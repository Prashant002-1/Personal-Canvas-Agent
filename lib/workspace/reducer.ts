import type { UIMessage } from "ai";
import { z } from "zod";
import type {
  WorkspaceAction,
  WorkspaceEvidence,
  WorkspaceFocus,
  WorkspacePanelId,
  WorkspaceSlot,
} from "@/lib/workspace/contracts";
import { workspaceDecisionInputSchema } from "@/lib/workspace/decision-schema";
import type { WorkspaceDecision } from "@/lib/workspace/decision-schema";
import {
  validateWorkspaceDecision,
  VIEW_DATA_REQUIREMENTS,
} from "@/lib/workspace/validation";

export type WorkspaceSlotPanel = {
  panelId: WorkspacePanelId;
  data: unknown;
};

export type WorkspaceState = {
  decision: WorkspaceDecision | null;
  decisionKey: string | null;
  selectedEntity: WorkspaceFocus | null;
  panelsBySlot: Partial<Record<WorkspaceSlot, WorkspaceSlotPanel>>;
  availableActions: WorkspaceAction[];
  evidence: WorkspaceEvidence[];
  dataByTarget: Record<string, unknown>;
  dataTargets: string[];
  requiredDataTargets: string[];
  toolSummaries: string[];
  validationErrors: string[];
};

const looseRow = z.record(z.string(), z.unknown());

const plannerTodaySchema = z.object({
  dueToday: z.array(looseRow),
  overdue: z.array(looseRow),
  recentAnnouncements: z.array(looseRow),
});

const weeklyWorkloadSchema = z.object({
  days: z.array(
    z.object({
      dateKey: z.string(),
      label: z.string(),
      isoDate: z.string(),
      loadScore: z.number(),
      items: z.array(
        z.object({
          id: z.string(),
          kind: z.enum(["assignment", "quiz", "discussion", "calendar_event"]),
          title: z.string(),
          at: z.string().nullable(),
          courseId: z.number().nullable().optional(),
          courseCode: z.string().nullable().optional(),
          assignmentId: z.number().nullable().optional(),
          htmlUrl: z.string().nullable().optional(),
        })
      ),
    })
  ),
  busiestDay: z
    .object({
      dateKey: z.string(),
      label: z.string(),
      loadScore: z.number(),
    })
    .nullable(),
  totalItems: z.number(),
});

const assignmentExecutionSchema = z.object({
  assignment: looseRow,
  course: looseRow,
  submission: looseRow.nullable(),
  module: looseRow.nullable(),
  relatedAssignments: z.array(looseRow),
  resources: z.object({
    pages: z.array(looseRow),
    files: z.array(looseRow),
  }),
  announcements: z.array(looseRow),
});

const searchResultsSchema = z.object({
  matches: z.array(looseRow),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isToolPayload(
  value: unknown
): value is { uiTarget: string; payload: unknown; summary: string } {
  if (!isRecord(value)) return false;
  return (
    typeof value.uiTarget === "string" &&
    typeof value.summary === "string" &&
    "payload" in value
  );
}

type ToolPart = Extract<
  UIMessage["parts"][number],
  { type: `tool-${string}` | "dynamic-tool" }
>;

function isToolPart(p: UIMessage["parts"][number]): p is ToolPart {
  return p.type === "dynamic-tool" || p.type.startsWith("tool-");
}

function decisionKey(decision: WorkspaceDecision): string {
  return JSON.stringify({
    view: decision.view,
    goal: decision.goal,
    focus: decision.focus,
    reason: decision.reason,
  });
}

function relativeDueLabel(value: string | null | undefined): string {
  if (!value) return "No due date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No due date";
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function taskFromRow(
  prefix: string,
  row: Record<string, unknown>,
  tone: "urgent" | "steady" | "later"
) {
  const id =
    typeof row.id === "number" || typeof row.id === "string"
      ? `${prefix}-${row.id}`
      : `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    title:
      typeof row.name === "string"
        ? row.name
        : typeof row.title === "string"
          ? row.title
          : prefix,
    courseCode:
      typeof row.course_code === "string"
        ? row.course_code
        : typeof row.code === "string"
          ? row.code
          : null,
    dueLabel: relativeDueLabel(
      typeof row.due_at === "string"
        ? row.due_at
        : typeof row.at === "string"
          ? row.at
          : null
    ),
    assignmentId: typeof row.id === "number" ? row.id : null,
    courseId: typeof row.course_id === "number" ? row.course_id : null,
    tone,
  };
}

function buildEvidencePanelData(
  decision: WorkspaceDecision,
  toolSummaries: string[]
): {
  reason: string;
  evidence: Array<{ kind: string; label: string }>;
} {
  return {
    reason: decision.reason,
    evidence: [
      ...decision.evidence.map((item) => ({
        kind: item.kind,
        label: item.label,
      })),
      ...toolSummaries.map((summary) => ({
        kind: "tool_summary",
        label: summary,
      })),
    ],
  };
}

function buildTodayDeskPanels(
  decision: WorkspaceDecision,
  dataByTarget: Record<string, unknown>,
  toolSummaries: string[]
): Partial<Record<WorkspaceSlot, WorkspaceSlotPanel>> {
  const parsed = plannerTodaySchema.safeParse(dataByTarget["planner.today"]);
  if (!parsed.success) return {};

  const { dueToday, overdue, recentAnnouncements } = parsed.data;
  const nowTasks = overdue.map((row) => taskFromRow("overdue", row, "urgent"));
  const nextTasks = dueToday.map((row) => taskFromRow("today", row, "steady"));
  const allTasks = [...nowTasks, ...nextTasks];

  return {
    hero: {
      panelId: "priorityBoard",
      data: {
        headline:
          nowTasks.length > 0
            ? "Recover what has already slipped."
            : nextTasks.length > 0
              ? "Finish what is due before the day closes."
              : "You have breathing room today.",
        lanes: [
          { id: "now", title: "Now", tasks: nowTasks },
          { id: "next", title: "Next", tasks: nextTasks },
          { id: "later", title: "Later", tasks: [] },
        ],
      },
    },
    main: {
      panelId: "taskStack",
      data: {
        title: "Execution stack",
        items: allTasks,
        emptyLabel: "No urgent work was found for today.",
      },
    },
    rail: {
      panelId: "announcementActions",
      data: {
        items: recentAnnouncements.slice(0, 4).map((item, index) => ({
          id: `announcement-${index}`,
          title:
            typeof item.title === "string" ? item.title : "Recent announcement",
          courseCode:
            typeof item.course_code === "string" ? item.course_code : null,
          prompt: typeof item.title === "string" ? item.title : "announcement",
        })),
      },
    },
    footer: {
      panelId: "evidencePanel",
      data: buildEvidencePanelData(decision, toolSummaries),
    },
  };
}

function buildWeekMapPanels(
  decision: WorkspaceDecision,
  dataByTarget: Record<string, unknown>,
  toolSummaries: string[]
): Partial<Record<WorkspaceSlot, WorkspaceSlotPanel>> {
  const parsed = weeklyWorkloadSchema.safeParse(
    dataByTarget["planner.weekly-workload"]
  );
  if (!parsed.success) return {};

  const flattened = parsed.data.days.flatMap((day) =>
    day.items.map((item) => ({
      id: item.id,
      title: item.title,
      courseCode: item.courseCode ?? null,
      dueLabel: relativeDueLabel(item.at),
      assignmentId: item.assignmentId ?? null,
      courseId: item.courseId ?? null,
      tone:
        day.loadScore >= 4
          ? ("urgent" as const)
          : day.loadScore >= 2
            ? ("steady" as const)
            : ("later" as const),
    }))
  );

  return {
    hero: {
      panelId: "weekTimeline",
      data: {
        days: parsed.data.days,
        busiestLabel: parsed.data.busiestDay?.label ?? null,
      },
    },
    main: {
      panelId: "taskStack",
      data: {
        title: "What is loading your week",
        items: flattened.slice(0, 8),
        emptyLabel: "This week looks unusually light.",
      },
    },
    footer: {
      panelId: "evidencePanel",
      data: buildEvidencePanelData(decision, toolSummaries),
    },
  };
}

function buildAssignmentFocusPanels(
  decision: WorkspaceDecision,
  dataByTarget: Record<string, unknown>,
  toolSummaries: string[]
): Partial<Record<WorkspaceSlot, WorkspaceSlotPanel>> {
  const parsed = assignmentExecutionSchema.safeParse(
    dataByTarget["assignment.execution"]
  );
  if (!parsed.success) return {};

  const { assignment, course, submission, module, relatedAssignments, resources, announcements } =
    parsed.data;

  const assignmentName =
    typeof assignment.name === "string" ? assignment.name : "Assignment";
  const courseCode =
    typeof course.code === "string" ? course.code : "Course";
  const submissionState =
    submission && submission.missing === true
      ? "Missing"
      : submission && typeof submission.submitted_at === "string"
        ? "Submitted"
        : "Not submitted";
  const effort =
    typeof assignment.points_possible === "number" && assignment.points_possible >= 100
      ? "High effort"
      : typeof assignment.points_possible === "number" && assignment.points_possible >= 40
        ? "Medium effort"
        : "Low effort";

  const executionItems = [
    {
      id: "assignment-primary",
      title:
        submission && submission.missing === true
          ? "Recover this assignment before anything else"
          : `Advance ${assignmentName}`,
      courseCode,
      dueLabel: relativeDueLabel(
        typeof assignment.due_at === "string" ? assignment.due_at : null
      ),
      assignmentId:
        typeof assignment.id === "number" ? assignment.id : null,
      courseId: typeof course.id === "number" ? course.id : null,
      tone: submission && submission.missing === true ? "urgent" : "steady",
    },
    ...relatedAssignments.slice(0, 2).map((item) => taskFromRow("related", item, "later")),
  ];

  return {
    hero: {
      panelId: "assignmentSummary",
      data: {
        assignmentId:
          typeof assignment.id === "number" ? assignment.id : null,
        courseId: typeof course.id === "number" ? course.id : null,
        courseCode,
        name: assignmentName,
        dueLabel: relativeDueLabel(
          typeof assignment.due_at === "string" ? assignment.due_at : null
        ),
        statusLabel: submissionState,
        effortLabel: effort,
        moduleName: typeof module?.name === "string" ? module.name : null,
        pointsLabel:
          typeof assignment.points_possible === "number"
            ? `${assignment.points_possible} pts`
            : "Points unavailable",
        nextStep:
          submission && submission.missing === true
            ? "Recover the missing work and ask for flexibility only if needed."
            : "Open the assignment context and get a focused work block going.",
      },
    },
    main: {
      panelId: "taskStack",
      data: {
        title: "Execution plan",
        items: executionItems,
        emptyLabel: "No immediate follow-up tasks were found.",
      },
    },
    secondary: {
      panelId: "resourceSuggestions",
      data: {
        items: [
          ...resources.pages.map((page, index) => ({
            id: `page-${index}`,
            title:
              typeof page.title === "string" ? page.title : "Course page",
            kind: "page",
            href: typeof page.url === "string" ? page.url : null,
            subtitle: "Recent course page",
          })),
          ...resources.files.map((file, index) => ({
            id: `file-${index}`,
            title:
              typeof file.display_name === "string"
                ? file.display_name
                : typeof file.filename === "string"
                  ? file.filename
                  : "Course file",
            kind: "file",
            href: typeof file.url === "string" ? file.url : null,
            subtitle: "Recent course file",
          })),
          ...announcements.slice(0, 2).map((item, index) => ({
            id: `announcement-${index}`,
            title:
              typeof item.title === "string" ? item.title : "Announcement",
            kind: "announcement",
            href: typeof item.html_url === "string" ? item.html_url : null,
            subtitle: "Recent announcement",
          })),
        ],
      },
    },
    footer: {
      panelId: "evidencePanel",
      data: buildEvidencePanelData(decision, toolSummaries),
    },
  };
}

function buildSearchResultsPanels(
  decision: WorkspaceDecision,
  dataByTarget: Record<string, unknown>,
  toolSummaries: string[]
): Partial<Record<WorkspaceSlot, WorkspaceSlotPanel>> {
  const parsed = searchResultsSchema.safeParse(
    dataByTarget["assignments.search-results"]
  );
  if (!parsed.success) return {};

  return {
    main: {
      panelId: "taskStack",
      data: {
        title: "Matching assignments",
        items: parsed.data.matches.map((item) => taskFromRow("search", item, "steady")),
        emptyLabel: "No assignments matched that search.",
      },
    },
    footer: {
      panelId: "evidencePanel",
      data: buildEvidencePanelData(decision, toolSummaries),
    },
  };
}

function buildPanels(
  decision: WorkspaceDecision,
  dataByTarget: Record<string, unknown>,
  toolSummaries: string[]
): Partial<Record<WorkspaceSlot, WorkspaceSlotPanel>> {
  switch (decision.view) {
    case "todayDesk":
      return buildTodayDeskPanels(decision, dataByTarget, toolSummaries);
    case "weekMap":
      return buildWeekMapPanels(decision, dataByTarget, toolSummaries);
    case "assignmentFocus":
      return buildAssignmentFocusPanels(decision, dataByTarget, toolSummaries);
    case "searchResults":
      return buildSearchResultsPanels(decision, dataByTarget, toolSummaries);
    case "coursePulse":
      return {
        footer: {
          panelId: "evidencePanel",
          data: buildEvidencePanelData(decision, toolSummaries),
        },
      };
  }
}

export function reduceWorkspaceFromMessages(
  messages: UIMessage[]
): WorkspaceState {
  let decision: WorkspaceDecision | null = null;
  let dataByTarget: Record<string, unknown> = {};
  let toolSummaries: string[] = [];
  let dataTargets: string[] = [];
  let validationErrors: string[] = [];

  for (const message of messages) {
    if (message.role !== "assistant") continue;
    for (const part of message.parts) {
      if (!isToolPart(part) || part.state !== "output-available") continue;
      if (!isToolPayload(part.output)) continue;

      const output = part.output;

      if (output.uiTarget === "workspace.decision") {
        const parsed = workspaceDecisionInputSchema.safeParse(output.payload);
        if (!parsed.success) {
          validationErrors = ["Invalid workspace decision payload."];
          continue;
        }
        const validation = validateWorkspaceDecision(parsed.data);
        decision = parsed.data;
        dataByTarget = {};
        toolSummaries = [output.summary];
        dataTargets = [];
        validationErrors = validation.errors;
        continue;
      }

      if (!decision) continue;

      dataByTarget[output.uiTarget] = output.payload;
      dataTargets.push(output.uiTarget);
      toolSummaries.push(output.summary);
    }
  }

  if (!decision) {
    return {
      decision: null,
      decisionKey: null,
      selectedEntity: null,
      panelsBySlot: {},
      availableActions: [],
      evidence: [],
      dataByTarget: {},
      dataTargets: [],
      requiredDataTargets: [],
      toolSummaries: [],
      validationErrors: [],
    };
  }

  const requiredDataTargets = VIEW_DATA_REQUIREMENTS[decision.view];
  const missing = requiredDataTargets.filter((target) => !(target in dataByTarget));
  const panelsBySlot = buildPanels(decision, dataByTarget, toolSummaries);

  return {
    decision,
    decisionKey: decisionKey(decision),
    selectedEntity: decision.focus,
    panelsBySlot,
    availableActions: decision.actions,
    evidence: decision.evidence,
    dataByTarget,
    dataTargets,
    requiredDataTargets,
    toolSummaries,
    validationErrors: [
      ...validationErrors,
      ...missing.map((target) => `Missing data for "${target}".`),
    ],
  };
}

"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { z } from "zod";
import {
  AlertTriangle,
  ArrowRight,
  CalendarRange,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  Lightbulb,
  Search,
  ShieldAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type {
  WorkspaceAction,
  WorkspaceFocus,
  WorkspacePanelId,
} from "@/lib/workspace/contracts";

type PanelRenderProps = {
  onAction: (action: WorkspaceAction) => void;
  deferredTaskIds: string[];
};

const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  courseCode: z.string().nullable(),
  dueLabel: z.string(),
  assignmentId: z.number().nullable(),
  courseId: z.number().nullable(),
  tone: z.enum(["urgent", "steady", "later"]),
});

const priorityBoardSchema = z.object({
  headline: z.string(),
  lanes: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      tasks: z.array(taskSchema),
    })
  ),
});

const taskStackSchema = z.object({
  title: z.string(),
  items: z.array(taskSchema),
  emptyLabel: z.string(),
});

const announcementActionsSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      courseCode: z.string().nullable(),
      prompt: z.string(),
    })
  ),
});

const evidencePanelSchema = z.object({
  reason: z.string(),
  evidence: z.array(
    z.object({
      kind: z.string(),
      label: z.string(),
    })
  ),
});

const weekTimelineSchema = z.object({
  days: z.array(
    z.object({
      dateKey: z.string(),
      label: z.string(),
      loadScore: z.number(),
      items: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          kind: z.string(),
          courseCode: z.string().nullable().optional(),
          at: z.string().nullable(),
        })
      ),
    })
  ),
  busiestLabel: z.string().nullable(),
});

const assignmentSummarySchema = z.object({
  assignmentId: z.number().nullable(),
  courseId: z.number().nullable(),
  courseCode: z.string(),
  name: z.string(),
  dueLabel: z.string(),
  statusLabel: z.string(),
  effortLabel: z.string(),
  moduleName: z.string().nullable(),
  pointsLabel: z.string(),
  nextStep: z.string(),
});

const resourceSuggestionsSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      kind: z.enum(["page", "file", "announcement"]),
      href: z.string().nullable(),
      subtitle: z.string().nullable().optional(),
    })
  ),
});

const riskSummarySchema = z.object({
  headline: z.string(),
  notes: z.array(z.string()),
});

export function BlockError({ message }: { message: string }) {
  return (
    <div className="rounded-3xl border border-red-300/40 bg-red-500/5 px-4 py-3 text-sm text-red-700 dark:text-red-300">
      {message}
    </div>
  );
}

function cardTone(tone: "urgent" | "steady" | "later"): string {
  switch (tone) {
    case "urgent":
      return "border-red-300/40 bg-red-500/5";
    case "steady":
      return "border-primary/20 bg-primary/5";
    case "later":
      return "border-border/60 bg-card/70";
  }
}

function PriorityBoardPanel({
  data,
}: {
  data: z.infer<typeof priorityBoardSchema>;
}) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-muted-foreground">Primary recommendation</p>
        <h2 className="text-2xl font-semibold tracking-tight mt-1">
          {data.headline}
        </h2>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {data.lanes.map((lane, index) => (
          <motion.div
            key={lane.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.28,
              delay: index * 0.04,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="rounded-3xl border bg-card/80 p-4"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">{lane.title}</h3>
              <Badge variant="secondary" className="rounded-full">
                {lane.tasks.length}
              </Badge>
            </div>
            {lane.tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing queued.</p>
            ) : (
              <div className="space-y-3">
                {lane.tasks.map((task) => (
                  <div
                    key={task.id}
                    className={`rounded-2xl border px-3 py-3 ${cardTone(task.tone)}`}
                  >
                    <p className="font-medium text-sm leading-snug">{task.title}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      {task.courseCode && <span>{task.courseCode}</span>}
                      <span>{task.dueLabel}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function TaskStackPanel({
  data,
  onAction,
  deferredTaskIds,
}: {
  data: z.infer<typeof taskStackSchema>;
} & PanelRenderProps) {
  const visibleItems = data.items.filter(
    (item) => !deferredTaskIds.includes(item.id)
  );

  return (
    <div className="rounded-3xl border bg-card/80 p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Task stack
          </p>
          <h3 className="text-lg font-semibold mt-1">{data.title}</h3>
        </div>
        <Badge variant="outline" className="rounded-full">
          {visibleItems.length}
        </Badge>
      </div>

      {visibleItems.length === 0 ? (
        <p className="text-sm text-muted-foreground">{data.emptyLabel}</p>
      ) : (
        <div className="space-y-3">
          {visibleItems.map((task) => (
            <div
              key={task.id}
              className={`rounded-2xl border px-4 py-3 ${cardTone(task.tone)}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm leading-snug">{task.title}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    {task.courseCode && <span>{task.courseCode}</span>}
                    <span>{task.dueLabel}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {task.assignmentId && (
                    <button
                      onClick={() =>
                        onAction({
                          actionId: "focusAssignment",
                          label: "Focus",
                          assignmentId: task.assignmentId ?? undefined,
                        })
                      }
                      className="rounded-full border px-3 py-1 text-xs hover:bg-background transition-colors"
                    >
                      Focus
                    </button>
                  )}
                  <button
                    onClick={() =>
                      onAction({
                        actionId: "deferTask",
                        label: "Defer",
                        taskId: task.id,
                      })
                    }
                    className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Defer
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AnnouncementActionsPanel({
  data,
}: {
  data: z.infer<typeof announcementActionsSchema>;
}) {
  return (
    <div className="rounded-3xl border bg-card/80 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Lightbulb className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Announcements
        </h3>
      </div>
      {data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing new to translate into action.</p>
      ) : (
        <div className="space-y-3">
          {data.items.map((item) => (
            <div key={item.id} className="rounded-2xl border px-4 py-3">
              <p className="font-medium text-sm">{item.title}</p>
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                {item.courseCode && <span>{item.courseCode}</span>}
                <span>May affect today&apos;s priorities</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EvidencePanel({
  data,
}: {
  data: z.infer<typeof evidencePanelSchema>;
}) {
  return (
    <div className="rounded-3xl border bg-card/80 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Search className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Why this view
        </h3>
      </div>
      <p className="text-sm leading-relaxed mb-4">{data.reason}</p>
      <div className="space-y-2">
        {data.evidence.map((item, index) => (
          <div
            key={`${item.kind}-${index}`}
            className="rounded-2xl border bg-muted/30 px-3 py-2 text-sm"
          >
            <span className="font-medium capitalize">
              {item.kind.replaceAll("_", " ")}:
            </span>{" "}
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function WeekTimelinePanel({
  data,
}: {
  data: z.infer<typeof weekTimelineSchema>;
}) {
  return (
    <div className="rounded-3xl border bg-card/80 p-5">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <CalendarRange className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Week map
            </h3>
          </div>
          <p className="text-lg font-semibold mt-2">
            {data.busiestLabel
              ? `${data.busiestLabel} carries the highest load.`
              : "No heavy concentration detected this week."}
          </p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {data.days.map((day) => (
          <div key={day.dateKey} className="rounded-2xl border p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="font-medium text-sm">{day.label}</p>
              <Badge
                variant="outline"
                className={`rounded-full ${
                  day.loadScore >= 4
                    ? "border-red-300/40 text-red-600"
                    : day.loadScore >= 2
                      ? "border-amber-300/40 text-amber-600"
                      : ""
                }`}
              >
                {day.loadScore}
              </Badge>
            </div>
            <div className="space-y-2">
              {day.items.length === 0 ? (
                <p className="text-xs text-muted-foreground">Open space.</p>
              ) : (
                day.items.slice(0, 4).map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl bg-muted/40 px-3 py-2 text-xs"
                  >
                    <p className="font-medium">{item.title}</p>
                    <p className="text-muted-foreground mt-1">
                      {item.courseCode ?? item.kind}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AssignmentSummaryPanel({
  data,
  onAction,
}: {
  data: z.infer<typeof assignmentSummarySchema>;
} & Pick<PanelRenderProps, "onAction">) {
  return (
    <div className="rounded-[2rem] border bg-card/90 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {data.courseCode}
          </p>
          <h2 className="text-2xl font-semibold tracking-tight mt-2">
            {data.name}
          </h2>
          <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
            {data.nextStep}
          </p>
        </div>
        <button
          onClick={() =>
            onAction({
              actionId: "buildStudySession",
              label: "Build a 45-minute study session",
              minutes: 45,
            })
          }
          className="rounded-2xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity shrink-0"
        >
          Build 45-min block
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 mt-6">
        <div className="rounded-2xl border p-4">
          <p className="text-xs text-muted-foreground">Due</p>
          <p className="font-medium mt-2">{data.dueLabel}</p>
        </div>
        <div className="rounded-2xl border p-4">
          <p className="text-xs text-muted-foreground">Status</p>
          <p className="font-medium mt-2">{data.statusLabel}</p>
        </div>
        <div className="rounded-2xl border p-4">
          <p className="text-xs text-muted-foreground">Effort</p>
          <p className="font-medium mt-2">{data.effortLabel}</p>
        </div>
        <div className="rounded-2xl border p-4">
          <p className="text-xs text-muted-foreground">Context</p>
          <p className="font-medium mt-2">
            {data.moduleName ?? data.pointsLabel}
          </p>
        </div>
      </div>
    </div>
  );
}

function ResourceSuggestionsPanel({
  data,
}: {
  data: z.infer<typeof resourceSuggestionsSchema>;
}) {
  return (
    <div className="rounded-3xl border bg-card/80 p-5">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Helpful context
        </h3>
      </div>
      {data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No resources surfaced yet.</p>
      ) : (
        <div className="space-y-3">
          {data.items.map((item) => (
            <div key={item.id} className="rounded-2xl border px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-sm">{item.title}</p>
                  {item.subtitle && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {item.subtitle}
                    </p>
                  )}
                </div>
                {item.href && (
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RiskSummaryPanel({
  data,
}: {
  data: z.infer<typeof riskSummarySchema>;
}) {
  return (
    <div className="rounded-3xl border bg-card/80 p-5">
      <div className="flex items-center gap-2 mb-4">
        <ShieldAlert className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Course pulse
        </h3>
      </div>
      <p className="text-lg font-semibold">{data.headline}</p>
      <ul className="space-y-2 mt-4">
        {data.notes.map((note, index) => (
          <li key={index} className="rounded-2xl border px-3 py-2 text-sm">
            {note}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function renderWorkspacePanel(
  panelId: WorkspacePanelId,
  data: unknown,
  props: PanelRenderProps
): ReactNode {
  switch (panelId) {
    case "priorityBoard": {
      const parsed = priorityBoardSchema.safeParse(data);
      return parsed.success ? (
        <PriorityBoardPanel data={parsed.data} />
      ) : (
        <BlockError message="Invalid priorityBoard payload." />
      );
    }
    case "taskStack": {
      const parsed = taskStackSchema.safeParse(data);
      return parsed.success ? (
        <TaskStackPanel
          data={parsed.data}
          onAction={props.onAction}
          deferredTaskIds={props.deferredTaskIds}
        />
      ) : (
        <BlockError message="Invalid taskStack payload." />
      );
    }
    case "announcementActions": {
      const parsed = announcementActionsSchema.safeParse(data);
      return parsed.success ? (
        <AnnouncementActionsPanel data={parsed.data} />
      ) : (
        <BlockError message="Invalid announcementActions payload." />
      );
    }
    case "evidencePanel": {
      const parsed = evidencePanelSchema.safeParse(data);
      return parsed.success ? (
        <EvidencePanel data={parsed.data} />
      ) : (
        <BlockError message="Invalid evidencePanel payload." />
      );
    }
    case "weekTimeline": {
      const parsed = weekTimelineSchema.safeParse(data);
      return parsed.success ? (
        <WeekTimelinePanel data={parsed.data} />
      ) : (
        <BlockError message="Invalid weekTimeline payload." />
      );
    }
    case "assignmentSummary": {
      const parsed = assignmentSummarySchema.safeParse(data);
      return parsed.success ? (
        <AssignmentSummaryPanel data={parsed.data} onAction={props.onAction} />
      ) : (
        <BlockError message="Invalid assignmentSummary payload." />
      );
    }
    case "resourceSuggestions": {
      const parsed = resourceSuggestionsSchema.safeParse(data);
      return parsed.success ? (
        <ResourceSuggestionsPanel data={parsed.data} />
      ) : (
        <BlockError message="Invalid resourceSuggestions payload." />
      );
    }
    case "riskSummary": {
      const parsed = riskSummarySchema.safeParse(data);
      return parsed.success ? (
        <RiskSummaryPanel data={parsed.data} />
      ) : (
        <BlockError message="Invalid riskSummary payload." />
      );
    }
  }
}

function focusLabel(focus: WorkspaceFocus): string {
  switch (focus.mode) {
    case "today":
      return "Today";
    case "week":
      return "This week";
    case "course":
      return focus.courseCode ?? `Course #${focus.courseId}`;
    case "assignment":
      return focus.assignmentName ?? `Assignment #${focus.assignmentId}`;
    case "search":
      return `Search: ${focus.queryText}`;
  }
}

export function WorkspaceFocusBadge({ focus }: { focus: WorkspaceFocus }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
      <Clock3 className="w-3 h-3" />
      <span className="font-medium text-foreground">{focusLabel(focus)}</span>
    </div>
  );
}

export function WorkspaceStatusBadge({
  accepted,
  dismissed,
}: {
  accepted: boolean;
  dismissed: boolean;
}) {
  if (dismissed) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground">
        <AlertTriangle className="w-3 h-3" />
        Plan dismissed
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="w-3 h-3" />
        Plan accepted
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground">
      Agent-selected view
      <ArrowRight className="w-3 h-3" />
    </div>
  );
}

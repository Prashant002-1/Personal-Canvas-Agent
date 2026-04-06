import type {
  WorkspaceActionId,
  WorkspaceFocus,
  WorkspaceGoal,
  WorkspacePanelId,
  WorkspaceSlot,
  WorkspaceView,
} from "@/lib/workspace/contracts";
import type { WorkspaceDecision } from "@/lib/workspace/decision-schema";

type ViewRule = {
  goal: WorkspaceGoal;
  focusModes: WorkspaceFocus["mode"][];
  slots: WorkspaceSlot[];
  panels: WorkspacePanelId[];
  actions: WorkspaceActionId[];
};

const VIEW_RULES: Record<WorkspaceView, ViewRule> = {
  todayDesk: {
    goal: "today_plan",
    focusModes: ["today"],
    slots: ["hero", "main", "rail", "footer"],
    panels: [
      "priorityBoard",
      "taskStack",
      "announcementActions",
      "evidencePanel",
    ],
    actions: [
      "acceptPlan",
      "dismissPlan",
      "showEvidence",
      "buildStudySession",
    ],
  },
  weekMap: {
    goal: "weekly_load",
    focusModes: ["week"],
    slots: ["hero", "main", "rail", "footer"],
    panels: ["weekTimeline", "taskStack", "evidencePanel"],
    actions: [
      "acceptPlan",
      "dismissPlan",
      "showEvidence",
      "buildStudySession",
      "focusAssignment",
    ],
  },
  assignmentFocus: {
    goal: "assignment_execution",
    focusModes: ["assignment"],
    slots: ["hero", "main", "secondary", "footer"],
    panels: [
      "assignmentSummary",
      "taskStack",
      "resourceSuggestions",
      "evidencePanel",
    ],
    actions: [
      "buildStudySession",
      "showEvidence",
      "showResources",
      "focusCourse",
      "dismissPlan",
    ],
  },
  coursePulse: {
    goal: "course_risk",
    focusModes: ["course"],
    slots: ["hero", "main", "rail", "footer"],
    panels: ["riskSummary", "taskStack", "evidencePanel"],
    actions: ["showEvidence", "focusAssignment", "dismissPlan"],
  },
  searchResults: {
    goal: "search_results",
    focusModes: ["search"],
    slots: ["hero", "main", "footer"],
    panels: ["taskStack", "evidencePanel"],
    actions: ["focusAssignment", "focusCourse", "dismissPlan"],
  },
};

export const VIEW_DATA_REQUIREMENTS: Record<WorkspaceView, string[]> = {
  todayDesk: ["planner.today"],
  weekMap: ["planner.weekly-workload"],
  assignmentFocus: ["assignment.execution"],
  coursePulse: ["course.risk"],
  searchResults: ["assignments.search-results"],
};

export function validateWorkspaceDecision(decision: WorkspaceDecision): {
  success: boolean;
  errors: string[];
} {
  const rule = VIEW_RULES[decision.view];
  const errors: string[] = [];

  if (decision.goal !== rule.goal) {
    errors.push(
      `View "${decision.view}" is reserved for goal "${rule.goal}", not "${decision.goal}".`
    );
  }

  if (!rule.focusModes.includes(decision.focus.mode)) {
    errors.push(
      `Focus mode "${decision.focus.mode}" is not valid for "${decision.view}".`
    );
  }

  const seenSlots = new Set<string>();
  for (const panel of decision.panels) {
    if (!rule.slots.includes(panel.slot)) {
      errors.push(
        `Slot "${panel.slot}" is not available in "${decision.view}".`
      );
    }
    if (!rule.panels.includes(panel.panelId)) {
      errors.push(
        `Panel "${panel.panelId}" is not allowed in "${decision.view}".`
      );
    }
    if (seenSlots.has(panel.slot)) {
      errors.push(`Slot "${panel.slot}" may only contain one panel.`);
    }
    seenSlots.add(panel.slot);
  }

  for (const action of decision.actions) {
    if (!rule.actions.includes(action.actionId)) {
      errors.push(
        `Action "${action.actionId}" is not allowed in "${decision.view}".`
      );
    }
  }

  return {
    success: errors.length === 0,
    errors,
  };
}

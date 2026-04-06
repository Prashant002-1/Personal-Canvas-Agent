import type { WorkspaceAction } from "@/lib/workspace/contracts";
import type { WorkspaceState } from "@/lib/workspace/reducer";

export type WorkspaceUiState = {
  decisionKey: string | null;
  showEvidence: boolean;
  showResources: boolean;
  acceptedDecisionKey: string | null;
  dismissedDecisionKey: string | null;
  deferredTaskIds: string[];
};

export type QueuedWorkspaceMessage = {
  key: string;
  text: string;
};

export function createInitialWorkspaceUiState(
  decisionKey: string | null = null
): WorkspaceUiState {
  return {
    decisionKey,
    showEvidence: false,
    showResources: false,
    acceptedDecisionKey: null,
    dismissedDecisionKey: null,
    deferredTaskIds: [],
  };
}

type ActionResult = {
  uiState: WorkspaceUiState;
  queuedMessage?: QueuedWorkspaceMessage;
};

function buildPromptForAction(
  action: WorkspaceAction
): string | null {
  switch (action.actionId) {
    case "focusAssignment":
      return action.assignmentId
        ? `Focus on assignment ${action.assignmentId} and switch the workspace to assignment execution.`
        : "Focus on the most urgent assignment and switch the workspace to assignment execution.";
    case "focusCourse":
      return action.courseId
        ? `Focus on course ${action.courseId} and show the course context that matters most right now.`
        : "Focus on the course that matters most right now.";
    case "buildStudySession":
      return `Build me a ${action.minutes}-minute study session based on the current workspace focus.`;
    default:
      return null;
  }
}

export function dispatchWorkspaceAction({
  action,
  state,
  uiState,
}: {
  action: WorkspaceAction;
  state: WorkspaceState;
  uiState: WorkspaceUiState;
}): ActionResult {
  switch (action.actionId) {
    case "showEvidence":
      return {
        uiState: {
          ...uiState,
          decisionKey: state.decisionKey,
          showEvidence: true,
        },
      };
    case "showResources":
      return {
        uiState: {
          ...uiState,
          decisionKey: state.decisionKey,
          showResources: true,
        },
      };
    case "acceptPlan":
      return {
        uiState: {
          ...uiState,
          decisionKey: state.decisionKey,
          acceptedDecisionKey: state.decisionKey,
          dismissedDecisionKey: null,
        },
      };
    case "dismissPlan":
      return {
        uiState: {
          ...uiState,
          decisionKey: state.decisionKey,
          dismissedDecisionKey: state.decisionKey,
        },
      };
    case "deferTask":
      return {
        uiState: {
          ...uiState,
          decisionKey: state.decisionKey,
          deferredTaskIds: [...uiState.deferredTaskIds, action.taskId],
        },
      };
    case "focusAssignment":
    case "focusCourse":
    case "buildStudySession": {
      const text = buildPromptForAction(action);
      return {
        uiState: {
          ...uiState,
          decisionKey: state.decisionKey,
        },
        queuedMessage: text
          ? {
              key: `${action.actionId}-${Date.now()}`,
              text,
            }
          : undefined,
      };
    }
  }
}

"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import type {
  WorkspaceAction,
  WorkspaceView,
} from "@/lib/workspace/contracts";
import type {
  WorkspaceSlotPanel,
  WorkspaceState,
} from "@/lib/workspace/reducer";
import { renderWorkspacePanel } from "@/components/workspace/panel-registry";
import type { WorkspaceUiState } from "@/lib/workspace/actions";

type LayoutProps = {
  state: WorkspaceState;
  uiState: WorkspaceUiState;
  onAction: (action: WorkspaceAction) => void;
};

function renderSlot(
  panel: WorkspaceSlotPanel | undefined,
  props: {
    onAction: (action: WorkspaceAction) => void;
    deferredTaskIds: string[];
  }
): ReactNode {
  if (!panel) return null;
  return renderWorkspacePanel(panel.panelId, panel.data, props);
}

function ActionRow({
  actions,
  onAction,
}: {
  actions: WorkspaceAction[];
  onAction: (action: WorkspaceAction) => void;
}) {
  if (actions.length === 0) return null;
  const [primary, ...secondary] = actions;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={() => onAction(primary)}
        className="rounded-2xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
      >
        {primary.label}
      </button>
      {secondary.map((action) => (
        <button
          key={action.label}
          onClick={() => onAction(action)}
          className="rounded-2xl border px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}

function TodayDeskLayout({ state, uiState, onAction }: LayoutProps) {
  const evidenceVisible = uiState.showEvidence || !state.availableActions.some((action) => action.actionId === "showEvidence");

  return (
    <div className="space-y-6">
      {renderSlot(state.panelsBySlot.hero, {
        onAction,
        deferredTaskIds: uiState.deferredTaskIds,
      })}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_360px]">
        <div className="space-y-6">
          <ActionRow actions={state.availableActions} onAction={onAction} />
          {renderSlot(state.panelsBySlot.main, {
            onAction,
            deferredTaskIds: uiState.deferredTaskIds,
          })}
        </div>
        <div className="space-y-6">
          {renderSlot(state.panelsBySlot.rail, {
            onAction,
            deferredTaskIds: uiState.deferredTaskIds,
          })}
        </div>
      </div>
      {evidenceVisible &&
        renderSlot(state.panelsBySlot.footer, {
          onAction,
          deferredTaskIds: uiState.deferredTaskIds,
        })}
    </div>
  );
}

function WeekMapLayout({ state, uiState, onAction }: LayoutProps) {
  const evidenceVisible = uiState.showEvidence || !state.availableActions.some((action) => action.actionId === "showEvidence");

  return (
    <div className="space-y-6">
      {renderSlot(state.panelsBySlot.hero, {
        onAction,
        deferredTaskIds: uiState.deferredTaskIds,
      })}
      <div className="space-y-6">
        <ActionRow actions={state.availableActions} onAction={onAction} />
        {renderSlot(state.panelsBySlot.main, {
          onAction,
          deferredTaskIds: uiState.deferredTaskIds,
        })}
      </div>
      {evidenceVisible &&
        renderSlot(state.panelsBySlot.footer, {
          onAction,
          deferredTaskIds: uiState.deferredTaskIds,
        })}
    </div>
  );
}

function AssignmentFocusLayout({ state, uiState, onAction }: LayoutProps) {
  const evidenceVisible = uiState.showEvidence || !state.availableActions.some((action) => action.actionId === "showEvidence");
  const resourcesVisible = uiState.showResources || !state.availableActions.some((action) => action.actionId === "showResources");

  return (
    <div className="space-y-6">
      {renderSlot(state.panelsBySlot.hero, {
        onAction,
        deferredTaskIds: uiState.deferredTaskIds,
      })}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_360px]">
        <div className="space-y-6">
          <ActionRow actions={state.availableActions} onAction={onAction} />
          {renderSlot(state.panelsBySlot.main, {
            onAction,
            deferredTaskIds: uiState.deferredTaskIds,
          })}
          {evidenceVisible &&
            renderSlot(state.panelsBySlot.footer, {
              onAction,
              deferredTaskIds: uiState.deferredTaskIds,
            })}
        </div>
        <div className="space-y-6">
          {resourcesVisible &&
            renderSlot(state.panelsBySlot.secondary, {
              onAction,
              deferredTaskIds: uiState.deferredTaskIds,
            })}
        </div>
      </div>
    </div>
  );
}

export function renderWorkspaceLayout({ state, uiState, onAction }: LayoutProps) {
  const key = state.decision?.view ?? "empty";

  return (
    <motion.div
      key={key}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className="max-w-6xl"
    >
      {(() => {
        switch (state.decision?.view as WorkspaceView | undefined) {
          case "todayDesk":
            return <TodayDeskLayout state={state} uiState={uiState} onAction={onAction} />;
          case "weekMap":
            return <WeekMapLayout state={state} uiState={uiState} onAction={onAction} />;
          case "assignmentFocus":
            return <AssignmentFocusLayout state={state} uiState={uiState} onAction={onAction} />;
          case "searchResults":
          case "coursePulse":
            return <WeekMapLayout state={state} uiState={uiState} onAction={onAction} />;
          default:
            return null;
        }
      })()}
    </motion.div>
  );
}

"use client";

import { motion, AnimatePresence } from "framer-motion";
import { LayoutTemplate, Sparkles } from "lucide-react";
import type { WorkspaceAction } from "@/lib/workspace/contracts";
import type { WorkspaceState } from "@/lib/workspace/reducer";
import {
  WorkspaceFocusBadge,
  WorkspaceStatusBadge,
} from "@/components/workspace/panel-registry";
import { renderWorkspaceLayout } from "@/components/workspace/layout-registry";
import type { WorkspaceUiState } from "@/lib/workspace/actions";

export function WorkspaceCanvas({
  state,
  uiState,
  onAction,
}: {
  state: WorkspaceState;
  uiState: WorkspaceUiState;
  onAction: (action: WorkspaceAction) => void;
}) {
  const isAccepted = state.decisionKey !== null && uiState.acceptedDecisionKey === state.decisionKey;
  const isDismissed = state.decisionKey !== null && uiState.dismissedDecisionKey === state.decisionKey;

  return (
    <div className="flex flex-col min-h-0 flex-1 border-b bg-gradient-to-b from-muted/20 to-background">
      <div className="shrink-0 px-6 py-4 flex items-center justify-between gap-4 border-b border-border/50">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <LayoutTemplate className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight truncate">
              Workspace
            </h1>
            <p className="text-xs text-muted-foreground truncate">
              Agent-selected layouts, grounded panels, explicit actions.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {state.selectedEntity && <WorkspaceFocusBadge focus={state.selectedEntity} />}
          <WorkspaceStatusBadge accepted={isAccepted} dismissed={isDismissed} />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6">
        <AnimatePresence mode="wait">
          {state.decision ? (
            <div className="space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="max-w-6xl rounded-3xl border bg-card/70 px-5 py-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      {state.decision.goal.replaceAll("_", " ")}
                    </p>
                    <p className="text-sm leading-relaxed mt-2">
                      {state.decision.reason}
                    </p>
                  </div>
                  <div className="shrink-0 rounded-full border px-3 py-1 text-xs text-muted-foreground">
                    {state.decision.view}
                  </div>
                </div>
              </motion.div>

              {renderWorkspaceLayout({ state, uiState, onAction })}

              {state.validationErrors.length > 0 && (
                <div className="max-w-6xl rounded-3xl border border-amber-300/40 bg-amber-500/5 px-5 py-4">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                    Validation warnings
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-amber-700/90 dark:text-amber-300/90">
                    {state.validationErrors.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {process.env.NODE_ENV !== "production" && (
                <div className="max-w-6xl rounded-3xl border bg-background/80 px-5 py-4 text-xs text-muted-foreground">
                  <div className="grid gap-3 md:grid-cols-5">
                    <div>
                      <p className="uppercase tracking-[0.18em] mb-1">Goal</p>
                      <p className="text-foreground">{state.decision.goal}</p>
                    </div>
                    <div>
                      <p className="uppercase tracking-[0.18em] mb-1">View</p>
                      <p className="text-foreground">{state.decision.view}</p>
                    </div>
                    <div>
                      <p className="uppercase tracking-[0.18em] mb-1">Panels</p>
                      <p className="text-foreground">
                        {Object.values(state.panelsBySlot)
                          .map((panel) => panel?.panelId)
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    </div>
                    <div>
                      <p className="uppercase tracking-[0.18em] mb-1">Actions</p>
                      <p className="text-foreground">
                        {state.availableActions.map((action) => action.actionId).join(", ")}
                      </p>
                    </div>
                    <div>
                      <p className="uppercase tracking-[0.18em] mb-1">Data</p>
                      <p className="text-foreground">
                        {state.dataTargets.join(", ") || "none"}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center justify-center text-center max-w-md mx-auto py-16 px-4"
            >
              <div className="w-14 h-14 rounded-2xl bg-primary/8 flex items-center justify-center mb-6 ring-1 ring-primary/10">
                <Sparkles className="w-7 h-7 text-primary/80" />
              </div>
              <h2 className="text-xl font-semibold mb-2">The agent has not chosen a workspace yet</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Ask for what you need right now, such as today&apos;s plan, a weekly
                workload map, or an assignment focus view. The agent will pick a
                registered layout, explain why, and surface actions you can take.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

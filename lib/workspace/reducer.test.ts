import test from "node:test";
import assert from "node:assert/strict";
import { reduceWorkspaceFromMessages } from "@/lib/workspace/reducer";
import { validateWorkspaceDecision } from "@/lib/workspace/validation";
import {
  assignmentFocusFixtureMessages,
  todayDeskFixtureMessages,
  weekMapFixtureMessages,
} from "@/lib/workspace/scenario-fixtures";
import {
  createInitialWorkspaceUiState,
  dispatchWorkspaceAction,
} from "@/lib/workspace/actions";

test("todayDesk fixture reduces to priority + tasks + evidence", () => {
  const state = reduceWorkspaceFromMessages(todayDeskFixtureMessages);

  assert.equal(state.decision?.view, "todayDesk");
  assert.equal(state.panelsBySlot.hero?.panelId, "priorityBoard");
  assert.equal(state.panelsBySlot.main?.panelId, "taskStack");
  assert.equal(state.panelsBySlot.footer?.panelId, "evidencePanel");
  assert.deepEqual(
    state.availableActions.map((action) => action.actionId),
    ["acceptPlan", "showEvidence", "buildStudySession"]
  );
  assert.equal(state.validationErrors.length, 0);
});

test("weekMap fixture reduces to timeline and stacked work", () => {
  const state = reduceWorkspaceFromMessages(weekMapFixtureMessages);

  assert.equal(state.decision?.view, "weekMap");
  assert.equal(state.panelsBySlot.hero?.panelId, "weekTimeline");
  assert.equal(state.panelsBySlot.main?.panelId, "taskStack");
  assert.ok(state.dataTargets.includes("planner.weekly-workload"));
});

test("assignmentFocus fixture reduces to summary + resources", () => {
  const state = reduceWorkspaceFromMessages(assignmentFocusFixtureMessages);

  assert.equal(state.decision?.view, "assignmentFocus");
  assert.equal(state.panelsBySlot.hero?.panelId, "assignmentSummary");
  assert.equal(state.panelsBySlot.secondary?.panelId, "resourceSuggestions");
  assert.equal(state.selectedEntity?.mode, "assignment");
});

test("invalid decision is rejected by validation rules", () => {
  const invalidDecision = {
    goal: "today_plan",
    focus: { mode: "today" },
    view: "weekMap",
    panels: [
      { slot: "hero", panelId: "priorityBoard" },
      { slot: "main", panelId: "taskStack" },
    ],
    actions: [{ actionId: "acceptPlan", label: "Accept plan" }],
    reason: "This is intentionally mismatched for validation.",
    evidence: [{ kind: "user_request", label: "Show me today." }],
  } as const;

  const result = validateWorkspaceDecision(invalidDecision);
  assert.equal(result.success, false);
  assert.ok(result.errors.some((error) => error.includes("reserved for goal")));
});

test("workspace action dispatcher toggles evidence and queues study-session prompts", () => {
  const state = reduceWorkspaceFromMessages(assignmentFocusFixtureMessages);
  const initial = createInitialWorkspaceUiState(state.decisionKey);

  const evidenceResult = dispatchWorkspaceAction({
    action: { actionId: "showEvidence", label: "Show why" },
    state,
    uiState: initial,
  });
  assert.equal(evidenceResult.uiState.showEvidence, true);

  const sessionResult = dispatchWorkspaceAction({
    action: {
      actionId: "buildStudySession",
      label: "Build a 45-minute study session",
      minutes: 45,
    },
    state,
    uiState: evidenceResult.uiState,
  });
  assert.ok(sessionResult.queuedMessage?.text.includes("45-minute study session"));
});

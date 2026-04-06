import { z } from "zod";

export const workspaceGoalValues = [
  "today_plan",
  "weekly_load",
  "assignment_execution",
  "course_risk",
  "search_results",
] as const;

export const workspaceViewValues = [
  "todayDesk",
  "weekMap",
  "assignmentFocus",
  "coursePulse",
  "searchResults",
] as const;

export const workspaceSlotValues = [
  "hero",
  "main",
  "secondary",
  "rail",
  "footer",
] as const;

export const workspacePanelValues = [
  "priorityBoard",
  "weekTimeline",
  "taskStack",
  "assignmentSummary",
  "resourceSuggestions",
  "riskSummary",
  "announcementActions",
  "evidencePanel",
] as const;

export const workspaceActionIdValues = [
  "focusAssignment",
  "focusCourse",
  "buildStudySession",
  "deferTask",
  "showEvidence",
  "showResources",
  "acceptPlan",
  "dismissPlan",
] as const;

export const workspaceGoalSchema = z.enum(workspaceGoalValues);
export const workspaceViewSchema = z.enum(workspaceViewValues);
export const workspaceSlotSchema = z.enum(workspaceSlotValues);
export const workspacePanelSchema = z.enum(workspacePanelValues);
export const workspaceActionIdSchema = z.enum(workspaceActionIdValues);

export const workspaceFocusSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("today") }),
  z.object({ mode: z.literal("week") }),
  z.object({
    mode: z.literal("course"),
    courseId: z.number().int().positive(),
    courseCode: z.string().min(1).max(32).optional(),
    courseName: z.string().min(1).max(160).optional(),
  }),
  z.object({
    mode: z.literal("assignment"),
    assignmentId: z.number().int().positive(),
    assignmentName: z.string().min(1).max(200).optional(),
    courseId: z.number().int().positive().optional(),
    courseCode: z.string().min(1).max(32).optional(),
  }),
  z.object({
    mode: z.literal("search"),
    queryText: z.string().min(1).max(200),
  }),
]);

export const workspacePanelPlacementSchema = z.object({
  slot: workspaceSlotSchema,
  panelId: workspacePanelSchema,
});

export const workspaceActionSchema = z.discriminatedUnion("actionId", [
  z.object({
    actionId: z.literal("focusAssignment"),
    label: z.string().min(2).max(60),
    assignmentId: z.number().int().positive().optional(),
  }),
  z.object({
    actionId: z.literal("focusCourse"),
    label: z.string().min(2).max(60),
    courseId: z.number().int().positive().optional(),
  }),
  z.object({
    actionId: z.literal("buildStudySession"),
    label: z.string().min(2).max(60),
    minutes: z.union([
      z.literal(30),
      z.literal(45),
      z.literal(60),
      z.literal(90),
    ]),
  }),
  z.object({
    actionId: z.literal("deferTask"),
    label: z.string().min(2).max(60),
    taskId: z.string().min(1).max(120),
  }),
  z.object({
    actionId: z.literal("showEvidence"),
    label: z.string().min(2).max(60),
  }),
  z.object({
    actionId: z.literal("showResources"),
    label: z.string().min(2).max(60),
  }),
  z.object({
    actionId: z.literal("acceptPlan"),
    label: z.string().min(2).max(60),
  }),
  z.object({
    actionId: z.literal("dismissPlan"),
    label: z.string().min(2).max(60),
  }),
]);

export const workspaceEvidenceSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("user_request"),
    label: z.string().min(2).max(160),
  }),
  z.object({
    kind: z.literal("assignment"),
    label: z.string().min(2).max(160),
    assignmentId: z.number().int().positive().optional(),
  }),
  z.object({
    kind: z.literal("course"),
    label: z.string().min(2).max(160),
    courseId: z.number().int().positive().optional(),
  }),
  z.object({
    kind: z.literal("planner_signal"),
    label: z.string().min(2).max(160),
    count: z.number().int().nonnegative().optional(),
  }),
  z.object({
    kind: z.literal("announcement"),
    label: z.string().min(2).max(160),
  }),
  z.object({
    kind: z.literal("grade_signal"),
    label: z.string().min(2).max(160),
  }),
  z.object({
    kind: z.literal("submission_signal"),
    label: z.string().min(2).max(160),
  }),
]);

export type WorkspaceGoal = z.infer<typeof workspaceGoalSchema>;
export type WorkspaceView = z.infer<typeof workspaceViewSchema>;
export type WorkspaceSlot = z.infer<typeof workspaceSlotSchema>;
export type WorkspacePanelId = z.infer<typeof workspacePanelSchema>;
export type WorkspaceAction = z.infer<typeof workspaceActionSchema>;
export type WorkspaceActionId = z.infer<typeof workspaceActionIdSchema>;
export type WorkspaceFocus = z.infer<typeof workspaceFocusSchema>;
export type WorkspacePanelPlacement = z.infer<
  typeof workspacePanelPlacementSchema
>;
export type WorkspaceEvidence = z.infer<typeof workspaceEvidenceSchema>;

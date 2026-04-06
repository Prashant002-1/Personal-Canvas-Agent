import { z } from "zod";
import {
  workspaceActionSchema,
  workspaceEvidenceSchema,
  workspaceFocusSchema,
  workspaceGoalSchema,
  workspacePanelPlacementSchema,
  workspaceViewSchema,
} from "@/lib/workspace/contracts";

export const workspaceDecisionInputSchema = z.object({
  goal: workspaceGoalSchema,
  focus: workspaceFocusSchema,
  view: workspaceViewSchema,
  panels: z.array(workspacePanelPlacementSchema).min(2).max(4),
  actions: z.array(workspaceActionSchema).min(1).max(5),
  reason: z.string().min(12).max(240),
  evidence: z.array(workspaceEvidenceSchema).min(1).max(5),
});

export type WorkspaceDecision = z.infer<typeof workspaceDecisionInputSchema>;

"use client";

import { useCallback, useMemo, useState } from "react";
import type { UIMessage } from "ai";
import { ChatInterface } from "@/components/ai/ChatInterface";
import { WorkspaceCanvas } from "@/components/workspace/WorkspaceCanvas";
import { readLocalJson } from "@/lib/client-storage";
import { WORKSPACE_CHAT_ID } from "@/lib/workspace/constants";
import { reduceWorkspaceFromMessages } from "@/lib/workspace/reducer";
import {
  createInitialWorkspaceUiState,
  dispatchWorkspaceAction,
  type QueuedWorkspaceMessage,
} from "@/lib/workspace/actions";
import type { WorkspaceAction } from "@/lib/workspace/contracts";

export default function WorkspacePage() {
  const [botName] = useState<string | null>(() =>
    readLocalJson<string>("canvas-bot-name")
  );
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [uiState, setUiState] = useState(createInitialWorkspaceUiState);
  const [queuedMessage, setQueuedMessage] =
    useState<QueuedWorkspaceMessage | null>(null);

  const onMessagesChange = useCallback((next: UIMessage[]) => {
    setMessages(next);
  }, []);

  const workspaceState = useMemo(
    () => reduceWorkspaceFromMessages(messages),
    [messages]
  );
  const effectiveUiState =
    uiState.decisionKey === workspaceState.decisionKey
      ? uiState
      : createInitialWorkspaceUiState(workspaceState.decisionKey);

  const handleWorkspaceAction = useCallback(
    (action: WorkspaceAction) => {
      const result = dispatchWorkspaceAction({
        action,
        state: workspaceState,
        uiState: effectiveUiState,
      });
      setUiState(result.uiState);
      if (result.queuedMessage) {
        setQueuedMessage(result.queuedMessage);
      }
    },
    [effectiveUiState, workspaceState]
  );

  return (
    <main className="flex flex-col h-[calc(100vh-3.5rem)] min-h-0">
      <WorkspaceCanvas
        state={workspaceState}
        uiState={effectiveUiState}
        onAction={handleWorkspaceAction}
      />
      <div className="shrink-0 flex flex-col min-h-[220px] max-h-[42vh] border-t bg-background">
        <ChatInterface
          chatId={WORKSPACE_CHAT_ID}
          contextData="User is in the agentic study workspace. First choose a workspace decision that states the goal, focus, view, panels, actions, reason, and evidence. Then call the data tools that support that view. Optimize for daily execution."
          botName={botName}
          variant="workspace"
          onMessagesChange={onMessagesChange}
          externalMessage={queuedMessage}
        />
      </div>
    </main>
  );
}

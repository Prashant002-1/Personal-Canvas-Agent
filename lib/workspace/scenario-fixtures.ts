import type { UIMessage } from "ai";

function assistantToolMessage(toolName: string, output: unknown): UIMessage {
  return {
    id: `${toolName}-${Math.random().toString(36).slice(2, 8)}`,
    role: "assistant",
    parts: [
      {
        type: `tool-${toolName}`,
        toolCallId: `${toolName}-call`,
        state: "output-available",
        input: {},
        output,
      },
    ],
  } as UIMessage;
}

export const todayDeskFixtureMessages: UIMessage[] = [
  assistantToolMessage("setWorkspaceDecision", {
    uiTarget: "workspace.decision",
    summary: "Workspace decision: todayDesk for today plan.",
    payload: {
      goal: "today_plan",
      focus: { mode: "today" },
      view: "todayDesk",
      panels: [
        { slot: "hero", panelId: "priorityBoard" },
        { slot: "main", panelId: "taskStack" },
        { slot: "rail", panelId: "announcementActions" },
        { slot: "footer", panelId: "evidencePanel" },
      ],
      actions: [
        { actionId: "acceptPlan", label: "Accept plan" },
        { actionId: "showEvidence", label: "Show why" },
        {
          actionId: "buildStudySession",
          label: "Build a 45-minute study session",
          minutes: 45,
        },
      ],
      reason:
        "There is overdue work plus work due today, so the student needs a clear execution desk.",
      evidence: [
        { kind: "planner_signal", label: "1 overdue assignment", count: 1 },
        { kind: "planner_signal", label: "1 assignment due today", count: 1 },
      ],
    },
  }),
  assistantToolMessage("getTodayPlanSnapshot", {
    uiTarget: "planner.today",
    summary: "Detected 1 due-today and 1 overdue assignments.",
    payload: {
      dueToday: [
        {
          id: 22,
          name: "Lab 4",
          due_at: "2026-03-24T18:00:00.000Z",
          course_code: "CS430",
          course_id: 1,
        },
      ],
      overdue: [
        {
          id: 18,
          name: "Reflection essay",
          due_at: "2026-03-23T17:00:00.000Z",
          course_code: "ENG210",
          course_id: 2,
        },
      ],
      recentAnnouncements: [
        {
          id: 1,
          title: "Quiz moved to Thursday",
          course_code: "CS430",
        },
      ],
    },
  }),
];

export const weekMapFixtureMessages: UIMessage[] = [
  assistantToolMessage("setWorkspaceDecision", {
    uiTarget: "workspace.decision",
    summary: "Workspace decision: weekMap for weekly load.",
    payload: {
      goal: "weekly_load",
      focus: { mode: "week" },
      view: "weekMap",
      panels: [
        { slot: "hero", panelId: "weekTimeline" },
        { slot: "main", panelId: "taskStack" },
        { slot: "footer", panelId: "evidencePanel" },
      ],
      actions: [
        {
          actionId: "buildStudySession",
          label: "Build a 60-minute study session",
          minutes: 60,
        },
        { actionId: "showEvidence", label: "Show why" },
      ],
      reason:
        "The user needs a temporal view because multiple deadlines cluster over the next week.",
      evidence: [
        { kind: "planner_signal", label: "4 workload items in 7 days", count: 4 },
      ],
    },
  }),
  assistantToolMessage("getWeeklyWorkload", {
    uiTarget: "planner.weekly-workload",
    summary: "Loaded 4 workload items across the next 7 days.",
    payload: {
      days: [
        {
          dateKey: "2026-03-24",
          label: "Tue, Mar 24",
          isoDate: "2026-03-24T00:00:00.000Z",
          loadScore: 1,
          items: [
            {
              id: "assignment-22",
              kind: "assignment",
              title: "Lab 4",
              at: "2026-03-24T18:00:00.000Z",
              courseCode: "CS430",
              courseId: 1,
              assignmentId: 22,
              htmlUrl: null,
            },
          ],
        },
        {
          dateKey: "2026-03-25",
          label: "Wed, Mar 25",
          isoDate: "2026-03-25T00:00:00.000Z",
          loadScore: 3,
          items: [
            {
              id: "quiz-2",
              kind: "quiz",
              title: "Quiz 3",
              at: "2026-03-25T19:00:00.000Z",
              courseCode: "CS430",
              courseId: 1,
              assignmentId: null,
              htmlUrl: null,
            },
            {
              id: "assignment-31",
              kind: "assignment",
              title: "Project milestone",
              at: "2026-03-25T23:00:00.000Z",
              courseCode: "STAT300",
              courseId: 3,
              assignmentId: 31,
              htmlUrl: null,
            },
            {
              id: "event-7",
              kind: "calendar_event",
              title: "Review session",
              at: "2026-03-25T15:00:00.000Z",
              courseCode: "STAT300",
              courseId: 3,
              assignmentId: null,
              htmlUrl: null,
            },
          ],
        },
      ],
      busiestDay: {
        dateKey: "2026-03-25",
        label: "Wed, Mar 25",
        loadScore: 3,
      },
      totalItems: 4,
    },
  }),
];

export const assignmentFocusFixtureMessages: UIMessage[] = [
  assistantToolMessage("setWorkspaceDecision", {
    uiTarget: "workspace.decision",
    summary: "Workspace decision: assignmentFocus for assignment execution.",
    payload: {
      goal: "assignment_execution",
      focus: {
        mode: "assignment",
        assignmentId: 31,
        assignmentName: "Project milestone",
        courseId: 3,
        courseCode: "STAT300",
      },
      view: "assignmentFocus",
      panels: [
        { slot: "hero", panelId: "assignmentSummary" },
        { slot: "main", panelId: "taskStack" },
        { slot: "secondary", panelId: "resourceSuggestions" },
        { slot: "footer", panelId: "evidencePanel" },
      ],
      actions: [
        {
          actionId: "buildStudySession",
          label: "Build a 45-minute study session",
          minutes: 45,
        },
        { actionId: "showResources", label: "Show resources" },
        { actionId: "showEvidence", label: "Show why" },
      ],
      reason:
        "The user asked about one assignment, so the workspace should center execution details instead of broad planning.",
      evidence: [
        {
          kind: "assignment",
          label: "Project milestone is the focal task",
          assignmentId: 31,
        },
      ],
    },
  }),
  assistantToolMessage("getAssignmentExecutionContext", {
    uiTarget: "assignment.execution",
    summary: "Loaded execution context for Project milestone.",
    payload: {
      assignment: {
        id: 31,
        course_id: 3,
        name: "Project milestone",
        due_at: "2026-03-25T23:00:00.000Z",
        points_possible: 100,
      },
      course: {
        id: 3,
        name: "Statistics",
        code: "STAT300",
      },
      submission: {
        missing: false,
        submitted_at: null,
        score: null,
      },
      module: {
        id: 9,
        name: "Regression project",
      },
      relatedAssignments: [
        {
          id: 33,
          name: "Peer review",
          due_at: "2026-03-28T17:00:00.000Z",
          points_possible: 20,
        },
      ],
      resources: {
        pages: [
          {
            url: "/page/project-rubric",
            title: "Project rubric",
          },
        ],
        files: [
          {
            id: 99,
            display_name: "Sample report.pdf",
            filename: "sample-report.pdf",
            url: "https://example.com/sample-report.pdf",
          },
        ],
      },
      announcements: [
        {
          title: "Updated milestone expectations",
          html_url: "https://example.com/announcement",
        },
      ],
    },
  }),
];

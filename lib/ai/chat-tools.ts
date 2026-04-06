import { tool } from "ai";
import { z } from "zod";
import { query } from "@/lib/db";
import {
  workspaceDecisionInputSchema,
  type WorkspaceDecision,
} from "@/lib/workspace/decision-schema";
import { validateWorkspaceDecision } from "@/lib/workspace/validation";
import {
  listPlannerEvents,
  loadChatSession,
  searchChatMemories,
  upsertChatMemory,
} from "@/lib/ai/chat-store";
import { embedText } from "@/lib/ai/embeddings";

type ToolPayload<T> = {
  uiTarget: string;
  summary: string;
  payload: T;
};

type ScheduleItem = {
  id: string;
  kind: "assignment" | "quiz" | "discussion" | "calendar_event";
  title: string;
  at: string | null;
  courseId?: number | null;
  courseCode?: string | null;
  assignmentId?: number | null;
  htmlUrl?: string | null;
};

const tableExistsCache = new Map<string, boolean>();

async function tableExists(tableName: string): Promise<boolean> {
  if (tableExistsCache.has(tableName)) {
    return tableExistsCache.get(tableName)!;
  }

  const result = await query(
    `SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1
    ) AS exists`,
    [tableName]
  );

  const exists = Boolean(result.rows[0]?.exists);
  tableExistsCache.set(tableName, exists);
  return exists;
}

async function fetchAnnouncements(limit: number, courseId?: number) {
  if (!(await tableExists("announcements"))) return [];

  if (courseId !== undefined) {
    const result = await query(
      `SELECT id, title, posted_at, html_url
       FROM announcements
       WHERE course_id = $1
       ORDER BY posted_at DESC NULLS LAST
       LIMIT $2`,
      [courseId, limit]
    );
    return result.rows;
  }

  const result = await query(
    `SELECT a.id, a.title, a.posted_at, a.html_url, c.code AS course_code
     FROM announcements a
     JOIN courses c ON c.id = a.course_id
     ORDER BY a.posted_at DESC NULLS LAST
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

async function fetchGradeSignal(courseId: number) {
  if (!(await tableExists("course_enrollments"))) return null;

  const result = await query(
    `SELECT current_score, current_grade, final_score, final_grade, last_activity_at
     FROM course_enrollments
     WHERE course_id = $1
     ORDER BY last_activity_at DESC NULLS LAST
     LIMIT 1`,
    [courseId]
  );

  return result.rows[0] ?? null;
}

function startOfDay(value: Date): Date {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
}

function dayKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function dayLabel(value: Date): string {
  return value.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function createWeekBuckets(days: number) {
  const today = startOfDay(new Date());
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    return {
      dateKey: dayKey(date),
      label: dayLabel(date),
      isoDate: date.toISOString(),
      items: [] as ScheduleItem[],
    };
  });
}

async function fetchWeeklyWorkload(days: number) {
  const buckets = createWeekBuckets(days);
  const bucketMap = new Map(buckets.map((bucket) => [bucket.dateKey, bucket]));

  const assignments = await query(
    `SELECT a.id, a.name, a.due_at, c.id AS course_id, c.code AS course_code, a.html_url
     FROM assignments a
     JOIN courses c ON c.id = a.course_id
     WHERE a.due_at >= date_trunc('day', NOW())
       AND a.due_at < date_trunc('day', NOW()) + ($1::int || ' days')::interval
     ORDER BY a.due_at ASC`,
    [days]
  );

  for (const row of assignments.rows) {
    if (!row.due_at) continue;
    const key = dayKey(new Date(row.due_at));
    const bucket = bucketMap.get(key);
    if (!bucket) continue;
    bucket.items.push({
      id: `assignment-${row.id}`,
      kind: "assignment",
      title: row.name,
      at: row.due_at,
      courseId: row.course_id,
      courseCode: row.course_code,
      assignmentId: row.id,
      htmlUrl: row.html_url,
    });
  }

  if (await tableExists("quizzes")) {
    const quizzes = await query(
      `SELECT q.id, q.title, q.due_at, q.assignment_id, c.id AS course_id, c.code AS course_code, q.html_url
       FROM quizzes q
       JOIN courses c ON c.id = q.course_id
       WHERE q.due_at >= date_trunc('day', NOW())
         AND q.due_at < date_trunc('day', NOW()) + ($1::int || ' days')::interval
       ORDER BY q.due_at ASC`,
      [days]
    );

    for (const row of quizzes.rows) {
      if (!row.due_at) continue;
      const key = dayKey(new Date(row.due_at));
      const bucket = bucketMap.get(key);
      if (!bucket) continue;
      bucket.items.push({
        id: `quiz-${row.id}`,
        kind: "quiz",
        title: row.title,
        at: row.due_at,
        courseId: row.course_id,
        courseCode: row.course_code,
        assignmentId: row.assignment_id,
        htmlUrl: row.html_url,
      });
    }
  }

  if (await tableExists("discussions")) {
    const discussions = await query(
      `SELECT d.id, d.title, COALESCE(d.todo_date, d.lock_at, d.posted_at) AS action_at, c.id AS course_id, c.code AS course_code, d.html_url
       FROM discussions d
       JOIN courses c ON c.id = d.course_id
       WHERE COALESCE(d.todo_date, d.lock_at, d.posted_at) >= date_trunc('day', NOW())
         AND COALESCE(d.todo_date, d.lock_at, d.posted_at) < date_trunc('day', NOW()) + ($1::int || ' days')::interval
       ORDER BY action_at ASC`,
      [days]
    );

    for (const row of discussions.rows) {
      if (!row.action_at) continue;
      const key = dayKey(new Date(row.action_at));
      const bucket = bucketMap.get(key);
      if (!bucket) continue;
      bucket.items.push({
        id: `discussion-${row.id}`,
        kind: "discussion",
        title: row.title,
        at: row.action_at,
        courseId: row.course_id,
        courseCode: row.course_code,
        htmlUrl: row.html_url,
      });
    }
  }

  if (await tableExists("calendar_events")) {
    const events = await query(
      `SELECT e.id, e.title, e.start_at, e.assignment_id, e.course_id, c.code AS course_code, e.html_url
       FROM calendar_events e
       LEFT JOIN courses c ON c.id = e.course_id
       WHERE e.start_at >= date_trunc('day', NOW())
         AND e.start_at < date_trunc('day', NOW()) + ($1::int || ' days')::interval
       ORDER BY e.start_at ASC`,
      [days]
    );

    for (const row of events.rows) {
      if (!row.start_at) continue;
      const key = dayKey(new Date(row.start_at));
      const bucket = bucketMap.get(key);
      if (!bucket) continue;
      bucket.items.push({
        id: `event-${row.id}`,
        kind: "calendar_event",
        title: row.title,
        at: row.start_at,
        courseId: row.course_id,
        courseCode: row.course_code,
        assignmentId: row.assignment_id,
        htmlUrl: row.html_url,
      });
    }
  }

  const daysWithLoad = buckets.map((bucket) => ({
    ...bucket,
    loadScore: bucket.items.length,
  }));

  let busiestDay = null as null | {
    dateKey: string;
    label: string;
    loadScore: number;
  };

  for (const bucket of daysWithLoad) {
    if (!busiestDay || bucket.loadScore > busiestDay.loadScore) {
      busiestDay = {
        dateKey: bucket.dateKey,
        label: bucket.label,
        loadScore: bucket.loadScore,
      };
    }
  }

  return {
    days: daysWithLoad,
    busiestDay,
    totalItems: daysWithLoad.reduce((sum, bucket) => sum + bucket.items.length, 0),
  };
}

async function fetchAssignmentExecutionContext(assignmentId: number) {
  const assignmentResult = await query(
    `SELECT a.id, a.course_id, a.assignment_group_id, a.name, a.description, a.due_at, a.points_possible, a.workflow_state, a.html_url,
            c.name AS course_name, c.code AS course_code
     FROM assignments a
     JOIN courses c ON c.id = a.course_id
     WHERE a.id = $1`,
    [assignmentId]
  );

  const assignment = assignmentResult.rows[0];
  if (!assignment) {
    throw new Error(`Assignment ${assignmentId} not found.`);
  }

  const submission =
    (await tableExists("submissions")) &&
    (
      await query(
        `SELECT submitted_at, graded_at, score, grade, late, missing, workflow_state
         FROM submissions
         WHERE assignment_id = $1
         ORDER BY graded_at DESC NULLS LAST, submitted_at DESC NULLS LAST
         LIMIT 1`,
        [assignmentId]
      )
    ).rows[0];

  const moduleRow =
    (await tableExists("module_items")) &&
    (
      await query(
        `SELECT m.id, m.name
         FROM module_items mi
         JOIN modules m ON m.id = mi.module_id
         WHERE mi.course_id = $1
           AND mi.content_id = $2
           AND mi.type = 'Assignment'
         ORDER BY m.position ASC
         LIMIT 1`,
        [assignment.course_id, assignmentId]
      )
    ).rows[0];

  const relatedAssignments = (
    await query(
      `SELECT id, name, due_at, points_possible
       FROM assignments
       WHERE course_id = $1
         AND id <> $2
         AND (due_at IS NULL OR due_at >= NOW())
       ORDER BY due_at ASC NULLS LAST
       LIMIT 4`,
      [assignment.course_id, assignmentId]
    )
  ).rows;

  const pages =
    (await tableExists("pages")) &&
    (
      await query(
        `SELECT url, title, updated_at_canvas
         FROM pages
         WHERE course_id = $1
         ORDER BY updated_at_canvas DESC NULLS LAST
         LIMIT 3`,
        [assignment.course_id]
      )
    ).rows;

  const files =
    (await tableExists("files")) &&
    (
      await query(
        `SELECT id, display_name, filename, url, updated_at_canvas
         FROM files
         WHERE course_id = $1
         ORDER BY updated_at_canvas DESC NULLS LAST
         LIMIT 3`,
        [assignment.course_id]
      )
    ).rows;

  const announcements = await fetchAnnouncements(3, assignment.course_id);

  return {
    assignment,
    course: {
      id: assignment.course_id,
      name: assignment.course_name,
      code: assignment.course_code,
    },
    submission: submission || null,
    module: moduleRow || null,
    relatedAssignments,
    resources: {
      pages: pages || [],
      files: files || [],
    },
    announcements,
  };
}

export function createChatTools({ chatId }: { chatId: string }) {
  return {
    setWorkspaceDecision: tool({
      description:
        "Choose the workspace goal, view, panels, actions, and evidence for this turn. Call this before data tools so the UI knows what the agent is trying to accomplish.",
      inputSchema: workspaceDecisionInputSchema,
      execute: async (input): Promise<ToolPayload<WorkspaceDecision>> => {
        const validation = validateWorkspaceDecision(input);
        if (!validation.success) {
          throw new Error(validation.errors.join(" "));
        }

        const summary = `Workspace decision: ${input.view} for ${input.goal.replaceAll("_", " ")}.`;
        return {
          uiTarget: "workspace.decision",
          summary,
          payload: input,
        };
      },
    }),

    getDashboardSnapshot: tool({
      description:
        "Get dashboard-ready course, deadline, and announcement snapshot data for UI cards.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(20).default(6),
      }),
      execute: async ({ limit }): Promise<
        ToolPayload<{
          courses: unknown[];
          upcomingAssignments: unknown[];
          announcements: unknown[];
        }>
      > => {
        const courses = await query(
          "SELECT id, name, code, term_name FROM courses ORDER BY id LIMIT $1",
          [limit]
        );

        const assignments = await query(
          `SELECT a.id, a.name, a.due_at, a.points_possible, c.id AS course_id, c.code AS course_code
           FROM assignments a
           JOIN courses c ON c.id = a.course_id
           WHERE a.due_at IS NULL OR a.due_at >= NOW()
           ORDER BY a.due_at ASC NULLS LAST
           LIMIT $1`,
          [limit]
        );

        const announcements = await fetchAnnouncements(limit);

        return {
          uiTarget: "dashboard.snapshot",
          summary: `Loaded ${courses.rowCount ?? 0} courses, ${assignments.rowCount ?? 0} upcoming assignments, and ${announcements.length} announcements.`,
          payload: {
            courses: courses.rows,
            upcomingAssignments: assignments.rows,
            announcements,
          },
        };
      },
    }),

    getCourseOverview: tool({
      description:
        "Get a complete course overview for UI, including assignments, modules, announcements, and grade signals.",
      inputSchema: z.object({
        courseId: z.number().int().positive(),
        assignmentLimit: z.number().int().min(1).max(25).default(10),
      }),
      execute: async ({ courseId, assignmentLimit }): Promise<
        ToolPayload<{
          course: unknown;
          assignments: unknown[];
          modules: unknown[];
          announcements: unknown[];
          gradeSignal: unknown;
        }>
      > => {
        const courseResult = await query(
          `SELECT id, name, code, term_name, syllabus_html, start_date, end_date
           FROM courses
           WHERE id = $1`,
          [courseId]
        );

        const course = courseResult.rows[0];
        if (!course) {
          throw new Error(`Course ${courseId} not found.`);
        }

        const assignments = await query(
          `SELECT id, name, due_at, points_possible, workflow_state
           FROM assignments
           WHERE course_id = $1
           ORDER BY due_at ASC NULLS LAST
           LIMIT $2`,
          [courseId, assignmentLimit]
        );

        const modules = await query(
          `SELECT m.id, m.name, m.position, COUNT(mi.id)::int AS items_count
           FROM modules m
           LEFT JOIN module_items mi ON mi.module_id = m.id
           WHERE m.course_id = $1
           GROUP BY m.id, m.name, m.position
           ORDER BY m.position`,
          [courseId]
        );

        const announcements = await fetchAnnouncements(5, courseId);
        const gradeSignal = await fetchGradeSignal(courseId);

        return {
          uiTarget: "course.overview",
          summary: `Loaded course overview for ${course.code} with ${assignments.rowCount ?? 0} assignments and ${modules.rowCount ?? 0} modules.`,
          payload: {
            course,
            assignments: assignments.rows,
            modules: modules.rows,
            announcements,
            gradeSignal,
          },
        };
      },
    }),

    getCourseTimeline: tool({
      description:
        "Fetch timeline context for a course from calendar events, quizzes, and discussions.",
      inputSchema: z.object({
        courseId: z.number().int().positive(),
        limit: z.number().int().min(1).max(25).default(10),
      }),
      execute: async ({ courseId, limit }): Promise<
        ToolPayload<{
          events: unknown[];
          quizzes: unknown[];
          discussions: unknown[];
        }>
      > => {
        const events =
          (await tableExists("calendar_events")) &&
          (
            await query(
              `SELECT id, title, start_at, end_at, html_url
               FROM calendar_events
               WHERE course_id = $1
               ORDER BY start_at ASC NULLS LAST
               LIMIT $2`,
              [courseId, limit]
            )
          ).rows;

        const quizzes =
          (await tableExists("quizzes")) &&
          (
            await query(
              `SELECT id, title, due_at, unlock_at, lock_at, html_url
               FROM quizzes
               WHERE course_id = $1
               ORDER BY due_at ASC NULLS LAST
               LIMIT $2`,
              [courseId, limit]
            )
          ).rows;

        const discussions =
          (await tableExists("discussions")) &&
          (
            await query(
              `SELECT id, title, posted_at, todo_date, lock_at, html_url
               FROM discussions
               WHERE course_id = $1
               ORDER BY posted_at DESC NULLS LAST
               LIMIT $2`,
              [courseId, limit]
            )
          ).rows;

        return {
          uiTarget: "course.timeline",
          summary: "Loaded course timeline from events, quizzes, and discussions.",
          payload: {
            events: events || [],
            quizzes: quizzes || [],
            discussions: discussions || [],
          },
        };
      },
    }),

    getCourseResources: tool({
      description:
        "Fetch pages and files for a course to support study resource lookups.",
      inputSchema: z.object({
        courseId: z.number().int().positive(),
        pageLimit: z.number().int().min(1).max(25).default(10),
        fileLimit: z.number().int().min(1).max(25).default(10),
      }),
      execute: async ({ courseId, pageLimit, fileLimit }): Promise<
        ToolPayload<{ pages: unknown[]; files: unknown[] }>
      > => {
        const pages =
          (await tableExists("pages")) &&
          (
            await query(
              `SELECT url, title, front_page, published, updated_at_canvas
               FROM pages
               WHERE course_id = $1
               ORDER BY updated_at_canvas DESC NULLS LAST
               LIMIT $2`,
              [courseId, pageLimit]
            )
          ).rows;

        const files =
          (await tableExists("files")) &&
          (
            await query(
              `SELECT id, display_name, filename, content_type, size_bytes, url, updated_at_canvas
               FROM files
               WHERE course_id = $1
               ORDER BY updated_at_canvas DESC NULLS LAST
               LIMIT $2`,
              [courseId, fileLimit]
            )
          ).rows;

        return {
          uiTarget: "course.resources",
          summary: "Loaded course pages and files.",
          payload: { pages: pages || [], files: files || [] },
        };
      },
    }),

    getSubmissionInsights: tool({
      description:
        "Fetch submissions and grade trends for a course for progress analysis.",
      inputSchema: z.object({
        courseId: z.number().int().positive(),
        limit: z.number().int().min(1).max(25).default(10),
      }),
      execute: async ({ courseId, limit }): Promise<
        ToolPayload<{ submissions: unknown[]; gradeSnapshots: unknown[] }>
      > => {
        const submissions =
          (await tableExists("submissions")) &&
          (
            await query(
              `SELECT s.assignment_id, a.name AS assignment_name, s.submitted_at, s.graded_at, s.score, s.grade, s.late, s.missing
               FROM submissions s
               JOIN assignments a ON a.id = s.assignment_id
               WHERE s.course_id = $1
               ORDER BY s.graded_at DESC NULLS LAST, s.submitted_at DESC NULLS LAST
               LIMIT $2`,
              [courseId, limit]
            )
          ).rows;

        const gradeSnapshots =
          (await tableExists("course_grade_snapshots")) &&
          (
            await query(
              `SELECT captured_at, current_score, current_grade, final_score, final_grade
               FROM course_grade_snapshots
               WHERE course_id = $1
               ORDER BY captured_at DESC
               LIMIT $2`,
              [courseId, limit]
            )
          ).rows;

        return {
          uiTarget: "course.submissions",
          summary: "Loaded submission and grade trend insights.",
          payload: {
            submissions: submissions || [],
            gradeSnapshots: gradeSnapshots || [],
          },
        };
      },
    }),

    searchAssignments: tool({
      description:
        "Search assignments by keyword and optional course id. Returns structured rows for chat or UI.",
      inputSchema: z.object({
        queryText: z.string().min(2),
        courseId: z.number().int().positive().optional(),
        limit: z.number().int().min(1).max(25).default(10),
      }),
      execute: async ({ queryText, courseId, limit }): Promise<
        ToolPayload<{ matches: unknown[] }>
      > => {
        const courseCondition = courseId !== undefined ? "AND a.course_id = $3" : "";
        const courseParams = courseId !== undefined ? [courseId] : [];

        let rows: unknown[] = [];

        // Try semantic vector search first
        try {
          const vec = await embedText(queryText);
          const vectorLiteral = `[${vec.join(",")}]`;

          const result = await query(
            `SELECT a.id, a.name, a.due_at, a.points_possible, c.code AS course_code, c.id AS course_id
             FROM assignments a
             JOIN courses c ON c.id = a.course_id
             WHERE a.embedding IS NOT NULL ${courseCondition}
             ORDER BY a.embedding <=> $1::vector ASC
             LIMIT $2`,
            [vectorLiteral, limit, ...courseParams]
          );
          rows = result.rows;
        } catch {
          // Fall back to ILIKE if embedding fails
        }

        // If vector search returned no results (no embeddings yet), fall back to ILIKE
        if (rows.length === 0) {
          const params: unknown[] = [`%${queryText}%`];
          let paramIndex = 2;
          const conditions = [
            `(a.name ILIKE $1 OR COALESCE(a.description, '') ILIKE $1)`,
          ];

          if (courseId !== undefined) {
            params.push(courseId);
            conditions.push(`a.course_id = $${paramIndex++}`);
          }

          params.push(limit);
          const result = await query(
            `SELECT a.id, a.name, a.due_at, a.points_possible, c.code AS course_code, c.id AS course_id
             FROM assignments a
             JOIN courses c ON c.id = a.course_id
             WHERE ${conditions.join(" AND ")}
             ORDER BY a.due_at ASC NULLS LAST
             LIMIT $${paramIndex}`,
            params
          );
          rows = result.rows;
        }

        return {
          uiTarget: "assignments.search-results",
          summary: `Found ${rows.length} assignments matching "${queryText}".`,
          payload: { matches: rows },
        };
      },
    }),

    getTodayPlanSnapshot: tool({
      description:
        "Get today's plan signals, including due-today, overdue work, and latest course announcements.",
      inputSchema: z.object({
        assignmentLimit: z.number().int().min(1).max(20).default(10),
      }),
      execute: async ({ assignmentLimit }): Promise<
        ToolPayload<{
          dueToday: unknown[];
          overdue: unknown[];
          recentAnnouncements: unknown[];
        }>
      > => {
        const dueToday = await query(
          `SELECT a.id, a.name, a.due_at, c.code AS course_code, c.id AS course_id
           FROM assignments a
           JOIN courses c ON c.id = a.course_id
           WHERE a.due_at >= date_trunc('day', NOW())
             AND a.due_at < date_trunc('day', NOW()) + interval '1 day'
           ORDER BY a.due_at ASC
           LIMIT $1`,
          [assignmentLimit]
        );

        const overdue = await query(
          `SELECT a.id, a.name, a.due_at, c.code AS course_code, c.id AS course_id
           FROM assignments a
           JOIN courses c ON c.id = a.course_id
           WHERE a.due_at IS NOT NULL
             AND a.due_at < NOW()
           ORDER BY a.due_at DESC
           LIMIT $1`,
          [assignmentLimit]
        );

        const recentAnnouncements = await fetchAnnouncements(6);

        return {
          uiTarget: "planner.today",
          summary: `Detected ${dueToday.rowCount ?? 0} due-today and ${overdue.rowCount ?? 0} overdue assignments.`,
          payload: {
            dueToday: dueToday.rows,
            overdue: overdue.rows,
            recentAnnouncements,
          },
        };
      },
    }),

    getWeeklyWorkload: tool({
      description:
        "Get a 7-day workload map from assignments, quizzes, discussions, and calendar events for week-based execution planning.",
      inputSchema: z.object({
        days: z.number().int().min(5).max(10).default(7),
      }),
      execute: async ({ days }): Promise<
        ToolPayload<{
          days: Array<{
            dateKey: string;
            label: string;
            isoDate: string;
            loadScore: number;
            items: ScheduleItem[];
          }>;
          busiestDay: {
            dateKey: string;
            label: string;
            loadScore: number;
          } | null;
          totalItems: number;
        }>
      > => {
        const workload = await fetchWeeklyWorkload(days);
        return {
          uiTarget: "planner.weekly-workload",
          summary: `Loaded ${workload.totalItems} workload items across the next ${days} days.`,
          payload: workload,
        };
      },
    }),

    getAssignmentExecutionContext: tool({
      description:
        "Get a focused execution context for one assignment, including submission state, nearby work, module placement, and supporting resources.",
      inputSchema: z.object({
        assignmentId: z.number().int().positive(),
      }),
      execute: async ({ assignmentId }): Promise<
        ToolPayload<Awaited<ReturnType<typeof fetchAssignmentExecutionContext>>>
      > => {
        const payload = await fetchAssignmentExecutionContext(assignmentId);
        return {
          uiTarget: "assignment.execution",
          summary: `Loaded execution context for ${payload.assignment.name}.`,
          payload,
        };
      },
    }),

    saveMemory: tool({
      description:
        "Store a durable memory entry for future context retention in this chat session.",
      inputSchema: z.object({
        memoryKey: z.string().min(2).max(120),
        memoryValue: z.string().min(2).max(500),
      }),
      execute: async ({ memoryKey, memoryValue }): Promise<
        ToolPayload<{ memoryKey: string }>
      > => {
        await loadChatSession(chatId);
        await upsertChatMemory({
          chatId,
          memoryKey,
          memoryValue,
          source: "assistant-tool",
        });

        return {
          uiTarget: "memory.store",
          summary: `Stored memory "${memoryKey}".`,
          payload: { memoryKey },
        };
      },
    }),

    searchMemories: tool({
      description:
        "Search previously stored chat memories to recover user preferences and prior facts.",
      inputSchema: z.object({
        queryText: z.string().min(2).max(180),
        limit: z.number().int().min(1).max(20).default(8),
      }),
      execute: async ({ queryText, limit }): Promise<
        ToolPayload<{ matches: unknown[] }>
      > => {
        await loadChatSession(chatId);
        const matches = await searchChatMemories({ chatId, queryText, limit });
        return {
          uiTarget: "memory.search-results",
          summary: `Found ${matches.length} matching memories.`,
          payload: { matches },
        };
      },
    }),

    getPlannerEvents: tool({
      description:
        "Get recent planner update events for reactive schedule/context shifts.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(20).default(8),
      }),
      execute: async ({ limit }): Promise<ToolPayload<{ events: unknown[] }>> => {
        await loadChatSession(chatId);
        const events = await listPlannerEvents({ chatId, limit });
        return {
          uiTarget: "planner.events",
          summary: `Loaded ${events.length} recent planner events.`,
          payload: { events },
        };
      },
    }),
  };
}

export type ChatToolSet = ReturnType<typeof createChatTools>;

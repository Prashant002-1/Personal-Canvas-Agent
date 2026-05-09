import { generateText } from "ai";
import { z } from "zod";
import { primaryModel, isRetryableError } from "@/lib/ai/provider";

export const maxDuration = 60;

type Course = {
  name: string;
  code: string;
  term_name: string;
  syllabus_html: string | null;
  current_score?: number | null;
  current_grade?: string | null;
};

type Assignment = {
  name: string;
  due_at: string | null;
  points_possible: number | null;
};

type Module = {
  id: number;
  name: string;
};

type ModuleItem = {
  module_id: number;
};

type Announcement = {
  title: string;
  posted_at: string | null;
};

type RequestBody = {
  course: Course;
  assignments: Assignment[];
  modules: Module[];
  moduleItems: ModuleItem[];
  announcements?: Announcement[];
};

const courseSchema = z.object({
  summary: z.string(),
  nextSteps: z.array(z.object({
    action: z.string(),
    deadline: z.string().optional(),
    priority: z.enum(["high", "medium", "low"]),
  })),
  assignments: z.array(z.object({
    name: z.string(),
    effort: z.enum(["low", "medium", "high"]),
    concepts: z.array(z.string()),
    dueDate: z.string().optional(),
  })),
  moduleInsight: z.object({
    currentFocus: z.string(),
    keyTopics: z.array(z.string()),
    studyTip: z.string(),
  }),
  resources: z.array(z.object({
    title: z.string(),
    query: z.string(),
    type: z.enum(["youtube", "article"]),
  })),
});

async function runWithModel(modelFn: () => ReturnType<typeof primaryModel>, prompt: string) {
  const { text } = await generateText({
    model: modelFn(),
    messages: [{ role: "user", content: prompt + "\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown, no code fences, no preamble." }],
  });
  const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  return JSON.parse(cleaned);
}

async function generateWithFallback(args: { schema: z.ZodTypeAny; prompt: string }) {
  try {
    const json = await runWithModel(primaryModel, args.prompt);
    return args.schema.parse(json);
  } catch (err) {
    if (isRetryableError(err)) {
      console.warn("Primary model failed, retrying:", String(err).slice(0, 120));
      const json = await runWithModel(primaryModel, args.prompt);
      return args.schema.parse(json);
    }
    throw err;
  }
}

export async function POST(req: Request) {
  const { course, assignments, modules, moduleItems, announcements = [] } =
    (await req.json()) as RequestBody;

  const gradeContext = course.current_grade
    ? `Current grade: ${course.current_grade} (${course.current_score?.toFixed(1)}%)`
    : "No grade recorded yet.";

  const announcementsContext = announcements.length > 0
    ? `\nRecent announcements: ${announcements.map((a) => `"${a.title}" (${a.posted_at ? new Date(a.posted_at).toLocaleDateString() : "n/d"})`).join("; ")}`
    : "";

  const schemaDesc = `{
  "summary": "1-2 sentences on the most important thing happening in this course right now",
  "nextSteps": [{"action": "concrete action in 10 words", "deadline": "Jan 25 or tomorrow", "priority": "high|medium|low"}],
  "assignments": [{"name": "assignment name", "effort": "low|medium|high", "concepts": ["concept1"], "dueDate": "Jan 25"}],
  "moduleInsight": {"currentFocus": "one sentence", "keyTopics": ["topic1"], "studyTip": "concrete tip in 15 words"},
  "resources": [{"title": "Channel - Topic", "query": "exact search query", "type": "youtube|article"}]
}`;

  const object = await generateWithFallback({
    schema: courseSchema,
    prompt: `You are an expert academic AI assistant analyzing a student's course.

Course: ${course.name} (${course.code}), Term: ${course.term_name}
${gradeContext}
Syllabus: ${course.syllabus_html ? course.syllabus_html.replace(/<[^>]*>?/gm, '').substring(0, 2000) : 'Not provided.'}
Assignments: ${assignments.map((a) => `${a.name} (Due: ${a.due_at ? new Date(a.due_at).toLocaleDateString() : 'No due date'}, ${a.points_possible} pts)`).join("; ")}
Modules: ${modules.map((m) => `${m.name} (${moduleItems.filter((i) => i.module_id === m.id).length} items)`).join("; ")}
${announcementsContext}

Return exactly this JSON structure:
${schemaDesc}

Rules:
- priority: high=due within 48h or exam; medium=due within 7 days; low=due >7 days or prep
- effort: high=>4h; medium=2-4h; low=<2h
- max 5 nextSteps sorted by urgency
- max 5 assignments, most urgent first
- min 3, max 5 resources with known channels (3Blue1Brown, Khan Academy, StatQuest, MIT OCW, Crash Course)
- use actual names, never placeholders
- no preamble, no markdown, just the JSON object`,
  });

  return Response.json(object);
}

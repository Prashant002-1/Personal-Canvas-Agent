import { generateText } from "ai";
import { z } from "zod";
import { primaryModel, isRetryableError } from "@/lib/ai/provider";

export const maxDuration = 60;

type Course = {
  name: string;
  code: string;
};

type UpcomingAssignment = {
  name: string;
  due_at: string | null;
  course_code: string;
};

type RequestBody = {
  courses: Course[];
  upcomingAssignments: UpcomingAssignment[];
};

const dashboardSchema = z.object({
  briefing: z.string(),
  priorities: z.array(z.object({
    title: z.string(),
    description: z.string(),
    urgency: z.enum(["high", "medium", "low"]),
    course: z.string(),
  })),
  insight: z.string(),
  workloadWarning: z.string().optional(),
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
  const { courses, upcomingAssignments } = (await req.json()) as RequestBody;

  const schemaDesc = `{
  "briefing": "2 sentences max describing most urgent situation and one concrete next action",
  "priorities": [{"title": "5 words max", "description": "20 words max, one specific action", "urgency": "high|medium|low", "course": "e.g. STAT 401"}],
  "insight": "1-2 sentences, tactical observation about workload patterns",
  "workloadWarning": "include only if 2+ high-urgency items in 5 days, otherwise omit"
}`;

  const object = await generateWithFallback({
    schema: dashboardSchema,
    prompt: `You are an expert academic AI assistant. Analyze this student's academic landscape.

Courses: ${courses.map((c) => `${c.name} (${c.code})`).join(", ")}
Upcoming: ${upcomingAssignments.map((a) => `${a.name} in ${a.course_code} (Due: ${a.due_at ? new Date(a.due_at).toLocaleDateString() : "No due date"})`).join("; ")}

Return exactly this JSON structure:
${schemaDesc}

Rules:
- Exactly 3 priorities ordered by urgency
- high = due within 3 days, medium = within 7 days, low = everything else
- briefing: concrete, not generic. State what's due and one action.
- insight: tactical, not generic advice
- workloadWarning: omit unless 2+ high-urgency items within 5 days
- no preamble, no markdown, just the JSON object`,
  });

  return Response.json(object);
}

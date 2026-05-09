import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const CHAT_MODEL = "tencent/hy3-preview:free";
const STRUCTURED_MODEL = "nvidia/nemotron-3-super-120b-a12b:free";

export function primaryModel() {
  return openrouter(CHAT_MODEL);
}

export function structuredModel() {
  return openrouter(STRUCTURED_MODEL);
}

export function fallbackModel() {
  return openrouter(CHAT_MODEL);
}

export function isRetryableError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const message = err.message.toLowerCase();
  return (
    message.includes("429") ||
    message.includes("rate") ||
    message.includes("overloaded")
  );
}

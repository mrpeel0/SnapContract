import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

export const MODEL = "claude-opus-5-5";
export type AiProvider = "claude" | "local" | null;

/** Claude if a key is set, otherwise a local Ollama model if LOCAL_MODEL is set, otherwise offline engine. */
export function aiProvider(): AiProvider {
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) return "claude";
  if (process.env.LOCAL_MODEL) return "local";
  return null;
}

export function aiAvailable() {
  return aiProvider() !== null;
}

let _client: Anthropic | null = null;
function client() {
  if (!_client) _client = new Anthropic();
  return _client;
}

/**
 * One structured-output call. Returns null on refusal / parse failure so the
 * caller can fall back to the offline engine and the demo never dead-ends.
 */
export async function structured<S extends z.ZodType>(opts: {
  system: string;
  user: string;
  schema: S;
  effort?: "low" | "medium" | "high";
}): Promise<z.infer<S> | null> {
  if (aiProvider() === "local") return localStructured(opts);

  const res = await client().beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
    output_config: { effort: opts.effort ?? "low", format: betaZodOutputFormat(opts.schema) },
  });
  if (res.stop_reason === "refusal" || res.stop_reason === "max_tokens") {
    console.warn("[ai] stop_reason", res.stop_reason);
    return null;
  }
  return (res.parsed_output as z.infer<S> | null) ?? null;
}

// ---------- Local model via Ollama (structured outputs through the `format` JSON schema) ----------
async function localStructured<S extends z.ZodType>(opts: { system: string; user: string; schema: S }): Promise<z.infer<S> | null> {
  const base = process.env.OLLAMA_URL ?? "http://localhost:11434";
  const started = Date.now();
  const res = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.LOCAL_MODEL,
      stream: false,
      format: z.toJSONSchema(opts.schema),
      options: { temperature: 0, num_ctx: 8192 },
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as { message?: { content?: string } };
  console.log(`[ai] local ${process.env.LOCAL_MODEL} ${Date.now() - started}ms`);
  try {
    const parsed = opts.schema.safeParse(JSON.parse(body.message?.content ?? ""));
    if (parsed.success) return parsed.data;
    console.warn("[ai] local output failed schema", parsed.error.issues.slice(0, 3));
  } catch (e) {
    console.warn("[ai] local output not JSON", e);
  }
  return null;
}

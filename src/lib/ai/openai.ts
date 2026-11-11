import { z } from "zod";

export const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.5";

/** Strip keywords OpenAI strict structured outputs reject or don't need. */
function toOpenAiSchema(schema: z.ZodType) {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  delete json.$schema;
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(walk);
    const o = node as Record<string, unknown>;
    if (o.type === "integer" || o.type === "number") {
      delete o.minimum;
      delete o.maximum;
    }
    Object.values(o).forEach(walk);
  };
  walk(json);
  return json;
}

/** One structured-output call to OpenAI Chat Completions. Returns null on refusal / bad output. */
export async function openaiStructured<S extends z.ZodType>(opts: {
  system: string;
  user: string;
  schema: S;
  effort?: "low" | "medium" | "high";
}): Promise<z.infer<S> | null> {
  const started = Date.now();
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      reasoning_effort: opts.effort ?? "low",
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "result", strict: true, schema: toOpenAiSchema(opts.schema) },
      },
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as {
    choices?: { finish_reason?: string; message?: { content?: string | null; refusal?: string | null } }[];
  };
  const choice = body.choices?.[0];
  console.log(`[ai] openai ${OPENAI_MODEL} ${Date.now() - started}ms`);
  if (choice?.message?.refusal || choice?.finish_reason === "length") {
    console.warn("[ai] openai stop", choice?.finish_reason, choice?.message?.refusal);
    return null;
  }
  try {
    const parsed = opts.schema.safeParse(JSON.parse(choice?.message?.content ?? ""));
    if (parsed.success) return parsed.data;
    console.warn("[ai] openai output failed schema", parsed.error.issues.slice(0, 3));
  } catch (e) {
    console.warn("[ai] openai output not JSON", e);
  }
  return null;
}

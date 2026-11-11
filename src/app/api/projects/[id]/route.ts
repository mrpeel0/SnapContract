import type { NextRequest } from "next/server";
import { getProject } from "@/lib/db";
import { runAction, type Action } from "@/lib/actions";
import { aiProvider } from "@/lib/ai/claude";
import { rampConfigured, rampSandbox } from "@/lib/ramp";
import { botUsername, telegramConfigured, telegramLinks } from "@/lib/telegram";

async function integrations(projectId: string, linked?: { contractor?: number; client?: number }) {
  const username = telegramConfigured() ? await botUsername().catch(() => null) : null;
  return {
    telegram: {
      enabled: telegramConfigured(),
      username,
      links: telegramLinks(projectId, username),
      contractorLinked: Boolean(linked?.contractor),
      clientLinked: Boolean(linked?.client),
    },
    ramp: { enabled: rampConfigured(), sandbox: rampSandbox() },
  };
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const p = getProject(id);
  if (!p) return Response.json({ error: "Not found" }, { status: 404 });
  const tg = p.channels?.telegram;
  return Response.json({ project: p, ai: aiProvider(), integrations: await integrations(p.id, { contractor: tg?.contractorChatId, client: tg?.clientChatId }) });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const action = (await req.json()) as Action;
    const project = await runAction(id, action);
    const tg = project.channels?.telegram;
    return Response.json({ project, integrations: await integrations(project.id, { contractor: tg?.contractorChatId, client: tg?.clientChatId }) });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}

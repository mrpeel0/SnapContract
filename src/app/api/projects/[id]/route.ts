import type { NextRequest } from "next/server";
import { getProject } from "@/lib/db";
import { runAction, type Action } from "@/lib/actions";
import { aiProvider } from "@/lib/ai/claude";
import { rampConfigured, rampSandbox } from "@/lib/ramp";
import { channelsInfo } from "@/lib/channels";
import type { Project } from "@/lib/types";

async function integrations(p: Project) {
  return {
    channels: await channelsInfo(p),
    ramp: { enabled: rampConfigured(), sandbox: rampSandbox() },
  };
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const p = getProject(id);
  if (!p) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ project: p, ai: aiProvider(), integrations: await integrations(p) });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const action = (await req.json()) as Action;
    const project = await runAction(id, action);
    return Response.json({ project, integrations: await integrations(project) });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}

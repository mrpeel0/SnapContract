import type { NextRequest } from "next/server";
import { getProject } from "@/lib/db";
import { runAction, type Action } from "@/lib/actions";
import { aiProvider } from "@/lib/ai/claude";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const p = getProject(id);
  if (!p) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ project: p, ai: aiProvider() });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const action = (await req.json()) as Action;
    const project = await runAction(id, action);
    return Response.json({ project });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}

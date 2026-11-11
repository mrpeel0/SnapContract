import type { NextRequest } from "next/server";
import { getProject } from "@/lib/db";
import { runAction, type Action } from "@/lib/actions";
import { aiProvider } from "@/lib/ai/claude";
import { imessageConfigured } from "@/lib/imessage";
import { rampConfigured, rampSandbox } from "@/lib/ramp";
import { botUsername, telegramConfigured, telegramLinks } from "@/lib/telegram";
import type { PhoneChannel } from "@/lib/types";
import { whatsappConfigured } from "@/lib/whatsapp";

function phoneStatus(slot: PhoneChannel | undefined, enabled: boolean) {
  return {
    enabled,
    contractorLinked: Boolean(slot?.contractorAddress),
    clientLinked: Boolean(slot?.clientAddress),
    contractorAddress: slot?.contractorAddress,
    clientAddress: slot?.clientAddress,
  };
}

async function integrations(projectId: string, channels?: { telegram?: { contractorChatId?: number; clientChatId?: number }; whatsapp?: PhoneChannel; imessage?: PhoneChannel }) {
  const username = telegramConfigured() ? await botUsername().catch(() => null) : null;
  return {
    telegram: {
      enabled: telegramConfigured(),
      username,
      links: telegramLinks(projectId, username),
      contractorLinked: Boolean(channels?.telegram?.contractorChatId),
      clientLinked: Boolean(channels?.telegram?.clientChatId),
    },
    whatsapp: phoneStatus(channels?.whatsapp, whatsappConfigured()),
    imessage: phoneStatus(channels?.imessage, imessageConfigured()),
    ramp: { enabled: rampConfigured(), sandbox: rampSandbox() },
  };
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const p = getProject(id);
  if (!p) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ project: p, ai: aiProvider(), integrations: await integrations(p.id, p.channels) });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const action = (await req.json()) as Action;
    const project = await runAction(id, action);
    return Response.json({ project, integrations: await integrations(project.id, project.channels) });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}

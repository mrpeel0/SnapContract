import type { NextRequest } from "next/server";
import { ingestPhoneMessage } from "@/lib/messaging";
import { imessageConfigured, sendIMessage } from "@/lib/imessage";

export async function POST(req: NextRequest) {
  const secret = process.env.IMESSAGE_WEBHOOK_SECRET;
  if (secret) {
    const got = req.headers.get("x-snapcontract-secret") || req.nextUrl.searchParams.get("secret");
    if (got !== secret) return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    event?: string;
    contact?: string;
    from?: string;
    recipient?: string;
    phone?: string;
    text?: string;
    body?: string;
    message?: string;
    message_id?: string;
    id?: string;
  };
  if (body.event && !/inbound|received/i.test(body.event)) return Response.json({ ok: true });
  const from = body.contact || body.from || body.phone || "";
  const text = body.text || body.body || body.message || "";
  if (!from || !text) return Response.json({ ok: true });
  try {
    await ingestPhoneMessage({
      channel: "imessage",
      from,
      text,
      messageId: body.message_id || body.id,
      reply: async (note) => {
        if (imessageConfigured()) await sendIMessage(from.replace(/\D/g, ""), note);
      },
    });
  } catch (e) {
    console.error("imessage inbound", e);
  }
  return Response.json({ ok: true });
}

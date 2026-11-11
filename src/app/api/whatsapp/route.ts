import type { NextRequest } from "next/server";
import { ingestPhoneMessage } from "@/lib/messaging";
import { sendWhatsApp, verifyMetaSignature, whatsappConfigured } from "@/lib/whatsapp";

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

type WaMessage = {
  id?: string;
  from?: string;
  text?: { body?: string };
  button?: { payload?: string };
  interactive?: { button_reply?: { id?: string }; list_reply?: { id?: string } };
};

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifyMetaSignature(raw, req.headers.get("x-hub-signature-256"))) {
    return Response.json({ error: "bad signature" }, { status: 401 });
  }
  const body = raw ? (JSON.parse(raw) as { entry?: { changes?: { value?: { messages?: WaMessage[] } }[] }[] }) : {};
  const messages: WaMessage[] = [];
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const message of change.value?.messages ?? []) messages.push(message);
    }
  }
  for (const message of messages) {
    const text = message.text?.body || message.interactive?.button_reply?.id || message.interactive?.list_reply?.id || message.button?.payload;
    if (!message.from || !text) continue;
    try {
      await ingestPhoneMessage({
        channel: "whatsapp",
        from: message.from,
        text,
        messageId: message.id,
        reply: async (note) => {
          if (whatsappConfigured()) await sendWhatsApp(message.from!, note);
        },
      });
    } catch (e) {
      console.error("whatsapp inbound", e);
    }
  }
  return Response.json({ ok: true });
}

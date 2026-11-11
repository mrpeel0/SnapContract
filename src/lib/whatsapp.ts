import { createHmac, timingSafeEqual } from "crypto";
import { deliverChannel } from "./messaging";

export function whatsappConfigured() {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

export function verifyMetaSignature(raw: string, header: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return true;
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const got = Buffer.from(header.slice(7));
  const exp = Buffer.from(expected);
  return got.length === exp.length && timingSafeEqual(got, exp);
}

export async function sendWhatsApp(to: string, text: string, actions?: { id: string; title: string }[]) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) return;
  const version = process.env.WHATSAPP_GRAPH_VERSION || "v21.0";
  const payload = actions?.length
    ? {
        messaging_product: "whatsapp",
        to,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: text.slice(0, 1024) },
          action: {
            buttons: actions.slice(0, 3).map((a) => ({
              type: "reply",
              reply: { id: a.id.slice(0, 256), title: a.title.slice(0, 20) },
            })),
          },
        },
      }
    : {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { preview_url: false, body: text.slice(0, 4096) },
      };
  const res = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.text();
    if (actions?.length) {
      const hint = actions.map((a) => `${a.title.toUpperCase()} ${a.id.split(":")[1] ?? ""}`.trim()).join(" or ");
      await sendWhatsApp(to, `${text}\n\nReply ${hint}`);
      return;
    }
    throw new Error(err.slice(0, 300) || `WhatsApp send failed (${res.status})`);
  }
}

export async function notifyWhatsApp(projectId: string) {
  if (!whatsappConfigured()) return;
  await deliverChannel(projectId, "whatsapp", sendWhatsApp);
}

import crypto from "node:crypto";
import { handleInbound, joinCode, plainText, type Adapter, type OutMsg } from "./core";

// WhatsApp Business Cloud API (Meta). Outbound via Graph API, inbound via the /api/whatsapp webhook.
const env = () => ({
  token: process.env.WHATSAPP_TOKEN ?? "",
  phoneId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "",
  version: process.env.WHATSAPP_GRAPH_VERSION ?? "v23.0",
});

async function graph<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { token, version } = env();
  const res = await fetch(`https://graph.facebook.com/${version}/${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...init.headers },
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(`WhatsApp: ${body.error?.message ?? res.status}`);
  return body;
}

let numberCache: string | null = null;
async function displayNumber() {
  if (process.env.WHATSAPP_DISPLAY_NUMBER) return process.env.WHATSAPP_DISPLAY_NUMBER;
  if (numberCache) return numberCache;
  const r = await graph<{ display_phone_number?: string }>(`${env().phoneId}?fields=display_phone_number`);
  numberCache = r.display_phone_number ?? null;
  return numberCache;
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

async function send(to: string, out: OutMsg) {
  const path = `${env().phoneId}/messages`;
  if (out.buttons?.length) {
    const shortNote = out.note && out.note.length <= 60 ? out.note : undefined; // footer limit
    const body = plainText({ ...out, title: undefined, note: shortNote ? undefined : out.note, buttons: undefined }, { bold: (s) => `*${s}*`, italic: (s) => `_${s}_` });
    await graph(path, {
      method: "POST",
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "interactive",
        interactive: {
          type: "button",
          ...(out.title ? { header: { type: "text", text: clip(out.title, 60) } } : {}),
          body: { text: clip(body, 1024) },
          ...(shortNote ? { footer: { text: shortNote } } : {}),
          action: { buttons: out.buttons.slice(0, 3).map((b) => ({ type: "reply", reply: { id: b.id, title: clip(b.label, 20) } })) },
        },
      }),
    });
    return;
  }
  const text = plainText(out, { bold: (s) => `*${s}*`, italic: (s) => `_${s}_` });
  await graph(path, {
    method: "POST",
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: clip(text, 4096), preview_url: false } }),
  });
}

export const whatsapp: Adapter = {
  kind: "whatsapp",
  configured: () => Boolean(env().token && env().phoneId),
  send,
  async info(projectId) {
    try {
      const num = await displayNumber();
      if (!num) return { address: null, links: null, error: "Couldn't read the WhatsApp number" };
      const digits = num.replace(/\D/g, "");
      const link = (role: "contractor" | "client") => `https://wa.me/${digits}?text=${encodeURIComponent(`join ${joinCode(role, projectId)}`)}`;
      return { address: num, links: { contractor: link("contractor"), client: link("client") } };
    } catch (e) {
      return { address: null, links: null, error: (e as Error).message };
    }
  },
  setup: ["developers.facebook.com → WhatsApp → API Setup", "WHATSAPP_TOKEN=… WHATSAPP_PHONE_NUMBER_ID=…", "Webhook: https://<tunnel>/api/whatsapp"],
};

// ---------- webhook ----------
export function verifyChallenge(params: URLSearchParams) {
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (expected && params.get("hub.mode") === "subscribe" && params.get("hub.verify_token") === expected) return params.get("hub.challenge");
  return null;
}

export function validSignature(raw: string, header: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return true; // optional in development
  if (!header?.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  const got = header.slice(7);
  return got.length === expected.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

type WaMessage = {
  id: string;
  from: string;
  type: string;
  text?: { body?: string };
  interactive?: { button_reply?: { id: string; title: string }; list_reply?: { id: string } };
  button?: { payload?: string; text?: string };
};
type WaPayload = { entry?: { changes?: { value?: { messages?: WaMessage[]; contacts?: { wa_id: string; profile?: { name?: string } }[] } }[] }[] };

const g = globalThis as unknown as { __waSeen?: Set<string> };
g.__waSeen ??= new Set();

export async function handleWebhook(payload: WaPayload) {
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const v = change.value;
      for (const m of v?.messages ?? []) {
        if (g.__waSeen!.has(m.id)) continue; // Meta retries deliveries
        g.__waSeen!.add(m.id);
        if (g.__waSeen!.size > 2000) g.__waSeen = new Set([...g.__waSeen!].slice(-1000));
        const text = m.interactive?.button_reply?.id ?? m.interactive?.list_reply?.id ?? m.button?.payload ?? m.text?.body ?? "";
        if (!text) {
          await send(m.from, { text: "I can read text messages and button taps here. Voice notes and photos work best in the web app for now.", quiet: true }).catch(() => {});
          continue;
        }
        const name = v?.contacts?.find((c) => c.wa_id === m.from)?.profile?.name;
        try {
          await handleInbound("whatsapp", m.from, text, { name, reply: (o) => send(m.from, o) });
        } catch (e) {
          console.error("[whatsapp] inbound", e);
          await send(m.from, { text: (e as Error).message, quiet: true }).catch(() => {});
        }
      }
    }
  }
}

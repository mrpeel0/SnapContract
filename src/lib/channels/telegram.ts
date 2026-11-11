import { handleInbound, joinCode, type Adapter, type OutMsg } from "./core";

const g = globalThis as unknown as { __tgGen?: number };

const token = () => process.env.TELEGRAM_BOT_TOKEN ?? "";

async function tg<T>(method: string, body?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${token()}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const json = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!json.ok) throw new Error(json.description || `Telegram ${method} failed`);
  return json.result as T;
}

let usernameCache: string | null = null;
async function botUsername() {
  if (!token()) return null;
  if (usernameCache) return usernameCache;
  const me = await tg<{ username?: string }>("getMe");
  usernameCache = me.username ?? null;
  return usernameCache;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function render(out: OutMsg) {
  const parts: string[] = [];
  if (out.title) parts.push(`<b>${esc(out.title)}</b>`);
  parts.push(out.quiet ? `<i>${esc(out.text)}</i>` : esc(out.text));
  if (out.items?.length) parts.push(out.items.map(esc).join("\n"));
  if (out.total) parts.push(`<b>${esc(out.total)}</b>`);
  if (out.note) parts.push(`<i>${esc(out.note)}</i>`);
  const text = parts.join("\n\n");
  return text.length > 3900 ? `${text.slice(0, 3900)}…` : text;
}

async function send(chatId: string, out: OutMsg) {
  await tg("sendMessage", {
    chat_id: chatId,
    text: render(out),
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup: out.buttons?.length ? { inline_keyboard: [out.buttons.map((b) => ({ text: b.label, callback_data: b.id }))] } : undefined,
  });
}

export const telegram: Adapter = {
  kind: "telegram",
  configured: () => Boolean(token()),
  send,
  async info(projectId) {
    try {
      const u = await botUsername();
      if (!u) return { address: null, links: null, error: "Bot has no username" };
      return {
        address: `@${u}`,
        links: { contractor: `https://t.me/${u}?start=${joinCode("contractor", projectId)}`, client: `https://t.me/${u}?start=${joinCode("client", projectId)}` },
      };
    } catch (e) {
      return { address: null, links: null, error: (e as Error).message };
    }
  },
  setup: ["Message @BotFather → /newbot", "TELEGRAM_BOT_TOKEN=…"],
};

type Update = {
  update_id: number;
  message?: { message_id: number; text?: string; chat: { id: number; type?: string }; from?: { first_name?: string } };
  callback_query?: { id: string; data?: string; from?: { first_name?: string }; message?: { message_id: number; chat: { id: number } } };
};

async function handleUpdate(u: Update) {
  if (u.callback_query) {
    const cq = u.callback_query;
    await tg("answerCallbackQuery", { callback_query_id: cq.id }).catch(() => {});
    const chatId = cq.message?.chat.id;
    if (!chatId || !cq.data) return;
    // Remove the buttons so a change can't be approved twice from an old message.
    if (cq.message) await tg("editMessageReplyMarkup", { chat_id: chatId, message_id: cq.message.message_id, reply_markup: { inline_keyboard: [] } }).catch(() => {});
    await handleInbound("telegram", String(chatId), cq.data, { name: cq.from?.first_name, reply: (o) => send(String(chatId), o) });
    return;
  }
  const msg = u.message;
  if (!msg?.text) return;
  const chatId = String(msg.chat.id);
  await handleInbound("telegram", chatId, msg.text, {
    name: msg.from?.first_name,
    reply: (o) => send(chatId, o),
    typing: () => tg("sendChatAction", { chat_id: chatId, action: "typing" }),
  });
}

async function poll(gen: number) {
  let offset = 0;
  await tg("setMyCommands", {
    commands: [
      { command: "status", description: "Open change orders on this project" },
      { command: "approve", description: "Approve a change order, e.g. /approve 2" },
      { command: "decline", description: "Decline a change order, e.g. /decline 2" },
      { command: "send", description: "Contractor: send a change order to the client" },
      { command: "help", description: "How SnapContract works here" },
    ],
  }).catch(() => {});
  while (g.__tgGen === gen && token()) {
    try {
      const updates = await tg<Update[]>("getUpdates", { offset, timeout: 25, allowed_updates: ["message", "callback_query"] });
      for (const u of updates) {
        offset = u.update_id + 1;
        try {
          await handleUpdate(u);
        } catch (e) {
          console.error("[telegram] update", e);
          const chatId = u.message?.chat.id ?? u.callback_query?.message?.chat.id;
          if (chatId) await send(String(chatId), { text: (e as Error).message, quiet: true }).catch(() => {});
        }
      }
    } catch (e) {
      console.error("[telegram] poll", (e as Error).message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

export function startTelegram() {
  if (!token()) return;
  const gen = (g.__tgGen = (g.__tgGen ?? 0) + 1);
  void poll(gen);
}

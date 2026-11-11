import { getProject, listProjects, mutate } from "./db";
import { money, quoteChange } from "./pricing";
import type { ChangeOrder, Message, Project, Role } from "./types";

const g = globalThis as unknown as { __tgGen?: number };

function token() {
  return process.env.TELEGRAM_BOT_TOKEN ?? "";
}

export function telegramConfigured() {
  return Boolean(token());
}

let usernameCache: string | null = null;

export async function botUsername() {
  if (!token()) return null;
  if (usernameCache) return usernameCache;
  const me = await tg<{ username?: string }>("getMe");
  usernameCache = me.username ?? null;
  return usernameCache;
}

export function telegramLinks(projectId: string, username: string | null) {
  if (!username) return null;
  return {
    contractor: `https://t.me/${username}?start=c_${projectId}`,
    client: `https://t.me/${username}?start=u_${projectId}`,
  };
}

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

async function send(chatId: number, text: string, reply_markup?: unknown) {
  const clipped = text.length > 3900 ? `${text.slice(0, 3900)}…` : text;
  await tg("sendMessage", { chat_id: chatId, text: clipped, reply_markup });
}

type Update = {
  update_id: number;
  message?: { message_id: number; text?: string; chat: { id: number }; from?: { first_name?: string } };
  callback_query?: { id: string; data?: string; from?: { first_name?: string }; message?: { chat: { id: number } } };
};

function roleForChat(p: Project, chatId: number): Role | null {
  const tgCh = p.channels?.telegram;
  if (tgCh?.contractorChatId === chatId) return "contractor";
  if (tgCh?.clientChatId === chatId) return "client";
  return null;
}

function findLinked(chatId: number) {
  return listProjects().find((p) => p.channels?.telegram?.contractorChatId === chatId || p.channels?.telegram?.clientChatId === chatId);
}

function parseStart(text: string) {
  const m = text.match(/^\/start(?:@\w+)?(?:\s+|$)([cu])_([A-Za-z0-9_-]+)/);
  if (!m) return null;
  return { role: (m[1] === "c" ? "contractor" : "client") as Role, projectId: m[2] };
}

async function act(projectId: string, action: Parameters<Awaited<typeof import("./actions")>["runAction"]>[1]) {
  const { runAction } = await import("./actions");
  return runAction(projectId, action);
}

async function handleUpdate(u: Update) {
  if (u.callback_query) {
    const chatId = u.callback_query.message?.chat.id;
    const data = u.callback_query.data ?? "";
    await tg("answerCallbackQuery", { callback_query_id: u.callback_query.id });
    if (!chatId) return;
    const project = findLinked(chatId);
    const role = project ? roleForChat(project, chatId) : null;
    const [op, num] = data.split(":");
    const co = project?.changeOrders.find((c) => c.number === Number(num));
    if (!project || !role || !co) {
      await send(chatId, "This chat is not linked to that change order. Open the project link again.");
      return;
    }
    const name = u.callback_query.from?.first_name || (role === "client" ? project.client.name : project.contractor.name);
    if (op === "a" && role === "client") await act(project.id, { type: "approveChange", coId: co.id, name });
    else if (op === "d" && role === "client") await act(project.id, { type: "declineChange", coId: co.id, reason: "Declined in Telegram" });
    else if (op === "s" && role === "contractor") {
      if (co.lines.some((l) => !l.qty)) {
        await send(chatId, "This change still needs quantities before it can be sent.");
        return;
      }
      await act(project.id, { type: "sendChange", coId: co.id });
    } else await send(chatId, "That action isn't available for your role.");
    return;
  }

  const msg = u.message;
  const text = msg?.text?.trim();
  if (!msg || !text) return;
  const chatId = msg.chat.id;

  const start = parseStart(text);
  if (start) {
    const project = getProject(start.projectId);
    if (!project) {
      await send(chatId, `No project found for “${start.projectId}”.`);
      return;
    }
    await act(project.id, { type: "linkTelegram", role: start.role, chatId });
    await send(chatId, `You're linked as the ${start.role} on ${project.name}. Messages here go to the SnapContract agent. Reply /help for commands.`);
    return;
  }

  if (text === "/help" || text === "/start") {
    await send(chatId, "Link a project from its SnapContract page, then just text. Commands: /send 2, /approve 2, /decline 2.");
    return;
  }

  const project = findLinked(chatId);
  const role = project ? roleForChat(project, chatId) : null;
  if (!project || !role) {
    await send(chatId, "This chat isn't linked yet. Use the contractor or client link on the project page.");
    return;
  }

  const cmd = text.match(/^\/(send|approve|decline)(?:@\w+)?\s+(\d+)(?:\s+([\s\S]+))?$/i);
  if (cmd) {
    const co = project.changeOrders.find((c) => c.number === Number(cmd[2]));
    if (!co) {
      await send(chatId, `No CO-${cmd[2]} on this project.`);
      return;
    }
    const name = msg.from?.first_name || (role === "client" ? project.client.name : project.contractor.name);
    if (cmd[1].toLowerCase() === "approve" && role === "client") await act(project.id, { type: "approveChange", coId: co.id, name });
    else if (cmd[1].toLowerCase() === "decline" && role === "client") await act(project.id, { type: "declineChange", coId: co.id, reason: cmd[3]?.trim() || "Declined in Telegram" });
    else if (cmd[1].toLowerCase() === "send" && role === "contractor") await act(project.id, { type: "sendChange", coId: co.id });
    else await send(chatId, "That command is for the other person on this project.");
    return;
  }

  if (text.startsWith("/")) {
    await send(chatId, "Unknown command. /help");
    return;
  }

  await act(project.id, { type: "postMessage", author: role, kind: "text", body: text });
}

function keyboard(co: ChangeOrder, recipient: Role) {
  if (recipient === "client" && co.status === "client_review") {
    return { inline_keyboard: [[{ text: "Approve", callback_data: `a:${co.number}` }, { text: "Decline", callback_data: `d:${co.number}` }]] };
  }
  if (recipient === "contractor" && (co.status === "contractor_review" || co.status === "needs_info")) {
    return { inline_keyboard: [[{ text: "Send to client", callback_data: `s:${co.number}` }]] };
  }
  return undefined;
}

function outbound(p: Project, m: Message, recipient: Role): { text: string; markup?: unknown } | null {
  if (m.visibleTo && !m.visibleTo.includes(recipient)) return null;
  if (m.author === recipient) return null;
  if (m.author === "system") return { text: m.body };
  if (m.author === "agent") {
    const co = m.changeOrderId ? p.changeOrders.find((c) => c.id === m.changeOrderId) : undefined;
    if (co && recipient === "client" && (co.status === "needs_info" || co.status === "contractor_review")) {
      return { text: co.question ?? `${p.contractor.name.split(" ")[0]} is reviewing a possible change.` };
    }
    if (co) {
      const hidden = recipient === "client" && co.status !== "client_review" && co.status !== "approved" && co.status !== "declined";
      const price = hidden ? "" : `\n${money(quoteChange(p, co).total, { sign: true })}`;
      return { text: `CO-${co.number} · ${co.title}${co.summary ? `\n${co.summary}` : ""}${price}`, markup: keyboard(co, recipient) };
    }
    return { text: m.body };
  }
  const name = m.author === "contractor" ? p.contractor.name : p.client.name;
  return { text: `${name}: ${m.body}` };
}

export async function notifyTelegram(projectId: string) {
  if (!token()) return;
  const p = getProject(projectId);
  const channel = p?.channels?.telegram;
  if (!p || !channel) return;
  const delivered = new Set(channel.deliveredIds ?? []);
  const fresh = p.messages.filter((m) => !delivered.has(m.id));
  const targets: { role: Role; chatId?: number }[] = [
    { role: "contractor", chatId: channel.contractorChatId },
    { role: "client", chatId: channel.clientChatId },
  ];
  for (const m of fresh) {
    for (const target of targets) {
      if (!target.chatId) continue;
      const out = outbound(p, m, target.role);
      if (!out) continue;
      await send(target.chatId, out.text, out.markup);
    }
    delivered.add(m.id);
  }
  if (!fresh.length) return;
  mutate(projectId, (pp) => {
    pp.channels ??= {};
    pp.channels.telegram ??= {};
    pp.channels.telegram.deliveredIds = [...delivered].slice(-400);
  });
}

async function poll(gen: number) {
  let offset = 0;
  while (g.__tgGen === gen && token()) {
    try {
      const updates = await tg<Update[]>("getUpdates", { offset, timeout: 25, allowed_updates: ["message", "callback_query"] });
      for (const u of updates) {
        offset = u.update_id + 1;
        try {
          await handleUpdate(u);
        } catch (e) {
          console.error("telegram update", e);
          const chatId = u.message?.chat.id ?? u.callback_query?.message?.chat.id;
          if (chatId) await send(chatId, (e as Error).message).catch(() => {});
        }
      }
    } catch (e) {
      console.error("telegram poll", e);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

if (token()) {
  const gen = (g.__tgGen = (g.__tgGen ?? 0) + 1);
  void poll(gen);
}

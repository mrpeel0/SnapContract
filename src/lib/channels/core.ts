import { getProject, listProjects } from "../db";
import { money, quoteChange } from "../pricing";
import type { ChangeOrder, ChannelKind, Message, Project, Role } from "../types";
import type { Action } from "../actions";

export const CHANNEL_LABEL: Record<ChannelKind, string> = {
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  imessage: "iMessage",
};

/** A channel-neutral outbound message. Each adapter renders it in its own format. */
export interface OutMsg {
  title?: string;
  text: string;
  items?: string[];
  total?: string;
  note?: string;
  buttons?: { id: string; label: string }[];
  quiet?: boolean; // system event: render muted
}

export interface Adapter {
  kind: ChannelKind;
  configured(): boolean;
  send(to: string, out: OutMsg): Promise<void>;
  /** Where people text, plus per-role join links. */
  info(projectId: string): Promise<{ address: string | null; links: { contractor: string; client: string } | null; error?: string | null }>;
  setup: string[];
}

// ---------- link codes ----------
export const joinCode = (role: Role, projectId: string) => `${role === "contractor" ? "c" : "u"}_${projectId}`;

function parseJoin(text: string) {
  const m = text.match(/^(?:\/start(?:@\w+)?\s+|join\s+)?([cu])_([a-z0-9_-]+)\s*$/i);
  if (!m) return null;
  return { role: (m[1].toLowerCase() === "c" ? "contractor" : "client") as Role, projectId: m[2].toLowerCase() };
}

// ---------- routing ----------
export function linkedProject(kind: ChannelKind, sender: string): { project: Project; role: Role } | null {
  for (const p of listProjects()) {
    const l = p.channels?.[kind];
    if (l?.contractor === sender) return { project: p, role: "contractor" };
    if (l?.client === sender) return { project: p, role: "client" };
  }
  return null;
}

async function act(projectId: string, action: Action) {
  const { runAction } = await import("../actions");
  return runAction(projectId, action);
}

const first = (name: string) => name.split(" ")[0];

const HELP = (role?: Role) =>
  role === "contractor"
    ? "Text here like you normally would. I flag anything that changes the contract, price it from your rate sheet and send it to you to review.\n\nCommands: send 2 · dismiss 2 · status"
    : role === "client"
      ? "Text here like you normally would. When a request changes the contract, I'll send you the price to approve right here.\n\nCommands: approve 2 · decline 2 · status"
      : "Open your project's SnapContract page and use the Connect link to join a project.";

/** Button ids and typed commands share one grammar: a:2 / approve 2 / approve CO-2 / /approve 2 */
function parseCommand(text: string) {
  const btn = text.match(/^([adsv]):(\d+)$/);
  if (btn) return { op: ({ a: "approve", d: "decline", s: "send", v: "dismiss" } as const)[btn[1] as "a" | "d" | "s" | "v"], num: Number(btn[2]), reason: "" };
  const slash = text.match(/^\/(approve|decline|send|dismiss)(?:@\w+)?\s+(?:co-?)?(\d+)(?:\s+([\s\S]+))?$/i);
  if (slash) return { op: slash[1].toLowerCase() as "approve", num: Number(slash[2]), reason: slash[3]?.trim() ?? "" };
  const plain = text.match(/^(approve|decline|send|dismiss)\s+(?:co-?)?(\d+)\s*(?:[:\-–]\s*([\s\S]+))?$/i);
  if (plain) return { op: plain[1].toLowerCase() as "approve", num: Number(plain[2]), reason: plain[3]?.trim() ?? "" };
  return null;
}

export async function handleInbound(
  kind: ChannelKind,
  sender: string,
  raw: string,
  opts: { name?: string; reply: (out: OutMsg) => Promise<void>; typing?: () => Promise<void> },
) {
  const text = raw.trim();
  if (!text) return;

  const join = parseJoin(text);
  if (join) {
    const project = getProject(join.projectId);
    if (!project) return opts.reply({ text: `I couldn't find a project for “${join.projectId}”. Scan the code on the project page again.` });
    await act(project.id, { type: "linkChannel", channel: kind, role: join.role, sender });
    const party = join.role === "contractor" ? project.contractor : project.client;
    const other = join.role === "contractor" ? project.client : project.contractor;
    return opts.reply({
      title: `Connected to ${project.name}`,
      text: `You're in as ${party.name} (${join.role}). Messages here go straight into the project conversation with ${other.name}.`,
      note: HELP(join.role),
    });
  }

  const linked = linkedProject(kind, sender);
  if (/^\/?(help|start)$/i.test(text)) return opts.reply({ title: "SnapContract", text: HELP(linked?.role) });
  if (!linked) return opts.reply({ title: "SnapContract", text: "This chat isn't connected to a project yet. Scan the QR code on the project page, or open its Connect link." });

  const { project, role } = linked;

  if (/^\/?status$/i.test(text)) return opts.reply(statusMessage(project, role));

  const cmd = parseCommand(text);
  if (cmd) {
    const co = project.changeOrders.find((c) => c.number === cmd.num);
    if (!co) return opts.reply({ text: `There's no CO-${cmd.num} on ${project.name}.` });
    const name = opts.name || (role === "client" ? project.client.name : project.contractor.name);
    if (role === "client" && cmd.op === "approve") {
      if (co.status !== "client_review") return opts.reply({ text: `CO-${co.number} isn't waiting for your approval (${co.status.replace("_", " ")}).` });
      await act(project.id, { type: "approveChange", coId: co.id, name });
      return;
    }
    if (role === "client" && cmd.op === "decline") {
      if (co.status !== "client_review") return opts.reply({ text: `CO-${co.number} isn't waiting for your approval.` });
      await act(project.id, { type: "declineChange", coId: co.id, reason: cmd.reason || `Declined in ${CHANNEL_LABEL[kind]}` });
      return;
    }
    if (role === "contractor" && cmd.op === "send") {
      if (co.lines.some((l) => !l.qty)) return opts.reply({ text: `CO-${co.number} still needs quantities before it can go to ${first(project.client.name)}.` });
      await act(project.id, { type: "sendChange", coId: co.id }); // the "sent" event is delivered to this chat
      return;
    }
    if (role === "contractor" && cmd.op === "dismiss") {
      await act(project.id, { type: "voidChange", coId: co.id });
      return opts.reply({ text: `Dismissed CO-${co.number}. It won't be billed.`, quiet: true });
    }
    return opts.reply({ text: `That action is for the ${role === "client" ? "contractor" : "client"} on this project.` });
  }

  if (text.startsWith("/")) return opts.reply({ text: "I don't know that command. Send help to see what I can do." });

  await act(project.id, { type: "postMessage", author: role, kind: "text", body: text, via: kind });
  if (project.agreement.status === "signed") await opts.typing?.().catch(() => {});
}

// ---------- outbound formatting ----------
function itemLines(p: Project, co: ChangeOrder) {
  return quoteChange(p, co).lines.map((l) => {
    const qty = l.qty ? `${l.qty} ${l.unit}` : "qty needed";
    return `${l.sign > 0 ? "+" : "−"} ${l.name} · ${qty} · ${money(l.total)}`;
  });
}

function totals(p: Project, co: ChangeOrder) {
  const q = quoteChange(p, co);
  const days = co.scheduleImpactDays > 0 ? ` · +${co.scheduleImpactDays} day${co.scheduleImpactDays > 1 ? "s" : ""}` : "";
  return { q, total: `Total ${money(q.total, { sign: true })}${days}` };
}

function changeOrderMessage(p: Project, co: ChangeOrder, recipient: Role): OutMsg {
  const client = first(p.client.name);
  const contractor = first(p.contractor.name);
  if (recipient === "client") {
    if (co.status === "needs_info") return { title: "Quick question", text: co.question ?? `${contractor} needs a detail to price your request.` };
    if (co.status === "contractor_review") return { text: `Got it. ${contractor} is reviewing “${co.title}” and will send you the price here to approve.`, quiet: true };
    if (co.status === "client_review") {
      const { total } = totals(p, co);
      return {
        title: `CO-${co.number} · ${co.title}`,
        text: co.summary || "Change to your signed scope.",
        items: itemLines(p, co),
        total,
        note: co.contractorNote ? `Note from ${contractor}: ${co.contractorNote}` : "Approving signs this change and updates your invoice.",
        buttons: [
          { id: `a:${co.number}`, label: "Approve" },
          { id: `d:${co.number}`, label: "Decline" },
        ],
      };
    }
  }
  const { q, total } = totals(p, co);
  if (co.status === "needs_info") {
    return { title: `CO-${co.number} · ${co.title}`, text: co.summary, items: itemLines(p, co), note: `Asked ${client}: “${co.question ?? "a follow-up"}”. I'll finish pricing when they reply.` };
  }
  if (co.status === "contractor_review") {
    return {
      title: `New change · CO-${co.number} · ${co.title}`,
      text: co.summary || "Change to the signed scope.",
      items: itemLines(p, co),
      total,
      note: q.markup > 0 ? `Includes ${q.markupPct}% O&P (${money(q.markup)}). Send it to ${client} when it looks right.` : `Send it to ${client} when it looks right.`,
      buttons: [
        { id: `s:${co.number}`, label: `Send to ${client}`.slice(0, 20) },
        { id: `v:${co.number}`, label: "Not a change" },
      ],
    };
  }
  return { title: `CO-${co.number} · ${co.title}`, text: co.summary, total };
}

export function buildOutbound(p: Project, m: Message, recipient: Role): OutMsg | null {
  if (m.visibleTo && !m.visibleTo.includes(recipient)) return null;
  if (m.author === recipient) return null;
  if (m.author === "system") return { text: m.body, quiet: true };
  if (m.author === "agent") {
    const co = m.changeOrderId ? p.changeOrders.find((c) => c.id === m.changeOrderId) : undefined;
    return co ? changeOrderMessage(p, co, recipient) : { title: "SnapContract", text: m.body };
  }
  const party = m.author === "contractor" ? p.contractor : p.client;
  const tag = m.kind === "voice" ? " · voice note" : m.kind === "transcript" ? " · call transcript" : "";
  return { title: `${party.name}${tag}`, text: m.body };
}

function statusMessage(p: Project, role: Role): OutMsg {
  const open = p.changeOrders.filter((c) => ["needs_info", "contractor_review", "client_review"].includes(c.status));
  const visible = role === "client" ? open.filter((c) => c.status === "client_review") : open;
  const approved = p.changeOrders.filter((c) => c.status === "approved");
  const sum = (cs: ChangeOrder[]) => cs.reduce((s, c) => s + quoteChange(p, c).total, 0);
  return {
    title: p.name,
    text: `${approved.length} approved change${approved.length === 1 ? "" : "s"} (${money(sum(approved), { sign: true })}).`,
    items: visible.length ? visible.map((c) => `CO-${c.number} · ${c.title} · ${c.status === "client_review" ? "awaiting approval" : "in review"}`) : ["Nothing waiting on you."],
  };
}

// ---------- rendering helpers shared by adapters ----------
export function plainText(out: OutMsg, opts: { bold?: (s: string) => string; italic?: (s: string) => string; buttonsAsText?: boolean } = {}) {
  const b = opts.bold ?? ((s) => s);
  const i = opts.italic ?? ((s) => s);
  const parts: string[] = [];
  if (out.title) parts.push(b(out.title));
  parts.push(out.quiet ? i(out.text) : out.text);
  if (out.items?.length) parts.push(out.items.join("\n"));
  if (out.total) parts.push(b(out.total));
  if (out.note) parts.push(i(out.note));
  if (opts.buttonsAsText && out.buttons?.length) {
    parts.push(`Reply ${out.buttons.map((x) => `“${commandFor(x.id)}”`).join(" or ")}`);
  }
  return parts.filter(Boolean).join("\n\n");
}

function commandFor(id: string) {
  const [op, n] = id.split(":");
  return `${({ a: "approve", d: "decline", s: "send", v: "dismiss" } as Record<string, string>)[op] ?? op} ${n}`;
}

import { getProject, listProjects, mutate } from "./db";
import { money, quoteChange } from "./pricing";
import { phoneDigits } from "./phone";
import type { ChangeOrder, Message, Project, Role } from "./types";

export type PhoneChannelId = "whatsapp" | "imessage";

const seen = new Set<string>();

export function freshInbound(id?: string) {
  if (!id) return true;
  if (seen.has(id)) return false;
  seen.add(id);
  if (seen.size > 500) seen.delete(seen.values().next().value!);
  return true;
}

export function relayText(p: Project, m: Message, recipient: Role): string | null {
  if (m.visibleTo && !m.visibleTo.includes(recipient)) return null;
  if (m.author === recipient) return null;
  if (m.author === "system") return m.body;
  if (m.author === "agent") {
    const co = m.changeOrderId ? p.changeOrders.find((c) => c.id === m.changeOrderId) : undefined;
    if (co && recipient === "client" && (co.status === "needs_info" || co.status === "contractor_review")) {
      return co.question ?? `${p.contractor.name.split(" ")[0]} is reviewing a possible change.`;
    }
    if (co) {
      const hidden = recipient === "client" && !["client_review", "approved", "declined"].includes(co.status);
      const price = hidden ? "" : `\n${money(quoteChange(p, co).total, { sign: true })}`;
      return `CO-${co.number} · ${co.title}${co.summary ? `\n${co.summary}` : ""}${price}`;
    }
    return m.body;
  }
  const name = m.author === "contractor" ? p.contractor.name : p.client.name;
  const prefix = m.kind === "voice" ? "Voice note: " : m.kind === "transcript" ? "Call transcript:\n" : "";
  return `${name}: ${prefix}${m.body}`;
}

export function relayActions(p: Project, m: Message, recipient: Role): { id: string; title: string }[] | undefined {
  if (m.author !== "agent" || !m.changeOrderId) return;
  const co = p.changeOrders.find((c) => c.id === m.changeOrderId);
  if (!co) return;
  if (recipient === "client" && co.status === "client_review") {
    return [
      { id: `a:${co.number}`, title: "Approve" },
      { id: `d:${co.number}`, title: "Decline" },
    ];
  }
  if (recipient === "contractor" && (co.status === "contractor_review" || co.status === "needs_info") && co.lines.every((l) => l.qty)) {
    return [{ id: `s:${co.number}`, title: "Send to client" }];
  }
  return;
}

type Control =
  | { kind: "link"; role: Role; projectId: string }
  | { kind: "approve"; n: number }
  | { kind: "decline"; n: number; reason: string }
  | { kind: "send"; n: number };

export function parseControl(text: string): Control | null {
  const link = text.trim().match(/^(?:\/start(?:@\w+)?\s+)?(?:link\s+)?([cu])_([A-Za-z0-9_-]+)$/i);
  if (link) return { kind: "link", role: link[1].toLowerCase() === "c" ? "contractor" : "client", projectId: link[2] };
  const button = text.trim().match(/^([ads]):(\d+)$/i);
  if (button) {
    const n = Number(button[2]);
    const op = button[1].toLowerCase();
    if (op === "a") return { kind: "approve", n };
    if (op === "d") return { kind: "decline", n, reason: "" };
    return { kind: "send", n };
  }
  const cmd = text.trim().match(/^(?:\/)?(approve|decline|send)\s+(\d+)(?:\s+([\s\S]+))?$/i);
  if (!cmd) return null;
  const n = Number(cmd[2]);
  const op = cmd[1].toLowerCase();
  if (op === "approve") return { kind: "approve", n };
  if (op === "decline") return { kind: "decline", n, reason: cmd[3]?.trim() || "" };
  return { kind: "send", n };
}

function findPhone(channel: PhoneChannelId, from: string) {
  const digits = from.replace(/\D/g, "");
  const project = listProjects().find((p) => {
    const slot = p.channels?.[channel];
    return slot?.contractorAddress === digits || slot?.clientAddress === digits;
  });
  if (!project) return null;
  const slot = project.channels?.[channel];
  const role: Role = slot?.contractorAddress === digits ? "contractor" : "client";
  return { project, role };
}

function order(project: Project, n: number) {
  return project.changeOrders.find((c) => c.number === n);
}

export async function ingestPhoneMessage(opts: { channel: PhoneChannelId; from: string; text: string; messageId?: string; reply: (text: string) => Promise<void> }) {
  if (!freshInbound(opts.messageId)) return;
  const text = opts.text.trim();
  if (!text) return;
  const label = opts.channel === "whatsapp" ? "WhatsApp" : "iMessage";
  const { runAction } = await import("./actions");
  const control = parseControl(text);

  if (control?.kind === "link") {
    const project = getProject(control.projectId);
    if (!project) {
      await opts.reply(`No project found for “${control.projectId}”.`);
      return;
    }
    await runAction(project.id, { type: "linkChannel", channel: opts.channel, role: control.role, address: phoneDigits(opts.from) });
    return;
  }

  const linked = findPhone(opts.channel, opts.from);
  if (!linked) {
    await opts.reply(`This number isn't linked to a SnapContract project. On the project, open ${label} and save this phone, or text: link c_PROJECTID`);
    return;
  }

  const { project, role } = linked;
  if (!control) {
    await runAction(project.id, { type: "postMessage", author: role, kind: "text", body: text });
    return;
  }

  const co: ChangeOrder | undefined = order(project, control.n);
  if (!co) {
    await opts.reply(`No CO-${control.n} on this project.`);
    return;
  }
  const name = role === "client" ? project.client.name : project.contractor.name;
  if (control.kind === "approve" && role === "client") await runAction(project.id, { type: "approveChange", coId: co.id, name });
  else if (control.kind === "decline" && role === "client") await runAction(project.id, { type: "declineChange", coId: co.id, reason: control.reason || `Declined in ${label}` });
  else if (control.kind === "send" && role === "contractor") await runAction(project.id, { type: "sendChange", coId: co.id });
  else await opts.reply("That action is for the other person on this project.");
}

export async function deliverChannel(projectId: string, channel: PhoneChannelId, send: (to: string, text: string, actions?: { id: string; title: string }[]) => Promise<void>) {
  const p = getProject(projectId);
  const slot = p?.channels?.[channel];
  if (!p || !slot) return;
  const delivered = new Set(slot.deliveredIds ?? []);
  const fresh = p.messages.filter((m) => !delivered.has(m.id));
  const targets: { role: Role; to?: string }[] = [
    { role: "contractor", to: slot.contractorAddress },
    { role: "client", to: slot.clientAddress },
  ];
  for (const m of fresh) {
    let ok = true;
    for (const target of targets) {
      if (!target.to) continue;
      const text = relayText(p, m, target.role);
      if (!text) continue;
      try {
        await send(target.to, text, relayActions(p, m, target.role));
      } catch (e) {
        ok = false;
        console.error(`${channel} send`, e);
      }
    }
    if (ok) delivered.add(m.id);
  }
  if (!fresh.length) return;
  mutate(projectId, (pp) => {
    pp.channels ??= {};
    const current = pp.channels[channel] ?? {};
    current.deliveredIds = [...delivered].slice(-400);
    pp.channels[channel] = current;
  });
}

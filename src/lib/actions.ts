import { getProject, mutate, saveProject } from "./db";
import { analyzeMessages, draftAgreement } from "./ai/agents";
import { budget, quoteChange, money } from "./pricing";
import { emptyAgreement, uid, SAMPLE_PRICE_SHEET } from "./seed";
import type { ChangeLine, ChangeOrder, Message, MessageKind, PaymentMilestone, PriceItem, Project, Role, AgreementSection, LineItem } from "./types";

const now = () => new Date().toISOString();

function sysMsg(p: Project, body: string) {
  p.messages.push({ id: uid("m"), author: "system", kind: "event", body, createdAt: now() });
}

function pushInvoice(p: Project, reason: string) {
  const b = budget(p);
  p.invoices.push({
    version: p.invoices.length + 1,
    createdAt: now(),
    reason,
    total: b.current,
    changeOrderIds: p.changeOrders.filter((c) => c.status === "approved").map((c) => c.id),
  });
}

// ---------- agent queue (one run at a time per project) ----------
const g = globalThis as unknown as { __snapQueue?: Map<string, { running: boolean; pending: string[] }> };
g.__snapQueue ??= new Map();

function enqueueAnalysis(projectId: string, messageId: string) {
  const q = g.__snapQueue!.get(projectId) ?? { running: false, pending: [] };
  g.__snapQueue!.set(projectId, q);
  q.pending.push(messageId);
  if (!q.running) void drain(projectId);
}

async function drain(projectId: string) {
  const q = g.__snapQueue!.get(projectId)!;
  q.running = true;
  try {
    while (q.pending.length) {
      const ids = q.pending.splice(0);
      const p = getProject(projectId);
      if (!p) break;
      const msgs = p.messages.filter((m) => ids.includes(m.id));
      mutate(projectId, (pp) => {
        pp.agentStatus = "thinking";
        pp.agentStatusText = msgs.some((m) => m.kind === "transcript") ? "Reading call transcript…" : "Checking for scope changes…";
      });
      const started = Date.now();
      const { result, mode } = await analyzeMessages(p, msgs);
      // Small floor so the "thinking" state is visible in the demo.
      const wait = 900 - (Date.now() - started);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      mutate(projectId, (pp) => {
        pp.aiMode = mode;
        for (const c of result.changes) applyProposal(pp, c);
      });
    }
  } catch (e) {
    console.error("agent drain failed", e);
  } finally {
    q.running = false;
    mutate(projectId, (pp) => {
      pp.agentStatus = "idle";
      pp.agentStatusText = undefined;
    });
  }
}

function applyProposal(p: Project, c: Awaited<ReturnType<typeof analyzeMessages>>["result"]["changes"][number]) {
  const lines: ChangeLine[] = c.lines.map((l) => ({ id: uid("l"), sku: l.sku, qty: l.qty, action: l.action, note: l.note ?? undefined }));
  const existing = c.updatesChangeOrderNumber
    ? p.changeOrders.find((x) => x.number === c.updatesChangeOrderNumber && !["approved", "void"].includes(x.status))
    : undefined;
  const status = c.question ? "needs_info" : "contractor_review";

  if (existing) {
    Object.assign(existing, {
      title: c.title,
      summary: c.summary,
      lines,
      assumptions: c.assumptions,
      question: c.question ?? undefined,
      scheduleImpactDays: c.scheduleImpactDays,
      confidence: c.confidence,
      status,
      sourceMessageIds: [...new Set([...existing.sourceMessageIds, ...c.sourceMessageIds])],
    });
    existing.history.push({ at: now(), actor: "agent", action: c.question ? "Asked a follow-up" : "Filled in missing details · ready for contractor review" });
    p.messages.push({ id: uid("m"), author: "agent", kind: "text", body: `Updated CO-${existing.number}`, createdAt: now(), changeOrderId: existing.id });
    return;
  }

  const co: ChangeOrder = {
    id: uid("co_"),
    number: Math.max(0, ...p.changeOrders.map((x) => x.number)) + 1,
    title: c.title,
    summary: c.summary,
    status,
    lines,
    assumptions: c.assumptions,
    question: c.question ?? undefined,
    scheduleImpactDays: c.scheduleImpactDays,
    confidence: c.confidence,
    sourceMessageIds: c.sourceMessageIds,
    createdAt: now(),
    history: [{ at: now(), actor: "agent", action: c.question ? "Detected possible change · needs details" : "Detected change · drafted estimate" }],
  };
  p.changeOrders.push(co);
  p.messages.push({ id: uid("m"), author: "agent", kind: "text", body: c.question ?? `Drafted CO-${co.number}`, createdAt: now(), changeOrderId: co.id });
}

// ---------- agreement drafting ----------
async function runDraft(projectId: string) {
  const p = getProject(projectId)!;
  const { draft, mode } = await draftAgreement(p);
  mutate(projectId, (pp) => {
    pp.aiMode = mode;
    pp.agentStatus = "idle";
    pp.agentStatusText = undefined;
    pp.agreement = {
      ...pp.agreement,
      status: "draft",
      title: draft.title,
      summary: draft.summary,
      sections: draft.sections,
      baseline: draft.baseline.map((l) => ({ id: uid("b"), sku: l.sku, qty: l.qty, note: l.note ?? undefined })),
      payments: draft.payments,
      timelineWeeks: draft.timelineWeeks,
      changeMarkupPct: draft.changeMarkupPct,
      signatures: {},
      draftedBy: mode === "live" ? "ai" : "template",
    };
  });
}

// ---------- public actions ----------
export type Action =
  | { type: "postMessage"; author: Role; kind: MessageKind; body: string }
  | { type: "draftAgreement" }
  | { type: "updateAgreement"; sections?: AgreementSection[]; baseline?: LineItem[]; payments?: PaymentMilestone[]; changeMarkupPct?: number; timelineWeeks?: number; summary?: string }
  | { type: "signAgreement"; role: Role; name: string }
  | { type: "updateChange"; coId: string; lines?: ChangeLine[]; title?: string; summary?: string; contractorNote?: string; scheduleImpactDays?: number }
  | { type: "sendChange"; coId: string }
  | { type: "approveChange"; coId: string; name: string }
  | { type: "declineChange"; coId: string; reason: string }
  | { type: "voidChange"; coId: string }
  | { type: "createManualChange" }
  | { type: "updatePriceSheet"; items: PriceItem[] };

export async function runAction(projectId: string, a: Action): Promise<Project> {
  switch (a.type) {
    case "postMessage": {
      const msg: Message = { id: uid("m"), author: a.author, kind: a.kind, body: a.body.trim(), createdAt: now() };
      if (!msg.body) throw new Error("Empty message");
      const p = mutate(projectId, (pp) => {
        pp.messages.push(msg);
        if (pp.agreement.status === "signed") {
          pp.agentStatus = "thinking";
          pp.agentStatusText = "Reading…";
        }
      });
      if (p.agreement.status === "signed") enqueueAnalysis(projectId, msg.id);
      return p;
    }
    case "draftAgreement": {
      const p = mutate(projectId, (pp) => {
        pp.agreement.status = "drafting";
        pp.agentStatus = "thinking";
        pp.agentStatusText = "Drafting agreement from your scope and rates…";
      });
      void runDraft(projectId).catch((e) => {
        console.error(e);
        mutate(projectId, (pp) => {
          pp.agreement.status = "none";
          pp.agentStatus = "idle";
        });
      });
      return p;
    }
    case "updateAgreement":
      return mutate(projectId, (pp) => {
        const { type: _t, ...patch } = a;
        void _t;
        Object.assign(pp.agreement, Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)));
        pp.agreement.signatures = {}; // edits invalidate signatures
      });
    case "signAgreement":
      return mutate(projectId, (pp) => {
        pp.agreement.signatures[a.role] = { name: a.name, at: now() };
        if (pp.agreement.signatures.contractor && pp.agreement.signatures.client && pp.agreement.status !== "signed") {
          pp.agreement.status = "signed";
          pushInvoice(pp, "Agreement signed");
          sysMsg(pp, `Agreement signed by both parties · baseline locked at ${money(budget(pp).baseline)}`);
          pp.messages.push({
            id: uid("m"),
            author: "agent",
            kind: "text",
            body: "I'm now following this conversation. Whenever someone asks for something that changes the signed scope, I'll price it from the rate sheet and draft a change order for review.",
            createdAt: now(),
          });
        }
      });
    case "updateChange":
      return mutate(projectId, (pp) => {
        const co = find(pp, a.coId);
        if (a.lines) co.lines = a.lines;
        if (a.title !== undefined) co.title = a.title;
        if (a.summary !== undefined) co.summary = a.summary;
        if (a.contractorNote !== undefined) co.contractorNote = a.contractorNote;
        if (a.scheduleImpactDays !== undefined) co.scheduleImpactDays = a.scheduleImpactDays;
        if (co.status === "needs_info" && co.lines.every((l) => l.qty > 0) && a.lines) {
          co.status = "contractor_review";
          co.question = undefined;
        }
      });
    case "sendChange":
      return mutate(projectId, (pp) => {
        const co = find(pp, a.coId);
        co.status = "client_review";
        co.question = undefined;
        co.history.push({ at: now(), actor: "contractor", action: "Reviewed & sent to client", note: money(quoteChange(pp, co).total) });
        pp.messages.push({ id: uid("m"), author: "agent", kind: "text", body: `CO-${co.number} ready for approval`, createdAt: now(), changeOrderId: co.id, visibleTo: ["client"] });
        sysMsg(pp, `${pp.contractor.name} sent CO-${co.number} to ${pp.client.name} for approval`);
      });
    case "approveChange":
      return mutate(projectId, (pp) => {
        const co = find(pp, a.coId);
        const total = quoteChange(pp, co).total;
        co.status = "approved";
        co.approval = { name: a.name, at: now(), total };
        co.history.push({ at: now(), actor: "client", action: "Approved", note: `Signed by ${a.name}` });
        pushInvoice(pp, `CO-${co.number} approved`);
        sysMsg(pp, `CO-${co.number} approved by ${a.name} · ${money(total, { sign: true })} · invoice updated to v${pp.invoices.length}`);
      });
    case "declineChange":
      return mutate(projectId, (pp) => {
        const co = find(pp, a.coId);
        co.status = "declined";
        co.declineReason = a.reason;
        co.history.push({ at: now(), actor: "client", action: "Declined", note: a.reason });
        sysMsg(pp, `CO-${co.number} declined by ${pp.client.name}${a.reason ? `: “${a.reason}”` : ""}`);
      });
    case "voidChange":
      return mutate(projectId, (pp) => {
        const co = find(pp, a.coId);
        co.status = "void";
        co.history.push({ at: now(), actor: "contractor", action: "Dismissed" });
      });
    case "createManualChange":
      return mutate(projectId, (pp) => {
        const co: ChangeOrder = {
          id: uid("co_"),
          number: Math.max(0, ...pp.changeOrders.map((x) => x.number)) + 1,
          title: "New change order",
          summary: "",
          status: "contractor_review",
          lines: [],
          assumptions: [],
          scheduleImpactDays: 0,
          confidence: 1,
          sourceMessageIds: [],
          createdAt: now(),
          history: [{ at: now(), actor: "contractor", action: "Created manually" }],
        };
        pp.changeOrders.push(co);
      });
    case "updatePriceSheet":
      return mutate(projectId, (pp) => {
        pp.priceSheet = a.items;
      });
  }
}

function find(p: Project, id: string) {
  const co = p.changeOrders.find((c) => c.id === id);
  if (!co) throw new Error("Change order not found");
  return co;
}

export function createProject(input: { name: string; address: string; description: string; contractorName: string; company?: string; clientName: string; priceSheet?: PriceItem[] }) {
  const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "project";
  const p: Project = {
    id: `${slug}-${Math.random().toString(36).slice(2, 6)}`,
    name: input.name,
    address: input.address,
    description: input.description,
    contractor: { name: input.contractorName, company: input.company },
    client: { name: input.clientName },
    createdAt: now(),
    priceSheet: input.priceSheet?.length ? input.priceSheet : SAMPLE_PRICE_SHEET,
    agreement: emptyAgreement(),
    messages: [],
    changeOrders: [],
    invoices: [],
    agentStatus: "idle",
  };
  return saveProject(p);
}

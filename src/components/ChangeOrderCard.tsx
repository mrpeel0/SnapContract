"use client";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import { useMemo, useState } from "react";
import { CalendarClock, Check, ChevronDown, CreditCard, Minus, Pencil, Plus, Send, Sparkles, Trash2, X, PenLine, Quote, ShieldCheck, HelpCircle } from "lucide-react";
import type { ChangeLine, ChangeOrder, Project, Role } from "@/lib/types";
import { materialsSpend, money, quoteChange } from "@/lib/pricing";
import { ProjectCardFace } from "./Finance";
import { AnimatedMoney, Button, StatusPill } from "./ui";
import type { Act } from "./useProject";

export function ChangeOrderCard({ project, co, role, act, compact, ramp }: { project: Project; co: ChangeOrder; role: Role; act: Act; compact?: boolean; ramp?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ChangeLine[]>(co.lines);
  const [note, setNote] = useState(co.contractorNote ?? "");
  const [signing, setSigning] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [sigName, setSigName] = useState(project.client.name);
  const [reason, setReason] = useState("");
  const [showDetails, setShowDetails] = useState(!compact);
  const [busy, setBusy] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);

  const lines = editing ? draft : co.lines;
  const quote = useMemo(() => quoteChange(project, { lines }), [project, lines]);
  const materials = useMemo(() => materialsSpend(project, { lines }), [project, lines]);
  const purchase = (project.purchases ?? []).find((card) => card.changeOrderId === co.id);
  const added = quote.lines.filter((l) => l.sign > 0).reduce((s, l) => s + l.total, 0);
  const marginPct = added + quote.markup > 0 ? ((quote.markup / (added + quote.markup)) * 100).toFixed(1) : null;
  const hiddenFromClient = role === "client" && ["needs_info", "contractor_review"].includes(co.status);
  const sources = project.messages.filter((m) => co.sourceMessageIds.includes(m.id));
  const missingQty = lines.some((l) => !l.qty);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const saveEdits = () =>
    run(async () => {
      await act({ type: "updateChange", coId: co.id, lines: draft, contractorNote: note });
      setEditing(false);
    });

  const approve = () =>
    run(async () => {
      await act({ type: "approveChange", coId: co.id, name: sigName });
      setSigning(false);
      confetti({ particleCount: 140, spread: 80, origin: { y: 0.7 }, colors: ["#e8590c", "#0e9f6e", "#5b4fe0", "#0f1012"] });
    });

  return (
    <motion.div layout initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className={clsx("agent-border rounded-2xl overflow-hidden elevated")}>
      {/* header */}
      <div className="flex items-start gap-3 px-4 pt-3.5 pb-3 bg-agent/[0.035]">
        <div className="mt-0.5 h-8 w-8 shrink-0 rounded-xl bg-agent grid place-items-center text-white">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] font-semibold text-muted">CO-{co.number}</span>
            <StatusPill status={co.status} />
            {co.confidence < 1 && !hiddenFromClient && (
              <span className="text-[11px] text-muted inline-flex items-center gap-1" title="Agent confidence">
                <span className="h-1 w-10 rounded-full bg-black/10 overflow-hidden inline-block">
                  <span className="block h-full bg-agent" style={{ width: `${Math.round(co.confidence * 100)}%` }} />
                </span>
                {Math.round(co.confidence * 100)}%
              </span>
            )}
          </div>
          <div className="mt-1 font-semibold leading-snug">{co.title}</div>
          {co.summary && <div className="text-[13px] text-muted leading-snug mt-0.5">{co.summary}</div>}
        </div>
        {!hiddenFromClient && (
          <div className="text-right shrink-0">
            <div className={clsx("text-lg font-semibold", quote.total < 0 ? "text-good" : "text-ink")}>
              <AnimatedMoney value={quote.total} sign />
            </div>
            {co.scheduleImpactDays > 0 && (
              <div className="text-[11px] text-muted inline-flex items-center gap-1">
                <CalendarClock className="h-3 w-3" /> +{co.scheduleImpactDays} day{co.scheduleImpactDays > 1 ? "s" : ""}
              </div>
            )}
          </div>
        )}
      </div>

      {/* question */}
      {co.status === "needs_info" && co.question && (
        <div className="mx-4 mb-3 rounded-xl bg-warn/10 border border-warn/30 px-3 py-2 text-[13px] flex gap-2">
          <HelpCircle className="h-4 w-4 text-warn shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Agent asks: </span>
            {co.question}
            <div className="text-[11.5px] text-muted mt-0.5">{role === "client" ? "Reply in the chat and I'll finish the estimate." : "Waiting on the client's reply, or fill in quantities yourself."}</div>
          </div>
        </div>
      )}

      {hiddenFromClient ? (
        <div className="px-4 pb-4 text-[13px] text-muted flex items-center gap-2">
          <span className="dot-pulse flex gap-1"><span /><span /><span /></span>
          {co.status === "needs_info" ? "Gathering details for your request" : `${project.contractor.name} is reviewing the estimate for your request`}
        </div>
      ) : (
        <>
          {/* lines */}
          <div className="px-4">
            <button onClick={() => setShowDetails((s) => !s)} className="w-full flex items-center justify-between text-[11.5px] uppercase tracking-wider text-muted font-semibold py-1.5 cursor-pointer">
              <span>{lines.length} line item{lines.length === 1 ? "" : "s"}</span>
              <ChevronDown className={clsx("h-3.5 w-3.5 transition-transform", showDetails && "rotate-180")} />
            </button>
            <AnimatePresence initial={false}>
              {showDetails && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="divide-y divide-line/70 border-y border-line/70">
                    {quote.lines.map((l, i) => (
                      <div key={l.id} className="py-2 flex items-center gap-3 text-[13px]">
                        <span className={clsx("h-5 w-5 rounded-md grid place-items-center shrink-0", l.sign > 0 ? "bg-accent/10 text-accent" : "bg-good/10 text-good")}>
                          {l.sign > 0 ? <Plus className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{l.name}</div>
                          <div className="text-[11.5px] text-muted">
                            {editing ? (
                              <span className="inline-flex items-center gap-1">
                                <input
                                  type="number"
                                  value={draft[i].qty}
                                  onChange={(e) => setDraft(draft.map((d, j) => (j === i ? { ...d, qty: Number(e.target.value) } : d)))}
                                  className="w-16 rounded-md border border-line px-1.5 py-0.5 text-ink"
                                />
                                {l.unit} × {money(l.unitPrice)}
                                <select
                                  value={draft[i].action}
                                  onChange={(e) => setDraft(draft.map((d, j) => (j === i ? { ...d, action: e.target.value as "add" | "remove" } : d)))}
                                  className="ml-1 rounded-md border border-line px-1 py-0.5 text-ink"
                                >
                                  <option value="add">add</option>
                                  <option value="remove">credit</option>
                                </select>
                              </span>
                            ) : (
                              <>
                                <span className={clsx(!l.qty && "text-warn font-semibold")}>{l.qty || "?"}</span> {l.unit} × {money(l.unitPrice)} · <span className="font-mono">{l.sku}</span>
                                {l.note && <span> · {l.note}</span>}
                              </>
                            )}
                          </div>
                        </div>
                        <div className={clsx("tabular-nums font-medium", l.sign < 0 && "text-good")}>{money(l.total)}</div>
                        {editing && (
                          <button onClick={() => setDraft(draft.filter((_, j) => j !== i))} className="text-muted hover:text-bad cursor-pointer">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                    {editing && <AddLine project={project} onAdd={(sku) => setDraft([...draft, { id: Math.random().toString(36).slice(2), sku, qty: 1, action: "add" }])} />}
                  </div>
                  <div className="py-2 text-[12.5px] space-y-0.5">
                    <Row label={role === "contractor" ? "Rate-sheet cost" : "Subtotal"} value={money(quote.subtotal)} />
                    {quote.markup > 0 && <Row label={`Overhead & profit (${quote.markupPct}%)`} value={money(quote.markup)} />}
                    <Row label={role === "contractor" ? "Client price" : "Change total"} value={money(quote.total, { sign: true })} bold />
                    {role === "contractor" && <Row label={marginPct ? `Your margin · ${marginPct}%` : "Your margin"} value={money(quote.markup, { sign: true })} />}
                    {role === "contractor" && materials > 0 && <Row label="Materials to buy" value={money(materials)} />}
                  </div>
                  {co.assumptions.length > 0 && (
                    <div className="pb-2 text-[12px] text-muted">
                      <span className="font-semibold text-ink/70">Assumptions: </span>
                      {co.assumptions.join(" ")}
                    </div>
                  )}
                  {sources.length > 0 && !compact && (
                    <div className="pb-2 space-y-1">
                      {sources.slice(0, 2).map((m) => (
                        <div key={m.id} className="text-[12px] text-muted flex gap-1.5 items-start">
                          <Quote className="h-3 w-3 mt-0.5 shrink-0" />
                          <span className="line-clamp-2 italic">{m.body}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {editing ? (
                    <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note to client (optional)" className="w-full mb-2 rounded-lg border border-line p-2 text-[13px]" rows={2} />
                  ) : (
                    co.contractorNote && (
                      <div className="mb-2 rounded-lg bg-black/[0.03] p-2 text-[12.5px]">
                        <span className="font-semibold">Note from {project.contractor.name.split(" ")[0]}: </span>
                        {co.contractorNote}
                      </div>
                    )
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* actions */}
          <div className="px-4 pb-3.5 pt-1">
            {role === "contractor" && ["needs_info", "contractor_review"].includes(co.status) && (
              <div className="flex flex-wrap gap-2">
                {editing ? (
                  <>
                    <Button size="sm" variant="dark" onClick={saveEdits} disabled={busy}>
                      <Check className="h-3.5 w-3.5" /> Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setDraft(co.lines); }}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="primary" disabled={busy || missingQty || !co.lines.length} onClick={() => run(() => act({ type: "sendChange", coId: co.id }))}>
                      <Send className="h-3.5 w-3.5" /> Send to {project.client.name.split(" ")[0]}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setDraft(co.lines); setEditing(true); setShowDetails(true); }}>
                      <Pencil className="h-3.5 w-3.5" /> Adjust
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => run(() => act({ type: "voidChange", coId: co.id }))}>
                      <X className="h-3.5 w-3.5" /> Not a change
                    </Button>
                  </>
                )}
              </div>
            )}
            {role === "contractor" && co.status === "client_review" && (
              <div className="text-[12.5px] text-muted flex items-center gap-2">
                <span className="dot-pulse flex gap-1"><span /><span /><span /></span> Waiting for {project.client.name} to approve
              </div>
            )}
            {role === "client" && co.status === "client_review" && (
              <AnimatePresence mode="wait">
                {signing ? (
                  <motion.div key="sign" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-good/30 bg-good/5 p-3">
                    <div className="text-[12px] text-muted mb-1.5">
                      Type your name to approve <b className="text-ink">{money(quote.total, { sign: true })}</b> and authorize this work.
                    </div>
                    <div className="flex gap-2">
                      <input value={sigName} onChange={(e) => setSigName(e.target.value)} className="flex-1 rounded-lg border border-line bg-white px-3 font-sign text-[22px]" />
                      <Button variant="good" size="md" disabled={busy || sigName.trim().length < 2} onClick={approve}>
                        <PenLine className="h-4 w-4" /> Sign & approve
                      </Button>
                    </div>
                  </motion.div>
                ) : declining ? (
                  <motion.div key="dec" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2">
                    <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" className="flex-1 rounded-lg border border-line px-3 text-sm" />
                    <Button size="sm" variant="danger" onClick={() => run(() => act({ type: "declineChange", coId: co.id, reason }))}>Decline</Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeclining(false)}>Cancel</Button>
                  </motion.div>
                ) : (
                  <motion.div key="btns" className="flex gap-2">
                    <Button variant="good" size="sm" onClick={() => setSigning(true)}>
                      <Check className="h-3.5 w-3.5" /> Approve
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setDeclining(true)}>
                      Decline
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            )}
            {co.status === "approved" && co.approval && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-[12px] text-muted flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-good" /> Signed by <span className="font-sign text-ink text-[19px]">{co.approval.name}</span> · {new Date(co.approval.at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </div>
                  <motion.div initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 14 }} className="stamp rounded-md px-2 py-0.5 text-[11px] font-bold">
                    APPROVED
                  </motion.div>
                </div>
                {role === "contractor" && materials > 0 && (
                  purchase ? (
                    <ProjectCardFace last4={purchase.last4} amount={purchase.amount} memo={purchase.memo} source={purchase.source} />
                  ) : (
                    <div className="rounded-xl border border-dashed border-line p-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[12.5px]">
                        <div className="font-medium">Materials on this change</div>
                        <div className="text-muted">{money(materials)} at cost, ready for a project card.</div>
                      </div>
                      <Button size="sm" variant="dark" disabled={busy} onClick={() => run(async () => { setCardError(null); try { await act({ type: "issueMaterialCard", coId: co.id }); } catch (e) { setCardError((e as Error).message); } })}>
                        <CreditCard className="h-3.5 w-3.5" /> {ramp ? "Issue Ramp card" : "Purchase materials"}
                      </Button>
                      {cardError && <div className="w-full text-[12px] text-bad">{cardError}</div>}
                    </div>
                  )
                )}
              </div>
            )}
            {co.status === "declined" && <div className="text-[12.5px] text-bad">Declined{co.declineReason ? `: “${co.declineReason}”` : ""}</div>}
          </div>
        </>
      )}
    </motion.div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={clsx("flex justify-between", bold ? "font-semibold text-ink text-[13.5px] pt-1" : "text-muted")}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function AddLine({ project, onAdd }: { project: Project; onAdd: (sku: string) => void }) {
  const [q, setQ] = useState("");
  const matches = q ? project.priceSheet.filter((i) => (i.name + i.sku).toLowerCase().includes(q.toLowerCase())).slice(0, 5) : [];
  return (
    <div className="py-2 relative">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="+ Add item from rate sheet…" className="w-full rounded-lg border border-dashed border-line px-2.5 py-1.5 text-[13px]" />
      {matches.length > 0 && (
        <div className="absolute z-20 left-0 right-0 mt-1 rounded-xl border border-line bg-white shadow-xl overflow-hidden">
          {matches.map((m) => (
            <button key={m.sku} onClick={() => { onAdd(m.sku); setQ(""); }} className="w-full text-left px-3 py-2 text-[13px] hover:bg-black/5 flex justify-between cursor-pointer">
              <span>{m.name}</span>
              <span className="text-muted tabular-nums">{money(m.unitPrice)}/{m.unit}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";
import clsx from "clsx";
import { motion } from "framer-motion";
import { useState } from "react";
import { FileSignature, Lock, PenLine, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import type { Project, Role, LineItem } from "@/lib/types";
import { baselineTotal, money, priceLine } from "@/lib/pricing";
import { AnimatedMoney, Button, Card } from "./ui";
import type { Act } from "./useProject";

export function AgreementView({ project, role, act }: { project: Project; role: Role; act: Act }) {
  const a = project.agreement;
  const [name, setName] = useState(role === "contractor" ? project.contractor.name : project.client.name);

  if (a.status === "none") {
    return (
      <div className="max-w-2xl mx-auto py-14 text-center">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-agent to-agent-2 grid place-items-center text-white shadow-[0_16px_40px_-12px_rgba(107,92,255,0.7)]">
          <FileSignature className="h-8 w-8" />
        </motion.div>
        <h2 className="mt-5 text-2xl font-semibold tracking-tight">Draft the agreement</h2>
        <p className="mt-2 text-muted text-[15px]">
          The contract agent reads your project description and {project.priceSheet.length}-item rate sheet, then drafts scope, a priced baseline, a payment schedule and the change-order rules both sides agree to.
        </p>
        <Card className="mt-6 p-4 text-left text-[13.5px] text-ink/80 leading-relaxed">{project.description}</Card>
        <Button variant="agent" size="lg" className="mt-6" onClick={() => act({ type: "draftAgreement" })} disabled={role !== "contractor"}>
          <Sparkles className="h-4 w-4" /> Draft with AI
        </Button>
        {role !== "contractor" && <div className="text-[12px] text-muted mt-2">Your contractor will send the draft for review.</div>}
      </div>
    );
  }

  if (a.status === "drafting") {
    return (
      <div className="max-w-3xl mx-auto py-10">
        <div className="flex items-center gap-2 mb-5 text-sm">
          <span className="dot-pulse flex gap-1"><span /><span /><span /></span>
          <span className="shimmer-text font-semibold">{project.agentStatusText ?? "Drafting…"}</span>
        </div>
        <Card className="p-8 space-y-5">
          {[0.5, 1, 0.9, 0.95, 0.6, 1, 0.8].map((w, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 rounded shimmer" style={{ width: `${w * 40}%` }} />
              <div className="h-3 rounded shimmer" style={{ width: `${w * 100}%` }} />
              <div className="h-3 rounded shimmer" style={{ width: `${w * 85}%` }} />
            </div>
          ))}
        </Card>
      </div>
    );
  }

  const signed = a.status === "signed";
  const total = baselineTotal(project);
  const editable = !signed && role === "contractor";

  const updateBaseline = (baseline: LineItem[]) => act({ type: "updateAgreement", baseline });

  return (
    <div className="max-w-6xl mx-auto py-6 grid lg:grid-cols-[1fr_320px] gap-6">
      <Card className="p-8 md:p-10 relative overflow-hidden">
        {signed && (
          <div className="absolute top-6 right-6 stamp rounded-md px-3 py-1 text-xs font-bold flex items-center gap-1">
            <Lock className="h-3 w-3" /> SIGNED · BASELINE LOCKED
          </div>
        )}
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted font-semibold flex items-center gap-1.5">
          {a.draftedBy === "ai" ? <><Sparkles className="h-3 w-3 text-agent" /> Drafted by SnapContract agent</> : "Drafted from template"}
        </div>
        <h1 className="mt-2 text-[26px] font-semibold tracking-tight pr-40">{a.title}</h1>
        <p className="mt-2 text-muted">{a.summary}</p>
        <div className="mt-5 grid sm:grid-cols-3 gap-3 text-[13px]">
          <Meta k="Contractor" v={`${project.contractor.name}${project.contractor.company ? `, ${project.contractor.company}` : ""}`} />
          <Meta k="Client" v={project.client.name} />
          <Meta k="Site" v={project.address} />
        </div>

        <div className="mt-8 space-y-6">
          {a.sections.map((s, i) => (
            <section key={`${a.title}-${i}-${s.body.length}`}>
              <h3 className="font-semibold text-[15px] mb-1.5">
                {i + 1}. {s.title}
              </h3>
              {editable ? (
                <textarea
                  defaultValue={s.body}
                  onBlur={(e) => {
                    if (e.target.value === s.body) return;
                    const sections = a.sections.map((x, j) => (j === i ? { ...x, body: e.target.value } : x));
                    act({ type: "updateAgreement", sections });
                  }}
                  rows={Math.max(2, Math.ceil(s.body.length / 95))}
                  className="w-full rounded-lg border border-transparent hover:border-line focus:border-agent/40 p-2 -m-2 text-[14px] leading-relaxed text-ink/85 resize-none outline-none"
                />
              ) : (
                <p className="text-[14px] leading-relaxed text-ink/85">{s.body}</p>
              )}
            </section>
          ))}
        </div>

        <h3 className="mt-10 font-semibold text-[15px] mb-2">Priced baseline</h3>
        <div className="rounded-xl border border-line overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-bg/70 text-muted text-[11.5px] uppercase tracking-wider">
              <tr>
                <th className="text-left font-semibold px-3 py-2">Item</th>
                <th className="text-right font-semibold px-3 py-2">Qty</th>
                <th className="text-right font-semibold px-3 py-2">Rate</th>
                <th className="text-right font-semibold px-3 py-2">Amount</th>
                {editable && <th />}
              </tr>
            </thead>
            <tbody className="divide-y divide-line/70">
              {a.baseline.map((l, i) => {
                const pl = priceLine(project.priceSheet, l);
                return (
                  <tr key={l.id} className="hover:bg-bg/40">
                    <td className="px-3 py-1.5">
                      {pl.name} <span className="font-mono text-[11px] text-muted">{pl.sku}</span>
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {editable ? (
                        <input
                          type="number"
                          defaultValue={l.qty}
                          onBlur={(e) => Number(e.target.value) !== l.qty && updateBaseline(a.baseline.map((x, j) => (j === i ? { ...x, qty: Number(e.target.value) } : x)))}
                          className="w-20 text-right rounded border border-line px-1"
                        />
                      ) : (
                        l.qty
                      )}{" "}
                      <span className="text-muted">{pl.unit}</span>
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-muted">{money(pl.unitPrice)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-medium">{money(pl.total)}</td>
                    {editable && (
                      <td className="pr-2">
                        <button onClick={() => updateBaseline(a.baseline.filter((_, j) => j !== i))} className="text-muted hover:text-bad cursor-pointer">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-ink text-white">
                <td className="px-3 py-2.5 font-semibold" colSpan={3}>
                  Contract price
                </td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                  <AnimatedMoney value={total} />
                </td>
                {editable && <td />}
              </tr>
            </tfoot>
          </table>
        </div>

        <h3 className="mt-8 font-semibold text-[15px] mb-2">Payment schedule</h3>
        <div className="grid sm:grid-cols-4 gap-2">
          {a.payments.map((p) => (
            <div key={p.label} className="rounded-xl border border-line p-3">
              <div className="text-[12px] text-muted">{p.trigger}</div>
              <div className="font-semibold text-[14px]">{p.label}</div>
              <div className="mt-1 tabular-nums text-[13px]">
                {p.pct}% · {money((total * p.pct) / 100, { cents: false })}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* signing rail */}
      <div className="space-y-4 lg:sticky lg:top-24 self-start">
        <Card className="p-5">
          <div className="text-[11.5px] uppercase tracking-wider text-muted font-semibold mb-3">Key terms</div>
          <div className="space-y-2 text-[13px]">
            <Term k="Contract price" v={money(total)} />
            <Term k="Timeline" v={`${a.timelineWeeks} weeks`} />
            <Term k="Change-order markup" v={`${a.changeMarkupPct}% O&P`} />
            <Term k="Credits" v="At cost" />
            <Term k="Rate sheet" v={`${project.priceSheet.length} items`} />
          </div>
          {editable && (
            <div className="mt-4 flex items-center gap-2 text-[12.5px]">
              <span className="text-muted">Markup</span>
              <input type="number" defaultValue={a.changeMarkupPct} onBlur={(e) => act({ type: "updateAgreement", changeMarkupPct: Number(e.target.value) })} className="w-16 rounded border border-line px-1.5 py-0.5" />%
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => act({ type: "draftAgreement" })}>
                <RefreshCw className="h-3.5 w-3.5" /> Redraft
              </Button>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="text-[11.5px] uppercase tracking-wider text-muted font-semibold mb-3">Signatures</div>
          {(["contractor", "client"] as Role[]).map((r) => {
            const sig = a.signatures[r];
            const party = r === "contractor" ? project.contractor : project.client;
            return (
              <div key={r} className={clsx("rounded-xl border p-3 mb-2", sig ? "border-good/40 bg-good/5" : "border-dashed border-line")}>
                <div className="text-[11px] text-muted capitalize">{r}</div>
                {sig ? (
                  <>
                    <div className="font-[cursive] italic text-xl">{sig.name}</div>
                    <div className="text-[11px] text-muted">{new Date(sig.at).toLocaleString()}</div>
                  </>
                ) : (
                  <div className="text-[13px] text-muted py-1">Awaiting {party.name}</div>
                )}
              </div>
            );
          })}
          {!signed && !a.signatures[role] && (
            <div className="mt-3">
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-line px-3 py-2 font-[cursive] italic text-lg" />
              <Button variant="good" className="w-full mt-2" onClick={() => act({ type: "signAgreement", role, name })} disabled={name.trim().length < 2}>
                <PenLine className="h-4 w-4" /> Sign as {role}
              </Button>
              <div className="text-[11px] text-muted mt-1.5 text-center">Editing the draft clears existing signatures.</div>
            </div>
          )}
          {!signed && a.signatures[role] && <div className="text-[12.5px] text-muted text-center mt-2">Switch to the other party to countersign.</div>}
        </Card>
      </div>
    </div>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl bg-bg/60 px-3 py-2">
      <div className="text-[11px] text-muted">{k}</div>
      <div className="font-medium">{v}</div>
    </div>
  );
}
function Term({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{k}</span>
      <span className="font-medium tabular-nums">{v}</span>
    </div>
  );
}

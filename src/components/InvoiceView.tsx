"use client";
import clsx from "clsx";
import { motion } from "framer-motion";
import { useState } from "react";
import { History, Printer, ShieldCheck } from "lucide-react";
import type { Project } from "@/lib/types";
import { baselineTotal, budget, money, priceLine, quoteChange } from "@/lib/pricing";
import { AnimatedMoney, Button, Card, Logo } from "./ui";

export function InvoiceView({ project }: { project: Project }) {
  const b = budget(project);
  const approved = project.changeOrders.filter((c) => c.status === "approved");
  const pending = project.changeOrders.filter((c) => ["contractor_review", "client_review", "needs_info"].includes(c.status));
  const [showBaseline, setShowBaseline] = useState(false);
  const latest = project.invoices.at(-1);

  if (!latest) {
    return <div className="max-w-xl mx-auto py-20 text-center text-muted">The invoice draft appears once the agreement is signed.</div>;
  }

  return (
    <div className="max-w-6xl mx-auto py-6 grid lg:grid-cols-[1fr_300px] gap-6">
      <Card className="print-area p-8 md:p-10">
        <div className="flex items-start justify-between">
          <div>
            <Logo />
            <div className="mt-4 text-[13px] text-muted">
              <div className="font-semibold text-ink">{project.contractor.company ?? project.contractor.name}</div>
              <div>{project.contractor.name}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-[0.2em] text-muted font-semibold">Invoice draft</div>
            <div className="text-2xl font-semibold mt-1">v{latest.version}</div>
            <div className="text-[12px] text-muted">{new Date(latest.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}</div>
          </div>
        </div>

        <div className="mt-6 grid sm:grid-cols-2 gap-4 text-[13px]">
          <div className="rounded-xl bg-bg/60 p-3">
            <div className="text-[11px] text-muted">Bill to</div>
            <div className="font-medium">{project.client.name}</div>
            <div className="text-muted">{project.address}</div>
          </div>
          <div className="rounded-xl bg-bg/60 p-3">
            <div className="text-[11px] text-muted">Project</div>
            <div className="font-medium">{project.name}</div>
            <div className="text-muted">{approved.length} approved change order{approved.length === 1 ? "" : "s"}</div>
          </div>
        </div>

        <table className="w-full mt-8 text-[13.5px]">
          <thead className="text-[11px] uppercase tracking-wider text-muted border-b border-line">
            <tr>
              <th className="text-left font-semibold py-2">Description</th>
              <th className="text-right font-semibold py-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-line/60">
              <td className="py-3">
                <div className="font-medium">Original contract: {project.agreement.title}</div>
                <button onClick={() => setShowBaseline((s) => !s)} className="no-print text-[12px] text-agent cursor-pointer">
                  {showBaseline ? "Hide" : "Show"} {project.agreement.baseline.length} baseline items
                </button>
                {showBaseline && (
                  <div className="mt-2 space-y-0.5 text-[12px] text-muted">
                    {project.agreement.baseline.map((l) => {
                      const pl = priceLine(project.priceSheet, l);
                      return (
                        <div key={l.id} className="flex justify-between">
                          <span>{pl.name} · {l.qty} {pl.unit}</span>
                          <span className="tabular-nums">{money(pl.total)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </td>
              <td className="py-3 text-right tabular-nums align-top font-medium">{money(baselineTotal(project))}</td>
            </tr>
            {approved.map((co) => {
              const q = quoteChange(project, co);
              return (
                <motion.tr key={co.id} initial={{ backgroundColor: "rgba(16,185,129,0.15)" }} animate={{ backgroundColor: "rgba(16,185,129,0)" }} transition={{ duration: 2 }} className="border-b border-line/60">
                  <td className="py-3">
                    <div className="font-medium">
                      CO-{co.number}: {co.title}
                    </div>
                    <div className="text-[12px] text-muted">
                      {q.lines.map((l) => `${l.sign < 0 ? "Credit: " : ""}${l.name} × ${l.qty}`).join(" · ")}
                      {q.markup > 0 && ` · O&P ${q.markupPct}%`}
                    </div>
                    {co.approval && (
                      <div className="text-[11.5px] text-good mt-0.5 flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3" /> Approved by {co.approval.name}, {new Date(co.approval.at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                      </div>
                    )}
                  </td>
                  <td className={clsx("py-3 text-right tabular-nums align-top font-medium", q.total < 0 && "text-good")}>{money(q.total, { sign: true })}</td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-6 ml-auto max-w-xs space-y-1.5 text-[13.5px]">
          <div className="flex justify-between text-muted"><span>Original contract</span><span className="tabular-nums">{money(b.baseline)}</span></div>
          <div className="flex justify-between text-muted"><span>Approved changes</span><span className="tabular-nums">{money(b.approved, { sign: true })}</span></div>
          <div className="flex justify-between text-lg font-semibold border-t border-line pt-2"><span>Contract total</span><AnimatedMoney value={b.current} /></div>
        </div>

        <h3 className="mt-10 font-semibold text-[14px] mb-2">Payment milestones (recalculated)</h3>
        <div className="rounded-xl border border-line divide-y divide-line/70 text-[13px]">
          {project.agreement.payments.map((p) => (
            <div key={p.label} className="flex items-center justify-between px-3 py-2">
              <span>
                {p.label} <span className="text-muted">· {p.trigger}</span>
              </span>
              <span className="tabular-nums font-medium">
                {p.pct}% · <AnimatedMoney value={(b.current * p.pct) / 100} />
              </span>
            </div>
          ))}
        </div>

        {pending.length > 0 && (
          <div className="no-print mt-6 rounded-xl border border-dashed border-accent/40 bg-accent/5 p-3 text-[12.5px]">
            <b>{pending.length} pending change{pending.length > 1 ? "s" : ""}</b> ({money(b.pending, { sign: true })}) are not on this invoice until the client approves.
          </div>
        )}
      </Card>

      <div className="space-y-4 no-print lg:sticky lg:top-24 self-start">
        <Button variant="dark" className="w-full" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print / Save PDF
        </Button>
        <Card className="p-4">
          <div className="text-[11.5px] uppercase tracking-wider text-muted font-semibold flex items-center gap-1.5 mb-3">
            <History className="h-3.5 w-3.5" /> Version history
          </div>
          <ol className="relative border-l border-line ml-1.5 space-y-4">
            {[...project.invoices].reverse().map((v, i, arr) => {
              const prev = arr[i + 1];
              const delta = prev ? v.total - prev.total : 0;
              return (
                <li key={v.version} className="ml-4">
                  <span className={clsx("absolute -left-[5px] h-2.5 w-2.5 rounded-full", i === 0 ? "bg-accent ring-4 ring-accent/20" : "bg-black/20")} />
                  <div className="flex justify-between text-[13px]">
                    <span className="font-semibold">v{v.version}</span>
                    <span className="tabular-nums">{money(v.total)}</span>
                  </div>
                  <div className="text-[12px] text-muted flex justify-between">
                    <span>{v.reason}</span>
                    {prev && <span className={clsx("tabular-nums", delta > 0 ? "text-accent" : "text-good")}>{money(delta, { sign: true })}</span>}
                  </div>
                  <div className="text-[11px] text-muted">{new Date(v.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</div>
                </li>
              );
            })}
          </ol>
        </Card>
      </div>
    </div>
  );
}

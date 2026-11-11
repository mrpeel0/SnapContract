"use client";
import clsx from "clsx";
import { Fragment, useState } from "react";
import { Check, ClipboardCopy, Download, History, Printer, ShieldCheck } from "lucide-react";
import type { Project, Role } from "@/lib/types";
import { baselineTotal, budget, money, paymentImpact, priceLine, quoteChange } from "@/lib/pricing";
import { accountingCsv, accountingJson, downloadText, quickbooksText } from "@/lib/export";
import { AccountingNote, CashFlowTimeline, ProfitabilityPanel, PurchasesPanel } from "./Finance";
import { AnimatedMoney, Button, Card, Logo } from "./ui";
import type { Act } from "./useProject";

export function InvoiceView({ project, role, act, ramp }: { project: Project; role: Role; act: Act; ramp?: boolean }) {
  const b = budget(project);
  const pending = project.changeOrders.filter((c) => ["contractor_review", "client_review", "needs_info"].includes(c.status));
  const [picked, setPicked] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);
  const latest = project.invoices.at(-1);
  const viewing = (picked == null ? latest : project.invoices.find((v) => v.version === picked)) ?? latest;

  if (!viewing) {
    return <div className="max-w-xl mx-auto py-20 text-center text-muted">The invoice draft appears once the agreement is signed.</div>;
  }

  const prev = project.invoices.find((v) => v.version === viewing.version - 1);
  const included = new Set(viewing.changeOrderIds);
  const approved = project.changeOrders.filter((c) => c.status === "approved" && included.has(c.id));
  const isLatest = viewing.version === latest?.version;
  const contract = isLatest ? b.current : viewing.total;
  const prior = prev?.total ?? contract;
  const flow = paymentImpact(project.agreement.payments, contract, prior, project.agreement.status === "signed", project.invoices[0]?.total);
  const headline =
    prev && flow.next && flow.next.delta !== 0
      ? `${viewing.reason} adds ${money(flow.next.delta, { sign: true })} to the next draw (${flow.next.label})`
      : undefined;

  const copyBooks = async () => {
    const text = quickbooksText(project, { ...viewing, total: contract });
    const fallback = () => {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    };
    try {
      await Promise.race([
        navigator.clipboard.writeText(text),
        new Promise((_, reject) => setTimeout(() => reject(new Error("clipboard timeout")), 400)),
      ]);
    } catch {
      fallback();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  const sendAccounting = () => {
    downloadText(`${project.id}-invoice-v${viewing.version}.json`, accountingJson(project, { ...viewing, total: contract }), "application/json");
    setSent(true);
  };
  const downloadCsv = () => {
    downloadText(`${project.id}-invoice-v${viewing.version}.csv`, accountingCsv(project, viewing), "text/csv");
    setSent(true);
  };

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
            <div className="text-2xl font-semibold mt-1">v{viewing.version}</div>
            <div className="text-[12px] text-muted">{new Date(viewing.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}</div>
            {!isLatest && <div className="text-[11px] text-accent font-semibold mt-1">Earlier version · current is v{latest?.version}</div>}
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
            <div className="text-muted">{approved.length} approved change order{approved.length === 1 ? "" : "s"} on this version</div>
          </div>
        </div>

        <table className="w-full mt-8 text-[13px]">
          <thead className="text-[11px] uppercase tracking-wider text-muted border-b border-line">
            <tr>
              <th className="text-left font-semibold py-2">Description</th>
              <th className="text-right font-semibold py-2 hidden sm:table-cell">Qty</th>
              <th className="text-right font-semibold py-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-black/[0.02]">
              <td className="py-2.5 font-semibold" colSpan={2}>Original contract · {project.agreement.title || project.name}</td>
              <td className="py-2.5 text-right tabular-nums font-semibold">{money(baselineTotal(project))}</td>
            </tr>
            {project.agreement.baseline.map((l) => {
              const pl = priceLine(project.priceSheet, l);
              return (
                <tr key={l.id} className="border-b border-line/50 text-muted">
                  <td className="py-1.5 pl-3">{pl.name}</td>
                  <td className="py-1.5 text-right tabular-nums hidden sm:table-cell">{l.qty} {pl.unit}</td>
                  <td className="py-1.5 text-right tabular-nums">{money(pl.total)}</td>
                </tr>
              );
            })}
            {approved.map((co) => {
              const q = quoteChange(project, co);
              return (
                <Fragment key={co.id}>
                  <tr className="bg-good/[0.06]">
                    <td className="py-2.5 font-semibold" colSpan={2}>
                      CO-{co.number}: {co.title}
                    </td>
                    <td className={clsx("py-2.5 text-right tabular-nums font-semibold", q.total < 0 && "text-good")}>{money(q.total, { sign: true })}</td>
                  </tr>
                  {q.lines.map((l) => (
                    <tr key={l.id} className="border-b border-line/50">
                      <td className="py-1.5 pl-3">{l.sign < 0 ? "Credit: " : ""}{l.name}</td>
                      <td className="py-1.5 text-right tabular-nums text-muted hidden sm:table-cell">{l.qty} {l.unit}</td>
                      <td className={clsx("py-1.5 text-right tabular-nums", l.total < 0 && "text-good")}>{money(l.total, { sign: true })}</td>
                    </tr>
                  ))}
                  {q.markup !== 0 && (
                    <tr className="border-b border-line/50 text-muted">
                      <td className="py-1.5 pl-3" colSpan={2}>Overhead & profit {q.markupPct}%</td>
                      <td className="py-1.5 text-right tabular-nums">{money(q.markup, { sign: true })}</td>
                    </tr>
                  )}
                  {co.approval && (
                    <tr>
                      <td colSpan={3} className="py-2 pl-3">
                        <div className="inline-flex items-center gap-3 rounded-lg border border-good/30 bg-good/5 px-3 py-1.5">
                          <ShieldCheck className="h-4 w-4 text-good" />
                          <div>
                            <div className="font-[cursive] italic text-[16px] leading-none text-ink">{co.approval.name}</div>
                            <div className="text-[11px] text-muted mt-0.5">Approved {new Date(co.approval.at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} · {money(co.approval.total, { sign: true })}</div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {approved.length === 0 && (
              <tr>
                <td colSpan={3} className="py-3 text-[12.5px] text-muted">No approved change orders on this version.</td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="mt-6 ml-auto max-w-xs space-y-1.5 text-[13.5px]">
          <div className="flex justify-between text-muted"><span>Original contract</span><span className="tabular-nums">{money(b.baseline)}</span></div>
          <div className="flex justify-between text-muted"><span>Approved changes on this invoice</span><span className="tabular-nums">{money(roundDelta(contract, b.baseline), { sign: true })}</span></div>
          <div className="flex justify-between text-lg font-semibold border-t border-line pt-2"><span>Contract total</span>{isLatest ? <AnimatedMoney value={contract} /> : <span className="tabular-nums">{money(contract)}</span>}</div>
        </div>

        <h3 className="mt-10 font-semibold text-[14px] mb-3">Payment schedule</h3>
        <CashFlowTimeline payments={project.agreement.payments} contract={contract} prior={prior} depositCollected={project.agreement.status === "signed"} collectedContract={project.invoices[0]?.total} headline={headline} />

        {isLatest && pending.length > 0 && (
          <div className="no-print mt-6 rounded-xl border border-dashed border-accent/40 bg-accent/5 p-3 text-[12.5px]">
            <div className="font-semibold">{pending.length} open change{pending.length > 1 ? "s" : ""} · {money(b.pending, { sign: true })} not on this invoice</div>
            <div className="text-muted mt-0.5">
              Original {money(b.baseline)} · contracted now {money(b.current)} · {money(b.projected)} if every open change is approved.
            </div>
          </div>
        )}
      </Card>

      <div className="space-y-4 no-print lg:sticky lg:top-6 self-start">
        <Button variant="dark" className="w-full" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Download PDF
        </Button>
        <Button variant="outline" className="w-full" onClick={copyBooks}>
          {copied ? <Check className="h-4 w-4 text-good" /> : <ClipboardCopy className="h-4 w-4" />} {copied ? "Copied" : "Copy for QuickBooks"}
        </Button>
        <Button variant="outline" className="w-full" onClick={sendAccounting}>
          <Download className="h-4 w-4" /> {sent ? "Sent to accounting" : "Send to accounting"}
        </Button>
        <button onClick={downloadCsv} className="w-full text-[12px] text-muted hover:text-ink cursor-pointer">Download CSV instead</button>
        <AccountingNote sent={sent} />

        {role === "contractor" && <ProfitabilityPanel project={project} />}
        {role === "contractor" && <PurchasesPanel project={project} act={act} ramp={ramp} />}

        <Card className="p-4">
          <div className="text-[11.5px] uppercase tracking-wider text-muted font-semibold flex items-center gap-1.5 mb-3">
            <History className="h-3.5 w-3.5" /> Version history
          </div>
          <ol className="relative border-l border-line ml-1.5 space-y-4">
            {[...project.invoices].reverse().map((v, i, arr) => {
              const older = arr[i + 1];
              const delta = older ? v.total - older.total : 0;
              const active = v.version === viewing.version;
              return (
                <li key={v.version} className="ml-4">
                  <span className={clsx("absolute -left-[5px] h-2.5 w-2.5 rounded-full", active ? "bg-accent ring-4 ring-accent/20" : "bg-black/20")} />
                  <button onClick={() => setPicked(v.version)} className="w-full text-left cursor-pointer">
                    <div className="flex justify-between text-[13px]">
                      <span className="font-semibold">v{v.version}</span>
                      <span className="tabular-nums">{money(v.total)}</span>
                    </div>
                    <div className="text-[12px] text-muted flex justify-between gap-2">
                      <span>{v.reason}</span>
                      {older && <span className={clsx("tabular-nums", delta > 0 ? "text-accent" : "text-good")}>{money(delta, { sign: true })}</span>}
                    </div>
                    <div className="text-[11px] text-muted">{new Date(v.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} · {v.changeOrderIds.length} CO{v.changeOrderIds.length === 1 ? "" : "s"}</div>
                  </button>
                </li>
              );
            })}
          </ol>
        </Card>
      </div>
    </div>
  );
}

function roundDelta(contract: number, baseline: number) {
  return Math.round((contract - baseline) * 100) / 100;
}

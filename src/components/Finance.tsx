"use client";
import clsx from "clsx";
import { CreditCard, Landmark, Scale } from "lucide-react";
import type { PaymentMilestone, Project } from "@/lib/types";
import { materialsSpend, money, paymentImpact, profitability } from "@/lib/pricing";
import type { Act } from "./useProject";
import { Button, Card } from "./ui";

export function CashFlowTimeline({
  payments,
  contract,
  prior,
  depositCollected,
  collectedContract,
  headline,
}: {
  payments: PaymentMilestone[];
  contract: number;
  prior: number;
  depositCollected: boolean;
  collectedContract?: number;
  headline?: string;
}) {
  const flow = paymentImpact(payments, contract, prior, depositCollected, collectedContract);
  if (!flow.milestones.length) return null;
  return (
    <div>
      {headline && (
        <div className="mb-3 rounded-xl bg-accent/10 border border-accent/25 px-3 py-2.5 text-[13px]">
          <div className="font-semibold text-ink">{headline}</div>
          <div className="text-[12px] text-muted mt-0.5">Each later draw moves with the new contract total. The deposit already collected stays put.</div>
        </div>
      )}
      <ol className="relative ml-1.5 space-y-0">
        {flow.milestones.map((m, i) => (
          <li key={m.label} className="relative pl-5 pb-3 last:pb-0">
            {i < flow.milestones.length - 1 && <span className="absolute left-[3px] top-2 bottom-0 w-px bg-line" />}
            <span className={clsx("absolute left-0 top-1.5 h-2 w-2 rounded-full ring-4", m.state === "collected" ? "bg-good ring-good/15" : m.state === "next" ? "bg-accent ring-accent/20" : "bg-black/20 ring-transparent")} />
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="font-medium">
                {m.label}
                {m.state === "next" && <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-accent">Next draw</span>}
                {m.state === "collected" && <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-good">Collected</span>}
              </span>
              <span className="tabular-nums font-semibold">{money(m.amount)}</span>
            </div>
            <div className="text-[12px] text-muted flex justify-between gap-3">
              <span>{m.trigger} · {m.pct}%</span>
              {m.delta !== 0 && <span className={clsx("tabular-nums font-medium", m.delta > 0 ? "text-accent" : "text-good")}>{money(m.delta, { sign: true })}</span>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function ProfitabilityPanel({ project }: { project: Project }) {
  const p = profitability(project);
  const rows = [...p.approved, ...p.pending];
  return (
    <Card className="p-4">
      <div className="text-[11.5px] uppercase tracking-wider text-muted font-semibold flex items-center gap-1.5 mb-3">
        <Scale className="h-3.5 w-3.5" /> Margin
      </div>
      {rows.length === 0 ? (
        <div className="text-[13px] text-muted">Margin shows up on each change order: rate-sheet cost versus the client price with overhead and profit.</div>
      ) : (
        <div className="space-y-2.5">
          {rows.map((r) => (
            <div key={r.id} className={clsx("text-[12.5px]", r.status !== "approved" && "opacity-70")}>
              <div className="flex justify-between gap-2 font-medium">
                <span className="truncate">CO-{r.number} · {r.title}</span>
                <span className="tabular-nums text-good shrink-0">{money(r.margin, { sign: true })}</span>
              </div>
              <div className="text-[11.5px] text-muted flex justify-between">
                <span>Cost {money(r.cost)} → client {money(r.price)}</span>
                <span>{r.marginPct == null ? "—" : `${r.marginPct}%`}{r.status !== "approved" ? " · open" : ""}</span>
              </div>
            </div>
          ))}
          <div className="border-t border-line pt-2 flex justify-between text-[13px] font-semibold">
            <span>Approved margin{p.totals.marginPct != null ? ` · ${p.totals.marginPct}%` : ""}</span>
            <span className="tabular-nums text-good">{money(p.totals.margin, { sign: true })}</span>
          </div>
          <div className="text-[11.5px] text-muted">Cost is the rate sheet. Client price adds {project.agreement.changeMarkupPct}% O&P on new work. Credits go back at cost.</div>
        </div>
      )}
    </Card>
  );
}

export function ProjectCardFace({ last4, amount, memo, source }: { last4: string; amount: number; memo: string; source?: "ramp" | "demo" }) {
  return (
    <div className="rounded-2xl bg-[radial-gradient(120%_120%_at_100%_0%,#3b3f4a_0%,#15171c_55%,#0b0c0e_100%)] ring-1 ring-white/5 text-white p-4">
      <div className="flex justify-between text-[10px] uppercase tracking-[0.16em] text-white/55">
        <span>{source === "ramp" ? "Ramp card" : "Demo card"}</span>
        <span>Virtual</span>
      </div>
      <div className="mt-5 font-mono text-[15px] tracking-[0.18em]">•••• •••• •••• {last4}</div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-white/50">Materials</div>
          <div className="font-semibold tabular-nums">{money(amount)}</div>
        </div>
        <div className="text-[11px] text-white/70 text-right max-w-[150px] leading-snug">{memo}</div>
      </div>
    </div>
  );
}

export function PurchasesPanel({ project, act, ramp }: { project: Project; act?: Act; ramp?: boolean }) {
  const purchases = project.purchases ?? [];
  const open = project.changeOrders.filter((c) => c.status === "approved" && materialsSpend(project, c) > 0 && !purchases.some((card) => card.changeOrderId === c.id));
  return (
    <Card className="p-4">
      <div className="text-[11.5px] uppercase tracking-wider text-muted font-semibold flex items-center gap-1.5 mb-3">
        <CreditCard className="h-3.5 w-3.5" /> Materials spend
      </div>
      {purchases.length === 0 && open.length === 0 && <div className="text-[13px] text-muted">When an approved change includes materials or fixtures, issue a project card for that spend.</div>}
      <div className="space-y-3">
        {purchases.map((card) => (
          <div key={card.id} className="space-y-1.5">
            <ProjectCardFace last4={card.last4} amount={card.amount} memo={card.memo} source={card.source} />
            {(card.transactions ?? []).slice(0, 3).map((t) => (
              <div key={t.id} className="flex justify-between text-[12px] text-muted px-1">
                <span className="truncate">{t.merchant}</span>
                <span className="tabular-nums">{money(t.amount)} · {t.state.toLowerCase()}</span>
              </div>
            ))}
          </div>
        ))}
        {ramp && purchases.some((c) => c.source === "ramp") && act && (
          <Button size="sm" variant="outline" className="w-full" onClick={() => act({ type: "syncRamp" })}>Sync Ramp spend</Button>
        )}
        {open.map((co) => (
          <div key={co.id} className="rounded-xl border border-dashed border-line p-3">
            <div className="text-[13px] font-medium">CO-{co.number} materials</div>
            <div className="text-[12px] text-muted mb-2">{money(materialsSpend(project, co))} at rate-sheet cost, before O&P.</div>
            {act && (
              <Button size="sm" variant="dark" onClick={() => act({ type: "issueMaterialCard", coId: co.id })}>
                <CreditCard className="h-3.5 w-3.5" /> {ramp ? "Issue Ramp card" : "Purchase materials"}
              </Button>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

export function AccountingNote({ sent }: { sent: boolean }) {
  return (
    <div className="text-[11.5px] text-muted flex items-start gap-1.5">
      <Landmark className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      {sent ? "Accounting export downloaded. Drop the file into the books — nothing was posted to a live ledger." : "Export is a clean file for the books. No live ledger is connected."}
    </div>
  );
}

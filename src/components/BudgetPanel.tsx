"use client";
import clsx from "clsx";
import { motion } from "framer-motion";
import { CalendarClock, CircleDollarSign, FileCheck2, Hourglass, TrendingUp } from "lucide-react";
import type { Project, Role } from "@/lib/types";
import { budget, money, quoteChange } from "@/lib/pricing";
import { AnimatedMoney, Card, StatusPill, timeAgo } from "./ui";

export function BudgetPanel({ project, role, onOpen }: { project: Project; role: Role; onOpen?: (tab: string) => void }) {
  const b = budget(project);
  const max = Math.max(b.projected, b.current, 1);
  const pct = (n: number) => `${Math.max(0, (n / max) * 100)}%`;
  const live = project.changeOrders.filter((c) => ["needs_info", "contractor_review", "client_review"].includes(c.status));
  const myTurn = live.filter((c) => (role === "contractor" ? c.status !== "client_review" : c.status === "client_review"));
  const weeks = project.agreement.timelineWeeks;
  const nextPayment = project.agreement.payments[1];

  return (
    <div className="space-y-4">
      <Card className="p-5 overflow-hidden relative">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br from-accent/20 to-agent/10 blur-2xl" />
        <div className="text-[11.5px] uppercase tracking-wider text-muted font-semibold flex items-center gap-1.5">
          <CircleDollarSign className="h-3.5 w-3.5" /> Current contract value
        </div>
        <div className="text-[34px] leading-tight font-semibold tracking-tight mt-1">
          <AnimatedMoney value={b.current} />
        </div>
        {b.pending !== 0 && (
          <div className="text-[12.5px] text-muted">
            <AnimatedMoney value={b.projected} className="font-medium text-ink" /> if pending changes are approved
          </div>
        )}

        <div className="mt-4 h-3 w-full rounded-full bg-black/[0.05] overflow-hidden flex">
          <motion.div className="h-full bg-ink" animate={{ width: pct(b.baseline) }} transition={{ type: "spring", stiffness: 80, damping: 18 }} />
          <motion.div className="h-full bg-good" animate={{ width: pct(Math.max(0, b.approved)) }} transition={{ type: "spring", stiffness: 80, damping: 18 }} />
          <motion.div
            className="h-full bg-[repeating-linear-gradient(135deg,var(--accent)_0_6px,var(--accent-2)_6px_12px)] opacity-70"
            animate={{ width: pct(Math.max(0, b.pending)) }}
            transition={{ type: "spring", stiffness: 80, damping: 18 }}
          />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
          <Legend color="bg-ink" label="Original" value={b.baseline} />
          <Legend color="bg-good" label={`Approved (${b.approvedCount})`} value={b.approved} sign />
          <Legend color="bg-accent" label={`Pending (${b.pendingCount})`} value={b.pending} sign />
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3.5">
          <div className="text-[11px] uppercase tracking-wider text-muted font-semibold flex items-center gap-1"><CalendarClock className="h-3 w-3" /> Schedule</div>
          <div className="mt-1 font-semibold text-lg">
            {weeks} wk{b.scheduleDays > 0 && <span className="text-accent text-sm"> +{b.scheduleDays}d</span>}
          </div>
          <div className="text-[11.5px] text-muted">from approved changes</div>
        </Card>
        <Card className="p-3.5">
          <div className="text-[11px] uppercase tracking-wider text-muted font-semibold flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Change vs. original</div>
          <div className={clsx("mt-1 font-semibold text-lg", b.approved > 0 ? "text-accent" : "text-good")}>
            {b.baseline ? `${b.approved >= 0 ? "+" : ""}${((b.approved / b.baseline) * 100).toFixed(1)}%` : "—"}
          </div>
          <div className="text-[11.5px] text-muted">{project.invoices.length ? `Invoice v${project.invoices.length}` : "No invoice yet"}</div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11.5px] uppercase tracking-wider text-muted font-semibold flex items-center gap-1.5">
            <Hourglass className="h-3.5 w-3.5" /> {role === "contractor" ? "Needs your attention" : "Your open requests"}
          </div>
          {myTurn.length > 0 && <span className="h-5 min-w-5 px-1.5 rounded-full bg-accent text-white text-[11px] font-bold grid place-items-center">{myTurn.length}</span>}
        </div>
        {live.length === 0 ? (
          <div className="text-[13px] text-muted py-2">All caught up. Every change is priced and signed.</div>
        ) : (
          <div className="space-y-1.5">
            {live.map((c) => (
              <button key={c.id} onClick={() => onOpen?.("changes")} className="w-full text-left rounded-xl border border-line px-3 py-2 hover:border-ink/20 transition-colors cursor-pointer">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium truncate">CO-{c.number} · {c.title}</span>
                  {!(role === "client" && c.status !== "client_review") && <span className="text-[12.5px] tabular-nums font-medium">{money(quoteChange(project, c).total, { sign: true })}</span>}
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <StatusPill status={c.status} />
                  <span className="text-[11px] text-muted">{timeAgo(c.createdAt)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      {nextPayment && b.current > 0 && (
        <Card className="p-4">
          <div className="text-[11.5px] uppercase tracking-wider text-muted font-semibold flex items-center gap-1.5 mb-2">
            <FileCheck2 className="h-3.5 w-3.5" /> Payment schedule
          </div>
          <div className="space-y-1.5">
            {project.agreement.payments.map((p, i) => (
              <div key={p.label} className="flex items-center gap-2 text-[12.5px]">
                <span className={clsx("h-2 w-2 rounded-full", i === 0 ? "bg-good" : "bg-black/15")} />
                <span className="flex-1">{p.label} <span className="text-muted">· {p.pct}%</span></span>
                <AnimatedMoney value={(b.current * p.pct) / 100} className="font-medium" />
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function Legend({ color, label, value, sign }: { color: string; label: string; value: number; sign?: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-muted">
        <span className={clsx("h-2 w-2 rounded-sm", color)} /> {label}
      </div>
      <AnimatedMoney value={value} sign={sign && value !== 0} cents={false} className="font-semibold text-[13px]" />
    </div>
  );
}

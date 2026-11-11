"use client";
import clsx from "clsx";
import { useState } from "react";
import { Download, Plus } from "lucide-react";
import type { ChangeStatus, Project, Role } from "@/lib/types";
import { money, quoteChange } from "@/lib/pricing";
import { auditCsv, downloadText } from "@/lib/export";
import { Button, Card, STATUS_META, timeAgo } from "./ui";
import { ChangeOrderCard } from "./ChangeOrderCard";
import type { Act } from "./useProject";

const FILTERS: { key: string; label: string; match: ChangeStatus[] }[] = [
  { key: "open", label: "Open", match: ["needs_info", "contractor_review", "client_review"] },
  { key: "approved", label: "Approved", match: ["approved"] },
  { key: "closed", label: "Declined / dismissed", match: ["declined", "void"] },
  { key: "all", label: "All", match: ["needs_info", "contractor_review", "client_review", "approved", "declined", "void"] },
];

export function ChangeOrdersBoard({ project, role, act, ramp }: { project: Project; role: Role; act: Act; ramp?: boolean }) {
  const [filter, setFilter] = useState("all");
  const f = FILTERS.find((x) => x.key === filter)!;
  const list = [...project.changeOrders].filter((c) => f.match.includes(c.status)).sort((a, b) => b.number - a.number);
  const [selected, setSelected] = useState<string | null>(null);
  const sel = project.changeOrders.find((c) => c.id === (selected ?? list[0]?.id));

  return (
    <div className="max-w-6xl mx-auto py-6">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {FILTERS.map((x) => {
          const n = project.changeOrders.filter((c) => x.match.includes(c.status)).length;
          return (
            <button
              key={x.key}
              onClick={() => setFilter(x.key)}
              className={clsx("rounded-full px-3.5 py-1.5 text-[13px] font-medium border transition-colors cursor-pointer", filter === x.key ? "bg-ink text-white border-ink" : "bg-white border-line hover:border-ink/30")}
            >
              {x.label} <span className="opacity-60">{n}</span>
            </button>
          );
        })}
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={() => downloadText(`${project.id}-audit.csv`, auditCsv(project), "text/csv")}>
            <Download className="h-3.5 w-3.5" /> Audit trail
          </Button>
          {role === "contractor" && (
            <Button size="sm" variant="outline" onClick={() => act({ type: "createManualChange" })}>
              <Plus className="h-3.5 w-3.5" /> Manual change order
            </Button>
          )}
        </div>
      </div>
      <div className="grid lg:grid-cols-[380px_1fr] gap-5">
        <div className="space-y-2">
          {list.length === 0 && <Card className="p-6 text-center text-muted text-sm">Nothing here yet.</Card>}
          {list.map((c) => {
            const q = quoteChange(project, c);
            const hidden = role === "client" && ["needs_info", "contractor_review"].includes(c.status);
            return (
              <button
                key={c.id}
                onClick={() => setSelected(c.id)}
                className={clsx("w-full text-left rounded-2xl border bg-white p-3.5 transition-all cursor-pointer", sel?.id === c.id ? "border-agent/50 shadow-[0_8px_30px_-12px_rgba(107,92,255,0.4)]" : "border-line hover:border-ink/20")}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-muted">CO-{c.number}</span>
                  <span className={clsx("text-[11px] font-semibold rounded-full px-2 py-0.5", STATUS_META[c.status].cls)}>{STATUS_META[c.status].label}</span>
                </div>
                <div className="font-medium mt-1">{c.title}</div>
                <div className="flex justify-between text-[12px] text-muted mt-1">
                  <span>{timeAgo(c.createdAt)} · {c.history.length} events</span>
                  {!hidden && <span className="tabular-nums font-semibold text-ink">{money(q.total, { sign: true })}</span>}
                </div>
              </button>
            );
          })}
        </div>
        {sel && (
          <div className="space-y-4">
            <ChangeOrderCard key={sel.id + sel.status} project={project} co={sel} role={role} act={act} ramp={ramp} />
            <Card className="p-4">
              <div className="text-[11.5px] uppercase tracking-wider text-muted font-semibold mb-3">Audit trail</div>
              <ol className="relative border-l border-line ml-1.5 space-y-3">
                {sel.history.map((h, i) => (
                  <li key={i} className="ml-4 text-[13px]">
                    <span className={clsx("absolute -left-[5px] h-2.5 w-2.5 rounded-full", h.actor === "agent" ? "bg-agent" : h.actor === "client" ? "bg-accent" : "bg-ink")} />
                    <div>
                      <span className="font-medium capitalize">{h.actor === "agent" ? "Agent" : h.actor === "client" ? project.client.name : project.contractor.name}</span> · {h.action}
                      {h.note && <span className="text-muted"> · {h.note}</span>}
                    </div>
                    <div className="text-[11px] text-muted">{new Date(h.at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</div>
                  </li>
                ))}
              </ol>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

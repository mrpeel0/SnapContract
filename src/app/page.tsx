"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { ArrowRight, Check, FileSignature, MessageSquareText, Plus, ReceiptText, Sparkles, Zap } from "lucide-react";
import { Button, Card, Logo, timeAgo } from "@/components/ui";
import { money } from "@/lib/pricing";

interface Row {
  id: string;
  name: string;
  address: string;
  client: string;
  status: string;
  budget: { baseline: number; current: number; pending: number; approved: number; projected: number; approvedCount: number };
  needsAttention: number;
  lastMessage: string;
}

const STEPS = [
  { icon: MessageSquareText, t: "Client asks in chat", d: "“Can we add 2 outlets on the island?”" },
  { icon: Sparkles, t: "Agent prices it", d: "Matched to your rate sheet, +10% O&P" },
  { icon: Check, t: "Client approves", d: "Signed right in the conversation" },
  { icon: ReceiptText, t: "Invoice updates", d: "New version, approval attached" },
];

function PortfolioStat({ label, value, hint, accent }: { label: string; value: number; hint: string; accent?: boolean }) {
  return (
    <Card className="p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted font-semibold">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${accent && value !== 0 ? "text-accent" : ""}`}>{money(value, { cents: false })}</div>
      <div className="text-[12px] text-muted mt-0.5">{hint}</div>
    </Card>
  );
}

export default function Home() {
  const [rows, setRows] = useState<Row[]>([]);
  const [ai, setAi] = useState<"claude" | "local" | null | undefined>(undefined);
  const [step, setStep] = useState(0);

  useEffect(() => {
    fetch("/api/projects").then((r) => r.json()).then((j) => {
      setRows(j.projects);
      setAi(j.ai);
    });
    const t = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 1800);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen grain">
      <section className="blueprint text-white">
        <div className="max-w-6xl mx-auto px-6 pt-6 pb-20">
          <div className="flex items-center justify-between">
            <Logo className="text-white text-lg" />
            {ai !== undefined && (
              <span className={`text-[12px] rounded-full px-3 py-1 font-semibold inline-flex items-center gap-1 ${ai ? "bg-agent/30 text-white" : "bg-white/10 text-white/70"}`}>
                {ai ? <Sparkles className="h-3 w-3" /> : <Zap className="h-3 w-3" />} {ai === "claude" ? "Claude connected" : ai === "local" ? "Local model connected" : "Offline demo engine"}
              </span>
            )}
          </div>
          <div className="mt-16 grid lg:grid-cols-[1.1fr_1fr] gap-12 items-center">
            <div>
              <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-5xl md:text-6xl font-semibold tracking-tight leading-[1.02]">
                Every “can we also…”<br />
                <span className="bg-gradient-to-r from-accent via-accent-2 to-agent-2 bg-clip-text text-transparent">priced, approved, invoiced.</span>
              </motion.h1>
              <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-5 text-white/70 text-lg max-w-xl">
                SnapContract&apos;s agent lives in the contractor-client conversation. It catches scope changes in texts, voice notes and call transcripts, prices them from your rate sheet and gets them signed before work starts.
              </motion.p>
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-8 flex flex-wrap gap-3">
                <Link href="/projects/maple-kitchen?tab=chat&as=client">
                  <Button size="lg">Open live demo <ArrowRight className="h-4 w-4" /></Button>
                </Link>
                <Link href="/projects/new">
                  <Button size="lg" variant="outline" className="!bg-white/10 !border-white/20 text-white hover:!bg-white/15">
                    <Plus className="h-4 w-4" /> Start a project
                  </Button>
                </Link>
              </motion.div>
            </div>
            <div className="relative">
              <div className="absolute -inset-8 bg-gradient-to-br from-accent/30 to-agent/30 blur-3xl rounded-full" />
              <div className="relative space-y-3">
                {STEPS.map((s, i) => {
                  const Icon = s.icon;
                  const active = i === step;
                  return (
                    <motion.div
                      key={s.t}
                      animate={{ scale: active ? 1.03 : 1, opacity: active ? 1 : 0.55, x: active ? 8 : 0 }}
                      transition={{ type: "spring", stiffness: 260, damping: 22 }}
                      className={`flex items-center gap-4 rounded-2xl border px-4 py-3.5 backdrop-blur ${active ? "bg-white text-ink border-white" : "bg-white/5 border-white/10"}`}
                    >
                      <div className={`h-10 w-10 rounded-xl grid place-items-center ${active ? "bg-gradient-to-br from-agent to-agent-2 text-white" : "bg-white/10"}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-semibold text-[15px]">{s.t}</div>
                        <div className={`text-[13px] ${active ? "text-muted" : "text-white/60"}`}>{s.d}</div>
                      </div>
                      <span className="ml-auto font-mono text-[11px] opacity-50">0{i + 1}</span>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 -mt-10 pb-20 relative">
        {rows.length > 0 && (
          <div className="grid sm:grid-cols-3 gap-3 mb-4 md:mt-14">
            <PortfolioStat label="Contracted value" value={rows.reduce((s, p) => s + p.budget.current, 0)} hint="Signed baseline plus approved changes" />
            <PortfolioStat label="Open change exposure" value={rows.reduce((s, p) => s + p.budget.pending, 0)} hint="Pending, not yet on an invoice" accent />
            <PortfolioStat label="Approved changes" value={rows.reduce((s, p) => s + p.budget.approved, 0)} hint={`${rows.reduce((s, p) => s + p.budget.approvedCount, 0)} signed change orders`} />
          </div>
        )}
        <div className="flex items-end justify-between mb-4">
          <h2 className="text-xl font-semibold tracking-tight text-ink">Projects</h2>
          <Link href="/projects/new">
            <Button size="sm" variant="dark"><Plus className="h-3.5 w-3.5" /> New project</Button>
          </Link>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Link href={`/projects/${p.id}`}>
                <Card className="p-5 hover:-translate-y-0.5 hover:shadow-xl transition-all">
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${p.status === "signed" ? "bg-good/12 text-[#067a55]" : "bg-agent/10 text-agent"}`}>
                      {p.status === "signed" ? "Active" : p.status === "none" ? "Setup" : "Agreement draft"}
                    </span>
                    {p.needsAttention > 0 && <span className="text-[11px] font-semibold text-accent">{p.needsAttention} open change{p.needsAttention > 1 ? "s" : ""}</span>}
                  </div>
                  <div className="mt-3 font-semibold text-[16px]">{p.name}</div>
                  <div className="text-[13px] text-muted">{p.address} · {p.client}</div>
                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <div className="text-[11px] text-muted">Contract value</div>
                      <div className="text-xl font-semibold tabular-nums">{money(p.budget.current, { cents: false })}</div>
                    </div>
                    <div className="text-right">
                      {p.budget.pending !== 0 && <div className="text-[11.5px] font-semibold text-accent tabular-nums">{money(p.budget.pending, { sign: true, cents: false })} open</div>}
                      <div className="text-[11.5px] text-muted">{timeAgo(p.lastMessage)}</div>
                    </div>
                  </div>
                </Card>
              </Link>
            </motion.div>
          ))}
          <Link href="/projects/new">
            <div className="h-full min-h-[170px] rounded-2xl border-2 border-dashed border-line grid place-items-center text-muted hover:border-accent/50 hover:text-accent transition-colors">
              <div className="text-center">
                <FileSignature className="h-6 w-6 mx-auto" />
                <div className="mt-2 text-sm font-medium">Draft a new agreement</div>
              </div>
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}

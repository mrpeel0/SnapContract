"use client";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { ArrowRight, Check, CreditCard, FileSignature, MessageSquareText, Plus, ReceiptText, ShieldCheck, Sparkles } from "lucide-react";
import { Button, Card, ChannelIcon, Dot, Logo, timeAgo, type ChannelKey } from "@/components/ui";
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
  { icon: MessageSquareText, t: "Client texts a change", d: "On WhatsApp, iMessage, Telegram or the web. Voice notes and call transcripts too." },
  { icon: Sparkles, t: "Agent prices it", d: "Matched to the contractor's rate sheet. Overhead & profit added, credits back at cost." },
  { icon: ShieldCheck, t: "Approved in the thread", d: "Contractor reviews, client taps Approve. Signed and audit-logged." },
  { icon: ReceiptText, t: "Books stay right", d: "Contract, draws and invoice update. Materials get a Ramp card." },
];

const CHANNELS: { kind: ChannelKey; label: string }[] = [
  { kind: "whatsapp", label: "WhatsApp" },
  { kind: "imessage", label: "iMessage" },
  { kind: "telegram", label: "Telegram" },
  { kind: "web", label: "Web" },
];

function HeroPhone() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % 5), 1700);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="relative mx-auto w-[310px]">
      <div className="absolute -inset-10 rounded-[60px] bg-accent/20 blur-3xl" />
      <div className="relative rounded-[38px] bg-[#1b1c20] p-2.5 shadow-[0_40px_100px_-30px_rgba(0,0,0,0.8)] ring-1 ring-white/10">
        <div className="rounded-[30px] bg-[#f3f2ee] overflow-hidden h-[540px] flex flex-col">
          <div className="bg-white px-4 pt-6 pb-3 flex items-center gap-2.5 border-b border-black/5">
            <ChannelIcon kind="whatsapp" size={30} className="rounded-full!" />
            <div className="leading-tight">
              <div className="text-[13.5px] font-semibold text-ink">SnapContract</div>
              <div className="text-[11px] text-muted">Maple St Kitchen · Priya</div>
            </div>
          </div>
          <div className="flex-1 p-3 space-y-2 text-[12.5px]">
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-[#d9fdd3] px-3 py-2 text-ink">
              Could we add a couple more outlets on the island?
            </motion.div>
            <AnimatePresence>
              {step === 1 && (
                <motion.div key="typing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-14 rounded-2xl rounded-bl-md bg-white px-3 py-2.5">
                  <span className="dot-pulse flex gap-1"><span /><span /><span /></span>
                </motion.div>
              )}
            </AnimatePresence>
            {step >= 2 && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-[88%] rounded-2xl rounded-bl-md bg-white overflow-hidden shadow-sm">
                <div className="px-3 pt-2.5">
                  <div className="font-semibold text-ink">CO-2 · Two outlets at island</div>
                  <div className="text-muted mt-0.5 leading-snug">Add two GFCI outlets on the island, on the existing circuit.</div>
                  <div className="mt-2 text-[11.5px] text-ink/80">+ Outlet install · 2 ea · $330.00</div>
                  <div className="mt-1.5 font-semibold text-ink">Total +$363.00</div>
                </div>
                <div className="mt-2 grid grid-cols-2 border-t border-black/5 text-[12.5px] font-medium text-[#0b8a5f]">
                  <span className={`py-2 text-center transition-colors ${step >= 3 ? "bg-[#0b8a5f]/10" : ""}`}>Approve</span>
                  <span className="py-2 text-center border-l border-black/5">Decline</span>
                </div>
              </motion.div>
            )}
            {step >= 4 && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mx-auto w-fit rounded-full bg-white/80 px-3 py-1 text-[11px] text-muted flex items-center gap-1.5">
                <Check className="h-3 w-3 text-good" /> Approved by Priya · invoice v3
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PortfolioStat({ label, value, hint, accent }: { label: string; value: number; hint: string; accent?: boolean }) {
  return (
    <Card className="p-4 elevated">
      <div className="eyebrow">{label}</div>
      <div className={`mt-1.5 text-[26px] leading-none font-semibold tracking-tight tabular-nums ${accent && value !== 0 ? "text-accent" : ""}`}>{money(value, { cents: false })}</div>
      <div className="text-[12px] text-muted mt-1.5">{hint}</div>
    </Card>
  );
}

export default function Home() {
  const [rows, setRows] = useState<Row[]>([]);
  const [ai, setAi] = useState<"openai" | "claude" | "local" | null | undefined>(undefined);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((j) => {
        setRows(j.projects);
        setAi(j.ai);
      });
  }, []);

  const aiLabel = ai === "openai" ? "OpenAI" : ai === "claude" ? "Claude" : ai === "local" ? "Local model" : "Offline engine";

  return (
    <div className="min-h-screen grain">
      <section className="blueprint text-white">
        <div className="max-w-6xl mx-auto px-6">
          <nav className="flex items-center justify-between h-16">
            <Logo dark className="text-white text-[15px]" />
            <div className="flex items-center gap-2">
              {ai !== undefined && (
                <span className="hidden sm:inline-flex items-center gap-1.5 text-[12px] rounded-lg px-2.5 h-8 font-medium bg-white/[0.06] ring-1 ring-white/10 text-white/80">
                  <Dot tone={ai ? "good" : "muted"} pulse={Boolean(ai)} /> {aiLabel} {ai ? "connected" : ""}
                </span>
              )}
              <Link href="/projects/maple-kitchen?tab=chat&as=client&split=1">
                <Button size="sm" variant="outline" className="bg-white! text-ink! border-white!">Open demo</Button>
              </Link>
            </div>
          </nav>

          <div className="pt-14 pb-20 grid lg:grid-cols-[1.3fr_1fr] gap-12 items-center">
            <div>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] ring-1 ring-white/10 px-3 py-1 text-[12px] text-white/75">
                <Sparkles className="h-3.5 w-3.5 text-accent-2" /> AI change orders for residential contractors
              </motion.div>
              <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mt-5 text-[42px] md:text-[54px] font-semibold tracking-[-0.035em] leading-[1.03]">
                Every &ldquo;can we also&hellip;&rdquo;
                <br />
                <span className="text-white/45">priced, signed, invoiced.</span>
              </motion.h1>
              <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-5 text-white/65 text-[17px] leading-relaxed max-w-xl">
                SnapContract&apos;s agent sits in the texts between a contractor and their client. It catches scope changes, prices them from the contractor&apos;s rate sheet and gets them approved in the same thread, before the work starts.
              </motion.p>
              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mt-8 flex flex-wrap gap-2.5">
                <Link href="/projects/maple-kitchen?tab=chat&as=client&split=1">
                  <Button size="lg" variant="accent">Open live demo <ArrowRight className="h-4 w-4" /></Button>
                </Link>
                <Link href="/projects/new">
                  <Button size="lg" variant="ghost" className="text-white! hover:bg-white/10! ring-1 ring-white/15">
                    <Plus className="h-4 w-4" /> Start a project
                  </Button>
                </Link>
              </motion.div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="mt-10">
                <div className="text-[11px] uppercase tracking-[0.12em] text-white/40 font-semibold">Works where clients already text</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {CHANNELS.map((c) => (
                    <span key={c.kind} className="inline-flex items-center gap-2 rounded-lg bg-white/[0.05] ring-1 ring-white/10 pl-1.5 pr-3 h-9 text-[13px] text-white/85">
                      <ChannelIcon kind={c.kind} size={24} className={c.kind === "web" ? "bg-white/15!" : ""} /> {c.label}
                    </span>
                  ))}
                </div>
              </motion.div>
            </div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="hidden md:block">
              <HeroPhone />
            </motion.div>
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-white">
        <div className="max-w-6xl mx-auto px-6 py-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={s.t}>
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-sunken ring-1 ring-line grid place-items-center"><Icon className="h-4 w-4" /></div>
                  <span className="font-mono text-[11px] text-muted">0{i + 1}</span>
                </div>
                <div className="mt-3 font-semibold text-[14.5px]">{s.t}</div>
                <div className="mt-1 text-[13px] text-muted leading-relaxed">{s.d}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-12">
        {rows.length > 0 && (
          <div className="grid sm:grid-cols-3 gap-3 mb-8">
            <PortfolioStat label="Contracted value" value={rows.reduce((s, p) => s + p.budget.current, 0)} hint="Signed baseline plus approved changes" />
            <PortfolioStat label="Open change exposure" value={rows.reduce((s, p) => s + p.budget.pending, 0)} hint="Priced, not yet approved" accent />
            <PortfolioStat label="Approved changes" value={rows.reduce((s, p) => s + p.budget.approved, 0)} hint={`${rows.reduce((s, p) => s + p.budget.approvedCount, 0)} signed change orders`} />
          </div>
        )}
        <div className="flex items-end justify-between mb-4">
          <div>
            <h2 className="text-[19px] font-semibold tracking-tight">Projects</h2>
            <div className="text-[13px] text-muted">Each project has its own agreement, rate sheet and conversation.</div>
          </div>
          <Link href="/projects/new">
            <Button size="sm"><Plus className="h-3.5 w-3.5" /> New project</Button>
          </Link>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Link href={`/projects/${p.id}`}>
                <Card className="p-5 h-full hover:border-line-strong hover:shadow-[0_12px_32px_-16px_rgba(15,16,18,0.2)] transition-all">
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1.5 text-[11.5px] font-semibold rounded-md px-2 py-0.5 ${p.status === "signed" ? "bg-good/10 text-good" : "bg-agent/10 text-agent"}`}>
                      <Dot tone={p.status === "signed" ? "good" : "agent"} /> {p.status === "signed" ? "Active" : p.status === "none" ? "Setup" : "Agreement draft"}
                    </span>
                    {p.needsAttention > 0 && <span className="text-[11.5px] font-semibold text-accent">{p.needsAttention} open change{p.needsAttention > 1 ? "s" : ""}</span>}
                  </div>
                  <div className="mt-3 font-semibold text-[15.5px] tracking-tight">{p.name}</div>
                  <div className="text-[13px] text-muted truncate">{p.address} · {p.client}</div>
                  <div className="mt-5 pt-4 border-t border-line flex items-end justify-between">
                    <div>
                      <div className="eyebrow">Contract value</div>
                      <div className="mt-1 text-[20px] leading-none font-semibold tabular-nums tracking-tight">{money(p.budget.current, { cents: false })}</div>
                    </div>
                    <div className="text-right">
                      {p.budget.pending !== 0 && <div className="text-[12px] font-semibold text-accent tabular-nums">{money(p.budget.pending, { sign: true, cents: false })} open</div>}
                      <div className="text-[11.5px] text-muted">{timeAgo(p.lastMessage)}</div>
                    </div>
                  </div>
                </Card>
              </Link>
            </motion.div>
          ))}
          <Link href="/projects/new">
            <div className="h-full min-h-[176px] rounded-xl border border-dashed border-line-strong grid place-items-center text-muted hover:border-ink/30 hover:text-ink hover:bg-white transition-colors">
              <div className="text-center">
                <FileSignature className="h-5 w-5 mx-auto" />
                <div className="mt-2 text-[13.5px] font-medium">Draft a new agreement</div>
                <div className="text-[12px] text-muted">From a plain-English scope</div>
              </div>
            </div>
          </Link>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between text-[12px] text-muted">
          <Logo className="text-[13px] text-ink" />
          <span className="flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5" /> Materials spend on Ramp virtual cards</span>
        </div>
      </footer>
    </div>
  );
}

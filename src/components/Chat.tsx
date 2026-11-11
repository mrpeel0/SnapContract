"use client";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Mic, MicOff, SendHorizontal, Sparkles, Square, Wand2, X, AudioLines } from "lucide-react";
import type { Message, Project, Role } from "@/lib/types";
import { Avatar, Button, timeAgo } from "./ui";
import { ChangeOrderCard } from "./ChangeOrderCard";
import type { Act } from "./useProject";
import type { Surface } from "./Channels";

const QUICK: Record<Role, string[]> = {
  client: [
    "Could we add a couple more outlets on the island?",
    "Actually, can we switch the flooring to white oak instead?",
    "Let's add 3 pendant lights over the island",
    "We'd love zellige tile for the backsplash instead of subway",
    "Let's skip the disposal, we don't need it",
  ],
  contractor: [
    "Countertop install is scheduled for Thursday morning.",
    "While we're in there I can add a pot filler over the range if you want one.",
    "Heads up: inspector signed off on rough electrical today.",
  ],
};

const SAMPLE_TRANSCRIPT = `[Call · Marcus Reyes & Priya Shah · 6 min]
Marcus: So the cabinets look great. Anything else you're thinking about?
Priya: Yes, two things. We'd love under-cabinet lighting, maybe 14 feet along the uppers.
Marcus: Easy, that's LED strip on the existing circuit.
Priya: And can we add dimmer switches for the recessed lights? Two dimmers I think.
Marcus: Sure. Anything else?
Priya: No, that's it. Oh, and the dog door is on hold, we'll talk later.`;

export function Chat({ project, role, act, className, dense, ramp, skin = "web" }: { project: Project; role: Role; act: Act; className?: string; dense?: boolean; ramp?: boolean; skin?: Surface }) {
  const [text, setText] = useState("");
  const [showTranscript, setShowTranscript] = useState(false);
  const [transcript, setTranscript] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const voice = useVoice((t) => setText(t));
  const [sending, setSending] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const phone = skin !== "web";

  const visible = useMemo(() => project.messages.filter((m) => !m.visibleTo || m.visibleTo.includes(role)), [project.messages, role]);

  // Only render the full card at the latest message referencing each change order.
  const lastRef = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of visible) if (m.changeOrderId) map.set(m.changeOrderId, m.id);
    return map;
  }, [visible]);

  const thinking = project.agentStatus === "thinking";

  const coSig = project.changeOrders.map((c) => c.status).join();
  useEffect(() => {
    const go = () => scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
    go();
    const t = setTimeout(go, 350);
    return () => clearTimeout(t);
  }, [visible.length, thinking, coSig]);

  const send = async (body: string, kind: Message["kind"] = "text") => {
    if (!body.trim()) return;
    setSending(true);
    try {
      await act({ type: "postMessage", author: role, kind, body });
      setText("");
      setVoiceMode(false);
    } finally {
      setSending(false);
    }
  };

  const me = role === "contractor" ? project.contractor : project.client;
  const locked = project.agreement.status !== "signed";

  return (
    <div className={clsx("flex flex-col min-h-0", skin === "web" && "bg-white/70", className)}>
      {skin === "web" && (
        <div className="shrink-0 border-b border-line bg-white/90 px-5 py-3">
          <div className="text-[13px] font-semibold tracking-tight">Project thread</div>
          <div className="text-[11.5px] text-muted">Website · the same conversation is on Telegram, WhatsApp, and iMessage</div>
        </div>
      )}
      <div ref={scroller} className={clsx("flex-1 overflow-y-auto scroll-thin space-y-3", dense || phone ? "p-3" : "p-5", skin === "whatsapp" && "wa-wall", skin === "telegram" && "tg-wall", skin === "imessage" && "bg-white")}>
        {locked && (
          <div className="mx-auto max-w-md text-center text-[13px] text-muted rounded-xl border border-dashed border-line p-4 bg-white">
            The agent starts watching for changes once the agreement is signed by both sides.
          </div>
        )}
        <AnimatePresence initial={false}>
          {visible.map((m) => (
            <MessageRow key={m.id} m={m} project={project} role={role} act={act} showCard={m.changeOrderId ? lastRef.get(m.changeOrderId) === m.id : false} dense={dense || phone} ramp={ramp} skin={skin} />
          ))}
        </AnimatePresence>
        {thinking && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2.5">
            <Avatar name="AI" tone="agent" size={28} />
            <div className="rounded-2xl rounded-tl-md bg-white border border-line px-3.5 py-2 text-[13px] flex items-center gap-2">
              <span className="dot-pulse flex gap-1"><span /><span /><span /></span>
              <span className="shimmer-text font-medium">{project.agentStatusText ?? "Thinking…"}</span>
            </div>
          </motion.div>
        )}
      </div>

      {/* composer */}
      <div className={clsx("border-t", phone ? "px-2 py-2" : dense ? "p-2.5" : "p-3.5", skin === "whatsapp" && "border-transparent bg-[#f0f2f5]", skin === "telegram" && "border-white/40 bg-white/80", skin === "imessage" && "border-black/5 bg-[#f6f6f6]", skin === "web" && "border-line bg-white")}>
        <div className="flex gap-1.5 overflow-x-auto scroll-thin pb-2 -mx-0.5 px-0.5">
          {QUICK[role].map((q) => (
            <button key={q} onClick={() => setText(q)} className="shrink-0 rounded-full border border-line bg-bg/60 px-3 py-1 text-[12px] text-ink/80 hover:border-accent/50 hover:text-accent transition-colors cursor-pointer">
              {q}
            </button>
          ))}
        </div>
        <div className={clsx("flex items-end gap-2 px-2 py-1.5 transition-colors", skin === "imessage" ? "rounded-full" : "rounded-2xl", skin === "web" || skin === "telegram" ? "border bg-white" : "bg-white", voice.listening ? "border-bad/50 ring-4 ring-bad/10" : "border-line focus-within:border-ink/30")}>
          {!phone && <Avatar name={me.name} tone={role === "contractor" ? "ink" : "accent"} size={28} />}
          {voice.listening ? (
            <div className="flex-1 py-1.5 text-sm flex items-center gap-2 min-h-9">
              <AudioLines className="h-4 w-4 text-bad animate-pulse" />
              <span className="text-ink/80">{text || "Listening… speak your voice note"}</span>
            </div>
          ) : (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(text, voiceMode ? "voice" : "text");
                }
              }}
              rows={1}
              placeholder={`Message as ${me.name.split(" ")[0]}…`}
              className="flex-1 resize-none bg-transparent py-1.5 text-sm outline-none max-h-28 min-h-9"
            />
          )}
          {voice.supported && (
            <button
              title={voice.listening ? "Stop" : "Record voice note"}
              onClick={() => {
                if (voice.listening) {
                  voice.stop();
                  setVoiceMode(true);
                } else voice.start();
              }}
              className={clsx("h-9 w-9 grid place-items-center rounded-xl cursor-pointer transition-colors", voice.listening ? "bg-bad text-white" : "hover:bg-black/5 text-muted")}
            >
              {voice.listening ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-4 w-4" />}
            </button>
          )}
          {!voice.supported && (
            <span title="Voice notes need Chrome's speech recognition" className="h-9 w-9 grid place-items-center text-muted/50">
              <MicOff className="h-4 w-4" />
            </span>
          )}
          <button title="Share a call transcript" onClick={() => setShowTranscript(true)} className="h-9 w-9 grid place-items-center rounded-xl hover:bg-black/5 text-muted cursor-pointer">
            <FileText className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={!text.trim() || sending}
            onClick={() => send(text, voiceMode ? "voice" : "text")}
            className={clsx(
              "h-9 w-9 grid place-items-center rounded-full text-white disabled:opacity-40 cursor-pointer",
              skin === "whatsapp" && "bg-[#25D366]",
              skin === "telegram" && "bg-[#229ED9]",
              skin === "imessage" && "bg-[#0A84FF]",
              skin === "web" && "bg-ink",
            )}
          >
            <SendHorizontal className="h-4 w-4" />
          </button>
        </div>
        {voiceMode && !voice.listening && text && <div className="text-[11px] text-muted mt-1 pl-1">Will send as a transcribed voice note</div>}
      </div>

      <AnimatePresence>
        {showTranscript && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm grid place-items-center p-4" onClick={() => setShowTranscript(false)}>
            <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl">
              <div className="flex items-center justify-between mb-1">
                <div className="font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-agent" /> Share a call transcript
                </div>
                <button onClick={() => setShowTranscript(false)} className="text-muted cursor-pointer"><X className="h-4 w-4" /></button>
              </div>
              <p className="text-[13px] text-muted mb-3">Paste notes or a transcript from a phone call or site visit. The agent will pull out every scope change it finds.</p>
              <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} rows={9} className="w-full rounded-xl border border-line p-3 text-[13px] font-mono" placeholder="Paste transcript…" />
              <div className="flex justify-between mt-3">
                <Button variant="ghost" size="sm" onClick={() => setTranscript(SAMPLE_TRANSCRIPT)}>
                  <Wand2 className="h-3.5 w-3.5" /> Use sample call
                </Button>
                <Button
                  variant="agent"
                  disabled={!transcript.trim()}
                  onClick={async () => {
                    setShowTranscript(false);
                    await send(transcript, "transcript");
                    setTranscript("");
                  }}
                >
                  <Sparkles className="h-4 w-4" /> Analyze transcript
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MessageRow({ m, project, role, act, showCard, dense, ramp, skin }: { m: Message; project: Project; role: Role; act: Act; showCard: boolean; dense?: boolean; ramp?: boolean; skin: Surface }) {
  if (m.author === "system") {
    return (
      <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center">
        <div className={clsx("text-[11.5px] rounded-full px-3 py-1 text-center max-w-[90%]", skin === "telegram" ? "bg-black/25 text-white" : skin === "imessage" ? "bg-transparent text-black/40" : "text-muted bg-black/[0.05]")}>{m.body}</div>
      </motion.div>
    );
  }
  if (m.author === "agent") {
    const co = m.changeOrderId ? project.changeOrders.find((c) => c.id === m.changeOrderId) : undefined;
    return (
      <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2.5 items-start">
        {skin === "web" && <Avatar name="AI" tone="agent" size={28} />}
        <div className="flex-1 min-w-0 max-w-[560px]">
          <div className={clsx("text-[11px] mb-1 flex items-center gap-1.5", skin === "telegram" ? "text-white/80" : "text-muted")}>
            <span className={clsx("font-semibold", skin === "telegram" ? "text-white" : "text-agent")}>SnapContract</span> · {timeAgo(m.createdAt)}
          </div>
          {co && showCard ? (
            <>
              {co.status === "needs_info" && co.question && (
                <div className="mb-2 rounded-2xl rounded-tl-md bg-white border border-line px-3.5 py-2 text-sm">{co.question}</div>
              )}
              <ChangeOrderCard project={project} co={co} role={role} act={act} compact={dense} ramp={ramp} />
            </>
          ) : co ? (
            <div className="text-[12px] text-muted rounded-full border border-line bg-white px-3 py-1 inline-flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-agent" /> {m.body}: <span className="font-medium text-ink">{co.title}</span> (see below)
            </div>
          ) : (
            <div className="rounded-2xl rounded-tl-md agent-border px-3.5 py-2.5 text-sm leading-relaxed">{m.body}</div>
          )}
        </div>
      </motion.div>
    );
  }
  const mine = m.author === role;
  const party = m.author === "contractor" ? project.contractor : project.client;
  const bubble = mine
    ? skin === "whatsapp"
      ? "bg-[#d9fdd3] text-[#111b21] rounded-lg rounded-br-sm"
      : skin === "telegram"
        ? "bg-[#eeffde] text-[#18222d] rounded-xl rounded-br-sm shadow-sm"
        : skin === "imessage"
          ? "bg-[#0A84FF] text-white rounded-[18px] rounded-br-[5px]"
          : "bg-ink text-white rounded-2xl rounded-br-md"
    : skin === "whatsapp"
      ? "bg-white text-[#111b21] rounded-lg rounded-bl-sm shadow-sm"
      : skin === "telegram"
        ? "bg-white text-[#18222d] rounded-xl rounded-bl-sm shadow-sm"
        : skin === "imessage"
          ? "bg-[#E9E9EB] text-black rounded-[18px] rounded-bl-[5px]"
          : "bg-white border border-line rounded-2xl rounded-bl-md";
  const quiet = mine && (skin === "web" || skin === "imessage") ? "text-white/60" : "text-muted";
  return (
    <motion.div layout initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className={clsx("flex gap-2.5 items-end", mine && "flex-row-reverse")}>
      {skin === "web" && <Avatar name={party.name} tone={m.author === "contractor" ? "ink" : "accent"} size={28} />}
      <div className={clsx("max-w-[82%] flex flex-col", mine ? "items-end" : "items-start")}>
        <div className={clsx("text-[11px] mb-1 px-1", skin === "telegram" ? "text-white/75" : "text-muted")}>
          {party.name.split(" ")[0]} · {timeAgo(m.createdAt)}
        </div>
        {m.kind === "transcript" ? (
          <div className={clsx("rounded-2xl border border-line bg-white p-3 text-[12.5px] font-mono whitespace-pre-wrap max-h-48 overflow-y-auto scroll-thin", mine && "rounded-br-md")}>
            <div className="font-sans text-[11px] font-semibold text-agent mb-1 flex items-center gap-1"><FileText className="h-3 w-3" /> Call transcript</div>
            {m.body}
          </div>
        ) : (
          <div className={clsx("px-3.5 py-2 text-sm leading-relaxed", bubble)}>
            {m.kind === "voice" && (
              <div className={clsx("flex items-center gap-1.5 text-[11px] mb-1", quiet)}>
                <AudioLines className="h-3.5 w-3.5" /> Voice note · transcribed
              </div>
            )}
            {m.body}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// --- Web Speech API voice notes (Chrome/Edge/Safari) ---
type SR = { start(): void; stop(): void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; interimResults: boolean; continuous: boolean; lang: string };

function useVoice(onText: (t: string) => void) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const rec = useRef<SR | null>(null);
  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);
  const start = () => {
    const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;
    const r = new Ctor();
    r.interimResults = true;
    r.continuous = true;
    r.lang = "en-US";
    r.onresult = (e) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      onText(t);
    };
    r.onend = () => setListening(false);
    rec.current = r;
    r.start();
    setListening(true);
  };
  const stop = () => {
    rec.current?.stop();
    setListening(false);
  };
  return { listening, supported, start, stop };
}

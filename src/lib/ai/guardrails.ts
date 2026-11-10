// Deterministic checks applied to every model proposal (Claude or local) before it becomes a
// change order. Models choose items; code makes sure the result is complete and grounded.
import type { Message, Project } from "../types";
import type { AnalysisResultT, ProposedChangeT } from "./schemas";
import { BUNDLE, FAMILY, WORD_NUM, matchItems } from "./offline";

type Line = ProposedChangeT["lines"][number];

const hasQuantity = (text: string) =>
  /\b\d+(\.\d+)?\b/.test(text) || Object.keys(WORD_NUM).some((w) => w.length > 2 && new RegExp(`\\b${w}\\b`, "i").test(text));

export function repairProposals(p: Project, msgs: Message[], result: AnalysisResultT): AnalysisResultT {
  const skus = new Set(p.priceSheet.map((i) => i.sku));
  const text = msgs.map((m) => m.body).join("\n");
  const lower = text.toLowerCase();
  const isTranscript = msgs.some((m) => m.kind === "transcript");
  const mentioned = matchItems(text, p.priceSheet).map((h) => h.item.sku);
  const openNumbers = new Set(p.changeOrders.filter((c) => c.status === "needs_info").map((c) => c.number));

  for (const c of result.changes) {
    // 0) A reply that covers the same items as an open "needs details" CO completes that CO.
    if (c.updatesChangeOrderNumber == null) {
      const open = [...p.changeOrders].reverse().find((o) => o.status === "needs_info" && o.lines.some((ol) => c.lines.some((l) => l.sku === ol.sku)));
      if (open) c.updatesChangeOrderNumber = open.number;
    }
    if (c.updatesChangeOrderNumber != null && !p.changeOrders.some((o) => o.number === c.updatesChangeOrderNumber && !["approved", "void", "declined"].includes(o.status))) {
      c.updatesChangeOrderNumber = null;
    }

    // 1) Only real SKUs, positive or zero quantities.
    c.lines = c.lines.filter((l) => skus.has(l.sku)).map((l) => ({ ...l, qty: Math.max(0, l.qty) }));

    // 2) Grounding: an added item the message never names gets swapped for a same-trade item it does name.
    c.lines = c.lines.map((l) => {
      if (l.action !== "add" || mentioned.includes(l.sku)) return l;
      const item = p.priceSheet.find((i) => i.sku === l.sku)!;
      if (!item.keywords?.length || item.keywords.some((k) => lower.includes(k))) return l;
      const prefix = l.sku.split("-")[0];
      const better = mentioned.find((s) => s.startsWith(prefix + "-") && !c.lines.some((x) => x.sku === s));
      return better ? { ...l, sku: better, note: l.note } : l;
    });

    // 3) Removals default to the baseline quantity (credit for what was in the contract).
    c.lines = c.lines.map((l) => {
      if (l.action === "remove" && !l.qty) {
        const base = p.agreement.baseline.find((b) => b.sku === l.sku);
        if (base) return { ...l, qty: base.qty };
      }
      return l;
    });

    // 4) Material swaps must credit the baseline material they replace.
    for (const add of c.lines.filter((l) => l.action === "add" && FAMILY[l.sku])) {
      const old = p.agreement.baseline.find((b) => FAMILY[b.sku] === FAMILY[add.sku] && b.sku !== add.sku);
      if (!old) continue;
      if (!c.lines.some((l) => l.action === "remove" && l.sku === old.sku)) {
        c.lines.unshift({ sku: old.sku, qty: old.qty, action: "remove", note: "Replaced material · credited at cost" });
      }
      if (!add.qty) add.qty = old.qty;
    }

    // 5) Bundles: installed items include their fixture.
    for (const [sku, extras] of Object.entries(BUNDLE)) {
      const main = c.lines.find((l) => l.sku === sku && l.action === "add");
      if (!main) continue;
      for (const e of extras) {
        const ex = c.lines.find((l) => l.sku === e);
        if (!ex) c.lines.push({ sku: e, qty: main.qty, action: "add", note: "Fixture" } satisfies Line);
        else if (!ex.qty) ex.qty = main.qty;
      }
    }

    // 6) Never invent counts: if the client gave no number for a per-each item, ask instead.
    const answeringOpen = c.updatesChangeOrderNumber != null && openNumbers.has(c.updatesChangeOrderNumber);
    if (!isTranscript && !answeringOpen && !c.question && !hasQuantity(text)) {
      const guessed = c.lines.find((l) => {
        const it = p.priceSheet.find((i) => i.sku === l.sku)!;
        return l.action === "add" && it.unit === "ea" && !FAMILY[l.sku] && !BUNDLE_CHILDREN.has(l.sku);
      });
      if (guessed) {
        const it = p.priceSheet.find((i) => i.sku === guessed.sku)!;
        const name = it.name.split(/[,(]/)[0].replace(/\s*(installed|install|material)\s*/i, " ").trim().toLowerCase();
        c.question = `Happy to price that! How many ${name.endsWith("s") ? name : name + "s"} would you like?`;
        for (const l of c.lines) if (l.action === "add" && !FAMILY[l.sku]) l.qty = 0;
        c.confidence = Math.min(c.confidence, 0.6);
      }
    }
    if (c.question && c.lines.every((l) => l.qty > 0)) {
      // The model asked but already has every quantity: keep the question only if counts were not given.
      if (hasQuantity(text) || answeringOpen) c.question = null;
    }
    c.confidence = Math.max(0, Math.min(1, c.confidence));
    c.scheduleImpactDays = Math.max(0, Math.round(c.scheduleImpactDays));
  }

  result.changes = result.changes.filter((c) => c.lines.length || c.question);
  return result;
}

const BUNDLE_CHILDREN = new Set(Object.values(BUNDLE).flat());

/** Keep the drafted baseline grounded in the written scope. */
export function repairAgreementBaseline(p: Project, baseline: { sku: string; qty: number; note: string | null }[]) {
  const d = p.description.toLowerCase();
  const byId = new Map(p.priceSheet.map((i) => [i.sku, i]));
  const grounded = (sku: string) => {
    const it = byId.get(sku);
    if (!it) return false;
    if (it.category === "labor" || it.category === "fee") return true;
    const words = [...(it.keywords ?? []), ...it.name.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 4)];
    return words.some((w) => d.includes(w.toLowerCase()));
  };
  let out = baseline.filter((l) => l.qty > 0 && grounded(l.sku));
  // Labor tied to work that isn't in scope (e.g. carpentry with no cabinets/trim) is dropped too.
  if (!/cabinet|trim|carpentry|island|framing/.test(d)) out = out.filter((l) => l.sku !== "LAB-CARP");

  // Floor areas use the area written in the scope; flooring always includes install (and demo if removing).
  const area = Number(d.match(/(\d+)\s*(?:sq\.?\s*ft|square feet)/)?.[1] ?? 0);
  const floor = out.find((l) => FAMILY[l.sku] === "floor");
  if (floor) {
    if (area) floor.qty = area;
    const need = ["FL-INSTALL", ...(/remove|tear out|demo|rip out/.test(d) ? ["FL-DEMO"] : [])];
    for (const sku of need) {
      const ex = out.find((l) => l.sku === sku);
      if (ex) ex.qty = floor.qty;
      else if (byId.has(sku)) out.push({ sku, qty: floor.qty, note: null });
    }
  }
  // De-duplicate SKUs.
  const seen = new Map<string, (typeof out)[number]>();
  for (const l of out) {
    const prev = seen.get(l.sku);
    if (prev) prev.qty = Math.max(prev.qty, l.qty);
    else seen.set(l.sku, l);
  }
  return [...seen.values()];
}

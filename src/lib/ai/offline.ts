// Deterministic keyword engine used when no API key is set (or the API call fails).
// It is intentionally tuned to the sample price sheet so the demo always works.
import type { ChangeOrder, Message, PriceItem, Project } from "../types";
import type { AgreementDraftT, AnalysisResultT, ProposedChangeT } from "./schemas";

export const WORD_NUM: Record<string, number> = {
  a: 1, an: 1, one: 1, another: 1, single: 1, two: 2, couple: 2, pair: 2, three: 3, few: 3,
  four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12,
};

const REMOVE_RE = /\b(remove|skip|drop|don'?t need|no longer|cancel|scratch|nix|without|get rid of|forget)\b/i;
const SWAP_RE = /\b(switch|swap|change|upgrade|instead|go with|replace|rather)\b/i;
// More specific SKUs suppress generic ones when both match.
export const SUPPRESS: Record<string, string[]> = {
  "EL-USB": ["EL-OUT"],
  "EL-GFCI": ["EL-OUT"],
  "BS-ZEL": ["BS-SUB"],
  "FL-OAK": ["FL-INSTALL"],
};
// Bundles: ask for one thing, price the full installed cost.
export const BUNDLE: Record<string, string[]> = {
  "EL-PEND": ["FX-PEND"],
  "BS-ZEL": [],
};
// Material families used for swaps (old baseline item gets removed).
export const FAMILY: Record<string, string> = {
  "FL-LVP": "floor", "FL-OAK": "floor", "FL-TILE": "floor",
  "BS-SUB": "backsplash", "BS-ZEL": "backsplash",
  "CT-QTZ": "counter", "CT-LAM": "counter",
};

function qtyNear(text: string, idx: number): number | null {
  const before = text.slice(Math.max(0, idx - 28), idx).toLowerCase();
  const digits = before.match(/(\d+(?:\.\d+)?)\s*(?:more|extra|additional|new|x)?\s*[a-z-]*\s*$/);
  if (digits) return Number(digits[1]);
  const words = before.match(/\b([a-z]+)\s+(?:of\s+)?(?:more|extra|additional|new|those|them|these)?\s*(?:[a-z-]+\s+)?$/);
  if (words && WORD_NUM[words[1]] !== undefined) return WORD_NUM[words[1]];
  for (const w of before.split(/\W+/).reverse().slice(0, 4)) if (WORD_NUM[w] !== undefined) return WORD_NUM[w];
  const after = text.slice(idx, idx + 60).match(/(\d+(?:\.\d+)?)\s*(?:feet|ft|lf|linear|sq|square)/i);
  if (after) return Number(after[1]);
  return null;
}

export function matchItems(text: string, sheet: PriceItem[]) {
  const lower = text.toLowerCase();
  const hits = new Map<string, { item: PriceItem; idx: number; kw: string }>();
  for (const item of sheet) {
    for (const kw of item.keywords ?? []) {
      const re = new RegExp(`\\b${kw.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "i");
      const m = re.exec(lower);
      if (m && item.category !== "labor") {
        const prev = hits.get(item.sku);
        if (!prev || m.index < prev.idx) hits.set(item.sku, { item, idx: m.index, kw });
      }
    }
  }
  for (const [sku, losers] of Object.entries(SUPPRESS)) if (hits.has(sku)) losers.forEach((l) => hits.delete(l));
  for (const [sku, extras] of Object.entries(BUNDLE)) if (hits.has(sku)) extras.forEach((e) => hits.delete(e));
  return [...hits.values()];
}


const ADD_RE = /\b(add|adding|more|extra|another|additional|new)\b/i;
const REQUEST_RE = /\b(add|more|extra|another|could|can we|can you|want|would like|we'?d like|we'?d love|love|let'?s|put in|include|get)\b/i;

function titleFor(p: Project, lines: ProposedChangeT["lines"]) {
  const parts: string[] = [];
  const adds = lines.filter((l) => l.action === "add");
  const rems = lines.filter((l) => l.action === "remove");
  for (const a of adds) {
    if (BUNDLE_CHILD.has(a.sku)) continue;
    const it = p.priceSheet.find((x) => x.sku === a.sku)!;
    const swapped = rems.find((r) => FAMILY[r.sku] && FAMILY[r.sku] === FAMILY[a.sku]);
    if (swapped) parts.push(`${shortName(p.priceSheet.find((x) => x.sku === swapped.sku)!)} → ${shortName(it)}`);
    else parts.push(a.qty ? `Add ${a.qty} ${plural(shortName(it).toLowerCase(), a.qty, it.unit)}` : `Add ${plural(shortName(it).toLowerCase(), 2, it.unit)}`);
  }
  for (const r of rems) {
    if (adds.some((a) => FAMILY[a.sku] && FAMILY[a.sku] === FAMILY[r.sku])) continue;
    parts.push(`Remove ${shortName(p.priceSheet.find((x) => x.sku === r.sku)!).toLowerCase()}`);
  }
  return parts.join(" + ") || "Scope change";
}
const BUNDLE_CHILD = new Set(Object.values(BUNDLE).flat());
function plural(n: string, q: number, unit: string) {
  if (unit !== "ea" || q === 1 || n.endsWith("s")) return n;
  return /(ch|sh|x)$/.test(n) ? n + "es" : n + "s";
}

export function offlineAnalyze(p: Project, newMsgs: Message[]): AnalysisResultT {
  const text = newMsgs.map((m) => m.body).join("\n");
  const ids = newMsgs.map((m) => m.id);

  // 1) Does this answer the most recent open question?
  const open = [...p.changeOrders].reverse().find((c) => c.status === "needs_info");
  if (open && text.length < 80) {
    const n = text.match(/\b(\d+)\b/)?.[1] ?? Object.keys(WORD_NUM).find((w) => w.length > 2 && new RegExp(`\\b${w}\\b`, "i").test(text));
    const yes = /\b(yes|yep|yeah|sure|correct|that works|sounds good)\b/i.test(text);
    const qty = n ? (isNaN(Number(n)) ? WORD_NUM[n as string] : Number(n)) : yes ? suggestedQty(open) : null;
    if (qty) {
      const lines = open.lines.map((l) => ({ sku: l.sku, qty: l.qty || qty, action: l.action, note: l.note ?? null }));
      return {
        changes: [
          {
            title: titleFor(p, lines),
            summary: `Client confirmed ${qty}. ${titleFor(p, lines)}, priced from the contractor rate sheet.`,
            lines,
            assumptions: open.assumptions,
            question: null,
            scheduleImpactDays: open.scheduleImpactDays,
            confidence: 0.9,
            updatesChangeOrderNumber: open.number,
            sourceMessageIds: [...open.sourceMessageIds, ...ids],
          },
        ],
      };
    }
  }

  // 2) Each sentence/clause becomes its own change order.
  const changes: ProposedChangeT[] = [];
  const isTranscript = newMsgs.some((m) => m.kind === "transcript");
  const sentences = text
    .split(/(?<=[.!?\n])\s+|\s+(?:and also|also|plus|and can we|and could we)\s+/i)
    .map((s) => s.replace(/^\s*[A-Z][a-z]+:\s*/, ""))
    .filter((s) => !(isTranscript && /\b(on hold|later|not now|maybe next)\b/i.test(s)));

  for (const s of sentences) {
    const isRemove = REMOVE_RE.test(s);
    const isSwap = SWAP_RE.test(s);
    if (!(isRemove || isSwap || REQUEST_RE.test(s))) continue;

    const lines: ProposedChangeT["lines"] = [];
    const assumptions: string[] = [];
    let question: string | null = null;
    let days = 0;

    for (const { item, idx, kw } of matchItems(s, p.priceSheet)) {
      const base = p.agreement.baseline.find((b) => b.sku === item.sku);
      const fam = FAMILY[item.sku];

      if (isRemove) {
        if (!base) continue;
        const q = qtyNear(s, idx) ?? base.qty;
        lines.push({ sku: item.sku, qty: q, action: "remove", note: "Removed from scope · credited at cost" });
        continue;
      }

      if (fam && isSwap) {
        const old = p.agreement.baseline.find((b) => FAMILY[b.sku] === fam && b.sku !== item.sku);
        if (old) {
          const oldItem = p.priceSheet.find((x) => x.sku === old.sku)!;
          lines.push({ sku: old.sku, qty: old.qty, action: "remove", note: `Replaced by ${shortName(item)}` });
          lines.push({ sku: item.sku, qty: old.qty, action: "add", note: `Replaces ${shortName(oldItem)}` });
          assumptions.push(`Same area as original scope (${old.qty} ${item.unit}).`);
          if (fam === "floor") days += 2;
          if (fam === "backsplash") days += 1;
          continue;
        }
      }

      // Items already in scope only count as changes with an explicit "add/more/extra".
      // and the add-word must be close to the item (not "add dimmers for the recessed lights").
      if (base && !ADD_RE.test(s.slice(Math.max(0, idx - 30), idx))) continue;
      if (/\b(for|of|by|over|under|near)\s+the\s+$/i.test(s.slice(Math.max(0, idx - 10), idx))) continue;

      let q = qtyNear(s, idx);
      if (q === null) {
        // Look ahead in the full text, e.g. "...dimmer switches? Two dimmers I think."
        const pos = text.indexOf(s);
        const ahead = text.slice(pos + s.length, pos + s.length + 120);
        const stem = kw.split(" ")[0].slice(0, 5).replace(/[^a-z-]/gi, "");
        const m = ahead.match(new RegExp(`\\b(\\d+|${Object.keys(WORD_NUM).join("|")})\\s+(?:[\\w-]+\\s+)?${stem}`, "i"));
        if (m) q = isNaN(Number(m[1])) ? WORD_NUM[m[1].toLowerCase()] : Number(m[1]);
      }
      if (q === null && item.unit === "ea" && /\b(an?|another|one)\s+(?:[\w-]+\s+){0,2}$/i.test(s.slice(0, idx))) q = 1;
      if (q === null) {
        question ??=
          item.unit === "ea"
            ? `Happy to price that! How many ${plural(shortName(item).toLowerCase(), 2, "ea")} would you like${/island/i.test(s) ? " on the island" : ""}?`
            : `Roughly how many ${item.unit} of ${shortName(item).toLowerCase()} should I price?`;
      }
      lines.push({ sku: item.sku, qty: q ?? 0, action: "add", note: null });
      for (const extra of BUNDLE[item.sku] ?? []) lines.push({ sku: extra, qty: q ?? 0, action: "add", note: "Fixture" });
      if (item.sku.startsWith("EL-")) {
        assumptions.push("Fed from the existing kitchen circuit; no panel upgrade.");
        days += 1;
      }
    }

    if (!lines.length) continue;
    const title = titleFor(p, lines);
    const where = s.match(/\b(on|over|by|at|near|under|along)\s+the\s+([\w-]+(?:\s[\w-]+)?)/i);
    changes.push({
      title,
      summary: question
        ? `${isTranscript ? "From the call" : "Client asked"}: ${s.trim().replace(/\?$/, "")}. Waiting on one detail before pricing.`
        : `${title}${where ? ` ${where[0].toLowerCase()}` : ""}, priced from the contractor's rate sheet${lines.some((l) => l.action === "remove") ? "; removed items are credited at cost" : ""}.`,
      lines,
      assumptions: [...new Set(assumptions)],
      question,
      scheduleImpactDays: days,
      confidence: question ? 0.55 : isTranscript ? 0.78 : 0.86,
      updatesChangeOrderNumber: null,
      sourceMessageIds: ids,
    });
  }
  return { changes };
}

function suggestedQty(co: ChangeOrder) {
  return co.question?.match(/\b(\d+)\b/) ? Number(co.question.match(/\b(\d+)\b/)![1]) : 2;
}

function shortName(i: PriceItem) {
  return i.name.split(/[,(]/)[0].replace(/\s*(installed|material|install)\s*/i, " ").replace(/\s+/g, " ").trim();
}

export function offlineAgreement(p: Project): AgreementDraftT {
  const d = p.description;
  const num = (re: RegExp, dflt: number) => Number(d.match(re)?.[1] ?? dflt);
  const area = num(/(\d+)\s*sq\s*ft/i, 200);
  const baseline: AgreementDraftT["baseline"] = [];
  const add = (sku: string, qty: number) => p.priceSheet.some((x) => x.sku === sku) && qty > 0 && baseline.push({ sku, qty, note: null });
  const has = (re: RegExp) => re.test(d);
  if (has(/floor|lvp|vinyl|porcelain/i)) {
    add("FL-DEMO", area);
    add(has(/oak|hardwood/i) ? "FL-OAK" : has(/porcelain|floor tile/i) ? "FL-TILE" : "FL-LVP", area);
    add("FL-INSTALL", area);
  }
  if (has(/cabinet/i)) {
    add("CB-BASE", num(/(\d+)\s*lf\s*base/i, 16));
    add("CB-UPPER", num(/(\d+)\s*lf\s*upper/i, 12));
    add("CB-HW", 24);
  }
  if (has(/quartz|counter/i)) add("CT-QTZ", num(/countertops?\s*\(~?(\d+)/i, 40));
  if (has(/backsplash/i)) {
    add("BS-SUB", 30);
    add("BS-INSTALL", 30);
  }
  add("EL-OUT", num(/(\d+)\s*(?:standard\s+)?outlets?/i, 0));
  add("EL-GFCI", num(/(\d+)\s*gfci/i, 0));
  add("EL-RECESS", num(/(\d+)\s*recessed/i, 0));
  if (has(/faucet/i)) add("FX-FAUCET", 1);
  if (has(/disposal/i)) add("FX-DISP", 1);
  if (has(/paint/i)) add("PT-WALL", Math.round(area * 2.2));
  if (has(/cabinet|trim|carpentry|island/i)) add("LAB-CARP", 32);
  else add("LAB-GEN", 16);
  add("FE-PERMIT", 1);
  add("FE-DUMP", 1);
  const weeks = num(/(\d+)\s*weeks?/i, 6);
  return {
    title: `${p.name} Agreement`,
    summary: `Fixed-price agreement for ${p.name} at ${p.address}, priced from ${p.contractor.company ?? p.contractor.name}'s rate sheet.`,
    sections: [
      { title: "Scope of Work", body: d },
      { title: "Exclusions", body: "Appliances, structural work, permits beyond the base permit, hazardous material abatement and any work not listed in the scope are excluded unless added by an approved change order." },
      { title: "Change Orders", body: "All changes to scope, materials or quantities are documented in SnapContract and priced from the Contractor's rate sheet plus 10% overhead & profit on added work. Credits for removed work are returned at cost. Change work starts only after the Client approves in chat." },
      { title: "Timeline", body: `Estimated ${weeks} weeks from start. Approved change orders may extend the schedule by the days stated on each change order.` },
      { title: "Warranty", body: "12-month workmanship warranty from final walkthrough; manufacturer warranties apply to materials and fixtures." },
    ],
    baseline,
    payments: [
      { label: "Deposit", pct: 30, trigger: "On signing" },
      { label: "Rough-in complete", pct: 30, trigger: "Electrical & plumbing rough-in inspected" },
      { label: "Substantial completion", pct: 30, trigger: "Finishes installed" },
      { label: "Final walkthrough", pct: 10, trigger: "Punch list complete" },
    ],
    timelineWeeks: weeks,
    changeMarkupPct: 10,
  };
}

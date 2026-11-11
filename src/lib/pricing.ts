import type { ChangeLine, ChangeOrder, LineItem, PriceItem, Project } from "./types";

// All money math lives here. The AI only proposes SKUs and quantities;
// totals are always computed deterministically from the contractor's price sheet.

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function findItem(sheet: PriceItem[], sku: string) {
  return sheet.find((p) => p.sku === sku);
}

export interface PricedLine {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  unitPrice: number;
  qty: number;
  sign: 1 | -1;
  total: number;
  note?: string;
  missing?: boolean;
}

export function priceLine(sheet: PriceItem[], line: LineItem | ChangeLine): PricedLine {
  const item = findItem(sheet, line.sku);
  const sign: 1 | -1 = "action" in line && line.action === "remove" ? -1 : 1;
  const unitPrice = item?.unitPrice ?? 0;
  return {
    id: line.id,
    sku: line.sku,
    name: item?.name ?? `Unknown item (${line.sku})`,
    category: item?.category ?? "material",
    unit: item?.unit ?? "ea",
    unitPrice,
    qty: line.qty,
    sign,
    total: round2(sign * unitPrice * line.qty),
    note: line.note,
    missing: !item,
  };
}

export function baselineTotal(p: Project) {
  return round2(p.agreement.baseline.reduce((s, l) => s + priceLine(p.priceSheet, l).total, 0));
}

export interface ChangeQuote {
  lines: PricedLine[];
  subtotal: number;
  markup: number;
  markupPct: number;
  total: number;
  byCategory: Record<string, number>;
}

export function quoteChange(p: Project, co: Pick<ChangeOrder, "lines">): ChangeQuote {
  const lines = co.lines.map((l) => priceLine(p.priceSheet, l));
  const subtotal = round2(lines.reduce((s, l) => s + l.total, 0));
  const markupPct = p.agreement.changeMarkupPct;
  // Markup only on added work; credits are passed back at cost.
  const addedSubtotal = lines.filter((l) => l.sign > 0).reduce((s, l) => s + l.total, 0);
  const markup = round2((addedSubtotal * markupPct) / 100);
  const byCategory: Record<string, number> = {};
  for (const l of lines) byCategory[l.category] = round2((byCategory[l.category] ?? 0) + l.total);
  return { lines, subtotal, markup, markupPct, total: round2(subtotal + markup), byCategory };
}

export interface BudgetSummary {
  baseline: number;
  approved: number;
  pending: number;
  current: number;
  projected: number;
  approvedCount: number;
  pendingCount: number;
  scheduleDays: number;
}

const SPEND_CATEGORIES = new Set(["material", "fixture"]);

/** Materials and fixtures the contractor actually buys. Labor, install, and fees stay off the card. */
export function materialsSpend(p: Project, co: Pick<ChangeOrder, "lines">) {
  const lines = co.lines.map((l) => priceLine(p.priceSheet, l));
  return round2(lines.filter((l) => l.sign > 0 && SPEND_CATEGORIES.has(l.category)).reduce((s, l) => s + l.total, 0));
}

export interface MilestoneDraw {
  label: string;
  pct: number;
  trigger: string;
  amount: number;
  prior: number;
  delta: number;
  state: "collected" | "next" | "upcoming";
}

function allocateWeighted(total: number, weights: number[]) {
  const weightSum = weights.reduce((s, n) => s + n, 0);
  if (!weights.length || weightSum === 0) return weights.map(() => 0);
  const amounts = weights.map((weight) => round2((total * weight) / weightSum));
  const drift = round2(total - amounts.reduce((s, n) => s + n, 0));
  amounts[amounts.length - 1] = round2(amounts[amounts.length - 1] + drift);
  return amounts;
}

/**
 * Draws follow the contract. The deposit billed at signing stays fixed, and
 * later approved changes land only on the unpaid draws.
 * `collectedContract` is the contract total when that deposit was billed.
 */
export function paymentImpact(payments: { label: string; pct: number; trigger: string }[], contract: number, priorContract: number, depositCollected: boolean, collectedContract?: number) {
  const weights = payments.map((p) => p.pct);
  const freezeDeposit = depositCollected && payments.length > 1;
  const deposit = freezeDeposit ? (allocateWeighted(collectedContract ?? priorContract, weights)[0] ?? 0) : 0;
  const schedule = (total: number) =>
    freezeDeposit ? [deposit, ...allocateWeighted(round2(total - deposit), weights.slice(1))] : allocateWeighted(total, weights);
  const now = schedule(contract);
  const before = schedule(priorContract);
  const milestones: MilestoneDraw[] = payments.map((p, i) => ({
    label: p.label,
    pct: p.pct,
    trigger: p.trigger,
    amount: now[i] ?? 0,
    prior: before[i] ?? 0,
    delta: round2((now[i] ?? 0) - (before[i] ?? 0)),
    state: !depositCollected ? (i === 0 ? "next" : "upcoming") : i === 0 ? "collected" : i === 1 ? "next" : "upcoming",
  }));
  return { milestones, next: milestones.find((m) => m.state === "next") ?? null };
}

export interface ProfitRow {
  id: string;
  number: number;
  title: string;
  status: ChangeOrder["status"];
  cost: number;
  price: number;
  margin: number;
  marginPct: number | null;
  materials: number;
  added: number;
}

function sumRows(rows: ProfitRow[], key: "cost" | "price" | "margin" | "materials" | "added") {
  return round2(rows.reduce((s, r) => s + r[key], 0));
}

/** Rate-sheet cost versus client price. Margin is the O&P added on top of the rate sheet. */
export function profitability(p: Project) {
  const rows: ProfitRow[] = p.changeOrders
    .filter((c) => c.status !== "void" && c.status !== "declined")
    .map((co) => {
      const q = quoteChange(p, co);
      const added = round2(q.lines.filter((l) => l.sign > 0).reduce((s, l) => s + l.total, 0));
      const sell = round2(added + q.markup);
      return {
        id: co.id,
        number: co.number,
        title: co.title,
        status: co.status,
        cost: q.subtotal,
        price: q.total,
        margin: q.markup,
        marginPct: sell > 0 ? round2((q.markup / sell) * 100) : null,
        materials: materialsSpend(p, co),
        added,
      };
    });
  const approved = rows.filter((r) => r.status === "approved");
  const pending = rows.filter((r) => r.status !== "approved");
  const cost = sumRows(approved, "cost");
  const price = sumRows(approved, "price");
  const margin = sumRows(approved, "margin");
  const added = sumRows(approved, "added");
  const sell = round2(added + margin);
  return {
    approved,
    pending,
    totals: {
      cost,
      price,
      margin,
      materials: sumRows(approved, "materials"),
      marginPct: sell > 0 ? round2((margin / sell) * 100) : null,
    },
  };
}

export function budget(p: Project): BudgetSummary {
  const baseline = baselineTotal(p);
  let approved = 0;
  let pending = 0;
  let approvedCount = 0;
  let pendingCount = 0;
  let scheduleDays = 0;
  for (const co of p.changeOrders) {
    const t = quoteChange(p, co).total;
    if (co.status === "approved") {
      approved += t;
      approvedCount++;
      scheduleDays += co.scheduleImpactDays;
    } else if (["needs_info", "contractor_review", "client_review"].includes(co.status)) {
      pending += t;
      pendingCount++;
    }
  }
  approved = round2(approved);
  pending = round2(pending);
  return {
    baseline,
    approved,
    pending,
    current: round2(baseline + approved),
    projected: round2(baseline + approved + pending),
    approvedCount,
    pendingCount,
    scheduleDays,
  };
}

export const money = (n: number, opts: { sign?: boolean; cents?: boolean } = {}) => {
  const s = Math.abs(n).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: opts.cents === false ? 0 : 2,
    maximumFractionDigits: opts.cents === false ? 0 : 2,
  });
  if (n < 0) return `−${s}`;
  return opts.sign ? `+${s}` : s;
};

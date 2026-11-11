import type { RampTransaction } from "./types";

export function rampConfigured() {
  return Boolean(process.env.RAMP_CLIENT_ID && process.env.RAMP_CLIENT_SECRET);
}

export function rampSandbox() {
  return process.env.RAMP_ENV !== "production";
}

function apiHost() {
  return rampSandbox() ? "https://demo-api.ramp.com" : "https://api.ramp.com";
}

let cached: { token: string; until: number } | null = null;

async function accessToken() {
  if (cached && cached.until > Date.now() + 15_000) return cached.token;
  const id = process.env.RAMP_CLIENT_ID;
  const secret = process.env.RAMP_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Ramp is not configured");
  const res = await fetch(`${apiHost()}/developer/v1/token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "funds:write funds:read users:read transactions:read",
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: { message?: string }; error_v2?: { message?: string } };
  if (!res.ok || !body.access_token) {
    throw new Error(body.error_v2?.message || body.error?.message || `Ramp auth failed (${res.status})`);
  }
  cached = { token: body.access_token, until: Date.now() + (body.expires_in ?? 3600) * 1000 };
  return body.access_token;
}

async function rampFetch(path: string, init: RequestInit = {}) {
  const token = await accessToken();
  const res = await fetch(`${apiHost()}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const text = await res.text();
  const body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!res.ok) {
    const err = body.error_v2 as { message?: string } | undefined;
    const alt = body.error as { message?: string } | undefined;
    throw new Error(err?.message || alt?.message || `Ramp request failed (${res.status})`);
  }
  return body;
}

async function cardholderId() {
  if (process.env.RAMP_USER_ID) return process.env.RAMP_USER_ID;
  const body = await rampFetch("/developer/v1/users?page_size=2");
  const data = body.data as { id?: string }[] | undefined;
  const id = data?.[0]?.id;
  if (!id) throw new Error("Ramp has no users to own the card. Set RAMP_USER_ID.");
  return id;
}

export interface IssuedFund {
  fundId: string;
  cardId?: string;
  last4: string;
}

/** Create a one-time Ramp fund and the virtual card attached to it. Does not request or store a PAN. */
export async function issueMaterialsFund(opts: { displayName: string; amount: number; idempotencyKey: string }): Promise<IssuedFund> {
  const userId = await cardholderId();
  const cents = Math.max(1, Math.round(opts.amount * 100));
  const body = await rampFetch("/developer/v1/funds", {
    method: "POST",
    headers: { "X-Idempotency-Key": opts.idempotencyKey.slice(0, 255) },
    body: JSON.stringify({
      user_id: userId,
      display_name: opts.displayName.slice(0, 80),
      permitted_spend_types: { virtual_card: true, physical_card: false, reimbursements: false },
      spending_restrictions: {
        interval: "TOTAL",
        limit: { amount: cents, currency_code: "USD" },
      },
    }),
  });
  const cards = (body.cards as { card_id?: string; id?: string; last_four?: string; last4?: string }[] | undefined) ?? [];
  const card = cards[0];
  const fundId = String(body.id ?? "");
  if (!fundId) throw new Error("Ramp did not return a fund id");
  return { fundId, cardId: card?.card_id ?? card?.id, last4: card?.last_four ?? card?.last4 ?? "····" };
}

function txnAmount(raw: Record<string, unknown>) {
  const entity = raw.entity_amount as { value?: string | number } | undefined;
  if (entity?.value != null && entity.value !== "") {
    const minor = Number(entity.value);
    if (Number.isFinite(minor)) return Math.round(Math.abs(minor)) / 100;
  }
  const amount = Number(raw.amount);
  if (!Number.isFinite(amount)) return 0;
  return Math.abs(amount) >= 1000 && Number.isInteger(amount) ? amount / 100 : Math.abs(amount);
}

export async function fundTransactions(fundId: string, cardId?: string): Promise<RampTransaction[]> {
  const body = await rampFetch("/developer/v1/transactions?page_size=50");
  const data = (body.data as Record<string, unknown>[] | undefined) ?? [];
  return data
    .filter((t) => t.limit_id === fundId || (cardId && t.card_id === cardId))
    .map((t) => ({
      id: String(t.id ?? ""),
      amount: txnAmount(t),
      merchant: String(t.merchant_name ?? t.merchant_descriptor ?? "Ramp"),
      at: String(t.user_transaction_time ?? t.accounting_date ?? new Date().toISOString()),
      state: String(t.state ?? ""),
    }))
    .filter((t) => t.id);
}

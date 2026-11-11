import type { NextRequest } from "next/server";
import { handleWebhook, validSignature, verifyChallenge } from "@/lib/channels/whatsapp";

// Meta calls GET once to verify the webhook, then POSTs every incoming message.
export async function GET(req: NextRequest) {
  const challenge = verifyChallenge(req.nextUrl.searchParams);
  return challenge ? new Response(challenge) : new Response("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get("x-hub-signature-256"))) return new Response("Bad signature", { status: 401 });
  try {
    await handleWebhook(JSON.parse(raw));
  } catch (e) {
    console.error("[whatsapp] webhook", e);
  }
  return new Response("ok"); // always 200 so Meta doesn't retry-storm
}

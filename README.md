# SnapContract

An AI agent that sits in the contractor–client conversation, catches scope changes in texts, voice notes and call transcripts, prices them from the contractor's rate sheet, and gets them approved before the budget and invoice update.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

**AI provider** (set in `.env.local`, see `.env.local.example`), picked in this order:
1. `ANTHROPIC_API_KEY=...` → Claude (`claude-opus-5-5`), best quality.
2. `LOCAL_MODEL=qwen2.5:7b` → a local model through Ollama (`ollama pull qwen2.5:7b`). Free and private; ~5–13 s per chat message and ~45 s to draft an agreement on a 16 GB Mac.
3. Neither → a built-in offline engine tuned to the demo phrases.

If a model call fails or returns invalid JSON, the app falls back to the offline engine, so the demo never dead-ends. The header badge shows which provider is active.

Every model proposal passes through `src/lib/ai/guardrails.ts` before it becomes a change order: only rate-sheet SKUs, swaps always credit the old material, installed items include their fixture, quantities are never invented (the agent asks), replies attach to the open change order, and drafted baselines only include items named in the scope.

## Demo script (≈2 min)

1. Open **Open live demo** → toggle **Split view** (contractor and client phones side by side + live budget).
2. Client: *"Could we add a couple more outlets on the island?"* → agent drafts CO-2 (+$363, priced from rates + 10% O&P). The client sees "contractor is reviewing"; pricing stays private until it's sent.
3. Contractor: **Adjust** (optional) → **Send to Priya**.
4. Client: **Approve** → type signature → confetti; budget, schedule and invoice v3 update live.
5. Ambiguous ask: *"Let's add some pendant lights over the island"* → agent asks "How many?" → client replies "3" → CO is completed.
6. Swap: *"switch the flooring to white oak instead"* → credit for LVP, add oak at the same sq ft.
7. 📄 **Share a call transcript** → "Use sample call" → agent finds several separate changes and ignores the item that's "on hold".
8. 🎙 Mic button records a voice note (Chrome speech recognition) and sends it as a transcribed note.
9. **New project** → AI drafts the agreement from a plain-English scope + rate sheet → both parties sign → agent starts listening.

Reset demo data with the ↻ button in the header.

## How it's built

- Next.js 16 (App Router) + Tailwind 4 + framer-motion, JSON file store in `.data/db.json`.
- `src/lib/pricing.ts` does **all money math**: the AI only proposes SKUs and quantities from the rate sheet.
- `src/lib/ai/agents.ts`: two Claude agents (`claude-opus-5-5`, structured outputs via Zod):
  - **Contract drafter** → scope sections, priced baseline, payment schedule, change policy.
  - **Change detector** → `{changes: [{lines, question, updatesChangeOrderNumber, …}]}` per new message.
- `src/lib/ai/offline.ts`: deterministic fallback used when there's no API key or the call fails.
- `src/lib/actions.ts`: server reducer for every action (post message, send/approve/decline CO, sign agreement…) plus a per-project agent queue.
- Change order lifecycle: `needs_info → contractor_review → client_review → approved | declined | void`, with a full audit trail.

import { listProjects } from "@/lib/db";
import { createProject } from "@/lib/actions";
import { budget } from "@/lib/pricing";
import { aiProvider } from "@/lib/ai/claude";

export async function GET() {
  const projects = listProjects().map((p) => ({
    id: p.id,
    name: p.name,
    address: p.address,
    client: p.client.name,
    contractor: p.contractor,
    status: p.agreement.status,
    budget: budget(p),
    changeCount: p.changeOrders.filter((c) => c.status !== "void").length,
    needsAttention: p.changeOrders.filter((c) => ["needs_info", "contractor_review", "client_review"].includes(c.status)).length,
    lastMessage: p.messages.at(-1)?.createdAt ?? p.createdAt,
  }));
  return Response.json({ projects, ai: aiProvider() });
}

export async function POST(req: Request) {
  const body = await req.json();
  if (!body.name || !body.description) return Response.json({ error: "Name and description required" }, { status: 400 });
  const p = createProject(body);
  return Response.json({ project: p });
}

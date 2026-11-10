import fs from "node:fs";
import path from "node:path";
import type { Project } from "./types";
import { demoProject } from "./seed";
import { baselineTotal, budget, quoteChange } from "./pricing";

// Tiny JSON-file store. Good enough for a hackathon demo, survives dev-server reloads.
const FILE = path.join(process.cwd(), ".data", "db.json");

interface DB {
  projects: Record<string, Project>;
}

const g = globalThis as unknown as { __snapdb?: DB };

function seedDb(): DB {
  const demo = demoProject();
  // Fill in computed totals for the seeded history.
  for (const co of demo.changeOrders) {
    if (co.approval) co.approval.total = quoteChange(demo, co).total;
  }
  demo.invoices[0].total = baselineTotal(demo);
  demo.invoices[1].total = budget(demo).current;
  return { projects: { [demo.id]: demo } };
}

function load(): DB {
  if (g.__snapdb) return g.__snapdb;
  try {
    g.__snapdb = JSON.parse(fs.readFileSync(FILE, "utf8")) as DB;
  } catch {
    g.__snapdb = seedDb();
    persist();
  }
  return g.__snapdb!;
}

function persist() {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(g.__snapdb, null, 2));
  } catch (e) {
    console.error("persist failed", e);
  }
}

export function listProjects(): Project[] {
  return Object.values(load().projects).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getProject(id: string): Project | undefined {
  return load().projects[id];
}

export function saveProject(p: Project) {
  load().projects[p.id] = p;
  persist();
  return p;
}

export function mutate(id: string, fn: (p: Project) => void): Project {
  const p = getProject(id);
  if (!p) throw new Error("Project not found");
  fn(p);
  persist();
  return p;
}

export function resetDb() {
  g.__snapdb = seedDb();
  persist();
}

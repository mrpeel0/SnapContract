"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Project } from "@/lib/types";
import type { Action } from "@/lib/actions";

export interface Integrations {
  telegram: {
    enabled: boolean;
    username: string | null;
    links: { contractor: string; client: string } | null;
    contractorLinked: boolean;
    clientLinked: boolean;
  };
  ramp: { enabled: boolean; sandbox: boolean };
}

export function useProject(id: string) {
  const [project, setProject] = useState<Project | null>(null);
  const [ai, setAi] = useState<"claude" | "local" | null>(null);
  const [integrations, setIntegrations] = useState<Integrations | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    try {
      const r = await fetch(`/api/projects/${id}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setProject(j.project);
      setAi(j.ai);
      if (j.integrations) setIntegrations(j.integrations);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    const t = setInterval(refresh, 1200);
    return () => clearInterval(t);
  }, [refresh]);

  const act = useCallback(
    async (action: Action) => {
      busy.current = true;
      try {
        const r = await fetch(`/api/projects/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(action) });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        setProject(j.project);
        if (j.integrations) setIntegrations(j.integrations);
        return j.project as Project;
      } finally {
        busy.current = false;
      }
    },
    [id],
  );

  return { project, ai, integrations, error, act, refresh };
}

export type Act = ReturnType<typeof useProject>["act"];

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { authMessage } from "./errors";
import type { Bootstrap } from "../types";

export function useDay(
  workspaceId: string | null,
  date: string,
  from: string,
  to: string,
) {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  const load = useCallback(
    async (quiet = false) => {
      if (!workspaceId) return;
      const id = ++requestId.current;
      if (!quiet) setLoading(true);
      try {
        const params = new URLSearchParams({ date, from, to, workspace: workspaceId });
        const next = await api<Bootstrap>(`/bootstrap?${params.toString()}`);
        if (requestId.current !== id) return;
        setData(next);
        setError("");
      } catch (caught) {
        if (requestId.current !== id) return;
        setError(authMessage(caught));
      } finally {
        if (requestId.current === id) setLoading(false);
      }
    },
    [workspaceId, date, from, to],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") void load(true);
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);

  return { data, loading, error, reload: load };
}

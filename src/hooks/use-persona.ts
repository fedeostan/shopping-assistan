"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { UserPersona, InteractionRecord, PersonaSignal } from "@/lib/persona/types";
import { getConfidenceLabel } from "@/lib/persona/engine";

interface PersonaState {
  persona: UserPersona | null;
  confidenceScore: number;
  confidenceLabel: string;
  isLoading: boolean;
}

/**
 * Fire-and-forget POST to record an interaction.
 */
function postInteraction(
  type: InteractionRecord["type"],
  payload: Record<string, unknown>,
  personaSignals?: PersonaSignal[],
) {
  fetch("/api/persona/interaction", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, payload, personaSignals }),
  }).catch(console.error);
}

/**
 * Full persona hook — fetches persona on mount and exposes recording.
 */
export function usePersona() {
  const [state, setState] = useState<PersonaState>({
    persona: null,
    confidenceScore: 0,
    confidenceLabel: getConfidenceLabel(0),
    isLoading: true,
  });

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    let ignore = false;
    (async () => {
      try {
        const res = await fetch("/api/profile/persona");
        if (ignore) return;
        if (!res.ok) {
          setState((s) => ({ ...s, isLoading: false }));
          return;
        }
        const data = await res.json();
        if (ignore) return;
        setState({
          persona: data.persona,
          confidenceScore: data.confidenceScore,
          confidenceLabel: data.confidenceLabel,
          isLoading: false,
        });
      } catch {
        if (!ignore) setState((s) => ({ ...s, isLoading: false }));
      }
    })();
    return () => { ignore = true; isMounted.current = false; };
  }, []);

  const refreshPersona = useCallback(async () => {
    try {
      const res = await fetch("/api/profile/persona");
      if (!res.ok) return;
      const data = await res.json();
      if (isMounted.current) {
        setState({
          persona: data.persona,
          confidenceScore: data.confidenceScore,
          confidenceLabel: data.confidenceLabel,
          isLoading: false,
        });
      }
    } catch { /* ignore */ }
  }, []);

  const recordInteraction = useCallback(
    (type: InteractionRecord["type"], payload: Record<string, unknown>, signals?: PersonaSignal[]) => {
      postInteraction(type, payload, signals);
    },
    [],
  );

  return {
    ...state,
    refreshPersona,
    recordInteraction,
  };
}

/**
 * Lightweight hook — only exposes recordInteraction, no persona fetch.
 * Use in components like ProductCard that only need to record clicks.
 */
export function useRecordInteraction() {
  const recordInteraction = useCallback(
    (type: InteractionRecord["type"], payload: Record<string, unknown>, signals?: PersonaSignal[]) => {
      postInteraction(type, payload, signals);
    },
    [],
  );

  return { recordInteraction };
}

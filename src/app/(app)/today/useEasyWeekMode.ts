"use client";

import { useCallback, useEffect, useState } from "react";

const EVENT_NAME = "easy-week-changed";

function storageKey(programId: string) {
  return `easy-week-active-${programId}`;
}

function readActive(programId: string): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(storageKey(programId)) === "1";
}

export function useEasyWeekMode(programId: string | undefined) {
  const [active, setActive] = useState(false);

  // Sync from localStorage on mount (client only)
  useEffect(() => {
    if (!programId) return;
    setActive(readActive(programId));

    function onChanged(e: Event) {
      const detail = (e as CustomEvent<string>).detail;
      if (detail === programId) setActive(readActive(programId));
    }
    window.addEventListener(EVENT_NAME, onChanged);
    return () => window.removeEventListener(EVENT_NAME, onChanged);
  }, [programId]);

  const toggle = useCallback(() => {
    if (!programId) return;
    const next = !readActive(programId);
    if (next) {
      localStorage.setItem(storageKey(programId), "1");
    } else {
      localStorage.removeItem(storageKey(programId));
    }
    setActive(next);
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: programId }));
  }, [programId]);

  return { active, toggle };
}

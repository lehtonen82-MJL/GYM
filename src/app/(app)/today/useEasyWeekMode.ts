"use client";

import { useCallback, useSyncExternalStore } from "react";

const EVENT_NAME = "easy-week-changed";

function storageKey(programId: string) {
  return `easy-week-active-${programId}`;
}

function readActive(programId: string): boolean {
  return localStorage.getItem(storageKey(programId)) === "1";
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT_NAME, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT_NAME, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Whether Easy Week is switched on for a program, kept in localStorage (false while server rendering). */
export function useEasyWeekMode(programId: string | undefined) {
  const active = useSyncExternalStore(
    subscribe,
    () => (programId ? readActive(programId) : false),
    () => false
  );

  const toggle = useCallback(() => {
    if (!programId) return;
    if (readActive(programId)) {
      localStorage.removeItem(storageKey(programId));
    } else {
      localStorage.setItem(storageKey(programId), "1");
    }
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: programId }));
  }, [programId]);

  return { active, toggle };
}

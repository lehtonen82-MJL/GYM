"use client";

import { createContext, useContext, useSyncExternalStore } from "react";

export type NavPosition = "bottom" | "top";

type Settings = {
  navPosition: NavPosition;
  debugBorders: boolean;
  /** Easy Week: percentage of weight to use (e.g. 80 = 80%) */
  deloadWeightPct: number;
  /** Easy Week: percentage of sets to keep (e.g. 50 = half) */
  deloadSetPct: number;
};

type SettingsContextType = Settings & {
  setNavPosition: (pos: NavPosition) => void;
  setDebugBorders: (on: boolean) => void;
  setDeloadWeightPct: (pct: number) => void;
  setDeloadSetPct: (pct: number) => void;
};

const STORAGE_KEY = "gym-app-settings";

const defaults: Settings = {
  navPosition: "bottom",
  debugBorders: false,
  deloadWeightPct: 80,
  deloadSetPct: 50,
};

function loadSettings(): Settings {
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
}

function saveSettings(s: Settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {}
}

let currentSettings: Settings = defaults;
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  currentSettings = loadSettings();
}

function emitChange() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return currentSettings;
}

function getServerSnapshot() {
  return defaults;
}

const SettingsContext = createContext<SettingsContextType>({
  ...defaults,
  setNavPosition: () => {},
  setDebugBorders: () => {},
  setDeloadWeightPct: () => {},
  setDeloadSetPct: () => {},
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const settings = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function setNavPosition(navPosition: NavPosition) {
    currentSettings = { ...currentSettings, navPosition };
    saveSettings(currentSettings);
    emitChange();
  }

  function setDebugBorders(debugBorders: boolean) {
    currentSettings = { ...currentSettings, debugBorders };
    saveSettings(currentSettings);
    emitChange();
  }

  function setDeloadWeightPct(deloadWeightPct: number) {
    currentSettings = { ...currentSettings, deloadWeightPct };
    saveSettings(currentSettings);
    emitChange();
  }

  function setDeloadSetPct(deloadSetPct: number) {
    currentSettings = { ...currentSettings, deloadSetPct };
    saveSettings(currentSettings);
    emitChange();
  }

  return (
    <SettingsContext.Provider value={{ ...settings, setNavPosition, setDebugBorders, setDeloadWeightPct, setDeloadSetPct }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}

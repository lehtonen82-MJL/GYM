"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type NavPosition = "bottom" | "top";

type Settings = {
  navPosition: NavPosition;
};

type SettingsContextType = Settings & {
  setNavPosition: (pos: NavPosition) => void;
};

const STORAGE_KEY = "gym-app-settings";

const defaults: Settings = {
  navPosition: "bottom",
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

const SettingsContext = createContext<SettingsContextType>({
  ...defaults,
  setNavPosition: () => {},
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaults);

  // Load from localStorage after hydration
  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  function setNavPosition(navPosition: NavPosition) {
    const next = { ...settings, navPosition };
    setSettings(next);
    saveSettings(next);
  }

  return (
    <SettingsContext.Provider value={{ ...settings, setNavPosition }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}

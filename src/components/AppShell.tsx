"use client";

import { useSettings } from "@/lib/settings";
import BottomNav from "@/components/BottomNav";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { navPosition } = useSettings();
  const isTop = navPosition === "top";

  return (
    <div className="flex flex-col min-h-screen">
      {isTop && <BottomNav />}
      <main
        className={`flex-1 max-w-lg mx-auto w-full px-4 pt-4 ${
          isTop ? "pt-16" : "pb-16"
        }`}
      >
        {children}
      </main>
      {!isTop && <BottomNav />}
    </div>
  );
}

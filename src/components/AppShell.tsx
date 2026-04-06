"use client";

import { usePathname } from "next/navigation";
import { useSettings } from "@/lib/settings";
import BottomNav from "@/components/BottomNav";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { navPosition, debugBorders } = useSettings();
  const isTop = navPosition === "top";

  return (
    <div className={`flex flex-col min-h-screen ${debugBorders ? "[&_div]:outline [&_div]:outline-1 [&_div]:outline-lime-500/40 [&_section]:outline [&_section]:outline-1 [&_section]:outline-cyan-500/40 [&_button]:outline [&_button]:outline-1 [&_button]:outline-red-500/60 [&_textarea]:outline [&_textarea]:outline-2 [&_textarea]:outline-orange-400" : ""}`}>
      {isTop && <BottomNav />}
      <main
        className={`flex-1 max-w-lg mx-auto w-full px-4 pt-4 ${
          isTop ? "pt-16" : "pb-16"
        }`}
      >
        <div key={pathname} className="page-transition">
          {children}
        </div>
      </main>
      {!isTop && <BottomNav />}
    </div>
  );
}

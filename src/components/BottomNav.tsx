"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSettings } from "@/lib/settings";

const tabs = [
  { href: "/today",    label: "Today",    icon: "💪" },
  { href: "/history",  label: "History",  icon: "📋" },
  { href: "/progress", label: "Progress", icon: "📈" },
  { href: "/programs", label: "Programs", icon: "🗂️" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { navPosition } = useSettings();

  useEffect(() => {
    for (const tab of tabs) {
      if (!pathname.startsWith(tab.href)) {
        router.prefetch(tab.href);
      }
    }
  }, [pathname, router]);

  // Hide nav during active workout or in program builder
  const inWorkout = pathname.startsWith("/workout/");
  const inProgramEditor =
    pathname.includes("/programs/") &&
    (pathname.includes("/edit") || pathname.includes("/new") || pathname.includes("/import"));

  if (inWorkout || inProgramEditor) return null;

  const isTop = navPosition === "top";

  return (
    <nav
      className={`fixed left-0 right-0 bg-card z-50 ${
        isTop
          ? "top-0 border-b border-border pt-[env(safe-area-inset-top)]"
          : "bottom-0 border-t border-border pb-[env(safe-area-inset-bottom)]"
      }`}
    >
      <div className="flex justify-around items-center h-14 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              prefetch
              className={`flex flex-col items-center justify-center flex-1 py-1 text-xs ${
                active ? "text-accent" : "text-muted"
              }`}
            >
              <span className="text-xl">{tab.icon}</span>
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/today", label: "Today", icon: "💪" },
  { href: "/history", label: "History", icon: "📋" },
  { href: "/progress", label: "Progress", icon: "📈" },
];

export default function BottomNav() {
  const pathname = usePathname();

  // Hide nav during active workout
  if (pathname.startsWith("/workout/")) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 pb-[env(safe-area-inset-bottom)] z-50">
      <div className="flex justify-around items-center h-14 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center justify-center flex-1 py-1 text-xs ${
                active ? "text-blue-500" : "text-zinc-500"
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

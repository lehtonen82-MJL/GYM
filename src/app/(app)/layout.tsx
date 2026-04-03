import BottomNav from "@/components/BottomNav";
import { SettingsProvider } from "@/lib/settings";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SettingsProvider>
      <AppShell>{children}</AppShell>
    </SettingsProvider>
  );
}

// Inner shell reads settings (client context), wraps layout
import AppShell from "@/components/AppShell";

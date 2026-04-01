import BottomNav from "@/components/BottomNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen pb-16">
      <main className="flex-1 max-w-lg mx-auto w-full px-4 pt-4">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}

import { BottomNav, MobileTopBar, Sidebar } from "@/components/app/nav";
import { requireUser } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <div className="min-h-dvh">
      <Sidebar />
      <MobileTopBar />
      <main className="mx-auto w-full max-w-4xl px-5 pb-28 pt-6 sm:px-8 sm:pt-10 lg:ml-64 lg:pl-10 lg:max-w-none lg:px-12 lg:pb-16 xl:px-16">
        <div className="mx-auto max-w-4xl">{children}</div>
      </main>
      <BottomNav />
    </div>
  );
}

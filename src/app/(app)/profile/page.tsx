import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { signOut } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Profil" };

export default async function ProfilePage() {
  const { user, supabase } = await requireUser();
  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
  return (
    <>
      <PageHeader title="Profil" />
      <Card>
        <p className="text-sm text-muted">Inloggad som</p>
        <p className="mt-1 font-semibold text-ink">{user.email}</p>
        <div className="mt-6">
          <ProfileForm initialName={profile?.display_name ?? ""} />
        </div>
      </Card>
      <form action={signOut} className="mt-6">
        <Button type="submit" variant="secondary" size="lg">
          <LogOut /> Logga ut
        </Button>
      </form>
    </>
  );
}

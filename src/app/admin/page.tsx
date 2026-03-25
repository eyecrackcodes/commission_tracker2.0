import { auth } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/admin";
import AdminDashboard from "@/components/AdminDashboard";

export default async function AdminPage() {
  const { userId } = auth();

  if (!userId) {
    redirect("/");
  }

  const { data: profile } = await supabaseAdmin
    .from("agent_profiles")
    .select("role")
    .eq("user_id", userId)
    .single();

  if (!profile || profile.role !== "admin") {
    redirect("/dashboard");
  }

  return <AdminDashboard />;
}

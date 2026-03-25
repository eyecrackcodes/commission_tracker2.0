import { auth } from "@clerk/nextjs";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function requireAdmin(): Promise<
  { userId: string } | { error: string; status: number }
> {
  const { userId } = auth();

  if (!userId) {
    return { error: "Unauthorized", status: 401 };
  }

  const { data: profile, error } = await supabaseAdmin
    .from("agent_profiles")
    .select("role")
    .eq("user_id", userId)
    .single();

  if (error || !profile || profile.role !== "admin") {
    return { error: "Forbidden", status: 403 };
  }

  return { userId };
}

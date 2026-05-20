import { auth } from "@clerk/nextjs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedAdminClient: SupabaseClient | null = null;

/**
 * Lazily build the Supabase admin client. Throws a descriptive error
 * inside the handler (not at module load) when env vars are missing,
 * so a misconfigured deploy returns a 500 JSON response instead of
 * crashing the serverless function.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (cachedAdminClient) return cachedAdminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  cachedAdminClient = createClient(url, serviceKey);
  return cachedAdminClient;
}

/**
 * Back-compat proxy. Existing imports of `supabaseAdmin` keep working
 * but the underlying client is created on first property access, so
 * module load no longer throws when env vars are absent.
 */
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseAdmin();
    const value = (client as unknown as Record<string | symbol, unknown>)[
      prop as string | symbol
    ];
    return typeof value === "function" ? (value as Function).bind(client) : value;
  },
});

export async function requireAdmin(): Promise<
  { userId: string } | { error: string; status: number }
> {
  const { userId } = auth();

  if (!userId) {
    return { error: "Unauthorized", status: 401 };
  }

  const { data: profile, error } = await getSupabaseAdmin()
    .from("agent_profiles")
    .select("role")
    .eq("user_id", userId)
    .single();

  if (error || !profile || profile.role !== "admin") {
    return { error: "Forbidden", status: 403 };
  }

  return { userId };
}

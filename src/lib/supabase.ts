import { createClient } from "@supabase/supabase-js";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_URL");
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

// Create a single supabase client for interacting with your database
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Prefer: "return=representation",
      },
    },
  }
);

export type Policy = {
  id: number;
  user_id: string;
  client: string;
  carrier: string;
  policy_number: string;
  product: string;
  policy_status: string;
  commissionable_annual_premium: number;
  commission_rate: number;
  commission_due: number;
  first_payment_date: string | null;
  type_of_payment: string | null;
  inforce_date: string | null;
  date_policy_verified: string | null;
  comments: string | null;
  created_at: string;
  cancelled_date: string | null;
};

export type AgentProfile = {
  id: number;
  user_id: string;
  start_date: string | null;
  license_number: string | null;
  specializations: string[] | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

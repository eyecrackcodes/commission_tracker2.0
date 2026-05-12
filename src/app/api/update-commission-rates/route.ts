import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { differenceInMonths, parseISO } from "date-fns";
import { getCommissionTier, COMMISSION_RATES, REDUCED_TIER_CAP } from "@/lib/carriers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing Supabase URL or service role key");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const PERSISTENCE_MONTHS = 3;

export async function GET() {
  try {
    const { data: policies, error: fetchError } = await supabase
      .from("policies")
      .select("id, carrier, product, commission_rate, commission_tier, persistence_status, policy_status, inforce_date, created_at, cancelled_date, commissionable_annual_premium")
      .in("persistence_status", ["pending"]);

    if (fetchError) throw fetchError;

    const updates: Array<{ id: number; action: string }> = [];
    const now = new Date();

    for (const policy of policies || []) {
      const placementDate = policy.inforce_date || policy.created_at;
      if (!placementDate) continue;

      const monthsSincePlacement = differenceInMonths(now, parseISO(placementDate));

      if (policy.policy_status === "Cancelled" && policy.cancelled_date) {
        const monthsToCancel = differenceInMonths(
          parseISO(policy.cancelled_date),
          parseISO(placementDate)
        );

        if (monthsToCancel < PERSISTENCE_MONTHS) {
          const tier = (policy.commission_tier as "standard" | "reduced") ||
            getCommissionTier(policy.carrier, policy.product);
          const rate = COMMISSION_RATES[tier];
          let chargebackAmount = policy.commissionable_annual_premium * rate;
          if (tier === "reduced") {
            chargebackAmount = Math.min(chargebackAmount, REDUCED_TIER_CAP);
          }

          await supabase
            .from("policies")
            .update({
              persistence_status: "failed",
              chargeback_amount: chargebackAmount,
              chargeback_date: now.toISOString(),
            })
            .eq("id", policy.id);

          updates.push({ id: policy.id, action: "chargeback_applied" });
        }
      } else if (
        monthsSincePlacement >= PERSISTENCE_MONTHS &&
        policy.policy_status !== "Cancelled"
      ) {
        await supabase
          .from("policies")
          .update({ persistence_status: "met" })
          .eq("id", policy.id);

        updates.push({ id: policy.id, action: "persistence_met" });
      }
    }

    return NextResponse.json({
      message: `Processed ${policies?.length || 0} policies, ${updates.length} updated`,
      updates,
    });
  } catch (error) {
    console.error("Error processing persistence check:", error);
    return NextResponse.json(
      { error: "Failed to process persistence check" },
      { status: 500 }
    );
  }
}

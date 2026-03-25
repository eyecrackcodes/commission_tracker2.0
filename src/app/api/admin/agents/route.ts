import { NextResponse } from "next/server";
import { requireAdmin, supabaseAdmin } from "@/lib/admin";

export async function GET() {
  const adminCheck = await requireAdmin();
  if ("error" in adminCheck) {
    return NextResponse.json(
      { error: adminCheck.error },
      { status: adminCheck.status }
    );
  }

  const { data: agents, error } = await supabaseAdmin
    .from("agent_profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: policies } = await supabaseAdmin
    .from("policies")
    .select("user_id, policy_status");

  const policyStats: Record<
    string,
    { total: number; active: number; pending: number; cancelled: number }
  > = {};

  if (policies) {
    for (const p of policies) {
      if (!policyStats[p.user_id]) {
        policyStats[p.user_id] = {
          total: 0,
          active: 0,
          pending: 0,
          cancelled: 0,
        };
      }
      policyStats[p.user_id].total++;
      const status = p.policy_status?.toLowerCase();
      if (status === "active") policyStats[p.user_id].active++;
      else if (status === "pending") policyStats[p.user_id].pending++;
      else if (status === "cancelled") policyStats[p.user_id].cancelled++;
    }
  }

  const enrichedAgents = (agents ?? []).map((agent) => ({
    ...agent,
    policy_stats: policyStats[agent.user_id] || {
      total: 0,
      active: 0,
      pending: 0,
      cancelled: 0,
    },
  }));

  return NextResponse.json(enrichedAgents);
}

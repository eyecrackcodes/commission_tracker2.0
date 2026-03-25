import { NextResponse } from "next/server";
import { requireAdmin, supabaseAdmin } from "@/lib/admin";
import { clerkClient } from "@clerk/nextjs";

export async function POST() {
  const adminCheck = await requireAdmin();
  if ("error" in adminCheck) {
    return NextResponse.json(
      { error: adminCheck.error },
      { status: adminCheck.status }
    );
  }

  const { data: agents, error } = await supabaseAdmin
    .from("agent_profiles")
    .select("id, user_id, first_name, last_name");

  if (error || !agents) {
    return NextResponse.json({ error: "Failed to fetch agents" }, { status: 500 });
  }

  const results: { user_id: string; name: string; status: string }[] = [];

  for (const agent of agents) {
    try {
      const clerkUser = await clerkClient.users.getUser(agent.user_id);
      const firstName = clerkUser.firstName || null;
      const lastName = clerkUser.lastName || null;

      if (firstName !== agent.first_name || lastName !== agent.last_name) {
        await supabaseAdmin
          .from("agent_profiles")
          .update({ first_name: firstName, last_name: lastName })
          .eq("id", agent.id);

        results.push({
          user_id: agent.user_id,
          name: `${firstName || ""} ${lastName || ""}`.trim() || "(no name)",
          status: "updated",
        });
      } else {
        results.push({
          user_id: agent.user_id,
          name: `${firstName || ""} ${lastName || ""}`.trim() || "(no name)",
          status: "unchanged",
        });
      }
    } catch (err) {
      results.push({
        user_id: agent.user_id,
        name: "(clerk error)",
        status: `error: ${err instanceof Error ? err.message : "unknown"}`,
      });
    }
  }

  const updated = results.filter((r) => r.status === "updated").length;
  const errors = results.filter((r) => r.status.startsWith("error")).length;

  return NextResponse.json({
    message: `Synced ${updated} names, ${errors} errors, ${results.length - updated - errors} unchanged`,
    results,
  });
}

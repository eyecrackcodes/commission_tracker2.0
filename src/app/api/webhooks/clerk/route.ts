import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Webhook } from "svix";
import type { WebhookEvent } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

// Force Node.js runtime (svix requires Node crypto)
export const runtime = "nodejs";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing Supabase env vars");
  }
  return createClient(url, serviceKey);
}

export async function POST(request: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    console.error("CLERK_WEBHOOK_SECRET is not set");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  // Get the Svix signature headers
  const headerPayload = headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json(
      { error: "Missing svix headers" },
      { status: 400 }
    );
  }

  // Verify the payload with the Svix headers
  const payload = await request.text();
  let event: WebhookEvent;
  try {
    const wh = new Webhook(secret);
    event = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 401 }
    );
  }

  try {
    if (event.type === "user.created") {
      const supabase = getSupabaseAdmin();
      const { id, first_name, last_name } = event.data;

      // Idempotent: only insert if no existing profile row
      const { data: existing, error: existingErr } = await supabase
        .from("agent_profiles")
        .select("id")
        .eq("user_id", id)
        .maybeSingle();

      if (existingErr) {
        console.error("Error checking existing profile:", existingErr);
        return NextResponse.json(
          { error: "Failed to check existing profile" },
          { status: 500 }
        );
      }

      if (!existing) {
        const today = new Date().toISOString().split("T")[0];
        const { error: insertErr } = await supabase
          .from("agent_profiles")
          .insert({
            user_id: id,
            first_name: first_name || null,
            last_name: last_name || null,
            start_date: today,
          });

        if (insertErr) {
          console.error("Error creating agent profile:", insertErr);
          return NextResponse.json(
            { error: "Failed to create profile" },
            { status: 500 }
          );
        }
      }
    }

    if (event.type === "user.updated") {
      const supabase = getSupabaseAdmin();
      const { id, first_name, last_name } = event.data;

      const { error: updateErr } = await supabase
        .from("agent_profiles")
        .update({
          first_name: first_name || null,
          last_name: last_name || null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", id);

      if (updateErr && updateErr.code !== "PGRST116") {
        console.error("Error updating agent profile:", updateErr);
      }
    }

    return NextResponse.json({ received: true, type: event.type });
  } catch (err) {
    console.error("Error handling webhook:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Webhook handler error" },
      { status: 500 }
    );
  }
}

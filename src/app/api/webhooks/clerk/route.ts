import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing Supabase URL or service role key");
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Webhook secret key from Clerk Dashboard
const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

async function validateRequest(request: Request) {
  const headerPayload = headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return false;
  }

  // Get the body
  const payload = await request.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your secret.
  if (!WEBHOOK_SECRET) {
    throw new Error("Missing Clerk Webhook Secret");
  }

  const wh = new Webhook(WEBHOOK_SECRET);

  try {
    return await wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    });
  } catch (err) {
    console.error("Error verifying webhook:", err);
    return false;
  }
}

export async function POST(request: Request) {
  try {
    // Validate the webhook
    const payload = await validateRequest(request);
    if (!payload) {
      return new Response("Invalid webhook signature", { status: 401 });
    }

    const { type, data } = payload as WebhookEvent;

    // Handle user creation
    if (type === "user.created") {
      console.log("New user created:", data.id);

      // Create agent profile in Supabase
      const { error } = await supabaseAdmin.from("agent_profiles").insert({
        user_id: data.id,
        start_date: new Date().toISOString().split("T")[0], // Today's date
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.error("Error creating agent profile:", error);
        return NextResponse.json(
          { error: "Failed to create agent profile" },
          { status: 500 }
        );
      }

      console.log("Successfully created agent profile for user:", data.id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

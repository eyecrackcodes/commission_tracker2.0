import { Webhook } from "svix";
import { headers } from "next/headers";
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

interface ClerkWebhookEvent {
  data: {
    id: string;
    email_addresses: Array<{
      email_address: string;
      id: string;
      linked_to: unknown[];
      object: string;
      verification: {
        status: string;
        strategy: string;
      };
    }>;
    external_accounts: unknown[];
    external_id: string;
    first_name: string;
    gender: string;
    image_url: string;
    last_name: string;
    last_sign_in_at: number;
    object: string;
    password_enabled: boolean;
    phone_numbers: unknown[];
    primary_email_address_id: string;
    primary_phone_number_id: null;
    primary_web3_wallet_id: null;
    private_metadata: Record<string, unknown>;
    profile_image_url: string;
    public_metadata: Record<string, unknown>;
    two_factor_enabled: boolean;
    unsafe_metadata: Record<string, unknown>;
    created_at: number;
    updated_at: number;
    username: null;
    web3_wallets: unknown[];
  };
  instance_id?: string;
  object: string;
  timestamp: number;
  type: string;
}

async function validateRequest(request: Request) {
  console.log("Validating webhook request...");

  // First, try to get the raw body
  const rawBody = await request.text();
  console.log("Raw request body:", rawBody);

  let payload;
  try {
    payload = JSON.parse(rawBody);
    console.log("Parsed payload:", payload);
  } catch (err) {
    console.error("Error parsing request body:", err);
    return false;
  }

  // Check for Svix headers
  const headerPayload = headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  console.log("Headers:", {
    svix_id: svix_id ? "present" : "missing",
    svix_timestamp: svix_timestamp ? "present" : "missing",
    svix_signature: svix_signature ? "present" : "missing",
  });

  // If this is a test webhook from the Clerk Dashboard (no Svix headers)
  if (!svix_id || !svix_timestamp || !svix_signature) {
    // Validate the test webhook format according to Clerk's documentation
    if (
      payload.type === "user.created" &&
      payload.object === "event" &&
      payload.data?.id &&
      payload.data?.object === "user"
    ) {
      console.log("Valid test webhook detected");
      return payload as ClerkWebhookEvent;
    }
    console.log("Invalid test webhook format:", {
      hasType: payload.type === "user.created",
      isEvent: payload.object === "event",
      hasUserId: !!payload.data?.id,
      isUserObject: payload.data?.object === "user",
    });
    return false;
  }

  // For production webhooks, verify with Svix
  console.log("Production webhook detected, verifying with Svix...");

  if (!WEBHOOK_SECRET) {
    console.error("Missing Clerk Webhook Secret");
    throw new Error("Missing Clerk Webhook Secret");
  }

  const wh = new Webhook(WEBHOOK_SECRET);

  try {
    const result = await wh.verify(rawBody, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    });
    console.log("Svix verification successful");
    return result as ClerkWebhookEvent;
  } catch (err) {
    console.error("Error verifying webhook with Svix:", err);
    return false;
  }
}

export async function POST(request: Request) {
  console.log("Webhook POST request received");

  try {
    // Validate the webhook
    const payload = await validateRequest(request);
    if (!payload) {
      console.error("Webhook validation failed");
      return new Response("Invalid webhook request", { status: 401 });
    }

    console.log("Webhook validated successfully");

    // Handle both Svix and direct Clerk webhook formats
    const type = (payload as ClerkWebhookEvent).type;
    const data = (payload as ClerkWebhookEvent).data;

    console.log("Processing webhook:", {
      type,
      userId: data?.id,
      email: data?.email_addresses?.[0]?.email_address,
      name:
        `${data?.first_name || ""} ${data?.last_name || ""}`.trim() ||
        undefined,
      instanceId: (payload as ClerkWebhookEvent).instance_id,
      timestamp: new Date(
        (payload as ClerkWebhookEvent).timestamp
      ).toISOString(),
    });

    // Handle user creation
    if (type === "user.created") {
      console.log("Processing user.created event for user:", data.id);

      // Check if profile already exists
      const { data: existingProfile, error: checkError } = await supabaseAdmin
        .from("agent_profiles")
        .select("id")
        .eq("user_id", data.id)
        .maybeSingle();

      if (checkError) {
        console.error("Error checking for existing profile:", checkError);
        return NextResponse.json(
          {
            error: "Failed to check for existing profile",
            details: checkError.message,
          },
          { status: 500 }
        );
      }

      if (existingProfile) {
        console.log("Profile already exists for user:", data.id);
        return NextResponse.json({
          success: true,
          message: "Profile already exists",
          profileId: existingProfile.id,
        });
      }

      // Create agent profile in Supabase
      console.log("Creating new agent profile for user:", {
        id: data.id,
        email: data.email_addresses?.[0]?.email_address,
        name:
          `${data.first_name || ""} ${data.last_name || ""}`.trim() ||
          "Unknown",
        created_at: new Date(data.created_at).toISOString(),
      });

      try {
        const { data: newProfile, error } = await supabaseAdmin
          .from("agent_profiles")
          .insert({
            user_id: data.id,
            start_date: new Date(data.created_at).toISOString().split("T")[0], // Use Clerk's user creation date
            created_at: new Date(data.created_at).toISOString(),
            updated_at: new Date(data.updated_at).toISOString(),
          })
          .select()
          .single();

        if (error) {
          console.error("Error creating agent profile:", error);
          return NextResponse.json(
            { error: "Failed to create agent profile", details: error.message },
            { status: 500 }
          );
        }

        console.log("Successfully created agent profile:", newProfile);
        return NextResponse.json({
          success: true,
          message: "Profile created successfully",
          profile: newProfile,
        });
      } catch (profileError) {
        console.error("Exception creating agent profile:", profileError);
        return NextResponse.json(
          { 
            error: "Exception creating agent profile", 
            details: profileError instanceof Error ? profileError.message : String(profileError) 
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true, message: "Webhook processed" });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

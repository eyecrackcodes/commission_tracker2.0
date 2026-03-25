import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/admin";

export async function GET() {
  try {
    const { userId } = auth();

    if (!userId) {
      return NextResponse.json({ isAdmin: false }, { status: 401 });
    }

    const { data: profile, error } = await supabaseAdmin
      .from("agent_profiles")
      .select("role")
      .eq("user_id", userId)
      .single();

    if (error || !profile) {
      return NextResponse.json({ isAdmin: false });
    }

    return NextResponse.json({ isAdmin: profile.role === "admin" });
  } catch {
    return NextResponse.json({ isAdmin: false }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { diagnoseSlackSetup } from "@/lib/slack-server";

export async function GET() {
  try {
    const result = await diagnoseSlackSetup();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in Slack diagnostic:", error);
    return NextResponse.json(
      { error: "Failed to run Slack diagnostic" },
      { status: 500 }
    );
  }
}

// Set runtime to nodejs to avoid edge runtime issues with @clerk/nextjs
export const runtime = "nodejs";

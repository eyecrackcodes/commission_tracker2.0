import { NextResponse } from "next/server";
import { sendSlackMessage } from "@/lib/slack-server";
import { recordNotification } from "@/lib/notification-tracker";

// Define interfaces for error handling
interface SlackError extends Error {
  data?: {
    error?: string;
    needed?: string;
    provided?: string;
  };
}

interface ErrorResponse {
  error: string;
  details?: string;
  fixInstructions?: string;
  diagnosticInfo?: {
    errorType: string;
    channelId?: string;
    botTokenExists?: boolean;
    errorMessage?: string;
    errorData?: unknown;
  };
}

export async function POST(request: Request) {
  try {
    const { type, data } = await request.json();

    let message = "";
    if (type === "commission_rate_change") {
      const { userId, oldRate, newRate, agentName } = data;
      const displayName = agentName || userId;
      message = `🎉 Commission Rate Update for ${displayName}:\nPrevious Rate: ${(
        oldRate * 100
      ).toFixed(1)}%\nNew Rate: ${(newRate * 100).toFixed(1)}%`;
    } else {
      return NextResponse.json(
        { error: "Invalid notification type" },
        { status: 400 }
      );
    }

    const result = await sendSlackMessage(message);

    // Record the notification to prevent duplicates
    if (data.userId) {
      await recordNotification(data.userId);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in Slack notification:", error);
    return NextResponse.json(
      { error: "Failed to send Slack notification" },
      { status: 500 }
    );
  }
}

// Set runtime to nodejs to avoid edge runtime issues with @clerk/nextjs
export const runtime = "nodejs";

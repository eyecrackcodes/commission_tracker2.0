import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs";
import {
  sendPolicyNotification,
  sendQuickPolicyPost,
  testSlackConnection,
} from "@/lib/slack";

export async function POST(request: NextRequest) {
  try {
    const { userId } = auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await clerkClient.users.getUser(userId);

    const body = await request.json();
    const { type, data } = body;

    switch (type) {
      case "policy_notification":
        const success = await sendPolicyNotification(data);
        if (success) {
          return NextResponse.json({
            success: true,
            message: "Policy notification sent to Slack",
          });
        } else {
          return NextResponse.json(
            { error: "Failed to send policy notification" },
            { status: 500 }
          );
        }

      case "quick_post":
        const { carrier, product, premium, acronym = "OCC", userName } = data;
        const quickSuccess = await sendQuickPolicyPost(
          carrier,
          product,
          premium,
          acronym,
          userName,
          user.imageUrl
        );
        if (quickSuccess) {
          return NextResponse.json({
            success: true,
            message: "Quick post sent to Slack",
          });
        } else {
          return NextResponse.json(
            { error: "Failed to send quick post" },
            { status: 500 }
          );
        }

      case "test_connection":
        const testSuccess = await testSlackConnection();
        if (testSuccess) {
          return NextResponse.json({
            success: true,
            message: "Slack connection test successful",
          });
        } else {
          return NextResponse.json(
            { error: "Slack connection test failed" },
            { status: 500 }
          );
        }

      default:
        return NextResponse.json(
          { error: "Invalid notification type" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error in slack-notification API:", error);

    // Check if it's a Slack configuration issue
    if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_CHANNEL_ID) {
      return NextResponse.json(
        {
          error:
            "Slack is not configured. Please set SLACK_BOT_TOKEN and SLACK_CHANNEL_ID environment variables.",
          details: "Configuration missing",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const { userId } = auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Test Slack connection
    const testSuccess = await testSlackConnection();

    return NextResponse.json({
      connected: testSuccess,
      channelId: process.env.SLACK_CHANNEL_ID || "Not configured",
      message: testSuccess
        ? "Slack connection is working"
        : "Slack connection failed",
    });
  } catch (error) {
    console.error("Error testing Slack connection:", error);

    // Check if it's a Slack configuration issue
    if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_CHANNEL_ID) {
      return NextResponse.json(
        {
          connected: false,
          error:
            "Slack is not configured. Please set SLACK_BOT_TOKEN and SLACK_CHANNEL_ID environment variables.",
          channelId: process.env.SLACK_CHANNEL_ID || "Not configured",
          message: "Slack configuration missing",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        connected: false,
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

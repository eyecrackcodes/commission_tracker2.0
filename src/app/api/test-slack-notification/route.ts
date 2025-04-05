import { NextResponse } from "next/server";
import { sendSlackMessage } from "@/lib/slack-server";

export async function GET() {
  try {
    const message = `📈 Test Commission Rate Update!\nAgent's commission rate has been updated from 5% to 20%`;
    const blocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "📈 *Test Commission Rate Update!*",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Agent's commission rate has been updated from *5%* to *20%*`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "_This is a test notification triggered manually._",
        },
      },
    ];

    await sendSlackMessage(message);

    return NextResponse.json({
      success: true,
      message: "Test Slack notification sent successfully",
    });
  } catch (error) {
    console.error("Error sending test Slack notification:", error);
    return NextResponse.json(
      { error: "Failed to send test Slack notification" },
      { status: 500 }
    );
  }
}

// Set runtime to nodejs to avoid edge runtime issues with @clerk/nextjs
export const runtime = "nodejs";

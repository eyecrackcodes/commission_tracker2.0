import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";
import { WebClient } from "@slack/web-api";

// Initialize Slack client only on server-side
const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

export async function POST(request: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { type, data } = body;

    if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_CHANNEL_ID) {
      console.error("Missing Slack environment variables");
      return NextResponse.json(
        { error: "Slack integration not configured" },
        { status: 500 }
      );
    }

    switch (type) {
      case "new_policy":
        await sendPolicyNotification(data.policy, data.user);
        break;
      case "commission_rate_change":
        await sendCommissionRateChangeNotification(
          data.oldRate,
          data.newRate,
          data.user
        );
        break;
      default:
        return NextResponse.json(
          { error: "Invalid notification type" },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error sending Slack notification:", error);
    return NextResponse.json(
      { error: "Failed to send notification" },
      { status: 500 }
    );
  }
}

async function sendPolicyNotification(
  policy: {
    client: string;
    carrier: string;
    policy_number: string;
    commissionable_annual_premium: number;
    commission_rate: number;
  },
  user?: {
    name: string;
    imageUrl?: string;
  }
  ) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blocks: any[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "🎉 *New Policy Added!*",
      },
    },
  ];

  // Add user info section if available
  if (user) {
    blocks.push({
      type: "context",
      elements: [
        ...(user.imageUrl
          ? [
              {
                type: "image",
                image_url: user.imageUrl,
                alt_text: user.name,
              },
            ]
          : []),
        {
          type: "mrkdwn",
          text: `*Agent:* ${user.name}`,
        },
      ],
    });
  }

  // Add policy details
  blocks.push({
    type: "section",
    fields: [
      {
        type: "mrkdwn",
        text: `*Client:*\n${policy.client}`,
      },
      {
        type: "mrkdwn",
        text: `*Carrier:*\n${policy.carrier}`,
      },
      {
        type: "mrkdwn",
        text: `*Policy Number:*\n${policy.policy_number}`,
      },
      {
        type: "mrkdwn",
        text: `*Premium:*\n$${policy.commissionable_annual_premium.toLocaleString()}`,
      },
      {
        type: "mrkdwn",
        text: `*Commission Rate:*\n${policy.commission_rate * 100}%`,
      },
      {
        type: "mrkdwn",
        text: `*Commission Due:*\n$${(
          policy.commissionable_annual_premium * policy.commission_rate
        )
          .toFixed(2)
          .toLocaleString()}`,
      },
    ],
  });

  await slack.chat.postMessage({
    channel: process.env.SLACK_CHANNEL_ID!,
    text: `🎉 New Policy Added!\n*Agent:* ${
      user?.name || "Unknown"
    }\n*Client:* ${policy.client}\n*Carrier:* ${
      policy.carrier
    }\n*Policy Number:* ${policy.policy_number}\n*Premium:* $${
      policy.commissionable_annual_premium
    }\n*Commission Rate:* ${policy.commission_rate * 100}%`,
    blocks: blocks,
  });
}

async function sendCommissionRateChangeNotification(
  oldRate: number,
  newRate: number,
  user?: {
    name: string;
    imageUrl?: string;
  }
  ) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blocks: any[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "📈 *Commission Rate Update!*",
      },
    },
  ];

  // Add user info section if available
  if (user) {
    blocks.push({
      type: "context",
      elements: [
        ...(user.imageUrl
          ? [
              {
                type: "image",
                image_url: user.imageUrl,
                alt_text: user.name,
              },
            ]
          : []),
        {
          type: "mrkdwn",
          text: `*Agent:* ${user.name}`,
        },
      ],
    });
  }

  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `Agent's commission rate has been updated from *${
        oldRate * 100
      }%* to *${newRate * 100}%*`,
    },
  });

  await slack.chat.postMessage({
    channel: process.env.SLACK_CHANNEL_ID!,
    text: `📈 Commission Rate Update!\n${
      user ? `Agent: ${user.name}\n` : ""
    }Agent's commission rate has been updated from ${
      oldRate * 100
    }% to ${newRate * 100}%`,
    blocks: blocks,
  });
} 
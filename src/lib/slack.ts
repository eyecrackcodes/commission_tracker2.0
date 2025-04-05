import { WebClient } from "@slack/web-api";

if (!process.env.SLACK_BOT_TOKEN) {
  throw new Error("Missing SLACK_BOT_TOKEN environment variable");
}

if (!process.env.SLACK_CHANNEL_ID) {
  throw new Error("Missing SLACK_CHANNEL_ID environment variable");
}

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

export async function sendPolicyNotification(policy: {
  client: string;
  carrier: string;
  policy_number: string;
  commissionable_annual_premium: number;
  commission_rate: number;
}) {
  try {
    await slack.chat.postMessage({
      channel: process.env.SLACK_CHANNEL_ID!,
      text: `🎉 New Policy Added!\n*Client:* ${policy.client}\n*Carrier:* ${
        policy.carrier
      }\n*Policy Number:* ${policy.policy_number}\n*Premium:* $${
        policy.commissionable_annual_premium
      }\n*Commission Rate:* ${policy.commission_rate * 100}%`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "🎉 *New Policy Added!*",
          },
        },
        {
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
              text: `*Premium:*\n$${policy.commissionable_annual_premium}`,
            },
            {
              type: "mrkdwn",
              text: `*Commission Rate:*\n${policy.commission_rate * 100}%`,
            },
          ],
        },
      ],
    });
  } catch (error) {
    console.error("Error sending Slack notification:", error);
  }
}

export async function sendCommissionRateChangeNotification(
  oldRate: number,
  newRate: number
) {
  try {
    await slack.chat.postMessage({
      channel: process.env.SLACK_CHANNEL_ID!,
      text: `📈 Commission Rate Update!\nAgent's commission rate has been updated from ${
        oldRate * 100
      }% to ${newRate * 100}%`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "📈 *Commission Rate Update!*",
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `Agent's commission rate has been updated from *${
              oldRate * 100
            }%* to *${newRate * 100}%*`,
          },
        },
      ],
    });
  } catch (error) {
    console.error("Error sending Slack notification:", error);
  }
}

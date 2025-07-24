import { WebClient } from '@slack/web-api';

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

/**
 * Send a quick post to Slack for new policies
 */
export async function sendQuickPost(
  carrier: string,
  premium: number,
  userName?: string,
  userImageUrl?: string,
  customMessage?: string
): Promise<boolean> {
  try {
    if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_CHANNEL_ID) {
      console.error("Slack configuration missing");
      return false;
    }

    const formattedPremium = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(premium);

    // Simple one-line message with premium, carrier, and agent
    const text = `${formattedPremium} • ${carrier}${userName ? ` • ${userName}` : ''}${customMessage ? ` • ${customMessage}` : ''}`;

    // Create block with smaller profile picture
    const blocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: text,
        },
        accessory: userImageUrl
          ? {
              type: "image",
              image_url: userImageUrl,
              alt_text: userName || "Agent",
            }
          : undefined,
      },
    ];

    const result = await slack.chat.postMessage({
      channel: process.env.SLACK_CHANNEL_ID,
      text: text,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      blocks: blocks as any[],
    });

    if (result.ok) {
      console.log("Quick post sent to Slack successfully");
      return true;
    } else {
      console.error("Failed to send quick post:", result.error);
      return false;
    }
  } catch (error) {
    console.error("Error sending quick post:", error);
    return false;
  }
}

/**
 * Send Slack notification for reconciliation discrepancies
 */
export async function sendReconciliationAlert(discrepancies: Array<{
  policyId: number;
  client: string;
  policyNumber: string;
  carrier: string;
  commission: number;
  reason: string;
  status?: string;
}>): Promise<boolean> {
  try {
    if (!process.env.SLACK_BOT_TOKEN) {
      console.error("Slack bot token not configured");
      return false;
    }

    // Use reconciliation channel if available, otherwise fall back to main channel
    const channelId = process.env.SLACK_RECONCILIATION_CHANNEL_ID || process.env.SLACK_CHANNEL_ID;
    if (!channelId) {
      console.error("Slack configuration missing - no channel ID available");
      return false;
    }

    if (!discrepancies || discrepancies.length === 0) {
      console.log("No discrepancies to report");
      return true;
    }

    // Calculate total commission amount
    const totalAmount = discrepancies.reduce((sum, disc) => {
      const amount = Number(disc.commission) || 0;
      return sum + amount;
    }, 0);

    const formattedTotal = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(totalAmount);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blocks: any[] = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "🚨 Commission Reconciliation Alert",
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Found *${discrepancies.length}* ${discrepancies.length === 1 ? 'policy' : 'policies'} with discrepancies totaling *${formattedTotal}*`,
        },
      },
      {
        type: "divider",
      },
    ];

    // Group discrepancies by type for better organization
    const groupedDiscrepancies: {
      verified_but_not_on_spreadsheet: typeof discrepancies;
      missing_commission_notification: typeof discrepancies;
      removal_requests: typeof discrepancies;
    } = {
      verified_but_not_on_spreadsheet: [],
      missing_commission_notification: [],
      removal_requests: []
    };

    discrepancies.forEach(disc => {
      if (disc.reason.startsWith('verified_but_not_on_spreadsheet')) {
        groupedDiscrepancies.verified_but_not_on_spreadsheet.push(disc);
      } else if (disc.reason === 'missing_commission_notification') {
        groupedDiscrepancies.missing_commission_notification.push(disc);
      } else {
        // This is a removal request with the reason being the user's explanation
        groupedDiscrepancies.removal_requests.push(disc);
      }
    });

    // Add each type of discrepancy
    if (groupedDiscrepancies.verified_but_not_on_spreadsheet.length > 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*❌ Verified in App but Missing from Spreadsheet:*`,
        },
      });

      groupedDiscrepancies.verified_but_not_on_spreadsheet.forEach((disc) => {
        const formattedAmount = new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 2,
        }).format(Number(disc.commission) || 0);

        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `• *${disc.client}* (${disc.policyNumber})\n   ${disc.carrier} • ${formattedAmount}`,
          },
        });
      });
    }

    if (groupedDiscrepancies.missing_commission_notification.length > 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*🚨 Agent Reported Missing Commissions:*`,
        },
      });

      groupedDiscrepancies.missing_commission_notification.forEach((disc) => {
        const formattedAmount = new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 2,
        }).format(Number(disc.commission) || 0);

        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `• *${disc.client}* (${disc.policyNumber})\n   ${disc.carrier} • ${formattedAmount}\n   Status: ${disc.status || 'Unknown'}`,
          },
        });
      });
    }

    if (groupedDiscrepancies.removal_requests.length > 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*📝 Policy Removal Requests:*`,
        },
      });

      groupedDiscrepancies.removal_requests.forEach((disc) => {
        const formattedAmount = new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 2,
        }).format(Number(disc.commission) || 0);

        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `• *${disc.client}* (${disc.policyNumber})\n   ${disc.carrier} • ${formattedAmount}\n   *Reason:* ${disc.reason}`,
          },
        });
      });
    }

    // Add action suggestions
    blocks.push(
      {
        type: "divider",
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "📋 *Recommended Actions:*\n" +
                "• Review commission spreadsheet for missing policies\n" +
                "• Update policy statuses in the Commission Tracker\n" +
                "• Contact commission team for discrepancies",
        },
      }
    );

    const result = await slack.chat.postMessage({
      channel: channelId,
      text: `🚨 Commission Reconciliation Alert: ${discrepancies.length} policies need attention (${formattedTotal})`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      blocks: blocks as any[],
    });

    if (result.ok) {
      console.log("Reconciliation alert sent to Slack successfully");
      return true;
    } else {
      console.error("Failed to send reconciliation alert:", result.error);
      return false;
    }
  } catch (error) {
    console.error("Error sending reconciliation alert to Slack:", error);
    return false;
  }
}

/**
 * Send Slack notification for cancelled policy that needs commission removal
 */
export async function sendCancellationCommissionAlert(
  policyNumber: string,
  client: string,
  carrier: string,
  commissionAmount: number,
  cancelledDate: string,
  userName?: string,
  userImageUrl?: string
): Promise<boolean> {
  try {
    if (!process.env.SLACK_BOT_TOKEN) {
      console.error("Slack configuration missing - SLACK_BOT_TOKEN required");
      return false;
    }

    // Use reconciliation channel if available, otherwise fall back to main channel
    const channelId = process.env.SLACK_RECONCILIATION_CHANNEL_ID || process.env.SLACK_CHANNEL_ID;
    if (!channelId) {
      console.error("Slack configuration missing - no channel ID available");
      return false;
    }

    const formattedAmount = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(commissionAmount);

    const formattedDate = new Date(cancelledDate).toLocaleDateString();

    const text = `❌ *Policy Cancellation Alert*\n\n` +
      `Policy needs removal from commission spreadsheet\n\n` +
      `📋 **Policy:** ${policyNumber}\n` +
      `👤 **Client:** ${client}\n` +
      `🏢 **Carrier:** ${carrier}\n` +
      `💰 **Commission:** ${formattedAmount}\n` +
      `📅 **Cancelled:** ${formattedDate}` +
      `${userName ? `\n🏆 **Agent:** ${userName}` : ''}`;

    const result = await slack.chat.postMessage({
      channel: channelId,
      text: text,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: text,
          },
          accessory: userImageUrl
            ? {
                type: "image",
                image_url: userImageUrl,
                alt_text: userName || "User image",
              }
            : undefined,
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "🔧 *Action Required:*\nRemove this policy from the commission spreadsheet to avoid overpayment.",
          },
        },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ] as any[],
    });

    if (result.ok) {
      console.log("Cancellation commission alert sent to Slack successfully");
      return true;
    } else {
      console.error("Failed to send cancellation alert:", result.error);
      return false;
    }
  } catch (error) {
    console.error("Error sending cancellation alert:", error);
    return false;
  }
}

export async function testSlackConnection(): Promise<boolean> {
  try {
    if (!process.env.SLACK_BOT_TOKEN) {
      console.error("SLACK_BOT_TOKEN is not set");
      return false;
    }

    const result = await slack.auth.test();

    if (result.ok) {
      console.log("Slack connection test successful:", result.user);
      return true;
    } else {
      console.error("Slack connection test failed:", result.error);
      return false;
    }
  } catch (error) {
    console.error("Error testing Slack connection:", error);
    return false;
  }
}

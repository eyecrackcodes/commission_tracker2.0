import { WebClient } from '@slack/web-api';

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

// Slack Block Kit types
interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
  };
  accessory?: {
    type: string;
    image_url: string;
    alt_text: string;
  };
}

/**
 * Send a quick post to Slack for new policies
 */
export async function sendQuickPost(
  type: string,
  client: string,
  carrier: string,
  premium: number,
  commission: number,
  userName?: string,
  userImageUrl?: string
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

    const formattedCommission = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(commission);

    let emoji = "📄";
    let typeText = "New Policy";

    switch (type.toLowerCase()) {
      case "life":
        emoji = "❤️";
        typeText = "Life Insurance";
        break;
      case "health":
        emoji = "🏥";
        typeText = "Health Insurance";
        break;
      case "auto":
        emoji = "🚗";
        typeText = "Auto Insurance";
        break;
      case "home":
        emoji = "🏠";
        typeText = "Home Insurance";
        break;
      case "commercial":
        emoji = "🏢";
        typeText = "Commercial Insurance";
        break;
      case "annuity":
        emoji = "💰";
        typeText = "Annuity";
        break;
      case "disability":
        emoji = "🦽";
        typeText = "Disability Insurance";
        break;
      case "long term care":
        emoji = "🏥";
        typeText = "Long Term Care";
        break;
      default:
        emoji = "📄";
        typeText = "New Policy";
    }

    const text = `${emoji} *${typeText} Sale!*\n\n` +
      `Congratulations on your new policy!\n\n` +
      `📋 **Client:** ${client}\n` +
      `🏢 **Carrier:** ${carrier}\n` +
      `💰 **Premium:** ${formattedPremium}\n` +
      `💵 **Commission:** ${formattedCommission}` +
      `${userName ? `\n🏆 **Agent:** ${userName}` : ''}`;

    const blocks: SlackBlock[] = [
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
    ];

    // Only add congratulations block if user info is available
    if (userName) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: "🎉 Keep up the great work!",
        },
      });
    }

    const result = await slack.chat.postMessage({
      channel: process.env.SLACK_CHANNEL_ID,
      text: `${emoji} New ${typeText} sale by ${userName || 'Agent'}: ${client} - ${formattedCommission}`,
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
export async function sendReconciliationAlert(
  discrepancies: Array<{
    policyNumber: string;
    client: string;
    carrier: string;
    commissionAmount: number;
    issueType: 'verified_missing' | 'payment_delay' | 'cancelled_needs_removal';
    daysOverdue: number;
  }>,
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

    const totalAmount = discrepancies.reduce((sum, d) => sum + d.commissionAmount, 0);
    const formattedTotal = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(totalAmount);

    const blocks: SlackBlock[] = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `🚨 *Commission Reconciliation Alert*\n\n` +
                `Found ${discrepancies.length} ${discrepancies.length === 1 ? 'policy' : 'policies'} with discrepancies totaling ${formattedTotal}` +
                `${userName ? `\n\n🏆 **Agent:** ${userName}` : ''}`,
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
        type: "divider",
      },
    ];

    // Show first 5 discrepancies
    discrepancies.slice(0, 5).forEach((discrepancy) => {
      const formattedAmount = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
      }).format(discrepancy.commissionAmount);

      let issueEmoji = "⚠️";
      let issueText = "";

      switch (discrepancy.issueType) {
        case 'verified_missing':
          issueEmoji = "❌";
          issueText = `Verified in app but missing from commission spreadsheet (${discrepancy.daysOverdue} days ago)`;
          break;
        case 'payment_delay':
          issueEmoji = "⏰";
          issueText = `Payment delayed by ${discrepancy.daysOverdue} days`;
          break;
        case 'cancelled_needs_removal':
          issueEmoji = "🚫";
          issueText = `Cancelled policy needs removal from commission spreadsheet`;
          break;
      }

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${issueEmoji} *${discrepancy.client}* (${discrepancy.policyNumber})\n` +
                `${discrepancy.carrier} • ${formattedAmount}\n` +
                `_${issueText}_`,
        },
      });
    });

    // Add "and more" message if there are more than 5
    if (discrepancies.length > 5) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `_... and ${discrepancies.length - 5} more ${discrepancies.length - 5 === 1 ? 'policy' : 'policies'}_`,
        },
      });
    }

    // Add action suggestion
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
    console.error("Error sending reconciliation alert:", error);
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

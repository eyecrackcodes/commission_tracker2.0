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
export async function sendReconciliationAlert(
  discrepancies: Array<{
    policyId: number;
    client: string;
    policyNumber: string;
    carrier: string;
    commission: number;
    reason: string;
    status?: string;
  }>,
  userName?: string,
  userImageUrl?: string
): Promise<boolean> {
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

    // Create simplified messages for each type
    const messages = [];

    if (groupedDiscrepancies.verified_but_not_on_spreadsheet.length > 0) {
      const policies = groupedDiscrepancies.verified_but_not_on_spreadsheet
        .map(disc => `${disc.client} • ${disc.carrier} • ${new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 2,
        }).format(Number(disc.commission) || 0)}`)
        .join('\n');
      
      messages.push(`❌ **Missing from Spreadsheet**\n${policies}`);
    }

    if (groupedDiscrepancies.missing_commission_notification.length > 0) {
      const policies = groupedDiscrepancies.missing_commission_notification
        .map(disc => `${disc.client} • ${disc.carrier} • ${new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 2,
        }).format(Number(disc.commission) || 0)}`)
        .join('\n');
      
      messages.push(`🚨 **Missing Commissions**\n${policies}`);
    }

    if (groupedDiscrepancies.removal_requests.length > 0) {
      const policies = groupedDiscrepancies.removal_requests
        .map(disc => `${disc.client} • ${disc.carrier} • ${disc.reason}`)
        .join('\n');
      
      messages.push(`📝 **Removal Requests**\n${policies}`);
    }

    // Create the main message
    const mainText = `**Commission Reconciliation** • ${formattedTotal}${userName ? ` • ${userName}` : ''}\n\n${messages.join('\n\n')}`;

    // Create block with profile picture
    const blocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: mainText,
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
      channel: channelId,
      text: `Commission Reconciliation: ${discrepancies.length} policies need attention (${formattedTotal})`,
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

/**
 * Send improved reconciliation alert with grouped notifications
 */
export async function sendReconciliationAlertV2(
  groups: Array<{
    type: 'missing_commission' | 'removal_request' | 'reconciliation_complete';
    policies: Array<{
      policyId: number;
      client: string;
      policyNumber: string;
      carrier: string;
      product: string;
      commission: number;
      priority?: 'normal' | 'urgent';
      reason?: string;
      status?: string;
    }>;
    totalAmount: number;
  }>,
  paymentPeriod: string,
  userName?: string,
  userImageUrl?: string
): Promise<boolean> {
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

    if (!groups || groups.length === 0) {
      console.log("No reconciliation groups to report");
      return true;
    }

    const formattedPaymentDate = new Date(paymentPeriod).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Create separate messages for different types
    const results = [];

    for (const group of groups) {
      let message = '';
      let emoji = '';

      switch (group.type) {
        case 'missing_commission':
          emoji = '🚨';
          message = `**Commission Reconciliation Alert**\n\n**Missing/Incorrect Commissions:**\n`;
          
          group.policies.forEach(policy => {
            const priorityFlag = policy.priority === 'urgent' ? ' [URGENT]' : '';
            message += `• ${policy.client} • ${policy.carrier} • ${new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
              minimumFractionDigits: 2,
            }).format(policy.commission)}${priorityFlag}\n`;
          });

          message += `\n**Total Missing: ${new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 2,
          }).format(group.totalAmount)}**\n`;
          break;

        case 'removal_request':
          emoji = '📝';
          message = `**Policy Removal Request**\n\n**Remove from Spreadsheet:**\n`;
          
          group.policies.forEach(policy => {
            message += `• ${policy.client} • ${policy.carrier} • ${new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
              minimumFractionDigits: 2,
            }).format(policy.commission)}\n`;
            if (policy.reason) {
              message += `  *Reason: ${policy.reason}*\n`;
            }
          });

          message += `\n**Total Amount: ${new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 2,
          }).format(group.totalAmount)}**\n`;
          break;

        case 'reconciliation_complete':
          emoji = '✅';
          message = `**Commission Reconciliation Complete**\n\n**Verified Accurate:**\n`;
          message += `• ${group.policies.length} ${group.policies.length === 1 ? 'policy' : 'policies'} confirmed on spreadsheet\n`;
          message += `• **Total Commission: ${new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 2,
          }).format(group.totalAmount)}**\n`;
          break;
      }

      message += `\n**Agent:** ${userName || 'Unknown'}\n**Payment Period:** ${formattedPaymentDate}`;

      // Create the Slack message
      const blocks = [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `${emoji} ${message}`,
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
        channel: channelId,
        text: `${emoji} Reconciliation ${group.type.replace('_', ' ')}`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        blocks: blocks as any[],
      });

      results.push(result.ok);

      if (!result.ok) {
        console.error(`Failed to send ${group.type} alert:`, result.error);
      }
    }

    const allSuccessful = results.every(result => result);
    if (allSuccessful) {
      console.log("All reconciliation alerts sent to Slack successfully");
    }

    return allSuccessful;
  } catch (error) {
    console.error("Error sending reconciliation alert v2:", error);
    return false;
  }
}

import { WebClient } from '@slack/web-api';

// Initialize Slack client
const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

export interface PolicyNotificationData {
  carrier: string;
  product: string;
  premium: number;
  userEmail?: string;
  userName?: string;
}

export async function sendPolicyNotification(data: PolicyNotificationData): Promise<boolean> {
  try {
    if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_CHANNEL_ID) {
      console.error('Slack configuration missing. Please set SLACK_BOT_TOKEN and SLACK_CHANNEL_ID in your environment variables.');
      return false;
    }

    const { carrier, product, premium, userEmail, userName } = data;
    
    // Format premium as currency
    const formattedPremium = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(premium);

    // Create the message
    const message = `🎉 *New Policy Sale!*\n\n` +
      `📋 **Carrier:** ${carrier}\n` +
      `📦 **Product:** ${product}\n` +
      `💰 **Premium:** ${formattedPremium}\n` +
      `${userName ? `🏆 **Agent:** ${userName}` : ''}` +
      `${userEmail ? ` (${userEmail})` : ''}`;

    const result = await slack.chat.postMessage({
      channel: process.env.SLACK_CHANNEL_ID,
      text: message,
      parse: 'full',
    });

    if (result.ok) {
      console.log('Policy notification sent to Slack successfully');
      return true;
    } else {
      console.error('Failed to send Slack notification:', result.error);
      return false;
    }
  } catch (error) {
    console.error('Error sending Slack notification:', error);
    return false;
  }
}

export async function sendQuickPolicyPost(carrier: string, product: string, premium: number, acronym: string = 'OCC', userName?: string): Promise<boolean> {
  try {
    if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_CHANNEL_ID) {
      console.error('Slack configuration missing. Please set SLACK_BOT_TOKEN and SLACK_CHANNEL_ID in your environment variables.');
      return false;
    }

    // Format premium as currency
    const formattedPremium = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(premium);

    // Create a quick message with the acronym and user info
    const agentInfo = userName ? ` - ${userName}` : '';
    const message = `${acronym} - ${carrier} | ${product} | ${formattedPremium}${agentInfo}`;

    const result = await slack.chat.postMessage({
      channel: process.env.SLACK_CHANNEL_ID,
      text: message,
      parse: 'full',
    });

    if (result.ok) {
      console.log('Quick policy post sent to Slack successfully');
      return true;
    } else {
      console.error('Failed to send quick Slack post:', result.error);
      return false;
    }
  } catch (error) {
    console.error('Error sending quick Slack post:', error);
    return false;
  }
}

export async function testSlackConnection(): Promise<boolean> {
  try {
    if (!process.env.SLACK_BOT_TOKEN) {
      console.error('SLACK_BOT_TOKEN is not set');
      return false;
    }

    const result = await slack.auth.test();
    
    if (result.ok) {
      console.log('Slack connection test successful:', result.user);
      return true;
    } else {
      console.error('Slack connection test failed:', result.error);
      return false;
    }
  } catch (error) {
    console.error('Error testing Slack connection:', error);
    return false;
  }
} 
import { WebClient } from "@slack/web-api";

if (!process.env.SLACK_BOT_TOKEN) {
  throw new Error("SLACK_BOT_TOKEN is not set");
}

if (!process.env.SLACK_CHANNEL_ID) {
  throw new Error("SLACK_CHANNEL_ID is not set");
}

const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);

export async function sendSlackMessage(text: string) {
  try {
    const result = await slackClient.chat.postMessage({
      channel: process.env.SLACK_CHANNEL_ID!,
      text,
    });
    return { success: true, result };
  } catch (error) {
    console.error("Slack error:", error);
    throw error;
  }
}

export async function diagnoseSlackSetup() {
  try {
    // Test auth
    const authTest = await slackClient.auth.test();
    if (!authTest.ok) {
      return {
        success: false,
        error: "Authentication failed",
        details: authTest,
      };
    }

    // Test channel access
    const channelId = process.env.SLACK_CHANNEL_ID;
    try {
      const channelInfo = await slackClient.conversations.info({
        channel: channelId,
      });

      if (!channelInfo.ok) {
        return {
          success: false,
          error: "Channel access failed",
          details: channelInfo,
        };
      }
    } catch (error: any) {
      if (error.code === "channel_not_found") {
        return {
          success: false,
          error: "Channel not found",
          details: { channelId },
        };
      }
      throw error;
    }

    return {
      success: true,
      message: "Slack setup is working correctly",
      details: {
        botName: authTest.user,
        teamName: authTest.team,
        channelId,
      },
    };
  } catch (error) {
    console.error("Slack diagnostic error:", error);
    throw error;
  }
}

# Slack Integration Setup Guide

This guide will help you set up the Slack integration for the Commission Tracker application.

## Features

The Commission Tracker includes two types of Slack notifications:

1. **Quick Post**: A concise notification with customizable acronym (e.g., "OCC - Carrier | Product | $1,000")
2. **Full Notification**: A detailed notification with agent information and formatted message

Both notification types include:
- Agent's name
- Agent's profile picture (from Clerk)
- Policy details (carrier, product, premium)

## Setup Steps

### 1. Create a Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click "Create New App"
3. Choose "From scratch"
4. Name your app (e.g., "Commission Tracker")
5. Select your workspace

### 2. Configure Bot Token Scopes

1. In your app settings, go to "OAuth & Permissions"
2. Under "Scopes" → "Bot Token Scopes", add these permissions:
   - `chat:write` - To post messages
   - `chat:write.public` - To post in public channels

### 3. Install App to Workspace

1. In "OAuth & Permissions", click "Install to Workspace"
2. Authorize the app
3. Copy the "Bot User OAuth Token" (starts with `xoxb-`)

### 4. Get Your Channel ID

1. Open Slack in your browser
2. Navigate to the channel where you want notifications
3. Look at the URL: `https://app.slack.com/client/WORKSPACE_ID/CHANNEL_ID`
4. Copy the CHANNEL_ID (starts with `C`)

### 5. Set Environment Variables

Add these to your `.env.local` file:

```env
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_CHANNEL_ID=C1234567890
```

### 6. Test Your Integration

1. Navigate to `/test-slack` in your application
2. Click either "Test Quick Post" or "Test Full Notification"
3. Check your Slack channel for the message

## Troubleshooting

### Common Issues

1. **"channel_not_found" error**
   - Make sure the bot is added to the channel
   - In Slack, type `/invite @YourBotName` in the channel

2. **"not_authed" or "invalid_auth" error**
   - Verify your bot token is correct
   - Make sure the token starts with `xoxb-`

3. **No profile picture showing**
   - Ensure the user has a profile picture in Clerk
   - Check that the slack-notification API route is fetching user data correctly

### Testing Without Slack

If you don't have Slack configured yet, the application will still work:
- Policy creation will function normally
- You'll see an alert explaining how to set up Slack
- You can skip Slack notifications by clicking "Skip Slack Notification"

## Customization

### Changing the Default Acronym

The default acronym is "OCC". Users can change this in the modal when posting to Slack.

### Modifying Message Format

To customize the Slack message format, edit the `sendQuickPolicyPost` function in `/src/lib/slack.ts`.

## Security Notes

- Never commit your Slack tokens to version control
- Use environment variables for all sensitive information
- Consider using different tokens for development and production 
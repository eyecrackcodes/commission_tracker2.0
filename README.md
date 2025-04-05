# Commission Tracker

A web application for insurance agents to track their policies and commissions. Built with Next.js, Clerk for authentication, and Supabase for the database.

## Features

- User authentication with Clerk
- Policy management (create, read, update, delete)
- Commission tracking and calculations
- Agent profile management
- Policy filtering and search
- Export policies to CSV
- Automatic commission rate adjustments based on agent tenure
- Slack notifications for policy updates and commission changes

## Commission Rules

- Agents receive 5% commission for the first 6 months of employment
- Commission rate automatically increases to 20% after 6 months
- Commission rate changes are tracked and notified via Slack

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Clerk Authentication
- Supabase Database
- Tailwind CSS
- Slack API Integration

## Environment Variables

The following environment variables are required:

```env
# Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key

# Database
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Slack Integration
SLACK_BOT_TOKEN=your_slack_bot_token
SLACK_CHANNEL_ID=your_slack_channel_id
```

## Deployment on Vercel

1. Fork or clone this repository
2. Create a new project on Vercel
3. Connect your repository to Vercel
4. Add the environment variables in Vercel's project settings
5. Deploy!

## Local Development

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file with the required environment variables
4. Run the development server:
   ```bash
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000)

## Database Setup

The application requires a Supabase database with the following tables:

- `policies`
- `agent_profiles`

Refer to the SQL scripts in the `supabase` directory for the complete schema.

## Commission Rate Updates

The application includes an API endpoint at `/api/update-commission-rates` that checks for and updates commission rates when agents reach their 6-month mark. This endpoint should be called daily using a cron job or similar scheduling service.

## Slack Notifications

The application sends Slack notifications for:

- New policy additions
- Commission rate changes
- Important policy updates

To set up Slack notifications:

1. Create a Slack app in your workspace
2. Add the necessary bot scopes (chat:write)
3. Install the app to your workspace
4. Add the bot to your desired channel
5. Configure the environment variables with your Slack bot token and channel ID

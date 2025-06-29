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

## Commission Rules

- Agents receive 5% commission for the first 6 months of employment
- Commission rate automatically increases to 20% after 6 months
- Commission rate changes are tracked automatically

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Clerk Authentication
- Supabase Database
- Tailwind CSS

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
3. Create a `.env.local` file with the required environment variables
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

# Commission Tracker 2.0

A modern web application for tracking insurance policy commissions, built with Next.js, Supabase, and Clerk Authentication.

## Features

- Policy management with status tracking (Active, Pending, Cancelled)
- Commission calculation and tracking
- Date-based filtering and search functionality
- Secure authentication with Clerk
- Real-time data updates with Supabase

## Tech Stack

- **Frontend**: Next.js, React, Tailwind CSS
- **Backend**: Supabase (PostgreSQL)
- **Authentication**: Clerk
- **Styling**: Tailwind CSS
- **State Management**: React Hooks

## Getting Started

1. Clone the repository:

```bash
git clone https://github.com/eyecrackcodes/commission_tracker2.0.git
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:
   Create a `.env.local` file with the following variables:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
```

4. Run the development server:

```bash
npm run dev
```

## Database Schema

The application uses the following main tables in Supabase:

- `policies`: Stores policy information and commission data
- `users`: Managed by Clerk for authentication

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

# Commission Tracker 2.0

A modern web application for tracking insurance policy commissions, built with Next.js, Supabase, and Clerk Authentication.

## Live Demo

[Access the live application here](#) <!-- You'll add the Vercel URL once deployed -->

## Features

- Policy management with status tracking (Active, Pending, Cancelled)
- Commission calculation and tracking
- Date-based filtering and search functionality
- Export to CSV functionality
- Secure authentication with Clerk
- Real-time data updates with Supabase
- Sortable columns and detailed statistics

## Tech Stack

- **Frontend**: Next.js, React, Tailwind CSS
- **Backend**: Supabase (PostgreSQL)
- **Authentication**: Clerk
- **Styling**: Tailwind CSS
- **Deployment**: Vercel

## Quick Start for Users

1. Visit the application URL (will be provided after deployment)
2. Sign up for an account using email or social login
3. Start adding and managing your policies
4. Use filters and search to organize your data
5. Export reports as needed using the CSV export feature

## For Developers

### Local Development

1. Clone the repository:

```bash
git clone https://github.com/eyecrackcodes/commission_tracker2.0.git
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

   - Copy `.env.example` to `.env.local`
   - Fill in your Supabase and Clerk credentials

4. Run the development server:

```bash
npm run dev
```

### Deployment

1. **Supabase Setup**

   - Create a new Supabase project
   - Run the following SQL in the Supabase SQL editor:

   ```sql
   -- Create policies table
   CREATE TABLE policies (
     id SERIAL PRIMARY KEY,
     user_id TEXT NOT NULL,
     client TEXT NOT NULL,
     carrier TEXT NOT NULL,
     policy_number TEXT NOT NULL,
     product TEXT NOT NULL,
     policy_status TEXT NOT NULL DEFAULT 'Pending',
     commissionable_annual_premium DECIMAL NOT NULL,
     commission_rate DECIMAL NOT NULL CHECK (commission_rate IN (0.05, 0.20)),
     commission_due DECIMAL GENERATED ALWAYS AS (commissionable_annual_premium * commission_rate) STORED,
     first_payment_date DATE,
     type_of_payment TEXT,
     inforce_date DATE,
     date_commission_paid DATE,
     comments TEXT,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
   );

   -- Enable Row Level Security
   ALTER TABLE policies ENABLE ROW LEVEL SECURITY;

   -- Create policy for user access
   CREATE POLICY "Users can manage their own policies" ON policies
     FOR ALL TO authenticated
     USING (auth.uid() = user_id)
     WITH CHECK (auth.uid() = user_id);
   ```

2. **Clerk Setup**

   - Create a new Clerk application
   - Configure your authentication methods (email, social providers)
   - Set up the JWT template
   - Add your Clerk credentials to environment variables

3. **Vercel Deployment**
   - Fork this repository
   - Create a new project in Vercel
   - Connect it to your forked repository
   - Add your environment variables in Vercel
   - Deploy!

## Security

- All data is protected by Row Level Security in Supabase
- Each user can only access their own policies
- Secure authentication handled by Clerk
- All sensitive operations require authentication

## Support

For support, please create an issue in the GitHub repository or contact the development team.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

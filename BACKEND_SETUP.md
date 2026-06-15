# LoyLoop Backend Setup

## 1. Supabase environment

The project reads Supabase from:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Local values are in `.env.local`.

## 2. Create database tables

Open Supabase SQL Editor and run:

1. `supabase/schema.sql`
2. `supabase/seed.sql`

The seed creates demo businesses, a demo customer, memberships, rewards, missions, stamp cards, and loyalty events.

## 3. Current backend features

- Dashboard rewards read from Supabase with mock fallback.
- Dashboard missions read from Supabase with mock fallback.
- Reward creation writes to Supabase.
- Mission creation writes to Supabase.
- Customer QR simulation creates/updates demo membership.
- Stamp card can add a stamp and redeem the stamp reward.
- Login/signup page uses Supabase Auth.

## 4. Demo note

The current RLS policies intentionally allow demo insert/update operations with the publishable key so the MVP can be tested quickly. Before production, replace them with role-based policies for merchant owners and authenticated customers.

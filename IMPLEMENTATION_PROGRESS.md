# Dynamic commerce migration checkpoint

## Completed

- Checkout API reads authoritative product prices and delivery records from Supabase.
- Admin authentication guard and read-only operational views exist.

## Next safe implementation block

1. Add protected `/api/admin/products` CRUD using `requireAdmin`/server role checks.
2. Replace `src/app/sklep/page.tsx` and product routes with server-side Supabase catalog queries, retaining static data only as an offline fallback.
3. Add the equivalent category, delivery, promotion and order mutation APIs.

## Validation

Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, then execute Vercel Preview database tests using Admin01.

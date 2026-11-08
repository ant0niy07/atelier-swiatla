# Checkout hardening audit — 2026-11-08

## Scope and live-data boundary

This review was performed against the repository at `3b7a5b2` and its
forward-only changes. No production deployment, Supabase migration, live order,
promotion, payment configuration, or customer record was changed.

## Confirmed defects and resolutions

| ID | Severity | Root cause | Resolution | Verification |
| --- | --- | --- | --- | --- |
| CHK-01 | critical | Checkout did not reserve stock-managed inventory. | `inventory_state` plus a locked, deterministic stock reservation in the checkout RPC. | Requires isolated PostgreSQL run. |
| CHK-02 | critical | Checkout's first Telegram log was written after the order committed. | Creates a `pending` outbox record within the checkout transaction. | Unit-tested message privacy; DB run pending. |
| CHK-03 | high | Checkout replay response omitted final totals/payment fields. | RPC returns the same response shape for new and replayed orders. | SQL review; DB run pending. |
| CHK-04 | high | Request hashes depended on incidental JSON/item order. | Canonical request normalization before SHA-256 hashing. | 6 hash unit tests pass. |
| CHK-05 | high | Promo preview accepted rule-query failure as an empty rule set. | Preview fails closed on every rule-query/database error and rejects archived/no-eligible promotions. | Promotion unit tests pass. |
| CHK-06 | high | Local delivery minimum was not enforced. | Enforced in preview, browser preflight, and the authoritative RPC. | SQL review; DB run pending. |
| CHK-07 | high | Telegram could include PII embedded in free-text notes. | Telegram formatter excludes customer notes; notes stay in protected admin UI. | Privacy unit test passes. |
| CHK-08 | medium | Retry could leave `sending` permanently stuck after a crash. | Lease-aware claim reclaims a `sending` record after 10 minutes, without modifying sent records. | Requires isolated PostgreSQL run. |
| CHK-09 | medium | Public endpoints had no cross-instance throttling. | Service-role-only persistent fixed-window limiter with hashed request subject. | Unit test verifies no raw IP is stored by the route helper. |

## Migration package and order

Do **not** run `supabase db push` against the live project because the audit
identified migration-history drift (`20261107121351` live versus
`20261107120326` in this repository). Reconcile migration history first, then
apply only these pending forward migrations in this exact order:

1. `20261108003004_secure_promotion_reservations.sql`
2. `20261108005000_atomic_checkout.sql`
3. `20261108005738_telegram_notification_log.sql`
4. `20261108012726_checkout_inventory_outbox_hardening.sql`

Preflight: take a database backup; inspect `supabase_migrations.schema_migrations`;
confirm the three earlier files are absent; verify `products.is_personalization_addon`,
`orders.is_test`, `delivery_methods.minimum_order_grosz`, and `admin_users` exist.
Postflight: check `has_function_privilege` for `anon` and `authenticated` (all
four privileged functions must be false); perform an isolated test order and
verify the atomic order, item, reservation, redemption, outbox, and replay rows.

## Known verification boundary

The local Supabase PostgreSQL endpoint at `127.0.0.1:54322` is unavailable and
Docker is not available in this environment. Therefore database integration,
concurrency, RLS/grant, and browser E2E tests have not been represented as
passing. The included unit suite does not replace those tests.

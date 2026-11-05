# Deployment

## Preview workflow

The development branch is `preview`; `main` is not touched by this project workflow. In Vercel, import `ant0niy07/atelier-swiatla`, select the Next.js preset, and configure the project to create preview deployments for GitHub pushes. Vercel requires an owner-authorized login/import; no credentials are stored in this repository.

Set `NEXT_PUBLIC_SITE_URL` to the final preview URL when it is known. Add values from `.env.example` only when enabling real order storage/email. Never expose a GitHub token to the browser.

## Before sales

Configure a private order repository and a scoped GitHub token, Resend sender/domain, owner email, a strong session secret, an Argon2/bcrypt password hash, shipping rates, legally reviewed store details, and verified product stock. Then implement/enable the server endpoints only after integration testing.

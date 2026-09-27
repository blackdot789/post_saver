# Setup

## Accounts (owner)

| Service | Used for | Cost |
|---|---|---|
| GitHub (`site.config.ts → github.owner`) | Code, CI, hosting for the site and embed sandbox | Free |
| Google / Firebase | Sign-in, Firestore database, hosting for the auth subdomain | Free (Spark) |
| Cloudflare | Resolver Worker (short links, metadata) | Free |
| Domain registrar | DNS records (see DOMAIN_CHANGE.md) | Domain only |

## Local tools

Node 24, pnpm 12, GitHub CLI, Firebase CLI, Google Cloud CLI, Java 21 (Firestore emulator).

```bash
brew install gh pnpm firebase-cli
brew install --cask google-cloud-sdk temurin@21
gh auth login && gh auth refresh -h github.com -s workflow
firebase login
gcloud auth login
npx wrangler login
```

This repo pushes over HTTPS as the GitHub CLI account (repo-local credential helper), so a
different global SSH identity on the machine doesn't matter.

## Repositories

| Repo | Visibility | Purpose |
|---|---|---|
| `post_saver` | Public | This monorepo; Pages → main domain |
| `post_saver_embed` | Public | Built embed sandbox only (pushed by CI); Pages → `embed.<domain>` |
| `post_saver_ops` | Private | Backups and admin jobs |

## Firebase projects

| Alias | Project | Notes |
|---|---|---|
| `dev` | `post-saver-dev` | Local development and emulators |
| `prod` | `post-saver-prod` | Live site; Hosting serves only the auth subdomain (`/__/auth/*`) |

Both use Firestore `(default)` in `nam5`. The auto-created browser API key in each project is
restricted to: Identity Toolkit, Token Service, Cloud Firestore, Firebase Installations and
App Check. If a new Firebase feature fails with `API_KEY_SERVICE_BLOCKED`, add its API to the
key under Google Cloud → APIs & Services → Credentials.

## Secrets (never committed)

| Secret | Where | Set by |
|---|---|---|
| `EMBED_DEPLOY_KEY` | `post_saver` → environment `production` | Developer (`gh secret set`) |
| `CLOUDFLARE_API_TOKEN` | `post_saver` → environment `production` | Owner, pasted into the terminal |

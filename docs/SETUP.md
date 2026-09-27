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

## Secrets (never committed)

| Secret | Where | Set by |
|---|---|---|
| `EMBED_DEPLOY_KEY` | `post_saver` → environment `production` | Developer (`gh secret set`) |
| `CLOUDFLARE_API_TOKEN` | `post_saver` → environment `production` | Owner, pasted into the terminal |

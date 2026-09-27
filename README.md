# post_saver

Save posts from every social platform into one library — on phone and desktop, always in sync.
The product name, domain, contacts and service URLs all live in **[`site.config.ts`](site.config.ts)**;
nothing else in the repo hardcodes them (`pnpm check:domains` enforces this).

## How it works

- **Links only.** The app stores a post's link plus small metadata (tags, notes, collections) and
  shows each post through the platform's official embed.
- **Zero running cost.** Static site on GitHub Pages, Firebase (Spark plan) for sign-in and data,
  one Cloudflare Worker for short-link expansion.
- **Safe embeds.** Platform embed scripts run only inside a sandbox on a separate origin
  (`embed.<domain>`), never on the main site.

## Repository layout

| Path | What it is |
|---|---|
| `site.config.ts` | Domain, brand, contacts, URLs — the only place they're written |
| `brand/` | Logo sources (`mark.svg`, `mark-p.svg`, `logo-full.png`) |
| `apps/web/` | Main site + app (Vite, React, Tailwind) → GitHub Pages of this repo |
| `apps/embed/` | Embed sandbox → published to the `post_saver_embed` repo |
| `packages/config/` | Typed access to the site config, HTML tokens, CSP, Vite plugin |
| `firebase/` | Firestore rules/indexes, emulator config, auth-subdomain hosting |
| `scripts/` | Brand asset generator, domain checker, domain apply, config reader |
| `docs/` | Setup and domain-change runbooks |

## Develop

Requirements: Node 24 (see `.nvmrc`), pnpm 12.

```bash
pnpm install
pnpm dev             # main site at http://localhost:5173
pnpm build           # production build of web + embed
pnpm verify          # what CI runs: domain check, typecheck, build
pnpm brand           # regenerate icons/OG image after changing brand/
```

See [docs/SETUP.md](docs/SETUP.md) for accounts and infrastructure, and
[docs/DOMAIN_CHANGE.md](docs/DOMAIN_CHANGE.md) to move to a new domain or brand.

## License

All rights reserved — see [LICENSE](LICENSE). The code is public for transparency, not for reuse.

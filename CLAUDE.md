# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This file is the **single source of truth for the whole project**: product, decisions, the full plan, live infrastructure, status and how to work with the owner. Read it fully before doing anything, and **update §12 (progress log) and the roadmap checkboxes (§9) whenever work lands**.

> **Naming rule for this file and every other tracked file.** `pnpm check:domains` fails CI if the domain or brand name appears literally anywhere except `site.config.ts` and `brand/`. So docs say **`<domain>`** for the main domain and **"the brand"** for the product name. The **current values are in `site.config.ts`**: `domain` (a *temporary test domain* registered at Hostinger) and `brand.name`. The tagline is "Save Posts Across All Platforms". Repo and project names use `post_saver` / `post-saver`, which the check allows.

---

## 0. Quick orientation

- **What:** a web app (PWA) that collects **links** to posts saved from every social platform into one synced library, on phone and desktop. Posts are displayed only through the platforms' **official embeds**; no media is copied.
- **Why:** the owner tried Dewey (getdewey.co). Saves and unsaves made in the Instagram *phone app* never reached Dewey, because Dewey depends on a desktop Chrome extension noticing changes, and Instagram has no API or notifications for saved posts. We beat that by making every capture path write straight to the cloud, especially **Share → the app** on the phone.
- **Cost:** must stay **$0 to run**: GitHub Pages (public repos) + Firebase **Spark** (Auth + Firestore, used directly from the browser, no Cloud Functions) + one Cloudflare Worker (free plan).
- **Status (2026-09-29):**
  - **Phase 0 (foundations) is done.** The coming-soon landing is live at `https://<domain>`, the embed sandbox at `https://embed.<domain>`, and the Worker skeleton is live. CI and deploy are green.
  - `auth.<domain>` also serves the Firebase auth helpers over HTTPS.
  - **Phase 1, step 1 (the URL engine, `packages/core`) is done.**
  - **Phase 1, step 2 (Firestore schema, rules, rules tests) is built and green:** 587 unit tests + 117 rules tests, all run in CI. The rules are **not deployed to Firebase yet**; both projects still have the deny-all rules until the owner approves the deploy.
  - **Next: Phase 1, step 3: Auth** (§6.7, §9).
- **The original plan file**, `~/.claude/plans/make-a-full-proof-vivid-rose.md`, exists only on the owner's Mac and is superseded by this file.

## 1. Working with the owner

- **The owner is a non-expert builder.** They want **step-by-step guides** with exact click paths and direct links for anything they must do themselves (accounts, web consoles, DNS). When they ask for "yes or no", answer yes or no plus a little explanation, nothing longer.
- **They review plans before any building starts.** Confirm before outward-facing actions: creating repos or projects, deploying, changing cloud settings, pushing.
- **Never ask them to paste secrets into the chat.** When a token is needed, they run the command themselves in the VS Code terminal (e.g. `gh secret set NAME --repo blackdot789/post_saver --env production`) and paste it there.
- **Test devices:** a **OnePlus Nord 5 (Android, Chrome)** and **desktop Chrome**. They have **no iPhone**, so iPhone capture is deferred to v1.2.
- **Split of work:** the owner handles accounts, consoles, DNS and payments. Claude does everything else (code, CLIs, repos, deploys, docs) and **verifies what the owner did**, e.g. with `dig`, `gh api`, and the Firebase/Identity Toolkit APIs via `gcloud auth print-access-token`.

---

## 2. Decisions locked (don't re-decide)

| Topic | Decision |
|---|---|
| Domain & brand | **Only in `site.config.ts`**. Everything else derives from it; CI enforces this (§4) |
| Main site | GitHub Pages of public repo **`post_saver`** → `<domain>` (`www.<domain>` redirects to it) |
| Embed sandbox | Public repo **`post_saver_embed`** → `embed.<domain>`. **All platform embed code runs only here**, never on the main origin |
| Private ops | Private repo **`post_saver_ops`**: backups and admin jobs (empty so far) |
| Sign-in helper | `auth.<domain>` on Firebase Hosting (free), used as Firebase `authDomain` in prod |
| Helper API | Cloudflare Worker **`post-saver-resolver`** on `workers.dev` (URL in `site.apiBaseUrl`); may move to `api.<domain>` later |
| DNS | Stays at **Hostinger**; the owner edits records (§8.4) |
| Firebase | Projects **`post-saver-dev`** and **`post-saver-prod`**, Spark plan. Firestore `(default)` in **`nam5`** (US multi-region, worldwide audience). **The location is permanent** |
| License | **All rights reserved**: code is public for transparency, not reuse. Don't add OSS headers |
| Data | **Links + small metadata only**, one Firestore doc per saved post. No media, no platform passwords or sessions |
| Stack | TypeScript (v7 native `tsc`), Vite 8, React 19 (for `/app/`), Tailwind v4, PWA (vite-plugin-pwa/Workbox, planned), pnpm 12 workspaces, Node 24 |
| Sign-in | Google + email/password, **email verification required before cloud sync**. **Never email-link sign-in** (5/day limit on Spark). Apple sign-in is deferred ($99/yr) |
| Phone capture | **v1: Android** installed PWA share target. **iPhone: v1.2**, an Apple Shortcut with a save key, once an iPhone is available. The data model supports it from day 1 |
| Accounts | GitHub **`blackdot789`** · Google/Firebase/Cloudflare owner **`kerdostack@gmail.com`**, which is also the support email during testing |
| Brand assets | Owner's logo `brand/logo-full.png`; vector redraws `brand/mark.svg` (P + sparks) and `brand/mark-p.svg` (P only). Colors sampled from the logo: `#099AFE` → `#6636F2` gradient, ink `#03112C` |
| Unavoidable costs | The domain, and the Chrome Web Store $5 one-time fee (v1.1) |
| Blaze decision | Stay on Spark through development and beta. **Before public launch**, decide whether to move to Blaze with a $5 budget alert. It has the same free allowance, and going over costs cents instead of an outage |
| Domain switch | **Switch to the final domain before the public launch**, because users must re-login and reinstall after an origin change (§10) |

---

## 3. Commands

pnpm 12 workspace; Node 24 (`.nvmrc`; the local machine has Node 26 via Homebrew, which also works).

```bash
pnpm install
pnpm dev                                   # web app at http://localhost:5173
pnpm --filter @postsaver/embed dev         # embed sandbox at http://localhost:5174
pnpm build                                 # web + embed production builds
pnpm verify                                # what CI runs: check:domains + typecheck + test + test:rules + build
pnpm check:domains                         # fail if domain/brand is hardcoded outside site.config.ts
pnpm typecheck                             # all packages + scripts/
pnpm test                                  # Vitest in every package that has a `test` script (packages/core)
pnpm test:rules                            # Firestore rules tests: starts the emulator (Java 21), runs firebase/test
pnpm --filter @postsaver/core exec vitest  # URL engine tests in watch mode
pnpm brand                                 # regenerate icons + OG image from brand/ (outputs committed)
pnpm exec tsx scripts/config-get.ts hosts.embed   # print one config value (CI uses this)
pnpm domain:apply                          # set both GitHub Pages custom domains, then enforce HTTPS
pnpm --filter @postsaver/resolver dev      # Worker locally (wrangler)
pnpm --filter @postsaver/resolver exec wrangler deploy   # manual Worker deploy (CI normally does it)
cd firebase && firebase deploy --only firestore --project dev    # rules/indexes (aliases: dev, prod)
cd firebase && firebase deploy --only hosting --project prod     # auth-subdomain helper site
cd firebase && firebase emulators:start    # Auth 9099, Firestore 8080, UI 4000 (Java 21 installed)
```

**Vitest 5** runs the unit tests (`packages/core/test`) and the rules tests (`firebase/test`, with `@firebase/rules-unit-testing` inside `firebase emulators:exec`, project `demo-post-saver`, so no login is needed). There is **no linter yet**. Phase 1 still adds Playwright (e2e against the emulators) and ESLint/Prettier.

**pnpm 12 quirks:**
- There is no `-s` flag.
- `pnpm ci` is pnpm's *built-in* clean install; our check script is **`pnpm verify`**.
- Packages with install scripts need `allowBuilds:` entries in `pnpm-workspace.yaml`. `esbuild` and `workerd` are allowed; `@firebase/util`, `protobufjs` and `re2` are denied (not needed). `pnpm add` fails with `ERR_PNPM_IGNORED_BUILDS` and writes placeholder values ("set this to true or false") into the file; replace them with a real decision.
- **Minimum release age:** pnpm refuses versions published less than a day ago (a supply-chain guard). If `pnpm add` asks for a `minimumReleaseAgeExclude` entry, don't keep it: use the previous version. If the lockfile already holds the too-new version, restore `pnpm-lock.yaml` from git and install again.
- In zsh, quote workspace specs: `pnpm add -D '@postsaver/config@workspace:*'`.

---

## 4. Codebase architecture (as built)

```
site.config.ts        the ONLY place for domain, brand, contacts, GitHub repos, Worker URL, Firebase web configs
packages/config/      typed access: index.ts (hosts/origins/firebaseConfig), html.ts (%TOKENS%, CSP), vite-plugin.ts
packages/core/        URL engine: parse(), extractSharedUrl()/findUrls(), saveId(); fixture tests (Vitest)
apps/web/             main site (static landing index.html + 404.html now; React /app/ etc. in Phase 1)
apps/embed/           embed sandbox (placeholder: answers the parent via postMessage)
workers/resolver/     Cloudflare Worker (Phase 0: /health + config-driven CORS)
firebase/             firebase.json, .firebaserc (dev/prod aliases), firestore.rules + test/ (rules tests), indexes, hosting/
scripts/              check-domains, config-get, domain-apply, gen-brand (sharp)
brand/                logo sources; apps/web/public/{favicon.svg,icons/*,og.png} are generated by `pnpm brand`
docs/                 SETUP.md (accounts/tools/secrets), DOMAIN_CHANGE.md (runbook)
.github/workflows/    ci.yml, deploy.yml (actions pinned by commit SHA; keep it that way)
```

### 4.1 How config flows
- **`packages/config/src/index.ts`**
  - Derives `hosts` and `origins` (app, www, embed, auth) from `site.domain` + `site.subdomains`.
  - `firebaseConfig(env)` sets `authDomain` = `auth.<domain>` for **prod** and `<projectId>.firebaseapp.com` for **dev**.
  - `forbiddenLiterals()` feeds `check:domains`.
- **`packages/config/src/html.ts`**
  - `%TOKEN%` values for HTML: `BRAND_NAME`, `BRAND_NAME_FIRST`/`BRAND_NAME_LAST` (the landing styles the last word with the gradient), `BRAND_TAGLINE`, `BRAND_DESCRIPTION`, `THEME_COLOR`, `APP_ORIGIN`, `APP_HOST`, `EMBED_ORIGIN`, `SUPPORT_EMAIL`, `YEAR`. An unknown token throws at build time.
  - `mainSiteCsp()` builds the main-site CSP. **Add every new third-party origin here** (Firebase APIs, the Worker, Google sign-in, auth.<domain>).
- **`packages/config/src/vite-plugin.ts`** (`siteConfigPlugin`), used by both apps:
  - Replaces tokens.
  - Writes brand CSS variables to `apps/*/src/generated/brand.css` (git-ignored). Tailwind `@theme` maps them to the `brand-from`, `brand-to` and `brand-ink` utilities.
  - Injects the CSP `<meta>` **only in production builds**, because the dev server needs inline scripts.
  - Emits config-driven files: the web app's robots.txt, sitemap.xml and manifest.webmanifest; the embed's `CNAME`, `.nojekyll` and robots.txt.
- **Worker:** imports `origins` for its CORS allowlist (+ `http://localhost:5173`); wrangler bundles it.
- **CI:** reads config with `scripts/config-get.ts`, e.g. the embed repo name, so workflows never hardcode it.
- **Gotcha:** inside `packages/config`, imports **must use explicit `.ts` extensions**. Vite loads `vite.config.ts` and this workspace package through Node's native type stripping, and extensionless imports fail with `ERR_MODULE_NOT_FOUND`. `allowImportingTsExtensions` is on.

### 4.2 Deploys (`.github/workflows/deploy.yml`, on push to `main`)

| Job | Builds | Goes to | Auth |
|---|---|---|---|
| `web` | `apps/web` | GitHub Pages of `post_saver` (Actions artifact, build_type=workflow) | `github-pages` environment |
| `embed` | `apps/embed` | Force-pushed as the only commit to `post_saver_embed@main` (branch-deployed Pages, root) | `production` environment, secret **`EMBED_DEPLOY_KEY`** (SSH deploy key with write access on the embed repo) |
| `resolver` | `workers/resolver` | `wrangler deploy` (account id in `wrangler.jsonc`) | `production` environment, secret **`CLOUDFLARE_API_TOKEN`** (skipped with a warning if missing) |

`ci.yml` runs on PRs and pushes, as two jobs:
- `check`: `pnpm install --frozen-lockfile`, `check:domains`, `typecheck`, `test`, `build`.
- `rules`: the same install plus Java 21 (`actions/setup-java`) and a cache of the emulator jar (`actions/cache`), then `test:rules`.

Rules are **not** deployed by CI yet (that needs Workload Identity Federation); they're deployed by hand with `firebase deploy --only firestore`, and only when the rules tests are green.

### 4.3 Structural rules
- **Multi-page build, no SPA fallback.** GitHub Pages can't rewrite routes, so **every route is its own HTML entry** in `apps/web/vite.config.ts` → `build.rollupOptions.input`. Internal links are relative, with trailing slashes (`/save/`). State inside `/app/` goes in query params.
- **Embed isolation is a security boundary.** Platform scripts must never run on the main origin, where they could read the Firebase session in IndexedDB. The main app only renders `<iframe src="https://embed.<domain>/#…">`. Messages use the `ps:` prefix (`ps:height`, `ps:status`), and both sides check `event.origin`/referrer against config-derived origins.
- **The landing page is static HTML** (Tailwind, no JS) for speed and SEO. React is installed for the upcoming `/app/`.
- **Git identity is repo-local:**
  - Commits are authored as `blackdot789` with `334481207+blackdot789@users.noreply.github.com`.
  - Pushes go over HTTPS through a repo-local `!gh auth git-credential` helper.
  - This Mac's **global** git/SSH identity is a *different* GitHub account (`taurusconsultants`, email `marmikpatel791@gmail.com`). **Never** switch the remote to SSH or rely on global git config.
  - The `gh` token has the `repo` and `workflow` scopes.
- **Commit messages** end with the `Co-Authored-By` line the harness specifies.

### 4.4 Complete code map (every tracked file)

Workspace packages: root `post-saver-monorepo`, `@postsaver/config`, `@postsaver/core`, `@postsaver/web`, `@postsaver/embed`, `@postsaver/resolver`, `@postsaver/firebase` (rules tests only). Every workspace dependency is `workspace:*`. Packages export **TypeScript source directly**: there is no build step for `packages/*`, and consumers (Vite, tsx, wrangler) compile it.

**Root**

| File | Purpose / key contents |
|---|---|
| `site.config.ts` | `export const site = {…} as const` + `interface FirebaseWebConfig`. Fields: `brand{name, shortName, tagline, description, colors{from,to,ink}}`, `domain`, `subdomains{www,embed,auth}`, `apiBaseUrl`, `contact{support,privacy}`, `github{owner, repos{web,embed,ops}}`, `firebase{dev,prod}` (apiKey, projectId, appId, messagingSenderId) |
| `package.json` | `packageManager: pnpm@12.6.0`, `engines.node >=22.18`. Scripts: `dev`, `build`, `typecheck`, `test` (`pnpm -r run test`), `test:rules`, `check:domains`, `brand`, `config:get`, `domain:apply`, `verify`. devDeps: typescript ^7.0.2, tsx ^4.23, sharp ^0.35.4, @types/node ^26, `@postsaver/config` |
| `pnpm-workspace.yaml` | `packages: apps/*, packages/*, workers/*, firebase`; `allowBuilds`: esbuild and workerd true; `@firebase/util`, protobufjs and re2 false |
| `tsconfig.base.json` | ES2022, `moduleResolution: Bundler`, `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `allowImportingTsExtensions`, `noEmit`. Every package's `tsconfig.json` extends it |
| `.nvmrc` | `24` (CI reads it) |
| `.gitignore` | Notably `apps/*/src/generated/`, `dist/`, `.wrangler/`, `.dev.vars`, emulator logs, `*.pem`, `*_key`, `*_key.pub` |
| `.editorconfig` | 2-space indentation, LF, final newline |
| `LICENSE` | All rights reserved (copyright blackdot789); viewing and forking on GitHub only |
| `README.md` · `SECURITY.md` · `CHANGELOG.md` | Public overview · vulnerability reporting to `contact.support` · changelog (only "Unreleased" so far) |
| `CLAUDE.md` | This file |

**`packages/config/`**: typed access to `site.config.ts`. Exports map: `"."` → `src/index.ts`, `"./html"` → `src/html.ts`, `"./vite-plugin"` → `src/vite-plugin.ts`. Its tsconfig also includes `../../site.config.ts`. devDeps: vite, @types/node.

| File | Exports |
|---|---|
| `src/index.ts` | `site`, `type FirebaseWebConfig`, `type HostKey` (`"app" \| "www" \| "embed" \| "auth"`), `host(key)`, `origin(key)`, `hosts`, `origins`, `type FirebaseEnv`, `firebaseConfig(env)` (adds `authDomain`), `forbiddenLiterals()` (returns `[domain, brand.name]`) |
| `src/html.ts` | `htmlTokens()` (token → value map; HTML-escaped on apply), `applyHtmlTokens(html, tokens?)` (replaces `%[A-Z_]+%`, throws on unknown), `mainSiteCsp()` (a directive map: `default/script/style/font/connect-src 'self'`, `img-src 'self' data:`, `frame-src <embed origin>`, `object-src 'none'`, `base-uri`/`form-action 'self'`) |
| `src/vite-plugin.ts` | `siteConfigPlugin({ csp?, brandCssPath?, files? })`. It uses `configResolved` (writes brand.css only when changed), `transformIndexHtml` (order `pre`, tokens + CSP meta when `!ctx.server`) and `generateBundle` (emits `files()` as assets) |

**`packages/core/`**: the URL engine (§6.2). Pure TypeScript with no network access; runs in the browser, the Worker and Node. Exports map: `"."` → `src/index.ts`. Scripts: `typecheck`, `test` (`vitest run`). devDeps: vitest ^5.0.2.

| File | Purpose |
|---|---|
| `src/index.ts` | Public API: `parse`, `extractSharedUrl`, `findUrls`, `saveId`, `sha256Hex`, `parseStart`, `GENERIC_SHORTENERS`, `MAX_URL_LENGTH` (2048), `PLATFORMS`, `KINDS`, and the types |
| `src/types.ts` | `Platform` (the 10 platforms + `"web"`), `Kind` (post, reel, video, short, live, photo, pin, comment, story, profile, community, playlist, article, link), `ResolveVia` (`"redirect"` \| `"bsky-handle"`), `Embed` (one descriptor per platform, ids only), `ParsedLink` |
| `src/url.ts` | `toUrl(input)`: trims, removes invisible characters and `<…>`/quote wrappers, decodes a fully encoded URL, converts `intent://` and `at://`, adds `https://`, refuses other schemes and hosts without a dot, drops credentials. `bareHost`. `cleanUrl`: drops tracking params (**the other params keep their exact encoding**) and the fragment unless it's `#/…` or `#!…`. `unwrapRedirect`: l.facebook / l.instagram / l.threads, Google `/url` + AMP, YouTube `/redirect` + `attribution_link`, out.reddit, LinkedIn `/redir`, Facebook plugin/sharer URLs |
| `src/match.ts` | `Ctx` (URL, bare host, decoded path segments, query), `Match`, `Matcher`, and the helpers `linkCard`, `profile`, `shortLink` |
| `src/platforms/*.ts` | One matcher per platform. Returns null for hosts it doesn't own. Otherwise returns one of: a post (id checked by a strict regex, canonical URL rebuilt from ids, plus an embed), a profile or community, a short link (`needsResolve`), or a link card for any other page on that site |
| `src/parse.ts` | `parse(input)`: `toUrl`, then up to 3 `unwrapRedirect` hops, then the first matching platform, else `web` (generic shorteners in `GENERIC_SHORTENERS` get `needsResolve`). Returns null for anything we can't store |
| `src/extract.ts` | `extractSharedUrl({url, text, title})`: the first link in `url`, then `text`, then `title`; only the `url` param may be a bare `host/path`. `findUrls(text, {limit, lone})` serves the paste box. A link ends at whitespace, CJK/full-width punctuation or an emoji; trailing sentence punctuation and unbalanced closing brackets are trimmed. **No regex lookbehind** (older Safari can't parse it) |
| `src/id.ts` | `sha256Hex` (Web Crypto) and `saveId(link)`, which returns `{platform}_{platformId}` or `url_{first 24 hex of sha256(canonicalUrl)}` |
| `test/fixtures/*.ts` | 255 fixtures (at least 10 per platform) + 14 inputs that must be refused: share forms from the Android and iOS apps and the web, mirrors, wrappers, profiles, junk. **Formats follow each app's known share format; ids are placeholders.** When a real link breaks the parser, add it here exactly as shared |
| `test/parse.test.ts` | Every fixture, plus invariants: every canonical URL parses back to itself, the output is well-formed, and embeds come only from validated ids. Also refused inputs, the embed for each platform, and a seeded 5,000-input fuzz |
| `src/schema.ts` | The Firestore document shapes (§6.4): `SaveDoc<T>`, `Tombstone<T>`, `CollectionDoc<T>`, `UserDoc<T>`, `ImportDoc<T>`, `AppConfig` (`T` = timestamp type), plus `SCHEMA_VERSION` (1), `LIMITS`, the status enums, `SaveSource`, `STABLE_THUMB_PREFIX`. Helpers: `normalizeTag`/`normalizeTags`, **`newSave(link, {source, now, savedAt?, tags?, note?})`**, which builds the exact document the rules accept, and `tombstone(now)`. The app and the rules tests both use them |
| `test/extract.test.ts` · `test/id.test.ts` · `test/schema.test.ts` | Share-text extraction cases · the SHA-256 test vector and "every form of the same post gives one id" · tag normalisation, `newSave`, `tombstone` |

**`apps/web/`**: the main site. deps: react ^19.3, react-dom, @fontsource-variable/outfit. devDeps: vite ^8.3, @vitejs/plugin-react ^6.1, tailwindcss + @tailwindcss/vite ^4.3.

| File | Purpose |
|---|---|
| `vite.config.ts` | Plugins `siteConfigPlugin` (csp = `mainSiteCsp`, brandCssPath = `src/generated/brand.css`, files = robots.txt / sitemap.xml / manifest.webmanifest), `react()` and `tailwindcss()`. `build.rollupOptions.input = { index, notFound: 404.html }`; **add each new route here** |
| `index.html` | Static coming-soon landing: blurred gradient blobs, mark, gradient brand name (`%BRAND_NAME_FIRST%` + `%BRAND_NAME_LAST%`), tagline, description, "Coming soon" pill, platform chips, 3-step cards, footer with `%SUPPORT_EMAIL%`. Head: canonical, favicons, manifest, OG/Twitter tags, `<link rel="stylesheet" href="/src/styles.css">` |
| `404.html` | Served by GitHub Pages for unknown paths (noindex) |
| `src/styles.css` | `@import "tailwindcss"`, the Outfit font and `./generated/brand.css`; `@theme inline` maps `--font-sans`, `--color-brand-from/to/ink`; `color-scheme: light dark` |
| `src/generated/brand.css` | **Generated, git-ignored**: `:root{--brand-from;--brand-to;--brand-ink}` |
| `public/favicon.svg`, `public/icons/{favicon-32,apple-touch-icon,icon-192,icon-512,maskable-512}.png`, `public/icons/mark.svg`, `public/og.png` | **Generated by `pnpm brand`, committed**. Don't hand-edit |
| `tsconfig.json` | `jsx: react-jsx`, types `vite/client` + `node`; includes `src` and `vite.config.ts` |

**`apps/embed/`**: the embed sandbox (Phase 0 placeholder). devDeps: vite, `@postsaver/config`.

| File | Purpose |
|---|---|
| `vite.config.ts` | `siteConfigPlugin({ files: CNAME = hosts.embed, .nojekyll, robots.txt Disallow all })` |
| `index.html` | noindex; `<div id="frame" aria-live="polite">`, loads `src/embed.css` + `src/main.ts` |
| `src/main.ts` | `allowedParents` = {origins.app, origins.www} (+ `http://localhost:5173` in dev). `parentOrigin()` checks `document.referrer`, then posts `{type:"ps:status", status:"unavailable", reason:"not-implemented"}` to the parent. **Phase 1 replaces this with the fragment parser + per-platform renderers** |
| `src/embed.css` | Transparent background, no margins |

**`workers/resolver/`**: the Cloudflare Worker. devDeps: wrangler ^4.141, @cloudflare/workers-types, `@postsaver/config`.

| File | Purpose |
|---|---|
| `wrangler.jsonc` | `name: post-saver-resolver`, `account_id`, `main: src/index.ts`, `compatibility_date: 2026-09-01`, `workers_dev: true`, observability on |
| `src/index.ts` | `ALLOWED_ORIGINS` (config origins + localhost:5173), `corsHeaders(origin)`, `json(body, status, origin)`, default `fetch` handler: `OPTIONS` → 204, `GET /health` → `{ok:true, service:"resolver", phase:0}`, anything else → 404 JSON. **Phase 1 adds `/resolve`, `/meta`, `/batch` + ID-token verification** |
| `tsconfig.json` | lib ES2023, types `@cloudflare/workers-types` |

**`firebase/`**: run the Firebase CLI from this folder.

| File | Purpose |
|---|---|
| `firebase.json` | firestore `{database:"(default)", rules, indexes}`, hosting `{public:"hosting"}`, emulators auth 9099 / firestore 8080 / ui 4000, `singleProjectMode` |
| `.firebaserc` | Aliases `default`/`dev` → post-saver-dev, `prod` → post-saver-prod |
| `firestore.rules` | The real rules (§6.4; "As built" there explains them). Helper functions, then paths: `config/{doc}` (public read, no writes), `users/{uid}`, and its `saves`, `collections` and `imports`. Everything else, including the v1.2 inbox paths, is denied |
| `firestore.indexes.json` | `fieldOverrides`: no indexes on saves `note`, `title`, `thumb`, `originalUrl`, `onPlatform` and items `text`; saves `updatedAt` keeps both collection indexes and adds a **collection-group** ascending index (for the incremental backup job) |
| `package.json` | `@postsaver/firebase`: `test:rules` = `firebase emulators:exec --only firestore --project demo-post-saver 'vitest run'`; `typecheck`. devDeps: @firebase/rules-unit-testing ^5.0.2, firebase ^12.19, firebase-tools ^15.31 (pinned by the lockfile so CI uses the same CLI), vitest, @types/node, `@postsaver/core` |
| `vitest.config.ts` · `tsconfig.json` | One shared emulator, so no file parallelism; longer timeouts · extends the base, node types |
| `test/rules.test.ts` | 117 cases. Documents are built exactly as the app will build them (`parse` → `saveId` → `newSave`), so core and rules can't drift. Also checks that `platforms()`/`kinds()` in the rules equal core's lists. Covers owner vs stranger vs signed out, unverified email, every field limit (in both directions), the id-from-link check, edits, tombstones, hard-delete timing, account deletion, collections, imports and closed paths |
| `hosting/index.html` | Placeholder page for the auth subdomain; Firebase serves `/__/auth/*` automatically |

**`scripts/`**: run with tsx. `tsconfig.json` includes `*.ts` with node types.

| File | What it does |
|---|---|
| `check-domains.ts` | Lists files with `git ls-files --cached --others --exclude-standard`. Skips `site.config.ts`, `brand/`, `pnpm-lock.yaml` and binaries. Case-insensitive search for `forbiddenLiterals()`; prints `file:line` and exits 1 |
| `config-get.ts` | `tsx scripts/config-get.ts <dotted.path>` over `{...site, hosts, origins}`. Prints strings raw, objects as JSON |
| `domain-apply.ts` | `gh api -X PUT repos/<owner>/<repo>/pages -f cname=…` for the web and embed repos; prints the manual console checklist; tries `https_enforced=true` on both |
| `gen-brand.ts` | sharp. `squareIcon(svg, size, scale, bg)` renders into `apps/web/public`: favicon.svg + favicon-32 from `mark-p.svg`; apple-touch 180, icon-192, icon-512 (scale 0.72) and maskable-512 (0.56, safe zone) from `mark.svg`; `og.png` 1200×630 from `logo-full.png` cropped to content, palette-compressed |

**`brand/`**

| File | Notes |
|---|---|
| `logo-full.png` | The owner's original: 1254×1254, mark + wordmark + tagline on white |
| `mark.svg` | Vector redraw in original pixel coordinates (`viewBox="444 268 450 427"`): gradient `ps-fill` (`#099AFE`→`#1469F9`→`#4B3CEF`→`#6636F2`→`#6A30F4`), bookmark-shaped cutout (evenodd), fold shading `ps-fold` clipped to the P, three spark strokes `#0B94FD` width 25 |
| `mark-p.svg` | The same without the sparks (`viewBox="434 268 376 427"`), used for the favicon |

**`docs/`**: `SETUP.md` (accounts, tools, repos, Firebase projects, API-key restriction, secrets table) and `DOMAIN_CHANGE.md` (the domain-change runbook).

**`.github/workflows/`**: `ci.yml` (job `check`) and `deploy.yml` (jobs `web`, `embed`, `resolver`), described in §4.2. Pinned actions: checkout v7.0.1, pnpm/action-setup v6.1.0, setup-node v7.0.0, upload-pages-artifact v5.0.0, deploy-pages v5.0.1.

### 4.5 Conventions for adding code
- **New config value:** add it to `site.config.ts`, then derive helpers in `packages/config/src/index.ts`. Never read the domain or brand anywhere else.
- **New HTML value:** add a token in `htmlTokens()` and use `%TOKEN%` in HTML.
- **New third-party origin:** extend `mainSiteCsp()`, and the Worker CORS list if relevant.
- **New page/route:** add `apps/web/<route>/index.html` + an entry in `build.rollupOptions.input`, and update robots/sitemap in `apps/web/vite.config.ts` if it's public.
- **New shared package:** `packages/<name>` with `exports` pointing at `src/*.ts`, a tsconfig that extends the base, explicit `.ts` import extensions, and a `typecheck` script (the root `pnpm typecheck` runs `pnpm -r typecheck`).
- **Generated files:** brand images are generated and committed (`pnpm brand`); `src/generated/` is generated at build and git-ignored.

---

## 5. Target repo layout (after Phase 1–2)

```
apps/web/  index.html (landing) · app/ (library) · save/ (capture) · share/ (Android target) · login/ · setup/
           privacy/ · terms/ · 404.html · canary/ (hidden) · ext-auth/ (v1.1)
           src/{auth,data,sync,capture,library,embeds-host,import,ui,lib}/
apps/embed/        sandbox page + per-platform renderers
apps/extension/    v1.1 MV3 extension (WXT; Chrome/Edge/Firefox)
workers/resolver/  /resolve /meta /batch
packages/core/     pure TS: URL engine, types, schema, validators, embed descriptors (fixture-tested)
packages/config/   (exists)
firebase/          rules + rules tests, indexes, emulator config
shortcuts/         v1.2 iOS Shortcut notes + version.json template
tests/e2e/         Playwright against the emulators
.github/workflows/ ci.yml · deploy.yml · canary.yml
```

---

## 6. Product design (the full plan)

### 6.1 Capture: every way a post gets in
Every path calls one idempotent **`saveLink()`** (in `packages/core` + `apps/web/src/capture`). Saving the same post twice never creates a duplicate.

- **`/save/`: the universal capture page**
  - **Input:** `?url=`, `?text=`, `?title=`. Take the **first http(s) URL** found in url, then text, then title, because Android apps put links inside `text`.
  - **Flow:** parse → canonicalize (§6.2) → deterministic id → `setDoc` *without awaiting the server*.
    - Show **"Saved ✓ · syncing…"** at once, then **"Saved ✓ · synced"** when `hasPendingWrites` turns false.
    - If the post exists: **"Already saved on 12 Sep. Move to top?"**
  - **Quick actions:** tag, collection, note, open library. It auto-closes when opened as a popup.
  - **Not signed in, or email unverified:** keep the pending URL in IndexedDB and save it automatically after login or verification.
  - **Budget:** confirmation in under 1.5 s on a mid-range Android over 4G. Precached shell, code-split Firebase SDK, never wait on the Worker.
- **Android (v1): Web Share Target**
  - Manifest: `share_target: { action: "/share/", method: "GET", params: { title, text, url } }` → same code as `/save/`.
  - **`/setup/` wizard:** Install button (`beforeinstallprompt`), a 3-step animated guide, then a **live test save**.
  - **Works offline:** the service worker serves `/share/`, and the Firestore write waits in the IndexedDB queue.
- **iPhone (v1.2): "Save to the brand" Apple Shortcut**, with no sign-in needed on the phone
  - Share sheet for URLs, Safari pages and text. **Import Question**: "Paste your save key".
  - **Actions:**
    1. Get URLs from input.
    2. Generate Hash (SHA-256) of the URL.
    3. POST to Firestore REST **`documents:commit`**, writing `inbox/{saveKey}/items/{hash}` with `currentDocument.exists=false` and an `updateTransforms` REQUEST_TIME for `createdAt` (plain REST create can't set server time).
    4. Notify "Saved ✓". An already-exists error counts as success.
  - It uses **only the Firebase project id + API key, no domain**, so it survives a domain change.
  - **Save key:** 32 random bytes, base64url (43 characters), stored at `/inboxTokens/{key}` = `{uid, createdAt}`. Regenerate (requires recent login) revokes the old key.
  - **Moving items:** any open, owned app instance listens to its inbox, runs `saveLink()` for each item and deletes it.
  - **Updates:** the Shortcut checks `https://<domain>/shortcuts/version.json`.
  - Until v1.2, `/setup/` shows "iPhone share button coming soon" on iPhone; the website and paste still work.
- **Desktop & bulk**
  - **Bookmarklet:** generated from config; opens `/save/?url=` in a 420×560 popup that auto-closes.
  - **Paste box:** one link per line.
  - **Import (v1), with a progress UI and throttled queue (§6.11):**
    - Browser bookmarks HTML, CSV, and **Dewey CSV**.
    - **Instagram "Download your information"** (JSON, "Saved" only): unzipped in the browser with `fflate`, streaming to find `saved_posts.json` and collections, with a tolerant parser and fixtures.
    - **Re-importing reconciles removals** according to the user's setting.
    - TikTok favorites and Facebook saved exports come in v1.x.
- **v1.1 extension:** see §9.

### 6.2 URL engine (`packages/core`), the core of robustness
Pure functions with no network access, tested against **hundreds of real share-URL fixtures** from each platform's Android app, iOS app and web.

`parse(url) → { platform, kind, platformId, author?, canonicalUrl, needsResolve, embed | null }`

**Pipeline:**
1. Trim, add `https://` if missing, decode, lowercase the host, drop `www.`/`m.`/`mobile.`.
2. **Strip tracking params:** `utm_*`, `igsh`, `igshid`, `si`, `feature`, `pp`, `s`/`t` (X), `share_id`, `rdt`, `xmt`, `slof`, `is_from_webapp`, `sender_device`, `rcm`, `fbclid`, `mibextid`, `ref`, …
3. Match the platform pattern and build the canonical URL.

| Platform | Patterns | Stable ID | Needs resolve (Worker) |
|---|---|---|---|
| Instagram | `/p/{c}`, `/reel/{c}`, `/reels/{c}`, `/tv/{c}`, `/{user}/p/{c}`, `/{user}/reel/{c}`; stories/profiles → link card | shortcode | `instagram.com/share/…` |
| X | x.com, twitter.com, mobile., fxtwitter/vxtwitter/fixupx → `/{u}/status/{id}`, `/i/web/status/{id}`, `/i/status/{id}` | status id | `t.co/…` |
| TikTok | `/@{u}/video/{id}`, `/@{u}/photo/{id}`, `m.tiktok.com/v/{id}.html` | video id | `vm.`/`vt.tiktok.com`, `tiktok.com/t/…` |
| YouTube | `watch?v=`, `youtu.be/{id}`, `/shorts/{id}`, `/live/{id}`, `/embed/{id}`, `music.`; keep `t` (start) and `list`; strip `si` | video id | none |
| Reddit | `/r/{s}/comments/{id}/…`, `/comments/{id}`, old./new./np., comment permalinks, `redd.it/{id}` (offline) | post id (+comment) | `/r/{s}/s/{code}` |
| Facebook | `/{u}/posts/{id or pfbid…}`, `permalink.php?story_fbid=&id=`, `/reel/{id}`, `/watch/?v=`, `/{page}/videos/{id}`, `/photo?fbid=`, `/groups/…` (→ link card) | post/video id | `fb.watch/…`, `/share/{p,r,v}/…` |
| LinkedIn | `/posts/{slug}-activity-{id}-…`, `/feed/update/urn:li:{activity,share,ugcPost}:{id}` | urn type + id | `lnkd.in/…` |
| Threads | threads.com / threads.net `/@{u}/post/{code}` → canonical **threads.com** | code | none |
| Pinterest | `*.pinterest.*/pin/{id}` (all country domains) | pin id | `pin.it/…` |
| Bluesky | `bsky.app/profile/{handle or did}/post/{rkey}`; resolve the handle → **DID in the browser** (`public.api.bsky.app`) and store the DID, since handles change | did + rkey | none |
| Other | any http(s) → generic link card | sha256(canonical) | none |

- **Doc id** = `${platform}_${platformId}`, otherwise `url_${sha256(canonicalUrl)[0..24]}`.
- **When a short link resolves later:** if the canonical id already exists, **merge** tags, notes, collections and favorite into it and tombstone the short-link doc. Otherwise create the canonical doc and tombstone the short-link doc.

**As built (2026-09-29): decisions made while implementing** (code map in §4.4)
- **Invalid input:** `parse()` returns **null** for input we can't store (no link, a non-http scheme, a host without a dot, over 2048 characters).
- **`originalUrl`:** the link as shared, with the scheme added. It falls back to the canonical URL when too long.
- **`resolveVia`:** always set together with `needsResolve`.
  - `"redirect"`: the Worker follows it.
  - `"bsky-handle"`: the browser looks up the DID.
- **Unresolved links get a `url_…` id**, then merge as described above once resolved.
- **Worker allowlist:** `/resolve` should allow exactly the URLs where `parse(u)?.resolveVia === "redirect"`, re-checked on every hop, so core stays the single source of truth.
- **t.co and lnkd.in are platform `web`**, not X or LinkedIn, because they wrap *any* link inside a post (app shares use the real URL). The same goes for bit.ly, tinyurl, amzn.to and the other generic shorteners.
- **Every canonical URL parses back to itself** (tested). That's why `/tv/{c}/` (kind video) and `/live/{id}` (kind live) keep their own paths.
- **Other pages on a known platform** (explore, search, events…) stay under that platform as `kind: "link"`.
- **Posts we don't embed** (Facebook group posts, stories) get `embed: null`.
- **Kinds:** X and Threads posts are both `post`; there is no "tweet" or "thread" kind.
- **Canonical form when the username is unknown:**
  - X: `x.com/i/status/{id}` (verified with X's oEmbed).
  - Threads: `threads.com/t/{code}`.
  - TikTok: `tiktok.com/@/video/{id}`. This is **unverified**, because tiktok.com doesn't respond from the owner's network; the canary must check it.
- **Reddit comments** use `/comments/{id}/comment/{cid}/`, the form Reddit's own oEmbed returns.

### 6.3 Resolver Worker (`post-saver-resolver`, Cloudflare free plan)
Limits: 100k requests/day (resets 00:00 UTC), **10 ms CPU** per request, 50 subrequests per request.

- **Auth:** `Authorization: Bearer <Firebase ID token>`, verified with `jose` against Google's securetoken JWKS (checking `aud` = project id, `iss`, `exp`, and `email_verified`). No secrets.
- **`GET /resolve?url=`:**
  - Allowlisted short-link hosts only; https only; no IP literals or custom ports.
  - Redirects are followed manually (`redirect:"manual"`, reading `Location`), at most 5 hops, re-checking the host on **every** hop. 5 s timeout. Returns `{finalUrl}`. This prevents SSRF and open-proxy abuse.
- **`GET /meta?url=`** → `{title, author, thumb?}`:
  - Open oEmbed: YouTube, TikTok, X (`publish.x.com/oembed`), Reddit, Vimeo, Spotify.
  - **Meta tokenless oEmbed** (since June 2026) for Instagram, Facebook and Threads. It returns only `html`, so author and caption are extracted from it. **Store this data only if Meta's terms allow caching** (pre-launch check); otherwise keep it in the local cache only.
  - Generic pages: `og:` tags via `HTMLRewriter`, stopping at `</head>` or 256 KB.
  - Thumbnails are stored **only from stable hosts** (i.ytimg.com); other platforms' image URLs expire.
- **`POST /batch`:** at most 40 URLs, for imports.
- **Other behaviour:**
  - Cloudflare Cache API: 7 days for resolve, 1 day for meta.
  - CORS allowlist from config.
- **Failures are never fatal.** Keep `needsResolve`/`needsMeta` + `originalUrl` and retry with backoff (at most 5 tries, including from the v1.1 extension on the user's own IP). Expect datacenter-IP blocks from Reddit, Facebook and Instagram, and verify each in testing.

### 6.4 Data model & Firestore rules

```
/config/app                     public read; admin-only write:
                                { minClientVersion, maintenance, notice, disabledEmbeds[], importPaused, importDailyCap, inboxEnabled }
/users/{uid}                    { email, displayName, createdAt, saveKey?, settings{view, theme, previews: ask|always|click, onUnsave: remove|keep}, schemaVersion }
/users/{uid}/saves/{saveId}     save document (below)
/users/{uid}/collections/{cid}  { name ≤60, emoji?, color?, order, createdAt, updatedAt, deleted? }
/users/{uid}/imports/{jobId}    { type, total, done, cursor, status, createdAt, updatedAt }
/inboxTokens/{saveKey}          { uid, createdAt }                                   (v1.2)
/inbox/{saveKey}/items/{sha256} { url ≤2048, text? ≤2000, source, createdAt (REQUEST_TIME) }   (v1.2)
```

**Save document fields**
- `url` (canonical, ≤2048) · `originalUrl` · `platform` (enum) · `kind` (post, reel, video, short, tweet, pin, thread, link…) · `platformId?`
- `author?` ≤100 · `title?` ≤500 · `thumb?` (stable hosts only) · `note?` ≤5000
- `tags[]` (≤30, each ≤40 chars, lowercase) · `collectionIds[]` (≤50) · `favorite`
- `status` (active or trashed) · `trashedAt?` · `deleted` (tombstone)
- `source` (web, share-android, ios-shortcut, bookmarklet, import-*, extension, sync-*)
- `savedAt` (original save time, kept on import) · `createdAt` · **`updatedAt` = server time**
- `embedStatus` (ok, unavailable, unknown) + `embedCheckedAt` · `onPlatform?` (per-platform lastSeenAt/removedAt) · `needsResolve` · `needsMeta` · `schemaVersion`

**Indexes:** `note`, `title`, `thumb`, `originalUrl`, `text` and `onPlatform` are exempt from single-field indexes. The only query is `updatedAt > X`, which uses the automatic index. No composite indexes.

**Rules (deny by default)**
- **`users/{uid}/**`:** owner only, and **writes need `request.auth.token.email_verified == true`**.
- **Every create and update runs through a validator:** `keys().hasOnly([...])`, types, size caps, `url.matches('^https?://.+')`, platform enum, and `updatedAt == request.time`.
- **Updates:** `diff().affectedKeys()` restricts which fields may change.
- **`inboxTokens/{k}`:**
  - create only if `k.size() == 43` and `data.uid == request.auth.uid` (verified email)
  - get/delete by the owner only
  - **`list: if false`**
- **`inbox/{k}/items/{id}`:**
  - **Unauthenticated create** is allowed only if all of these hold:
    - `exists(/inboxTokens/k)`
    - `get(/config/app).data.inboxEnabled` (a remote kill switch)
    - the field allowlist
    - `url.size() <= 2048`
    - `createdAt == request.time`
  - Optionally, `id == hashing.sha256(url).toHexString()`.
  - Read/delete only by the key's owner.
- **Rules tests** run in CI on the emulator: owner vs stranger, unverified email, extra keys, oversize fields, a forged uid, inbox writes with valid, revoked and wrong keys, and the kill switch. **Rules deploy only when green** and must stay backward compatible with the live client.

**As built (2026-09-29): v1 rules and schema** (`firebase/firestore.rules`, `packages/core/src/schema.ts`)
- **Saves, required fields:** url, originalUrl, platform, kind, platformId (string or null), tags, collectionIds, favorite, status, `deleted: false`, source, savedAt, createdAt, updatedAt, embedStatus, needsResolve, needsMeta, schemaVersion.
- **Saves, optional fields:** author, title, thumb, note, trashedAt (required when status is trashed), embedCheckedAt. Optional fields are **left out, never null**; remove one with `deleteField()`.
- **The document id must come from the link:** `{platform}_{platformId}` when the platform id is safe, otherwise `url_` + the first 24 hex of sha256(url), recomputed in the rules with `hashing.sha256`. The same post saved twice is always one document, even with a buggy client.
- **Create:** createdAt and updatedAt must be the server time (`serverTimestamp()`).
- **savedAt:** may be in the past (imports), and at most 1 hour ahead, which covers device clocks on offline saves.
- **Edits:** only the editable fields may change (see `saveEditable()`): author, title, thumb, note, tags, collectionIds, favorite, status, trashedAt, savedAt ("move to top"), updatedAt, embedStatus, embedCheckedAt, needsResolve, needsMeta, schemaVersion. The link and its identity never change; a resolved short link becomes a new document.
- **Delete = tombstone:** overwrite the document with exactly `{deleted: true, updatedAt: serverTimestamp(), schemaVersion}` (`tombstone()`). Saving the post again later overwrites the tombstone with a fresh document.
- **Hard delete** is allowed only for tombstones **older than 60 days**, or for anything while `users/{uid}.deleting == true`. The account-deletion flow sets that flag first, then deletes saves → collections → imports → the user doc → the auth user.
- **Two saves of the same new post (two devices offline):** the second create is refused, not duplicated. Later edits from that device still apply as normal updates.
- **Lists (tags, collectionIds):** rules can't loop, so a list is joined with commas and checked with one pattern. `v.hasOnly(v.join(',').split(','))` proves every element is a string without a comma, because `join` alone turns `42` into `"42"`.
  - Tags: ≤ 30, each 1–40 characters, no commas or capital A–Z.
  - Collection ids: ≤ 50, `[A-Za-z0-9]{1,40}`.
- **Rules count characters, not bytes** (tested with a 5,000-character Hindi note).
- **Other checks:**
  - source: `web|share-android|ios-shortcut|bookmarklet|paste|extension|import-*|sync-*`.
  - thumb: only `https://i.ytimg.com/…`.
- **Collections:** name 1–60, optional emoji (≤ 16) and color `#rrggbb`, a numeric order, and the same tombstone and delete pattern.
- **Imports:** type, total (≤ 100,000), done (≤ total), cursor (index of the next item in the file), status (running, paused, done, failed, cancelled), and an optional error. The type and createdAt can't change after the start.
- **User doc:** email must equal the sign-in token's email; settings is a map of the four enums; optional displayName (≤ 100), syncEpoch (int; bump it to force a full resync on every device) and deleting (bool).
- **Reads:** owner only, and allowed with an unverified email (the owner just can't write). There are no collection-group reads. `config/*` is public read and never writable from clients.
- **Deferred:** the inbox rules and `saveKey` come in v1.2, and `onPlatform` in v2, each with their own tests. Those paths and fields are rejected until then.
- **Checked by breaking rules on purpose:** removing the verified-email check, the id check or the hard-delete check each makes tests fail.

### 6.5 Sync engine: offline, multi-device, quota-safe
- **SDK setup:**
  - `initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager(), cacheSizeBytes: CACHE_SIZE_UNLIMITED }) })`
  - The cache **must be unlimited**, because evicted docs would never come back through delta sync.
  - `navigator.storage.persist()` after the first save.
- **Startup:**
  1. Render from the cache (`getDocsFromCache`).
  2. Attach **one delta listener**: `saves where updatedAt > (highest server updatedAt seen − 5 min)`. The watermark comes from the server, never the device clock.
  3. Only changed docs cost reads. A listener that reattaches after more than 30 minutes is billed like a fresh full query.
- **Wiped-cache detection:** a sentinel with the `syncEpoch`. If it's missing (the cache was cleared, or Safari deleted data after 7 days without a visit) or `lastSync` is older than **45 days** → **full resync**.
- **Delete timeline:**
  1. Trash, 30 days, restorable.
  2. Tombstone (fields stripped, `deleted: true`, `updatedAt` bumped).
  3. Hard delete **60 days** later.
  - Full-resync threshold (45 days) < tombstone retention (60 days), so no device misses a delete.
  - With no Cloud Functions, purging runs client-side when the owner opens the app, plus the admin job in `post_saver_ops`.
- **Conflicts:** field-level `updateDoc`; `arrayUnion`/`arrayRemove` for tags and collections; otherwise the last write wins per field.
- **Search:** in memory with MiniSearch over title, author, tags, note, platform and URL.
- **Status indicator:** Synced · Syncing… · Offline (N waiting) · **"Cloud sync paused until tomorrow — your saves are safe on this device"** when a `resource-exhausted` error arrives. Also `config/app.notice` banners.
- **Migrations:** `schemaVersion` per doc; clients read old versions and upgrade lazily on the next edit.

### 6.6 Library UI & embeds
- **Landing:** hero, 3 steps, supported platforms, the privacy promise ("we store only links"), "better than the save button", FAQ, CTA. The current coming-soon version is live.
- **Library `/app/`:**
  - **Grid** (masonry of embeds) and **List** (compact rows).
  - **Top bar:** search, platform chips, sort (newest saved, oldest, recently updated).
  - **Sidebar:** All, Favorites, Collections, Tags, Unavailable, Removed on platform, Trash.
  - **Card menu:** open original, copy link, favorite, tags, collection, note, delete.
  - **Multi-select** bulk actions. **Desktop shortcuts:** `/` search, `n` add, `f` favorite, `e` tags.
- **`/setup/`:** device-aware (Android install + share demo, desktop bookmarklet, iPhone later), ending with a live test save.
- **Settings:** profile, save key (v1.2), preview mode, on-unsave behaviour, theme, import, export, delete account.
- **Design standards:** mobile-first, light/dark, WCAG AA, no layout shift, respects reduced motion; all brand text comes from config. Font: Outfit Variable (self-hosted via `@fontsource-variable/outfit`).
- **Embeds, always inside the sandbox iframe on `embed.<domain>`:**
  - iframe attributes: `sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation"`, `loading="lazy"`, strict referrer policy.
  - The sandbox reads the `#fragment` (`p`, `k`, `id`, `u`, `theme`). It renders with the platform's **direct iframe URL** where one exists, otherwise the official script, and reports `ps:height` / `ps:status` (ok, unavailable, blocked).

| Platform | Render inside the sandbox |
|---|---|
| Instagram | `instagram.com/p/{code}/embed/captioned/` iframe; fallback blockquote + embed.js |
| X | `platform.x.com/widgets.js` → `twttr.widgets.createTweet(id)` (`undefined` = unavailable) |
| TikTok | `tiktok.com/player/v1/{id}` iframe |
| YouTube | Facade (i.ytimg thumbnail) → `youtube-nocookie.com/embed/{id}` (≥200×200 per YouTube rules) |
| Reddit | `embed.reddit.com` iframe |
| Threads | `blockquote.text-post-media` + `https://www.threads.com/embed.js` |
| Pinterest | `assets.pinterest.com/ext/embed.html?id={pinId}` iframe |
| Facebook | `facebook.com/plugins/post.php?href=` / `video.php?href=` (Like/Comment plugins died Feb 2026; Embedded Posts/Video still work) |
| LinkedIn | `linkedin.com/embed/feed/update/urn:li:{type}:{id}` iframe |
| Bluesky | `embed.bsky.app` with the stored `at://did/…/rkey` |
| Others | Link card (favicon, domain, title from `/meta`) in the main app, with no iframe |

**Rendering rules**
- Frames mount near the viewport (IntersectionObserver), at most **3 loading at once**.
- Heights are cached per item, and frames far off-screen unmount (TanStack Virtual `lanes` for masonry).
- A 10 s timeout, a blocked script (ad-blocker) or an unavailable post → a **link card with the reason**. The item gets `embedStatus: unavailable` and is re-checked after 7 days.
- **Our own card header** always sits outside the frame (platform, author, date, "Open original"). Never overlay the embed.
- **Preview consent** on first run: [Always show] / [Click to load], defaulting to click-to-load for Europe time zones.
- `config/app.disabledEmbeds` is a remote kill switch per platform.

### 6.7 Authentication
- **`authDomain = auth.<domain>`** in prod (Firebase Hosting). It's same-site with `<domain>`, so storage partitioning doesn't break sign-in. **Verify in Safari, Firefox and Chrome.**
- **Which flow where:**
  - Popup on desktop and mobile browsers.
  - Redirect in the installed (standalone) PWA.
  - Email/password works everywhere.
- **In-app browsers** (Instagram, Facebook, TikTok, LinkedIn, Snapchat webviews, detected by UA): Google blocks OAuth there, so show "Open in Chrome/Safari" + copy link. Email/password still works.
- **Email/password:**
  - Verification (1,000/day), password reset (**150/day**), enumeration protection (on).
  - Saves are captured locally until the email is verified, then sync after `getIdToken(true)`.
- **Re-authentication** before account deletion and save-key regeneration.
- **Session:** IndexedDB persistence. On iPhone, the home-screen app and Safari keep separate sessions; the Shortcut needs none.
- **v1.1 extension:** `firebase/auth/web-extension` (SDK ≥10.8). Email/password runs directly; Google runs through an offscreen document that iframes `<domain>/ext-auth/`, which calls `signInWithPopup`. Add `chrome-extension://<id>` to the authorized domains.

### 6.8 Privacy, legal & platform terms
- **Privacy policy + terms**, generated with brand, domain and contact from config. Required for Google OAuth branding and the Chrome Web Store. They cover:
  - What we store: links + what users add. What we never store: media, passwords, sessions.
  - That previews load from the platforms and may set cookies.
  - Our processors: Google Firebase, Cloudflare, GitHub.
  - Retention (§6.5), export and deletion rights, and the contact email.
- **Embeds only:** never download or re-host content; no scraping in v1. Attribution stays intact. **Pre-launch checks:** Meta terms on storing oEmbed-derived text; YouTube and X display rules.
- **Trademarks:** platform names and icons are used only to identify the source (Simple Icons), with a "not affiliated" footer.
- **User rights in v1:** export (JSON, CSV, bookmarks HTML) and resumable **delete account** (saves → collections → imports → inbox + token → user doc → auth user).
- **Analytics:** Cloudflare Web Analytics (cookie-less, so no consent banner for our own tracking).
- **GitHub Pages terms forbid running a commercial SaaS on it.** That's fine while the app is free; if it's ever monetized, move the static hosting to Cloudflare Pages (free, same repo, real headers).

### 6.9 Security & abuse hardening
- **Rules are the only gatekeeper** (§6.4), tested and deployed only when green.
- **Third-party code isolation** (§4.3, §6.6).
- **Main-site CSP via a meta tag**, since Pages can't set headers; built in `mainSiteCsp()`:
  - `script-src 'self'` + Google/Firebase sign-in
  - `frame-src` limited to embed.<domain>, auth.<domain> and accounts.google.com
  - `connect-src` limited to the Firebase APIs + `apiBaseUrl`
  - No inline scripts.
- **Clickjacking:** `frame-ancestors` can't be set with a meta tag, so a JS frame-bust runs on Settings and Delete.
- **XSS:** user text is rendered as text only. Links open only for `https?:`. Embed descriptors are built from **parsed ids**, never raw HTML.
- **Browser API keys** (both projects) are restricted by API only (not by referrer, because the Shortcut sends none) to Identity Toolkit, Token Service, Firestore, Firebase Installations and App Check. A new Firebase feature failing with `API_KEY_SERVICE_BLOCKED` needs its API added.
- **Quota abuse:** verified-email writes, size caps, import throttling, listeners only (never polling), kill switches in `config/app`.
- **CI/CD:** actions pinned by SHA; secrets only in the `production` environment (main branch only); Workload Identity Federation for Google deploys from CI (planned, no JSON keys); Dependabot (planned); secret scanning.
- **v2 hardening:** route Shortcut writes through the Worker, which unlocks **App Check enforcement** on Firestore and real per-key rate limits.

### 6.10 Reliability & operations
- **CI:** lint, typecheck, `check:domains`, unit, rules and e2e tests, build.
- **Deploy order:** rules + indexes → Worker → embed → web. Rules must be backward compatible with the live client.
- **Versioning:** build id + service-worker **"New version — tap to refresh"** prompt; forced reload below `config/app.minClientVersion`; CHANGELOG + semver.
- **`canary.yml`** (daily): headless Chromium loads a hidden `/canary/` page (one public post per platform) plus sample `/resolve` calls. It **opens a GitHub issue after 2 consecutive failures**, because runner IPs sometimes get login walls.
- **Backups** (`post_saver_ops`, private, weekly, just after Pacific midnight):
  - Incremental by `updatedAt` (collection-group query), full snapshot monthly.
  - Encrypted with `age`, 12 weeks kept.
  - The same job hard-deletes tombstones older than 60 days.
  - Test the restore quarterly.
  - Admin reads count against the shared 50k/day quota.
- **Monitoring:** Firebase usage dashboard, a weekly review, alerts at 60% of the daily quotas. Optional Sentry free plan (no PII).

### 6.11 Free-tier budget (Spark, project-wide)

| Resource | Free limit | Est. per active user/day | Supports roughly |
|---|---|---|---|
| Firestore writes | 20k/day (resets at Pacific midnight) | ~10 | ~2,000 DAU (excluding imports) |
| Firestore reads | 50k/day | ~25 (delta sync) | ~2,000 DAU |
| Firestore deletes | 20k/day | ~2 | plenty |
| Firestore storage / egress | 1 GiB / 10 GiB per month | ~1 KB per save | ~1M saves |
| Auth | 50k MAU; 100 sign-ups/hour/IP; 1k verification + 150 reset emails per day | — | plenty |
| Worker | 100k requests/day, 10 ms CPU | ~10 | ~10,000 DAU |
| Firebase Hosting (auth. only) | 10 GB, 360 MB/day | tiny | plenty |
| GitHub Pages | 1 GB site, ~100 GB/month soft, 10 builds/hour | static | plenty |

- **Cloud Storage and managed Firestore exports need Blaze**, so neither is used.
- **Imports are the main quota risk.** Cap them at **≤500 items per user per day** (`importDailyCap`, adjustable remotely), resume the next day with progress shown ("1,000 of 3,000 imported · continues tomorrow"), and pause globally with `importPaused`.

---

## 7. Top risks & mitigations (ranked)

| # | Risk | Mitigation |
|---|---|---|
| 1 | Shared daily quota exhausted, so everyone's sync pauses until Pacific midnight | Delta sync, throttled imports, verified-email writes, size caps, 60% alerts, kill switches, Blaze decision |
| 2 | Platform scripts stealing sessions | Embeds only on embed.<domain>, strict CSP, parsed-id descriptors |
| 3 | Sign-in failures (partitioning, standalone PWA, in-app browsers) | auth.<domain> on Firebase Hosting, popup/redirect by context, email fallback, device matrix |
| 4 | Embed or URL formats change | Fixtures, daily canary, link-card fallback, remote `disabledEmbeds` |
| 5 | A late domain change disrupts users | One config file + runbook; switch before public launch; old-domain redirect |
| 6 | Leaked save key used to spam an inbox | 256-bit keys, regenerate, hashed ids, size caps, `inboxEnabled`; v2 Worker + App Check |
| 7 | Silent sync gaps or data loss | Unlimited cache, sentinel + full resync, tombstone timeline, encrypted backups + tested restore |
| 8 | Short links fail to resolve | Retries, `originalUrl` kept, extension resolves locally, caching |
| 9 | v2 auto-sync conflicts with platform terms (Meta) | Opt-in, read-only, throttled, kill switch; data-export imports as the safe default |
| 10 | Secrets leaking via public repos | Environments, deploy key scoped to one repo, SHA-pinned actions, secret scanning, WIF |

---

## 8. Live infrastructure inventory

### 8.1 GitHub (owner `blackdot789`, numeric id 334481207)

| Repo | Visibility | Pages | Notes |
|---|---|---|---|
| `post_saver` | public | build_type **workflow**, custom domain `<domain>`, **HTTPS enforced**; `www` → 301 to apex | Environment **`production`** (deployment branch policy: `main` only) holds secrets `EMBED_DEPLOY_KEY` and `CLOUDFLARE_API_TOKEN`. The `github-pages` environment is automatic |
| `post_saver_embed` | public | branch `main` / root, custom domain `embed.<domain>` (from the `CNAME` file), **HTTPS enforced** | Deploy key "post_saver CI deploy" (read-write). Content = embed build output, force-pushed by CI. Issues disabled |
| `post_saver_ops` | private | — | Empty; will hold backup and cleanup workflows |

The domain is **verified** on the blackdot789 account (TXT `_github-pages-challenge-blackdot789`).

### 8.2 Firebase / Google Cloud (owner `kerdostack@gmail.com`)

| | `post-saver-dev` (number 96165435237) | `post-saver-prod` (number 650431358172) |
|---|---|---|
| Web app id | `1:96165435237:web:6c02c349e9286d812cb38c` | `1:650431358172:web:8188bcd18fcfa9f3350019` |
| Firestore | `(default)`, `nam5`, native mode; deny-all rules deployed | same |
| Auth | Google + Email/Password on; enumeration protection on | same; **authorized domains** include `<domain>`, `www.<domain>`, `auth.<domain>` |
| Hosting | — | site `post-saver-prod.web.app` serving `firebase/hosting/` (auth helpers only); custom domain `auth.<domain>` is **active** (CNAME live; `/__/auth/handler` returns 200 over HTTPS; the cert was propagating on 2026-09-27) |
| Browser API key | restricted to 5 APIs (§6.9) | same |

The web configs (apiKey, projectId, appId, messagingSenderId) are in `site.config.ts`; they're public by design.

**OAuth (Google Auth Platform, prod):**
- The owner set Branding (app name, support email, authorized domain) **without a logo**, because a logo triggers a Google review. The logo and privacy/terms links get added before launch.
- The owner was asked to add redirect URI `https://auth.<domain>/__/auth/handler` to "Web client (auto created by Google Service)". **This hasn't been verified**; confirm it when sign-in is first tested.

### 8.3 Cloudflare (owner `kerdostack@gmail.com`)
- Account id `d6243ded1f47348d69121fdc54c4fc01` (in `workers/resolver/wrangler.jsonc`).
- workers.dev subdomain `postsaver-resolver`; Worker `post-saver-resolver` is live at `site.apiBaseUrl`.
  - `/health` → `{"ok":true,"service":"resolver","phase":0}`
  - CORS echoes only config origins.
- The CI token was created from the "Edit Cloudflare Workers" template.

### 8.4 DNS at Hostinger (nameservers `apollo.dns-parking.com`, `athena.dns-parking.com`)

| Type | Name | Value | State |
|---|---|---|---|
| A ×4 | @ | 185.199.108.153 · 185.199.109.153 · 185.199.110.153 · 185.199.111.153 | live |
| AAAA ×4 | @ | 2606:50c0:8000::153 · 2606:50c0:8001::153 · 2606:50c0:8002::153 · 2606:50c0:8003::153 | live |
| CAA ×2 | @ | `0 issue "letsencrypt.org"` · `0 issue "pki.goog"` | live |
| CNAME | www | blackdot789.github.io | live |
| CNAME | embed | blackdot789.github.io | live |
| TXT | _github-pages-challenge-blackdot789 | GitHub verification code | live |
| CNAME | auth | post-saver-prod.web.app | live (Firebase Hosting custom domain active) |
| TXT | auth | `hosting-site=post-saver-prod` | still present alongside the CNAME. Hostinger allowed it, but CNAME + other records at one name is invalid DNS, so **the owner was asked to delete it**; it's no longer needed |

Hostinger's original parking records (A @ → 147.79.69.170 / 91.108.106.12, CNAME www → `*.cdn.hstgr.net`) were removed. Verify DNS with `dig +short <type> <name> @athena.dns-parking.com +norecurse`. In zsh, pass the type and name as separate arguments; `set -- $var` doesn't word-split.

### 8.5 Local machine (owner's Mac, arm64, macOS 26)
- **Tools:** Homebrew, git, Node 26 (brew; Node 22 also present), pnpm 12.6, gh 2.101, firebase-tools 15.x, gcloud, Java 21 (Temurin), wrangler (per project).
- **Logged in:** `gh` as blackdot789; `firebase`, `gcloud` and `wrangler` as `kerdostack@gmail.com`.
- Headless Chrome for screenshots: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome --headless=new --screenshot=… --window-size=W,H URL`. The minimum window width is about 500 px, so for phone widths screenshot a page that iframes the site at 390 px. Add `--blink-settings=preferredColorScheme=1` for light mode (0 = dark; the Mac defaults to dark).

---

## 9. Roadmap & status

### Phase 0: Foundations ✅ (2026-09-27)
- [x] Accounts, CLI logins, git repo with repo-local identity
- [x] `site.config.ts` + `packages/config` + `check:domains` + `config-get` + `domain-apply`
- [x] Brand redraw + generated icons/OG; coming-soon landing + 404 live on `<domain>`
- [x] Embed sandbox placeholder live on `embed.<domain>`; resolver Worker skeleton live
- [x] Firebase dev/prod, web apps, Firestore nam5, deny-all rules, auth hosting site, Auth providers, API key restriction
- [x] CI + deploy workflows (web, embed, resolver) green
- [x] `auth.<domain>` CNAME live, Firebase Hosting domain active (the leftover TXT should be deleted)
- [x] Vitest (added with Phase 1 step 1)
- [ ] ESLint + Prettier; Dependabot; `main` branch protection
- [ ] Privacy/terms drafts; design tokens + base components for `/app/`
- [ ] Emulator smoke test; Workload Identity Federation for Firebase deploys from CI (rules are deployed manually for now)

### Phase 1: v1.0 MVP (next)
1. [x] `packages/core` URL engine + fixture suite (§6.2) (2026-09-29)
2. [x] Firestore schema, rules and the rules test suite (§6.4) (2026-09-29; **deploy to both projects pending the owner's OK**)
3. [ ] Auth: popup/redirect by context, email verification, in-app-browser handling (§6.7)
4. [ ] `saveLink()`, `/save/`, `/share/`, offline queue, dedupe, pending/synced states (§6.1)
5. [ ] Sync engine + status UI (§6.5)
6. [ ] Embed sandbox renderers + host component + fallbacks + preview consent (§6.6)
7. [ ] Library features: grid/list, search, filters, collections, tags, notes, favorites, bulk actions, trash, unavailable
8. [ ] Resolver Worker `/resolve`, `/meta`, `/batch` + the enrichment/retry queue (§6.3)
9. [ ] Android install + share target (tested on the OnePlus Nord 5); bookmarklet; `/setup/` (Android + desktop)
10. [ ] Import (bookmarks, CSV, Dewey CSV, **Instagram export + reconcile**) + export + delete account
11. [ ] PWA polish (vite-plugin-pwa, update prompt), accessibility, performance budgets, full landing, SEO
12. [ ] Canary, backups, monitoring, `config/app` switches
13. [ ] Private beta (10–20 testers) → fixes → **final domain switch** (§10) → **Blaze decision** → public launch

### Phase 2: v1.1 browser extension
- **Framework:** WXT, MV3, for Chrome, Edge and Firefox.
- **Features:** toolbar Save, right-click "Save link", keyboard shortcut, "already saved" check.
- **Permissions:** `activeTab`, `contextMenus`, `storage`, `offscreen`. **No broad host permissions.**
- **Auth:** per §6.7.
- **Short links:** resolved locally when the Worker is blocked.
- **Stores:** Chrome Web Store ($5), Edge and Firefox (free).
- **Also in v1.x:** TikTok and Facebook export imports.

### Phase 2b: v1.2 iPhone
The Apple Shortcut + save key + inbox rules and tests + inbox processing + iPhone steps in `/setup/` (§6.1). This needs an iPhone for testing.

### Phase 3: v2.0 desktop auto-sync of native saves (the direct Dewey-beater)
- **Opt-in per platform** with `optional_host_permissions`. Read-only, using the user's own logged-in session.
- **Full reconcile:** detect **added and removed** posts, including changes made on the phone.
- **When it runs:** Chrome start, `chrome.alarms` every 30 min, when the library opens, and on Sync now. About 1 request every 2 s; the removal scan runs at most every 6 h.
- **Visible status:** "Instagram · synced 4 min ago · 3 added, 1 removed", stored in `/users/{uid}/syncState/{platform}`.
- **Unsave setting:** remove from the library, or keep with a label.
- **Safety:** isolated adapters with recorded-fixture contract tests and a remote kill switch.
- **Order:** Instagram → X → LinkedIn → Reddit → TikTok → YouTube → Facebook → Threads → Pinterest.
- **Other v2 work:** Shortcut writes through the Worker + App Check; caption enrichment for search.

### Phase 4: v3+
Shareable read-only collections, a weekly "resurface" email (Cloudflare Cron + a free email tier), AI tagging (once there's revenue), a native iOS app with a share extension, a Telegram bot, a Safari extension, more languages.

---

## 10. Runbooks & pending owner tasks

**Pending (owner):**
1. At Hostinger, delete the leftover TXT `auth` (`hosting-site=post-saver-prod`); the CNAME `auth` → `post-saver-prod.web.app` stays.
   - Check the Firebase Hosting custom-domain status with:
     `curl -H "Authorization: Bearer $(gcloud auth print-access-token)" -H "x-goog-user-project: post-saver-prod" https://firebasehosting.googleapis.com/v1beta1/projects/post-saver-prod/sites/post-saver-prod/customDomains`
   - Expect `hostState` HOST_ACTIVE and the cert active.
2. When sign-in is first tested, confirm the OAuth redirect URI (§8.2).

**Before launch (owner):**
- Final domain + brand.
- Blaze decision.
- Read the privacy/terms drafts.
- Submit OAuth brand verification (logo + privacy/terms links).
- v1.1: Chrome Web Store $5.

**Domain change** (full runbook in `docs/DOMAIN_CHANGE.md`):
1. **Code:**
   - Edit `site.config.ts` (and `brand/` + `pnpm brand` if rebranding).
   - Run `pnpm verify`, then merge.
   - Run `pnpm domain:apply` (re-run after the certificates exist, to enforce HTTPS).
2. **Owner:**
   - DNS at the new registrar (the same record set as §8.4).
   - Verify the domain on GitHub **first**.
   - Firebase Hosting `auth.<new>`.
   - Firebase authorized domains.
   - OAuth redirect URI + branding domain.
   - Forward the old domain for about 90 days.
3. **Users** must sign in again, reinstall the Android app and re-add the bookmarklet. Saved data is untouched.

---

## 11. Verification & launch gates

**Automated (every PR, once the tests exist)**
- `pnpm check:domains`: no domain or brand literal outside `site.config.ts`.
- `pnpm test`:
  - URL engine fixtures for every row of §6.2
  - sync logic: watermark, tombstones, short-link merge, import throttling and resume
  - Instagram export parser
  - config generators: switching `domain` in a test config changes the CSP, manifest, CORS, sitemap and legal pages
- `pnpm test:rules`: every rule case in §6.4.
- `pnpm e2e` (Playwright + emulators):
  1. Email sign-up → blocked until verified → verify → the pending save syncs.
  2. `/share/?text=<IG link with igsh>` → canonical id; sharing again → "Already saved".
  3. Offline save → reload → online → it appears in a second browser context.
  4. Trash → restore → delete → the tombstone propagates; a wiped cache triggers a full resync.
  5. v1.2: REST `commit` to the inbox is moved into the library; revoked key, kill switch or oversize URL → rejected.
  6. A 1,200-item import with a cap of 500 → pauses and resumes the next day.
  7. Export matches the library; delete account leaves zero docs.
  8. The embed host only accepts `postMessage` from the embed origin.

**Manual device matrix**
- **OnePlus Nord 5, Chrome, installed PWA:** share from the Instagram, TikTok, YouTube, X, Reddit, Facebook, LinkedIn, Pinterest, Threads and Bluesky apps; airplane-mode save, then it syncs.
  - **TikTok can't be tested from the owner's network:** tiktok.com timed out from the Mac on 2026-09-29, most likely a regional block. TikTok shares and embeds are verified by the canary (GitHub runners) and by beta testers.
- **Desktop:** Chrome/Edge/Firefox/Safari sign-in and embeds, with and without uBlock Origin; slow 3G.
- **Google sign-in:** the in-app browser shows "Open in browser". iPhone is website-only until v1.2.
- **Domain-switch rehearsal** on dev.

**Launch gates:** canary green for 7 days; rules tests green; Lighthouse ≥ 90 on the landing page; privacy/terms published; OAuth brand verification done; the final domain live.

---

## 12. Progress log

- **2026-09-27:** planning and Phase 0.
  - **Planning:** the plan was fact-checked by a planning agent. Key corrections adopted: the embed sandbox origin, `auth.<domain>` on Firebase Hosting, the unlimited cache + server watermark, verified-email writes, import throttling, and Instagram export import moved into v1.
  - **Built:**
    - Monorepo, config system and brand redraw.
    - Landing, embed placeholder and Worker skeleton.
    - The 3 repos, 2 Firebase projects with Firestore nam5 and Auth providers, and API key restriction.
    - CI + deploy (first run: all 3 jobs green). `<domain>` and `embed.<domain>` are live with HTTPS enforced.
  - The owner then added the `auth` CNAME: the Firebase Hosting domain is active and `/__/auth/handler` returns 200 over HTTPS. The leftover `auth` TXT still needs deleting.
  - CLAUDE.md was expanded into the single source of truth, including the full code map (§4.4).
- **2026-09-29:** Phase 1, step 1: the URL engine.
  - **Built `packages/core`:**
    - `parse()` with 10 platform matchers + generic links, redirect-wrapper unwrapping, and tracking removal.
    - Share-text extraction for `/save/` and `/share/`.
    - `saveId()` for deduplication.
  - **Tests:** Vitest 5 added; `pnpm test` now runs in `pnpm verify` and CI. 571 tests pass: 255 fixtures, invariants, embeds, extraction, ids and a fuzz.
  - **A bug caught by the fixtures before shipping:** LinkedIn slugs that start with `activity-` weren't recognised.
  - **Live probes:**
    - X `/i/status/{id}` and Reddit's comment URL form are confirmed.
    - tiktok.com is unreachable from the owner's network (§11).
  - `.claude/PROJECT_PLAN.md`, the local copy of the original plan, is git-ignored.
  - Pushed as `7c1a884`; CI and Deploy green.
- **2026-09-29:** Phase 1, step 2: Firestore schema, rules and rules tests.
  - **Schema:** `packages/core/src/schema.ts` has the document types, limits, `newSave()` and `tombstone()`.
  - **Rules:** `firebase/firestore.rules` holds the real rules (see "As built" in §6.4); `firebase/firestore.indexes.json` has the index exemptions and the collection-group `updatedAt` index.
  - **Tests:** a new `@postsaver/firebase` package runs 117 rules tests in the emulator. It's in `pnpm verify`, and CI has a `rules` job (Java 21, emulator cache).
  - **Bugs caught before shipping:** the first run found that joined-list checks let through a tag containing commas (which also meant no length limit per tag) and non-text tags. Fixed with the `hasOnly(split)` check.
  - **Mutation check:** breaking the verified-email, id or hard-delete rule makes tests fail.
  - **pnpm policies met:**
    - firebase-tools 15.32.0 was blocked by pnpm's minimum-release-age guard, so we use 15.31.0.
    - Three unneeded install scripts are denied.

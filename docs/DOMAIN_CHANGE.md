# Changing the domain (or brand)

Everything reads the domain and brand from `site.config.ts`. A change is one edit plus a short
checklist of console steps that only a person can do.

## 1. Code (developer)

1. Edit `domain` (and `brand` if renaming) in `site.config.ts`. Replace files in `brand/` if the
   logo changes, then run `pnpm brand`.
2. `pnpm verify` — must pass (`check:domains` confirms nothing else hardcodes the old values).
3. Merge to `main` — the deploy workflow rebuilds the site and embed sandbox for the new domain.
4. `pnpm domain:apply` — points both GitHub Pages sites at the new hostnames and enforces HTTPS
   once certificates exist (re-run after ~15 minutes if it says they aren't ready).

## 2. Consoles (owner)

| Where | What |
|---|---|
| Registrar DNS for the new domain | A `@` → 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153 · AAAA `@` → 2606:50c0:8000::153, 2606:50c0:8001::153, 2606:50c0:8002::153, 2606:50c0:8003::153 · CNAME `www` and `embed` → `<github-owner>.github.io` · if CAA records exist: `0 issue "letsencrypt.org"` and `0 issue "pki.goog"` |
| GitHub → Settings → Pages | Add and verify the new domain (TXT record) **before** adding the records above |
| Firebase → Hosting | Add custom domain `auth.<new-domain>` and add the DNS records it shows |
| Firebase → Authentication → Settings → Authorized domains | Add `<new-domain>`, `www.<new-domain>`, `auth.<new-domain>` |
| Google Cloud → Google Auth Platform → Clients → Web client | Add redirect URI `https://auth.<new-domain>/__/auth/handler` |
| Google Cloud → Google Auth Platform → Branding | Update authorized domain, privacy and terms links |
| Old domain's registrar | Forward the old domain to the new one for ~90 days |

## 3. What users notice

Saved data is untouched (same Firebase project). Because the site origin changes, users sign in
once more, Android users reinstall the home-screen app, and desktop users re-add the bookmarklet.
Switch before the public launch if possible.

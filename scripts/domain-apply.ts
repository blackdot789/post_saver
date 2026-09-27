/**
 * Applies the domain from site.config.ts to GitHub Pages (both public repos) and prints
 * the manual steps that only a human can do in web consoles. Run: `pnpm domain:apply`.
 */
import { execFileSync } from "node:child_process";
import { site, hosts } from "@postsaver/config";

const { owner, repos } = site.github;

function gh(args: string[]): string {
  return execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function setPagesDomain(repo: string, cname: string) {
  gh(["api", "-X", "PUT", `repos/${owner}/${repo}/pages`, "-f", `cname=${cname}`]);
  console.log(`✓ ${owner}/${repo} → https://${cname}`);
}

setPagesDomain(repos.web, hosts.app);
setPagesDomain(repos.embed, hosts.embed);

console.log(`
Manual steps for ${site.domain} (see docs/DOMAIN_CHANGE.md):
  1. DNS at the registrar: GitHub Pages A/AAAA records on @, CNAME www + ${site.subdomains.embed} → ${owner}.github.io
  2. GitHub → Settings → Pages → verify ${site.domain}
  3. Firebase Hosting → add custom domain ${hosts.auth} (add the DNS records it shows)
  4. Firebase Auth → Authorized domains: ${hosts.app}, ${hosts.www}, ${hosts.auth}
  5. Google Cloud OAuth client → redirect URI https://${hosts.auth}/__/auth/handler
  6. Once certificates are issued: pnpm domain:apply again enforces HTTPS
`);

try {
  gh(["api", "-X", "PUT", `repos/${owner}/${repos.web}/pages`, "-F", "https_enforced=true"]);
  gh(["api", "-X", "PUT", `repos/${owner}/${repos.embed}/pages`, "-F", "https_enforced=true"]);
  console.log("✓ HTTPS enforced on both sites");
} catch {
  console.log("… HTTPS certificates not issued yet; re-run in ~15 minutes to enforce HTTPS.");
}

# Security

Please report vulnerabilities privately to the address in `contact.support` in
[`site.config.ts`](site.config.ts). Do not open a public issue.

Include steps to reproduce and the affected URL or file. We aim to reply within 72 hours.

## Design notes

- Firestore security rules are the only data gatekeeper; they are tested in CI before deploy.
- No secrets are stored in this public repository. The Firebase web config is public by design.
- Third-party embed scripts run only on the separate embed origin, never on the main site.

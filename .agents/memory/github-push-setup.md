---
name: GitHub push setup
description: How to push this repo to GitHub and why the Replit Git pane fails
---

The Replit Git pane's push fails with a false PUSH_REJECTED because the GitHub URL (https://github.com/simplenow320/GET.git) was pasted onto a leftover task-agent remote (`subrepl-3314awhp`) that carries broken internal config (lfsurl pointing at a dead ssh endpoint). The GitHub repo itself was empty; the rejection message was bogus.

**How to push:** use the `GITHUB_PERSONAL_ACCESS_TOKEN` secret with a GIT_ASKPASS helper script (username `simplenow320`, password = token) and push directly: `git push https://github.com/simplenow320/GET.git main:main`. Never echo the token.

**Why:** shell has no GitHub credentials of its own; the pane's remote is broken; git config edits are blocked in the main agent sandbox.

**Gotcha:** the repo history contains `.github/workflows/security.yml`, so the token must have BOTH `repo` and `workflow` scopes or GitHub rejects the push. Token is a 30-day classic PAT (created ~Jul 2026) — it will expire and need renewal.

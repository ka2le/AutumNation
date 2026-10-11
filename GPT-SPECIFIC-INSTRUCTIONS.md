# GPT-specific instructions

## Claude-to-GPT Git and deployment handoff

Claude models may change this project and commit to `main` locally, but their environment does not have full Git permissions or access to the user's GitHub credentials. They may therefore leave commits waiting to be pushed. This is a limitation of Claude's environment, not a restriction on GPT/Codex.

GPT/Codex can use the user's configured GitHub credentials and should complete the Git and deployment work when the user asks to sync, publish, update the static page, or finish a Claude handoff.

- Inspect the working tree and commits ahead of `origin/main` first. Changes may already be committed; push those existing commits rather than creating a duplicate or empty commit.
- If requested changes are still uncommitted, review them, run appropriate checks, and commit them before pushing. Preserve unrelated or ongoing work.
- Push the intended commits to `origin/main` without asking the user to run `git push` manually when GPT can do it.
- A push to `main` triggers `.github/workflows/github-pages.yml`, which publishes only `public/` with no build step.
- Wait for the deployment associated with the pushed commit to succeed, then verify that the live page serves the updated code. Report the live URL and any concrete blocker.
- If a sandboxed GitHub authentication or network check fails, retry using the tool's permitted network/approval mechanism before concluding the user's credentials are invalid. Do not print tokens.

Repository: https://github.com/ka2le/AutumNation

Live game: https://ka2le.github.io/AutumNation/

For GPT's own requested project changes, complete the appropriate commit, push, and deployment verification as part of the work. A Claude-specific note saying that the user must push does not apply to GPT.

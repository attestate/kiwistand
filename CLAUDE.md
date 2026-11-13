- Always run TODOs in parallel using subagents (if possible)
- NEVER add inline scripts in developit/htm templates - the codebase doesn't
  support inline scripts, they simply don't work
- We use dotenv for environment variable management - look for .env files

## Pull Requests

- NEVER merge anything, and NEVER push or merge directly into `main`. Always
  open a pull request; the maintainer Tim Daubenschütz (TimDaub) reviews and
  merges it.
- Request TimDaub as reviewer on every PR. If the GitHub API refuses that
  (no write access), mention @TimDaub in a PR comment instead.
- Every PR must include mockups (screenshots/visual previews of the change) in
  the PR description. Host images on a separate orphan `pr-assets` branch of
  the fork so they stay out of the PR diff.
- Contributors without write access to the attestate repos go through their
  fork: push the branch to the fork and open the PR from the fork against
  attestate/<repo> main. A session with the attestate repo attached cannot
  also attach the same-named fork, so start a session on the fork to push.
- NEVER post private data on GitHub (personal names, emails, contacts,
  credentials, internal details): repos, PRs, comments and commits are public.

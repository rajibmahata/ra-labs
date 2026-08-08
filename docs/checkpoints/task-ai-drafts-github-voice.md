# AI Drafts, GitHub Metadata, and Voice Checkpoint

Date: 2026-08-08
Status: Implementation complete for this slice; production release remains gated.

## Built

- GitHub sync now stores repository metadata and decoded README snapshots in `GithubRepositories`.
- Added additive EF migration `ContentDraftsAndGithubRepositories`.
- Added server-only OpenAI chat-completions integration, model configuration, and source snapshot retention.
- Added pending draft persistence with explicit admin approve/reject workflow.
- Approval creates an unpublished portfolio project; generated content is never published automatically.
- Added admin `/admin/drafts` review queue.
- Added customer Web Speech API voice input to the existing chat composer.
- Preserved existing private customer document upload/download and offline chat queue behavior.

## Configuration

- Docker: `OPENAI_API_KEY` and optional `OPENAI_MODEL` are mapped to the API container.
- Local API: use `OpenAI__ApiKey` and `OpenAI__Model` environment variables or user secrets.
- Keys are never read by frontend code and must not be committed.

## Validation

- Backend build passed.
- Backend tests: 58 passed, 0 failed.
- `web-public`, `web-customer`, and `web-admin` production builds passed.
- EF migration generation passed and includes both new tables.

## Remaining Gates

- Configure production OpenAI/GitHub secrets and approved model budget.
- Add authenticated Playwright coverage for draft review, voice fallback, and file workflows.
- Complete malware scanning/object storage, dependency audit remediation, accessibility, and performance evidence.
- Obtain code review and QA sign-off on a task branch before merging.
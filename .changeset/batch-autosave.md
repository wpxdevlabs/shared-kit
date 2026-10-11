---
"@wpxdev/hooks": minor
"@wpxdev/shared-kit": patch
---

Add optional batch reads and writes to the autosave queue, preserving per-resource drafts, immutable retries, conflicts, and the two-request concurrency limit.

Index draft cleanup by scope and resource, preserving version-1 drafts during migration. Avoid repeated full-queue scans for save confirmations.

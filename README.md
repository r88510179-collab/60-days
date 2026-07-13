# Security Engineering Sprint — 60-Day Tracker

A self-hosted PWA that tracks a 140-task, 60-day hands-on sprint across Microsoft
Entra ID, Intune, PowerShell, and Microsoft Graph — built to run offline-first on
a phone, sync across devices, and never lose progress.

This repo is also a working example of taking a single-file React app to
production-grade: a precompile pipeline, a blocking invariant gate, unit and
runtime tests on every deploy, vendored dependencies, and a strict CSP.

## Architecture

```
index.html  (single-file source: React 18 JSX + babel-standalone for the edit loop)
    │
    │  node build/build.js
    ▼
dist/       (what Vercel serves — no Babel, no CDNs, no inline scripts)
 ├─ index.html            script tags rewritten to local files
 ├─ app.js                JSX compiled once at build time
 ├─ register-sw.js        SW registration, externalized for CSP script-src 'self'
 ├─ sw.js                 cache name content-stamped per build
 ├─ vendor/react*.js      React/ReactDOM 18.2.0 UMD, hash-verified from npm
 └─ manifest.json, icons
```

The source keeps `babel-standalone` **on purpose**: opening `index.html` directly
in a browser still works, which preserves the single-file edit loop on any
device. Production never ships it.

## Build & deploy

- **Vercel (git-connected)** runs the full pipeline on every push via
  `vercel.json`: build → invariant gate → merge tests → runtime render tests.
  If any check fails, **the deploy fails** and the last good deployment stays
  live. `outputDirectory` is `dist/`.
- **GitHub Actions** (`verify-build`) mirrors the same gate on push/PR and
  uploads `dist/` as an artifact for manual drag-and-drop deploys as a fallback.
- **Dependabot** watches npm and GitHub Actions weekly.

Local run: `npm ci && npm run build && npm run verify`

## The invariant gate (`build/verify.js`)

Fails the build if any of these break, on both the source and the compiled output:

- Exactly **140 declared task IDs**, derived from the `id:"…"` declarations in
  the DAYS data (per-day task counts vary by design — never hardcoded)
- No dangling task-ID references (e.g. a `prereq` pointing at a nonexistent task)
- Source and compiled task-ID sets are identical
- All **eight** localStorage keys present: `se-done`, `se-hab`, `se-start`,
  `se-ref`, `se-sync`, `se-notes`, `se-notesat`, `se-exported`
- No `toISOString().slice(0,10)` day-key pattern (local-date keys only)
- `SNAPSHOT_VERSION` matches expected; React 18 `createRoot` in use
- `dist/` purity: no `text/babel`, no CDN URLs, zero inline scripts,
  content-stamped SW cache, complete precache shell, `app.js` parses

`build/merge.test.js` extracts the *real* snapshot/merge functions from the
source (no duplicated logic to drift) and unit-tests the conflict rules.
`build/render.test.js` boots the compiled app in jsdom and asserts it mounts
and behaves.

## Sync design

Primary: **GitHub Gist cloud sync** (snapshot v3), pull-on-mount + debounced
push + reconnect/visibility triggers. Merge rules:

- `completed` / `habitLog`: union, local wins per key — done-flags can't be lost
- `notes`: per-task **newer-edit-wins** via `notesAt` timestamps; deletions
  leave tombstones so they replicate instead of resurrecting; pre-v3 data keeps
  the old behavior (untimestamped notes are never dropped, ties go local)
- Known residual limit: timestamps come from device clocks, so severe clock
  skew between devices could pick the wrong side of a same-note conflict

Fallback: manual clipboard export/import (explicit wholesale overwrite by
design). Devices with no cloud sync get a backup nudge after 7 days without a
manual export.

## Security posture

- Vendored React/ReactDOM verified against npm's published sha512 before commit
  (closes the SRI finding — no third-party script hosts at runtime)
- No runtime JSX compilation, no `eval`-class dependencies in production
- CSP: `script-src 'self'` with zero inline scripts, `frame-ancestors 'none'`,
  `object-src 'none'`; plus `nosniff`, `Referrer-Policy`, `Permissions-Policy`
  (see `vercel.json`; HSTS is provided by the platform on vercel.app domains)
- Gist PAT is stored in `localStorage` on the device only — use a fine-grained
  token scoped to **gists only**

## Data

All state is client-side `localStorage` (eight `se-*` keys above). Existing
keys and task IDs are never renamed across releases, so progress survives every
update. Tenant identifiers may be stored locally in Lab Reference; they are
identifiers, not credentials, and never appear in this repo.

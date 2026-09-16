# Decisions

## 2026-09-16 — CLI hint prints the URL the client actually builds

The missing-URL hint said the client connects to `ws://host/api/current`, the one scheme
that gets a TrueNAS API key revoked, while the client has always used `wss://`. The hint
now prints `toWebSocketUrl()`, the function the client connects with, so the two cannot
drift again.

An explicit `ws://` still passes through unchanged. Rewriting or rejecting it would change
behaviour, so it was left out of this fix and stays documented as a warning.

## 2026-08-04 — Published as a fresh repo rather than flipping the private one

The predecessor, `maverick0628/truenas-ws-mcp`, stays private. Its history audited
clean — no secrets, no personal email, no absolute paths across all 13 commits — so
flipping it would have been safe. A fresh repo was chosen anyway, to publish a
deliberate initial state rather than a development history, and because the rename
was happening regardless.

## 2026-08-04 — Renamed to nasbridge

`truenas-ws-mcp` embedded iXsystems' TrueNAS trademark in the product name, the same
shape as a rename already made elsewhere for using a vendor's mark. The risk was
lower here — "an MCP server for TrueNAS" is descriptive, nominative use rather than a
coined product identity — but renaming sidesteps it at no cost.

The `ws` half was also an implementation detail. Nobody choosing this tool cares that
the transport is WebSocket.

`nasbridge` was picked over more evocative candidates specifically to keep keyword
discoverability: someone searching "nas mcp" should find it. The GitHub description,
topics and npm `keywords` carry "truenas" so the descriptive terms are not lost.

## 2026-08-04 — zod moved from devDependencies to dependencies

Nine files under `src/` import zod, but it was declared as a devDependency. It has
been resolving through `@modelcontextprotocol/sdk`'s own copy, so npm installs worked
by accident — the version actually loaded at runtime (3.25.76) was not the declared
range (^3.23.0), and a strict node_modules layout such as pnpm's would not expose a
transitive dependency to this package at all.

A `production-install` CI job now builds, reinstalls with `--omit=dev` and imports the
built server, so the same mistake cannot return unnoticed.

## 2026-08-04 — CI is read-only at the workflow root

`permissions: contents: read` is declared at the root and no job raises it. A public
repo means `pull_request` runs are triggerable by anyone with a fork, so no job should
hold a write token or see a secret. If a publish job is added later, its permissions
belong on that job alone.

This is the direct lesson from a sibling repo, where a release job inherited the
repo-default read-only token and failed with HTTP 403 on its first ever run — the fix
was granting write to that one job, not to the workflow.

## 2026-08-04 — `private: true` removed from package.json

The package declares a `bin`, which exists to be installed, so the flag contradicted
the intent. Removing it permits `npm publish` but does not perform one, and no publish
automation exists. The trade-off: the flag was also a guard against an accidental
publish permanently claiming the name. Re-add it if npm is not wanted.

## 2026-08-04 — .env patterns added to .gitignore

This server authenticates to a NAS with `TRUENAS_API_KEY`, so a local `.env` is the
worst thing that could land in a public repo, and nothing was ignoring it. `.letta/`
was likewise covered only by a global gitignore — rules outside the repo do not travel
with a clone, which is exactly how a fresh clone ends up tracking files the author
never sees.

## 2026-08-04 — Tests run on Node 22 only; the runtime floor is proven separately

CI's first run failed on Node 18 with `bad option: --experimental-strip-types`. That
flag arrived in Node 22.6, and the test script uses it to run `.ts` files directly.

The tempting fix — raise `engines` to `>=22` — would have been wrong. The shipped
artifact is compiled `dist/*.js`, `@modelcontextprotocol/sdk` declares `>=18`, and the
build targets ES2022, all of which Node 18 handles. The constraint belongs to the test
harness, not the package.

So tests run on 22, and a `runtime` job builds and then imports the built server on
both 18 and 22 with production dependencies only. That validates the `engines` claim
against the thing users actually install, which the test job never could.

## 2026-08-04 — The public repo is canonical; no private mirror

Considered developing privately and mirroring out, matching the pattern used for
`obsidian-automation`. Rejected: that mirror earns its place because `~/.claude` has
to be the live source of truth and the repo is a versioning layer on top. Nothing
here is like that.

The audit found nothing in this codebase that needs hiding — no secrets, no homelab
addresses, no personal paths. The NAS-specific configuration lives in the MCP wrapper
outside the repo, where it belongs.

The deciding cost was contributions. A one-way mirror means any pull request opened
against the public repo gets clobbered on the next sync or has to be hand-ported. For
a package that ships a `bugs` URL and invites issues, that is a bad trade for staging
that nothing currently requires.

`maverick0628/truenas-ws-mcp` is archived. Its `src/` and `test/` were byte-identical
to this repo at the split, so nothing is stranded there — every difference was an
improvement that exists only here.

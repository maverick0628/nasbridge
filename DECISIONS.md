# Decisions

## 2026-09-18 — The tool description reads its categories and count from the registry

The `truenas` tool description and its `category` parameter listed eight names typed by hand:
the eight tool modules, not the eighteen categories. One of them, `replication`, is not a
category at all (those actions live under `data_protection`), so a model that took the
description at its word got `Unknown category "replication"`. Ten real categories were never
mentioned.

Both lists and the action count are now built from the registry when the server starts.
`ToolRegistry.categoryNames()` returns categories that hold at least one action, in declared
order, which is the same set `help` prints. An empty category is left out rather than
advertised, since calling it would only return "No actions found".

`test/index.test.ts` drives the real server over the SDK's in-memory transport and checks the
description against what the server itself answers: the `help` listing and the unknown-category
error. It also asserts that every declared category has actions, so a module that is written
but never wired into `buildRegistry` fails the build instead of vanishing quietly.

To make that test possible, `index.ts` and `tools/index.ts` now import siblings with `.ts`
extensions, as the type-checked files already do. `rewriteRelativeImportExtensions` turns them
back into `.js` in `dist`. Both files are still `@ts-nocheck`. The README and `package.json`
still say 278 in prose, which is true today and has to be kept true by hand.

## 2026-09-17 — registry.ts is type-checked and bound to the runTool contract

`registry.ts` was compiled JavaScript saved as `.ts` under `// @ts-nocheck`, source map
comment and all. It routes all 278 actions and had no tests. It now carries real types, and
`test/registry.test.ts` covers category routing, dispatch, the wrong-category guard and
discovery output.

Runtime behaviour is unchanged except for one fix. `listActions` looked categories up with a
bare index, so `constructor`, `toString` and `__proto__` resolved to inherited properties and
reported "No actions found" instead of an unknown category. The lookup now checks own keys.

`ToolRegistry` declares `implements ToolExecutor`. `run-tool.ts` takes the registry through
that interface so tests can pass a fake, and `index.ts` is still `@ts-nocheck`, so nothing
else would notice if the two signatures drifted. The import is type-only.

The test file also runs `tsc --noEmit`. CI already type-checks in its build step, so the two
overlap there, but it means `npm test` on its own catches a type error that strip-types would
run straight past. It costs well under a second. The other twelve `@ts-nocheck` files are out
of scope and stay unchecked for now.

## 2026-09-17 — Secrets are redacted once, at the output boundary

`cloudsync_list` returned each task's provider credentials as-is, B2 application key and
S3 secret access key included, so any session that listed tasks put live keys in its
transcript. Other actions had the same shape: certificate and SSH private keys, API key and
password hashes, bind passwords and alert tokens. `truenas_api_call` could reach all of them.

Redaction now lives in `src/redact.ts` and runs on every tool result, error message and
resource on the way out, through `src/run-tool.ts` and a resource wrapper in `src/index.ts`.
There was no shared response helper to put it in. Two modules define their own
`jsonContent` and the rest call `JSON.stringify` inline, so a per-helper fix would have
missed most of the 278 actions and every future one.

Redacting in the client was rejected. Handlers would then see `[redacted]` as data, and any
read-modify-write would send it back to the NAS as a credential.

Matching is by key name after lowercasing and dropping separators: an exact list, fragments
such as `password`, `secret` and `token`, and any name ending in `key` except public ones
(`public_key`, `sshpubkey`, `remote_host_key`). Names that describe a secret without holding
it (`privatekey_path`, `key_type`, `key_format`) stay. Only non-empty strings, objects and
arrays are redacted. Null, booleans, numbers and empty strings still show whether something
is set, and an SFTP credential's `private_key` is a keypair id, not key material. Private key
blocks, URL passwords and secret query parameters are scrubbed from every string.

`access_key_id` and a B2 provider's `account` are both redacted. TrueNAS labels the B2 field
"Key ID". It is the application key ID, the same half of the pair as the S3 access key ID,
and hiding one while showing the other would be arbitrary. `account` on other providers,
such as an Azure storage account name, is kept. Credential `id`, `name` and provider `type`
still identify which credential a task uses.

Accepted cost: `api_key_create` and `keychaincredential_generate_ssh_key` can no longer
return the secret they create, and their descriptions now say so. Known gap: a secret inside
a field with an ordinary name, such as a Slack webhook `url` or a password typed into a cloud
sync task's `args`, is not caught.

## 2026-09-16 — Decision log names no private repos

The earlier entries named a private predecessor repo, a private automation mirror and a
path inside Duncan's home directory. None of those are readable from here, so the names
added nothing for a reader and exposed private project structure. They now say "the
predecessor repo" and "another project". The decisions themselves are unchanged. Git
history still has the old wording.

## 2026-09-16 — CLI hint prints the URL the client actually builds

The missing-URL hint said the client connects to `ws://host/api/current`, the one scheme
that gets a TrueNAS API key revoked, while the client has always used `wss://`. The hint
now prints `toWebSocketUrl()`, the function the client connects with, so the two cannot
drift again.

An explicit `ws://` still passes through unchanged. Rewriting or rejecting it would change
behaviour, so it was left out of this fix and stays documented as a warning.

## 2026-08-04 — Published as a fresh repo rather than flipping the private one

The predecessor repo stays private. Its history audited
clean — no secrets, no personal email, no absolute paths across all 13 commits — so
flipping it would have been safe. A fresh repo was chosen anyway, to publish a
deliberate initial state rather than a development history, and because the rename
was happening regardless.

## 2026-08-04 — Renamed to nasbridge

The working name embedded iXsystems' TrueNAS trademark in the product name, the same
shape as a rename already made elsewhere for using a vendor's mark. The risk was
lower here — "an MCP server for TrueNAS" is descriptive, nominative use rather than a
coined product identity — but renaming sidesteps it at no cost.

It also named the transport, an implementation detail. Nobody choosing this tool cares
that the transport is WebSocket.

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

Considered developing privately and mirroring out, a pattern used for another project.
Rejected: that mirror earns its place because its live source of truth sits outside
the repo and the repo is only a versioning layer on top. Nothing here is like that.

The audit found nothing in this codebase that needs hiding — no secrets, no homelab
addresses, no personal paths. The NAS-specific configuration lives in the MCP wrapper
outside the repo, where it belongs.

The deciding cost was contributions. A one-way mirror means any pull request opened
against the public repo gets clobbered on the next sync or has to be hand-ported. For
a package that ships a `bugs` URL and invites issues, that is a bad trade for staging
that nothing currently requires.

The predecessor repo is archived. Its `src/` and `test/` were byte-identical
to this repo at the split, so nothing is stranded there — every difference was an
improvement that exists only here.

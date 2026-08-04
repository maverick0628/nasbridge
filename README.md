# nasbridge — control TrueNAS from Claude

[![CI](https://github.com/maverick0628/nasbridge/actions/workflows/ci.yml/badge.svg)](https://github.com/maverick0628/nasbridge/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TrueNAS](https://img.shields.io/badge/TrueNAS-26-0095D5)](https://www.truenas.com/)
[![MCP](https://img.shields.io/badge/MCP-stdio-8A63D2)](https://modelcontextprotocol.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6)](tsconfig.json)

An **MCP server for TrueNAS** that lets Claude Desktop, Claude Code, Cursor or any
other MCP client manage your NAS — ZFS pools and datasets, SMB and NFS shares,
snapshots, replication, VMs, alerts and network config. 278 actions in all.

Ask for "a dataset on tank with lz4 and a daily snapshot task", or "which pools
are degraded", and it happens over the wire rather than through the web UI.

TrueNAS 26 drops the REST API in favour of JSON-RPC 2.0 over WebSocket, so this
server speaks that transport directly.

## One tool, not 278

The design decision worth stealing: this exposes a **single hierarchical
`truenas` tool** rather than one tool per action.

Most MCP servers register a flat tool per operation. At 278 actions that consumes
a large share of the context window before the model has done any work, and
degrades tool selection as the list grows. Here the model discovers categories,
lists the actions in one, then executes with parameters — three cheap round trips
instead of a permanently expensive tool manifest.

## How it works

This started as a fork of the `truenas-mcp` package, which targets the REST API
that TrueNAS 26 removed. The tool handlers are largely unchanged — they still call
a REST-style client (`client.get/post/put/delete`). What was rewritten is
everything beneath: a `path-translator` maps each REST path to its JSON-RPC method
(`GET /pool` becomes `pool.query`, `PUT /pool/id/1` becomes `pool.update`), and a
`ws` client sends those calls over a single authenticated WebSocket connection.

Keeping the REST-shaped seam meant the 278 handlers did not have to be rewritten
to change transport.

Authentication is `auth.login_with_api_key` on connect. The connection keeps itself alive with a 30s `core.ping`. Long-running operations are tracked via `core.get_jobs`.

## Tools

The `truenas` tool takes `category`, `action` and `params`:

- No args or `category="help"` — list all categories with action counts
- `category` only — list the actions in that category and their parameters
- `category` + `action` + `params` — execute

278 actions are wired across these categories:

| Category | Covers |
|----------|--------|
| `system` | System info, services, mail, API keys, power, NTP |
| `storage` | Pools, datasets, snapshots, periodic snapshot tasks |
| `sharing` | SMB, NFS and iSCSI (targets, extents, portals, initiators) |
| `network` | Interfaces, global config, static routes, staged changes |
| `vm` | Virtual machines and VM devices |
| `alert` | System alerts and alert notification services |
| `data_protection` | Replication, cloud sync/backup, cron, rsync, SSH credentials |
| `filesystem` | stat, listdir, mkdir, permissions, ACLs, ownership |

Destructive actions (reboot, shutdown and similar) require an explicit `confirm: true` parameter.

### Resources

Read-only resources surface common state without a tool call: `truenas://system/info`, `truenas://storage/pools`, `truenas://storage/datasets`, `truenas://services`, `truenas://alerts`, `truenas://network/summary`, `truenas://sharing`, `truenas://vms`, `truenas://apps`, `truenas://disks`, `truenas://boot/environments` and `truenas://system/update`.

## Configuration

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `TRUENAS_URL` | yes | — | TrueNAS host or URL. `http://`/`https://` is rewritten to `wss://`; `/api/current` is appended if absent |
| `TRUENAS_API_KEY` | yes | — | Generate in TrueNAS: Credentials → API Keys → Add |
| `TRUENAS_VERIFY_SSL` | no | `true` | Set `false` to skip TLS verification (self-signed certs) |

The client connects with `wss://` by default. A self-signed cert needs `TRUENAS_VERIFY_SSL=false`.

## Requirements

- TrueNAS **26** or later (earlier versions expose a different WebSocket shape)
- Node.js 20+
- A TrueNAS API key — Credentials → API Keys → Add
- An MCP client: Claude Desktop, Claude Code, Cursor, or anything else speaking MCP

## Install and run

```bash
git clone https://github.com/maverick0628/nasbridge.git
cd nasbridge
npm install
npm run build
TRUENAS_URL=https://truenas.local TRUENAS_API_KEY=1-yourkey node dist/cli.js
```

Create the API key in the TrueNAS UI under **Credentials → Local Users → API Keys**.
Keep it in your MCP client config or a local `.env`, never in the repo — `.env` is
gitignored for that reason.

The server speaks MCP over stdio. Add it to your MCP client config — for Claude
Desktop that is `claude_desktop_config.json`, for Claude Code `.mcp.json`:

```json
{
  "command": "node",
  "args": ["/path/to/nasbridge/dist/cli.js"],
  "env": {
    "TRUENAS_URL": "https://truenas.local",
    "TRUENAS_API_KEY": "1-yourkey",
    "TRUENAS_VERIFY_SSL": "false"
  }
}
```

## Tests

```bash
npm test
```

Unit tests cover the REST-to-WebSocket path translator and the client against a mock WebSocket server. `test/e2e-live.mjs` runs the dataset create/get flow against a real TrueNAS instance.

## Notes

TrueNAS 26 tightened dataset validation: `atime`, `compression` and `sync` must be uppercase string literals (`ON`, `OFF`, `LZ4`, `STANDARD`). The storage tools normalise these before create/update, so the model can pass natural values.

Built against TrueNAS 26. Earlier versions expose a different WebSocket API shape and are not supported.

## License

MIT — see [LICENSE](LICENSE).

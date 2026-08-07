# HOOX · Analytics Worker

**The observability plane — every operational signal in the mesh converges here. Latency percentiles, trade success rates, error budgets, in continuous time-series.**

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/) [![Runtime](https://img.shields.io/badge/Runtime-Bun-black?logo=bun)](https://bun.sh) [![Platform](https://img.shields.io/badge/Platform-Cloudflare%C2%AE%20Workers-orange?logo=cloudflare)](https://workers.cloudflare.com/) [![License](https://img.shields.io/badge/License-CC%20BY%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by/4.0/)

**Part of the [HOOX](https://github.com/hoox-sh/hoox) edge-trading mesh — a production-grade algorithmic trading framework on Cloudflare Workers.**  
**Site:** [hoox.sh](https://hoox.sh) · **Docs:** [docs.hoox.sh](https://docs.hoox.sh) · **Paper:** [`hoox-arxiv-paper-core.pdf`](https://github.com/hoox-sh/hoox/blob/main/papers/hoox-arxiv-paper-core.pdf)

---

The analytics-worker is the central observability hub for the HOOX mesh — the single fan-in collector for all system telemetry. Peer workers push structured events to its REST endpoints, which are written as time-series data points to Cloudflare Analytics Engine (`hoox-analytics` dataset). Each event type — trade execution, API call latency, worker performance heartbeat, signal ingestion, notification delivery — is validated against a Zod schema (`.strict()` mode rejects unknown fields; finite numbers; max string lengths) before being committed as a `DataPoint` with typed `blobs`, `doubles`, and `indexes`. Invalid or oversized payloads are **dropped safely** (`400`, no `writeDataPoint`).

This isolate is **write-path only** via the Analytics Engine binding. Historical SQL query helpers against the Cloudflare REST SQL API were removed in favor of D1 (via [`d1-worker`](https://github.com/hoox-sh/d1-worker)) for queryable storage and dashboard aggregates.

### Fan-In Architecture

```
hoox ─────────┐
trade-worker ─┤
agent-worker ─┼──► analytics-worker ──► Analytics Engine
email-worker ─┤        │               (hoox-analytics)
web3-wallet ──┘        │
                       │
                       ├──► D1 (via d1-worker, for queries)
                       └──► SQL API (time-series queries)
```

### Event Types

| Endpoint              | Zod Schema           | Blobs                    | Doubles                    | Description          |
| --------------------- | -------------------- | ------------------------ | -------------------------- | -------------------- |
| `/track/trade`        | `TradeBodySchema`    | exchange, symbol, action | qty, latencyMs             | Per-trade execution  |
| `/track/api-call`     | `ApiCallBodySchema`  | worker, endpoint         | latencyMs, success         | Internal RPC latency |
| `/track/worker-perf`  | `WorkerPerfSchema`   | worker                   | requests, errors, duration | Heartbeat metrics    |
| `/track/signal`       | `SignalBodySchema`   | source, type, symbol     | confidence                 | Signal ingestion     |
| `/track/notification` | `NotificationSchema` | type, target             | success                    | Delivery status      |

### Entry Points

| Method | Path                  | Auth         | Schema                           |
| ------ | --------------------- | ------------ | -------------------------------- |
| `POST` | `/track/trade`        | Internal key | Zod-validated trade event        |
| `POST` | `/track/api-call`     | Internal key | Zod-validated RPC event          |
| `POST` | `/track/worker-perf`  | Internal key | Zod-validated perf event         |
| `POST` | `/track/signal`       | Internal key | Zod-validated signal event       |
| `POST` | `/track/notification` | Internal key | Zod-validated notification event |
| `GET`  | `/health`             | None         | Liveness probe                   |

### Development

```bash
bun test workers/analytics-worker
```

### Mesh interconnect

| Direction | Peers |
| --------- | ----- |
| **Called by** | [hoox-worker](https://github.com/hoox-sh/hoox-worker), [trade-worker](https://github.com/hoox-sh/trade-worker), [agent-worker](https://github.com/hoox-sh/agent-worker), [email-worker](https://github.com/hoox-sh/email-worker), [web3-wallet-worker](https://github.com/hoox-sh/web3-wallet-worker), [telegram-worker](https://github.com/hoox-sh/telegram-worker), [d1-worker](https://github.com/hoox-sh/d1-worker). |
| **This worker calls** | See list below |

- **—** — Writes to Analytics Engine (`hoox-analytics`); queried by dashboard and report-worker

Full mesh (all isolates live as git submodules under [`hoox-sh/hoox`](https://github.com/hoox-sh/hoox) `workers/`):

| Isolate | Role | Repository |
| ------- | ---- | ---------- |
| [hoox-worker](https://github.com/hoox-sh/hoox-worker) | Public webhook gateway (WAF, idempotency, dispatch) | monorepo `workers/hoox-worker` |
| [trade-worker](https://github.com/hoox-sh/trade-worker) | Multi-exchange order execution (Binance / Bybit / MEXC) | monorepo `workers/trade-worker` |
| [agent-worker](https://github.com/hoox-sh/agent-worker) | AI risk manager (configurable cron 1–1440 min, kill switch) | monorepo `workers/agent-worker` |
| [d1-worker](https://github.com/hoox-sh/d1-worker) | D1 SQL proxy + settings / balances / positions | monorepo `workers/d1-worker` |
| [telegram-worker](https://github.com/hoox-sh/telegram-worker) | Alerts, bot commands, RAG copilot | monorepo `workers/telegram-worker` |
| [email-worker](https://github.com/hoox-sh/email-worker) | Mailgun / email signal parsing → trade | monorepo `workers/email-worker` |
| [analytics-worker](https://github.com/hoox-sh/analytics-worker) | Analytics Engine write + query path | monorepo `workers/analytics-worker` |
| [report-worker](https://github.com/hoox-sh/report-worker) | PDF reports via Browser Rendering → R2 | monorepo `workers/report-worker` |
| [web3-wallet-worker](https://github.com/hoox-sh/web3-wallet-worker) | On-chain wallet identity (ethers.js) | monorepo `workers/web3-wallet-worker` |
| [dashboard](https://github.com/hoox-sh/hoox/tree/main/workers/dashboard) | Next.js ops console (OpenNext, public) | monorepo `workers/dashboard` |

### Docs & monorepo

| Resource | Link |
| -------- | ---- |
| Isolate profile (operators) | [https://docs.hoox.sh/docs/devops/workers/analytics-worker](https://docs.hoox.sh/docs/devops/workers/analytics-worker) |
| Parent monorepo | [github.com/hoox-sh/hoox](https://github.com/hoox-sh/hoox) |
| This repository | [github.com/hoox-sh/analytics-worker](https://github.com/hoox-sh/analytics-worker) |
| Workers index | [docs.hoox.sh → Workers](https://docs.hoox.sh/docs/devops/workers) |
| CLI | `@hoox-sh/hoox-cli` · `hoox deploy worker analytics-worker` |

### License

[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — part of the HOOX open-core mesh.

# HOOX · Analytics Worker

**The observability plane — every operational signal in the mesh converges here. Latency percentiles, trade success rates, error budgets, in continuous time-series.**

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/) [![Runtime](https://img.shields.io/badge/Runtime-Bun-black?logo=bun)](https://bun.sh) [![Platform](https://img.shields.io/badge/Platform-Cloudflare%C2%AE%20Workers-orange?logo=cloudflare)](https://workers.cloudflare.com/) [![License](https://img.shields.io/badge/License-CC%20BY%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by/4.0/)

**Part of the [HOOX](https://github.com/hoox-sh/hoox) edge-trading mesh — a production-grade algorithmic trading framework on Cloudflare Workers.**  
**Site:** [hoox.sh](https://hoox.sh) · **Docs:** [docs.hoox.sh](https://docs.hoox.sh) · **Paper:** [`hoox-arxiv-paper-core.pdf`](https://github.com/hoox-sh/hoox/blob/main/papers/hoox-arxiv-paper-core.pdf)

---

The analytics-worker is the central observability hub for the HOOX mesh — the single fan-in collector for all system telemetry. Six workers push structured events to its REST endpoints, which are written as time-series data points to Cloudflare Analytics Engine (`hoox-analytics` dataset). Each event type — trade execution, API call latency, worker performance heartbeat, signal ingestion, notification delivery — is validated against a Zod schema (`.strict()` mode rejects unknown fields) before being committed as a `DataPoint` with typed `blobs`, `doubles`, and `indexes`.

Query methods are exposed for the dashboard and the [`report-worker`](../report-worker): `getTradeMetrics`, `getTradesByExchange`, `getTradeSuccessRate`, `getWorkerPerformance`, `getApiCallStats`, `getSignalOutcomes`. Each builds parameterized SQL and executes against the Analytics Engine SQL API.

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

### License

[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — part of the HOOX open-core mesh.

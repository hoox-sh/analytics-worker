# @hoox/analytics-worker

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/) [![Runtime](https://img.shields.io/badge/Runtime-Bun-black?logo=bun)](https://bun.sh) [![Platform](https://img.shields.io/badge/Platform-Cloudflare%C2%AE%20Workers-orange?logo=cloudflare)](https://workers.cloudflare.com/) [![License](https://img.shields.io/badge/License-CC%20BY%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by/4.0/)

Collects metrics and observability data across all workers.

## For CLI Users

Use this worker indirectly when you run `hoox` commands:

- `hoox monitor status` — view aggregated worker health and metrics

→ [Monitor Trading Guide](../../docs/guides/monitor-trading.md) · [CLI Reference](../../docs/reference/cli-commands.md)

## For Operators

This worker provides performance analytics and reporting. It queries D1 for trade history, calculates win rate, Sharpe ratio, drawdown, and other metrics, and serves REST endpoints for the dashboard. Reports can be exported as CSV or stored in R2 as PDFs via the report worker.

→ [Operator Docs](../../docs/devops/workers/analytics-worker.md)

## Development

```bash
bun test workers/analytics-worker
```

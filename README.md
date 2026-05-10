# Analytics Worker

**Last Updated:** May 2026

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/) [![Runtime](https://img.shields.io/badge/Runtime-Bun-black?logo=bun)](https://bun.sh) [![Platform](https://img.shields.io/badge/Platform-Cloudflare®%20Edge%20Workers-orange?logo=cloudflare)](https://workers.cloudflare.com/) [![License](https://img.shields.io/badge/License-CC%20BY%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by/4.0/) [![Build Status](https://github.com/jango-blockchained/hoox-setup/actions/workflows/opencode.yml/badge.svg)](https://github.com/jango-blockchained/hoox-setup/actions/workflows/opencode.yml)

**[Main Repository](https://github.com/jango-blockchained/hoox-setup)** · **[View on GitHub](https://github.com/jango-blockchained/analytics-worker)**

A Cloudflare® Worker service that provides advanced analytics and reporting for the Hoox trading ecosystem. This worker aggregates data from D1, generates performance reports, and creates visualizations for the dashboard.

---

## About

This worker is part of the **[Hoox Trading System](https://github.com/jango-blockchained/hoox-setup)** - a zero-latency edge trading ecosystem. The `analytics-worker` provides:

- **Performance Analytics**: Calculates win rates, PnL, drawdown, and Sharpe ratio
- **Trade Reporting**: Generates detailed trade reports in JSON/CSV formats
- **Data Aggregation**: Queries D1 database for historical trade data
- **Visualization Data**: Prepares chart data for the dashboard
- **Scheduled Reports**: Can generate periodic performance summaries via cron

---

## Features

- **Real-Time Metrics**: Live calculation of portfolio performance
- **Historical Analysis**: Deep dive into past trades and strategies
- **Export Capabilities**: Download reports to R2 for long-term storage
- **Multi-Timeframe**: Analyze performance by day, week, month, or custom range
- **Risk Metrics**: Value at Risk (VaR), maximum drawdown, profit factor

---

## Prerequisites

- Node.js >= 16
- Bun
- Wrangler CLI
- Cloudflare® Workers account
- Cloudflare® D1 Database access (for trade history)
- Cloudflare® R2 access (for report storage)

---

## Setup

1. **Install dependencies:**

   ```bash
   bun install
   ```

2. **Set your Cloudflare® account ID in `wrangler.jsonc`.**

3. **Create necessary D1 database and R2 bucket:**

   ```bash
   # D1 database for trade data (if not already created)
   npx wrangler d1 create hoox-analytics-db

   # R2 bucket for storing reports
   npx wrangler r2 bucket create hoox-reports
   ```

4. **Configure `wrangler.jsonc` with bindings:**

   ```jsonc
   {
     "name": "analytics-worker",
     "main": "src/index.ts",
     "compatibility_date": "2025-03-07",
     "compatibility_flags": ["nodejs_compat"],
     "account_id": "YOUR_CLOUDFLARE_ACCOUNT_ID",
     "d1_databases": [
       {
         "binding": "DB",
         "database_name": "hoox-analytics-db",
         "database_id": "YOUR_D1_DATABASE_ID",
       },
     ],
     "r2_buckets": [
       {
         "binding": "REPORTS_BUCKET",
         "bucket_name": "hoox-reports",
       },
     ],
     "services": [{ "binding": "D1_SERVICE", "service": "d1-worker" }],
   }
   ```

5. **For local development, create a `.dev.vars` file:**
   ```.dev.vars
   # Any local test variables
   TEST_MODE=true
   ```

---

## Development

Run locally:

```bash
bun run dev
```

Deploy:

```bash
bun run deploy
```

---

## API Endpoints

### `GET /analytics/performance`

Returns current performance metrics.

**Response:**

```json
{
  "success": true,
  "data": {
    "totalTrades": 150,
    "winRate": 68.5,
    "profitFactor": 2.1,
    "sharpeRatio": 1.8,
    "maxDrawdown": 12.3,
    "totalPnL": 4500.5
  }
}
```

### `GET /analytics/trades`

Returns historical trade data with optional filters.

**Query Parameters:**

- `limit` (optional): Number of trades to return (default: 100)
- `offset` (optional): Pagination offset (default: 0)
- `symbol` (optional): Filter by trading symbol
- `startDate` (optional): Filter trades after this date
- `endDate` (optional): Filter trades before this date

**Response:**

```json
{
  "success": true,
  "data": {
    "trades": [...],
    "total": 150,
    "limit": 100,
    "offset": 0
  }
}
```

### `POST /analytics/report/generate`

Generates a detailed PDF/CSV report and stores it in R2.

**Request Body:**

```json
{
  "format": "pdf",
  "startDate": "2026-01-01",
  "endDate": "2026-05-05",
  "includeCharts": true
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "reportId": "report-123456",
    "downloadUrl": "https://.../reports/report-123456.pdf",
    "generatedAt": "2026-05-05T17:30:00Z"
  }
}
```

### `GET /analytics/export`

Exports all trade data as a CSV file.

**Response:** CSV file download

---

## Architecture

1. **Data Source**: Queries `d1-worker` (or directly via D1 binding) for trade history
2. **Processing**: Calculates metrics using in-worker analytics engine
3. **Storage**: Stores generated reports in R2 for dashboard access
4. **Serving**: Provides REST API for dashboard and external consumers

---

## Metrics Calculated

| Metric              | Description                        |
| ------------------- | ---------------------------------- |
| **Win Rate**        | Percentage of profitable trades    |
| **Profit Factor**   | Gross profit / Gross loss          |
| **Sharpe Ratio**    | Risk-adjusted return metric        |
| **Max Drawdown**    | Largest peak-to-trough decline     |
| **Expectancy**      | Average amount won/lost per trade  |
| **Kelly Criterion** | Optimal position sizing percentage |

---

## Scheduled Reporting

Configure cron triggers in `wrangler.jsonc` for automated reports:

```jsonc
{
  "triggers": [
    {
      "type": "cron",
      "cron": "0 9 * * MON", // Every Monday at 9 AM
      "method": "POST",
      "path": "/cron/weekly-report",
    },
  ],
}
```

---

## Security

- **Internal Only**: This worker should only be accessible via service bindings from the dashboard
- **No Public API**: Do not expose directly to the internet
- **Data Privacy**: Reports may contain sensitive trading data - secure R2 access appropriately

---

_Cloudflare® and the Cloudflare logo are trademarks and/or registered trademarks of Cloudflare, Inc. in the United States and other jurisdictions._

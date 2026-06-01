// workers/analytics-worker/src/index.ts

import type {
  Env,
  DataPoint,
  TradePayload,
  TradeResult,
  WorkerPerfData,
  SignalData,
  NotificationData,
} from "./types";
import { buildDataPoint } from "./helpers";
import { buildQuery } from "./query-builder";
import {
  createLogger,
  withRequestLog,
} from "@jango-blockchained/hoox-shared/middleware";
import {
  Errors,
  createJsonResponse,
  toError,
} from "@jango-blockchained/hoox-shared/errors";
import { createRouter } from "@jango-blockchained/hoox-shared/router";
import { healthCheck } from "@jango-blockchained/hoox-shared/health";
import { validateJson } from "@jango-blockchained/hoox-shared/middleware";
import { z } from "zod";

// Request, Response, and fetch are available globally in Cloudflare Workers runtime

// ── Zod validation schemas ──────────────────────────────────────────
// Each schema validates the HTTP request body for a specific endpoint.

const TradeBodySchema = z
  .object({
    payload: z.object({
      exchange: z.string(),
      symbol: z.string(),
      action: z.string(),
      quantity: z.number(),
    }),
    result: z.object({
      success: z.boolean(),
    }),
    latencyMs: z.number().optional(),
  })
  .strict();

const ApiCallBodySchema = z
  .object({
    worker: z.string(),
    endpoint: z.string(),
    latencyMs: z.number(),
    success: z.boolean(),
  })
  .strict();

const WorkerPerfBodySchema = z
  .object({
    data: z.object({
      worker: z.string(),
      requests: z.number(),
      errors: z.number(),
      duration: z.number(),
    }),
  })
  .strict();

const SignalBodySchema = z
  .object({
    data: z.object({
      source: z.string(),
      type: z.string(),
      symbol: z.string(),
      confidence: z.number(),
    }),
  })
  .strict();

const NotificationBodySchema = z
  .object({
    data: z.object({
      type: z.string(),
      target: z.string(),
      success: z.boolean(),
    }),
  })
  .strict();

const logger = createLogger({ service: "analytics-worker" });

const router = createRouter<Env>();

router.get("/health", async (request, env, ctx) => {
  return healthCheck({ worker: "analytics-worker" });
});

router.post("/track/trade", async (request, env, ctx) => {
  const body = await request.json();
  const parsed = validateJson(TradeBodySchema, body);
  if (!parsed.ok) {
    return createJsonResponse(
      { success: false, error: "Validation failed", details: parsed.error },
      400
    );
  }
  const { payload, result, latencyMs } = parsed.value;
  await trackTrade(payload, result, latencyMs ?? 0, env);
  return createJsonResponse({ success: true });
});

router.post("/track/api-call", async (request, env, ctx) => {
  const body = await request.json();
  const parsed = validateJson(ApiCallBodySchema, body);
  if (!parsed.ok) {
    return createJsonResponse(
      { success: false, error: "Validation failed", details: parsed.error },
      400
    );
  }
  const { worker: workerName, endpoint, latencyMs, success } = parsed.value;
  await trackApiCall(workerName, endpoint, latencyMs, success, env);
  return createJsonResponse({ success: true });
});

router.post("/track/worker-perf", async (request, env, ctx) => {
  const body = await request.json();
  const parsed = validateJson(WorkerPerfBodySchema, body);
  if (!parsed.ok) {
    return createJsonResponse(
      { success: false, error: "Validation failed", details: parsed.error },
      400
    );
  }
  const { data } = parsed.value;
  await trackWorkerPerf(data, env);
  return createJsonResponse({ success: true });
});

router.post("/track/signal", async (request, env, ctx) => {
  const body = await request.json();
  const parsed = validateJson(SignalBodySchema, body);
  if (!parsed.ok) {
    return createJsonResponse(
      { success: false, error: "Validation failed", details: parsed.error },
      400
    );
  }
  const { data } = parsed.value;
  await trackSignal(data, env);
  return createJsonResponse({ success: true });
});

router.post("/track/notification", async (request, env, ctx) => {
  const body = await request.json();
  const parsed = validateJson(NotificationBodySchema, body);
  if (!parsed.ok) {
    return createJsonResponse(
      { success: false, error: "Validation failed", details: parsed.error },
      400
    );
  }
  const { data } = parsed.value;
  await trackNotification(data, env);
  return createJsonResponse({ success: true });
});

// Service binding methods (called by other workers)
export function writeDataPoint(data: DataPoint, env: Env): void {
  env.ANALYTICS_ENGINE.writeDataPoint({
    blobs: data.blobs,
    doubles: data.doubles,
    indexes: data.indexes,
  });
}

export function trackTrade(
  payload: TradePayload,
  result: TradeResult,
  latencyMs: number,
  env: Env
): void {
  const dataPoint = buildDataPoint.trade(payload, result, latencyMs);
  env.ANALYTICS_ENGINE.writeDataPoint(dataPoint);
}

export function trackApiCall(
  worker: string,
  endpoint: string,
  latencyMs: number,
  success: boolean,
  env: Env
): void {
  const dataPoint = buildDataPoint.apiCall(
    worker,
    endpoint,
    latencyMs,
    success
  );
  env.ANALYTICS_ENGINE.writeDataPoint(dataPoint);
}

export function trackWorkerPerf(data: WorkerPerfData, env: Env): void {
  const dataPoint = buildDataPoint.workerPerf(data);
  env.ANALYTICS_ENGINE.writeDataPoint(dataPoint);
}

export function trackSignal(data: SignalData, env: Env): void {
  const dataPoint = buildDataPoint.signal(data);
  env.ANALYTICS_ENGINE.writeDataPoint(dataPoint);
}

export function trackNotification(data: NotificationData, env: Env): void {
  const dataPoint = buildDataPoint.notification(data);
  env.ANALYTICS_ENGINE.writeDataPoint(dataPoint);
}

// Query methods (make HTTP calls to Cloudflare SQL API)
export async function getTradeMetrics(
  timeRange: { start: string; end: string },
  env: Env
): Promise<any> {
  const sql = buildQuery.getTradeMetrics(timeRange);
  return await executeQuery(sql, env);
}

export async function getTradesByExchange(
  exchange: string,
  limit: number = 100,
  env: Env
): Promise<any> {
  const sql = buildQuery.getTradesByExchange(exchange, limit);
  return await executeQuery(sql, env);
}

export async function getTradeSuccessRate(
  timeRange: string | undefined,
  env: Env
): Promise<any> {
  const sql = buildQuery.getTradeSuccessRate(timeRange);
  return await executeQuery(sql, env);
}

export async function getWorkerPerformance(
  worker: string,
  timeRange: string | undefined,
  env: Env
): Promise<any> {
  const sql = buildQuery.getWorkerPerformance(worker, timeRange);
  return await executeQuery(sql, env);
}

export async function getApiCallStats(
  exchange: string | undefined,
  env: Env
): Promise<any> {
  const sql = buildQuery.getApiCallStats(exchange);
  return await executeQuery(sql, env);
}

export async function getSignalOutcomes(
  timeRange: string | undefined,
  env: Env
): Promise<any> {
  const sql = buildQuery.getSignalOutcomes(timeRange);
  return await executeQuery(sql, env);
}

// Helper: Execute SQL query via Cloudflare API
async function executeQuery(sql: string, env: Env): Promise<any> {
  if (!env.CLOUDFLARE_API_TOKEN) {
    throw new Error("CLOUDFLARE_API_TOKEN not configured");
  }

  if (!env.CLOUDFLARE_ACCOUNT_ID) {
    throw new Error("CLOUDFLARE_ACCOUNT_ID not configured");
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/analytics_engine/sql`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: sql,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Query failed: ${response.status} ${errorText}`);
  }

  return await response.json();
}

export default {
  fetch: withRequestLog(
    async (request: Request, env: Env, ctx: ExecutionContext) => {
      try {
        return await router.handle(request, env, ctx);
      } catch (err) {
        logger.error("Unhandled exception", { error: toError(err) });
        return Errors.internal("An unexpected error occurred");
      }
    },
    { service: "analytics-worker", module: "router" }
  ),
};

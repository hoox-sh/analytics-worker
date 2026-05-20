// workers/analytics-worker/src/index.ts
import type { ExecutionContext } from "@cloudflare/workers-types";
import type {
  Env,
  DataPoint,
  TradePayload,
  TradeResult,
  WorkerPerfData,
  ApiCallData,
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

// Declare global objects for Cloudflare Workers runtime
declare const ANALYTICS_ENGINE: any;
declare const fetch: any;
// Request and Response are available globally in Cloudflare Workers

const logger = createLogger({ service: "analytics-worker" });

const router = createRouter<Env>();

// ── Lightweight runtime validation helpers ──────────────────────────
// Each validates the HTTP request body for a specific endpoint,
// checking required fields exist and are the correct types.
// Returns { valid: true } or { valid: false, errors: string[] }.

function validateTradeBody(body: unknown): {
  valid: boolean;
  errors?: string[];
} {
  if (!body || typeof body !== "object")
    return { valid: false, errors: ["body must be an object"] };
  const data = body as Record<string, unknown>;
  const errors: string[] = [];

  if (!data.payload || typeof data.payload !== "object") {
    errors.push("payload must be an object");
  } else {
    const p = data.payload as Record<string, unknown>;
    if (typeof p.exchange !== "string")
      errors.push("exchange must be a string");
    if (typeof p.symbol !== "string") errors.push("symbol must be a string");
    if (typeof p.action !== "string") errors.push("action must be a string");
    if (typeof p.quantity !== "number")
      errors.push("quantity must be a number");
  }

  if (!data.result || typeof data.result !== "object") {
    errors.push("result must be an object");
  } else {
    const r = data.result as Record<string, unknown>;
    if (typeof r.success !== "boolean")
      errors.push("result.success must be a boolean");
  }

  return errors.length ? { valid: false, errors } : { valid: true };
}

function validateApiCallBody(body: unknown): {
  valid: boolean;
  errors?: string[];
} {
  if (!body || typeof body !== "object")
    return { valid: false, errors: ["body must be an object"] };
  const data = body as Record<string, unknown>;
  const errors: string[] = [];

  if (typeof data.worker !== "string") errors.push("worker must be a string");
  if (typeof data.endpoint !== "string")
    errors.push("endpoint must be a string");
  if (typeof data.latencyMs !== "number")
    errors.push("latencyMs must be a number");
  if (typeof data.success !== "boolean")
    errors.push("success must be a boolean");

  return errors.length ? { valid: false, errors } : { valid: true };
}

function validateWorkerPerfBody(body: unknown): {
  valid: boolean;
  errors?: string[];
} {
  if (!body || typeof body !== "object")
    return { valid: false, errors: ["body must be an object"] };
  const data = body as Record<string, unknown>;
  const errors: string[] = [];

  if (!data.data || typeof data.data !== "object") {
    errors.push("data must be an object");
  } else {
    const d = data.data as Record<string, unknown>;
    if (typeof d.worker !== "string") errors.push("worker must be a string");
    if (typeof d.requests !== "number")
      errors.push("requests must be a number");
    if (typeof d.errors !== "number") errors.push("errors must be a number");
    if (typeof d.duration !== "number")
      errors.push("duration must be a number");
  }

  return errors.length ? { valid: false, errors } : { valid: true };
}

function validateSignalBody(body: unknown): {
  valid: boolean;
  errors?: string[];
} {
  if (!body || typeof body !== "object")
    return { valid: false, errors: ["body must be an object"] };
  const data = body as Record<string, unknown>;
  const errors: string[] = [];

  if (!data.data || typeof data.data !== "object") {
    errors.push("data must be an object");
  } else {
    const d = data.data as Record<string, unknown>;
    if (typeof d.source !== "string") errors.push("source must be a string");
    if (typeof d.type !== "string") errors.push("type must be a string");
    if (typeof d.symbol !== "string") errors.push("symbol must be a string");
    if (typeof d.confidence !== "number")
      errors.push("confidence must be a number");
  }

  return errors.length ? { valid: false, errors } : { valid: true };
}

function validateNotificationBody(body: unknown): {
  valid: boolean;
  errors?: string[];
} {
  if (!body || typeof body !== "object")
    return { valid: false, errors: ["body must be an object"] };
  const data = body as Record<string, unknown>;
  const errors: string[] = [];

  if (!data.data || typeof data.data !== "object") {
    errors.push("data must be an object");
  } else {
    const d = data.data as Record<string, unknown>;
    if (typeof d.type !== "string") errors.push("type must be a string");
    if (typeof d.target !== "string") errors.push("target must be a string");
    if (typeof d.success !== "boolean")
      errors.push("success must be a boolean");
  }

  return errors.length ? { valid: false, errors } : { valid: true };
}

router.get("/health", async (request, env, ctx) => {
  return healthCheck({ worker: "analytics-worker" });
});

router.post("/track/trade", async (request, env, ctx) => {
  const body = (await request.json()) as Record<string, any>;
  const validation = validateTradeBody(body);
  if (!validation.valid) {
    return createJsonResponse(
      {
        success: false,
        error: "Validation failed",
        details: validation.errors,
      },
      400
    );
  }
  const { payload, result, latencyMs } = body;
  await trackTrade(payload, result, latencyMs, env);
  return createJsonResponse({ success: true });
});

router.post("/track/api-call", async (request, env, ctx) => {
  const body = (await request.json()) as Record<string, any>;
  const validation = validateApiCallBody(body);
  if (!validation.valid) {
    return createJsonResponse(
      {
        success: false,
        error: "Validation failed",
        details: validation.errors,
      },
      400
    );
  }
  const { worker: workerName, endpoint, latencyMs, success } = body;
  await trackApiCall(workerName, endpoint, latencyMs, success, env);
  return createJsonResponse({ success: true });
});

router.post("/track/worker-perf", async (request, env, ctx) => {
  const body = (await request.json()) as Record<string, any>;
  const validation = validateWorkerPerfBody(body);
  if (!validation.valid) {
    return createJsonResponse(
      {
        success: false,
        error: "Validation failed",
        details: validation.errors,
      },
      400
    );
  }
  const { data } = body;
  await trackWorkerPerf(data, env);
  return createJsonResponse({ success: true });
});

router.post("/track/signal", async (request, env, ctx) => {
  const body = (await request.json()) as Record<string, any>;
  const validation = validateSignalBody(body);
  if (!validation.valid) {
    return createJsonResponse(
      {
        success: false,
        error: "Validation failed",
        details: validation.errors,
      },
      400
    );
  }
  const { data } = body;
  await trackSignal(data, env);
  return createJsonResponse({ success: true });
});

router.post("/track/notification", async (request, env, ctx) => {
  const body = (await request.json()) as Record<string, any>;
  const validation = validateNotificationBody(body);
  if (!validation.valid) {
    return createJsonResponse(
      {
        success: false,
        error: "Validation failed",
        details: validation.errors,
      },
      400
    );
  }
  const { data } = body;
  await trackNotification(data, env);
  return createJsonResponse({ success: true });
});

// Service binding methods (called by other workers)
export async function writeDataPoint(data: DataPoint, env: Env): Promise<void> {
  env.ANALYTICS_ENGINE.writeDataPoint({
    blobs: data.blobs,
    doubles: data.doubles,
    indexes: data.indexes,
  });
}

export async function trackTrade(
  payload: TradePayload,
  result: TradeResult,
  latencyMs: number,
  env: Env
): Promise<void> {
  const dataPoint = buildDataPoint.trade(payload, result, latencyMs);
  env.ANALYTICS_ENGINE.writeDataPoint(dataPoint);
}

export async function trackApiCall(
  worker: string,
  endpoint: string,
  latencyMs: number,
  success: boolean,
  env: Env
): Promise<void> {
  const dataPoint = buildDataPoint.apiCall(
    worker,
    endpoint,
    latencyMs,
    success
  );
  env.ANALYTICS_ENGINE.writeDataPoint(dataPoint);
}

export async function trackWorkerPerf(
  data: WorkerPerfData,
  env: Env
): Promise<void> {
  const dataPoint = buildDataPoint.workerPerf(data);
  env.ANALYTICS_ENGINE.writeDataPoint(dataPoint);
}

export async function trackSignal(data: SignalData, env: Env): Promise<void> {
  const dataPoint = buildDataPoint.signal(data);
  env.ANALYTICS_ENGINE.writeDataPoint(dataPoint);
}

export async function trackNotification(
  data: NotificationData,
  env: Env
): Promise<void> {
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
    (request: Request, env: Env, ctx: ExecutionContext) => {
      return router.handle(request, env, ctx);
    },
    { service: "analytics-worker", module: "router" }
  ),
};

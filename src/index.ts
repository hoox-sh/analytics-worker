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
import {
  createLogger,
  withRequestLog,
  createInternalAuthMiddleware,
} from "@jango-blockchained/hoox-shared/middleware";
import {
  Errors,
  createJsonResponse,
  toError,
} from "@jango-blockchained/hoox-shared/errors";
import {
  createRouter,
  type MiddlewareHandler,
} from "@jango-blockchained/hoox-shared/router";
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

// Internal auth middleware for all tracking endpoints.
// Cast: createInternalAuthMiddleware returns MiddlewareHandler<InternalAuthEnv>
// but our router is typed for MiddlewareHandler<Env>. The middleware only
// reads `INTERNAL_KEY_BINDING` which is present on both types.
const internalAuth =
  createInternalAuthMiddleware() as unknown as MiddlewareHandler<Env>;

router.get("/health", async (_request, _env, _ctx) => {
  return healthCheck({ worker: "analytics-worker" });
});

router.post(
  "/track/trade",
  async (request, env, _ctx) => {
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
  },
  [internalAuth]
);

router.post(
  "/track/api-call",
  async (request, env, _ctx) => {
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
  },
  [internalAuth]
);

router.post(
  "/track/worker-perf",
  async (request, env, _ctx) => {
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
  },
  [internalAuth]
);

router.post(
  "/track/signal",
  async (request, env, _ctx) => {
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
  },
  [internalAuth]
);

router.post(
  "/track/notification",
  async (request, env, _ctx) => {
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
  },
  [internalAuth]
);

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

/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

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
import { buildDataPoint, sanitizeIndexes } from "./helpers";
import {
  createLogger,
  withRequestLog,
  createInternalAuthMiddleware,
} from "@hoox-sh/hoox-shared/middleware";
import {
  Errors,
  createJsonResponse,
  toError,
} from "@hoox-sh/hoox-shared/errors";
import {
  createRouter,
  type MiddlewareHandler,
} from "@hoox-sh/hoox-shared/router";
import { healthCheck } from "@hoox-sh/hoox-shared/health";
import { validateJson } from "@hoox-sh/hoox-shared/middleware";
import { z } from "zod";

// Request, Response, and fetch are available globally in Cloudflare Workers runtime

// ── Zod validation schemas ──────────────────────────────────────────
// Each schema validates the HTTP request body for a specific endpoint.
// Invalid metrics are dropped with 400 — never written to Analytics Engine.

const MAX_JSON_BODY_BYTES = 64 * 1024; // 64 KiB — metrics payloads are small
const MAX_STR = 256;
const MAX_INDEXES = 8;

const finiteNonNeg = z.number().finite().min(0).max(1e15);
const finiteAny = z.number().finite().min(-1e15).max(1e15);
const shortStr = z.string().min(1).max(MAX_STR);

const TradeBodySchema = z
  .object({
    payload: z.object({
      exchange: shortStr,
      symbol: shortStr,
      action: shortStr,
      quantity: finiteAny,
      price: finiteNonNeg.optional(),
      requestId: z.string().max(MAX_STR).optional(),
      test: z.boolean().optional(),
    }),
    result: z.object({
      success: z.boolean(),
      error: z.string().max(MAX_STR).optional(),
    }),
    latencyMs: finiteNonNeg.optional(),
  })
  .strict();

const ApiCallBodySchema = z
  .object({
    worker: shortStr,
    endpoint: shortStr,
    latencyMs: finiteNonNeg,
    success: z.boolean(),
    indexes: z.array(z.string().max(MAX_STR)).max(MAX_INDEXES).optional(),
  })
  .strict();

const WorkerPerfBodySchema = z
  .object({
    data: z.object({
      worker: shortStr,
      requests: finiteNonNeg,
      errors: finiteNonNeg,
      duration: finiteNonNeg,
    }),
  })
  .strict();

const SignalBodySchema = z
  .object({
    data: z.object({
      source: shortStr,
      type: shortStr,
      symbol: shortStr,
      confidence: z.number().finite().min(0).max(1),
    }),
  })
  .strict();

const NotificationBodySchema = z
  .object({
    data: z.object({
      type: shortStr,
      target: shortStr,
      success: z.boolean(),
    }),
  })
  .strict();

/**
 * Parse JSON with a hard body-size cap. Invalid / oversized bodies yield 400
 * (drop invalid metrics) rather than propagating to the top-level 500 boundary.
 */
async function readJsonBody(
  request: Request
): Promise<
  { ok: true; value: unknown } | { ok: false; response: Response }
> {
  const contentLength = request.headers.get("Content-Length");
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (!Number.isFinite(size) || size < 0 || size > MAX_JSON_BODY_BYTES) {
      return {
        ok: false,
        response: createJsonResponse(
          {
            success: false,
            error: `Request body too large (max ${MAX_JSON_BODY_BYTES} bytes)`,
          },
          400
        ),
      };
    }
  }

  const reader = request.body?.getReader();
  if (!reader) {
    return {
      ok: false,
      response: createJsonResponse(
        { success: false, error: "Empty request body" },
        400
      ),
    };
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_JSON_BODY_BYTES) {
        try {
          await reader.cancel();
        } catch {
          /* ignore */
        }
        return {
          ok: false,
          response: createJsonResponse(
            {
              success: false,
              error: `Request body too large (max ${MAX_JSON_BODY_BYTES} bytes)`,
            },
            400
          ),
        };
      }
      chunks.push(value);
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* ignore */
    }
  }

  try {
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.byteLength;
    }
    const text = new TextDecoder().decode(merged);
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return {
      ok: false,
      response: createJsonResponse(
        { success: false, error: "Invalid JSON in request body" },
        400
      ),
    };
  }
}

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
    const body = await readJsonBody(request);
    if (!body.ok) return body.response;
    const parsed = validateJson(TradeBodySchema, body.value);
    if (!parsed.ok) {
      // Drop invalid metrics safely — do not write partial data points
      return createJsonResponse(
        { success: false, error: "Validation failed", details: parsed.error },
        400
      );
    }
    const { payload, result, latencyMs } = parsed.value;
    trackTrade(payload, result, latencyMs ?? 0, env);
    return createJsonResponse({ success: true });
  },
  [internalAuth]
);

router.post(
  "/track/api-call",
  async (request, env, _ctx) => {
    const body = await readJsonBody(request);
    if (!body.ok) return body.response;
    const parsed = validateJson(ApiCallBodySchema, body.value);
    if (!parsed.ok) {
      return createJsonResponse(
        { success: false, error: "Validation failed", details: parsed.error },
        400
      );
    }
    trackApiCall(env, parsed.value);
    return createJsonResponse({ success: true });
  },
  [internalAuth]
);

router.post(
  "/track/worker-perf",
  async (request, env, _ctx) => {
    const body = await readJsonBody(request);
    if (!body.ok) return body.response;
    const parsed = validateJson(WorkerPerfBodySchema, body.value);
    if (!parsed.ok) {
      return createJsonResponse(
        { success: false, error: "Validation failed", details: parsed.error },
        400
      );
    }
    const { data } = parsed.value;
    trackWorkerPerf(data, env);
    return createJsonResponse({ success: true });
  },
  [internalAuth]
);

router.post(
  "/track/signal",
  async (request, env, _ctx) => {
    const body = await readJsonBody(request);
    if (!body.ok) return body.response;
    const parsed = validateJson(SignalBodySchema, body.value);
    if (!parsed.ok) {
      return createJsonResponse(
        { success: false, error: "Validation failed", details: parsed.error },
        400
      );
    }
    const { data } = parsed.value;
    trackSignal(data, env);
    return createJsonResponse({ success: true });
  },
  [internalAuth]
);

router.post(
  "/track/notification",
  async (request, env, _ctx) => {
    const body = await readJsonBody(request);
    if (!body.ok) return body.response;
    const parsed = validateJson(NotificationBodySchema, body.value);
    if (!parsed.ok) {
      return createJsonResponse(
        { success: false, error: "Validation failed", details: parsed.error },
        400
      );
    }
    const { data } = parsed.value;
    trackNotification(data, env);
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
  env: Env,
  body: z.infer<typeof ApiCallBodySchema>
): void {
  const dataPoint = buildDataPoint.apiCall(
    body.worker,
    body.endpoint,
    body.latencyMs,
    body.success
  );
  if (body.indexes?.length) {
    dataPoint.indexes = [
      ...dataPoint.indexes,
      ...sanitizeIndexes(body.indexes),
    ];
  }
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

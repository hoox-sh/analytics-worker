/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  DataPoint,
  TradePayload,
  TradeResult,
  WorkerPerfData,
  SignalData,
  NotificationData,
} from "./types";

// crypto is available globally in Cloudflare Workers - no import needed

export const buildDataPoint = {
  trade(
    payload: TradePayload,
    result: TradeResult,
    latencyMs: number
  ): DataPoint {
    return {
      blobs: [
        "trade",
        "trade-worker",
        result.success ? "success" : "failure",
        // Encode mode in exchange label so AE queries can filter without
        // a new blob index (index 5 would shift existing consumers).
        payload.test ? `${payload.exchange}:test` : payload.exchange,
        payload.symbol,
      ],
      doubles: [payload.quantity, payload.price ?? 0, latencyMs],
      indexes: [payload.requestId || crypto.randomUUID()],
    };
  },

  apiCall(
    worker: string,
    endpoint: string,
    latencyMs: number,
    success: boolean
  ): DataPoint {
    return {
      blobs: [
        "api-call",
        worker,
        success ? "success" : "failure",
        endpoint,
        "",
      ],
      doubles: [latencyMs, 0, 0],
      indexes: [crypto.randomUUID()],
    };
  },

  workerPerf(data: WorkerPerfData): DataPoint {
    return {
      blobs: [
        "worker-perf",
        data.worker,
        data.errors > 0 ? "degraded" : "success",
        "",
        "",
      ],
      doubles: [data.requests, data.errors, data.duration],
      indexes: [crypto.randomUUID()],
    };
  },

  signal(data: SignalData): DataPoint {
    return {
      blobs: ["signal", data.source, "pending", data.type, data.symbol],
      doubles: [data.confidence, 0, 0],
      indexes: [crypto.randomUUID()],
    };
  },

  notification(data: NotificationData): DataPoint {
    return {
      blobs: [
        "notification",
        data.target,
        data.success ? "success" : "failure",
        data.type,
        "",
      ],
      doubles: [0, 0, 0],
      indexes: [crypto.randomUUID()],
    };
  },
};

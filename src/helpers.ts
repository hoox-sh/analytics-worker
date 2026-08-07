/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
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

/** Analytics Engine blob / index size caps (bytes of UTF-16 code units ≈ chars). */
export const MAX_BLOB_CHARS = 256;
export const MAX_INDEX_CHARS = 96;
export const MAX_INDEXES = 8;

/** Coerce to a finite number; drop non-finite values as 0 (safe metric). */
export function safeDouble(n: unknown, fallback = 0): number {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? v : fallback;
}

/** Truncate / stringify blob fields so AE writeDataPoint never sees huge strings. */
export function safeBlob(value: unknown, max = MAX_BLOB_CHARS): string {
  const s = value == null ? "" : String(value);
  if (s.length <= max) return s;
  return s.slice(0, max);
}

export function safeIndex(value: unknown): string {
  return safeBlob(value, MAX_INDEX_CHARS);
}

export function sanitizeIndexes(indexes: string[] | undefined): string[] {
  if (!indexes?.length) return [];
  return indexes.slice(0, MAX_INDEXES).map(safeIndex);
}

export const buildDataPoint = {
  trade(
    payload: TradePayload,
    result: TradeResult,
    latencyMs: number
  ): DataPoint {
    const exchangeLabel = payload.test
      ? `${payload.exchange}:test`
      : payload.exchange;
    return {
      blobs: [
        "trade",
        "trade-worker",
        result.success ? "success" : "failure",
        // Encode mode in exchange label so AE queries can filter without
        // a new blob index (index 5 would shift existing consumers).
        safeBlob(exchangeLabel),
        safeBlob(payload.symbol),
      ],
      doubles: [
        safeDouble(payload.quantity),
        safeDouble(payload.price ?? 0),
        safeDouble(latencyMs),
      ],
      indexes: [safeIndex(payload.requestId || crypto.randomUUID())],
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
        safeBlob(worker),
        success ? "success" : "failure",
        safeBlob(endpoint),
        "",
      ],
      doubles: [safeDouble(latencyMs), 0, 0],
      indexes: [crypto.randomUUID()],
    };
  },

  workerPerf(data: WorkerPerfData): DataPoint {
    return {
      blobs: [
        "worker-perf",
        safeBlob(data.worker),
        data.errors > 0 ? "degraded" : "success",
        "",
        "",
      ],
      doubles: [
        safeDouble(data.requests),
        safeDouble(data.errors),
        safeDouble(data.duration),
      ],
      indexes: [crypto.randomUUID()],
    };
  },

  signal(data: SignalData): DataPoint {
    return {
      blobs: [
        "signal",
        safeBlob(data.source),
        "pending",
        safeBlob(data.type),
        safeBlob(data.symbol),
      ],
      doubles: [safeDouble(data.confidence), 0, 0],
      indexes: [crypto.randomUUID()],
    };
  },

  notification(data: NotificationData): DataPoint {
    return {
      blobs: [
        "notification",
        safeBlob(data.target),
        data.success ? "success" : "failure",
        safeBlob(data.type),
        "",
      ],
      doubles: [0, 0, 0],
      indexes: [crypto.randomUUID()],
    };
  },
};

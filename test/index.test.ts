/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import type { Env } from "../src/index";
import { trackApiCall } from "../src/index";

// Mock environment shared across tests
const mockWriteDataPoint = mock(() => {});
const mockEnv = {
  ANALYTICS_ENGINE: { writeDataPoint: mockWriteDataPoint },
  INTERNAL_KEY_BINDING: "test-internal-key",
};

beforeEach(() => {
  mockWriteDataPoint.mockClear();
});

describe("trackTrade", () => {
  test("writes a trade data point to ANALYTICS_ENGINE", async () => {
    const { trackTrade } = await import("../src/index");
    const payload = {
      exchange: "binance",
      action: "LONG",
      symbol: "BTCUSDT",
      quantity: 0.5,
      price: 45000,
    };
    const result = { success: true };

    await trackTrade(payload, result, 1200, mockEnv as any);

    expect(mockWriteDataPoint).toHaveBeenCalledTimes(1);
    expect(mockWriteDataPoint).toHaveBeenCalledWith(
      expect.objectContaining({
        blobs: expect.arrayContaining([
          "trade",
          "trade-worker",
          "success",
          "binance",
          "BTCUSDT",
        ]),
      })
    );
  });
});

describe("trackApiCall", () => {
  test("writes an api-call data point to ANALYTICS_ENGINE", async () => {
    const { trackApiCall } = await import("../src/index");

    await trackApiCall(mockEnv as any, {
      worker: "trade-worker",
      endpoint: "/api/v3/order",
      latencyMs: 250,
      success: true,
    });

    expect(mockWriteDataPoint).toHaveBeenCalledTimes(1);
    expect(mockWriteDataPoint).toHaveBeenCalledWith(
      expect.objectContaining({
        blobs: expect.arrayContaining(["api-call", "trade-worker", "success"]),
      })
    );
  });
});

describe("trackWorkerPerf", () => {
  test("writes a worker-perf data point to ANALYTICS_ENGINE", async () => {
    const { trackWorkerPerf } = await import("../src/index");

    await trackWorkerPerf(
      { worker: "trade-worker", requests: 100, errors: 0, duration: 25000 },
      mockEnv as any
    );

    expect(mockWriteDataPoint).toHaveBeenCalledTimes(1);
    expect(mockWriteDataPoint).toHaveBeenCalledWith(
      expect.objectContaining({
        blobs: expect.arrayContaining([
          "worker-perf",
          "trade-worker",
          "success",
        ]),
      })
    );
  });
});

describe("trackSignal", () => {
  test("writes a signal data point to ANALYTICS_ENGINE", async () => {
    const { trackSignal } = await import("../src/index");

    await trackSignal(
      {
        source: "agent-worker",
        type: "BUY",
        symbol: "ETHUSDT",
        confidence: 0.85,
      },
      mockEnv as any
    );

    expect(mockWriteDataPoint).toHaveBeenCalledTimes(1);
    expect(mockWriteDataPoint).toHaveBeenCalledWith(
      expect.objectContaining({
        blobs: expect.arrayContaining(["signal", "agent-worker", "pending"]),
      })
    );
  });
});

describe("trackNotification", () => {
  test("writes a notification data point to ANALYTICS_ENGINE", async () => {
    const { trackNotification } = await import("../src/index");

    await trackNotification(
      { type: "trade_executed", target: "telegram", success: true },
      mockEnv as any
    );

    expect(mockWriteDataPoint).toHaveBeenCalledTimes(1);
    expect(mockWriteDataPoint).toHaveBeenCalledWith(
      expect.objectContaining({
        blobs: expect.arrayContaining(["notification", "telegram", "success"]),
      })
    );
  });
});

describe("HTTP fetch handler", () => {
  test("POST /track/trade returns 200 and writes data point", async () => {
    const { default: worker } = await import("../src/index");
    const req = new Request("http://localhost/track/trade", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Auth-Key": "test-internal-key",
      },
      body: JSON.stringify({
        payload: {
          exchange: "binance",
          action: "LONG",
          symbol: "BTCUSDT",
          quantity: 0.5,
        },
        result: { success: true },
        latencyMs: 1200,
      }),
    });

    const resp = await worker.fetch(req, mockEnv as any, {} as any);
    const data = (await resp.json()) as { success: boolean };

    expect(resp.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockWriteDataPoint).toHaveBeenCalled();
  });

  test("POST /track/api-call returns 200 and writes data point", async () => {
    const { default: worker } = await import("../src/index");
    const req = new Request("http://localhost/track/api-call", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Auth-Key": "test-internal-key",
      },
      body: JSON.stringify({
        worker: "trade-worker",
        endpoint: "/api/v3/order",
        latencyMs: 250,
        success: true,
      }),
    });

    const resp = await worker.fetch(req, mockEnv as any, {} as any);

    expect(resp.status).toBe(200);
    expect(mockWriteDataPoint).toHaveBeenCalled();
  });

  test("POST /track/signal returns 200 and writes data point", async () => {
    const { default: worker } = await import("../src/index");
    const req = new Request("http://localhost/track/signal", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Auth-Key": "test-internal-key",
      },
      body: JSON.stringify({
        data: {
          source: "agent-worker",
          type: "BUY",
          symbol: "ETHUSDT",
          confidence: 0.85,
        },
      }),
    });

    const resp = await worker.fetch(req, mockEnv as any, {} as any);

    expect(resp.status).toBe(200);
    expect(mockWriteDataPoint).toHaveBeenCalled();
  });

  test("POST /track/worker-perf returns 200 and writes data point", async () => {
    const { default: worker } = await import("../src/index");
    const req = new Request("http://localhost/track/worker-perf", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Auth-Key": "test-internal-key",
      },
      body: JSON.stringify({
        data: {
          worker: "trade-worker",
          requests: 100,
          errors: 0,
          duration: 25000,
        },
      }),
    });

    const resp = await worker.fetch(req, mockEnv as any, {} as any);

    expect(resp.status).toBe(200);
    expect(mockWriteDataPoint).toHaveBeenCalled();
  });

  test("POST /track/notification returns 200 and writes data point", async () => {
    const { default: worker } = await import("../src/index");
    const req = new Request("http://localhost/track/notification", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Auth-Key": "test-internal-key",
      },
      body: JSON.stringify({
        data: {
          type: "trade_executed",
          target: "telegram",
          success: true,
        },
      }),
    });

    const resp = await worker.fetch(req, mockEnv as any, {} as any);

    expect(resp.status).toBe(200);
    expect(mockWriteDataPoint).toHaveBeenCalled();
  });

  test("GET request returns 405 method not allowed", async () => {
    const { default: worker } = await import("../src/index");
    const req = new Request("http://localhost/track/trade", {
      headers: { "X-Internal-Auth-Key": "test-internal-key" },
    });

    const resp = await worker.fetch(req, mockEnv as any, {} as any);
    expect(resp.status).toBe(405);
    expect(mockWriteDataPoint).not.toHaveBeenCalled();
  });

  test("GET /health returns 200", async () => {
    const { default: worker } = await import("../src/index");
    const req = new Request("http://localhost/health");

    const resp = await worker.fetch(req, mockEnv as any, {} as any);
    expect(resp.status).toBe(200);
    const data = (await resp.json()) as Record<string, unknown>;
    expect(data.success).toBe(true);
    const result = data.result as Record<string, unknown>;
    expect(result.status).toBe("ok");
    expect(result.service).toBe("analytics-worker");
  });

  test("POST /track/trade returns 400 for invalid payload", async () => {
    const { default: worker } = await import("../src/index");
    const req = new Request("http://localhost/track/trade", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Auth-Key": "test-internal-key",
      },
      body: JSON.stringify({ payload: { exchange: "binance" } }),
    });

    const resp = await worker.fetch(req, mockEnv as any, {} as any);
    expect(resp.status).toBe(400);
    const data = (await resp.json()) as { success: boolean };
    expect(data.success).toBe(false);
    expect(mockWriteDataPoint).not.toHaveBeenCalled();
  });

  test("POST /track/api-call returns 400 for missing fields", async () => {
    const { default: worker } = await import("../src/index");
    const req = new Request("http://localhost/track/api-call", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Auth-Key": "test-internal-key",
      },
      body: JSON.stringify({}),
    });

    const resp = await worker.fetch(req, mockEnv as any, {} as any);
    expect(resp.status).toBe(400);
    expect(mockWriteDataPoint).not.toHaveBeenCalled();
  });

  test("POST /track/signal returns 400 for invalid confidence", async () => {
    const { default: worker } = await import("../src/index");
    const req = new Request("http://localhost/track/signal", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Auth-Key": "test-internal-key",
      },
      body: JSON.stringify({
        data: {
          source: "test",
          type: "BUY",
          symbol: "BTC",
          confidence: "high",
        },
      }),
    });

    const resp = await worker.fetch(req, mockEnv as any, {} as any);
    expect(resp.status).toBe(400);
    expect(mockWriteDataPoint).not.toHaveBeenCalled();
  });

  test("POST /track/worker-perf returns 400 for missing data fields", async () => {
    const { default: worker } = await import("../src/index");
    const req = new Request("http://localhost/track/worker-perf", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Auth-Key": "test-internal-key",
      },
      body: JSON.stringify({ data: { worker: "test" } }),
    });

    const resp = await worker.fetch(req, mockEnv as any, {} as any);
    expect(resp.status).toBe(400);
    expect(mockWriteDataPoint).not.toHaveBeenCalled();
  });

  test("POST /track/notification returns 400 for missing success field", async () => {
    const { default: worker } = await import("../src/index");
    const req = new Request("http://localhost/track/notification", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Auth-Key": "test-internal-key",
      },
      body: JSON.stringify({ data: { type: "alert", target: "telegram" } }),
    });

    const resp = await worker.fetch(req, mockEnv as any, {} as any);
    expect(resp.status).toBe(400);
    expect(mockWriteDataPoint).not.toHaveBeenCalled();
  });

  test("POST with invalid JSON body returns 400 (drop invalid metric)", async () => {
    const { default: worker } = await import("../src/index");
    const req = new Request("http://localhost/track/trade", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Auth-Key": "test-internal-key",
      },
      body: "not-json-at-all",
    });

    const resp = await worker.fetch(req, mockEnv as any, {} as any);
    expect(resp.status).toBe(400);
    const data = (await resp.json()) as Record<string, unknown>;
    expect(data.success).toBe(false);
    expect(mockWriteDataPoint).not.toHaveBeenCalled();
  });

  test("POST /track/trade rejects NaN/Infinity metrics without writing", async () => {
    const { default: worker } = await import("../src/index");
    const req = new Request("http://localhost/track/trade", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Auth-Key": "test-internal-key",
      },
      body: JSON.stringify({
        payload: {
          exchange: "binance",
          action: "LONG",
          symbol: "BTCUSDT",
          quantity: Number.POSITIVE_INFINITY,
        },
        result: { success: true },
        latencyMs: 10,
      }),
    });

    const resp = await worker.fetch(req, mockEnv as any, {} as any);
    expect(resp.status).toBe(400);
    expect(mockWriteDataPoint).not.toHaveBeenCalled();
  });

  test("POST /track/trade rejects unknown fields (.strict)", async () => {
    const { default: worker } = await import("../src/index");
    const req = new Request("http://localhost/track/trade", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Auth-Key": "test-internal-key",
      },
      body: JSON.stringify({
        payload: {
          exchange: "binance",
          action: "LONG",
          symbol: "BTCUSDT",
          quantity: 1,
        },
        result: { success: true },
        evil: true,
      }),
    });

    const resp = await worker.fetch(req, mockEnv as any, {} as any);
    expect(resp.status).toBe(400);
    expect(mockWriteDataPoint).not.toHaveBeenCalled();
  });

  test("missing auth key fails closed with 401", async () => {
    const { default: worker } = await import("../src/index");
    const req = new Request("http://localhost/track/trade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payload: {
          exchange: "binance",
          action: "LONG",
          symbol: "BTCUSDT",
          quantity: 1,
        },
        result: { success: true },
      }),
    });
    const resp = await worker.fetch(req, mockEnv as any, {} as any);
    expect(resp.status).toBe(401);
    expect(mockWriteDataPoint).not.toHaveBeenCalled();
  });
});

describe("writeDataPoint", () => {
  test("writes arbitrary data point to ANALYTICS_ENGINE", async () => {
    const { writeDataPoint } = await import("../src/index");
    const dp = {
      blobs: ["custom", "test"],
      doubles: [1, 2, 3],
      indexes: ["idx1"],
    };

    await writeDataPoint(dp, mockEnv as any);

    expect(mockWriteDataPoint).toHaveBeenCalledWith({
      blobs: ["custom", "test"],
      doubles: [1, 2, 3],
      indexes: ["idx1"],
    });
  });
});

describe("trackApiCall indexes", () => {
  test("appends custom indexes to the data point", async () => {
    const writes: Array<unknown> = [];
    const env = {
      ANALYTICS_ENGINE: {
        writeDataPoint: (dp: unknown) => {
          writes.push(dp);
        },
      },
    } as unknown as Env;

    const body = {
      worker: "hoox",
      endpoint: "/webhook",
      latencyMs: 42,
      success: true,
      indexes: ["probe-abc-123", "extra-tag"],
    };

    await trackApiCall(env, body);

    expect(writes).toHaveLength(1);
    const dp = writes[0] as { indexes: string[] };
    expect(dp.indexes).toContain("probe-abc-123");
    expect(dp.indexes).toContain("extra-tag");
    expect(dp.indexes.length).toBeGreaterThanOrEqual(3);
  });

  test("leaves indexes untouched when body has no indexes field", async () => {
    const writes: Array<unknown> = [];
    const env = {
      ANALYTICS_ENGINE: {
        writeDataPoint: (dp: unknown) => {
          writes.push(dp);
        },
      },
    } as unknown as Env;

    await trackApiCall(env, {
      worker: "hoox",
      endpoint: "/webhook",
      latencyMs: 42,
      success: true,
    });

    const dp = writes[0] as { indexes: string[] };
    expect(dp.indexes).toHaveLength(1);
  });
});

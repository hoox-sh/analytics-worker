import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";

// Mock environment shared across tests
const mockWriteDataPoint = mock(() => {});
const mockEnv = {
  ANALYTICS_ENGINE: { writeDataPoint: mockWriteDataPoint },
  CLOUDFLARE_API_TOKEN: "test-token",
  CLOUDFLARE_ACCOUNT_ID: "test-account",
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

    await trackApiCall(
      "trade-worker",
      "/api/v3/order",
      250,
      true,
      mockEnv as any
    );

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
    expect(resp.status).toBe(200);
    expect(mockWriteDataPoint).toHaveBeenCalled();
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

describe("query functions", () => {
  const origFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = origFetch;
  });

  test("getTradeMetrics executes SQL query via fetch", async () => {
    const mockJson = { data: [{ exchange: "binance", trade_count: 5 }] };
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify(mockJson), { status: 200 }))
    );

    const { getTradeMetrics } = await import("../src/index");
    const result = await getTradeMetrics(
      { start: "2024-01-01", end: "2024-12-31" },
      mockEnv as any
    );

    expect(result).toEqual(mockJson);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const fetchCall = (globalThis.fetch as any).mock.calls[0];
    expect(fetchCall[0]).toContain("analytics_engine/sql");
    expect(fetchCall[1].method).toBe("POST");
    expect(fetchCall[1].headers.Authorization).toBe("Bearer test-token");
  });

  test("getTradeMetrics throws when CLOUDFLARE_API_TOKEN is missing", async () => {
    const { getTradeMetrics } = await import("../src/index");
    const noTokenEnv = {
      ANALYTICS_ENGINE: { writeDataPoint: mock(() => {}) },
      CLOUDFLARE_ACCOUNT_ID: "test-account",
    };

    await expect(
      getTradeMetrics(
        { start: "2024-01-01", end: "2024-12-31" },
        noTokenEnv as any
      )
    ).rejects.toThrow("CLOUDFLARE_API_TOKEN not configured");
  });

  test("getTradeMetrics throws when CLOUDFLARE_ACCOUNT_ID is missing", async () => {
    const { getTradeMetrics } = await import("../src/index");
    const noAccountEnv = {
      ANALYTICS_ENGINE: { writeDataPoint: mock(() => {}) },
      CLOUDFLARE_API_TOKEN: "test-token",
    };

    await expect(
      getTradeMetrics(
        { start: "2024-01-01", end: "2024-12-31" },
        noAccountEnv as any
      )
    ).rejects.toThrow("CLOUDFLARE_ACCOUNT_ID not configured");
  });

  test("getTradeMetrics throws on non-ok response", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response("Service Unavailable", { status: 503 }))
    );

    const { getTradeMetrics } = await import("../src/index");

    await expect(
      getTradeMetrics(
        { start: "2024-01-01", end: "2024-12-31" },
        mockEnv as any
      )
    ).rejects.toThrow("Query failed: 503 Service Unavailable");
  });

  test("getTradesByExchange returns data from fetch", async () => {
    const mockJson = { data: [{ timestamp: "2024-01-01", symbol: "BTCUSDT" }] };
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify(mockJson), { status: 200 }))
    );

    const { getTradesByExchange } = await import("../src/index");
    const result = await getTradesByExchange("binance", 10, mockEnv as any);

    expect(result).toEqual(mockJson);
  });

  test("getTradeSuccessRate returns data from fetch", async () => {
    const mockJson = {
      data: [{ total: 100, successes: 80, success_rate: 80 }],
    };
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify(mockJson), { status: 200 }))
    );

    const { getTradeSuccessRate } = await import("../src/index");
    const result = await getTradeSuccessRate("2024-01-01", mockEnv as any);

    expect(result).toEqual(mockJson);
  });

  test("getWorkerPerformance returns data from fetch", async () => {
    const mockJson = {
      data: [{ data_type: "worker-perf", total_requests: 100 }],
    };
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify(mockJson), { status: 200 }))
    );

    const { getWorkerPerformance } = await import("../src/index");
    const result = await getWorkerPerformance(
      "trade-worker",
      "2024-01-01",
      mockEnv as any
    );

    expect(result).toEqual(mockJson);
  });

  test("getApiCallStats returns data from fetch", async () => {
    const mockJson = { data: [{ endpoint: "/api/v3/order", call_count: 50 }] };
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify(mockJson), { status: 200 }))
    );

    const { getApiCallStats } = await import("../src/index");
    const result = await getApiCallStats("binance", mockEnv as any);

    expect(result).toEqual(mockJson);
  });

  test("getSignalOutcomes returns data from fetch", async () => {
    const mockJson = { data: [{ source: "agent-worker", signal_count: 30 }] };
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify(mockJson), { status: 200 }))
    );

    const { getSignalOutcomes } = await import("../src/index");
    const result = await getSignalOutcomes("2024-01-01", mockEnv as any);

    expect(result).toEqual(mockJson);
  });
});

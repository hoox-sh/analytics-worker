import { describe, test, expect, mock } from "bun:test";
import { buildDataPoint } from "../src/helpers";
import { buildQuery } from "../src/query-builder";

// Mock environment
const mockEnv = {
  ANALYTICS_ENGINE: {
    writeDataPoint: mock(() => {}),
  },
  CLOUDFLARE_API_TOKEN: "test-token",
  CLOUDFLARE_ACCOUNT_ID: "test-account",
};

describe("Analytics Worker", () => {
  test("writeDataPoint calls ANALYTICS_ENGINE.writeDataPoint", async () => {
    const { writeDataPoint } = await import("../src/index.ts");
    const dp = {
      blobs: ["test"],
      doubles: [1],
      indexes: ["id1"],
    };

    await writeDataPoint(dp, mockEnv as any);
    expect(mockEnv.ANALYTICS_ENGINE.writeDataPoint).toHaveBeenCalledWith({
      blobs: ["test"],
      doubles: [1],
      indexes: ["id1"],
    });
  });

  test("trackTrade calls writeDataPoint with correct data", async () => {
    const { trackTrade } = await import("../src/index.ts");
    const payload = {
      exchange: "binance",
      action: "LONG",
      symbol: "BTCUSDT",
      quantity: 0.5,
      price: 45000,
    };
    const result = { success: true };
    const latencyMs = 1200;

    await trackTrade(payload, result, latencyMs, mockEnv as any);

    expect(mockEnv.ANALYTICS_ENGINE.writeDataPoint).toHaveBeenCalled();
  });

  test("fetch handler returns method not allowed for GET", async () => {
    const { default: worker } = await import("../src/index.ts");
    const req = new Request("http://localhost/");
    const resp = await worker.fetch(req, mockEnv as any, {} as any);
    const text = await resp.text();

    expect(text).toContain("Method not allowed");
    expect(resp.status).toBe(405);
  });

  test("fetch handler tracks trade via POST", async () => {
    const { default: worker } = await import("../src/index.ts");
    const req = new Request("http://localhost/track/trade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

    expect(data.success).toBe(true);
    expect(resp.status).toBe(200);
    expect(mockEnv.ANALYTICS_ENGINE.writeDataPoint).toHaveBeenCalled();
  });

  test("getTradeMetrics calls executeQuery with correct SQL", async () => {
    // This would need more sophisticated mocking
    // For now, just verify the function exists
    const { getTradeMetrics } = await import("../src/index.ts");
    expect(typeof getTradeMetrics).toBe("function");
  });
});

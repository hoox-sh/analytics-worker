import { buildDataPoint } from "../src/helpers";
import { describe, test, expect } from "bun:test";

describe("buildDataPoint", () => {
  test("buildDataPoint.trade creates correct data point", () => {
    const dp = buildDataPoint.trade(
      {
        exchange: "binance",
        action: "LONG",
        symbol: "BTCUSDT",
        quantity: 0.5,
        price: 45000,
        requestId: "req-123",
      },
      { success: true },
      1200
    );

    expect(dp.blobs[0]).toBe("trade");
    expect(dp.blobs[1]).toBe("trade-worker");
    expect(dp.blobs[2]).toBe("success");
    expect(dp.doubles[0]).toBe(0.5);
    expect(dp.doubles[2]).toBe(1200);
  });

  test("buildDataPoint.apiCall creates correct data point", () => {
    const dp = buildDataPoint.apiCall(
      "trade-worker",
      "/api/v3/order",
      250,
      true
    );

    expect(dp.blobs[0]).toBe("api-call");
    expect(dp.blobs[1]).toBe("trade-worker");
    expect(dp.blobs[2]).toBe("success");
    expect(dp.blobs[3]).toBe("/api/v3/order");
    expect(dp.blobs[4]).toBe("");
    expect(dp.doubles[0]).toBe(250);
    expect(dp.doubles[1]).toBe(0);
    expect(dp.doubles[2]).toBe(0);
    expect(dp.indexes[0]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  test("apiCall marks failure when success is false", () => {
    const dp = buildDataPoint.apiCall(
      "trade-worker",
      "/api/v3/order",
      250,
      false
    );

    expect(dp.blobs[2]).toBe("failure");
  });

  test("trade marks failure when result.success is false", () => {
    const dp = buildDataPoint.trade(
      {
        exchange: "coinbase",
        action: "SHORT",
        symbol: "ETHUSDT",
        quantity: 1.0,
      },
      { success: false },
      500
    );

    expect(dp.blobs[0]).toBe("trade");
    expect(dp.blobs[1]).toBe("trade-worker");
    expect(dp.blobs[2]).toBe("failure");
    expect(dp.blobs[3]).toBe("coinbase");
    expect(dp.blobs[4]).toBe("ETHUSDT");
    expect(dp.doubles[0]).toBe(1.0);
    expect(dp.doubles[1]).toBe(0);
    expect(dp.doubles[2]).toBe(500);
  });

  test("trade uses crypto.randomUUID() when requestId is not provided", () => {
    const dp = buildDataPoint.trade(
      {
        exchange: "binance",
        action: "LONG",
        symbol: "BTCUSDT",
        quantity: 0.5,
      },
      { success: true },
      100
    );

    expect(dp.indexes[0]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  test("trade uses provided requestId as index", () => {
    const dp = buildDataPoint.trade(
      {
        exchange: "binance",
        action: "LONG",
        symbol: "BTCUSDT",
        quantity: 0.5,
        price: 45000,
        requestId: "req-abc-123",
      },
      { success: true },
      1200
    );

    expect(dp.indexes[0]).toBe("req-abc-123");
  });

  test("workerPerf marks degraded when errors > 0", () => {
    const dp = buildDataPoint.workerPerf({
      worker: "trade-worker",
      requests: 100,
      errors: 5,
      duration: 30000,
    });

    expect(dp.blobs[0]).toBe("worker-perf");
    expect(dp.blobs[1]).toBe("trade-worker");
    expect(dp.blobs[2]).toBe("degraded");
    expect(dp.blobs[3]).toBe("");
    expect(dp.blobs[4]).toBe("");
    expect(dp.doubles[0]).toBe(100);
    expect(dp.doubles[1]).toBe(5);
    expect(dp.doubles[2]).toBe(30000);
    expect(dp.indexes[0]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  test("workerPerf marks success when errors === 0", () => {
    const dp = buildDataPoint.workerPerf({
      worker: "agent-worker",
      requests: 50,
      errors: 0,
      duration: 15000,
    });

    expect(dp.blobs[2]).toBe("success");
  });

  test("signal creates correct data point", () => {
    const dp = buildDataPoint.signal({
      source: "agent-worker",
      type: "BUY",
      symbol: "ETHUSDT",
      confidence: 0.85,
    });

    expect(dp.blobs[0]).toBe("signal");
    expect(dp.blobs[1]).toBe("agent-worker");
    expect(dp.blobs[2]).toBe("pending");
    expect(dp.blobs[3]).toBe("BUY");
    expect(dp.blobs[4]).toBe("ETHUSDT");
    expect(dp.doubles[0]).toBe(0.85);
    expect(dp.doubles[1]).toBe(0);
    expect(dp.doubles[2]).toBe(0);
    expect(dp.indexes[0]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  test("signal handles low confidence and different type", () => {
    const dp = buildDataPoint.signal({
      source: "telegram-worker",
      type: "SELL",
      symbol: "BTCUSDT",
      confidence: 0.25,
    });

    expect(dp.blobs[1]).toBe("telegram-worker");
    expect(dp.blobs[2]).toBe("pending");
    expect(dp.blobs[3]).toBe("SELL");
    expect(dp.doubles[0]).toBe(0.25);
  });

  test("notification creates correct data point for success", () => {
    const dp = buildDataPoint.notification({
      type: "trade_executed",
      target: "telegram",
      success: true,
    });

    expect(dp.blobs[0]).toBe("notification");
    expect(dp.blobs[1]).toBe("telegram");
    expect(dp.blobs[2]).toBe("success");
    expect(dp.blobs[3]).toBe("trade_executed");
    expect(dp.blobs[4]).toBe("");
    expect(dp.doubles[0]).toBe(0);
    expect(dp.doubles[1]).toBe(0);
    expect(dp.doubles[2]).toBe(0);
    expect(dp.indexes[0]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  test("notification marks failure when success is false", () => {
    const dp = buildDataPoint.notification({
      type: "alert",
      target: "email",
      success: false,
    });

    expect(dp.blobs[2]).toBe("failure");
  });
});

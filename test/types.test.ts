// workers/analytics-worker/test/types.test.ts
import { describe, test, expect } from "bun:test";
import type { Env, DataPoint } from "../src/types";

describe("Env interface", () => {
  test("accepts valid env structure", () => {
    const env: Env = {
      ANALYTICS_ENGINE: {} as any,
      CLOUDFLARE_API_TOKEN: "test-token",
      CLOUDFLARE_ACCOUNT_ID: "test-account",
    };
    expect(typeof env.ANALYTICS_ENGINE).toBe("object");
    expect(env.CLOUDFLARE_API_TOKEN).toBe("test-token");
    expect(env.CLOUDFLARE_ACCOUNT_ID).toBe("test-account");
  });

  test("optional fields can be omitted", () => {
    const env: Env = {
      ANALYTICS_ENGINE: {} as any,
    };
    expect(env.CLOUDFLARE_API_TOKEN).toBeUndefined();
    expect(env.CLOUDFLARE_ACCOUNT_ID).toBeUndefined();
  });
});

describe("DataPoint interface", () => {
  test("accepts valid trade data point", () => {
    const dp: DataPoint = {
      blobs: ["trade", "trade-worker", "success", "binance", "BTCUSDT"],
      doubles: [0.5, 45000.5, 1200],
      indexes: ["req-123"],
    };
    expect(dp.blobs.length).toBe(5);
    expect(dp.doubles.length).toBe(3);
    expect(dp.indexes).toContain("req-123");
  });

  test("accepts minimal data point", () => {
    const dp: DataPoint = {
      blobs: [],
      doubles: [],
      indexes: [],
    };
    expect(dp.blobs).toHaveLength(0);
    expect(dp.doubles).toHaveLength(0);
    expect(dp.indexes).toHaveLength(0);
  });
});

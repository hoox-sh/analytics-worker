/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained
 * SPDX-License-Identifier: Apache-2.0
 */

// workers/analytics-worker/test/types.test.ts
import { describe, test, expect } from "bun:test";
import type { Env, DataPoint } from "../src/types";

describe("Env interface", () => {
  test("accepts valid env structure", () => {
    const env: Env = {
      ANALYTICS_ENGINE: {} as any,
      INTERNAL_KEY_BINDING: "test-internal-key",
    };
    expect(typeof env.ANALYTICS_ENGINE).toBe("object");
    expect(env.INTERNAL_KEY_BINDING).toBe("test-internal-key");
  });

  test("INTERNAL_KEY_BINDING is required", () => {
    const env: Env = {
      ANALYTICS_ENGINE: {} as any,
      INTERNAL_KEY_BINDING: "some-key",
    };
    expect(env.INTERNAL_KEY_BINDING).toBe("some-key");
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

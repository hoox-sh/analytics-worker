import { describe, test, expect } from "bun:test";
import { buildQuery } from "../src/query-builder";

// Import the function directly for sanitization tests
// sanitizeQueryInputs is not directly exported, but we can test via buildQuery methods

describe("buildQuery", () => {
  test("getTradeMetrics builds correct SQL", () => {
    const sql = buildQuery.getTradeMetrics({
      start: "2026-05-01T00:00:00Z",
      end: "2026-05-04T23:59:59Z",
    });

    expect(sql).toContain("blob1 = 'trade'");
    expect(sql).toContain("2026-05-01T00:00:00Z");
    expect(sql).toContain("COUNT(*)");
    expect(sql).toContain("GROUP BY blob3");
  });

  test("getWorkerPerformance builds correct SQL", () => {
    const sql = buildQuery.getWorkerPerformance("trade-worker", "2026-05-01");

    expect(sql).toContain("blob1 IN ('worker-perf', 'api-call')");
    expect(sql).toContain("blob2 = 'trade-worker'");
    expect(sql).toContain("2026-05-01");
  });

  test("getTradesByExchange builds correct SQL", () => {
    const sql = buildQuery.getTradesByExchange("binance", 50);

    expect(sql).toContain("blob1 = 'trade'");
    expect(sql).toContain("blob3 = 'binance'");
    expect(sql).toContain("LIMIT 50");
  });

  test("getTradeSuccessRate builds correct SQL", () => {
    const sql = buildQuery.getTradeSuccessRate("2026-05-01");

    expect(sql).toContain("blob1 = 'trade'");
    expect(sql).toContain("2026-05-01");
    expect(sql).toContain("success_rate");
  });

  test("getApiCallStats builds correct SQL", () => {
    const sql = buildQuery.getApiCallStats("binance");

    expect(sql).toContain("blob1 = 'api-call'");
    expect(sql).toContain("blob3 = 'binance'");
    expect(sql).toContain("call_count");
  });

  test("getSignalOutcomes builds correct SQL", () => {
    const sql = buildQuery.getSignalOutcomes("2026-05-01");

    expect(sql).toContain("blob1 = 'signal'");
    expect(sql).toContain("2026-05-01");
    expect(sql).toContain("signal_count");
  });

  describe("sanitization rejects invalid inputs", () => {
    test("invalid timeRange shape (missing start)", () => {
      expect(() =>
        (buildQuery.getTradeMetrics as any)({ start: null, end: "2026-05-01" })
      ).toThrow("must be an object with start and end properties");
    });

    test("invalid timeRange.start", () => {
      expect(() =>
        buildQuery.getTradeMetrics({ start: "not-a-date", end: "2026-05-01" })
      ).toThrow("not a valid date");
    });

    test("invalid timeRange.end", () => {
      expect(() =>
        buildQuery.getTradeMetrics({ start: "2026-05-01", end: "also-not" })
      ).toThrow("not a valid date");
    });

    test("invalid exchange name", () => {
      expect(() => buildQuery.getTradesByExchange("fake-exchange", 10)).toThrow(
        'Invalid exchange: "fake-exchange"'
      );
    });

    test("invalid worker name with special chars", () => {
      expect(() =>
        buildQuery.getWorkerPerformance("worker$bad!!", "2026-05-01")
      ).toThrow("Invalid worker name");
    });

    test("invalid timeRangeString", () => {
      expect(() => buildQuery.getTradeSuccessRate("bad-date")).toThrow(
        "not a valid date"
      );
    });

    test("getSignalOutcomes with invalid time range", () => {
      expect(() => buildQuery.getSignalOutcomes("nope")).toThrow(
        "not a valid date"
      );
    });
  });
});

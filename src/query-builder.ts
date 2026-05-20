// workers/analytics-worker/src/query-builder.ts
//
// SQL Injection Risk Note:
// All user-supplied values used in SQL query construction must pass through
// sanitizeQueryInputs() before being interpolated. Direct string interpolation
// of unsanitized input into SQL allows attackers to execute arbitrary queries
// against the analytics engine.

/** Allowed exchange values for analytics queries */
const ALLOWED_EXCHANGES = ["binance", "bybit", "mexc"] as const;

/** Regex for validating ISO 8601 date/time strings */
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?Z?)?$/;

/** Regex for validating worker names (alphanumeric, hyphens, underscores only) */
const WORKER_NAME_REGEX = /^[a-zA-Z0-9_-]+$/;

/** Maximum allowed limit value to prevent abuse */
const MAX_LIMIT = 1000;

/**
 * Validates and sanitizes query input parameters to prevent SQL injection.
 *
 * ## SQL Injection Risk
 * All user-supplied values used in SQL query construction must pass through
 * this validation before being interpolated. Direct string interpolation of
 * unsanitized input into SQL statements allows attackers to execute arbitrary
 * queries against the analytics engine.
 *
 * ## Validation rules
 * - `timeRange.start` / `timeRange.end`: Must be valid ISO 8601 date strings
 *   (e.g. `"2026-05-01"` or `"2026-05-01T00:00:00Z"`)
 * - `exchange`: Must be one of: binance, bybit, mexc, null, or undefined
 * - `worker`: Must contain only alphanumeric chars, hyphens, and underscores
 * - `limit`: Clamped between 1 and MAX_LIMIT (1000)
 * - `timeRangeString`: Must be a valid ISO 8601 date string
 *
 * @param options - Input parameters to validate
 * @returns Sanitized parameters with limit clamped to safe range
 * @throws {Error} If any parameter fails validation
 */
function sanitizeQueryInputs(options: {
  timeRange?: { start: string; end: string } | null;
  exchange?: string | null;
  worker?: string | null;
  limit?: number | null;
  timeRangeString?: string | null;
}): {
  timeRange: { start: string; end: string } | null;
  exchange: string | null;
  worker: string | null;
  limit: number;
  timeRangeString: string | null;
} {
  // --- Validate timeRange (object with start/end) ---
  const timeRange = options.timeRange ?? null;
  if (timeRange) {
    if (typeof timeRange !== "object" || !timeRange.start || !timeRange.end) {
      throw new Error(
        "Invalid timeRange: must be an object with start and end properties"
      );
    }
    if (
      !ISO_DATE_REGEX.test(timeRange.start) &&
      isNaN(Date.parse(timeRange.start))
    ) {
      throw new Error(
        `Invalid timeRange.start: "${timeRange.start}" is not a valid date`
      );
    }
    if (
      !ISO_DATE_REGEX.test(timeRange.end) &&
      isNaN(Date.parse(timeRange.end))
    ) {
      throw new Error(
        `Invalid timeRange.end: "${timeRange.end}" is not a valid date`
      );
    }
  }

  // --- Validate exchange (allowlisted values only) ---
  const exchange = options.exchange ?? null;
  if (
    exchange !== null &&
    !ALLOWED_EXCHANGES.includes(exchange as (typeof ALLOWED_EXCHANGES)[number])
  ) {
    throw new Error(
      `Invalid exchange: "${exchange}". Must be one of: ${ALLOWED_EXCHANGES.join(", ")}`
    );
  }

  // --- Validate worker (alphanumeric, hyphens, underscores only) ---
  const worker = options.worker ?? null;
  if (worker !== null && !WORKER_NAME_REGEX.test(worker)) {
    throw new Error(
      `Invalid worker name: "${worker}". Must contain only alphanumeric characters, hyphens, and underscores.`
    );
  }

  // --- Validate and clamp limit ---
  let limit = MAX_LIMIT;
  if (options.limit !== null && options.limit !== undefined) {
    limit = Math.max(1, Math.min(Math.floor(options.limit), MAX_LIMIT));
  }

  // --- Validate timeRangeString (ISO date string) ---
  const timeRangeString = options.timeRangeString ?? null;
  if (
    timeRangeString !== null &&
    !ISO_DATE_REGEX.test(timeRangeString) &&
    isNaN(Date.parse(timeRangeString))
  ) {
    throw new Error(
      `Invalid time range: "${timeRangeString}" is not a valid date`
    );
  }

  return { timeRange, exchange, worker, limit, timeRangeString };
}

export const buildQuery = {
  /**
   * Build SQL query for trade metrics grouped by exchange.
   * @param timeRange - Date range with ISO 8601 start and end strings
   */
  getTradeMetrics(timeRange: { start: string; end: string }): string {
    const sanitized = sanitizeQueryInputs({ timeRange });

    return `
      SELECT 
        blob3 as exchange, 
        COUNT(*) as trade_count,
        SUM(_sample_interval * double2) / SUM(_sample_interval) as avg_price,
        SUM(CASE WHEN blob2 = 'success' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN blob2 = 'failure' THEN 1 ELSE 0 END) as failure_count
      FROM hoox-analytics 
      WHERE blob1 = 'trade' 
        AND timestamp >= '${sanitized.timeRange!.start}' 
        AND timestamp <= '${sanitized.timeRange!.end}'
      GROUP BY blob3
    `.trim();
  },

  /**
   * Build SQL query for trades filtered by exchange.
   * @param exchange - Exchange name (validated against allowlist)
   * @param limit - Maximum number of results (clamped to MAX_LIMIT)
   */
  getTradesByExchange(exchange: string, limit: number = 100): string {
    const sanitized = sanitizeQueryInputs({ exchange, limit });

    return `
      SELECT 
        timestamp,
        blob4 as symbol,
        blob2 as action,
        double1 as quantity,
        double2 as price
      FROM hoox-analytics 
      WHERE blob1 = 'trade' 
        AND blob3 = '${sanitized.exchange}'
      ORDER BY timestamp DESC
      LIMIT ${sanitized.limit}
    `.trim();
  },

  /**
   * Build SQL query for trade success rate over a time range.
   * @param timeRange - Optional ISO 8601 date string for time filtering
   */
  getTradeSuccessRate(timeRange?: string): string {
    const sanitized = sanitizeQueryInputs({
      timeRangeString: timeRange ?? null,
    });

    const timeFilter = sanitized.timeRangeString
      ? `AND timestamp >= '${sanitized.timeRangeString}'`
      : "";

    return `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN blob2 = 'success' THEN 1 ELSE 0 END) as successes,
        (SUM(CASE WHEN blob2 = 'success' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) as success_rate
      FROM hoox-analytics 
      WHERE blob1 = 'trade' 
      ${timeFilter}
    `.trim();
  },

  /**
   * Build SQL query for worker performance metrics.
   * @param worker - Worker name (alphanumeric, hyphens, underscores only)
   * @param timeRange - Optional ISO 8601 date string for time filtering
   */
  getWorkerPerformance(worker: string, timeRange?: string): string {
    const sanitized = sanitizeQueryInputs({
      worker,
      timeRangeString: timeRange ?? null,
    });

    const timeFilter = sanitized.timeRangeString
      ? `AND timestamp >= '${sanitized.timeRangeString}'`
      : "";

    return `
      SELECT 
        blob1 as data_type,
        SUM(double1) as total_requests,
        SUM(double2) as total_errors,
        AVG(double3) as avg_duration_ms
      FROM hoox-analytics 
      WHERE blob1 IN ('worker-perf', 'api-call')
        AND blob2 = '${sanitized.worker}'
        ${timeFilter}
      GROUP BY blob1
    `.trim();
  },

  /**
   * Build SQL query for API call statistics, optionally filtered by exchange.
   * @param exchange - Optional exchange name (validated against allowlist)
   */
  getApiCallStats(exchange?: string): string {
    const sanitized = sanitizeQueryInputs({ exchange: exchange ?? null });

    const exchangeFilter = sanitized.exchange
      ? `AND blob3 = '${sanitized.exchange}'`
      : "";

    return `
      SELECT 
        blob3 as endpoint,
        COUNT(*) as call_count,
        AVG(double1) as avg_latency_ms,
        SUM(CASE WHEN blob2 = 'success' THEN 1 ELSE 0 END) as success_count
      FROM hoox-analytics 
      WHERE blob1 = 'api-call'
      ${exchangeFilter}
      GROUP BY blob3
      ORDER BY call_count DESC
    `.trim();
  },

  /**
   * Build SQL query for signal outcome analysis over a time range.
   * @param timeRange - Optional ISO 8601 date string for time filtering
   */
  getSignalOutcomes(timeRange?: string): string {
    const sanitized = sanitizeQueryInputs({
      timeRangeString: timeRange ?? null,
    });

    const timeFilter = sanitized.timeRangeString
      ? `AND timestamp >= '${sanitized.timeRangeString}'`
      : "";

    return `
      SELECT 
        blob2 as source,
        blob3 as signal_type,
        blob4 as symbol,
        COUNT(*) as signal_count,
        AVG(double1) as avg_confidence
      FROM hoox-analytics 
      WHERE blob1 = 'signal'
      ${timeFilter}
      GROUP BY blob2, blob3, blob4
      ORDER BY signal_count DESC
    `.trim();
  },
};

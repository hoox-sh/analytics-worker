// workers/analytics-worker/src/query-builder.ts
//
// REMOVED: Analytics Engine SQL query builder.
// Analytics Engine only supports writes via binding (writeDataPoint).
// Read queries required the Cloudflare REST API which violates the
// "Bindings over REST" best practice. All data is written to D1
// via d1-worker for queryable storage instead.
//
// See: .opencode/tasks/worker-audit-fixes/subtask_03.json (Critical #3)

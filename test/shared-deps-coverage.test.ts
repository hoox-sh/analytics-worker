/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Exercise pure helpers from @hoox-sh/hoox-shared already depended on by
 * analytics-worker (no network / real bindings).
 */

import { describe, expect, test } from "bun:test";
import { z } from "zod";
import {
  toError,
  createJsonResponse,
  createSuccessResponse,
  createErrorResponse,
  Errors,
} from "@hoox-sh/hoox-shared/errors";
import { healthCheck } from "@hoox-sh/hoox-shared/health";
import {
  timingSafeEqual,
  checkInternalAuth,
  requireInternalAuth,
  createInternalAuthMiddleware,
  validateJson,
  validateJsonLegacy,
  requireField,
  optionalField,
  createLogger,
  withRequestLog,
  corsHeaders,
  publicCorsHeaders,
  internalCorsHeaders,
  resolveCorsOptions,
  handleCorsPreflightRequest,
  createRateLimiter,
  secureHeaders,
  wrapWithSecurityHeaders,
} from "@hoox-sh/hoox-shared/middleware";
import { createRouter } from "@hoox-sh/hoox-shared/router";

describe("shared errors + health", () => {
  test("toError variants", () => {
    expect(toError(new Error("e"))).toBe("e");
    expect(toError("s")).toBe("s");
    expect(toError({ message: "m" })).toBe("m");
    expect(toError(null, "fb")).toBe("fb");
    expect(toError(7)).toBe("7");
  });

  test("response factories and Errors", async () => {
    expect((await createJsonResponse({ success: true })).status).toBe(200);
    expect((await createSuccessResponse({ status: "ok" })).status).toBe(200);
    expect((await createErrorResponse("bad", 400)).status).toBe(400);
    expect((await Errors.badRequest("b")).status).toBe(400);
    expect((await Errors.unauthorized()).status).toBe(401);
    expect((await Errors.forbidden()).status).toBe(403);
    expect((await Errors.notFound()).status).toBe(404);
    expect((await Errors.methodNotAllowed()).status).toBe(405);
    expect((await Errors.rateLimited(10)).status).toBe(429);
    expect((await Errors.internal()).status).toBe(500);
  });

  test("healthCheck with details", async () => {
    const res = healthCheck({
      worker: "analytics-worker",
      version: "1",
      details: { engine: "AE" },
    });
    expect(res.status).toBe(200);
    const j = (await res.json()) as {
      result: { service: string; details: { engine: string } };
    };
    expect(j.result.service).toBe("analytics-worker");
    expect(j.result.details.engine).toBe("AE");
  });
});

describe("shared middleware", () => {
  test("auth + validate", async () => {
    expect(timingSafeEqual("same", "same")).toBe(true);
    expect(timingSafeEqual("a", "b")).toBe(false);
    const env = { INTERNAL_KEY_BINDING: "secret" } as any;
    const good = new Request("https://a", {
      headers: { "X-Internal-Auth-Key": "secret" },
    });
    const bad = new Request("https://a");
    expect(checkInternalAuth(good, env).authorized).toBe(true);
    expect(checkInternalAuth(bad, env).authorized).toBe(false);
    expect(requireInternalAuth(good, env)).toBeNull();
    expect(requireInternalAuth(bad, env)?.status).toBe(401);
    expect(typeof createInternalAuthMiddleware()).toBe("function");

    const schema = z.object({ worker: z.string() });
    expect(validateJson(schema, { worker: "x" }).ok).toBe(true);
    expect(validateJson(schema, {}).ok).toBe(false);
    expect(
      (
        await validateJsonLegacy(
          new Request("https://a", {
            method: "POST",
            body: JSON.stringify({ a: 1 }),
          })
        )
      ).ok
    ).toBe(true);
    expect(
      (
        await validateJsonLegacy(
          new Request("https://a", { method: "POST", body: "bad" })
        )
      ).ok
    ).toBe(false);
    expect(requireField({ a: 1 }, "a").ok).toBe(true);
    expect(requireField({}, "a").ok).toBe(false);
    expect(optionalField({}, "a", "d")).toBe("d");
  });

  test("cors security rate-limit logger", async () => {
    expect(corsHeaders({ allowOrigin: "https://o" })[
      "Access-Control-Allow-Origin"
    ]).toBe("https://o");
    expect(publicCorsHeaders()["Access-Control-Allow-Origin"]).toBe("*");
    expect(internalCorsHeaders()).toBeDefined();
    resolveCorsOptions(new Request("https://a", {
      headers: { Origin: "https://o" },
    }), { CORS_ALLOW_ORIGIN: "https://o" } as any);
    const pre = handleCorsPreflightRequest(
      new Request("https://a", { method: "OPTIONS" }),
      { allowOrigin: "https://o" }
    );
    expect(pre).not.toBeNull();
    expect(pre!.status).toBe(204);

    const headers = secureHeaders();
    expect(Object.keys(headers).length).toBeGreaterThan(0);
    wrapWithSecurityHeaders(new Response("ok", { status: 200 }));

    const limiter = createRateLimiter(undefined, {
      maxRequests: 2,
      windowSeconds: 60,
      keyPrefix: "analytics",
    });
    const req = new Request("https://a/track", {
      headers: { "CF-Connecting-IP": "2.2.2.2" },
    });
    expect((await limiter.check(req)).allowed).toBe(true);
    expect((await limiter.checkKey("k1")).allowed).toBe(true);
    expect(await limiter.enforceKey("k2")).toBeNull();

    const log = createLogger({ service: "analytics-worker", module: "test" });
    log.info("i", { n: 1 });
    log.warn("w");
    log.error("e");
    log.debug("d");

    const wrapped = withRequestLog(
      async () => new Response(JSON.stringify({ ok: true })),
      { service: "analytics-worker", module: "router" }
    );
    const res = await wrapped(
      new Request("https://a/track/trade", { method: "POST" }),
      {} as any,
      { waitUntil: () => {} } as any
    );
    expect(res.status).toBe(200);
  });
});

describe("shared router", () => {
  test("registers routes and returns 404 for unknown", async () => {
    const router = createRouter();
    router.get("/health", async () => healthCheck({ worker: "analytics-worker" }));
    router.post("/track/trade", async () =>
      createJsonResponse({ success: true })
    );

    const health = await router.handle(
      new Request("https://a/health"),
      {} as any,
      {} as any
    );
    expect(health.status).toBe(200);

    const track = await router.handle(
      new Request("https://a/track/trade", { method: "POST" }),
      {} as any,
      {} as any
    );
    expect(track.status).toBe(200);

    const miss = await router.handle(
      new Request("https://a/nope"),
      {} as any,
      {} as any
    );
    expect(miss.status).toBe(404);
  });
});

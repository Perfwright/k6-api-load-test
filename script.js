/**
 * Perfwright — API Load Test: Baseline Scenario
 * Tool: k6 (https://k6.io)
 * Author: Perfwright (perfwright.com)
 *
 * Parameterized REST API user journey with:
 *  - Staged ramp-up via environment variables
 *  - Custom metrics (latency trend, error rate, throughput)
 *  - Per-endpoint thresholds
 *  - Named groups for clear reporting
 *
 * Usage:
 *   k6 run script.js
 *
 * Overrides (all optional):
 *   BASE_URL     Target base URL            default: https://api.example.com
 *   RAMP_TIME    Ramp-up duration (s)       default: 60
 *   STEADY_TIME  Steady-state duration (s)  default: 180
 *   PEAK_VUS     Virtual users at peak      default: 50
 */

import http from "k6/http";
import { check, group, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";
import { randomIntBetween } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";

// ---------------------------------------------------------------------------
// Configuration — override via -e / --env flags
// ---------------------------------------------------------------------------
const BASE_URL = __ENV.BASE_URL || "https://api.example.com";
const RAMP_TIME = `${__ENV.RAMP_TIME || 60}s`;
const STEADY_TIME = `${__ENV.STEADY_TIME || 180}s`;
const PEAK_VUS = parseInt(__ENV.PEAK_VUS || "50", 10);

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------
const listLatency = new Trend("list_endpoint_duration", true);   // ms, with percentiles
const detailLatency = new Trend("detail_endpoint_duration", true);
const createLatency = new Trend("create_endpoint_duration", true);
const errorRate = new Rate("http_error_rate");
const createdItems = new Counter("items_created");

// ---------------------------------------------------------------------------
// Test options
// ---------------------------------------------------------------------------
export const options = {
  stages: [
    { duration: RAMP_TIME,   target: PEAK_VUS },      // ramp up
    { duration: STEADY_TIME, target: PEAK_VUS },      // steady state
    { duration: RAMP_TIME,   target: Math.round(PEAK_VUS * 0.5) }, // step down
    { duration: RAMP_TIME,   target: 0 },             // ramp down
  ],

  thresholds: {
    // Overall HTTP
    http_req_duration:         ["p(95)<1000", "p(99)<2000"],
    http_req_failed:           ["rate<0.01"],          // <1 % failure rate

    // Per-endpoint custom metrics
    list_endpoint_duration:    ["p(95)<800"],
    detail_endpoint_duration:  ["p(95)<600"],
    create_endpoint_duration:  ["p(95)<1200"],

    // Business-level
    http_error_rate:           ["rate<0.01"],
  },

  // Output summary tags for cleaner reporting
  summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"],
};

// ---------------------------------------------------------------------------
// Default headers — extend as needed (auth tokens, API keys, etc.)
// ---------------------------------------------------------------------------
const HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json",
  // Authorization: `Bearer ${__ENV.API_TOKEN}`,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function taggedParams(endpointName) {
  return { headers: HEADERS, tags: { endpoint: endpointName } };
}

function assertOk(res, name) {
  const ok = check(res, {
    [`${name}: status 2xx`]: (r) => r.status >= 200 && r.status < 300,
    [`${name}: body not empty`]: (r) => r.body && r.body.length > 0,
  });
  errorRate.add(!ok);
  return ok;
}

// ---------------------------------------------------------------------------
// VU lifecycle — runs once per VU before the test loop
// ---------------------------------------------------------------------------
export function setup() {
  // Optional: authenticate once and pass token to default(); omit if unneeded.
  // const res = http.post(`${BASE_URL}/auth/token`, JSON.stringify({ ... }), { headers: HEADERS });
  // return { token: res.json("access_token") };
  return {};
}

// ---------------------------------------------------------------------------
// Main test loop
// ---------------------------------------------------------------------------
export default function (data) {
  // --- Group 1: Browse (list resources) ---
  group("browse", () => {
    const res = http.get(`${BASE_URL}/items?page=1&limit=20`, taggedParams("list"));
    listLatency.add(res.timings.duration);
    assertOk(res, "list");
    sleep(randomIntBetween(1, 3));
  });

  // --- Group 2: View detail ---
  group("view_detail", () => {
    const itemId = randomIntBetween(1, 100);
    const res = http.get(`${BASE_URL}/items/${itemId}`, taggedParams("detail"));
    detailLatency.add(res.timings.duration);
    assertOk(res, "detail");
    sleep(randomIntBetween(1, 2));
  });

  // --- Group 3: Create resource (subset of VUs, ~30 % of iterations) ---
  if (Math.random() < 0.3) {
    group("create", () => {
      const payload = JSON.stringify({
        name: `load-test-item-${Date.now()}`,
        value: randomIntBetween(1, 999),
        source: "k6-baseline",
      });

      const res = http.post(`${BASE_URL}/items`, payload, taggedParams("create"));
      createLatency.add(res.timings.duration);

      if (assertOk(res, "create")) {
        createdItems.add(1);
      }

      sleep(randomIntBetween(2, 4));
    });
  }
}

// ---------------------------------------------------------------------------
// End-of-test summary
// ---------------------------------------------------------------------------
export function handleSummary(data) {
  const passed = Object.values(data.metrics)
    .filter((m) => m.thresholds)
    .every((m) => Object.values(m.thresholds).every((t) => !t.ok === false));

  console.log(`\n=== Perfwright Baseline Summary ===`);
  console.log(`Target:        ${BASE_URL}`);
  console.log(`Peak VUs:      ${PEAK_VUS}`);
  console.log(`Error rate:    ${(data.metrics.http_error_rate?.values?.rate * 100 || 0).toFixed(2)}%`);
  console.log(`Items created: ${data.metrics.items_created?.values?.count || 0}`);
  console.log(`Thresholds:    ${passed ? "ALL PASSED ✓" : "SOME FAILED ✗"}`);
  console.log(`===================================\n`);

  return {
    "stdout": JSON.stringify(data, null, 2),
  };
}

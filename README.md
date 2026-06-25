# API Load Test — Baseline Scenario

**Tool:** k6 · JavaScript  
**Author:** [Perfwright](https://perfwright.com)

Parameterized user journey with thresholds, custom metrics, and staged ramp-up. Ready to run against any REST API.

## What it tests

Three sequential groups mirroring a typical API user journey:

| Group | Endpoint | Weight |
|---|---|---|
| Browse | `GET /items` (paginated) | 100 % of VUs |
| View detail | `GET /items/:id` | 100 % of VUs |
| Create | `POST /items` | ~30 % of VUs |

## Custom metrics

| Metric | Type | Description |
|---|---|---|
| `list_endpoint_duration` | Trend | Latency for the list endpoint |
| `detail_endpoint_duration` | Trend | Latency for detail requests |
| `create_endpoint_duration` | Trend | Latency for write operations |
| `http_error_rate` | Rate | Fraction of failed checks |
| `items_created` | Counter | Total successful POST operations |

## Thresholds

| Threshold | Limit |
|---|---|
| `http_req_duration` p95 | < 1 000 ms |
| `http_req_duration` p99 | < 2 000 ms |
| `http_req_failed` | < 1 % |
| `list_endpoint_duration` p95 | < 800 ms |
| `detail_endpoint_duration` p95 | < 600 ms |
| `create_endpoint_duration` p95 | < 1 200 ms |

## Load profile (default)

```
VUs
50 |          ________
   |         /        \
25 |        /          \____
   |       /                \
 0 |______/                  \____
    ramp   steady            step   ramp
     1m      3m               1m    down 1m
```

## Usage

```bash
# Basic run (defaults: 50 VUs, api.example.com)
k6 run script.js

# Point at a real target
k6 run -e BASE_URL=https://api.myapp.com script.js

# Higher load, authenticated
k6 run \
  -e BASE_URL=https://api.myapp.com \
  -e PEAK_VUS=200 \
  -e RAMP_TIME=120 \
  -e STEADY_TIME=300 \
  -e API_TOKEN=your_token_here \
  script.js

# Output to Grafana / InfluxDB
k6 run --out influxdb=http://localhost:8086/k6 script.js
```

## Prerequisites

- [k6](https://k6.io/docs/get-started/installation/) v0.46+

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `BASE_URL` | `https://api.example.com` | Target base URL |
| `PEAK_VUS` | `50` | Max virtual users |
| `RAMP_TIME` | `60` | Ramp-up/down duration in seconds |
| `STEADY_TIME` | `180` | Steady-state duration in seconds |
| `API_TOKEN` | — | Bearer token (uncomment auth header) |

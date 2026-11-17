#!/usr/bin/env python3
"""End-to-end smoke test on a disposable local Observability Docker Compose stack.

Proves OTLP/HTTP -> Collector -> Prometheus remote write, Grafana dashboard
provisioning and Prometheus alert rules. Uses disposable synthetic values only.
Only connects to 127.0.0.1; does not touch AWS, live users or production.
"""
import base64
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request


class NoRedirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, url):
        raise ValueError("Unexpected redirect")


OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirects())
TIMEOUT = int(os.environ.get("OBS_SMOKE_TIMEOUT", "180"))


def request(path, port, data=None, headers=None):
    url = "http://127.0.0.1:" + str(port) + path
    req = urllib.request.Request(url, data=data, headers=headers or {})
    with OPENER.open(req, timeout=5) as response:
        result = response.read(2_000_001)
        if len(result) > 2_000_000:
            raise AssertionError("Unusually large response")
        return json.loads(result) if result and result[:1] in (b"{", b"[") else result.decode()


def retry(label, check, seconds=None, interval=2):
    deadline = time.monotonic() + (seconds or TIMEOUT)
    last = None
    while time.monotonic() < deadline:
        try:
            outcome = check()
            if outcome:
                print("PASS:", label, flush=True)
                return outcome
            last = AssertionError("No data yet")
        except (urllib.error.URLError, OSError, ValueError, KeyError, AssertionError) as exc:
            last = exc
        time.sleep(interval)
    raise RuntimeError(f"FAIL: {label}: {type(last).__name__}: {last}")


def check_prometheus():
    return "Prometheus" in str(request("/-/ready", 9090))


def check_grafana():
    return request("/api/health", 3000).get("database") == "ok"


def check_dashboard():
    pwd = os.environ["GRAFANA_ADMIN_PASSWORD"]
    credential = base64.b64encode(("admin:" + pwd).encode()).decode()
    dashboard = request("/api/dashboards/uid/devatlas-business", 3000,
                        headers={"Authorization": "Basic " + credential})
    panels = dashboard["dashboard"]["panels"]
    panel = next(p for p in panels if p["title"] == "Quiz pass ratio")
    query = panel["targets"][0]["expr"]
    return ('devatlas_quiz_submissions_total{outcome="passed"}' in query and
            "devatlas_quiz_submissions_total[5m]" in query)


def check_alerts():
    data = request("/api/v1/rules?type=alert", 9090)
    names = {r["name"] for group in data["data"]["groups"] for r in group.get("rules", [])
             if r.get("type") == "alerting"}
    return {"DevAtlasQuizFailuresHigh", "DevAtlasTelemetryMissing"} <= names


def send_otlp_sample():
    now = time.time_ns()
    payload = {
        "resourceMetrics": [{
            "resource": {"attributes": [{"key": "service.name",
                                        "value": {"stringValue": "devatlas-ci-smoke"}}]},
            "scopeMetrics": [{
                "scope": {"name": "devatlas.business"},
                "metrics": [{
                    "name": "devatlas.quiz.submissions",
                    "unit": "1",
                    "sum": {
                        "aggregationTemporality": 2,
                        "isMonotonic": True,
                        "dataPoints": [{
                            "attributes": [{"key": "outcome", "value": {"stringValue": "passed"}}],
                            "startTimeUnixNano": str(now - 1_000_000_000),
                            "timeUnixNano": str(now),
                            "asInt": "3",
                        }],
                    },
                }],
            }],
        }],
    }
    result = request("/v1/metrics", 4318, json.dumps(payload).encode(),
                     {"Content-Type": "application/json"})
    return isinstance(result, dict)


def check_metric():
    expr = urllib.parse.quote('devatlas_quiz_submissions_total{outcome="passed"}', safe="")
    data = request("/api/v1/query?query=" + expr, 9090)
    matches = data["data"]["result"]
    return any(float(record["value"][1]) >= 3 for record in matches)


def main():
    retry("Prometheus ready", check_prometheus)
    retry("Grafana ready", check_grafana)
    retry("Grafana provisioned dashboard", check_dashboard)
    retry("Prometheus business alert rules loaded", check_alerts)
    retry("OTLP HTTP collector accepts metrics", send_otlp_sample, interval=3)
    retry("Prometheus received synthetic OTLP counter", check_metric)
    print("PASS: real disposable Collector -> Prometheus -> Grafana integration", flush=True)


if __name__ == "__main__":
    main()

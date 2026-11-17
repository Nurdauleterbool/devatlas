#!/usr/bin/env python3
"""Verify actual DevAtlas -> OpenTelemetry Collector -> Prometheus business metrics.

Only uses local HTTP (127.0.0.1), a disposable CI database and a synthetic
*failed* authentication attempt. No account is created; no secrets are sent.
"""
import json
import time
import urllib.error
import urllib.parse
import urllib.request

OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))
BASE = "http://127.0.0.1"
DEADLINE = 150


def local_request(port, path, data=None):
    assert path.startswith("/") and "//" not in path
    headers = {"Accept": "application/json"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(f"{BASE}:{port}{path}", data=data, headers=headers)
    with OPENER.open(request, timeout=8) as response:
        if response.status != 200:
            raise AssertionError(f"Unexpected HTTP response: {response.status}")
        return json.loads(response.read(200_000))


def until(description, check, seconds=DEADLINE):
    start = time.monotonic()
    last_error = None
    while time.monotonic() - start < seconds:
        try:
            if check():
                print(f"PASS: {description}", flush=True)
                return
            last_error = AssertionError("not ready")
        except (urllib.error.URLError, OSError, ValueError, KeyError, AssertionError) as exc:
            last_error = exc
        time.sleep(3)
    raise AssertionError(f"{description}: {last_error}")


def emit_real_auth_failure():
    payload = json.dumps({
        "email": "observability-ci@example.test",
        "password": "synthetic-ci-invalid-password",
    }).encode()
    request = urllib.request.Request(
        f"{BASE}:8000/api/v1/auth/login",
        data=payload,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    try:
        OPENER.open(request, timeout=12)
    except urllib.error.HTTPError as error:
        assert error.code == 401, f"Expected 401 for nonexistent CI test user, got {error.code}"
    else:
        raise AssertionError("Authentication of nonexistent CI user unexpectedly succeeded")
    print("PASS: real DevAtlas API recorded a denied authentication", flush=True)


def has_real_app_metric():
    query = urllib.parse.quote('devatlas_auth_attempts_total{outcome="failure"}', safe="")
    data = local_request(9090, "/api/v1/query?query=" + query)
    if data.get("status") != "success":
        return False
    results = data.get("data", {}).get("result", [])
    if results and any(float(item["value"][1]) >= 1 for item in results):
        print("Observed real app series:", [
            {key: value for key, value in item.get("metric", {}).items()
             if key in ("__name__", "outcome", "service_name")}
            for item in results
        ], flush=True)
        return True
    return False


def main():
    until("FastAPI + PostgreSQL health", lambda: local_request(8000, "/api/v1/health")["status"] == "ok")
    until("Prometheus API ready", lambda: local_request(9090, "/api/v1/query?query=up")["status"] == "success")
    emit_real_auth_failure()
    until("REAL DevAtlas auth failure reached Prometheus via Collector", has_real_app_metric)
    print("PASS: the application itself generated business telemetry; no synthetic OTLP payload was used")


if __name__ == "__main__":
    main()

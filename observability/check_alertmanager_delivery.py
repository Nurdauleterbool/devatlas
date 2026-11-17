#!/usr/bin/env python3
"""Run INSIDE the disposable oncall container, not against any real host.

Verify Alertmanager receives a synthetic alert and delivers its webhook to
the on-call responder. The test disables API/Issue tokens in GitHub Actions.
"""
import json
import os
import sqlite3
import time
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

assert not os.getenv("OPENAI_API_KEY"), "CI must not call external AI"
assert not os.getenv("GITHUB_TOKEN"), "CI must not create GitHub Issues"

dbpath = Path("/data/alerts.sqlite3")
alertname = "DevAtlasSyntheticOncallCI"
now = datetime.now(timezone.utc)
payload = [{
    "labels": {"alertname": alertname, "severity": "warning"},
    "annotations": {
        "summary": "Disposable CI test only; no user impact",
        "runbook": "No operator action needed",
    },
    "startsAt": (now - timedelta(seconds=30)).isoformat().replace("+00:00", "Z"),
    "endsAt": (now + timedelta(minutes=5)).isoformat().replace("+00:00", "Z"),
}]
req = urllib.request.Request(
    "http://alertmanager:9093/api/v2/alerts",
    data=json.dumps(payload).encode(),
    headers={"Content-Type": "application/json"},
)
with urllib.request.urlopen(req, timeout=10) as response:
    assert response.status in (200, 202), response.status
print("PASS: Alertmanager accepted synthetic CI-only alert", flush=True)

# The repository config groups for 30 seconds; allow processing + startup time.
deadline = time.monotonic() + 100
while time.monotonic() < deadline:
    if dbpath.exists():
        try:
            with sqlite3.connect(dbpath, timeout=2) as conn:
                active = conn.execute("SELECT count(*) FROM alerts WHERE active=1").fetchone()[0]
            if active >= 1:
                print("PASS: Alertmanager -> webhook -> oncall SQLite incident store", flush=True)
                raise SystemExit(0)
        except sqlite3.OperationalError:
            pass
    time.sleep(3)

raise SystemExit("FAIL: Alertmanager webhook did not reach oncall within 100 seconds")

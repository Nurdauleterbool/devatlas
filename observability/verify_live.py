#!/usr/bin/env python3
"""Read-only checks for local DevAtlas observability.

    python observability/verify_live.py --static-only
    python observability/verify_live.py --json

Live checks only reach HTTP 127.0.0.1 (proxies and redirects disabled).
Never writes cloud, GitHub, Docker, or monitoring configuration.
"""
import argparse
import json
from pathlib import Path
import urllib.error
import urllib.parse
import urllib.request


class NoRedirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError("Redirects are disabled for local checks")


def fetch_local(url, expect_json=True):
    parts = urllib.parse.urlsplit(url)
    if parts.scheme != "http" or parts.hostname != "127.0.0.1":
        raise ValueError("Only HTTP 127.0.0.1 is permitted")
    if parts.username or parts.password:
        raise ValueError("Credentials are not permitted")
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirects())
    with opener.open(urllib.request.Request(url, headers={"Accept": "application/json"}), timeout=4) as resp:
        data = resp.read(2_000_001)
        if len(data) > 2_000_000:
            raise ValueError("Response too large")
        if resp.status != 200:
            raise ValueError("Unexpected status")
        return json.loads(data) if expect_json else data.decode("utf-8", errors="replace")


def static_checks(root):
    checks = []
    def result(name, ok, detail):
        checks.append({"name": name, "status": "PASS" if ok else "FAIL", "detail": detail})

    try:
        dashboard = json.loads((root / "observability/grafana/dashboards/devatlas.json").read_text())
        panel = next(p for p in dashboard["panels"] if p["title"] == "Quiz pass ratio")
        query = panel["targets"][0]["expr"]
        ok = ('devatlas_quiz_submissions_total{outcome="passed"}' in query
              and "sum(rate(devatlas_quiz_submissions_total[5m]))" in query
              and "quiz_passes_total" not in query)
        result("Grafana quiz fraction", ok, "Uses same submission counter for numerator and denominator")
    except (OSError, ValueError, KeyError, StopIteration, TypeError) as exc:
        result("Grafana quiz fraction", False, type(exc).__name__)
    try:
        import yaml
    except ImportError:
        checks.append({"name": "YAML parser", "status": "WARN", "detail": "Install PyYAML for configuration checks"})
        return checks
    paths = ["collector/config.yaml", "prometheus/prometheus.yml", "prometheus/alerts.yml",
             "alertmanager/alertmanager.yml", "loki/config.yaml", "tempo/config.yaml",
             "compose.observability.yaml"]
    try:
        configs = {p: yaml.safe_load((root / "observability" / p).read_text()) for p in paths}
        result("Monitoring YAML", True, f"{len(paths)} valid YAML files")
        alerts = {r["alert"] for g in configs["prometheus/alerts.yml"]["groups"] for r in g["rules"]}
        result("Prometheus alerts", {"DevAtlasQuizFailuresHigh", "DevAtlasTelemetryMissing"} <= alerts, str(sorted(alerts)))
        am = configs["alertmanager/alertmanager.yml"]
        urls = [w["url"] for r in am["receivers"] for w in r.get("webhook_configs", [])]
        result("Alertmanager routing", am["route"]["receiver"] == "ai-oncall" and "http://oncall:8080/alerts" in urls, str(urls))
        pipelines = configs["collector/config.yaml"]["service"]["pipelines"]
        result("OpenTelemetry pipelines", {"metrics", "traces", "logs"} <= pipelines.keys(), str(sorted(pipelines)))
    except (OSError, ValueError, KeyError, TypeError, yaml.YAMLError) as exc:
        result("Monitoring YAML", False, type(exc).__name__)
    return checks


def live_checks():
    checks = []
    def record(name, fn):
        try:
            ok, detail = fn()
            checks.append({"name": name, "status": "PASS" if ok else "WARN", "detail": detail})
        except (urllib.error.URLError, TimeoutError, ValueError, KeyError, TypeError, OSError) as exc:
            checks.append({"name": name, "status": "WARN", "detail": type(exc).__name__})
    record("Prometheus readiness", lambda: (bool(fetch_local("http://127.0.0.1:9090/-/ready", False)), "Ready"))
    record("Grafana health", lambda: (fetch_local("http://127.0.0.1:3000/api/health").get("database") == "ok", "Database healthy"))
    def alert_rules():
        data = fetch_local("http://127.0.0.1:9090/api/v1/rules?type=alert")
        rules = {r["name"] for g in data["data"]["groups"] for r in g.get("rules", []) if r.get("type") == "alerting"}
        needed = {"DevAtlasQuizFailuresHigh", "DevAtlasTelemetryMissing"}
        return needed <= rules, str(sorted(rules))
    record("Live alert rules", alert_rules)
    def telemetry():
        url = "http://127.0.0.1:9090/api/v1/query?query=devatlas_quiz_submissions_total"
        series = fetch_local(url)["data"]["result"]
        return bool(series), f"{len(series)} quiz metric series"
    record("Real quiz telemetry", telemetry)
    return checks


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--root", type=Path, default=Path(__file__).resolve().parent.parent)
    p.add_argument("--json", action="store_true")
    p.add_argument("--static-only", action="store_true")
    args = p.parse_args(argv)
    checks = static_checks(args.root)
    if not args.static_only:
        checks.extend(live_checks())
    counts = {s: sum(c["status"] == s for c in checks) for s in ("PASS", "WARN", "FAIL")}
    if args.json:
        print(json.dumps({"counts": counts, "checks": checks}, indent=2))
    else:
        for c in checks:
            print(f'[{c["status"]}] {c["name"]}: {c["detail"]}')
        print(f'Summary: {counts}')
    return int(counts["FAIL"] > 0)


if __name__ == "__main__":
    raise SystemExit(main())

# DevAtlas Observability — запуск и проверка (без изменения Production)

This runbook is for an isolated local/monitoring host. Do **not** run the full
Prometheus/Grafana/Loki/Tempo stack on a 1 GiB t3.micro Production EC2.
The development EC2 is also very small; evaluate RAM, storage, and cost first.

## 1. Подготовка на отдельном компьютере/мониторинг-хосте

```bash
cp observability/.env.example observability/.env
# Edit observability/.env: set a UNIQUE, STRONG GRAFANA_ADMIN_PASSWORD
# Leave OPENAI_API_KEY and GITHUB_TOKEN blank until intentionally enabled.
docker network inspect devatlas-telemetry >/dev/null 2>&1 || docker network create devatlas-telemetry
docker compose --env-file observability/.env -f observability/compose.observability.yaml config --quiet
docker compose --env-file observability/.env -f observability/compose.observability.yaml up -d --build
```

Only local loopback ports 3000 (Grafana), 9090 (Prometheus), and 4318
(OTLP) are published on the monitoring host. For real app telemetry,
the app must be **on the same Docker network/host** or use a separately
secured collector path. The repository does not configure secure cross-host
telemetry; do not open public ingestion ports.

## 2. Проверка (read-only)

```bash
python -m pip install 'PyYAML>=6,<7'
python observability/verify_live.py --static-only
python observability/verify_live.py --json
curl -fsS http://127.0.0.1:9090/-/ready
curl -fsS http://127.0.0.1:3000/api/health
docker compose --env-file observability/.env -f observability/compose.observability.yaml exec -T oncall python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8080/healthz', timeout=4).read().decode())"
```

`verify_live.py` reports PASS for configuration/health checks. **WARN for quiz
telemetry means no real quiz metric series was observed**, even if Prometheus
and Grafana are healthy. Traffic through a running, instrumented application
is necessary; the script never fabricates metric events.

Dashboard: **DevAtlas — Business & Reliability**, Grafana URL
`http://127.0.0.1:3000`. Prometheus rules:
`DevAtlasQuizFailuresHigh` and `DevAtlasTelemetryMissing`.
The on-call endpoint remains private to Docker network `monitoring`.

## 3. Incident response (human approval required)

1. Inspect the firing alert and graph in Grafana/Prometheus.
2. Confirm whether business telemetry is enabled; no traffic may explain missing series.
3. Correlate the incident with recent releases, Tempo spans and sanitized Loki logs.
4. Escalate, roll back or change infrastructure **only after human approval**.
5. Verify recovered metrics/health and alert resolution before closing incident.

AI On-call is **advisory only**. Without `OPENAI_API_KEY` it uses a safe static
recommendation; without a separately scoped `GITHUB_TOKEN` it logs but does
not create Issues. Do not commit API keys or GitHub tokens.

## 4. CI and restrictions

Pull requests changing `observability/` trigger **Observability checks**,
which validate Grafana math, Prometheus/Alertmanager/OTLP config, and unit
tests for on-call incident deduplication. No CI step deploys monitoring.

All code changes in this PR are isolated from Production deployment.
Do not merge until GitHub CI succeeds. Production promotion remains a
separate, manual workflow requiring its own review.

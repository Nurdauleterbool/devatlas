"""Read-only verification tests. No external network or Docker required."""
import importlib.util
import io
import json
import sys
import tempfile
import unittest
import urllib.error
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("verify_live", ROOT / "observability/verify_live.py")
verify_live = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = verify_live
spec.loader.exec_module(verify_live)


class Reply:
    status = 200
    def __init__(self, body=None):
        self.body = body if body is not None else {"status": "success"}
    def read(self, limit=0):
        return json.dumps(self.body).encode()
    def __enter__(self):
        return self
    def __exit__(self, *args):
        return False


class VerifyLiveTests(unittest.TestCase):
    def test_local_only_enforced_before_network(self):
        for url in ("https://127.0.0.1:3000/", "http://example.org/",
                    "http://169.254.169.254/latest/meta-data/", "http://localhost:9090/",
                    "http://test:secret@127.0.0.1:9090/"):
            with self.subTest(url=url), self.assertRaises(ValueError):
                verify_live.fetch_local(url)

    def test_disallow_redirect(self):
        with self.assertRaisesRegex(ValueError, "Redirects"):
            verify_live.NoRedirects().redirect_request(None, None, 302, "Found", {}, "http://example.com/")

    def test_static_validation_passes(self):
        checks = verify_live.static_checks(ROOT)
        self.assertGreaterEqual(len(checks), 5)
        self.assertTrue(all(c["status"] == "PASS" for c in checks), checks)

    def test_offline_services_report_warnings(self):
        with mock.patch.object(verify_live, "fetch_local", side_effect=urllib.error.URLError("offline")):
            result = verify_live.live_checks()
        self.assertEqual(len(result), 4)
        self.assertTrue(all(x["status"] == "WARN" for x in result))

    def test_empty_real_telemetry_is_warning(self):
        def get(url, expect_json=True):
            if url.endswith("/-/ready"): return "Ready"
            if "/api/health" in url: return {"database": "ok"}
            if "/api/v1/rules" in url: return {"data": {"groups": [{"rules": [
                {"name": "DevAtlasQuizFailuresHigh", "type": "alerting"},
                {"name": "DevAtlasTelemetryMissing", "type": "alerting"}]}]}}
            return {"data": {"result": []}}
        with mock.patch.object(verify_live, "fetch_local", side_effect=get):
            result = {c["name"]: c["status"] for c in verify_live.live_checks()}
        self.assertEqual(result["Live alert rules"], "PASS")
        self.assertEqual(result["Real quiz telemetry"], "WARN")

    def test_static_only_never_hits_live(self):
        with mock.patch.object(verify_live, "live_checks", side_effect=AssertionError("live invoked")):
            with mock.patch("sys.stdout", new_callable=io.StringIO) as output:
                status = verify_live.main(["--root", str(ROOT), "--static-only", "--json"])
        self.assertEqual(status, 0)
        self.assertEqual(json.loads(output.getvalue())["counts"]["FAIL"], 0)


if __name__ == "__main__":
    unittest.main()

import contextlib
import io
import os
import tempfile
import threading
import unittest
import urllib.error
from pathlib import Path
from unittest import mock

import responder

class OncallTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        responder._store = responder.AlertStore(Path(self.tmp.name) / 'alerts.sqlite3')
        self.env = mock.patch.dict(os.environ, {'OPENAI_API_KEY': '', 'GITHUB_TOKEN': ''})
        self.env.start()
        self.addCleanup(self.env.stop)
        self.alert = {
            'status': 'firing',
            'fingerprint': '1234567890abcdef',
            'labels': {'alertname': 'DevAtlasQuizFailuresHigh', 'severity': 'warning'},
            'annotations': {'summary': 'High quiz failures', 'runbook': 'Check metrics'},
        }

    def test_dedup_persists_across_restarts(self):
        with mock.patch.object(responder, 'post_issue') as post, contextlib.redirect_stdout(io.StringIO()):
            responder.process([self.alert, self.alert])
            self.assertEqual(post.call_count, 1)
            responder._store = responder.AlertStore(Path(self.tmp.name) / 'alerts.sqlite3')
            responder.process([self.alert])
            self.assertEqual(post.call_count, 1)
            responder.process([{**self.alert, 'status': 'resolved'}])
            responder.process([self.alert])
            self.assertEqual(post.call_count, 2)

    def test_threads_are_deduplicated(self):
        with mock.patch.object(responder, 'post_issue') as post, contextlib.redirect_stdout(io.StringIO()):
            threads = [threading.Thread(target=responder.process, args=([self.alert],)) for _ in range(10)]
            for thread in threads:
                thread.start()
            for thread in threads:
                thread.join()
            self.assertEqual(post.call_count, 1)

    def test_no_key_uses_fallback(self):
        with mock.patch.object(responder.urllib.request, 'urlopen') as urlopen:
            *_, recommendation = responder.assess(self.alert)
            self.assertEqual(recommendation, responder.FALLBACK)
            urlopen.assert_not_called()

    def test_ai_error_falls_back(self):
        with mock.patch.dict(os.environ, {'OPENAI_API_KEY': 'dummy'}):
            with mock.patch.object(responder.urllib.request, 'urlopen', side_effect=urllib.error.URLError('offline')):
                *_, recommendation = responder.assess(self.alert)
                self.assertEqual(recommendation, responder.FALLBACK)

    def test_invalid_alert_is_ignored(self):
        with mock.patch.object(responder, 'post_issue') as post:
            responder.process([{'status': 'firing', 'labels': 'bad'}])
            post.assert_not_called()

    def test_clean_rejects_control_characters(self):
        self.assertEqual(responder.clean('test\n**danger**\x1b'), 'testdanger')

if __name__ == '__main__':
    unittest.main()

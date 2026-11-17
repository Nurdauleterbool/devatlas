import json
from pathlib import Path
import unittest

BASE = Path(__file__).resolve().parent

class DashboardTests(unittest.TestCase):
    def test_grafana_quiz_ratio(self):
        data = json.loads((BASE / 'observability/grafana/dashboards/devatlas.json').read_text(encoding='utf-8'))
        panel = next(p for p in data['panels'] if p['title'] == 'Quiz pass ratio')
        expr = panel['targets'][0]['expr']
        self.assertIn('devatlas_quiz_submissions_total{outcome="passed"}', expr)
        self.assertIn('sum(rate(devatlas_quiz_submissions_total[5m]))', expr)
        self.assertNotIn('quiz_passes_total', expr)
        self.assertEqual(panel['fieldConfig']['defaults']['unit'], 'percentunit')
        self.assertEqual(panel['fieldConfig']['defaults']['min'], 0)
        self.assertEqual(panel['fieldConfig']['defaults']['max'], 1)
        self.assertEqual(len(data['panels']), 4)

if __name__ == '__main__':
    unittest.main()

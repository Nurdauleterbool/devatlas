"""Static safety tests: NEVER invoke Production SSM, Docker or AWS here."""
import pathlib
import subprocess
import tempfile
import unittest

import yaml

REPO = pathlib.Path(__file__).resolve().parents[1]
WORKFLOW = REPO / ".github/workflows/promote-production.yml"
PROD_ID = "i-04c0e9c7e74eaba84"
DEV_ID = "i-02e00d28cf030334d"
DEV_ROLE = "DevAtlasGitHubDevelopmentRole"
PROD_ROLE = "DevAtlasGitHubDeployRole"


class ProductionPromotionSafetyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.raw = WORKFLOW.read_text(encoding="utf-8")
        cls.yaml = yaml.safe_load(cls.raw)
        cls.jobs = cls.yaml["jobs"]

    def test_dispatch_only_never_automatically_deploy(self):
        # PyYAML implements YAML 1.1 ("on" may be parsed as boolean True).
        triggers = self.yaml.get("on", self.yaml.get(True))
        self.assertIsInstance(triggers, dict)
        self.assertEqual(set(triggers), {"workflow_dispatch"})
        form = triggers["workflow_dispatch"]["inputs"]
        self.assertTrue(form["release_sha"]["required"])
        self.assertTrue(form["confirm_production"]["required"])

    def test_explicit_approval_and_gating(self):
        self.assertEqual(set(self.jobs), {"preflight", "approval", "promote"})
        self.assertEqual(self.jobs["approval"]["needs"], "preflight")
        self.assertEqual(self.jobs["approval"]["environment"]["name"], "production")
        self.assertEqual(self.jobs["promote"]["needs"], "approval")
        self.assertNotIn("environment", self.jobs["preflight"])
        self.assertNotIn("environment", self.jobs["promote"])
        self.assertIn('test "$USER_CONFIRMATION" = "PROMOTE_TO_PRODUCTION"',
                      self.jobs["preflight"]["steps"][0]["run"])
        self.assertIn('test "$GITHUB_REF" = "refs/heads/main"',
                      self.jobs["preflight"]["steps"][0]["run"])
        self.assertIn('test "$USER_CONFIRMATION" = "PROMOTE_TO_PRODUCTION"',
                      self.jobs["promote"]["steps"][0]["run"])

    def test_least_privilege_roles_and_targets(self):
        preflight = self.jobs["preflight"]
        promote = self.jobs["promote"]
        self.assertEqual(preflight["env"]["DEV_INSTANCE_ID"], DEV_ID)
        self.assertEqual(preflight["env"]["PROD_INSTANCE_ID"], PROD_ID)
        self.assertEqual(promote["env"]["PROD_INSTANCE_ID"], PROD_ID)
        dev_role = next(step for step in preflight["steps"] if step.get("uses", "").startswith("aws-actions/"))
        prod_role = next(step for step in promote["steps"] if step.get("uses", "").startswith("aws-actions/"))
        self.assertIn(DEV_ROLE, dev_role["with"]["role-to-assume"])
        self.assertNotIn(PROD_ROLE, dev_role["with"]["role-to-assume"])
        self.assertIn(PROD_ROLE, prod_role["with"]["role-to-assume"])
        self.assertNotIn(DEV_ROLE, prod_role["with"]["role-to-assume"])

    def test_development_is_only_read_from(self):
        check = self.jobs["preflight"]["steps"][-1]["run"]
        self.assertIn("grep -Fx 'DEVATLAS_ENVIRONMENT=development'", check)
        self.assertIn("grep -Fx 'APP_IMAGE=ghcr.io/nurdauleterbool/devatlas:__IMAGE_SHA__'", check)
        self.assertNotIn("docker pull", check)
        self.assertNotIn("docker compose up", check)
        self.assertNotIn("sed -i", check.split("candidate-check.sh <<'SCRIPT'")[1].split("\n          SCRIPT")[0])

    def test_production_identity_never_changes(self):
        promote_script = self.jobs["promote"]["steps"][-1]["run"]
        self.assertIn("grep -Fx 'DEVATLAS_ENVIRONMENT=production'", promote_script)
        self.assertIn("trap rollback ERR", promote_script)
        self.assertIn("docker pull", promote_script)
        self.assertIn("DEVATLAS_RELEASE=__IMAGE_SHA__", promote_script)
        self.assertNotIn("DEVATLAS_ENVIRONMENT=development", promote_script)

    def test_bash_scripts_parse_without_execution(self):
        for name, job in self.jobs.items():
            for i, step in enumerate(job["steps"]):
                content = step.get("run")
                if content and step.get("shell", "bash") == "bash":
                    with self.subTest(job=name, step=i):
                        p = subprocess.run(["bash", "-n"], input=content, text=True,
                                           capture_output=True, check=False)
                        self.assertEqual(p.returncode, 0, p.stderr)


if __name__ == "__main__":
    unittest.main()

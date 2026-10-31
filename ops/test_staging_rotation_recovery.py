"""Isolated, dependency-free staging rotation recovery safety tests."""
import copy
import unittest

import staging_rotation_recovery as recovery


STARTED = "2026-10-31T11:00:00.000000Z"
ROTATED = "2026-10-31T12:11:31.034000+00:00"


def fixture():
    return (
        {
            "status": "not_ready",
            "production": True,
            "configurationIssueCount": 0,
            "release": {"complete": True, "deploymentEnvironment": "staging"},
            "unavailableAuthorities": ["database", "audit", "searchIndex"],
            "checks": [
                {"authority": "database", "state": "unavailable"},
                {"authority": "audit", "state": "unavailable"},
                {"authority": "searchIndex", "state": "unavailable"},
                {"authority": "session", "state": "ready"},
                {"authority": "rateLimit", "state": "ready"},
                {"authority": "objectStorage", "state": "ready"},
            ],
        },
        {"Running": True, "StartedAt": STARTED},
        {"CreatedDate": ROTATED, "VersionId": "example-version"},
    )


class RotationSafetyTests(unittest.TestCase):
    def decide(self, status=503, mutator=None):
        report, container, secret = fixture()
        if mutator is not None:
            mutator(report, container, secret)
        return recovery.decision(status, report, container, secret)

    def test_healthy_staging_never_restarts(self):
        self.assertEqual(self.decide(200, lambda r, *_: r.update(status="ready")), "healthy")

    def test_password_rotation_candidate_when_staging_database_is_only_dependency_failure(self):
        self.assertEqual(self.decide(), "rotation_recovery_candidate")

    def test_secret_created_before_container_started_is_not_stale(self):
        self.assertEqual(
            self.decide(mutator=lambda r, c, s: c.update(StartedAt="2026-10-31T19:14:35Z")),
            "credentials_not_proven_stale",
        )

    def test_secret_created_within_clock_skew_window_is_not_stale(self):
        self.assertEqual(
            self.decide(mutator=lambda r, c, s: c.update(StartedAt="2026-10-31T12:11:00Z")),
            "credentials_not_proven_stale",
        )

    def test_never_restarts_production(self):
        self.assertEqual(
            self.decide(mutator=lambda r, *_: r["release"].update(deploymentEnvironment="production")),
            "not_staging",
        )

    def test_incomplete_release_blocks_restart(self):
        self.assertEqual(
            self.decide(mutator=lambda r, *_: r["release"].update(complete=False)),
            "invalid_release",
        )

    def test_non_production_safety_mode_blocks_restart(self):
        self.assertEqual(
            self.decide(mutator=lambda r, *_: r.update(production=False)),
            "invalid_release",
        )

    def test_unhealthy_redis_blocks_restart(self):
        def change(r, *_):
            r["unavailableAuthorities"].append("session")
            for check in r["checks"]:
                if check["authority"] == "session":
                    check["state"] = "unavailable"
        self.assertEqual(self.decide(mutator=change), "unrelated_dependency_failure")

    def test_unhealthy_object_storage_blocks_restart(self):
        def change(r, *_):
            for check in r["checks"]:
                if check["authority"] == "objectStorage":
                    check["state"] = "unavailable"
        self.assertEqual(self.decide(mutator=change), "other_dependency_unhealthy")

    def test_configuration_issues_block_restart(self):
        self.assertEqual(self.decide(mutator=lambda r, *_: r.update(configurationIssueCount=1)), "configuration_issue")

    def test_unexpected_status_blocks_restart(self):
        self.assertEqual(self.decide(502), "unexpected_probe_state")

    def test_stopped_container_blocks_restart(self):
        self.assertEqual(self.decide(mutator=lambda r, c, s: c.update(Running=False)), "container_not_running")

    def test_bad_secret_timestamp_blocks_restart(self):
        self.assertEqual(
            self.decide(mutator=lambda r, c, s: s.update(CreatedDate="not-a-date")),
            "invalid_timestamps",
        )

    def test_unauthenticated_or_missing_readiness_is_not_considered_recoverable(self):
        self.assertEqual(
            self.decide(mutator=lambda r, c, s: r.pop("checks")),
            "invalid_checks",
        )

    def test_database_check_must_explicitly_fail(self):
        def change(r, *_):
            for check in r["checks"]:
                if check["authority"] == "database":
                    check["state"] = "ready"
        self.assertEqual(self.decide(mutator=change), "database_probe_inconsistent")


if __name__ == "__main__":
    unittest.main()

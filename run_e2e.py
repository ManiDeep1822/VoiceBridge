#!/usr/bin/env python3
"""VoiceBridge E2E Test Runner.

Executes the opaque-box 4-tier E2E test suite via pytest programmatically,
streams stdout/stderr, categorizes test outcomes per tier, prints a structured
summary report, and returns exit code 0 on success or non-zero on failure.

Usage:
    python run_e2e.py                 # Run full E2E test suite
    python run_e2e.py --tier 1        # Run only Tier 1 tests
    python run_e2e.py --tier 2        # Run only Tier 2 tests
    python run_e2e.py --tier 3        # Run only Tier 3 tests
    python run_e2e.py --tier 4        # Run only Tier 4 tests
    python run_e2e.py --tier 5        # Run only Tier 5 tests
    python run_e2e.py -k "health"     # Filter by keyword
    python run_e2e.py -v              # Verbose pytest output
"""

import argparse
from collections import defaultdict
import datetime
import multiprocessing
import os
import sys
import time
from typing import Dict, List, Tuple

import pytest


# Ensure project root is in sys.path
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)
backend_path = os.path.join(PROJECT_ROOT, "backend")
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)


class TierReportPlugin:
    """Pytest plugin to record and categorize test results by tier."""

    def __init__(self):
        self.records: List[Dict[str, any]] = []

    def pytest_runtest_logreport(self, report):
        # Record only on test call, or on setup failure
        if report.when == "call" or (report.when == "setup" and report.failed):
            tier = self._classify_tier(report.nodeid)
            self.records.append({
                "nodeid": report.nodeid,
                "tier": tier,
                "outcome": report.outcome,
                "duration": getattr(report, "duration", 0.0),
            })

    def _classify_tier(self, nodeid: str) -> str:
        node_lower = nodeid.lower()
        if "tier1" in node_lower or "tier_1" in node_lower:
            return "Tier 1: Core Features"
        if "tier2" in node_lower or "tier_2" in node_lower:
            return "Tier 2: Boundaries & Resilience"
        if "tier3" in node_lower or "tier_3" in node_lower:
            return "Tier 3: Feature Combinations"
        if "tier4" in node_lower or "tier_4" in node_lower:
            return "Tier 4: Realistic Scenarios"
        if "tier5" in node_lower or "tier_5" in node_lower or "adversarial" in node_lower:
            return "Tier 5: Adversarial & Stress"
        if "sanity" in node_lower or "infra" in node_lower:
            return "Infra: Harness & Sanity"
        return "General E2E"


def print_summary(records: List[Dict[str, any]], elapsed_seconds: float) -> bool:
    """Print a structured summary table and return True if all tests passed."""
    tier_counts = defaultdict(lambda: {"passed": 0, "failed": 0, "skipped": 0, "total": 0})
    total_passed = 0
    total_failed = 0
    total_skipped = 0

    for rec in records:
        t = rec["tier"]
        tier_counts[t]["total"] += 1
        outcome = rec["outcome"]
        if outcome == "passed":
            tier_counts[t]["passed"] += 1
            total_passed += 1
        elif outcome == "skipped":
            tier_counts[t]["skipped"] += 1
            total_skipped += 1
        else:
            tier_counts[t]["failed"] += 1
            total_failed += 1

    total_tests = len(records)
    all_passed = (total_failed == 0 and total_tests > 0)

    width = 82
    print("\n" + "=" * width)
    print(f" VoiceBridge E2E Test Suite Execution Summary")
    print("=" * width)
    print(f" Timestamp : {datetime.datetime.now(datetime.timezone.utc).isoformat()}")
    print(f" Duration  : {elapsed_seconds:.2f} seconds")
    print(f" Total Run : {total_tests} test(s)")
    print("-" * width)
    print(f" {'Tier / Category':<34} | {'Total':<6} | {'Pass':<6} | {'Fail':<6} | {'Skip':<6} | {'Status':<8}")
    print("-" * width)

    tier_order = [
        "Infra: Harness & Sanity",
        "Tier 1: Core Features",
        "Tier 2: Boundaries & Resilience",
        "Tier 3: Feature Combinations",
        "Tier 4: Realistic Scenarios",
        "Tier 5: Adversarial & Stress",
        "General E2E",
    ]

    for t in tier_order:
        if t in tier_counts:
            stats = tier_counts[t]
            status = "PASSED" if stats["failed"] == 0 else "FAILED"
            print(f" {t:<34} | {stats['total']:<6} | {stats['passed']:<6} | {stats['failed']:<6} | {stats['skipped']:<6} | {status:<8}")

    # Any remaining tiers not in standard order
    for t, stats in tier_counts.items():
        if t not in tier_order:
            status = "PASSED" if stats["failed"] == 0 else "FAILED"
            print(f" {t:<34} | {stats['total']:<6} | {stats['passed']:<6} | {stats['failed']:<6} | {stats['skipped']:<6} | {status:<8}")

    print("-" * width)
    overall_status = "SUCCESS (ALL TESTS PASSED)" if all_passed else "FAILURE (TESTS FAILED OR NONE RUN)"
    print(f" Overall: {total_passed} passed, {total_failed} failed, {total_skipped} skipped -> {overall_status}")
    print("=" * width + "\n")

    return all_passed


def main() -> int:
    parser = argparse.ArgumentParser(description="VoiceBridge E2E Test Runner")
    parser.add_argument(
        "--tier",
        type=int,
        choices=[1, 2, 3, 4, 5],
        help="Run only the specified tier (1, 2, 3, 4, or 5)",
    )
    parser.add_argument(
        "-k",
        "--expression",
        dest="expression",
        type=str,
        help="Filter tests by keyword expression (passed to pytest -k)",
    )
    parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="Run pytest in verbose mode (-v)",
    )
    parser.add_argument(
        "extra_args",
        nargs="*",
        help="Additional arguments passed directly to pytest",
    )

    args = parser.parse_args()

    pytest_args = ["tests/e2e"]

    if args.tier is not None:
        pytest_args.append(f"-k")
        pytest_args.append(f"tier{args.tier}")
    elif args.expression:
        pytest_args.append(f"-k")
        pytest_args.append(args.expression)

    if args.verbose:
        pytest_args.append("-v")

    if args.extra_args:
        pytest_args.extend(args.extra_args)

    print(f"\n[E2E Runner] Invoking pytest with args: {pytest_args}\n")

    plugin = TierReportPlugin()
    start_time = time.time()

    ret_code = pytest.main(pytest_args, plugins=[plugin])
    elapsed = time.time() - start_time

    all_passed = print_summary(plugin.records, elapsed)

    if ret_code == 0 and all_passed:
        return 0
    return ret_code if ret_code != 0 else 1


if __name__ == "__main__":
    multiprocessing.freeze_support()
    sys.exit(main())

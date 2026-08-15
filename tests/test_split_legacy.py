"""Regression coverage for the transactional legacy splitter."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

from pytest import MonkeyPatch

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/split_legacy.py"
sys.path.insert(0, str(SCRIPT.parent))
SPEC = importlib.util.spec_from_file_location("split_legacy", SCRIPT)
assert SPEC and SPEC.loader
split_legacy = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(split_legacy)

FEATURE_SPEC = importlib.util.spec_from_file_location(
    "vendor_features_for_delta", SCRIPT.parent / "vendor_features.py"
)
assert FEATURE_SPEC and FEATURE_SPEC.loader
vendor_features = importlib.util.module_from_spec(FEATURE_SPEC)
FEATURE_SPEC.loader.exec_module(vendor_features)

VENDOR_SPEC = importlib.util.spec_from_file_location(
    "vendor_legacy_for_hash_gate", SCRIPT.parent / "vendor_legacy.py"
)
assert VENDOR_SPEC and VENDOR_SPEC.loader
vendor_legacy = importlib.util.module_from_spec(VENDOR_SPEC)
VENDOR_SPEC.loader.exec_module(vendor_legacy)


def _monolith(locale: str, *, bad: bool = False) -> str:
    debug = "function unknown() {}" if bad else "function toggleDebug() {}"
    return f"""<html><head>
<script src="external-0.js"></script><script src="external-1.js"></script>
<style>body {{ color: red; }}</style>
<script>{debug}</script>
<script>(function(){{try{{var p=localStorage.getItem('cd_theme')}}
catch(e){{}}}})();</script>
</head><body><div id="cd-boot-overlay"><div class="s"></div></div>
<script data-dashboardmodern-bootstrap-watchdog>(() => {{}})();</script>
<script>/* ═ runtime {locale} */\nconst ready = true;</script>
<style>.second {{ display: block; }}</style></body></html>"""


def test_script_roles_are_content_anchored_not_positional() -> None:
    outputs = split_legacy.build_variant("dashboard.html", "it", _monolith("it"))
    assert "function toggleDebug" in outputs["dashboard-debug-it.js"]
    assert "runtime it" in outputs["dashboard-runtime-it.js"]
    assert 'src="external-0.js"' in outputs["dashboard.html"]


def test_two_variant_validation_precedes_every_write(tmp_path: Path) -> None:
    (tmp_path / "dashboard.html").write_text(_monolith("it"), encoding="utf-8")
    (tmp_path / "dashboard-en.html").write_text(
        _monolith("en", bad=True), encoding="utf-8"
    )
    split_legacy.LEGACY = tmp_path

    assert split_legacy.main() == 1
    assert not (tmp_path / "dashboard-runtime-it.css").exists()
    assert "<style>" in (tmp_path / "dashboard.html").read_text(encoding="utf-8")


def test_ambiguous_inline_script_is_rejected() -> None:
    source = _monolith("it").replace(
        "<script>/* ═ runtime it */",
        "<script data-dashboardmodern-bootstrap-watchdog>/* ═ runtime it */",
    )
    try:
        split_legacy.build_variant("dashboard.html", "it", source)
    except split_legacy.SplitError as error:
        assert "exactly one signature" in str(error)
    else:
        raise AssertionError("ambiguous runtime/watchdog body was accepted")


def test_positional_delta_handles_adjacent_replace_and_insert_hunks() -> None:
    """Adjacent hunks must not invalidate one another's textual context."""
    source = "header\nold value\nshared\ntail\n"
    target = "header\nnew value\ninserted\nshared\ntail\n"

    assert (
        vendor_features._apply_line_delta(source, target, "adjacent regression")
        == target
    )


def test_upstream_hash_drift_requires_explicit_update(
    monkeypatch: MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        vendor_legacy,
        "_expected_upstream_digests",
        lambda: {"dashboard.html": "reviewed"},
    )
    try:
        vendor_legacy._validate_upstream_digests(
            {"dashboard.html": "tampered"}, update_upstream=False
        )
    except vendor_legacy.PatchError as error:
        assert "upstream sha256 mismatch" in str(error)
        assert "--update-upstream" in str(error)
    else:
        raise AssertionError("tampered upstream hash was accepted")

    vendor_legacy._validate_upstream_digests(
        {"dashboard.html": "tampered"}, update_upstream=True
    )

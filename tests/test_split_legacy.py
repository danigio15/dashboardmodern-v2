"""Regression coverage for the transactional legacy splitter."""

from __future__ import annotations

import importlib.util
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/split_legacy.py"
SPEC = importlib.util.spec_from_file_location("split_legacy", SCRIPT)
assert SPEC and SPEC.loader
split_legacy = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(split_legacy)


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

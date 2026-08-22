"""The integration dialogs must speak every language the dashboard does.

Home Assistant renders the config and options flows itself, from these JSON
files — the frontend i18n engine never sees them. So a user whose dashboard is
fully translated could still be asked "Panel name" in English while adding the
integration. These tests hold the two halves to the same list of languages and
to the same set of keys.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COMPONENT = ROOT / "custom_components/dashboardmodern"
STRINGS = COMPONENT / "strings.json"
TRANSLATIONS = COMPONENT / "translations"
REGISTRY = COMPONENT / "frontend/src/core/i18n.js"


def _leaf_keys(node: dict, prefix: str = "") -> set[str]:
    """Every dotted path in the file that holds a string rather than a branch."""
    keys: set[str] = set()
    for key, value in node.items():
        path = f"{prefix}.{key}" if prefix else key
        if isinstance(value, dict):
            keys |= _leaf_keys(value, path)
        else:
            keys.add(path)
    return keys


def _load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _translation_files() -> list[Path]:
    return sorted(TRANSLATIONS.glob("*.json"))


def _frontend_locales() -> set[str]:
    """The locale codes declared in the frontend registry."""
    source = REGISTRY.read_text(encoding="utf-8")
    block = re.search(
        r"export const LOCALE_REGISTRY = Object\.freeze\(\{(.*?)\n\}\);",
        source,
        re.DOTALL,
    )
    assert block, "LOCALE_REGISTRY not found in src/core/i18n.js"
    return set(re.findall(r'code: "([^"]+)"', block.group(1)))


def test_every_translation_answers_the_same_keys() -> None:
    expected = _leaf_keys(_load(STRINGS))
    assert expected, "strings.json is empty"
    for path in _translation_files():
        actual = _leaf_keys(_load(path))
        assert actual == expected, (
            f"{path.name} does not match strings.json: "
            f"missing={sorted(expected - actual)} extra={sorted(actual - expected)}"
        )


def test_every_frontend_language_has_integration_strings() -> None:
    """A language offered by the dashboard must also translate the setup dialogs.

    Traditional Chinese is the one exception, and for the same reason as in the
    frontend: it is bridged onto Simplified rather than duplicated, and Home
    Assistant applies the same fallback when it finds no zh-Hant file.
    """
    shipped = {path.stem for path in _translation_files()}
    missing = _frontend_locales() - shipped - {"zh-Hant"}
    assert not missing, f"languages with no integration strings: {sorted(missing)}"


def test_no_translation_is_left_in_english() -> None:
    """A copied English file renders as a translation but is not one."""
    english = _load(TRANSLATIONS / "en.json")
    for path in _translation_files():
        if path.stem == "en":
            continue
        assert _load(path) != english, f"{path.name} is a copy of en.json"


def test_translations_are_valid_utf8_json_without_a_bom() -> None:
    for path in _translation_files():
        raw = path.read_bytes()
        assert not raw.startswith(b"\xef\xbb\xbf"), f"{path.name} starts with a BOM"
        json.loads(raw.decode("utf-8"))

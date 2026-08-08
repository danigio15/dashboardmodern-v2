"""Regression tests for DashboardModern frontend cache busting."""

from __future__ import annotations

from custom_components.dashboardmodern import frontend as frontend_module


def test_frontend_asset_version_changes_when_runtime_file_changes(
    tmp_path, monkeypatch
) -> None:
    """A HACS in-place update must produce a fresh immutable asset URL."""
    panel = tmp_path / "panel.js"
    panel.write_text("export const version = 'old';\n", encoding="utf-8")

    monkeypatch.setattr(frontend_module, "FRONTEND_DIR", tmp_path)

    first = frontend_module._frontend_asset_version()
    first_url = frontend_module._versioned_static_url_path()

    panel.write_text("export const version = 'new';\n", encoding="utf-8")

    second = frontend_module._frontend_asset_version()
    second_url = frontend_module._versioned_static_url_path()

    assert second != first
    assert second_url != first_url
    assert first_url.startswith(frontend_module.STATIC_URL_PATH + "/")
    assert second_url.startswith(frontend_module.STATIC_URL_PATH + "/")

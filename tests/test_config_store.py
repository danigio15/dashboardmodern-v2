"""The shared configuration store and its data-loss protections."""

from __future__ import annotations

import json
from typing import Any

import pytest

pytest.importorskip(
    "homeassistant", reason="Home Assistant test dependency is not installed"
)

from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.dashboardmodern.config_store import (
    PRIMARY_PROFILE,
    STATUS_CONFLICT,
    STATUS_REFUSED_EMPTY,
    STATUS_SAVED,
    STATUS_UNCHANGED,
    DashboardConfigStore,
    SnapshotTooLargeError,
    async_get_config_store,
    content_key_count,
    is_configured,
    profile_for_entry,
    validate_values,
)
from custom_components.dashboardmodern.const import DOMAIN


def _configured(name: str = "Cucina") -> dict[str, str]:
    """A snapshot that describes a configured plancia."""
    return {
        "dm_dashboard_state": json.dumps(
            {"schema_version": 4, "sections": {"rooms": [{"id": "r1", "name": name}]}}
        ),
        "dm_schema_version": "4",
        "cd_stanze": json.dumps([{"id": "r1", "name": name, "temp": "sensor.t"}]),
    }


def _empty() -> dict[str, str]:
    """The snapshot a device with nothing configured produces."""
    return {
        "dm_dashboard_state": json.dumps(
            {"schema_version": 4, "sections": {"rooms": []}, "visibility": {}}
        ),
        "dm_schema_version": "4",
        "cd_sections": json.dumps({"temp": True}),
        "cd_stanze": "[]",
    }


def test_only_real_content_counts_as_configured() -> None:
    """Visibility flags and schema bookkeeping are not a configured plancia."""
    assert is_configured(_configured()) is True
    assert is_configured(_empty()) is False
    assert is_configured({}) is False
    assert content_key_count(_configured()) == 2
    # An envelope whose sections are all empty must not read as configured.
    assert (
        content_key_count(
            {
                "dm_dashboard_state": json.dumps(
                    {"sections": {"energy": {"metadata": {"x": 1}}}}
                )
            }
        )
        == 0
    )


def test_profile_is_independent_of_the_entry_id() -> None:
    """The storage profile survives removing and re-adding the integration."""
    assert (
        profile_for_entry(primary=True, title="Casa", entry_id="abc123")
        == PRIMARY_PROFILE
    )
    # A different entry_id, same plancia name: same profile.
    first = profile_for_entry(primary=False, title="Casa al mare", entry_id="aaa")
    second = profile_for_entry(primary=False, title="Casa al mare", entry_id="bbb")
    assert first == second == "plancia-casa_al_mare"
    assert (
        profile_for_entry(primary=False, title="", entry_id="DEADBEEF")
        == "plancia-deadbeef"
    )


async def test_configuration_survives_a_new_entry_id(hass: HomeAssistant) -> None:
    """Re-adding the integration finds the configuration of the same plancia."""
    store = DashboardConfigStore(hass)
    saved = await store.async_set(
        PRIMARY_PROFILE, _configured(), entry_id="entry-old", keys_revision=2
    )
    assert saved["status"] == STATUS_SAVED

    # A fresh integration install: new entry_id, same profile.
    reread = await store.async_get(PRIMARY_PROFILE, entry_id="entry-new")
    assert reread["snapshot"]["values"] == _configured()
    assert reread["snapshot"]["revision"] == 1


async def test_a_renamed_plancia_keeps_its_configuration(hass: HomeAssistant) -> None:
    """Renaming a secondary plancia moves its data to the new profile."""
    store = DashboardConfigStore(hass)
    await store.async_set("plancia-mare", _configured(), entry_id="entry-b")

    renamed = await store.async_get("plancia-lago", entry_id="entry-b")

    assert renamed["requested_profile"] == "plancia-lago"
    assert renamed["profile"] == "plancia-mare"
    assert renamed["snapshot"]["values"] == _configured()
    # One bucket, never two: the data is not copied to the new name.
    assert renamed["profiles"] == ["plancia-mare"]

    # A writer that still uses the pre-rename name reaches the same bucket, so
    # the panel and the companion card cannot end up on different copies.
    written = await store.async_set(
        "plancia-lago", _configured("Salotto"), entry_id="entry-b", keys_revision=2
    )
    assert written["profile"] == "plancia-mare"
    stale = await store.async_get("plancia-mare", entry_id="entry-b")
    assert stale["snapshot"]["values"] == _configured("Salotto")


async def test_an_empty_snapshot_cannot_overwrite_a_configured_plancia(
    hass: HomeAssistant,
) -> None:
    """The write that used to wipe every device is refused."""
    store = DashboardConfigStore(hass)
    await store.async_set(PRIMARY_PROFILE, _configured(), keys_revision=2)

    refused = await store.async_set(PRIMARY_PROFILE, _empty(), keys_revision=2)

    assert refused["status"] == STATUS_REFUSED_EMPTY
    # The caller gets the protected copy back so it can adopt it.
    assert refused["snapshot"]["values"] == _configured()
    assert refused["snapshot"]["revision"] == 1
    stored = await store.async_get(PRIMARY_PROFILE)
    assert stored["snapshot"]["values"] == _configured()


async def test_an_explicit_reset_may_empty_the_plancia(hass: HomeAssistant) -> None:
    """A reset is the one write allowed to empty a configured plancia."""
    store = DashboardConfigStore(hass)
    await store.async_set(PRIMARY_PROFILE, _configured(), keys_revision=2)

    reset = await store.async_set(
        PRIMARY_PROFILE, _empty(), keys_revision=2, reset=True
    )

    assert reset["status"] == STATUS_SAVED
    assert reset["snapshot"]["reset"] is True
    assert is_configured(reset["snapshot"]["values"]) is False
    # The previous revision is kept, so a mistaken reset is not unrecoverable.
    assert [item["revision"] for item in reset["recoverable"]] == [1]


async def test_a_kept_revision_can_be_restored(hass: HomeAssistant) -> None:
    """Restoring promotes a kept revision back to current."""
    store = DashboardConfigStore(hass)
    await store.async_set(PRIMARY_PROFILE, _configured("Cucina"), keys_revision=2)
    await store.async_set(PRIMARY_PROFILE, _configured("Salotto"), keys_revision=2)

    restored = await store.async_restore(PRIMARY_PROFILE, 1)

    assert restored["status"] == STATUS_SAVED
    assert restored["snapshot"]["values"] == _configured("Cucina")
    assert restored["snapshot"]["revision"] == 3

    missing = await store.async_restore(PRIMARY_PROFILE, 99)
    assert missing["status"] == STATUS_CONFLICT


async def test_history_is_bounded_and_keeps_the_newest_revisions(
    hass: HomeAssistant,
) -> None:
    """Kept revisions never grow without bound."""
    store = DashboardConfigStore(hass)
    for index in range(9):
        await store.async_set(
            PRIMARY_PROFILE, _configured(f"Stanza {index}"), keys_revision=2
        )

    current = await store.async_get(PRIMARY_PROFILE)
    revisions = [item["revision"] for item in current["recoverable"]]
    assert revisions == [8, 7, 6, 5, 4]


async def test_a_stale_revision_is_reported_as_a_conflict(hass: HomeAssistant) -> None:
    """Another device's write is never silently overwritten."""
    store = DashboardConfigStore(hass)
    await store.async_set(PRIMARY_PROFILE, _configured("Cucina"), keys_revision=2)
    await store.async_set(PRIMARY_PROFILE, _configured("Salotto"), keys_revision=2)

    conflict = await store.async_set(
        PRIMARY_PROFILE, _configured("Terrazzo"), keys_revision=2, expected_revision=1
    )

    assert conflict["status"] == STATUS_CONFLICT
    assert conflict["snapshot"]["values"] == _configured("Salotto")


async def test_an_identical_write_does_not_create_a_revision(
    hass: HomeAssistant,
) -> None:
    """Re-pushing the same values is a no-op instead of churning revisions."""
    store = DashboardConfigStore(hass)
    await store.async_set(PRIMARY_PROFILE, _configured(), keys_revision=2)

    again = await store.async_set(PRIMARY_PROFILE, _configured(), keys_revision=2)

    assert again["status"] == STATUS_UNCHANGED
    assert again["snapshot"]["revision"] == 1


async def test_the_store_is_shared_by_every_user_and_device(
    hass: HomeAssistant,
) -> None:
    """One installation, one configuration.

    The store has no user dimension at all, which is the whole point: the
    frontend/*_user_data API it replaces stored one copy per Home Assistant
    user, so a second user opened an unconfigured plancia.
    """
    writer = await async_get_config_store(hass)
    await writer.async_set(PRIMARY_PROFILE, _configured(), keys_revision=2)

    # A second connection, whichever user it belongs to, reads the same store.
    reader = await async_get_config_store(hass)
    assert reader is writer
    assert (await reader.async_get(PRIMARY_PROFILE))["snapshot"][
        "values"
    ] == _configured()

    # And it is reloaded from disk, not from process memory only.
    reloaded = DashboardConfigStore(hass)
    assert (await reloaded.async_get(PRIMARY_PROFILE))["snapshot"][
        "values"
    ] == _configured()


async def test_setup_exposes_the_store_and_the_commands(
    hass: HomeAssistant, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Setting up an entry makes the shared configuration reachable."""
    from homeassistant.components import websocket_api

    from custom_components.dashboardmodern import async_setup_entry
    from custom_components.dashboardmodern import frontend as frontend_module
    from custom_components.dashboardmodern.websocket_api import TYPE_GET, TYPE_SET

    async def fake_register(_hass: HomeAssistant, _entry_id: str) -> None:
        return None

    monkeypatch.setattr(frontend_module, "async_register_frontend", fake_register)

    entry = MockConfigEntry(domain=DOMAIN, entry_id="entry-1", title="Casa")
    entry.add_to_hass(hass)
    assert await async_setup_entry(hass, entry) is True

    assert isinstance(hass.data[DOMAIN]["config_store"], DashboardConfigStore)
    handlers = hass.data[websocket_api.const.DOMAIN]
    assert TYPE_GET in handlers
    assert TYPE_SET in handlers


def test_oversized_snapshots_are_rejected() -> None:
    """A snapshot arriving from the frontend is validated, not trusted."""
    assert validate_values({"cd_stanze": "[]", "ignored": 5}) == {"cd_stanze": "[]"}
    with pytest.raises(SnapshotTooLargeError):
        validate_values({f"cd_{index}": "x" for index in range(400)})
    with pytest.raises(SnapshotTooLargeError):
        validate_values({"cd_stanze": "x" * (3 * 1024 * 1024)})
    with pytest.raises(SnapshotTooLargeError):
        validate_values("not an object")  # type: ignore[arg-type]


def test_the_panel_publishes_the_profile(hass: HomeAssistant) -> None:
    """The panel hands the frontend the profile to read and write."""
    from custom_components.dashboardmodern import frontend as frontend_module

    primary = MockConfigEntry(
        domain=DOMAIN, entry_id="entry-a", title="Casa", data={"primary": True}
    )
    primary.add_to_hass(hass)
    second = MockConfigEntry(
        domain=DOMAIN, entry_id="entry-b", title="Mare", data={"primary": False}
    )
    second.add_to_hass(hass)

    config: dict[str, Any] = frontend_module._panel_config(
        hass, primary, asset_version="v", static_url_path="/s"
    )
    assert config["config_profile"] == PRIMARY_PROFILE
    other = frontend_module._panel_config(
        hass, second, asset_version="v", static_url_path="/s"
    )
    assert other["config_profile"] == "plancia-mare"


async def test_writer_generation_travels_with_the_snapshot(
    hass: HomeAssistant,
) -> None:
    """La generazione dello scrittore si conserva e si rilegge tale e quale.

    Il frontend nuovo la usa per riconoscere gli scatti spinti dai runtime
    vecchi — quelli che marcavano «in sospeso» anche le riscritture di
    macchina — e non farsi sovrascrivere da loro. Il negozio deve solo
    custodirla: senza questo giro il campo spariva nella risposta e il
    recinto non poteva mai chiudersi.
    """
    store = DashboardConfigStore(hass)
    saved = await store.async_set(
        PRIMARY_PROFILE, _configured(), keys_revision=5, writer_generation=1
    )
    assert saved["snapshot"]["writer_generation"] == 1

    reread = await store.async_get(PRIMARY_PROFILE)
    assert reread["snapshot"]["writer_generation"] == 1

    # Uno scrittore vecchio non manda il campo: lo scatto lo dice, con lo zero.
    old = await store.async_set(
        PRIMARY_PROFILE, _configured("Salotto"), keys_revision=4
    )
    assert old["snapshot"]["writer_generation"] == 0

    # E il ripristino di una revisione custodita riporta la sua generazione.
    restored = await store.async_restore(PRIMARY_PROFILE, revision=1)
    assert restored["snapshot"]["writer_generation"] == 1

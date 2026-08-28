"""Tell Home Assistant when a new DashboardModern release is out.

HACS already builds an update entity for every repository it has downloaded,
but it refreshes a *custom* repository — one added by URL, which is how this
integration is installed — on a 48 hour timer, and never at startup:

    custom_components/hacs/base.py
        async_track_time_interval(
            hass, self.async_update_downloaded_custom_repositories, timedelta(hours=48)
        )

Repositories that live in the HACS default store take a different path and are
refreshed every six hours. This one cannot join that store: the default store
requires the `topics` and `license` checks to pass, and this project ships a
proprietary source-available licence that GitHub classifies as NOASSERTION.

So the notification arrives here instead. This entity asks GitHub for the
latest release on its own, and does it often enough that a release published in
the morning is announced the same morning. Installing is still HACS's job — the
files are its — and the release summary says which button to press.

Nothing here is required for the dashboard to work. If the panel has no way out
to the internet the check simply finds nothing and says nothing: no repeated
errors in the log, no entity going unavailable, no retry storm. And whoever
wants it off can turn it off from the integration's options.
"""

from __future__ import annotations

import logging
from datetime import timedelta
from typing import TYPE_CHECKING, Any

from homeassistant.components.update import UpdateEntity, UpdateEntityFeature
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.update_coordinator import (
    CoordinatorEntity,
    DataUpdateCoordinator,
)
from homeassistant.loader import async_get_integration

from .const import (
    DOMAIN,
    NAME,
    OPTION_CHECK_UPDATES,
    RELEASES_URL,
    REPOSITORY,
    UPDATE_SCAN_INTERVAL,
)

if TYPE_CHECKING:
    from homeassistant.config_entries import ConfigEntry
    from homeassistant.core import HomeAssistant
    from homeassistant.helpers.entity_platform import AddEntitiesCallback

_LOGGER = logging.getLogger(__name__)

# GitHub cuts an unauthenticated caller off at sixty requests an hour, counted
# per address. A check every half hour is two an hour, and a check that gets
# `304 Not Modified` back does not count at all — which is why the tag from the
# previous answer is sent along. The cost of knowing early is that low.
_TIMEOUT = 20

# Home Assistant refuses to show a summary longer than this, so it is cut here
# rather than by the frontend.
_SUMMARY_MAX = 255


def normalize_version(value: Any) -> str:
    """Return a bare version, with the `v` a git tag carries stripped off.

    The releases are tagged `v1.3.3` and the manifest says `1.3.3`. Comparing
    the two as they come would announce an update on every single check, for
    ever: the notification that cries wolf is worse than no notification.
    """
    text = str(value or "").strip()
    return text[1:] if text[:1] in {"v", "V"} and text[1:2].isdigit() else text


def _chiave(version: str) -> tuple[list[int], int, str] | None:
    """Turn a version into something that can be compared, or `None`.

    `None` means «non l'ho capita», e chi non capisce non annuncia niente.
    """
    testo = normalize_version(version)
    if not testo:
        return None
    coda = ""
    for separatore in ("-", "+"):
        if separatore in testo:
            testo, coda = testo.split(separatore, 1)
            break
    numeri: list[int] = []
    for pezzo in testo.split("."):
        if not pezzo.isdigit():
            return None
        numeri.append(int(pezzo))
    if not numeri:
        return None
    # Chi non ha una coda viene dopo: `1.4.0` e' piu' recente di `1.4.0-beta1`.
    return (numeri, 0 if coda else 1, coda)


def newer(latest: str, installed: str) -> bool:
    """Say whether `latest` is a later version than `installed`.

    I numeri si confrontano da numeri — `1.10.0` viene dopo `1.9.0`, che da
    stringhe verrebbe prima — e una versione con la coda («1.4.0-beta1») resta
    dietro a quella intera, che e' il verso in cui le legge chiunque. Due
    versioni illeggibili contano come uguali: nel dubbio si tace, perche' un
    avviso che grida al lupo e' peggio di nessun avviso.
    """
    sinistra, destra = _chiave(latest), _chiave(installed)
    if sinistra is None or destra is None:
        return False
    lunghezza = max(len(sinistra[0]), len(destra[0]))
    numeri_sinistra = sinistra[0] + [0] * (lunghezza - len(sinistra[0]))
    numeri_destra = destra[0] + [0] * (lunghezza - len(destra[0]))
    return (numeri_sinistra, sinistra[1], sinistra[2]) > (
        numeri_destra,
        destra[1],
        destra[2],
    )


class DashboardModernReleaseCoordinator(DataUpdateCoordinator[dict[str, Any]]):
    """Ask GitHub for the newest release, and keep the last good answer."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Set the coordinator up on its own schedule."""
        super().__init__(
            hass,
            _LOGGER,
            name=f"{NAME} releases",
            update_interval=timedelta(seconds=UPDATE_SCAN_INTERVAL),
        )
        self._etag: str | None = None
        self._last: dict[str, Any] = {}

    async def _async_update_data(self) -> dict[str, Any]:
        """Return the latest release, or the last one that arrived.

        A failure here is not an error to shout about: a plancia on a network
        without a way out is a supported way to run this integration, and it
        must not fill the log or grey the entity out. What cannot be fetched
        simply leaves the previous answer in place — nothing at all, the first
        time round.
        """
        headers = {"Accept": "application/vnd.github+json"}
        if self._etag:
            headers["If-None-Match"] = self._etag
        try:
            session = async_get_clientsession(self.hass)
            async with session.get(
                RELEASES_URL, headers=headers, timeout=_TIMEOUT
            ) as answer:
                if answer.status == 304:
                    return self._last
                if answer.status != 200:
                    _LOGGER.debug(
                        "GitHub answered %s for the latest release", answer.status
                    )
                    return self._last
                self._etag = answer.headers.get("ETag")
                payload = await answer.json()
        except Exception as error:  # noqa: BLE001 - a check that fails is not a fault
            _LOGGER.debug("Could not ask GitHub for the latest release: %s", error)
            return self._last

        if (
            not isinstance(payload, dict)
            or payload.get("draft")
            or payload.get("prerelease")
        ):
            return self._last
        version = normalize_version(payload.get("tag_name"))
        if not version:
            return self._last
        self._last = {
            "version": version,
            "url": payload.get("html_url")
            or f"https://github.com/{REPOSITORY}/releases",
            "notes": str(payload.get("body") or ""),
        }
        return self._last


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    """Add the update entity, once, for the plancia that came first."""
    if not entry.options.get(OPTION_CHECK_UPDATES, True):
        return
    # La versione installata la dice il manifest, e a leggerlo e' il caricatore
    # di Home Assistant: e' l'unica fonte che resta giusta anche quando i file
    # li sostituisce HACS sotto un processo gia' avviato.
    integrazione = await async_get_integration(hass, DOMAIN)
    coordinator = DashboardModernReleaseCoordinator(hass)
    await coordinator.async_config_entry_first_refresh()
    async_add_entities(
        [DashboardModernUpdate(coordinator, normalize_version(integrazione.version))]
    )


class DashboardModernUpdate(
    CoordinatorEntity[DashboardModernReleaseCoordinator], UpdateEntity
):
    """The version that is installed, and the one that is out."""

    _attr_has_entity_name = True
    _attr_name = None
    _attr_title = NAME
    # Installing stays with HACS: the files are its, and two owners of the same
    # folder is how a half-written update happens. The notes are shown here so
    # the decision can be taken without leaving Home Assistant.
    _attr_supported_features = UpdateEntityFeature.RELEASE_NOTES

    def __init__(
        self, coordinator: DashboardModernReleaseCoordinator, installed: str
    ) -> None:
        """Bind the entity to the integration, not to a single plancia."""
        super().__init__(coordinator)
        self._installed = installed
        self._attr_unique_id = f"{DOMAIN}_release"

    @property
    def installed_version(self) -> str | None:
        """The version of the integration Home Assistant has loaded."""
        return self._installed or None

    @property
    def latest_version(self) -> str | None:
        """The newest published release, or the installed one when unknown.

        Answering `None` would make Home Assistant draw the entity as unknown,
        which on a plancia without internet looks like something broken. With
        no answer from GitHub the honest reading is «nothing new».
        """
        version = (self.coordinator.data or {}).get("version")
        installed = self.installed_version
        if not version:
            return installed
        if installed and not newer(version, installed):
            return installed
        return version

    @property
    def release_url(self) -> str | None:
        """Where the release is written up."""
        return (self.coordinator.data or {}).get("url") or (
            f"https://github.com/{REPOSITORY}/releases"
        )

    @property
    def release_summary(self) -> str | None:
        """What to do about it, in the two lines the dialog shows.

        HACS refreshes a custom repository every 48 hours, so it can still be
        offering the previous version when this notice arrives. Saying which
        button shortens that wait is the difference between a notification and
        a nuisance.
        """
        if not self.installed_version or self.latest_version == self.installed_version:
            return None
        # Home Assistant non traduce questo testo, quindi lo si sceglie qui
        # nella lingua del sistema: la plancia parla due lingue e questo e'
        # l'unico posto dove la scelta non la fa il suo motore di traduzione.
        if str(self.hass.config.language or "").lower().startswith("it"):
            return (
                "In HACS: DashboardModern v2 → menu ⋮ → «Aggiorna informazioni», "
                "poi «Aggiorna». Senza quel passaggio HACS può metterci fino a "
                "48 ore ad accorgersi della versione nuova."
            )[:_SUMMARY_MAX]
        return (
            'In HACS: DashboardModern v2 → ⋮ menu → "Update information", then '
            '"Update". Without that step HACS can take up to 48 hours to notice '
            "the new version."
        )[:_SUMMARY_MAX]

    async def async_release_notes(self) -> str | None:
        """The release notes, as they are written on GitHub."""
        return (self.coordinator.data or {}).get("notes") or None

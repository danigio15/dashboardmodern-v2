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
the morning is announced the same morning.

Installing happens here too. It used to stay with HACS — «two owners of the
same folder is how a half-written update happens» — but that left the update
sitting in Home Assistant's page marked *not installable*, with a two-step
detour through HACS as the only way in. The two-owners worry is answered by
HOW the install works, not by refusing to have a button: the zip downloaded is
the exact asset HACS would install (`hacs.json: zip_release`), it is validated
before a single file moves (its paths, its manifest, its version), the swap is
a rename with the previous folder kept beside it until the new one is in
place, and a failure puts the old folder back. HACS finds the same files at
its next «Update information» and simply re-aligns. The one thing the button
cannot do is reload Python that is already running: a restart finishes the
job, and the entity says so.

Nothing here is required for the dashboard to work. If the panel has no way out
to the internet the check simply finds nothing and says nothing: no repeated
errors in the log, no entity going unavailable, no retry storm. And whoever
wants it off can turn it off from the integration's options.
"""

from __future__ import annotations

import io
import json
import logging
import shutil
import zipfile
from datetime import timedelta
from pathlib import Path, PurePosixPath
from typing import TYPE_CHECKING, Any

from homeassistant.components.update import UpdateEntity, UpdateEntityFeature
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.update_coordinator import (
    CoordinatorEntity,
    DataUpdateCoordinator,
)
from homeassistant.loader import async_get_integration

from .const import (
    DOMAIN,
    NAME,
    OPTION_CHECK_UPDATES,
    RELEASE_ASSET,
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

# La cartella di questa integrazione, risolta una volta al caricamento: dentro
# `async_install` toccherebbe il disco sul loop.
_CARTELLA = Path(__file__).resolve().parent

# Lo zip di una release pesa pochi megabyte; il download ha un suo tempo e un
# suo tetto, perche' un file che non somiglia per niente a quello atteso non
# deve nemmeno finire in memoria.
_DOWNLOAD_TIMEOUT = 300
_MAX_ZIP = 200 * 1024 * 1024

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


def installa_da_zip(cartella: Path, dati: bytes, versione: str) -> None:
    """Replace the integration folder with the release zip's content.

    Prima si controlla, poi si muove, e ogni mossa e' reversibile:

    - nessun nome nello zip puo' uscire dalla cartella (`..`, percorsi
      assoluti): un archivio che ci prova non tocca un solo file;
    - lo zip deve contenere il `manifest.json` di QUESTA integrazione, con la
      versione che si e' promesso di installare — non «uno zip qualunque»;
    - si spacchetta in una cartella nuova accanto a quella vera, poi due
      rinomini: la vecchia si fa da parte, la nuova prende il suo posto. Se il
      secondo rinomino fallisce, la vecchia torna dov'era. La vecchia si
      cancella solo a scambio riuscito.

    Gira nell'executor: qui dentro e' tutto disco, niente loop.
    """
    with zipfile.ZipFile(io.BytesIO(dati)) as archivio:
        nomi = archivio.namelist()
        for nome in nomi:
            pezzo = PurePosixPath(nome)
            if pezzo.is_absolute() or ".." in pezzo.parts:
                raise ValueError(f"percorso fuori dalla cartella nello zip: {nome}")
        if "manifest.json" not in nomi:
            raise ValueError("lo zip non contiene il manifest dell'integrazione")
        manifesto = json.loads(archivio.read("manifest.json"))
        if manifesto.get("domain") != DOMAIN:
            raise ValueError("lo zip appartiene a un'altra integrazione")
        if normalize_version(manifesto.get("version")) != normalize_version(versione):
            raise ValueError(
                "lo zip porta la versione "
                f"{manifesto.get('version')!r}, non la {versione!r} promessa"
            )
        genitore = cartella.parent
        nuova = genitore / f".{cartella.name}-nuovo"
        vecchia = genitore / f".{cartella.name}-vecchio"
        for scarto in (nuova, vecchia):
            if scarto.exists():
                shutil.rmtree(scarto)
        nuova.mkdir()
        archivio.extractall(nuova)
    cartella.rename(vecchia)
    try:
        nuova.rename(cartella)
    except OSError:
        vecchia.rename(cartella)
        raise
    # A scambio riuscito la vecchia e' solo spazzatura: se il disco non la
    # lascia togliere adesso, l'installazione e' comunque fatta — annunciarla
    # fallita spingerebbe a installare di nuovo sopra file gia' nuovi. I
    # residui li spazza la testa di questa stessa funzione, al giro dopo.
    shutil.rmtree(vecchia, ignore_errors=True)


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
        # Lo zip della release: e' quello che il tasto «Installa» scarica. Una
        # release senza — non dovrebbe succedere, il flusso di rilascio lo
        # carica sempre — lascia il tasto a spiegare la strada di HACS.
        asset_url = ""
        for asset in payload.get("assets") or []:
            if isinstance(asset, dict) and asset.get("name") == RELEASE_ASSET:
                asset_url = str(asset.get("browser_download_url") or "")
                break
        self._last = {
            "version": version,
            "url": payload.get("html_url")
            or f"https://github.com/{REPOSITORY}/releases",
            "notes": str(payload.get("body") or ""),
            "asset_url": asset_url,
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
    async_add_entities(
        [DashboardModernUpdate(coordinator, normalize_version(integrazione.version))]
    )
    # La prima occhiata a GitHub si fa da parte, non qui.
    #
    # Aspettarla teneva fermo l'avvio dell'integrazione finche' la richiesta non
    # tornava. Una rete che rifiuta subito non si sente; una che ingoia il
    # pacchetto e non risponde — un firewall che scarta invece di respingere —
    # tiene fermo tutto per i venti secondi buoni del timeout, a ogni avvio di
    # Home Assistant e a ogni ricarica. Sapere se e' uscita una versione e'
    # comodo, non indispensabile: l'entita' senza risposta legge gia' «niente di
    # nuovo», e quando la risposta arriva si aggiorna da sola.
    entry.async_create_background_task(
        hass, coordinator.async_refresh(), f"{DOMAIN}-prima-occhiata"
    )


class DashboardModernUpdate(
    CoordinatorEntity[DashboardModernReleaseCoordinator], UpdateEntity
):
    """The version that is installed, and the one that is out."""

    _attr_has_entity_name = True
    _attr_name = None
    _attr_title = NAME
    # Il tasto «Installa» c'e': senza, l'aggiornamento finiva nella pagina di
    # Home Assistant fra i «non installabili», con HACS come unica strada. Lo
    # zip che si installa e' lo stesso che installerebbe HACS, controllato
    # prima che un solo file si muova; il come sta in `installa_da_zip`.
    _attr_supported_features = (
        UpdateEntityFeature.INSTALL
        | UpdateEntityFeature.PROGRESS
        | UpdateEntityFeature.RELEASE_NOTES
    )

    def __init__(
        self, coordinator: DashboardModernReleaseCoordinator, installed: str
    ) -> None:
        """Bind the entity to the integration, not to a single plancia."""
        super().__init__(coordinator)
        self._installed = installed
        self._riavvio_richiesto = False
        self._attr_unique_id = f"{DOMAIN}_release"
        # Senza un dispositivo l'entita' non ha un nome da nessuna parte —
        # `_attr_name = None` dice «usa il nome del dispositivo» — e la pagina
        # Aggiornamenti ripiegava sull'entity_id: il dialogo titolava
        # «update.dashboardmodern_...» e la riga dell'elenco restava grigia.
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, "dashboardmodern")},
            name=NAME,
            manufacturer="DashboardModern",
            model=NAME,
            sw_version=installed,
            configuration_url=f"https://github.com/{REPOSITORY}",
        )

    def _frase(self, italiano: str, inglese: str) -> str:
        """The system's language decides: HA does not translate these texts."""
        lingua = str(self.hass.config.language or "").lower()
        return italiano if lingua.startswith("it") else inglese

    async def async_install(
        self, version: str | None, backup: bool, **kwargs: Any
    ) -> None:
        """Download the release zip and swap the integration's files.

        Quello che il tasto NON puo' fare e' ricaricare il Python gia' in
        esecuzione: i file nuovi sono a terra, il processo e' ancora quello
        vecchio. Il riavvio completa, e finche' non arriva un secondo
        «Installa» viene rifiutato — installare sopra un'installazione a meta'
        e' esattamente il pasticcio che questo tasto promette di non fare.
        """
        # Due «Installa» sovrapposti — un'automazione che riprova mentre il
        # primo download e' in corso — lavorerebbero sulle stesse cartelle
        # d'appoggio, e il secondo puo' portar via la vecchia proprio mentre
        # il primo ci conta per il ripristino. Il segno e' gia' li': da qui
        # alla sua scrittura non c'e' nemmeno un await, quindi sul loop il
        # controllo e' atomico.
        if self._attr_in_progress:
            raise HomeAssistantError(
                self._frase(
                    "Un'installazione è già in corso.",
                    "An installation is already running.",
                )
            )
        if self._riavvio_richiesto:
            raise HomeAssistantError(
                self._frase(
                    "Aggiornamento già installato: riavvia Home Assistant "
                    "per completarlo.",
                    "Update already installed: restart Home Assistant to complete it.",
                )
            )
        dati_release = self.coordinator.data or {}
        destinazione = str(dati_release.get("version") or "")
        if not destinazione or not newer(destinazione, self._installed or ""):
            raise HomeAssistantError(
                self._frase(
                    "Nessuna versione nuova da installare.",
                    "No new version to install.",
                )
            )
        asset_url = str(dati_release.get("asset_url") or "")
        if not asset_url:
            raise HomeAssistantError(
                self._frase(
                    "La release non pubblica il suo zip: aggiorna da HACS "
                    "(menu ⋮ → «Aggiorna informazioni», poi «Aggiorna»).",
                    "The release does not publish its zip: update from HACS "
                    "(⋮ menu → “Update information”, then “Update”).",
                )
            )

        self._attr_in_progress = True
        self.async_write_ha_state()
        try:
            session = async_get_clientsession(self.hass)
            try:
                async with session.get(
                    asset_url, timeout=_DOWNLOAD_TIMEOUT
                ) as risposta:
                    if risposta.status != 200:
                        raise HomeAssistantError(
                            self._frase(
                                f"GitHub ha risposto {risposta.status} "
                                "scaricando lo zip della release.",
                                f"GitHub answered {risposta.status} while "
                                "downloading the release zip.",
                            )
                        )
                    if (risposta.content_length or 0) > _MAX_ZIP:
                        raise HomeAssistantError(
                            self._frase(
                                "Lo zip della release è più grande del previsto.",
                                "The release zip is larger than expected.",
                            )
                        )
                    dati = await risposta.read()
            except HomeAssistantError:
                raise
            except Exception as errore:
                raise HomeAssistantError(
                    self._frase(
                        f"Download dello zip fallito: {errore}",
                        f"Downloading the zip failed: {errore}",
                    )
                ) from errore
            if len(dati) > _MAX_ZIP:
                raise HomeAssistantError(
                    self._frase(
                        "Lo zip della release è più grande del previsto.",
                        "The release zip is larger than expected.",
                    )
                )
            try:
                await self.hass.async_add_executor_job(
                    installa_da_zip, _CARTELLA, dati, destinazione
                )
            except (ValueError, OSError, zipfile.BadZipFile) as errore:
                raise HomeAssistantError(
                    self._frase(
                        f"Installazione interrotta, file di prima al loro "
                        f"posto: {errore}",
                        f"Install stopped, previous files back in place: {errore}",
                    )
                ) from errore
        finally:
            self._attr_in_progress = False
            # Anche sul fallimento: senza questa scrittura l'entita' restava
            # pubblicata come «in installazione», col tasto spento, fino al
            # prossimo giro del coordinator.
            self.async_write_ha_state()

        self._installed = destinazione
        self._riavvio_richiesto = True
        self.async_write_ha_state()
        from homeassistant.components.persistent_notification import (
            async_create as notifica,
        )

        notifica(
            self.hass,
            self._frase(
                f"La versione {destinazione} è installata. Riavvia Home "
                "Assistant per completare l'aggiornamento.",
                f"Version {destinazione} is installed. Restart Home Assistant "
                "to complete the update.",
            ),
            title=NAME,
            notification_id=f"{DOMAIN}_riavvio",
        )

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
        """What to do about it, in the two lines the dialog shows."""
        if self._riavvio_richiesto:
            return self._frase(
                "Installata: riavvia Home Assistant per completare l'aggiornamento.",
                "Installed: restart Home Assistant to complete the update.",
            )[:_SUMMARY_MAX]
        if not self.installed_version or self.latest_version == self.installed_version:
            return None
        # Home Assistant non traduce questo testo, quindi lo si sceglie qui
        # nella lingua del sistema: la plancia parla due lingue e questo e'
        # l'unico posto dove la scelta non la fa il suo motore di traduzione.
        return self._frase(
            "Si installa da qui col tasto «Installa»; alla fine serve un "
            "riavvio di Home Assistant. HACS si riallinea da solo al suo "
            "prossimo controllo.",
            "Install it from here with the “Install” button; a Home Assistant "
            "restart finishes the job. HACS re-aligns on its next check.",
        )[:_SUMMARY_MAX]

    async def async_release_notes(self) -> str | None:
        """The release notes, as they are written on GitHub."""
        return (self.coordinator.data or {}).get("notes") or None

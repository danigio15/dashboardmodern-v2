"""Shared, cross-user storage for the plancia configuration.

Until now the configuration of a plancia lived in two per-client places: the
browser's ``localStorage`` and Home Assistant's ``frontend/set_user_data``,
which is stored per Home Assistant user in ``.storage/frontend.user_data_*``.
Both are invisible to everybody else, so a second Home Assistant user, a second
browser or a phone that never held the configuration opened an unconfigured
plancia and had to configure it again.

This store is the authoritative copy instead: a single file for the whole
integration, shared by every user and every device. Three properties matter and
are all deliberate:

* The key is a stable *profile* name, never the ``entry_id``. Removing and
  re-adding the integration therefore lands on the same configuration instead of
  orphaning it. Renaming a plancia is followed through ``entry_profiles``.
* A write that would replace a configured plancia with an empty snapshot is
  refused. That was the shape of the real data loss: a device whose remote read
  failed considered itself authoritative and pushed its own empty state over the
  good one.
* The previous revisions are kept, so an installation that was already emptied
  can be recovered automatically, without the user having to do anything.
"""

from __future__ import annotations

import json
from typing import TYPE_CHECKING, Any

from .const import DOMAIN

if TYPE_CHECKING:
    from collections.abc import Mapping, Sequence

    from homeassistant.core import HomeAssistant

STORAGE_KEY = f"{DOMAIN}.config"
STORAGE_VERSION = 1
DATA_CONFIG_STORE = "config_store"

PRIMARY_PROFILE = "primary"
PROFILE_PREFIX = "plancia-"

#: Kept revisions per profile. Enough to recover from a bad sync without letting
#: the storage file grow without bound.
HISTORY_LIMIT = 5

#: Hard limits for one snapshot. The payload arrives from the frontend, so it is
#: validated rather than trusted.
MAX_KEYS = 256
MAX_VALUE_BYTES = 2 * 1024 * 1024
MAX_TOTAL_BYTES = 8 * 1024 * 1024

#: Bookkeeping and presentation-only keys never count as configured content:
#: a snapshot holding just these is an empty plancia.
NON_CONTENT_KEYS = frozenset(
    {"dm_schema_version", "dm_persistence_meta", "cd_sections"}
)

STATUS_SAVED = "saved"
STATUS_UNCHANGED = "unchanged"
STATUS_CONFLICT = "conflict"
STATUS_REFUSED_EMPTY = "refused-empty"


def profile_for_entry(*, primary: bool, title: str, entry_id: str) -> str:
    """Return the stable profile name of one plancia.

    The primary plancia keeps a fixed name so it survives a rename. The others
    are named after their title, which the user reproduces when they re-add the
    integration; a rename is still followed through ``entry_profiles``.
    """
    if primary:
        return PRIMARY_PROFILE
    from homeassistant.util import slugify

    return _named_profile(title, entry_id, slugify)


def _named_profile(title: str, entry_id: str, slugify: Any) -> str:
    slug = slugify(title or "")
    return f"{PROFILE_PREFIX}{slug or entry_id[:8].lower()}"


def unique_profiles(
    entries: Sequence[tuple[str, str, bool]], *, slugify: Any = None
) -> dict[str, str]:
    """Assegna a ogni plancia il SUO profilo, senza due che ne condividono uno.

    Il nome del profilo veniva dal titolo e basta: due plance chiamate allo
    stesso modo — e chi ne aggiunge una seconda lascia il nome proposto —
    finivano nello stesso posto, e la nuova nasceva gia' piena della
    configurazione dell'altra. «Se aggiungo una nuova dashboard da integrazioni
    mi duplica quella attuale, invece doveva crearne una ex novo sciolta
    dall'altra.»

    Chi arriva per primo tiene il nome del titolo, cosi' una plancia che
    esisteva gia' non cambia posto e non perde niente; chi arriva dopo su un
    nome gia' occupato si porta dietro un pezzo del proprio identificativo, che
    e' l'unica cosa che due plance non possono avere uguale.

    ``entries`` e' una sequenza di ``(entry_id, titolo, primaria)`` nell'ordine
    in cui le plance sono state create.
    """
    if slugify is None:  # pragma: no cover - la strada di Home Assistant
        from homeassistant.util import slugify as slugify_ha

        slugify = slugify_ha
    assegnati: dict[str, str] = {}
    presi: set[str] = set()
    for entry_id, title, primary in entries:
        if primary:
            profilo = PRIMARY_PROFILE
        else:
            profilo = _named_profile(title, entry_id, slugify)
            if profilo in presi:
                profilo = f"{profilo}-{entry_id[:6].lower()}"
        assegnati[entry_id] = profilo
        presi.add(profilo)
    return assegnati


def _meaningful_scalar(value: Any) -> bool:
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, bool):
        return value
    if isinstance(value, int | float):
        return value != 0
    return False


def _meaningful(value: Any, *, ignore_metadata: bool = False) -> bool:
    """Whether a decoded configuration value holds anything a user entered."""
    if isinstance(value, list):
        return any(_meaningful(item) for item in value)
    if isinstance(value, dict):
        return any(
            not (ignore_metadata and key == "metadata") and _meaningful(child)
            for key, child in value.items()
        )
    return _meaningful_scalar(value)


def content_key_count(values: Mapping[str, Any] | None) -> int:
    """Count the snapshot keys that actually carry a configured plancia.

    Mirrors ``meaningfulLocal`` in the frontend: visibility flags and schema
    bookkeeping are ignored, and ``dm_dashboard_state`` is judged by its
    sections so a bare envelope does not read as configured.
    """
    if not isinstance(values, dict):
        return 0
    count = 0
    for key, raw in values.items():
        if key in NON_CONTENT_KEYS:
            continue
        try:
            decoded = json.loads(raw) if isinstance(raw, str) else raw
        except (TypeError, ValueError):
            decoded = raw
        if key == "dm_dashboard_state":
            sections = decoded.get("sections") if isinstance(decoded, dict) else None
            # Mirrors meaningfulConfigValues in the frontend: only the energy
            # section carries a metadata block that is bookkeeping rather than
            # configuration, and it is ignored inside that section alone.
            if isinstance(sections, dict) and any(
                _meaningful(value, ignore_metadata=name == "energy")
                for name, value in sections.items()
            ):
                count += 1
            continue
        if _meaningful(decoded):
            count += 1
    return count


def is_configured(values: Mapping[str, Any] | None) -> bool:
    """Whether a snapshot describes a configured plancia."""
    return content_key_count(values) > 0


def _public(snapshot: dict[str, Any] | None) -> dict[str, Any] | None:
    """Return a snapshot without its history, as the frontend consumes it."""
    if not snapshot:
        return None
    return {
        "revision": int(snapshot.get("revision") or 0),
        "updated_at": int(snapshot.get("updated_at") or 0),
        "keys_revision": int(snapshot.get("keys_revision") or 0),
        "writer_generation": int(snapshot.get("writer_generation") or 0),
        "reset": bool(snapshot.get("reset")),
        "values": dict(snapshot.get("values") or {}),
    }


def _recoverable(snapshot: dict[str, Any] | None) -> list[dict[str, Any]]:
    """List the kept revisions that could restore a configured plancia.

    Only used when the current snapshot is empty, which is why intentional
    resets are listed too: the caller decides, and an intentional reset is
    never auto-recovered.
    """
    if not snapshot:
        return []
    entries = []
    for revision in snapshot.get("history") or []:
        values = revision.get("values") or {}
        if not is_configured(values):
            continue
        entries.append(
            {
                "revision": int(revision.get("revision") or 0),
                "updated_at": int(revision.get("updated_at") or 0),
                "content_keys": content_key_count(values),
                "reset": bool(revision.get("reset")),
            }
        )
    entries.sort(key=lambda item: item["revision"], reverse=True)
    return entries


class SnapshotTooLargeError(ValueError):
    """Raised when a snapshot exceeds the accepted size limits."""


def validate_values(values: Mapping[str, Any]) -> dict[str, str]:
    """Return the accepted string values of an incoming snapshot."""
    if not isinstance(values, dict):
        raise SnapshotTooLargeError("values must be an object")
    if len(values) > MAX_KEYS:
        raise SnapshotTooLargeError(f"too many keys: {len(values)} > {MAX_KEYS}")
    total = 0
    accepted: dict[str, str] = {}
    for key, value in values.items():
        if not isinstance(value, str):
            continue
        size = len(value.encode("utf-8"))
        if size > MAX_VALUE_BYTES:
            raise SnapshotTooLargeError(f"{key} exceeds {MAX_VALUE_BYTES} bytes")
        total += size
        if total > MAX_TOTAL_BYTES:
            raise SnapshotTooLargeError(f"snapshot exceeds {MAX_TOTAL_BYTES} bytes")
        accepted[str(key)] = value
    return accepted


class DashboardConfigStore:
    """The shared configuration of every plancia of this installation."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Bind the store to Home Assistant's storage helper."""
        from homeassistant.helpers.storage import Store

        self.hass = hass
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self._data: dict[str, Any] = {"profiles": {}, "entry_profiles": {}}
        self._loaded = False

    async def async_load(self) -> None:
        """Read the storage file once."""
        if self._loaded:
            return
        stored = await self._store.async_load()
        if isinstance(stored, dict):
            profiles = stored.get("profiles")
            entry_profiles = stored.get("entry_profiles")
            self._data = {
                "profiles": profiles if isinstance(profiles, dict) else {},
                "entry_profiles": (
                    entry_profiles if isinstance(entry_profiles, dict) else {}
                ),
            }
        self._loaded = True

    async def _async_save(self) -> None:
        await self._store.async_save(self._data)

    def _profiles(self) -> dict[str, Any]:
        return self._data.setdefault("profiles", {})

    def _entry_profiles(self) -> dict[str, Any]:
        return self._data.setdefault("entry_profiles", {})

    def entry_profiles(self) -> dict[str, str]:
        """Quale profilo usa davvero ogni plancia, per chi deve risalire.

        E' la memoria che segue i cambi di nome: chi controlla i permessi sul
        profilo chiesto la guarda per non scambiare una plancia rinominata per
        un profilo di nessuno.
        """
        return {
            str(entry_id): str(profile)
            for entry_id, profile in self._entry_profiles().items()
            if profile
        }

    def _resolve(self, profile: str, entry_id: str | None) -> tuple[str, str | None]:
        """Return the profile this config entry actually uses.

        The profile of a non-primary plancia is derived from its title, so
        renaming it would otherwise point at an empty bucket. ``entry_profiles``
        remembers which bucket this exact entry has been using, and that bucket
        keeps serving it. The data is never moved between buckets: the panel and
        the companion card can ask under different names — one of them carrying a
        title from before a rename — and both are answered from the same place.

        Il ricordo viene PRIMA del nome chiesto, e questo e' il punto.
        Chiesto in revisione: due plance con lo stesso titolo, la seconda con il
        nome suffissato; si rinomina o si toglie la prima, e il nome liscio
        torna libero. La seconda lo ricalcolerebbe — e' quello che ha di nuovo
        il titolo unico — e finirebbe di nuovo nella cassetta dell'altra, che e'
        esattamente il difetto da cui si e' partiti. La cassetta di una plancia
        gliela dice la sua memoria, non il conto del momento.
        """
        if not entry_id:
            return profile, None
        profiles = self._profiles()
        memoria = self._entry_profiles()
        ricordo = memoria.get(entry_id)
        if not ricordo or ricordo == profile:
            return profile, None
        # Un ricordo non vale se quella cassetta e' di un'altra plancia.
        #
        # Il ricordo serve a seguire un rinomino: la stessa plancia, sotto un
        # altro nome, ritrova la sua roba. Ma due plance chiamate allo stesso
        # modo hanno condiviso una cassetta sola — e' il difetto che i profili
        # unici tolgono di mezzo — e senza questa riga il ricordo le
        # rimetterebbe insieme il giorno dopo, vanificando la separazione.
        altrui = {salvato for altra, salvato in memoria.items() if altra != entry_id}
        if ricordo in altrui:
            return profile, None
        # Il ricordo vale quando ha davvero una cassetta dietro, e vale anche
        # quando non ce l'ha ancora ma il nome chiesto adesso e' di un'altra
        # plancia: meglio una cassetta vuota che la roba di qualcun altro.
        if ricordo in profiles or profile in altrui:
            return ricordo, profile
        return profile, None

    async def async_get(
        self, profile: str, *, entry_id: str | None = None
    ) -> dict[str, Any]:
        """Return the shared snapshot of one plancia."""
        await self.async_load()
        profile, requested = self._resolve(profile, entry_id)
        snapshot = self._profiles().get(profile)
        if entry_id and self._entry_profiles().get(entry_id) != profile:
            self._entry_profiles()[entry_id] = profile
            await self._async_save()
        return {
            "profile": profile,
            "requested_profile": requested,
            "snapshot": _public(snapshot),
            "recoverable": _recoverable(snapshot),
            "profiles": sorted(self._profiles()),
        }

    async def async_set(
        self,
        profile: str,
        values: Mapping[str, Any],
        *,
        entry_id: str | None = None,
        keys_revision: int = 0,
        writer_generation: int = 0,
        updated_at: int = 0,
        expected_revision: int | None = None,
        reset: bool = False,
    ) -> dict[str, Any]:
        """Store a snapshot, refusing the writes that used to lose data."""
        await self.async_load()
        profile, _renamed = self._resolve(profile, entry_id)
        profiles = self._profiles()
        current = profiles.get(profile)
        accepted = validate_values(values)

        if expected_revision is not None and int(expected_revision) != int(
            (current or {}).get("revision") or 0
        ):
            return {
                "status": STATUS_CONFLICT,
                "profile": profile,
                "snapshot": _public(current),
                "recoverable": _recoverable(current),
            }

        # The accidental-wipe signature: a client with nothing configured
        # overwriting a configured plancia. Only an explicit reset may do that.
        if (
            not reset
            and current
            and is_configured(current.get("values"))
            and not is_configured(accepted)
        ):
            return {
                "status": STATUS_REFUSED_EMPTY,
                "profile": profile,
                "snapshot": _public(current),
                "recoverable": _recoverable(current),
            }

        if current and dict(current.get("values") or {}) == accepted:
            if entry_id:
                self._entry_profiles()[entry_id] = profile
            # Un salto di generazione (o di revisione delle chiavi) su valori
            # identici e' un aggiornamento di metadati, non una scrittura: si
            # timbra la busta com'e', senza coniare una revisione nuova.
            # Senza questo timbro l'aggiornamento in-sync del frontend girava
            # a vuoto e la busta restava della generazione vecchia — e un
            # altro dispositivo aggiornato con dati stantii poteva ancora
            # scavalcarla come «scatto di un runtime vecchio».
            stamped = False
            if int(writer_generation or 0) > int(current.get("writer_generation") or 0):
                current["writer_generation"] = int(writer_generation or 0)
                stamped = True
            if int(keys_revision or 0) > int(current.get("keys_revision") or 0):
                current["keys_revision"] = int(keys_revision or 0)
                stamped = True
            if stamped:
                await self._async_save()
            return {
                "status": STATUS_UNCHANGED,
                "profile": profile,
                "snapshot": _public(current),
                "recoverable": _recoverable(current),
            }

        history = list((current or {}).get("history") or [])
        if current and is_configured(current.get("values")):
            history.insert(
                0,
                {
                    "revision": int(current.get("revision") or 0),
                    "updated_at": int(current.get("updated_at") or 0),
                    "keys_revision": int(current.get("keys_revision") or 0),
                    "writer_generation": int(current.get("writer_generation") or 0),
                    "reset": bool(current.get("reset")),
                    "values": dict(current.get("values") or {}),
                },
            )
        del history[HISTORY_LIMIT:]

        snapshot = {
            "revision": int((current or {}).get("revision") or 0) + 1,
            "updated_at": int(updated_at or 0) or _now_ms(),
            "keys_revision": int(keys_revision or 0),
            "writer_generation": int(writer_generation or 0),
            "reset": bool(reset),
            "values": accepted,
            "history": history,
        }
        profiles[profile] = snapshot
        if entry_id:
            self._entry_profiles()[entry_id] = profile
        await self._async_save()
        return {
            "status": STATUS_SAVED,
            "profile": profile,
            "snapshot": _public(snapshot),
            "recoverable": _recoverable(snapshot),
        }

    async def async_restore(
        self, profile: str, revision: int, *, entry_id: str | None = None
    ) -> dict[str, Any]:
        """Promote a kept revision back to current."""
        await self.async_load()
        profile, _renamed = self._resolve(profile, entry_id)
        current = self._profiles().get(profile)
        wanted = next(
            (
                item
                for item in (current or {}).get("history") or []
                if int(item.get("revision") or 0) == int(revision)
            ),
            None,
        )
        if not wanted:
            return {
                "status": STATUS_CONFLICT,
                "profile": profile,
                "snapshot": _public(current),
                "recoverable": _recoverable(current),
            }
        return await self.async_set(
            profile,
            dict(wanted.get("values") or {}),
            entry_id=entry_id,
            keys_revision=int(wanted.get("keys_revision") or 0),
            writer_generation=int(wanted.get("writer_generation") or 0),
            updated_at=_now_ms(),
        )


def _now_ms() -> int:
    from homeassistant.util import dt as dt_util

    return int(dt_util.utcnow().timestamp() * 1000)


async def async_get_config_store(hass: HomeAssistant) -> DashboardConfigStore:
    """Return the single loaded store of this installation."""
    domain_data: dict[str, Any] = hass.data.setdefault(DOMAIN, {})
    store = domain_data.get(DATA_CONFIG_STORE)
    if store is None:
        store = DashboardConfigStore(hass)
        domain_data[DATA_CONFIG_STORE] = store
    await store.async_load()
    return store

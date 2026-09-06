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

import copy
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

#: Quanto aspetta il negozio prima di scrivere il file.
#:
#: Un salvataggio dalla plancia non arriva mai da solo: l'editor spinge una
#: raffica di scatti a distanza di decimi di secondo, e ognuno riscriveva
#: subito un file con dentro la revisione corrente piu' cinque copie della
#: storia — otto megabyte al massimo, serializzati e scritti su disco a ogni
#: tocco. Con un ritardo breve la raffica diventa una scrittura sola: la
#: risposta «salvato» parte comunque subito, perche' il negozio in memoria e'
#: gia' aggiornato. Alla chiusura di Home Assistant una scrittura in attesa
#: viene fatta lo stesso, prima dell'ultimo scatto su disco.
SAVE_DELAY = 2.0

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


# ─── Il conto delle chiavi, fatto una volta sola ─────────────────────────────
#
# Contare le chiavi di contenuto vuol dire decodificare ogni valore dello
# scatto — sono documenti JSON, alcuni da centinaia di kilobyte — e
# percorrerlo tutto. Lo si faceva a ogni lettura e a ogni scrittura, sullo
# scatto corrente e su ognuna delle cinque revisioni custodite: una decina di
# volte per chiamata, nell'event loop, per rispondere sempre alla stessa
# domanda su dati che non erano cambiati. Il conto si fa adesso quando lo
# scatto entra nel negozio, e viaggia con lui: ``content_keys`` e
# ``configured`` stanno nel record, e chi legge li legge e basta. I record
# scritti prima di questa versione non li hanno: si contano la prima volta
# che qualcuno li guarda, e da li' in poi restano contati.


def _annotate(record: dict[str, Any], content_keys: int) -> None:
    """Scrivi nel record quante chiavi di contenuto porta."""
    record["content_keys"] = int(content_keys)
    record["configured"] = content_keys > 0


def _content_keys(record: dict[str, Any]) -> int:
    """Le chiavi di contenuto di un record, contate una volta sola."""
    count = record.get("content_keys")
    if isinstance(count, bool) or not isinstance(count, int):
        count = content_key_count(record.get("values"))
        _annotate(record, count)
    return count


def _configured(record: dict[str, Any] | None) -> bool:
    """Se un record del negozio descrive una plancia configurata."""
    if not record:
        return False
    flag = record.get("configured")
    if isinstance(flag, bool):
        return flag
    return _content_keys(record) > 0


def _public(
    snapshot: dict[str, Any] | None, *, with_values: bool = True
) -> dict[str, Any] | None:
    """Return a snapshot without its history, as the frontend consumes it.

    ``with_values`` e' falso solo nella risposta «unchanged»: li' i valori
    custoditi sono per definizione quelli appena mandati, e rimandarli
    indietro — fino a otto megabyte da serializzare nel loop — non dice
    niente che il chiamante non abbia gia' in mano. Il frontend, in quel
    ramo, usa i propri.
    """
    if not snapshot:
        return None
    public = {
        "revision": int(snapshot.get("revision") or 0),
        "updated_at": int(snapshot.get("updated_at") or 0),
        "keys_revision": int(snapshot.get("keys_revision") or 0),
        "writer_generation": int(snapshot.get("writer_generation") or 0),
        "reset": bool(snapshot.get("reset")),
    }
    if with_values:
        public["values"] = dict(snapshot.get("values") or {})
    return public


def _recoverable(snapshot: dict[str, Any] | None) -> list[dict[str, Any]]:
    """List the kept revisions that could restore a configured plancia.

    Only used when the current snapshot is empty — e' l'unico caso in cui il
    frontend la guarda — which is why intentional resets are listed too: the
    caller decides, and an intentional reset is never auto-recovered. Per una
    plancia configurata l'elenco e' vuoto: non serve a nessuno, e comporlo
    voleva dire rileggere la storia a ogni chiamata.
    """
    if not snapshot or _configured(snapshot):
        return []
    entries = []
    for revision in snapshot.get("history") or []:
        if not _configured(revision):
            continue
        entries.append(
            {
                "revision": int(revision.get("revision") or 0),
                "updated_at": int(revision.get("updated_at") or 0),
                "content_keys": _content_keys(revision),
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
        # Se c'e' una scrittura in attesa che il file non ha ancora visto.
        self._pending = False

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

    def _snapshot_to_save(self) -> dict[str, Any]:
        """Una copia dei dati, presa nel loop, che il thread puo' serializzare.

        Home Assistant serializza il file in un thread; dargli il dizionario
        vivo vuol dire che una scrittura arrivata nel frattempo lo cambia
        mentre viene percorso. La copia duplica solo i contenitori: le
        stringhe — che sono il peso vero — restano condivise.
        """
        return copy.deepcopy(self._data)

    def _schedule_save(self) -> None:
        """Segna che c'e' da scrivere, e lascia che la raffica si compatti."""
        pending = self._snapshot_to_save()

        def consegna() -> dict[str, Any]:
            # Chiamata da Home Assistant nel momento in cui scrive davvero.
            self._pending = False
            return pending

        self._pending = True
        self._store.async_delay_save(consegna, SAVE_DELAY)

    async def async_flush(self) -> None:
        """Scrivi subito quello che e' in attesa, se c'e' qualcosa.

        Alla chiusura di Home Assistant ci pensa il negozio da se'; qui si
        passa quando una plancia viene scaricata, e nelle prove che rileggono
        il file.
        """
        if not self._pending:
            return
        self._pending = False
        await self._store.async_save(self._snapshot_to_save())

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
            self._schedule_save()
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
        # L'unico conto di questa chiamata: sullo scatto che arriva. Quello
        # corrente e la storia il loro conto lo portano gia' scritto.
        accepted_keys = content_key_count(accepted)

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
        if not reset and _configured(current) and accepted_keys == 0:
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
                self._schedule_save()
            return {
                "status": STATUS_UNCHANGED,
                "profile": profile,
                "snapshot": _public(current, with_values=False),
                "recoverable": _recoverable(current),
            }

        history = list((current or {}).get("history") or [])
        if current and _configured(current):
            # La revisione custodita si porta dietro il suo conto: cosi'
            # l'elenco delle recuperabili si compone leggendo, non contando.
            kept = {
                "revision": int(current.get("revision") or 0),
                "updated_at": int(current.get("updated_at") or 0),
                "keys_revision": int(current.get("keys_revision") or 0),
                "writer_generation": int(current.get("writer_generation") or 0),
                "reset": bool(current.get("reset")),
                "values": dict(current.get("values") or {}),
            }
            _annotate(kept, _content_keys(current))
            history.insert(0, kept)
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
        _annotate(snapshot, accepted_keys)
        profiles[profile] = snapshot
        if entry_id:
            self._entry_profiles()[entry_id] = profile
        self._schedule_save()
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

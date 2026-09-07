"""«Vorrei uno slider per decidere il tempo che un condizionatore debba restare
acceso dal momento che gli do l'on, utile spesso di notte o per accensioni a
spot.» (#364)

La parte che conta non e' lo slider: e' DOVE vive il conto alla rovescia. Un
timer nel browser muore chiudendo la pagina, e chi accende il condizionatore
per due ore prima di dormire la pagina la chiude sempre — resterebbe acceso
tutta la notte, cioe' esattamente il contrario di quello che ha chiesto.

Queste prove fissano le quattro cose che rendono onesto lo spegnimento: che il
timer scatti, che spenga col servizio giusto per qualunque dominio, che un
riavvio non lo perda, e che chi spegne a mano se lo porti via.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from custom_components.dashboardmodern import spegnimento as sp


class _Memoria:
    """Il file dello store, tenuto in memoria."""

    def __init__(self, contenuto: dict | None = None) -> None:
        self.contenuto = contenuto
        self.scritto: dict | None = None

    async def async_load(self) -> dict | None:
        return self.contenuto

    def async_delay_save(self, fabbrica: Any, _ritardo: float) -> None:
        self.scritto = fabbrica()


class _Stato:
    def __init__(self, state: str) -> None:
        self.state = state


class _Casa:
    """Quel poco di Home Assistant che serve qui."""

    def __init__(self, stati: dict[str, str] | None = None) -> None:
        self.states = MagicMock()
        mappa = {nome: _Stato(valore) for nome, valore in (stati or {}).items()}
        self.states.get = mappa.get
        self.services = MagicMock()
        self.services.async_call = AsyncMock()
        self.data: dict[str, Any] = {}


def _store(
    monkeypatch: pytest.MonkeyPatch,
    casa: _Casa,
    memoria: _Memoria,
    adesso: float = 1_000_000.0,
) -> tuple[Any, list[tuple[float, Any]], list[Any]]:
    """Uno store con il file finto, l'orologio fermo e gli allarmi raccolti."""
    allarmi: list[tuple[float, Any]] = []

    def _piu_tardi(_hass: Any, fra: float, callback: Any) -> Any:
        allarmi.append((fra, callback))
        return lambda: allarmi.remove((fra, callback))

    ascolti: list[Any] = []

    def _segui(_hass: Any, entita: Any, callback: Any) -> Any:
        ascolti.append((list(entita), callback))
        return lambda: None

    monkeypatch.setattr(sp, "_adesso", lambda _hass: adesso)
    monkeypatch.setattr(
        "homeassistant.helpers.storage.Store", lambda *_a, **_k: memoria
    )
    monkeypatch.setattr("homeassistant.helpers.event.async_call_later", _piu_tardi)
    monkeypatch.setattr(
        "homeassistant.helpers.event.async_track_state_change_event", _segui
    )
    store = sp.SpegnimentoStore(casa)
    return store, allarmi, ascolti


async def test_il_timer_scatta_e_spegne(monkeypatch: pytest.MonkeyPatch) -> None:
    """Trenta minuti, e alla scadenza l'unita' si spegne."""
    casa = _Casa({"climate.salone": "cool"})
    memoria = _Memoria()
    store, allarmi, _ = _store(monkeypatch, casa, memoria)
    await store.async_load()

    scadenza = await store.async_programma("climate.salone", 30)
    assert scadenza == 1_000_000.0 + 30 * 60_000
    assert store.scadenze() == {"climate.salone": scadenza}
    # Un solo allarme, e fra mezz'ora esatta.
    assert len(allarmi) == 1
    assert allarmi[0][0] == pytest.approx(30 * 60)

    await allarmi[0][1](None)
    # `homeassistant.turn_off` sceglie il dominio giusto da se': nella casella
    # dell'unita' puo' esserci un climate, ma anche uno switch.
    casa.services.async_call.assert_awaited_once_with(
        "homeassistant", "turn_off", {"entity_id": "climate.salone"}, blocking=False
    )
    assert store.scadenze() == {}


async def test_zero_minuti_toglie_il_timer(monkeypatch: pytest.MonkeyPatch) -> None:
    """Zero e' come si annulla, e non spegne niente."""
    casa = _Casa({"climate.salone": "cool"})
    store, _, _ = _store(monkeypatch, casa, _Memoria())
    await store.async_load()

    await store.async_programma("climate.salone", 30)
    assert await store.async_programma("climate.salone", 0) is None
    assert store.scadenze() == {}
    casa.services.async_call.assert_not_awaited()


async def test_un_riavvio_non_perde_lo_spegnimento(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """La scadenza sta sul disco, e all'avvio si riarma.

    Un riavvio di Home Assistant nel mezzo della notte non deve lasciare acceso
    un condizionatore che qualcuno aveva chiesto di spegnere fra due ore.
    """
    casa = _Casa({"climate.camera": "cool"})
    fra_dieci_minuti = 1_000_000.0 + 10 * 60_000
    memoria = _Memoria({"scadenze": {"climate.camera": fra_dieci_minuti}})
    store, allarmi, _ = _store(monkeypatch, casa, memoria)

    await store.async_load()
    assert store.scadenze() == {"climate.camera": fra_dieci_minuti}
    assert allarmi[0][0] == pytest.approx(10 * 60)


async def test_la_scadenza_gia_passata_si_esegue_subito(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Meglio spegnere in ritardo che non spegnere."""
    casa = _Casa({"climate.camera": "cool"})
    memoria = _Memoria({"scadenze": {"climate.camera": 1.0}})
    store, allarmi, _ = _store(monkeypatch, casa, memoria)

    await store.async_load()
    assert allarmi[0][0] == 0.0


async def test_chi_spegne_a_mano_si_porta_via_il_timer(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Il timer appartiene a QUELLA accensione, e con lei finisce.

    Senza questo restava appeso un allarme che, due ore dopo, spegneva
    un'unita' che nel frattempo qualcun altro aveva riacceso.
    """
    casa = _Casa({"climate.salone": "cool"})
    store, _, ascolti = _store(monkeypatch, casa, _Memoria())
    await store.async_load()
    await store.async_programma("climate.salone", 60)

    seguite, callback = ascolti[-1]
    assert seguite == ["climate.salone"]

    evento = MagicMock()
    evento.data = {"entity_id": "climate.salone", "new_state": _Stato("off")}
    await callback(evento)
    assert store.scadenze() == {}


async def test_un_integrazione_che_si_ricarica_non_butta_il_timer(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """`unavailable` e' l'entita' sparita, non spenta.

    Chi sta dormendo non deve perdere lo spegnimento perche' l'integrazione si
    e' ricaricata per un attimo.
    """
    casa = _Casa({"climate.salone": "cool"})
    store, _, ascolti = _store(monkeypatch, casa, _Memoria())
    await store.async_load()
    await store.async_programma("climate.salone", 60)
    _, callback = ascolti[-1]

    for assente in (None, _Stato("unavailable"), _Stato("unknown")):
        evento = MagicMock()
        evento.data = {"entity_id": "climate.salone", "new_state": assente}
        await callback(evento)
    assert list(store.scadenze()) == ["climate.salone"]


async def test_i_minuti_fuori_scala_si_riportano_dentro(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Un valore fuori scala e' un errore di chi chiama, non una richiesta."""
    casa = _Casa({"climate.salone": "cool"})
    store, _, _ = _store(monkeypatch, casa, _Memoria())
    await store.async_load()

    scadenza = await store.async_programma("climate.salone", 100_000)
    assert scadenza == 1_000_000.0 + sp.MAX_MINUTI * 60_000


async def test_lo_store_ha_un_fondo(monkeypatch: pytest.MonkeyPatch) -> None:
    """Cento timer, e poi cede la scadenza piu' lontana."""
    casa = _Casa({f"climate.u{indice}": "cool" for indice in range(sp.MAX_TIMER + 1)})
    store, _, _ = _store(monkeypatch, casa, _Memoria())
    await store.async_load()

    for indice in range(sp.MAX_TIMER):
        await store.async_programma(f"climate.u{indice}", 10)
    # L'ultima messa e' anche la piu' lontana fra quelle da dieci minuti: e'
    # lei che cede il posto.
    await store.async_programma(f"climate.u{sp.MAX_TIMER}", 5)
    assert len(store.scadenze()) == sp.MAX_TIMER
    assert f"climate.u{sp.MAX_TIMER}" in store.scadenze()

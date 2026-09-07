"""«Quando si imposta la plancia come predefinita ed apro app HA va in errore,
se invece poi la seleziono dal menu laterale funziona.»

Home Assistant lascia scegliere come dashboard predefinita una dashboard
Lovelace, non un pannello personalizzato: percio' la plancia ne registra una di
appoggio, fuori dalla barra laterale, con dentro una card sola.

Il guaio era CHI la scriveva. La scriveva `panel.js`, cioe' il pannello, e il
pannello gira solo quando qualcuno apre la plancia dalla barra. Chi la mette
come predefinita e riavvia apre quella dashboard senza passare dal pannello: se
il contenuto non era mai stato scritto, Lovelace risponde «Errore di
configurazione», e aprirla dalla barra la ripara — esattamente il sintomo.

Adesso la scrive l'integrazione all'avvio, che e' l'unico momento che succede
comunque. Queste prove fissano che succeda, che il contenuto sia quello giusto,
e che non si rompa niente quando Lovelace non c'e'.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock

from custom_components.dashboardmodern import frontend as fe


class _Magazzino:
    """Il posto dove Lovelace tiene la configurazione di una dashboard."""

    def __init__(self) -> None:
        self.salvata: dict | None = None

    async def async_save(self, config: dict) -> None:
        self.salvata = config


class _Collezione:
    def __init__(self, plance: dict) -> None:
        self.plance = plance
        self.create = []

    async def async_create_item(self, voce: dict) -> dict:
        self.create.append(voce)
        self.plance[voce["url_path"]] = _Magazzino()
        return voce


def _lovelace(hass: Any, plance: dict | None = None) -> dict:
    plance = plance if plance is not None else {}
    dati = {"dashboards": plance, "dashboards_collection": _Collezione(plance)}
    hass.data["lovelace"] = dati
    return dati


def _voce(
    hass: Any,
    *,
    entry_id: str = "abcdef1234567890",
    title: str = "Casa 3.0",
    options: dict | None = None,
) -> Any:
    entry = MagicMock()
    entry.entry_id = entry_id
    entry.title = title
    entry.data = {"primary": True}
    entry.options = options or {}
    hass.config_entries.async_get_entry = MagicMock(return_value=entry)
    hass.config_entries.async_entries = MagicMock(return_value=[entry])
    return entry


async def test_la_dashboard_di_appoggio_nasce_all_avvio(hass: Any) -> None:
    entry = _voce(hass)
    dati = _lovelace(hass)

    assert await fe._ensure_companion_dashboard(hass, entry.entry_id) is True

    url_path = fe._lovelace_url_path(entry)
    # Nasce fuori dalla barra: nella barra c'e' gia' il pannello.
    (creata,) = dati["dashboards_collection"].create
    assert creata["url_path"] == url_path
    assert creata["show_in_sidebar"] is False
    assert creata["title"] == "Casa 3.0"

    # E nasce PIENA: e' il vuoto che dava «Errore di configurazione».
    salvata = dati["dashboards"][url_path].salvata
    (vista,) = salvata["views"]
    assert vista["type"] == "panel"
    (card,) = vista["cards"]
    assert card["type"] == "custom:dashboardmodern-card"
    assert card["entry_id"] == entry.entry_id


async def test_una_dashboard_che_c_e_gia_si_riempie_e_basta(hass: Any) -> None:
    """Riavviare non deve creare una seconda dashboard con lo stesso indirizzo."""
    entry = _voce(hass)
    url_path = fe._lovelace_url_path(entry)
    dati = _lovelace(hass, {url_path: _Magazzino()})

    assert await fe._ensure_companion_dashboard(hass, entry.entry_id) is True
    assert dati["dashboards_collection"].create == []
    assert dati["dashboards"][url_path].salvata["views"]


async def test_senza_lovelace_non_si_rompe_niente(hass: Any) -> None:
    """All'avvio Lovelace puo' non esserci ancora: si dice di no e si riprova."""
    entry = _voce(hass)
    hass.data.pop("lovelace", None)
    assert await fe._ensure_companion_dashboard(hass, entry.entry_id) is False


async def test_chi_ha_spento_la_dashboard_non_se_la_ritrova(hass: Any) -> None:
    from custom_components.dashboardmodern.config_flow import OPTION_REGISTER_LOVELACE

    entry = _voce(hass, options={OPTION_REGISTER_LOVELACE: False})
    dati = _lovelace(hass)
    assert await fe._ensure_companion_dashboard(hass, entry.entry_id) is False
    assert dati["dashboards_collection"].create == []


async def test_le_persone_ammesse_arrivano_nella_vista(hass: Any) -> None:
    """Chi limita la plancia a certi utenti deve limitare anche questa strada."""
    from custom_components.dashboardmodern.config_flow import (
        OPTION_ADMIN_ONLY,
        OPTION_ALLOWED_USERS,
    )

    entry = _voce(
        hass, options={OPTION_ADMIN_ONLY: True, OPTION_ALLOWED_USERS: ["u1", "u2"]}
    )
    dati = _lovelace(hass)
    await fe._ensure_companion_dashboard(hass, entry.entry_id)

    (creata,) = dati["dashboards_collection"].create
    assert creata["require_admin"] is True
    vista = dati["dashboards"][fe._lovelace_url_path(entry)].salvata["views"][0]
    assert vista["visible"] == [{"user": "u1"}, {"user": "u2"}]
    assert vista["cards"][0]["allowed_user_ids"] == ["u1", "u2"]


async def test_un_errore_di_lovelace_non_ferma_la_plancia(hass: Any) -> None:
    entry = _voce(hass)
    plance: dict = {}
    collezione = _Collezione(plance)
    collezione.async_create_item = AsyncMock(side_effect=RuntimeError("no"))
    hass.data["lovelace"] = {"dashboards": plance, "dashboards_collection": collezione}
    assert await fe._ensure_companion_dashboard(hass, entry.entry_id) is False


def test_il_pannello_non_scrive_piu_la_dashboard() -> None:
    """Una vista sola, scritta in un posto solo.

    Averla in `panel.js` e in `frontend.py` vorrebbe dire due verita' sulla
    stessa dashboard, e quella che vince dipenderebbe da cosa hai aperto per
    primo — che e' il difetto di partenza, non la sua correzione.
    """
    sorgente = (fe.FRONTEND_DIR / "panel.js").read_text(encoding="utf-8")
    assert "lovelace/dashboards/create" not in sorgente
    assert "lovelace/config/save" not in sorgente
    assert "custom:dashboardmodern-card" not in sorgente

"""La dashboard di appoggio su una Lovelace che non tiene piu' la collezione.

«Esce nella sidebar ma fra le plance non c'e'» (#507), su Home Assistant
2026.8: la plancia nella barra laterale — quel pannello lo registriamo noi — e
fra le plance niente, con un avviso che accusava il modo YAML una casa che il
modo YAML non ha. Reinstallare non cambiava niente, e non poteva: non era un
residuo.

Sotto c'era un campo che non esiste piu'. `hass.data["lovelace"]` era un
dizionario, e dentro ci stava anche `dashboards_collection`; adesso e' un
oggetto tipizzato con quattro campi — `resource_mode`, `dashboards`,
`resources`, `yaml_dashboards` — e la collezione non e' fra quelli: nel codice
di Lovelace e' una variabile locale dell'avvio. Senza collezione la dashboard
di appoggio non nasce, e senza quella la plancia non e' scegliibile come
predefinita.

Le prove che c'erano non potevano vederlo: girano sulla Lovelace installata
qui, che e' ancora quella col dizionario. Questa prova prende gli oggetti VERI
di quell'avvio e li rimette nella forma di oggi — la collezione raggiungibile
solo da chi pubblica i comandi `lovelace/dashboards/*` — e chiede la stessa
cosa: che la dashboard nasca.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from unittest.mock import MagicMock

from homeassistant.setup import async_setup_component

from custom_components.dashboardmodern import frontend as fe


@dataclass
class LovelaceComeOggi:
    """I quattro campi che Lovelace tiene, e nient'altro.

    Copiati dalla `LovelaceData` vera: se un giorno ne aggiunge uno, questa
    prova resta valida — quello che conta e' che la collezione NON ci sia.
    """

    resource_mode: str
    dashboards: dict
    resources: Any
    yaml_dashboards: dict

    # Il ponte per la Lovelace installata qui, che dentro al suo stesso avvio
    # scrive `hass.data["lovelace"]["dashboards"][...]`: quella riga, nella
    # versione di oggi, e' scritta con il punto. Serve alla prova, non al
    # prodotto — cio' che si sta provando e' che la collezione si trovi senza
    # il campo che la portava.
    def __getitem__(self, nome: str) -> Any:
        return getattr(self, nome)

    def get(self, nome: str, difetto: Any = None) -> Any:
        return getattr(self, nome, difetto)

    def __contains__(self, nome: object) -> bool:
        return hasattr(self, str(nome))


def _voce(hass: Any, *, title: str = "Casa 3.0") -> Any:
    entry = MagicMock()
    entry.entry_id = "abcdef1234567890"
    entry.title = title
    entry.data = {"primary": True}
    entry.options = {}
    hass.config_entries.async_get_entry = MagicMock(return_value=entry)
    hass.config_entries.async_entries = MagicMock(
        side_effect=lambda dominio=None, **_p: (
            [entry] if dominio in (None, "dashboardmodern") else []
        )
    )
    return entry


def _come_oggi(hass: Any) -> Any:
    """Rimette i dati di Lovelace nella forma che hanno adesso."""
    dati = hass.data["lovelace"]
    campi = dati if isinstance(dati, dict) else vars(dati)
    hass.data["lovelace"] = LovelaceComeOggi(
        resource_mode=str(campi.get("mode") or "storage"),
        dashboards=campi["dashboards"],
        resources=campi["resources"],
        yaml_dashboards=campi.get("yaml_dashboards") or {},
    )
    return hass.data["lovelace"]


async def test_niente_dashboards_collection_e_la_plancia_nasce_comunque(
    hass: Any,
) -> None:
    """Senza quel campo la collezione si trova, e la dashboard nasce piena."""
    assert await async_setup_component(hass, "lovelace", {})
    await hass.async_block_till_done()
    nuovi = _come_oggi(hass)
    # La premessa della prova: il campo non c'e' davvero.
    assert not hasattr(nuovi, "dashboards_collection")

    entry = _voce(hass)
    assert await fe._ensure_companion_dashboard(hass, entry.entry_id) is True
    await hass.async_block_till_done()

    url_path = fe._lovelace_url_path(entry)
    collezione, plance, modo, _dentro = fe._plance_di_lovelace(hass)
    assert collezione is not None
    # Ed e' la collezione VERA, quella che usa Home Assistant: la voce nuova
    # sta li' dentro, non in una seconda copia scritta di nascosto.
    assert [voce["url_path"] for voce in collezione.async_items()] == [url_path]
    # Il modo si sa ancora, perche' lo dichiara la plancia di serie.
    assert modo == "storage"

    # E dentro c'e' la card: e' il vuoto che dava «Errore di configurazione».
    salvata = await plance[url_path].async_load(False)
    (vista,) = salvata["views"]
    (card,) = vista["cards"]
    assert card["type"] == "custom:dashboardmodern-card"


async def test_senza_nessuna_via_la_plancia_lo_dice_senza_accusare_lo_yaml(
    hass: Any,
) -> None:
    """Niente collezione da nessuna parte: si avvisa, e non si dice «YAML».

    E' il caso che la 1.4.22 sbagliava a raccontare. Adesso la dashboard non
    nasce — non c'e' niente in cui farla nascere — ma il modo si sa, e non e'
    YAML: chi legge non va a cercare una riga che non ha mai scritto.
    """
    assert await async_setup_component(hass, "lovelace", {})
    await hass.async_block_till_done()
    _come_oggi(hass)
    # Si toglie anche l'ultima via: i comandi del websocket.
    for comando in list(hass.data.get("websocket_api") or {}):
        if comando.startswith("lovelace/dashboards/"):
            hass.data["websocket_api"].pop(comando)

    collezione, _plance, modo, dentro = fe._plance_di_lovelace(hass)
    assert collezione is None
    assert modo == "storage"
    # E il registro dice cosa c'era da guardare, che e' l'unica cosa utile.
    assert "dashboards" in dentro

    entry = _voce(hass)
    assert await fe._ensure_companion_dashboard(hass, entry.entry_id) is False

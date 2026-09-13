"""La dashboard di appoggio, provata contro la Lovelace vera.

«Il flag c'e' ma tra le plance non la vedo.»

Le altre prove della dashboard di appoggio usano una collezione finta: dicono
che la plancia chiede la cosa giusta, non che Home Assistant gliela conceda. Fra
le due c'e' esattamente lo spazio in cui una segnalazione come quella puo'
nascere e non farsi vedere da nessun test: basta un campo che Lovelace non
accetta, o una corsa fra due avvii, e la dashboard non nasce — mentre le prove
restano tutte verdi.

Qui la Lovelace e' quella vera, con la sua collezione, il suo magazzino e il suo
registro dei pannelli.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

from homeassistant.setup import async_setup_component

from custom_components.dashboardmodern import frontend as fe


def _voce(hass: Any, *, title: str = "Casa 3.0", options: dict | None = None) -> Any:
    entry = MagicMock()
    # Un identificativo come quelli veri: Home Assistant li fa ULID — lettere
    # fino alla z, non esadecimali. Con un esadecimale finto la forma del
    # nome della dashboard di appoggio non si prova davvero.
    entry.entry_id = "01M2CCTJ3ATSJCFJZ869AW6HMD"
    entry.title = title
    entry.data = {"primary": True}
    entry.options = options or {}
    hass.config_entries.async_get_entry = MagicMock(return_value=entry)

    def _entrate(dominio: str | None = None, **_parole: Any) -> list[Any]:
        # Solo per il proprio dominio: qui Home Assistant e' quello vero, e
        # rispondere «questa plancia» a chiunque chieda vuol dire vederla
        # comparire dentro l'avvio di Lovelace.
        return [entry] if dominio in (None, "dashboardmodern") else []

    hass.config_entries.async_entries = MagicMock(side_effect=_entrate)
    return entry


async def _niente(*_argomenti: Any, **_parole: Any) -> None:
    """Un pezzo dell'avvio che questa prova non guarda."""


def _niente_subito(*_argomenti: Any, **_parole: Any) -> None:
    """Lo stesso, per i pezzi che non si aspettano."""


def _lovelace(hass: Any) -> tuple[Any, Any]:
    dati = hass.data["lovelace"]
    if isinstance(dati, dict):
        return dati["dashboards_collection"], dati["dashboards"]
    return dati.dashboards_collection, dati.dashboards


async def test_la_compagna_nasce_dentro_la_lovelace_vera(hass: Any) -> None:
    """Nasce, si vede nell'elenco delle dashboard, e dentro ha la card."""
    assert await async_setup_component(hass, "lovelace", {})
    await hass.async_block_till_done()
    entry = _voce(hass)

    assert await fe._ensure_companion_dashboard(hass, entry.entry_id) is True
    await hass.async_block_till_done()

    url_path = fe._lovelace_url_path(entry)
    collezione, plance = _lovelace(hass)
    (voce,) = collezione.async_items()
    assert voce["url_path"] == url_path
    assert voce["title"] == "Casa 3.0"
    # Fuori dalla barra: nella barra c'e' gia' il pannello della plancia.
    assert voce["show_in_sidebar"] is False

    # E piena: e' il vuoto che dava «Errore di configurazione».
    salvata = await plance[url_path].async_load(False)
    (vista,) = salvata["views"]
    (card,) = vista["cards"]
    assert card["type"] == "custom:dashboardmodern-card"
    assert card["entry_id"] == entry.entry_id


async def test_un_secondo_avvio_non_ne_crea_una_seconda(hass: Any) -> None:
    """Riavviare non deve aggiungere una voce con lo stesso indirizzo."""
    assert await async_setup_component(hass, "lovelace", {})
    await hass.async_block_till_done()
    entry = _voce(hass)

    assert await fe._ensure_companion_dashboard(hass, entry.entry_id) is True
    await hass.async_block_till_done()
    assert await fe._ensure_companion_dashboard(hass, entry.entry_id) is True
    await hass.async_block_till_done()

    collezione, _plance = _lovelace(hass)
    assert len(collezione.async_items()) == 1


async def test_chi_rinomina_la_plancia_lo_vede_nel_menu_delle_dashboard(
    hass: Any,
) -> None:
    """Il nome nel selettore delle dashboard segue quello della plancia."""
    assert await async_setup_component(hass, "lovelace", {})
    await hass.async_block_till_done()
    entry = _voce(hass)
    assert await fe._ensure_companion_dashboard(hass, entry.entry_id) is True
    await hass.async_block_till_done()

    entry.title = "Casa di Anna"
    assert await fe._ensure_companion_dashboard(hass, entry.entry_id) is True
    await hass.async_block_till_done()

    collezione, _plance = _lovelace(hass)
    (voce,) = collezione.async_items()
    assert voce["title"] == "Casa di Anna"
    assert voce["show_in_sidebar"] is False


async def test_la_compagna_rimessa_nella_barra_ne_esce_al_riavvio(hass: Any) -> None:
    """Due plance identiche nella barra: quella di appoggio deve tornare fuori.

    Rimetterla dentro e' un gesto che si fa in due tocchi dalle impostazioni
    delle dashboard di Home Assistant, e prima restava dentro per sempre.
    """
    assert await async_setup_component(hass, "lovelace", {})
    await hass.async_block_till_done()
    entry = _voce(hass)
    assert await fe._ensure_companion_dashboard(hass, entry.entry_id) is True
    await hass.async_block_till_done()

    collezione, _plance = _lovelace(hass)
    (voce,) = collezione.async_items()
    await collezione.async_update_item(voce["id"], {"show_in_sidebar": True})
    await hass.async_block_till_done()

    assert await fe._ensure_companion_dashboard(hass, entry.entry_id) is True
    await hass.async_block_till_done()
    (voce,) = collezione.async_items()
    assert voce["show_in_sidebar"] is False


async def test_la_compagna_esce_dalla_barra_anche_senza_riavvio(hass: Any) -> None:
    """«Ancora problema, e' comparsa due volte»: dalla barra esce subito.

    La scheda salvata dice «fuori dalla barra», ma chi mette il pannello nella
    barra e' Lovelace, leggendo quel campo al suo avvio: fra la sua lettura e
    la nostra scrittura ci sono passati che non governiamo, e quando uno va
    storto nella barra restano due plance identiche finche' qualcuno non
    riavvia. Qui si guarda il posto che decide davvero — l'elenco dei pannelli
    — e non la casella da cui quel posto e' stato riempito.

    Il pannello deve restarci: l'appoggio si apre ancora, e si sceglie ancora
    come plancia predefinita. Quello che sparisce e' il suo posto nella barra.
    """
    assert await async_setup_component(hass, "lovelace", {})
    await hass.async_block_till_done()
    entry = _voce(hass)
    assert await fe._ensure_companion_dashboard(hass, entry.entry_id) is True
    await hass.async_block_till_done()

    url_path = fe._lovelace_url_path(entry)
    pannelli = hass.data["frontend_panels"]
    pannello = pannelli[url_path]
    # Lovelace l'ha messa nella barra, qualunque sia stata la ragione.
    pannello.sidebar_title = entry.title
    pannello.sidebar_icon = "mdi:view-dashboard-edit"

    assert fe._fuori_dalla_barra(hass, url_path) is True
    rimasto = hass.data["frontend_panels"][url_path]
    assert rimasto.sidebar_title is None
    assert rimasto.sidebar_icon is None
    assert rimasto.component_name == "lovelace"
    assert rimasto.config == pannello.config
    # E una seconda passata non ha niente da togliere.
    assert fe._fuori_dalla_barra(hass, url_path) is False


async def test_il_pannello_della_plancia_resta_nella_barra(hass: Any) -> None:
    """Fuori dalla barra ci va l'appoggio, non la plancia.

    Sono due pannelli con due indirizzi diversi, e il guardiano guarda solo
    quello dell'appoggio: se sbagliasse indirizzo la plancia sparirebbe dalla
    barra, che e' il modo di risolvere «due voci» togliendo quella giusta.
    """
    assert await async_setup_component(hass, "lovelace", {})
    await hass.async_block_till_done()
    entry = _voce(hass)
    assert await fe._ensure_companion_dashboard(hass, entry.entry_id) is True
    await hass.async_block_till_done()

    pannello = fe.PANEL_URL_PATH
    fe._register_or_update_panel(
        hass,
        entry,
        pannello,
        update=True,
        asset_version="x",
        static_url_path="/x",
    )
    assert fe._fuori_dalla_barra(hass, fe._lovelace_url_path(entry)) is False
    assert hass.data["frontend_panels"][pannello].sidebar_title == entry.title


async def test_la_compagna_se_ne_va_con_la_sua_plancia(hass: Any) -> None:
    """Tolta la plancia, la sua dashboard di appoggio non resta sul disco.

    «Ho sempre due volte nella barra laterale», con quattro plance in elenco
    dove di plance ce n'e' una: toglievamo il pannello e basta, e chi
    reinstalla o rinomina se ne accumulava una per volta.
    """
    assert await async_setup_component(hass, "lovelace", {})
    await hass.async_block_till_done()
    entry = _voce(hass)
    assert await fe._ensure_companion_dashboard(hass, entry.entry_id) is True
    await hass.async_block_till_done()

    collezione, _plance = _lovelace(hass)
    assert len(collezione.async_items()) == 1
    assert await fe.async_dimentica_la_compagna(hass, entry) is True
    await hass.async_block_till_done()
    assert collezione.async_items() == []
    # E una seconda volta non ha piu' niente da togliere, senza lamentarsi.
    assert await fe.async_dimentica_la_compagna(hass, entry) is False


async def test_le_compagne_orfane_se_ne_vanno_all_avvio(hass: Any) -> None:
    """Quelle gia' accumulate si spazzano da se', all'avvio.

    Sono le quattro dell'elenco: una per ogni voce mai esistita. Nessuno le
    visita — chi rimette fuori dalla barra una compagna passa dalla voce viva —
    quindi restano, e una finisce nella barra accanto a quella vera.
    """
    assert await async_setup_component(hass, "lovelace", {})
    await hass.async_block_till_done()
    entry = _voce(hass)
    assert await fe._ensure_companion_dashboard(hass, entry.entry_id) is True
    await hass.async_block_till_done()

    collezione, plance = _lovelace(hass)
    viva = fe._lovelace_url_path(entry)
    # La forma del nome deve riconoscere la compagna di una voce VERA. Con un
    # `[0-9a-f]` qui non ne riconoscerebbe nemmeno una, e la spazzata non
    # toglierebbe mai niente a nessuno.
    assert fe._NOME_DELLA_COMPAGNA.match(viva)

    async def _nasce(url_path: str, titolo: str, vista: dict | None) -> None:
        await collezione.async_create_item(
            {
                "allow_single_word": True,
                "title": titolo,
                "url_path": url_path,
                "show_in_sidebar": True,
                "require_admin": False,
            }
        )
        await hass.async_block_till_done()
        if vista is not None:
            await plance[url_path].async_save({"views": [vista]})

    def _nostra(entry_id: str) -> dict:
        return {"cards": [{"type": fe.TIPO_DELLA_CARD, "entry_id": entry_id}]}

    # Due orfane vere: il nostro nome, e dentro la nostra card con
    # l'identificativo di una plancia che non c'e' piu'.
    await _nasce("dashboardmodern-01hvecchi", "DashboardModern", None)
    await _nasce(
        "dashboardmodern-01hvecch", "DashboardModern", _nostra("01HVECCHIADAMORIRE01")
    )
    await _nasce(
        "dashboardmodern-01jz9qtp", "DashboardModern v2", _nostra("01JZ9QTPRIMADIORA02")
    )
    # E due che NON si toccano: una col nostro nome ma con dentro roba di casa,
    # e una fatta a mano che al nostro nome somiglia soltanto.
    await _nasce(
        "dashboardmodern-01kbcdef",
        "La mia",
        {"cards": [{"type": "entities", "entities": ["light.cucina"]}]},
    )
    await _nasce("dashboardmodern-di-casa-mia", "La mia dashboard", None)
    await hass.async_block_till_done()
    assert len(collezione.async_items()) == 6

    assert await fe._spazza_le_compagne_orfane(hass, collezione, plance) == 2
    await hass.async_block_till_done()
    restano = {voce["url_path"] for voce in collezione.async_items()}
    assert restano == {
        viva,
        # Il nome non ha la forma giusta: e' piu' lungo di otto cifre.
        "dashboardmodern-01hvecchi",
        # Dentro c'e' roba di casa, non la nostra card.
        "dashboardmodern-01kbcdef",
        # E questa e' fatta a mano.
        "dashboardmodern-di-casa-mia",
    }
    # E una seconda passata non ha piu' niente da togliere.
    assert await fe._spazza_le_compagne_orfane(hass, collezione, plance) == 0


async def test_una_scheda_gia_sul_disco_non_si_ricrea(hass: Any) -> None:
    """La stessa scheda c'e' gia': crearla di nuovo Lovelace la rifiuta.

    E' quello che succede a ogni riavvio, e il rifiuto non deve lasciare la
    dashboard fuori dal menu delle plance: la scheda c'e', va solo riempita.
    """
    assert await async_setup_component(hass, "lovelace", {})
    await hass.async_block_till_done()
    entry = _voce(hass)
    url_path = fe._lovelace_url_path(entry)
    collezione, plance = _lovelace(hass)
    await collezione.async_create_item(
        {
            "allow_single_word": True,
            "icon": "mdi:view-dashboard-edit",
            "title": "Casa 3.0",
            "url_path": url_path,
            "show_in_sidebar": False,
            "require_admin": False,
        }
    )
    await hass.async_block_till_done()

    # La plancia guarda una mappa che non e' ancora arrivata: e' la corsa
    # dell'avvio, e da li' partiva la creazione di troppo.
    assert fe._la_compagna_e_gia_registrata(collezione, {}, url_path) is True, (
        "la collezione le sue schede le sa sempre, anche prima della mappa"
    )

    assert await fe._ensure_companion_dashboard(hass, entry.entry_id) is True
    await hass.async_block_till_done()
    assert len(collezione.async_items()) == 1
    assert (await plance[url_path].async_load(False))["views"]


async def test_la_plancia_che_parte_prima_di_lovelace_aspetta(
    hass: Any, monkeypatch: Any
) -> None:
    """L'ordine dell'avvio non decide se la dashboard di appoggio nasce.

    Lovelace, mentre parte, mette in `hass.data` la collezione delle dashboard
    prima di leggere dal disco le schede che ci sono: chi guarda in quel momento
    trova una collezione vuota e crea una dashboard che c'e' gia'. La plancia
    non guarda piu' in quel momento — aspetta che Lovelace abbia finito — e
    questa prova fissa proprio l'ordine peggiore: la plancia prima, Lovelace
    dopo.
    """
    # Il pannello e i file statici li provano altre prove: qui interessa solo
    # chi prepara la dashboard di appoggio, e quando.
    monkeypatch.setattr(fe, "_ensure_static_registered", _niente)
    for nome in ("_ensure_dashboard_card_registered", "_register_or_update_panel"):
        monkeypatch.setattr(fe, nome, _niente_subito)
    entry = _voce(hass)
    assert "lovelace" not in hass.config.components

    await fe.async_register_frontend(hass, entry.entry_id)
    await hass.async_block_till_done()

    assert await async_setup_component(hass, "lovelace", {})
    await hass.async_block_till_done()

    url_path = fe._lovelace_url_path(entry)
    collezione, plance = _lovelace(hass)
    (voce,) = collezione.async_items()
    assert voce["url_path"] == url_path
    assert (await plance[url_path].async_load(False))["views"], (
        "e la dashboard e' anche piena: registrata e vuota vuol dire "
        "«Errore di configurazione»"
    )

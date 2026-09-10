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
    """La collezione delle dashboard di Lovelace, quel tanto che serve.

    `async_items` e `async_update_item` sono i due metodi con cui Lovelace fa
    vedere e correggere la scheda di una dashboard — nome, icona, «solo
    amministratori». Sono qui perche' la plancia adesso li usa: creare la
    scheda una volta sola voleva dire il nome vecchio nel menu di Home
    Assistant per sempre.
    """

    def __init__(self, plance: dict, voci: list[dict] | None = None) -> None:
        self.plance = plance
        self.create = []
        self.voci = voci if voci is not None else []
        self.aggiornate: list[tuple[str, dict]] = []

    async def async_create_item(self, voce: dict) -> dict:
        self.create.append(voce)
        self.plance[voce["url_path"]] = _Magazzino()
        self.voci.append({"id": voce["url_path"], **voce})
        return voce

    def async_items(self) -> list[dict]:
        return list(self.voci)

    async def async_update_item(self, item_id: str, cambi: dict) -> dict:
        self.aggiornate.append((item_id, cambi))
        for voce in self.voci:
            if voce.get("id") == item_id:
                voce.update(cambi)
                return voce
        raise KeyError(item_id)


def _lovelace(
    hass: Any, plance: dict | None = None, voci: list[dict] | None = None
) -> dict:
    plance = plance if plance is not None else {}
    dati = {
        "dashboards": plance,
        "dashboards_collection": _Collezione(plance, voci),
    }
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


class _PlanceLente(dict):
    """La mappa `dashboards` che si riempie un giro dopo, come quella vera.

    A riempirla e' un ascoltatore della collezione, non chi crea la scheda:
    all'avvio la si puo' chiedere e trovarla ancora vuota.
    """

    def __init__(self, url_path: str, magazzino: Any) -> None:
        super().__init__()
        self._url_path = url_path
        self._magazzino = magazzino
        self.sbirciate = 0

    def get(self, chiave: str, default: Any = None) -> Any:
        if chiave != self._url_path:
            return super().get(chiave, default)
        self.sbirciate += 1
        return self._magazzino if self.sbirciate > 1 else default


async def test_una_scheda_che_c_e_gia_non_si_crea_una_seconda_volta(
    hass: Any,
) -> None:
    """La scheda c'e', il suo magazzino non e' ancora comparso: non si ricrea.

    Guardare solo la mappa `dashboards` voleva dire crearla di nuovo, e la
    guardia di Lovelace contro i doppioni guarda quella stessa mappa: si
    finiva con due schede sullo stesso indirizzo e due voci con lo stesso nome
    nel menu delle dashboard.
    """
    entry = _voce(hass)
    url_path = fe._lovelace_url_path(entry)
    magazzino = _Magazzino()
    voci = [
        {
            "id": "gia-c-e",
            "url_path": url_path,
            "title": "Casa 3.0",
            "require_admin": False,
            "show_in_sidebar": False,
        }
    ]
    dati = _lovelace(hass, _PlanceLente(url_path, magazzino), voci)

    assert await fe._ensure_companion_dashboard(hass, entry.entry_id) is True
    assert dati["dashboards_collection"].create == []
    assert dati["dashboards_collection"].aggiornate == []
    assert magazzino.salvata["views"], "e la si riempie lo stesso"


async def _niente(*_argomenti: Any, **_parole: Any) -> None:
    """Un pezzo dell'avvio che questa prova non guarda."""


def _niente_subito(*_argomenti: Any, **_parole: Any) -> None:
    """Lo stesso, per i pezzi che non si aspettano."""


async def test_lovelace_a_meta_dell_avvio_non_si_guarda(
    hass: Any, monkeypatch: Any
) -> None:
    """Una collezione che c'e' ma non ha ancora letto il disco non e' una casa
    senza dashboard.

    Lovelace, mentre parte, mette in `hass.data` la collezione delle dashboard
    PRIMA di leggerci dentro le schede che ci sono. Un'integrazione che parte
    nello stesso momento — e questa parte proprio li' — la trovava vuota e
    creava una dashboard di appoggio che sul disco c'era gia'.

    Adesso non si guarda affatto in quel momento: si aspetta che Lovelace abbia
    finito. Qui Lovelace non finisce mai, e infatti non si crea niente.
    """
    monkeypatch.setattr(fe, "_ensure_static_registered", _niente)
    for nome in ("_ensure_dashboard_card_registered", "_register_or_update_panel"):
        monkeypatch.setattr(fe, nome, _niente_subito)
    entry = _voce(hass)
    dati = _lovelace(hass)
    assert "lovelace" not in hass.config.components

    await fe.async_register_frontend(hass, entry.entry_id)
    await hass.async_block_till_done()

    assert dati["dashboards_collection"].create == []


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
    assert vista["cards"][0]["allowed_user_ids"] == ["u1", "u2"]
    # Il permesso sta sulla card e sulla dashboard, NON su un filtro della
    # vista: quella vista e' l'unica che c'e', e filtrarla vuol dire lasciare
    # la dashboard senza niente da mostrare. Chi la tiene come predefinita
    # aprirebbe «Errore di configurazione» a ogni avvio dell'app, mentre la
    # stessa plancia dalla barra laterale funziona.
    assert "visible" not in vista


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


def test_la_card_si_carica_da_un_percorso_che_non_scade() -> None:
    """«Custom element doesn't exist: dashboardmodern-card» (#372).

    L'indirizzo con cui il frontend carica la card se lo porta dentro l'avvio
    della pagina, e l'app companion di Android quell'avvio se lo tiene in cache
    a lungo. Con un indirizzo versionato, dopo un aggiornamento la pagina in
    cache chiedeva la firma vecchia, quel percorso non esisteva piu', e
    l'elemento non veniva mai definito: succedeva sui telefoni con l'app
    installata da tempo e non su uno appena installato, che e' esattamente come
    e' stato descritto.

    Il percorso deve essere quello stabile — c'e' sempre — con la firma nella
    domanda, cosi' una pagina vecchia riceve la card di adesso invece di un 404
    e una nuova non riusa quella in cache.
    """
    url = fe._dashboard_card_module_url("abc123")
    assert url == "/dashboardmodern_static/dashboard-card.js?v=abc123"
    # Il percorso non porta la firma: sarebbe di nuovo un indirizzo che scade.
    assert "/abc123/" not in url
    # Ed e' un percorso che l'integrazione monta davvero, fuori dalla versione.
    assert "dashboard-card.js" in fe.RUNTIME_MOUNTS


async def test_chi_rinomina_la_plancia_rinomina_anche_la_dashboard(hass: Any) -> None:
    """«Rinomino la plancia e nel menu di Home Assistant resta il nome vecchio.»

    La scheda della dashboard di appoggio si scriveva solo alla nascita: al
    riavvio si riscrivevano le viste — quelle si — e la scheda restava com'era.
    Il titolo nel selettore delle dashboard era quindi quello del giorno in cui
    la plancia era stata installata, per sempre. Vale lo stesso per «solo
    amministratori»: chiudere la plancia agli altri non chiudeva la dashboard.
    """
    entry = _voce(hass, title="Casa di Anna", options={"admin_only": True})
    url_path = fe._lovelace_url_path(entry)
    voci = [
        {
            "id": "vecchia",
            "url_path": url_path,
            "title": "Casa 3.0",
            "require_admin": False,
            "show_in_sidebar": False,
        }
    ]
    dati = _lovelace(hass, {url_path: _Magazzino()}, voci)

    assert await fe._ensure_companion_dashboard(hass, entry.entry_id) is True

    collezione = dati["dashboards_collection"]
    assert collezione.create == []
    assert collezione.aggiornate == [
        ("vecchia", {"title": "Casa di Anna", "require_admin": True})
    ]


async def test_la_compagna_finita_nella_barra_ne_esce(hass: Any) -> None:
    """«Perche' nel mio ha ci sono 2 plance Dashboard modern v2?»

    La schermata mostrava una barra laterale con due volte «iPhone Dash»,
    stesso nome e stessa icona. Sono il pannello e la dashboard di appoggio:
    il titolo ce l'hanno uguale per forza — l'appoggio si sceglie per nome nel
    selettore delle dashboard — e l'unica cosa che li teneva distinti era che
    l'appoggio sta FUORI dalla barra.

    Quel «fuori» si scriveva alla nascita e mai piu'. Bastava che una volta
    diventasse «dentro» perche' ci restasse per sempre.
    """
    entry = _voce(hass, title="iPhone Dash")
    url_path = fe._lovelace_url_path(entry)
    voci = [
        {
            "id": "finita-dentro",
            "url_path": url_path,
            "title": "iPhone Dash",
            "require_admin": False,
            "show_in_sidebar": True,
        }
    ]
    dati = _lovelace(hass, {url_path: _Magazzino()}, voci)

    assert await fe._ensure_companion_dashboard(hass, entry.entry_id) is True
    assert dati["dashboards_collection"].aggiornate == [
        ("finita-dentro", {"show_in_sidebar": False})
    ]


async def test_una_compagna_gia_fuori_dalla_barra_non_si_riscrive(hass: Any) -> None:
    """Rimetterla fuori quando e' gia' fuori sarebbe un salvataggio su disco a
    ogni avvio, e un avvio non e' una modifica."""
    entry = _voce(hass, title="iPhone Dash")
    url_path = fe._lovelace_url_path(entry)
    voci = [
        {
            "id": "gia-fuori",
            "url_path": url_path,
            "title": "iPhone Dash",
            "require_admin": False,
            "show_in_sidebar": False,
        }
    ]
    dati = _lovelace(hass, {url_path: _Magazzino()}, voci)

    assert await fe._ensure_companion_dashboard(hass, entry.entry_id) is True
    assert dati["dashboards_collection"].aggiornate == []


async def test_un_avvio_qualunque_non_riscrive_la_scheda(hass: Any) -> None:
    """La collezione salva su disco a ogni aggiornamento: un avvio non lo e'."""
    entry = _voce(hass, title="Casa 3.0")
    url_path = fe._lovelace_url_path(entry)
    voci = [
        {
            "id": "gia-giusta",
            "url_path": url_path,
            "title": "Casa 3.0",
            "require_admin": False,
            "show_in_sidebar": False,
        }
    ]
    dati = _lovelace(hass, {url_path: _Magazzino()}, voci)

    assert await fe._ensure_companion_dashboard(hass, entry.entry_id) is True
    assert dati["dashboards_collection"].aggiornate == []


async def test_una_lovelace_vecchia_non_fa_saltare_l_avvio(hass: Any) -> None:
    """Se la collezione non sa aggiornare, si tira dritto e si riempie lo stesso."""
    entry = _voce(hass)
    url_path = fe._lovelace_url_path(entry)
    plance = {url_path: _Magazzino()}

    class _Vecchia(_Collezione):
        async_update_item = None
        async_items = None

    collezione = _Vecchia(plance)
    hass.data["lovelace"] = {
        "dashboards": plance,
        "dashboards_collection": collezione,
    }

    assert await fe._ensure_companion_dashboard(hass, entry.entry_id) is True
    assert plance[url_path].salvata["views"]


class _MagazzinoTardivo(_Magazzino):
    """Un magazzino che si rilegge, come quello vero."""

    async def async_load(self, _forza: bool) -> dict:
        if self.salvata is None:
            raise RuntimeError("nessuna configurazione")
        return self.salvata


class _CollezioneLenta(_Collezione):
    """Lovelace che costruisce il magazzino un giro di eventi DOPO.

    E' quello che fa davvero: la mappa `dashboards` la riempie un ascoltatore
    della collezione, non chi crea la voce. Chiedere il magazzino nella riga
    dopo la creazione lo trova vuoto.
    """

    async def async_create_item(self, voce: dict) -> dict:
        import asyncio

        self.create.append(voce)
        self.voci.append({"id": voce["url_path"], **voce})

        async def _piu_tardi() -> None:
            await asyncio.sleep(0)
            self.plance[voce["url_path"]] = _MagazzinoTardivo()

        asyncio.get_running_loop().create_task(_piu_tardi())
        return voce


async def test_una_lovelace_che_arriva_tardi_non_lascia_la_dashboard_vuota(
    hass: Any,
) -> None:
    """«Errore di configurazione» quando si mette la plancia come predefinita.

    Una dashboard registrata e mai riempita e' esattamente cio' che Home
    Assistant apre rispondendo «Errore di configurazione», e la risposta resta
    uguale a ogni riavvio: al giro dopo la dashboard c'e' gia', e si ripercorre
    la stessa strada. Qui la collezione costruisce il magazzino un giro dopo,
    come fa quella vera, e la vista deve arrivarci lo stesso.
    """
    plance: dict = {}
    hass.data["lovelace"] = {
        "dashboards": plance,
        "dashboards_collection": _CollezioneLenta(plance),
    }
    _voce(hass)

    assert await fe._ensure_companion_dashboard(hass, "abcdef1234567890") is True
    magazzino = plance["dashboardmodern-abcdef12"]
    assert magazzino.salvata is not None
    assert magazzino.salvata["views"], "la vista deve esserci davvero"


async def test_una_compagna_che_si_rilegge_vuota_lo_dice(hass: Any) -> None:
    """Scrivere e non ricontrollare vuol dire scoprirlo da una segnalazione."""

    class _MagazzinoBugiardo(_Magazzino):
        async def async_load(self, _forza: bool) -> dict:
            return {"views": []}

    plance = {"dashboardmodern-abcdef12": _MagazzinoBugiardo()}
    _lovelace(hass, plance, [{"id": "x", "url_path": "dashboardmodern-abcdef12"}])
    _voce(hass)

    assert await fe._ensure_companion_dashboard(hass, "abcdef1234567890") is False


async def test_la_vista_di_appoggio_non_puo_restare_senza_niente(hass: Any) -> None:
    """Una dashboard con zero viste visibili non si apre: risponde «Errore di
    configurazione», e chi la tiene come predefinita la incontra a ogni avvio.

    La vista di appoggio e' una sola. Qualunque filtro su di lei non riduce
    niente — sotto non c'e' altro — e puo' solo renderla non apribile.
    """
    from custom_components.dashboardmodern.config_flow import OPTION_ALLOWED_USERS

    for ammessi in ([], ["u1"], ["u1", "u2"]):
        entry = _voce(hass, options={OPTION_ALLOWED_USERS: ammessi})
        vista = fe._companion_view(entry, "profilo", True)
        assert vista["cards"], "senza card la dashboard e' vuota lo stesso"
        visibile = vista.get("visible", True)
        assert visibile is True or visibile == [], (
            "un filtro sull'unica vista puo' solo lasciare la dashboard senza "
            f"niente da mostrare (ammessi: {ammessi})"
        )

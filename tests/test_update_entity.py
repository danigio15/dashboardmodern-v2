"""Chi aggiorna deve sapere che c'e' da aggiornare, e senza aspettare due giorni.

HACS costruisce gia' un'entita' di aggiornamento per ogni repository che ha
scaricato, ma un repository *personalizzato* — aggiunto per URL, che e' il modo
in cui si installa questa integrazione — lo ricontrolla su un timer da
quarantotto ore, e non lo guarda affatto all'avvio:

    custom_components/hacs/base.py
        async_track_time_interval(
            hass, self.async_update_downloaded_custom_repositories, timedelta(hours=48)
        )

Quelli dello store predefinito passano da un'altra strada, ogni sei ore. Questo
progetto in quello store non puo' entrare: la validazione dello store pretende
anche i controlli su `topics` e `license`, e la licenza qui e' proprietaria.

Da qui in poi l'avviso lo da' l'integrazione per conto suo. Queste prove
tengono ferme le due cose che lo rendono affidabile: il confronto fra versioni,
e il silenzio quando la rete non c'e'.
"""

from __future__ import annotations

import io
import json
import re
import shutil
import zipfile
from collections.abc import Callable
from pathlib import Path, PurePosixPath

import pytest

ROOT = Path(__file__).resolve().parents[1]
COMPONENT = ROOT / "custom_components/dashboardmodern"
UPDATE = COMPONENT / "update.py"


def _carica_funzioni() -> tuple[
    Callable[..., str], Callable[[str, str], bool], Callable[..., None]
]:
    """Prende le funzioni pure senza tirarsi dietro Home Assistant.

    Il modulo importa `homeassistant.components.update`, che nell'ambiente
    delle prove non c'e'. Ma il confronto fra versioni e lo scambio dei file
    sono aritmetica e disco: si compilano da soli, coi moduli standard che
    usano passati nello spazio dei nomi.
    """
    sorgente = UPDATE.read_text(encoding="utf-8")
    inizio = sorgente.index("def normalize_version")
    fine = sorgente.index("class DashboardModernReleaseCoordinator")
    spazio: dict = {
        "Any": object,
        "io": io,
        "json": json,
        "shutil": shutil,
        "zipfile": zipfile,
        "Path": Path,
        "PurePosixPath": PurePosixPath,
        "DOMAIN": "dashboardmodern",
    }
    exec(compile(sorgente[inizio:fine], str(UPDATE), "exec"), spazio)  # noqa: S102
    return spazio["normalize_version"], spazio["newer"], spazio["installa_da_zip"]


normalize_version, newer, installa_da_zip = _carica_funzioni()


def _zip_di_release(versione: str, **file_extra: str) -> bytes:
    """Uno zip fatto come quello vero: manifest alla radice, file accanto."""
    manifesto = {"domain": "dashboardmodern", "version": versione}
    dati = io.BytesIO()
    with zipfile.ZipFile(dati, "w") as archivio:
        archivio.writestr("manifest.json", json.dumps(manifesto))
        archivio.writestr("__init__.py", f"# {versione}\n")
        for nome, contenuto in file_extra.items():
            archivio.writestr(nome, contenuto)
    return dati.getvalue()


def _cartella_installata(tmp_path: Path) -> Path:
    cartella = tmp_path / "custom_components" / "dashboardmodern"
    cartella.mkdir(parents=True)
    (cartella / "manifest.json").write_text(
        json.dumps({"domain": "dashboardmodern", "version": "1.3.8"})
    )
    (cartella / "vecchio.py").write_text("# resto della versione vecchia\n")
    return cartella


def test_il_v_del_tag_non_conta_come_versione_diversa() -> None:
    """I tag sono `v1.3.3` e il manifest dice `1.3.3`.

    Confrontarli come arrivano annuncerebbe un aggiornamento a ogni controllo,
    per sempre: l'avviso che grida al lupo e' peggio di nessun avviso.
    """
    assert normalize_version("v1.3.3") == "1.3.3"
    assert normalize_version("1.3.3") == "1.3.3"
    assert normalize_version(" v1.3.3 ") == "1.3.3"
    # Una `v` che non introduce un numero e' parte del nome, non un prefisso.
    assert normalize_version("verde") == "verde"
    assert normalize_version(None) == ""
    assert not newer("v1.3.3", "1.3.3")


def test_i_numeri_si_confrontano_da_numeri() -> None:
    """`1.10.0` viene dopo `1.9.0`, che da stringhe verrebbe prima."""
    assert newer("1.10.0", "1.9.0")
    assert not newer("1.9.0", "1.10.0")
    assert newer("1.3.4", "1.3.3")
    assert newer("2.0.0", "1.99.99")
    assert not newer("1.3.3", "1.3.4")


def test_una_beta_resta_dietro_alla_versione_intera() -> None:
    """Chi ha la 1.4.0 non deve vedersi offrire la 1.4.0-beta1."""
    assert not newer("1.4.0-beta1", "1.4.0")
    assert newer("1.4.0", "1.4.0-beta1")


def test_una_versione_illeggibile_non_annuncia_niente() -> None:
    """Nel dubbio si tace: e' l'unica risposta che non fa danni."""
    assert not newer("", "1.3.3")
    assert not newer("1.3.3", "")
    assert not newer("boh", "")


def test_il_controllo_non_scrive_errori_quando_la_rete_non_ce() -> None:
    """Una plancia su una rete senza uscita e' un modo supportato di usarla.

    Quindi un controllo che fallisce non deve riempire il registro ne' far
    diventare l'entita' non disponibile: si tiene l'ultima risposta buona.
    """
    sorgente = UPDATE.read_text(encoding="utf-8")
    assert "_LOGGER.debug" in sorgente
    assert "_LOGGER.error" not in sorgente
    assert "_LOGGER.warning" not in sorgente
    assert "return self._last" in sorgente


def test_si_chiede_col_marchio_della_risposta_di_prima() -> None:
    """`If-None-Match` fa tornare `304`, e un `304` non conta sul limite."""
    sorgente = UPDATE.read_text(encoding="utf-8")
    assert "If-None-Match" in sorgente
    assert "ETag" in sorgente
    assert "answer.status == 304" in sorgente


def test_bozze_e_pre_release_non_diventano_un_avviso() -> None:
    """Una release non pubblicata non e' disponibile per nessuno."""
    sorgente = UPDATE.read_text(encoding="utf-8")
    assert 'payload.get("draft")' in sorgente
    assert 'payload.get("prerelease")' in sorgente


def test_l_installazione_si_fa_da_qui() -> None:
    """Il tasto «Installa» c'e', e installa lo stesso zip che userebbe HACS.

    L'installazione RESTAVA a HACS — «due proprietari della stessa cartella e'
    come nasce un aggiornamento a meta'» — ma cosi' l'aggiornamento finiva fra
    i «non installabili» della pagina di Home Assistant, con una deviazione in
    due passi come unica strada. La paura dei due proprietari si risolve nel
    COME si installa, non rifiutando il tasto: e il come sta nelle prove dello
    scambio qui sotto.
    """
    sorgente = UPDATE.read_text(encoding="utf-8")
    assert "UpdateEntityFeature.RELEASE_NOTES" in sorgente
    assert "UpdateEntityFeature.INSTALL" in sorgente
    # Il riavvio completa, e un secondo «Installa» prima del riavvio si rifiuta.
    assert "_riavvio_richiesto" in sorgente


def test_un_secondo_installa_mentre_il_primo_lavora_si_rifiuta() -> None:
    """Due «Installa» sovrapposti userebbero le stesse cartelle d'appoggio.

    Un'automazione che riprova mentre il primo download e' in corso puo'
    portar via la cartella vecchia proprio mentre il primo ci conta per il
    ripristino. Il segno di lavoro in corso si controlla in testa, e fra il
    controllo e la sua scrittura non c'e' un await: sul loop e' atomico.
    """
    sorgente = UPDATE.read_text(encoding="utf-8")
    assert "if self._attr_in_progress:" in sorgente
    # E il fallimento pubblica subito lo stato ripulito: senza, l'entita'
    # restava «in installazione» col tasto spento fino al giro del coordinator.
    spegnimento = sorgente.index("self._attr_in_progress = False")
    assert "async_write_ha_state" in sorgente[spegnimento : spegnimento + 400]


def test_la_pulizia_della_vecchia_non_boccia_lo_scambio_riuscito() -> None:
    """A rinomini fatti l'installazione e' fatta: la vecchia e' spazzatura.

    Se il disco non la lascia togliere subito, annunciare un fallimento
    spingerebbe a installare di nuovo sopra file gia' nuovi; i residui li
    spazza comunque la testa della funzione, al giro dopo.
    """
    sorgente = UPDATE.read_text(encoding="utf-8")
    assert "shutil.rmtree(vecchia, ignore_errors=True)" in sorgente


def test_lo_zip_buono_prende_il_posto_del_vecchio(tmp_path: Path) -> None:
    """A scambio riuscito restano i file nuovi, e nessuna cartella d'appoggio."""
    cartella = _cartella_installata(tmp_path)
    dati = _zip_di_release("1.3.9", **{"frontend/nuovo.js": "// nuovo\n"})
    installa_da_zip(cartella, dati, "v1.3.9")
    manifesto = json.loads((cartella / "manifest.json").read_text())
    assert manifesto["version"] == "1.3.9"
    assert (cartella / "frontend/nuovo.js").exists()
    assert not (cartella / "vecchio.py").exists()
    residui = sorted(p.name for p in cartella.parent.iterdir())
    assert residui == ["dashboardmodern"]


def test_lo_zip_che_scavalca_la_cartella_non_tocca_niente(tmp_path: Path) -> None:
    """Un archivio con `..` o percorsi assoluti non muove un solo file."""
    cartella = _cartella_installata(tmp_path)
    for nome in ("../fuori.py", "/assoluto.py"):
        dati = io.BytesIO()
        with zipfile.ZipFile(dati, "w") as archivio:
            archivio.writestr(
                "manifest.json",
                json.dumps({"domain": "dashboardmodern", "version": "1.3.9"}),
            )
            archivio.writestr(nome, "# non deve uscire\n")
        try:
            installa_da_zip(cartella, dati.getvalue(), "1.3.9")
        except ValueError:
            pass
        else:  # pragma: no cover - il fallimento atteso e' l'eccezione
            raise AssertionError(f"{nome}: lo zip doveva essere rifiutato")
    assert (cartella / "vecchio.py").exists()
    assert not (tmp_path / "custom_components" / "fuori.py").exists()


def test_lo_zip_sbagliato_viene_rifiutato_prima_di_muovere(tmp_path: Path) -> None:
    """Dominio o versione diversi da quelli promessi: niente scambio."""
    cartella = _cartella_installata(tmp_path)
    sbagliati = [
        _zip_di_release("1.4.0"),  # versione diversa da quella promessa
        b"non uno zip",
    ]
    dati = io.BytesIO()
    with zipfile.ZipFile(dati, "w") as archivio:
        archivio.writestr("manifest.json", json.dumps({"domain": "altro"}))
    sbagliati.append(dati.getvalue())
    for zip_sbagliato in sbagliati:
        try:
            installa_da_zip(cartella, zip_sbagliato, "1.3.9")
        except (ValueError, zipfile.BadZipFile):
            pass
        else:  # pragma: no cover - il fallimento atteso e' l'eccezione
            raise AssertionError("lo zip doveva essere rifiutato")
    assert (cartella / "vecchio.py").exists()
    manifesto = json.loads((cartella / "manifest.json").read_text())
    assert manifesto["version"] == "1.3.8"


def test_il_controllo_gira_piu_spesso_di_hacs() -> None:
    """Mezz'ora contro le quarantotto ore: e' tutta la ragione di esistere."""
    const = (COMPONENT / "const.py").read_text(encoding="utf-8")
    trovato = re.search(r"UPDATE_SCAN_INTERVAL = (.+)", const)
    assert trovato is not None
    assert eval(trovato.group(1)) <= 60 * 60  # noqa: S307


def test_una_sola_voce_anche_con_due_plance() -> None:
    """Due plance sono due pannelli, non due integrazioni da aggiornare."""
    avvio = (COMPONENT / "__init__.py").read_text(encoding="utf-8")
    assert "_primary_entry" in avvio
    assert 'PLATFORMS: list[str] = ["update"]' in avvio
    sorgente = UPDATE.read_text(encoding="utf-8")
    assert 'f"{DOMAIN}_release"' in sorgente


def test_si_puo_spegnere_e_lo_dicono_tutte_le_lingue() -> None:
    """Chi non vuole che la plancia parli con l'esterno deve poterlo impedire."""
    flow = (COMPONENT / "config_flow.py").read_text(encoding="utf-8")
    assert "OPTION_CHECK_UPDATES" in flow
    sorgente = UPDATE.read_text(encoding="utf-8")
    assert "OPTION_CHECK_UPDATES" in sorgente
    lingue = sorted(p.name for p in (COMPONENT / "translations").glob("*.json"))
    assert lingue, "nessuna traduzione trovata"
    for nome in lingue + ["../strings.json"]:
        percorso = (COMPONENT / "translations" / nome).resolve()
        dati = json.loads(percorso.read_text(encoding="utf-8"))
        campi = dati["options"]["step"]["init"]["data"]
        assert "check_updates" in campi, f"{nome} non traduce l'opzione"


def test_l_entita_ha_un_nome_da_mostrare() -> None:
    """Senza un dispositivo l'entita' non aveva un nome da nessuna parte.

    `_attr_name = None` dice «usa il nome del dispositivo», e il dispositivo
    non c'era: la pagina Aggiornamenti ripiegava sull'entity_id — il dialogo
    titolava «update.dashboardmodern_...» e la riga dell'elenco restava
    grigia, senza nome.
    """
    sorgente = UPDATE.read_text(encoding="utf-8")
    assert "DeviceInfo(" in sorgente
    assert "name=NAME" in sorgente
    assert "sw_version=installed" in sorgente


def test_il_riavvio_si_chiede_dal_posto_standard() -> None:
    """La Riparazione col tasto, come HACS — non una notifica da leggere.

    Chi aggiornava da HACS premeva «riavvia» nella Riparazione di Home
    Assistant; il tasto «Installa» lasciava invece una notifica testuale, e
    quel tasto non si trovava piu' da nessuna parte. A installazione riuscita
    si apre la stessa Riparazione, e la conferma riavvia davvero.
    """
    sorgente = UPDATE.read_text(encoding="utf-8")
    assert "async_create_issue" in sorgente
    assert '"riavvio_richiesto"' in sorgente
    assert "persistent_notification" not in sorgente
    riparazioni = (COMPONENT / "repairs.py").read_text(encoding="utf-8")
    assert "async_create_fix_flow" in riparazioni
    assert '"homeassistant", "restart"' in riparazioni
    lingue = sorted((COMPONENT / "translations").glob("*.json"))
    assert lingue
    for percorso in [*lingue, COMPONENT / "strings.json"]:
        dati = json.loads(percorso.read_text(encoding="utf-8"))
        voce = dati["issues"]["riavvio_richiesto"]
        passo = voce["fix_flow"]["step"]["confirm"]
        assert voce["title"], percorso.name
        assert "{version}" in passo["description"], percorso.name


def test_un_estrazione_fallita_non_lascia_una_seconda_integrazione(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Disco pieno a meta' estrazione: la cartella d'appoggio se ne va.

    Restava `.dashboardmodern-nuovo` dentro `custom_components`, col manifest
    di questo stesso dominio: il caricatore di Home Assistant la vedeva come
    una seconda integrazione e al riavvio poteva preferirla a quella vera.
    """
    cartella = _cartella_installata(tmp_path)
    dati = _zip_di_release("1.3.9")

    def esplode(
        self: zipfile.ZipFile, path: str = "", *_a: object, **_k: object
    ) -> None:
        (Path(path) / "manifest.json").write_text("{}")
        raise OSError(28, "No space left on device")

    monkeypatch.setattr(zipfile.ZipFile, "extractall", esplode)
    try:
        installa_da_zip(cartella, dati, "1.3.9")
    except OSError:
        pass
    else:  # pragma: no cover - il fallimento atteso e' l'eccezione
        raise AssertionError("l'estrazione doveva fallire")
    assert sorted(p.name for p in cartella.parent.iterdir()) == ["dashboardmodern"]
    assert (cartella / "vecchio.py").exists()

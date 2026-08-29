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

import json
import re
from collections.abc import Callable
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COMPONENT = ROOT / "custom_components/dashboardmodern"
UPDATE = COMPONENT / "update.py"


def _carica_funzioni() -> tuple[Callable[..., str], Callable[[str, str], bool]]:
    """Prende `normalize_version` e `newer` senza tirarsi dietro Home Assistant.

    Il modulo importa `homeassistant.components.update`, che nell'ambiente
    delle prove non c'e'. Le due funzioni pero' sono pura aritmetica sulle
    stringhe e non toccano nulla: si compilano da sole.
    """
    sorgente = UPDATE.read_text(encoding="utf-8")
    inizio = sorgente.index("def normalize_version")
    fine = sorgente.index("class DashboardModernReleaseCoordinator")
    spazio: dict = {"Any": object}
    exec(compile(sorgente[inizio:fine], str(UPDATE), "exec"), spazio)  # noqa: S102
    return spazio["normalize_version"], spazio["newer"]


normalize_version, newer = _carica_funzioni()


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


def test_l_installazione_resta_a_hacs() -> None:
    """Due proprietari della stessa cartella e' come nasce un aggiornamento a meta'."""
    sorgente = UPDATE.read_text(encoding="utf-8")
    assert "UpdateEntityFeature.RELEASE_NOTES" in sorgente
    assert "UpdateEntityFeature.INSTALL" not in sorgente


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

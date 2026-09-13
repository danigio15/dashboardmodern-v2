"""Il manifest dichiara i componenti di Home Assistant che tocchiamo davvero.

Una riga `from homeassistant.components.X import ...` senza la X nel manifest
e' un errore di hassfest, cioe' CI rossa — ma soprattutto e' una bugia: Home
Assistant decide l'ordine di avvio leggendo quel campo, e se non gli si dice
che ci serve puo' avviarci prima.

`dependencies` vuol dire «senza questo non parto»; `after_dependencies` vuol
dire «se c'e', mettilo su prima di me». Lovelace e' la seconda: la plancia
funziona anche in modo YAML, dove la collezione delle plance non esiste — c'e'
un ramo apposta che lo dice a chi guarda il registro.
"""

from __future__ import annotations

import ast
import json
from pathlib import Path

INTEGRAZIONE = (
    Path(__file__).resolve().parents[1] / "custom_components" / "dashboardmodern"
)


def _componenti_importati() -> set[str]:
    """I componenti di Home Assistant importati dai nostri moduli."""
    trovati: set[str] = set()
    for modulo in sorted(INTEGRAZIONE.glob("*.py")):
        albero = ast.parse(modulo.read_text(encoding="utf-8"))
        for nodo in ast.walk(albero):
            if isinstance(nodo, ast.ImportFrom) and nodo.module:
                pezzi = nodo.module.split(".")
                if pezzi[:2] == ["homeassistant", "components"] and len(pezzi) > 2:
                    trovati.add(pezzi[2])
            elif isinstance(nodo, ast.Import):
                for nome in nodo.names:
                    pezzi = nome.name.split(".")
                    if pezzi[:2] == ["homeassistant", "components"] and len(pezzi) > 2:
                        trovati.add(pezzi[2])
    return trovati


def _senza_dichiarazione() -> set[str]:
    """Cosa si puo' importare senza dichiararlo, secondo hassfest.

    Due famiglie. Le PIATTAFORME — `switch`, `update`, `sensor`… — perche' una
    piattaforma non e' una dipendenza: e' un posto dove l'integrazione mette le
    sue entita', e il nome ce l'ha per forza chi lo fa. E i pezzi interni che
    Home Assistant considera sempre disponibili, come `repairs`, che serve solo
    per avvisare chi guarda.

    La prova del nove e' la pipeline: con `switch`, `update` e `repairs` gia'
    importati hassfest e' sempre passato, e si e' lamentato la prima volta che
    e' comparso `lovelace`.
    """
    import pytest

    pytest.importorskip("homeassistant")
    from homeassistant.const import Platform

    return {piattaforma.value for piattaforma in Platform} | {"repairs"}


def test_ogni_componente_importato_e_dichiarato() -> None:
    """Quello che si importa, si dichiara. E' la regola di hassfest."""
    manifest = json.loads((INTEGRAZIONE / "manifest.json").read_text(encoding="utf-8"))
    dichiarati = set(manifest.get("dependencies", [])) | set(
        manifest.get("after_dependencies", [])
    )
    mancanti = sorted(_componenti_importati() - dichiarati - _senza_dichiarazione())
    assert not mancanti, (
        "questi componenti si importano ma il manifest non li dichiara, e "
        f"hassfest lo bocciera': {mancanti}"
    )


def test_lovelace_e_una_dipendenza_dopo_non_una_prima() -> None:
    """Lovelace serve, ma non e' indispensabile: la plancia parte anche senza.

    Metterlo fra le `dependencies` vorrebbe dire non avviarsi affatto dove
    Lovelace non c'e' — e ci sono case cosi', in modo YAML.
    """
    manifest = json.loads((INTEGRAZIONE / "manifest.json").read_text(encoding="utf-8"))
    assert "lovelace" in manifest.get("after_dependencies", [])
    assert "lovelace" not in manifest.get("dependencies", [])


def test_il_manifest_e_in_ordine() -> None:
    """Dopo `domain` e `name`, le chiavi vanno in ordine alfabetico.

    E' un'altra regola di hassfest, e si scopre solo in CI: una chiave nuova
    infilata in fondo passa le prove e boccia la pipeline.
    """
    chiavi = list(
        json.loads((INTEGRAZIONE / "manifest.json").read_text(encoding="utf-8"))
    )
    assert chiavi[:2] == ["domain", "name"]
    assert chiavi[2:] == sorted(chiavi[2:])

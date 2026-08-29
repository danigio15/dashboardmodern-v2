"""Nessuna passeggiata sul disco dentro l'event loop.

Segnalato con la traccia di Home Assistant 2026.8: «Detected blocking call to
scandir ... inside the event loop by custom integration 'dashboardmodern'».
Non e' un avviso pedante. La cartella del frontend ha centosettanta moduli piu'
il guscio, e mentre il ciclo cammina fra i file nessun'altra integrazione va
avanti: l'avvio di tutta la casa aspetta noi.

Le due operazioni di disco di questo modulo — percorrere la cartella e leggere
i byte per il digest — devono succedere da parte, in un thread, e non nella
funzione asincrona che le chiama. Qui si legge il sorgente e si pretende che
dentro le funzioni `async def` non ci sia nessuna chiamata che tocca il disco
senza passare per l'executor.

Si legge il sorgente invece di far girare Home Assistant perche' il difetto e'
proprio questo: una chiamata che, scritta nel posto sbagliato, funziona
benissimo e rallenta tutti. Non fallisce, quindi non si vede provando.
"""

from __future__ import annotations

import ast
import pathlib

SORGENTE = (
    pathlib.Path(__file__).resolve().parents[1]
    / "custom_components"
    / "dashboardmodern"
    / "frontend.py"
)

# I modi in cui questo file tocca il disco. `rglob` percorre la cartella,
# `read_bytes` e `read_text` leggono un file, `iterdir` e `glob` elencano.
TOCCA_IL_DISCO = frozenset(
    {"rglob", "glob", "iterdir", "read_bytes", "read_text", "scandir", "walk"}
)

# Le funzioni che fanno quel lavoro per mestiere: sono sincrone apposta, e chi
# le chiama deve mandarle nell'executor. Nominarle qui vuol dire che una
# chiamata a una di queste dentro un `async def` e' grave quanto un rglob.
LAVORI_DI_DISCO = frozenset(
    {"_runtime_assets", "_runtime_digest", "_frontend_asset_version"}
)


def _nome_chiamato(nodo: ast.Call) -> str:
    if isinstance(nodo.func, ast.Attribute):
        return nodo.func.attr
    if isinstance(nodo.func, ast.Name):
        return nodo.func.id
    return ""


def _dentro_executor(nodo: ast.AST) -> bool:
    """La chiamata sta dentro un `async_add_executor_job`?"""
    for figlio in ast.walk(nodo):
        if not isinstance(figlio, ast.Call):
            continue
        if _nome_chiamato(figlio) == "async_add_executor_job":
            return True
    return False


def test_le_funzioni_asincrone_non_toccano_il_disco() -> None:
    albero = ast.parse(SORGENTE.read_text(encoding="utf-8"))
    colpevoli: list[str] = []

    for funzione in ast.walk(albero):
        if not isinstance(funzione, ast.AsyncFunctionDef):
            continue
        for nodo in ast.walk(funzione):
            if not isinstance(nodo, ast.Call):
                continue
            nome = _nome_chiamato(nodo)
            if nome not in TOCCA_IL_DISCO and nome not in LAVORI_DI_DISCO:
                continue
            # Dentro un executor va benissimo: e' proprio dove deve stare.
            riga = nodo.lineno
            padre_e_executor = any(
                isinstance(altro, ast.Call)
                and _nome_chiamato(altro) == "async_add_executor_job"
                and altro.lineno <= riga
                and (getattr(altro, "end_lineno", riga) or riga) >= riga
                for altro in ast.walk(funzione)
            )
            if padre_e_executor:
                continue
            colpevoli.append(f"{funzione.name}:{riga} chiama {nome}()")

    assert not colpevoli, (
        "queste chiamate toccano il disco dentro una funzione asincrona, quindi "
        "dentro l'event loop di Home Assistant: mentre girano, tutta la casa "
        "aspetta. Vanno mandate in un thread con "
        "hass.async_add_executor_job.\n  " + "\n  ".join(colpevoli)
    )

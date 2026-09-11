"""Nessuna passeggiata sul disco dentro l'event loop.

Segnalato con la traccia di Home Assistant 2026.8: «Detected blocking call to
scandir ... inside the event loop by custom integration 'dashboardmodern'».
Non e' un avviso pedante. La cartella del frontend ha centosettanta moduli piu'
il guscio, e mentre il ciclo cammina fra i file nessun'altra integrazione va
avanti: l'avvio di tutta la casa aspetta noi.

Le operazioni di disco — percorrere una cartella, leggere i byte per il digest,
aprire un file — devono succedere da parte, in un thread, e non nella funzione
asincrona che le chiama. Qui si legge il sorgente e si pretende che dentro le
funzioni `async def` non ci sia nessuna chiamata che tocca il disco senza
passare per l'executor.

La traccia nominava `frontend.py`, ma la regola non e' di quel file: vale per
tutto il pacchetto, ed e' l'unico modo perche' il difetto non torni da
un'altra porta. Si legge il sorgente invece di far girare Home Assistant
perche' il difetto e' proprio questo: una chiamata che, scritta nel posto
sbagliato, funziona benissimo e rallenta tutti. Non fallisce, quindi non si
vede provando.
"""

from __future__ import annotations

import ast
import pathlib

PACCHETTO = (
    pathlib.Path(__file__).resolve().parents[1]
    / "custom_components"
    / "dashboardmodern"
)

# I modi in cui si tocca il disco. `rglob` percorre la cartella, `read_bytes`
# e `read_text` leggono un file, `iterdir` e `glob` elencano, `stat`, `exists`,
# `is_dir` e `is_file` chiedono al filesystem di un file, e `open`, `mkdir`,
# `write_text`, `write_bytes` e `unlink` ci scrivono sopra.
TOCCA_IL_DISCO = frozenset(
    {
        "rglob",
        "glob",
        "iterdir",
        "listdir",
        "read_bytes",
        "read_text",
        "scandir",
        "walk",
        "stat",
        "exists",
        "is_dir",
        "is_file",
        "open",
        "mkdir",
        "write_text",
        "write_bytes",
        "unlink",
    }
)

# Le funzioni che fanno quel lavoro per mestiere: sono sincrone apposta, e chi
# le chiama deve mandarle nell'executor. Nominarle qui vuol dire che una
# chiamata a una di queste dentro un `async def` e' grave quanto un rglob.
LAVORI_DI_DISCO = frozenset(
    {
        "_runtime_assets",
        "_runtime_digest",
        "_frontend_asset_version",
        "_mounts_on_disk",
        "legacy_variants",
    }
)


def _nome_chiamato(nodo: ast.Call) -> str:
    if isinstance(nodo.func, ast.Attribute):
        return nodo.func.attr
    if isinstance(nodo.func, ast.Name):
        return nodo.func.id
    return ""


def _dentro_executor(funzione: ast.AST, nodo: ast.Call) -> bool:
    """La chiamata sta dentro un `async_add_executor_job`?

    Li' dentro va benissimo: e' proprio dove deve stare. Si guarda per righe
    perche' e' la parentela che conta — la chiamata al disco e' l'argomento
    che l'executor porta nel thread.
    """
    riga = nodo.lineno
    return any(
        isinstance(altro, ast.Call)
        and _nome_chiamato(altro) == "async_add_executor_job"
        and altro.lineno <= riga
        and (getattr(altro, "end_lineno", riga) or riga) >= riga
        for altro in ast.walk(funzione)
    )


def test_le_funzioni_asincrone_non_toccano_il_disco() -> None:
    colpevoli: list[str] = []

    for sorgente in sorted(PACCHETTO.rglob("*.py")):
        albero = ast.parse(sorgente.read_text(encoding="utf-8"))
        dove = sorgente.relative_to(PACCHETTO.parent).as_posix()
        for funzione in ast.walk(albero):
            if not isinstance(funzione, ast.AsyncFunctionDef):
                continue
            for nodo in ast.walk(funzione):
                if not isinstance(nodo, ast.Call):
                    continue
                nome = _nome_chiamato(nodo)
                if nome not in TOCCA_IL_DISCO and nome not in LAVORI_DI_DISCO:
                    continue
                if _dentro_executor(funzione, nodo):
                    continue
                colpevoli.append(
                    f"{dove}:{nodo.lineno} {funzione.name} chiama {nome}()"
                )

    assert not colpevoli, (
        "queste chiamate toccano il disco dentro una funzione asincrona, quindi "
        "dentro l'event loop di Home Assistant: mentre girano, tutta la casa "
        "aspetta. Vanno mandate in un thread con "
        "hass.async_add_executor_job.\n  " + "\n  ".join(colpevoli)
    )

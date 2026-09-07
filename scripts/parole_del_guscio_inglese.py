"""Le parole inglesi del guscio, in un posto solo invece che in una seconda copia.

`legacy/dashboard-runtime-{it,en}.js` sono lo STESSO programma scritto due
volte: 9232 righe contro 9176, identiche al 92%, 465 funzioni con lo stesso nome
su 466 — l'unica in piu' e' `edSaveCosti`, che il guscio inglese non ha mai
avuto. Quello che cambia sono soltanto le parole: i commenti, il testo dentro le
stringhe, le etichette dei pulsanti. Non c'e' una riga di logica che si comporti
in modo diverso. Lo stesso vale per il foglio di stile, il debug, il tema e il
guardiano.

Due copie vogliono dire che ogni aggiornamento del guscio arriva due volte e va
riconciliato due volte, e che un difetto corretto di qua puo' restare di la'.
Qui la copia inglese smette di essere un file e diventa quello che e' davvero:
l'elenco delle sue parole. `--scrivi` lo estrae dalle due copie, `--genera` rifa'
i file inglesi, e la prova `il-guscio-inglese-si-genera` li confronta byte per
byte con quelli vendorizzati.

Non e' una tabella «parola italiana → parola inglese»: quella non basterebbe. La
stessa riga italiana in due punti puo' voler dire due cose diverse
(`editorSwitch('sezioni')` diventa `'sost'` in un posto e `'testi'` in un altro),
e in trentaquattro punti i commenti sono riflowati e le due copie non hanno
nemmeno lo stesso numero di righe. E' un ELENCO ORDINATO di tratti: «dalla riga
N togli queste, metti quelle». Applicato in ordine rifa' il file esatto, e letto
dall'alto e' l'elenco delle parole inglesi del guscio.

Uso:
    python3 scripts/parole_del_guscio_inglese.py --scrivi    # estrae l'elenco
    python3 scripts/parole_del_guscio_inglese.py --genera    # rifa' i file en
    python3 scripts/parole_del_guscio_inglese.py --check     # verifica l'elenco
"""

from __future__ import annotations

import difflib
import io
import json
import sys
from pathlib import Path

RADICE = Path(__file__).resolve().parent.parent
LEGACY = RADICE / "custom_components/dashboardmodern/frontend/legacy"
ELENCO = LEGACY / "parole-del-guscio-en.json"

# Le coppie di file che sono lo stesso programma in due lingue.
COPPIE = (
    ("dashboard-runtime-it.js", "dashboard-runtime-en.js"),
    ("dashboard-runtime-it.css", "dashboard-runtime-en.css"),
    ("dashboard-debug-it.js", "dashboard-debug-en.js"),
    ("dashboard-theme-it.js", "dashboard-theme-en.js"),
    ("dashboard-watchdog-it.js", "dashboard-watchdog-en.js"),
)


def leggi(nome: str) -> str:
    return io.open(LEGACY / nome, encoding="utf-8", newline="").read()


def tratti(testo_it: str, testo_en: str) -> list[dict]:
    """I punti in cui la copia inglese si stacca da quella italiana."""
    a = testo_it.split("\n")
    b = testo_en.split("\n")
    fuori = []
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
        if tag == "equal":
            continue
        fuori.append({"riga": i1, "via": i2 - i1, "metti": b[j1:j2]})
    return fuori


def applica(testo_it: str, cambi: list[dict]) -> str:
    """Rifa' la copia inglese dall'italiana e dall'elenco dei tratti."""
    righe = testo_it.split("\n")
    fuori: list[str] = []
    letto = 0
    for cambio in cambi:
        fuori.extend(righe[letto : cambio["riga"]])
        fuori.extend(cambio["metti"])
        letto = cambio["riga"] + cambio["via"]
    fuori.extend(righe[letto:])
    return "\n".join(fuori)


def costruisci() -> dict:
    fuori = {"generato": "scripts/parole_del_guscio_inglese.py", "file": {}}
    for nome_it, nome_en in COPPIE:
        testo_it = leggi(nome_it)
        testo_en = leggi(nome_en)
        cambi = tratti(testo_it, testo_en)
        rifatto = applica(testo_it, cambi)
        if rifatto != testo_en:
            raise SystemExit(f"{nome_en}: l'elenco non rifa' il file esatto")
        fuori["file"][nome_en] = {"da": nome_it, "cambi": cambi}
    return fuori


def serializza(parole: dict) -> str:
    return json.dumps(parole, ensure_ascii=False, indent=1) + "\n"


def genera() -> int:
    parole = json.loads(io.open(ELENCO, encoding="utf-8").read())
    fatti = 0
    for nome_en, voce in parole["file"].items():
        testo = applica(leggi(voce["da"]), voce["cambi"])
        destinazione = LEGACY / nome_en
        vecchio = ""
        if destinazione.exists():
            vecchio = io.open(destinazione, encoding="utf-8", newline="").read()
        if vecchio != testo:
            io.open(destinazione, "w", encoding="utf-8", newline="").write(testo)
        fatti += 1
    return fatti


def main() -> None:
    if "--genera" in sys.argv:
        print(f"rifatti {genera()} file inglesi dall'elenco delle parole")
        return
    parole = costruisci()
    testo = serializza(parole)
    quanti = sum(len(v["cambi"]) for v in parole["file"].values())
    if "--check" in sys.argv:
        vecchio = io.open(ELENCO, encoding="utf-8").read() if ELENCO.exists() else ""
        if vecchio != testo:
            print(f"stale: {ELENCO}", file=sys.stderr)
            raise SystemExit(1)
        print(f"parole del guscio inglese aggiornate ({quanti} tratti su {len(COPPIE)} file)")
        return
    io.open(ELENCO, "w", encoding="utf-8").write(testo)
    print(f"scritti {quanti} tratti su {len(COPPIE)} file in {ELENCO.name}")


if __name__ == "__main__":
    main()

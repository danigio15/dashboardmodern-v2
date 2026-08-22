"""Le foto che stanno in ``config/www``.

Home Assistant sa elencare le proprie cartelle media, ma non ``config/www``:
non esiste un'API per farlo, e chi tiene li' le foto — che e' quasi chiunque,
perche' e' la cartella servita come ``/local`` — poteva solo scriverne il
percorso a mano. Questa integrazione gira dentro Home Assistant e quella
cartella la puo' leggere.

Il modulo non importa Home Assistant di proposito: legge una cartella e
restituisce un dizionario, e cosi' si puo' provare senza avviare niente.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

# Le immagini che ha senso scegliere per una foto.
IMAGE_SUFFIXES = frozenset(
    {".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".bmp", ".svg"}
)

# Una cartella con migliaia di file non deve diventare un messaggio enorme.
MAX_ENTRIES = 500


def _vuota(available: bool) -> dict[str, Any]:
    """Una risposta senza niente dentro, che dice se la cartella esiste."""
    return {
        "path": "",
        "folders": [],
        "images": [],
        "available": available,
        "truncated": False,
    }


def list_www_folder(root: str, relative: str = "") -> dict[str, Any] | None:
    """Elenca cartelle e immagini sotto ``config/www``.

    Restituisce ``None`` quando il percorso chiesto esce da ``www``: e' l'unico
    modo in cui una richiesta potrebbe leggere qualcosa che non le compete, e va
    fermata qui, non a valle. Il confronto e' sui percorsi *risolti*, cosi' ne'
    un ``..`` ne' un collegamento simbolico portano fuori.

    Una cartella ``www`` che non esiste non e' un errore: e' una casa senza foto
    dentro, e la risposta lo dice con ``available``.
    """
    try:
        base = Path(root).resolve(strict=True)
    except OSError:
        return _vuota(False)
    if not base.is_dir():
        return _vuota(False)

    chiesto = relative.strip("/")
    try:
        target = (base / chiesto).resolve(strict=True) if chiesto else base
    except OSError:
        return None
    if target != base and base not in target.parents:
        return None
    if not target.is_dir():
        return None

    folders: list[dict[str, str]] = []
    images: list[dict[str, str]] = []
    truncated = False
    try:
        with os.scandir(target) as entries:
            for entry in entries:
                # I nomi che cominciano con un punto sono roba di sistema.
                if entry.name.startswith("."):
                    continue
                if len(folders) + len(images) >= MAX_ENTRIES:
                    truncated = True
                    break
                try:
                    path = Path(entry.path).resolve(strict=True)
                except OSError:
                    continue
                if base not in path.parents:
                    continue
                mostrato = path.relative_to(base).as_posix()
                if path.is_dir():
                    folders.append({"name": entry.name, "path": mostrato})
                elif path.suffix.lower() in IMAGE_SUFFIXES:
                    images.append(
                        {
                            "name": entry.name,
                            "path": mostrato,
                            "url": f"/local/{mostrato}",
                        }
                    )
    except OSError:
        return None

    folders.sort(key=lambda item: item["name"].lower())
    images.sort(key=lambda item: item["name"].lower())
    return {
        "path": "" if target == base else target.relative_to(base).as_posix(),
        "folders": folders,
        "images": images,
        "available": True,
        "truncated": truncated,
    }


# ── Il caricamento di una foto in ``config/www`` ─────────────────────────────
#
# La plancia servita dall'integrazione non possiede nessun token: il suo
# WebSocket si autentica lato server. Qualsiasi chiamata REST del browser —
# tipo l'archivio immagini di Home Assistant — risponde percio' 401, ed e'
# l'errore che usciva premendo «Dal dispositivo» nel selettore delle foto.
# L'unico canale autenticato che il frontend ha e' il WebSocket di questa
# integrazione: la foto arriva da li', in base64, e viene scritta nella stessa
# cartella da cui il selettore gia' legge — ``config/www`` — cosi' l'indirizzo
# che ne esce e' un ``/local/`` come quelli scritti a mano.

# Una foto da plancia: 10 MB di file (≈13.4 MB in base64) bastano e avanzano.
MAX_UPLOAD_BYTES = 10 * 1024 * 1024

# La sottocartella dove finiscono i caricamenti, per non sparpagliare.
UPLOAD_FOLDER = "dashboardmodern"

_NOME_BUONO = frozenset("abcdefghijklmnopqrstuvwxyz0123456789._-")


def _sanitize_name(filename: str) -> str:
    """Un nome di file che non puo' uscire dalla cartella ne' sorprendere."""
    base = os.path.basename(str(filename or "")).strip().lower().replace(" ", "-")
    pulito = "".join(ch for ch in base if ch in _NOME_BUONO).lstrip(".")
    return pulito or "foto.png"


def save_www_upload(root: str, filename: str, payload: bytes) -> dict[str, Any] | None:
    """Scrive una foto sotto ``config/www/dashboardmodern`` e ne da' il /local.

    Restituisce ``None`` per un file che non e' un'immagine o e' troppo
    grande: il chiamante lo traduce in un errore parlante. Un nome gia' preso
    non si sovrascrive — si numera, perche' una foto caricata ieri non deve
    sparire sotto quella di oggi.
    """
    nome = _sanitize_name(filename)
    if Path(nome).suffix not in IMAGE_SUFFIXES:
        return None
    if not payload or len(payload) > MAX_UPLOAD_BYTES:
        return None
    base = Path(root)
    cartella = base / UPLOAD_FOLDER
    cartella.mkdir(parents=True, exist_ok=True)
    destinazione = cartella / nome
    contatore = 2
    while destinazione.exists():
        destinazione = cartella / f"{Path(nome).stem}-{contatore}{Path(nome).suffix}"
        contatore += 1
    # La cartella e' appena stata composta da pezzi sanificati, ma il confronto
    # sui percorsi risolti resta: e' la stessa regola della lettura.
    risolta = destinazione.resolve()
    if not str(risolta).startswith(str(base.resolve()) + os.sep):
        return None
    risolta.write_bytes(payload)
    return {"path": f"/local/{UPLOAD_FOLDER}/{destinazione.name}"}

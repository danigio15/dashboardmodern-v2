"""Le immagini per il catalogo dei marchi devono restare pubblicabili.

`dark_icon@2x.png` e' rimasto in repository per mesi con il flusso IDAT
troncato: l'ultimo quinto dell'immagine era spazzatura e il CRC del chunk non
tornava. Nessuno se n'e' accorto perche' i decodificatori indulgenti (Pillow,
`file`) non verificano le checksum e mostrano comunque qualcosa. La CI del
catalogo, invece, le verifica.

Qui si controlla quello che controllerebbe loro: firma, formato, dimensioni e
soprattutto che i byte compressi si srotolino per intero.
"""

from __future__ import annotations

import binascii
import struct
import zlib
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
CARTELLE = (ROOT / "brand", ROOT / "custom_components" / "dashboardmodern" / "brand")

# Regole di https://github.com/home-assistant/brands: le icone sono quadrate e
# di misura esatta, i loghi vincolano il lato corto.
ICONE_ESATTE = {
    "icon.png": (256, 256),
    "icon@2x.png": (512, 512),
    "dark_icon.png": (256, 256),
    "dark_icon@2x.png": (512, 512),
}
LOGHI_LATO_CORTO = {
    "logo.png": (128, 256),
    "logo@2x.png": (256, 512),
}
ATTESI = tuple(ICONE_ESATTE) + tuple(LOGHI_LATO_CORTO)

FIRMA = b"\x89PNG\r\n\x1a\n"


def _chunk(dati: bytes):
    """Percorre i chunk del PNG restituendo (tipo, corpo, crc_corretto)."""
    indice = 8
    while indice + 8 <= len(dati):
        lunghezza = struct.unpack(">I", dati[indice : indice + 4])[0]
        tipo = dati[indice + 4 : indice + 8]
        corpo = dati[indice + 8 : indice + 8 + lunghezza]
        atteso = struct.unpack(">I", dati[indice + 8 + lunghezza : indice + 12 + lunghezza])[0]
        yield tipo, corpo, binascii.crc32(tipo + corpo) & 0xFFFFFFFF == atteso
        indice += 12 + lunghezza
        if tipo == b"IEND":
            break


def _percorsi() -> list[Path]:
    return [cartella / nome for cartella in CARTELLE for nome in ATTESI]


@pytest.mark.parametrize("percorso", _percorsi(), ids=lambda p: f"{p.parent.name}/{p.name}")
def test_immagine_del_marchio_e_integra(percorso: Path) -> None:
    """Il file esiste, e' un PNG valido e i pixel ci sono tutti."""
    assert percorso.is_file(), f"manca {percorso}"
    dati = percorso.read_bytes()
    assert dati[:8] == FIRMA, f"{percorso} non e' un PNG"

    larghezza, altezza, profondita, colore, _, _, interlacciato = struct.unpack(
        ">IIBBBBB", dati[16:29]
    )
    assert (profondita, colore) == (8, 6), f"{percorso}: serve RGBA a 8 bit"
    assert interlacciato == 0, f"{percorso}: il catalogo non vuole PNG interlacciati"

    idat = bytearray()
    for tipo, corpo, crc_ok in _chunk(dati):
        assert crc_ok, f"{percorso}: CRC sbagliato sul chunk {tipo.decode('latin1')}"
        if tipo == b"IDAT":
            idat += corpo

    srotolato = zlib.decompress(bytes(idat))
    assert len(srotolato) == altezza * (larghezza * 4 + 1), (
        f"{percorso}: il flusso compresso non copre tutta l'immagine"
    )


@pytest.mark.parametrize("percorso", _percorsi(), ids=lambda p: f"{p.parent.name}/{p.name}")
def test_misure_accettate_dal_catalogo(percorso: Path) -> None:
    """Le misure sono quelle che la CI del catalogo pretende."""
    larghezza, altezza = struct.unpack(">II", percorso.read_bytes()[16:24])
    nome = percorso.name
    if nome in ICONE_ESATTE:
        assert (larghezza, altezza) == ICONE_ESATTE[nome], f"{percorso}: icona fuori misura"
        return
    minimo, massimo = LOGHI_LATO_CORTO[nome]
    corto = min(larghezza, altezza)
    assert minimo <= corto <= massimo, f"{percorso}: lato corto {corto} fuori da {minimo}-{massimo}"


@pytest.mark.parametrize("nome", ATTESI)
def test_le_due_copie_restano_uguali(nome: str) -> None:
    """La copia spedita nel pacchetto non deve divergere da quella canonica."""
    canonica, spedita = (cartella / nome for cartella in CARTELLE)
    assert canonica.read_bytes() == spedita.read_bytes(), f"{nome}: le due copie sono diverse"

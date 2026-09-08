"""Il pannello si registra davvero, con la firma vera di Home Assistant.

Segnalato sul gruppo: «anche io ho qualche problema nell'installazione», e la
risposta di chi l'aveva risolto — «eliminare la riga show_in_sidebar=True nel
file frontend.py». Aveva ragione. Home Assistant quel parametro lo ha aggiunto
nella 2026.3; dalla 2026.2 in giu' la firma e'

    (hass, component_name, sidebar_title, sidebar_icon, frontend_url_path,
     config, require_admin, *, update, config_panel_domain)

e basta. Passarglielo solleva `TypeError: unexpected keyword argument`, il
setup della voce fallisce e l'integrazione non compare. Su una Home Assistant
recente non succede niente, ed e' per questo che a chi sviluppa non risultava:
a restare fuori sono le case ferme a una versione piu' vecchia.

Il difetto vero pero' e' che nessuna prova se ne e' accorta, per quasi tre
settimane. Tutte quelle sul pannello sostituiscono `_register_or_update_panel`
con una funzione finta — servono a guardare COSA le si passa — e una finta
accetta qualunque cosa, compreso un argomento che non esiste. Il pezzo che
tocca Home Assistant per davvero non lo provava nessuno.

Queste due prove chiamano la cosa vera: una la registra e guarda che il
pannello ci sia, l'altra confronta la nostra chiamata con la firma
dichiarata da questa versione di Home Assistant. La seconda esiste perche' la
prima passerebbe anche se domani aggiungessimo un argomento che questa
versione accetta e la minima no.
"""

from __future__ import annotations

import ast
import inspect
import textwrap

import pytest

pytest.importorskip(
    "homeassistant", reason="Home Assistant test dependency is not installed"
)

from homeassistant.components import frontend
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.dashboardmodern import frontend as frontend_module
from custom_components.dashboardmodern.const import DOMAIN


def _voce(hass: HomeAssistant) -> MockConfigEntry:
    entry = MockConfigEntry(domain=DOMAIN, entry_id="pannello-1", title="Casa 3.0")
    entry.add_to_hass(hass)
    return entry


@pytest.mark.asyncio
async def test_il_pannello_si_registra_per_davvero(hass: HomeAssistant) -> None:
    """Senza nessuna finta di mezzo: si chiama, e il pannello c'e'."""
    entry = _voce(hass)

    frontend_module._register_or_update_panel(
        hass,
        entry,
        "dashboardmodern-pannello",
        update=False,
        asset_version="0123456789abcdef",
        static_url_path="/dashboardmodern-static",
    )

    pannelli = hass.data.get("frontend_panels", {})
    assert "dashboardmodern-pannello" in pannelli
    pannello = pannelli["dashboardmodern-pannello"]
    assert pannello.sidebar_title == "Casa 3.0"
    assert pannello.component_name == "custom"

    # E si aggiorna senza lamentarsi: e' la strada di ogni ricaricamento.
    frontend_module._register_or_update_panel(
        hass,
        entry,
        "dashboardmodern-pannello",
        update=True,
        asset_version="0123456789abcdef",
        static_url_path="/dashboardmodern-static",
    )
    assert "dashboardmodern-pannello" in hass.data.get("frontend_panels", {})


def test_non_si_passano_argomenti_che_home_assistant_non_ha() -> None:
    """Ogni parola che diciamo a Home Assistant, Home Assistant la conosce.

    Si legge la chiamata dal nostro sorgente e la si prova contro la firma
    dichiarata da questa versione: e' il controllo che avrebbe fermato
    `show_in_sidebar` il giorno in cui e' stato scritto.
    """
    albero = ast.parse(
        textwrap.dedent(inspect.getsource(frontend_module._register_or_update_panel))
    )
    nostri: set[str] = set()
    for nodo in ast.walk(albero):
        if not isinstance(nodo, ast.Call):
            continue
        chi = ast.unparse(nodo.func)
        # Solo la chiamata a Home Assistant: `_panel_config(...)` la' dentro ha
        # i suoi argomenti, che sono nostri e non c'entrano con questa firma.
        if not chi.endswith("async_register_built_in_panel"):
            continue
        nostri = {parola.arg for parola in nodo.keywords if parola.arg}
    assert nostri, "la chiamata non si trova piu': la ricerca e' rotta"

    firma = inspect.signature(frontend.async_register_built_in_panel)
    conosciuti = set(firma.parameters)
    sconosciuti = sorted(nostri - conosciuti)
    assert not sconosciuti, (
        "Home Assistant non conosce questi argomenti, e il setup della voce "
        f"fallirebbe con TypeError: {', '.join(sconosciuti)}"
    )

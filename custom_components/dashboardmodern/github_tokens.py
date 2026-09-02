"""I gettoni GitHub di chi usa questa plancia.

Un file suo, e non una colonna in piu' dentro lo store delle segnalazioni,
perche' quello che c'e' qui e' di natura diversa: sono credenziali. Hanno una
vita loro — si ottengono, si revocano, scadono — e mescolarle ai ticket
avrebbe voluto dire che ogni lettura dell'elenco passava sopra un segreto.

Tre regole, e sono tutte e tre sul confine di questo file.

* **Uno per utente di Home Assistant, non uno per casa.** Chi apre una
  segnalazione la apre a suo nome, e la risposta del manutentore arriva a lui.
  In una casa con quattro persone sarebbe sbagliato che le segnalazioni di
  tutti comparissero sotto l'account di chi ha installato l'integrazione.
* **Il gettone non torna mai indietro verso il browser.** Da qui esce
  ``describe()``, che dice chi ha autorizzato e se e' lui a tenere la
  repository. Il gettone lo legge solo il codice che chiama GitHub.
* **Si dimentica quando si vuole.** Revocarlo su GitHub e' un gesto che si fa
  su GitHub; toglierlo di qui e' un gesto che si fa di qui, e sono due cose
  diverse che vanno potute fare separatamente.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from .const import DOMAIN

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

STORAGE_KEY = f"{DOMAIN}.github"
STORAGE_VERSION = 1
DATA_TOKEN_STORE = "github_token_store"


class GitHubTokenStore:
    """Chi ha autorizzato GitHub, su questa installazione."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Aggancia il deposito a quello di Home Assistant."""
        from homeassistant.helpers.storage import Store

        self.hass = hass
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self._data: dict[str, Any] = {"users": {}}
        self._loaded = False

    async def async_load(self) -> None:
        """Leggi il file una volta sola."""
        if self._loaded:
            return
        stored = await self._store.async_load()
        if isinstance(stored, dict):
            users = stored.get("users")
            self._data = {"users": users if isinstance(users, dict) else {}}
        self._loaded = True

    async def _async_save(self) -> None:
        await self._store.async_save(self._data)

    def _users(self) -> dict[str, Any]:
        users = self._data.setdefault("users", {})
        if not isinstance(users, dict):  # pragma: no cover - file manomesso
            users = {}
            self._data["users"] = users
        return users

    def token(self, user_id: str) -> str:
        """Il gettone di questo utente, o stringa vuota."""
        voce = self._users().get(str(user_id))
        if not isinstance(voce, dict):
            return ""
        return str(voce.get("token") or "")

    def any_token(self) -> str:
        """Un gettone qualsiasi, per le letture che non sono di nessuno.

        Rileggere lo stato di una issue non richiede di essere qualcuno: la
        repository e' pubblica. Un gettone pero' alza il limite orario da
        sessanta richieste a cinquemila, e per il giro periodico e' la
        differenza fra funzionare e non funzionare in una casa con dieci
        segnalazioni aperte.
        """
        for voce in self._users().values():
            if isinstance(voce, dict) and voce.get("token"):
                return str(voce["token"])
        return ""

    def describe(self, user_id: str) -> dict[str, Any]:
        """Chi ha autorizzato, senza il gettone. E' quello che vede il browser."""
        voce = self._users().get(str(user_id))
        if not isinstance(voce, dict) or not voce.get("token"):
            return {"connected": False, "login": "", "maintainer": False}
        return {
            "connected": True,
            "login": str(voce.get("login") or ""),
            "maintainer": bool(voce.get("maintainer")),
        }

    def is_maintainer(self, user_id: str) -> bool:
        """Se questo utente puo' scrivere sulla repository della plancia."""
        voce = self._users().get(str(user_id))
        return bool(
            isinstance(voce, dict) and voce.get("token") and voce.get("maintainer")
        )

    def maintainer_token(self) -> str:
        """Il gettone di chi tiene la repository, se su questa casa ce n'e' uno."""
        for voce in self._users().values():
            if isinstance(voce, dict) and voce.get("maintainer") and voce.get("token"):
                return str(voce["token"])
        return ""

    async def async_remember(
        self, user_id: str, *, token: str, login: str, maintainer: bool
    ) -> dict[str, Any]:
        """Conserva il gettone appena ottenuto, e torna cosa puo' vedere il browser."""
        self._users()[str(user_id)] = {
            "token": token,
            "login": login,
            "maintainer": bool(maintainer),
        }
        await self._async_save()
        return self.describe(user_id)

    async def async_forget(self, user_id: str) -> bool:
        """Dimentica il gettone di questo utente.

        Non lo revoca su GitHub: quello si fa da GitHub, e dirlo e' compito di
        chi disegna la finestra. Qui sparisce da Home Assistant, che e' la
        meta' del gesto che questo file puo' compiere davvero.
        """
        if str(user_id) not in self._users():
            return False
        del self._users()[str(user_id)]
        await self._async_save()
        return True


async def async_get_token_store(hass: HomeAssistant) -> GitHubTokenStore:
    """Il deposito dei gettoni, caricato una volta sola."""
    domain_data: dict[str, Any] = hass.data.setdefault(DOMAIN, {})
    store = domain_data.get(DATA_TOKEN_STORE)
    if store is None:
        store = GitHubTokenStore(hass)
        domain_data[DATA_TOKEN_STORE] = store
    await store.async_load()
    return store

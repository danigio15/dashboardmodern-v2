"""Constants for the DashboardModern integration."""

from __future__ import annotations

DOMAIN = "dashboardmodern"
NAME = "DashboardModern v2"

# Where the releases are published, and where the update entity goes looking.
REPOSITORY = "danigio15/dashboardmodern-v2"
RELEASES_URL = f"https://api.github.com/repos/{REPOSITORY}/releases/latest"

# Lo zip che ogni release pubblica: lo stesso identico file che installerebbe
# HACS (hacs.json: zip_release). Il tasto «Installa» scarica questo.
RELEASE_ASSET = "dashboardmodern.zip"

# Half an hour. HACS gives a custom repository — one added by URL, which is how
# this integration is installed — forty-eight hours, and does not even look at
# startup; six hours is what the default store gets, and this project cannot
# join it. Thirty minutes means a release published in the morning is announced
# the same morning, and it costs two requests an hour against a GitHub limit of
# sixty, minus the ones that come back `304 Not Modified` and do not count.
UPDATE_SCAN_INTERVAL = 30 * 60

# Chi la plancia la tiene su una rete senza uscita puo' spegnere il controllo.
OPTION_CHECK_UPDATES = "check_updates"

# ─── Segnalazioni ────────────────────────────────────────────────────────────
#
# Le segnalazioni aperte dalla plancia diventano issue di questa stessa
# repository, aperte a nome di chi le scrive.
#
# La strada e' questa e non un servizio di mezzo per una ragione che sta a
# monte: **la plancia si scarica da HACS, e HACS un account GitHub lo chiede
# gia'**. Chiede anche la stessa identica autorizzazione — il codice da
# digitare su github.com/login/device — quindi chi ha la plancia installata
# quel giro l'ha gia' fatto una volta, e lo riconosce. Un relay in mezzo
# avrebbe voluto dire un servizio da tenere in piedi, un segreto da custodire
# e una superficie da difendere dagli abusi, per raggiungere persone che su
# GitHub ci sono gia' tutte.
#
# In cambio c'e' una cosa da dire chiaramente, e la plancia la dice prima di
# spedire: una issue e' una pagina pubblica. Chi apre una segnalazione la
# pubblica a suo nome, e chiunque puo' leggerla.

# L'applicazione che chiede l'autorizzazione: la GitHub App «DashboardModern
# Segnalazioni», di @danigio15, con il solo permesso *Issues: Read and write*.
#
# Il `client_id` e' pubblico per progetto — nel device flow non esiste un
# `client_secret` da spedire, e infatti questo stesso identificativo compare
# nella pagina pubblica dell'App — quindi sta qui, in chiaro, e non fra i
# segreti. Non c'e' nessuna chiave privata da nessuna parte: quella servirebbe
# per autenticarsi *come* l'App, e qui non succede mai. Si parla sempre e solo
# a nome di chi ha autorizzato.
#
# Vuoto vuol dire che l'autorizzazione non e' configurata: le segnalazioni si
# scrivono e restano in casa, e la plancia lo dice invece di offrire un tasto
# che non spedisce niente.
GITHUB_CLIENT_ID = "Iv23libQr1HSkyvzG9SO"

# Il permesso da chiedere, e resta vuoto perche' l'App e' una GitHub App: i
# permessi li porta lei, e sono i suoi soli. Un'applicazione OAuth avrebbe
# chiesto `public_repo`, che e' molto piu' largo — scrittura su TUTTE le
# repository pubbliche di chi autorizza, per aprire una segnalazione. E' la
# ragione per cui si e' scelta la App.
GITHUB_SCOPE = ""

# Dove il device flow chiede e ritira l'autorizzazione.
GITHUB_DEVICE_CODE_URL = "https://github.com/login/device/code"
GITHUB_DEVICE_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_API = "https://api.github.com"

# La riga invisibile che marca una issue come nata dalla plancia. Serve alla
# console per ritrovarle: le etichette non vanno bene, perche' GitHub le
# scarta quando a scriverle e' qualcuno che sulla repository non ha i permessi
# — cioe' esattamente chi apre le segnalazioni.
TICKET_MARKER = "<!-- plancia:v1 -->"

# Ogni quanto la plancia riprova le consegne rimaste indietro e va a vedere se
# qualcuno ha risposto. Mezz'ora, la stessa cadenza del controllo
# aggiornamenti: chi apre una segnalazione la vede partire subito — la
# consegna viene tentata all'istante — e questo giro serve al resto.
TICKET_SYNC_INTERVAL = 30 * 60

# Quante issue si vanno a rileggere in un giro. Un tetto perche' il giro non
# diventi lungo quanto la storia di chi usa la plancia da due anni.
TICKET_SYNC_BATCH = 20

# Chi non vuole che la plancia parli con nessuno fuori di casa lo spegne, e le
# segnalazioni restano una cosa fra lui e il suo Home Assistant.
OPTION_TICKETS_ENABLED = "tickets_enabled"

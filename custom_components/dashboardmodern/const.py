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
# Dove le segnalazioni aperte dalla plancia vanno a finire. Vuoto vuol dire
# «da nessuna parte»: il ticket si scrive, si conserva e si rilegge in casa,
# ma non parte — e la plancia lo dice invece di far finta di aver spedito.
#
# Va riempito con l'indirizzo del relay quando c'e', e finche' resta vuoto
# l'integrazione non prova a contattare nessuno: nessuna richiesta in uscita,
# nessun errore ripetuto nel registro.
TICKET_RELAY_URL = ""

# Ogni quanto la plancia prova a consegnare le bozze e a chiedere che fine
# hanno fatto i ticket gia' partiti. Mezz'ora e' la stessa cadenza del
# controllo aggiornamenti: chi apre una segnalazione la vede partire subito —
# la consegna viene tentata all'istante — e questo giro serve solo a
# recuperare quello che era andato storto e a portare a casa le risposte.
TICKET_SYNC_INTERVAL = 30 * 60

# Chi non vuole che la plancia parli con nessuno fuori di casa lo spegne, e le
# segnalazioni restano una cosa fra lui e il suo Home Assistant.
OPTION_TICKETS_ENABLED = "tickets_enabled"

# L'indirizzo del relay, se questa installazione ne usa uno diverso da quello
# di serie. Serve alle prove e a chi ospita il proprio.
OPTION_TICKET_ENDPOINT = "ticket_endpoint"

# La chiave che apre la console del manutentore. Sta nelle opzioni del config
# entry — non nella configurazione condivisa, che ogni utente della plancia
# puo' leggere — e non lascia mai il backend: il browser chiede la coda, il
# backend la va a prendere.
OPTION_MAINTAINER_TOKEN = "maintainer_token"

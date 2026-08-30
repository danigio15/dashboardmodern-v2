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

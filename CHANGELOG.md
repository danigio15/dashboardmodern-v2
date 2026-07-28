# Changelog

## 0.13.0 — 2026-07-28

- Introduced the canonical DashboardStore, schema v2 migration and targeted reactive render coordination.
- Unified device names/visuals, appliance/camera CRUD, section visibility, stable room references and the energy editor model.
- Removed room lifecycle controls from the Lights editor.

## 0.12.6 — 2026-07-28

- Corrette le virgolette non bilanciate nell'HTML generato dall'editor stanze
  che impedivano al browser di compilare il JavaScript inline.
- Aggiunti compilazione reale di ogni blocco inline bilingue e test del
  bootstrap con timeout e messaggio di errore al posto dello spinner infinito.

## 0.12.4 — 2026-07-28

- Unificati stanze, elettrodomestici e telecamere sul modello dati vendorizzato usato dall'integrazione.
- Aggiunti tab dinamici per stanza, toggle comandabili e CRUD telecamere sincronizzato con Home Assistant.
- Rimossa la patch runtime caricata in coda e aggiunti test funzionali bilingue del modello.
- Verificata la localizzazione completa IT/EN con un glossario automatico che impedisce regressioni tra le due varianti.
- Collaudati i flussi reali dei renderer vendorizzati e corretti il caricamento del modulo runtime, gli stati a potenza reale e i picker entità mancanti.

Il formato segue [Keep a Changelog](https://keepachangelog.com/it/1.1.0/);
le versioni seguono [Semantic Versioning](https://semver.org/lang/it/).

## 0.12.0 — 2026-07-27

Prima versione candidata al rilascio pubblico.

### Aggiunto

- **Plance multiple**: il config flow chiede il nome e permette più entry;
  ogni plancia ha pannello, storage e chiave di sincronizzazione propri e
  isolati. La prima plancia è *primaria* e mantiene URL e chiave storici
  (migrazione automatica delle installazioni esistenti).
- **Autorilevamento dai registri HA**: piani dal floor registry, aree come
  stanze (col piano), stanza ereditata dall'area per luci, clima e
  telecamere. Non sovrascrive mai le scelte manuali.
- **Motore visibilità navbar**: al primo avvio le sezioni si mostrano solo se
  popolate (plancia nuova = solo Home e Config) e si accendono da sole
  appena ricevono contenuto; interruttore 🟢/⚪ in cima a ogni scheda
  dell'editor; ordinamento linguette da Impostazioni.
- **Editor ristrutturato**: una scheda per ogni sezione (via il vecchio tab
  "Sezioni"), profili EV nella scheda EV con tendina di modifica, viste e
  costi energia nella scheda Energia, Rileva e Reset dentro Impostazioni,
  telecamere unite a Sicurezza, Salva in ogni sezione.
- **Nuove sezioni e funzioni**: Tapparelle (card animate, Apri/Chiudi tutte,
  avvisi cover aperta), Irrigazione (zone sequenziali, orario, salto
  pioggia), Piscina (filtrazione fissa o automatica), profili multi-auto EV,
  viste Energia configurabili, raggruppamento piano→stanza.
- **Diagnostica**: riga di stato in Impostazioni (versione, hosted, bridge,
  token, sync, istanza, primaria, query, chiave in uso).
- **Brand**: nuovo logo generato da `scripts/make_logo.py` (icona app,
  icone HACS/brands, lockup con wordmark).
- Suite di regressione Node per il motore navbar eseguita sul file
  vendorizzato; test Python per i pannelli multi-entry.

### Cambiato

- Tag del custom element versionato per build: classi in cache di build
  precedenti non pilotano più i pannelli nuovi.
- Istanza e flag primaria viaggiano nell'URL dell'iframe (`?dmi=…&dmp=…`),
  a prova di qualunque timing di mount.
- Versione integrazione allineata al frontend (0.12.0).

### Corretto

- Le plance mostravano lo stesso frame (riuso dell'elemento pannello di HA):
  al cambio di entry il frame ora si smonta e rimonta.
- Storage condiviso tra plance per fallback sull'hash del percorso.
- Loop di ricarica su desktop (doppio import sync recintato, auto-update
  legacy disattivato quando ospitato).
- Il Reset lasciava la navbar piena (flag di boot orfano): la derivazione
  riparte da sola quando manca la mappa sezioni.
- Mappe sezioni dei motori precedenti senza le chiavi nuove
  (Elettrodomestici, Tapparelle, Irrigazione, Piscina): migrazione delle
  sole chiavi mancanti.
- Il tab Impostazioni non si apriva; salvataggio profili EV con valori
  digitati ma non confermati.
- La pagina Temperatura restava vuota quando l'autorilevamento aggiungeva
  stanze senza sensore (la prima stanza senza `temp` bloccava il render):
  ora mostra solo le stanze con sensore, raggruppate per piano.
- Gli elettrodomestici finivano tutti in "Altro": l'editor aveva due
  selettori stanza duplicati e il salvataggio leggeva quello sbagliato.
- Le luci rilevate automaticamente non si potevano rinominare né
  eliminare: bottoni ✏️/🗑️ su ogni riga della sezione Luci.
- Nel dettaglio elettrodomestici le entità switch/light/fan hanno ora un
  vero pulsante di accensione/spegnimento.
- Logo ridisegnato: geometria simmetrica centrata al pixel, gradiente
  cielo→blu e saetta ambra nello stile della dashboard, resa a 1024px.

## 0.2.0

### The hosted dashboard never receives a credential

An earlier build of this release handed the hosted dashboard a Home Assistant
access token so its existing bootstrap could use it unchanged. That was wrong:
the hosted page loads three scripts from a public CDN, and any script in a page
can read that page's storage. No token crosses over now. The panel replaces the
hosted document's WebSocket with a shim that forwards a fixed set of message
types through its own authenticated connection, so the hosted page can do
exactly what the dashboard needs and nothing else — a stronger guarantee than a
token, which permits everything its owner can do.

### The dashboard is visible to everyone in the house

The panel no longer requires an administrator account to appear. Every
configuration change already requires admin at the API, so the editor is
protected where it matters instead of by hiding the dashboard from the family.

First release usable as a real dashboard rather than a skeleton.

### The dashboard now installs as an integration

Install from HACS, restart, add the integration, and the panel is in the
sidebar. No HTML file to download and place, no iframe panel to wire up by
hand, and no long-lived token to create and paste: the panel hands the
dashboard an already-authenticated session, so the wizard's connection step is
skipped entirely when a session is present.

Updates arrive as integration updates. The static mount is keyed on a content
digest of every shipped asset, so a new build changes the URL and reaches
browsers on the next load — no hard refresh, no incognito, no version bump
needed to defeat a cache.

### Configuration is shared across devices

Section configuration is stored server-side in Home Assistant, included in
backups and identical on every phone, tablet and browser profile. Concurrent
edits from two devices are detected and refused rather than silently
overwriting each other. Reading is available to any authenticated user;
writing requires an administrator.

### Entities are found and suggested

The integration reads the entity, device and area registries in-process and
proposes rooms and sections. Suggestions are ranked on device class, unit,
naming in Italian or English, device grouping and area, each with the reasons
behind it, and a correction is remembered and outranks everything else the next
time. Weak matches are withheld rather than guessed.

Rooms are configured once and referenced everywhere: renaming or merging rooms
changes every section that groups by them.

### Cards read live state

Cards can bind Home Assistant entities by role. Unbound, missing, unavailable,
unknown and stale are distinguished throughout, and a missing reading is never
rendered as a zero.

- Appliance cards read power and energy as separate roles, each converted from
  its declared unit, and track cycle duration with a configurable tolerance for
  the pauses appliances make mid-cycle.
- Light cards offer exactly the controls the bound light reports supporting and
  show the colour the light reports.

### Fixes carried from the legacy dashboard

- Editing or deleting a camera no longer destroys the whole camera
  configuration.
- The alarm keypad now reaches the configured panel, so the code is actually
  evaluated; a rejected code is reported instead of closing silently; and the
  keypad is shown only when the panel requires a code, with codes longer than
  four digits accepted.
- Appliances keep the room they were assigned instead of collecting under one
  bucket.

### Every section reads live state

Covers, climate, measurements, irrigation valves, cameras, media players,
people, locks, fans, vacuums and vehicles all bind entities and render real
readings. Controls follow what each device reports supporting, so a garage door
is not offered a tilt control and a media player without track skipping does not
show skip buttons.

### Pool water assessment

pH, redox, chlorine, salinity, temperature and filter pressure are assessed
against configurable ranges. Every default can be overridden, because water
chemistry depends on the pool. A missing reading is reported as unknown and
never as fine, and the overall verdict follows the worst reading rather than an
average that would hide it. Filter attention has two independent causes:
pressure above its band, and time since the last backwash.

This reads the numbers a pool reports; it is not advice about water safety, and
anything you intend to swim in is worth confirming with a proper test kit.

### The panel shows the dashboard

Installing the integration and opening the panel shows the dashboard, filling
the panel with no surrounding chrome. The native renderer that the sections
below are built on is development scaffolding, not a second interface, and it
is no longer put in front of anyone.

### Arrange the navigation bar

Sections can be reordered, hidden on one device while kept on another, and up
to three pinned so they stay put while the rest scroll. The arrangement is
stored server-side like everything else, so it is the same on every device. A
newly detected section appears at the end rather than nowhere, and an entry for
a section that no longer exists leaves no dead button behind.

### Long-term statistics

Cards can read Home Assistant's own long-term statistics: consumption over a
window, mean, minimum and maximum, and a comparison against the preceding
window. A meter reset is not counted as negative consumption, and "no previous
data" is reported as unknown rather than as no change. Only entities with a
state class produce statistics, and the editor says so up front instead of
leaving the user to work it out from an empty chart.

### The editor offers instead of asking

Binding an entity used to mean typing `sensor.lavastoviglie_potenza` from
memory into a blank field, and finding out whether you were right by looking at
the card afterwards. Each binding now says what it is for in plain language,
gives a concrete example, and offers the entities the integration ranked for it
— each with the reason it was suggested, so a wrong suggestion can be judged
rather than only overridden. An entity you corrected before is shown as your own
previous choice.

Every field is checked as you fill it: a typo is reported as a missing entity,
the wrong kind of entity says which kind is needed, and an unexpected unit
warns without refusing. The chosen entity's current reading is shown next to
it, because seeing 1900 W while the dishwasher runs is the fastest way to know
you picked the right sensor.

### Existing configuration is imported

Users already running the legacy dashboard hand their browser configuration
over once and it is rewritten into shared storage. The saved token is
deliberately not imported: no token needs to exist any more. The import runs
once, because a second run would silently overwrite anything configured since,
and it reports what crossed over, what had no mapping and what was skipped.

<p align="center">
  <img src="assets/logo@2x.png" alt="DashboardModern" width="420">
</p>

<h1 align="center">DashboardModern</h1>

<p align="center">
  <b>Una plancia smart-home completa, multiutente e responsive per Home Assistant.</b><br>
  Energia · Fotovoltaico · Batteria · EV · Clima · Luci · Sicurezza · Elettrodomestici · Automazioni
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.14.15-0ea5e9" alt="Versione 0.14.15">
  <img src="https://img.shields.io/badge/HACS-custom-41BDF5" alt="HACS custom integration">
  <img src="https://img.shields.io/badge/Home%20Assistant-2025.1%2B-1e3a8a" alt="Home Assistant 2025.1+">
  <img src="https://img.shields.io/badge/UI-Italiano%20%7C%20English-16a34a" alt="Italiano e inglese">
</p>

> **English overview** — DashboardModern is a responsive, multi-instance Home
> Assistant dashboard distributed as a HACS custom integration. Release 0.14.15
> keeps the Energy flow values produced by the canonical Home Assistant render,
> mirrors live `state_changed` events for temperature and appliances, recognises
> canonical `control_entity` mappings, and ships safe-area local brand assets.

---

## Indice

1. [Novità 0.14.15](#novità-01415)
2. [Funzioni principali](#funzioni-principali)
3. [Requisiti](#requisiti)
4. [Installazione con HACS](#installazione-con-hacs)
5. [Aggiornamento](#aggiornamento)
6. [Prima configurazione](#prima-configurazione)
7. [Energia e flussi](#energia-e-flussi)
8. [Report Energia](#report-energia)
9. [Temperature e umidità](#temperature-e-umidità)
10. [Elettrodomestici](#elettrodomestici)
11. [Plance multiple e utenti](#plance-multiple-e-utenti)
12. [Branding Home Assistant e HACS](#branding-home-assistant-e-hacs)
13. [Sicurezza del bridge](#sicurezza-del-bridge)
14. [Risoluzione dei problemi](#risoluzione-dei-problemi)
15. [Sviluppo, test e release](#sviluppo-test-e-release)

## Novità 0.14.15

Questa versione corregge regressioni osservate su una vera installazione Home
Assistant mobile, non soltanto in ambiente simulato.

### Energia

- I valori di **Giornaliera**, **Mensile** e **Annuale** non vengono più
  riscritti dopo il primo rendering da un registro secondario non allineato.
- Il dato già calcolato dalla sorgente canonica rimane stabile durante refresh,
  cambio scheda e aggiornamenti Recorder.
- La protezione copre Casa, Fotovoltaico, Rete e Batteria, inclusi i due versi di
  prelievo/immissione e carica/scarica.
- I contatori cumulativi restano supportati per Report e periodi derivati, ma non
  possono sovrascrivere un valore di flusso già valido mostrato dalla dashboard.

### Temperature

- Temperatura e umidità vengono aggiornate da una sottoscrizione autenticata agli
  eventi `state_changed` di Home Assistant.
- Il runtime mantiene un mirror esatto degli stati reali e aggiorna le card anche
  quando il vecchio registro interno o un override non è ancora pronto.
- Il valore iniziale arriva tramite `get_states`; gli aggiornamenti successivi
  non richiedono ricaricamenti della pagina.

### Elettrodomestici

- `control_entity` è ora un campo canonico anche per il calcolo dello stato.
- Sono riconosciuti anche `state_entity`, `switch_entity`, sensori di potenza in
  W/kW e le entità legacy contenute in `entities`.
- Badge, colore card e pulsante **Accendi/Spegni** seguono lo stato reale.
- Una potenza superiore alla soglia di funzionamento ha precedenza e mostra
  **In funzione**, anche quando il comando binario è temporaneamente in ritardo.

### Branding e documentazione

- Nuova icona HACS/Home Assistant con ampia area di sicurezza trasparente, così
  il simbolo non viene tagliato nelle righe compatte delle Impostazioni.
- Aggiunte variante ad alta densità e logo locale.
- README e changelog sono stati riallineati alla versione pubblica corrente.

## Funzioni principali

- **Più plance indipendenti** per casa, tablet, ospiti o impianti distinti.
- **Pannello laterale e plancia Lovelace** registrati dall'integrazione.
- **Editor visuale** per Energia, EV, Solare, Batteria, Luci, Clima,
  Temperature, Sicurezza, Elettrodomestici, Tapparelle, Irrigazione, Piscina,
  Stanze e Avvisi.
- **Autorilevamento** da aree, piani, dispositivi ed entità Home Assistant.
- **Accesso per utente** configurabile per ogni istanza.
- **Responsive reale** per telefono, tablet, desktop e dispositivi Fold.
- **Italiano e inglese** con dashboard vendorizzate separate.
- **Storico e statistiche a lungo termine** per energia e consumi.
- **Bridge autenticato**: il documento ospitato non riceve un token utilizzabile.

## Requisiti

- Home Assistant con supporto alle integrazioni personalizzate.
- HACS consigliato per installazione e aggiornamenti.
- Recorder attivo quando si vogliono derivare periodi da contatori cumulativi.
- Home Assistant 2026.3 o successivo per usare direttamente gli asset locali
  `brand/icon.png` e `brand/logo.png`; HACS usa comunque l'icona inclusa nel
  repository.

Non servono token salvati manualmente, file in `www/`, risorse Lovelace aggiunte
all'interfaccia o configurazioni YAML per il pannello.

## Installazione con HACS

1. Apri **HACS → Repository personalizzati**.
2. Aggiungi `https://github.com/danigio15/dashboardmodern-v2`.
3. Seleziona la categoria **Integrazione**.
4. Installa l'ultima release di DashboardModern.
5. **Riavvia Home Assistant** quando HACS mostra `Restart required`.
6. Vai in **Impostazioni → Dispositivi e servizi → Aggiungi integrazione**.
7. Cerca **DashboardModern** e assegna un nome alla prima plancia.
8. Apri la nuova voce laterale almeno una volta con un account amministratore.

### Installazione manuale

Copia la cartella:

```text
custom_components/dashboardmodern
```

in:

```text
/config/custom_components/dashboardmodern
```

Riavvia Home Assistant e aggiungi l'integrazione da **Dispositivi e servizi**.

## Aggiornamento

1. Installa la nuova versione da HACS.
2. Riavvia Home Assistant; la sola ricarica del browser non sostituisce il
   riavvio richiesto da un aggiornamento dell'integrazione.
3. Riapri DashboardModern.
4. Se l'app mobile conserva una vecchia pagina, chiudila completamente e
   riaprila. In browser è sufficiente una ricarica completa.
5. Controlla in **Config → Impostazioni** che la versione mostrata corrisponda
   alla release installata.

Le configurazioni delle plance sono mantenute. Non è necessario cancellare
storage, entità o integrazione per un normale aggiornamento.

## Prima configurazione

1. Apri DashboardModern dalla barra laterale.
2. Entra in **Config → Configura entità**.
3. In **Impostazioni**, esegui **Autorilevamento**.
4. Controlla le associazioni proposte prima di salvarle.
5. Configura le **Stanze** con identificativi stabili.
6. Associa luci, temperature ed elettrodomestici alle stanze.
7. Completa **Energia → Flussi ed entità**.
8. Configura eventuali profili EV, telecamere e automazioni.

L'autorilevamento propone valori ma non deve sostituire una scelta manuale già
salvata. Le sezioni senza dati possono essere nascoste dalla navbar.

## Energia e flussi

DashboardModern distingue tre tipi di dato:

| Tipo | Unità tipica | Uso |
|---|---|---|
| Potenza istantanea | W, kW | flussi in tempo reale e stato carichi |
| Energia di periodo | Wh, kWh, MWh | giorno, mese o anno già calcolato |
| Contatore cumulativo | Wh, kWh, MWh con `total`/`total_increasing` | delta ricavati dal Recorder |

### Priorità dei valori

1. Valore canonico già renderizzato per il periodo selezionato.
2. Sensore esplicito giornaliero, mensile o annuale configurato dall'utente.
3. Delta del contatore cumulativo calcolato dalle Long-Term Statistics.
4. `—` quando nessuna sorgente valida è disponibile.

Un sensore in W/kW non viene mai usato come energia. Un contatore lifetime non
viene mostrato direttamente come consumo mensile.

### Configurazione consigliata

Per Casa, Fotovoltaico, Rete e Batteria puoi usare:

- sensori separati già calcolati per giorno/mese/anno; oppure
- un contatore cumulativo con:
  - `device_class: energy`;
  - `state_class: total` o `total_increasing`;
  - unità `Wh`, `kWh` o `MWh`;
  - statistiche a lungo termine disponibili.

Per la Rete configura separatamente prelievo e immissione. Per la Batteria
configura separatamente energia caricata e scaricata.

### Confronto con la dashboard Energia di Home Assistant

I numeri devono essere confrontati sullo stesso periodo e con le stesse entità.
Una piccola differenza di arrotondamento è normale; una differenza stabile di
parecchi kWh indica invece una mappatura o una statistica diversa. La release
0.14.15 impedisce che un refresh secondario cambi un valore inizialmente
corretto.

## Report Energia

Per ciascun elettrodomestico puoi configurare:

- entità di potenza istantanea;
- comando ON/OFF;
- stato separato opzionale;
- energia giornaliera o mensile già calcolata;
- contatore energia totale cumulativo;
- entità per lo storico;
- stanza, tipo, icona o immagine personalizzata.

Il Report seleziona una sorgente energetica valida e usa le statistiche del
Recorder quando deve ricostruire un periodo da un totale cumulativo. Durante il
caricamento non ricade mai sul valore lifetime come se fosse il consumo del
mese.

Le visuali integrate coprono forno, frigorifero, microonde, scaldabagno,
lavatrice, asciugatrice, lavastoviglie, piano cottura, TV e dispositivi generici.

## Temperature e umidità

In **Config → Stanze**, per ogni ambiente indica:

```text
Temperatura: sensor.terrazza_temperature
Umidità:     sensor.terrazza_humidity
```

L'entità deve avere uno stato numerico. Le unità consigliate sono `°C` e `%`.
La dashboard legge lo stato iniziale e resta sottoscritta agli aggiornamenti di
Home Assistant. Una card configurata non deve rimanere su `—` se l'entità è
disponibile in **Strumenti per sviluppatori → Stati**.

Se il sensore di umidità non è indicato, il runtime prova anche la convenzione
`_temperature` → `_humidity`, ma la configurazione esplicita è preferibile.

## Elettrodomestici

### Campi principali

| Campo | Esempio | Funzione |
|---|---|---|
| `control_entity` | `switch.frigo` | comando e stato ON/OFF canonico |
| `state_entity` | `binary_sensor.frigo_running` | stato separato opzionale |
| `power_entity` | `sensor.frigo_power` | consumo istantaneo e rilevamento attività |
| `total_energy_entity` | `sensor.frigo_energy_total` | storico e periodi |
| `room_id` | `room-kitchen` | relazione stabile con la stanza |

### Regole dello stato

- potenza ≥ soglia di funzionamento: **In funzione**;
- comando/stato `on` oppure potenza ≥ soglia standby: **Acceso**;
- altrimenti: **Spento**.

Il pulsante mostra **Spegni** quando l'entità di controllo è `on` e **Accendi**
quando è `off`. Il controllo viene inviato soltanto a domini comandabili come
`switch`, `light`, `input_boolean` e `fan`.

## Plance multiple e utenti

Ogni istanza ha:

- URL e identificativo propri;
- storage isolato;
- voce laterale configurabile;
- plancia Lovelace associata opzionale;
- lista di utenti autorizzati;
- opzione solo amministratori.

Gestisci queste impostazioni da:

**Impostazioni → Dispositivi e servizi → DashboardModern → Configura**.

Una lista utenti vuota consente l'accesso a tutti gli utenti autenticati,
salvo il filtro **Solo amministratori**.

## Branding Home Assistant e HACS

Gli asset sono inclusi in:

```text
custom_components/dashboardmodern/brand/
├── icon.png
├── icon@2x.png
└── logo.png
```

L'icona usa una safe area trasparente ampia per evitare ritagli in HACS,
Riparazioni e Dispositivi e servizi. Dopo l'aggiornamento può essere necessario
riavviare Home Assistant perché le immagini brand vengono memorizzate nella
cache locale.

## Sicurezza del bridge

Il pannello ospita la dashboard legacy in un iframe same-origin, ma non le
consegna una credenziale persistente. Un WebSocket bridge inoltra soltanto un
insieme esplicito di messaggi necessari, tra cui:

- lettura stati;
- sottoscrizione agli eventi;
- chiamate servizio;
- registri aree/dispositivi/entità;
- storico e statistiche Recorder;
- stream e miniature telecamere.

I tipi non autorizzati vengono rifiutati. Il token di Home Assistant resta nel
contesto autenticato del pannello.

## Risoluzione dei problemi

| Sintomo | Controllo |
|---|---|
| HACS mostra `Restart required` | riavvia Home Assistant prima di provare la dashboard |
| Versione vecchia dopo l'update | chiudi e riapri app/browser, poi verifica la versione in Config |
| Energia cambia dopo pochi secondi | assicurati di avere 0.14.15 o successiva; confronta periodo ed entità con HA Energia |
| Totale mensile uguale al lifetime | verifica `state_class`, unità e statistiche del contatore |
| Temperatura su `—` | controlla entity ID e stato numerico in Strumenti per sviluppatori |
| Elettrodomestico acceso mostrato spento | configura `control_entity` e, se disponibile, `power_entity` |
| Pulsante non cambia stato | verifica che l'entità appartenga a un dominio comandabile |
| Icona tagliata | aggiorna, riavvia Home Assistant e ricarica l'app |
| Storico vuoto | verifica che Recorder conservi statistiche per l'entità selezionata |

Per una segnalazione utile includi:

- versione DashboardModern e Home Assistant;
- browser o modello dispositivo;
- screenshot;
- passaggi precisi;
- entity ID coinvolti;
- stato e attributi delle entità, senza dati sensibili.

## Sviluppo, test e release

Struttura principale:

```text
custom_components/dashboardmodern/
├── __init__.py
├── config_flow.py
├── frontend.py
├── manifest.json
├── brand/
└── frontend/
    ├── panel.js
    ├── dashboard-card.js
    ├── src/core/
    ├── src/legacy/
    ├── legacy/
    ├── tests/
    └── e2e/
tests/
```

Comandi di verifica:

```bash
python -m pytest -q
ruff check .
ruff format --check .
npm run check:inline-syntax
npm run test:frontend
npm run test:e2e
```

Una release pubblica viene creata soltanto quando risultano verdi:

- test Python;
- test frontend;
- Browser E2E su tutte le varianti configurate;
- hassfest;
- validazione HACS;
- build del pacchetto `dashboardmodern.zip`.

Il workflow di release legge la versione da `manifest.json`, crea il tag
corrispondente e allega lo ZIP alla GitHub Release.

Consulta [CHANGELOG.md](CHANGELOG.md) per la cronologia completa.

---

<p align="center">Fatto con ⚡ a Napoli · <a href="https://github.com/danigio15/dashboardmodern-v2/issues">Segnala un problema</a></p>

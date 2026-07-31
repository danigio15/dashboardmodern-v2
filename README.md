<p align="center">
  <img src="assets/logo@2x.png" alt="DashboardModern" width="420">
</p>

<h1 align="center">DashboardModern</h1>

<p align="center">
  <b>Una plancia smart-home completa, multiutente e responsive per Home Assistant.</b><br>
  Energia · Fotovoltaico · EV · Clima · Luci · Sicurezza · Tapparelle · Irrigazione · Piscina
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.14.10-0ea5e9">
  <img src="https://img.shields.io/badge/HACS-custom-41BDF5">
  <img src="https://img.shields.io/badge/Home%20Assistant-2025.1%2B-1e3a8a">
</p>

> **English summary** — DashboardModern is a complete Home Assistant dashboard
> distributed as a HACS custom integration. Version 0.14.10 restores cumulative
> energy meters as first-class inputs, derives day/month/year values from Home
> Assistant Long-Term Statistics, fixes appliance icons in the Energy Report,
> rebuilds the Temperature card layout and standardizes editor actions.

---

## Indice

1. [Novità 0.14.10](#novità-01410)
2. [Funzioni principali](#funzioni-principali)
3. [Installazione](#installazione)
4. [Prima configurazione](#prima-configurazione)
5. [Energia: configurazione consigliata](#energia-configurazione-consigliata)
6. [Report Energia ed elettrodomestici](#report-energia-ed-elettrodomestici)
7. [Plancia Home Assistant e preferita](#plancia-home-assistant-e-preferita)
8. [Utenti autorizzati](#utenti-autorizzati)
9. [Editor e sezioni](#editor-e-sezioni)
10. [Responsive e dispositivi pieghevoli](#responsive-e-dispositivi-pieghevoli)
11. [Aggiornamento, cache e diagnostica](#aggiornamento-cache-e-diagnostica)
12. [Sviluppo e test](#sviluppo-e-test)

## Novità 0.14.10

- I **contatori totali cumulativi** tornano disponibili nel Config Energia per
  Casa, Rete, Fotovoltaico e Batteria.
- Da un solo contatore con `state_class: total_increasing` o `total`, la
  dashboard calcola automaticamente giorno, mese corrente, mesi passati e anno
  tramite le Long-Term Statistics di Home Assistant.
- I sensori giornalieri, mensili e annuali restano disponibili come override:
  quando sono configurati hanno precedenza sul contatore totale.
- Il Report preferisce il contatore totale dell'elettrodomestico, così può
  ricostruire correttamente i periodi invece di dipendere da un sensore mensile
  che si azzera.
- Le icone `mdi:*` non vengono più stampate come testo. Il Report usa immagine,
  visuale o glifo coerente con l'elettrodomestico selezionato.
- La card Temperatura è stata ricostruita con una griglia interna stabile: nome,
  icona, temperatura e umidità non si sovrappongono.
- Il simbolo batteria è stato rimosso dal totale consumato degli
  elettrodomestici e sostituito da **∑ Totale**.
- I pulsanti **Aggiungi**, **Salva** e **Annulla** hanno stile e dimensioni
  uniformi in tutto l'editor.

## Funzioni principali

- **Più plance indipendenti**: casa, tablet, ospiti o altri impianti, ciascuna
  con URL, storage, sincronizzazione e impostazioni separati.
- **Plancia nativa Home Assistant**: oltre al pannello laterale, DashboardModern
  registra una plancia Lovelace che compare in **Impostazioni → Plance** e può
  essere scelta come predefinita globale o personale.
- **Accesso per utente**: ogni istanza può essere visibile a tutti oppure a una
  lista precisa di utenti Home Assistant.
- **Editor visuale**: configurazione senza YAML per Energia, EV, Solare,
  Sicurezza, Temperatura, Clima, Luci, Elettrodomestici, Piscina, Irrigazione,
  Tapparelle, Stanze e Avvisi.
- **Autorilevamento**: usa piani, aree, dispositivi ed entità per proporre
  associazioni senza sovrascrivere le scelte manuali.
- **Responsive reale**: griglie fluide, `ResizeObserver`, `visualViewport` e
  ricalcolo al cambio di orientamento o apertura di un dispositivo Fold.
- **Bilingue**: interfaccia italiana e inglese.

## Installazione

### HACS

1. Apri **HACS → Repository personalizzati**.
2. Aggiungi `https://github.com/danigio15/dashboardmodern-v2` come
   **Integrazione**.
3. Installa DashboardModern e riavvia Home Assistant.
4. Vai in **Impostazioni → Dispositivi e servizi → Aggiungi integrazione**,
   cerca DashboardModern e assegna un nome alla plancia.
5. Apri una volta la nuova voce laterale con un account amministratore.

L'ultima apertura crea o aggiorna automaticamente la plancia Lovelace associata.
Non occorrono token, file in `www/` o risorse Lovelace manuali.

### Installazione manuale

Copia `custom_components/dashboardmodern` in
`config/custom_components/dashboardmodern`, riavvia Home Assistant e aggiungi
l'integrazione dall'interfaccia.

## Prima configurazione

1. Apri DashboardModern dalla barra laterale.
2. Entra in **Config → Configura entità**.
3. In **Impostazioni**, avvia **Autorilevamento**.
4. Controlla le associazioni proposte e salva ogni sezione modificata.
5. Configura stanze, luci ed elettrodomestici.
6. Completa **Energia → Flussi ed entità** seguendo la configurazione consigliata
   qui sotto.

La navbar mostra automaticamente le sezioni che contengono dati. Le stanze
senza entità associate non vengono renderizzate nelle relative pagine.

## Energia: configurazione consigliata

### Contatore totale oppure sensori per periodo

Per ogni flusso energetico puoi scegliere una delle due modalità.

**Modalità consigliata — un contatore totale cumulativo**

Inserisci un'entità che:

- misuri energia, normalmente in `Wh`, `kWh` o `MWh`;
- abbia `device_class: energy`;
- abbia `state_class: total_increasing` oppure `total`;
- non sia un sensore di potenza istantanea in `W` o `kW`.

Esempio valido:

```text
sensor.solarman_total_grid_energy
unit_of_measurement: kWh
device_class: energy
state_class: total_increasing
```

Il nome dell'entità può contenere anche la parola `power`, ma sono unità,
`device_class` e `state_class` a determinare se il dato è utilizzabile. Il Config
segnala in rosso un sensore W/kW o non cumulativo.

**Modalità alternativa — sensori già calcolati**

Puoi continuare a indicare entità giornaliere, mensili o annuali. Questi campi
sono override facoltativi e, se compilati, hanno precedenza sul contatore totale
per il relativo periodo.

### Campi totali disponibili

| Gruppo | Campo totale | Periodi derivati automaticamente |
|---|---|---|
| Casa | Contatore totale consumo casa | oggi, mese, anno |
| Rete | Totale energia prelevata | oggi, mese, mesi passati, anno |
| Rete | Totale energia immessa | oggi, mese, mesi passati, anno |
| Fotovoltaico | Totale produzione | oggi, mese, anno |
| Batteria | Totale caricata / scaricata | oggi, mese e analisi storiche |

DashboardModern interroga le statistiche del recorder e usa il delta del
periodo richiesto. Non crea helper e non modifica l'entità originale.

### Valori a zero

Quando il Report resta a zero, verifica in **Strumenti per sviluppatori →
Statistiche** che l'entità non presenti errori e disponga di statistiche a lungo
termine. Controlla inoltre che il contatore non sia espresso in `W` o `kW`.
Dopo aver corretto l'entità, salva nuovamente Energia e riapri il Report.

## Report Energia ed elettrodomestici

Per ciascun elettrodomestico configura, quando disponibili:

- entità di potenza istantanea;
- comando ON/OFF;
- **entità energia totale cumulativa**;
- stanza e visuale.

Il Report sceglie l'entità in questo ordine:

1. entità Report esplicita valida;
2. entità energia totale;
3. altra entità cumulativa `total`/`total_increasing`;
4. entità energia mensile, giornaliera o generica in Wh/kWh.

Un'entità W/kW viene sempre esclusa dai calcoli energetici. Il Report usa
l'immagine configurata oppure una visuale coerente con il tipo: forno,
frigorifero, lavatrice, lavastoviglie, asciugatrice e altri dispositivi non
mostrano più stringhe come `mdi:stove`.

## Plancia Home Assistant e preferita

Ogni istanza genera una plancia Lovelace con URL stabile
`dashboardmodern-<id>`:

1. Apri DashboardModern una volta come amministratore.
2. Vai in **Impostazioni → Plance**.
3. Dal menu della plancia puoi impostarla come predefinita per tutti.
4. Ogni utente può scegliere la propria da **Profilo → Plancia**.

La plancia generata non viene aggiunta automaticamente una seconda volta alla
barra laterale, per evitare il duplicato del pannello DashboardModern.

## Utenti autorizzati

Apri **Impostazioni → Dispositivi e servizi → DashboardModern → Configura**.
Per ciascuna istanza puoi impostare:

- **Utenti autorizzati**: lista precisa degli account ammessi; lista vuota =
  tutti gli utenti autenticati.
- **Registra anche come plancia Home Assistant**.
- **Solo amministratori**: filtro nativo Home Assistant più restrittivo.

Esempio: autorizza Giovanni nella plancia Casa e Donato nella plancia Ospiti,
poi seleziona la rispettiva plancia predefinita nei due profili.

## Editor e sezioni

| Sezione | Funzioni principali |
|---|---|
| Impostazioni | Titolo, navbar, autorilevamento, reset, diagnostica |
| Energia | Contatori totali, flussi, costi, carichi, Report e storico |
| Elettrodomestici | Entità, stanza, soglie, immagini, icone e totale energia |
| Luci | Associazione esplicita alla stanza; stanze vuote nascoste |
| Temperatura | Card senza sovrapposizioni, icona stanza, temperatura e umidità |
| EV | Profili multipli e dati veicolo |
| Sicurezza | Allarme e telecamere WebRTC/HLS/MJPEG |
| Tapparelle | Stato, comandi e avvisi cover aperte |
| Piscina / Irrigazione | Programmi, sensori e automazioni operative |

I comandi principali dell'editor adottano una gerarchia comune:

- **Aggiungi**: azzurro;
- **Salva**: verde;
- **Annulla**: grigio;
- picker entità: pulsante lente separato.

## Responsive e dispositivi pieghevoli

La dashboard distingue automaticamente:

- **compact** fino a 420 px;
- **fold/tablet verticale** da 421 a 820 px;
- **wide** oltre 820 px.

Un `ResizeObserver` ricalcola il layout quando cambia il viewport. Le card
Temperatura usano una griglia interna a due colonne e le immagini degli
elettrodomestici hanno limiti fluidi, quindi il passaggio fra Samsung Galaxy Z
Fold chiuso e aperto non richiede il ricaricamento.

## Aggiornamento, cache e diagnostica

Gli asset frontend sono serviti da un percorso basato sul contenuto. Dopo un
aggiornamento HACS:

1. riavvia Home Assistant;
2. ricarica la pagina o riapri l'app;
3. apri DashboardModern una volta come amministratore.

La scheda Impostazioni mostra versione, bridge, sincronizzazione e identificativo
istanza. In una segnalazione allega versione, dispositivo/browser, screenshot,
passaggi per riprodurre e, per Energia, attributi dell'entità usata.

## Sviluppo e test

```text
custom_components/dashboardmodern/
├── __init__.py
├── config_flow.py
├── frontend.py
└── frontend/
    ├── panel.js
    ├── dashboard-card.js
    ├── src/core/
    ├── src/legacy/
    └── legacy/
tests/
```

Comandi principali:

```bash
python -m pytest
npm run check:inline-syntax
npm run test:frontend
npm run format:check
npm run test:e2e
```

La release viene pubblicata soltanto dopo test Python, frontend, hassfest, HACS
e matrice Browser E2E verdi. Il pacchetto HACS è `dashboardmodern.zip` allegato
alla release GitHub.

Consulta [CHANGELOG.md](CHANGELOG.md) per le modifiche di ogni versione.

---

<p align="center">Fatto con ⚡ a Napoli · <a href="https://github.com/danigio15/dashboardmodern-v2/issues">Segnala un problema</a></p>

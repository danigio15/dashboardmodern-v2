<p align="center">
  <img src="assets/logo@2x.png" alt="DashboardModern" width="420">
</p>

<h1 align="center">DashboardModern</h1>

<p align="center">
  <b>Una plancia smart-home completa e responsive per Home Assistant.</b><br>
  Energia · Fotovoltaico · EV · Clima · Luci · Sicurezza · Tapparelle · Irrigazione · Piscina
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.14.9-0ea5e9">
  <img src="https://img.shields.io/badge/HACS-custom-41BDF5">
  <img src="https://img.shields.io/badge/Home%20Assistant-2025.1%2B-1e3a8a">
</p>

> **English summary** — DashboardModern is a complete Home Assistant dashboard
> distributed as a HACS custom integration. Version 0.14.9 adds a generated
> Lovelace companion dashboard, exact per-user access lists, appliance visuals
> in the Energy Report, reliable light-to-room assignments and adaptive layouts
> for phones, tablets and foldable devices.

---

## Indice

1. [Funzioni principali](#funzioni-principali)
2. [Installazione](#installazione)
3. [Prima configurazione](#prima-configurazione)
4. [Plancia Home Assistant e preferita](#plancia-home-assistant-e-preferita)
5. [Utenti autorizzati](#utenti-autorizzati)
6. [Editor e sezioni](#editor-e-sezioni)
7. [Responsive e dispositivi pieghevoli](#responsive-e-dispositivi-pieghevoli)
8. [Aggiornamento e cache](#aggiornamento-e-cache)
9. [Diagnostica](#diagnostica)
10. [Sviluppo e test](#sviluppo-e-test)

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
  Tapparelle, Stanze, Avvisi e altre sezioni.
- **Autorilevamento**: usa registri di piani, aree, dispositivi ed entità per
  proporre stanze e associazioni senza sovrascrivere le scelte manuali.
- **Responsive reale**: griglie fluide, misure con `clamp()`, `ResizeObserver`,
  `visualViewport` e ricalcolo al cambio di orientamento o apertura di un fold.
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

L'ultima apertura serve a creare o aggiornare automaticamente la plancia
Lovelace associata. Non occorrono token, file in `www/` o risorse Lovelace
manuali.

### Installazione manuale

Copia `custom_components/dashboardmodern` in
`config/custom_components/dashboardmodern`, riavvia Home Assistant e aggiungi
l'integrazione dall'interfaccia.

## Prima configurazione

1. Apri DashboardModern dalla barra laterale.
2. Entra in **Config → Configura entità**.
3. In **Impostazioni**, avvia **Autorilevamento**.
4. Controlla le associazioni proposte e salva ogni sezione modificata.
5. Configura gli elettrodomestici scegliendo stanza, entità e visuale: la stessa
   visuale viene ora ereditata dal Report Energia.

La navbar mostra automaticamente le sezioni che contengono dati. Le sezioni
vuote restano nascoste, salvo una scelta manuale nell'editor.

## Plancia Home Assistant e preferita

Dalla versione 0.14.9 ogni istanza genera una plancia Lovelace con URL stabile
`dashboardmodern-<id>`:

1. Apri DashboardModern una volta come amministratore.
2. Vai in **Impostazioni → Plance**: trovi la plancia col nome dell'istanza.
3. Dal menu della plancia puoi impostarla come predefinita per tutti.
4. Ogni utente può scegliere la propria da **Profilo → Plancia**.

La plancia generata non viene aggiunta automaticamente una seconda volta alla
barra laterale, per evitare il duplicato del pannello DashboardModern. Puoi
abilitarla manualmente dalle impostazioni della plancia.

## Utenti autorizzati

Apri **Impostazioni → Dispositivi e servizi → DashboardModern → Configura**.
Per ciascuna istanza puoi impostare:

- **Utenti autorizzati**: lista precisa degli account ammessi; lista vuota =
  tutti gli utenti autenticati.
- **Registra anche come plancia Home Assistant**: crea e mantiene la plancia
  Lovelace selezionabile come predefinita.
- **Solo amministratori**: filtro nativo Home Assistant, più restrittivo della
  lista utenti.

La visibilità della vista Lovelace segue la lista utenti e il custom element
esegue anche un controllo diretto: un utente escluso non vede i contenuti
neppure aprendo l'URL manualmente.

Esempio: autorizza **Giovanni** nella plancia Casa e **Donato** nella plancia
Ospiti; poi imposta per ciascun profilo la relativa plancia predefinita.

## Editor e sezioni

| Sezione | Funzioni principali |
|---|---|
| Impostazioni | Titolo, navbar, autorilevamento, reset, diagnostica |
| Energia | Flussi, costi, carichi secondari, report e storico |
| Elettrodomestici | Entità, stanza, soglie, immagini e icone |
| Luci | Associazione esplicita alla stanza; le stanze senza luci non sono renderizzate |
| Temperatura | Card compatte con icona stanza leggibile, temperatura e umidità |
| EV | Profili multipli e dati veicolo |
| Sicurezza | Allarme e telecamere WebRTC/HLS/MJPEG |
| Tapparelle | Stato, comandi e avvisi cover aperte |
| Piscina / Irrigazione | Programmi, sensori e automazioni operative |

Il Report Energia usa `report_icon` quando definita; altrimenti deriva l'icona
dalla visuale dell'elettrodomestico, ad esempio `mdi:fridge-outline` per il
frigorifero e `mdi:stove` per il forno.

## Responsive e dispositivi pieghevoli

La dashboard non usa un'unica larghezza “mobile”. Distingue automaticamente:

- **compact** fino a 420 px;
- **fold** da 421 a 760 px;
- **wide** oltre 760 px.

Un `ResizeObserver` ricalcola il layout quando cambia la dimensione reale del
viewport, quindi un Samsung Galaxy Z Fold passa dalla vista chiusa a quella
aperta senza richiedere un ricaricamento. Le immagini degli elettrodomestici e
le card Temperatura usano dimensioni fluide e non provocano scorrimento
orizzontale.

## Aggiornamento e cache

Gli asset frontend sono serviti da un percorso basato sul loro contenuto. A
ogni aggiornamento il percorso cambia, incluse la card Lovelace e tutte le sue
importazioni, evitando che una vecchia build resti nella cache.

Dopo un aggiornamento HACS:

1. riavvia Home Assistant;
2. ricarica la pagina o riapri l'app;
3. apri DashboardModern una volta come amministratore per sincronizzare la
   plancia Lovelace generata.

## Diagnostica

La scheda Impostazioni mostra versione, stato bridge, sincronizzazione,
identificativo istanza e flag primaria. In una segnalazione allega:

- riga diagnostica;
- versione Home Assistant e DashboardModern;
- dispositivo/browser;
- screenshot e passaggi per riprodurre.

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

La release stabile viene pubblicata soltanto dopo test Python, frontend,
hassfest, HACS e matrice Browser E2E verdi. Il pacchetto HACS è
`dashboardmodern.zip` allegato alla release GitHub.

Consulta [CHANGELOG.md](CHANGELOG.md) per le modifiche di ogni versione.

---

<p align="center">Fatto con ⚡ a Napoli · <a href="https://github.com/danigio15/dashboardmodern-v2/issues">Segnala un problema</a></p>

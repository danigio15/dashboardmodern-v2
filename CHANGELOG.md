# Changelog

Il formato segue [Keep a Changelog](https://keepachangelog.com/it/1.1.0/) e le
versioni seguono [Semantic Versioning](https://semver.org/lang/it/).

## 0.14.9 — 2026-07-31

### Aggiunto

- **Plancia Lovelace associata** a ogni istanza DashboardModern. Viene creata
  alla prima apertura amministrativa, compare in **Impostazioni → Plance** e
  può essere scelta come predefinita globale o personale.
- **Selettore utenti autorizzati** nelle opzioni dell'integrazione. La lista è
  applicata sia alla visibilità della vista Lovelace sia al controllo diretto
  del pannello e della custom card.
- Custom card globale `dashboardmodern-card`, caricata dal percorso statico
  versionato dell'integrazione senza configurazione manuale delle risorse.
- Test automatici per creazione plancia, visibilità per utente e derivazione
  delle icone del Report Energia.

### Cambiato

- Report Energia: eredita automaticamente l'icona o la visuale selezionata
  nell'elettrodomestico; frigorifero, forno, lavatrice, lavastoviglie,
  asciugatrice e altri tipi hanno fallback MDI coerenti.
- Nuovo layout della card Temperatura: icona stanza più leggibile, gerarchia
  compatta e griglia `auto-fit` senza spazi inutili.
- Layout responsive basato sulla larghezza effettiva del viewport, con profili
  compact/fold/wide, `ResizeObserver`, `visualViewport` e ricalcolo al cambio
  di orientamento o apertura di un dispositivo pieghevole.
- Immagini e icone degli elettrodomestici ridimensionate con limiti fluidi
  anche sugli smartphone stretti.
- README riscritto e allineato alle funzioni pubbliche della 0.14.9.

### Corretto

- L'associazione manuale di una luce alla stanza ora prevale sempre
  sull'inferenza ricavata dal nome dell'entità.
- Le stanze senza entità luce associate non vengono più mostrate nella pagina
  Luci.
- Le righe del Report con icona vuota vengono riparate usando la visuale
  canonica dell'elettrodomestico.
- Il passaggio fra schermo chiuso e aperto dei dispositivi Fold non lascia più
  card e immagini con le misure del viewport precedente.

## 0.14.8 — 2026-07-30

- Consolidate le regressioni UI reali di Tapparelle, Temperatura, Report,
  Irrigazione e Avvisi.
- Resi verdi HACS, hassfest, test applicativi e Browser E2E completi.
- Introdotto il workflow automatico di release con tag e `dashboardmodern.zip`.

## 0.14.7 — 2026-07-30

- Revisione di coerenza grafica e compatibilità sul runtime Home Assistant
  reale, inclusi desktop, mobile e WebKit/iPad.

## 0.13.4 — 2026-07-28

- Rifinitura finale dell'Editor: Salva Telecamere, Report Energia canonico e
  card Costi uniforme.
- Corretti picker entità persistenti, ricerca icone Stanze, visibilità
  immediata e migrazione Lavatrice.

## 0.13.2 — 2026-07-28

- Unificato l'editor Energia con tab Flussi e Impostazioni.
- Consolidati carichi secondari e voci report in un modello canonico migrato.

## 0.13.0 — 2026-07-28

- Introdotti DashboardStore canonico, migrazione schema v2 e coordinamento dei
  renderer reattivi.
- Unificati nomi/visuali dispositivi, CRUD elettrodomestici e telecamere,
  visibilità sezioni e riferimenti stanza stabili.

## 0.12.0 — 2026-07-27

- Prima candidata pubblica come integrazione HACS con plance multiple,
  autorilevamento dai registri Home Assistant, editor visuale e storage isolato
  per istanza.

/* ═══════════════════════════════════════════════════════════════════
   SMART HOME DASHBOARD — Configurazione avanzata (OPZIONALE)
   
   ⚡ NON TI SERVE QUESTO FILE se usi il Setup Wizard!
   Al primo avvio la dashboard si configura da sola con una procedura
   guidata (token, nome, sezioni, luci) — tutto da interfaccia.
   
   Questo file è per chi preferisce la configurazione testuale.
   Priorità: wizard/editor (localStorage) → config salvata nel file
   (download dall'editor) → questo config.js → default interni.
   
   USO:
   1. Copia questo file come  config.js  (stessa cartella di dashboard.html)
   2. Compila e ricarica la dashboard (Ctrl+Shift+R)
   
   ⚠️ MAI committare config.js su repository pubblici: contiene il token!
   ═══════════════════════════════════════════════════════════════════ */

window.DASHBOARD_CONFIG = {

  /* ── CONNESSIONE ────────────────────────────────────────────────── */
  connection: {
    // Profilo utente HA → Sicurezza → Token di accesso a lunga scadenza
    token: "INCOLLA_QUI_IL_TUO_TOKEN",

    // URL remoto (Nabu Casa o dominio proprio) — facoltativo
    remote_url: "",

    // IP:porta di HA in LAN — facoltativo (default: host corrente)
    local_ip: "",

    // Path Lovelace per il pulsante "Editor Plancia" (esci da kiosk-mode)
    dashboard_path: "/lovelace/0?disable_km="
  },

  /* ── AMMINISTRATORI ─────────────────────────────────────────────
     Utenti HA che vedono la pagina ⚙️ Configurazione (editor, entità, tema).
     Lista vuota [] = visibile a tutti. Match parziale case-insensitive. */
  admin_users: [],   // es. ["mario"]

  /* ── BRANDING ───────────────────────────────────────────────────── */
  branding: {
    title: "Casa Mia",
    subtitle: "Smart Home Dashboard"
  },

  /* ── SEZIONI (false = tab e pagina nascosti) ────────────────────── */
  sections: {
    home: true,        // 🏠 Meteo, avvisi, azioni rapide
    energy: true,      // ⚡ Fotovoltaico, consumi, analisi
    ev: false,         // 🚗 Auto elettrica (EVCC)
    boiler: false,     // 🌞 Solare termico
    clima: true,       // ❄️ Condizionatori + riscaldamento
    temp: true,        // 🌡️ Temperature stanze
    security: false,   // 🛡️ Telecamere + allarme
    server: true       // 🖥️ Monitoraggio MiniPC
  },

  /* ── RIMAPPATURA ENTITÀ ─────────────────────────────────────────
     "entità_riferimento_della_dashboard": "tua_entità"
     Vale ovunque (card, popup, storici, comandi). Più comodo dall'editor
     visuale integrato (⚙️ Configurazione → Configura Entità: autocomplete). */
  entities: {
    // "sensor.speedtest_download": "sensor.mio_download",
    // "alarm_control_panel.casa":  "alarm_control_panel.mio_allarme",
  },

  /* ── LUCI (sostituisce integralmente l'elenco di default) ────────
     "entity_id": "Stanza - Dettaglio"  → raggruppamento automatico */
  luci: {
    // "light.salone":  "Salone - Lampadario",
    // "light.cucina":  "Cucina - Faretti",
  },

  /* ── CARICHI EXTRA (si sommano) ──────────────────────────────────
     Gruppi: cucina, cucina_day, cucina_month, lavanderia, lavanderia_day, lavanderia_month */
  carichi: {
    // cucina: [ { name: "Tostapane", pwr: "sensor.tostapane_power", icon: "🍞" } ],
  },

  /* ── AVVISI EXTRA (si sommano) ───────────────────────────────────
     Gruppi: win (aperture), batt (batterie), luci, clima, risc */
  avvisi: {
    // win: ["binary_sensor.finestra_studio_contact"],
  },
  avvisi_names: {
    // "binary_sensor.finestra_studio_contact": "Finestra Studio",
  },

  /* NOTA TEMA: chiaro/scuro/auto si imposta dalla pagina ⚙️ Configurazione
     (salvato per dispositivo, la modalità Auto segue il tema di sistema). */
};

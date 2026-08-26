/* Il tema scuro possiede anche il fondo.
 *
 * «Scuro» scuriva le card una per una — regole puntuali su schede, barre e
 * popup — ma le fondamenta del tema, le variabili di `:root` da cui il corpo
 * della pagina prende colore, restavano quelle chiare: `--bg-sculpted` e
 * compagnia non avevano mai avuto una versione notturna. Il risultato e' negli
 * screenshot arrivati piu' volte: card scure appoggiate su una pagina bianca,
 * titoli di sezione grigio chiaro sul bianco. Con il tema su «Auto» bastava
 * un telefono in modalita' scura di sistema per ritrovarsi quella via di
 * mezzo, senza aver toccato niente.
 *
 * La correzione sta dove deve stare: si ridefiniscono LE VARIABILI, una volta,
 * per `html[data-theme="dark"]`. Tutto quello che gia' legge `var(--...)` —
 * il body, le card di vetro, i bordi, i testi — si scurisce da solo, e le
 * regole puntuali che gia' esistevano continuano a fare il loro lavoro sopra
 * una base finalmente coerente. Il tema chiaro non cambia di una virgola:
 * queste righe vivono solo sotto l'attributo del tema scuro. */
import { installStyle } from "./shared.js";

const KEY = "__DASHBOARDMODERN_THEME_FOUNDATION__";
const STYLE_ID = "dm-theme-foundation-style";

export function installThemeFoundationSection() {
  const state = (globalThis[KEY] ||= { installed: false });
  if (state.installed) return false;
  state.installed = true;
  installStyle(STYLE_ID, `
    html[data-theme="dark"]{
      --bg-sculpted:#0b1220;
      --bg-1:#0f172a;
      --card-glass:rgba(20,30,52,.88);
      --card-border:#273652;
      --text:#e6edf7;
      --text-dim:#93a3ba;
      --card-bg:#141e34;
      --surface-2:#182338;
      --surface-3:#1e2b44;
      --shadow-sculpted:0 4px 20px rgba(0,0,0,.45),0 1px 4px rgba(0,0,0,.35);
      --shadow-hover:0 12px 35px rgba(0,0,0,.55),0 2px 8px rgba(0,0,0,.4);
      --shadow-glass:0 8px 30px rgba(0,0,0,.45),inset 0 0 0 1px rgba(255,255,255,.06);
      color-scheme:dark;
    }
    /* #206: le variabili col NOME di Home Assistant, risolte sui token nostri.
     *
     * Decine di regole delle sezioni scrivono background:var(--card-background-color,#fff)
     * o var(--secondary-background-color,#f6f8fb): nomi del tema di HA che in
     * questo documento non esistono, quindi vinceva sempre il ripiego chiaro —
     * e col tema scuro il testo (che invece legge --text, tematizzato) finiva
     * chiaro su bianco: illeggibile. L'alias sta qui, nella fondazione: ogni
     * regola che usa il nome di HA riceve il token di DashboardModern, chiaro
     * col chiaro e scuro con lo scuro, senza toccare le regole una per una. */
    html{
      --card-background-color:var(--card-bg);
      --ha-card-background:var(--card-bg);
      --secondary-background-color:var(--surface-2);
      --divider-color:var(--card-border);
      --secondary-text-color:var(--text-dim);
      --primary-text-color:var(--text);
    }
  `);
  return true;
}

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

    /* Il margine laterale della plancia.
     *
     * Il guscio non ne ha mai avuto uno: il corpo della pagina parte a filo di
     * schermo, e tutto quello che ci sta dentro parte con lui. Su un telefono
     * si vede subito da dove: la «P» di PERSONE nasce sul bordo e sembra
     * tagliata, le tessere finiscono contro il vetro, e ogni titolo di sezione
     * comincia dove finisce il mondo. Non e' una scelta, e' una riga che
     * nessuno ha mai scritto.
     *
     * Qui si scrive, una volta sola e per tutte le pagine: il corpo tiene le
     * distanze dai bordi, e con box-sizing border-box gia' dichiarato nel
     * guscio nessuno diventa piu' largo di prima. La barra in basso non si
     * muove — e' fissa, il margine del corpo non la riguarda — e le finestre
     * nemmeno, per lo stesso motivo. Le tacche del telefono si rispettano,
     * dove ci sono. */
    /* La misura sta in un posto solo.
     *
     * La prima volta questa regola l'aveva scritta due volte: qui, e nel foglio
     * del chiosco, che sui telefoni e' sempre acceso e la scriveva col peso
     * massimo, chiedendo la tacca laterale con zero come ripiego. Su un
     * telefono senza tacca quella misura vale zero, e vinceva: il
     * margine c'era, scritto, e non si e' mai visto. Adesso la distanza ha un
     * nome, e chi ha bisogno di ripeterla ripete il nome. */
    :root{--dm-gutter:14px}
    @media(min-width:769px){:root{--dm-gutter:22px}}
    body{
      padding-left:max(var(--dm-gutter),env(safe-area-inset-left,0px));
      padding-right:max(var(--dm-gutter),env(safe-area-inset-right,0px));
    }

    /* Il nome della plancia deve leggersi anche di notte.
     *
     * Il titolo in alto a sinistra e' un testo riempito da un gradiente, e il
     * gradiente partiva da un blu notte scritto a mano. In tema chiaro si
     * legge benissimo; in tema scuro quella prima parola finisce su un fondo
     * dello stesso colore e sparisce — restava leggibile solo "Home". Tutto il
     * resto dell'intestazione, sottotitolo e pastiglia della connessione,
     * seguiva gia' il tema: era solo quel capo del gradiente a non farlo. E'
     * una fondamenta come le altre qui sopra: un colore che deve seguire il
     * tema, non la rifinitura di una sezione. */
    .brand-text h1{
      background:linear-gradient(135deg,var(--text,#0f172a),var(--green,#16a34a))!important;
      -webkit-background-clip:text!important;background-clip:text!important;
      -webkit-text-fill-color:transparent!important}

    /* Lo sfondo animato sta sul suo livello (dal campo: la CPU del mini PC).
     *
     * Le due macchie sfumate dietro la plancia si muovono per sempre, fuori da
     * ogni pagina, con un blur di cento pixel su meta' dello schermo. Promosse
     * a livello composito il browser le sposta senza rasterizzarle di nuovo a
     * ogni fotogramma; e chi ha chiesto al sistema di ridurre le animazioni le
     * trova ferme, che e' quello che ha chiesto. */
    .animated-mesh-bg::before,.animated-mesh-bg::after{will-change:transform}
    @media (prefers-reduced-motion:reduce){
      .animated-mesh-bg::before,.animated-mesh-bg::after{animation-play-state:paused!important}
    }
  `);
  return true;
}

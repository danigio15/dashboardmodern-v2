/* Il cielo dietro la finestra segue l'ora.
 *
 * La card della tapparella si guarda da dentro casa: la tapparella sta fuori,
 * l'infisso in primo piano, e in mezzo si vede il cielo. Quel cielo era uno
 * solo — azzurro di mezzogiorno con il tema chiaro, notte con quello scuro — e
 * alle sette di sera stonava.
 *
 * Il disegno del cielo era gia' tutto in variabili: `--tapp-sky`, il sole, le
 * nuvole, le stelle, le colline, gli alberi, la luce che filtra fra le stecche.
 * Qui non si ridisegna niente e non si tocca nessuna card: si scrive sulla
 * pagina in che fascia del giorno siamo, e le variabili di quella fascia fanno
 * il resto. Un solo proprietario per il cielo, come per tutto il resto.
 */
import { daylightPhase, millisToNextPhase } from "../core/daylight.js";
import { doc, installStyle, root } from "./shared.js";

const KEY = "__DASHBOARDMODERN_SHUTTER_SKY__";
const state = (root[KEY] ||= { installed: false, timer: 0, phase: "" });

function page() {
  return doc?.getElementById("page-tapparelle") || null;
}

export function paintSky(when = new Date()) {
  const host = page();
  if (!host) return "";
  const phase = daylightPhase(when);
  if (host.dataset.dmOra !== phase) host.dataset.dmOra = phase;
  state.phase = phase;
  return phase;
}

/* Il prossimo cambio, non un battito al minuto: la fascia cambia cinque volte
 * al giorno e il resto del tempo non c'e' niente da rifare. */
function scheduleNext(when = new Date()) {
  root.clearTimeout?.(state.timer);
  state.timer = root.setTimeout?.(() => {
    paintSky();
    scheduleNext();
  }, millisToNextPhase(when));
}

function installStyles() {
  const at = (phase, body) =>
    `html body #page-tapparelle#page-tapparelle#page-tapparelle[data-dm-ora="${phase}"]{${body}}`;
  installStyle(
    "dm-shutter-sky-style",
    [
      /* L'alba: il blu della notte ancora in alto, l'arancio che sale da terra e
       * il sole basso a destra, appena sopra le colline. */
      at(
        "alba",
        `--tapp-sky:linear-gradient(180deg,#25406e 0,#7d6a9c 34%,#f0a172 68%,#ffd3a1 100%)!important;
         --tapp-sun:radial-gradient(circle at 79% 63%,#fff6dd 0 4%,rgba(255,214,150,.95) 6.5%,rgba(255,183,116,.44) 17%,rgba(255,183,116,0) 36%)!important;
         --tapp-clouds:radial-gradient(29px 10px at 26% 30%,rgba(255,214,196,.72),transparent 70%),radial-gradient(20px 8px at 36% 34%,rgba(255,226,208,.58),transparent 70%)!important;
         --tapp-stars:radial-gradient(1.2px 1.2px at 20% 15%,rgba(255,255,255,.55),transparent),radial-gradient(1.1px 1.1px at 45% 11%,rgba(255,255,255,.38),transparent)!important;
         --tapp-trees:radial-gradient(11px 13px at 64% 79%,#1d5c3c 0 64%,transparent 65%),radial-gradient(8px 10px at 71% 82%,#164a30 0 64%,transparent 65%),radial-gradient(7px 8px at 57% 83%,#256b47 0 64%,transparent 65%)!important;
         --tapp-hill-a:radial-gradient(140% 64% at 4% 112%,#6fb894 0 62%,transparent 63%)!important;
         --tapp-hill-b:radial-gradient(120% 58% at 92% 116%,#2f8f63 0 60%,transparent 61%)!important;
         --tapp-track-sky:#e8b98d!important;
         --tapp-spill:rgba(255,196,132,.78)!important`,
      ),
      /* La mattina: il cielo pulito, il sole in alto a destra, nuvole bianche. */
      at(
        "mattina",
        `--tapp-sky:linear-gradient(180deg,#3aaef2,#9ad8fb 46%,#e9f7ff)!important;
         --tapp-sun:radial-gradient(circle at 78% 22%,#fffdf0 0 4.5%,rgba(255,244,186,.94) 6%,rgba(255,229,146,.44) 15%,rgba(255,229,146,0) 32%)!important;
         --tapp-stars:none!important;
         --tapp-clouds:radial-gradient(27px 11px at 25% 33%,rgba(255,255,255,.92),transparent 70%),radial-gradient(19px 8px at 34% 36%,rgba(255,255,255,.82),transparent 70%),radial-gradient(15px 7px at 17% 37%,rgba(255,255,255,.72),transparent 70%)!important;
         --tapp-trees:radial-gradient(11px 13px at 64% 79%,#2b8f59 0 64%,transparent 65%),radial-gradient(8px 10px at 71% 82%,#217a48 0 64%,transparent 65%),radial-gradient(7px 8px at 57% 83%,#37a367 0 64%,transparent 65%)!important;
         --tapp-hill-a:radial-gradient(140% 64% at 4% 112%,#8ee7b0 0 62%,transparent 63%)!important;
         --tapp-hill-b:radial-gradient(120% 58% at 92% 116%,#3fbc7c 0 60%,transparent 61%)!important;
         --tapp-track-sky:#bfe6fb!important;
         --tapp-spill:rgba(255,224,150,.80)!important`,
      ),
      /* Il pomeriggio: la stessa luce ma piu' calda e piu' bassa, e il verde
       * delle colline che ha preso il sole tutto il giorno. */
      at(
        "pomeriggio",
        `--tapp-sky:linear-gradient(180deg,#4cb6ef,#a8dcf6 44%,#f3f0e2)!important;
         --tapp-sun:radial-gradient(circle at 74% 38%,#fffaf0 0 4.5%,rgba(255,236,168,.92) 6.5%,rgba(255,214,128,.42) 17%,rgba(255,214,128,0) 34%)!important;
         --tapp-clouds:radial-gradient(30px 11px at 24% 31%,rgba(255,255,255,.92),transparent 70%),radial-gradient(21px 9px at 35% 35%,rgba(255,252,244,.80),transparent 70%),radial-gradient(15px 7px at 16% 36%,rgba(255,255,255,.66),transparent 70%)!important;
         --tapp-stars:none!important;
         --tapp-trees:radial-gradient(11px 13px at 64% 79%,#2b8f59 0 64%,transparent 65%),radial-gradient(8px 10px at 71% 82%,#217a48 0 64%,transparent 65%),radial-gradient(7px 8px at 57% 83%,#37a367 0 64%,transparent 65%)!important;
         --tapp-hill-a:radial-gradient(140% 64% at 4% 112%,#93dfa6 0 62%,transparent 63%)!important;
         --tapp-hill-b:radial-gradient(120% 58% at 92% 116%,#43b072 0 60%,transparent 61%)!important;
         --tapp-track-sky:#cfe6f3!important;
         --tapp-spill:rgba(255,210,128,.82)!important`,
      ),
      /* Il tramonto: il sole grosso e basso, il cielo che va dal rosso al viola
       * e tutto cio' che sta a terra in controluce. */
      at(
        "tramonto",
        `--tapp-sky:linear-gradient(180deg,#3c3a72 0,#a8557f 30%,#eb7a58 62%,#ffb877 100%)!important;
         --tapp-stars:none!important;
         --tapp-sun:radial-gradient(circle at 76% 68%,#fff3d0 0 6%,rgba(255,178,102,.96) 9%,rgba(240,120,80,.44) 22%,rgba(240,120,80,0) 42%)!important;
         --tapp-clouds:radial-gradient(31px 10px at 27% 29%,rgba(255,190,170,.70),transparent 70%),radial-gradient(22px 9px at 38% 34%,rgba(255,170,150,.55),transparent 70%)!important;
         --tapp-trees:radial-gradient(11px 13px at 64% 79%,#123a2a 0 64%,transparent 65%),radial-gradient(8px 10px at 71% 82%,#0d2d20 0 64%,transparent 65%),radial-gradient(7px 8px at 57% 83%,#194936 0 64%,transparent 65%)!important;
         --tapp-hill-a:radial-gradient(140% 64% at 4% 112%,#3f7a63 0 62%,transparent 63%)!important;
         --tapp-hill-b:radial-gradient(120% 58% at 92% 116%,#1e5541 0 60%,transparent 61%)!important;
         --tapp-track-sky:#e79b6d!important;
         --tapp-spill:rgba(255,158,96,.82)!important`,
      ),
      /* La sera, e con lei la notte: il blu profondo, le stelle, la luna al
       * posto del sole e le colline ridotte a sagome. */
      at(
        "sera",
        `--tapp-sky:linear-gradient(180deg,#060d1f,#101f3f 52%,#1b3a64)!important;
         --tapp-sun:radial-gradient(circle at 78% 24%,rgba(248,250,252,.96) 0 4.5%,rgba(203,213,225,.32) 8%,rgba(203,213,225,0) 26%)!important;
         --tapp-clouds:none!important;
         --tapp-stars:radial-gradient(1.4px 1.4px at 17% 27%,rgba(255,255,255,.92),transparent),radial-gradient(1.2px 1.2px at 34% 13%,rgba(255,255,255,.74),transparent),radial-gradient(1.3px 1.3px at 55% 31%,rgba(255,255,255,.62),transparent),radial-gradient(1.1px 1.1px at 24% 47%,rgba(255,255,255,.52),transparent),radial-gradient(1.2px 1.2px at 66% 18%,rgba(255,255,255,.58),transparent)!important;
         --tapp-trees:radial-gradient(11px 13px at 64% 79%,#0b3a20 0 64%,transparent 65%),radial-gradient(8px 10px at 71% 82%,#072b17 0 64%,transparent 65%),radial-gradient(7px 8px at 57% 83%,#0f4527 0 64%,transparent 65%)!important;
         --tapp-hill-a:radial-gradient(140% 64% at 4% 112%,#14532d 0 62%,transparent 63%)!important;
         --tapp-hill-b:radial-gradient(120% 58% at 92% 116%,#052e16 0 60%,transparent 61%)!important;
         --tapp-track-sky:#1b3a64!important;
         --tapp-spill:rgba(191,219,254,.44)!important`,
      ),
      /* Il cielo cambia una volta ogni poche ore: il passaggio si vede, ma non
       * si aspetta. */
      `html body #page-tapparelle#page-tapparelle .tapp-win{transition:background-color .8s ease!important}`,
      `@media(prefers-reduced-motion:reduce){html body #page-tapparelle#page-tapparelle .tapp-win{transition:none!important}}`,
    ].join("\n"),
  );
}

export function installShutterSkySection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  // Lo stato e' gia' condiviso sotto la sua chiave, come per le altre sezioni:
  // ci si appoggia anche il pennello, cosi' una prova puo' chiedere una certa
  // ora invece di aspettare che arrivi.
  state.paint = paintSky;
  const ridipingi = () => {
    paintSky();
    scheduleNext();
  };
  for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:runtime-ready", "dashboardmodern:state-changed", "pageshow"]) {
    root.addEventListener?.(evento, ridipingi);
  }
  doc.addEventListener?.("visibilitychange", () => {
    if (!doc.hidden) ridipingi();
  });
  ridipingi();
}

installShutterSkySection();

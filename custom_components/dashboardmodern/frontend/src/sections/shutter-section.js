import { doc, installStyle, root } from "./shared.js";

globalThis.__DM_20260815C__ = true;
const KEY = "__DASHBOARDMODERN_SHUTTER_SECTION__";
const state = (root[KEY] ||= { installed: false });

/* La card «Tapparelle aperte» e il suo popup vivevano nel Quadro Avvisi della
 * Home, che dalla Home e' uscito: senza il riquadro che li ospitava non
 * avevano piu' una porta da cui entrare, e la tessera «Tapparelle» del ponte
 * dice le stesse cose — quante sono aperte, quali, e i comandi per ognuna,
 * tendina della posizione compresa. Due strade per la stessa stanza sono una
 * di troppo: questa e' stata chiusa, non lasciata socchiusa. */

function installStyles() {
  installStyle("dm-shutter-section-style", `

    /* ── Tapparelle page ─────────────────────────────────────────────────
       First paint is already the final Beta9 geometry. This section no longer
       decorates or wraps renderTapparelle: the legacy grid rewrites its own
       innerHTML every two seconds, so the whole skin is static CSS that
       survives each repaint without a single DOM pass, and Beta9's bounded
       polish keeps re-applying the same geometry values underneath.

       Everything below the geometry is paint only. The window is drawn as a
       real one — frame, mullion, sky, sun and hills behind the glass, roller
       box at the top — and the shutter itself carries the slat texture as a
       repeating background anchored to its bottom edge. That anchoring is
       what makes the legacy slat elements redundant: they stack from the bottom
       and stop after eight of them, which used to leave the top of a fully
       closed shutter transparent. The background fills the whole panel at any
       height, so the slats only need to stop painting. */
    html body #page-tapparelle#page-tapparelle{animation:none!important;transform:none!important;opacity:1!important;
      --tapp-accent:#0ea5e9;
      --tapp-text:var(--text,#0f172a);
      --tapp-dim:var(--text-dim,#64748b);
      --tapp-surface:linear-gradient(168deg,rgba(255,255,255,.97),rgba(237,245,255,.93));
      --tapp-border:rgba(148,163,184,.30);
      --tapp-shadow:0 1px 2px rgba(15,23,42,.05),0 12px 28px -14px rgba(15,23,42,.32);
      --tapp-shadow-hover:0 2px 5px rgba(15,23,42,.07),0 20px 44px -18px rgba(2,132,199,.45);
      --tapp-shadow-live:0 1px 2px rgba(15,23,42,.05),0 16px 36px -18px rgba(2,132,199,.55);
      --tapp-frame:#dbe3ee;
      --tapp-mullion:linear-gradient(90deg,transparent calc(50% - 2px),rgba(226,232,240,.92) calc(50% - 2px) calc(50% + 2px),transparent calc(50% + 2px));
      --tapp-guides:linear-gradient(90deg,rgba(233,239,247,.70) 0 2px,rgba(15,23,42,.16) 2px 4px,transparent 4px),linear-gradient(270deg,rgba(233,239,247,.70) 0 2px,rgba(15,23,42,.16) 2px 4px,transparent 4px);
      --tapp-stars:none;
      --tapp-clouds:radial-gradient(27px 11px at 25% 33%,rgba(255,255,255,.92),transparent 70%),radial-gradient(19px 8px at 34% 36%,rgba(255,255,255,.82),transparent 70%),radial-gradient(15px 7px at 17% 37%,rgba(255,255,255,.72),transparent 70%);
      --tapp-sun:radial-gradient(circle at 78% 25%,#fffdf0 0 4.5%,rgba(255,241,170,.92) 6%,rgba(255,223,130,.42) 15%,rgba(255,223,130,0) 32%);
      --tapp-trees:radial-gradient(11px 13px at 64% 79%,#2b8f59 0 64%,transparent 65%),radial-gradient(8px 10px at 71% 82%,#217a48 0 64%,transparent 65%),radial-gradient(7px 8px at 57% 83%,#37a367 0 64%,transparent 65%);
      --tapp-hill-a:radial-gradient(140% 64% at 4% 112%,#8ee7b0 0 62%,transparent 63%);
      --tapp-hill-b:radial-gradient(120% 58% at 92% 116%,#3fbc7c 0 60%,transparent 61%);
      --tapp-sky:linear-gradient(180deg,#4fbcf6,#a2dcfb 46%,#e8f6fe);
      --tapp-box:linear-gradient(180deg,#f4f7fb 0 2px,#e2e9f2 2px 5px,#c8d2df 5px 6px,#dfe6ef 6px 8px,#a9b5c5 8px 10px,rgba(15,23,42,.38) 10px 11px);
      --tapp-slat:linear-gradient(180deg,#fdfeff 0 1px,#eaf0f7 1px 4px,#c6d1df 4px 9px,#9daabc 9px 11px,rgba(15,23,42,.34) 11px 12px);
      --tapp-slat-base:#b7c2d1;
      --tapp-track-sky:#bfe6fb;
      --tapp-spill:rgba(255,214,120,.80);
      --tapp-rail:linear-gradient(180deg,#b3bdcc 0 2px,#7d8898 2px 5px,#4d5766 5px 7px);
      --tapp-grip:radial-gradient(20px 3px at 50% 50%,rgba(15,23,42,.5),transparent 72%);
      --tapp-pill:rgba(148,163,184,.13);
      --tapp-pill-line:rgba(148,163,184,.30);
      --tapp-ok-fg:#0f9d6e;--tapp-ok-bg:rgba(16,185,129,.14);--tapp-ok-line:rgba(16,185,129,.34);
      --tapp-off-fg:#5b6b82;--tapp-off-bg:rgba(100,116,139,.14);--tapp-off-line:rgba(100,116,139,.30);
      --tapp-run-fg:#0284c7;--tapp-run-bg:rgba(14,165,233,.15);--tapp-run-line:rgba(14,165,233,.36);
      --tapp-up-bg:linear-gradient(160deg,#e6f5ff,#bfe6fb);--tapp-up-fg:#0369a1;--tapp-up-line:rgba(14,165,233,.36);
      --tapp-stop-bg:linear-gradient(160deg,#fff,#eef2f8);--tapp-stop-fg:#475569;--tapp-stop-line:rgba(148,163,184,.44);
      --tapp-down-bg:linear-gradient(160deg,#0ea5e9,#0369a1);--tapp-down-fg:#fff;--tapp-down-line:rgba(3,105,161,.55)}
    html[data-theme="dark"] body #page-tapparelle#page-tapparelle,html body.dark-theme #page-tapparelle#page-tapparelle{
      --tapp-surface:linear-gradient(168deg,rgba(32,43,68,.96),rgba(19,27,46,.95));
      --tapp-border:rgba(148,163,184,.20);
      --tapp-shadow:0 1px 2px rgba(0,0,0,.45),0 14px 32px -16px rgba(0,0,0,.75);
      --tapp-shadow-hover:0 2px 6px rgba(0,0,0,.5),0 22px 48px -20px rgba(14,165,233,.5);
      --tapp-shadow-live:0 1px 2px rgba(0,0,0,.45),0 18px 40px -20px rgba(56,189,248,.55);
      --tapp-frame:#3d4a61;
      --tapp-mullion:linear-gradient(90deg,transparent calc(50% - 2px),rgba(71,85,105,.95) calc(50% - 2px) calc(50% + 2px),transparent calc(50% + 2px));
      --tapp-guides:linear-gradient(90deg,rgba(100,116,139,.6) 0 2px,rgba(0,0,0,.4) 2px 4px,transparent 4px),linear-gradient(270deg,rgba(100,116,139,.6) 0 2px,rgba(0,0,0,.4) 2px 4px,transparent 4px);
      --tapp-stars:radial-gradient(1.4px 1.4px at 17% 27%,rgba(255,255,255,.9),transparent),radial-gradient(1.2px 1.2px at 34% 13%,rgba(255,255,255,.7),transparent),radial-gradient(1.3px 1.3px at 55% 31%,rgba(255,255,255,.6),transparent),radial-gradient(1.1px 1.1px at 24% 47%,rgba(255,255,255,.5),transparent);
      --tapp-clouds:none;
      --tapp-sun:radial-gradient(circle at 78% 24%,rgba(248,250,252,.96) 0 4.5%,rgba(203,213,225,.32) 8%,rgba(203,213,225,0) 26%);
      --tapp-trees:radial-gradient(11px 13px at 64% 79%,#0b3a20 0 64%,transparent 65%),radial-gradient(8px 10px at 71% 82%,#072b17 0 64%,transparent 65%),radial-gradient(7px 8px at 57% 83%,#0f4527 0 64%,transparent 65%);
      --tapp-hill-a:radial-gradient(140% 64% at 4% 112%,#14532d 0 62%,transparent 63%);
      --tapp-hill-b:radial-gradient(120% 58% at 92% 116%,#052e16 0 60%,transparent 61%);
      --tapp-sky:linear-gradient(180deg,#070f24,#12274a 52%,#1e4370);
      --tapp-box:linear-gradient(180deg,#454f64 0 2px,#333d50 2px 5px,#222b3b 5px 6px,#303a4c 6px 8px,#1b2331 8px 10px,rgba(0,0,0,.65) 10px 11px);
      --tapp-slat:linear-gradient(180deg,#7c8ca6 0 1px,#5d6c85 1px 4px,#41506a 4px 9px,#2d3950 9px 11px,rgba(0,0,0,.58) 11px 12px);
      --tapp-slat-base:#39455a;
      --tapp-track-sky:#1e4370;
      --tapp-spill:rgba(191,219,254,.42);
      --tapp-rail:linear-gradient(180deg,#5a6779 0 2px,#3b4557 2px 5px,#1b222e 5px 7px);
      --tapp-grip:radial-gradient(20px 3px at 50% 50%,rgba(0,0,0,.65),transparent 72%);
      --tapp-pill:rgba(148,163,184,.14);--tapp-pill-line:rgba(148,163,184,.24);
      --tapp-ok-fg:#34d399;--tapp-ok-bg:rgba(16,185,129,.16);--tapp-ok-line:rgba(52,211,153,.34);
      --tapp-off-fg:#a8b6cc;--tapp-off-bg:rgba(148,163,184,.16);--tapp-off-line:rgba(148,163,184,.28);
      --tapp-run-fg:#7dd3fc;--tapp-run-bg:rgba(14,165,233,.18);--tapp-run-line:rgba(56,189,248,.38);
      --tapp-up-bg:linear-gradient(160deg,rgba(12,74,110,.9),rgba(7,89,133,.9));--tapp-up-fg:#bae6fd;--tapp-up-line:rgba(56,189,248,.40);
      --tapp-stop-bg:linear-gradient(160deg,rgba(51,65,85,.92),rgba(30,41,59,.92));--tapp-stop-fg:#cbd5e1;--tapp-stop-line:rgba(148,163,184,.30);
      --tapp-down-bg:linear-gradient(160deg,#0ea5e9,#0c4a6e);--tapp-down-fg:#f0f9ff;--tapp-down-line:rgba(56,189,248,.5)}

    html body #page-tapparelle#page-tapparelle #tapp-grid{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(280px,360px))!important;justify-content:center!important;align-items:start!important;gap:14px!important;padding:12px 4px 26px!important}

    /* Legacy renderTapparelle emits two inline-styled full-width rows into the
       grid: the "open/close everything" bar, recognised by its buttons, and one
       label per room. Neither carries a class, so both are matched on the one
       inline declaration they do have. */
    html body #page-tapparelle#page-tapparelle #tapp-grid>div:has(>.tapp-btn[data-all]){display:flex!important;flex-wrap:wrap!important;justify-content:center!important;gap:10px!important;margin:0 0 2px!important;padding:0!important}
    html body #page-tapparelle#page-tapparelle #tapp-grid>div[style*="grid-column"]:not(.ed-empty):not(:has(.tapp-btn)){display:flex!important;align-items:center!important;gap:10px!important;margin:8px 2px 0!important;padding:0!important;opacity:1!important;color:var(--tapp-dim)!important;font-size:11px!important;font-weight:900!important;letter-spacing:1.5px!important;text-transform:uppercase!important}
    html body #page-tapparelle#page-tapparelle #tapp-grid>div[style*="grid-column"]:not(.ed-empty):not(:has(.tapp-btn))::after{content:""!important;flex:1 1 auto!important;height:1px!important;background:linear-gradient(90deg,var(--tapp-border),transparent)!important}
    html body #page-tapparelle#page-tapparelle #tapp-grid>.ed-empty{padding:34px 18px!important;border:1px dashed var(--tapp-border)!important;border-radius:20px!important;color:var(--tapp-dim)!important;font-weight:800!important;text-align:center!important}

    html body #page-tapparelle#page-tapparelle .tapp-card{box-sizing:border-box!important;width:100%!important;max-width:360px!important;min-height:0!important;padding:14px!important;gap:10px!important;border-radius:20px!important;animation:none!important;transform:none!important;position:relative!important;overflow:hidden!important;border:1px solid var(--tapp-border)!important;background:var(--tapp-surface)!important;box-shadow:var(--tapp-shadow)!important;transition:box-shadow .24s ease,border-color .24s ease!important}
    html body #page-tapparelle#page-tapparelle .tapp-card::before{content:""!important;position:absolute!important;inset:0 0 auto!important;height:3px!important;background:linear-gradient(90deg,transparent,var(--tapp-accent),transparent);background-size:55% 100%;background-repeat:no-repeat;background-position:50% 0;opacity:.5!important}
    html body #page-tapparelle#page-tapparelle .tapp-card:hover{border-color:color-mix(in srgb,var(--tapp-accent) 42%,transparent)!important;box-shadow:var(--tapp-shadow-hover)!important}
    html body #page-tapparelle#page-tapparelle .tapp-card:has(.tapp-st-open)::before{background:linear-gradient(90deg,transparent,var(--tapp-ok-fg),transparent);background-size:55% 100%;background-repeat:no-repeat;background-position:50% 0;opacity:.62!important}
    html body #page-tapparelle#page-tapparelle .tapp-card:has(.tapp-st-closed)::before{opacity:.24!important}
    html body #page-tapparelle#page-tapparelle .tapp-card:has(.tapp-st-opening),html body #page-tapparelle#page-tapparelle .tapp-card:has(.tapp-st-closing){border-color:var(--tapp-run-line)!important;box-shadow:var(--tapp-shadow-live)!important}
    html body #page-tapparelle#page-tapparelle .tapp-card:has(.tapp-st-opening)::before,html body #page-tapparelle#page-tapparelle .tapp-card:has(.tapp-st-closing)::before{opacity:1!important;animation:dmTappSweep 1.8s linear infinite!important}
    @keyframes dmTappSweep{0%{background-position:-60% 0}100%{background-position:160% 0}}

    html body #page-tapparelle#page-tapparelle .tapp-head{gap:8px!important;min-height:26px!important}
    html body #page-tapparelle#page-tapparelle .tapp-name{min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;color:var(--tapp-text)!important;font-size:14.5px!important;font-weight:900!important;letter-spacing:.2px!important}
    html body #page-tapparelle#page-tapparelle .tapp-state{display:inline-flex!important;align-items:center!important;gap:6px!important;flex:0 0 auto!important;padding:4px 10px!important;border:1px solid transparent!important;border-radius:999px!important;font-size:10px!important;font-weight:900!important;letter-spacing:.8px!important;text-transform:uppercase!important;white-space:nowrap!important;background:var(--tapp-off-bg)!important;border-color:var(--tapp-off-line)!important;color:var(--tapp-off-fg)!important}
    html body #page-tapparelle#page-tapparelle .tapp-state::before{content:""!important;flex:0 0 auto!important;width:6px!important;height:6px!important;border-radius:50%!important;background:currentColor!important;box-shadow:0 0 0 3px color-mix(in srgb,currentColor 20%,transparent)!important}
    html body #page-tapparelle#page-tapparelle .tapp-st-open{background:var(--tapp-ok-bg)!important;border-color:var(--tapp-ok-line)!important;color:var(--tapp-ok-fg)!important}
    html body #page-tapparelle#page-tapparelle .tapp-st-closed{background:var(--tapp-off-bg)!important;border-color:var(--tapp-off-line)!important;color:var(--tapp-off-fg)!important}
    html body #page-tapparelle#page-tapparelle .tapp-st-opening,html body #page-tapparelle#page-tapparelle .tapp-st-closing{background:var(--tapp-run-bg)!important;border-color:var(--tapp-run-line)!important;color:var(--tapp-run-fg)!important}
    html body #page-tapparelle#page-tapparelle .tapp-st-opening::before,html body #page-tapparelle#page-tapparelle .tapp-st-closing::before{animation:dmTappPulse 1.2s ease-in-out infinite!important}
    @keyframes dmTappPulse{0%,100%{opacity:1}50%{opacity:.2}}

    html body #page-tapparelle#page-tapparelle .tapp-win{box-sizing:border-box!important;height:132px!important;min-height:132px!important;max-height:132px!important;margin:0!important;border-radius:17px!important;animation:none!important;transform:none!important;position:relative!important;overflow:hidden!important;border:4px solid var(--tapp-frame)!important;background:var(--tapp-mullion),var(--tapp-clouds),var(--tapp-stars),var(--tapp-sun),var(--tapp-trees),var(--tapp-hill-a),var(--tapp-hill-b),var(--tapp-sky)!important;box-shadow:inset 0 0 0 1px rgba(15,23,42,.16),0 6px 16px -11px rgba(15,23,42,.6)!important}
    html body #page-tapparelle#page-tapparelle .tapp-win::before{content:""!important;position:absolute!important;inset:0 0 auto!important;height:11px!important;z-index:5!important;background:var(--tapp-box)!important;box-shadow:0 4px 8px -3px rgba(15,23,42,.5)!important}
    html body #page-tapparelle#page-tapparelle .tapp-win::after{content:""!important;position:absolute!important;inset:0!important;z-index:6!important;pointer-events:none!important;border-radius:13px!important;background:var(--tapp-guides)!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.5),inset 0 14px 22px -16px rgba(15,23,42,.55),inset 0 -8px 14px -10px rgba(15,23,42,.45)!important}
    html body #page-tapparelle#page-tapparelle .tapp-glass{position:absolute!important;inset:0!important;z-index:1!important;background:linear-gradient(116deg,rgba(255,255,255,.5) 0 11%,rgba(255,255,255,0) 12% 27%,rgba(255,255,255,.28) 28% 35%,rgba(255,255,255,0) 36%)!important}

    /* The slat texture is repeated by the panel itself and anchored to its
       bottom edge, so it stays aligned with the closing edge at every height.
       Beta9 pins animation:none on the panel to stop the legacy slat flicker;
       an inline declaration cannot reach a pseudo-element, which is why the
       travelling texture and the bottom rail live on ::before and ::after. */
    html body #page-tapparelle#page-tapparelle .tapp-shutter{animation:none!important;filter:none!important;transition:height .55s cubic-bezier(.2,.8,.2,1)!important;z-index:3!important;background:var(--tapp-rail) left bottom/100% 7px no-repeat,var(--tapp-slat) left bottom/100% 12px repeat-y var(--tapp-slat-base)!important;box-shadow:0 8px 14px -6px rgba(15,23,42,.55)!important}
    html body #page-tapparelle#page-tapparelle .tapp-shutter::before{content:""!important;position:absolute!important;inset:0!important;z-index:1!important;background:var(--tapp-slat) left bottom/100% 12px repeat-y var(--tapp-slat-base)}
    html body #page-tapparelle#page-tapparelle .tapp-shutter::after{content:""!important;position:absolute!important;inset:auto 0 0!important;height:7px!important;z-index:2!important;background:var(--tapp-grip),var(--tapp-rail)!important}
    html body #page-tapparelle#page-tapparelle .tapp-shutter.closing::before{animation:dmTappRoll .9s linear infinite!important}
    html body #page-tapparelle#page-tapparelle .tapp-shutter.opening::before{animation:dmTappRoll .9s linear infinite reverse!important}
    @keyframes dmTappRoll{from{background-position-y:100%}to{background-position-y:calc(100% + 12px)}}
    html body #page-tapparelle#page-tapparelle .tapp-shutter i{animation:none!important;filter:none!important;transform:none!important;flex:0 0 12px!important;height:12px!important;background:none!important;border:0!important}

    /* La tenda.
     *
     * Stesso serramento della tapparella — vetro, cornice, luce che entra — e
     * al posto della fascia che scende due teli che si scostano dal centro.
     * Quanto e' coperta la finestra e' la stessa cosa; a cambiare e' il verso,
     * e sta tutto nella variabile --tenda-chiusa, che e' meta' della parte
     * coperta perche' i teli sono due. I colori sono quelli della scena,
     * cosi' la tenda segue l'ora del giorno come tutto il resto. */
    html body #page-tapparelle#page-tapparelle .dm-tenda{position:absolute!important;inset:0!important;z-index:3!important;pointer-events:none!important}
    /* Stoffa, non lamiera.
     *
     * Le pieghe erano righe nette da due pixel su un fondo grigio: da lontano
     * una veneziana di metallo, che e' proprio la cosa da cui la tenda doveva
     * distinguersi. Una piega di tessuto non ha un bordo — la luce ci scivola
     * sopra — quindi i passaggi sono sfumati e larghi, e il fondo va sul caldo
     * del lino invece che sul grigio del serramento. */
    html body #page-tapparelle#page-tapparelle .dm-tenda-telo{position:absolute!important;top:0!important;bottom:0!important;width:var(--tenda-chiusa,50%)!important;
      background:
        repeating-linear-gradient(90deg,
          rgba(255,255,255,.62) 0,
          rgba(255,255,255,.10) 7px,
          rgba(120,86,58,.16) 13px,
          rgba(15,23,42,.20) 17px,
          rgba(255,255,255,.10) 22px,
          rgba(255,255,255,.62) 28px)!important;
      background-color:color-mix(in srgb,var(--tapp-slat-base,#e2e8f0) 26%,#f4e3cf)!important;
      box-shadow:inset 0 10px 16px -12px rgba(255,255,255,.8),0 8px 18px -12px rgba(15,23,42,.55)!important;
      transition:width .55s cubic-bezier(.2,.8,.2,1)!important}
    html body #page-tapparelle#page-tapparelle .dm-tenda-telo.dm-sinistra{left:0!important;border-radius:0 10px 10px 0!important}
    html body #page-tapparelle#page-tapparelle .dm-tenda-telo.dm-destra{right:0!important;border-radius:10px 0 0 10px!important}
    /* Il bordo interno e' dove la stoffa si raccoglie: una piega piu' fitta, e
       l'ombra che cade sul vetro accanto. */
    html body #page-tapparelle#page-tapparelle .dm-tenda-telo::after{content:""!important;position:absolute!important;top:0!important;bottom:0!important;width:14px!important;
      background:linear-gradient(90deg,rgba(15,23,42,0),rgba(15,23,42,.14) 55%,rgba(15,23,42,.26))!important;border-radius:inherit!important}
    html body #page-tapparelle#page-tapparelle .dm-tenda-telo.dm-sinistra::after{right:0!important}
    html body #page-tapparelle#page-tapparelle .dm-tenda-telo.dm-destra::after{left:0!important;transform:scaleX(-1)!important}
    /* Il bastone in cima, con i suoi anelli. Una fascia piatta non diceva
       niente; un bastone e gli anelli dicono «tenda» prima ancora del telo. */
    html body #page-tapparelle#page-tapparelle .dm-tenda::before{content:""!important;position:absolute!important;left:-2px!important;right:-2px!important;top:1px!important;height:5px!important;z-index:6!important;
      border-radius:3px!important;
      background:linear-gradient(180deg,
        color-mix(in srgb,var(--tapp-slat-base,#e2e8f0) 20%,#f7e9d6),
        color-mix(in srgb,var(--tapp-slat-base,#e2e8f0) 55%,#6b4a2f))!important;
      box-shadow:0 2px 5px -2px rgba(15,23,42,.5)!important}
    html body #page-tapparelle#page-tapparelle .dm-tenda::after{content:""!important;position:absolute!important;left:0!important;right:0!important;top:0!important;height:9px!important;z-index:7!important;
      pointer-events:none!important;
      background:repeating-linear-gradient(90deg,
        transparent 0 6px,
        color-mix(in srgb,var(--tapp-slat-base,#e2e8f0) 45%,#5a3f28) 6px 8px,
        transparent 8px 14px)!important}
    html body #page-tapparelle#page-tapparelle .dm-tenda.opening .dm-tenda-telo,
    html body #page-tapparelle#page-tapparelle .dm-tenda.closing .dm-tenda-telo{animation:dmTendaOnda 1.6s ease-in-out infinite!important}
    @keyframes dmTendaOnda{0%,100%{background-position-x:0}50%{background-position-x:5px}}
    /* La tenda da sole.
     *
     * Prima era una tapparella con lo sfondo a righe. Non si vedeva: quello
     * sfondo stava sotto le otto stecche piene, che sono elementi veri e lo
     * coprivano per intero — accanto a una tapparella era il medesimo disegno.
     * Adesso ha un telo suo, senza stecche, e le tre cose che fanno riconoscere
     * una tenda da sole a colpo d'occhio: righe larghe e contrastate, il telo
     * che sporge in avanti, e il bordo ondulato in fondo. */
    html body #page-tapparelle#page-tapparelle .dm-tendasole{
      position:absolute!important;left:-3px!important;right:-3px!important;top:0!important;
      z-index:4!important;pointer-events:none!important;
      transition:height .55s cubic-bezier(.2,.8,.2,1)!important;
      --dm-awn-chiaro:#fdf7ee;
      --dm-awn-scuro:color-mix(in srgb,#d9553c 88%,var(--tapp-slat-base,#e2e8f0))}
    html body #page-tapparelle#page-tapparelle .dm-tendasole-telo{
      position:absolute!important;inset:0!important;
      background:repeating-linear-gradient(90deg,
        var(--dm-awn-chiaro) 0 17px,
        var(--dm-awn-scuro) 17px 34px)!important;
      /* Il telo e' teso e sporge: piu' luce in cima, ombra dove si piega. */
      box-shadow:inset 0 12px 14px -12px rgba(255,255,255,.85),
        inset 0 -10px 14px -12px rgba(15,23,42,.5),
        0 10px 16px -8px rgba(15,23,42,.5)!important;
      border-radius:2px 2px 0 0!important}
    /* Il bordo: mezzelune della stessa stoffa, appese sotto il telo. La fase
       delle righe combacia perche' partono dallo stesso bordo sinistro. */
    html body #page-tapparelle#page-tapparelle .dm-tendasole-bordo{
      position:absolute!important;left:0!important;right:0!important;top:100%!important;
      height:11px!important;
      background:repeating-linear-gradient(90deg,
        var(--dm-awn-chiaro) 0 17px,
        var(--dm-awn-scuro) 17px 34px)!important;
      filter:drop-shadow(0 3px 3px rgba(15,23,42,.35))!important;
      -webkit-mask-image:radial-gradient(circle at 8.5px 0,#000 8px,transparent 8.5px)!important;
      -webkit-mask-size:17px 100%!important;
      -webkit-mask-repeat:repeat-x!important;
      mask-image:radial-gradient(circle at 8.5px 0,#000 8px,transparent 8.5px)!important;
      mask-size:17px 100%!important;
      mask-repeat:repeat-x!important}
    /* A telo tutto raccolto non deve restare appeso un festone nel vuoto. */
    html body #page-tapparelle#page-tapparelle .dm-tendasole[style*="height: 0%"] .dm-tendasole-bordo,
    html body #page-tapparelle#page-tapparelle .dm-tendasole[style*="height:0%"] .dm-tendasole-bordo{
      display:none!important}
    html body #page-tapparelle#page-tapparelle .dm-tendasole.opening .dm-tendasole-telo,
    html body #page-tapparelle#page-tapparelle .dm-tendasole.closing .dm-tendasole-telo{
      animation:dmTendaOnda 1.6s ease-in-out infinite!important}
    /* Nessun ramo a movimento ridotto sui teli: una tenda che scende e' il
     * disegno dello stato, non un ornamento — spegnerla lasciava le tapparelle
     * "senza animazione" sui desktop dove quell'impostazione di sistema e'
     * attiva a insaputa di chi guarda. Come per gli elettrodomestici. */

    html body #page-tapparelle#page-tapparelle .tapp-pos{min-height:0!important;padding:0!important;opacity:1!important;color:var(--tapp-dim)!important;font-size:11px!important}
    html body #page-tapparelle#page-tapparelle .tapp-pos:not(:empty){display:inline-flex!important;align-self:center!important;align-items:center!important;gap:7px!important;padding:3px 12px!important;border:1px solid var(--tapp-pill-line)!important;border-radius:999px!important;background:var(--tapp-pill)!important;font-weight:900!important;letter-spacing:.9px!important;font-variant-numeric:tabular-nums!important}
    html body #page-tapparelle#page-tapparelle .tapp-pos:not(:empty)::before{content:""!important;flex:0 0 auto!important;width:9px!important;height:9px!important;border:1px solid var(--tapp-pill-line)!important;border-radius:2px!important;background:var(--tapp-slat)!important;background-size:100% 3px!important}

    html body #page-tapparelle#page-tapparelle .tapp-ctl{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px!important}
    html body #page-tapparelle#page-tapparelle .tapp-btn{display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:7px!important;box-sizing:border-box!important;min-width:0!important;height:40px!important;min-height:40px!important;padding:0 10px!important;border:1px solid transparent!important;border-radius:13px!important;font-size:16px!important;font-weight:900!important;line-height:1!important;cursor:pointer!important;transition:filter .18s ease,box-shadow .18s ease,transform .12s ease!important}
    html body #page-tapparelle#page-tapparelle .tapp-btn[data-svc="open_cover"]{background:var(--tapp-up-bg)!important;border-color:var(--tapp-up-line)!important;color:var(--tapp-up-fg)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.75),0 5px 12px -8px rgba(3,105,161,.7)!important}
    html body #page-tapparelle#page-tapparelle .tapp-btn[data-svc="stop_cover"]{background:var(--tapp-stop-bg)!important;border-color:var(--tapp-stop-line)!important;color:var(--tapp-stop-fg)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.75),0 5px 12px -8px rgba(15,23,42,.45)!important}
    html body #page-tapparelle#page-tapparelle .tapp-btn[data-svc="close_cover"]{background:var(--tapp-down-bg)!important;border-color:var(--tapp-down-line)!important;color:var(--tapp-down-fg)!important;box-shadow:0 7px 15px -9px rgba(3,105,161,.9)!important}
    html body #page-tapparelle#page-tapparelle .tapp-btn[data-all]{flex:0 1 210px!important;height:46px!important;min-height:46px!important;padding:0 18px!important;border-radius:15px!important;font-size:13px!important;letter-spacing:.4px!important}
    html body #page-tapparelle#page-tapparelle .tapp-btn:hover{filter:brightness(1.05)!important}
    html body #page-tapparelle#page-tapparelle .tapp-btn:active{transform:translateY(1px)!important;filter:brightness(.95)!important}
    html body #page-tapparelle#page-tapparelle .tapp-btn:focus-visible{outline:3px solid color-mix(in srgb,var(--tapp-accent) 55%,transparent)!important;outline-offset:2px!important}

    @media(max-width:560px){html body #page-tapparelle#page-tapparelle #tapp-grid{grid-template-columns:minmax(0,360px)!important;justify-content:center!important}html body #page-tapparelle#page-tapparelle .tapp-card{max-width:360px!important}html body #page-tapparelle#page-tapparelle .tapp-btn[data-all]{flex:1 1 46%!important;padding:0 10px!important;font-size:12px!important}}
    /* A movimento ridotto si ferma la decorazione (card e bottoni), mai il
     * telo che scende o la pastiglia che dice "in movimento": quelli sono lo
     * stato della finestra, disegnato. */
    @media(prefers-reduced-motion:reduce){html body #page-tapparelle#page-tapparelle .tapp-card,html body #page-tapparelle#page-tapparelle .tapp-btn{transition:none!important}}
  `);
}

export function installShutterSection() {
  if (!doc) return;
  installStyles();
  if (state.installed) return;
  state.installed = true;
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", installShutterSection, { once: true });
} else {
  installShutterSection();
}

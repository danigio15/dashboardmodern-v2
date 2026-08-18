// Visual owner of the Solar Thermal page (#page-boiler).
//
// The legacy runtime keeps every behaviour: it writes probe temperatures, the
// tank gradient variables, the pump/valve `active` classes, the comet flows and
// the nine control buttons. This module never reads or writes Home Assistant
// state and never touches an id, an onclick or a class the runtime toggles.
//
// What it owns is the scene. The synoptic is rebuilt as an isometric plant:
// the collector sits high on the left on its roof plane, the storage cylinder
// stands on the floor to the right, and the pipework runs on two 2:1 diagonals
// plus verticals, which is what makes a flat drawing read as depth.
//
// Three things make that possible without touching behaviour:
//
//   * the stage gets a fixed aspect ratio and a container-relative unit, so one
//     viewBox unit and one CSS pixel stay proportional at every width. That is
//     what lets CSS hardware and SVG pipework share one coordinate system;
//   * the pipe `d` attributes are rewritten to isometric routes. The runtime
//     only ever toggles the `active` class on those paths by id, so their
//     geometry is ours to own;
//   * a portrait route set and viewBox swap in on narrow screens, driven by a
//     media-query listener rather than polling or an observer.
//
// The only DOM it adds is hardware detail and the labelling the legacy markup
// left empty: the two pump bodies (`.syn-pump` ships as an empty div), the
// missing name labels on the solar-pump and recirculation buttons, the tank
// probe captions, the heat-exchanger coil, the pipe highlights and the header
// subtitle. It also lifts the collector readout out of the collector, so the
// isometric transform skews the panel without skewing its digits. Every
// insertion is idempotent and additive.
import { doc, installStyle, root, t, wrapFunction } from "./shared.js";

const KEY = "__DASHBOARDMODERN_SOLAR_THERMAL_DESIGN__";
const STYLE_ID = "dm-solar-thermal-design";
const SVG_NS = "http://www.w3.org/2000/svg";
const COIL_TURNS = 7;
const PORTRAIT_QUERY = "(max-width: 768px)";
const state = (root[KEY] ||= { installed: false, frame: 0, query: null });

// Isometric routes. Every diagonal is 2:1 and every riser is vertical, in the
// viewBox units of the layout it belongs to.
const LANDSCAPE = Object.freeze({
  viewBox: "0 0 1000 600",
  routes: Object.freeze({
    "flow-sol-hot": "M 350 150 L 500 225 L 700 325",
    "flow-sol-cold": "M 655 508 L 540 565 L 320 455 L 320 320 L 245 282 L 245 250",
    "flow-ricircolo": "M 762 340 L 850 384 L 850 440 L 762 484",
  }),
});

const PORTRAIT = Object.freeze({
  viewBox: "0 0 640 700",
  routes: Object.freeze({
    "flow-sol-hot": "M 350 150 L 440 195 L 440 400",
    "flow-sol-cold": "M 400 586 L 300 636 L 130 551 L 130 240 L 110 230 L 110 200",
    "flow-ricircolo": "M 512 440 L 545 457 L 545 525 L 512 542",
  }),
});

const PUMP_LABELS = [
  ["syn-p-solare", () => t("Pompa Solare", "Solar Pump")],
  ["syn-p-ricircolo", () => t("Ricircolo", "Recirculation")],
];

const BUTTON_LABELS = [
  ["b-c-pompasol", () => t("Pompa Sol.", "Solar Pump")],
  ["b-c-ricircolo", () => t("Ricircolo", "Recirc.")],
];

function stylesheet() {
  const idle = t("Impianto in attesa", "System idle");
  const recirculating = t("Ricircolo attivo", "Recirculation running");
  const charging = t("Carico solare attivo", "Solar charging");
  const safety = t("Limite di sicurezza", "Safety limit");

  return `
  /* ───────── design tokens, remapped once for the dark theme ───────── */
  #page-boiler {
    --st-panel:#ffffff;
    --st-panel-2:#f8fafc;
    --st-chip:#f1f5f9;
    --st-line:#e6ecf4;
    --st-ink:#0f172a;
    --st-ink-dim:#64748b;
    --st-floor-1:#eef3f9;
    --st-floor-2:#cfdae7;
    --st-stage-light:rgba(255,255,255,.92);
    --st-vignette:rgba(15,23,42,.14);
    --st-steel-hi:#ffffff;
    --st-steel:#c6d1de;
    --st-steel-mid:#9fb0c4;
    --st-steel-dark:#5f6d82;
    --st-rotor:#8ea0b6;
    --st-glass:rgba(255,255,255,.94);
    --st-glass-line:rgba(255,255,255,.95);
    --st-lcd:linear-gradient(180deg, rgba(9,16,30,.94), rgba(2,6,16,.96));
    --st-lcd-line:rgba(148,163,184,.40);
    --st-shade:rgba(15,23,42,.26);
  }
  html[data-theme="dark"] #page-boiler {
    --st-panel:#161f36;
    --st-panel-2:#131c30;
    --st-chip:#1f2a47;
    --st-line:#263453;
    --st-ink:#e6edf7;
    --st-ink-dim:#92a4c2;
    --st-floor-1:#16223a;
    --st-floor-2:#0a1120;
    --st-stage-light:rgba(148,163,184,.16);
    --st-vignette:rgba(0,0,0,.50);
    --st-steel-hi:#8ca0bb;
    --st-steel:#56657f;
    --st-steel-mid:#3b4860;
    --st-steel-dark:#1c2436;
    --st-rotor:#8296b3;
    --st-glass:rgba(19,28,48,.92);
    --st-glass-line:rgba(148,163,184,.24);
    --st-shade:rgba(0,0,0,.55);
  }

  /* ───────── card shell: header is full-bleed, body keeps the padding ───────── */
  #page-boiler .boiler-dashboard {
    max-width:1120px;
    padding:0;
    border-radius:32px;
    border:1px solid var(--st-line);
    background:var(--st-panel);
    box-shadow:0 30px 70px rgba(15,23,42,.10), 0 2px 6px rgba(15,23,42,.04);
  }
  html[data-theme="dark"] #page-boiler .boiler-dashboard {
    box-shadow:0 30px 70px rgba(0,0,0,.45);
  }

  #page-boiler .boiler-header {
    position:relative;
    display:block;
    margin:0;
    padding:26px 30px 24px;
    border-bottom:1px solid var(--st-line);
    background:
      radial-gradient(130% 190% at 88% -60%, rgba(249,115,22,.20), transparent 58%),
      radial-gradient(95% 150% at 2% 130%, rgba(14,165,233,.15), transparent 60%),
      var(--st-panel-2);
    overflow:hidden;
  }
  /* Decorative sun disc; purely ornamental so it stays out of the a11y tree. */
  #page-boiler .boiler-header::before {
    content:"";
    position:absolute;
    top:-96px; right:-56px;
    width:230px; height:230px;
    border-radius:50%;
    background:radial-gradient(circle at 42% 58%, rgba(251,191,36,.50), rgba(249,115,22,.18) 54%, transparent 74%);
    filter:blur(3px);
    pointer-events:none;
  }
  #page-boiler .boiler-header::after {
    content:"";
    position:absolute;
    inset:auto 0 0 0;
    height:2px;
    background:linear-gradient(90deg, #f59e0b, #f97316 34%, #0ea5e9 78%, transparent);
    opacity:.7;
  }
  #page-boiler .boiler-title {
    position:relative;
    font-size:clamp(21px, 3.3vw, 34px);
    line-height:1.1;
    letter-spacing:2px;
    background:linear-gradient(100deg, #f97316, #f59e0b 42%, #0ea5e9 105%);
    -webkit-background-clip:text;
    background-clip:text;
    -webkit-text-fill-color:transparent;
  }
  #page-boiler .dm-st-sub {
    position:relative;
    margin-top:7px;
    font-size:11px;
    font-weight:800;
    letter-spacing:1.4px;
    text-transform:uppercase;
    color:var(--st-ink-dim);
  }

  /* Live status pill. Its text comes from the runtime's own "active" classes,
     so this module keeps zero state logic. It only renders when :has() is
     available, so unsupported engines get no label instead of a stale one. */
  #page-boiler .dm-st-live { display:none; }
  @supports selector(:has(*)) {
    #page-boiler .dm-st-live {
      position:relative;
      display:inline-flex;
      align-items:center;
      gap:8px;
      margin-top:14px;
      padding:7px 15px 7px 12px;
      border-radius:999px;
      border:1px solid var(--st-line);
      background:var(--st-panel);
      box-shadow:0 6px 16px rgba(15,23,42,.07);
      font-size:10.5px;
      font-weight:900;
      letter-spacing:1.3px;
      text-transform:uppercase;
      color:var(--st-ink-dim);
    }
    #page-boiler .dm-st-live::before {
      content:"";
      width:8px; height:8px;
      border-radius:50%;
      background:currentColor;
      box-shadow:0 0 0 3px rgba(100,116,139,.16);
    }
    #page-boiler .dm-st-live::after { content:"${idle}"; }
    #page-boiler:has(#syn-p-ricircolo.active) .dm-st-live {
      color:#7c3aed;
      border-color:rgba(124,58,237,.32);
      background:rgba(124,58,237,.08);
    }
    #page-boiler:has(#syn-p-ricircolo.active) .dm-st-live::after { content:"${recirculating}"; }
    #page-boiler:has(#syn-p-solare.active) .dm-st-live {
      color:#c2410c;
      border-color:rgba(234,88,12,.34);
      background:rgba(234,88,12,.09);
    }
    #page-boiler:has(#syn-p-solare.active) .dm-st-live::after { content:"${charging}"; }
    #page-boiler:has(#syn-p-solare.active) .dm-st-live::before { animation:dmStBreathe 1.9s ease-in-out infinite; }
    #page-boiler:has(#syn-safety-icon.active) .dm-st-live {
      color:#dc2626;
      border-color:rgba(220,38,38,.38);
      background:rgba(220,38,38,.10);
    }
    #page-boiler:has(#syn-safety-icon.active) .dm-st-live::after { content:"${safety}"; }
  }
  @keyframes dmStBreathe {
    0%,100% { box-shadow:0 0 0 3px rgba(234,88,12,.20); }
    50%     { box-shadow:0 0 0 7px rgba(234,88,12,0); }
  }

  /* ───────── the isometric stage ─────────
     --st-u is one percent of the stage width and --v is one drawing unit, so
     CSS hardware and the SVG pipework scale together. The vw fallback matches
     the card's own max-width and padding; container units replace it wherever
     they exist. */
  #page-boiler .synoptic-stage {
    --st-u:min(10.76px, calc(1vw - .84px));
    --v:calc(var(--st-u) / 10);
    aspect-ratio:5 / 3;
    height:auto;
    margin:22px 22px 16px;
    border-radius:26px;
    border:1px solid var(--st-line);
    background:
      radial-gradient(120% 86% at 50% -22%, var(--st-stage-light), transparent 60%),
      radial-gradient(58% 52% at 24% 22%, rgba(251,191,36,.24), transparent 66%),
      radial-gradient(52% 50% at 74% 74%, rgba(56,189,248,.14), transparent 68%),
      linear-gradient(178deg, var(--st-floor-1), var(--st-floor-2));
    box-shadow:inset 0 1px 0 rgba(255,255,255,.7), 0 18px 42px rgba(15,23,42,.08);
  }
  @supports (width: 1cqw) {
    #page-boiler .synoptic-stage { container-type:inline-size; --st-u:1cqw; }
  }
  #page-boiler .synoptic-stage.dm-st-portrait {
    aspect-ratio:64 / 70;
    --v:calc(var(--st-u) / 6.4);
  }
  html[data-theme="dark"] #page-boiler .synoptic-stage {
    box-shadow:inset 0 1px 0 rgba(148,163,184,.10), 0 18px 42px rgba(0,0,0,.40);
  }
  #page-boiler .synoptic-stage::before {
    content:"";
    position:absolute;
    inset:0;
    pointer-events:none;
    background:radial-gradient(122% 104% at 50% 40%, transparent 42%, var(--st-vignette) 100%);
  }

  /* The pipe SVG carries preserveAspectRatio="none" and no geometry: as an
     in-flow block it kept its intrinsic ratio, so the pipework landed above the
     nodes that are positioned in percentages of the stage. Pinning it to the
     stage box is what makes both coordinate systems agree. */
  #page-boiler .syn-svg {
    position:absolute;
    inset:0;
    width:100%;
    height:100%;
    z-index:1;
  }
  /* Three coaxial strokes read as a drawn steel tube: dark shell, brushed
     body, specular line. The highlight path is injected next to each body. */
  #page-boiler .syn-pipe-bg,
  #page-boiler .syn-pipe-inner,
  #page-boiler .dm-st-pipe-hi,
  #page-boiler .syn-flow { stroke-linejoin:round; stroke-linecap:round; }
  #page-boiler .syn-pipe-bg    { stroke:var(--st-steel-dark); stroke-width:22; opacity:.9; }
  #page-boiler .syn-pipe-inner { stroke:var(--st-steel); stroke-width:15; }
  #page-boiler .dm-st-pipe-hi  { fill:none; stroke:var(--st-steel-hi); stroke-width:4; opacity:.72; }
  #page-boiler .syn-flow { stroke-width:10; stroke-dasharray:70 460; filter:drop-shadow(0 0 9px currentColor); }

  /* ───────── nodes become anchor points, hardware hangs off them ───────── */
  #page-boiler .syn-node-boiler {
    width:0; height:0;
    transform:none !important;
    z-index:2;
  }
  #page-boiler .dm-st-node-collector { left:24% !important;   top:28.33% !important; }
  #page-boiler .dm-st-node-tank      { left:70% !important;   top:65% !important; }
  #page-boiler #syn-v-chiave         { left:50% !important;   top:37.5% !important; }
  #page-boiler #syn-p-solare         { left:32% !important;   top:64.67% !important; }
  #page-boiler #syn-p-ricircolo      { left:85% !important;   top:68.67% !important; }
  /* The landscape rules are id-scoped, so the portrait overrides have to carry
     the same id to win on specificity rather than on source order. */
  #page-boiler .dm-st-portrait .dm-st-node-collector { left:31.25% !important; top:21.43% !important; }
  #page-boiler .dm-st-portrait .dm-st-node-tank      { left:70.31% !important; top:67.14% !important; }
  #page-boiler .dm-st-portrait #syn-v-chiave         { left:68.75% !important; top:27.86% !important; }
  #page-boiler .dm-st-portrait #syn-p-solare         { left:20.31% !important; top:60% !important; }
  #page-boiler .dm-st-portrait #syn-p-ricircolo      { left:85.16% !important; top:70.14% !important; }

  /* Ground patch: a square skewed onto the isometric plane. */
  #page-boiler .syn-node-boiler::after {
    content:"";
    position:absolute;
    left:calc(var(--v) * -90);
    width:calc(var(--v) * 180);
    height:calc(var(--v) * 180);
    transform:matrix(1, .5, -1, .5, 0, 0);
    background:radial-gradient(ellipse at center, var(--st-shade), transparent 68%);
    filter:blur(calc(var(--v) * 5));
    z-index:-1;
    pointer-events:none;
  }
  #page-boiler .dm-st-node-collector::after { top:calc(var(--v) * -8); opacity:.75; }
  #page-boiler .dm-st-node-tank::after      { top:calc(var(--v) * 26); }

  /* ───────── flat-plate collector, laid on the isometric plane ───────── */
  #page-boiler .syn-solar-panel {
    position:absolute;
    left:calc(var(--v) * -75);
    top:calc(var(--v) * -75);
    width:calc(var(--v) * 150);
    height:calc(var(--v) * 150);
    overflow:visible;
    border:none;
    border-radius:calc(var(--v) * 5);
    transform:matrix(1, .5, -1, .5, 0, 0);
    transition:filter .4s ease, box-shadow .4s ease;
    /* Aluminium frame with four mounting screws in the corners. */
    background:
      radial-gradient(circle at 9px 9px, #64748b 0 2px, transparent 3px),
      radial-gradient(circle at calc(100% - 9px) 9px, #64748b 0 2px, transparent 3px),
      radial-gradient(circle at 9px calc(100% - 9px), #64748b 0 2px, transparent 3px),
      radial-gradient(circle at calc(100% - 9px) calc(100% - 9px), #64748b 0 2px, transparent 3px),
      linear-gradient(135deg, #f8fafc, #d3dce7 46%, #93a3b8 100%);
    box-shadow:
      0 calc(var(--v) * 16) calc(var(--v) * 26) rgba(15,23,42,.30),
      inset 0 0 0 1px rgba(255,255,255,.7);
  }
  #page-boiler .syn-solar-panel:hover { filter:brightness(1.05); }
  #page-boiler .syn-solar-panel.active {
    box-shadow:
      0 calc(var(--v) * 16) calc(var(--v) * 30) rgba(180,83,9,.42),
      0 0 0 1px rgba(245,158,11,.5),
      inset 0 0 0 1px rgba(255,255,255,.8);
  }
  /* Absorber sheet with copper risers over the selective coating. */
  #page-boiler .syn-solar-grid {
    position:absolute;
    inset:calc(var(--v) * 8);
    border-radius:calc(var(--v) * 3);
    overflow:hidden;
    z-index:1;
    background:
      repeating-linear-gradient(90deg,
        transparent 0 calc(var(--v) * 7),
        rgba(120,53,15,.6) calc(var(--v) * 7) calc(var(--v) * 8),
        rgba(217,119,6,.8) calc(var(--v) * 8) calc(var(--v) * 9.5),
        rgba(251,191,36,.5) calc(var(--v) * 9.5) calc(var(--v) * 10),
        transparent calc(var(--v) * 10) calc(var(--v) * 17)),
      linear-gradient(150deg, #16283f 0%, #0a1220 48%, #101d31 100%);
  }
  /* Upper and lower manifolds. */
  #page-boiler .syn-solar-grid::before,
  #page-boiler .syn-solar-grid::after {
    content:"";
    position:absolute;
    left:0; right:0;
    height:calc(var(--v) * 7);
    background:linear-gradient(180deg, #fbbf24, #b45309 70%, #78350f);
    box-shadow:0 1px 3px rgba(0,0,0,.6);
  }
  #page-boiler .syn-solar-grid::before { top:calc(var(--v) * 6); }
  #page-boiler .syn-solar-grid::after  { bottom:calc(var(--v) * 6); }
  /* Cover glass: sky reflection, then a sweep while the loop charges. */
  #page-boiler .syn-solar-glass {
    position:absolute;
    inset:calc(var(--v) * 8);
    border-radius:calc(var(--v) * 3);
    overflow:hidden;
    z-index:3;
    background:linear-gradient(140deg,
      rgba(255,255,255,.42) 0 12%,
      rgba(255,255,255,.10) 12% 24%,
      rgba(255,255,255,.02) 24% 56%,
      rgba(255,255,255,.16) 56% 63%,
      rgba(255,255,255,.03) 63% 100%);
  }
  #page-boiler .syn-solar-glass::before {
    content:"";
    position:absolute;
    inset:0;
    background:linear-gradient(215deg, rgba(186,230,253,.34), transparent 46%);
    transition:background .6s ease;
  }
  #page-boiler .syn-solar-panel.active .syn-solar-glass::before {
    background:
      linear-gradient(215deg, rgba(254,215,170,.42), transparent 48%),
      radial-gradient(62% 42% at 28% 20%, rgba(251,191,36,.38), transparent 72%);
  }
  #page-boiler .syn-solar-glass::after {
    content:"";
    position:absolute;
    top:-60%; bottom:-60%;
    width:26%;
    left:-40%;
    background:linear-gradient(90deg, transparent, rgba(255,255,255,.48), transparent);
    opacity:0;
  }
  #page-boiler .syn-solar-panel.active .syn-solar-glass::after {
    opacity:1;
    animation:dmStSweep 5s ease-in-out infinite;
  }
  @keyframes dmStSweep {
    0%,66%  { left:-40%; }
    100%    { left:116%; }
  }

  /* Collector readout: lifted out of the panel so the isometric skew never
     reaches the digits. Backlit LCD, upright, floating above the roof plane. */
  #page-boiler .syn-solar-content {
    position:absolute;
    left:calc(var(--v) * -72);
    top:calc(var(--v) * -142);
    width:max(112px, calc(var(--v) * 144));
    z-index:6;
    padding:calc(var(--v) * 8) calc(var(--v) * 10) calc(var(--v) * 9);
    border-radius:calc(var(--v) * 8);
    display:grid;
    grid-template-columns:auto 1fr;
    grid-template-areas:"icon label" "icon value";
    align-items:center;
    column-gap:calc(var(--v) * 9);
    text-align:left;
    background:var(--st-lcd);
    border:1px solid var(--st-lcd-line);
    box-shadow:0 calc(var(--v) * 7) calc(var(--v) * 14) rgba(0,0,0,.42), inset 0 1px 0 rgba(255,255,255,.16);
  }
  /* Leader line down to the panel. */
  #page-boiler .syn-solar-content::after {
    content:"";
    position:absolute;
    left:50%; top:100%;
    width:1px;
    height:calc(var(--v) * 22);
    background:linear-gradient(180deg, var(--st-lcd-line), transparent);
  }
  #page-boiler .sun-icon {
    grid-area:icon;
    font-size:max(17px, calc(var(--v) * 22));
    line-height:1;
    margin:0;
  }
  #page-boiler .syn-lbl {
    grid-area:label;
    margin:0;
    font-size:max(7px, calc(var(--v) * 8));
    letter-spacing:calc(var(--v) * 1.2);
    color:#94a3b8;
    text-align:left;
  }
  #page-boiler .syn-val {
    grid-area:value;
    font-family:'Oswald', sans-serif;
    font-size:max(16px, calc(var(--v) * 21));
    font-weight:700;
    line-height:1.1;
    letter-spacing:calc(var(--v) * .9);
    text-shadow:0 0 calc(var(--v) * 11) rgba(245,158,11,.55);
  }

  /* ───────── storage cylinder standing on the floor ───────── */
  #page-boiler .syn-tank {
    position:absolute;
    left:calc(var(--v) * -62);
    top:calc(var(--v) * -110);
    width:calc(var(--v) * 124);
    height:calc(var(--v) * 220);
    padding:calc(var(--v) * 42) 0;
    border:none;
    /* Elliptical caps turn the rectangle into a cylinder on the iso plane. */
    border-radius:calc(var(--v) * 62) / calc(var(--v) * 22);
    background:linear-gradient(90deg, #8593a8, #dfe6ee 22%, #cfd9e4 52%, #9fb0c4 78%, #667287 100%);
    box-shadow:
      0 calc(var(--v) * 22) calc(var(--v) * 30) rgba(15,23,42,.32),
      inset 0 calc(var(--v) * -8) calc(var(--v) * 14) rgba(15,23,42,.26);
  }
  html[data-theme="dark"] #page-boiler .syn-tank {
    background:linear-gradient(90deg, #131b2c, #46536b 22%, #3b4760 52%, #26314a 78%, #101827 100%);
    box-shadow:
      0 calc(var(--v) * 22) calc(var(--v) * 30) rgba(0,0,0,.55),
      inset 0 calc(var(--v) * -8) calc(var(--v) * 14) rgba(0,0,0,.45);
  }
  /* Top face of the cylinder, plus the lower shadow band. */
  #page-boiler .syn-tank::before,
  #page-boiler .syn-tank::after {
    content:"";
    position:absolute;
    left:0; right:0;
    z-index:5;
    pointer-events:none;
  }
  #page-boiler .syn-tank::before {
    top:0;
    height:calc(var(--v) * 42);
    border-radius:50% / 50%;
    background:radial-gradient(60% 120% at 36% 24%, #ffffff, #cdd8e5 52%, #8d9db2 100%);
    box-shadow:inset 0 -1px 2px rgba(15,23,42,.30);
  }
  html[data-theme="dark"] #page-boiler .syn-tank::before {
    background:radial-gradient(60% 120% at 36% 24%, #7f8ea6, #46536b 52%, #202a3f 100%);
  }
  #page-boiler .syn-tank::after {
    bottom:0;
    height:calc(var(--v) * 34);
    border-radius:50% / 50%;
    background:linear-gradient(180deg, rgba(15,23,42,0), rgba(15,23,42,.34));
  }
  /* Cylindrical shading with the cutaway left clear in the middle. */
  #page-boiler .tank-glass {
    z-index:4;
    background:
      linear-gradient(90deg,
        rgba(30,41,59,.70) 0%,
        rgba(203,213,225,.88) 7%,
        rgba(255,255,255,.92) 13%,
        rgba(203,213,225,.58) 20%,
        rgba(203,213,225,0) 27%,
        rgba(203,213,225,0) 74%,
        rgba(148,163,184,.42) 83%,
        rgba(71,85,105,.70) 93%,
        rgba(15,23,42,.60) 100%),
      repeating-linear-gradient(180deg, rgba(255,255,255,.09) 0 1px, transparent 1px calc(var(--v) * 22)),
      linear-gradient(112deg, rgba(255,255,255,.30) 0 14%, rgba(255,255,255,.04) 32%, transparent 58%, rgba(15,23,42,.16) 100%);
  }
  /* Brushed steel reflects far less light in a dark room. */
  html[data-theme="dark"] #page-boiler .tank-glass {
    background:
      linear-gradient(90deg,
        rgba(2,6,16,.78) 0%,
        rgba(100,116,139,.70) 7%,
        rgba(148,163,184,.76) 13%,
        rgba(100,116,139,.46) 20%,
        rgba(100,116,139,0) 27%,
        rgba(100,116,139,0) 74%,
        rgba(51,65,85,.52) 83%,
        rgba(15,23,42,.78) 93%,
        rgba(2,6,16,.72) 100%),
      repeating-linear-gradient(180deg, rgba(148,163,184,.10) 0 1px, transparent 1px calc(var(--v) * 22)),
      linear-gradient(112deg, rgba(226,232,240,.14) 0 14%, rgba(226,232,240,.03) 32%, transparent 58%, rgba(0,0,0,.28) 100%);
  }
  /* Copper heat exchanger, seen through the cutaway. */
  #page-boiler .dm-st-coil {
    position:absolute;
    left:50%; top:50%;
    transform:translate(-50%, -50%);
    width:calc(var(--v) * 60);
    height:calc(var(--v) * 84);
    z-index:2;
    pointer-events:none;
    opacity:.7;
  }
  #page-boiler .dm-st-coil i {
    position:absolute;
    left:0; right:0;
    height:calc(var(--v) * 16);
    border-radius:50%;
    border:calc(var(--v) * 1.6) solid rgba(146,64,14,.78);
    border-top-color:rgba(251,191,36,.88);
    border-bottom-color:rgba(120,53,15,.8);
  }
  #page-boiler .dm-st-coil i:nth-child(1) { top:0; }
  #page-boiler .dm-st-coil i:nth-child(2) { top:calc(var(--v) * 11); }
  #page-boiler .dm-st-coil i:nth-child(3) { top:calc(var(--v) * 22); }
  #page-boiler .dm-st-coil i:nth-child(4) { top:calc(var(--v) * 33); }
  #page-boiler .dm-st-coil i:nth-child(5) { top:calc(var(--v) * 44); }
  #page-boiler .dm-st-coil i:nth-child(6) { top:calc(var(--v) * 55); }
  #page-boiler .dm-st-coil i:nth-child(7) { top:calc(var(--v) * 66); }

  /* Sensor readouts: lifted out of the cylinder so they read as mounted
     displays beside it rather than stickers on the shell. */
  /* Left of the shell: the right flank carries the recirculation loop. */
  #page-boiler .tank-probes {
    position:absolute;
    right:calc(var(--v) * 100);
    top:calc(var(--v) * -92);
    height:calc(var(--v) * 176);
    padding:0;
    align-items:flex-end;
    z-index:6;
  }
  #page-boiler .probe {
    position:relative;
    min-width:max(80px, calc(var(--v) * 92));
    padding:calc(var(--v) * 6) calc(var(--v) * 11) calc(var(--v) * 7);
    border-radius:calc(var(--v) * 7);
    display:flex;
    flex-direction:column;
    align-items:flex-start;
    gap:0;
    background:var(--st-lcd);
    border:1px solid var(--st-lcd-line);
    box-shadow:0 calc(var(--v) * 6) calc(var(--v) * 12) rgba(0,0,0,.42), inset 0 1px 0 rgba(255,255,255,.14);
    backdrop-filter:none;
  }
  /* Leader across to the shell. */
  #page-boiler .probe::after {
    content:"";
    position:absolute;
    left:100%; top:50%;
    width:calc(var(--v) * 44);
    height:1px;
    background:linear-gradient(90deg, var(--st-lcd-line), transparent);
  }
  #page-boiler .dm-st-probe-tag {
    font-size:max(7px, calc(var(--v) * 7.5));
    font-weight:900;
    letter-spacing:calc(var(--v) * 1.3);
    text-transform:uppercase;
    display:flex;
    align-items:center;
    gap:calc(var(--v) * 4);
  }
  #page-boiler .dm-st-probe-tag::before {
    content:"";
    width:calc(var(--v) * 5);
    height:calc(var(--v) * 5);
    border-radius:50%;
    background:currentColor;
    box-shadow:0 0 calc(var(--v) * 6) currentColor;
  }
  /* The runtime already paints the live temperature colours into these two
     variables for the tank gradient; the captions reuse them for free. */
  #page-boiler .probe:first-child .dm-st-probe-tag { color:var(--tank-top); }
  #page-boiler .probe:last-child  .dm-st-probe-tag { color:var(--tank-bottom); }
  #page-boiler .probe-val {
    font-size:max(15px, calc(var(--v) * 19));
    line-height:1.15;
    letter-spacing:calc(var(--v) * .9);
    color:#f1f5f9;
    text-shadow:0 0 calc(var(--v) * 9) rgba(226,232,240,.35);
  }

  /* Safety relief valve, tucked onto the cylinder's shoulder. */
  #page-boiler .sv-wrap {
    left:calc(var(--v) * 40);
    top:calc(var(--v) * -104);
    transform:scale(calc(var(--v) / 1.076));
    transform-origin:0 0;
  }

  /* ───────── wet-rotor circulators, upright cans on the pipe run ───────── */
  #page-boiler .syn-pump .icon {
    position:relative;
    width:calc(var(--v) * 62);
    height:calc(var(--v) * 66);
    padding-top:calc(var(--v) * 12);
    border:none;
    border-radius:calc(var(--v) * 31) / calc(var(--v) * 13);
    overflow:visible;
    background:
      repeating-radial-gradient(circle at 50% 50%, rgba(15,23,42,.08) 0 1px, transparent 1px calc(var(--v) * 4)),
      linear-gradient(90deg, #7d8ca1, #ffffff 28%, #cfd9e4 58%, #7f8ea6 100%);
    box-shadow:
      0 calc(var(--v) * 12) calc(var(--v) * 18) rgba(15,23,42,.34),
      inset 0 calc(var(--v) * -6) calc(var(--v) * 10) rgba(15,23,42,.28);
  }
  html[data-theme="dark"] #page-boiler .syn-pump .icon {
    background:
      repeating-radial-gradient(circle at 50% 50%, rgba(0,0,0,.20) 0 1px, transparent 1px calc(var(--v) * 4)),
      linear-gradient(90deg, #131b2c, #7f8ea6 28%, #46536b 58%, #161f2f 100%);
    box-shadow:
      0 calc(var(--v) * 12) calc(var(--v) * 18) rgba(0,0,0,.5),
      inset 0 calc(var(--v) * -6) calc(var(--v) * 10) rgba(0,0,0,.45);
  }
  /* Top face of the can. */
  #page-boiler .syn-pump .icon::before {
    content:"";
    position:absolute;
    left:0; right:0; top:0;
    height:calc(var(--v) * 26);
    border-radius:50% / 50%;
    background:radial-gradient(60% 120% at 36% 26%, #ffffff, #ccd7e4 54%, #90a0b5 100%);
    box-shadow:inset 0 -1px 2px rgba(15,23,42,.28);
    z-index:1;
  }
  html[data-theme="dark"] #page-boiler .syn-pump .icon::before {
    background:radial-gradient(60% 120% at 36% 26%, #7f8ea6, #46536b 54%, #1f2a3d 100%);
  }
  /* Both circulators sit on vertical risers, so their flanges face up and down. */
  #page-boiler .dm-st-flange { position:absolute; inset:0; pointer-events:none; z-index:3; }
  #page-boiler .dm-st-flange::before,
  #page-boiler .dm-st-flange::after {
    content:"";
    position:absolute;
    left:50%;
    transform:translateX(-50%);
    width:calc(var(--v) * 30);
    height:calc(var(--v) * 11);
    border-radius:calc(var(--v) * 2);
    background:linear-gradient(90deg, #8ea0b6, #f4f7fb 34%, #9fb0c4 100%);
    box-shadow:0 2px 4px rgba(15,23,42,.4);
  }
  #page-boiler .dm-st-flange::before { top:calc(var(--v) * -7); }
  #page-boiler .dm-st-flange::after  { bottom:calc(var(--v) * -7); }
  html[data-theme="dark"] #page-boiler .dm-st-flange::before,
  html[data-theme="dark"] #page-boiler .dm-st-flange::after {
    background:linear-gradient(90deg, #2c3648, #7f8ea6 34%, #3b4760 100%);
  }
  /* Terminal box with the run indicator. */
  #page-boiler .dm-st-box {
    position:absolute;
    top:calc(var(--v) * -13);
    left:50%;
    transform:translateX(-50%);
    z-index:4;
    width:calc(var(--v) * 30);
    height:calc(var(--v) * 17);
    border-radius:calc(var(--v) * 4) calc(var(--v) * 4) calc(var(--v) * 2) calc(var(--v) * 2);
    background:linear-gradient(180deg, #f8fafc, #cbd5e1 58%, #8ea0b6);
    box-shadow:0 2px 5px rgba(15,23,42,.4), inset 0 1px 0 rgba(255,255,255,.95);
  }
  html[data-theme="dark"] #page-boiler .dm-st-box {
    background:linear-gradient(180deg, #7d8ca1, #46536b 58%, #232d42);
  }
  #page-boiler .dm-st-box::after {
    content:"";
    position:absolute;
    left:50%; top:calc(var(--v) * 5);
    transform:translateX(-50%);
    width:calc(var(--v) * 6);
    height:calc(var(--v) * 6);
    border-radius:50%;
    background:#94a3b8;
    box-shadow:inset 0 1px 2px rgba(0,0,0,.45);
    transition:background .3s ease, box-shadow .3s ease;
  }
  #page-boiler .syn-pump.active .dm-st-box::after {
    background:#22c55e;
    box-shadow:0 0 calc(var(--v) * 8) rgba(34,197,94,.95);
  }
  /* Impeller on the front face; the legacy rule spins .anim-icon on .active. */
  #page-boiler .dm-st-rotor {
    position:relative;
    z-index:2;
    width:calc(var(--v) * 28);
    height:calc(var(--v) * 28);
    border-radius:50%;
    background:conic-gradient(from 0deg,
      var(--st-rotor) 0 9%, transparent 9% 25%,
      var(--st-rotor) 25% 34%, transparent 34% 50%,
      var(--st-rotor) 50% 59%, transparent 59% 75%,
      var(--st-rotor) 75% 84%, transparent 84% 100%);
    -webkit-mask:radial-gradient(circle, transparent 0 22%, #000 24%);
    mask:radial-gradient(circle, transparent 0 22%, #000 24%);
    filter:drop-shadow(0 1px 1px rgba(15,23,42,.45));
    transition:background .4s ease;
  }
  /* A running circulator stays a metal can: the state is carried by the rim
     light, the LED, the aura and the spinning impeller, not by a colour swap. */
  #page-boiler .syn-pump.active .icon {
    background:
      radial-gradient(90% 60% at 50% 120%, rgba(249,115,22,.34), transparent 64%),
      repeating-radial-gradient(circle at 50% 50%, rgba(15,23,42,.08) 0 1px, transparent 1px calc(var(--v) * 4)),
      linear-gradient(90deg, #7d8ca1, #ffffff 28%, #cfd9e4 58%, #7f8ea6 100%);
    box-shadow:
      0 calc(var(--v) * 12) calc(var(--v) * 20) rgba(194,65,12,.40),
      0 0 calc(var(--v) * 18) rgba(234,88,12,.30),
      inset 0 calc(var(--v) * -6) calc(var(--v) * 10) rgba(124,45,18,.28);
  }
  #page-boiler .syn-pump.active .dm-st-rotor { background:conic-gradient(from 0deg,
      #9a3412 0 9%, transparent 9% 25%,
      #9a3412 25% 34%, transparent 34% 50%,
      #9a3412 50% 59%, transparent 59% 75%,
      #9a3412 75% 84%, transparent 84% 100%); }
  #page-boiler .syn-pump.active .icon::after {
    content:"";
    position:absolute;
    left:50%; bottom:calc(var(--v) * -6);
    transform:translateX(-50%);
    width:calc(var(--v) * 74);
    height:calc(var(--v) * 30);
    border-radius:50%;
    border:1px solid rgba(234,88,12,.45);
    animation:dmStPulse 1.9s ease-out infinite;
    pointer-events:none;
  }
  @keyframes dmStPulse {
    0%   { transform:translateX(-50%) scale(.82); opacity:.85; }
    100% { transform:translateX(-50%) scale(1.24); opacity:0; }
  }
  #page-boiler .syn-pump .lbl,
  #page-boiler .syn-valve .lbl {
    margin-top:calc(var(--v) * 14);
    padding:calc(var(--v) * 5) calc(var(--v) * 11);
    border-radius:999px;
    font-size:max(8px, calc(var(--v) * 9));
    letter-spacing:calc(var(--v) * 1.1);
    color:var(--st-ink-dim);
    background:var(--st-glass);
    border:1px solid var(--st-glass-line);
    box-shadow:0 calc(var(--v) * 5) calc(var(--v) * 11) rgba(15,23,42,.10);
    white-space:nowrap;
  }
  #page-boiler .syn-pump.active .lbl {
    color:#c2410c;
    border-color:rgba(234,88,12,.28);
    background:rgba(255,247,237,.96);
  }
  /* Recirculation keeps its own violet identity. */
  #page-boiler #syn-p-ricircolo.active .icon {
    background:
      radial-gradient(90% 60% at 50% 120%, rgba(139,92,246,.34), transparent 64%),
      repeating-radial-gradient(circle at 50% 50%, rgba(15,23,42,.08) 0 1px, transparent 1px calc(var(--v) * 4)),
      linear-gradient(90deg, #7d8ca1, #ffffff 28%, #cfd9e4 58%, #7f8ea6 100%);
    box-shadow:
      0 calc(var(--v) * 12) calc(var(--v) * 20) rgba(109,40,217,.38),
      0 0 calc(var(--v) * 18) rgba(124,58,237,.30),
      inset 0 calc(var(--v) * -6) calc(var(--v) * 10) rgba(76,29,149,.26);
  }
  #page-boiler #syn-p-ricircolo.active .dm-st-rotor { background:conic-gradient(from 0deg,
      #5b21b6 0 9%, transparent 9% 25%,
      #5b21b6 25% 34%, transparent 34% 50%,
      #5b21b6 50% 59%, transparent 59% 75%,
      #5b21b6 75% 84%, transparent 84% 100%); }
  #page-boiler #syn-p-ricircolo.active .icon::after { border-color:rgba(124,58,237,.45); }
  #page-boiler #syn-p-ricircolo.active .lbl {
    color:#6d28d9;
    border-color:rgba(124,58,237,.28);
    background:rgba(245,243,255,.96);
  }

  /* ───────── butterfly valve: the legacy open/closed rules use !important on
     an id selector, so the housing restyle has to answer in kind ───────── */
  #page-boiler .syn-valve .icon { position:relative; }
  #page-boiler #syn-v-chiave .icon {
    width:calc(var(--v) * 54) !important;
    height:calc(var(--v) * 54) !important;
    border:none !important;
    background:
      repeating-radial-gradient(circle at 50% 50%, rgba(15,23,42,.07) 0 1px, transparent 1px calc(var(--v) * 5)),
      radial-gradient(circle at 34% 27%, #ffffff, #dde5ee 38%, #9fb0c4 74%, #5f6d82 100%) !important;
    box-shadow:
      0 calc(var(--v) * 12) calc(var(--v) * 18) rgba(15,23,42,.34),
      inset 0 0 0 calc(var(--v) * 3) rgba(255,255,255,.45) !important;
  }
  html[data-theme="dark"] #page-boiler #syn-v-chiave .icon {
    background:
      repeating-radial-gradient(circle at 50% 50%, rgba(0,0,0,.20) 0 1px, transparent 1px calc(var(--v) * 5)),
      radial-gradient(circle at 34% 27%, #7f8ea6, #4c5972 38%, #2c3648 74%, #161f2f 100%) !important;
  }
  #page-boiler #syn-v-chiave.active .icon {
    box-shadow:
      0 calc(var(--v) * 12) calc(var(--v) * 20) rgba(5,150,105,.40),
      0 0 0 2px rgba(16,185,129,.5),
      inset 0 0 0 calc(var(--v) * 3) rgba(255,255,255,.45) !important;
  }
  #page-boiler #syn-v-chiave:not(.active) .icon {
    box-shadow:
      0 calc(var(--v) * 12) calc(var(--v) * 20) rgba(190,18,60,.34),
      0 0 0 2px rgba(239,68,68,.45),
      inset 0 0 0 calc(var(--v) * 3) rgba(255,255,255,.45) !important;
  }
  #page-boiler #syn-v-chiave .valve-svg { width:70%; height:70%; }
  #page-boiler #syn-v-chiave.active .lbl {
    color:#047857;
    border-color:rgba(16,185,129,.30);
    background:rgba(240,253,244,.96);
  }
  /* Hand-lever stem, so the valve reads as a body rather than a badge. */
  #page-boiler #syn-v-chiave .icon::after {
    content:"";
    position:absolute;
    top:calc(var(--v) * -12);
    left:50%;
    transform:translateX(-50%);
    width:calc(var(--v) * 8);
    height:calc(var(--v) * 15);
    border-radius:calc(var(--v) * 3) calc(var(--v) * 3) 0 0;
    background:linear-gradient(180deg, #eef3f9, #94a3b8 60%, #5f6d82);
    box-shadow:0 2px 4px rgba(15,23,42,.4);
  }

  /* ───────── safety banner ───────── */
  #page-boiler .syn-safety-alert {
    top:16px;
    left:auto;
    right:16px;
    padding:9px 18px;
    border-radius:999px;
    border:1px solid #fca5a5;
    background:linear-gradient(135deg, #fff1f2, #fee2e2);
    color:#b91c1c;
    font-size:11px;
    letter-spacing:1.4px;
    box-shadow:0 14px 30px rgba(220,38,38,.22);
    z-index:12;
  }
  /* Own keyframes: the legacy pulseAlert animates transform, which would fight
     any positioning this banner needs. */
  #page-boiler .syn-safety-alert.active {
    animation:dmStAlert 1.8s ease-in-out infinite;
  }
  @keyframes dmStAlert {
    0%,100% { box-shadow:0 14px 30px rgba(220,38,38,.22); }
    50%     { box-shadow:0 14px 34px rgba(220,38,38,.46); }
  }

  /* ───────── statistics ───────── */
  #page-boiler .boiler-stats-row {
    display:grid;
    grid-template-columns:repeat(3, 1fr);
    gap:14px;
    margin:0 22px 16px;
  }
  #page-boiler .b-stat-card {
    position:relative;
    overflow:hidden;
    padding:19px 17px 16px;
    border-radius:22px;
    align-items:flex-start;
    text-align:left;
    gap:9px;
    background:var(--st-panel);
    border:1px solid var(--st-line);
    box-shadow:0 12px 30px rgba(15,23,42,.06);
  }
  #page-boiler .b-stat-card::before {
    content:"";
    position:absolute;
    inset:0 0 auto 0;
    height:4px;
    background:linear-gradient(90deg, var(--st-accent), transparent 88%);
  }
  #page-boiler .b-stat-card:nth-child(1) { --st-accent:#059669; }
  #page-boiler .b-stat-card:nth-child(2) { --st-accent:#0284c7; }
  #page-boiler .b-stat-card:nth-child(3) { --st-accent:#ea580c; }
  #page-boiler .b-stat-card::after {
    content:"";
    position:absolute;
    right:-40px; bottom:-52px;
    width:104px; height:104px;
    border-radius:50%;
    background:radial-gradient(circle, var(--st-accent), transparent 66%);
    opacity:.07;
    pointer-events:none;
  }
  #page-boiler .b-stat-card .lbl {
    display:flex;
    align-items:center;
    gap:7px;
    font-size:10.5px;
    letter-spacing:1.2px;
  }
  #page-boiler .b-stat-card .lbl::before { font-size:13px; line-height:1; }
  #page-boiler .b-stat-card:nth-child(1) .lbl::before { content:"🌡️"; }
  #page-boiler .b-stat-card:nth-child(2) .lbl::before { content:"💧"; }
  #page-boiler .b-stat-card:nth-child(3) .lbl::before { content:"⚡"; }
  #page-boiler .b-stat-card .val {
    font-size:clamp(23px, 2.7vw, 31px);
    line-height:1.05;
    letter-spacing:.5px;
  }
  #page-boiler .b-stat-card:hover { box-shadow:0 20px 40px rgba(15,23,42,.10); }

  /* ───────── control tiles ─────────
     Nine controls, laid out so no row is ever left with a single orphan tile:
     9 across when the card is wide, then 5+4, then 3+3+3. */
  #page-boiler .b-controls-grid {
    grid-template-columns:repeat(9, 1fr);
    gap:12px;
    margin:0 22px 24px;
  }
  @media (max-width:1080px) {
    #page-boiler .b-controls-grid { grid-template-columns:repeat(5, 1fr); }
  }
  #page-boiler .b-btn {
    position:relative;
    overflow:hidden;
    padding:16px 8px 14px;
    border-radius:22px;
    gap:9px;
    background:var(--st-panel);
    border:1px solid var(--st-line);
    box-shadow:0 10px 24px rgba(15,23,42,.05);
  }
  #page-boiler .b-btn .icon {
    width:46px; height:46px;
    display:grid;
    place-items:center;
    border-radius:16px;
    font-size:23px;
    background:var(--st-chip);
    filter:grayscale(1) opacity(.5);
    transition:.35s cubic-bezier(.165,.84,.44,1);
  }
  #page-boiler .b-btn .lbl {
    font-size:9.5px;
    letter-spacing:.5px;
    color:var(--st-ink-dim);
  }
  #page-boiler .b-btn .state {
    padding:5px 10px;
    border-radius:999px;
    font-size:9px;
    letter-spacing:.9px;
    color:var(--st-ink-dim);
    background:var(--st-chip);
    border:1px solid var(--st-line);
  }
  #page-boiler .b-btn.active {
    transform:translateY(-4px);
    border-color:rgba(var(--c-rgb), .50);
    background:linear-gradient(168deg, rgba(var(--c-rgb), .11), rgba(var(--c-rgb), .03));
    box-shadow:0 18px 34px rgba(var(--c-rgb), .22);
  }
  #page-boiler .b-btn.active .icon {
    filter:none;
    transform:scale(1.04);
    background:rgba(var(--c-rgb), .16);
    box-shadow:0 8px 18px rgba(var(--c-rgb), .28);
  }
  #page-boiler .b-btn.active .lbl { color:rgb(var(--c-rgb)); }
  #page-boiler .b-btn.active .state {
    color:rgb(var(--c-rgb));
    background:rgba(var(--c-rgb), .13);
    border-color:rgba(var(--c-rgb), .30);
  }
  #page-boiler .b-btn.active::after {
    content:"";
    position:absolute;
    top:12px; right:12px;
    width:7px; height:7px;
    border-radius:50%;
    background:rgb(var(--c-rgb));
    box-shadow:0 0 0 3px rgba(var(--c-rgb), .18);
  }
  #page-boiler .b-btn:active { transform:scale(.97); }
  /* The markup ships .spin-active/.blink-active hooks that nothing animated. */
  #page-boiler .b-btn.active .spin-active {
    display:inline-block;
    animation:spinAnim 1.6s linear infinite;
  }
  #page-boiler .b-btn.active .blink-active {
    display:inline-block;
    animation:dmStBlink 1.25s ease-in-out infinite;
  }
  @keyframes dmStBlink {
    0%,100% { opacity:1; }
    50%     { opacity:.35; }
  }

  /* ───────── compact layout ───────── */
  @media (max-width:768px) {
    #page-boiler .boiler-dashboard { border-radius:24px; }
    #page-boiler .boiler-header { padding:20px 18px 18px; }
    #page-boiler .boiler-header::before { top:-74px; right:-58px; width:180px; height:180px; }
    #page-boiler .synoptic-stage {
      --st-u:calc(1vw - .68px);
      margin:16px 14px 12px;
      border-radius:20px;
    }
    #page-boiler .syn-safety-alert { top:11px; right:11px; padding:7px 13px; font-size:9.5px; }
    #page-boiler .boiler-stats-row { gap:9px; margin:0 14px 12px; }
    #page-boiler .b-stat-card { padding:14px 12px 12px; border-radius:18px; gap:6px; }
    #page-boiler .b-stat-card .lbl { font-size:9px; letter-spacing:.6px; gap:5px; }
    #page-boiler .b-stat-card .lbl::before { font-size:11px; }
    #page-boiler .b-stat-card .val { font-size:19px; }
    #page-boiler .b-controls-grid {
      grid-template-columns:repeat(3, 1fr);
      gap:9px;
      margin:0 14px 18px;
    }
    #page-boiler .b-btn { padding:13px 6px 11px; border-radius:18px; gap:7px; }
    #page-boiler .b-btn .icon { width:38px; height:38px; border-radius:13px; font-size:19px; }
    #page-boiler .b-btn .lbl { font-size:8.5px; letter-spacing:.2px; }
    #page-boiler .b-btn .state { font-size:8px; padding:4px 8px; }
    #page-boiler .b-btn.active::after { top:9px; right:9px; width:6px; height:6px; }
  }
  @media (max-width:420px) {
    #page-boiler .dm-st-sub { font-size:9.5px; letter-spacing:1px; }
    #page-boiler .dm-st-live { margin-top:11px; font-size:9.5px; }
  }

  @media (prefers-reduced-motion: reduce) {
    #page-boiler .syn-solar-panel.active .syn-solar-glass::after,
    #page-boiler .syn-pump.active .icon::after,
    #page-boiler .syn-safety-alert.active,
    #page-boiler .b-btn.active .spin-active,
    #page-boiler .b-btn.active .blink-active { animation:none; }
  }
  `;
}

function element(tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/** Mark the two anchor nodes so the layout never depends on sibling order. */
function markNodes() {
  const panel = doc.querySelector("#page-boiler .syn-solar-panel");
  const tank = doc.querySelector("#page-boiler .syn-tank");
  panel?.closest(".syn-node-boiler")?.classList.add("dm-st-node-collector");
  tank?.closest(".syn-node-boiler")?.classList.add("dm-st-node-tank");
}

/** Give the two empty `.syn-pump` divs a circulator body and a nameplate. */
function buildPumps() {
  for (const [id, label] of PUMP_LABELS) {
    const pump = doc.getElementById(id);
    if (!pump || pump.querySelector(".icon")) continue;
    const icon = element("div", "icon");
    icon.append(
      element("span", "dm-st-flange"),
      element("span", "anim-icon dm-st-rotor"),
      element("span", "dm-st-box"),
    );
    pump.append(icon, element("div", "lbl", label()));
  }
}

/** The valve ships an icon but no nameplate. */
function nameValve() {
  const valve = doc.getElementById("syn-v-chiave");
  if (!valve || valve.querySelector(".lbl")) return;
  valve.append(element("div", "lbl", t("Chiave Solare", "Solar Valve")));
}

/** Copper heat exchanger, visible through the cylinder cutaway. */
function buildCoil() {
  const tank = doc.querySelector("#page-boiler .syn-tank");
  if (!tank || tank.querySelector(".dm-st-coil")) return;
  const coil = element("div", "dm-st-coil");
  for (let turn = 0; turn < COIL_TURNS; turn += 1) coil.append(element("i"));
  tank.prepend(coil);
}

/**
 * Lift the two readouts out of the bodies they were painted on. The collector
 * carries an isometric skew that would shear its own digits, and the cylinder
 * clips its overflow, so both readouts live on the anchor node instead.
 */
function liftReadouts() {
  const collector = doc.querySelector("#page-boiler .dm-st-node-collector");
  const readout = doc.querySelector("#page-boiler .syn-solar-content");
  if (collector && readout && readout.parentElement !== collector) collector.append(readout);

  const tankNode = doc.querySelector("#page-boiler .dm-st-node-tank");
  const probes = doc.querySelector("#page-boiler .tank-probes");
  if (tankNode && probes && probes.parentElement !== tankNode) tankNode.append(probes);
}

/** Caption the two tank probes, which only ever showed a bare temperature. */
function captionProbes() {
  const probes = doc.querySelectorAll("#page-boiler .tank-probes .probe");
  if (probes.length !== 2) return;
  const captions = [t("Alto", "Top"), t("Basso", "Bottom")];
  probes.forEach((probe, index) => {
    if (probe.querySelector(".dm-st-probe-tag")) return;
    probe.prepend(element("span", "dm-st-probe-tag", captions[index]));
  });
}

/**
 * Route the pipework on isometric axes and keep the three coaxial strokes of
 * each run in sync. The runtime only toggles `active` on the flow paths by id,
 * so their geometry belongs to this module.
 */
function routePipes(portrait) {
  const stage = doc.querySelector("#page-boiler .synoptic-stage");
  const svg = doc.querySelector("#page-boiler .syn-svg");
  if (!stage || !svg) return;
  const layout = portrait ? PORTRAIT : LANDSCAPE;

  stage.classList.toggle("dm-st-portrait", portrait);
  if (svg.getAttribute("viewBox") !== layout.viewBox) {
    svg.setAttribute("viewBox", layout.viewBox);
  }

  for (const [id, route] of Object.entries(layout.routes)) {
    const flow = doc.getElementById(id);
    if (!flow) continue;
    const run = [flow];
    let sibling = flow.previousElementSibling;
    while (
      sibling &&
      (sibling.classList.contains("syn-pipe-inner") ||
        sibling.classList.contains("syn-pipe-bg") ||
        sibling.classList.contains("dm-st-pipe-hi"))
    ) {
      run.push(sibling);
      sibling = sibling.previousElementSibling;
    }
    for (const path of run) {
      if (path.getAttribute("d") !== route) path.setAttribute("d", route);
    }
  }
}

/** Specular line along each pipe, drawn between the body and the flow comet. */
function highlightPipes() {
  for (const body of doc.querySelectorAll("#page-boiler .syn-pipe-inner")) {
    const route = body.getAttribute("d") || "";
    let highlight = body.nextElementSibling;
    if (!highlight?.classList?.contains("dm-st-pipe-hi")) {
      highlight = doc.createElementNS(SVG_NS, "path");
      highlight.setAttribute("class", "dm-st-pipe-hi");
      body.after(highlight);
    }
    if (highlight.getAttribute("d") !== route) highlight.setAttribute("d", route);
  }
}

/** Two control tiles ship an icon and a state but no name. */
function nameButtons() {
  for (const [id, label] of BUTTON_LABELS) {
    const button = doc.getElementById(id);
    if (!button || button.querySelector(".lbl")) continue;
    const stateNode = button.querySelector(".state");
    const node = element("div", "lbl", label());
    if (stateNode) button.insertBefore(node, stateNode);
    else button.append(node);
  }
}

/** Subtitle and the CSS-driven status pill for the hero header. */
function buildHeader() {
  const header = doc.querySelector("#page-boiler .boiler-header");
  if (!header || header.querySelector(".dm-st-sub")) return;
  header.append(
    element(
      "div",
      "dm-st-sub",
      t(
        "Circuito primario · Boiler · Ricircolo sanitario",
        "Primary loop · Tank · DHW recirculation",
      ),
    ),
    element("div", "dm-st-live"),
  );
}

function decorate() {
  if (!doc?.getElementById("page-boiler")) return false;
  buildHeader();
  markNodes();
  buildPumps();
  nameValve();
  buildCoil();
  liftReadouts();
  captionProbes();
  routePipes(Boolean(state.query?.matches));
  highlightPipes();
  nameButtons();
  return true;
}

function schedule() {
  if (state.frame) return;
  state.frame = root.requestAnimationFrame?.(() => {
    state.frame = 0;
    decorate();
  }) || 0;
  if (!state.frame) decorate();
}

export function installSolarThermalDesignSection() {
  installStyle(STYLE_ID, stylesheet());
  state.query ||= root.matchMedia?.(PORTRAIT_QUERY) || null;
  decorate();
  if (state.installed) return true;
  state.installed = true;
  // The portrait scene swaps in on a media-query event, never on a timer.
  state.query?.addEventListener?.("change", schedule);
  // The legacy runtime only writes text and classes into this page, so the
  // added hardware survives; re-running after a render keeps it in place if a
  // future legacy repaint ever replaces the markup.
  for (const name of ["render", "renderBoiler", "renderSolarThermal"]) {
    wrapFunction(name, `__dmSolarThermalDesign_${name}`, schedule);
  }
  return true;
}

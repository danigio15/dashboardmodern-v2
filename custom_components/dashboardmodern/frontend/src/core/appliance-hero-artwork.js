// DM-FIX-20260816B
/* Photorealistic-style hero artwork for the appliance showcase.
 *
 * Hand-built SVG product shots in the reference style (white/steel bodies,
 * dark glass, warm interiors, soft floor shadow) with named animatable groups
 * so the running state can move the actual mechanism:
 *
 *   .dmh-drum   rotating drum content (washer / dryer)
 *   .dmh-fan    oven convection fan, ventilator blades
 *   .dmh-glow   warm interior glow (oven / microwave / toaster)
 *   .dmh-ring   external heat rings (oven), robot lidar
 *   .dmh-jets   dishwasher water sprays
 *   .dmh-steam  steam / air wisps (iron, kettle, coffee, hood, AC)
 *   .dmh-light  cold interior light (fridge / freezer)
 *   .dmh-frost  frost sparkles (freezer)
 *   .dmh-screen TV screen sheen
 *   .dmh-led    status LEDs
 *   .dmh-zone   cooktop heating zones
 *   .dmh-water  boiler / kettle water
 *
 * Every SVG is self-contained (per-type def ids) inside a 240×240 viewBox and
 * is returned wrapped in `<span class="dm-hero-art" data-dm-hero="<type>">`.
 * The CSS animations live in the showcase section and only run on
 * `.is-run` / `.is-standby` cards, honouring prefers-reduced-motion.
 */
import { canonicalArtworkType } from "./appliance-artwork.js";

const FLOOR = (w = 150) =>
  `<ellipse cx="120" cy="216" rx="${w / 2}" ry="11" fill="#0f172a" opacity=".14" filter="url(#dmh-blur)"/>`;

function defs(id, extra = "") {
  return `<defs>
    <filter id="dmh-blur" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="5"/></filter>
    <linearGradient id="dmh-white-${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/><stop offset=".62" stop-color="#f3f6fa"/><stop offset="1" stop-color="#d7dee8"/>
    </linearGradient>
    <linearGradient id="dmh-steel-${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f6f8fb"/><stop offset=".5" stop-color="#dde4ec"/><stop offset="1" stop-color="#aab6c5"/>
    </linearGradient>
    <linearGradient id="dmh-steel-h-${id}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#c6cfda"/><stop offset=".18" stop-color="#f2f5f9"/><stop offset=".55" stop-color="#d4dbe4"/><stop offset=".85" stop-color="#eef2f7"/><stop offset="1" stop-color="#b7c1cd"/>
    </linearGradient>
    <linearGradient id="dmh-glass-${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1c2b42"/><stop offset=".55" stop-color="#0d1728"/><stop offset="1" stop-color="#050b16"/>
    </linearGradient>
    <radialGradient id="dmh-warm-${id}" cx=".5" cy=".55" r=".75">
      <stop offset="0" stop-color="#ffe3ae"/><stop offset=".45" stop-color="#fb923c"/><stop offset=".85" stop-color="#9a3412"/><stop offset="1" stop-color="#5f1f0a"/>
    </radialGradient>
    <radialGradient id="dmh-cool-${id}" cx=".5" cy=".42" r=".8">
      <stop offset="0" stop-color="#f0f9ff"/><stop offset=".5" stop-color="#bae6fd"/><stop offset="1" stop-color="#0e3a5c"/>
    </radialGradient>
    <linearGradient id="dmh-sheen-${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".5"/><stop offset=".35" stop-color="#ffffff" stop-opacity=".07"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    ${extra}
  </defs>`;
}

const EDGE = 'stroke="#8fa0b3" stroke-opacity=".55" stroke-width="1.5"';
const DARKEDGE = 'stroke="#22344d" stroke-opacity=".6" stroke-width="1.5"';

function led(x, y, color = "#22c55e", r = 2.6) {
  return `<circle class="dmh-led" cx="${x}" cy="${y}" r="${r}" fill="${color}"/>`;
}

function display(id, x, y, w, h, text = "") {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2.6}" fill="#0b1526"/>
    ${text ? `<text x="${x + w / 2}" y="${y + h / 2 + 3.2}" text-anchor="middle" font-family="ui-monospace,monospace" font-size="9" font-weight="700" fill="#67e8f9">${text}</text>` : `<rect x="${x + 5}" y="${y + h / 2 - 1.5}" width="${w - 10}" height="3" rx="1.5" fill="#155e75"/>`}`;
}

/* ── front-load machines (washer / dryer share the chassis) ──────────── */

function frontLoader(id, { dryer = false } = {}) {
  const drumContent = dryer
    ? `<g class="dmh-drum">
        <path d="M118 112c12-10 28-8 35 4-9 9-26 10-35-4z" fill="#e2e8f0" opacity=".9"/>
        <path d="M96 144c2-15 17-23 30-18-2 13-15 22-30 18z" fill="#cbd5e1" opacity=".85"/>
        <path d="M110 162c10-7 23-4 28 6-8 6-21 5-28-6z" fill="#f1f5f9" opacity=".8"/>
      </g>`
    : `<g class="dmh-drum">
        <circle cx="110" cy="130" r="13" fill="#3b82f6" opacity=".9"/>
        <circle cx="134" cy="147" r="11" fill="#ef4444" opacity=".85"/>
        <circle cx="117" cy="154" r="8.5" fill="#f59e0b" opacity=".9"/>
        <circle cx="133" cy="124" r="7" fill="#e0f2fe" opacity=".9"/>
        <circle cx="104" cy="147" r="6" fill="#a78bfa" opacity=".85"/>
        <path d="M100 148c7 12 26 15 37 6" stroke="#e2e8f0" stroke-width="4.5" stroke-linecap="round" fill="none" opacity=".7"/>
      </g>`;
  return `${defs(id)}
  ${FLOOR(132)}
  <rect x="52" y="30" width="136" height="180" rx="16" fill="url(#dmh-white-${id})" ${EDGE}/>
  <rect x="52" y="30" width="136" height="180" rx="16" fill="url(#dmh-sheen-${id})"/>
  <rect x="60" y="40" width="120" height="22" rx="8" fill="#eef2f7" ${EDGE}/>
  ${display(id, 104, 45, 44, 12)}
  ${led(70, 51, "#22c55e")}
  ${led(80, 51, "#94a3b8", 2.2)}
  <circle cx="169" cy="51" r="6.5" fill="#dde4ec" ${EDGE}/>
  <circle cx="120" cy="140" r="56" fill="#c3ccd7"/>
  <circle cx="120" cy="140" r="52" fill="url(#dmh-steel-h-${id})"/>
  <circle cx="120" cy="140" r="43" fill="#101d31"/>
  <circle cx="120" cy="140" r="38" fill="url(#dmh-glass-${id})"/>
  ${drumContent}
  <path d="M92 114a38 38 0 0 1 46-9" stroke="#e0f2fe" stroke-width="6" stroke-linecap="round" fill="none" opacity=".28"/>
  <circle cx="120" cy="140" r="43" fill="none" ${DARKEDGE}/>
  <path class="dmh-ring" d="M77 140a43 43 0 0 0 24 38" stroke="${dryer ? "#f59e0b" : "#0ea5e9"}" stroke-width="4.5" stroke-linecap="round" fill="none" opacity=".85"/>
  <rect x="52" y="199" width="136" height="11" rx="5.5" fill="#b9c3cf"/>
  <rect x="66" y="210" width="12" height="7" rx="2.5" fill="#8fa0b3"/><rect x="162" y="210" width="12" height="7" rx="2.5" fill="#8fa0b3"/>`;
}

/* ── dishwasher: open front with racks and jets ──────────────────────── */

function dishwasher(id) {
  return `${defs(id)}
  ${FLOOR(140)}
  <rect x="46" y="28" width="148" height="184" rx="14" fill="url(#dmh-steel-${id})" ${EDGE}/>
  <rect x="54" y="36" width="132" height="20" rx="7" fill="#eef2f7" ${EDGE}/>
  ${display(id, 100, 41, 40, 11)}
  ${led(66, 46)}
  <rect x="56" y="62" width="128" height="128" rx="9" fill="#0c1930"/>
  <rect x="60" y="66" width="120" height="120" rx="7" fill="url(#dmh-cool-${id})" opacity=".9"/>
  <rect x="60" y="66" width="120" height="120" rx="7" fill="#082033" opacity=".45"/>
  <g stroke="#9fd8f5" stroke-width="2.4" opacity=".8">
    <path d="M70 96h100M70 92c8-6 92-6 100 0" fill="none"/>
    <path d="M70 148h100M70 144c8-6 92-6 100 0" fill="none"/>
  </g>
  <g fill="#cfeefd" opacity=".85">
    <ellipse cx="94" cy="86" rx="12" ry="9"/><ellipse cx="120" cy="84" rx="11" ry="8"/><ellipse cx="145" cy="86" rx="12" ry="9"/>
    <ellipse cx="100" cy="138" rx="11" ry="8"/><ellipse cx="138" cy="138" rx="11" ry="8"/>
  </g>
  <g class="dmh-jets" stroke="#e0f7ff" stroke-linecap="round" fill="none">
    <path d="M120 178c-16-16-24-38-26-58" stroke-width="3.4" opacity=".9"/>
    <path d="M120 178c0-20 0-42 0-60" stroke-width="3.8"/>
    <path d="M120 178c16-16 24-38 26-58" stroke-width="3.4" opacity=".9"/>
    <path d="M120 178c-26-8-38-24-44-40" stroke-width="2.6" opacity=".7"/>
    <path d="M120 178c26-8 38-24 44-40" stroke-width="2.6" opacity=".7"/>
  </g>
  <circle cx="120" cy="178" r="6" fill="#d3e3ef"/>
  <rect x="46" y="196" width="148" height="16" rx="7" fill="#9fadbc"/>
  <rect x="100" y="199" width="40" height="7" rx="3.5" fill="#78899b"/>`;
}

/* ── oven: glass door, glowing interior, convection fan, heat rings ──── */

function oven(id) {
  return `${defs(
    id,
    `<radialGradient id="dmh-ovenheat-${id}" cx=".5" cy=".5" r=".5">
       <stop offset="0" stop-color="#f87171" stop-opacity="0"/><stop offset=".8" stop-color="#ef4444" stop-opacity=".0"/><stop offset=".92" stop-color="#ef4444" stop-opacity=".8"/><stop offset="1" stop-color="#ef4444" stop-opacity="0"/>
     </radialGradient>`,
  )}
  ${FLOOR(146)}
  <g class="dmh-ring">
    <circle cx="120" cy="128" r="86" fill="url(#dmh-ovenheat-${id})"/>
    <circle cx="120" cy="128" r="74" fill="none" stroke="#f87171" stroke-width="2.4" stroke-dasharray="34 26" opacity=".55"/>
  </g>
  <rect x="44" y="34" width="152" height="176" rx="13" fill="url(#dmh-steel-${id})" ${EDGE}/>
  <rect x="52" y="42" width="136" height="26" rx="8" fill="#e7ecf3" ${EDGE}/>
  <circle cx="66" cy="55" r="7" fill="#c9d2dd" ${EDGE}/><circle cx="88" cy="55" r="7" fill="#c9d2dd" ${EDGE}/>
  ${display(id, 104, 49, 44, 12)}
  <circle cx="163" cy="55" r="7" fill="#c9d2dd" ${EDGE}/><circle cx="176" cy="55" r="5" fill="#c9d2dd"/>
  <rect x="52" y="74" width="136" height="8" rx="4" fill="#c3ccd7"/>
  <rect x="54" y="88" width="132" height="112" rx="9" fill="#101d31"/>
  <rect x="60" y="94" width="120" height="100" rx="7" fill="url(#dmh-glass-${id})"/>
  <g class="dmh-glow">
    <rect x="64" y="98" width="112" height="92" rx="6" fill="url(#dmh-warm-${id})" opacity=".92"/>
    <rect x="68" y="150" width="104" height="5" rx="2.5" fill="#7c2d12" opacity=".8"/>
    <rect x="68" y="170" width="104" height="5" rx="2.5" fill="#7c2d12" opacity=".8"/>
  </g>
  <g class="dmh-fan" fill="#7c2d12" opacity=".92">
    <circle cx="120" cy="132" r="6.5" fill="#5f1f0a"/>
    <path d="M120 132 108 112a24 24 0 0 1 24 0zM120 132l20 12a24 24 0 0 1-12 20 24 24 0 0 1-8-32zM120 132l-20 12a24 24 0 0 0 12 20 24 24 0 0 0 8-32z"/>
  </g>
  <rect x="60" y="94" width="120" height="100" rx="7" fill="url(#dmh-sheen-${id})" opacity=".55"/>
  <rect x="92" y="200" width="56" height="6" rx="3" fill="#9fadbc"/>`;
}

/* ── microwave ───────────────────────────────────────────────────────── */

function microwave(id) {
  return `${defs(id)}
  ${FLOOR(150)}
  <rect x="34" y="62" width="172" height="118" rx="13" fill="url(#dmh-steel-${id})" ${EDGE}/>
  <rect x="44" y="72" width="112" height="98" rx="9" fill="#101d31"/>
  <rect x="49" y="77" width="102" height="88" rx="7" fill="url(#dmh-glass-${id})"/>
  <g class="dmh-glow">
    <rect x="53" y="81" width="94" height="80" rx="6" fill="url(#dmh-warm-${id})" opacity=".88"/>
    <ellipse class="dmh-plate" cx="100" cy="146" rx="30" ry="7" fill="#7c2d12" opacity=".85"/>
    <ellipse cx="100" cy="128" rx="16" ry="10" fill="#ffedd5" opacity=".85"/>
  </g>
  <rect x="49" y="77" width="102" height="88" rx="7" fill="url(#dmh-sheen-${id})" opacity=".5"/>
  <g stroke="#22344d" stroke-opacity=".5" stroke-width="2"><path d="M60 77v88M74 77v88M88 77v88M102 77v88M116 77v88M130 77v88M144 77v88"/></g>
  <rect x="162" y="72" width="34" height="98" rx="7" fill="#e7ecf3" ${EDGE}/>
  ${display(id, 166, 79, 26, 10)}
  ${led(170, 98)}
  <circle cx="179" cy="118" r="9" fill="#c9d2dd" ${EDGE}/>
  <circle cx="179" cy="144" r="9" fill="#c9d2dd" ${EDGE}/>
  <rect x="44" y="180" width="152" height="0" fill="none"/>
  <rect x="52" y="180" width="14" height="6" rx="2.5" fill="#8fa0b3"/><rect x="176" y="180" width="14" height="6" rx="2.5" fill="#8fa0b3"/>`;
}

/* ── fridge / freezer: open door with lit interior ───────────────────── */

function coldCabinet(id, { freezer = false } = {}) {
  const interior = freezer
    ? `<g>
        <rect x="60" y="60" width="82" height="38" rx="5" fill="#dcf3ff" opacity=".9"/>
        <rect x="60" y="104" width="82" height="38" rx="5" fill="#cdeefd" opacity=".9"/>
        <rect x="60" y="148" width="82" height="42" rx="5" fill="#dcf3ff" opacity=".9"/>
        <rect x="82" y="74" width="38" height="6" rx="3" fill="#7fc8e8"/>
        <rect x="82" y="118" width="38" height="6" rx="3" fill="#7fc8e8"/>
        <rect x="82" y="164" width="38" height="6" rx="3" fill="#7fc8e8"/>
        <g class="dmh-frost" fill="#eefaff">
          <path d="M70 52l3 6h-6zM128 96l3 6h-6zM76 140l3 6h-6zM124 186l3 6h-6z"/>
        </g>
      </g>`
    : `<g>
        <rect x="58" y="94" width="86" height="5" rx="2.5" fill="#e8f4fd" opacity=".95"/>
        <rect x="58" y="132" width="86" height="5" rx="2.5" fill="#e8f4fd" opacity=".95"/>
        <rect x="58" y="170" width="86" height="5" rx="2.5" fill="#e8f4fd" opacity=".95"/>
        <g opacity=".97">
          <rect x="66" y="70" width="10" height="24" rx="4" fill="#4ade80"/>
          <rect x="80" y="64" width="10" height="30" rx="4" fill="#fbbf24"/>
          <rect x="94" y="72" width="12" height="22" rx="4" fill="#f87171"/>
          <rect x="112" y="68" width="9" height="26" rx="3.5" fill="#93c5fd"/>
          <ellipse cx="74" cy="122" rx="9" ry="8" fill="#fde68a"/>
          <ellipse cx="94" cy="121" rx="10" ry="9" fill="#fca5a5"/>
          <ellipse cx="116" cy="123" rx="8" ry="7" fill="#a7f3d0"/>
          <rect x="64" y="152" width="12" height="18" rx="4" fill="#bfdbfe"/>
          <rect x="82" y="155" width="14" height="15" rx="4" fill="#fdba74"/>
          <rect x="102" y="150" width="11" height="20" rx="4" fill="#f9a8d4"/>
        </g>
      </g>`;
  return `${defs(id)}
  ${FLOOR(140)}
  <rect x="46" y="24" width="110" height="188" rx="12" fill="url(#dmh-steel-${id})" ${EDGE}/>
  <rect x="52" y="30" width="98" height="176" rx="8" fill="#22344d"/>
  <rect x="55" y="33" width="92" height="170" rx="6" fill="#0e1c30"/>
  <g class="dmh-light">
    <rect x="57" y="35" width="88" height="166" rx="5" fill="url(#dmh-cool-${id})"/>
    <rect x="57" y="35" width="88" height="166" rx="5" fill="#7dd3fc" opacity=".14"/>
    ${interior}
  </g>
  <path d="M156 22 204 44v168l-48 2z" fill="url(#dmh-steel-h-${id})" ${EDGE}/>
  <path d="M160 30 198 48v156l-38 2z" fill="none" stroke="#8fa0b3" stroke-opacity=".45" stroke-width="1.5"/>
  <rect x="188" y="78" width="7" height="64" rx="3.5" fill="#e7ecf3" ${EDGE}/>
  <path d="M156 22 204 44" stroke="#c3ccd7" stroke-width="3"/>
  ${led(64, 44, freezer ? "#38bdf8" : "#22c55e", 2.6)}
  <rect x="58" y="212" width="13" height="7" rx="2.5" fill="#8fa0b3"/><rect x="132" y="212" width="13" height="7" rx="2.5" fill="#8fa0b3"/><rect x="186" y="212" width="13" height="7" rx="2.5" fill="#8fa0b3"/>`;
}

/* ── cooktop ─────────────────────────────────────────────────────────── */

function cooktop(id) {
  return `${defs(id)}
  ${FLOOR(150)}
  <g transform="skewX(-4)">
  <rect x="42" y="86" width="172" height="96" rx="10" fill="#0b1526" ${DARKEDGE}/>
  <rect x="48" y="92" width="160" height="84" rx="7" fill="url(#dmh-glass-${id})"/>
  <rect x="48" y="92" width="160" height="84" rx="7" fill="url(#dmh-sheen-${id})" opacity=".4"/>
  <g class="dmh-zone">
    <circle cx="92" cy="118" r="19" fill="none" stroke="#f97316" stroke-width="4" opacity=".95"/>
    <circle cx="92" cy="118" r="10" fill="none" stroke="#fb923c" stroke-width="3" opacity=".8"/>
    <circle cx="164" cy="150" r="15" fill="none" stroke="#f97316" stroke-width="3.4" opacity=".85"/>
  </g>
  <circle cx="164" cy="118" r="17" fill="none" stroke="#334155" stroke-width="3.4"/>
  <circle cx="92" cy="152" r="13" fill="none" stroke="#334155" stroke-width="3"/>
  ${display(id, 112, 160, 32, 10)}
  </g>`;
}

/* ── hood ────────────────────────────────────────────────────────────── */

function hood(id) {
  return `${defs(id)}
  ${FLOOR(140)}
  <rect x="104" y="24" width="32" height="64" fill="url(#dmh-steel-h-${id})" ${EDGE}/>
  <path d="M52 130 74 92h92l22 38z" fill="url(#dmh-steel-${id})" ${EDGE}/>
  <rect x="46" y="130" width="148" height="18" rx="7" fill="#e7ecf3" ${EDGE}/>
  <rect x="58" y="135" width="56" height="8" rx="4" fill="#f8fafc" opacity=".9"/>
  ${led(174, 139, "#fbbf24", 3)}
  ${led(160, 139, "#fbbf24", 3)}
  <g class="dmh-steam" stroke="#94a3b8" stroke-width="4" stroke-linecap="round" fill="none" opacity=".65">
    <path d="M86 196c-6-12 6-18 0-32"/>
    <path d="M120 200c-6-14 6-20 0-36"/>
    <path d="M154 196c-6-12 6-18 0-32"/>
  </g>`;
}

/* ── iron ────────────────────────────────────────────────────────────── */

function iron(id) {
  return `${defs(id)}
  ${FLOOR(146)}
  <g class="dmh-steam" stroke="#b6c3d2" stroke-width="4.5" stroke-linecap="round" fill="none" opacity=".7">
    <path d="M76 200c-5-10 5-14 0-26"/><path d="M106 206c-5-11 5-15 0-28"/><path d="M138 202c-5-10 5-14 0-26"/>
  </g>
  <path d="M66 82c14-16 38-24 62-20l44 8c12 2 20 10 22 22l4 24H60z" fill="url(#dmh-steel-h-${id})" ${EDGE}/>
  <path d="M84 62c-22 4-36 20-40 36l-2 18h28l4-30c2-12 10-20 22-22z" fill="#0ea5e9" opacity=".88"/>
  <path d="M100 66c26-14 62-8 78 12" stroke="#f8fafc" stroke-width="5" stroke-linecap="round" fill="none" opacity=".6"/>
  <rect x="130" y="84" width="36" height="13" rx="6.5" fill="#e7ecf3" ${EDGE}/>
  ${led(176, 90, "#f59e0b", 3)}
  <path d="M42 132c2-9 10-16 20-16h136l-4 20c-2 8-9 14-17 14H50c-6 0-9-5-8-10z" fill="url(#dmh-white-${id})" ${EDGE}/>
  <path d="M40 156h160" stroke="#8fa0b3" stroke-width="4" stroke-linecap="round"/>
  <circle cx="72" cy="140" r="2.6" fill="#94a3b8"/><circle cx="94" cy="142" r="2.6" fill="#94a3b8"/><circle cx="118" cy="143" r="2.6" fill="#94a3b8"/><circle cx="142" cy="142" r="2.6" fill="#94a3b8"/>`;
}

/* ── vacuums ─────────────────────────────────────────────────────────── */

function vacuum(id) {
  return `${defs(id)}
  ${FLOOR(126)}
  <path d="M130 26h22" stroke="#334155" stroke-width="9" stroke-linecap="round"/>
  <rect x="136" y="30" width="10" height="58" rx="5" fill="#475569"/>
  <rect x="118" y="84" width="46" height="76" rx="15" fill="url(#dmh-white-${id})" ${EDGE}/>
  <rect x="118" y="84" width="46" height="76" rx="15" fill="url(#dmh-sheen-${id})"/>
  <rect x="126" y="96" width="30" height="44" rx="11" fill="url(#dmh-cool-${id})" opacity=".92"/>
  <rect x="126" y="96" width="30" height="44" rx="11" fill="none" ${DARKEDGE}/>
  <path class="dmh-drum" d="M141 102c8 6 8 10 0 16-8 6-8 10 0 16" stroke="#0ea5e9" stroke-width="3.6" fill="none" stroke-linecap="round"/>
  ${led(141, 150, "#22c55e", 3)}
  <path d="M134 160c-4 16-16 24-36 28" stroke="#475569" stroke-width="9" fill="none" stroke-linecap="round"/>
  <rect x="62" y="184" width="66" height="16" rx="8" fill="url(#dmh-steel-h-${id})" ${EDGE}/>
  <rect x="70" y="198" width="50" height="6" rx="3" fill="#8fa0b3"/>
  <g class="dmh-steam" stroke="#b6c3d2" stroke-width="3.6" stroke-linecap="round" fill="none" opacity=".65">
    <path d="M56 176c4-6 12-8 18-6"/><path d="M140 180c4-6 12-8 18-6"/>
  </g>`;
}

function robotVacuum(id) {
  return `${defs(id)}
  ${FLOOR(148)}
  <ellipse cx="120" cy="150" rx="72" ry="42" fill="url(#dmh-white-${id})" ${EDGE}/>
  <ellipse cx="120" cy="140" rx="72" ry="40" fill="url(#dmh-steel-${id})" ${EDGE}/>
  <ellipse cx="120" cy="136" rx="56" ry="30" fill="#eef2f7"/>
  <g class="dmh-ring">
    <circle cx="120" cy="126" r="17" fill="#101d31"/>
    <circle cx="120" cy="126" r="17" fill="none" stroke="#38bdf8" stroke-width="3" stroke-dasharray="16 12"/>
  </g>
  <circle cx="120" cy="126" r="6" fill="#38bdf8"/>
  ${led(88, 142, "#22c55e", 3)}
  ${led(152, 142, "#f59e0b", 3)}
  <path d="M58 164c14 10 34 16 62 16s48-6 62-16" stroke="#8fa0b3" stroke-width="3" fill="none" opacity=".7"/>`;
}

/* ── climate ─────────────────────────────────────────────────────────── */

function airConditioner(id) {
  return `${defs(id)}
  ${FLOOR(150)}
  <rect x="36" y="56" width="168" height="64" rx="22" fill="url(#dmh-white-${id})" ${EDGE}/>
  <rect x="36" y="56" width="168" height="64" rx="22" fill="url(#dmh-sheen-${id})"/>
  <path d="M48 104h124" stroke="#c3ccd7" stroke-width="3"/>
  <rect x="48" y="108" width="110" height="7" rx="3.5" fill="#101d31"/>
  ${display(id, 168, 68, 24, 11)}
  ${led(176, 92, "#38bdf8", 2.6)}
  <g class="dmh-steam" stroke="#7dd3fc" stroke-width="5" stroke-linecap="round" fill="none" opacity=".8">
    <path d="M76 132c-8 16 8 24 0 42"/>
    <path d="M120 134c-8 18 8 26 0 46"/>
    <path d="M164 132c-8 16 8 24 0 42"/>
  </g>`;
}

function ventilator(id) {
  return `${defs(id)}
  ${FLOOR(120)}
  <circle cx="120" cy="102" r="58" fill="#e7ecf3" ${EDGE}/>
  <circle cx="120" cy="102" r="50" fill="#0b1526" opacity=".08"/>
  <g class="dmh-fan">
    <path d="M120 102c4-30-4-44-18-44-12 0-12 18 2 30zM120 102c30 4 44-4 44-18 0-12-18-12-30 2zM120 102c-4 30 4 44 18 44 12 0 12-18-2-30zM120 102c-30-4-44 4-44 18 0 12 18 12 30-2z" fill="#9cd3f0" opacity=".95"/>
    <circle cx="120" cy="102" r="10" fill="url(#dmh-steel-${id})"/>
  </g>
  <circle cx="120" cy="102" r="58" fill="none" stroke="#8fa0b3" stroke-width="2" stroke-dasharray="3 7"/>
  <path d="M120 160v34" stroke="#8fa0b3" stroke-width="7"/>
  <path d="M92 208c16-8 40-8 56 0" stroke="#8fa0b3" stroke-width="7" stroke-linecap="round" fill="none"/>`;
}

/* ── boiler ──────────────────────────────────────────────────────────── */

function boiler(id) {
  return `${defs(id)}
  ${FLOOR(116)}
  <rect x="70" y="26" width="100" height="168" rx="46" fill="url(#dmh-white-${id})" ${EDGE}/>
  <rect x="70" y="26" width="100" height="168" rx="46" fill="url(#dmh-sheen-${id})"/>
  <circle cx="120" cy="98" r="34" fill="#eef2f7" ${EDGE}/>
  <g class="dmh-water">
    <circle cx="120" cy="98" r="27" fill="url(#dmh-cool-${id})"/>
    <path d="M96 100c8-7 16 4 24-2s16-2 24 2v10a27 27 0 0 1-48 0z" fill="#38bdf8" opacity=".75"/>
  </g>
  ${display(id, 104, 148, 32, 11)}
  ${led(120, 170, "#f59e0b", 3)}
  <path d="M96 194v14M144 194v14" stroke="#8fa0b3" stroke-width="7" stroke-linecap="round"/>`;
}

/* ── boiler d'accumulo ───────────────────────────────────────────────── */

/* Il cilindrone a pavimento del solare termico: manometro in alto, acqua che
 * ondeggia in basso, tubi di mandata e ritorno sul fianco. */
function storageBoiler(id) {
  return `${defs(id)}
  ${FLOOR(120)}
  <rect x="62" y="18" width="116" height="184" rx="54" fill="url(#dmh-white-${id})" ${EDGE}/>
  <rect x="62" y="18" width="116" height="184" rx="54" fill="url(#dmh-sheen-${id})"/>
  <circle cx="120" cy="72" r="26" fill="#eef2f7" ${EDGE}/>
  <circle cx="120" cy="72" r="19" fill="url(#dmh-cool-${id})"/>
  <path d="M120 72l11-11" stroke="#0f2942" stroke-width="4" stroke-linecap="round"/>
  <g class="dmh-water">
    <path d="M74 138c14-10 26 6 40-2s24-4 38 2v22a46 46 0 0 1-46 40 46 46 0 0 1-46-40z" fill="#38bdf8" opacity=".7"/>
    <path d="M80 152c12-7 22 4 34-1s20-3 32 1" stroke="#e0f2fe" stroke-width="4" stroke-linecap="round" fill="none"/>
  </g>
  ${display(id, 100, 108, 40, 12)}
  ${led(120, 96, "#f59e0b", 3)}
  <path d="M178 58h26M178 152h26" stroke="#8fa0b3" stroke-width="8" stroke-linecap="round"/>
  <path d="M92 202v12M148 202v12" stroke="#8fa0b3" stroke-width="7" stroke-linecap="round"/>`;
}

/* ── friggitrice ad aria ─────────────────────────────────────────────── */

/* Il corpo a uovo, l'anello dei comandi, il cassetto del cestello con la
 * maniglia, e l'aria calda che gira quando lavora. */
function airFryer(id) {
  return `${defs(id)}
  ${FLOOR(120)}
  <path d="M84 34h72c22 0 34 18 34 40v58c0 34-28 62-62 62h-16c-34 0-62-28-62-62V74c0-22 12-40 34-40z" fill="url(#dmh-white-${id})" ${EDGE}/>
  <path d="M84 34h72c22 0 34 18 34 40v58c0 34-28 62-62 62h-16c-34 0-62-28-62-62V74c0-22 12-40 34-40z" fill="url(#dmh-sheen-${id})"/>
  <rect x="84" y="48" width="72" height="34" rx="17" fill="#101d31" ${DARKEDGE}/>
  <circle cx="120" cy="65" r="12" fill="url(#dmh-cool-${id})"/>
  <circle class="dmh-fan" cx="120" cy="65" r="7" fill="none" stroke="#e0f2fe" stroke-width="3" stroke-dasharray="5 6"/>
  <g class="dmh-glow">
    <path d="M76 110c6 8 6 16 0 24M120 106c6 10 6 20 0 30M164 110c6 8 6 16 0 24" stroke="#f59e0b" stroke-width="5" stroke-linecap="round" fill="none" opacity=".55"/>
  </g>
  <path d="M62 150h116v6a44 44 0 0 1-44 38h-28a44 44 0 0 1-44-38z" fill="#eef2f7" ${EDGE}/>
  <rect x="98" y="160" width="44" height="14" rx="7" fill="#101d31"/>
  ${led(120, 142, "#22c55e", 3)}`;
}

/* ── tv ──────────────────────────────────────────────────────────────── */

function television(id) {
  return `${defs(id)}
  ${FLOOR(150)}
  <rect x="30" y="44" width="180" height="112" rx="8" fill="#101d31" ${DARKEDGE}/>
  <rect x="36" y="50" width="168" height="100" rx="5" fill="url(#dmh-glass-${id})"/>
  <g class="dmh-screen">
    <rect x="36" y="50" width="168" height="100" rx="5" fill="url(#dmh-cool-${id})" opacity=".55"/>
    <path d="M36 88c40-26 96-30 168-12v74H36z" fill="#0ea5e9" opacity=".35"/>
    <circle cx="76" cy="84" r="12" fill="#fbbf24" opacity=".8"/>
  </g>
  <rect x="36" y="50" width="168" height="100" rx="5" fill="url(#dmh-sheen-${id})" opacity=".5"/>
  ${led(120, 160, "#22c55e", 2.4)}
  <path d="M120 156v28" stroke="#334155" stroke-width="8"/>
  <path d="M84 196h72" stroke="#334155" stroke-width="8" stroke-linecap="round"/>`;
}

/* ── small kitchen ───────────────────────────────────────────────────── */

function coffee(id) {
  return `${defs(id)}
  ${FLOOR(120)}
  <rect x="70" y="30" width="100 " height="34" rx="10" fill="url(#dmh-steel-${id})" ${EDGE}/>
  <rect x="86" y="64" width="68" height="66" rx="8" fill="url(#dmh-white-${id})" ${EDGE}/>
  ${display(id, 100, 72, 40, 11)}
  ${led(120, 94, "#f59e0b", 3)}
  <path d="M112 104h16v8a8 8 0 0 1-16 0z" fill="#8fa0b3"/>
  <g class="dmh-steam" stroke="#b6c3d2" stroke-width="3.4" stroke-linecap="round" fill="none" opacity=".75">
    <path d="M112 136c-4-8 4-10 0-18"/><path d="M126 138c-4-9 4-11 0-20"/>
  </g>
  <path class="dmh-jets" d="M120 116v22" stroke="#7c4a03" stroke-width="4" stroke-linecap="round"/>
  <path d="M96 142h48l-5 22c-1 5-5 8-10 8h-18c-5 0-9-3-10-8z" fill="#f8fafc" ${EDGE}/>
  <path d="M144 146h10a9 9 0 0 1 0 18h-8" stroke="#c3ccd7" stroke-width="5" fill="none"/>
  <rect x="62" y="176" width="116" height="20" rx="8" fill="url(#dmh-steel-${id})" ${EDGE}/>`;
}

function toaster(id) {
  return `${defs(id)}
  ${FLOOR(134)}
  <path d="M84 58c0-18 14-30 36-30s36 12 36 30v14H84z" fill="#e9b98a"/>
  <path d="M92 58c0-13 11-22 28-22s28 9 28 22v12H92z" fill="#f6dab7"/>
  <rect x="48" y="70" width="144" height="112" rx="26" fill="url(#dmh-steel-h-${id})" ${EDGE}/>
  <rect x="48" y="70" width="144" height="112" rx="26" fill="url(#dmh-sheen-${id})" opacity=".7"/>
  <g class="dmh-glow">
    <rect x="76" y="76" width="38" height="9" rx="4.5" fill="#f97316" opacity=".9"/>
    <rect x="126" y="76" width="38" height="9" rx="4.5" fill="#f97316" opacity=".9"/>
  </g>
  <rect x="196" y="96" width="10" height="26" rx="4" fill="#334155"/>
  <circle cx="176" cy="150" r="11" fill="#c9d2dd" ${EDGE}/>
  ${led(154, 150, "#f59e0b", 3)}
  <rect x="60" y="182" width="14" height="8" rx="3" fill="#8fa0b3"/><rect x="166" y="182" width="14" height="8" rx="3" fill="#8fa0b3"/>`;
}

function kettle(id) {
  return `${defs(id)}
  ${FLOOR(116)}
  <g class="dmh-steam" stroke="#b6c3d2" stroke-width="4" stroke-linecap="round" fill="none" opacity=".75">
    <path d="M96 44c-5-10 5-14 0-26"/><path d="M120 40c-5-11 5-15 0-28"/>
  </g>
  <path d="M78 62h84c6 0 10 5 9 11l-10 96c-1 8-8 14-16 14h-50c-8 0-15-6-16-14l-10-96c-1-6 3-11 9-11z" fill="url(#dmh-steel-h-${id})" ${EDGE}/>
  <path d="M74 56h92v10H74z" rx="4" fill="#334155"/>
  <path d="M98 42c0-8 6-14 22-14s22 6 22 14v14H98z" fill="#101d31"/>
  <path d="M162 78c22 4 26 34 4 44" stroke="#334155" stroke-width="8" fill="none" stroke-linecap="round"/>
  <g class="dmh-water">
    <rect x="86" y="118" width="68" height="42" rx="8" fill="url(#dmh-cool-${id})" opacity=".9"/>
    <circle class="dmh-frost" cx="100" cy="146" r="3.4" fill="#e0f2fe"/>
    <circle class="dmh-frost" cx="118" cy="152" r="2.6" fill="#e0f2fe"/>
    <circle class="dmh-frost" cx="134" cy="144" r="3" fill="#e0f2fe"/>
  </g>
  ${led(120, 172, "#38bdf8", 3)}`;
}

/* ── generic plug ────────────────────────────────────────────────────── */

function generic(id) {
  return `${defs(id)}
  ${FLOOR(120)}
  <rect x="64" y="42" width="112" height="152" rx="20" fill="url(#dmh-white-${id})" ${EDGE}/>
  <rect x="64" y="42" width="112" height="152" rx="20" fill="url(#dmh-sheen-${id})"/>
  <circle cx="120" cy="108" r="34" fill="#eef2f7" ${EDGE}/>
  <path d="M120 84v22" stroke="#0ea5e9" stroke-width="6" stroke-linecap="round"/>
  <path d="M104 96a22 22 0 1 0 32 0" stroke="#0ea5e9" stroke-width="6" stroke-linecap="round" fill="none"/>
  ${display(id, 96, 156, 48, 12)}
  ${led(120, 180, "#22c55e", 3)}`;
}

const BUILDERS = {
  washer: (id) => frontLoader(id),
  dryer: (id) => frontLoader(id, { dryer: true }),
  dishwasher,
  oven,
  microwave,
  fridge: (id) => coldCabinet(id),
  freezer: (id) => coldCabinet(id, { freezer: true }),
  cooktop,
  hood,
  iron,
  vacuum,
  "robot-vacuum": robotVacuum,
  "air-conditioner": airConditioner,
  fan: ventilator,
  boiler,
  "storage-boiler": storageBoiler,
  "air-fryer": airFryer,
  television,
  coffee,
  toaster,
  kettle,
  generic,
};

export const HERO_ARTWORK_TYPES = Object.freeze(Object.keys(BUILDERS));

/* Un nome buono per un id dentro un SVG: lettere, cifre e trattini. */
const perId = (valore) =>
  String(valore || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * `freezerHint` lets callers keep congelatore visually distinct even though
 * canonicalArtworkType folds it into "fridge".
 *
 * `chiave` distingue due disegni dello stesso tipo che stanno nella pagina
 * insieme: i gradienti vivono in `<defs>` e ci si punta per id, quindi due
 * lavatrici con gli stessi id si ruberebbero le sfumature.
 *
 * Quella chiave era un contatore che saliva a ogni chiamata, e il prezzo non
 * si vedeva da qui: rendeva il markup DIVERSO A OGNI CHIAMATA, a parita' di
 * tutto. Chi disegna la vetrina prende l'impronta del markup per non rifare
 * schede che non sono cambiate — e quell'impronta non poteva mai coincidere.
 * Ogni elettrodomestico si rifaceva da zero a ogni giro di disegno, con la
 * pagina chiusa, per sempre. Misurato: sei millisecondi a giro contro uno, e
 * il giro intero della plancia dimezzato togliendolo.
 *
 * L'identita' ce l'ha gia' chi chiama — un elettrodomestico ha il suo id — e
 * un'identita' stabile e' l'unica che serva: due disegni della stessa cosa
 * possono anche condividere le sfumature, perche' sono le stesse.
 */
export function applianceHeroArtwork(type, size = 170, { freezer = false, chiave = "" } = {}) {
  let canonical = canonicalArtworkType(type) || "generic";
  if (canonical === "fridge" && (freezer || /congel|freez/i.test(String(type || "")))) {
    canonical = "freezer";
  }
  const builder = BUILDERS[canonical] || BUILDERS.generic;
  const suo = perId(chiave);
  const id = suo ? `${canonical}-${suo}` : canonical;
  return `<span class="dm-hero-art" data-dm-hero="${canonical}"><svg width="${size}" height="${size}" viewBox="0 0 240 240" role="img" aria-hidden="true">${builder(id)}</svg></span>`;
}

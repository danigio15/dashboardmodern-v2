/* I disegni di tutto il resto, nella stessa famiglia degli elettrodomestici.
 *
 * «Le icone non sono stilizzate nello stesso modo: crea un catalogo
 * proprietario nostro e crea le icone sullo stesso stile degli
 * elettrodomestici, su tutto il catalogo non ci devono essere differenze.»
 *
 * Nella stessa schermata convivevano tre stili: la scocca blu notte degli
 * elettrodomestici, il tratto sottile delle stanze, e le emoji del sistema per
 * le azioni e i carichi — che per giunta cambiano faccia da un telefono a un
 * altro, quindi la stessa plancia non era uguale nemmeno a se stessa.
 *
 * Qui ci sono i disegni che mancavano, fatti con la tavolozza di quelli degli
 * elettrodomestici: stesso riquadro, stessa scocca, stesso frontale, stesso
 * accento. Chi cerca un disegno lo chiede a un posto solo, e quello che esce
 * somiglia a tutto il resto.
 */
import {
  ACCENTO,
  CALDO,
  FRONTALE,
  PANNELLO,
  SCOCCA,
  SPENTO,
  TRATTO,
  TRATTO_ACCENTO,
  TRATTO_CHIARO,
  VERDE,
  VETRO,
  guscio,
} from "./tavolozza-disegni.js";

/* Le forme. Ognuna parte dal pannello e sta dentro il riquadro 96x96, con il
 * peso visivo attorno al centro: cosi' a 32 pixel si legge come a 96. */
const CORPI = Object.freeze({
  home: `${PANNELLO}<path ${SCOCCA} d="M48 12 14 41v39a6 6 0 0 0 6 6h56a6 6 0 0 0 6-6V41z"/><path ${FRONTALE} d="M40 56h16v30H40z"/><rect ${VETRO} x="24" y="48" width="12" height="12" rx="3"/><rect ${VETRO} x="60" y="48" width="12" height="12" rx="3"/><circle ${ACCENTO} cx="52" cy="71" r="2.6"/>`,

  lights: `${PANNELLO}<path ${CALDO} d="M48 12c14 0 23 10 23 22 0 9-5 13-8 19H33c-3-6-8-10-8-19 0-12 9-22 23-22Z"/><path ${SCOCCA} d="M33 58h30v8H33z" rx="3"/><rect ${SCOCCA} x="35" y="68" width="26" height="7" rx="3"/><rect ${SCOCCA} x="38" y="77" width="20" height="7" rx="3"/><path ${TRATTO_CHIARO} d="M41 30c3-4 8-6 13-5"/>`,

  "lights-group": `${PANNELLO}<path ${CALDO} d="M31 15c10 0 16 7 16 15 0 6-3 9-5 13H20c-2-4-5-7-5-13 0-8 6-15 16-15Z"/><rect ${SCOCCA} x="21" y="45" width="20" height="6" rx="3"/><rect ${SCOCCA} x="24" y="53" width="14" height="5" rx="2.5"/><path ${CALDO} d="M67 34c10 0 16 7 16 15 0 6-3 9-5 13H56c-2-4-5-7-5-13 0-8 6-15 16-15Z"/><rect ${SCOCCA} x="57" y="64" width="20" height="6" rx="3"/><rect ${SCOCCA} x="60" y="72" width="14" height="5" rx="2.5"/>`,

  radiator: `${PANNELLO}<rect ${SCOCCA} x="14" y="22" width="68" height="52" rx="10"/><rect ${FRONTALE} x="22" y="29" width="7" height="38" rx="3.5"/><rect ${FRONTALE} x="34" y="29" width="7" height="38" rx="3.5"/><rect ${FRONTALE} x="46" y="29" width="7" height="38" rx="3.5"/><rect ${FRONTALE} x="58" y="29" width="7" height="38" rx="3.5"/><rect ${ACCENTO} x="70" y="29" width="7" height="38" rx="3.5"/><path ${TRATTO} d="M26 80h44"/>`,

  security: `${PANNELLO}<path ${SCOCCA} d="M48 10 18 22v24c0 18 12 32 30 40 18-8 30-22 30-40V22z"/><path ${TRATTO_CHIARO} d="M34 47l10 11 19-21"/>`,

  /* La porta, che non c'era.
   *
   * C'era solo il cancello, e teneva per se' anche l'emoji della porta: chi
   * configurava una porta si ritrovava le stecche del cancello. */
  door: `${PANNELLO}<rect ${SCOCCA} x="24" y="12" width="48" height="72" rx="8"/><rect ${FRONTALE} x="31" y="19" width="34" height="58" rx="5"/><circle ${ACCENTO} cx="58" cy="50" r="3.6"/><path ${TRATTO_CHIARO} d="M38 26h20M38 34h20"/>`,

  gate: `${PANNELLO}<rect ${SCOCCA} x="12" y="24" width="8" height="56" rx="4"/><rect ${SCOCCA} x="76" y="24" width="8" height="56" rx="4"/><rect ${FRONTALE} x="24" y="34" width="48" height="38" rx="6"/><path ${TRATTO} d="M32 34v38M42 34v38M52 34v38M62 34v38M24 53h48"/>`,

  shutters: `${PANNELLO}<rect ${SCOCCA} x="14" y="14" width="68" height="66" rx="10"/><rect ${FRONTALE} x="21" y="21" width="54" height="52" rx="6"/><path ${TRATTO} d="M25 31h46M25 41h46M25 51h46M25 61h46"/><rect ${ACCENTO} x="38" y="76" width="20" height="6" rx="3"/>`,

  scene: `${PANNELLO}<rect ${SCOCCA} x="12" y="30" width="72" height="50" rx="9"/><path ${FRONTALE} d="M12 30l14-14h12L24 30zM40 30l14-14h12L52 30zM68 30l14-14h2v14z"/><path ${ACCENTO} d="M42 46l20 11-20 11z"/>`,

  script: `${PANNELLO}<rect ${SCOCCA} x="18" y="12" width="52" height="72" rx="10"/><rect ${FRONTALE} x="25" y="19" width="38" height="58" rx="6"/><path ${TRATTO} d="M32 30h24M32 40h24M32 50h14"/><circle ${ACCENTO} cx="66" cy="66" r="15"/><path ${TRATTO_CHIARO} d="M62 60l10 6-10 6z"/>`,

  toggle: `${PANNELLO}<rect ${SCOCCA} x="12" y="32" width="72" height="34" rx="17"/><circle ${FRONTALE} cx="66" cy="49" r="12"/><circle ${ACCENTO} cx="66" cy="49" r="5"/><path ${TRATTO_CHIARO} d="M26 43v12"/>`,

  power: `${PANNELLO}<circle ${SCOCCA} cx="48" cy="50" r="32"/><path ${TRATTO_CHIARO} stroke-width="7" d="M48 28v20"/><path ${TRATTO_ACCENTO} stroke-width="7" d="M33 39a19 19 0 1 0 30 0"/>`,

  ev: `${PANNELLO}<path ${SCOCCA} d="M20 56l6-16a8 8 0 0 1 7-5h26a8 8 0 0 1 7 5l6 16v14a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5v-3H34v3a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5z"/><path ${FRONTALE} d="M30 42h36l4 11H26z"/><circle ${VETRO} cx="32" cy="62" r="4"/><circle ${VETRO} cx="64" cy="62" r="4"/><path ${CALDO} d="M50 14l-9 14h7l-3 11 11-15h-7z"/>`,

  water: `${PANNELLO}<path ${VETRO} d="M48 12c14 18 22 29 22 38a22 22 0 0 1-44 0c0-9 8-20 22-38Z"/><path ${TRATTO_CHIARO} d="M37 52c0 8 5 13 11 14"/>`,

  camera: `${PANNELLO}<rect ${SCOCCA} x="12" y="28" width="56" height="40" rx="9"/><path ${SCOCCA} d="M68 42l16-9v30l-16-9z"/><circle ${FRONTALE} cx="34" cy="48" r="12"/><circle ${VETRO} cx="34" cy="48" r="6"/><circle ${ACCENTO} cx="57" cy="37" r="3.2"/>`,

  bell: `${PANNELLO}<path ${SCOCCA} d="M48 14a20 20 0 0 1 20 20v18l6 10H22l6-10V34a20 20 0 0 1 20-20Z"/><rect ${FRONTALE} x="34" y="36" width="28" height="10" rx="5"/><path ${ACCENTO} d="M40 68h16a8 8 0 0 1-16 0Z"/><circle ${ACCENTO} cx="48" cy="12" r="4"/>`,

  star: `${PANNELLO}<path ${CALDO} d="M48 14l10 21 23 3-17 16 4 23-20-11-20 11 4-23-17-16 23-3z"/><path ${TRATTO_CHIARO} d="M42 34l6-12 6 12"/>`,

  "heat-pump": `${PANNELLO}<rect ${SCOCCA} x="12" y="22" width="72" height="52" rx="10"/><circle ${FRONTALE} cx="48" cy="48" r="19"/><path ${ACCENTO} d="M48 34c8-2 12 4 10 9-2 4-7 3-10-1zM60 52c2 8-4 12-9 10-4-2-3-7 1-10zM36 52c-4 6-1 12 4 12 4 0 6-4 5-9z"/><circle ${SCOCCA} cx="48" cy="48" r="4"/><path ${TRATTO} d="M22 80h52"/>`,

  "floor-heating": `${PANNELLO}<rect ${SCOCCA} x="12" y="46" width="72" height="34" rx="8"/><path ${TRATTO_CHIARO} d="M22 72c0-8 8-8 8-16s8-8 8 0 8 8 8 16"/><path ${TRATTO_ACCENTO} d="M54 72c0-8 8-8 8-16s8-8 8 0"/><path ${CALDO} d="M40 14c6 6 8 11 5 16 5-1 8-5 8-10 6 6 8 13 4 19H33c-4-8-1-19 7-25Z"/>`,

  grill: `${PANNELLO}<path ${SCOCCA} d="M16 42h64a32 32 0 0 1-64 0Z"/><path ${TRATTO} d="M28 68l6-14M68 68l-6-14M48 72V56"/><path ${CALDO} d="M48 10c5 5 6 10 4 14 4-1 6-4 6-8 5 5 6 11 3 16H37c-3-7-1-16 11-22Z"/><path ${TRATTO_CHIARO} d="M26 42h44"/>`,

  dehumidifier: `${PANNELLO}<rect ${SCOCCA} x="20" y="12" width="56" height="72" rx="12"/><rect ${FRONTALE} x="27" y="19" width="42" height="28" rx="7"/><path ${VETRO} d="M48 24c7 9 11 14 11 19a11 11 0 0 1-22 0c0-5 4-10 11-19Z"/><path ${TRATTO_CHIARO} d="M31 58h34M31 68h34"/><circle ${ACCENTO} cx="65" cy="76" r="3.2"/>`,

  computer: `${PANNELLO}<rect ${SCOCCA} x="10" y="18" width="76" height="50" rx="9"/><rect ${VETRO} x="17" y="25" width="62" height="36" rx="5"/><path ${SCOCCA} d="M40 68h16v8H40z"/><rect ${SCOCCA} x="28" y="76" width="40" height="7" rx="3.5"/><path ${TRATTO_ACCENTO} d="M27 35h20M27 44h30"/>`,

  server: `${PANNELLO}<rect ${SCOCCA} x="14" y="14" width="68" height="22" rx="7"/><rect ${SCOCCA} x="14" y="42" width="68" height="22" rx="7"/><rect ${SCOCCA} x="14" y="70" width="68" height="16" rx="7"/><circle ${VERDE} cx="26" cy="25" r="3.4"/><circle ${VERDE} cx="26" cy="53" r="3.4"/><circle ${ACCENTO} cx="26" cy="78" r="3.4"/><path ${TRATTO_CHIARO} d="M40 25h30M40 53h30M40 78h22"/>`,

  router: `${PANNELLO}<rect ${SCOCCA} x="14" y="52" width="68" height="26" rx="9"/><circle ${VERDE} cx="27" cy="65" r="3.4"/><circle ${ACCENTO} cx="39" cy="65" r="3.4"/><path ${TRATTO} d="M62 52V34M74 52V38"/><path ${TRATTO_ACCENTO} d="M30 40c5-6 12-10 20-10M24 30c8-9 18-14 30-14"/>`,

  printer: `${PANNELLO}<rect ${FRONTALE} x="28" y="12" width="40" height="20" rx="4"/><rect ${SCOCCA} x="14" y="30" width="68" height="34" rx="9"/><circle ${ACCENTO} cx="26" cy="42" r="3.4"/><path ${TRATTO_CHIARO} d="M40 42h30"/><rect ${FRONTALE} x="28" y="60" width="40" height="24" rx="4"/><path ${TRATTO} d="M36 68h24M36 76h16"/>`,

  solar: `${PANNELLO}<circle ${CALDO} cx="70" cy="24" r="11"/><path ${SCOCCA} d="M22 76l14-38h38l-8 38z"/><path ${TRATTO_CHIARO} d="M34 57h40M45 38l-8 38M60 38l-6 38"/><path ${TRATTO} d="M30 84h44"/>`,

  battery: `${PANNELLO}<rect ${SCOCCA} x="18" y="20" width="60" height="60" rx="11"/><rect ${SCOCCA} x="38" y="12" width="20" height="9" rx="4"/><rect ${VERDE} x="25" y="45" width="46" height="28" rx="6"/><path ${CALDO} d="M52 28l-13 20h9l-3 14 14-20h-9z"/>`,

  pump: `${PANNELLO}<circle ${SCOCCA} cx="44" cy="50" r="27"/><circle ${FRONTALE} cx="44" cy="50" r="16"/><path ${ACCENTO} d="M44 38c7 0 11 5 10 10l-10 2zM56 56c-3 6-9 8-13 5l6-9zM32 56c-4-5-3-11 2-13l4 9z"/><circle ${SCOCCA} cx="44" cy="50" r="4"/><rect ${SCOCCA} x="66" y="34" width="14" height="14" rx="4"/><path ${TRATTO} d="M20 82h56"/>`,

  irrigation: `${PANNELLO}<rect ${SCOCCA} x="42" y="44" width="12" height="38" rx="5"/><rect ${SCOCCA} x="28" y="76" width="40" height="8" rx="4"/><path ${TRATTO_ACCENTO} d="M30 42c4-10 12-16 18-16s14 6 18 16"/><path ${VETRO} d="M24 30c3 4 4 6 4 8a4 4 0 0 1-8 0c0-2 1-4 4-8Z"/><path ${VETRO} d="M72 30c3 4 4 6 4 8a4 4 0 0 1-8 0c0-2 1-4 4-8Z"/><path ${VETRO} d="M48 14c3 4 4 6 4 8a4 4 0 0 1-8 0c0-2 1-4 4-8Z"/>`,

  sauna: `${PANNELLO}<rect ${SCOCCA} x="20" y="44" width="56" height="40" rx="10"/><circle ${SPENTO} cx="36" cy="56" r="6"/><circle ${SPENTO} cx="50" cy="53" r="7"/><circle ${SPENTO} cx="63" cy="57" r="6"/><rect ${ACCENTO} x="28" y="68" width="40" height="8" rx="4"/><path ${CALDO} d="M38 34c5-5 6-10 4-14 6 3 9 9 8 14 3-2 4-5 4-8 4 4 6 9 4 14H36z"/>`,

  lift: `${PANNELLO}<rect ${SCOCCA} x="16" y="12" width="64" height="72" rx="10"/><rect ${FRONTALE} x="24" y="20" width="22" height="56" rx="5"/><rect ${FRONTALE} x="50" y="20" width="22" height="56" rx="5"/><path ${TRATTO_ACCENTO} d="M35 44l-6 8h12zM61 52l6-8H55z"/>`,

  /* ── le stanze ──────────────────────────────────────────────────────── */

  "room-living": `${PANNELLO}<path ${SCOCCA} d="M16 46c0-7 5-12 12-12h40c7 0 12 5 12 12v6H16z"/><rect ${SCOCCA} x="10" y="50" width="76" height="24" rx="8"/><rect ${FRONTALE} x="24" y="38" width="20" height="12" rx="4"/><rect ${FRONTALE} x="52" y="38" width="20" height="12" rx="4"/><path ${TRATTO} d="M22 74v8M74 74v8"/>`,

  "room-bedroom": `${PANNELLO}<path ${SCOCCA} d="M12 74V32a4 4 0 0 1 8 0v10h48c9 0 16 7 16 16v16z"/><rect ${FRONTALE} x="24" y="30" width="26" height="14" rx="6"/><rect ${VETRO} x="20" y="48" width="56" height="12" rx="5"/><path ${TRATTO} d="M16 74v8M80 74v8"/>`,

  "room-kids": `${PANNELLO}<circle ${SCOCCA} cx="48" cy="38" r="18"/><circle ${SCOCCA} cx="30" cy="24" r="8"/><circle ${SCOCCA} cx="66" cy="24" r="8"/><circle ${FRONTALE} cx="41" cy="36" r="3.4"/><circle ${FRONTALE} cx="55" cy="36" r="3.4"/><path ${TRATTO_CHIARO} d="M42 46c4 3 8 3 12 0"/><path ${SCOCCA} d="M30 60h36a10 10 0 0 1 10 10v14H20V70a10 10 0 0 1 10-10Z"/>`,

  "room-nursery": `${PANNELLO}<circle ${SCOCCA} cx="48" cy="44" r="26"/><circle ${FRONTALE} cx="39" cy="42" r="3.6"/><circle ${FRONTALE} cx="57" cy="42" r="3.6"/><path ${TRATTO_CHIARO} d="M39 54c5 4 13 4 18 0"/><path ${CALDO} d="M48 12c4 0 7 3 7 6h-14c0-3 3-6 7-6Z"/><path ${TRATTO} d="M26 78h44"/>`,

  "room-bathroom": `${PANNELLO}<path ${TRATTO} d="M48 14v18"/><path ${SCOCCA} d="M30 30h36a6 6 0 0 1 0 12H30a6 6 0 0 1 0-12Z"/><circle ${VETRO} cx="34" cy="54" r="3.4"/><circle ${VETRO} cx="48" cy="60" r="3.4"/><circle ${VETRO} cx="62" cy="54" r="3.4"/><circle ${VETRO} cx="41" cy="70" r="3.4"/><circle ${VETRO} cx="55" cy="70" r="3.4"/><path ${TRATTO_ACCENTO} d="M26 82h44"/>`,

  "room-wc": `${PANNELLO}<rect ${SCOCCA} x="26" y="14" width="44" height="20" rx="6"/><circle ${ACCENTO} cx="60" cy="24" r="4"/><path ${SCOCCA} d="M24 38h48v10a24 24 0 0 1-24 24 24 24 0 0 1-24-24z"/><path ${FRONTALE} d="M31 44h34v4a17 17 0 0 1-34 0z"/><rect ${SCOCCA} x="34" y="74" width="28" height="9" rx="4"/>`,

  "room-dining": `${PANNELLO}<rect ${SCOCCA} x="12" y="42" width="72" height="10" rx="5"/><path ${TRATTO} d="M22 52v26M74 52v26"/><path ${SCOCCA} d="M28 14h8v28h-8z"/><path ${SCOCCA} d="M60 14h8v28h-8z"/><circle ${FRONTALE} cx="48" cy="30" r="10"/><path ${TRATTO_ACCENTO} d="M30 62h36"/>`,

  "room-office": `${PANNELLO}<rect ${SCOCCA} x="10" y="46" width="76" height="10" rx="5"/><path ${TRATTO} d="M20 56v24M76 56v24"/><rect ${SCOCCA} x="30" y="20" width="38" height="26" rx="6"/><rect ${VETRO} x="35" y="25" width="28" height="16" rx="3"/><rect ${ACCENTO} x="24" y="62" width="26" height="14" rx="4"/>`,

  "room-guest": `${PANNELLO}<circle ${SCOCCA} cx="36" cy="34" r="13"/><circle ${SCOCCA} cx="63" cy="38" r="10"/><path ${SCOCCA} d="M14 82c0-13 10-22 22-22s22 9 22 22z"/><path ${ACCENTO} d="M56 82c0-10 5-17 13-17s13 7 13 17z"/>`,

  "room-entrance": `${PANNELLO}<path ${SCOCCA} d="M20 14h34a6 6 0 0 1 6 6v62a6 6 0 0 1-6 6H20z"/><path ${FRONTALE} d="M26 22h26v52H26z"/><circle ${ACCENTO} cx="46" cy="48" r="3.6"/><path ${TRATTO_ACCENTO} d="M70 48H84M78 40l8 8-8 8"/>`,

  "room-hallway": `${PANNELLO}<rect ${SCOCCA} x="26" y="12" width="44" height="72" rx="8"/><rect ${FRONTALE} x="33" y="19" width="30" height="58" rx="5"/><circle ${ACCENTO} cx="56" cy="48" r="3.6"/><path ${TRATTO} d="M20 84h56"/>`,

  "room-pantry": `${PANNELLO}<rect ${SCOCCA} x="16" y="14" width="64" height="70" rx="10"/><rect ${FRONTALE} x="23" y="22" width="50" height="18" rx="5"/><rect ${FRONTALE} x="23" y="46" width="50" height="18" rx="5"/><rect ${ACCENTO} x="29" y="26" width="10" height="10" rx="3"/><rect ${VETRO} x="45" y="26" width="10" height="10" rx="3"/><rect ${VETRO} x="29" y="50" width="10" height="10" rx="3"/><rect ${ACCENTO} x="45" y="50" width="10" height="10" rx="3"/><path ${TRATTO_CHIARO} d="M30 74h36"/>`,

  "room-wardrobe": `${PANNELLO}<path ${TRATTO} stroke-width="4" d="M20 40h56"/><path ${SCOCCA} d="M48 20a7 7 0 0 1 7 7c0 4-3 5-5 7l-2 6-2-6c-2-2-5-3-5-7a7 7 0 0 1 7-7Z"/><path ${SCOCCA} d="M48 40 24 68c-3 4-1 10 5 10h38c6 0 8-6 5-10z"/><path ${TRATTO_CHIARO} d="M36 66h24"/>`,

  "room-storage": `${PANNELLO}<rect ${SCOCCA} x="14" y="24" width="68" height="16" rx="6"/><rect ${SCOCCA} x="18" y="44" width="60" height="38" rx="8"/><rect ${FRONTALE} x="38" y="52" width="20" height="8" rx="4"/><path ${TRATTO_CHIARO} d="M28 70h40"/><rect ${ACCENTO} x="38" y="28" width="20" height="8" rx="4"/>`,

  "room-balcony": `${PANNELLO}<path ${SCOCCA} d="M14 44h68v8H14z"/><path ${TRATTO} d="M22 52v26M38 52v26M54 52v26M70 52v26"/><rect ${SCOCCA} x="14" y="76" width="68" height="8" rx="4"/><path ${VETRO} d="M26 20h44v20H26z"/><path ${TRATTO_ACCENTO} d="M48 12v8"/>`,

  "room-terrace": `${PANNELLO}<path ${SCOCCA} d="M48 12c16 0 28 11 30 24H18c2-13 14-24 30-24Z"/><path ${TRATTO} stroke-width="4" d="M48 36v42"/><rect ${SCOCCA} x="34" y="78" width="28" height="8" rx="4"/><path ${TRATTO_CHIARO} d="M32 30c4-8 10-12 16-12s12 4 16 12"/>`,

  "room-garage": `${PANNELLO}<path ${SCOCCA} d="M48 12 12 34v50h72V34z"/><rect ${FRONTALE} x="26" y="46" width="44" height="38" rx="5"/><path ${TRATTO} d="M30 56h36M30 65h36M30 74h36"/>`,

  "room-cellar": `${PANNELLO}<path ${SCOCCA} d="M34 14h28v20a14 14 0 0 1-28 0z"/><path ${ACCENTO} d="M36 22h24v11a12 12 0 0 1-24 0z"/><path ${TRATTO} stroke-width="4" d="M48 48v24"/><rect ${SCOCCA} x="32" y="72" width="32" height="8" rx="4"/>`,

  "room-attic": `${PANNELLO}<path ${SCOCCA} d="M48 12 10 44l6 8 32-27 32 27 6-8z"/><path ${SCOCCA} d="M24 52h48v32H24z"/><rect ${VETRO} x="38" y="60" width="20" height="16" rx="4"/><path ${TRATTO_CHIARO} d="M48 60v16M38 68h20"/>`,

  "room-utility": `${PANNELLO}<path ${SCOCCA} d="M63 16a18 18 0 0 0-17 24L20 66a8 8 0 0 0 11 11l26-26a18 18 0 0 0 21-24l-11 11-9-2-2-9z"/><path ${TRATTO_ACCENTO} d="M28 68h1"/><circle ${ACCENTO} cx="28" cy="69" r="3.4"/>`,

  "room-gym": `${PANNELLO}<rect ${SCOCCA} x="14" y="36" width="12" height="26" rx="5"/><rect ${SCOCCA} x="70" y="36" width="12" height="26" rx="5"/><rect ${ACCENTO} x="28" y="42" width="10" height="14" rx="4"/><rect ${ACCENTO} x="58" y="42" width="10" height="14" rx="4"/><rect ${SCOCCA} x="38" y="45" width="20" height="8" rx="4"/>`,

  "room-media": `${PANNELLO}<rect ${SCOCCA} x="12" y="24" width="72" height="48" rx="10"/><rect ${VETRO} x="19" y="31" width="58" height="34" rx="5"/><path ${ACCENTO} d="M41 40l16 8-16 8z"/><path ${TRATTO} d="M36 80h24"/>`,

  "room-garden": `${PANNELLO}<circle ${CALDO} cx="48" cy="34" r="9"/><path ${ACCENTO} d="M48 16c6 0 9 5 9 9s-4 9-9 9-9-4-9-9 3-9 9-9ZM66 34c4 5 2 11-2 14s-9 1-11-4 1-9 5-11 6-1 8 1ZM30 34c-4 5-2 11 2 14s9 1 11-4-1-9-5-11-6-1-8 1Z"/><path ${TRATTO} stroke-width="4" d="M48 46v30"/><path ${TRATTO_ACCENTO} d="M48 60c-6-2-10-6-11-11M48 68c6-2 10-6 11-11"/>`,

  "room-pool": `${PANNELLO}<path ${TRATTO} stroke-width="4" d="M32 58V32a10 10 0 0 1 20 0v26M32 40h20M32 50h20"/><path ${VETRO} d="M10 54c8 0 8 6 16 6s8-6 16-6 8 6 16 6 8-6 16-6 8 6 8 6v18a6 6 0 0 1-6 6H16a6 6 0 0 1-6-6z"/><path ${TRATTO_CHIARO} d="M18 70c8 0 8 5 16 5s8-5 16-5 8 5 16 5 8-5 12-5"/>`,

  /* ── e le due che restavano fuori ───────────────────────────────────── */

  socket: `${PANNELLO}<rect ${SCOCCA} x="18" y="18" width="60" height="60" rx="16"/><circle ${FRONTALE} cx="48" cy="48" r="21"/><circle ${SCOCCA} cx="39" cy="44" r="4"/><circle ${SCOCCA} cx="57" cy="44" r="4"/><rect ${SCOCCA} x="44" y="56" width="8" height="6" rx="3"/>`,

  fireplace: `${PANNELLO}<rect ${SCOCCA} x="16" y="16" width="64" height="68" rx="10"/><rect ${FRONTALE} x="24" y="24" width="48" height="40" rx="7"/><path ${CALDO} d="M48 32c5 6 6 11 4 15 4-1 6-5 6-9 5 6 6 13 2 19H38c-4-9-2-19 10-25Z"/><path ${TRATTO_CHIARO} d="M30 74h36"/>`,

  /* ── Le forme che mancavano al catalogo unico ─────────────────────────
   *
   * «Rivedi completamente il catalogo nostro delle icone, fallo piu' ampio e
   * a qualsiasi parte viene richiesta una icona deve puntare sempre ed
   * esclusivamente al nostro catalogo»: le voci nuove non potevano restare
   * emoji di sistema accanto alle scocche blu notte. Stessa famiglia: il
   * riquadro, la scocca, il frontale, un accento. */
  info: `${PANNELLO}<circle ${SCOCCA} cx="48" cy="48" r="32"/><circle ${FRONTALE} cx="48" cy="33" r="4.6"/><rect ${FRONTALE} x="43.4" y="42" width="9.2" height="24" rx="4.6"/>`,

  check: `${PANNELLO}<circle ${SCOCCA} cx="48" cy="48" r="32"/><path ${TRATTO_CHIARO} d="M33 49l11 12 21-25"/>`,

  error: `${PANNELLO}<circle ${SCOCCA} cx="48" cy="48" r="32"/><path ${TRATTO_CHIARO} d="M36 36l24 24M60 36 36 60"/>`,

  lock: `${PANNELLO}<path ${TRATTO} d="M34 44V34a14 14 0 0 1 28 0v10"/><rect ${SCOCCA} x="24" y="44" width="48" height="38" rx="10"/><circle ${VETRO} cx="48" cy="59" r="6"/><rect ${VETRO} x="45" y="59" width="6" height="12" rx="3"/>`,

  motion: `${PANNELLO}<circle ${SCOCCA} cx="52" cy="22" r="8"/><path ${SCOCCA} d="M44 34h10l9 18-8 4-5-9-3 15 11 12v13h-9V78l-13-13 5-24-9 6-6-8z"/><path ${TRATTO_ACCENTO} d="M74 30c5 6 5 14 0 20M20 30c-5 6-5 14 0 20"/>`,

  smoke: `${PANNELLO}<rect ${SCOCCA} x="18" y="56" width="60" height="26" rx="10"/><rect ${ACCENTO} x="27" y="65" width="10" height="8" rx="4"/><path ${TRATTO} d="M36 46c0-8 10-8 10-16s-8-8-8-14M56 46c0-6 8-7 8-14"/>`,

  thermometer: `${PANNELLO}<rect ${SCOCCA} x="40" y="12" width="16" height="46" rx="8"/><circle ${SCOCCA} cx="48" cy="68" r="16"/><circle ${ACCENTO} cx="48" cy="68" r="9"/><rect ${ACCENTO} x="45" y="32" width="6" height="30" rx="3"/><path ${TRATTO} d="M62 26h8M62 36h8M62 46h8"/>`,

  sun: `${PANNELLO}<circle ${CALDO} cx="48" cy="48" r="19"/><path ${TRATTO} d="M48 12v9M48 75v9M12 48h9M75 48h9M23 23l6 6M67 67l6 6M73 23l-6 6M29 67l-6 6"/>`,

  moon: `${PANNELLO}<path ${SCOCCA} d="M60 14a34 34 0 1 0 22 44 27 27 0 0 1-22-44Z"/><circle ${CALDO} cx="70" cy="30" r="4"/><circle ${VETRO} cx="42" cy="60" r="5"/>`,

  speaker: `${PANNELLO}<rect ${SCOCCA} x="26" y="10" width="44" height="76" rx="12"/><circle ${VETRO} cx="48" cy="58" r="14"/><circle ${ACCENTO} cx="48" cy="58" r="6"/><circle ${FRONTALE} cx="48" cy="28" r="7"/>`,

  person: `${PANNELLO}<circle ${SCOCCA} cx="48" cy="32" r="15"/><path ${SCOCCA} d="M18 84c0-17 13-27 30-27s30 10 30 27z"/><path ${TRATTO_CHIARO} d="M40 30c2-3 6-4 9-3"/>`,

  pet: `${PANNELLO}<ellipse ${SCOCCA} cx="48" cy="62" rx="17" ry="14"/><ellipse ${SCOCCA} cx="27" cy="42" rx="8" ry="11"/><ellipse ${SCOCCA} cx="69" cy="42" rx="8" ry="11"/><ellipse ${SCOCCA} cx="38" cy="26" rx="8" ry="11"/><ellipse ${SCOCCA} cx="58" cy="26" rx="8" ry="11"/><circle ${ACCENTO} cx="48" cy="60" r="5"/>`,

  package: `${PANNELLO}<path ${SCOCCA} d="M48 10 82 28v40L48 86 14 68V28z"/><path ${FRONTALE} d="M48 30 68 41v22L48 74 28 63V41z"/><path ${TRATTO} d="M28 41 48 52l20-11M48 52v22"/>`,

  mail: `${PANNELLO}<rect ${SCOCCA} x="12" y="26" width="72" height="46" rx="10"/><path ${TRATTO_CHIARO} d="m16 32 32 22 32-22"/><rect ${ACCENTO} x="62" y="16" width="16" height="16" rx="8"/>`,

  phone: `${PANNELLO}<rect ${SCOCCA} x="27" y="8" width="42" height="80" rx="12"/><rect ${VETRO} x="33" y="20" width="30" height="50" rx="6"/><rect ${FRONTALE} x="42" y="76" width="12" height="4" rx="2"/>`,

  timer: `${PANNELLO}<circle ${SCOCCA} cx="48" cy="54" r="30"/><circle ${FRONTALE} cx="48" cy="54" r="22"/><path ${TRATTO} d="M48 40v14l10 7"/><rect ${SCOCCA} x="38" y="10" width="20" height="9" rx="4.5"/>`,

  cart: `${PANNELLO}<path ${TRATTO} d="M14 20h10l10 38h34l9-26H30"/><circle ${SCOCCA} cx="38" cy="76" r="8"/><circle ${SCOCCA} cx="66" cy="76" r="8"/><rect ${ACCENTO} x="44" y="36" width="26" height="6" rx="3"/>`,

  list: `${PANNELLO}<rect ${SCOCCA} x="18" y="12" width="60" height="72" rx="12"/><rect ${FRONTALE} x="26" y="22" width="44" height="52" rx="8"/><path ${TRATTO_ACCENTO} d="m33 38 5 5 9-10M33 58l5 5 9-10"/><path ${TRATTO} d="M53 40h12M53 60h12"/>`,

  key: `${PANNELLO}<circle ${SCOCCA} cx="34" cy="38" r="18"/><circle ${VETRO} cx="34" cy="38" r="7"/><path ${SCOCCA} d="M45 48 78 81l-9 9-8-8-6 6-7-7 6-6-9-9z"/>`,

  tools: `${PANNELLO}<path ${SCOCCA} d="M22 68 52 38l-6-6a16 16 0 0 1 20-20l-9 9 8 8 9-9a16 16 0 0 1-20 20l-6-6-30 30z"/><circle ${ACCENTO} cx="26" cy="72" r="6"/>`,

  heart: `${PANNELLO}<path ${ACCENTO} d="M48 82 20 55a17 17 0 0 1 24-24l4 4 4-4a17 17 0 0 1 24 24z"/><path ${TRATTO_CHIARO} d="M28 50h12l4-8 6 16 5-8h13"/>`,

  wind: `${PANNELLO}<path ${TRATTO} d="M14 34h34a10 10 0 1 0-10-10"/><path ${TRATTO} d="M14 50h46a10 10 0 1 1-10 10"/><path ${TRATTO_ACCENTO} d="M14 66h26a8 8 0 1 1-8 8"/>`,

  broom: `${PANNELLO}<path ${TRATTO} d="M62 14 40 44"/><path ${SCOCCA} d="M30 44h26l10 26a6 6 0 0 1-6 8H26a6 6 0 0 1-6-8z"/><path ${TRATTO_CHIARO} d="M30 58v18M40 58v18M50 58v18"/>`,

  refresh: `${PANNELLO}<path ${TRATTO} d="M76 48a28 28 0 1 1-9-20"/><path ${SCOCCA} d="M72 6h8v22H58z"/>`,

  /* ── i programmi della lavatrice ───────────────────────────────────────
   *
   * «Crea anche nel nostro catalogo delle icone che possono essere utilizzate
   * per i programmi della lavatrice»: i tasti del popup si battezzano uno per
   * uno, e finora l'unico disegno pertinente era il cesto. Questi sono i
   * programmi che una lavatrice ha davvero, nella stessa famiglia di tutto il
   * resto: stesso riquadro, stessa scocca, stesso accento. */

  /* Cotone: la maglietta, che e' il capo che tutti riconoscono. */
  "wash-cotton": `${PANNELLO}<path ${SCOCCA} d="M38 20h20l18 10-8 14-8-4v34a4 4 0 0 1-4 4H40a4 4 0 0 1-4-4V40l-8 4-8-14z"/><path ${TRATTO_CHIARO} d="M40 21c2 6 14 6 16 0"/><circle ${ACCENTO} cx="48" cy="62" r="4"/>`,

  /* Sintetici: la camicia col collo aperto e i bottoni. */
  "wash-synthetic": `${PANNELLO}<path ${SCOCCA} d="M36 18h24l16 12-9 12-5-3v37a4 4 0 0 1-4 4H38a4 4 0 0 1-4-4V39l-5 3-9-12z"/><path ${TRATTO_CHIARO} d="M40 19l8 12 8-12M48 40v34"/><circle ${ACCENTO} cx="48" cy="50" r="2.6"/><circle ${ACCENTO} cx="48" cy="64" r="2.6"/>`,

  /* Lana: il gomitolo con il filo che scappa. */
  "wash-wool": `${PANNELLO}<circle ${SCOCCA} cx="46" cy="52" r="26"/><path ${TRATTO_CHIARO} d="M28 36c14 4 26 16 30 30M36 28c12 6 24 20 26 34M24 50c10 2 20 10 24 22"/><path ${TRATTO_ACCENTO} d="M70 40c8-4 12-10 10-18"/>`,

  /* Rapido: l'oblo' con la lancetta corta, e la scia. */
  "wash-quick": `${PANNELLO}<circle ${SCOCCA} cx="48" cy="50" r="28"/><circle ${FRONTALE} cx="48" cy="50" r="20"/><path ${TRATTO} d="M48 36v14l10 6"/><path ${TRATTO_ACCENTO} d="M14 32h16M10 46h12"/>`,

  /* Eco: la foglia dentro l'oblo'. */
  "wash-eco": `${PANNELLO}<circle ${SCOCCA} cx="48" cy="50" r="28"/><circle ${FRONTALE} cx="48" cy="50" r="20"/><path ${VERDE} d="M60 36c2 16-6 26-20 26 0-16 8-24 20-26z"/><path ${TRATTO} d="M38 64c6-8 12-14 20-18"/>`,

  /* Centrifuga: il cestello e le frecce che girano forte. */
  "wash-spin": `${PANNELLO}<circle ${SCOCCA} cx="48" cy="50" r="28"/><circle ${FRONTALE} cx="48" cy="50" r="19"/><path ${TRATTO_ACCENTO} d="M48 36a14 14 0 0 1 13 9"/><path ${ACCENTO} d="M64 40l-2 10-8-6z"/><path ${TRATTO_ACCENTO} d="M48 64a14 14 0 0 1-13-9"/><path ${ACCENTO} d="M32 60l2-10 8 6z"/>`,

  /* Risciacquo: l'acqua che scende dentro il cestello. */
  "wash-rinse": `${PANNELLO}<circle ${SCOCCA} cx="48" cy="54" r="26"/><circle ${FRONTALE} cx="48" cy="54" r="18"/><path ${VETRO} d="M48 12c7 9 11 14 11 19a11 11 0 0 1-22 0c0-5 4-10 11-19z"/><path ${TRATTO_CHIARO} d="M40 58c5 5 11 5 16 0"/>`,

  /* Igienizzante: il caldo alto, col termometro e il vapore. */
  "wash-hot": `${PANNELLO}<circle ${SCOCCA} cx="52" cy="56" r="24"/><circle ${FRONTALE} cx="52" cy="56" r="16"/><path ${CALDO} d="M30 20a6 6 0 0 1 12 0v28a10 10 0 1 1-12 0z"/><circle ${CALDO} cx="36" cy="60" r="9"/><path ${TRATTO_CHIARO} d="M46 50c4-4 4-8 0-12"/>`,

  /* Delicati: la piuma, che dice «piano» senza scriverlo. */
  "wash-delicate": `${PANNELLO}<path ${SCOCCA} d="M74 18c4 22-6 40-24 46l-10 4 4-10c8-18 18-30 30-40z"/><path ${TRATTO_CHIARO} d="M62 30 40 60M56 32l2 12M48 42l2 12"/><path ${TRATTO_ACCENTO} d="M24 78c6-6 12-10 18-12"/>`,

  /* Piumoni: il capo grande, con le sue cuciture. */
  "wash-duvet": `${PANNELLO}<rect ${SCOCCA} x="16" y="26" width="64" height="46" rx="10"/><path ${TRATTO_CHIARO} d="M16 42h64M16 58h64M38 26v46M60 26v46"/><circle ${ACCENTO} cx="27" cy="34" r="3"/>`,
});

/* I nomi con cui il resto della plancia chiede la stessa cosa. Un disegno solo,
 * tanti nomi: «luce», «light», «lights» sono la stessa lampadina. */
const ALIAS = Object.freeze({
  /* I programmi della lavatrice, chiamati come li chiama chi li usa. */
  cotone: "wash-cotton",
  cotton: "wash-cotton",
  sintetici: "wash-synthetic",
  synthetic: "wash-synthetic",
  lana: "wash-wool",
  wool: "wash-wool",
  rapido: "wash-quick",
  quick: "wash-quick",
  eco: "wash-eco",
  centrifuga: "wash-spin",
  spin: "wash-spin",
  risciacquo: "wash-rinse",
  rinse: "wash-rinse",
  igienizzante: "wash-hot",
  sanitize: "wash-hot",
  delicati: "wash-delicate",
  delicate: "wash-delicate",
  piumoni: "wash-duvet",
  duvet: "wash-duvet",
  light: "lights",
  luce: "lights",
  luci: "lights",
  "gruppo-luci": "lights-group",
  heat: "radiator",
  riscaldamento: "radiator",
  termosifone: "radiator",
  "pompa-di-calore": "heat-pump",
  sicurezza: "security",
  cancello: "gate",
  porta: "door",
  "door-closed": "door",
  "door-open": "door",
  portoncino: "door",
  ingresso: "door",
  tapparelle: "shutters",
  scena: "scene",
  interruttore: "toggle",
  potenza: "power",
  presa: "power",
  auto: "ev",
  acqua: "water",
  telecamera: "camera",
  campanello: "bell",
  stella: "star",
  "riscaldamento-a-pavimento": "floor-heating",
  barbecue: "grill",
  deumidificatore: "dehumidifier",
  pc: "computer",
  computer: "computer",
  stampante: "printer",
  fotovoltaico: "solar",
  solare: "solar",
  batteria: "battery",
  pompa: "pump",
  irrigazione: "irrigation",
  ascensore: "lift",
  casa: "home",
  /* Le voci nuove del catalogo unico: ognuna al suo disegno di famiglia. */
  alarm: "security",
  allarme: "security",
  warning: "bell",
  attenzione: "bell",
  informazione: "info",
  risolto: "check",
  errore: "error",
  bloccato: "lock",
  unlock: "lock",
  sbloccato: "lock",
  serratura: "lock",
  window: "shutters",
  finestra: "shutters",
  garage: "room-garage",
  movimento: "motion",
  presence: "motion",
  presenza: "motion",
  fire: "fireplace",
  incendio: "fireplace",
  fumo: "smoke",
  gas: "smoke",
  leak: "water",
  perdita: "water",
  flood: "water",
  allagamento: "water",
  temperatura: "thermometer",
  humidity: "water",
  umidita: "water",
  sole: "sun",
  notte: "moon",
  vento: "wind",
  rain: "water",
  pioggia: "water",
  "battery-low": "battery",
  plug: "socket",
  vacuum: "robot-vacuum",
  aspirapolvere: "robot-vacuum",
  pool: "room-pool",
  piscina: "room-pool",
  tv: "television",
  casse: "speaker",
  musica: "speaker",
  music: "speaker",
  wifi: "router",
  rete: "router",
  persona: "person",
  animale: "pet",
  pacco: "package",
  posta: "mail",
  telefono: "phone",
  scadenza: "timer",
  calendar: "timer",
  shopping: "cart",
  spesa: "cart",
  todo: "list",
  chiave: "key",
  bed: "room-bedroom",
  letto: "room-bedroom",
  away: "door",
  party: "scene",
  festa: "scene",
  movie: "scene",
  film: "scene",
  clean: "broom",
  pulizie: "broom",
  manutenzione: "tools",
  salute: "heart",
  aggiorna: "refresh",
  restart: "refresh",
  riavvia: "refresh",
});

const pulito = (valore) =>
  String(valore ?? "")
    .trim()
    .toLowerCase()
    .replace(/^mdi:/, "")
    .replace(/[\s_]+/g, "-");

/** Il nome canonico del disegno, o "" se questo catalogo non ce l'ha. */
export function chiaveDelDisegno(valore) {
  const token = pulito(valore);
  if (!token) return "";
  if (CORPI[token]) return token;
  const alias = ALIAS[token];
  return alias && CORPI[alias] ? alias : "";
}

/** Il disegno pronto da mettere nel documento, o "" se non c'e'. */
export function disegnoDelCatalogo(valore, misura = 96) {
  const chiave = chiaveDelDisegno(valore);
  return chiave ? guscio(chiave, CORPI[chiave], misura) : "";
}

/** Tutti i nomi che questo catalogo sa disegnare: serve alle prove e ai provini. */
export function chiaviDisegnate() {
  return Object.keys(CORPI);
}

/* Con che nomi provare a cercare il disegno di una voce, in ordine.
 *
 * La configurazione salva il nome mdi — `mdi:stove` — mentre i disegni hanno il
 * nome della voce — `kitchen`, e per le stanze `room-kitchen`. In mezzo c'e' il
 * catalogo, che dal nome mdi risale alla voce. Chi cerca un disegno deve
 * provarli tutti e tre: qui c'e' l'elenco, in un posto solo, cosi' il motore
 * che disegna e la prova che pretende il disegno guardano la stessa cosa —
 * prima non era cosi', e restavano tredici voci disegnate sulla carta e a
 * emoji sullo schermo. */
export function chiaviDaProvare(kind, token, voce = null) {
  const nomi = [];
  const aggiungi = (valore) => {
    const nome = pulito(valore);
    if (nome && !nomi.includes(nome)) nomi.push(nome);
  };
  aggiungi(token);
  if (voce?.id) {
    if (kind === "room") aggiungi(`room-${voce.id}`);
    aggiungi(voce.id);
    aggiungi(voce.mdi);
  }
  return nomi;
}

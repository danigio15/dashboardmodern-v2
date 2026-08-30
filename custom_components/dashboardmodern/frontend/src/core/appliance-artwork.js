// DM-FIX-20260812B
/* Pure appliance artwork helpers. */

export function canonicalArtworkType(value) {
  const token = String(value || "").toLowerCase();
  if (/microonde|microwave/.test(token)) return "microwave";
  if (/forno|oven|stove/.test(token)) return "oven";
  if (/frigo|fridge|refriger|frigorifero|freezer|congelatore/.test(token)) return "fridge";
  /* Il boiler d'accumulo prima dello scaldabagno: la chiave e' «accumulo»
   * perche' la parola «boiler» da sola e' storicamente lo scaldabagno a muro
   * — rimapparla romperebbe chi l'ha gia' scritta — ma l'etichetta a video
   * dice Boiler, che e' come lo chiama chi ce l'ha. */
  if (/accumulo|puffer|storage[_ -]?(?:boiler|tank)/.test(token)) return "storage-boiler";
  if (/friggitrice|air[_ -]?fryer|airfryer/.test(token)) return "air-fryer";
  if (/scaldabagno|boiler|water[_ -]?heater/.test(token)) return "boiler";
  // "dishwasher" must resolve before the washer pattern: /washer/ would match
  // the "…washer" suffix and canonicalArtworkType would not be idempotent.
  if (/lavastoviglie|dishwasher/.test(token)) return "dishwasher";
  if (/lavatrice|washing[_ -]?machine|washer/.test(token)) return "washer";
  if (/asciugatrice|tumble[_ -]?dryer|dryer/.test(token)) return "dryer";
  if (/piano[_ -]?cottura|cooktop|hob/.test(token)) return "cooktop";
  if (/televis|\btv\b|monitor/.test(token)) return "television";
  if (/cappa|hood|extractor/.test(token)) return "hood";
  if (/ferro|iron/.test(token)) return "iron";
  // The catalog key is the bare "robot": it must resolve before the generic
  // vacuum pattern, and never fall through to "generic".
  if (/robot|roomba/.test(token)) return "robot-vacuum";
  if (/aspirapolvere|vacuum/.test(token)) return "vacuum";
  // La wallbox va riconosciuta prima di "presa": e' una presa anche lei, ma
  // chi la guarda nel Report deve vederci una colonnina, non un frullatore.
  /* "charger" da solo non basta: il caricabatterie del telefono e quello del
   * portatile sono caricatori anche loro, e si vedevano assegnare la colonnina.
   * Serve che si parli di wallbox, di stazione di ricarica o di un'auto. */
  if (
    /wallbox|colonnina|charging[_ -]?station|stazione[_ -]?di[_ -]?ricarica|ricarica[_ -]?(?:auto|vettura|ev)|(?:ev|car|auto|vettura)[_ -]?charg/.test(
      token,
    )
  )
    return "wallbox";
  // "clima" e' il nome che quasi tutti danno alla sezione e al carico: senza
  // questo cadeva nel disegno generico, identico a quello della wallbox.
  if (/condizionatore|air[_ -]?condition|\bsplit\b|clima/.test(token)) return "air-conditioner";
  if (/ventilatore|\bfan\b/.test(token)) return "fan";
  if (/caffe|caffè|coffee/.test(token)) return "coffee";
  if (/tostapane|toaster/.test(token)) return "toaster";
  if (/bollitore|kettle/.test(token)) return "kettle";
  if (/generico|altro|generic|presa|plug/.test(token)) return "generic";
  return "";
}

function artworkBody(type) {
  const panel =
    '<rect class="dm-art-panel" x="3" y="3" width="90" height="90" rx="20" fill="#e0f2fe"/><path class="dm-art-highlight" fill="#ffffff" opacity=".75" d="M15 13h66a10 10 0 0 1 10 10v8C70 18 42 17 5 39V23A10 10 0 0 1 15 13Z"/>';
  const shell = 'fill="#0f2942"';
  const face = 'fill="#f8fafc"';
  const window = 'fill="#8be2ff"';
  const accent = 'fill="#0ea5e9"';
  const muted = 'fill="#94a3b8"';
  const line =
    'fill="none" stroke="#0f2942" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"';
  const lightLine =
    'fill="none" stroke="#f8fafc" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"';
  const bodies = {
    oven: `${panel}<rect ${shell} x="15" y="10" width="66" height="76" rx="9"/><rect ${face} x="21" y="17" width="54" height="14" rx="5"/><circle ${accent} cx="29" cy="24" r="3.2"/><circle ${muted} cx="39" cy="24" r="3.2"/><circle ${muted} cx="49" cy="24" r="3.2"/><rect ${face} x="21" y="37" width="54" height="40" rx="6"/><rect ${window} x="28" y="44" width="40" height="25" rx="4"/><path ${line} d="M34 61c8-7 20-7 28 0M31 72h34"/>`,
    microwave: `${panel}<rect ${shell} x="10" y="22" width="76" height="54" rx="10"/><rect ${face} x="16" y="29" width="50" height="40" rx="6"/><rect ${window} x="22" y="35" width="38" height="28" rx="4"/><circle ${accent} cx="76" cy="36" r="5"/><rect ${accent} x="70" y="47" width="12" height="5" rx="2.5"/><rect ${muted} x="70" y="57" width="12" height="5" rx="2.5"/><path ${line} d="M31 56h20M34 51c4-5 10-5 14 0"/>`,
    fridge: `${panel}<rect ${shell} x="20" y="8" width="56" height="80" rx="12"/><rect ${face} x="26" y="14" width="44" height="31" rx="7"/><rect ${face} x="26" y="51" width="44" height="30" rx="7"/><rect ${accent} x="31" y="21" width="6" height="17" rx="3"/><rect ${accent} x="31" y="58" width="6" height="17" rx="3"/><circle ${accent} cx="63" cy="22" r="3"/>`,
    "storage-boiler": `${panel}<rect ${shell} x="24" y="7" width="48" height="74" rx="22"/><rect ${face} x="31" y="14" width="34" height="60" rx="16"/><path ${window} d="M32 54c8-6 14 4 22-2 4-3 8-3 11 0v4a16 16 0 0 1-16 16h-2a16 16 0 0 1-15-16Z"/><circle ${face} cx="48" cy="33" r="9"/><circle ${window} cx="48" cy="33" r="6"/><path ${line} d="M48 33l4-4"/><circle ${accent} cx="48" cy="20" r="3"/><path ${line} d="M34 81v7M62 81v7M72 26h13M72 62h13"/>`,

    "air-fryer": `${panel}<path ${shell} d="M31 11h34c9 0 15 7 15 16v31c0 15-12 27-27 27h-10c-15 0-27-12-27-27V27c0-9 6-16 15-16Z"/><rect ${face} x="30" y="18" width="36" height="18" rx="9"/><circle ${window} cx="48" cy="27" r="6"/><circle ${accent} cx="48" cy="27" r="2.6"/><path ${face} d="M25 52h46v8a16 16 0 0 1-16 16H41a16 16 0 0 1-16-16Z"/><rect ${shell} x="40" y="58" width="16" height="6" rx="3"/><path ${line} d="M36 44h24"/>`,

    boiler: `${panel}<rect ${shell} x="20" y="8" width="56" height="76" rx="28"/><rect ${face} x="27" y="15" width="42" height="62" rx="21"/><path ${window} d="M28 51c9-8 16 5 25-3 6-5 10-4 16 0v18a13 13 0 0 1-13 13H40a13 13 0 0 1-13-13Z"/><circle ${shell} cx="48" cy="58" r="8"/><path ${lightLine} d="M48 53v6M44 57l4 4 4-4"/><path ${line} d="M36 86v5M60 86v5"/>`,
    washer: `${panel}<rect ${shell} x="13" y="10" width="70" height="76" rx="9"/><rect ${face} x="19" y="16" width="58" height="14" rx="5"/><circle ${accent} cx="27" cy="23" r="3"/><rect ${muted} x="58" y="20" width="12" height="5" rx="2.5"/><circle ${face} cx="48" cy="57" r="24"/><circle ${window} cx="48" cy="57" r="17"/><path ${lightLine} d="M35 58c8-8 18 8 27-1M38 64c7-5 13 4 20 0"/>`,
    dryer: `${panel}<rect ${shell} x="13" y="10" width="70" height="76" rx="9"/><rect ${face} x="19" y="16" width="58" height="14" rx="5"/><circle ${accent} cx="27" cy="23" r="3"/><circle ${face} cx="48" cy="57" r="24"/><circle ${window} cx="48" cy="57" r="17"/><path ${lightLine} d="M39 64c-5-5 5-8 0-13M48 64c-5-5 5-8 0-13M57 64c-5-5 5-8 0-13"/>`,
    dishwasher: `${panel}<rect ${shell} x="14" y="10" width="68" height="76" rx="9"/><rect ${face} x="20" y="16" width="56" height="14" rx="5"/><circle ${accent} cx="28" cy="23" r="3"/><rect ${face} x="20" y="36" width="56" height="41" rx="6"/><path ${line} d="M27 49h42M30 64h36M33 49v15M44 49v15M55 49v15M66 49v15"/><path ${window} d="M23 67c9-6 16 5 25-2 8-6 14 4 25-1v10H23Z"/>`,
    cooktop: `${panel}<rect ${shell} x="12" y="18" width="72" height="60" rx="10"/><rect ${face} x="18" y="24" width="60" height="48" rx="7"/><circle ${window} cx="35" cy="40" r="10"/><circle ${window} cx="61" cy="40" r="10"/><circle ${window} cx="35" cy="61" r="8"/><circle ${window} cx="61" cy="61" r="8"/><circle ${accent} cx="35" cy="40" r="3"/><circle ${accent} cx="61" cy="61" r="3"/>`,
    television: `${panel}<rect ${shell} x="10" y="18" width="76" height="54" rx="9"/><rect ${window} x="17" y="25" width="62" height="40" rx="5"/><path ${line} d="M39 78h18M48 70v8"/><path ${lightLine} d="M27 53c10-17 29-21 43-9"/>`,
    hood: `${panel}<path ${shell} d="M24 13h48l-5 20H29z"/><rect ${shell} x="18" y="33" width="60" height="12" rx="5"/><rect ${face} x="25" y="37" width="46" height="4" rx="2"/><path ${line} d="M35 54c-5 6-5 12 0 18M48 51c-5 7-5 14 0 22M61 54c-5 6-5 12 0 18"/>`,
    iron: `${panel}<path ${shell} d="M15 62c14-25 28-33 47-24 9 4 15 12 18 24H15z"/><path ${face} d="M27 56c10-13 20-18 32-13 4 2 8 6 10 13H27z"/><path ${line} d="M40 35V24c0-5 4-9 9-9h8M19 69h58"/>`,
    vacuum: `${panel}<rect ${shell} x="24" y="13" width="44" height="51" rx="18"/><circle ${window} cx="46" cy="33" r="10"/><circle ${accent} cx="37" cy="58" r="6"/><path ${line} d="M26 56C12 60 12 75 22 80c8 4 14-1 17-8M68 53h11v10H68"/>`,
    "robot-vacuum": `${panel}<ellipse ${shell} cx="48" cy="52" rx="31" ry="25"/><ellipse ${face} cx="48" cy="47" rx="24" ry="18"/><circle ${window} cx="48" cy="43" r="9"/><circle ${accent} cx="48" cy="43" r="4"/><path ${line} d="M23 62h50M31 72l-7 8M65 72l7 8"/>`,
    "air-conditioner": `${panel}<rect ${shell} x="10" y="18" width="76" height="38" rx="10"/><rect ${face} x="17" y="25" width="62" height="18" rx="6"/><circle ${accent} cx="71" cy="34" r="3"/><path ${line} d="M20 51h56M30 62c-5 6-5 12 0 18M48 62c-5 6-5 12 0 18M66 62c-5 6-5 12 0 18"/>`,
    fan: `${panel}<circle ${shell} cx="48" cy="43" r="29"/><circle ${face} cx="48" cy="43" r="7"/><path ${window} d="M48 35c-7-14 3-22 12-18 8 4 4 13-3 19zM55 47c14-7 22 3 18 12-4 8-13 4-19-3zM41 50c7 14-3 22-12 18-8-4-4-13 3-19z"/><path ${line} d="M48 72v12M35 87h26"/>`,
    coffee: `${panel}<rect ${shell} x="18" y="11" width="50" height="65" rx="10"/><rect ${face} x="25" y="18" width="36" height="14" rx="5"/><circle ${accent} cx="33" cy="25" r="3"/><path ${line} d="M31 39h24v8H31zM43 47v8M56 59h11v16H34V59h11"/><path ${window} d="M39 65h22v6H39z"/>`,
    toaster: `${panel}<rect ${shell} x="16" y="31" width="64" height="43" rx="15"/><rect ${face} x="23" y="38" width="50" height="27" rx="9"/><path ${line} d="M28 31c0-13 7-20 17-20s17 7 17 20M31 24h28M73 43h9M80 43v17"/>`,
    kettle: `${panel}<path ${shell} d="M29 23h34l8 14v35a12 12 0 0 1-12 12H33a12 12 0 0 1-12-12V37z"/><path ${face} d="M31 31h26l6 10v26a8 8 0 0 1-8 8H37a8 8 0 0 1-8-8V41z"/><path ${window} d="M34 51h24v16H34z"/><path ${line} d="M63 32c17 2 19 26 4 32M36 16h20"/>`,
    wallbox: `${panel}<rect ${shell} x="22" y="9" width="52" height="66" rx="12"/><rect ${face} x="29" y="16" width="38" height="26" rx="7"/><path ${accent} d="M52 20l-11 15h8l-3 11 12-16h-8z"/><circle ${window} cx="40" cy="55" r="5"/><circle ${window} cx="56" cy="55" r="5"/><path ${line} d="M30 66h36M74 40c9 3 13 10 13 20v12a7 7 0 0 1-14 0"/>`,
    generic: `${panel}<rect ${shell} x="19" y="17" width="58" height="62" rx="15"/><rect ${face} x="27" y="25" width="42" height="46" rx="10"/><path ${line} d="M39 36v13M57 36v13M38 50h20c0 9-4 14-10 14s-10-5-10-14z"/><circle ${accent} cx="65" cy="29" r="3"/>`,
  };
  return bodies[type] || "";
}

export function applianceArtwork(type, size = 96) {
  const canonical = canonicalArtworkType(type);
  const body = artworkBody(canonical);
  if (!canonical || !body) return "";
  return `<span class="dm-appliance-art dm-appliance-art-0154" data-dm-art="${canonical}" data-dm-art-style="panel"><svg width="${size}" height="${size}" viewBox="0 0 96 96" role="img" aria-hidden="true">${body}</svg></span>`;
}

export const canonicalArtworkType0154 = canonicalArtworkType;
export const applianceArtwork0154 = applianceArtwork;

// 0.14.12 only overrode fridge and boiler. Keep that public contract for tests.
export function applianceArtwork0152(type, size = 96) {
  const canonical = canonicalArtworkType(type);
  return canonical === "fridge" || canonical === "boiler" ? applianceArtwork(type, size) : "";
}

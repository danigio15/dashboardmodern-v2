/* Pure appliance artwork helpers. */

export function canonicalArtworkType(value) {
  const token = String(value || "").toLowerCase();
  if (/microonde|microwave/.test(token)) return "microwave";
  if (/forno|oven|stove/.test(token)) return "oven";
  if (/frigo|fridge|refriger|frigorifero|freezer|congelatore/.test(token)) return "fridge";
  if (/scaldabagno|boiler|water[_ -]?heater/.test(token)) return "boiler";
  if (/lavatrice|washing[_ -]?machine|washer/.test(token)) return "washer";
  if (/asciugatrice|tumble[_ -]?dryer|dryer/.test(token)) return "dryer";
  if (/lavastoviglie|dishwasher/.test(token)) return "dishwasher";
  if (/piano[_ -]?cottura|cooktop|hob/.test(token)) return "cooktop";
  if (/televis|\btv\b|monitor/.test(token)) return "television";
  return "";
}

function artworkBody(type) {
  const panel = '<rect class="dm-art-panel" x="3" y="3" width="90" height="90" rx="20" fill="#e0f2fe"/><path class="dm-art-highlight" fill="#ffffff" opacity=".75" d="M15 13h66a10 10 0 0 1 10 10v8C70 18 42 17 5 39V23A10 10 0 0 1 15 13Z"/>';
  const shell = 'fill="#0f2942"';
  const face = 'fill="#f8fafc"';
  const window = 'fill="#8be2ff"';
  const accent = 'fill="#0ea5e9"';
  const muted = 'fill="#94a3b8"';
  const line = 'fill="none" stroke="#0f2942" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"';
  const lightLine = 'fill="none" stroke="#f8fafc" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"';
  const bodies = {
    oven: `${panel}<rect ${shell} x="15" y="10" width="66" height="76" rx="9"/><rect ${face} x="21" y="17" width="54" height="14" rx="5"/><circle ${accent} cx="29" cy="24" r="3.2"/><circle ${muted} cx="39" cy="24" r="3.2"/><circle ${muted} cx="49" cy="24" r="3.2"/><rect ${face} x="21" y="37" width="54" height="40" rx="6"/><rect ${window} x="28" y="44" width="40" height="25" rx="4"/><path ${line} d="M34 61c8-7 20-7 28 0M31 72h34"/>`,
    microwave: `${panel}<rect ${shell} x="10" y="22" width="76" height="54" rx="10"/><rect ${face} x="16" y="29" width="50" height="40" rx="6"/><rect ${window} x="22" y="35" width="38" height="28" rx="4"/><circle ${accent} cx="76" cy="36" r="5"/><rect ${accent} x="70" y="47" width="12" height="5" rx="2.5"/><rect ${muted} x="70" y="57" width="12" height="5" rx="2.5"/><path ${line} d="M31 56h20M34 51c4-5 10-5 14 0"/>`,
    fridge: `${panel}<rect ${shell} x="20" y="8" width="56" height="80" rx="12"/><rect ${face} x="26" y="14" width="44" height="31" rx="7"/><rect ${face} x="26" y="51" width="44" height="30" rx="7"/><rect ${accent} x="31" y="21" width="6" height="17" rx="3"/><rect ${accent} x="31" y="58" width="6" height="17" rx="3"/><circle ${accent} cx="63" cy="22" r="3"/>`,
    boiler: `${panel}<rect ${shell} x="20" y="8" width="56" height="76" rx="28"/><rect ${face} x="27" y="15" width="42" height="62" rx="21"/><path ${window} d="M28 51c9-8 16 5 25-3 6-5 10-4 16 0v18a13 13 0 0 1-13 13H40a13 13 0 0 1-13-13Z"/><circle ${shell} cx="48" cy="58" r="8"/><path ${lightLine} d="M48 53v6M44 57l4 4 4-4"/><path ${line} d="M36 86v5M60 86v5"/>`,
    washer: `${panel}<rect ${shell} x="13" y="10" width="70" height="76" rx="9"/><rect ${face} x="19" y="16" width="58" height="14" rx="5"/><circle ${accent} cx="27" cy="23" r="3"/><rect ${muted} x="58" y="20" width="12" height="5" rx="2.5"/><circle ${face} cx="48" cy="57" r="24"/><circle ${window} cx="48" cy="57" r="17"/><path ${lightLine} d="M35 58c8-8 18 8 27-1M38 64c7-5 13 4 20 0"/>`,
    dryer: `${panel}<rect ${shell} x="13" y="10" width="70" height="76" rx="9"/><rect ${face} x="19" y="16" width="58" height="14" rx="5"/><circle ${accent} cx="27" cy="23" r="3"/><circle ${face} cx="48" cy="57" r="24"/><circle ${window} cx="48" cy="57" r="17"/><path ${lightLine} d="M39 64c-5-5 5-8 0-13M48 64c-5-5 5-8 0-13M57 64c-5-5 5-8 0-13"/>`,
    dishwasher: `${panel}<rect ${shell} x="14" y="10" width="68" height="76" rx="9"/><rect ${face} x="20" y="16" width="56" height="14" rx="5"/><circle ${accent} cx="28" cy="23" r="3"/><rect ${face} x="20" y="36" width="56" height="41" rx="6"/><path ${line} d="M27 49h42M30 64h36M33 49v15M44 49v15M55 49v15M66 49v15"/><path ${window} d="M23 67c9-6 16 5 25-2 8-6 14 4 25-1v10H23Z"/>`,
    cooktop: `${panel}<rect ${shell} x="12" y="18" width="72" height="60" rx="10"/><rect ${face} x="18" y="24" width="60" height="48" rx="7"/><circle ${window} cx="35" cy="40" r="10"/><circle ${window} cx="61" cy="40" r="10"/><circle ${window} cx="35" cy="61" r="8"/><circle ${window} cx="61" cy="61" r="8"/><circle ${accent} cx="35" cy="40" r="3"/><circle ${accent} cx="61" cy="61" r="3"/>`,
    television: `${panel}<rect ${shell} x="10" y="18" width="76" height="54" rx="9"/><rect ${window} x="17" y="25" width="62" height="40" rx="5"/><path ${line} d="M39 78h18M48 70v8"/><path ${lightLine} d="M27 53c10-17 29-21 43-9"/>`,
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

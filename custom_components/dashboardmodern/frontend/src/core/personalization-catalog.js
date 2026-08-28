// DM-FIX-20260812B
/* DashboardModern personalization visuals. Room/action artwork is local; vehicle
   brand marks use pinned public SVG sources so the same canonical helper owns
   picker, editor, profile cards and EV header without post-render swapping. */
import { getLocale, pick } from "./i18n.js";

const clean = (value) => String(value ?? "").trim();
const normalized = (value) =>
  clean(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const ROOM_DEFINITIONS = [
  [
    "living",
    "Salone",
    "Living room",
    "mdi:sofa",
    "salone soggiorno living sofa lounge",
    "<path d='M8 25v-5c0-4 3-7 7-7h18c4 0 7 3 7 7v5'/><path d='M6 24h36v12H6z'/><path d='M10 36v5m28-5v5M18 24v12m12-12v12'/>",
  ],
  [
    "kitchen",
    "Cucina",
    "Kitchen",
    "mdi:stove",
    "cucina kitchen stove cook",
    "<rect x='8' y='8' width='32' height='32' rx='5'/><circle cx='17' cy='17' r='5'/><circle cx='31' cy='17' r='5'/><circle cx='17' cy='30' r='4'/><circle cx='31' cy='30' r='4'/>",
  ],
  [
    "bedroom",
    "Camera",
    "Bedroom",
    "mdi:bed-king-outline",
    "camera letto bedroom bed matrimoniale",
    "<path d='M7 36V17m34 19V22c0-4-3-7-7-7H20'/><path d='M7 25h34v11H7z'/><path d='M10 18h11c3 0 5 2 5 5v2H10z'/>",
  ],
  [
    "kids",
    "Cameretta",
    "Kids room",
    "mdi:teddy-bear",
    "cameretta bambini kids child nursery giochi",
    "<circle cx='24' cy='23' r='9'/><circle cx='15' cy='15' r='4'/><circle cx='33' cy='15' r='4'/><circle cx='21' cy='22' r='1'/><circle cx='27' cy='22' r='1'/><path d='M21 27c2 2 4 2 6 0M13 39c2-7 6-10 11-10s9 3 11 10'/>",
  ],
  [
    "nursery",
    "Nursery",
    "Nursery",
    "mdi:baby-face-outline",
    "nursery neonato neonati bebe baby",
    "<circle cx='24' cy='23' r='12'/><path d='M18 19h.1M30 19h.1M19 28c3 3 7 3 10 0M18 10c4-5 10-5 14 0'/>",
  ],
  [
    "bathroom",
    "Bagno",
    "Bathroom",
    "mdi:shower",
    "bagno bathroom shower doccia vasca",
    "<path d='M10 10v7m0-7c0-4 4-6 7-4l4 3'/><path d='M18 12l8 8'/><path d='M27 23l-9-9'/><path d='M8 29h32c0 7-5 12-12 12h-8c-7 0-12-5-12-12z'/>",
  ],
  [
    "wc",
    "WC",
    "WC",
    "mdi:toilet",
    "wc toilette toilet servizio",
    "<path d='M17 8h14v13H17z'/><path d='M14 22h20c0 9-4 15-10 15s-10-6-10-15z'/><path d='M19 37h10'/>",
  ],
  [
    "dining",
    "Sala da pranzo",
    "Dining room",
    "mdi:table-chair",
    "sala pranzo dining tavolo",
    "<path d='M10 20h28v6H10zM15 26v14m18-14v14'/><path d='M7 16h7v14H7zm27 0h7v14h-7z'/>",
  ],
  [
    "office",
    "Studio",
    "Office",
    "mdi:desk",
    "studio ufficio office smartworking scrivania",
    "<path d='M8 19h32v8H8zM13 27v13m22-13v13'/><rect x='17' y='8' width='14' height='9' rx='2'/>",
  ],
  [
    "guest",
    "Camera ospiti",
    "Guest room",
    "mdi:account-group-outline",
    "ospiti guest camera",
    "<circle cx='18' cy='18' r='6'/><circle cx='31' cy='20' r='5'/><path d='M7 38c1-8 5-12 11-12s10 4 11 12M27 29c6 0 10 3 11 9'/>",
  ],
  [
    "entrance",
    "Ingresso",
    "Entrance",
    "mdi:door-open",
    "ingresso entrata entrance foyer porta",
    "<path d='M12 41V8h23v33'/><path d='M18 11h12v30H18z'/><circle cx='27' cy='26' r='1'/><path d='M8 41h32'/>",
  ],
  [
    "hallway",
    "Corridoio",
    "Hallway",
    "mdi:door",
    "corridoio disimpegno hallway corridor",
    "<path d='M9 41l7-33h16l7 33M16 8h16M13 26h22'/>",
  ],
  [
    "laundry",
    "Lavanderia",
    "Laundry",
    "mdi:washing-machine",
    "lavanderia laundry lavatrice bucato",
    "<rect x='10' y='7' width='28' height='34' rx='5'/><circle cx='24' cy='26' r='9'/><circle cx='17' cy='13' r='1'/><path d='M27 13h6'/>",
  ],
  [
    "pantry",
    "Dispensa",
    "Pantry",
    "mdi:food-variant",
    "dispensa pantry alimenti",
    "<path d='M11 8h26v33H11zM11 20h26M11 31h26'/><path d='M17 13h6m4 12h5m-15 11h8'/>",
  ],
  [
    "wardrobe",
    "Cabina armadio",
    "Walk-in closet",
    "mdi:hanger",
    "armadio guardaroba wardrobe closet cabina",
    "<path d='M24 10a4 4 0 1 1 4 4c0 3-4 3-4 7'/><path d='M24 21L8 35h32z'/>",
  ],
  [
    "storage",
    "Ripostiglio",
    "Storage",
    "mdi:archive-outline",
    "ripostiglio deposito storage closet",
    "<path d='M9 12h30v28H9zM7 8h34v7H7z'/><path d='M19 23h10'/>",
  ],
  [
    "balcony",
    "Balcone",
    "Balcony",
    "mdi:balcony",
    "balcone balcony",
    "<path d='M12 8h24v18H12zM8 26h32v14H8z'/><path d='M14 26v14m7-14v14m7-14v14m7-14v14'/>",
  ],
  [
    "terrace",
    "Terrazza",
    "Terrace",
    "mdi:patio-heater",
    "terrazza terrace patio",
    "<path d='M9 33h30M13 33v8m22-8v8M15 20h18l4 13H11z'/><path d='M24 8v12m-8-7h16'/>",
  ],
  [
    "garage",
    "Garage",
    "Garage",
    "mdi:garage",
    "garage box auto parking",
    "<path d='M7 20L24 8l17 12v21H7z'/><path d='M12 25h24v16H12zM16 29h16M16 34h16'/>",
  ],
  [
    "cellar",
    "Cantina",
    "Cellar",
    "mdi:glass-wine",
    "cantina cellar vino basement",
    "<path d='M16 9h16c0 9-2 14-8 14S16 18 16 9zM24 23v11m-7 6h14M12 9h24'/>",
  ],
  [
    "attic",
    "Mansarda",
    "Attic",
    "mdi:home-roof",
    "mansarda soffitta attic loft",
    "<path d='M6 25L24 8l18 17M11 22v19h26V22'/><path d='M20 41V29h8v12'/>",
  ],
  [
    "utility",
    "Locale tecnico",
    "Utility room",
    "mdi:tools",
    "locale tecnico caldaia utility tools server",
    "<path d='M13 11l10 10-4 4-10-10zM25 23l14 14-4 4-14-14z'/><path d='M32 8a8 8 0 0 0-7 11l4-4 4 4-4 4a8 8 0 0 0 11-7'/>",
  ],
  [
    "gym",
    "Palestra",
    "Gym",
    "mdi:dumbbell",
    "palestra gym fitness",
    "<path d='M6 21v6m5-10v14m5-8h16m5-6v14m5-10v6'/>",
  ],
  [
    "media",
    "Cinema / Media",
    "Media room",
    "mdi:movie-open-outline",
    "cinema media teatro tv gaming",
    "<rect x='8' y='12' width='32' height='28' rx='4'/><path d='M8 20h32M14 12l5 8m5-8l5 8m5-8l5 8'/>",
  ],
  [
    "garden",
    "Giardino",
    "Garden",
    "mdi:flower",
    "giardino garden verde yard",
    "<circle cx='24' cy='20' r='4'/><circle cx='24' cy='11' r='5'/><circle cx='33' cy='20' r='5'/><circle cx='24' cy='29' r='5'/><circle cx='15' cy='20' r='5'/><path d='M24 33v9'/>",
  ],
  [
    "pool",
    "Piscina",
    "Pool",
    "mdi:pool",
    "piscina pool acqua",
    "<path d='M8 25c5-4 8 4 13 0s8 4 13 0 8 4 10 1M8 34c5-4 8 4 13 0s8 4 13 0 8 4 10 1'/><path d='M16 23V11h9v6h-9m9-1h7'/>",
  ],
];

export const ROOM_GLYPHS = Object.freeze({
  living: "🛋️",
  kitchen: "🍳",
  bedroom: "🛏️",
  kids: "🧸",
  nursery: "👶",
  bathroom: "🚿",
  wc: "🚽",
  dining: "🍽️",
  office: "💻",
  guest: "🛏️",
  entrance: "🚪",
  hallway: "🚪",
  laundry: "🧺",
  pantry: "🥫",
  wardrobe: "👗",
  storage: "📦",
  balcony: "🌇",
  terrace: "🌤️",
  garage: "🚗",
  cellar: "🍷",
  attic: "🏠",
  utility: "🛠️",
  gym: "🏋️",
  media: "🎬",
  garden: "🌿",
  pool: "🏊",
});

export function directEmoji(value) {
  const token = clean(value);
  if (!token || token.startsWith("mdi:")) return "";
  return /[^\p{L}\p{N}\s:_-]/u.test(token) && token.length <= 12 ? token : "";
}

export function roomGlyph(value) {
  const token = clean(value);
  const direct = directEmoji(token);
  if (direct) return direct;
  const legacyAliases = {
    "mdi:bathtub-outline": "🛁",
    "mdi:chef-hat": "🍳",
    "mdi:desk": "💻",
  };
  if (legacyAliases[token.toLowerCase()]) return legacyAliases[token.toLowerCase()];
  return ROOM_GLYPHS[roomCatalogMatch(token)?.id] || "🏠";
}

export const ROOM_CATALOG = Object.freeze(
  ROOM_DEFINITIONS.map(([id, it, en, mdi, keywords, body]) =>
    Object.freeze({ id, it, en, mdi, keywords, body }),
  ),
);

const CAR_NAMES = [
  "Abarth",
  "Alfa Romeo",
  "Audi",
  "BMW",
  "BYD",
  "Citroën",
  "Cupra",
  "Dacia",
  "DS",
  "Fiat",
  "Ford",
  "Honda",
  "Hyundai",
  "Jeep",
  "Kia",
  "Lancia",
  "Leapmotor",
  "Lexus",
  "Mazda",
  "Mercedes-Benz",
  "MG",
  "MINI",
  "Nissan",
  "Opel",
  "Peugeot",
  "Polestar",
  "Porsche",
  "Renault",
  "SEAT",
  "Škoda",
  "Smart",
  "Subaru",
  "Suzuki",
  "Tesla",
  "Toyota",
  "Volkswagen",
  "Volvo",
  "XPeng",
];
export const CAR_BRANDS = Object.freeze(
  CAR_NAMES.map((name) =>
    Object.freeze({
      id: normalized(name).replace(/[^a-z0-9]+/g, "-"),
      name,
      initials: name
        .split(/[\s-]+/)
        .map((part) => part[0])
        .join("")
        .slice(0, 3)
        .toUpperCase(),
    }),
  ),
);

const SIMPLE_ICON_SLUGS = Object.freeze({
  abarth: "abarth",
  "alfa-romeo": "alfaromeo",
  audi: "audi",
  bmw: "bmw",
  byd: "byd",
  citroen: "citroen",
  cupra: "cupra",
  dacia: "dacia",
  ds: "dsautomobiles",
  fiat: "fiat",
  ford: "ford",
  honda: "honda",
  hyundai: "hyundai",
  jeep: "jeep",
  kia: "kia",
  lancia: "lancia",
  lexus: "lexus",
  mazda: "mazda",
  "mercedes-benz": "mercedesbenz",
  mg: "mg",
  mini: "mini",
  nissan: "nissan",
  opel: "opel",
  peugeot: "peugeot",
  polestar: "polestar",
  porsche: "porsche",
  renault: "renault",
  seat: "seat",
  skoda: "skoda",
  smart: "smart",
  subaru: "subaru",
  suzuki: "suzuki",
  tesla: "tesla",
  toyota: "toyota",
  volkswagen: "volkswagen",
  volvo: "volvo",
  xpeng: "xpeng",
});
const CAR_BRAND_OVERRIDES = Object.freeze({});

/* La tinta d'istituto di ogni marchio.
 *
 * I loghi erano tutti neri: su fondo scuro sparivano, e messi in fila
 * sembravano tutti la stessa cosa. Il colore lo dichiara il pacchetto da cui
 * vengono i file — quelli disegnati da noi hanno il colore della loro casa — e
 * lo scrive lo script di build: un colore copiato a occhio e' un colore
 * sbagliato che nessuno rilegge piu'. */
const CAR_BRAND_COLORS = Object.freeze({
  abarth: "#B01B2E",
  "alfa-romeo": "#981E32",
  audi: "#BB0A30",
  bmw: "#0066B1",
  byd: "#D0021B",
  citroen: "#DA291C",
  cupra: "#95572B",
  dacia: "#646B52",
  fiat: "#941711",
  ford: "#00274E",
  honda: "#E40521",
  hyundai: "#002C5E",
  lancia: "#003B7A",
  leapmotor: "#0B69C7",
  "mercedes-benz": "#00A19B",
  mg: "#FF0000",
  nissan: "#C3002F",
  opel: "#F7FF14",
  porsche: "#B12B28",
  renault: "#FFCC33",
  smart: "#D7E600",
  subaru: "#013C74",
  suzuki: "#E30613",
  tesla: "#CC0000",
  toyota: "#EB0A1E",
  volkswagen: "#151F5D",
  volvo: "#003057",
  xpeng: "#00A0E9",
});

/** Di che colore va disegnato questo marchio. Vuoto = quello del tema. */
export function carBrandColor(value) {
  const item = brandMatch(value);
  return (item && CAR_BRAND_COLORS[item.id]) || "";
}

/* I marchi di cui il logo ce l'abbiamo davvero, in casa.
 *
 * Lo scrive `scripts/costruisci-loghi-auto.mjs` guardando cosa e' riuscito a
 * mettere in `frontend/brands/`. Otto marchi non ci sono — Simple Icons li ha
 * tolti per ragioni di marchio registrato — e per quelli resta il tondo con le
 * iniziali, che e' disegnato da noi e non manca mai.
 *
 * Questo elenco NON si scrive a mano: se qualcuno aggiunge un logo alla
 * cartella e si dimentica di aggiungerlo qui, una prova lo ferma. */
const LOGHI_IN_CASA = Object.freeze([
  "abarth",
  "alfa-romeo",
  "audi",
  "bmw",
  "byd",
  "citroen",
  "cupra",
  "dacia",
  "ds",
  "fiat",
  "ford",
  "honda",
  "hyundai",
  "jeep",
  "kia",
  "lancia",
  "lexus",
  "mazda",
  "mercedes-benz",
  "mg",
  "mini",
  "nissan",
  "opel",
  "peugeot",
  "polestar",
  "porsche",
  "renault",
  "seat",
  "skoda",
  "smart",
  "subaru",
  "suzuki",
  "tesla",
  "toyota",
  "volkswagen",
  "volvo",
  "xpeng",
]);

/* Dove stanno i file.
 *
 * Non sono codice, quindi non hanno un `import.meta.url` loro: si ricava dal
 * nostro, togliendo la versione. I loghi non cambiano da un rilascio all'altro,
 * e tenerli fuori dalla versione vuol dire non riscaricarli ogni volta. */
function cartellaLoghi() {
  const qui = import.meta.url;
  const taglio = qui.indexOf("/dashboardmodern_static/");
  if (taglio < 0) return "../../brands/";
  return `${qui.slice(0, taglio)}/dashboardmodern_static/brands/`;
}

/**
 * L'indirizzo del logo di un marchio, dentro l'integrazione.
 *
 * Prima era un indirizzo su un CDN, costruito a mano. Una plancia di Home
 * Assistant sta su una rete di casa, e molte non escono su internet: li' i
 * loghi non arrivavano mai, tutti quanti. Adesso i file sono nostri, arrivano
 * sempre, e si possono ritoccare.
 */
export function carBrandImageSource(value) {
  const item = brandMatch(value);
  if (!item) return "";
  if (CAR_BRAND_OVERRIDES[item.id]) return CAR_BRAND_OVERRIDES[item.id];
  return LOGHI_IN_CASA.includes(item.id) ? `${cartellaLoghi()}${item.id}.svg` : "";
}

export const CAR_ICON_CATALOG = Object.freeze(
  [
    ["electric", "Elettrica", "Electric", "mdi:car-electric", "⚡"],
    ["car", "Auto", "Car", "mdi:car", "🚗"],
    ["sports", "Sportiva", "Sports", "mdi:car-sports", "🏎️"],
    ["hatchback", "Compatta", "Hatchback", "mdi:car-hatchback", "🚙"],
    ["estate", "Station wagon", "Estate", "mdi:car-estate", "🚘"],
    ["pickup", "Pickup", "Pickup", "mdi:car-pickup", "🛻"],
    ["convertible", "Cabrio", "Convertible", "mdi:car-convertible", "🏎️"],
    ["wagon", "SUV / Wagon", "SUV / Wagon", "mdi:car-wagon", "🚙"],
  ].map(([id, it, en, mdi, glyph]) => Object.freeze({ id, it, en, mdi, glyph })),
);

export const ACTION_ICON_CATALOG = Object.freeze(
  [
    ["home", "Casa", "Home", "mdi:home", "🏠"],
    ["lights", "Luci", "Lights", "mdi:lightbulb", "💡"],
    ["lights-group", "Gruppo luci", "Light group", "mdi:lightbulb-group", "💡"],
    ["climate", "Clima", "Climate", "mdi:snowflake", "❄️"],
    ["heat", "Riscaldamento", "Heating", "mdi:radiator", "🔥"],
    ["security", "Sicurezza", "Security", "mdi:shield-home", "🛡️"],
    ["gate", "Cancello", "Gate", "mdi:gate", "🚪"],
    ["shutters", "Tapparelle", "Shutters", "mdi:window-shutter", "🪟"],
    ["scene", "Scena", "Scene", "mdi:movie-open", "🎬"],
    ["script", "Script", "Script", "mdi:script-text-play", "▶️"],
    ["toggle", "Interruttore", "Toggle", "mdi:toggle-switch-outline", "🔀"],
    ["laundry", "Lavatrice", "Washing machine", "mdi:washing-machine", "🧺"],
    ["power", "Energia", "Power", "mdi:flash", "⚡"],
    ["ev", "Auto", "Car", "mdi:car-electric", "🚗"],
    ["boiler", "Boiler", "Boiler", "mdi:water-boiler", "♨️"],
    ["water", "Acqua", "Water", "mdi:water", "💧"],
    ["camera", "Telecamera", "Camera", "mdi:cctv", "📷"],
    ["bell", "Avviso", "Alert", "mdi:bell", "🔔"],
    ["star", "Preferito", "Favorite", "mdi:star", "⭐"],
  ].map(([id, it, en, mdi, glyph]) => Object.freeze({ id, it, en, mdi, glyph })),
);

const ACTION_ARTWORK = Object.freeze({
  home: "<path d='M7 22L24 8l17 14v18H29V29H19v11H7z'/>",
  lights:
    "<path d='M17 30c-4-3-6-7-6-12a13 13 0 0 1 26 0c0 5-2 9-6 12l-2 3H19z'/><path d='M19 37h10M20 41h8'/>",
  "lights-group":
    "<path d='M7 27c-3-2-4-5-4-8a9 9 0 0 1 18 0c0 3-1 6-4 8l-1 3H8z'/><path d='M31 27c-3-2-4-5-4-8a9 9 0 0 1 18 0c0 3-1 6-4 8l-1 3h-8z'/><path d='M9 34h6m18 0h6'/>",
  climate:
    "<path d='M24 5v38M8 14l32 20M8 34l32-20'/><path d='M19 10l5-5 5 5M19 38l5 5 5-5M9 20l-1-6 6-1M34 35l6-1-1-6M14 35l-6-1 1-6M39 20l1-6-6-1'/>",
  heat: "<rect x='9' y='12' width='30' height='27' rx='4'/><path d='M16 12v27m8-27v27m8-27v27M12 8v4m24-4v4M14 43v-4m20 4v-4'/>",
  security:
    "<path d='M24 5l15 6v11c0 10-6 17-15 21C15 39 9 32 9 22V11z'/><path d='M18 23l4 4 8-9'/>",
  gate: "<path d='M8 41V9h32v32M14 41V15h20v26M14 23h20M14 31h20'/>",
  shutters:
    "<rect x='8' y='7' width='32' height='34' rx='3'/><path d='M12 13h24M12 19h24M12 25h24M12 31h24M12 37h24'/>",
  scene:
    "<rect x='7' y='17' width='34' height='24' rx='3'/><path d='M7 17l5-10h29l-5 10M17 7l-5 10M29 7l-5 10'/>",
  script: "<path d='M12 6h18l7 7v29H12z'/><path d='M30 6v8h7M18 23l12 7-12 7z'/>",
  toggle: "<rect x='5' y='15' width='38' height='18' rx='9'/><circle cx='31' cy='24' r='6'/>",
  laundry:
    "<rect x='9' y='5' width='30' height='38' rx='5'/><circle cx='24' cy='27' r='10'/><path d='M14 11h3m5 0h12'/>",
  power: "<path d='M27 4L11 27h11l-2 17 17-25H26z'/>",
  ev: "<path d='M10 31l3-12h22l4 12v8H9v-8z'/><path d='M15 19l4-7h10l4 7M15 31h18'/><circle cx='15' cy='37' r='3'/><circle cx='33' cy='37' r='3'/><path d='M24 21v8m-3-4h6'/>",
  boiler:
    "<rect x='11' y='7' width='26' height='34' rx='6'/><path d='M18 27c0-5 6-7 6-13 5 5 8 9 6 14-1 4-4 7-7 7s-5-3-5-8z'/>",
  water: "<path d='M24 5S11 21 11 30a13 13 0 0 0 26 0C37 21 24 5 24 5z'/>",
  camera:
    "<rect x='7' y='13' width='34' height='26' rx='5'/><circle cx='24' cy='26' r='8'/><path d='M14 13l4-6h12l4 6'/>",
  bell: "<path d='M11 34h26l-4-6v-8a9 9 0 0 0-18 0v8z'/><path d='M20 39c2 4 6 4 8 0'/>",
  star: "<path d='M24 5l6 12 13 2-9 9 2 13-12-6-12 6 2-13-9-9 13-2z'/>",
});

function svg(body, size, className, token) {
  const safeSize = Math.max(16, Math.min(160, Number(size) || 48));
  return `<span class="${className}" data-visual="${token}"><svg width="${safeSize}" height="${safeSize}" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg></span>`;
}

function leapmotorVisual(size = 48) {
  const safeSize = Math.max(20, Math.min(160, Number(size) || 48));
  return `<span class="dm-car-brand dm-leapmotor-mark" data-brand="leapmotor" data-brand-source="inline" data-dm-beta5-brand="Leapmotor" title="Leapmotor" style="width:${safeSize}px;height:${safeSize}px;color:${CAR_BRAND_COLORS.leapmotor || "currentColor"}"><span data-brand-logo="leapmotor" style="display:grid;place-items:center;width:100%;height:100%"><svg width="${safeSize}" height="${safeSize}" viewBox="0 0 48 48" aria-hidden="true" fill="currentColor"><path d="M6 16 17 10v19l6 4v9L6 32z"/><path d="M24 5l18 10v17l-14 8V28l7-4v-6l-7-4v31l-4-2z"/></svg></span></span>`;
}

/* Il nome mdi di una voce e' quello che si salva nella configurazione: quando
 * arriva di li', la voce e' una sola e la si riconosce per intero. Prima si
 * passava subito al confronto a parole, che pero' dichiara buona la prima voce
 * che ha una parola qualsiasi dentro al nome cercato: `mdi:home` finiva in
 * soffitta, e `mdi:silverware-fork-knife` non trovava la cucina perche' il
 * confronto era fra trattini e spazi. Il giro largo resta, ma dopo. */
const nomeVoce = (value) => normalized(value).replace(/^mdi:/, "").replace(/[-_]+/g, " ").trim();

export function roomCatalogMatch(value) {
  const token = nomeVoce(value);
  if (!token) return ROOM_CATALOG[0];
  const esatta = ROOM_CATALOG.find(
    (item) => item.id === token || nomeVoce(item.mdi) === token || nomeVoce(item.id) === token,
  );
  if (esatta) return esatta;
  return (
    ROOM_CATALOG.find(
      (item) =>
        normalized(item.mdi).includes(token) ||
        `${item.keywords} ${item.it} ${item.en}`
          .split(/\s+/)
          .some((word) => token.includes(normalized(word))),
    ) || null
  );
}

export function roomVisual(value, size = 48) {
  const item = roomCatalogMatch(value);
  if (!item) return "";
  const safeSize = Math.max(16, Math.min(160, Number(size) || 48));
  const glyph = ROOM_GLYPHS[item.id] || roomGlyph(item.mdi);
  return `<span class="dm-room-art dm-room-glyph" data-visual="${item.id}" style="font-size:${safeSize}px"><span aria-hidden="true">${glyph}</span></span>`;
}

export function brandMatch(value) {
  const token = normalized(value);
  if (!token) return null;
  return (
    CAR_BRANDS.find(
      (item) =>
        token === normalized(item.name) ||
        token === item.id ||
        token.includes(normalized(item.name)),
    ) || null
  );
}

/* Una marca che non conosciamo non e' una marca che conosciamo.
 *
 * Il ripiego era Leapmotor: chi scriveva una marca fuori dal catalogo si
 * ritrovava addosso il marchio di un'altra casa, senza che niente glielo
 * dicesse. Non e' un dettaglio estetico — e' la plancia che afferma una cosa
 * falsa sulla macchina di qualcuno. Quando non si sa, si dicono le iniziali di
 * quello che e' stato scritto: e' onesto, e si legge. */
function brandFallback(value, safeSize) {
  const nome = String(value ?? "").trim();
  /* Nessuna marca scelta non e' «marca sconosciuta».
   *
   * Le iniziali sono la risposta giusta a «hai scritto una marca che non
   * conosco»: dicono cosa c'e' scritto, e sono oneste. Ma su una scheda dove
   * non si e' ancora scelto niente non c'e' niente da abbreviare, e usciva un
   * punto interrogativo dentro un cerchio: sembra un errore, e non lo e'. Chi
   * non ha ancora scelto vede una macchina, che e' esattamente quello che c'e'
   * da vedere. */
  if (!nome)
    return `<span class="dm-car-brand" data-brand="" data-brand-source="empty" aria-hidden="true" style="width:${safeSize}px;height:${safeSize}px;display:grid;place-items:center;font-size:${Math.round(safeSize * 0.62)}px">🚗</span>`;
  const initials = (nome.slice(0, 2) || "?").toUpperCase();
  const fontSize = initials.length > 2 ? 10 : initials.length === 2 ? 13 : 16;
  return `<span class="dm-car-brand" data-brand="" data-brand-source="unknown" title="${nome}" style="width:${safeSize}px;height:${safeSize}px"><span data-brand-logo=""><svg width="${safeSize}" height="${safeSize}" viewBox="0 0 48 48" aria-hidden="true"><rect x="3" y="3" width="42" height="42" rx="14" fill="currentColor" opacity=".12"/><circle cx="24" cy="24" r="15.5" fill="none" stroke="currentColor" stroke-width="2.4" opacity=".9"/><text x="24" y="28.5" text-anchor="middle" font-size="${fontSize}" font-family="system-ui,sans-serif" font-weight="900" fill="currentColor">${initials}</text></svg></span></span>`;
}

export function carBrandVisual(value, size = 48) {
  const safeSize = Math.max(20, Math.min(160, Number(size) || 48));
  const item = brandMatch(value);
  if (!item) return brandFallback(value, safeSize);
  if (item.id === "leapmotor") return leapmotorVisual(safeSize);
  const initials = item.initials || item.name.slice(0, 2).toUpperCase();
  const fontSize = initials.length > 2 ? 10 : initials.length === 2 ? 13 : 16;
  const source = carBrandImageSource(item.name);
  if (source) {
    const width = Math.max(safeSize, Math.round(safeSize * 1.75));
    const tinta = CAR_BRAND_COLORS[item.id];
    /* La forma viene dal file, il colore dalla plancia.
     *
     * Il logo era un `<img>`, e un SVG dentro un `<img>` e' un documento a
     * parte: `currentColor` li' dentro non vede niente e resta nero. Erano
     * tutti neri qualunque cosa dicesse il catalogo — e un logo nero su tema
     * scuro sparisce.
     *
     * Con la maschera il file dice solo DOVE disegnare, e il colore lo mette
     * il fondo: la tinta d'istituto dove ce n'e' una leggibile, il colore del
     * tema per le case il cui marchio e' nero — che seguono la plancia invece
     * di sparirci dentro. Il file resta un file, modificabile, e non ottanta
     * chilobyte di percorsi dentro a un modulo. */
    /* Le virgolette qui dentro sono singole di proposito: doppie chiuderebbero
     * l'attributo `style` a meta' frase, e la maschera arriverebbe vuota — che
     * si vede come un riquadro senza niente, non come un errore. E le proprieta'
     * sono scritte per esteso invece che nella forma breve, che non tutti i
     * motori accettano con la stessa grammatica. */
    const maschera = [
      `-webkit-mask-image:url('${source}')`,
      "-webkit-mask-size:contain",
      "-webkit-mask-repeat:no-repeat",
      "-webkit-mask-position:center",
      `mask-image:url('${source}')`,
      "mask-size:contain",
      "mask-repeat:no-repeat",
      "mask-position:center",
    ].join(";");
    return `<span class="dm-car-brand" data-brand="${item.id}" data-brand-source="canonical" data-dm-beta5-brand="${item.name}" title="${item.name}" style="width:${width}px;height:${safeSize}px${tinta ? `;color:${tinta}` : ""}"><span data-brand-logo="${item.id}" data-dm-brand-image="${item.id}" role="img" aria-label="${item.name}" style="display:block;width:100%;height:100%;background:currentColor;${maschera}"></span></span>`;
  }
  const tintaRipiego = CAR_BRAND_COLORS[item.id];
  return `<span class="dm-car-brand" data-brand="${item.id}" data-brand-source="fallback" data-dm-beta5-brand="${item.name}" title="${item.name}" style="width:${safeSize}px;height:${safeSize}px${tintaRipiego ? `;color:${tintaRipiego}` : ""}"><span data-brand-logo="${item.id}"><svg width="${safeSize}" height="${safeSize}" viewBox="0 0 48 48" aria-hidden="true"><rect x="3" y="3" width="42" height="42" rx="14" fill="currentColor" opacity=".12"/><circle cx="24" cy="24" r="15.5" fill="none" stroke="currentColor" stroke-width="2.4" opacity=".9"/><text x="24" y="28.5" text-anchor="middle" font-size="${fontSize}" font-family="system-ui,sans-serif" font-weight="900" fill="currentColor">${initials}</text></svg></span></span>`;
}

export function carIconMatch(value) {
  const token = normalized(value).replace(/^mdi:/, "").replace(/[-_]+/g, " ");
  if (!token) return CAR_ICON_CATALOG[0];
  return (
    CAR_ICON_CATALOG.find(
      (item) =>
        normalized(item.id) === token ||
        normalized(item.mdi).replace(/^mdi:/, "").replace(/[-_]+/g, " ") === token ||
        normalized(item.it) === token ||
        normalized(item.en) === token,
    ) ||
    CAR_ICON_CATALOG.find((item) => token.includes(normalized(item.id))) ||
    null
  );
}

export function carIconVisual(value, size = 48) {
  const item = carIconMatch(value) || CAR_ICON_CATALOG[0];
  const safeSize = Math.max(20, Math.min(160, Number(size) || 48));
  const glyphSize = Math.max(16, Math.round(safeSize * 0.52));
  return `<span class="dm-car-icon-glyph" data-car-icon="${item.id}" title="${item.it}" style="width:${safeSize}px;height:${safeSize}px;font-size:${glyphSize}px"><span aria-hidden="true">${item.glyph}</span></span>`;
}

export function actionCatalogMatch(value) {
  const token = normalized(value).replace(/^mdi:/, "").replace(/[-_]+/g, " ");
  if (!token) return ACTION_ICON_CATALOG[0];
  return (
    ACTION_ICON_CATALOG.find(
      (item) =>
        normalized(item.id) === token ||
        normalized(item.mdi).replace(/^mdi:/, "").replace(/[-_]+/g, " ") === token ||
        normalized(item.it) === token ||
        normalized(item.en) === token,
    ) || null
  );
}

export function actionVisual(value, size = 48) {
  const item = actionCatalogMatch(value);
  if (!item) return "";
  const safeSize = Math.max(16, Math.min(160, Number(size) || 48));
  return `<span class="dm-action-glyph" data-visual="${item.id}" style="font-size:${safeSize}px"><span aria-hidden="true">${item.glyph || "⭐"}</span></span>`;
}

/* What can actually draw power in a home. The action catalogue was the wrong
 * list to offer here: it is built around what a button on the dashboard *does*
 * — a scene, a script, an alert, the alarm, a camera — and none of those is a
 * load. This one is built around what consumes: the appliances and plants
 * themselves, and the areas a load is measured in, because a circle is just as
 * often "the kitchen" as it is "the oven".
 *
 * Every entry keeps a distinct `mdi`, so the same icon is never offered twice;
 * `LOAD_ROOM_SKIP` drops the areas whose icon is already an appliance here. */
const LOAD_APPLIANCE_DEFINITIONS = [
  ["power", "Energia", "Power", "mdi:flash", "⚡", "consumo generale casa totale"],
  ["socket", "Presa", "Socket", "mdi:power-socket-eu", "🔌", "presa spina generica"],
  ["light", "Illuminazione", "Lighting", "mdi:lightbulb", "💡", "luce luci lampada"],
  ["lights-group", "Gruppo luci", "Light group", "mdi:lightbulb-group", "🪔", "luci gruppo"],
  ["boiler", "Boiler", "Boiler", "mdi:water-boiler", "♨️", "scaldabagno acqua calda resistenza"],
  ["heat-pump", "Pompa di calore", "Heat pump", "mdi:heat-pump", "🌡️", "pompa calore termica"],
  [
    "air-conditioner",
    "Condizionatore",
    "Air conditioner",
    "mdi:air-conditioner",
    "❄️",
    "clima split freddo",
  ],
  ["radiator", "Riscaldamento", "Heating", "mdi:radiator", "🔥", "termosifone calorifero caldo"],
  [
    "floor-heating",
    "Riscaldamento a pavimento",
    "Underfloor heating",
    "mdi:heating-coil",
    "🌡️",
    "pavimento radiante",
  ],
  [
    "fireplace",
    "Stufa a pellet",
    "Pellet stove",
    "mdi:fireplace",
    "🪵",
    "stufa camino pellet legna",
  ],
  ["oven", "Forno", "Oven", "mdi:toaster-oven", "🍕", "forno cottura"],
  ["hob", "Piano cottura", "Hob", "mdi:countertop", "🍳", "fornelli induzione piastra"],
  ["hood", "Cappa", "Cooker hood", "mdi:air-filter", "💨", "cappa aspirazione cucina"],
  ["microwave", "Microonde", "Microwave", "mdi:microwave", "🍲", "microonde forno"],
  ["fridge", "Frigorifero", "Fridge", "mdi:fridge", "🧊", "frigo frigorifero"],
  [
    "freezer",
    "Congelatore",
    "Freezer",
    "mdi:snowflake-variant",
    "🥶",
    "freezer congelatore surgelati",
  ],
  ["dishwasher", "Lavastoviglie", "Dishwasher", "mdi:dishwasher", "🍽️", "lavastoviglie piatti"],
  [
    "washer",
    "Lavatrice",
    "Washing machine",
    "mdi:washing-machine",
    "🧺",
    "lavatrice bucato lavaggio",
  ],
  [
    "dryer",
    "Asciugatrice",
    "Tumble dryer",
    "mdi:tumble-dryer",
    "👕",
    "asciugatrice asciugabiancheria",
  ],
  ["iron", "Ferro da stiro", "Iron", "mdi:iron", "👔", "ferro stiro stireria"],
  ["coffee", "Macchina caffè", "Coffee machine", "mdi:coffee-maker", "☕", "caffe espresso"],
  ["kettle", "Bollitore", "Kettle", "mdi:kettle", "🫖", "bollitore te acqua"],
  ["grill", "Barbecue", "Grill", "mdi:grill", "🍖", "barbecue griglia bbq"],
  ["vacuum", "Aspirapolvere", "Vacuum", "mdi:robot-vacuum", "🤖", "aspirapolvere robot pulizia"],
  ["fan", "Ventilatore", "Fan", "mdi:fan", "🌀", "ventilatore ventola aria"],
  [
    "dehumidifier",
    "Deumidificatore",
    "Dehumidifier",
    "mdi:air-humidifier",
    "🌫️",
    "deumidificatore umidita umidificatore",
  ],
  ["hairdryer", "Asciugacapelli", "Hair dryer", "mdi:hair-dryer", "💇", "phon asciugacapelli"],
  ["tv", "TV", "TV", "mdi:television", "📺", "televisore tv salotto"],
  ["computer", "Computer", "Computer", "mdi:desktop-tower-monitor", "💻", "pc computer postazione"],
  ["server", "Server / NAS", "Server / NAS", "mdi:server", "🖥️", "server nas rack homelab"],
  ["router", "Rete e router", "Network", "mdi:router-wireless", "📶", "router modem rete wifi"],
  ["printer", "Stampante", "Printer", "mdi:printer", "🖨️", "stampante stampa"],
  [
    "ev",
    "Auto elettrica",
    "Electric car",
    "mdi:car-electric",
    "🚗",
    "auto macchina veicolo elettrica",
  ],
  [
    "wallbox",
    "Colonnina di ricarica",
    "Charging station",
    "mdi:ev-station",
    "⛽",
    "wallbox colonnina ricarica",
  ],
  ["solar", "Fotovoltaico", "Solar", "mdi:solar-power", "☀️", "solare fotovoltaico pannelli"],
  ["battery", "Batteria", "Battery", "mdi:battery-charging", "🔋", "batteria accumulo"],
  ["pump", "Pompa", "Pump", "mdi:pump", "💧", "pompa autoclave rilancio"],
  ["water", "Acqua", "Water", "mdi:water", "🚰", "acqua idrico"],
  [
    "irrigation",
    "Irrigazione",
    "Irrigation",
    "mdi:sprinkler-variant",
    "🌱",
    "irrigazione giardino annaffiare",
  ],
  [
    "sauna",
    "Sauna e idromassaggio",
    "Sauna and hot tub",
    "mdi:hot-tub",
    "🧖",
    "sauna idromassaggio jacuzzi",
  ],
  ["gate", "Cancello", "Gate", "mdi:gate", "🚪", "cancello portone motore"],
  [
    "shutters",
    "Tapparelle",
    "Shutters",
    "mdi:window-shutter",
    "🪟",
    "tapparelle serrande persiane",
  ],
  ["lift", "Ascensore", "Lift", "mdi:elevator", "🛗", "ascensore montacarichi"],
];

// Areas whose icon is an appliance offered above: the appliance wins, so the
// same tile is never drawn twice.
const LOAD_ROOM_SKIP = Object.freeze(new Set(["laundry"]));

export const LOAD_ICON_CATALOG = Object.freeze([
  ...ROOM_CATALOG.filter((item) => !LOAD_ROOM_SKIP.has(item.id)).map((item) =>
    Object.freeze({
      id: `room-${item.id}`,
      it: item.it,
      en: item.en,
      mdi: item.mdi,
      glyph: ROOM_GLYPHS[item.id] || "🏠",
      group: "room",
      keywords: item.keywords,
    }),
  ),
  ...LOAD_APPLIANCE_DEFINITIONS.map(([id, it, en, mdi, glyph, keywords]) =>
    Object.freeze({ id, it, en, mdi, glyph, group: "appliance", keywords }),
  ),
]);

export function loadCatalogMatch(value) {
  const token = normalized(value).replace(/^mdi:/, "").replace(/[-_]+/g, " ");
  if (!token) return null;
  return (
    LOAD_ICON_CATALOG.find(
      (item) =>
        normalized(item.id) === token ||
        normalized(item.mdi).replace(/^mdi:/, "").replace(/[-_]+/g, " ") === token ||
        normalized(item.it) === token ||
        normalized(item.en) === token,
    ) || null
  );
}

export function loadGlyph(value) {
  const token = clean(value);
  // An unset icon is a plug, like every other default in the loads model — not
  // the first entry of the action catalogue, which is a house.
  if (!token) return "🔌";
  const direct = directEmoji(token);
  if (direct) return direct;
  return loadCatalogMatch(token)?.glyph || actionCatalogMatch(token)?.glyph || "🔌";
}

/* Qui c'era anche un roomOptionsMarkup che elencava le icone del catalogo.
 * Nessuno lo importava, e il nome era quello con cui mezza plancia chiede
 * l'elenco delle stanze configurate — che vive in sections/shared.js e fa una
 * cosa completamente diversa. Un nome uguale per due cose diverse e' un errore
 * che aspetta chi importa in fretta. */

/* Catalog entries carry an Italian and an English name; the English one is the
 * pivot every other language is keyed by. */
export function catalogLabel(item = {}, locale = getLocale()) {
  return pick(item.it, item.en, locale) || item.it || item.en || "";
}

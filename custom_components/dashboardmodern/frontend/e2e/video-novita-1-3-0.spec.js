/* Il giro guidato della 1.3.0, registrato.
 *
 * Non e' una prova: e' il filmato che si manda a chi la plancia la usa. Ogni
 * scena accende una delle cose nuove — il Colpo d'occhio in Home, le Stanze,
 * l'Energia a piu' impianti, l'antifurto che si fa dichiarare dalla centrale,
 * la foto dell'auto intera, i ritratti, le schede delle luci e l'interruttore
 * dei widget — e la didascalia in sovrimpressione dice cosa si sta guardando.
 *
 * Si registra a mano, perche' dura un minuto e in CI non serve a nessuno:
 *
 *   DM_VIDEO=1 npx playwright test e2e/video-novita-1-3-0.spec.js --project=desktop
 *
 * Il filmato esce in `test-results/<nome-della-prova>/video.webm`.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

test.use({ video: { mode: "on", size: { width: 1440, height: 900 } } });
test.describe.configure({ timeout: 12 * 60 * 1000 });

/* ── la casa finta, quella del filmato ──────────────────────────────────── */

const STANZE = [
  {
    id: "room-salone",
    name: "Salone",
    icon: "🛋️",
    temp: "sensor.salone_t",
    hum: "sensor.salone_h",
  },
  { id: "room-cucina", name: "Cucina", icon: "🍳", temp: "sensor.cucina_t", hum: "" },
  { id: "room-camera", name: "Camera", icon: "🛏️", temp: "sensor.camera_t", hum: "" },
];

const SEME = {
  schema_version: 4,
  sections: {
    rooms: STANZE,
    cameras: [],
    appliances: [
      {
        id: "app-lavatrice",
        name: "Lavatrice",
        type: "washer",
        icon: "mdi:washing-machine",
        power: "sensor.lavatrice_w",
        energy: "sensor.lavatrice_kwh",
        room_id: "room-cucina",
      },
      {
        id: "app-lavastoviglie",
        name: "Lavastoviglie",
        type: "dishwasher",
        icon: "mdi:dishwasher",
        power: "sensor.lavastoviglie_w",
        energy: "sensor.lavastoviglie_kwh",
        room_id: "room-cucina",
      },
    ],
    loads: [
      { id: "forno", name: "Forno", icon: "🔥", power_entity: "sensor.forno_w", order: 0 },
      {
        id: "pompa",
        name: "Pompa di calore",
        icon: "♨️",
        power_entity: "sensor.pompa_w",
        order: 1,
        plant: "impianto-donato",
      },
    ],
    /* Nomi lunghi apposta: erano loro a non entrare nelle schede. */
    lights: [
      {
        id: "luce-salone",
        name: "Lampadario del salone",
        entities: ["light.salone"],
        room_id: "room-salone",
      },
      {
        id: "luce-libreria",
        name: "Faretti della libreria",
        entities: ["light.libreria"],
        room_id: "room-salone",
      },
      {
        id: "luce-tv",
        name: "Retroilluminazione TV",
        entities: ["light.tv"],
        room_id: "room-salone",
      },
      {
        id: "luce-cucina",
        name: "Faretti del piano cottura",
        entities: ["light.cucina"],
        room_id: "room-cucina",
      },
      {
        id: "luce-isola",
        name: "Sospensioni sopra l'isola",
        entities: ["light.isola"],
        room_id: "room-cucina",
      },
      {
        id: "luce-camera",
        name: "Abat-jour del comodino",
        entities: ["light.camera"],
        room_id: "room-camera",
      },
      {
        id: "luce-armadio",
        name: "Strisce dell'armadio",
        entities: ["light.armadio"],
        room_id: "room-camera",
      },
      { id: "luce-corridoio", name: "Corridoio", entities: ["light.corridoio"], room_id: "" },
    ],
    climate: [
      {
        id: "clima-salone",
        name: "Clima salone",
        entity: "climate.salone",
        room_id: "room-salone",
      },
    ],
    ev: [
      {
        name: "Leapmotor B10",
        uid: "b10",
        brand: "Leapmotor",
        model: "B10",
        img: "/video-1-3-0/auto.svg",
        ov: {
          "dm.ev_batteria_auto": "sensor.ev_batteria",
          "dm.ev_autonomia": "sensor.ev_autonomia",
        },
      },
    ],
    covers: [
      {
        id: "cover-salone",
        name: "Tapparella salone",
        entity: "cover.salone",
        room_id: "room-salone",
      },
    ],
    pool: {},
    irrigation: { zones: [] },
    energy: {
      name: "Casa Giovanni",
      grid: { power: "sensor.rete_w" },
      solar: { power: "sensor.fv_w" },
      house: { power: "sensor.casa_w" },
      battery: { soc: "sensor.batteria_soc" },
      plants: [
        {
          id: "impianto-donato",
          name: "Casa Donato",
          grid: { power: "sensor.rete2_w" },
          solar: { power: "sensor.fv2_w" },
          house: { power: "sensor.casa2_w" },
        },
      ],
      metadata: { plant_seq: 2 },
    },
    entityOverrides: {
      "dm.security_centrale_allarme": "alarm_control_panel.casa",
    },
  },
  visibility: {
    home: true,
    stanze: true,
    luci: true,
    temp: true,
    tapparelle: true,
    clima: true,
    ev: true,
    energy: true,
    appliances: true,
    security: true,
  },
};

const numero = (id, stato, nome, unita, classe) => ({
  entity_id: id,
  state: String(stato),
  attributes: {
    friendly_name: nome,
    unit_of_measurement: unita,
    device_class: classe,
    state_class: classe === "energy" ? "total_increasing" : "measurement",
  },
});

const STATI = [
  numero("sensor.salone_t", "21.6", "Salone temperatura", "°C", "temperature"),
  numero("sensor.salone_h", "48", "Salone umidita'", "%", "humidity"),
  numero("sensor.cucina_t", "23.4", "Cucina temperatura", "°C", "temperature"),
  numero("sensor.camera_t", "19.8", "Camera temperatura", "°C", "temperature"),
  numero("sensor.rete_w", "-1240", "Rete Casa Giovanni", "W", "power"),
  numero("sensor.fv_w", "3180", "Fotovoltaico Casa Giovanni", "W", "power"),
  numero("sensor.casa_w", "1940", "Consumo Casa Giovanni", "W", "power"),
  numero("sensor.batteria_soc", "78", "Batteria", "%", "battery"),
  numero("sensor.rete2_w", "620", "Rete Casa Donato", "W", "power"),
  numero("sensor.fv2_w", "480", "Fotovoltaico Casa Donato", "W", "power"),
  numero("sensor.casa2_w", "1100", "Consumo Casa Donato", "W", "power"),
  numero("sensor.forno_w", "1850", "Forno", "W", "power"),
  numero("sensor.pompa_w", "740", "Pompa di calore", "W", "power"),
  numero("sensor.lavatrice_w", "1420", "Lavatrice", "W", "power"),
  numero("sensor.lavatrice_kwh", "0.84", "Lavatrice energia", "kWh", "energy"),
  numero("sensor.lavastoviglie_w", "0", "Lavastoviglie", "W", "power"),
  numero("sensor.lavastoviglie_kwh", "1.12", "Lavastoviglie energia", "kWh", "energy"),
  numero("sensor.ev_batteria", "64", "Batteria auto", "%", "battery"),
  numero("sensor.ev_autonomia", "312", "Autonomia", "km", "distance"),
  {
    entity_id: "light.salone",
    state: "on",
    attributes: { friendly_name: "Lampadario del salone", brightness: 208 },
  },
  {
    entity_id: "light.libreria",
    state: "on",
    attributes: { friendly_name: "Faretti della libreria", brightness: 120 },
  },
  { entity_id: "light.tv", state: "off", attributes: { friendly_name: "Retroilluminazione TV" } },
  {
    entity_id: "light.cucina",
    state: "on",
    attributes: { friendly_name: "Faretti del piano cottura", brightness: 160 },
  },
  {
    entity_id: "light.isola",
    state: "off",
    attributes: { friendly_name: "Sospensioni sopra l'isola" },
  },
  {
    entity_id: "light.camera",
    state: "off",
    attributes: { friendly_name: "Abat-jour del comodino" },
  },
  {
    entity_id: "light.armadio",
    state: "off",
    attributes: { friendly_name: "Strisce dell'armadio" },
  },
  { entity_id: "light.corridoio", state: "off", attributes: { friendly_name: "Corridoio" } },
  {
    entity_id: "cover.salone",
    state: "open",
    attributes: {
      friendly_name: "Tapparella salone",
      current_position: 100,
      supported_features: 15,
    },
  },
  {
    entity_id: "climate.salone",
    state: "heat",
    attributes: {
      friendly_name: "Clima salone",
      current_temperature: 21.6,
      temperature: 22,
      hvac_modes: ["off", "heat", "cool"],
    },
  },
  /* La centrale come la pubblica ring-mqtt: casa e fuori, niente Notte e
     nessun codice da digitare. E' il caso di Andrea, ed e' la scena. */
  {
    entity_id: "alarm_control_panel.casa",
    state: "armed_home",
    attributes: { friendly_name: "Antifurto", supported_features: 3 },
  },
  { entity_id: "person.giovanni", state: "home", attributes: { friendly_name: "Giovanni" } },
  { entity_id: "person.giulia", state: "not_home", attributes: { friendly_name: "Giulia" } },
  { entity_id: "person.marco", state: "home", attributes: { friendly_name: "Marco" } },
];

/* La stanza detta su cose che la scheda non chiedeva: una sonda di umidita',
 * il contatore di una lavatrice. E' questa la riga che le fa comparire sotto
 * «Altro in questa stanza». */
const STANZE_ENTITA = {
  "sensor.salone_h": "room-salone",
  "sensor.lavatrice_kwh": "room-cucina",
  "sensor.camera_t": "room-camera",
};

const PERSONE = [
  {
    id: "p1",
    name: "Giovanni",
    entity: "person.giovanni",
    avatar: {
      color: "#3a6fb0",
      face: { persona: "uomo", capelli: "barba", carnagione: "media", vestito: "ufficio" },
    },
  },
  {
    id: "p2",
    name: "Giulia",
    entity: "person.giulia",
    avatar: {
      color: "#c94a3e",
      face: { persona: "donna", capelli: "rossi", carnagione: "chiara", vestito: "medico" },
    },
  },
  {
    id: "p3",
    name: "Marco",
    entity: "person.marco",
    avatar: {
      color: "#2f8f6b",
      face: { persona: "uomo", capelli: "corti", carnagione: "media", vestito: "informatico" },
    },
  },
];

/* Una foto d'auto disegnata qui: il filmato non deve dipendere da un file che
   sul computer di chi lo rigenera potrebbe non esserci. Sedici a nove, cosi'
   la cornice ne prende la forma davvero. */
const AUTO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
  <defs>
    <linearGradient id="cielo" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0b2a4a"/><stop offset="0.62" stop-color="#1f5f8f"/><stop offset="1" stop-color="#5aa7c8"/>
    </linearGradient>
    <linearGradient id="scocca" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#eef4fa"/><stop offset="0.5" stop-color="#9fb6cc"/><stop offset="1" stop-color="#48606f"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="900" fill="url(#cielo)"/>
  <ellipse cx="800" cy="742" rx="620" ry="58" fill="#04121f" opacity="0.45"/>
  <path d="M250 700 h1100 v18 H250 z" fill="#0a1b28" opacity="0.6"/>
  <path d="M300 690 C 330 560 430 520 560 508 L 700 420 C 760 384 900 380 980 414 L 1120 500
           C 1250 516 1320 566 1330 690 Z" fill="url(#scocca)"/>
  <path d="M690 432 C 760 400 890 398 962 428 L 1078 502 L 596 502 Z" fill="#12303f" opacity="0.85"/>
  <circle cx="520" cy="692" r="96" fill="#101a22"/><circle cx="520" cy="692" r="46" fill="#c9d6e2"/>
  <circle cx="1120" cy="692" r="96" fill="#101a22"/><circle cx="1120" cy="692" r="46" fill="#c9d6e2"/>
  <rect x="1288" y="586" width="60" height="30" rx="14" fill="#ffd98a"/>
  <rect x="292" y="590" width="52" height="26" rx="12" fill="#ff8a7a"/>
</svg>`;

/* ── il cartello in sovrimpressione ─────────────────────────────────────── */

async function scena(page, numero, titolo, testo) {
  await page.evaluate(
    ({ numero, titolo, testo }) => {
      let cartello = document.getElementById("dm-video-scena");
      if (!cartello) {
        const foglio = document.createElement("style");
        foglio.textContent = `
          #dm-video-scena{
            position:fixed;left:22px;right:22px;bottom:96px;z-index:2147483647;pointer-events:none;
            display:flex;align-items:center;gap:15px;padding:15px 20px;border-radius:22px;
            font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
            background:linear-gradient(120deg,rgba(4,12,24,.95),rgba(9,25,44,.93));
            box-shadow:0 26px 60px -28px rgba(2,8,20,.95);color:#f8fafc;
            opacity:0;transform:translateY(12px);transition:opacity .45s ease,transform .45s ease}
          #dm-video-scena[data-on="true"]{opacity:1;transform:none}
          #dm-video-scena b{
            display:grid;place-items:center;flex:0 0 auto;width:44px;height:44px;border-radius:15px;
            background:linear-gradient(150deg,#38bdf8,#0369a1);font-size:18px;font-weight:900;
            box-shadow:0 14px 30px -14px rgba(56,189,248,.9)}
          #dm-video-scena div{display:grid;gap:2px;min-width:0;flex:1 1 auto}
          #dm-video-scena h4{margin:0;font-size:22px;font-weight:900;letter-spacing:-.4px}
          #dm-video-scena p{margin:0;font-size:14px;font-weight:600;color:#cbd5f5;letter-spacing:.1px}
          #dm-video-scena i{
            flex:0 0 auto;padding:6px 12px;border-radius:999px;font-style:normal;
            background:rgba(148,197,255,.16);color:#bfdbfe;font-size:10.5px;font-weight:900;letter-spacing:1.5px}`;
        document.head.append(foglio);
        cartello = document.createElement("aside");
        cartello.id = "dm-video-scena";
        cartello.innerHTML = "<b></b><div><h4></h4><p></p></div><i>DASHBOARD MODERN · 1.3.0</i>";
        document.body.append(cartello);
      }
      cartello.querySelector("b").textContent = String(numero);
      cartello.querySelector("h4").textContent = titolo;
      cartello.querySelector("p").textContent = testo;
      cartello.setAttribute("data-on", "true");
    },
    { numero, titolo, testo },
  );
  await page.waitForTimeout(2600);
}

const respira = (page, ms = 1400) => page.waitForTimeout(ms);

/* Portare una cosa al centro dello schermo, senza mai bloccarsi: in un filmato
 * una scena che non c'e' si salta, non ferma la registrazione. */
async function inVista(page, selettore, ms = 1000) {
  const bersaglio = page.locator(selettore).first();
  try {
    await bersaglio.waitFor({ state: "attached", timeout: 4000 });
    await bersaglio.evaluate((nodo) =>
      nodo.scrollIntoView({ block: "center", behavior: "smooth" }),
    );
  } catch (_errore) {
    return false;
  }
  await respira(page, ms);
  return true;
}

async function vaiA(page, tab) {
  const linguetta = page.locator(`.tab[data-tab="${tab}"]`).first();
  if (await linguetta.count()) {
    await linguetta.evaluate((nodo) => nodo.click());
  } else {
    await page.evaluate((nome) => {
      document.querySelectorAll(".page").forEach((nodo) => nodo.classList.remove("active"));
      document.getElementById(`page-${nome}`)?.classList.add("active");
    }, tab);
  }
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
    try {
      render();
    } catch (_errore) {
      /* il giro di disegno storico non c'e' su tutte le pagine */
    }
  });
  await page.evaluate(() => window.scrollTo({ top: 0 }));
  await respira(page, 1400);
}

/* ── il filmato ─────────────────────────────────────────────────────────── */

test("il giro delle novita' della 1.3.0", async ({ page }, testInfo) => {
  test.skip(!process.env.DM_VIDEO, "si registra a mano: DM_VIDEO=1");
  test.skip(testInfo.project.name !== "desktop", "il filmato e' da schermo largo");
  test.setTimeout(10 * 60 * 1000);

  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.route("**/video-1-3-0/auto.svg", (route) =>
    route.fulfill({ contentType: "image/svg+xml", body: AUTO_SVG }),
  );
  await page.addInitScript((stati) => {
    class PonteFinto extends EventTarget {
      static OPEN = 1;
      readyState = 1;
      onopen = null;
      onmessage = null;
      onclose = null;
      constructor() {
        super();
        queueMicrotask(() => {
          this.onopen?.({});
          this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
        });
      }
      send(grezzo) {
        const messaggio = JSON.parse(grezzo);
        if (messaggio.type === "auth") return;
        let risultato = null;
        if (messaggio.type === "get_states") risultato = stati;
        if (messaggio.type === "frontend/get_user_data") risultato = { value: null };
        queueMicrotask(() =>
          this.onmessage?.({
            data: JSON.stringify({
              id: messaggio.id,
              type: "result",
              success: true,
              result: risultato,
            }),
          }),
        );
      }
      close() {
        this.readyState = 3;
        this.onclose?.({});
      }
    }
    /* Il sipario. Sta li' dal primo fotogramma: l'avvio della plancia — il
       lampo bianco, la procedura guidata che si toglie — non e' una novita' da
       far vedere. */
    const alza = () => {
      if (document.getElementById("dm-video-sipario")) return;
      const telo = document.createElement("div");
      telo.id = "dm-video-sipario";
      telo.innerHTML =
        "<b>DASHBOARD MODERN</b><h1>Le novita&#39; della 1.3.0</h1>" +
        "<p>Colpo d&#39;occhio · Stanze · Energia a piu&#39; impianti · Antifurto · Auto · Ritratti</p>";
      telo.setAttribute(
        "style",
        "position:fixed;inset:0;z-index:2147483646;display:grid;align-content:center;justify-items:center;gap:10px;" +
          "background:linear-gradient(140deg,#041020,#0b2a4a 55%,#0e3b63);color:#f8fafc;text-align:center;" +
          "font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;transition:opacity .7s ease",
      );
      const stile = document.createElement("style");
      stile.textContent =
        "#dm-video-sipario b{font-size:13px;font-weight:900;letter-spacing:5px;color:#7dd3fc}" +
        "#dm-video-sipario h1{margin:0;font-size:54px;font-weight:900;letter-spacing:-1.5px}" +
        "#dm-video-sipario p{margin:6px 0 0;font-size:15px;font-weight:600;color:#a5c4e4;letter-spacing:.3px}";
      document.head.append(stile);
      document.body.append(telo);
    };
    if (document.body) alza();
    else document.addEventListener("DOMContentLoaded", alza);
    window.__DASHBOARDMODERN_HOSTED__ = true;
    window.__DASHBOARDMODERN_BRIDGE_WS__ = PonteFinto;
    window.WebSocket = PonteFinto;
  }, STATI);

  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((nodo) => nodo.remove()));
  await page.evaluate(
    ({ stati, persone, stanzeEntita }) => {
      const grezzi = eval("_RAW_STATES");
      for (const voce of stati) {
        grezzi[voce.entity_id] = structuredClone(voce);
        try {
          STATES[voce.entity_id] = structuredClone(voce);
        } catch (_errore) {
          /* la mappa dipinta non c'e' su tutte le build */
        }
      }
      localStorage.setItem("cd_people", JSON.stringify(persone));
      localStorage.setItem("cd_stanze_entita", JSON.stringify(stanzeEntita));
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    },
    { stati: STATI, persone: PERSONE, stanzeEntita: STANZE_ENTITA },
  );
  await respira(page, 3600);

  /* 1 — Home, il Colpo d'occhio */
  await vaiA(page, "home");
  await page.evaluate(() => {
    const telo = document.getElementById("dm-video-sipario");
    if (!telo) return;
    telo.style.opacity = "0";
    setTimeout(() => telo.remove(), 900);
  });
  await respira(page, 1200);
  await scena(
    page,
    1,
    "Colpo d'occhio",
    "In Home una sola fascia riassume la casa: quante luci accese, cosa sta consumando, cosa chiede attenzione.",
  );
  await inVista(page, "#dm-widgets");
  await respira(page, 4200);

  /* 1b — una tessera si apre */
  const tessera = page.locator("#dm-widgets .dm-tile").first();
  if (await tessera.count()) {
    await scena(
      page,
      1,
      "Colpo d'occhio",
      "Ogni tessera si apre e racconta il dettaglio, senza cambiare pagina.",
    );
    await tessera.evaluate((nodo) => nodo.click());
    await respira(page, 4200);
    await page.keyboard.press("Escape").catch(() => {});
    await respira(page, 1000);
  }

  /* 2 — i ritratti */
  await scena(
    page,
    2,
    "Ritratti veri",
    "Le persone hanno un ritratto composto: sei corporature, cinque carnagioni e ventinove vestiti.",
  );
  await inVista(page, "#dm-people");
  await respira(page, 4200);

  /* 3 — le Stanze */
  await vaiA(page, "stanze");
  await scena(
    page,
    3,
    "Stanze",
    "Una linguetta per stanza, e dentro confluisce tutto quello che sta in quella stanza: luci, clima, tapparelle, sonde.",
  );
  await respira(page, 3600);
  const linguette = page.locator("#page-stanze [data-dm-stanza]");
  const quante = await linguette.count();
  for (let indice = 1; indice < Math.min(quante, 3); indice += 1) {
    await linguette.nth(indice).evaluate((nodo) => nodo.click());
    await respira(page, 3400);
  }

  /* 3b — «Altro in questa stanza»: la stanza si puo' dire su qualunque entita' */
  await scena(
    page,
    3,
    "La stanza, su qualunque cosa",
    "Anche una sonda o un contatore puo' dire in che stanza sta: finisce qui, sotto «Altro in questa stanza».",
  );
  await inVista(page, "#page-stanze .dm-stanze-h", 1200);
  await respira(page, 3600);

  /* 4 — l'Energia a piu' impianti */
  await vaiA(page, "energy");
  await scena(
    page,
    4,
    "Energia, un impianto per casa",
    "Due contatori, due impianti: le linguette in cima scelgono la casa e tutto la segue — rete, fotovoltaico, carichi.",
  );
  await respira(page, 3600);
  const impianti = page.locator("#dm-impianti-tabs [data-dm-impianto]");
  if ((await impianti.count()) > 1) {
    await impianti.nth(1).evaluate((nodo) => nodo.click());
    await respira(page, 4200);
    await impianti.nth(0).evaluate((nodo) => nodo.click());
    await respira(page, 2400);
  }

  /* 5 — l'antifurto */
  await vaiA(page, "security");
  await scena(
    page,
    5,
    "Antifurto onesto",
    "La plancia mostra solo i tasti che la centrale dichiara davvero, e chiede il codice solo se la centrale lo vuole.",
  );
  await respira(page, 4600);

  /* 6 — la foto dell'auto */
  await vaiA(page, "ev");
  await scena(
    page,
    6,
    "L'auto, intera",
    "Da schermo largo la cornice prende la forma della foto: niente tagli e niente bande sfocate ai lati.",
  );
  await respira(page, 4600);

  /* 7 — le luci */
  await vaiA(page, "luci");
  await scena(
    page,
    7,
    "Luci, schede rifatte",
    "Da desktop le schede stanno una accanto all'altra e il nome ha una riga sua: i nomi lunghi ci entrano.",
  );
  await respira(page, 4600);

  /* 8 — l'interruttore dei widget e la stanza, in configurazione */
  await page.evaluate(() => {
    window.apriConfigEntita?.();
    window.editorSwitch?.("luci");
  });
  await respira(page, 2400);
  await scena(
    page,
    8,
    "«Nel widget» / «Fuori»",
    "In configurazione ogni riga dice se quell'entita' finisce nel Colpo d'occhio, e in che stanza sta.",
  );
  await inVista(page, "#ed-body [data-dm-widget-entities]", 1400);
  await respira(page, 4600);

  await scena(page, 9, "1.3.0", "Tutto questo e' gia' installato: basta ricaricare la plancia.");
  await respira(page, 3400);

  /* Una riga di verita' perche' il filmato non menta: se il giro non e'
     arrivato in fondo, la registrazione va rifatta invece che consegnata. */
  await expect(page.locator("#dm-video-scena")).toHaveAttribute("data-on", "true");
  await expect(page.locator("#ed-body [data-dm-widget-entities]").first()).toBeVisible();
});

/*
 * Demo home used to render the README previews.
 *
 * The fixture is intentionally a *complete* house: every section of the
 * dashboard has enough configuration and enough Home Assistant states to paint
 * a realistic screenshot. Values are plausible but invented — no preview is
 * taken from a real installation.
 *
 * Consumed by scripts/capture-previews.mjs.
 */

const ROOMS = [
  ["room-soggiorno", "Soggiorno", "mdi:sofa", "Piano terra", 22.4, 46],
  ["room-cucina", "Cucina", "mdi:stove", "Piano terra", 23.1, 44],
  ["room-camera", "Camera", "mdi:bed-king-outline", "Primo piano", 20.8, 49],
  ["room-cameretta", "Cameretta", "mdi:baby-face-outline", "Primo piano", 21.3, 51],
  ["room-bagno", "Bagno", "mdi:shower", "Primo piano", 26.8, 61],
  ["room-studio", "Studio", "mdi:desk", "Primo piano", 22.0, 45],
  ["room-garage", "Garage", "mdi:garage", "Piano terra", 16.4, 64],
];

const slugOf = (roomId) => roomId.replace(/^room-/, "");

export const rooms = ROOMS.map(([id, name, icon, floor, , ,], index) => ({
  id,
  name,
  icon,
  floor,
  temp: `sensor.${slugOf(id)}_temperatura`,
  hum: `sensor.${slugOf(id)}_umidita`,
  order: index,
}));

/* ─────────────────────────── Home Assistant states ────────────────────────── */

const states = [];

/* Home Assistant always carries these two: without them a card that shows "last
   updated" renders NaN. */
const STAMP = new Date(Date.now() - 90_000).toISOString();

const push = (entity_id, state, attributes = {}) => {
  states.push({
    entity_id,
    state: String(state),
    attributes,
    last_changed: STAMP,
    last_updated: STAMP,
  });
  return entity_id;
};

const power = (entity_id, value, friendly_name) =>
  push(entity_id, value, {
    friendly_name,
    unit_of_measurement: "W",
    device_class: "power",
    state_class: "measurement",
  });

const energy = (entity_id, value, friendly_name, cumulative = false) =>
  push(entity_id, value, {
    friendly_name,
    unit_of_measurement: "kWh",
    device_class: "energy",
    state_class: cumulative ? "total_increasing" : "total",
  });

const temperature = (entity_id, value, friendly_name) =>
  push(entity_id, value, {
    friendly_name,
    unit_of_measurement: "°C",
    device_class: "temperature",
    state_class: "measurement",
  });

const percent = (entity_id, value, friendly_name, device_class) =>
  push(entity_id, value, {
    friendly_name,
    unit_of_measurement: "%",
    ...(device_class ? { device_class } : {}),
    state_class: "measurement",
  });

/* Rooms: temperature and humidity. */
for (const [id, name, , , temp, hum] of ROOMS) {
  temperature(`sensor.${slugOf(id)}_temperatura`, temp, `${name} temperatura`);
  percent(`sensor.${slugOf(id)}_umidita`, hum, `${name} umidità`, "humidity");
}

/* Home: weather, alarm, gate. */
push("weather.casa", "partlycloudy", {
  friendly_name: "Meteo casa",
  temperature: 26.4,
  temperature_unit: "°C",
  humidity: 42,
  wind_speed: 11.5,
  wind_speed_unit: "km/h",
  pressure: 1014,
  forecast: Array.from({ length: 5 }, (_, index) => ({
    datetime: new Date(Date.now() + (index + 1) * 86_400_000).toISOString(),
    condition: ["sunny", "partlycloudy", "rainy", "sunny", "sunny"][index],
    temperature: [29, 28, 24, 27, 30][index],
    templow: [18, 18, 16, 17, 19][index],
  })),
});
push("alarm_control_panel.casa", "armed_away", {
  friendly_name: "Centrale allarme",
  code_format: null,
  changed_by: null,
  supported_features: 63,
});
push("switch.antifurto", "off", { friendly_name: "Antifurto perimetrale" });
push("script.apri_cancello", "off", { friendly_name: "Apri cancello" });
push("binary_sensor.porta_ingresso", "off", {
  friendly_name: "Porta ingresso",
  device_class: "door",
});
push("binary_sensor.finestra_cucina", "on", {
  friendly_name: "Finestra cucina",
  device_class: "window",
});
push("binary_sensor.movimento_giardino", "off", {
  friendly_name: "Movimento giardino",
  device_class: "motion",
});
push("binary_sensor.fumo_cucina", "off", { friendly_name: "Fumo cucina", device_class: "smoke" });

/* Energy: house, grid, solar, battery. */
power("sensor.casa_potenza", 6480, "Potenza consumo casa");
energy("sensor.casa_energia_oggi", 14.6, "Consumo casa oggi");
energy("sensor.casa_energia_mese", 401.1, "Consumo casa mese");
energy("sensor.casa_energia_anno", 5202.2, "Consumo casa anno");
energy("sensor.casa_energia_totale", 18_240.6, "Consumo casa totale", true);

power("sensor.rete_potenza", -520, "Potenza scambio rete");
energy("sensor.rete_prelievo_oggi", 3.2, "Energia prelevata oggi");
energy("sensor.rete_immissione_oggi", 7.9, "Energia immessa oggi");
energy("sensor.rete_prelievo_mese", 74.3, "Rete acquistata mese");
energy("sensor.rete_immissione_mese", 168.2, "Rete venduta mese");
energy("sensor.rete_prelievo_anno", 962.4, "Rete acquistata anno");
energy("sensor.rete_immissione_anno", 1840.7, "Rete venduta anno");
energy("sensor.rete_prelievo_totale", 5124.9, "Rete acquistata totale", true);
energy("sensor.rete_immissione_totale", 9820.3, "Rete venduta totale", true);
push("sensor.stato_rete", "on-grid", { friendly_name: "Stato rete" });

power("sensor.fv_potenza", 7400, "Potenza fotovoltaico");
energy("sensor.fv_energia_oggi", 21.6, "Produzione solare oggi");
energy("sensor.fv_energia_mese", 512.4, "Produzione solare mese");
energy("sensor.fv_energia_anno", 6248.1, "Produzione solare anno");
energy("sensor.fv_energia_totale", 24_860.5, "Produzione solare totale", true);

percent("sensor.batteria_soc", 68, "Stato carica batteria", "battery");
power("sensor.batteria_potenza", 400, "Potenza batteria");
energy("sensor.batteria_caricata_oggi", 6.4, "Batteria caricata oggi");
energy("sensor.batteria_scaricata_oggi", 4.1, "Batteria scaricata oggi");
energy("sensor.batteria_caricata_mese", 148.6, "Batteria caricata mese");
energy("sensor.batteria_scaricata_mese", 131.2, "Batteria usata mese");
energy("sensor.batteria_caricata_anno", 1620.4, "Batteria caricata anno");
energy("sensor.batteria_scaricata_anno", 1452.8, "Batteria usata anno");
energy("sensor.batteria_caricata_totale", 4260.2, "Batteria caricata totale", true);
energy("sensor.batteria_scaricata_totale", 3810.7, "Batteria scaricata totale", true);
temperature("sensor.inverter_temp_dc", 42.6, "Temperatura DC inverter");
temperature("sensor.inverter_temp_ac", 38.1, "Temperatura AC inverter");
temperature("sensor.batteria_temperatura", 27.4, "Temperatura batteria");
power("sensor.inverter_ventola_potenza", 6, "Potenza ventola inverter");
push("switch.inverter_ventola", "off", { friendly_name: "Ventola inverter" });

/* Energy flow loads. */
power("sensor.boiler_potenza", 0, "Potenza resistenza boiler");
energy("sensor.boiler_energia_oggi", 1.2, "Boiler oggi");
energy("sensor.boiler_energia_mese", 42.6, "Boiler mese");
energy("sensor.boiler_energia_totale", 862.4, "Boiler totale", true);
power("sensor.wallbox_potenza", 4200, "Potenza wallbox");
energy("sensor.wallbox_energia_oggi", 6.4, "Energia wallbox oggi");
energy("sensor.wallbox_energia_mese", 132.6, "Energia wallbox mese");
energy("sensor.wallbox_energia_totale", 2860.4, "Energia wallbox totale", true);
power("sensor.clima_potenza", 940, "Potenza condizionatori");
energy("sensor.clima_energia_oggi", 2.6, "Condizionatori oggi");
energy("sensor.clima_energia_mese", 62.4, "Condizionatori mese");
energy("sensor.clima_energia_totale", 1240.8, "Condizionatori totale", true);
power("sensor.lavanderia_potenza", 620, "Potenza carichi lavanderia");
energy("sensor.lavanderia_energia_oggi", 2.4, "Somma lavanderia oggi");
energy("sensor.lavanderia_energia_mese", 48.9, "Somma lavanderia mese");
power("sensor.cucina_carichi_potenza", 310, "Potenza carichi cucina");
energy("sensor.cucina_energia_oggi", 3.1, "Somma cucina oggi");
energy("sensor.cucina_energia_mese", 72.4, "Somma cucina mese");
power("sensor.illuminazione_potenza", 84, "Potenza illuminazione");
energy("sensor.illuminazione_energia_mese", 18.6, "Illuminazione mese");
energy("sensor.illuminazione_energia_totale", 246.3, "Illuminazione totale", true);

/* Appliances. */
power("sensor.lavatrice_potenza", 612, "Lavatrice potenza");
energy("sensor.lavatrice_energia_oggi", 0.94, "Lavatrice oggi");
energy("sensor.lavatrice_energia_totale", 342.6, "Lavatrice totale", true);
push("switch.lavatrice", "on", { friendly_name: "Presa lavatrice" });
push("sensor.lavatrice_fase", "Lavaggio", { friendly_name: "Lavatrice fase corrente" });
push("sensor.lavatrice_rimanente", 48, {
  friendly_name: "Lavatrice tempo rimanente",
  unit_of_measurement: "min",
  device_class: "duration",
});
temperature("sensor.lavatrice_temperatura", 40, "Lavatrice temperatura");
push("select.lavatrice_programma", "Cotone eco", {
  friendly_name: "Lavatrice programma",
  options: ["Cotone eco", "Rapido 14'", "Misti 30'", "Sintetici 59'", "Lana"],
});

push("sensor.lavatrice_ultimo_avvio", new Date(Date.now() - 3 * 3600_000).toISOString(), {
  friendly_name: "Lavatrice ultimo avvio",
  device_class: "timestamp",
});
push("sensor.lavatrice_ultima_durata", 128, {
  friendly_name: "Lavatrice ultima durata",
  unit_of_measurement: "min",
  device_class: "duration",
});
energy("sensor.lavatrice_ultimo_consumo", 0.86, "Lavatrice ultimo consumo");
push("sensor.lavatrice_ultimo_costo", 0.24, {
  friendly_name: "Lavatrice ultimo costo",
  unit_of_measurement: "\u20ac",
  device_class: "monetary",
});

power("sensor.lavastoviglie_potenza", 1180, "Lavastoviglie potenza");
energy("sensor.lavastoviglie_energia_oggi", 1.12, "Lavastoviglie oggi");
energy("sensor.lavastoviglie_energia_totale", 486.2, "Lavastoviglie totale", true);
push("switch.lavastoviglie", "on", { friendly_name: "Presa lavastoviglie" });
push("sensor.lavastoviglie_fase", "Asciugatura", { friendly_name: "Lavastoviglie fase" });
push("sensor.lavastoviglie_rimanente", 22, {
  friendly_name: "Lavastoviglie tempo rimanente",
  unit_of_measurement: "min",
  device_class: "duration",
});

power("sensor.asciugatrice_potenza", 3, "Asciugatrice potenza");
energy("sensor.asciugatrice_energia_oggi", 0, "Asciugatrice oggi");
energy("sensor.asciugatrice_energia_totale", 218.4, "Asciugatrice totale", true);
push("switch.asciugatrice", "off", { friendly_name: "Presa asciugatrice" });
push("sensor.asciugatrice_fase", "Standby", { friendly_name: "Asciugatrice fase" });

power("sensor.forno_potenza", 0, "Forno potenza");
energy("sensor.forno_energia_oggi", 0.4, "Forno oggi");
energy("sensor.forno_energia_totale", 396.8, "Forno totale", true);
push("switch.forno", "off", { friendly_name: "Presa forno" });
temperature("sensor.forno_temperatura", 24, "Forno temperatura");

power("sensor.frigo_potenza", 86, "Frigorifero potenza");
energy("sensor.frigo_energia_oggi", 0.72, "Frigorifero oggi");
energy("sensor.frigo_energia_totale", 1284.6, "Frigorifero totale", true);
temperature("sensor.frigo_temperatura", 4.2, "Frigorifero temperatura");

power("sensor.robot_potenza", 42, "Robot potenza");
energy("sensor.robot_energia_oggi", 0.18, "Robot oggi");
energy("sensor.robot_energia_totale", 62.4, "Robot totale", true);
push("vacuum.robot", "cleaning", { friendly_name: "Robot aspirapolvere" });
push("switch.robot", "on", { friendly_name: "Presa robot" });

/* Lights. */
const LIGHTS = [
  ["light.soggiorno_faretti", "Faretti soggiorno", "room-soggiorno", "on", 190, "dimmer"],
  ["light.soggiorno_strip", "Strip TV", "room-soggiorno", "on", 220, "rgb"],
  ["light.cucina_led", "LED cucina", "room-cucina", "on", 255, "white"],
  ["light.camera_plafoniera", "Plafoniera camera", "room-camera", "off", 0, "dimmer"],
  ["light.cameretta_plafoniera", "Plafoniera cameretta", "room-cameretta", "off", 0, "rgb"],
  ["light.bagno_specchio", "Specchio bagno", "room-bagno", "on", 140, "dimmer"],
  ["light.studio_scrivania", "Scrivania studio", "room-studio", "off", 0, "dimmer"],
  ["switch.esterno_giardino", "Giardino", "room-garage", "off", 0, "switch"],
];

/* One of each shape the dashboard can command: a plain relay, dimmers, a
   tunable white and an RGB strip with effects. */
const COLOR_MODES = { dimmer: ["brightness"], white: ["color_temp"], rgb: ["hs", "color_temp"] };

for (const [entity, name, , state, brightness, kind] of LIGHTS) {
  if (kind === "switch") {
    push(entity, state, { friendly_name: name });
    continue;
  }
  push(entity, state, {
    friendly_name: name,
    supported_color_modes: COLOR_MODES[kind],
    ...(kind === "rgb"
      ? {
          color_mode: state === "on" ? "hs" : null,
          hs_color: [278, 66],
          rgb_color: [186, 92, 240],
          effect_list: ["Arcobaleno", "Fuoco", "Respiro", "Festa"],
          effect: "Respiro",
        }
      : {}),
    ...(kind === "rgb" || kind === "white"
      ? { min_color_temp_kelvin: 2202, max_color_temp_kelvin: 6535, color_temp_kelvin: 3200 }
      : {}),
    ...(state === "on" ? { brightness } : {}),
  });
}

/* Climate. */
const CLIMATE = [
  ["climate.soggiorno", "Clima soggiorno", "cool", 25.4, 24, "room-soggiorno", "clima"],
  ["climate.camera", "Clima camera", "off", 21.2, 23, "room-camera", "clima"],
  ["climate.cameretta", "Clima cameretta", "cool", 22.6, 23, "room-cameretta", "clima"],
  ["climate.termo_giorno", "Termostato zona giorno", "heat", 22.4, 21, "room-soggiorno", "termo"],
  ["climate.termo_notte", "Termostato zona notte", "off", 20.8, 20, "room-camera", "termo"],
];
for (const [entity, name, state, current, target] of CLIMATE) {
  push(entity, state, {
    friendly_name: name,
    current_temperature: current,
    temperature: target,
    min_temp: 16,
    max_temp: 30,
    target_temp_step: 0.5,
    hvac_modes: ["off", "cool", "heat", "dry", "fan_only"],
    fan_modes: ["auto", "low", "medium", "high"],
    fan_mode: "auto",
    supported_features: 393,
  });
}

/* Covers.
 *
 * L'ultima colonna e' il contatto sull'anta: solo il soggiorno ce l'ha aperto,
 * perche' e' li' che si vede cosa fa la card quando l'infisso e' aperto — le
 * ante rientrano e accanto allo stato compare «Finestra aperta». La cucina ha
 * un contatto chiuso, le altre due non ne hanno affatto: una casa vera e' fatta
 * cosi', e la card non deve inventare un'apertura che nessuno ha misurato. */
const COVERS = [
  [
    "cover.soggiorno",
    "Tapparella soggiorno",
    "room-soggiorno",
    "open",
    100,
    "binary_sensor.finestra_soggiorno",
  ],
  ["cover.cucina", "Tapparella cucina", "room-cucina", "open", 60, "binary_sensor.finestra_cucina"],
  ["cover.camera", "Tapparella camera", "room-camera", "closed", 0, ""],
  ["cover.cameretta", "Tapparella cameretta", "room-cameretta", "open", 35, ""],
];
for (const [entity, name, , state, position] of COVERS) {
  push(entity, state, {
    friendly_name: name,
    current_position: position,
    device_class: "shutter",
    supported_features: 15,
  });
}
/* Chiuso: serve a mostrare che un contatto che dice «chiuso» non disegna
 * nessuna apertura. Quello della cucina esiste gia' piu' sopra ed e' aperto —
 * e' la stessa entita' che alimenta la card avvisi della Home, quindi qui non
 * si duplica: si riusa. */
push("binary_sensor.finestra_soggiorno", "off", {
  friendly_name: "Finestra soggiorno",
  device_class: "window",
});

/* EV + wallbox. */
percent("sensor.auto_batteria", 74, "Batteria auto", "battery");
push("sensor.auto_autonomia", 312, {
  friendly_name: "Autonomia",
  unit_of_measurement: "km",
  device_class: "distance",
});
push("sensor.auto_odometro", 18_460, {
  friendly_name: "Odometro",
  unit_of_measurement: "km",
  device_class: "distance",
  state_class: "total_increasing",
});
push("sensor.auto_autonomia_limite", 386, {
  friendly_name: "Autonomia al limite di carica",
  unit_of_measurement: "km",
});
push("sensor.auto_km_ultima_ricarica", 142, {
  friendly_name: "Km dall'ultima ricarica",
  unit_of_measurement: "km",
});
push("sensor.wallbox_stato", "Ricarica solare", { friendly_name: "Stato ricarica" });
push("select.wallbox_modalita", "pv", {
  friendly_name: "Modalità ricarica",
  options: ["off", "now", "minpv", "pv"],
});
push("select.auto_target_soc", "80", {
  friendly_name: "Target SOC",
  options: ["50", "60", "70", "80", "90", "100"],
});
energy("sensor.wallbox_sessione", 9.8, "Energia sessione");
percent("sensor.wallbox_solare_sessione", 84, "Percentuale solare sessione");
temperature("sensor.wallbox_temperatura", 34.2, "Temperatura wallbox");
push("sensor.wallbox_tensione", 231, {
  friendly_name: "Tensione wallbox",
  unit_of_measurement: "V",
  device_class: "voltage",
});
energy("sensor.auto_prelievo_totale", 2640.8, "Prelievo AC totale auto", true);

/* Solar thermal / boiler. */
push("switch.boiler", "off", { friendly_name: "Interruttore boiler" });
push("switch.solare_termico", "on", { friendly_name: "Interruttore solare termico" });
push("sensor.solare_centralina", "Circolazione", { friendly_name: "Centralina solare termico" });
push("switch.pompa_solare", "on", { friendly_name: "Pompa solare" });
push("sensor.pompa_solare_stato", "In marcia", { friendly_name: "Stato pompa solare" });
push("binary_sensor.pompa_solare", "on", {
  friendly_name: "Sensore pompa solare",
  device_class: "running",
});
temperature("sensor.solare_delta", 12.4, "Delta temperatura");
push("sensor.impianto_pressione", 1.8, {
  friendly_name: "Pressione acqua",
  unit_of_measurement: "bar",
  device_class: "pressure",
});
push("cover.valvola_sicurezza", "closed", {
  friendly_name: "Valvola di sicurezza",
  current_position: 0,
  supported_features: 15,
});
temperature("sensor.boiler_sonda_1", 68.4, "Sonda temperatura 1");
temperature("sensor.boiler_sonda_2", 54.2, "Sonda temperatura 2");
temperature("sensor.boiler_sonda_3", 41.6, "Sonda temperatura 3");

/* Pool. */
temperature("sensor.piscina_temperatura", 27.4, "Temperatura piscina");
push("sensor.piscina_ph", 7.2, { friendly_name: "pH piscina", unit_of_measurement: "pH" });
push("sensor.piscina_cloro", 1.1, { friendly_name: "Cloro piscina", unit_of_measurement: "ppm" });
push("switch.piscina_pompa", "on", { friendly_name: "Pompa filtrazione" });
push("switch.piscina_riscaldamento", "off", { friendly_name: "Riscaldamento piscina" });
push("light.piscina", "off", { friendly_name: "Luci piscina" });

/* Irrigation. */
for (const [index, name] of ["Prato fronte", "Prato retro", "Siepe", "Orto"].entries()) {
  push(`switch.irrigazione_zona_${index + 1}`, index === 1 ? "on" : "off", {
    friendly_name: `Irrigazione ${name}`,
  });
}
push("binary_sensor.pioggia", "off", {
  friendly_name: "Sensore pioggia",
  device_class: "moisture",
});

/* MiniPC / server. */
percent("sensor.minipc_cpu", 18, "CPU MiniPC");
percent("sensor.minipc_ram", 46, "RAM MiniPC");
percent("sensor.minipc_disco", 62, "Disco MiniPC");
push("sensor.minipc_uptime", new Date(Date.now() - 14 * 86_400_000).toISOString(), {
  friendly_name: "Uptime MiniPC",
  device_class: "timestamp",
});
temperature("sensor.minipc_cpu_temp", 52.4, "Temperatura CPU");
push("sensor.ha_uptime", new Date(Date.now() - 9 * 86_400_000).toISOString(), {
  friendly_name: "Uptime Home Assistant",
  device_class: "timestamp",
});
power("sensor.minipc_potenza", 14, "Potenza MiniPC");
push("binary_sensor.internet", "on", {
  friendly_name: "Stato Internet",
  device_class: "connectivity",
});
push("binary_sensor.ping_internet", "on", {
  friendly_name: "Ping Internet",
  device_class: "connectivity",
});
push("binary_sensor.google", "on", {
  friendly_name: "Raggiungibilità Google",
  device_class: "connectivity",
});
push("binary_sensor.internet_lavanderia", "on", {
  friendly_name: "Internet lavanderia",
  device_class: "connectivity",
});
push("sensor.speedtest_download", 938, {
  friendly_name: "Speedtest Download",
  unit_of_measurement: "Mbit/s",
});
push("sensor.speedtest_upload", 214, {
  friendly_name: "Speedtest Upload",
  unit_of_measurement: "Mbit/s",
});
push("sensor.speedtest_ping", 8.4, { friendly_name: "Speedtest Ping", unit_of_measurement: "ms" });

/* Cameras. */
push("camera.ingresso", "streaming", {
  friendly_name: "Ingresso",
  entity_picture: "/api/camera_proxy/camera.ingresso",
  supported_features: 2,
});
push("camera.giardino", "streaming", {
  friendly_name: "Giardino",
  entity_picture: "/api/camera_proxy/camera.giardino",
  supported_features: 2,
});

/* ── le sezioni nate nelle beta ───────────────────────────────────────────── */

/* I lettori musicali (#269). Tre bastano a mostrare i tre stati che la scheda
   disegna: uno che suona con la sua copertina, uno con la radio — che di
   copertina non ne ha e di brano successivo nemmeno — e uno spento. Le
   bandiere sono quelle vere di Home Assistant: la scheda disegna solo i tasti
   che il lettore dichiara di saper eseguire. */
const SA_COMPLETO = 23999; /* pausa, cerca, volume, muto, prec/succ, on/off, sorgente, stop, play */
const SA_RADIO = 16781; /* pausa, volume, muto, on/off, play — niente prec/succ */
const SA_SPENTO = 388; /* volume, on/off */

push("media_player.salone", "playing", {
  friendly_name: "Salone",
  media_title: "Nuvole bianche",
  media_artist: "Ludovico Einaudi",
  media_album_name: "Una mattina",
  entity_picture: "/api/dm_album/salone.png",
  media_duration: 342,
  media_position: 137,
  media_position_updated_at: new Date(Date.now() - 4_000).toISOString(),
  volume_level: 0.42,
  is_volume_muted: false,
  source: "Spotify",
  source_list: ["Spotify", "Radio", "Bluetooth"],
  supported_features: SA_COMPLETO,
});
push("media_player.cucina", "playing", {
  friendly_name: "Cucina",
  media_title: "Radio Deejay",
  media_artist: "Deejay Chiama Italia",
  volume_level: 0.28,
  source: "Radio",
  supported_features: SA_RADIO,
});
push("media_player.camera", "off", {
  friendly_name: "Camera",
  volume_level: 0.2,
  supported_features: SA_SPENTO,
});

/* Il gruppo di continuita' (#256). Lo stato di NUT da solo basterebbe: «OL»
   vuol dire rete presente. Gli altri sensori sono per chi li ha separati. */
push("sensor.ups_status", "OL", { friendly_name: "UPS stato" });
push("binary_sensor.ups_rete", "on", { friendly_name: "UPS rete", device_class: "power" });
push("sensor.ups_battery_charge", 100, {
  friendly_name: "UPS carica batteria",
  unit_of_measurement: "%",
  device_class: "battery",
  state_class: "measurement",
});
push("sensor.ups_load", 23, {
  friendly_name: "UPS carico",
  unit_of_measurement: "%",
  state_class: "measurement",
});
push("sensor.ups_runtime", 48, {
  friendly_name: "UPS autonomia",
  unit_of_measurement: "min",
  device_class: "duration",
});
push("sensor.ups_input_voltage", 231.4, {
  friendly_name: "UPS tensione di rete",
  unit_of_measurement: "V",
  device_class: "voltage",
  state_class: "measurement",
});
push("sensor.ups_power", 74, {
  friendly_name: "UPS potenza assorbita",
  unit_of_measurement: "W",
  device_class: "power",
  state_class: "measurement",
});
push("sensor.ups_temperature", 31.6, {
  friendly_name: "UPS temperatura",
  unit_of_measurement: "\u00b0C",
  device_class: "temperature",
  state_class: "measurement",
});

/* Le prese. Il modem e' fra quelle che si guardano e basta: e' il motivo per
   cui hanno una sezione loro invece di stare fra le luci. */
push("switch.presa_tv", "on", { friendly_name: "TV salotto", device_class: "outlet" });
push("switch.presa_firestick", "on", { friendly_name: "Firestick", device_class: "outlet" });
push("switch.presa_modem", "on", { friendly_name: "Modem", device_class: "outlet" });
push("switch.presa_camera", "off", { friendly_name: "Presa camera", device_class: "outlet" });

/* I calendari. Gli impegni veri arrivano dalla rotta REST /api/calendars/. */
push("calendar.famiglia", "on", {
  friendly_name: "Famiglia",
  message: "Cena dai nonni",
  all_day: false,
  start_time: new Date(Date.now() + 3 * 3_600_000).toISOString().slice(0, 19).replace("T", " "),
  end_time: new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 19).replace("T", " "),
  supported_features: 7,
});
push("calendar.lavoro", "off", {
  friendly_name: "Lavoro",
  message: "Riunione settimanale",
  all_day: false,
  supported_features: 7,
});

/* Le entita' che uno si aggiunge dove vuole (#271) e quelle di una sezione
   tutta sua: roba che la plancia non disegna ancora, ed e' il punto. */
push("sensor.cisterna_livello", 68, {
  friendly_name: "Livello cisterna",
  unit_of_measurement: "%",
  state_class: "measurement",
});
push("sensor.contatore_acqua", 128.4, {
  friendly_name: "Contatore acqua",
  unit_of_measurement: "m\u00b3",
  state_class: "total_increasing",
});
push("binary_sensor.cancello_pedonale", "off", {
  friendly_name: "Cancello pedonale",
  device_class: "door",
});
push("sensor.acquario_temperatura", 25.6, {
  friendly_name: "Acquario temperatura",
  unit_of_measurement: "\u00b0C",
  device_class: "temperature",
  state_class: "measurement",
});
push("sensor.acquario_ph", 7.2, { friendly_name: "Acquario pH", state_class: "measurement" });
push("switch.acquario_luce", "on", { friendly_name: "Luce acquario" });
push("switch.acquario_pompa", "on", { friendly_name: "Pompa acquario" });

export const haStates = states;

/* ───────────────────────────── Dashboard config ───────────────────────────── */

const appliance = (config) => ({
  show_in_dashboard: true,
  show_in_report: true,
  visual_type: "asset",
  ...config,
  entities: [
    config.control_entity,
    config.power_entity,
    config.daily_energy_entity,
    config.total_energy_entity,
    config.state_entity,
  ].filter(Boolean),
});

/* ── Chi abita la casa (1.1+) ──────────────────────────────────────────────
 *
 * Le persone sono `person.*` come in Home Assistant: lo stato e' la zona, e il
 * telefono porta con se' batteria, stato di carica e distanza da casa. Tre
 * situazioni diverse di proposito — chi e' in casa, chi sta rientrando, chi e'
 * fuori con la batteria agli sgoccioli — perche' la card cambia faccia per
 * ognuna. */
push("person.giovanni", "home", { friendly_name: "Giovanni", id: "giovanni" });
push("person.laura", "not_home", { friendly_name: "Laura", id: "laura" });
push("person.marco", "Ufficio", { friendly_name: "Marco", id: "marco" });

percent("sensor.telefono_giovanni_batteria", 82, "Batteria telefono Giovanni", "battery");
push("sensor.telefono_giovanni_stato_batteria", "Charging", {
  friendly_name: "Stato batteria Giovanni",
});
percent("sensor.telefono_laura_batteria", 46, "Batteria telefono Laura", "battery");
push("sensor.telefono_laura_stato_batteria", "Not Charging", {
  friendly_name: "Stato batteria Laura",
});
push("sensor.laura_distanza", 8.4, {
  friendly_name: "Distanza Laura",
  unit_of_measurement: "km",
  device_class: "distance",
});
push("sensor.laura_tempo_rientro", 14, {
  friendly_name: "Tempo di rientro Laura",
  unit_of_measurement: "min",
});
percent("sensor.telefono_marco_batteria", 9, "Batteria telefono Marco", "battery");
push("sensor.telefono_marco_stato_batteria", "Not Charging", {
  friendly_name: "Stato batteria Marco",
});

/* ── Aspirapolvere (1.2+) ─────────────────────────────────────────────────── */
push("vacuum.robot", "cleaning", {
  friendly_name: "Robot aspirapolvere",
  battery_level: 63,
  fan_speed: "medium",
  fan_speed_list: ["quiet", "balanced", "medium", "turbo"],
  status: "In pulizia",
  supported_features: 16375,
});

/* ── Le cose da fare (1.2+) ───────────────────────────────────────────────── */
push("todo.spesa", 4, { friendly_name: "Spesa" });
push("todo.casa", 2, { friendly_name: "Cose di casa" });

/* ── Il secondo impianto (1.3+) ───────────────────────────────────────────────
 *
 * «Una casa che e' l'unione di due appartamenti»: il secondo ha i suoi
 * misuratori e i suoi carichi, piu' piccoli del primo perche' e' un
 * appartamento e non tutta la casa. */
power("sensor.dependance_casa_potenza", 1180, "Consumo dependance");
energy("sensor.dependance_casa_energia_totale", 4210, "Energia casa dependance", true);
power("sensor.dependance_rete_potenza", 620, "Prelievo dependance");
energy("sensor.dependance_rete_prelievo_totale", 2980, "Prelievo totale dependance", true);
power("sensor.dependance_fv_potenza", 1740, "Fotovoltaico dependance");
energy("sensor.dependance_fv_energia_totale", 5120, "Produzione totale dependance", true);
power("sensor.dependance_pdc_potenza", 640, "Pompa di calore dependance");
energy("sensor.dependance_pdc_energia_totale", 1870, "Energia pompa di calore", true);
power("sensor.dependance_cucina_potenza", 210, "Cucina dependance");
energy("sensor.dependance_cucina_energia_totale", 640, "Energia cucina dependance", true);

/* ── Le aperture della Sicurezza (1.2+) ───────────────────────────────────── */
push("lock.portone", "locked", {
  friendly_name: "Portone",
  supported_features: 1,
});
push("lock.garage", "unlocked", { friendly_name: "Serratura garage" });

export const seed = {
  schema_version: 4,
  sections: {
    rooms,
    cameras: [
      { id: "cam-ingresso", name: "Ingresso", entity: "camera.ingresso", room_id: "room-garage" },
      { id: "cam-giardino", name: "Giardino", entity: "camera.giardino", room_id: "room-garage" },
    ],
    appliances: [
      appliance({
        id: "appliance-lavatrice",
        name: "Lavatrice",
        device_type: "lavatrice",
        visual_key: "lavatrice",
        room_id: "room-garage",
        control_entity: "switch.lavatrice",
        power_entity: "sensor.lavatrice_potenza",
        daily_energy_entity: "sensor.lavatrice_energia_oggi",
        total_energy_entity: "sensor.lavatrice_energia_totale",
        state_entity: "sensor.lavatrice_fase",
        remaining_entity: "sensor.lavatrice_rimanente",
        temperature_entity: "sensor.lavatrice_temperatura",
        last_start_entity: "sensor.lavatrice_ultimo_avvio",
        last_duration_entity: "sensor.lavatrice_ultima_durata",
        last_energy_entity: "sensor.lavatrice_ultimo_consumo",
        last_cost_entity: "sensor.lavatrice_ultimo_costo",
        price_kwh: 0.28,
        threshold_standby: 2,
        threshold_run: 8,
        max_power: 2200,
        order: 0,
        report_order: 0,
      }),
      appliance({
        id: "appliance-lavastoviglie",
        name: "Lavastoviglie",
        device_type: "lavastoviglie",
        visual_key: "lavastoviglie",
        room_id: "room-cucina",
        control_entity: "switch.lavastoviglie",
        power_entity: "sensor.lavastoviglie_potenza",
        daily_energy_entity: "sensor.lavastoviglie_energia_oggi",
        total_energy_entity: "sensor.lavastoviglie_energia_totale",
        state_entity: "sensor.lavastoviglie_fase",
        remaining_entity: "sensor.lavastoviglie_rimanente",
        threshold_standby: 2,
        threshold_run: 10,
        max_power: 2000,
        order: 1,
        report_order: 1,
      }),
      appliance({
        id: "appliance-asciugatrice",
        name: "Asciugatrice",
        device_type: "asciugatrice",
        visual_key: "asciugatrice",
        room_id: "room-garage",
        control_entity: "switch.asciugatrice",
        power_entity: "sensor.asciugatrice_potenza",
        daily_energy_entity: "sensor.asciugatrice_energia_oggi",
        total_energy_entity: "sensor.asciugatrice_energia_totale",
        state_entity: "sensor.asciugatrice_fase",
        threshold_standby: 2,
        threshold_run: 10,
        order: 2,
        report_order: 2,
      }),
      appliance({
        id: "appliance-forno",
        name: "Forno",
        device_type: "forno",
        visual_key: "forno",
        room_id: "room-cucina",
        control_entity: "switch.forno",
        power_entity: "sensor.forno_potenza",
        daily_energy_entity: "sensor.forno_energia_oggi",
        total_energy_entity: "sensor.forno_energia_totale",
        temperature_entity: "sensor.forno_temperatura",
        threshold_run: 100,
        order: 3,
        report_order: 3,
      }),
      appliance({
        id: "appliance-frigo",
        name: "Frigorifero",
        device_type: "frigo",
        visual_key: "frigo",
        room_id: "room-cucina",
        power_entity: "sensor.frigo_potenza",
        daily_energy_entity: "sensor.frigo_energia_oggi",
        total_energy_entity: "sensor.frigo_energia_totale",
        temperature_entity: "sensor.frigo_temperatura",
        threshold_run: 20,
        order: 4,
        report_order: 4,
      }),
      appliance({
        id: "appliance-robot",
        name: "Robot aspirapolvere",
        device_type: "robot",
        visual_key: "robot",
        room_id: "room-soggiorno",
        control_entity: "switch.robot",
        power_entity: "sensor.robot_potenza",
        daily_energy_entity: "sensor.robot_energia_oggi",
        total_energy_entity: "sensor.robot_energia_totale",
        state_entity: "vacuum.robot",
        threshold_run: 10,
        order: 5,
        report_order: 5,
      }),
    ],
    loads: [
      {
        id: "load-boiler",
        name: "Boiler",
        category: "secondary",
        icon: "mdi:water-boiler",
        room_id: "room-bagno",
        power_entity: "sensor.boiler_potenza",
        daily_energy_entity: "sensor.boiler_energia_oggi",
        monthly_energy_entity: "sensor.boiler_energia_mese",
        total_energy_entity: "sensor.boiler_energia_totale",
        show_in_report: true,
        show_in_dashboard: true,
        report_order: 6,
        order: 0,
      },
      {
        id: "load-clima",
        name: "Climatizzazione",
        category: "secondary",
        icon: "mdi:snowflake",
        power_entity: "sensor.clima_potenza",
        daily_energy_entity: "sensor.clima_energia_oggi",
        monthly_energy_entity: "sensor.clima_energia_mese",
        total_energy_entity: "sensor.clima_energia_totale",
        show_in_report: true,
        show_in_dashboard: true,
        report_order: 7,
        order: 1,
      },
      {
        id: "load-wallbox",
        name: "Wallbox",
        category: "secondary",
        icon: "mdi:car-electric",
        room_id: "room-garage",
        power_entity: "sensor.wallbox_potenza",
        daily_energy_entity: "sensor.wallbox_energia_oggi",
        monthly_energy_entity: "sensor.wallbox_energia_mese",
        total_energy_entity: "sensor.wallbox_energia_totale",
        show_in_report: true,
        show_in_dashboard: true,
        report_order: 8,
        order: 2,
      },
      {
        id: "load-illuminazione",
        name: "Illuminazione",
        category: "manual-report",
        icon: "mdi:lightbulb",
        monthly_energy_entity: "sensor.illuminazione_energia_mese",
        total_energy_entity: "sensor.illuminazione_energia_totale",
        show_in_report: true,
        show_in_dashboard: false,
        report_order: 9,
        order: 3,
      },
    ],
    lights: LIGHTS.map(([entity, name, room_id], index) => ({
      id: `light-${entity.split(".")[1]}`,
      name,
      entities: [entity],
      entity,
      room_id,
      order: index,
    })),
    climate: CLIMATE.map(([entity, name, , , , room_id, type], index) => ({
      id: `climate-${entity.split(".")[1]}`,
      name,
      entity,
      room_id,
      type,
      order: index,
    })),
    ev: [
      {
        id: "ev-demo",
        name: "Auto di casa",
        brand: "Tesla",
        model: "Model 3",
        icon: "mdi:car-electric",
        /* Served by the capture script as an obvious placeholder: the hero
           accepts the owner's own photo and the preview has to show that. */
        img: "/api/dm_preview/vehicle.png",
        ov: {},
      },
    ],
    covers: COVERS.map(([entity, name, room_id, , , contact], index) => ({
      id: `cover-${entity.split(".")[1]}`,
      name,
      entity,
      room_id,
      order: index,
      ...(contact ? { contact } : {}),
    })),
    robots: [
      {
        id: "robot-piano-terra",
        name: "Robot piano terra",
        entity: "vacuum.robot",
        room_id: "room-soggiorno",
      },
    ],
    pool: {
      tempEnt: "sensor.piscina_temperatura",
      phEnt: "sensor.piscina_ph",
      clEnt: "sensor.piscina_cloro",
      pumpEnt: "switch.piscina_pompa",
      heatEnt: "switch.piscina_riscaldamento",
      lightEnt: "light.piscina",
      phMin: 7,
      phMax: 7.6,
      clMin: 0.5,
      clMax: 1.5,
      autoHours: true,
      hours: 8,
      filterStart: "09:00",
      enabled: true,
    },
    irrigation: {
      /* `mins` is the field the runtime reads for a zone duration. */
      zones: ["Prato fronte", "Prato retro", "Siepe", "Orto"].map((name, index) => ({
        id: `zone-${index + 1}`,
        name,
        entity: `switch.irrigazione_zona_${index + 1}`,
        mins: [15, 20, 8, 25][index],
        room: ["", "", "Giardino", "Giardino"][index],
      })),
      rainEnt: "binary_sensor.pioggia",
      weatherEnt: "weather.casa",
      rainThr: 40,
      time: "06:30",
      enabled: true,
    },
    energy: {
      plants: [
        {
          id: "impianto-dependance",
          name: "Dependance",
          house: {
            power: "sensor.dependance_casa_potenza",
            total_energy: "sensor.dependance_casa_energia_totale",
          },
          grid: {
            power: "sensor.dependance_rete_potenza",
            total_energy: "sensor.dependance_rete_prelievo_totale",
          },
          solar: {
            power: "sensor.dependance_fv_potenza",
            total_energy: "sensor.dependance_fv_energia_totale",
          },
          loads: [
            {
              id: "load-dep-pdc",
              name: "Pompa di calore",
              icon: "❄️",
              color: "#38bdf8",
              power_entity: "sensor.dependance_pdc_potenza",
              total_energy_entity: "sensor.dependance_pdc_energia_totale",
            },
            {
              id: "load-dep-cucina",
              name: "Cucina",
              icon: "🍳",
              color: "#f59e0b",
              power_entity: "sensor.dependance_cucina_potenza",
              total_energy_entity: "sensor.dependance_cucina_energia_totale",
            },
          ],
        },
      ],
      house: {
        power: "sensor.casa_potenza",
        daily_energy: "sensor.casa_energia_oggi",
        monthly_energy: "sensor.casa_energia_mese",
        annual_energy: "sensor.casa_energia_anno",
        total_energy: "sensor.casa_energia_totale",
      },
      grid: {
        power: "sensor.rete_potenza",
        daily_import_energy: "sensor.rete_prelievo_oggi",
        daily_export_energy: "sensor.rete_immissione_oggi",
        monthly_import_energy: "sensor.rete_prelievo_mese",
        monthly_export_energy: "sensor.rete_immissione_mese",
        annual_import_energy: "sensor.rete_prelievo_anno",
        annual_export_energy: "sensor.rete_immissione_anno",
        total_import_energy: "sensor.rete_prelievo_totale",
        total_export_energy: "sensor.rete_immissione_totale",
      },
      solar: {
        power: "sensor.fv_potenza",
        daily_energy: "sensor.fv_energia_oggi",
        monthly_energy: "sensor.fv_energia_mese",
        annual_energy: "sensor.fv_energia_anno",
        total_energy: "sensor.fv_energia_totale",
      },
      battery: {
        soc: "sensor.batteria_soc",
        power: "sensor.batteria_potenza",
        daily_charged_energy: "sensor.batteria_caricata_oggi",
        daily_discharged_energy: "sensor.batteria_scaricata_oggi",
        monthly_charged_energy: "sensor.batteria_caricata_mese",
        monthly_discharged_energy: "sensor.batteria_scaricata_mese",
        annual_charged_energy: "sensor.batteria_caricata_anno",
        annual_discharged_energy: "sensor.batteria_scaricata_anno",
        total_charged_energy: "sensor.batteria_caricata_totale",
        total_discharged_energy: "sensor.batteria_scaricata_totale",
      },
      metadata: { semantics_version: 4, energy_loads_migrated: true },
    },
    energyLoads: [
      {
        id: "energy-load-wallbox",
        name: "Wallbox",
        icon: "mdi:car-electric",
        color: "#06b6d4",
        power_entity: "sensor.wallbox_potenza",
        energy_entity: "sensor.wallbox_energia_oggi",
        order: 0,
      },
      {
        id: "energy-load-clima",
        name: "Clima",
        icon: "mdi:snowflake",
        color: "#0ea5e9",
        power_entity: "sensor.clima_potenza",
        energy_entity: "sensor.clima_energia_oggi",
        order: 1,
      },
      {
        id: "energy-load-lavanderia",
        name: "Lavanderia",
        icon: "mdi:washing-machine",
        color: "#7c3aed",
        power_entity: "sensor.lavanderia_potenza",
        energy_entity: "sensor.lavanderia_energia_oggi",
        order: 2,
      },
      {
        id: "energy-load-cucina",
        name: "Cucina",
        icon: "mdi:stove",
        color: "#e11d48",
        power_entity: "sensor.cucina_carichi_potenza",
        energy_entity: "sensor.cucina_energia_oggi",
        order: 3,
      },
      {
        id: "energy-load-boiler",
        name: "Boiler",
        icon: "mdi:water-boiler",
        color: "#ea580c",
        power_entity: "sensor.boiler_potenza",
        energy_entity: "sensor.boiler_energia_oggi",
        order: 4,
      },
    ],
    entityOverrides: {
      "dm.home_meteo": "weather.casa",
      "dm.security_centrale_allarme": "alarm_control_panel.casa",
      "dm.home_interruttore_antifurto": "switch.antifurto",
      "dm.home_script_apertura_cancello": "script.apri_cancello",
      "dm.energy_stato_rete": "sensor.stato_rete",
      "dm.energy_temperatura_dc_inverter": "sensor.inverter_temp_dc",
      "dm.energy_temperatura_ac_inverter": "sensor.inverter_temp_ac",
      "dm.energy_temperatura_batteria": "sensor.batteria_temperatura",
      "dm.energy_potenza_ventola_inverter": "sensor.inverter_ventola_potenza",
      "dm.energy_interruttore_ventola_inverter": "switch.inverter_ventola",
      "dm.energy_potenza_carichi_nodo_1_lavanderia": "sensor.lavanderia_potenza",
      "dm.energy_somma_lavanderia_oggi": "sensor.lavanderia_energia_oggi",
      "dm.energy_somma_lavanderia_mese": "sensor.lavanderia_energia_mese",
      "dm.energy_potenza_carichi_nodo_2_cucina": "sensor.cucina_carichi_potenza",
      "dm.energy_somma_cucina_oggi": "sensor.cucina_energia_oggi",
      "dm.energy_somma_cucina_mese": "sensor.cucina_energia_mese",
      "dm.energy_potenza_condizionatori": "sensor.clima_potenza",
      "dm.energy_condizionatori_oggi": "sensor.clima_energia_oggi",
      "dm.energy_condizionatori_mese": "sensor.clima_energia_mese",
      "dm.energy_boiler_oggi": "sensor.boiler_energia_oggi",
      "dm.energy_boiler_mese": "sensor.boiler_energia_mese",
      "dm.ev_batteria_auto": "sensor.auto_batteria",
      "dm.ev_autonomia": "sensor.auto_autonomia",
      "dm.ev_odometro": "sensor.auto_odometro",
      "dm.ev_autonomia_al_limite_di_carica": "sensor.auto_autonomia_limite",
      "dm.ev_km_dall_ultima_ricarica": "sensor.auto_km_ultima_ricarica",
      "dm.ev_stato_ricarica": "sensor.wallbox_stato",
      "dm.ev_modalita_ricarica_evcc": "select.wallbox_modalita",
      "dm.ev_target_soc": "select.auto_target_soc",
      "dm.ev_energia_sessione": "sensor.wallbox_sessione",
      "dm.ev_percentuale_solare_sessione": "sensor.wallbox_solare_sessione",
      "dm.ev_potenza_wallbox": "sensor.wallbox_potenza",
      "dm.ev_temperatura_wallbox": "sensor.wallbox_temperatura",
      "dm.ev_tensione_wallbox": "sensor.wallbox_tensione",
      "dm.ev_prelievo_ac_totale_auto": "sensor.auto_prelievo_totale",
      "dm.ev_energia_wallbox_oggi": "sensor.wallbox_energia_oggi",
      "dm.ev_energia_wallbox_mese": "sensor.wallbox_energia_mese",
      "dm.boiler_potenza_resistenza_boiler": "sensor.boiler_potenza",
      "dm.boiler_interruttore_boiler": "switch.boiler",
      "dm.boiler_interruttore_solare_termico": "switch.solare_termico",
      "dm.boiler_centralina_solare_termico": "sensor.solare_centralina",
      "dm.boiler_pompa_solare": "switch.pompa_solare",
      "dm.boiler_stato_pompa_solare": "binary_sensor.pompa_solare",
      "dm.boiler_sensore_pompa_solare": "binary_sensor.pompa_solare",
      "dm.boiler_delta_temperatura": "sensor.solare_delta",
      "dm.boiler_pressione_acqua": "sensor.impianto_pressione",
      "dm.boiler_valvola_di_sicurezza": "cover.valvola_sicurezza",
      "dm.boiler_sonda_temperatura_1": "sensor.boiler_sonda_1",
      "dm.boiler_sonda_temperatura_2": "sensor.boiler_sonda_2",
      "dm.boiler_sonda_temperatura_3": "sensor.boiler_sonda_3",
      "dm.lavatrice_presa_avvio_lavatrice": "switch.lavatrice",
      "dm.lavatrice_potenza_presa_lavatrice_per_lavatrici_no": "sensor.lavatrice_potenza",
      "dm.lavatrice_fase_corrente": "sensor.lavatrice_fase",
      "dm.lavatrice_tempo_rimanente": "sensor.lavatrice_rimanente",
      "dm.lavatrice_programma": "select.lavatrice_programma",
      "dm.server_cpu": "sensor.minipc_cpu",
      "dm.server_ram": "sensor.minipc_ram",
      "dm.server_disco": "sensor.minipc_disco",
      "dm.server_uptime_minipc": "sensor.minipc_uptime",
      "dm.server_temperatura_cpu": "sensor.minipc_cpu_temp",
      "dm.server_uptime_home_assistant": "sensor.ha_uptime",
      "dm.server_potenza_raspberry_server": "sensor.minipc_potenza",
      "dm.server_stato_internet": "binary_sensor.internet",
      "dm.server_ping_internet": "binary_sensor.ping_internet",
      "dm.server_raggiungibilita_google": "binary_sensor.google",
      "dm.server_internet_lavanderia": "binary_sensor.internet_lavanderia",
      "dm.server_speedtest_download": "sensor.speedtest_download",
      "dm.server_speedtest_upload": "sensor.speedtest_upload",
      "dm.server_speedtest_ping": "sensor.speedtest_ping",
    },
  },
  visibility: {
    home: true,
    stanze: true,
    luci: true,
    robot: true,
    energy: true,
    appliances: true,
    ev: true,
    boiler: true,
    clima: true,
    temp: true,
    temperature: true,
    security: true,
    server: true,
    tapparelle: true,
    irrigazione: true,
    piscina: true,
    /* Le sezioni nate nelle beta: musica, aperture, continuita', agenda e
       prese. Senza queste la barra le nasconde e la galleria non le vede. */
    media: true,
    porte: true,
    ups: true,
    calendario: true,
    prese: true,
  },
};

/* Extra localStorage keys the legacy runtime reads directly. */
export const extraStorage = {
  cd_quick_actions: [
    { type: "builtin", builtin: "luci", name: "Luci" },
    { type: "builtin", builtin: "clima", name: "Clima" },
    { type: "builtin", builtin: "antifurto", name: "Antifurto" },
    { type: "builtin", builtin: "lavatrice", name: "Lavatrice" },
    { type: "script", name: "Cancello", icon: "⛩️", entity: "script.apri_cancello" },
    { type: "toggle", name: "Irrigazione", icon: "💧", entity: "switch.irrigazione_zona_2" },
  ],
  cd_avvisi_custom: [
    { name: "Finestra cucina", entity: "binary_sensor.finestra_cucina", icon: "🪟" },
    { name: "Porta ingresso", entity: "binary_sensor.porta_ingresso", icon: "🚪" },
  ],
  cd_ev_image: "/api/dm_preview/vehicle.png",
  cd_ev_image_plugged: "/api/dm_preview/vehicle.png",
  cd_costo_kwh: 0.28,
  cd_prezzo_immissione: 0.09,
  cd_navbar_mode: "auto",
  /* Le persone: tre situazioni diverse, perche' la card cambia faccia per
   * ognuna — a casa, in rientro, fuori con la batteria agli sgoccioli. I
   * ritratti sono combinazioni dei render 3D vendorizzati. */
  cd_people: [
    {
      id: "person-giovanni",
      name: "Giovanni",
      entity: "person.giovanni",
      battery: "sensor.telefono_giovanni_batteria",
      batteryState: "sensor.telefono_giovanni_stato_batteria",
      avatar: {
        color: "#0ea5e9",
        face: { persona: "uomo", capelli: "barba", carnagione: "media", vestito: "informatico" },
      },
    },
    {
      id: "person-laura",
      name: "Laura",
      entity: "person.laura",
      battery: "sensor.telefono_laura_batteria",
      batteryState: "sensor.telefono_laura_stato_batteria",
      distance: "sensor.laura_distanza",
      travel: "sensor.laura_tempo_rientro",
      avatar: {
        color: "#ec4899",
        face: { persona: "donna", capelli: "ricci", carnagione: "chiara2", vestito: "medico" },
      },
    },
    {
      id: "person-marco",
      name: "Marco",
      entity: "person.marco",
      battery: "sensor.telefono_marco_batteria",
      batteryState: "sensor.telefono_marco_stato_batteria",
      avatar: {
        color: "#16a34a",
        face: { persona: "uomo", capelli: "lisci", carnagione: "ambrata", vestito: "ufficio" },
      },
    },
  ],
  cd_todo: [
    { entity: "todo.spesa", name: "Spesa" },
    { entity: "todo.casa", name: "Cose di casa" },
  ],
  cd_security_doors: [
    { id: "door-portone", name: "Portone", entity: "lock.portone", icon: "🚪" },
    { id: "door-garage", name: "Garage", entity: "lock.garage", icon: "🅿️" },
  ],
  /* La stanza detta sulla singola entita' (1.3): e' quello che riempie la
   * pagina di una stanza con cio' che nessuna scheda le chiedeva. */
  /* I lettori musicali (#269): il primo ha anche la sua stanza, cosi' la
   * didascalia della tessera dice dove sta suonando. */
  cd_media_player: [
    { id: "media-salone", entity: "media_player.salone", nome: "Salone", room_id: "room-soggiorno" },
    { id: "media-cucina", entity: "media_player.cucina", nome: "Cucina", room_id: "room-cucina" },
    { id: "media-camera", entity: "media_player.camera", nome: "Camera", room_id: "room-camera" },
  ],
  /* Il gruppo di continuita' (#256). */
  cd_ups: {
    name: "UPS rack",
    stato: "sensor.ups_status",
    rete: "binary_sensor.ups_rete",
    batteria: "sensor.ups_battery_charge",
    carico: "sensor.ups_load",
    autonomia: "sensor.ups_runtime",
    tensione: "sensor.ups_input_voltage",
    potenza: "sensor.ups_power",
    temperatura: "sensor.ups_temperature",
  },
  /* Le prese: il modem si guarda e basta. */
  cd_prese: [
    { entity: "switch.presa_tv", name: "TV salotto", icon: "\ud83d\udcfa", room_id: "room-soggiorno" },
    { entity: "switch.presa_firestick", name: "Firestick", icon: "\ud83c\udfac", room_id: "room-soggiorno" },
    { entity: "switch.presa_modem", name: "Modem", icon: "\ud83d\udce1", room_id: "room-studio" },
    { entity: "switch.presa_camera", name: "Presa camera", icon: "\ud83d\udd0c", room_id: "room-camera" },
  ],
  cd_solo_lettura: ["switch.presa_modem"],
  /* I calendari dell'Agenda: le liste delle cose da fare sono in cd_todo. */
  cd_calendari: [
    { entity: "calendar.famiglia", name: "Famiglia" },
    { entity: "calendar.lavoro", name: "Lavoro" },
  ],
  /* Le entita' che uno si aggiunge in fondo a una scheda che non le prevedeva
   * (#271): qui il livello della cisterna finisce nell'Irrigazione. */
  cd_entita_mie: [
    {
      id: "mia-cisterna",
      entity: "sensor.cisterna_livello",
      nome: "Cisterna",
      icona: "\ud83d\udeb0",
      sezione: "irrigazione",
    },
    {
      id: "mia-acqua",
      entity: "sensor.contatore_acqua",
      nome: "Contatore acqua",
      icona: "\ud83d\udca7",
      sezione: "energy",
    },
    {
      id: "mia-pedonale",
      entity: "binary_sensor.cancello_pedonale",
      nome: "Cancello pedonale",
      icona: "\ud83d\udeaa",
      sezione: "security",
    },
  ],
  /* Una sezione tutta sua: un titolo e le entita' che ci si mettono dentro. */
  cd_sezioni_mie: [
    {
      /* L'id e' nudo: la chiave della voce nella barra la fa la plancia,
       * anteponendogli «mia-». */
      id: "acquario",
      titolo: "Acquario",
      icona: "\ud83d\udc1f",
      voci: [
        { nome: "Temperatura", entity: "sensor.acquario_temperatura", icona: "\ud83c\udf21\ufe0f" },
        { nome: "pH", entity: "sensor.acquario_ph", icona: "\u2697\ufe0f" },
        { nome: "Luce", entity: "switch.acquario_luce", icona: "\ud83d\udca1" },
        { nome: "Pompa", entity: "switch.acquario_pompa", icona: "\ud83c\udf0a" },
      ],
    },
  ],
  cd_stanze_entita: {
    "binary_sensor.finestra_cucina": "room-cucina",
    "binary_sensor.porta_ingresso": "room-garage",
    "sensor.piscina_temperatura": "room-giardino",
    "binary_sensor.pompa_solare": "room-garage",
  },
};

/* Daily / monthly / yearly recorder deltas used by the mocked statistics API. */
export const statisticsDeltas = {
  day: {
    "sensor.casa_energia_totale": 14.6,
    "sensor.fv_energia_totale": 21.6,
    "sensor.rete_prelievo_totale": 3.2,
    "sensor.rete_immissione_totale": 7.9,
    "sensor.batteria_caricata_totale": 6.4,
    "sensor.batteria_scaricata_totale": 4.1,
    "sensor.lavatrice_energia_totale": 0.94,
    "sensor.lavastoviglie_energia_totale": 1.12,
    "sensor.asciugatrice_energia_totale": 0,
    "sensor.forno_energia_totale": 0.4,
    "sensor.frigo_energia_totale": 0.72,
    "sensor.robot_energia_totale": 0.18,
    "sensor.boiler_energia_totale": 1.2,
    "sensor.clima_energia_totale": 2.6,
    "sensor.wallbox_energia_totale": 6.4,
    "sensor.illuminazione_energia_totale": 0.6,
  },
  month: {
    "sensor.casa_energia_totale": 401.1,
    "sensor.fv_energia_totale": 512.4,
    "sensor.rete_prelievo_totale": 74.3,
    "sensor.rete_immissione_totale": 168.2,
    "sensor.batteria_caricata_totale": 148.6,
    "sensor.batteria_scaricata_totale": 131.2,
    "sensor.lavatrice_energia_totale": 24.6,
    "sensor.lavastoviglie_energia_totale": 28.4,
    "sensor.asciugatrice_energia_totale": 16.2,
    "sensor.forno_energia_totale": 12.8,
    "sensor.frigo_energia_totale": 22.4,
    "sensor.robot_energia_totale": 4.2,
    "sensor.boiler_energia_totale": 42.6,
    "sensor.clima_energia_totale": 62.4,
    "sensor.wallbox_energia_totale": 132.6,
    "sensor.illuminazione_energia_totale": 18.6,
  },
  previousMonth: {
    "sensor.casa_energia_totale": 406.1,
    "sensor.fv_energia_totale": 486.2,
    "sensor.rete_prelievo_totale": 88.1,
    "sensor.rete_immissione_totale": 152.6,
    "sensor.batteria_caricata_totale": 140.2,
    "sensor.batteria_scaricata_totale": 124.6,
    "sensor.lavatrice_energia_totale": 22.1,
    "sensor.lavastoviglie_energia_totale": 26.8,
    "sensor.asciugatrice_energia_totale": 19.4,
    "sensor.forno_energia_totale": 14.2,
    "sensor.frigo_energia_totale": 23.1,
    "sensor.robot_energia_totale": 3.8,
    "sensor.boiler_energia_totale": 46.2,
    "sensor.clima_energia_totale": 58.2,
    "sensor.wallbox_energia_totale": 124.8,
    "sensor.illuminazione_energia_totale": 19.8,
  },
  year: {
    "sensor.casa_energia_totale": 5202.2,
    "sensor.fv_energia_totale": 6248.1,
    "sensor.rete_prelievo_totale": 962.4,
    "sensor.rete_immissione_totale": 1840.7,
    "sensor.batteria_caricata_totale": 1620.4,
    "sensor.batteria_scaricata_totale": 1452.8,
    "sensor.lavatrice_energia_totale": 268.4,
    "sensor.lavastoviglie_energia_totale": 312.6,
    "sensor.asciugatrice_energia_totale": 184.2,
    "sensor.forno_energia_totale": 142.8,
    "sensor.frigo_energia_totale": 264.6,
    "sensor.robot_energia_totale": 46.2,
    "sensor.boiler_energia_totale": 486.4,
    "sensor.clima_energia_totale": 620.8,
    "sensor.wallbox_energia_totale": 1420.4,
    "sensor.illuminazione_energia_totale": 212.4,
  },
};

// DM-FIX-20260817A
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  explicitKioskRequest,
  isIosDevice,
  kioskHostStyles,
  kioskValueFromLocation,
  readStoredKiosk,
  isTouchDevice,
  resolveKioskMode,
  trapsFixedPosition,
  writeStoredKiosk,
} from "../src/sections/beta12-room-color-lock-section.js";

const fakeStorage = (initial = {}) => {
  const values = { ...initial };
  return {
    values,
    getItem: (key) => (key in values ? values[key] : null),
    setItem: (key, value) => {
      values[key] = String(value);
    },
  };
};

test("an explicit kiosk request is read from query string and hash", () => {
  assert.equal(kioskValueFromLocation({ search: "?kiosk=1" }), true);
  assert.equal(kioskValueFromLocation({ search: "?dm_kiosk=on" }), true);
  assert.equal(kioskValueFromLocation({ search: "?kiosk=0" }), false);
  assert.equal(kioskValueFromLocation({ search: "?kiosk=false" }), false);
  assert.equal(kioskValueFromLocation({ hash: "#kiosk=1" }), true);
  assert.equal(kioskValueFromLocation({ hash: "#/lovelace/home?kiosk=off" }), false);
  assert.equal(kioskValueFromLocation({ search: "?other=1" }), null);
  assert.equal(kioskValueFromLocation(null), null);
});

test("the hosting Home Assistant page owns the request of a srcdoc plancia", () => {
  const parent = { location: { search: "?kiosk=1" } };
  const frame = { location: { search: "" } };
  assert.equal(explicitKioskRequest([parent, frame]), true);
  assert.equal(explicitKioskRequest([{ location: {} }, { location: {} }]), null);
  assert.equal(explicitKioskRequest([undefined, { location: { search: "?kiosk=0" } }]), false);
});

test("a cross origin parent never blocks the request lookup", () => {
  const hostile = {
    get location() {
      throw new Error("cross origin");
    },
  };
  assert.equal(explicitKioskRequest([hostile, { location: { search: "?kiosk=1" } }]), true);
});

test("the stored preference round trips and stays optional", () => {
  const storage = fakeStorage();
  assert.equal(readStoredKiosk(storage), null);
  writeStoredKiosk(true, storage);
  assert.equal(storage.values.dm_kiosk, "1");
  assert.equal(readStoredKiosk(storage), true);
  writeStoredKiosk(false, storage);
  assert.equal(storage.values.dm_kiosk, "0");
  assert.equal(readStoredKiosk(storage), false);
  assert.equal(readStoredKiosk(fakeStorage({ dm_kiosk: "" })), null);
  assert.equal(readStoredKiosk(undefined), null);
});

test("a hosted iPhone starts the plancia in kiosk without any query string", () => {
  assert.equal(resolveKioskMode({ ios: true, hosted: true, narrow: true }), true);
  assert.equal(resolveKioskMode({ ios: true, standalone: true }), true);
});

test("kiosk never auto starts outside a narrow hosted phone surface", () => {
  assert.equal(resolveKioskMode({}), false);
  assert.equal(resolveKioskMode({ ios: true, hosted: true, narrow: false }), false);
  assert.equal(resolveKioskMode({ ios: true, hosted: false, narrow: true }), false);
  // Una finestra stretta su un computer: la barra degli indirizzi ce l'ha, e il
  // dito no. Non le si porta via lo schermo.
  assert.equal(resolveKioskMode({ touch: false, hosted: true, narrow: true }), false);
});

/* Il chiosco era nato guardando l'iPhone. Dentro l'app di Home Assistant per
 * Android il problema e' lo stesso — nessuna barra degli indirizzi dove
 * scrivere ?kiosk=1 — ma non si accendeva mai da solo. */
test("anche un telefono Android che ospita la plancia parte a tutto schermo", () => {
  assert.equal(resolveKioskMode({ ios: false, touch: true, hosted: true, narrow: true }), true);
});

test("e su Android la scelta di spegnerlo resta quella di chi la fa", () => {
  const android = { ios: false, touch: true, hosted: true, narrow: true };
  assert.equal(resolveKioskMode({ ...android, stored: false }), false);
  assert.equal(resolveKioskMode({ ...android, explicit: false }), false);
  assert.equal(resolveKioskMode({ ...android, override: false, stored: true }), false);
});

test("una plancia installata come app a se' su Android parte a tutto schermo", () => {
  assert.equal(resolveKioskMode({ ios: false, touch: true, standalone: true, narrow: true }), true);
  // Ma un computer con la plancia installata no: li' lo schermo e' largo e il
  // dito non c'e'.
  assert.equal(resolveKioskMode({ ios: false, touch: false, standalone: true }), false);
});

test("an explicit request outranks the auto default and the stored preference", () => {
  assert.equal(
    resolveKioskMode({ explicit: false, stored: true, ios: true, hosted: true, narrow: true }),
    false,
  );
  assert.equal(resolveKioskMode({ explicit: true, stored: false }), true);
});

test("the stored preference outranks the auto default", () => {
  assert.equal(resolveKioskMode({ stored: false, ios: true, hosted: true, narrow: true }), false);
  assert.equal(resolveKioskMode({ stored: true }), true);
});

test("the in session choice outranks a query string that cannot be edited", () => {
  assert.equal(resolveKioskMode({ override: false, explicit: true, stored: true }), false);
  assert.equal(resolveKioskMode({ override: true, explicit: false }), true);
});

test("the kiosk overlay covers the Home Assistant chrome at the measured height", () => {
  const styles = kioskHostStyles({ height: 844 });
  assert.equal(styles.position, "fixed");
  assert.equal(styles.inset, "0");
  assert.equal(styles.height, "844px");
  assert.equal(styles["min-height"], "844px");
  assert.equal(styles["max-height"], "844px");
  assert.equal(styles.width, "100%");
  assert.equal(styles.overflow, "hidden");
  assert.ok(Number(styles["z-index"]) > 1000);
});

test("an unusable measurement falls back to the dynamic viewport unit", () => {
  assert.equal(kioskHostStyles({ height: 0 }).height, "100dvh");
  assert.equal(kioskHostStyles().height, "100dvh");
});

test("the overlay steps down while the native sidebar is open", () => {
  assert.equal(kioskHostStyles({ height: 844, drawerOpen: true })["z-index"], "1");
});

test("only a real containing block on an ancestor is neutralized", () => {
  assert.equal(trapsFixedPosition("transform", "matrix(1, 0, 0, 1, 0, 0)"), true);
  assert.equal(trapsFixedPosition("transform", "none"), false);
  assert.equal(trapsFixedPosition("filter", "blur(2px)"), true);
  assert.equal(trapsFixedPosition("contain", "paint"), true);
  assert.equal(trapsFixedPosition("contain", "size"), false);
  assert.equal(trapsFixedPosition("will-change", "transform"), true);
  assert.equal(trapsFixedPosition("will-change", "auto"), false);
  assert.equal(trapsFixedPosition("will-change", "opacity"), false);
  assert.equal(trapsFixedPosition("color", "red"), false);
});

test("iOS detection covers iPhone, iPad and desktop class iPadOS", () => {
  assert.equal(isIosDevice({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)" }), true);
  assert.equal(isIosDevice({ userAgent: "Mozilla/5.0 (iPad; CPU OS 17_0)" }), true);
  assert.equal(isIosDevice({ platform: "MacIntel", maxTouchPoints: 5, userAgent: "" }), true);
  assert.equal(isIosDevice({ platform: "MacIntel", maxTouchPoints: 0, userAgent: "" }), false);
  assert.equal(isIosDevice({ userAgent: "Mozilla/5.0 (Linux; Android 14)" }), false);
  assert.equal(isIosDevice({}), false);
});

/* La plancia decide da dentro la sua cornice, e li' `maxTouchPoints` non e'
 * sempre quello del dispositivo: dove tornava zero il chiosco non partiva su un
 * telefono che il dito ce l'ha. Ne basta uno dei tre. */
test("il dito si riconosce in tre modi, non solo contando i tocchi", () => {
  const finestra = (coarse) => ({ matchMedia: () => ({ matches: coarse }) });
  assert.equal(isTouchDevice({ maxTouchPoints: 5 }, finestra(false)), true);
  assert.equal(isTouchDevice({ maxTouchPoints: 0 }, finestra(true)), true);
  const conTocco = finestra(false);
  conTocco.ontouchstart = null;
  assert.equal(isTouchDevice({ maxTouchPoints: 0 }, conTocco), true);
});

test("e un mouse su uno schermo fine resta un mouse", () => {
  assert.equal(
    isTouchDevice({ maxTouchPoints: 0 }, { matchMedia: () => ({ matches: false }) }),
    false,
  );
  // Un browser che non sa rispondere non diventa per questo un telefono.
  assert.equal(isTouchDevice({}, {}), false);
});

/* ── l'interruttore, dove lo si cerca (#480) ──────────────────────────── */

/* «Da smartphone non me la propone, su tablet e pc ho la barra laterale, è
 *  possibile toglierla?» — «Ma non vorrei disattivarla per tutte le plance,
 *  sarebbe possibile avere una funzione tipo kiosk mode?»
 *
 * Il chiosco c'era già e fa esattamente quello: manda la plancia sopra la
 * barra laterale, e riguarda questa plancia e basta. Ma per accenderlo a mano
 * bisognava sapere due cose non scritte da nessuna parte — tenere premuto
 * l'hamburger, o scrivere ?kiosk=1 nell'indirizzo. Una funzione che c'è ma non
 * si trova, per chi la cerca, non c'è. */
const chiosco = readFileSync(
  new URL("../src/sections/modo-chiosco-section.js", import.meta.url),
  "utf8",
);

test("l'interruttore del chiosco sta in ⚙️ Impostazioni, al suo posto in fila", () => {
  const condivise = readFileSync(new URL("../src/sections/shared.js", import.meta.url), "utf8");
  /* Fra la lingua e Assist: l'ordine è un numero che la riga si porta addosso,
   * così chi arriva primo o ultimo non cambia quello che si legge. */
  assert.match(
    condivise,
    /ORDINE_IMPOSTAZIONI = Object\.freeze\(\{ lingua: 10, chiosco: 15, assist: 20, sezioni: 30 \}\)/,
  );
  assert.match(chiosco, /const SCHEDA = "visib";/);
  assert.match(chiosco, /inserisciInOrdine\(corpo, riga, ORDINE_IMPOSTAZIONI\.chiosco, dopoIGenerali\)/);
});

test("non è un secondo chiosco: è lo stesso, visto da un posto dove si arriva", () => {
  /* Due modi di accendere la stessa cosa sarebbero due verità sullo stesso
   * interruttore, e prima o poi una delle due invecchia. */
  assert.match(
    chiosco,
    /import \{ kioskAttivo, setKioskMode \} from "\.\/beta12-room-color-lock-section\.js"/,
  );
  assert.match(chiosco, /setKioskMode\(!kioskAttivo\(\)\)/);
  // E nessuna memoria propria: la preferenza la scrive `setKioskMode`.
  assert.doesNotMatch(chiosco, /localStorage|writeStoredKiosk|readJson/);
});

test("l'interruttore dice quello che è vero adesso, anche se l'ha acceso un altro", () => {
  /* Il chiosco si accende anche da fuori — il dito tenuto premuto, ?kiosk=1, il
   * telefono che parte così — e chi disegna la riga lo viene a sapere
   * dall'annuncio che `setKioskMode` manda già. */
  assert.match(chiosco, /root\.addEventListener\?\.\("dashboardmodern:kiosk", ridipingi\)/);
  assert.match(chiosco, /aria-checked="\$\{acceso \? "true" : "false"\}"/);
  const beta12 = readFileSync(
    new URL("../src/sections/beta12-room-color-lock-section.js", import.meta.url),
    "utf8",
  );
  assert.match(beta12, /export function kioskAttivo\(\)/);
  assert.match(beta12, /new CustomEvent\("dashboardmodern:kiosk"/);
});

test("il modulo è installato dal runtime, come le altre righe delle Impostazioni", () => {
  const runtime = readFileSync(
    new URL("../src/sections/section-runtime.js", import.meta.url),
    "utf8",
  );
  assert.match(runtime, /import \{ installModoChiosco \} from "\.\/modo-chiosco-section\.js";/);
  assert.match(runtime, /installModoChiosco\(\);/);
});

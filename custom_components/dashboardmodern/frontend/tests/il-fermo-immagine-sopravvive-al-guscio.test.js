/* L'istantanea resta anche dopo che il guscio ha riscritto il popup.
 *
 * «Telecamere idem: guardalo tu stesso, non si vede nulla.» E la schermata lo
 * diceva: dentro il riquadro c'era il segnaposto nero di un `<video>` vuoto e
 * la scritta «Connessione WebRTC…», non il fotogramma della telecamera.
 *
 * Il difetto era di un colpo solo. `mostraSubito` scriveva l'istantanea in
 * `content.innerHTML`; un attimo dopo il guscio, dentro la sua corsa, scriveva
 * QUELLO STESSO `content.innerHTML` col suo video e il suo velo. Il fotogramma
 * veniva cancellato prima che qualcuno lo vedesse — e la correzione «si vede
 * subito» risultava fatta nel codice e invisibile sullo schermo, per tre
 * rilasci.
 *
 * La regola nuova e' che il fermo NON sta fra i figli di `content`: sta addosso
 * a `content`, come una classe e una variabile del foglio di stile. Quelli il
 * guscio non li tocca — riscrive i figli — quindi il fondo del riquadro resta
 * dipinto qualunque cosa ci scriva dentro e quante volte lo riscriva.
 *
 * Il finto `content` qui sotto fa esattamente quello che fa quello vero: gli si
 * assegna `innerHTML` e i figli se ne vanno, mentre classe e stile restano. E'
 * su quella differenza che il difetto viveva.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { istantaneaDi, vestiIlPopup } from "../src/sections/telecamera-subito-section.js";

const FOTO = "/api/camera_proxy/camera.salone?token=abc123";

function contentFinto() {
  const stile = new Map();
  const classi = new Set();
  return {
    innerHTML: "",
    /* Il gesto del guscio: i figli via, il resto dov'era. */
    riscriviComeIlGuscio() {
      this.innerHTML =
        '<div class="cam-popup-body"><div id="video-iframe-container" class="cam-zoom-container">' +
        '<video id="cam-video" autoplay playsinline></video>' +
        '<div id="cam-video-loader">Connessione WebRTC…</div></div></div>';
    },
    classList: {
      add: (nome) => classi.add(nome),
      remove: (nome) => classi.delete(nome),
      contains: (nome) => classi.has(nome),
    },
    style: {
      setProperty: (nome, valore) => stile.set(nome, valore),
      removeProperty: (nome) => stile.delete(nome),
      getPropertyValue: (nome) => stile.get(nome) || "",
    },
  };
}

const STATI = {
  "camera.salone": { entity_id: "camera.salone", attributes: { entity_picture: FOTO } },
  "camera.muta": { entity_id: "camera.muta", attributes: {} },
};

test("l'istantanea si legge da entity_picture, che e' gia' in casa", () => {
  assert.equal(istantaneaDi("camera.salone", STATI), FOTO);
  assert.equal(istantaneaDi("camera.muta", STATI), "");
  assert.equal(istantaneaDi("", STATI), "");
});

test("il fermo sopravvive al riscritto del guscio: e' addosso al popup, non dentro", () => {
  const content = contentFinto();
  assert.equal(vestiIlPopup({ entity: "camera.salone" }, content, STATI), true);
  assert.ok(content.classList.contains("dm-cam-con-fermo"));
  assert.match(content.style.getPropertyValue("--dm-cam-fermo"), /camera_proxy/);

  /* Ed ecco il gesto che prima cancellava tutto. */
  content.riscriviComeIlGuscio();
  assert.match(content.innerHTML, /Connessione WebRTC/, "il guscio ha riscritto davvero");
  assert.ok(
    content.classList.contains("dm-cam-con-fermo"),
    "il fermo se ne e' andato col riscritto: e' il difetto di prima",
  );
  assert.match(content.style.getPropertyValue("--dm-cam-fermo"), /camera_proxy/);
});

test("una telecamera senza istantanea non si veste, e non resta vestita da quella di prima", () => {
  const content = contentFinto();
  vestiIlPopup({ entity: "camera.salone" }, content, STATI);
  assert.ok(content.classList.contains("dm-cam-con-fermo"));
  /* Aprendo poi una telecamera che non ha `entity_picture`, il fotogramma
   * della PRIMA non deve restare li' sotto: sarebbe l'immagine di un'altra
   * stanza spacciata per questa. */
  assert.equal(vestiIlPopup({ entity: "camera.muta" }, content, STATI), false);
  assert.equal(content.classList.contains("dm-cam-con-fermo"), false);
  assert.equal(content.style.getPropertyValue("--dm-cam-fermo"), "");
});

test("un apice nel gettone non rompe la regola del foglio di stile", () => {
  /* Un `entity_picture` porta un gettone di accesso, e ci finisce dentro di
   * tutto: una virgoletta chiuderebbe l'url della regola CSS. */
  const content = contentFinto();
  const stati = {
    "camera.x": { attributes: { entity_picture: '/api/camera_proxy/x?token=a"b' } },
  };
  vestiIlPopup({ entity: "camera.x" }, content, stati);
  const valore = content.style.getPropertyValue("--dm-cam-fermo");
  assert.equal(valore.split('"').length - 1, 2, "le virgolette dentro l'url vanno citate");
  assert.match(valore, /%22/);
});

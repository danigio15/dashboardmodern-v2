import assert from "node:assert/strict";
import test from "node:test";

import {
  adoptLoosePhotos,
  photosForProfile,
  profilePhotos,
  withProfilePhotos,
} from "../src/core/vehicle-photos.js";

test("le foto di un profilo sono quelle che il profilo si porta dietro", () => {
  assert.deepEqual(profilePhotos({ img: " /local/a.png ", imgPlugged: "/local/b.png" }), {
    idle: "/local/a.png",
    plugged: "/local/b.png",
  });
  assert.deepEqual(profilePhotos({}), { idle: "", plugged: "" });
  assert.deepEqual(profilePhotos(), { idle: "", plugged: "" });
});

test("con due auto la seconda non eredita la foto della prima", () => {
  // Il difetto: le foto stavano in due caselle sole, l'auto appena scelta non
  // ne aveva di sue e teneva quelle che c'erano. Le due macchine finivano per
  // mostrare la stessa fotografia, ed e' esattamente quello che si vedeva.
  const inMostra = { idle: "/local/prima.png", plugged: "/local/prima-cavo.png" };
  const seconda = { name: "Seconda" };
  assert.deepEqual(photosForProfile(seconda, inMostra, 2), { idle: "", plugged: "" });
  // E se la sua ce l'ha, e' la sua che si vede.
  assert.deepEqual(photosForProfile({ img: "/local/seconda.png" }, inMostra, 2), {
    idle: "/local/seconda.png",
    plugged: "",
  });
});

test("con una macchina sola le caselle restano casa sua", () => {
  // Nessuno deve vedersi sparire la foto passando a questa versione.
  const inMostra = { idle: "/local/auto.png", plugged: "/local/auto-cavo.png" };
  assert.deepEqual(photosForProfile({ name: "Unica" }, inMostra, 1), inMostra);
  assert.deepEqual(photosForProfile({ name: "Unica" }, inMostra), inMostra);
});

test("salvare una foto la scrive nell'auto scelta e non tocca le altre", () => {
  const cars = [{ name: "Prima" }, { name: "Seconda", img: "/local/x.png" }];
  const dopo = withProfilePhotos(cars, 0, { idle: "/local/prima.png", plugged: "" });
  assert.equal(dopo[0].img, "/local/prima.png");
  assert.equal(dopo[0].imgPlugged, "");
  assert.deepEqual(dopo[1], cars[1]);
  // L'elenco di partenza resta com'era: chi lo teneva non se lo vede cambiare.
  assert.equal(cars[0].img, undefined);
  // Scrivere quello che c'e' gia' non e' una modifica.
  assert.equal(withProfilePhotos(dopo, 0, { idle: "/local/prima.png" }), dopo);
  // Un indice fuori misura finisce sull'auto piu' vicina, non in mezzo al nulla.
  assert.equal(withProfilePhotos(cars, 9, { idle: "/local/z.png" })[1].img, "/local/z.png");
  assert.equal(withProfilePhotos([], 0, { idle: "/local/z.png" }).length, 0);
});

test("chi arriva dalle versioni precedenti ritrova la foto sull'auto che la mostrava", () => {
  const cars = [{ name: "Prima" }, { name: "Seconda" }];
  const inMostra = { idle: "/local/auto.png", plugged: "/local/auto-cavo.png" };
  const dopo = adoptLoosePhotos(cars, 1, inMostra);
  assert.equal(dopo[1].img, "/local/auto.png");
  assert.equal(dopo[1].imgPlugged, "/local/auto-cavo.png");
  // L'altra resta senza, ed e' corretto: una foto sua non l'ha mai avuta.
  assert.equal(dopo[0].img, undefined);

  // Succede una volta: se una qualsiasi auto ha gia' la sua, non si adotta piu'.
  assert.equal(adoptLoosePhotos(dopo, 0, inMostra), dopo);
  // Niente da adottare, niente da fare.
  assert.equal(adoptLoosePhotos(cars, 0, { idle: "", plugged: "" }), cars);
  /* Anche con una macchina sola.
   *
   * L'adozione sembrava servire solo a chi ne ha due, perche' era li' che le
   * foto si mescolavano. Ma finche' con una sola la foto resta soltanto nelle
   * due caselle della plancia, quelle caselle sono l'unico posto dove vive — e
   * per farla arrivare sugli altri dispositivi bisognava spedirle. Spedirle era
   * proprio quello che faceva comparire l'auto sbagliata. Portata dentro al
   * profilo, la foto viaggia dove viaggiano le auto. */
  const unica = [{ name: "Unica" }];
  const soltanto = adoptLoosePhotos(unica, 0, inMostra);
  assert.notEqual(soltanto, unica, "anche l'unica auto si prende la sua foto");
  assert.equal(soltanto[0].img, "/local/auto.png");
  assert.equal(soltanto[0].imgPlugged, "/local/auto-cavo.png");
});

test("la foto col cavo non sparisce a chi arriva dalla plancia di prima", () => {
  // La plancia di prima la foto senza cavo la scriveva gia' dentro al profilo;
  // quella col cavo non e' mai esistita li'. Guardare "un profilo qualsiasi ha
  // una foto" fermava l'adozione proprio in questo caso, e al primo cambio
  // d'auto la foto col cavo veniva riscritta a vuoto e spariva.
  const cars = [
    { name: "Prima", img: "/local/prima.png" },
    { name: "Seconda", img: "/local/seconda.png" },
  ];
  const dopo = adoptLoosePhotos(cars, 0, {
    idle: "/local/prima.png",
    plugged: "/local/prima-cavo.png",
  });
  assert.equal(dopo[0].imgPlugged, "/local/prima-cavo.png");
  // La sua foto senza cavo resta quella che aveva.
  assert.equal(dopo[0].img, "/local/prima.png");
  // E l'altra auto non viene toccata.
  assert.deepEqual(dopo[1], cars[1]);

  // Se una foto col cavo un profilo ce l'ha gia', non si adotta piu' niente.
  assert.equal(adoptLoosePhotos(dopo, 1, { idle: "", plugged: "/local/x.png" }), dopo);
});

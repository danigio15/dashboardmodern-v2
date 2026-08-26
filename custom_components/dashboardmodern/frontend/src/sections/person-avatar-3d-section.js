/* Il ritratto in tre dimensioni, appeso al documento.
 *
 * Il motore — la scultura e il rasterizzatore — e' aritmetica pura e non sa
 * cos'e' una pagina. Qui c'e' l'altra meta': i pixel finiscono in una tela,
 * la tela diventa un'immagine, e l'immagine si mette dove c'era il disegno.
 *
 * Due regole, e sono quelle che tengono la plancia veloce:
 *
 *  - si disegna UNA volta per faccia. Il ritratto non gira e non respira: e'
 *    una fotografia, e la stessa faccia da' sempre la stessa fotografia. La
 *    chiave e' la faccia stessa, e il risultato resta in memoria;
 *  - si disegna QUANDO c'e' tempo. La prima passata mostra il disegno SVG,
 *    che costa niente ed e' gia' li'; il 3D arriva al primo momento libero e
 *    prende il suo posto. Nessuno aspetta un decimo di secondo davanti a una
 *    card vuota.
 */
import { renderFace } from "../core/person-avatar-3d.js";
import { doc, root } from "./shared.js";

const KEY = "__DASHBOARDMODERN_FACE_3D__";
const state = (root[KEY] ||= { cache: new Map(), coda: [], attesa: 0 });

/* Quante fotografie tenere: piu' delle persone di una casa, meno di quanto
 * serva a pesare. Quando si sfora, se ne va la piu' vecchia. */
const TETTO = 24;

function chiave(face, size, shirt) {
  return `${size}|${shirt}|${JSON.stringify(face)}`;
}

/** Il ritratto come URL di dati, disegnato adesso. */
export function avatar3dUrl(face, { size = 176, shirt = "" } = {}) {
  const k = chiave(face, size, shirt);
  const avuto = state.cache.get(k);
  if (avuto) return avuto;
  if (!doc?.createElement) return "";
  const { data, size: lato } = renderFace(face, { size, shirt });
  const tela = doc.createElement("canvas");
  tela.width = lato;
  tela.height = lato;
  const ctx = tela.getContext?.("2d");
  if (!ctx) return "";
  ctx.putImageData(new ImageData(data, lato, lato), 0, 0);
  const url = tela.toDataURL("image/png");
  state.cache.set(k, url);
  if (state.cache.size > TETTO) state.cache.delete(state.cache.keys().next().value);
  return url;
}

/** Il ritratto gia' pronto, se qualcuno l'ha gia' chiesto. Niente conti. */
export function avatar3dPronto(face, { size = 176, shirt = "" } = {}) {
  return state.cache.get(chiave(face, size, shirt)) || "";
}

function svuotaCoda() {
  state.attesa = 0;
  const lavoro = state.coda.splice(0, state.coda.length);
  for (const { host, face, size, shirt } of lavoro) {
    if (!host?.isConnected) continue;
    const url = avatar3dUrl(face, { size, shirt });
    if (!url) continue;
    const img = doc.createElement("img");
    img.className = "dm-face-3d";
    img.src = url;
    img.alt = "";
    host.replaceChildren(img);
  }
}

/**
 * Mette il ritratto 3D dentro `host`, quando c'e' tempo. Nel frattempo li'
 * dentro resta quello che c'era — il disegno — e nessuno vede un buco.
 */
export function dipingi3D(host, face, { size = 176, shirt = "" } = {}) {
  if (!host || !face) return;
  const gia = avatar3dPronto(face, { size, shirt });
  if (gia) {
    if (host.firstElementChild?.getAttribute?.("src") === gia) return;
    const img = doc.createElement("img");
    img.className = "dm-face-3d";
    img.src = gia;
    img.alt = "";
    host.replaceChildren(img);
    return;
  }
  state.coda.push({ host, face, size, shirt });
  if (state.attesa) return;
  /* Al primo momento libero. `requestIdleCallback` dove c'e', altrimenti il
   * fotogramma dopo: quello che conta e' non farlo mentre la pagina sta
   * ancora comparendo. */
  state.attesa = 1;
  if (root.requestIdleCallback) root.requestIdleCallback(svuotaCoda, { timeout: 800 });
  else root.setTimeout?.(svuotaCoda, 60);
}

export function installFace3dStyle() {
  const stile = doc?.getElementById?.("dm-face-3d-style");
  if (stile || !doc?.head) return;
  const el = doc.createElement("style");
  el.id = "dm-face-3d-style";
  el.textContent = `.dm-face-3d{width:100%;height:100%;display:block;object-fit:cover}`;
  doc.head.append(el);
}

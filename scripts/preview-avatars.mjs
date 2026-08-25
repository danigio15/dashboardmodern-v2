/* Anteprima dell'avatar: griglia di varianti renderizzata e fotografata,
 * per guardare il disegno mentre lo si lavora. Solo sviluppo locale. */
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { avatarSvg } from "../custom_components/dashboardmodern/frontend/src/core/person-avatar.js";

const scratch = process.argv[2] || "/tmp/avatar-preview";
const faces = [
  {
    label: "riccia",
    skin: "f3",
    hair: "riccio",
    hairColor: "moro",
    eyes: "grandi",
    eyeColor: "verde",
    mouth: "risata",
    beard: "nessuna",
    glasses: "nessuno",
    build: "normale",
  },
  {
    label: "bimba",
    skin: "f1",
    hair: "caschetto",
    hairColor: "rame",
    eyes: "grandi",
    eyeColor: "azzurro",
    mouth: "sorriso",
    beard: "nessuna",
    glasses: "nessuno",
    build: "magra",
  },
  {
    label: "biondo",
    skin: "f2",
    hair: "ciuffo",
    hairColor: "biondo",
    eyes: "normali",
    eyeColor: "azzurro",
    mouth: "sorriso",
    beard: "nessuna",
    glasses: "nessuno",
    build: "normale",
  },
  {
    label: "barba piena",
    skin: "f4",
    hair: "corto",
    hairColor: "nero",
    eyes: "normali",
    eyeColor: "marrone",
    mouth: "sorriso",
    beard: "piena",
    glasses: "nessuno",
    build: "robusta",
  },
  {
    label: "lunghi",
    skin: "f5",
    hair: "lungo",
    hairColor: "cioccolato",
    eyes: "grandi",
    eyeColor: "nocciola",
    mouth: "sorrisetto",
    beard: "nessuna",
    glasses: "nessuno",
    build: "magra",
  },
  {
    label: "chignon occhiali",
    skin: "f2",
    hair: "chignon",
    hairColor: "castano",
    eyes: "sorridenti",
    eyeColor: "verde",
    mouth: "risata",
    beard: "nessuna",
    glasses: "tondi",
    build: "normale",
  },
  {
    label: "spettinato",
    skin: "f3",
    hair: "spettinato",
    hairColor: "rame",
    eyes: "normali",
    eyeColor: "grigio",
    mouth: "neutra",
    beard: "pizzetto",
    glasses: "nessuno",
    build: "normale",
  },
  {
    label: "rasato sole",
    skin: "f6",
    hair: "rasato",
    hairColor: "nero",
    eyes: "normali",
    eyeColor: "marrone",
    mouth: "sorriso",
    beard: "baffi",
    glasses: "sole",
    build: "robusta",
  },
];
const shirts = [
  "#0ea5e9",
  "#f59e0b",
  "#10b981",
  "#8b5cf6",
  "#e11d48",
  "#0ea5e9",
  "#64748b",
  "#16a34a",
];

const cells = faces
  .map(
    (face, index) => `
    <figure>
      <span class="ring" style="--c:${shirts[index]}">${avatarSvg(face, { shirt: shirts[index] })}</span>
      <figcaption>${face.label}</figcaption>
    </figure>`,
  )
  .join("");

const html = `<!doctype html><meta charset="utf-8"><style>
  body{margin:0;padding:28px;background:#eef2f7;font-family:system-ui}
  .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:26px;width:960px}
  figure{margin:0;display:flex;flex-direction:column;align-items:center;gap:8px}
  .ring{display:grid;place-items:center;width:190px;height:190px;border-radius:50%;
    background:radial-gradient(circle at 32% 26%,color-mix(in srgb,var(--c) 12%,#fff),color-mix(in srgb,var(--c) 34%,#fff));
    box-shadow:0 16px 34px -16px color-mix(in srgb,var(--c) 55%,transparent);overflow:hidden}
  .ring svg{width:100%;height:100%}
  figcaption{font-size:12px;font-weight:700;color:#475569}
</style><div class="grid">${cells}</div>`;

writeFileSync(`${scratch}/preview.html`, html);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1030, height: 1180 } });
await page.goto(`file://${scratch}/preview.html`);
await page.screenshot({ path: `${scratch}/preview.png`, fullPage: true });
await browser.close();
console.log(`${scratch}/preview.png`);

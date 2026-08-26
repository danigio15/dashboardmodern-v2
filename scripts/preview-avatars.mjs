/* Anteprima dell'avatar: griglia di varianti renderizzata e fotografata,
 * per guardare il disegno mentre lo si lavora. Solo sviluppo locale. */
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { avatarSvg } from "../custom_components/dashboardmodern/frontend/src/core/person-avatar.js";

const scratch = process.argv[2] || "/tmp/avatar-preview";
const faces = [
  { label: "giacca", skin: "f2", hair: "pettinato", hairColor: "moro", eyes: "normali", eyeColor: "marrone", mouth: "sorriso", beard: "piena", glasses: "nessuno", build: "normale", outfit: "giacca" },
  { label: "riccia", skin: "f3", hair: "riccio", hairColor: "moro", eyes: "grandi", eyeColor: "verde", mouth: "risata", beard: "nessuna", glasses: "nessuno", build: "normale", outfit: "maglietta" },
  { label: "coda", skin: "f1", hair: "coda", hairColor: "rame", eyes: "grandi", eyeColor: "azzurro", mouth: "sorriso", beard: "nessuna", glasses: "nessuno", build: "magra", outfit: "polo" },
  { label: "afro", skin: "f5", hair: "afro", hairColor: "nero", eyes: "grandi", eyeColor: "marrone", mouth: "sorriso", beard: "incolta", glasses: "nessuno", build: "normale", outfit: "maglione" },
  { label: "calvo squadrati", skin: "f4", hair: "calvo", hairColor: "nero", eyes: "normali", eyeColor: "nocciola", mouth: "sorrisetto", beard: "pizzetto", glasses: "squadrati", build: "robusta", outfit: "gilet" },
  { label: "lunghi", skin: "f2", hair: "lungo", hairColor: "biondo", eyes: "grandi", eyeColor: "ghiaccio", mouth: "sorriso", beard: "nessuna", glasses: "nessuno", build: "magra", outfit: "camicia" },
  { label: "chignon", skin: "f3", hair: "chignon", hairColor: "castano", eyes: "sorridenti", eyeColor: "ambra", mouth: "risata", beard: "nessuna", glasses: "tondi", build: "normale", outfit: "felpa" },
  { label: "blu", skin: "f1", hair: "spettinato", hairColor: "blu", eyes: "grandi", eyeColor: "verde", mouth: "sorriso", beard: "nessuna", glasses: "sole", build: "normale", outfit: "maglietta" },
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

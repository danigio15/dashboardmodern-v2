import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
await page.goto("http://127.0.0.1:4174/legacy/dashboard.html");
const esito = await page.evaluate(async () => {
  const r = await fetch("/legacy/dashboard-runtime-it.js", { cache: "reload" });
  const testo = await r.text();
  return {
    contentEncoding: r.headers.get("content-encoding"),
    contentLength: r.headers.get("content-length"),
    tutteLeIntestazioni: [...r.headers.keys()],
    corpoDisteso: testo.length,
  };
});
console.log(JSON.stringify(esito, null, 1));
await browser.close();

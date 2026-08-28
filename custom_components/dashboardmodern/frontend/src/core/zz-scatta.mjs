import { chromium } from "playwright";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1000, height: 1400 }, deviceScaleFactor: 2 });
await page.goto("file://" + process.argv[2]);
await page.waitForTimeout(400);
await page.screenshot({ path: process.argv[3], fullPage: true });
await browser.close();

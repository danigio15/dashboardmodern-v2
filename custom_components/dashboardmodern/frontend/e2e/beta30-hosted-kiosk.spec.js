// DM-FIX-20260817A
/*
 * The plancia never runs alone on a phone: Home Assistant hosts it in a frame
 * inside a panel or a Lovelace card, under its own toolbar. This spec rebuilds
 * that topology - toolbar, shadow host, srcdoc frame - because the kiosk bug it
 * guards is invisible when dashboard.html is opened directly.
 */
import { expect, test } from "@playwright/test";

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";
const HOST_URL = "http://127.0.0.1:4173/dm-kiosk-host.html";
const HEADER_HEIGHT = 56;

const HOST_PAGE = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;background:#eef2f7}
  .header{position:sticky;top:0;height:${HEADER_HEIGHT}px;z-index:4;background:#1976d2;color:#fff}
  .view{padding:4px}
</style></head><body>
<div class="header" id="ha-header">Home Assistant</div>
<div class="view"><dm-host id="panel"></dm-host></div>
<script type="module">
class DmHost extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent =
      ":host{display:block;width:100%;height:calc(100dvh - ${HEADER_HEIGHT}px);overflow:hidden}" +
      "iframe{width:100%;height:100%;border:0;display:block}";
    this.frame = document.createElement("iframe");
    shadow.append(style, this.frame);
  }
}
customElements.define("dm-host", DmHost);
const panel = document.getElementById("panel");
const html = await (await fetch("/legacy/dashboard.html")).text();
panel.frame.srcdoc = html.replace(/<head(?:\\s[^>]*)?>/i, (head) => head + '<base href="/legacy/">');
window.__DM_HOST_READY__ = true;
</script></body></html>`;

const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36";

async function bootHostedPlancia(page, { search = "", userAgent = IPHONE_UA } = {}) {
  await page.addInitScript((userAgent) => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      get: () => userAgent,
    });
    class MockBridgeSocket extends EventTarget {
      static OPEN = 1;
      readyState = 1;
      constructor() {
        super();
        setTimeout(() => this.dispatchEvent(new Event("open")), 0);
      }
      send() {}
      close() {}
    }
    window.WebSocket = MockBridgeSocket;
    try {
      localStorage.clear();
    } catch (_error) {}
  }, userAgent);
  await page.route(`${HOST_URL}*`, (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: HOST_PAGE }),
  );
  await page.goto(`/dm-kiosk-host.html${search}`);
  await page.waitForFunction(() => window.__DM_HOST_READY__ === true);
  await page.frameLocator("iframe").locator("body").waitFor();
}

function hostGeometry(page) {
  return page.evaluate(() => {
    const panel = document.getElementById("panel");
    const box = panel.getBoundingClientRect();
    const painted = document.elementFromPoint(10, 10);
    return {
      top: Math.round(box.top),
      left: Math.round(box.left),
      height: Math.round(box.height),
      width: Math.round(box.width),
      position: getComputedStyle(panel).position,
      paintedOnTop: painted?.id || "",
      innerHeight: window.innerHeight,
      innerWidth: window.innerWidth,
      documentOverflow: getComputedStyle(document.documentElement).overflow,
    };
  });
}

test("a hosted iPhone plancia goes full screen with no query string at all", async ({
  page,
}, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  await bootHostedPlancia(page);

  const narrow = await page.evaluate(() => window.matchMedia("(max-width: 870px)").matches);
  const html = page.frameLocator("iframe").locator("html");
  if (!narrow) {
    // A desktop width keeps the native chrome: the kiosk is a phone contract.
    await expect(html).not.toHaveAttribute("data-dm-ios-kiosk", "true");
    expect((await hostGeometry(page)).position).not.toBe("fixed");
    return;
  }

  await expect(html).toHaveAttribute("data-dm-ios-kiosk", "true");
  const geometry = await hostGeometry(page);
  expect(geometry).toMatchObject({ top: 0, left: 0, position: "fixed" });
  expect(geometry.height).toBe(geometry.innerHeight);
  expect(geometry.width).toBe(geometry.innerWidth);
  // The toolbar sits at 0,0 in the flow: whatever paints there is the plancia.
  expect(geometry.paintedOnTop).toBe("panel");
  expect(geometry.documentOverflow).toBe("hidden");
});

test("an explicit opt-out restores the hosting page it borrowed", async ({ page }, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  await bootHostedPlancia(page, { search: "?kiosk=1" });

  const html = page.frameLocator("iframe").locator("html");
  await expect(html).toHaveAttribute("data-dm-ios-kiosk", "true");
  expect((await hostGeometry(page)).position).toBe("fixed");

  await page.evaluate(() => {
    const url = new URL(location.href);
    url.searchParams.set("kiosk", "0");
    history.replaceState({}, "", url);
  });
  await page
    .frameLocator("iframe")
    .locator("html")
    .evaluate(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

  await expect(html).not.toHaveAttribute("data-dm-ios-kiosk", "true");
  const geometry = await hostGeometry(page);
  expect(geometry.position).not.toBe("fixed");
  expect(geometry.documentOverflow).not.toBe("hidden");
  expect(geometry.top).toBeGreaterThan(0);
});

test("a long press on the plancia hamburger toggles the kiosk both ways", async ({
  page,
}, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  await bootHostedPlancia(page, { search: "?kiosk=0" });

  const html = page.frameLocator("iframe").locator("html");
  const hamburger = page.frameLocator("iframe").locator(".ha-menu-btn");
  await expect(hamburger).toBeVisible();
  await expect(html).not.toHaveAttribute("data-dm-ios-kiosk", "true");

  const longPress = async () => {
    await hamburger.dispatchEvent("mousedown");
    await page.waitForTimeout(900);
    await hamburger.dispatchEvent("mouseup");
  };

  // The gesture wins over the ?kiosk=0 still sitting on the hosting URL.
  await longPress();
  await expect(html).toHaveAttribute("data-dm-ios-kiosk", "true");
  expect((await hostGeometry(page)).position).toBe("fixed");

  await longPress();
  await expect(html).not.toHaveAttribute("data-dm-ios-kiosk", "true");
  expect((await hostGeometry(page)).position).not.toBe("fixed");
});

/* Il chiosco era nato guardando l'iPhone e chiedeva iOS per accendersi da solo.
 * Dentro l'app di Home Assistant per Android il problema e' lo stesso — nessuna
 * barra degli indirizzi dove scrivere ?kiosk=1 — ma non partiva mai, e la
 * plancia restava sotto la barra di Lovelace finche' non si scopriva il dito
 * tenuto premuto sull'hamburger. */
test("anche un telefono Android che ospita la plancia va a tutto schermo da solo", async ({
  page,
}, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  await bootHostedPlancia(page, { userAgent: ANDROID_UA });

  const narrow = await page.evaluate(() => window.matchMedia("(max-width: 870px)").matches);
  const html = page.frameLocator("iframe").locator("html");
  if (!narrow) {
    // Uno schermo largo tiene la sua barra: il chiosco e' un patto da telefono.
    await expect(html).not.toHaveAttribute("data-dm-ios-kiosk", "true");
    return;
  }

  // Se il dito non arrivasse fin qui la prova direbbe il falso, non il vero.
  expect(await page.evaluate(() => Number(navigator.maxTouchPoints || 0))).toBeGreaterThan(0);
  expect(await page.evaluate(() => /iPhone|iPad|iPod/i.test(navigator.userAgent))).toBe(false);

  await expect(html).toHaveAttribute("data-dm-ios-kiosk", "true");
  const geometry = await hostGeometry(page);
  expect(geometry).toMatchObject({ top: 0, left: 0, position: "fixed" });
  expect(geometry.height).toBe(geometry.innerHeight);
  expect(geometry.paintedOnTop).toBe("panel");
});

test("e su Android chi lo spegne resta spento", async ({ page }, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  await bootHostedPlancia(page, { search: "?kiosk=0", userAgent: ANDROID_UA });

  const html = page.frameLocator("iframe").locator("html");
  await expect(html).not.toHaveAttribute("data-dm-ios-kiosk", "true");
  expect((await hostGeometry(page)).position).not.toBe("fixed");
});

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "custom_components/dashboardmodern/frontend"


def read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def write(relative: str, content: str) -> None:
    (ROOT / relative).write_text(content, encoding="utf-8")


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return source.replace(old, new, 1)


def regex_once(source: str, pattern: str, replacement: str, label: str, flags: int = re.S) -> str:
    updated, count = re.subn(pattern, replacement, source, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one regex match, found {count}")
    return updated


# 1. The icon engine is imported before every historical compatibility owner.
path = "custom_components/dashboardmodern/frontend/src/sections/beta-entry-section.js"
source = read(path)
source = replace_once(
    source,
    'import "./config-persistence-section.js";\nimport "./beta-compat-section.js";',
    'import "./config-persistence-section.js";\nimport "./icon-engine-section.js";\nimport "./beta-compat-section.js";',
    "beta-entry icon-engine import",
)
source = regex_once(
    source,
    r'\n    document\.addEventListener\(\n      "click",\n      \(event\) => \{\n        const trigger = event\.target\?\.closest\?\.\("\.dm-beta5-room-icon-trigger"\);.*?\n      true,\n    \);\n\n    // The canonical period renderer',
    '\n    // Room/action picker activation is owned by icon-engine-section at window capture.\n\n    // The canonical period renderer',
    "remove beta-entry room picker bridge",
)
start = source.find("    // v0.15.25 Quick Actions used readable colour emoji/glyphs.")
end = source.find("    // The legacy Temperature edit handler creates a correctly populated room", start)
if start < 0 or end < 0 or end <= start:
    raise SystemExit("beta-entry delayed quick-action repair block not found")
source = (
    source[:start]
    + "    // Quick Action icon rendering is now owned synchronously by icon-engine-section.\n"
    + "    // No delayed 0/90/320/900 ms repaint is permitted in the public runtime.\n\n"
    + source[end:]
)
write(path, source)


# 2. Canonical room/action visuals are final colour glyphs, never blue SVG first frames.
path = "custom_components/dashboardmodern/frontend/src/core/personalization-catalog.js"
source = read(path)
source = regex_once(
    source,
    r'export function roomVisual\(value, size = 48\) \{.*?\n\}',
    '''export function roomVisual(value, size = 48) {
  const item = roomCatalogMatch(value);
  if (!item) return "";
  const safeSize = Math.max(16, Math.min(160, Number(size) || 48));
  const glyph = ROOM_GLYPHS[item.id] || roomGlyph(item.mdi);
  return `<span class="dm-room-art dm-room-glyph" data-visual="${item.id}" style="font-size:${safeSize}px"><span aria-hidden="true">${glyph}</span></span>`;
}''',
    "canonical roomVisual",
)
source = regex_once(
    source,
    r'export function actionVisual\(value, size = 48\) \{.*?\n\}',
    '''export function actionVisual(value, size = 48) {
  const item = actionCatalogMatch(value);
  if (!item) return "";
  const safeSize = Math.max(16, Math.min(160, Number(size) || 48));
  return `<span class="dm-action-glyph" data-visual="${item.id}" style="font-size:${safeSize}px"><span aria-hidden="true">${item.glyph || "⭐"}</span></span>`;
}''',
    "canonical actionVisual",
)
write(path, source)


# 3. Personalization no longer creates a competing visual picker or autofocuses touch keyboards.
path = "custom_components/dashboardmodern/frontend/src/sections/personalization-section.js"
source = read(path)
source = regex_once(
    source,
    r'function openVisualPicker\(input, kind = "room"\) \{.*?\n\}\n\nfunction decorateRoomModal',
    '''function openVisualPicker(input, kind = "room") {
  return Boolean(
    root.DashboardModernIconEngine?.openPicker?.(input, kind, { autofocus: false }),
  );
}

function decorateRoomModal''',
    "personalization picker delegation",
)
write(path, source)


# 4. Historical canonical-room picker becomes a pure compatibility delegate.
path = "custom_components/dashboardmodern/frontend/src/sections/beta-compat-section.js"
source = read(path)
source = regex_once(
    source,
    r'function openCanonicalRoomPicker\(input\) \{.*?\n\}\n\nfunction activeVehicleSignature',
    '''function openCanonicalRoomPicker(input) {
  return Boolean(
    root.DashboardModernIconEngine?.openPicker?.(input, "room", { autofocus: false }),
  );
}

function activeVehicleSignature''',
    "beta-compat picker delegation",
)
write(path, source)


# 5. Beta6 keeps its light-control responsibilities but delegates all action icon work.
path = "custom_components/dashboardmodern/frontend/src/sections/beta6-feedback-section.js"
source = read(path)
source = regex_once(
    source,
    r'function qaMarkup\(value, type, size = 32\) \{.*?\n\}',
    '''function qaMarkup(value, type, size = 32) {
  const mdi = qaMdi(value, type);
  const canonical = root.DashboardModernIconEngine?.markup?.("action", mdi, { size });
  if (clean(canonical)) return canonical;
  return actionVisual(mdi, size) || esc(qaPortable(value, type));
}''',
    "beta6 qaMarkup delegation",
)
source = regex_once(
    source,
    r'function closeQaPicker\(\) \{.*?\nfunction polishQaEditor',
    '''function closeQaPicker() {
  root.DashboardModernIconEngine?.closePicker?.();
}
function openQaPicker(input) {
  return Boolean(
    root.DashboardModernIconEngine?.openPicker?.(input, "action", { autofocus: false }),
  );
}

function polishQaEditor''',
    "beta6 picker delegation",
)
source = regex_once(
    source,
    r'function polishQaCards\(\) \{.*?\n\}\nfunction installQaRenderer\(\) \{.*?\n\}',
    '''function polishQaCards() {
  return Boolean(root.DashboardModernIconEngine?.syncQuickActions?.());
}
function installQaRenderer() {
  polishQaCards();
  return true;
}''',
    "beta6 renderer delegation",
)
write(path, source)


# 6. Beta9 can keep EV/layout reconciliation but cannot rewrite icon DOM.
path = "custom_components/dashboardmodern/frontend/src/sections/beta9-real-device-polish-section.js"
source = read(path)
source = regex_once(
    source,
    r'function polishQuickActions\(\) \{.*?\n\}\n\nfunction polishActionPicker',
    '''function polishQuickActions() {
  return Boolean(root.DashboardModernIconEngine?.syncQuickActions?.());
}

function polishActionPicker''',
    "beta9 quick-action delegation",
)
source = regex_once(
    source,
    r'function polishActionPicker\(\) \{.*?\n\}\n\nfunction modelBelongsToBrand',
    '''function polishActionPicker() {
  const picker = doc?.querySelector?.('#dm-visual-picker[data-kind="action"][data-dm-icon-engine="single-owner"]');
  return Boolean(picker);
}

function modelBelongsToBrand''',
    "beta9 picker no-op",
)
write(path, source)


# 7. Beta12 real-device owner delegates all icon surfaces to the engine.
path = "custom_components/dashboardmodern/frontend/src/sections/beta12-real-device-polish-section.js"
source = read(path)
for name, replacement in {
    "repairQuickActionHome": '''function repairQuickActionHome() {
  return Boolean(root.DashboardModernIconEngine?.syncQuickActions?.());
}''',
    "repairQuickActionRows": '''function repairQuickActionRows() {
  return Boolean(root.DashboardModernIconEngine?.syncEditor?.());
}''',
    "repairRoomRows": '''function repairRoomRows() {
  return Boolean(root.DashboardModernIconEngine?.syncEditor?.());
}''',
    "repairRoomCards": '''function repairRoomCards() {
  return Boolean(root.DashboardModernIconEngine?.syncEditor?.());
}''',
    "decorateVisualPicker": '''function decorateVisualPicker() {
  return Boolean(doc?.querySelector?.('#dm-visual-picker[data-dm-icon-engine="single-owner"]'));
}''',
    "repairModalPreviews": '''function repairModalPreviews() {
  return Boolean(root.DashboardModernIconEngine?.syncEditor?.());
}''',
}.items():
    source = regex_once(
        source,
        rf'function {name}\([^)]*\) \{{.*?\n\}}',
        replacement,
        f"beta12 real {name}",
    )
# Remove the now-unused bindPreview helper after replacing repairModalPreviews.
source = regex_once(
    source,
    r'\nfunction bindPreview\(input, preview, kind\) \{.*?\n\}\n',
    '\n',
    "remove beta12 bindPreview",
)
write(path, source)


# 8. Beta12 room-color-lock becomes only the iOS kiosk compatibility owner.
path = "custom_components/dashboardmodern/frontend/src/sections/beta12-room-color-lock-section.js"
source = '''// DM-FIX-20260813C
import { clean, doc, installStyle, root } from "./shared.js";

// Beta18: all room/action icons are owned by icon-engine-section. This historical
// module keeps only the iOS kiosk contract; it must never observe or repaint icon DOM.
const KEY = "__DASHBOARDMODERN_BETA12_FINAL_LOCK__";
const KIOSK_ATTR = "data-dm-ios-kiosk";
const state = (root[KEY] ||= {
  listeners: false,
  kioskHost: null,
  kioskHostCss: "",
  kioskFrame: null,
  kioskFrameCss: "",
  kioskViewportBound: false,
});

function isIosDevice() {
  const nav = root.navigator;
  const ua = clean(nav?.userAgent);
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  return clean(nav?.platform) === "MacIntel" && Number(nav?.maxTouchPoints || 0) > 1;
}

function kioskValueFromLocation(locationLike) {
  if (!locationLike) return null;
  try {
    const params = new URLSearchParams(locationLike.search || "");
    for (const key of ["kiosk", "dm_kiosk"]) {
      if (!params.has(key)) continue;
      const value = clean(params.get(key)).toLowerCase();
      return !["0", "false", "off", "no"].includes(value);
    }
    const hash = clean(locationLike.hash).replace(/^#/, "");
    if (hash.includes("=")) {
      const hashParams = new URLSearchParams(hash.includes("?") ? hash.split("?").pop() : hash);
      for (const key of ["kiosk", "dm_kiosk"]) {
        if (!hashParams.has(key)) continue;
        const value = clean(hashParams.get(key)).toLowerCase();
        return !["0", "false", "off", "no"].includes(value);
      }
    }
  } catch (_error) {}
  return null;
}

function kioskRequested() {
  for (const candidate of [root.parent, root]) {
    try {
      const value = kioskValueFromLocation(candidate?.location);
      if (value !== null) return value;
    } catch (_error) {}
  }
  return false;
}

function hostForFrame() {
  try {
    const frame = root.frameElement;
    const tree = frame?.getRootNode?.();
    const host = tree?.host;
    return { frame: frame || null, host: host || null };
  } catch (_error) {
    return { frame: null, host: null };
  }
}

function updateKioskViewport() {
  const viewport = root.visualViewport;
  const height = Math.max(1, Math.round(viewport?.height || root.innerHeight || 0));
  const width = Math.max(1, Math.round(viewport?.width || root.innerWidth || 0));
  doc?.documentElement?.style?.setProperty?.("--dm-ios-kiosk-height", `${height}px`);
  doc?.documentElement?.style?.setProperty?.("--dm-ios-kiosk-width", `${width}px`);
}

function activateIosKiosk() {
  if (!doc || !isIosDevice() || !kioskRequested()) return false;
  doc.documentElement?.setAttribute?.(KIOSK_ATTR, "true");
  doc.body?.setAttribute?.(KIOSK_ATTR, "true");
  updateKioskViewport();
  if (!state.kioskViewportBound) {
    state.kioskViewportBound = true;
    root.visualViewport?.addEventListener?.("resize", updateKioskViewport, { passive: true });
    root.visualViewport?.addEventListener?.("scroll", updateKioskViewport, { passive: true });
    root.addEventListener?.("resize", updateKioskViewport, { passive: true });
    root.addEventListener?.("orientationchange", updateKioskViewport, { passive: true });
  }
  const { frame, host } = hostForFrame();
  if (host && state.kioskHost !== host) {
    if (state.kioskHost) state.kioskHost.style.cssText = state.kioskHostCss;
    state.kioskHost = host;
    state.kioskHostCss = host.style.cssText || "";
  }
  if (frame && state.kioskFrame !== frame) {
    if (state.kioskFrame) state.kioskFrame.style.cssText = state.kioskFrameCss;
    state.kioskFrame = frame;
    state.kioskFrameCss = frame.style.cssText || "";
  }
  if (host) {
    host.dataset.dmIosKiosk = "true";
    host.style.setProperty("position", "fixed", "important");
    host.style.setProperty("inset", "0", "important");
    host.style.setProperty("z-index", "2147483000", "important");
    host.style.setProperty("width", "100vw", "important");
    host.style.setProperty("height", "100dvh", "important");
    host.style.setProperty("min-height", "100dvh", "important");
    host.style.setProperty("margin", "0", "important");
    host.style.setProperty("padding", "0", "important");
    host.style.setProperty("background", "var(--primary-background-color,#f8fafc)", "important");
    host.style.setProperty("overflow", "hidden", "important");
  }
  if (frame) {
    frame.dataset.dmIosKiosk = "true";
    frame.style.setProperty("width", "100%", "important");
    frame.style.setProperty("height", "100%", "important");
    frame.style.setProperty("min-height", "100%", "important");
  }
  return true;
}

function deactivateIosKiosk() {
  doc?.documentElement?.removeAttribute?.(KIOSK_ATTR);
  doc?.body?.removeAttribute?.(KIOSK_ATTR);
  if (state.kioskHost) {
    state.kioskHost.style.cssText = state.kioskHostCss;
    delete state.kioskHost.dataset.dmIosKiosk;
    state.kioskHost = null;
    state.kioskHostCss = "";
  }
  if (state.kioskFrame) {
    state.kioskFrame.style.cssText = state.kioskFrameCss;
    delete state.kioskFrame.dataset.dmIosKiosk;
    state.kioskFrame = null;
    state.kioskFrameCss = "";
  }
}

function syncIosKiosk() {
  if (isIosDevice() && kioskRequested()) activateIosKiosk();
  else deactivateIosKiosk();
}

if (!state.listeners) {
  state.listeners = true;
  root.addEventListener?.("popstate", syncIosKiosk);
  root.addEventListener?.("hashchange", syncIosKiosk);
  root.addEventListener?.("pageshow", syncIosKiosk);
}
for (const eventName of [
  "dashboardmodern:legacy-ready",
  "dashboardmodern:runtime-ready",
  "dashboardmodern:states-ready",
]) root.addEventListener?.(eventName, syncIosKiosk);

installStyle("dm-beta12-room-color-lock-style", `
  html[data-dm-ios-kiosk="true"],html[data-dm-ios-kiosk="true"] body{
    width:100%!important;min-width:0!important;height:var(--dm-ios-kiosk-height,100dvh)!important;
    min-height:var(--dm-ios-kiosk-height,100dvh)!important;max-height:none!important;margin:0!important;
    overflow-x:hidden!important;overscroll-behavior:none!important;background:var(--primary-background-color,#f8fafc)!important
  }
  html[data-dm-ios-kiosk="true"] body{
    box-sizing:border-box!important;padding-top:max(env(safe-area-inset-top),0px)!important;
    padding-left:max(env(safe-area-inset-left),0px)!important;padding-right:max(env(safe-area-inset-right),0px)!important;
    -webkit-overflow-scrolling:touch!important
  }
  html[data-dm-ios-kiosk="true"] #bottomNav{padding-bottom:max(env(safe-area-inset-bottom),0px)!important}
`);

syncIosKiosk();
'''
write(path, source)


# 9. Beta17 keeps only its Temperature placeholder guard and compatibility exports.
path = "custom_components/dashboardmodern/frontend/src/sections/beta17-final-icon-polish-section.js"
source = '''// DM-FIX-20260813C
import {
  ROOM_CATALOG,
  ROOM_GLYPHS,
  actionCatalogMatch,
  directEmoji,
  roomGlyph,
} from "../core/personalization-catalog.js";
import { clean, doc, root } from "./shared.js";

const KEY = "__DASHBOARDMODERN_BETA17_FINAL_ICON_POLISH__";
const state = (root[KEY] ||= {
  installed: false,
  temperaturePage: null,
  temperatureObserver: null,
});

// Kept as public compatibility exports for diagnostics/tests. Picker ownership
// moved to icon-engine-section in Beta18.
export const ROOM_ICON_CHOICES = Object.freeze(
  ROOM_CATALOG.map((item) =>
    Object.freeze([ROOM_GLYPHS[item.id] || roomGlyph(item.mdi), item.keywords, item.mdi]),
  ),
);

export function isTemperatureProgressText(value) {
  const text = clean(value).replaceAll("…", "...").toLowerCase();
  return /^(?:aggiornamento in corso|update in progress|updating)(?:\\s*\\.*)?$/.test(text);
}

export function actionPickerGlyph(value) {
  const token = clean(value);
  return directEmoji(token) || actionCatalogMatch(token)?.glyph || "⭐";
}

function hideTemperatureProgressCopy() {
  const page = doc?.getElementById("page-temp");
  if (!page) return false;
  let hidden = false;
  page.querySelectorAll("div,span,p,small").forEach((node) => {
    if (!isTemperatureProgressText(node.textContent)) {
      if (node.dataset.dmBeta17TemperatureProgressHidden === "true") {
        delete node.dataset.dmBeta17TemperatureProgressHidden;
        node.hidden = false;
        node.removeAttribute("aria-hidden");
        node.style.removeProperty("display");
      }
      return;
    }
    node.dataset.dmBeta17TemperatureProgressHidden = "true";
    node.hidden = true;
    node.setAttribute("aria-hidden", "true");
    node.style.setProperty("display", "none", "important");
    hidden = true;
  });
  return hidden;
}

function bindTemperatureProgressGuard() {
  const page = doc?.getElementById("page-temp");
  if (!page) return false;
  hideTemperatureProgressCopy();
  if (state.temperaturePage === page && state.temperatureObserver) return true;
  state.temperatureObserver?.disconnect?.();
  state.temperaturePage = page;
  if (typeof root.MutationObserver === "function") {
    state.temperatureObserver = new root.MutationObserver(hideTemperatureProgressCopy);
    state.temperatureObserver.observe(page, {
      subtree: true,
      childList: true,
      characterData: true,
    });
  }
  return true;
}

function install() {
  if (!doc || state.installed) return;
  state.installed = true;
  for (const eventName of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:persistence-restored",
  ]) root.addEventListener?.(eventName, bindTemperatureProgressGuard);
  root.addEventListener?.("dashboardmodern:state-changed", hideTemperatureProgressCopy);
  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", bindTemperatureProgressGuard, { once: true });
  } else {
    bindTemperatureProgressGuard();
  }
}

install();
'''
write(path, source)


# 10. Unified editor markup is born in the final canonical representation.
path = "custom_components/dashboardmodern/frontend/src/sections/unified-editors-section.js"
source = read(path)
source = regex_once(
    source,
    r'function iconMarkup\(value, fallback = "🔘", size = 34\) \{.*?\n\}',
    '''function iconMarkup(value, fallback = "🔘", size = 34) {
  const icon = clean(value) || fallback;
  const kind = fallback === "🏠" ? "room" : "action";
  try {
    const markup = root.DashboardModernIconEngine?.markup?.(kind, icon, { size });
    if (markup) return markup;
  } catch (_error) {}
  if (!icon.startsWith("mdi:")) return esc(icon);
  try {
    const legacy = root.cdIconMarkup?.(icon, size);
    if (legacy) return legacy;
  } catch (_error) {}
  return esc(fallback);
}''',
    "unified editor iconMarkup",
)
write(path, source)


# 11. Architecture budget accounts for exactly one new production owner.
path = "custom_components/dashboardmodern/frontend/tests/runtime-import-graph.test.js"
source = read(path)
source = replace_once(
    source,
    "  assert.ok(relative.length <= 71, `production graph unexpectedly grew to ${relative.length} modules`);",
    "  assert.ok(relative.length <= 72, `production graph unexpectedly grew to ${relative.length} modules`);",
    "runtime graph module budget",
)
source = source.replace(
    "  // Beta17 adds exactly one scoped owner for first-paint icon stability and the\n  // Temperature progress-copy guard; all legacy facade/cycle/orphan checks stay\n  // unchanged and still run below.\n",
    "  // Beta17 keeps the scoped Temperature progress-copy guard. Beta18 adds one\n  // canonical icon-engine owner while historical beta modules delegate instead\n  // of repainting the same icon DOM. All facade/cycle/orphan checks stay active.\n",
)
write(path, source)


# 12. Beta17 unit test now proves ownership moved out of the patch layer.
path = "custom_components/dashboardmodern/frontend/tests/beta17-final-icon-polish.test.js"
source = read(path)
source = regex_once(
    source,
    r'test\("beta17 loads before beta-entry and owns both insert/edit picker activation paths", async \(\) => \{.*?\n\}\);',
    '''test("beta18 moves picker ownership to the canonical icon engine", async () => {
  const generator = await readFile(
    new URL("../../../../scripts/generate_build_info.py", import.meta.url),
    "utf8",
  );
  const betaEntry = await readFile(new URL("../src/sections/beta-entry-section.js", import.meta.url), "utf8");
  const beta17 = await readFile(
    new URL("../src/sections/beta17-final-icon-polish-section.js", import.meta.url),
    "utf8",
  );
  const engine = await readFile(new URL("../src/sections/icon-engine-section.js", import.meta.url), "utf8");
  assert.ok(generator.includes("beta17-final-icon-polish-section.js"));
  assert.match(betaEntry, /icon-engine-section\\.js/);
  assert.match(engine, /modal\\.id = "dm-visual-picker"/);
  assert.match(engine, /\\.dm-beta5-room-icon-trigger/);
  assert.match(engine, /\\.dm-beta6-qa-icon-trigger/);
  assert.match(engine, /data-dm-icon-engine/);
  assert.doesNotMatch(beta17, /openStableRoomPicker|openStableActionPicker|queuePreviewRepair/);
  assert.doesNotMatch(beta17, /dm-visual-picker/);
});''',
    "beta17 ownership test",
)
write(path, source)


# 13. New static guard: only one picker creator and no delayed icon repaint loop.
write(
    "custom_components/dashboardmodern/frontend/tests/icon-engine-single-owner.test.js",
    '''// DM-FIX-20260813C
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { actionVisual, roomVisual } from "../src/core/personalization-catalog.js";

const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sections = path.join(frontend, "src", "sections");

async function sectionSources() {
  const files = (await readdir(sections)).filter((name) => name.endsWith(".js"));
  return Promise.all(
    files.map(async (name) => ({ name, source: await readFile(path.join(sections, name), "utf8") })),
  );
}

test("canonical room/action visuals never create blue SVG first frames", () => {
  assert.match(roomVisual("mdi:bed-king-outline", 40), /🛏️/);
  assert.match(actionVisual("mdi:lightbulb", 40), /💡/);
  assert.doesNotMatch(roomVisual("mdi:bed-king-outline", 40), /<svg|ha-icon/);
  assert.doesNotMatch(actionVisual("mdi:lightbulb", 40), /<svg|ha-icon/);
});

test("only icon-engine creates the shared visual picker", async () => {
  const sources = await sectionSources();
  const creators = sources
    .filter(({ source }) => /modal\\.id\\s*=\\s*["']dm-visual-picker["']/.test(source))
    .map(({ name }) => name);
  assert.deepEqual(creators, ["icon-engine-section.js"]);
});

test("legacy icon owners delegate and no delayed public repaint loop remains", async () => {
  const betaEntry = await readFile(path.join(sections, "beta-entry-section.js"), "utf8");
  const beta12Lock = await readFile(path.join(sections, "beta12-room-color-lock-section.js"), "utf8");
  const beta17 = await readFile(path.join(sections, "beta17-final-icon-polish-section.js"), "utf8");
  const engine = await readFile(path.join(sections, "icon-engine-section.js"), "utf8");
  assert.doesNotMatch(betaEntry, /scheduleV01525QuickActionRepair|\[0, 90, 320, 900\]/);
  assert.doesNotMatch(beta12Lock, /MutationObserver|repairVisualPicker|repairQuickActionNode/);
  assert.doesNotMatch(beta17, /openStableRoomPicker|openStableActionPicker|queuePreviewRepair/);
  assert.match(engine, /window capture|Window capture/i);
  assert.match(engine, /pointer:fine/);
  assert.doesNotMatch(engine, /setTimeout\\?\\.\\([^)]*focus|setTimeout\\([^)]*focus/);
});
''',
)


# 14. Real-device regression holds the picker open beyond every former delayed repaint.
write(
    "custom_components/dashboardmodern/frontend/e2e/beta18-icon-engine-stability.spec.js",
    '''// DM-FIX-20260813C
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const seed = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "room_cameretta", name: "Cameretta", icon: "mdi:bed-king-outline" }],
    cameras: [], appliances: [], loads: [], lights: [], climate: [], ev: [], covers: [],
    pool: {}, irrigation: { zones: [] }, energy: {}, entityOverrides: {},
  },
  visibility: { home: true, temp: true, temperature: true },
};

async function boot(page, testInfo) {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript(() => {
    class MockBridgeSocket extends EventTarget {
      static OPEN = 1;
      readyState = 1;
      constructor() {
        super();
        queueMicrotask(() => {
          this.onopen?.({});
          this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
        });
      }
      send(raw) {
        const message = JSON.parse(raw);
        if (message.type === "auth") return;
        queueMicrotask(() => this.onmessage?.({
          data: JSON.stringify({ id: message.id, type: "result", success: true, result: message.type === "get_states" ? [] : null }),
        }));
      }
      close() {}
    }
    window.__DASHBOARDMODERN_HOSTED__ = true;
    window.__DASHBOARDMODERN_BRIDGE_WS__ = MockBridgeSocket;
    window.WebSocket = MockBridgeSocket;
    window.matchMedia = (query) => ({
      matches: !query.includes("pointer:fine"),
      media: query,
      addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return true; },
    });
  });
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
  await page.locator("#setup-wizard").evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
  await expect.poll(() => page.evaluate(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true)).toBe(true);
}

async function openEditor(page, tab) {
  await page.evaluate((target) => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
    editorSwitch(target);
  }, tab);
  await expect(page.locator("#editor-modal")).toBeVisible();
}

async function assertStablePicker(page, kind, glyph) {
  const picker = page.locator(`#dm-visual-picker[data-kind="${kind}"]`);
  await expect(picker).toBeVisible();
  await expect(picker).toHaveAttribute("data-dm-icon-engine", "single-owner");
  await expect(picker.locator("svg,ha-icon")).toHaveCount(0);
  await expect(picker.locator("[data-search]")).not.toBeFocused();
  const first = picker.locator('.dm-picker-option[data-index="0"] .dm-picker-visual');
  await expect(first).toHaveAttribute("data-dm-icon-engine-glyph-value", glyph);

  const before = await first.evaluate((node) => ({
    text: getComputedStyle(node, "::before").content,
    glyph: node.dataset.dmIconEngineGlyphValue,
  }));
  await page.waitForTimeout(1250);
  await expect(picker.locator("svg,ha-icon")).toHaveCount(0);
  await expect(first).toHaveAttribute("data-dm-icon-engine-glyph-value", glyph);
  const after = await first.evaluate((node) => ({
    text: getComputedStyle(node, "::before").content,
    glyph: node.dataset.dmIconEngineGlyphValue,
  }));
  expect(after).toEqual(before);
}

test("beta18: action and room pickers remain visually stable beyond former delayed repairs", async ({ page }, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 80_000);
  await boot(page, testInfo);
  await page.evaluate(() => {
    localStorage.setItem("cd_quick_actions", JSON.stringify([
      { type: "builtin", builtin: "luci", name: "Luci", icon: "mdi:lightbulb" },
    ]));
    buildQuickActions();
  });

  await openEditor(page, "sez8");
  await page.locator('#ed-body [data-dm-edit-kind="action"][data-dm-edit-index="0"]').click();
  const actionPreview = page.locator("#dm-action-editor-modal [data-action-icon-preview]");
  await expect(actionPreview).toHaveAttribute("data-dm-icon-engine-glyph-value", "💡");
  await expect(actionPreview.locator("svg,ha-icon")).toHaveCount(0);
  await actionPreview.click();
  await assertStablePicker(page, "action", "🏠");
  await page.locator("#dm-visual-picker [data-close]").click();

  await page.locator("#dm-action-editor-modal [data-close]").click();
  await openEditor(page, "stanze");
  await page.locator("#ed-body .dm-beta5-room-icon-trigger").click();
  await assertStablePicker(page, "room", "🛋️");
});

test("beta18: first-add Quick Action trigger uses the same picker without keyboard autofocus", async ({ page }, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 80_000);
  await boot(page, testInfo);
  await openEditor(page, "sez8");
  const trigger = page.locator("#ed-body .dm-beta6-qa-icon-trigger");
  await expect(trigger).toBeVisible();
  await trigger.click();
  await assertStablePicker(page, "action", "🏠");
});
''',
)

# 15. Enhance the engine with a CSS-backed visual lock. Historical child rewrites
# become invisible even before all old compatibility code has returned.
path = "custom_components/dashboardmodern/frontend/src/sections/icon-engine-section.js"
source = read(path)
source = replace_once(
    source,
    '  target.dataset.dmIconEngineSignature = signature;\n  target.dataset.dmIconEngineOwner = "single";',
    '  target.dataset.dmIconEngineSignature = signature;\n  target.dataset.dmIconEngineOwner = "single";\n  target.dataset.dmIconEngineGlyphValue = glyph;\n  target.style.setProperty("--dm-icon-engine-glyph-size", `${Math.max(18, Math.min(72, Number(size) || 38))}px`);',
    "engine target visual lock",
)
source = source.replace(
    '      visual: iconGlyphMarkup("room", item.mdi, { size: 31 }),',
    '      glyph: ROOM_GLYPHS[item.id] || roomGlyph(item.mdi),\n      size: 31,\n      visual: iconGlyphMarkup("room", item.mdi, { size: 31 }),',
)
source = source.replace(
    '    visual: iconGlyphMarkup("action", item.mdi, { size: 36 }),',
    '    glyph: item.glyph || actionGlyph(item.mdi),\n    size: 36,\n    visual: iconGlyphMarkup("action", item.mdi, { size: 36 }),',
)
source = replace_once(
    source,
    '<span class="dm-picker-visual">${item.visual}</span>${normalized === "action" || normalized === "car" ? `<b>${esc(item.label)}</b>` : ""}',
    '<span class="dm-picker-visual"${normalized === "car" ? "" : ` data-dm-icon-engine-owner="single" data-dm-icon-engine-glyph-value="${item.glyph}" style="--dm-icon-engine-glyph-size:${item.size}px"`}>${item.visual}</span>${normalized === "action" || normalized === "car" ? `<b>${esc(item.label)}</b>` : ""}',
    "engine picker visual lock markup",
)
# Expand editor synchronization to list rows/cards, making the engine authoritative beyond modals.
needle = '  const quickInput = doc.getElementById("ed-qa-icon");\n'
insert = '''  const actions = quickActionsFromRuntime();
  doc.querySelectorAll('#ed-body [data-dm-edit-kind="action"][data-dm-edit-index]').forEach((edit) => {
    const row = edit.closest(".ed-row");
    const index = Number.parseInt(edit.dataset.dmEditIndex || "-1", 10);
    if (!row || index < 0) return;
    let target = row.querySelector(".dm-beta7-existing-action-icon");
    if (!target) {
      target = doc.createElement("span");
      target.className = "dm-beta7-existing-action-icon";
      row.prepend(target);
    }
    renderIconGlyph(target, "action", actionToken(actions[index] || {}), { size: 29 });
    changed = true;
  });
  let rooms = [];
  try {
    rooms = root.DashboardModernModules?.store?.getSection?.("rooms") || [];
  } catch (_error) {}
  if (!Array.isArray(rooms) || !rooms.length) {
    try { rooms = JSON.parse(root.localStorage?.getItem("cd_stanze") || "[]"); } catch (_error) { rooms = []; }
  }
  doc.querySelectorAll('#ed-body [data-dm-edit-kind="room"][data-dm-edit-index]').forEach((edit) => {
    const row = edit.closest(".ed-row");
    const index = Number.parseInt(edit.dataset.dmEditIndex || "-1", 10);
    const room = index >= 0 ? rooms[index] : null;
    if (!row || !room) return;
    let target = row.querySelector(":scope > .dm-room-list-icon");
    if (!target) {
      target = doc.createElement("span");
      target.className = "dm-room-list-icon";
      row.prepend(target);
    }
    const token = clean(room.icon || room.name || "mdi:home");
    target.dataset.roomIcon = token;
    renderIconGlyph(target, "room", token, { size: 31 });
    changed = true;
  });
  doc.querySelectorAll(".dm-temperature-card[data-room-id]").forEach((card) => {
    const room = rooms.find((item) => clean(item?.id) === clean(card.dataset.roomId));
    const target = card.querySelector(".dm-temperature-card-icon");
    if (!room || !target) return;
    renderIconGlyph(target, "room", room.icon || room.name || "mdi:home", { size: 29 });
    changed = true;
  });
'''
if needle not in source:
    raise SystemExit("engine editor sync insertion point not found")
source = source.replace(needle, insert + needle, 1)
source = replace_once(
    source,
    '      .dm-icon-engine-glyph{display:grid!important;place-items:center!important;width:100%!important;height:100%!important;font-family:Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif!important;font-style:normal!important;font-weight:400!important;line-height:1!important;color:initial!important}\n      .dm-icon-engine-glyph>span{display:block!important;line-height:1!important}',
    '      .dm-icon-engine-glyph{display:grid!important;place-items:center!important;width:100%!important;height:100%!important;font-family:Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif!important;font-style:normal!important;font-weight:400!important;line-height:1!important;color:initial!important}\n      .dm-icon-engine-glyph>span{display:block!important;line-height:1!important}\n      [data-dm-icon-engine-owner="single"][data-dm-icon-engine-glyph-value]{position:relative!important;color:initial!important}\n      [data-dm-icon-engine-owner="single"][data-dm-icon-engine-glyph-value]>*{visibility:hidden!important;opacity:0!important}\n      [data-dm-icon-engine-owner="single"][data-dm-icon-engine-glyph-value]::before{content:attr(data-dm-icon-engine-glyph-value)!important;display:grid!important;place-items:center!important;position:absolute!important;inset:0!important;z-index:3!important;visibility:visible!important;opacity:1!important;font-family:Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif!important;font-size:var(--dm-icon-engine-glyph-size,38px)!important;font-style:normal!important;font-weight:400!important;line-height:1!important;color:initial!important;pointer-events:none!important}',
    "engine CSS visual lock",
)
write(path, source)


# 16. Format-check expectations now recognize the new canonical module.
# Existing personalization test deliberately keeps dm-room-art class and remains valid.

# Remove this one-shot transformation machinery from the resulting branch tree.
for cleanup in [
    ROOT / "scripts/beta18_icon_engine_refactor.py",
    ROOT / ".github/workflows/beta18-icon-engine-refactor.yml",
]:
    if cleanup.exists():
        cleanup.unlink()

import { readFileSync } from "node:fs";
import { readFile as readFileAsync } from "node:fs/promises";

const legacyRoot = new URL("../legacy/", import.meta.url);
const localScriptPattern = /<script\b[^>]*\bsrc=["']\.\/([^"']+\.js)(?:[?#][^"']*)?["'][^>]*><\/script>/gi;

function referencedScripts(html) {
  return [...html.matchAll(localScriptPattern)].map((match) => match[1]);
}

export function readLegacyHtml(name) {
  return readFileSync(new URL(name, legacyRoot), "utf8");
}

export function readLegacyBundle(name) {
  const html = readLegacyHtml(name);
  const scripts = referencedScripts(html).map((file) =>
    readFileSync(new URL(file, legacyRoot), "utf8"),
  );
  return [html, ...scripts].join("\n");
}

export function readLegacyLocaleBundle(name, locale) {
  const html = readLegacyHtml(name);
  const scripts = referencedScripts(html)
    .filter((file) => file.includes(`-${locale}.js`))
    .map((file) => readFileSync(new URL(file, legacyRoot), "utf8"));
  return [html, ...scripts].join("\n");
}

export async function readLegacyBundleAsync(name) {
  const html = await readFileAsync(new URL(name, legacyRoot), "utf8");
  const scripts = await Promise.all(
    referencedScripts(html).map((file) => readFileAsync(new URL(file, legacyRoot), "utf8")),
  );
  return [html, ...scripts].join("\n");
}

export function legacyAssetUrl(file) {
  return new URL(file, legacyRoot);
}

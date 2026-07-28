import { readFileSync } from "node:fs";
import vm from "node:vm";

export function inlineScripts(file) {
  const html = readFileSync(file, "utf8");
  const scripts = [];
  const pattern = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  for (const match of html.matchAll(pattern)) {
    if (/\bsrc\s*=/.test(match[1]) || /\btype\s*=\s*["']module["']/.test(match[1])) continue;
    const htmlLine = html.slice(0, match.index).split("\n").length;
    scripts.push({ source: match[2], htmlLine, index: scripts.length + 1, attributes: match[1] });
  }
  return scripts;
}

export function compileInlineScripts(file) {
  const scripts = inlineScripts(file);
  for (const block of scripts) {
    try {
      new vm.Script(block.source, {
        filename: `${file}#inline-script-${block.index}`,
        lineOffset: block.htmlLine,
      });
    } catch (error) {
      error.message = `${file}: inline script ${block.index}, near HTML line ${block.htmlLine}: ${error.message}`;
      throw error;
    }
  }
  return scripts.length;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  for (const file of process.argv.slice(2)) {
    const count = compileInlineScripts(file);
    console.log(`${file}: compiled ${count} inline scripts`);
  }
}

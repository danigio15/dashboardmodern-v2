/*
 * The legacy editors build their rows as HTML strings assigned to innerHTML.
 * A configurable name/icon/value like `<img src=x onerror=...>` must never
 * reach the DOM as live markup: it would become persistent script running in
 * another user's (possibly an admin's) session on a shared installation.
 *
 * These tests execute the shipped escaper and the self-contained condition
 * label with hostile input (behavioural), and assert that the appliance and
 * alert editor renderers route their user-supplied fields through the escaper
 * (structural guard against a regression that drops a wrap).
 */
import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import { readLegacyBundle } from "./legacy-source.js";

function functionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} missing`);
  const body = source.indexOf("{", start);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = body; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === "'" || char === '"' || char === "`") quote = char;
    else if (char === "{") depth += 1;
    else if (char === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`unterminated ${name}`);
}

// cdEscHtml is a single-statement one-liner whose body holds regex literals
// containing quote characters, which the brace/quote scanner above cannot walk.
// It ends at the first `;}`, and its chained .replace() calls contain no earlier
// one, so a non-greedy match extracts it exactly.
function escaperSource(source) {
  const match = source.match(/function cdEscHtml\(x\)\{[\s\S]*?;\}/);
  assert.notEqual(match, null, "cdEscHtml missing");
  return match[0];
}

const PAYLOAD = '<img src=x onerror=alert(1)>';

for (const file of ["dashboard.html", "dashboard-en.html"]) {
  const source = readLegacyBundle(file);

  test(`${file}: cdEscHtml neutralises an HTML/JS injection payload`, () => {
    const context = vm.createContext({});
    vm.runInContext(
      `${escaperSource(source)}\nthis.cdEscHtml = cdEscHtml;`,
      context,
    );
    const escaped = context.cdEscHtml(PAYLOAD);
    assert.doesNotMatch(escaped, /<img/, "raw tag must not survive");
    assert.match(escaped, /&lt;img/);
    assert.equal(context.cdEscHtml('"&\'<>'), "&quot;&amp;&#39;&lt;&gt;");
    // Nullish input never throws and never leaks the word "undefined".
    assert.equal(context.cdEscHtml(null), "");
    assert.equal(context.cdEscHtml(undefined), "");
  });

  test(`${file}: a custom alert value is escaped through the label`, () => {
    const context = vm.createContext({});
    vm.runInContext(
      `${escaperSource(source)}\n` +
        `${functionSource(source, "cdAvvisoCondLabel")}\n` +
        "this.cdAvvisoCondLabel = cdAvvisoCondLabel;",
      context,
    );
    const label = context.cdAvvisoCondLabel({ cond: "eq", value: PAYLOAD });
    assert.doesNotMatch(label, /<img/);
    assert.match(label, /&lt;img/);
  });

  test(`${file}: appliance editor rows route names and entities through the escaper`, () => {
    const editor = functionSource(source, "editorRenderAppliances");
    // The appliance display name and the entity-id list are the two user-fed
    // sinks in the row template.
    assert.match(editor, /cdEscHtml\(a&&a\.name\?a\.name:cdApplianceName\(a\.icon\)\)/);
    assert.match(editor, /cdEscHtml\(ents\.join\(', '\)\)/);
    // No unescaped name interpolation remains in the row template.
    assert.doesNotMatch(editor, /\+\(a&&a\.name\?a\.name:cdApplianceName\(a\.icon\)\)\+/);
  });

  test(`${file}: alert editor rows escape name, icon and entity list`, () => {
    const editor = functionSource(source, "editorRenderAvvisi");
    assert.match(editor, /cdEscHtml\(a\.icon\|\|'⚠️'\)/);
    assert.match(editor, /cdEscHtml\(a\.name\|\|ents\[0\]\|\|''\)/);
    assert.match(editor, /cdEscHtml\(ents\.join\(', '\)\)/);
    assert.match(editor, /cdEscHtml\(nm\)/);
  });
}

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const guard = await read("../src/sections/entity-picker-guard-section.js");
const crud = await read("../src/sections/editor-crud-section.js");

test("the picker row never lands on a container", () => {
  // .dm-entity-picker-row is display:flex with min-width:0 children. The
  // Tapparelle, Telecamere and Irrigazione forms put fields directly inside
  // #ed-body, so flexing the parent laid the whole editor out as narrow
  // columns of broken words on a phone.
  assert.match(guard, /\.dm-entity-picker-row\{display:flex!important/);
  assert.match(guard, /const NEVER_A_PICKER_ROW = "#ed-body,\.ed-body,\.ed-shell,#editor-modal,#setup-wizard,\.ed-list,\.dm-section-dialog,body"/);
  assert.match(guard, /function markPickerRow\(parent\)/);
  assert.match(guard, /if \(parent\.matches\?\.\(NEVER_A_PICKER_ROW\)\) return;/);
  assert.match(guard, /if \(parent\.querySelectorAll\("input,select,textarea"\)\.length > 1\) return;/);
  // The old unconditional call is gone, not merely shadowed.
  assert.doesNotMatch(guard, /\["LABEL", "SPAN", "DIV"\]\.includes\(parent\.tagName\)\) parent\.classList\.add/);
  // And an installation upgrading from a release that flexed a container gets
  // it back as a block on the next reconcile.
  assert.match(guard, /node\?\.classList\?\.remove\?\.\("dm-entity-picker-row"\)/);
});

test("the editor body stays a vertical stack whatever else runs", () => {
  assert.match(crud, /#editor-modal \.ed-body\{display:block!important;columns:auto!important;column-count:auto!important\}/);
  assert.match(crud, /#editor-modal \.ed-body>\*\{float:none!important\}/);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const fixesUrl = new URL("../legacy/release-0152-runtime.js", import.meta.url);

test("historical Recorder failures do not invoke global connection handlers", async () => {
  const source = await readFile(fixesUrl, "utf8");
  const catchBlock = source.slice(source.indexOf("} catch (error) {", source.indexOf("refreshEnergyStatistics0152")));
  assert.match(catchBlock, /setStatus\(/);
  assert.doesNotMatch(catchBlock, /connectHA|setConnection|location\.reload/);
});

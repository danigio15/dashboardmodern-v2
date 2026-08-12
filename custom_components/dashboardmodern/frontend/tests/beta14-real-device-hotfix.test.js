import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { recoverRoomSnapshot } from "../src/sections/beta14-real-device-hotfix-section.js";

const hotfixUrl = new URL("../src/sections/beta14-real-device-hotfix-section.js", import.meta.url);
const buildInfoUrl = new URL("../legacy/build-info.js", import.meta.url);
const generatorUrl = new URL("../../../../scripts/generate_build_info.py", import.meta.url);

test("beta14 restores room icon and temperature fields lost by a stale canonical snapshot", () => {
  const canonical = [
    { id: "room-cameretta", name: "Cameretta", icon: "", temp: "", hum: "", order: 0 },
    { id: "room-bagno", name: "Bagno", icon: "mdi:home", temp: "sensor.bagno_temperature", order: 1 },
  ];
  const legacy = [
    {
      id: "room-cameretta",
      name: "Cameretta",
      icon: "mdi:sofa",
      temp: "sensor.cameretta_temperature",
      hum: "sensor.cameretta_humidity",
    },
    {
      id: "room-bagno",
      name: "Bagno",
      icon: "mdi:shower",
      temp: "sensor.bagno_temperature",
    },
    {
      id: "room-camera",
      name: "Camera",
      icon: "mdi:bed",
      temp: "sensor.camera_temperature",
    },
  ];

  const recovered = recoverRoomSnapshot(canonical, legacy);
  assert.equal(recovered.length, 3);
  assert.equal(recovered[0].icon, "mdi:sofa");
  assert.equal(recovered[0].temp, "sensor.cameretta_temperature");
  assert.equal(recovered[0].hum, "sensor.cameretta_humidity");
  // Non-empty canonical values remain authoritative.
  assert.equal(recovered[1].icon, "mdi:home");
  assert.equal(recovered[2].name, "Camera");
});

test("beta14 real-device polish keeps the requested visible contracts", async () => {
  const source = await readFile(hotfixUrl, "utf8");
  assert.match(source, /❄️ Freddo/);
  assert.match(source, /🔥 Caldo/);
  assert.match(source, /font-size:28px!important/);
  assert.match(source, /aspect-ratio:1\.78 \/ 1!important/);
  assert.match(source, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/);
  assert.match(source, /data-room-icon/);
  assert.doesNotMatch(source, /setInterval\s*\(/);
});

test("release build loads the beta14 hotfix after the beta12 final icon owner", async () => {
  const buildInfo = await readFile(buildInfoUrl, "utf8");
  const generator = await readFile(generatorUrl, "utf8");
  const finalOwner = "beta12-room-color-lock-section.js";
  const hotfix = "beta14-real-device-hotfix-section.js";
  assert.ok(buildInfo.indexOf(hotfix) > buildInfo.indexOf(finalOwner));
  assert.ok(generator.indexOf(hotfix) > generator.indexOf(finalOwner));
});

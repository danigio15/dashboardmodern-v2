from pathlib import Path

path = Path("custom_components/dashboardmodern/frontend/src/sections/beta16-real-device-layout-section.js")
text = path.read_text()
old = '''    const name = clean(room.name) || clean(room.id) || (english() ? "Room" : "Stanza");
    const sensors = [clean(room.temp), clean(room.hum)].filter(Boolean).join(" · ");
    nodes.primary.textContent = name;
    nodes.primary.title = name;
    nodes.secondary.textContent = sensors;
    nodes.secondary.title = sensors;
    row.dataset.dmBeta16TemperatureName = "true";'''
new = '''    const name = clean(room.name) || clean(room.id) || (english() ? "Room" : "Stanza");
    const sensors = [clean(room.temp), clean(room.hum)].filter(Boolean).join(" · ");
    const labels = [];
    if (clean(room.temp))
      labels.push(clean(room.temp_name || room.temperature_name) || clean(room.temp));
    if (clean(room.hum))
      labels.push(clean(room.hum_name || room.humidity_name) || clean(room.hum));
    nodes.primary.textContent = name;
    nodes.primary.title = name;
    nodes.secondary.textContent = labels.join(" · ");
    nodes.secondary.title = sensors;
    row.dataset.dmBeta16TemperatureName = "true";'''
if old not in text:
    raise SystemExit("beta16 Temperature row repair snippet not found")
path.write_text(text.replace(old, new, 1))

test_path = Path("custom_components/dashboardmodern/frontend/tests/temperature-labels-regression.test.js")
test_text = test_path.read_text()
needle = '''test("Temperature card renders optional entity names below the room and preserves generic metric labels", async () => {'''
addition = '''test("legacy real-device row repair cannot overwrite custom Temperature names with raw entity ids", async () => {
  const source = await readFile(
    new URL("../src/sections/beta16-real-device-layout-section.js", import.meta.url),
    "utf8",
  );
  assert.match(source, /room\.temp_name \|\| room\.temperature_name/);
  assert.match(source, /room\.hum_name \|\| room\.humidity_name/);
  assert.match(source, /nodes\.secondary\.textContent = labels\.join\(" · "\)/);
});

'''
if needle not in test_text:
    raise SystemExit("temperature regression insertion point not found")
test_path.write_text(test_text.replace(needle, addition + needle, 1))

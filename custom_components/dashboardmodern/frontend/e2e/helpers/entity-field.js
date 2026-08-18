/*
 * Entity fields in the editors are drawn as one readable row: the picker button
 * says what is chosen, and the raw entity id sits behind the pencil beside it.
 *
 * A test that wants to read or type an id does what a person does — it taps the
 * pencil first. Nothing here reaches past the UI: the pencil is the control the
 * dashboard ships, and these helpers only press it.
 */

/** Put one field into manual mode, by its pencil. */
export async function editEntityFieldByHand(page, selector) {
  const manual = page.locator(`${selector} ~ .dm-chip-manual`).first();
  // The row is decorated on the frame after the editor prints it, so wait for
  // the pencil the way a person waits for the form to finish drawing.
  await manual.waitFor({ state: "attached", timeout: 5_000 }).catch(() => {});
  if ((await manual.count()) === 0) return false;
  if ((await manual.getAttribute("aria-pressed")) === "true") return true;
  await manual.click();
  return true;
}

/** Tap the pencil, then type the id, the way the editor is used by hand. */
export async function fillEntityFieldByHand(page, selector, value) {
  await editEntityFieldByHand(page, selector);
  await page.locator(selector).fill(value);
}

/**
 * Put every entity field currently on screen into manual mode.
 *
 * For the specs that assert on the raw fields themselves — the picker
 * invariants, the persistence round trips — rather than on the row that
 * normally stands in for them.
 */
export async function showRawEntityFields(page) {
  return page.evaluate(() => {
    let opened = 0;
    for (const manual of document.querySelectorAll(".dm-chip-manual")) {
      if (manual.getAttribute("aria-pressed") === "true") continue;
      manual.click();
      opened += 1;
    }
    return opened;
  });
}

/**
 * Save the open tab through the one control the Configuration now offers.
 *
 * The per-panel save buttons stay in the document but are hidden behind the
 * single "Salva sezione" footer, which presses them for the panels on screen —
 * so pressing the footer is what a person does, and what these tests do.
 */
export async function saveSection(page) {
  await page.locator("#ed-body [data-dm-save-all]").click();
}

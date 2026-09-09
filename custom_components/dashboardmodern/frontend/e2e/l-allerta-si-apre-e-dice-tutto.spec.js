/* «Non si può interagire con le schede allerte per espandere le informazioni»
 *  (#422).
 *
 * La tessera dice il minimo per alzare la testa. Il testo di un avviso della
 * protezione civile lo si tagliava a centottanta caratteri per farlo stare nel
 * riquadro, e tutto quello che l'integrazione scrive negli attributi non
 * usciva da nessuna parte. Adesso la tessera si apre.
 *
 * Questa prova apre la plancia vera, semina un avviso come lo scrive la sua
 * integrazione, e guarda che premendo la tessera esca il testo INTERO — non
 * quello troncato che si legge già fuori.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true },
};

/* Un avviso vero e' lungo cosi': e' esattamente il motivo per cui la tessera
 * lo taglia, e per cui questa finestra esiste. */
const AVVISO =
  "Dalle ore 12:00 di oggi e per le successive 18 ore si prevedono precipitazioni diffuse, " +
  "anche a carattere di rovescio o temporale, sulla zona di allerta. I fenomeni saranno " +
  "accompagnati da rovesci di forte intensita', frequente attivita' elettrica e raffiche di vento.";

const ENTITA = "sensor.protezione_civile_allerta";

test("la tessera dell'allerta si apre e dice tutto", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript(
    ({ entita, avviso }) => {
      /* La configurazione della sezione, seminata prima che la plancia parta:
       * com'e' quando si riapre la pagina. */
      const originale = Storage.prototype.getItem;
      Storage.prototype.getItem = function (chiave) {
        if (String(chiave).endsWith("cd_allerte"))
          return JSON.stringify({ meteo: { entity: entita, nome: "Protezione civile" } });
        return originale.call(this, chiave);
      };
      /* E lo stato, con gli attributi che l'integrazione scrive davvero. */
      globalThis.__dmSemeAllerta = {
        entity_id: entita,
        state: "Allerta gialla",
        attributes: {
          friendly_name: "Allerta Protezione Civile",
          icon: "mdi:alert",
          event_description: avviso,
          severity: "Moderate",
          zone: ["Bacini Costieri", "Valle del Tevere"],
          valid_from: "2026-09-09T12:00:00+02:00",
        },
      };
    },
    { entita: ENTITA, avviso: AVVISO },
  );
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));

  /* Lo stato entra dove la plancia legge davvero: `_RAW_STATES` e' una
   * dichiarazione lessicale del guscio, non una proprieta' del globale — si
   * raggiunge per nome, come fanno le altre prove. Si MUTA l'oggetto che c'e',
   * non lo si sostituisce: sostituirlo lascerebbe il runtime attaccato al
   * vecchio. */
  await page.evaluate(() => {
    const seme = globalThis.__dmSemeAllerta;
    const raw =
      globalThis.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null") ||
      globalThis.eval("typeof STATES !== 'undefined' ? STATES : null") ||
      globalThis._RAW_STATES ||
      globalThis.STATES;
    if (raw) raw[seme.entity_id] = seme;
    globalThis.dispatchEvent(new CustomEvent("dashboardmodern:state-changed"));
  });

  await page.locator('.tab[data-tab="allerte"]').first().click();
  const tessera = page.locator('#page-allerte .dm-allerta[data-chiave="meteo"]').first();
  await expect(tessera).toBeVisible({ timeout: 20_000 });

  /* Fuori il testo e' tagliato: e' la tessera, e va bene cosi'. */
  await expect(tessera).toHaveAttribute("data-dm-allerta-apri", "");
  const fuori = (await tessera.textContent()) || "";
  expect(fuori.length).toBeLessThan(AVVISO.length);

  await tessera.click();
  const finestra = page.locator("#dm-allerta-dettaglio");
  await expect(finestra).toHaveClass(/show/);
  /* Dentro c'e' per intero, e c'e' anche quello che fuori non compariva. */
  await expect(finestra).toContainText("frequente attivita' elettrica");
  await expect(finestra).toContainText("Bacini Costieri");
  await expect(finestra).toContainText(ENTITA);
  /* La veste e' quella di tutte le altre finestre della plancia. */
  await expect(finestra).toHaveClass(/modal-wrapper/);
  await expect(finestra.locator(".modal-card")).toBeVisible();

  await testInfo.attach("allerta-dettaglio.png", {
    body: await page.screenshot({ fullPage: false }),
    contentType: "image/png",
  });

  /* E si chiude da fuori, come le altre. */
  await page.keyboard.press("Escape");
  await expect(finestra).not.toHaveClass(/show/);
});

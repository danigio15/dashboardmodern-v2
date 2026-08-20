/* All'apertura di una finestra si vedeva un tremolio.
 *
 * Le finestre chiuse non tengono piu' il vetro smerigliato: e' quello che le
 * rendeva care da tenere in giro su un telefono. Il prezzo pero' si era
 * spostato all'apertura — il browser deve costruire la sfocatura a schermo
 * intero tutta dentro lo stesso disegno, e su quel disegno il telefono perde un
 * fotogramma. Misurato su una macchina scarica: il disegno piu' lungo passava
 * da 36ms a 23ms una volta curato.
 *
 * La cura e' far salire la sfocatura insieme alla dissolvenza invece che di
 * scatto: la stessa mezza dozzina di disegni che il browser fa comunque per
 * sfumare l'opacita' portano su anche lo sfondo, un pezzo per volta.
 *
 * Qui si controlla la cura, non la misura. Quanto dura un disegno dipende da
 * cosa sta facendo la macchina in quel momento — sullo stesso computer lo
 * stesso identico codice ha dato 23ms da solo e 90ms con la suite intorno — e
 * un numero cosi' non e' un contratto, e' il meteo. Il contratto e' che lo
 * sfondo sfocato sia fra le cose che sfumano: e' quello che spalma il lavoro
 * su tutta la dissolvenza invece di concentrarlo in un disegno solo.
 */
import { expect, test } from "@playwright/test";
import { PRIMARY } from "./helpers/variants.js";

for (const variant of PRIMARY) {
  test(`${variant}: lo sfondo di una finestra sfuma invece di comparire di scatto`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.goto(`/legacy/${variant}`);
    await page.waitForFunction(() => Boolean(document.getElementById("weather-modal")), null, {
      timeout: 15000,
    });

    const transitions = await page.evaluate(() => {
      const modal = document.getElementById("weather-modal");
      const closed = getComputedStyle(modal).transitionProperty;
      modal.classList.add("show");
      const open = getComputedStyle(modal).transitionProperty;
      modal.classList.remove("show");
      return { closed, open };
    });

    // Chiusa e aperta: in tutti e due gli stati la sfocatura deve essere fra le
    // proprieta' che sfumano, altrimenti scatta da una parte o dall'altra.
    expect(transitions.closed).toMatch(/backdrop-filter/);
    expect(transitions.open).toMatch(/backdrop-filter/);

    // E deve sfumare insieme alla dissolvenza, non su un tempo suo.
    const durations = await page.evaluate(() => {
      const modal = document.getElementById("weather-modal");
      modal.classList.add("show");
      const style = getComputedStyle(modal);
      const properties = style.transitionProperty.split(",").map((value) => value.trim());
      const times = style.transitionDuration.split(",").map((value) => value.trim());
      modal.classList.remove("show");
      const at = (name) => times[properties.indexOf(name)] || "";
      return { opacity: at("opacity"), backdrop: at("backdrop-filter") };
    });
    expect(durations.backdrop).toBe(durations.opacity);
  });
}

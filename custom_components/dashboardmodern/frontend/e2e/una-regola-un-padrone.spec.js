/* Nessuna decisione ha due padroni.
 *
 * Il difetto che in questa plancia e' tornato piu' spesso ha sempre la stessa
 * forma: la stessa regola scritta col peso massimo in due fogli che non si
 * parlano. Finche' i due valori coincidono non si vede niente; il giorno che
 * uno dei due cambia, vince quello che capita di caricare per ultimo, e la
 * modifica «non fa effetto». Cosi' e' successo al numero della tessera, al
 * margine laterale, al nome della scheda dell'elettrodomestico.
 *
 * Cercarlo leggendo i sorgenti non basta: i fogli nascono dentro stringhe, le
 * regole vivono dentro @media, e chi guarda solo il testo o grida al lupo per
 * un ramo che si applica altrove, o non vede il ramo che perde. L'unico posto
 * dove la risposta e' certa e' il documento: si apre la plancia, si prendono i
 * fogli davvero installati nell'ordine in cui stanno, e si guarda chi vince.
 *
 * Un padrone solo per decisione vuol dire tre cose insieme: stesso ramo
 * (@media compreso), stesso selettore, stessa forza. Dove la forza e' diversa
 * non c'e' lite: vince la regola piu' precisa, ed e' come dev'essere.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

/* Le regole si leggono con un lettore che sa dove finisce un blocco: i fogli
 * di questa plancia mettono decine di regole su una riga sola, e le @media a
 * volte si aprono e si chiudono nella stessa. */
function regole(css) {
  const fuori = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const raccolte = [];
  const rami = [];
  let i = 0;
  let testa = "";
  while (i < fuori.length) {
    const carattere = fuori[i];
    if (carattere === "{") {
      const nome = testa.trim();
      testa = "";
      if (nome.startsWith("@")) {
        rami.push(nome.replace(/\s+/g, " "));
      } else {
        let profondita = 1;
        let j = i + 1;
        let corpo = "";
        while (j < fuori.length && profondita > 0) {
          if (fuori[j] === "{") profondita += 1;
          else if (fuori[j] === "}") {
            profondita -= 1;
            if (profondita === 0) break;
          }
          corpo += fuori[j];
          j += 1;
        }
        if (nome) raccolte.push({ ramo: rami.join(" >> "), selettori: nome, corpo });
        i = j;
      }
    } else if (carattere === "}") {
      rami.pop();
      testa = "";
    } else testa += carattere;
    i += 1;
  }
  return raccolte;
}

/* Il conto grezzo della forza di un selettore: quanti identificativi, quante
 * classi o attributi, quanti nomi di elemento. Serve solo a distinguere «due
 * regole ugualmente forti» da «una piu' precisa dell'altra». */
function forza(selettore) {
  const pulito = selettore.replace(/\\./g, "");
  const identificativi = (pulito.match(/#[\w-]+/g) || []).length;
  const classi = (
    pulito.match(/\.[\w-]+|\[[^\]]*\]|:(?!:)(?!is\b|where\b|not\b|has\b)[\w-]+(\([^)]*\))?/g) || []
  ).length;
  const elementi = (pulito.match(/(^|[\s>+~])[a-zA-Z][\w-]*/g) || []).length;
  return `${identificativi}-${classi}-${elementi}`;
}

test("una regola, un padrone", async ({ page }, testInfo) => {
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, {
    schema_version: 4,
    sections: {},
    visibility: {},
  });
  // I fogli non arrivano tutti insieme: qualcuno lo installa una sezione che
  // si accende dopo. Si aspetta che il numero smetta di crescere.
  await expect
    .poll(async () => page.evaluate(() => document.querySelectorAll("style").length), {
      timeout: 30_000,
    })
    .toBeGreaterThan(60);
  await page.waitForTimeout(3000);

  const fogli = await page.evaluate(() =>
    [...document.querySelectorAll("style")].map((foglio) => ({
      id: foglio.id || "",
      css: foglio.textContent || "",
    })),
  );

  const decisioni = new Map();
  fogli.forEach((foglio, ordineFoglio) => {
    if (!foglio.id) return;
    regole(foglio.css).forEach((regola, ordineRegola) => {
      const dichiarazioni = [
        ...regola.corpo.matchAll(/([-a-z]+)\s*:\s*([^;]*?)\s*(!important)?\s*(?:;|$)/g),
      ].filter((d) => d[3]);
      if (!dichiarazioni.length) return;
      for (const selettore of regola.selettori
        .split(",")
        .map((pezzo) => pezzo.trim().replace(/\s+/g, " "))
        .filter(Boolean)) {
        for (const dichiarazione of dichiarazioni) {
          const chiave = `${regola.ramo}||${selettore}||${dichiarazione[1]}`;
          if (!decisioni.has(chiave)) decisioni.set(chiave, []);
          decisioni.get(chiave).push({
            foglio: foglio.id,
            valore: dichiarazione[2].replace(/\s+/g, " "),
            forza: forza(selettore),
            ordine: ordineFoglio * 100000 + ordineRegola,
          });
        }
      }
    });
  });

  const litigi = [];
  for (const [chiave, voci] of decisioni) {
    if (new Set(voci.map((v) => v.foglio)).size < 2) continue;
    if (new Set(voci.map((v) => v.forza)).size > 1) continue;
    if (new Set(voci.map((v) => v.valore)).size < 2) continue;
    const ordinate = [...voci].sort((a, b) => a.ordine - b.ordine);
    const vincitore = ordinate[ordinate.length - 1];
    const perdenti = ordinate.filter(
      (v) => v.valore !== vincitore.valore && v.foglio !== vincitore.foglio,
    );
    if (!perdenti.length) continue;
    const [ramo, selettore, proprieta] = chiave.split("||");
    for (const perdente of perdenti)
      litigi.push(
        `${ramo ? `${ramo} ` : ""}${selettore} { ${proprieta}: ${perdente.valore} }` +
          ` in ${perdente.foglio} non fa effetto: vince ${vincitore.valore} da ${vincitore.foglio}`,
      );
  }

  expect(litigi, litigi.join("\n")).toEqual([]);
});

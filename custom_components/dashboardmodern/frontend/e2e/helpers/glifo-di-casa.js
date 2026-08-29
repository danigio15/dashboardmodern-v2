import { expect } from "@playwright/test";

/* Come si chiama, sullo schermo, l'icona che sta in quel posto.
 *
 * Le voci di serie non escono piu' a emoji: hanno il disegno del catalogo di
 * casa, fatto con la tavolozza degli elettrodomestici. L'identita' quindi non
 * e' piu' il testo — un disegno non ha testo — ma il nome del disegno, e si
 * scrive `disegno:qualcosa`. Chi un disegno non ce l'ha resta all'emoji del
 * sistema, e allora vale il testo, com'e' sempre stato. */
export async function identitaDelGlifo(locator, classe) {
  return locator.evaluate((node, nomeClasse) => {
    const glifo = node.querySelector(`.${nomeClasse}`);
    if (glifo?.dataset?.dmDisegno === "casa")
      return `disegno:${glifo.querySelector("[data-dm-art]")?.dataset.dmArt || "?"}`;
    const testo = glifo?.textContent || "";
    const prima = getComputedStyle(node, "::before").content || "";
    return `${testo}${prima}`;
  }, classe);
}

export async function attendiIlGlifo(locator, classe, atteso) {
  await expect(locator).toBeVisible();
  await expect.poll(() => identitaDelGlifo(locator, classe)).toContain(atteso);
}

/* Icone vettoriali che non sono nostre.
 *
 * La regola difesa qui e' che nel selettore non entri il vettoriale di
 * qualcun altro — un `ha-icon` di Home Assistant, un contorno rimasto dal
 * vecchio runtime — perche' accanto alle scocche stonerebbe. Prima bastava
 * contare gli svg, che erano tutti estranei per definizione; adesso i disegni
 * di casa sono svg anche loro, e si contano solo quelli che stanno fuori da un
 * disegno nostro. */
export async function vettorialiEstranei(locator) {
  return locator.evaluate((node) => ({
    haIcon: node.querySelectorAll("ha-icon").length,
    svg: [...node.querySelectorAll("svg")].filter(
      (disegno) => !disegno.closest('[data-dm-disegno="casa"]'),
    ).length,
  }));
}

/* Quel posto ha proprio quel disegno.
 *
 * Il nome del disegno e' l'identita' della voce: `room-living` e' il salotto,
 * `lights` sono le luci. Prima al suo posto c'era l'emoji, e si guardava il
 * testo. */
export async function attendiDisegno(locator, nome) {
  await expect(locator).toHaveAttribute("data-dm-disegno", "casa");
  await expect(locator.locator("[data-dm-art]")).toHaveAttribute("data-dm-art", nome);
}

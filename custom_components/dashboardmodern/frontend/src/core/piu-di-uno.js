/* Quando una cosa sola diventa più d'una, senza spostare niente.
 *
 * È successo tre volte con la stessa forma. Gli impianti dell'energia («ho due
 * misuratori nei due appartamenti»), gli impianti solari («solare termico
 * continua ad avere un solo impianto»), le centrali d'allarme («si può inserire
 * soltanto un alarm_control_panel, ma se si hanno 2 aree la pagina ne gestisce
 * una sola»). Ogni volta la richiesta è la stessa, e ogni volta la trappola è
 * la stessa: la cosa che c'è già è configurata dove è sempre stata, la legge
 * mezza plancia, e spostarla per fare posto alle altre rompe tutto quello che
 * la leggeva.
 *
 * La regola, scritta una volta:
 *
 *   NON SI SPOSTA NIENTE. Quello che si vede in pagina è sempre ciò che sta
 *   scritto nelle mappature di sempre. Le altre stanno in un elenco accanto, e
 *   passare a una di loro vuol dire scriverci le sue.
 *
 * Così nessuno intercetta niente: la scena del guscio, le tessere della Home,
 * la sincronizzazione e il rilevamento automatico continuano a leggere l'unico
 * posto che hanno sempre letto, e leggono quello che si sta guardando. E chi
 * non ha mai chiesto la seconda non ha un elenco, non ha un id, non ha niente
 * da migrare: questo modulo per lui non esiste.
 *
 * `refs` sono le mappature che appartengono a quella cosa — una sola per la
 * centrale d'allarme, tredici per il solare — e sono l'unico parametro che
 * cambia da un caso all'altro.
 */

const pulito = (valore) => String(valore ?? "").trim();

/** Le mappature che appartengono a questa cosa, ripulite. */
export function caselleDi(overrides, refs) {
  const dato = overrides && typeof overrides === "object" ? overrides : {};
  const fuori = {};
  for (const ref of refs || []) {
    const entita = pulito(dato[ref]);
    if (entita) fuori[ref] = entita;
  }
  return fuori;
}

/** Una voce dell'elenco, ripulita. `primo` è l'id che tocca alla prima. */
export function normalizzaVoce(stored, indice, refs, primo) {
  const dato = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  return {
    id: pulito(dato.id) || (indice === 0 ? primo : `${primo}-${indice + 1}`),
    nome: pulito(dato.nome || dato.name),
    caselle: caselleDi(dato.caselle, refs),
  };
}

/**
 * L'elenco, con segnata quella che sta in pagina adesso.
 *
 * Con l'elenco vuoto esce quella scritta nelle mappature, e basta: nessun id
 * inventato e niente da salvare. Con l'elenco pieno, quella scelta porta le
 * mappature — che valgono più della sua copia in lista, perché sono quelle che
 * la pagina legge davvero e quelle che il rilevamento automatico riscrive.
 */
export function elencoConCorrente(stored, overrides, scelta, refs, primo) {
  const attuali = caselleDi(overrides, refs);
  const righe = Array.isArray(stored) ? stored : [];
  if (!righe.length) {
    if (!Object.keys(attuali).length) return [];
    return [{ id: primo, nome: "", caselle: attuali, corrente: true }];
  }
  const lista = righe.map((riga, indice) => normalizzaVoce(riga, indice, refs, primo));
  const quale = lista.some((riga) => riga.id === pulito(scelta)) ? pulito(scelta) : lista[0].id;
  return lista.map((riga) => ({
    ...riga,
    caselle: riga.id === quale && Object.keys(attuali).length ? attuali : riga.caselle,
    corrente: riga.id === quale,
  }));
}

/** Quella che sta in pagina adesso. */
export function corrente(lista) {
  return (Array.isArray(lista) ? lista : []).find((riga) => riga?.corrente) || null;
}

/**
 * Le mappature da scrivere per far vedere un'altra.
 *
 * Torna gli override completi: le altre mappature — l'auto, il server,
 * l'energia — restano quelle che erano, e quelle di questa cosa che la scelta
 * non usa se ne vanno, altrimenti la pagina mostrerebbe metà della vicina.
 */
export function overridesPerScelto(overrides, scelto, refs) {
  const dato = overrides && typeof overrides === "object" ? overrides : {};
  const fuori = { ...dato };
  const caselle = caselleDi(scelto?.caselle, refs);
  for (const ref of refs || []) {
    if (caselle[ref]) fuori[ref] = caselle[ref];
    else delete fuori[ref];
  }
  return fuori;
}

/** Il nome da mostrare, che c'è sempre anche quando non gliene è stato dato uno. */
export function nomeProgressivo(voce, indice = 0, base = "") {
  const suo = pulito(voce?.nome);
  if (suo) return suo;
  return indice === 0 ? base : `${base} ${indice + 1}`;
}

/** Le entità di tutte, quelle parcheggiate comprese. */
export function entitaDiTutte(lista) {
  return (Array.isArray(lista) ? lista : []).flatMap((riga) =>
    Object.values(riga?.caselle || {}).filter(Boolean),
  );
}

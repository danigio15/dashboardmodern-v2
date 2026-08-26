/* Dove va davvero l'energia, dai quattro numeri che la plancia ha.
 *
 * La mappa dei flussi accendeva le linee guardando un numero alla volta:
 * «c'e' solare? allora solare → casa», «la batteria si carica? allora
 * solare → batteria». Ma i quattro numeri parlano INSIEME: di notte la rete
 * puo' alimentare casa E caricare la batteria — e la linea rete → batteria
 * non esisteva proprio — mentre di giorno il solare puo' finire tutto nella
 * batteria senza toccare casa, e la linea solare → casa restava accesa lo
 * stesso. Segnalato con i video alla mano: «il disegno mi indica che rete e
 * batteria stanno alimentando casa; in realta' rete alimenta casa e ricarica
 * batteria», «il solare mi carica la batteria, perche' vedo che va in casa?».
 *
 * Qui i tre numeri sorgente si spartiscono a cascata, con le convenzioni che
 * il runtime ha sempre usato: rete positiva = prelievo, batteria positiva =
 * scarica. Il solare copre prima la carica della batteria, poi l'immissione
 * dichiarata dal segno della rete, e cio' che resta e' suo verso casa; la
 * carica non coperta dal solare arriva dalla rete; la scarica va a casa, e
 * solo l'eventuale immissione non coperta dal solare esce dalla batteria
 * verso la rete. Nessun DOM: solo aritmetica, provabile a tavolino.
 */

const positivo = (value) => (Number.isFinite(value) && value > 0 ? value : 0);

/**
 * I flussi per arco, in watt.
 *
 * @param {{solar?: number, grid?: number, battery?: number}} input
 *   `solar` ≥ 0; `grid` col segno (positivo = prelievo dalla rete);
 *   `battery` col segno (positivo = scarica verso casa).
 */
export function allocateSourceFlows({ solar = 0, grid = 0, battery = 0 } = {}) {
  const sole = positivo(Number(solar));
  const prelievo = positivo(Number(grid));
  const immissione = positivo(-Number(grid));
  const scarica = positivo(Number(battery));
  const carica = positivo(-Number(battery));

  const solarToBattery = Math.min(sole, carica);
  const resto = sole - solarToBattery;
  const solarToGrid = Math.min(resto, immissione);
  const solarToHome = resto - solarToGrid;
  const gridToBattery = Math.min(prelievo, carica - solarToBattery);
  const gridToHome = prelievo - gridToBattery;
  const batteryToGrid = Math.min(scarica, immissione - solarToGrid);
  const batteryToHome = scarica - batteryToGrid;

  return {
    solarToHome,
    solarToBattery,
    solarToGrid,
    gridToHome,
    gridToBattery,
    batteryToHome,
    batteryToGrid,
  };
}

/* La bolla della batteria diceva il numero grezzo, segno compreso: «-201 W»
 * mentre carica. Il segno e' una convenzione del modello, non una cosa che si
 * legge su un pannello: si mostra la grandezza e il verso, con la freccia che
 * entra nella batteria quando si carica ed esce quando alimenta. */
export function batteryReadout(battery = 0, format = (watt) => `${Math.round(watt)} W`) {
  const value = Number(battery);
  if (!Number.isFinite(value) || value === 0) return null;
  return value < 0 ? `▼ ${format(-value)}` : `▲ ${format(value)}`;
}

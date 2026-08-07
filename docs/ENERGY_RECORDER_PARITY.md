# Parità con Home Assistant Energy

DashboardModern usa esclusivamente `recorder/statistics_during_period` e richiede il tipo `sum` in kWh.

| Sensore configurato | Statistica Recorder | Formula giorno/mese/anno |
| --- | --- | --- |
| `state_class: total_increasing` | `sum` normalizzata da Recorder | `sum(fine periodo) - sum(inizio periodo)` |
| `state_class: total` con statistiche a lungo termine | `sum` normalizzata da Recorder | `sum(fine periodo) - sum(inizio periodo)` |
| Sensore esplicito giorno/mese/anno | stato corrente, solo per il periodo corrente | valore del sensore; non viene usato per lo storico |

Recorder incorpora nella propria `sum` i reset del contatore fisico e la normalizzazione dell'unità. DashboardModern non legge `max` o `state` come fallback e non applica una seconda euristica di reset. Per i grafici, ogni bucket è la differenza fra due `sum` Recorder adiacenti; la somma dei bucket coincide quindi con il totale del periodo.

La fixture anonimizzata `tests/fixtures/ha-recorder-energy.json` contiene due reset fisici. Home Assistant Energy restituisce 7,843 kWh. La formula condivisa produce `4134,180 - 4126,337 = 7,843 kWh`; il test di parità verifica sia il totale sia la somma dei bucket del grafico.

## Confini verificati

- Intervallo logico della fixture: `[2026-08-01T00:00:00Z, 2026-08-01T06:00:00Z)`.
- Riga baseline richiesta e non attribuita al periodo: `2026-07-31T23:00:00Z`, `sum = 4126,337 kWh`.
- Riga finale disponibile: `2026-08-01T05:00:00Z`, `sum = 4134,180 kWh`.
- Formula: `4134,180 − 4126,337`.
- Atteso Home Assistant Energy: `7,843 kWh`.
- Ottenuto DashboardModern: `7,843 kWh`.

Per un mese storico chiuso, `end_time` è esattamente il primo istante del mese successivo e quel confine è esclusivo. Per il mese corrente incompleto, `end_time` è l'istante corrente e la formula usa l'ultima `sum` Recorder disponibile. La richiesta parte prima del confine iniziale; l'ultima riga con timestamp strettamente precedente è la baseline, mentre solo le righe con `start >= confine iniziale && start < confine finale` appartengono al periodo. La stessa regola vale per `total` e `total_increasing`, perché i reset e i cambi di unità compatibili sono già normalizzati nella `sum`. Unità incompatibili, `sum` assente e stato `unavailable` non attivano fallback euristici. I sensori giorno/mese/anno sono letti soltanto per il periodo corrente.

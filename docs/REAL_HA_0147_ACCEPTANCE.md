# Verifica reale Home Assistant — blocchi 0.14.7

Questa checklist deriva da prove manuali effettuate in una vera installazione Home Assistant dopo il merge della PR #33. La release pubblica resta bloccata finché ogni voce non è verificata sia in Home Assistant sia nei test automatici.

## Elettrodomestici
- [ ] Card proporzionata su desktop, tablet e smartphone.
- [ ] Eliminare o spiegare visivamente le barre blu prive di funzione comprensibile.
- [ ] Stato ON/OFF leggibile su smartphone senza simboli errati o `X`.
- [ ] Immagine full-bleed mantenuta.

## Report Energia
- [ ] Editor Report coerente graficamente con gli altri editor.
- [ ] Ogni elettrodomestico mostra e conserva l'entità energia configurata.
- [ ] Le entità energia vengono inferite e persistite senza cancellazioni.
- [ ] Gli elettrodomestici configurati compaiono nel Report e nel selettore Dettaglio dispositivo.
- [ ] Salvataggio e reload mantengono ordine, nome, icona ed entità.

## Tapparelle
- [ ] I comandi Apri/Stop/Chiudi nel popup usano il bridge Home Assistant reale e non mostrano "Home Assistant non connesso" quando la dashboard è ospitata in HA.
- [ ] Card più compatte e coerenti con il design generale.
- [ ] Pulsanti singoli e Apri tutte/Chiudi tutte uniformi alle altre sezioni.
- [ ] Stato e percentuale restano leggibili su smartphone.

## Avvisi
- [ ] Ogni avviso salvato, compresi quelli standard, dispone di Modifica e Elimina.
- [ ] Modifica precompila il form e aggiorna l'elemento esistente senza duplicarlo.

## Luci
- [ ] Ogni luce salvata dispone di Modifica e Elimina.
- [ ] Modifica precompila nome, entità e stanza e aggiorna senza duplicati.

## Temperatura
- [ ] Editor allineato alla struttura comune: lista, Modifica/Elimina, form, Salva modifiche e Annulla.
- [ ] Nessun controllo sproporzionato o fuori griglia.

## Coerenza Editor
- [ ] Tutte le sezioni condividono la stessa struttura visuale e gli stessi componenti.
- [ ] Azioni Modifica, Elimina, Salva modifiche e Annulla sono presenti dove applicabili.
- [ ] Tema chiaro/scuro, spaziature, campi entità, pulsanti e righe sono uniformi.

## Regola di rilascio
Non creare il tag `v0.14.7` e non pubblicare la release finché la checklist non è completata e verificata in una vera installazione Home Assistant.

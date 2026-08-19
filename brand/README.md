# L'icona su HACS

HACS non legge l'icona da questo repository: la prende dal catalogo dei marchi
di Home Assistant, `https://brands.home-assistant.io/dashboardmodern/icon.png`.
Finché il dominio non è lì dentro, la scheda dell'integrazione mostra
«icon not available» — non c'è nessun file, in questo repository, che possa
cambiarlo.

I file pronti per la richiesta sono quelli in questa cartella e rispettano i
limiti del catalogo:

| file               | dimensione | limite del catalogo |
| ------------------ | ---------- | ------------------- |
| `icon.png`         | 256×256    | esattamente 256×256 |
| `icon@2x.png`      | 512×512    | esattamente 512×512 |
| `logo.png`         | 512×173    | max 512×256         |
| `logo@2x.png`      | 1024×329   | max 1024×512        |
| `dark_icon.png`    | 256×256    | esattamente 256×256 |
| `dark_icon@2x.png` | 512×512    | esattamente 512×512 |

## Come pubblicarla

1. Fai un fork di [`home-assistant/brands`](https://github.com/home-assistant/brands).
2. Copia questi file in `custom_integrations/dashboardmodern/`.
3. Apri una pull request: la loro CI controlla nomi e dimensioni, che sono
   quelli della tabella qui sopra.
4. Quando la PR è unita, HACS mostra l'icona senza toccare nulla qui — può
   volerci qualche ora perché la CDN si aggiorni.

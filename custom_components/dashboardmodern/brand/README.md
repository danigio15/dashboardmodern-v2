# L'icona su HACS e negli aggiornamenti di Home Assistant

Home Assistant non legge l'icona di un'integrazione dal repository
dell'integrazione. La chiede al catalogo dei marchi,
`https://brands.home-assistant.io/dashboardmodern/icon.png`, dove la cartella
ha lo stesso nome del `domain` scritto in `manifest.json`. Finché il dominio
non è dentro quel catalogo, la scheda in HACS e la riga in **Impostazioni →
Aggiornamenti** mostrano «icon not available»: nessun file di questo
repository può cambiarlo.

Verificato il 22 agosto 2026 su [`home-assistant/brands`](https://github.com/home-assistant/brands):

| percorso                                  | esito                                                |
| ----------------------------------------- | ---------------------------------------------------- |
| `custom_integrations/dashboardmodern`     | **404, non esiste**                                   |
| `custom_integrations/dashboard_modern`    | 404, non esiste                                       |
| `custom_integrations/better_thermostat`   | esiste: `icon.png`, `icon@2x.png`, `logo.png`, `logo@2x.png` |

È esattamente la differenza fra noi e Better Thermostat, che nella stessa
schermata l'icona ce l'ha. Add-on come *Advanced SSH & Web Terminal* o
*SQLite Web* non fanno testo: sono add-on, non integrazioni, e la loro icona
viene dal repository dell'add-on, non da questo catalogo.

## I file pronti

Rispettano le regole del catalogo, che per i loghi vincolano il **lato corto**,
non il lato lungo:

| file               | dimensione | regola del catalogo         |
| ------------------ | ---------- | --------------------------- |
| `icon.png`         | 256×256    | esattamente 256×256          |
| `icon@2x.png`      | 512×512    | esattamente 512×512          |
| `dark_icon.png`    | 256×256    | esattamente 256×256          |
| `dark_icon@2x.png` | 512×512    | esattamente 512×512          |
| `logo.png`         | 512×173    | lato corto fra 128 e 256     |
| `logo@2x.png`      | 1024×329   | lato corto fra 256 e 512     |

Le varianti `dark_` sono facoltative (Better Thermostat non le ha) e servono
per i temi scuri. `tests/test_brand_images.py` verifica firma, formato,
misure, CRC dei chunk e integrità del flusso compresso di tutte e sei, in
entrambe le copie — la stessa cosa che verifica la loro CI.

## Come pubblicarla

1. Fai un fork di [`home-assistant/brands`](https://github.com/home-assistant/brands).
2. Copia questi file in `custom_integrations/dashboardmodern/`:

   ```bash
   git clone https://github.com/<tuo-utente>/brands.git
   cd brands
   git checkout -b dashboardmodern
   mkdir -p custom_integrations/dashboardmodern
   cp /percorso/dashboardmodern-v2/brand/*.png custom_integrations/dashboardmodern/
   git add custom_integrations/dashboardmodern
   git commit -m "Add DashboardModern v2 custom integration brand"
   git push -u origin dashboardmodern
   ```

3. Apri la pull request verso `home-assistant/brands`. La loro CI controlla
   nomi, formato e misure: sono quelli della tabella qui sopra.
4. Il catalogo vieta alle integrazioni personalizzate le immagini con il
   marchio di Home Assistant, per non farle sembrare ufficiali. La nostra
   icona è una casa stilizzata con un fulmine, disegno nostro.
5. Quando la pull request è unita, l'icona compare da sola in HACS e negli
   aggiornamenti: qui non c'è niente da toccare, e nessuna release da fare.
   La CDN può metterci qualche ora.

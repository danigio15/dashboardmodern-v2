# L'icona dell'integrazione

Ci sono due strade, e da Home Assistant 2026.3 la prima è quella buona.

## 1. I file in questa cartella (HA ≥ 2026.3)

Dal 2026.3 Home Assistant serve le immagini di marchio da sé, all'indirizzo
`/api/brands/integration/<dominio>/<file>`, e **prima di chiedere al catalogo
guarda dentro l'integrazione installata**. Il codice è
`homeassistant/components/brands/__init__.py`:

```python
if not integration.has_branding:
    return None
brand_dir = Path(integration.file_path) / "brand"
data = _read_brand_file(brand_dir, image)
```

`has_branding` è `"brand" in self._top_level_files`, cioè: **basta che esista
una cartella `brand/` dentro `custom_components/dashboardmodern/`.** Non c'è
niente da dichiarare nel `manifest.json`.

Questa cartella c'è, e viene spedita nello zip della release — `build_release.py`
la pretende esplicitamente. Perciò su un Home Assistant recente l'icona la
serve questo repository.

I nomi che Home Assistant accetta sono esattamente questi otto, e quando uno
manca ne prova un altro al posto suo:

| file richiesto     | se manca prova            |
| ------------------ | ------------------------- |
| `icon.png`         | —                         |
| `icon@2x.png`      | `icon.png`                |
| `logo.png`         | `icon.png`                |
| `logo@2x.png`      | `logo.png`, `icon.png`    |
| `dark_icon.png`    | `icon.png`                |
| `dark_icon@2x.png` | `icon@2x.png`, `icon.png` |
| `dark_logo.png`    | `dark_icon.png`, `logo.png`, `icon.png` |
| `dark_logo@2x.png` | `dark_icon@2x.png`, `logo@2x.png`, `logo.png`, `icon.png` |

Noi ne spediamo sei; i due `dark_logo` ricadono sui `dark_icon`.

Le misure sono quelle del catalogo, ed è bene rispettarle comunque perché
servono anche alla strada 2:

| file               | dimensione | regola                   |
| ------------------ | ---------- | ------------------------ |
| `icon.png`         | 256×256    | esattamente 256×256      |
| `icon@2x.png`      | 512×512    | esattamente 512×512      |
| `dark_icon.png`    | 256×256    | esattamente 256×256      |
| `dark_icon@2x.png` | 512×512    | esattamente 512×512      |
| `logo.png`         | 512×173    | lato corto fra 128 e 256 |
| `logo@2x.png`      | 1024×329   | lato corto fra 256 e 512 |

`tests/test_brand_images.py` verifica firma, formato, misure, CRC di ogni chunk
e integrità del flusso compresso di tutte e sei, in entrambe le copie — la
stessa cosa che verifica la CI del catalogo. Non è pignoleria: `dark_icon@2x.png`
è rimasto in repository per mesi con il flusso troncato, e dalla riga 409 in giù
era spazzatura. I decodificatori indulgenti mostravano comunque qualcosa.

## 2. Il catalogo dei marchi (HA < 2026.3, e la vetrina di HACS)

Su un Home Assistant più vecchio del 2026.3 la strada 1 non esiste: lì l'icona
la può servire solo `brands.home-assistant.io`, e finché il dominio non è nel
catalogo si legge «icon not available».

**E la strada 1 non copre HACS, nemmeno sul 2026.8.** Il pannello di Home
Assistant chiede le icone al proprio indirizzo locale — `brandsUrl()` in
`src/util/brands-url.ts` costruisce `/api/brands/integration/<dominio>/icon.png`
con un token — ma l'entità di aggiornamento che HACS crea si scrive l'indirizzo
da sola, e va dritta alla CDN (`custom_components/hacs/update.py`):

```python
return f"https://brands.home-assistant.io/_/{self.repository.data.domain}/icon.png"
```

Per questo in **Impostazioni → Aggiornamenti** si legge «icon not available»
anche quando la cartella `brand/` è installata e funziona: quella riga non passa
dal pannello, e nessun file di questo repository la può cambiare. Vale anche per
la scheda del repository dentro HACS prima di installarlo, dove l'integrazione
sul disco non c'è ancora.

Verificato il 22 agosto 2026 su [`home-assistant/brands`](https://github.com/home-assistant/brands):
`custom_integrations/dashboardmodern` **non esiste** (404), mentre
`custom_integrations/better_thermostat` c'è con le sue quattro immagini.

Per iscrivercisi:

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

3. Apri la pull request. La loro CI controlla nomi, formato e misure: sono
   quelli della tabella qui sopra.
4. Il catalogo vieta alle integrazioni personalizzate le immagini con il
   marchio di Home Assistant, per non farle sembrare ufficiali. La nostra icona
   è una casa stilizzata con un fulmine, disegno nostro.
5. A pull request unita l'icona compare da sola: qui non c'è niente da toccare
   e nessuna release da fare. La CDN può metterci qualche ora.

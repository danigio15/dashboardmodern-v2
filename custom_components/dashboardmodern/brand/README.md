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

## 2. Il catalogo dei marchi non accetta più nessuno

La strada del catalogo è **chiusa**. Il modello di pull request di
[`home-assistant/brands`](https://github.com/home-assistant/brands) lo dice
nella prima riga, prima ancora del titolo:

> Pull requests for adding new custom components will no longer be accepted.
> Please refer to the Brands Proxy API announcement for more details.

E le uniche voci fra cui scegliere in «Type of change» parlano tutte di
integrazioni **core**: per una personalizzata non c'è nemmeno la casella da
spuntare. La cartella `custom_integrations/` esiste ancora per chi c'era già,
ed è marcata «legacy» nel loro README: l'hanno chiusa perché la strada 1 la
sostituisce.

Quindi: **non aprire una pull request là, verrebbe respinta.** Le sei immagini
in questa cartella sono già il modo giusto e l'unico.

## Quello che resta rotto, e non dipende da noi

L'entità di aggiornamento che HACS crea si scrive l'indirizzo dell'icona da
sola, e va dritta alla CDN invece di chiederla al pannello
(`custom_components/hacs/update.py`):

```python
return f"https://brands.home-assistant.io/_/{self.repository.data.domain}/icon.png"
```

Per un'integrazione personalizzata quell'indirizzo non risponde — e adesso non
può più farlo, visto che il catalogo non accetta nuove iscrizioni. Per questo in
**Impostazioni → Aggiornamenti** si legge «icon not available» anche con la
cartella `brand/` installata e funzionante.

Non c'è niente in questo repository che lo possa cambiare: la correzione sta in
HACS, che dovrebbe chiedere `/api/brands/integration/<dominio>/icon.png` come fa
il resto del pannello. Fino ad allora l'icona si vede nelle Integrazioni e non
negli Aggiornamenti, ed è tutto quello che si può ottenere.

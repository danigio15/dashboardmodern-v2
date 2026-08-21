# Translations

The dashboard used to speak two languages because it contained two of
everything: a `t(it, en)` ternary at every call site, a second column in every
`locale === "en" ? … : …` switch in the core, and two vendored runtime builds.
Adding a third language meant a third copy of all of it, so nobody ever did.

The language is now a lookup, not a fork. This is how it fits together and what
it takes to add a language.

## English is the pivot

Every catalog is keyed by the **English** string. That is the one decision the
rest follows from:

- `t("Chiudi", "Close")` looks up `"Close"`. Italian is returned as written only
  when Italian is the active language.
- A key with no entry renders as its English source. A French user missing an
  entry reads English, which they have a chance with — never Italian, which was
  the old failure mode.
- The vendored Italian shell paints Italian directly into the DOM. The DOM pass
  maps that text to its English key through `src/i18n/source-index.js` first, so
  one set of catalogs covers both vendored builds.

## The pieces

| File | What it does |
| --- | --- |
| `src/core/i18n.js` | Locale registry, BCP 47 resolution, catalog store, on-demand loading |
| `src/core/i18n-dom.js` | Translates what this codebase does not render: the vendored shell and runtime |
| `src/i18n/<code>.js` | One catalog per language, fetched only when that language is active |
| `src/i18n/source-index.js` | Italian source text → English pivot key (generated) |
| `src/sections/i18n-section.js` | Settles the locale before anything renders, keeps the DOM pass fed |
| `tests/i18n-message-keys.js` | The keys every catalog must answer (generated) |
| `scripts/extract-i18n-keys.mjs` | Regenerates both generated files from the source |
| `custom_components/dashboardmodern/translations/` | Home Assistant's own config and options dialogs |

## Which language a user gets

In order, first match wins:

1. `window.__DASHBOARDMODERN_LOCALE__`, which the host writes from the signed-in
   user's Home Assistant profile language;
2. a choice stored on the device (`?lang=` / `?locale=`, remembered afterwards);
3. `<html lang>` of the document;
4. the vendored shell the page was loaded from;
5. the language the source is written in.

`navigator.language` is deliberately **not** consulted. The dashboard follows
the Home Assistant profile, so two devices in the same house do not disagree —
and a headless environment is not mistaken for an English user because Node
reports `en-US`.

## Adding a language

1. **Register it** in `LOCALE_REGISTRY` in `src/core/i18n.js`: code, English
   name, native name, direction, `Intl` tag, and which vendored shell it starts
   from (`dashboard-en.html` for everything except Italian).
2. **Write the catalog** at `src/i18n/<code>.js`: a frozen object mapping every
   key in `tests/i18n-message-keys.js` to your language. Regional variants need
   no file — `pt-BR` resolves to `pt` on its own.
3. **Translate the setup dialogs** at
   `custom_components/dashboardmodern/translations/<code>.json`, matching the
   keys in `strings.json`. Home Assistant renders those itself; the frontend
   engine never sees them.
4. **Run the checks:**
   ```
   npm run check:i18n     # the generated corpus is in sync with the source
   npm run test:frontend  # includes the catalog contract below
   python -m pytest -q    # includes the integration-strings contract
   ```

### What the tests will hold you to

- Every key answered, no key invented.
- Every `${…}` placeholder preserved. The order may change — languages put the
  number in different places — but a dropped placeholder renders a count with no
  number in it.
- No entry left sitting as its English source. Words that genuinely coincide are
  declared per language in `tests/i18n-catalogs.test.js`, so a real omission
  cannot hide behind another language's legitimate coincidence.
- A language offered in the picker must reach a catalog, its own or a bridged
  one. Offering a language that then renders English is worse than not offering
  it: the user thinks they picked wrong.

## Adding or changing a string

Write it as a pair — `t("Italiano", "English")` in a section,
`pick("Italiano", "English", locale)` in the core — and run:

```
node scripts/extract-i18n-keys.mjs
```

That regenerates the key list and the source index from the source. `npm run
check:i18n` fails when they drift, so a reworded call site cannot quietly leave
thirteen catalogs answering a key that no longer exists.

The extractor reads every place a bilingual pair is authored: `t()` in the
sections, `pick()` in the core and in `legacy/modules-entry.js`, the
`COPY_SOURCE` table, the `{ it, en }` rows of the room, action, load-icon and
appliance catalogs, the alert-icon table, and the hand-paired shell vocabulary
in `scripts/i18n-shell-vocabulary.json`. An indirection it cannot see through —
a local `say()` wrapper, say — is an indirection that silently keeps strings out
of every catalog.

## The vendored English shell is half-translated

`dashboard-en.html` was translated by hand from the Italian shell and the pass
was never finished. An English user still reads "⚡ Energy Erogata (da HA)" and
"Consumo Total". The file is regenerated from upstream, so it cannot be fixed in
place — instead `scripts/i18n-shell-aliases.json` maps each broken string onto
the key it should have had, and the DOM pass repairs it. English gets the same
treatment as every other language, through the same mechanism.

That file is also where an ambiguity is settled. The index is keyed by source
text, so the same Italian word can only mean one thing: "Energia" is *Power* on
a card and *Energy* in the navigation. The tie-break is what the **vendored
build** means by it, because the index exists for the DOM pass and the DOM pass
never sees a section's own wording — `t()` goes straight to the catalog. Sources
are therefore merged weakest-first: call sites, then the data tables, then the
shell vocabulary, then the aliases.

A test walks both shells and fails on any visible string that is neither a key
nor mapped to one, with the units, acronyms and product names that legitimately
stay put listed explicitly.

## Copy belongs in the DOM

Text written into a CSS `content:` declaration produces no text node, so neither
the catalog nor the DOM pass can reach it afterwards. Three sections do it
anyway, because it lets a class the legacy runtime toggles decide the wording
without duplicating that logic in JS. Those build the declaration from `t()` and
call `restyleOnLocaleChange`, which rebuilds the stylesheet when the language
changes. That is the exception, and it should stay the only one.

## Where the catalogs came from

The corpus is the visible vocabulary of the dashboard, collected from the source
rather than curated beside it. The thirteen catalogs shipped here were written
against the English pivot with the Italian original alongside for context, which
is why the phrasing follows the Italian intent rather than a literal reading of
the English. Corrections from native speakers are welcome and are the reason the
per-language coincidence lists are explicit: they show exactly which words were
judged to legitimately match English.

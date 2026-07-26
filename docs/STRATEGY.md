# Strategy

## The shipped document is the interface

The dashboard users see is `frontend/legacy/dashboard.html`. It stays that way.

This was decided after trying the alternative. A parallel native renderer has to
reach a 892KB document with 328 functions from nothing, and every piece of it is
either identical — in which case rewriting bought nothing — or different, in
which case the result is a dashboard the user recognises as worse. That is
structural, not bad luck.

Two constraints settle it:

- **Graphical and behavioural identity with the document.** Keeping the document
  achieves this by construction rather than by effort.
- **Easy updates without users handling an HTML file.** This is already true:
  the integration ships the document, HACS updates it, and the static mount is
  keyed on a content digest so browsers pick it up on the next load. Rewriting
  does not improve it.

So rewriting would cost months to regain what already exists, with a
demonstrated risk of not regaining it.

## What moves out of the document

Logic, one piece at a time, into tested modules the document calls. The code
that draws is not touched, so the pixels cannot change.

`frontend/legacy/modules-entry.js` is loaded by the document the same way it
already loads `config.js`, and exposes one namespace, `DashboardModernModules`.
It imports the same sources the rest of the integration uses: there is one
implementation of each rule, not one here and a copy in a renderer elsewhere.
`version` lets a section check what it can rely on instead of feature-detecting
each function.

Moved so far: unit conversion, appliance cycle tracking, light capabilities,
long-term statistics, and pool water assessment.

## What the integration provides

- Distribution and updates through HACS, with content-keyed cache invalidation.
- The authenticated bridge, which puts no credential in the document's page.
- Configuration shared across devices, with concurrent edits detected.
- Entity discovery: slots, ranked suggestions with their reasons, and
  corrections that are remembered.
- The tested logic modules above.

## What the native renderer is now

Preparation, not product. The cards, the entity picker and the section
registries are how configuration is edited and how logic is exercised under
test. The idea that it replaces the document is set aside — explicitly, rather
than left as an intention that keeps being deferred.

The panel falls back to it when nothing has been vendored, which is a
development checkout.

## New sections

Built as sections of the document, using its existing CSS, so they are identical
to the others from the first commit — with their logic in modules here rather
than in another few hundred inline lines.

The cost of this strategy is that the monolith remains. That is the debt paid
for graphical identity, and the two constraints above are what require paying it.

# Section roadmap

The agreed navigation is seventeen sections. This records how each one lands on
the architecture, and — more usefully — where the architecture is not yet ready
for it.

`discovery/navigation.py` holds the order as a constant, so a freshly detected
dashboard already reads in it. The order is a default: the navbar is
reorderable, sections can be hidden or pinned, and desktop and mobile can
differ. Those are user configuration, not constraints.

## Detection coverage

| Section | Detected from | Confidence |
|---|---|---|
| Home | — | not detected; composed from other sections |
| Rooms, areas, floors | area registry, per area | high |
| Lights | `light` | high |
| Climate | `climate`, `water_heater` | high |
| Covers | `cover` | high |
| Energy | `sensor` with device class power/energy | high |
| Appliances | `vacuum`, `humidifier`, `fan` | partial |
| Irrigation | `valve`, name hints | review |
| Pool | name hints | review |
| Security | `lock`, `alarm_control_panel`, opening classes | high |
| Cameras | `camera` | high |
| Vehicles | name hints | review |
| Server | name hints | review |
| Media | `media_player` | high |
| People | `person`, `device_tracker` | high |
| Statistics | — | not detected; derived from other sections |
| Settings | — | fixed integration UI |

Four sections have no device class to rely on, because Home Assistant does not
model pools, irrigation, vehicles or servers. Those detectors are name
heuristics, run last so a stronger detector keeps its claim, and are marked
`confidence: review` so the confirmation step shows them for approval instead of
accepting them silently. That flag is the honest part of the design: a wrong
guess the user can see is fine, a wrong guess presented as fact is not.

## Capabilities, not just domains

The sections with the most detail are exactly the ones a domain cannot describe.
An RGBWW light and a relay are both `light`; a venetian blind and a garage door
are both `cover`. Colour wheel, white channel, tilt, PTZ, source selection and
multiroom grouping all depend on what an entity *supports*, not what it *is*.

`discovery/capabilities.py` derives semantic capabilities from
`supported_color_modes`, `supported_features`, `effect_list` and `hvac_modes`,
and every candidate carries them. Detectors and, later, card renderers branch on
`candidate.can("tilt")` rather than re-reading raw attributes.

Values are semantic strings, not Home Assistant bitmask constants, so nothing
downstream imports Home Assistant and the meaning survives a constant being
renumbered upstream.

## The panel shows the dashboard

The shipped document is the interface and fills the panel. See `STRATEGY.md`
for why, and for what moves out of it instead.

New sections are built as sections of the document, with their logic in tested
modules the document calls. The detection, slots and matching described below
feed those sections; the native renderer exercises the same modules under test
and is not what users see.

## Rooms are configured once

Rooms are a shared registry, not a field each section invents. A room has an
id, name, icon, floor, and the Home Assistant areas it adopts. Sections
reference a room id, so renaming a room, merging two of them or moving one to
another floor changes every room-grouped section at once.

Assignment resolves through a chain:

    explicit assignment  ->  linked Home Assistant area  ->  unassigned

The middle link is what makes it usable. Home Assistant already knows the area
of most entities, so importing areas as rooms leaves almost nothing to assign
by hand. The explicit layer is for the entities Home Assistant cannot place and
for the cases where the user disagrees with it.

Three rules that are easy to get wrong:

- Several areas may map to one room. "Cucina" and "Angolo cottura" can be one
  room on the dashboard while staying separate in Home Assistant. One area
  mapping to two rooms is rejected, because grouping would become dependent on
  registry order.
- An assignment pointing at a deleted room resolves to unassigned, not back to
  the area. Falling back would resurrect a value the user deliberately
  overrode.
- Only areas that carry entities become rooms on import. An empty area would
  produce a room the user has to delete.

Entities that resolve to no room collect under a single unassigned bucket,
ordered last, so leftovers stay visible without pushing real rooms down.

## The alarm code is never stored

DashboardModern holds no alarm code, in configuration or anywhere else, and
there is no screen to set one. An alarm integration hashes its codes and
validates them itself; a code the dashboard could read back would be a code
sitting in browser-readable storage, and a code the dashboard validated itself
would be a lock that opens without asking the lock.

What the panel entity does expose is the shape of the keypad to build:

- `supported_features` — which arm modes exist. Offering a night button to a
  panel that has no night mode produces an action that cannot succeed.
- `code_format` — `number`, `text` or none. A four-digit numeric keypad cannot
  enter a six-digit or alphanumeric code, and prompting at all is wrong when
  the panel wants no code.
- `code_arm_required` — whether arming needs a code, which is often false while
  disarming still requires one.

The typed code is handed straight to the service and the alarm integration
decides. The result then has to be shown: a call that fails and a call that
succeeds are indistinguishable to a user if nothing reads the response.

## Cross-cutting requirements

Already done:

- Graphics identical to the original: the token layer carries the legacy `:root`
  values, and the hosted dashboard *is* the original.
- No long-lived token: the session comes from the panel; the wizard's connection
  step is skipped when the integration supplies it, and the bake-download
  control is hidden because baking a 30-minute token into a file is meaningless.
- Versioned cache and HACS updates: the static mount is keyed on a content
  digest of every shipped asset.
- Light and dark theme: an explicit `[data-theme]` choice wins over the system
  preference, which the legacy toggle needs.

Done since:

- **Entity references.** A Card now carries role-keyed Home Assistant
  references — `power`, `energy`, `light`, `cover` — validated for shape and
  omitted from the payload when empty, so every card type that existed before
  keeps its exact serialization. This was the blocker under every native
  section.
- **The absent-reading contract.** `runtime/entity-state.js` decides once what
  unbound, missing, unavailable, unknown and stale mean. `value` is null unless
  the reading is usable, so a sensor that dropped off cannot be rendered as a
  zero.

- **Shared settings storage.** `persistence/settings.py` keeps section
  configuration in Home Assistant `Store`, which is server-side, backed up and
  identical on every device. Not the recorder database: that holds state
  history and is pruned, so configuration written there would eventually be
  deleted out from under the user.

  Shared storage introduces a problem local storage did not have. Two devices
  can edit at once, and last-write-wins would silently discard whichever save
  arrived second with no way for that user to know. Every read returns a
  revision and an interactive write must present the revision it was based on;
  a stale one is refused rather than merged, because the store cannot know
  which of two conflicting intentions was meant. Reading is available to any
  authenticated user, since rendering needs it; writing requires admin.

- **Live state in every section.** Section cards are declarations over one
  factory rather than a module each, so the absent-reading contract, the unit
  handling and the never-invent-a-value rule are applied once instead of being
  forgotten in the eleventh card. Controls come from what a device reports
  supporting.
- **Legacy configuration import.** A one-way import into shared settings that
  runs once, keeps keys it does not recognise rather than dropping them, and
  never carries the stored token across.

- **Navigation arrangement.** Order, per-breakpoint visibility and pinning,
  stored server-side.
- **Long-term statistics.** Queried from the recorder directly rather than
  proxied: the data lives in its database and a second source of truth would
  add a hop for nothing.

Still open:

1. **Detection to configuration.** Detection produces `DetectedSection` values
   and the room registry produces rooms; the matcher ranks candidates for each
   slot. All three now have somewhere to be written. What is missing is the
   step that applies a confirmed detection run: turning accepted suggestions
   into card bindings and room assignments in one write. Until it lands, the
   suggestions are visible but each one is applied by hand.

Everything else that blocked a section has landed. This is the last dependency
between the pieces; the remaining work is per-section polish, which no longer
blocks anything else.

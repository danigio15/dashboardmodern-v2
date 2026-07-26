# DashboardModern Product Vision

DashboardModern v2 is a highly configurable smart-home dashboard platform: **the WordPress of Home Assistant dashboards**. The legacy DashboardModern repository is the baseline for visual and UX parity, while v2 must be substantially more configurable, modular, and safe to extend.

## Philosophy and identity

DashboardModern should feel premium: calm, fast, responsive, polished, and spatially consistent. Users configure a dashboard first; code supplies safe contracts, defaults, editors, widgets, and module metadata. Visual identity is token-driven, supports light and dark themes, respects branding configuration, and avoids one-off screen implementations.

## Architecture boundaries

The approved flow is: Frontend → authenticated Home Assistant WebSocket API → Application Service → Domain → Home Assistant JSON Store. Frontend components, cards, widgets, sections, and navigation never make direct WebSocket calls and never persist directly. DashboardModern does not use Lovelace, Lovelace YAML, dashboard YAML, or `runtime.hass` escape hatches.

## Configurable hierarchy

The product hierarchy is Dashboard → View → Section → Widget/Card. Sections are functional layout containers. Widgets are small reusable functional units that modules compose inside sections or cards. Cards remain larger rendered surfaces and are not replaced in this foundation PR.

## Modules and plugins

Future domains are modules, not hard-coded screens: Home, Rooms, Lights, Climate, Covers, Energy, Appliances, Irrigation, Pool, Security, Cameras, Vehicles, Server, Media, People, Statistics, and Configuration. A module may own plugins, sections, widgets, cards, editors, navigation entries, badges, actions, detail panels/popups, default layouts, and discovery metadata. Registration is internal and deterministic; dynamic remote loading is a future capability, not a v2 foundation requirement.

## Navigation philosophy

Navigation is derived from enabled, visible registered sections and adapts to measured available width rather than device labels. Bottom navigation supports fixed and auto-hide visibility independently from overflow modes. Horizontal scroll is the default overflow; an accessible More menu is optional. Active sections are clearly indicated, keyboard reachable, safe-area aware, and preserved across narrow desktop windows, split-screen, tablets, foldables, and phones.

## Responsive UX and accessibility

DashboardModern must work at high zoom, keep focus indicators visible, provide ARIA roles and selected states, respect `prefers-reduced-motion`, maintain touch targets, avoid content hidden behind fixed UI, and respond to actual container size. Templates should eventually provide complete starting points while remaining configuration-first.

## Roadmap

Near term: product contracts, registries, navigation, editor panels, persistence validation, and parity foundations. Mid term: reusable domain modules, richer widgets, templates, detail panels, badge resolvers, and setup/discovery flows. Long term: safe third-party plugin packaging, marketplace-like discovery, theme/template ecosystems, and migration tools.

## Development rules and anti-goals

Do not add unrelated backend changes, direct Home Assistant access from cards/widgets/navigation, direct persistence from frontend components, Lovelace compatibility layers, hard-coded functional screens, user-agent responsive logic, or complete future modules before their contracts and editors are ready.

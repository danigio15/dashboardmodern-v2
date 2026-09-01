/* Gli oggetti delle tessere: disegni, non simboli.
 *
 * Sulla plancia le tessere portavano un'emoji. Ogni sistema le disegna a modo
 * suo — la lampadina di Android non e' quella di iOS, e accanto al fiocco di
 * neve piatto arrivava un termometro lucido — cosi' sei tessere vicine avevano
 * sei stili diversi. La strada opposta, i simboli a filo tutti uguali, e'
 * peggio: sembrano finti, e una lampadina spenta a contorno grigio non sembra
 * una lampadina.
 *
 * Qui ci sono oggetti: vetro, riflesso, ghiera di metallo, e sotto ognuno la
 * sua ombra. Una sola fonte di luce per tutti, in alto a sinistra, ed e'
 * quello che li tiene insieme — non lo spessore della linea.
 *
 * Ogni disegno sta in una griglia di 32x32 e si porta dietro le proprie
 * sfumature. Due tessere che mostrano lo stesso oggetto ripetono gli stessi
 * identificatori: le definizioni sono identiche, quindi il disegno non cambia
 * — ma perche' quella frase sia vera bisogna che a rispondere ci sia una
 * definizione DISEGNATA, e non era garantito: vedi «il foglio delle
 * sfumature» in fondo al file, che e' il pezzo che lo garantisce.
 * Le tessere che uno si costruisce da se' ("custom-...") non hanno un oggetto
 * nostro: per quelle resta il simbolo scelto da chi le ha fatte.
 */

const OMBRA = (cx, cy, rx) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="1.8" fill="#0b1220" opacity=".14"/>`;

const OGGETTI = Object.freeze({
  /* La lampadina: bulbo caldo, ghiera di metallo, il riflesso del vetro. */
  luci: `<defs>
      <radialGradient id="dmoLuceB" cx=".4" cy=".33" r=".75">
        <stop offset="0" stop-color="#fffbe8"/><stop offset=".45" stop-color="#fcd34d"/>
        <stop offset="1" stop-color="#f59e0b"/></radialGradient>
      <linearGradient id="dmoLuceG" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#cbd5e1"/><stop offset="1" stop-color="#7c8ba1"/></linearGradient></defs>
    ${OMBRA(16, 27.6, 6.6)}
    <path d="M16 3a8.6 8.6 0 0 0-5 15.5c.8.6 1.3 1.5 1.5 2.5l.2 1h6.6l.2-1c.2-1 .7-1.9 1.5-2.5A8.6 8.6 0 0 0 16 3Z" fill="url(#dmoLuceB)"/>
    <path d="M12.4 22.6h7.2v1.6a2 2 0 0 1-2 2h-3.2a2 2 0 0 1-2-2Z" fill="url(#dmoLuceG)"/>
    <path d="M13.4 24.6h5.2" stroke="#fff" stroke-opacity=".45" stroke-width="1.1"/>
    <path d="M12.6 7.4a6 6 0 0 0-2.2 4.2" stroke="#fff" stroke-opacity=".8" stroke-width="1.7" fill="none" stroke-linecap="round"/>`,

  /* Il fiocco: sei bracci di ghiaccio e il cuore chiaro nel mezzo. */
  clima: `<defs>
      <linearGradient id="dmoGelo" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#e0f2fe"/><stop offset=".5" stop-color="#38bdf8"/>
        <stop offset="1" stop-color="#0284c7"/></linearGradient></defs>
    <g stroke="url(#dmoGelo)" stroke-width="3" stroke-linecap="round">
      <path d="M16 4v24M6.4 9.6l19.2 12.8M25.6 9.6 6.4 22.4"/></g>
    <g stroke="url(#dmoGelo)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none">
      <path d="m12.6 7.4 3.4 2.6 3.4-2.6M12.6 24.6l3.4-2.6 3.4 2.6"/></g>
    <circle cx="16" cy="16" r="2.4" fill="#fff" opacity=".9"/>`,

  /* Il termometro: mercurio dentro il vetro, e le tacche della scala. */
  temperatura: `<defs>
      <linearGradient id="dmoMerc" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#fecaca"/><stop offset=".45" stop-color="#ef4444"/>
        <stop offset="1" stop-color="#b91c1c"/></linearGradient>
      <linearGradient id="dmoVetro" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#e2e8f0"/>
        <stop offset="1" stop-color="#b6c2d2"/></linearGradient></defs>
    ${OMBRA(16, 29.2, 6)}
    <path d="M19.4 18.2V6.6a3.4 3.4 0 1 0-6.8 0v11.6a6 6 0 1 0 6.8 0Z" fill="url(#dmoVetro)"/>
    <circle cx="16" cy="22.6" r="4.1" fill="url(#dmoMerc)"/>
    <rect x="14.6" y="9.4" width="2.8" height="11.4" rx="1.4" fill="url(#dmoMerc)"/>
    <path d="M14.2 7.6v9.4" stroke="#fff" stroke-opacity=".75" stroke-width="1.1" stroke-linecap="round"/>
    <g stroke="#94a3b8" stroke-width="1.1" stroke-linecap="round">
      <path d="M20.8 10.6h2.2M20.8 13.8h1.4M20.8 17h2.2"/></g>`,

  /* L'auto: scocca lucida, parabrezza chiaro, ruote in ombra. */
  ev: `<defs>
      <linearGradient id="dmoScocca" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#67e8f9"/><stop offset=".55" stop-color="#06b6d4"/>
        <stop offset="1" stop-color="#0e7490"/></linearGradient>
      <linearGradient id="dmoParab" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#f1f9ff"/><stop offset="1" stop-color="#a5c8dd"/></linearGradient></defs>
    ${OMBRA(16, 26.4, 10.6)}
    <path d="M4.4 22.4v-4.2l2.2-5.4A3 3 0 0 1 9.4 11h13.2a3 3 0 0 1 2.8 1.8l2.2 5.4v4.2a1.6 1.6 0 0 1-1.6 1.6h-1.6a1.6 1.6 0 0 1-1.6-1.6v-.8H9.2v.8a1.6 1.6 0 0 1-1.6 1.6H6a1.6 1.6 0 0 1-1.6-1.6Z" fill="url(#dmoScocca)"/>
    <path d="M8.6 17.4 10.2 13h11.6l1.6 4.4Z" fill="url(#dmoParab)"/>
    <circle cx="9.6" cy="18.9" r="1.5" fill="#0b1220" opacity=".5"/>
    <circle cx="22.4" cy="18.9" r="1.5" fill="#0b1220" opacity=".5"/>
    <path d="M6.6 14.8h18.8" stroke="#fff" stroke-opacity=".3" stroke-width="1"/>`,

  /* Il sole del solare termico: disco caldo e raggi corti. */
  solare: `<defs>
      <radialGradient id="dmoSole" cx=".38" cy=".34" r=".72">
        <stop offset="0" stop-color="#fff7d6"/><stop offset=".5" stop-color="#fbbf24"/>
        <stop offset="1" stop-color="#ea580c"/></radialGradient></defs>
    <g stroke="#f59e0b" stroke-width="2.6" stroke-linecap="round" opacity=".92">
      <path d="M16 2.8v3.2M16 26v3.2M29.2 16H26M6 16H2.8M25.4 6.6l-2.2 2.2M8.8 23.2l-2.2 2.2M25.4 25.4l-2.2-2.2M8.8 8.8 6.6 6.6"/></g>
    <circle cx="16" cy="16" r="7.4" fill="url(#dmoSole)"/>
    <path d="M11.9 11.5a5.5 5.5 0 0 0-1.6 3.3" stroke="#fff" stroke-opacity=".7" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,

  /* Lo scaldabagno: il serbatoio di lamiera, l'acqua calda che sale dal fondo,
   * la spia della resistenza. Non e' il sole del solare termico — quello scalda
   * da fuori, questo da dentro, e si vede. */
  scaldabagno: `<defs>
      <linearGradient id="dmoScaldC" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#f8fafc"/><stop offset=".45" stop-color="#dbe3ec"/>
        <stop offset="1" stop-color="#9aa9bb"/></linearGradient>
      <linearGradient id="dmoScaldA" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stop-color="#ea580c"/><stop offset=".55" stop-color="#f97316"/>
        <stop offset="1" stop-color="#fbbf24"/></linearGradient></defs>
    ${OMBRA(16, 29.4, 6.4)}
    <rect x="8.4" y="3.4" width="15.2" height="24" rx="7" fill="url(#dmoScaldC)"/>
    <path d="M10.6 15.6h10.8v6.6a5.4 5.4 0 0 1-5.4 5.4 5.4 5.4 0 0 1-5.4-5.4Z" fill="url(#dmoScaldA)"/>
    <rect x="13.6" y="1.6" width="4.8" height="2.6" rx="1.3" fill="#94a3b8"/>
    <path d="M11.2 8a4.6 4.6 0 0 1 2.8-2.8" stroke="#fff" stroke-opacity=".85" stroke-width="1.6"
      fill="none" stroke-linecap="round"/>
    <circle cx="20.4" cy="11.4" r="1.5" fill="#ef4444"/>
    <path d="M11.6 28.4v2M20.4 28.4v2" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round"/>`,

  /* La caldaia: la scocca a muro, l'oblo' del bruciatore con la fiamma dentro,
   * i due attacchi sotto. Non e' il serbatoio dello scaldabagno — quella
   * scalda e basta, questa serve anche i termosifoni. */
  caldaia: `<defs>
      <linearGradient id="dmoCaldC" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#dbe3ec"/>
        <stop offset="1" stop-color="#a9b6c6"/></linearGradient>
      <radialGradient id="dmoCaldF" cx=".5" cy="1" r=".9">
        <stop offset="0" stop-color="#fde68a"/><stop offset=".5" stop-color="#fb923c"/>
        <stop offset="1" stop-color="#ea580c"/></radialGradient></defs>
    ${OMBRA(16, 28.8, 7.2)}
    <rect x="4.6" y="4.2" width="22.8" height="21" rx="3.4" fill="url(#dmoCaldC)"/>
    <rect x="7.4" y="6.8" width="17.2" height="4.2" rx="1.8" fill="#f8fafc"/>
    <circle cx="22" cy="8.9" r="1.4" fill="#38bdf8"/>
    <rect x="10.4" y="13.4" width="11.2" height="8.4" rx="2.2" fill="#0b1220"/>
    <path d="M16 15.4c1.6 1.5 2.4 2.7 2.4 3.7a2.4 2.4 0 0 1-4.8 0c0-.7.3-1.4.9-2 .1.8.5 1.2 1.1 1.3-.2-1.2 0-2.2.4-3Z" fill="url(#dmoCaldF)"/>
    <path d="M9.6 25.2v3M22.4 25.2v3" stroke="#94a3b8" stroke-width="1.9" stroke-linecap="round"/>`,

  /* La porta: pannello, maniglia, e il pavimento sotto. */
  aperture: `<defs>
      <linearGradient id="dmoPorta" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#fca5a5"/><stop offset=".5" stop-color="#ef4444"/>
        <stop offset="1" stop-color="#b91c1c"/></linearGradient></defs>
    ${OMBRA(16, 28.6, 8.4)}
    <path d="M4.4 27.4h23.2" stroke="#94a3b8" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M8.6 27V6.4A1.4 1.4 0 0 1 10 5h12a1.4 1.4 0 0 1 1.4 1.4V27Z" fill="url(#dmoPorta)"/>
    <path d="M10.8 7.2h4V25h-4Z" fill="#fff" opacity=".17"/>
    <circle cx="20.4" cy="16.4" r="1.4" fill="#fff" opacity=".9"/>`,

  /* La tapparella: infisso e stecche mezze calate. */
  tapparelle: `<defs>
      <linearGradient id="dmoInfisso" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ede9fe"/><stop offset="1" stop-color="#a78bfa"/></linearGradient>
      <linearGradient id="dmoStecche" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#a78bfa"/><stop offset="1" stop-color="#6d28d9"/></linearGradient></defs>
    <rect x="4.4" y="4.4" width="23.2" height="23.2" rx="2.6" fill="url(#dmoInfisso)"/>
    <rect x="7" y="7" width="18" height="18" rx="1.4" fill="#dbeafe"/>
    <path d="M9.4 22.6 13 10.6" stroke="#fff" stroke-opacity=".7" stroke-width="2" stroke-linecap="round"/>
    <g fill="url(#dmoStecche)">
      <rect x="7" y="7" width="18" height="3" rx="1"/>
      <rect x="7" y="10.8" width="18" height="3" rx="1"/>
      <rect x="7" y="14.6" width="18" height="3" rx="1"/></g>
    <rect x="4.4" y="4.4" width="23.2" height="23.2" rx="2.6" fill="none" stroke="#7c3aed" stroke-opacity=".45" stroke-width="1.4"/>`,

  /* Lo scudo: la piastra e il suo lucido. */
  sicurezza: `<defs>
      <linearGradient id="dmoScudo" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#6ee7b7"/><stop offset=".55" stop-color="#10b981"/>
        <stop offset="1" stop-color="#047857"/></linearGradient></defs>
    ${OMBRA(16, 29, 6.4)}
    <path d="M16 3.2 26 6.8v8.4c0 6-4.2 10.2-10 12.4-5.8-2.2-10-6.4-10-12.4V6.8Z" fill="url(#dmoScudo)"/>
    <path d="M16 5.4 8 8.2v7c0 4.6 3.2 8 8 9.9Z" fill="#fff" opacity=".18"/>
    <path d="m11.6 15.6 3.2 3.2 5.8-6.2" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,

  /* La telecamera: corpo, obiettivo di vetro, spia accesa. */
  telecamere: `<defs>
      <linearGradient id="dmoCam" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#7dd3fc"/><stop offset=".55" stop-color="#0284c7"/>
        <stop offset="1" stop-color="#075985"/></linearGradient>
      <radialGradient id="dmoLente" cx=".36" cy=".33" r=".7">
        <stop offset="0" stop-color="#e0f2fe"/><stop offset=".6" stop-color="#0f2942"/>
        <stop offset="1" stop-color="#020c18"/></radialGradient></defs>
    ${OMBRA(16, 27.4, 8.6)}
    <rect x="4.6" y="9" width="19.6" height="14" rx="3.4" fill="url(#dmoCam)"/>
    <path d="m24.2 14.4 4.6-2.8v9l-4.6-2.8Z" fill="url(#dmoCam)"/>
    <circle cx="12.6" cy="16" r="4.6" fill="url(#dmoLente)"/>
    <circle cx="11" cy="14.4" r="1.4" fill="#fff" opacity=".7"/>
    <circle cx="20.6" cy="12.4" r="1.3" fill="#f87171"/>
    <path d="M6.4 11.4h7" stroke="#fff" stroke-opacity=".35" stroke-width="1.2" stroke-linecap="round"/>`,

  /* Il fulmine dell'energia, con il suo bagliore. */
  energia: `<defs>
      <linearGradient id="dmoLampo" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#fed7aa"/><stop offset=".45" stop-color="#f97316"/>
        <stop offset="1" stop-color="#c2410c"/></linearGradient></defs>
    ${OMBRA(16, 28.6, 6.2)}
    <path d="M18.6 2 7.4 17.2h6.8L12.8 30l12-16.4h-7.4Z" fill="url(#dmoLampo)"/>
    <path d="M17.6 4.6 10.4 15.4h3.2" stroke="#fff" stroke-opacity=".55" stroke-width="1.4" fill="none" stroke-linecap="round"/>`,

  /* La lavatrice: obl&ograve; di vetro e cassetto del detersivo. */
  elettrodomestici: `<defs>
      <linearGradient id="dmoElet" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#cffafe"/><stop offset="1" stop-color="#a5b4c4"/></linearGradient>
      <radialGradient id="dmoOblo" cx=".38" cy=".34" r=".72">
        <stop offset="0" stop-color="#e0f2fe"/><stop offset=".55" stop-color="#22d3ee"/>
        <stop offset="1" stop-color="#0e7490"/></radialGradient></defs>
    ${OMBRA(16, 28.8, 8)}
    <rect x="5.6" y="3.4" width="20.8" height="24.4" rx="3.4" fill="url(#dmoElet)" stroke="#94a3b8" stroke-opacity=".5" stroke-width="1.2"/>
    <rect x="8.4" y="6.2" width="10.4" height="3.2" rx="1.4" fill="#fff" opacity=".85"/>
    <circle cx="22.4" cy="7.8" r="1.5" fill="#22d3ee"/>
    <circle cx="16" cy="18.6" r="7" fill="url(#dmoOblo)"/>
    <circle cx="16" cy="18.6" r="4.4" fill="#0b1220" opacity=".22"/>
    <path d="M12.4 15a5 5 0 0 0-1.4 3" stroke="#fff" stroke-opacity=".75" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,

  /* La lista delle cose da fare: foglio, spunta e righe. */
  todo: `<defs>
      <linearGradient id="dmoFoglio" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#cbd5e1"/></linearGradient>
      <linearGradient id="dmoSpunta" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#6ee7b7"/><stop offset="1" stop-color="#059669"/></linearGradient></defs>
    ${OMBRA(16, 28.8, 7.4)}
    <rect x="6" y="4" width="20" height="24" rx="3.2" fill="url(#dmoFoglio)"/>
    <rect x="11.6" y="2.4" width="8.8" height="4.4" rx="2.2" fill="#94a3b8"/>
    <g stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round">
      <path d="M10.4 13h5M10.4 18h7.6M10.4 23h4.4"/></g>
    <circle cx="22" cy="21.6" r="6" fill="url(#dmoSpunta)"/>
    <path d="m19.4 21.8 1.8 1.8 3.6-4" stroke="#fff" stroke-width="1.9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,

  /* Il robot: scocca tonda, paraurti e la spia del lavoro. */
  robot: `<defs>
      <linearGradient id="dmoRobot" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#e2e8f0"/><stop offset=".5" stop-color="#94a3b8"/>
        <stop offset="1" stop-color="#475569"/></linearGradient></defs>
    ${OMBRA(16, 28.4, 9)}
    <circle cx="16" cy="16.4" r="11.4" fill="url(#dmoRobot)"/>
    <path d="M6 12.4a11.4 11.4 0 0 1 20 0Z" fill="#0f172a" opacity=".22"/>
    <circle cx="16" cy="16.4" r="4.4" fill="#0f172a" opacity=".35"/>
    <circle cx="16" cy="16.4" r="2" fill="#38bdf8"/>
    <path d="M9.4 9.4a9.4 9.4 0 0 1 4.4-2.6" stroke="#fff" stroke-opacity=".75" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,

  /* La piscina: acqua e onde. */
  piscina: `<defs>
      <linearGradient id="dmoAcqua" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#a5f3fc"/><stop offset=".5" stop-color="#22d3ee"/>
        <stop offset="1" stop-color="#0369a1"/></linearGradient></defs>
    ${OMBRA(16, 28.6, 9.4)}
    <path d="M4 12.4a24 24 0 0 1 24 0v10.4a3.4 3.4 0 0 1-3.4 3.4H7.4A3.4 3.4 0 0 1 4 22.8Z" fill="url(#dmoAcqua)"/>
    <g stroke="#fff" stroke-opacity=".72" stroke-width="1.8" fill="none" stroke-linecap="round">
      <path d="M6.6 17.4c2-1.6 3.4-1.6 5.4 0s3.4 1.6 5.4 0 3.4-1.6 5.4 0 1.6 1.2 2.6.6"/>
      <path d="M6.6 22c2-1.6 3.4-1.6 5.4 0s3.4 1.6 5.4 0 3.4-1.6 5.4 0"/></g>
    <path d="M10.4 12V6.4a2.4 2.4 0 0 1 4.8 0" stroke="#e2e8f0" stroke-width="2" fill="none" stroke-linecap="round"/>`,

  /* L'irrigazione: la goccia con il suo lucido. */
  irrigazione: `<defs>
      <linearGradient id="dmoGoccia" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#bbf7d0"/><stop offset=".5" stop-color="#10b981"/>
        <stop offset="1" stop-color="#047857"/></linearGradient></defs>
    ${OMBRA(16, 29, 6.2)}
    <path d="M16 2.6c4.6 5.6 8.6 10 8.6 14.6a8.6 8.6 0 1 1-17.2 0c0-4.6 4-9 8.6-14.6Z" fill="url(#dmoGoccia)"/>
    <path d="M12.4 12.6a8 8 0 0 0-2 5" stroke="#fff" stroke-opacity=".7" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,

  /* La batteria: involucro, carica e polo. */
  batterie: `<defs>
      <linearGradient id="dmoBatt" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fde68a"/><stop offset=".55" stop-color="#eab308"/>
        <stop offset="1" stop-color="#a16207"/></linearGradient></defs>
    ${OMBRA(16, 28.6, 7)}
    <rect x="9" y="6.4" width="14" height="21.2" rx="3" fill="#e2e8f0"/>
    <rect x="12.6" y="3.6" width="6.8" height="3.4" rx="1.6" fill="#94a3b8"/>
    <rect x="11" y="13.6" width="10" height="12" rx="1.8" fill="url(#dmoBatt)"/>
    <path d="M11.8 8.6v3.4" stroke="#fff" stroke-opacity=".8" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M17 15.6 13.6 21h2.8l-.8 4 3.6-5.6h-2.6Z" fill="#fff" opacity=".85"/>`,

  /* L'allagamento: la goccia caduta e il cerchio che si allarga. */
  allagamenti: `<defs>
      <linearGradient id="dmoAllag" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#e0f2fe"/><stop offset=".5" stop-color="#38bdf8"/>
        <stop offset="1" stop-color="#0369a1"/></linearGradient></defs>
    <path d="M16 2.6c4 4.8 7.4 8.6 7.4 12.6a7.4 7.4 0 1 1-14.8 0c0-4 3.4-7.8 7.4-12.6Z" fill="url(#dmoAllag)"/>
    <path d="M12.8 11.6a7 7 0 0 0-1.8 4.4" stroke="#fff" stroke-opacity=".7" stroke-width="1.7" fill="none" stroke-linecap="round"/>
    <g stroke="#38bdf8" stroke-width="2" fill="none" stroke-linecap="round" opacity=".65">
      <path d="M6.4 25.4c2.6-2.2 4.6-2.2 7.2 0s4.6 2.2 7.2 0 3.2-1.6 4.8-.4"/></g>`,

  /* Il MiniPC: la scocca di alluminio, la spia accesa e le prese sul davanti.
   * «Nella sezione widget manca completamente minipc»: la tessera adesso c'e',
   * e le serviva il suo oggetto come a tutte le altre. */
  minipc: `<defs>
      <linearGradient id="dmoPcS" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#f1f5f9"/><stop offset=".5" stop-color="#94a3b8"/>
        <stop offset="1" stop-color="#334155"/></linearGradient>
      <linearGradient id="dmoPcF" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#1e293b"/><stop offset="1" stop-color="#0f172a"/></linearGradient></defs>
    ${OMBRA(16, 27.4, 9.4)}
    <rect x="4.4" y="8.6" width="23.2" height="16.4" rx="3.4" fill="url(#dmoPcS)"/>
    <rect x="6.6" y="11" width="18.8" height="11.6" rx="2.2" fill="url(#dmoPcF)"/>
    <circle cx="10" cy="16.8" r="1.7" fill="#22c55e"/>
    <g fill="#64748b"><rect x="14.2" y="14.6" width="4.4" height="2.4" rx="1"/>
      <rect x="14.2" y="18.4" width="7.6" height="2.2" rx="1"/></g>
    <path d="M6.6 10.4h18.8" stroke="#fff" stroke-opacity=".55" stroke-width="1.2"/>`,

  /* Il gruppo di continuita' (#256): la scatola nera col pannello davanti, la
   * batteria dentro che si vede dal livello, e la spia della rete. Non e' la
   * batteria del telefono — quella e' una carica che scende e basta, questa e'
   * una scatola attaccata al muro che regge la casa quando la corrente cade. */
  ups: `<defs>
      <linearGradient id="dmoUpsS" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#64748b"/><stop offset=".45" stop-color="#334155"/>
        <stop offset="1" stop-color="#0f172a"/></linearGradient>
      <linearGradient id="dmoUpsB" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stop-color="#16a34a"/><stop offset=".6" stop-color="#4ade80"/>
        <stop offset="1" stop-color="#bbf7d0"/></linearGradient></defs>
    ${OMBRA(16, 28.8, 7.6)}
    <rect x="7.4" y="4.2" width="17.2" height="23.4" rx="3" fill="url(#dmoUpsS)"/>
    <rect x="9.6" y="6.6" width="12.8" height="7.4" rx="1.8" fill="#0b1220"/>
    <rect x="10.8" y="8.4" width="7.4" height="3.8" rx="1" fill="url(#dmoUpsB)"/>
    <circle cx="20.6" cy="10.3" r="1.3" fill="#22c55e"/>
    <path d="M16.6 16.6 13.4 22h2.6l-.8 4 3.6-5.8h-2.6Z" fill="#fbbf24"/>
    <g fill="#94a3b8"><rect x="9.6" y="24.2" width="4.6" height="2" rx="1"/>
      <rect x="17.8" y="24.2" width="4.6" height="2" rx="1"/></g>
    <path d="M9.6 5.6h12.8" stroke="#fff" stroke-opacity=".4" stroke-width="1.2"/>`,

  /* L'agenda (#259): il blocco di fogli, la testata colorata coi due anelli,
   * il giorno segnato — e la spunta nell'angolo, perche' questa tessera porta
   * tutte e due le cose: quello che succede a un'ora e quello che si spunta. */
  agenda: `<defs>
      <linearGradient id="dmoCalT" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#818cf8"/><stop offset=".55" stop-color="#6366f1"/>
        <stop offset="1" stop-color="#4338ca"/></linearGradient>
      <linearGradient id="dmoCalF" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e2e8f0"/></linearGradient></defs>
    ${OMBRA(16, 28.6, 8.6)}
    <rect x="4.2" y="6.2" width="23.6" height="21.2" rx="3.4" fill="url(#dmoCalF)"/>
    <path d="M4.2 9.6a3.4 3.4 0 0 1 3.4-3.4h16.8a3.4 3.4 0 0 1 3.4 3.4v3.2H4.2Z" fill="url(#dmoCalT)"/>
    <g stroke="#64748b" stroke-width="2.2" stroke-linecap="round">
      <path d="M10.6 3.2v4.4M21.4 3.2v4.4"/></g>
    <rect x="8.6" y="16.4" width="5.2" height="4.4" rx="1.2" fill="#c7d2fe"/>
    <rect x="16.4" y="16.4" width="7" height="4.4" rx="1.2" fill="#e2e8f0"/>
    <rect x="8.6" y="22.4" width="7" height="3" rx="1.2" fill="#e2e8f0"/>
    <circle cx="21.6" cy="23.4" r="3.4" fill="#22c55e"/>
    <path d="m20 23.4 1.1 1.2 2.2-2.4" stroke="#fff" stroke-width="1.5" fill="none"
      stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M5.8 8.4a2.6 2.6 0 0 1 2-1.8" stroke="#fff" stroke-opacity=".7" stroke-width="1.5"
      fill="none" stroke-linecap="round"/>`,

  /* La presa: mascherina chiara e i due fori, come quella della sezione. */
  prese: `<defs>
      <linearGradient id="dmoPresa" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#f8fafc"/><stop offset=".55" stop-color="#cbd5e1"/>
        <stop offset="1" stop-color="#64748b"/></linearGradient></defs>
    ${OMBRA(16, 28.2, 8)}
    <rect x="5.6" y="5.6" width="20.8" height="20.8" rx="6" fill="url(#dmoPresa)"/>
    <circle cx="16" cy="16" r="7.4" fill="#0f172a" opacity=".14"/>
    <g fill="#334155"><rect x="12.4" y="12.6" width="2.6" height="6.8" rx="1.3"/>
      <rect x="17" y="12.6" width="2.6" height="6.8" rx="1.3"/></g>
    <path d="M8.4 8.6a6 6 0 0 1 3.4-2" stroke="#fff" stroke-opacity=".8" stroke-width="1.7" fill="none" stroke-linecap="round"/>`,

  /* In evidenza: la stella, con il suo lucido in alto a sinistra. */
  evidenza: `<defs>
      <linearGradient id="dmoStella" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#fef3c7"/><stop offset=".5" stop-color="#fbbf24"/>
        <stop offset="1" stop-color="#b45309"/></linearGradient></defs>
    ${OMBRA(16, 28.4, 7.4)}
    <path d="m16 3.6 3.9 7.9 8.7 1.3-6.3 6.1 1.5 8.7L16 23.5l-7.8 4.1 1.5-8.7-6.3-6.1 8.7-1.3Z" fill="url(#dmoStella)"/>
    <path d="m12.6 9.4 2.4-4.6" stroke="#fff" stroke-opacity=".75" stroke-width="1.7" stroke-linecap="round"/>`,

  /* Gli avvisi fatti in casa: il cartello, con il punto esclamativo inciso. */
  custom: `<defs>
      <linearGradient id="dmoAvviso" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#fde68a"/><stop offset=".5" stop-color="#f59e0b"/>
        <stop offset="1" stop-color="#b45309"/></linearGradient></defs>
    ${OMBRA(16, 28.2, 8.6)}
    <path d="M16 4.4a2.6 2.6 0 0 1 2.2 1.3l9 15.6a2.6 2.6 0 0 1-2.2 3.9H7a2.6 2.6 0 0 1-2.2-3.9l9-15.6A2.6 2.6 0 0 1 16 4.4Z" fill="url(#dmoAvviso)"/>
    <rect x="14.7" y="11" width="2.6" height="7.6" rx="1.3" fill="#fff" opacity=".92"/>
    <circle cx="16" cy="21.4" r="1.6" fill="#fff" opacity=".92"/>`,

  /* ── gli oggetti delle schede della configurazione ─────────────────────
   *
   * Il menu della configurazione portava le emoji del sistema, e due voci
   * finivano con lo stesso segno: «azioni ed energia hanno lo stesso simbolo
   * nel config». Qui ci sono gli oggetti che mancavano, nella stessa famiglia
   * delle tessere: chi guarda la colonna vede una cosa sola, disegnata da noi.
   */

  /* La casa: tetto, corpo e la finestra accesa. */
  home: `<defs>
      <linearGradient id="dmoCasaT" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#f87171"/><stop offset="1" stop-color="#b91c1c"/></linearGradient>
      <linearGradient id="dmoCasaC" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#f8fafc"/><stop offset="1" stop-color="#cbd5e1"/></linearGradient></defs>
    ${OMBRA(16, 27.8, 8.6)}
    <path d="M16 3.4 3.6 13.2l1.8 2.3L16 7.2l10.6 8.3 1.8-2.3Z" fill="url(#dmoCasaT)"/>
    <path d="M6.8 14.6 16 7.4l9.2 7.2v11.2H6.8Z" fill="url(#dmoCasaC)"/>
    <rect x="13.4" y="18" width="5.2" height="7.8" rx="1.2" fill="#64748b"/>
    <rect x="8.6" y="16.4" width="3.4" height="3.4" rx="1" fill="#fbbf24"/>`,

  /* Le azioni rapide: il tasto tondo e l'onda del tocco. Non un fulmine —
   * quello e' dell'Energia, e due voci con lo stesso segno non si distinguono
   * piu'. Qui si vede subito che e' una cosa da premere. */
  azioni: `<defs>
      <linearGradient id="dmoTasto" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#a5b4fc"/><stop offset=".5" stop-color="#6366f1"/>
        <stop offset="1" stop-color="#3730a3"/></linearGradient></defs>
    ${OMBRA(16, 28, 7.6)}
    <circle cx="16" cy="15.6" r="9.4" fill="url(#dmoTasto)"/>
    <circle cx="16" cy="15.6" r="5.4" fill="#0f172a" opacity=".2"/>
    <circle cx="16" cy="15.6" r="4" fill="#e0e7ff"/>
    <path d="M10.2 8.6a8 8 0 0 1 4-2.4" stroke="#fff" stroke-opacity=".8" stroke-width="1.7"
      fill="none" stroke-linecap="round"/>
    <g stroke="#6366f1" stroke-width="1.9" fill="none" stroke-linecap="round" opacity=".7">
      <path d="M24.6 22.6a12 12 0 0 0 1.8-3.4M27.8 25a15.6 15.6 0 0 0 2.2-4.4"/></g>`,

  /* Le stanze: il divano, di fronte. */
  stanze: `<defs>
      <linearGradient id="dmoDivano" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fdba74"/><stop offset="1" stop-color="#c2410c"/></linearGradient></defs>
    ${OMBRA(16, 27.6, 9.4)}
    <rect x="4.6" y="12.4" width="4.6" height="9" rx="2.3" fill="url(#dmoDivano)"/>
    <rect x="22.8" y="12.4" width="4.6" height="9" rx="2.3" fill="url(#dmoDivano)"/>
    <rect x="7.6" y="9.6" width="16.8" height="8.4" rx="2.6" fill="#fed7aa"/>
    <rect x="6.6" y="16" width="18.8" height="7" rx="2.6" fill="url(#dmoDivano)"/>
    <path d="M9.6 11.6h12.8" stroke="#fff" stroke-opacity=".6" stroke-width="1.4" stroke-linecap="round"/>
    <g fill="#7c2d12" opacity=".7"><rect x="8.4" y="23" width="2" height="2.8" rx="1"/>
      <rect x="21.6" y="23" width="2" height="2.8" rx="1"/></g>`,

  /* Le impostazioni: la ruota dentata con il mozzo chiaro. */
  impostazioni: `<defs>
      <linearGradient id="dmoRuota" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#e2e8f0"/><stop offset=".5" stop-color="#94a3b8"/>
        <stop offset="1" stop-color="#475569"/></linearGradient></defs>
    ${OMBRA(16, 28, 7.4)}
    <path d="M16 4.6a11.4 11.4 0 0 1 3.3.5l.9 3a8.6 8.6 0 0 1 2.3 1.3l3-.9a11.4 11.4 0 0 1 2.3 4l-2.1 2.2a8.6 8.6 0 0 1 0 2.6l2.1 2.2a11.4 11.4 0 0 1-2.3 4l-3-.9a8.6 8.6 0 0 1-2.3 1.3l-.9 3a11.4 11.4 0 0 1-6.6 0l-.9-3a8.6 8.6 0 0 1-2.3-1.3l-3 .9a11.4 11.4 0 0 1-2.3-4l2.1-2.2a8.6 8.6 0 0 1 0-2.6l-2.1-2.2a11.4 11.4 0 0 1 2.3-4l3 .9a8.6 8.6 0 0 1 2.3-1.3l.9-3A11.4 11.4 0 0 1 16 4.6Z" fill="url(#dmoRuota)"/>
    <circle cx="16" cy="16" r="4.4" fill="#0f172a" opacity=".22"/>
    <circle cx="16" cy="16" r="3.2" fill="#f8fafc"/>`,

  /* Il backup: il dischetto, con la sua etichetta. */
  backup: `<defs>
      <linearGradient id="dmoDisco" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#60a5fa"/><stop offset=".55" stop-color="#2563eb"/>
        <stop offset="1" stop-color="#1e3a8a"/></linearGradient></defs>
    ${OMBRA(16, 28, 8.4)}
    <path d="M5.6 5.6h16.2l4.6 4.6v16.2H5.6Z" fill="url(#dmoDisco)"/>
    <rect x="10.4" y="5.6" width="9.2" height="6.4" rx="1.2" fill="#e2e8f0"/>
    <rect x="16.4" y="6.8" width="2.4" height="4" rx="1" fill="#1e3a8a"/>
    <rect x="9" y="16.4" width="14" height="10" rx="1.6" fill="#f8fafc"/>
    <g stroke="#94a3b8" stroke-width="1.4" stroke-linecap="round">
      <path d="M11.4 19.4h9.2M11.4 22.2h6.4"/></g>`,

  /* Le persone: due sagome, una davanti all'altra. */
  persone: `<defs>
      <linearGradient id="dmoPers" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#7dd3fc"/><stop offset="1" stop-color="#0369a1"/></linearGradient></defs>
    ${OMBRA(16, 27.8, 9)}
    <circle cx="21.8" cy="11.6" r="4.2" fill="#94a3b8"/>
    <path d="M14.6 25.4c.6-4.4 3.6-6.6 7.2-6.6s6.6 2.2 7.2 6.6Z" fill="#94a3b8"/>
    <circle cx="12.4" cy="10.6" r="5" fill="url(#dmoPers)"/>
    <path d="M3.6 25.4c.7-5 4.2-7.6 8.8-7.6s8.1 2.6 8.8 7.6Z" fill="url(#dmoPers)"/>
    <path d="M8.6 7.4a4.6 4.6 0 0 1 3-1.6" stroke="#fff" stroke-opacity=".75" stroke-width="1.5"
      fill="none" stroke-linecap="round"/>`,

  /* Il runtime: il battito sotto vetro, che e' quello che quella scheda mostra. */
  runtime: `<defs>
      <linearGradient id="dmoBatt2" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#34d399"/><stop offset="1" stop-color="#059669"/></linearGradient></defs>
    ${OMBRA(16, 27.8, 8.6)}
    <rect x="3.6" y="7" width="24.8" height="18" rx="4" fill="#0f172a"/>
    <rect x="5.6" y="9" width="20.8" height="14" rx="2.6" fill="#052e2b"/>
    <path d="M7 16.4h4l2-4.4 3 8.4 2.4-5 1.8 3h4.8" stroke="url(#dmoBatt2)" stroke-width="2"
      fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M6.4 10.4a3 3 0 0 1 2-1.2" stroke="#fff" stroke-opacity=".45" stroke-width="1.2"
      fill="none" stroke-linecap="round"/>`,

  /* Gli avvisi: la campana, con il suo battaglio. */
  avvisi: `<defs>
      <linearGradient id="dmoCamp" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#fde68a"/><stop offset=".5" stop-color="#f59e0b"/>
        <stop offset="1" stop-color="#92400e"/></linearGradient></defs>
    ${OMBRA(16, 28.2, 7.6)}
    <path d="M16 4.2a2 2 0 0 1 2 2v.8a7.6 7.6 0 0 1 5.6 7.3v4.4l2 3.4a1.4 1.4 0 0 1-1.2 2.1H9.6a1.4 1.4 0 0 1-1.2-2.1l2-3.4v-4.4A7.6 7.6 0 0 1 16 7v-.8a2 2 0 0 1 0-2Z" fill="url(#dmoCamp)"/>
    <path d="M13.2 24.6h5.6a2.8 2.8 0 0 1-5.6 0Z" fill="#b45309"/>
    <path d="M12 11.4a5 5 0 0 1 2.8-2.4" stroke="#fff" stroke-opacity=".75" stroke-width="1.6"
      fill="none" stroke-linecap="round"/>`,

  /* I widget: le tessere del ponte, tre riquadri e uno acceso. */
  widget: `<defs>
      <linearGradient id="dmoTess" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#5eead4"/><stop offset=".55" stop-color="#14b8a6"/>
        <stop offset="1" stop-color="#0f766e"/></linearGradient></defs>
    ${OMBRA(16, 28, 8.8)}
    <rect x="4.4" y="4.6" width="10.8" height="10.8" rx="2.8" fill="url(#dmoTess)"/>
    <rect x="17.4" y="4.6" width="10.2" height="6.8" rx="2.4" fill="#cbd5e1"/>
    <rect x="17.4" y="13.6" width="10.2" height="13.8" rx="2.8" fill="#94a3b8"/>
    <rect x="4.4" y="17.6" width="10.8" height="9.8" rx="2.8" fill="#cbd5e1"/>
    <path d="M6.8 7.4a3.4 3.4 0 0 1 2.4-1.4" stroke="#fff" stroke-opacity=".8" stroke-width="1.5"
      fill="none" stroke-linecap="round"/>`,
});

/* Il disegno della tessera, pronto da mettere dentro la pastiglia.
 *
 * Chi chiama passa anche il simbolo di ripiego — quello scelto in
 * configurazione per le tessere fatte in casa — e per quelle si tiene il suo. */
export function oggettoWidget(chiave, ripiego = "") {
  const disegno = OGGETTI[String(chiave || "")];
  if (!disegno) return String(ripiego || "");
  return `<svg class="dm-oggetto" viewBox="0 0 32 32" aria-hidden="true" focusable="false">${disegno}</svg>`;
}

/* Serve alle prove e a chi vuole sapere se un tasto avra' il suo disegno. */
export function haOggettoWidget(chiave) {
  return Object.prototype.hasOwnProperty.call(OGGETTI, String(chiave || ""));
}

export const CHIAVI_OGGETTI = Object.freeze(Object.keys(OGGETTI));

/* ── il foglio delle sfumature ────────────────────────────────────────────
 *
 * «Le icone presenti sia sulla navbar che nel menu config sono poco
 * leggibili, troppo chiare.» Non erano chiare: erano MEZZE.
 *
 * Ogni disegno si porta dentro le proprie sfumature, e due disegni uguali
 * ripetono gli stessi identificatori — era una scelta, ed era scritta qui
 * sopra: «sono definizioni identiche, quindi il disegno non cambia». Il
 * ragionamento pero' saltava un pezzo. In una pagina, a un identificatore
 * ripetuto risponde SEMPRE il primo che lo porta, in ordine di documento; e
 * il primo, per meta' dei disegni, sta dentro una voce di barra che la
 * configurazione tiene a `display:none`. Una sfumatura dentro un ramo non
 * disegnato non dipinge niente: il riferimento cade nel vuoto, e del
 * lampadario o del termometro resta soltanto l'ombra sotto — che e'
 * l'ellisse grigia chiara, l'unica parte senza sfumatura.
 *
 * Da qui il «troppo chiare»: chi guardava vedeva un residuo pallido, non un
 * disegno spento.
 *
 * La riparazione sfrutta la stessa regola invece di subirla. Le definizioni
 * si raccolgono una volta sola in un foglio che sta in cima al documento ed
 * e' sempre disegnato: essendo il primo, e' lui a rispondere a tutti. Il
 * markup delle singole tessere non cambia di un carattere — e questo conta,
 * perche' le sezioni decidono se ridisegnare confrontando il markup che
 * hanno appena scritto con quello di prima: identificatori diversi a ogni
 * giro vorrebbero dire ridisegnare per sempre.
 */

/* Le definizioni di un disegno, senza il resto. */
function definizioniDi(disegno) {
  const apre = disegno.indexOf("<defs>");
  if (apre < 0) return "";
  const chiude = disegno.indexOf("</defs>", apre);
  if (chiude < 0) return "";
  return disegno.slice(apre + "<defs>".length, chiude);
}

/* Una sfumatura per volta, col suo identificatore: dentro i `defs` di questi
 * disegni non c'e' altro che sfumature lineari e radiali. */
const SFUMATURA = /<(linear|radial)Gradient\b[^>]*\bid="([^"]+)"[^>]*>[\s\S]*?<\/\1Gradient>/g;

/* Ogni sfumatura una volta sola: due disegni che dichiarano lo stesso
 * identificatore lo dichiarano identico, e la prima copia basta per tutti. */
function raccogliDefinizioni() {
  const viste = new Set();
  const pezzi = [];
  for (const disegno of Object.values(OGGETTI)) {
    const dentro = definizioniDi(disegno);
    if (!dentro) continue;
    for (const trovata of dentro.matchAll(SFUMATURA)) {
      const id = trovata[2];
      if (viste.has(id)) continue;
      viste.add(id);
      pezzi.push(trovata[0]);
    }
  }
  return { markup: pezzi.join(""), ids: Object.freeze([...viste]) };
}

const FOGLIO = raccogliDefinizioni();
const FOGLIO_DEFS = FOGLIO.markup;

/** Gli identificatori che il foglio dichiara: serve alle prove. */
export function identificatoriDelFoglio() {
  return FOGLIO.ids;
}

export const ID_FOGLIO_OGGETTI = "dm-oggetti-defs";

/**
 * Il foglio con tutte le sfumature dei disegni.
 *
 * Va messo per PRIMO dentro il corpo della pagina e non va mai nascosto con
 * `display:none`: e' misura zero, non occupa spazio e non prende il dito, ma
 * resta disegnato — che e' l'unica condizione perche' le sue sfumature
 * dipingano davvero.
 */
export function foglioDegliOggetti() {
  return `<svg id="${ID_FOGLIO_OGGETTI}" aria-hidden="true" focusable="false" style="position:absolute;width:0;height:0;overflow:hidden;pointer-events:none"><defs>${FOGLIO_DEFS}</defs></svg>`;
}

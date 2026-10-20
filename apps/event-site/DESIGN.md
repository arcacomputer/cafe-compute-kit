# Design: a local builder field guide

A welcoming table rather than an event-management dashboard. Warm paper, dark ink, restrained burnt orange and deep teal; system UI and Georgia, with monospace annotations. Numbered preparation notes, fine rules and one original cup/notebook illustration establish the field-guide motif without provider branding or remote assets.

- Spanish is `/`; English is `/en/`. Every public route has a same-page language switch. Event prose, image descriptions, credits, slide bodies and presenter notes require both languages.
- Information order: sample/confirmation status → invitation → public date/venue certainty → preparation → learning materials → benefits only if explicitly configured.
- No countdowns, invented stats, attendee names, testimonials, sponsors or stock photos. Empty recap/gallery states are designed content, not fake success.
- Semantic landmarks, visible focus, skip navigation, responsive layouts, 44px controls, reduced motion, progressive HTML slide reading, live slide position and print fallback are authored. Browser/axe/print verification must be reported separately, never inferred from this document.
- UI strings: `src/locales.mjs`. Public event content and slide source: root `config/event.example.json` or an explicitly selected public config. All CSS/JS/images are self-hosted. No runtime network or font dependency.

`public/assets/mark.svg` and `table-notes.svg` are original neutral graphics created for Cafe Compute Kit and covered by the repository MIT license. They are not provider logos. HTML, CSS, JavaScript and default copy in this app are also MIT. Operator-supplied media retains its own rights and requires documented permission; the kit license does not relicense it.

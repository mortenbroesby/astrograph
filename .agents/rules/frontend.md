---
paths:
  - "apps/host/**"
  - "packages/ui/**"
  - "**/*.tsx"
  - "**/*.css"
---

# Frontend

- Follow the existing design system before adding new patterns.
- Use semantic HTML, keyboard-accessible controls, visible focus, and meaningful
  image `alt` text.
- Keep layouts stable across state changes; fixed-format UI needs stable
  dimensions or responsive constraints.
- Use project tokens and Tailwind config instead of raw, one-off values where a
  token already exists.
- Do not style the main experience as an embedded preview unless the boundary is
  functional UI chrome.
- Avoid cards inside cards, decorative gradient orbs, viewport-scaled font
  sizes, negative letter spacing, and dominant one-hue palettes.
- For user-facing changes, verify the page manually when practical.

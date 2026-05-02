# Accessibility Checklist

## Baseline

- Use semantic HTML and meaningful labels.
- Ensure keyboard access and visible focus states.
- Keep image `alt` text useful and non-decorative when required.
- Avoid UI structures that depend on hover alone.

## Repo-specific checks

- Follow `.agents/rules/frontend.md` for UI work.
- Verify user-facing changes in a browser when practical.
- Keep layout shifts and cramped overlay patterns from breaking interaction.

## Red flags

- Clickable `div` patterns without keyboard support
- Focus styles removed or hidden
- Important meaning conveyed only through color or animation

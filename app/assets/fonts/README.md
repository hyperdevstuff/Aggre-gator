Fonts in this directory
=======================

Geist-Regular.ttf, Geist-Medium.ttf — the Geist typeface by Vercel.
Licensed under the SIL Open Font License 1.1. Upstream:
https://github.com/vercel/geist-font

Why these live here, in TrueType, rather than being reused from
`client/public/fonts/*.woff2`:

The Open Graph renderer (`app/src/og/index.ts`) uses satori, which cannot read
WOFF2 and throws `Unsupported OpenType signature wOF2`. It needs raw
.ttf/.otf/.woff bytes — and specifically *not* the Google Fonts CSS endpoint,
which serves woff2.

Vendoring the two weights keeps rendering reproducible and offline: no
third-party host in the render path, and no font subsetting step in CI.

Regenerating:

  curl -sSL -o app/assets/fonts/Geist-Regular.ttf \
    https://github.com/vercel/geist-font/raw/main/packages/next/dist/fonts/geist-sans/Geist-Regular.ttf
  curl -sSL -o app/assets/fonts/Geist-Medium.ttf \
    https://github.com/vercel/geist-font/raw/main/packages/next/dist/fonts/geist-sans/Geist-Medium.ttf
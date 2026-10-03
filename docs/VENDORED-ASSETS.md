# Third-party copies

Blue Note no longer depends on a framework or an icon font. The only third-party
code that ships with the site lives inside the theme and is listed in
[`themes/bluenote/THIRD-PARTY-LICENSES.md`](../themes/bluenote/THIRD-PARTY-LICENSES.md):

| Component | Version | Purpose |
| --- | --- | --- |
| typed.js | 2.0.12 (MIT) | Home slogan typing effect; loaded on the home page only |
| github-markdown-css | 4.0.0 (MIT) | Base typography of `.markdown-body`; vendored into the theme CSS instead of being fetched from a CDN |
| highlight.js `github` / `dark` styles | 11.12.0 (BSD-3) | Code block colours for light and dark schemes |

Bootstrap, jQuery, the Alibaba icon fonts, NProgress, tocbot, anchor.js,
clipboard.js, fancybox and hint.css were removed with the switch from Fluid to the
`bluenote` theme in September 2026. Icons are inline SVG symbols in
`themes/bluenote/layout/_partials/icons.ejs`.

The homepage cover `2021.11-2880.jpg` is a progressive JPEG preview generated from
the untouched `2021.11.jpg` with macOS `sips` (long edge 2880px, JPEG quality 86),
then `jpegtran -copy none -optimize -progressive`. The complete frame and aspect
ratio are preserved; this does not change article or Gallery photo masters.

The portrait phone covers `2021.11-portrait-{720,1080,1440}.{jpg,webp}` are a 9:10
crop centred on the figure, cut from the untouched `2021.11.jpg` (5640×2400, full
height) and resized with Pillow (Lanczos): progressive JPEG quality 82 and WebP
quality 80, both carrying the original sRGB profile. The 32×14 WebP placeholder in
`home.cover_placeholder` is a downscaled copy of the same frame.

Site-hosted fonts:

| Component | Version | Purpose |
| --- | --- | --- |
| EB Garamond (`source/fonts/eb-garamond/`) | @fontsource/eb-garamond 5.3.0 (SIL OFL 1.1) | Latin text and numerals |
| Noto Serif SC (`source/fonts/noto-serif-sc/`) | @fontsource/noto-serif-sc 5.3.0 (SIL OFL 1.1) | Regular-weight Chinese fallback, named `Blue Note Serif SC`, for systems without Songti or a system Noto/Source Han serif; Google's unicode-range slices, plus the Latin slice limited to U+2018–2019 for Chinese single quotes |

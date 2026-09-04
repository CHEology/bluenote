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

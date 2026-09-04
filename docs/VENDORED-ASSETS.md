# Theme dependency copies

The homepage serves its existing Fluid dependencies from `source/vendor/` to avoid
third-party connections on the critical loading path. Versions and behavior match
Fluid 1.9.9; this is a hosting change, not a library upgrade. Original license
notices in the distributed files are retained.

| Local directory | Original source |
| --- | --- |
| `bootstrap/4.6.1` | `https://lib.baomitu.com/twitter-bootstrap/4.6.1/` (`css/bootstrap.min.css`, `js/bootstrap.min.js`) |
| `jquery/3.6.4` | `https://lib.baomitu.com/jquery/3.6.4/jquery.min.js` |
| `typed.js/2.0.12` | `https://lib.baomitu.com/typed.js/2.0.12/typed.min.js` |
| `nprogress/0.2.0` | `https://lib.baomitu.com/nprogress/0.2.0/` (`nprogress.min.css`, `nprogress.min.js`) |
| `iconfont` | `https://at.alicdn.com/t/c/font_1749284_5i9bdhy70f8.{css,woff2,woff,ttf}` and `font_1736178_k526ubmyhba.{css,woff2,woff,ttf}` |

Icon font URLs in the copied CSS are changed to relative local paths; trailing
whitespace is normalized without changing code or license notices. The
theme's hardcoded icon CSS links are redirected by `scripts/page-loading.js`.
Builds require no additional download step. When upgrading Fluid, review its
dependency versions and update these copies and their notices together.

The homepage cover `2021.11-2880.jpg` is a progressive JPEG preview generated from
the untouched `2021.11.jpg` with macOS `sips` (long edge 2880px, JPEG quality 86),
then `jpegtran -copy none -optimize -progressive`. The complete frame and aspect
ratio are preserved; this does not change article or Gallery photo masters.

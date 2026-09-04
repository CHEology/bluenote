# bluenote

A quiet editorial theme for [Hexo](https://hexo.io/): paper tones, serif Latin and CJK
typography, a full-viewport cover with square cards on the home page, solid mastheads
on content pages, light and dark schemes, and no framework, icon font or third-party
request. Built for [Blue Note](https://cheology.github.io/bluenote/), whose source lives at [CHEology/bluenote](https://github.com/CHEology/bluenote).

## Install

Copy or clone the theme into your site's `themes/` directory and point Hexo at it:

```bash
# as an npm dependency (recommended; Hexo >= 5 resolves node_modules/hexo-theme-bluenote)
npm install git+https://github.com/CHEology/hexo-theme-bluenote.git#v1.0.0

# or as a checkout in themes/ (takes precedence over node_modules, handy for development)
git clone https://github.com/CHEology/hexo-theme-bluenote.git themes/bluenote
```

```yaml
# _config.yml
theme: bluenote
```

Requirements: Hexo 7 or newer, `hexo-renderer-ejs` (templates) and any Markdown
renderer. `hexo-generator-search` (XML format) enables the search panel;
`hexo-generator-archive` and `hexo-generator-tag` provide the list pages. No Stylus,
Sass or bundler is needed: the theme ships plain CSS and JavaScript and concatenates
them at build time into `css/bluenote.css` and `js/bluenote.js`.

Create `_config.bluenote.yml` in the site root to override any default from the
theme's `_config.yml`. Hexo merges the two files (note that arrays such as `nav.menu`
replace by index, which is why the theme leaves `menu` empty and falls back to Home,
Archives, About and Search when you do not configure one).

## Configuration

| Key | Default | Meaning |
| --- | --- | --- |
| `brand` | site title | Navigation title |
| `favicon`, `apple_touch_icon` | empty | Icon paths; empty omits the tags |
| `force_https` | `true` | Emit `upgrade-insecure-requests` |
| `fonts.ui` / `prose` / `math` / `mono` | serif stacks | Navigation and mastheads / article bodies / formula panels / code |
| `fonts.letter_spacing` | `0.02em` | Global letter spacing |
| `colors.light.*`, `colors.dark.*` | Blue Note palette | Every key becomes `--<key>` (`paper`, `text`, `prose`, `heading`, `muted`, `link`, `link-hover`, `link-hover-bg`, `line`, `masthead`, `masthead-text`, `masthead-line`, `nav-text`, `accent`, `panel`, `code-bg`, `inline-code-bg`, `scrollbar`, `scrollbar-hover`; dark adds `image-brightness`) |
| `colors.home.*` | dark blue palette | Home page tokens `--home-<key>`; keys ending in `-dark` apply in dark mode |
| `nav.menu` | Home, Archives, About, Search | `{ name, link, icon, target }` entries; `link: "#site-search"` opens the search panel |
| `nav.scheme_toggle` | `true` | Light/dark toggle in the menu |
| `home.cover` | empty | Full-viewport cover image; empty uses `home.bg` |
| `home.preload_cover` | `true` | `<link rel="preload">` for the cover |
| `home.slogan` | site subtitle | Slogan on the cover |
| `home.typing.enable` / `speed` / `cursor` | `true` / `70` / `_` | Typing effect (typed.js) |
| `home.cards` | `12` | Cards on the home page |
| `home.excerpt`, `home.date` | `true` | Card contents |
| `home.pagination` | `false` | Paginator below the cards |
| `post.toc.*` | enabled, depth 1–6 | Table of contents next to the article (screens ≥ 992px) |
| `post.prev_next` | `true` | Previous/next links |
| `post.show_tags` | `false` | Tag list under the article |
| `post.heading_anchors` | `true` | Hover anchors on headings |
| `post.figure_captions.enable` / `skip_filename_alt` | `true` / `true` | Turn `alt`/`title` into captions, except file names |
| `post.lightbox` | `true` | Click-to-enlarge for article images |
| `post.photo_layout.enable` / `min_images` | `true` / `3` | Wide layout for posts with several images |
| `archive.show_total` | `false` | "N posts in total" line |
| `archive.extra_entries` | `[]` | Extra rows on the main archive page: `{ section, kind, title, summary, link }` |
| `about.avatar` / `name` / `intro` / `links` | empty | About page header |
| `tags.enable`, `categories.enable` | `true`, `false` | Generate `/tags/` and `/categories/` index pages |
| `page404.enable` / `cover` | `true` / empty | Generate `404.html` with an optional cover |
| `dark_mode.enable` / `default` | `true` / `auto` | `auto` follows the system; the reader's choice is stored under `dark_mode.storage_key` |
| `dark_mode.legacy_storage_key` | `Fluid_Color_Scheme` | A key to migrate once |
| `search.enable` / `path` | `true` / `/local-search.xml` | Search panel over the hexo-generator-search index |
| `open_graph.enable` / `twitter_card` | `true` / `summary_large_image` | Open Graph tags |
| `asset_version` | `true` | Append content hashes (`?v=`) to site CSS/JS |
| `noscript_warning` | `false` | Bar shown without JavaScript |
| `footer.content` | empty | Footer HTML; empty renders no footer |
| `custom_css`, `custom_js` | `[]` | Site assets appended after the theme's |

## Front matter

- Posts: `title`, `date`, `description` (card excerpt and meta description), optional `toc: false`, `cover`/`og_img` for Open Graph.
- Pages: `layout: about` renders the About page; any other page gets the 760px editorial column.
- Generated pages can pass `body_class` in their data to add layout classes (Blue Note uses this for its Gallery and Design Doc pages).

## DOM contract

Site-level scripts may rely on these hooks:

- `html[data-root]` — site root; `html[data-scheme]` — `light`/`dark` when the reader chose one.
- `body.home-page` (`html.home-root`), `body.editorial-page`, `.post-page`, `.listing-page`, `.about-page`, `.error-page`, `.photo-post`, `.private-post-page`, plus any `body_class` a page passes.
- `.site-nav`, `.site-menu`, `.site-menu__item`, `.scheme-toggle`; `window.BlueNote.nav.close()` closes the mobile menu.
- `.index-card`, `.index-header`, `.index-excerpt`, `.index-meta` on the home page.
- `.listing__item`, `.listing__date`, `.listing__title` in lists; `.post-content > .markdown-body`, `.post-nav` in articles.
- Events: `bluenote:scheme` (detail `{ scheme }`); the search panel listens for `bluenote:private-unlocked`.

## Development

Theme CSS lives in `assets/css/*.css` and JavaScript in `assets/js/*.js`; files are
concatenated in name order. Keep `!important` out of the theme (the only exceptions are `[hidden]`, the
first/last-child margin resets of `.markdown-body`, and print styles). Tokens come from `_config.yml`; do not hard-code colours.

## License

MIT. Bundled third-party components and their licenses are listed in
`THIRD-PARTY-LICENSES.md`.

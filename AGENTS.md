# Blue Note editorial rules

These instructions apply to the entire repository.

`docs/DESIGN.md` is the visual and typesetting authority for the site. Any presentation change must follow it; update the document and implementation together when the design system intentionally changes.

## Authorial fidelity is the core principle

- Treat the author's source document as the sole authority for article wording, order, paragraph boundaries, parentheticals, repetitions, and rhetorical structure.
- Apart from unambiguous typos and mechanical typography (spacing, punctuation normalization, and faithful formula rendering), do not rewrite, condense, expand, fact-check-correct, or otherwise "improve" the prose without the author's explicit approval.
- Use the title supplied by the source document or its filename. Do not invent a more descriptive title.
- Do not promote an ordinary sentence such as `关于……。` into a heading, split inline enumerations into lists, extract sentences into pull quotes, or add a table of contents, summary, captions, references, or further reading unless the author explicitly asks for that treatment.
- Create visual hierarchy through CSS and restrained typesetting, not by restructuring the author's text.
- Use the shared `literary-panel` class for ordinary framed content. Its visual authority is the opening panel in `source/_posts/Z.A.T.O-随想.md`; article-specific classes may arrange content inside it but must not redefine the frame.
- If a factual claim seems questionable, preserve it and raise the concern to the author before changing it.
- When the user refers to the latest article, use `/Users/zeyuanlu/Desktop/文字/我的文字/Blue Note/` as the default source directory.
- Site presentation lives in `themes/bluenote` (templates, CSS, JS, defaults) and `_config.bluenote.yml`; site-only styles stay in `source/css`. Follow `docs/DESIGN.md` §11 for which file owns what.

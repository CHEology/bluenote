/* global hexo */
'use strict';

// Public editorial chronology never changes the encrypted manuscript or its URL.
hexo.extend.filter.register('before_generate', async function () {
  const entries = this.config.theme_config.historical_posts || {};
  for (const [id, entry] of Object.entries(entries)) {
    if (!Number.isInteger(entry.year) || entry.year < 1000 || entry.year > 9999) {
      throw new Error('Historical posts require a four-digit composition year');
    }
    const post = this.model('Post').findOne({ private_id: id });
    if (!post) throw new Error(`Unknown historical post: ${id}`);
    if (!post.__permalink) throw new Error('Historical posts require a stable permalink');
    // January 1 is an internal sorting anchor, never displayed as a known day.
    post.date = post.date.clone().year(entry.year).startOf('year');
    post.date_precision = 'year';
    post.archive_note = entry.archive_note || '';
    await post.save();
  }
});

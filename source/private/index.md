---
title: Private
layout: page
date: 2026-08-27 22:00:00
updated: 2026-08-27 22:00:00
description: Private reading space.
comments: false
---

<section class="private-vault" data-private-vault>
  <div class="private-vault__locked" data-private-locked>
    <p class="private-vault__eyebrow">PRIVATE READING</p>
    <h1 class="private-vault__title">私人阅读</h1>
    <p class="private-vault__intro">此处的文章经过加密。输入私人密码后，标题与正文才会在当前浏览器中解开。</p>
    <form class="private-vault__form" data-private-form>
      <label for="private-vault-password">密码</label>
      <div class="private-vault__input-row">
        <input id="private-vault-password" name="password" type="password" autocomplete="current-password" required>
        <button type="submit">解锁</button>
      </div>
      <p class="private-vault__status" data-private-status role="status" aria-live="polite"></p>
    </form>
  </div>

  <div class="private-vault__empty" data-private-empty hidden>
    <p>目前没有私密文章。</p>
  </div>

  <div class="private-vault__unlocked" data-private-unlocked hidden>
    <header class="private-vault__toolbar">
      <p class="private-vault__eyebrow">UNLOCKED</p>
      <button class="private-vault__lock" type="button" data-private-lock>退出私人阅读</button>
    </header>
    <div class="private-vault__layout">
      <nav class="private-vault__index" aria-label="私密文章" data-private-index></nav>
      <article class="private-vault__article markdown-body" data-private-article></article>
    </div>
  </div>
</section>

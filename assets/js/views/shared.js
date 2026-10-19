/* Общие фрагменты разметки. */
window.TravelApp = window.TravelApp || {};
TravelApp.views = TravelApp.views || {};

TravelApp.views.topbar = function topbar(options) {
  const opts = options || {};
  const right = [];
  if (opts.meta) right.push(`<span class="topbar__meta">${opts.meta}</span>`);
  if (opts.back) {
    right.push(
      `<button class="btn btn--ghost btn--small" data-action="${opts.back.action}">${opts.back.label}</button>`
    );
  }

  return `
    <header class="topbar ${opts.dark ? 'topbar--dark' : ''}">
      <button class="wordmark" type="button" data-action="home" aria-label="На главную">
        <span class="wordmark__name">MERIDIAN</span>
        <span class="wordmark__sub">ателье путешествий</span>
      </button>
      ${right.length ? `<div class="topbar__right">${right.join('')}</div>` : ''}
    </header>`;
};

TravelApp.views.matchRing = function matchRing(percent) {
  const value = Math.max(0, Math.min(100, Number(percent) || 0));
  return `
    <span class="match-ring" aria-label="Совпадение ${value} процентов">
      <svg viewBox="0 0 36 36" aria-hidden="true">
        <circle class="match-ring__track" cx="18" cy="18" r="15.9" pathLength="100"></circle>
        <circle class="match-ring__value" cx="18" cy="18" r="15.9" pathLength="100"
          stroke-dasharray="${value} 100" stroke-dashoffset="0"></circle>
      </svg>
      <span class="match-ring__text">${value}<small>%</small></span>
    </span>`;
};

TravelApp.views.image = function image(destination, options) {
  const opts = options || {};
  return `
    <img src="${destination.image}" alt="${TravelApp.ui.escapeHtml(destination.country)} — ${TravelApp.ui.escapeHtml(destination.place)}"
      ${opts.eager ? '' : 'loading="lazy"'} decoding="async"
      onerror="this.classList.add('is-missing'); this.removeAttribute('src');">`;
};

TravelApp.views.difficulty = function difficulty(level) {
  const label = TravelApp.meta.difficultyLabels[level] || '';
  return `<span class="difficulty" title="Сложность: ${label}">
    <span class="difficulty__dots">${TravelApp.ui.difficultyDots(level)}</span>
    <span class="difficulty__label">${label}</span>
  </span>`;
};

TravelApp.views.chip = function chip(label, modifier) {
  return `<span class="chip ${modifier || ''}">${label}</span>`;
};

TravelApp.views.footnote = function footnote() {
  return `<p class="footnote">Бюджеты, сезоны и визовые условия — ориентировочные оценки. Перед бронированием проверяем актуальные цены и правила.</p>`;
};

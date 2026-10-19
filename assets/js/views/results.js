/* Экран подборки. */
window.TravelApp = window.TravelApp || {};
TravelApp.views = TravelApp.views || {};

TravelApp.views.results = (function () {
  const ui = TravelApp.ui;
  const M = TravelApp.meta;

  function compactDates(answers) {
    const dates = answers.dates;
    if (dates.mode === 'exact' && dates.dateFrom) {
      const start = new Date(`${dates.dateFrom}T12:00:00`);
      const end = dates.dateTo ? new Date(`${dates.dateTo}T12:00:00`) : null;
      const format = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' });
      return end ? `${format.format(start)} — ${format.format(end)}` : format.format(start);
    }
    if (dates.mode === 'season' && dates.season) return M.seasonLabels[dates.season];
    return 'Гибкие даты';
  }

  function profileStrip(answers) {
    const budget = answers.budget.value >= 600000 ? 'Без лимита' : ui.money(answers.budget.value);
    const country = answers.country || { mode: 'open', id: null };
    const items = [
      country.mode === 'chosen' && country.id
        ? `Страна: ${ui.escapeHtml(country.id)}`
        : 'Страна: свободный подбор',
      ui.optionLabel('party', answers.party && answers.party.id),
      compactDates(answers),
      `${ui.days(answers.duration.value)}`,
      `${budget}${answers.budget.flex ? ' +15%' : ' · потолок'}`,
      ...ui.typeLabels(answers.restTypes),
      `${M.paceLabels[answers.pace.id]} темп`,
    ];
    return items.map((item) => `<span class="profile-strip__item">${item}</span>`).join('');
  }

  function card(item, index, items, chosenId) {
    const featured = index === 0 && items.length >= 4;
    const badge = item.visited
      ? '<span class="trip-card__badge trip-card__badge--warn">Вы уже были</span>'
      : item.compromise
        ? '<span class="trip-card__badge trip-card__badge--warn">Ближайший вариант</span>'
        : item.wildcard
          ? '<span class="trip-card__badge">Свежий взгляд</span>'
          : '';
    const chosen = chosenId === item.id ? '<span class="trip-card__chosen">✓ Выбрано</span>' : '';

    return `
      <article class="trip-card ${featured ? 'trip-card--featured' : ''} ${chosenId === item.id ? 'is-chosen' : ''}">
        <div class="trip-card__media">
          ${TravelApp.views.image(item)}
          <div class="trip-card__shade" aria-hidden="true"></div>
          ${badge}
          ${chosen}
          <div class="trip-card__match">${TravelApp.views.matchRing(item.percent)}</div>
        </div>

        <div class="trip-card__body">
          <p class="trip-card__place">${item.country} · ${item.region}</p>
          <h2 class="trip-card__title">${item.title}</h2>
          <p class="trip-card__tagline">${item.tagline}</p>

          <div class="trip-card__chips">
            ${ui.typeLabels(item.types).map((label) => `<span class="chip chip--small">${label}</span>`).join('')}
          </div>

          <div class="trip-card__meta">
            <span class="meta-item"><span class="meta-item__key">Сложность</span>${TravelApp.views.difficulty(item.difficulty)}</span>
            <span class="meta-item"><span class="meta-item__key">Длительность</span>${item.days[0]}–${item.days[1]} дней</span>
            <span class="meta-item"><span class="meta-item__key">Виза</span>${M.visaLabels[item.visa]}</span>
          </div>

          <ul class="trip-card__reasons">
            ${item.reasons.slice(0, 2).map((reason) => `<li>${reason}</li>`).join('')}
          </ul>

          <div class="trip-card__foot">
            <div class="trip-card__budget">
              <span>от</span>
              <strong>${ui.money(item.totals.min)}</strong>
              <small>/ чел.</small>
            </div>
            <button type="button" class="btn btn--primary btn--small" data-action="open-trip" data-id="${item.id}">
              Разобрать маршрут →
            </button>
          </div>
        </div>
      </article>`;
  }

  function emptyState(state) {
    const country = (state.answers && state.answers.country) || { mode: 'open', id: null };
    const chosen = country.mode === 'chosen' && country.id;
    const lead = chosen
      ? `В выбранной стране «${ui.escapeHtml(country.id)}» под эти условия ничего не подошло.
         Ослабьте ограничения или выберите другую страну.`
      : 'Мы не показываем варианты, которые нарушают обязательные условия. Ослабьте один параметр — и появятся направления.';

    return `
      <div class="empty-state">
        <p class="eyebrow">Подборка пуста</p>
        <h1>Под такие жёсткие условия<br><em>ничего не нашлось</em></h1>
        <p class="empty-state__lead">${lead}</p>
        <div class="empty-state__actions">
          <button type="button" class="btn btn--ghost" data-action="edit" data-index="0">Изменить страну</button>
          <button type="button" class="btn btn--ghost" data-action="edit" data-index="4">Изменить бюджет</button>
          <button type="button" class="btn btn--ghost" data-action="edit" data-index="9">Изменить визовые требования</button>
          <button type="button" class="btn btn--ghost" data-action="edit" data-index="2">Изменить даты</button>
          <button type="button" class="btn btn--primary" data-action="edit" data-index="6">Смягчить темп</button>
        </div>
      </div>`;
  }

  function render(state) {
    const result = state.results;
    const notes = [];

    const chosenCountry = state.answers && state.answers.country
      && state.answers.country.mode === 'chosen' && state.answers.country.id;

    if (chosenCountry && result && !result.empty && result.items.length < 3) {
      notes.push(
        `<div class="note-card">В стране «${ui.escapeHtml(chosenCountry)}» в каталоге пока ${result.items.length} ${ui.plural(result.items.length, 'направление', 'направления', 'направлений')} — поэтому подборка короче обычных 3–5.</div>`
      );
    }

    if (result && result.relaxed && !result.empty) {
      notes.push(
        '<div class="note-card note-card--accent"><strong>Мы расширили рамки.</strong> Под жёсткие условия подошло меньше трёх вариантов — добавили ближайшие. Они отмечены значком «Ближайший вариант».</div>'
      );
    }

    if (result && !result.empty && result.visitedAvoided > 0) {
      notes.push(
        `<div class="note-card"><strong>Без повторов.</strong> Скрыли ${result.visitedAvoided} ${ui.plural(result.visitedAvoided, 'направление', 'направления', 'направлений')} из истории поездок — есть свежие альтернативы.</div>`
      );
    }

    if (result && !result.empty && result.items.some((item) => item.visited)) {
      notes.push(
        '<div class="note-card"><strong>Есть совпадения с историей.</strong> Свежих вариантов оказалось меньше трёх, поэтому в подборке остались места, где вы уже были. Они отмечены значком «Вы уже были».</div>'
      );
    }

    return `
      <section class="screen screen--results ${state.instant ? 'screen--instant' : ''}">
        ${TravelApp.views.topbar({
          meta: '<span class="topbar__note">Подборка</span>',
          back: { action: 'summary', label: '← Изменить профиль' },
        })}

        <div class="results">
          ${result && !result.empty ? `
            <header class="results__head">
              <p class="eyebrow">Подборка · ${result.items.length} ${ui.plural(result.items.length, 'направление', 'направления', 'направлений')}</p>
              <h1>Вот что подходит <em>вам</em></h1>
              <p class="results__lead">
                Процент совпадения — не рейтинг стран, а объяснение, насколько направление отвечает вашим вводным.
              </p>
            </header>

            <div class="profile-strip">${profileStrip(state.answers)}</div>
            ${notes.join('')}

            <div class="cards">
              ${result.items.map((item, index) => card(item, index, result.items, state.chosenId)).join('')}
            </div>

            <details class="why-panel">
              <summary>Как мы считали совпадение</summary>
              <div class="why-panel__body">
                <p>
                  Сначала работают жёсткие фильтры: виза, бюджет, длительность и ограничения по компании.
                  Затем — взвешенная оценка: формат отдыха (до 42 баллов), бюджет, сезон, темп, климат,
                  перелёт, комфорт и ваши акценты.
                </p>
                <p>
                  Пятый вариант со значком «Свежий взгляд» — намеренно другое направление по типу отдыха.
                  Это не ошибка подбора, а попытка показать неочевидную альтернативу.
                </p>
                ${TravelApp.views.footnote()}
              </div>
            </details>

            <footer class="results__foot">
              <button type="button" class="btn btn--ghost" data-action="edit" data-index="0">← Изменить ответы</button>
              <button type="button" class="btn btn--ghost" data-action="restart">Начать заново</button>
            </footer>
          ` : emptyState(state)}
        </div>
      </section>`;
  }

  return { render };
})();

/* Экран «портрет путешественника». */
window.TravelApp = window.TravelApp || {};
TravelApp.views = TravelApp.views || {};

TravelApp.views.summary = (function () {
  const ui = TravelApp.ui;
  const M = TravelApp.meta;

  function parseISO(value) {
    return new Date(`${value}T12:00:00`);
  }

  function dateLabel(answers) {
    const dates = answers.dates;
    if (dates.mode === 'exact' && dates.dateFrom) {
      const from = parseISO(dates.dateFrom);
      const to = dates.dateTo ? parseISO(dates.dateTo) : null;
      const format = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });
      const year = from.getFullYear();
      if (!to) return `${format.format(from)} ${year}`;
      return `${format.format(from)} — ${format.format(to)} ${to.getFullYear()}`;
    }
    if (dates.mode === 'season' && dates.season) {
      return `${M.seasonLabels[dates.season]} · ${M.seasonMonths[dates.season]}`;
    }
    if (dates.mode === 'flex') return 'Гибкие даты — подберём лучшее окно';
    return 'Не выбрано';
  }

  function chip(text, modifier) {
    return `<span class="chip chip--static ${modifier || ''}">${text}</span>`;
  }

  function qualifier(isFlexible) {
    return isFlexible
      ? '<span class="chip chip--key chip--soft">можно варьировать</span>'
      : '<span class="chip chip--key chip--hard">жёстко</span>';
  }

  function group(title, editIndex, content) {
    return `
      <article class="profile-card">
        <div class="profile-card__head">
          <h2>${title}</h2>
          <button type="button" class="profile-card__edit" data-action="edit" data-index="${editIndex}">Изменить</button>
        </div>
        <div class="chips chips--wrap">${content}</div>
      </article>`;
  }

  function visitedSection(visited) {
    const items = Array.isArray(visited) ? visited : [];
    const list = items.length
      ? `
        <ul class="visited-list">
          ${items.map((entry) => `
            <li class="visited-item">
              <div class="visited-item__body">
                <strong>${ui.escapeHtml(entry.place)}</strong>
                ${entry.route ? `<span>${ui.escapeHtml(entry.route)}</span>` : ''}
              </div>
              <button type="button" class="visited-item__remove"
                data-action="remove-visited" data-id="${ui.escapeHtml(entry.id)}"
                aria-label="Удалить поездку">×</button>
            </li>`).join('')}
        </ul>`
      : '<p class="visited-empty">Пока ничего не добавлено. Чем больше истории — тем меньше повторов в подборке.</p>';

    const suggestions = (TravelApp.destinations || [])
      .map((destination) => `<option value="${ui.escapeHtml(destination.title)}"></option>`)
      .join('');

    return `
      <section class="visited-profile">
        <div class="visited-profile__head">
          <div>
            <p class="eyebrow">История поездок</p>
            <h2>Где вы уже были</h2>
            <p class="visited-profile__lead">Добавьте места и маршруты — мы постараемся не предлагать их повторно, если есть свежие альтернативы.</p>
          </div>
        </div>

        ${list}

        <div class="visited-form">
          <label class="field">
            <span>Где были</span>
            <input type="text" data-field="visitedPlace" list="visited-place-options"
              maxlength="80" placeholder="Например, Алтай">
          </label>
          <label class="field">
            <span>Маршрут</span>
            <input type="text" data-field="visitedRoute" maxlength="160"
              placeholder="Например, Чемал — Телецкое озеро">
          </label>
          <button type="button" class="btn btn--ghost" data-action="add-visited">Добавить</button>
        </div>
        <datalist id="visited-place-options">${suggestions}</datalist>
      </section>`;
  }

  function render(state) {
    const answers = state.answers;
    const constraints = (answers.constraints.items || []).filter((item) => item !== 'none');
    const country = answers.country || { mode: 'open', id: null };

    const context = [
      chip(country.mode === 'chosen' && country.id
        ? `Страна: ${ui.escapeHtml(country.id)}`
        : 'Страна: предложите варианты'),
      chip(ui.optionLabel('party', answers.party && answers.party.id)),
      chip(dateLabel(answers)),
      chip(`${ui.days(answers.duration.value)} ${answers.duration.flex ? '· ±2 дня' : '· фиксированно'}`),
    ].join('');

    const format = [
      chip(answers.budget.value >= 600000 ? 'Без лимита' : `${ui.money(answers.budget.value)} на человека`),
      chip(answers.budget.flex ? 'можно +15%' : 'жёсткий потолок'),
      ...ui.typeLabels(answers.restTypes).map((label) => chip(label)),
      chip(`${M.paceLabels[answers.pace.id]} темп`),
      answers.pace.flex ? chip('темп можно варьировать', 'chip--soft') : chip('темп принципиален', 'chip--hard'),
    ].join('');

    const logistics = [
      chip(`${M.hotelLabels[answers.comfort.hotel]} · ${M.flightClassLabels[answers.comfort.flight]}`),
      answers.comfort.flex ? chip('комфорт можно варьировать', 'chip--soft') : chip('комфорт важен', 'chip--hard'),
      chip(ui.optionLabel('transfers', answers.transfers.id)),
      answers.transfers.flex ? chip('пересадки гибко', 'chip--soft') : chip('пересадки жёстко', 'chip--hard'),
      chip(ui.optionLabel('visa', answers.visa.id)),
    ].join('');

    const personal = [
      chip(M.climateLabels[answers.climate.id]),
      ...answers.interests.map((id) => chip(M.interestLabels[id])),
      ...constraints.map((id) => chip(ui.optionLabel('constraints', id), 'chip--warn')),
    ].join('');

    const dream = answers.constraints.dream
      ? `<blockquote class="dream">«${ui.escapeHtml(answers.constraints.dream)}»</blockquote>`
      : '';

    return `
      <section class="screen screen--summary ${state.instant ? 'screen--instant' : ''}">
        ${TravelApp.views.topbar({ meta: '<span class="topbar__note">Профиль готов</span>' })}
        <div class="summary">
          <header class="summary__head">
            <p class="eyebrow">Профиль готов</p>
            <h1>Ваш портрет<br><em>путешественника</em></h1>
            <p class="summary__lead">Проверьте вводные. Любой блок можно изменить — подбор пересчитается.</p>
          </header>

          <div class="profile-grid">
            ${group('Контекст', 0, context)}
            ${group('Бюджет и формат', 4, format)}
            ${group('Комфорт и логистика', 7, logistics)}
            ${group('Вы и желания', 10, personal)}
          </div>

          ${visitedSection(answers.visited)}

          ${dream ? `<div class="dream-wrap">${dream}</div>` : ''}

          <div class="summary__cta">
            <button type="button" class="btn btn--ghost" data-action="back-quiz">← Вернуться к вопросам</button>
            <button type="button" class="btn btn--primary btn--large" data-action="finish">Показать направления →</button>
          </div>
        </div>
      </section>`;
  }

  return { render };
})();

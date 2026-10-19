/* Экран вопроса. */
window.TravelApp = window.TravelApp || {};
TravelApp.views = TravelApp.views || {};

TravelApp.views.questionnaire = (function () {
  const ui = TravelApp.ui;

  function todayISO() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  }

  function flexToggle(question, answers) {
    if (!question.flex) return '';
    const value = Boolean(answers[question.id] && answers[question.id].flex);
    return `
      <div class="flex-toggle">
        <span class="flex-toggle__label">Как учитывать параметр</span>
        <div class="flex-toggle__control" role="group" aria-label="Жёсткость параметра">
          <button type="button" class="flex-toggle__btn ${!value ? 'is-active' : ''}"
            data-action="flex" data-question="${question.id}" data-value="false"
            aria-pressed="${!value}">${question.flex.offLabel}</button>
          <button type="button" class="flex-toggle__btn ${value ? 'is-active' : ''}"
            data-action="flex" data-question="${question.id}" data-value="true"
            aria-pressed="${value}">${question.flex.onLabel}</button>
        </div>
        <p class="flex-toggle__note">${question.flex.note}</p>
      </div>`;
  }

  function singleControl(question, answers) {
    const value = answers[question.id];
    const selectedId = value && typeof value === 'object' ? value.id : value;
    return `
      <div class="options" role="radiogroup" aria-label="${question.title}">
        ${question.options.map((option) => `
          <button type="button" class="option ${selectedId === option.id ? 'is-selected' : ''}"
            data-action="select" data-question="${question.id}" data-value="${option.id}"
            role="radio" aria-checked="${selectedId === option.id}">
            <span class="option__mark" aria-hidden="true"></span>
            <span class="option__body">
              <span class="option__label">${option.label}</span>
              ${option.desc ? `<span class="option__desc">${option.desc}</span>` : ''}
            </span>
          </button>`).join('')}
      </div>`;
  }

  function multiControl(question, answers) {
    const selected = answers[question.id] || [];
    const atMax = selected.length >= question.max;
    return `
      <div class="control-head">
        <span class="control-head__counter ${atMax ? 'is-max' : ''}">
          ${atMax ? `Максимум ${question.max} — снимите один выбор` : `Выбрано ${selected.length} из ${question.max}`}
        </span>
      </div>
      <div class="options options--multi" role="group" aria-label="${question.title}">
        ${question.options.map((option) => {
          const isSelected = selected.includes(option.id);
          const locked = atMax && !isSelected;
          return `
            <button type="button" class="option options--multi__item ${isSelected ? 'is-selected' : ''} ${locked ? 'is-locked' : ''}"
              data-action="multi" data-question="${question.id}" data-value="${option.id}"
              aria-pressed="${isSelected}" ${locked ? 'disabled' : ''}>
              <span class="option__mark" aria-hidden="true"></span>
              <span class="option__body">
                <span class="option__label">${option.label}</span>
                ${option.desc ? `<span class="option__desc">${option.desc}</span>` : ''}
              </span>
            </button>`;
        }).join('')}
      </div>`;
  }

  function datesControl(question, answers) {
    const dates = answers.dates;
    const mode = dates.mode;

    const modes = `
      <div class="segmented" role="group" aria-label="Степень свободы по датам">
        ${question.modes.map((item) => `
          <button type="button" class="segmented__item ${mode === item.id ? 'is-selected' : ''}"
            data-action="date-mode" data-value="${item.id}" aria-pressed="${mode === item.id}">
            <span class="segmented__label">${item.label}</span>
            <span class="segmented__desc">${item.desc}</span>
          </button>`).join('')}
      </div>`;

    let panel = '';
    if (mode === 'exact') {
      panel = `
        <div class="date-panel">
          <div class="field-row">
            <label class="field">
              <span>Туда</span>
              <input type="date" data-field="dateFrom" value="${dates.dateFrom || ''}" min="${todayISO()}">
            </label>
            <label class="field">
              <span>Обратно</span>
              <input type="date" data-field="dateTo" value="${dates.dateTo || ''}" min="${dates.dateFrom || todayISO()}">
            </label>
          </div>
          <label class="checkline">
            <input type="checkbox" data-field="nudge" ${dates.nudge ? 'checked' : ''}>
            <span class="checkline__box" aria-hidden="true"></span>
            <span>Даты можно сдвинуть на ±3 дня</span>
          </label>
          <p class="control-note">Если сдвиг невозможен — снимите галочку. Мы учтём это как жёсткое ограничение.</p>
        </div>`;
    } else if (mode === 'season') {
      panel = `
        <div class="date-panel">
          <div class="season-grid">
            ${question.seasons.map((season) => `
              <button type="button" class="season-card ${dates.season === season.id ? 'is-selected' : ''}"
                data-action="season" data-value="${season.id}" aria-pressed="${dates.season === season.id}">
                <span class="season-card__label">${season.label}</span>
                <span class="season-card__months">${season.months}</span>
              </button>`).join('')}
          </div>
          <p class="control-note">Мы выберем лучший месяц внутри сезона — под бюджет и погоду.</p>
        </div>`;
    } else if (mode === 'flex') {
      panel = `
        <div class="note-card note-card--accent">
          <strong>Полная свобода.</strong>
          Подберём окно, где совпадут сезон, цена перелёта и ваши даты. Обычно это экономит 10–20%.
        </div>`;
    } else {
      panel = `<p class="control-empty">Сначала выберите, насколько даты могут быть гибкими.</p>`;
    }

    return `${modes}${panel}`;
  }

  function durationControl(question, answers) {
    const value = answers.duration.value;
    return `
      <div class="range-control">
        <div class="range-value">
          <strong data-display="duration">${value}</strong>
          <span>${ui.plural(value, 'день', 'дня', 'дней')}</span>
        </div>
        <input class="range" type="range" data-field="duration"
          min="${question.min}" max="${question.max}" step="1" value="${value}"
          aria-label="Количество дней">
        <div class="range-scale"><span>${question.min}</span><span>${question.max}</span></div>
        <div class="range-presets">
          ${question.presets.map((preset) => `
            <button type="button" class="chip ${value === preset ? 'is-selected' : ''}"
              data-action="preset-duration" data-value="${preset}">${preset} дней</button>`).join('')}
        </div>
      </div>`;
  }

  function budgetControl(question, answers) {
    const value = answers.budget.value;
    const display = value >= question.max ? 'Без лимита' : ui.money(value);
    return `
      <div class="range-control">
        <div class="range-value">
          <strong data-display="budget">${display}</strong>
          <span>на человека, всё включено</span>
        </div>
        <input class="range" type="range" data-field="budget"
          min="${question.min}" max="${question.max}" step="${question.step}" value="${value}"
          aria-label="Бюджет на человека">
        <div class="range-scale"><span>${ui.money(question.min)}</span><span>${ui.money(question.max)}</span></div>
        <div class="range-presets">
          ${question.presets.map((preset) => `
            <button type="button" class="chip ${value === preset.value ? 'is-selected' : ''}"
              data-action="preset-budget" data-value="${preset.value}">${preset.label}</button>`).join('')}
        </div>
        <p class="control-note">Включает перелёт, жильё, питание, транспорт и активности. Не включает шопинг и визовые сборы.</p>
      </div>`;
  }

  function comfortControl(question, answers) {
    const comfort = answers.comfort;
    return `
      <div class="comfort">
        <div class="comfort__group">
          <h3>Отель</h3>
          <div class="chips chips--options">
            ${question.hotels.map((hotel) => `
              <button type="button" class="chip chip--option ${comfort.hotel === hotel.id ? 'is-selected' : ''}"
                data-action="hotel" data-value="${hotel.id}" aria-pressed="${comfort.hotel === hotel.id}">
                <strong>${hotel.label}</strong><span>${hotel.desc}</span>
              </button>`).join('')}
          </div>
        </div>
        <div class="comfort__group">
          <h3>Перелёт</h3>
          <div class="chips chips--options">
            ${question.flights.map((flight) => `
              <button type="button" class="chip chip--option ${comfort.flight === flight.id ? 'is-selected' : ''}"
                data-action="flight" data-value="${flight.id}" aria-pressed="${comfort.flight === flight.id}">
                <strong>${flight.label}</strong>
              </button>`).join('')}
          </div>
        </div>
      </div>`;
  }

  function constraintsControl(question, answers) {
    const selected = answers.constraints.items || [];
    return `
      <div class="chips chips--wrap constraints">
        ${question.options.map((option) => `
          <button type="button" class="chip ${selected.includes(option.id) ? 'is-selected' : ''}"
            data-action="constraint" data-value="${option.id}" aria-pressed="${selected.includes(option.id)}">
            ${option.label}
          </button>`).join('')}
      </div>
      <label class="field field--textarea">
        <span>О чём мечтаете? <small>необязательно</small></span>
        <textarea data-field="dream" rows="3" placeholder="${question.placeholder}">${ui.escapeHtml(answers.constraints.dream)}</textarea>
      </label>`;
  }

  function countryOptions() {
    const counts = new Map();
    (TravelApp.destinations || []).forEach((destination) => {
      counts.set(destination.country, (counts.get(destination.country) || 0) + 1);
    });

    const preferred = ['Россия', 'Грузия', 'Армения', 'Азербайджан'];
    return Array.from(counts, ([id, count]) => ({ id, count }))
      .sort((a, b) => {
        const aIndex = preferred.indexOf(a.id);
        const bIndex = preferred.indexOf(b.id);
        if (aIndex !== -1 || bIndex !== -1) {
          if (aIndex === -1) return 1;
          if (bIndex === -1) return -1;
          return aIndex - bIndex;
        }
        return a.id.localeCompare(b.id, 'ru');
      });
  }

  function countryControl(question, answers) {
    const value = answers.country || { mode: null, id: null };
    const mode = value.mode;
    const options = countryOptions();

    const modes = `
      <div class="options" role="radiogroup" aria-label="${question.title}">
        ${question.modes.map((item) => `
          <button type="button" class="option ${mode === item.id ? 'is-selected' : ''}"
            data-action="country-mode" data-value="${item.id}"
            role="radio" aria-checked="${mode === item.id}">
            <span class="option__mark" aria-hidden="true"></span>
            <span class="option__body">
              <span class="option__label">${item.label}</span>
              <span class="option__desc">${item.desc}</span>
            </span>
          </button>`).join('')}
      </div>`;

    let panel = '';
    if (mode === 'chosen') {
      panel = `
        <div class="country-panel">
          <p class="country-panel__label">Выберите страну</p>
          <div class="country-grid">
            ${options.map((country) => `
              <button type="button" class="chip chip--country ${value.id === country.id ? 'is-selected' : ''}"
                data-action="country" data-value="${ui.escapeHtml(country.id)}"
                aria-pressed="${value.id === country.id}">
                <span>${ui.escapeHtml(country.id)}</span>
                <small>${country.count}</small>
              </button>`).join('')}
          </div>
          <p class="control-note">Покажем только направления внутри выбранной страны. Если подходящих маршрутов не останется, можно ослабить другие условия.</p>
        </div>`;
    } else if (mode === 'open') {
      panel = `
        <div class="note-card note-card--accent">
          <strong>Свободный подбор.</strong>
          Покажем направления из всего каталога — от России и Кавказа до зарубежных маршрутов.
        </div>`;
    } else {
      panel = '<p class="control-empty">Сначала выберите, есть ли у вас страна.</p>';
    }

    return `${modes}${panel}`;
  }

  function controlFor(question, answers) {
    switch (question.kind) {
      case 'country':
        return countryControl(question, answers);
      case 'single':
        return singleControl(question, answers);
      case 'multi':
        return multiControl(question, answers);
      case 'dates':
        return datesControl(question, answers);
      case 'duration':
        return durationControl(question, answers);
      case 'budget':
        return budgetControl(question, answers);
      case 'comfort':
        return comfortControl(question, answers);
      case 'constraints':
        return constraintsControl(question, answers);
      default:
        return '';
    }
  }

  function render(state) {
    const questions = TravelApp.questions;
    const index = Math.max(0, Math.min(state.qIndex, questions.length - 1));
    const question = questions[index];
    const block = TravelApp.blocks[question.block];
    const answers = state.answers;
    const answered = ui.isAnswered(question, answers);
    const isLast = index === questions.length - 1;
    const progress = Math.round(((index + 1) / questions.length) * 100);

    return `
      <section class="screen screen--quiz ${state.instant ? 'screen--instant' : ''}">
        ${TravelApp.views.topbar({
          meta: `<span class="topbar__note">${block.label}</span><span class="topbar__count">${index + 1} / ${questions.length}</span>`,
        })}
        <div class="progress" aria-hidden="true"><span style="width:${progress}%"></span></div>

        <div class="quiz">
          <aside class="quiz__aside">
            <p class="eyebrow">Блок ${question.block + 1} · ${block.short}</p>
            <h1 class="quiz__title">${question.title}</h1>
            <p class="quiz__subtitle">${question.subtitle}</p>
            ${flexToggle(question, answers)}
          </aside>

          <div class="quiz__main">
            <div class="quiz__control">${controlFor(question, answers)}</div>
            ${question.hint ? `<p class="quiz__hint-note">${question.hint}</p>` : ''}
          </div>
        </div>

        <footer class="quiz__footer">
          <button type="button" class="btn btn--ghost" data-action="back" ${index === 0 ? 'data-home="true"' : ''}>← Назад</button>
          <span class="quiz__status ${answered ? 'is-ready' : ''}">
            ${answered ? 'Готово · можно листать стрелками ← →' : 'Выберите вариант, чтобы продолжить'}
          </span>
          <button type="button" class="btn btn--primary" data-action="next" ${answered ? '' : 'disabled'}>
            ${isLast ? 'Собрать профиль' : 'Далее'} →
          </button>
        </footer>
      </section>`;
  }

  return { render };
})();

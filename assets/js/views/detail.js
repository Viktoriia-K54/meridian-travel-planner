/* Детальный маршрут выбранного направления. */
window.TravelApp = window.TravelApp || {};
TravelApp.views = TravelApp.views || {};

TravelApp.views.detail = (function () {
  const ui = TravelApp.ui;
  const M = TravelApp.meta;

  const BUDGET_LABELS = {
    flights: 'Перелёт',
    stay: 'Жильё',
    food: 'Питание',
    transport: 'Транспорт',
    activities: 'Активности',
    buffer: 'Резерв',
  };

  const BASE_PACKING = [
    'Загранпаспорт и копии',
    'Страховка',
    'Личные лекарства',
    'Павербанк',
    'Адаптер питания',
    'eSIM и офлайн-карты',
  ];

  function quickFacts(destination) {
    return `
      <dl class="quick-facts">
        <div><dt>Тип отдыха</dt><dd>${ui.typeLabels(destination.types).join(', ')}</dd></div>
        <div><dt>Сложность</dt><dd>${TravelApp.views.difficulty(destination.difficulty)}</dd></div>
        <div><dt>Темп</dt><dd>${M.paceLabels[destination.pace]}</dd></div>
        <div><dt>Длительность</dt><dd>${destination.days[0]}–${destination.days[1]} дней</dd></div>
        <div><dt>Бюджет</dt><dd>${ui.moneyRange([destination.totals.min, destination.totals.max])}</dd></div>
        <div><dt>Сезон</dt><dd>${ui.monthRange(destination.months)}</dd></div>
        <div><dt>Перелёт</dt><dd>${destination.flight.hours} ч${destination.flight.direct ? ', прямой' : ', со стыковкой'}</dd></div>
        <div><dt>Виза</dt><dd>${M.visaLabels[destination.visa]}</dd></div>
      </dl>`;
  }

  function timeline(itinerary) {
    return `
      <ol class="timeline">
        ${itinerary.days.map((day, index) => `
          <li class="timeline__item">
            <span class="timeline__num">${String(index + 1).padStart(2, '0')}</span>
            <div class="timeline__content">
              <span class="timeline__place">${day.place}</span>
              <h3>${day.title}</h3>
              <ul class="timeline__list">
                ${day.items.map((item) => `<li>${item}</li>`).join('')}
              </ul>
            </div>
          </li>`).join('')}
      </ol>`;
  }

  function budgetTable(destination) {
    const parts = destination.budgetParts;
    const rows = Object.keys(BUDGET_LABELS).map((key) => `
      <tr>
        <td>${BUDGET_LABELS[key]}</td>
        <td>${ui.moneyRange(parts[key])}</td>
      </tr>`).join('');

    return `
      <table class="budget-table">
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td>Итого на человека</td>
            <td>${ui.moneyRange([destination.totals.min, destination.totals.max])}</td>
          </tr>
        </tfoot>
      </table>
      <p class="panel__note">
        Ориентир при двухместном размещении. Для одноместной поездки добавьте 15–25%.
        Шопинг, визовые сборы и личные траты не включены.
      </p>`;
  }

  function factsGrid(destination) {
    return `
      <div class="info-grid">
        <article class="info-card">
          <h3>Перелёт</h3>
          <p class="info-card__value">${destination.flight.hours} ч · ${destination.flight.direct ? 'прямой' : 'со стыковкой'}</p>
          <p>${destination.flight.note}</p>
        </article>
        <article class="info-card">
          <h3>Виза</h3>
          <p class="info-card__value">${M.visaLabels[destination.visa]}</p>
          <p>${destination.visaHint}</p>
        </article>
        <article class="info-card info-card--wide">
          <h3>Как перемещаться</h3>
          <p>${destination.transportNote}</p>
        </article>
      </div>`;
  }

  function stayGrid(itinerary) {
    return `
      <div class="stay-grid">
        ${itinerary.stay.map((item) => `
          <article class="stay-card">
            <h3>${item.area}</h3>
            <p>${item.note}</p>
          </article>`).join('')}
      </div>`;
  }

  function checklist(destination, itinerary, checks) {
    const checkedCount = Object.values(checks).filter(Boolean).length;
    return `
      <div class="checklist-head">
        <span>${checkedCount} из ${itinerary.booking.length} отмечено</span>
        <span class="checklist-head__hint">Отметки сохраняются автоматически</span>
      </div>
      <ul class="checklist">
        ${itinerary.booking.map((item, index) => `
          <li class="check-item ${checks[index] ? 'is-checked' : ''}">
            <label>
              <input type="checkbox" data-action="toggle-check" data-id="${destination.id}" data-index="${index}"
                ${checks[index] ? 'checked' : ''}>
              <span class="check-item__box" aria-hidden="true"></span>
              <span>${item}</span>
            </label>
          </li>`).join('')}
      </ul>`;
  }

  function packing(itinerary, destination) {
    const items = [...BASE_PACKING];
    if (destination.visa !== 'none') items.splice(1, 0, 'Виза / разрешение');
    return `
      <div class="chips chips--wrap">
        ${[...items, ...itinerary.packing].map((item) => `<span class="chip chip--static">${item}</span>`).join('')}
      </div>`;
  }

  function risks(itinerary) {
    return `
      <div class="risk-grid">
        ${itinerary.risks.map((risk) => `
          <article class="risk-card">
            <h3>${risk.title}</h3>
            <p>${risk.text}</p>
          </article>`).join('')}
      </div>`;
  }

  function render(state) {
    const destination = TravelApp.destinations.find((item) => item.id === state.detailId);
    const itinerary = TravelApp.itineraries[state.detailId];
    if (!destination || !itinerary) return '';

    const totals = TravelApp.Matcher.budgetTotals(destination);
    const trip = { ...destination, totals };

    const match = state.results && state.results.items
      ? state.results.items.find((item) => item.id === destination.id)
      : null;
    const percent = match ? match.percent : null;
    const reasons = match ? match.reasons : destination.highlights;
    const notes = match ? match.notes : [];
    const checks = state.checks[destination.id] || {};
    const chosen = state.chosenId === destination.id;

    return `
      <section class="screen screen--detail ${state.instant ? 'screen--instant' : ''}">
        ${TravelApp.views.topbar({
          meta: `<span class="topbar__note">${destination.country} · ${destination.region}</span>`,
          back: { action: 'back-results', label: '← К подборке' },
        })}

        <header class="detail-hero">
          <div class="detail-hero__media" aria-hidden="true">
            ${TravelApp.views.image(destination, { eager: true })}
          </div>
          <div class="detail-hero__shade" aria-hidden="true"></div>
          <div class="detail-hero__content">
            <div class="detail-hero__text">
              <p class="eyebrow eyebrow--light">${destination.country} · ${destination.region}</p>
              <h1>${destination.title}</h1>
              <p class="detail-hero__place">${destination.place}</p>
              <div class="detail-hero__chips">
                ${ui.typeLabels(destination.types).map((label) => `<span class="chip chip--light">${label}</span>`).join('')}
              </div>
            </div>
            <div class="detail-hero__side">
              ${percent !== null ? TravelApp.views.matchRing(percent) : ''}
              <div class="detail-hero__facts">
                <span>${destination.days[0]}–${destination.days[1]} дней</span>
                <span>${ui.moneyRange([trip.totals.min, trip.totals.max])} / чел.</span>
              </div>
            </div>
          </div>
        </header>

        <div class="detail">
          <main class="detail__main">
            <section class="panel">
              <div class="panel__head">
                <span class="panel__num">01</span>
                <h2>Почему вам</h2>
              </div>
              <ul class="reasons">
                ${reasons.map((reason) => `<li>${reason}</li>`).join('')}
              </ul>
              ${notes.length ? `
                <div class="note-card">
                  <strong>Честные оговорки</strong>
                  <ul>${notes.map((note) => `<li>${note}</li>`).join('')}</ul>
                </div>` : ''}
              <div class="highlights">
                <h3>Не пропустить</h3>
                <div class="chips chips--wrap">
                  ${destination.highlights.map((item) => `<span class="chip chip--static">${item}</span>`).join('')}
                </div>
              </div>
            </section>

            <section class="panel">
              <div class="panel__head">
                <span class="panel__num">02</span>
                <h2>Маршрут по дням</h2>
              </div>
              <p class="panel__note">${itinerary.paceNote}</p>
              ${timeline(itinerary)}
              <div class="note-card note-card--accent">
                <strong>Если дней меньше или больше.</strong>
                ${itinerary.trim}
              </div>
            </section>

            <section class="panel">
              <div class="panel__head">
                <span class="panel__num">03</span>
                <h2>Бюджет</h2>
              </div>
              ${budgetTable(trip)}
            </section>

            <section class="panel">
              <div class="panel__head">
                <span class="panel__num">04</span>
                <h2>Логистика</h2>
              </div>
              ${factsGrid({ ...destination, transportNote: itinerary.transport })}
            </section>

            <section class="panel">
              <div class="panel__head">
                <span class="panel__num">05</span>
                <h2>Где жить</h2>
              </div>
              ${stayGrid(itinerary)}
            </section>

            <section class="panel">
              <div class="panel__head">
                <span class="panel__num">06</span>
                <h2>Что забронировать</h2>
              </div>
              ${checklist(destination, itinerary, checks)}
            </section>

            <section class="panel">
              <div class="panel__head">
                <span class="panel__num">07</span>
                <h2>Что взять</h2>
              </div>
              ${packing(itinerary, destination)}
            </section>

            <section class="panel">
              <div class="panel__head">
                <span class="panel__num">08</span>
                <h2>Что учесть</h2>
              </div>
              ${risks(itinerary)}
            </section>

            ${TravelApp.views.footnote()}
          </main>

          <aside class="detail__aside">
            <div class="sticky-card">
              <p class="eyebrow eyebrow--light">Ваш выбор</p>
              <h2>${destination.title}</h2>
              <p class="sticky-card__place">${destination.country} · ${destination.place}</p>
              ${quickFacts(trip)}
              <button type="button" class="btn btn--light btn--block" data-action="choose-trip" data-id="${destination.id}">
                ${chosen ? '✓ Выбрано — отменить' : 'Выбрать это путешествие'}
              </button>
              <button type="button" class="btn btn--outline-light btn--block" data-action="print">
                Скачать / распечатать
              </button>
              <p class="sticky-card__micro">
                Бюджет — ориентировочная оценка. Цены и визовые правила проверяем перед бронированием.
              </p>
            </div>
          </aside>
        </div>
      </section>`;
  }

  return { render };
})();

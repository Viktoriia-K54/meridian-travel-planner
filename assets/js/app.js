/* Точка входа: состояние, навигация, события. */
(function () {
  const ui = TravelApp.ui;
  const questions = TravelApp.questions;
  const app = document.getElementById('main');
  const toastEl = document.getElementById('toast');
  let toastTimer = null;

  function emptyAnswers() {
    return {
      country: { mode: null, id: null },
      visited: [],
      party: null,
      dates: { mode: null, dateFrom: '', dateTo: '', season: '', nudge: false },
      duration: { value: 8, flex: true },
      budget: { value: 180000, flex: false },
      restTypes: [],
      pace: { id: null, flex: true },
      comfort: { hotel: '4', flight: 'economy', flex: true },
      transfers: { id: null, flex: false },
      visa: { id: null },
      climate: { id: 'any' },
      interests: [],
      constraints: { items: ['none'], dream: '' },
    };
  }

  function normalizeIdAnswer(value) {
    if (typeof value === 'string') return { id: value };
    return value || null;
  }

  function hydrateAnswers(saved) {
    const base = emptyAnswers();
    if (!saved) return base;
    return {
      ...base,
      ...saved,
      country: saved.country && typeof saved.country === 'object'
        ? { ...base.country, ...saved.country }
        : base.country,
      visited: Array.isArray(saved.visited)
        ? saved.visited
          .filter((item) => item && typeof item.place === 'string' && item.place.trim())
          .map((item) => ({
            id: typeof item.id === 'string' ? item.id : `visit-${item.place}`,
            place: item.place.slice(0, 80),
            route: typeof item.route === 'string' ? item.route.slice(0, 160) : '',
          }))
        : [],
      party: normalizeIdAnswer(saved.party) || base.party,
      dates: { ...base.dates, ...(saved.dates || {}) },
      duration: { ...base.duration, ...(saved.duration || {}) },
      budget: { ...base.budget, ...(saved.budget || {}) },
      pace: { ...base.pace, ...normalizeIdAnswer(saved.pace) },
      comfort: { ...base.comfort, ...(saved.comfort || {}) },
      transfers: { ...base.transfers, ...normalizeIdAnswer(saved.transfers) },
      visa: { ...base.visa, ...normalizeIdAnswer(saved.visa) },
      climate: { ...base.climate, ...normalizeIdAnswer(saved.climate) },
      constraints: {
        ...base.constraints,
        ...(saved.constraints || {}),
        items: Array.isArray(saved.constraints && saved.constraints.items)
          ? saved.constraints.items
          : base.constraints.items,
      },
      restTypes: Array.isArray(saved.restTypes) ? saved.restTypes : [],
      interests: Array.isArray(saved.interests) ? saved.interests : [],
    };
  }

  function createState() {
    return {
      screen: 'intro',
      qIndex: 0,
      answers: emptyAnswers(),
      results: null,
      chosenId: null,
      checks: {},
      detailId: null,
      hasProgress: false,
      instant: false,
      savedScreen: null,
      savedDetailId: null,
    };
  }

  let state = createState();

  const saved = TravelApp.Storage.load();
  if (saved) {
    state.answers = hydrateAnswers(saved.answers);
    state.qIndex = Number.isFinite(saved.qIndex) ? saved.qIndex : 0;
    state.chosenId = saved.chosenId || null;
    state.checks = saved.checks || {};
    state.savedScreen = saved.screen || null;
    state.savedDetailId = saved.detailId || null;
    state.hasProgress = hasProgress(state.answers);
    applyRoute();
  }

  function hasProgress(answers) {
    return Boolean(
      (answers.country && answers.country.mode) ||
      (answers.visited && answers.visited.length) ||
      answers.party ||
      answers.dates.mode ||
      (answers.restTypes && answers.restTypes.length) ||
      (answers.interests && answers.interests.length) ||
      answers.pace.id ||
      answers.transfers.id ||
      answers.visa.id
    );
  }

  function allAnswered() {
    return questions.every((question) => ui.isAnswered(question, state.answers));
  }

  function firstUnanswered() {
    return questions.findIndex((question) => !ui.isAnswered(question, state.answers));
  }

  function currentQuestion() {
    return questions[state.qIndex];
  }

  function save() {
    state.hasProgress = hasProgress(state.answers);
    TravelApp.Storage.save(state);
  }

  function routeFor() {
    switch (state.screen) {
      case 'quiz':
        return `#/quiz/${state.qIndex + 1}`;
      case 'summary':
        return '#/summary';
      case 'results':
        return '#/results';
      case 'detail':
        return `#/trip/${state.detailId}`;
      default:
        return '#/';
    }
  }

  function pushHash() {
    const hash = routeFor();
    if (window.location.hash === hash) return;
    try {
      window.history.pushState({}, '', hash);
    } catch (error) {
      /* file:// в редких браузерах — просто живём без истории */
    }
  }

  function ensureResults() {
    if (!allAnswered()) {
      const index = firstUnanswered();
      state.qIndex = index >= 0 ? index : 0;
      state.screen = 'quiz';
      return false;
    }
    state.results = TravelApp.Matcher.match(state.answers);
    return true;
  }

  function viewFor(screen) {
    switch (screen) {
      case 'quiz':
        return TravelApp.views.questionnaire;
      case 'summary':
        return TravelApp.views.summary;
      case 'results':
        return TravelApp.views.results;
      case 'detail':
        return TravelApp.views.detail;
      default:
        return { render: TravelApp.views.intro };
    }
  }

  function render(animate) {
    if ((state.screen === 'results' || state.screen === 'detail') && !state.results) {
      ensureResults();
    }
    if (state.screen === 'detail' && !TravelApp.itineraries[state.detailId]) {
      state.screen = 'results';
    }

    state.instant = animate === false;
    app.innerHTML = viewFor(state.screen).render(state);
    state.instant = false;

    if (animate !== false) window.scrollTo(0, 0);
  }

  function navigate() {
    pushHash();
    save();
    render(true);
  }

  function instant() {
    save();
    render(false);
  }

  function applyRoute() {
    const hash = window.location.hash || '';
    if (hash.startsWith('#/quiz/')) {
      const number = Number.parseInt(hash.replace('#/quiz/', ''), 10);
      state.screen = 'quiz';
      state.qIndex = Number.isFinite(number)
        ? Math.max(0, Math.min(questions.length - 1, number - 1))
        : 0;
      return true;
    }
    if (hash === '#/summary' && allAnswered()) {
      state.screen = 'summary';
      return true;
    }
    if (hash === '#/results' && allAnswered()) {
      state.screen = 'results';
      return true;
    }
    if (hash.startsWith('#/trip/') && allAnswered()) {
      const id = decodeURIComponent(hash.slice(7));
      if (TravelApp.itineraries[id]) {
        state.detailId = id;
        state.screen = 'detail';
        return true;
      }
    }
    state.screen = 'intro';
    return false;
  }

  function toast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toastEl.classList.remove('is-visible');
    }, 2600);
  }

  function syncNextState() {
    const question = currentQuestion();
    if (!question) return;
    const answered = ui.isAnswered(question, state.answers);
    const button = app.querySelector('[data-action="next"]');
    if (button) button.disabled = !answered;
    const status = app.querySelector('.quiz__status');
    if (status) {
      status.classList.toggle('is-ready', answered);
      status.textContent = answered
        ? 'Готово · можно листать стрелками ← →'
        : 'Выберите вариант, чтобы продолжить';
    }
  }

  function syncPresetChips(action, value) {
    app.querySelectorAll(`[data-action="${action}"]`).forEach((element) => {
      element.classList.toggle('is-selected', Number(element.dataset.value) === Number(value));
    });
  }

  function setAnswer(questionId, value) {
    state.answers = { ...state.answers, [questionId]: value };
    state.results = null;
  }

  const actions = {
    start() {
      state.qIndex = 0;
      state.screen = 'quiz';
      navigate();
    },

    resume() {
      if (!state.hasProgress) {
        actions.start();
        return;
      }
      if (state.savedScreen === 'detail' && state.savedDetailId && TravelApp.itineraries[state.savedDetailId] && allAnswered()) {
        state.detailId = state.savedDetailId;
        if (ensureResults()) state.screen = 'detail';
      } else if (state.savedScreen === 'results' && allAnswered()) {
        if (ensureResults()) state.screen = 'results';
      } else if (state.savedScreen === 'summary' && allAnswered()) {
        state.screen = 'summary';
      } else {
        const index = firstUnanswered();
        state.qIndex = index >= 0 ? index : state.qIndex;
        state.screen = 'quiz';
      }
      navigate();
    },

    restart() {
      if (!window.confirm('Сбросить ответы и начать заново?')) return;
      TravelApp.Storage.clear();
      state = createState();
      try {
        window.history.replaceState({}, '', '#/');
      } catch (error) {
        /* ignore */
      }
      render(true);
      toast('Ответы сброшены');
    },

    home() {
      state.screen = 'intro';
      navigate();
    },

    'scroll-steps'() {
      const steps = document.getElementById('steps');
      if (steps) steps.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    next() {
      const question = currentQuestion();
      if (!question || !ui.isAnswered(question, state.answers)) return;
      if (state.qIndex >= questions.length - 1) {
        state.screen = 'summary';
        navigate();
        return;
      }
      state.qIndex += 1;
      navigate();
    },

    back() {
      if (state.qIndex <= 0) {
        state.screen = 'intro';
        navigate();
        return;
      }
      state.qIndex -= 1;
      navigate();
    },

    edit(element) {
      const index = Number(element.dataset.index);
      state.qIndex = Number.isFinite(index) ? Math.max(0, Math.min(questions.length - 1, index)) : 0;
      state.screen = 'quiz';
      navigate();
    },

    select(element) {
      const questionId = element.dataset.question;
      const value = element.dataset.value;
      const current = state.answers[questionId];
      const next = current && typeof current === 'object'
        ? { ...current, id: value }
        : { id: value };
      setAnswer(questionId, next);
      instant();
    },

    'country-mode'(element) {
      const mode = element.dataset.value;
      const current = state.answers.country || { mode: null, id: null };
      setAnswer('country', {
        ...current,
        mode,
        id: mode === 'open' ? null : current.id,
      });
      instant();
    },

    country(element) {
      const current = state.answers.country || { mode: 'chosen', id: null };
      setAnswer('country', {
        ...current,
        mode: 'chosen',
        id: element.dataset.value,
      });
      instant();
    },

    multi(element) {
      const questionId = element.dataset.question;
      const question = questions.find((item) => item.id === questionId);
      const current = state.answers[questionId] || [];
      const value = element.dataset.value;
      const isSelected = current.includes(value);

      if (!isSelected && current.length >= question.max) {
        toast(`Можно выбрать не больше ${question.max}`);
        return;
      }

      const next = isSelected
        ? current.filter((item) => item !== value)
        : [...current, value];
      setAnswer(questionId, next);
      instant();
    },

    flex(element) {
      const questionId = element.dataset.question;
      const value = element.dataset.value === 'true';
      setAnswer(questionId, { ...state.answers[questionId], flex: value });
      instant();
    },

    'date-mode'(element) {
      const mode = element.dataset.value;
      setAnswer('dates', { ...state.answers.dates, mode });
      instant();
    },

    season(element) {
      setAnswer('dates', { ...state.answers.dates, season: element.dataset.value });
      instant();
    },

    'preset-duration'(element) {
      const value = Number(element.dataset.value);
      setAnswer('duration', { ...state.answers.duration, value });
      instant();
    },

    'preset-budget'(element) {
      const value = Number(element.dataset.value);
      setAnswer('budget', { ...state.answers.budget, value });
      instant();
    },

    hotel(element) {
      setAnswer('comfort', { ...state.answers.comfort, hotel: element.dataset.value });
      instant();
    },

    flight(element) {
      setAnswer('comfort', { ...state.answers.comfort, flight: element.dataset.value });
      instant();
    },

    constraint(element) {
      const value = element.dataset.value;
      const current = state.answers.constraints.items || [];
      let items;

      if (value === 'none') {
        items = ['none'];
      } else if (current.includes(value)) {
        items = current.filter((item) => item !== value);
      } else {
        items = [...current.filter((item) => item !== 'none'), value];
      }

      if (!items.length) items = ['none'];

      setAnswer('constraints', { ...state.answers.constraints, items });
      instant();
    },

    'add-visited'() {
      const placeInput = app.querySelector('[data-field="visitedPlace"]');
      const routeInput = app.querySelector('[data-field="visitedRoute"]');
      const place = placeInput ? placeInput.value.trim() : '';
      const route = routeInput ? routeInput.value.trim() : '';

      if (!place) {
        toast('Укажите место, где вы уже были');
        if (placeInput) placeInput.focus();
        return;
      }

      const current = state.answers.visited || [];
      if (current.length >= 20) {
        toast('Можно добавить до 20 поездок');
        return;
      }

      const entry = {
        id: `visit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        place: place.slice(0, 80),
        route: route.slice(0, 160),
      };

      setAnswer('visited', [...current, entry]);
      instant();
      toast('Добавлено в историю поездок');
    },

    'remove-visited'(element) {
      const id = element.dataset.id;
      const current = state.answers.visited || [];
      setAnswer('visited', current.filter((item) => item.id !== id));
      instant();
    },

    'back-quiz'() {
      state.qIndex = questions.length - 1;
      state.screen = 'quiz';
      navigate();
    },

    finish() {
      if (!ensureResults()) {
        navigate();
        return;
      }
      state.screen = 'results';
      navigate();
    },

    summary() {
      if (!allAnswered()) {
        state.qIndex = Math.max(0, firstUnanswered());
        state.screen = 'quiz';
      } else {
        state.screen = 'summary';
      }
      navigate();
    },

    'open-trip'(element) {
      if (!ensureResults()) {
        navigate();
        return;
      }
      state.detailId = element.dataset.id;
      state.screen = 'detail';
      navigate();
    },

    'back-results'() {
      if (!ensureResults()) {
        navigate();
        return;
      }
      state.screen = 'results';
      navigate();
    },

    'choose-trip'(element) {
      const id = element.dataset.id;
      state.chosenId = state.chosenId === id ? null : id;
      instant();
      toast(state.chosenId ? 'Путешествие выбрано — отметки сохраняются' : 'Выбор отменён');
    },

    print() {
      window.print();
    },
  };

  app.addEventListener('click', (event) => {
    const element = event.target.closest('[data-action]');
    if (!element || element.disabled) return;
    const action = element.dataset.action;
    if (actions[action]) actions[action](element);
  });

  app.addEventListener('input', (event) => {
    const field = event.target.dataset.field;
    if (!field) return;

    if (field === 'duration') {
      const value = Number(event.target.value);
      setAnswer('duration', { ...state.answers.duration, value });
      const display = app.querySelector('[data-display="duration"]');
      if (display) display.textContent = value;
      const label = display && display.nextElementSibling;
      if (label) label.textContent = ui.plural(value, 'день', 'дня', 'дней');
      syncPresetChips('preset-duration', value);
      syncNextState();
      return;
    }

    if (field === 'budget') {
      const value = Number(event.target.value);
      setAnswer('budget', { ...state.answers.budget, value });
      const display = app.querySelector('[data-display="budget"]');
      if (display) display.textContent = value >= 600000 ? 'Без лимита' : ui.money(value);
      syncPresetChips('preset-budget', value);
      return;
    }

    if (field === 'dream') {
      setAnswer('constraints', { ...state.answers.constraints, dream: event.target.value });
      return;
    }

    if (field === 'dateFrom' || field === 'dateTo') {
      setAnswer('dates', { ...state.answers.dates, [field]: event.target.value });
      if (field === 'dateFrom') {
        const to = app.querySelector('[data-field="dateTo"]');
        if (to) to.min = event.target.value;
      }
      syncNextState();
    }
  });

  app.addEventListener('change', (event) => {
    const field = event.target.dataset.field;
    const action = event.target.dataset.action;

    if (field === 'nudge') {
      setAnswer('dates', { ...state.answers.dates, nudge: event.target.checked });
      save();
      return;
    }

    if (field === 'dateFrom' || field === 'dateTo') {
      setAnswer('dates', { ...state.answers.dates, [field]: event.target.value });
      syncNextState();
      save();
      return;
    }

    if (field === 'duration' || field === 'budget' || field === 'dream') {
      save();
      return;
    }

    if (action === 'toggle-check') {
      const id = event.target.dataset.id;
      const index = event.target.dataset.index;
      const current = state.checks[id] || {};
      state.checks = {
        ...state.checks,
        [id]: { ...current, [index]: event.target.checked },
      };
      instant();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (state.screen !== 'quiz') return;
    const tag = (event.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    if (event.key === 'ArrowRight') {
      const button = app.querySelector('[data-action="next"]');
      if (button && !button.disabled) {
        event.preventDefault();
        actions.next();
      }
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      actions.back();
    }
  });

  window.addEventListener('popstate', () => {
    applyRoute();
    render(true);
  });

  render(true);
})();

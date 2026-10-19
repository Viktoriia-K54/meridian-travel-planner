/* Общие утилиты форматирования и безопасной вставки. */
window.TravelApp = window.TravelApp || {};

TravelApp.ui = (function () {
  const moneyFormatter = new Intl.NumberFormat('ru-RU');

  function money(value) {
    return `${moneyFormatter.format(Math.round(value))} ₽`;
  }

  function moneyRange(range) {
    if (!range) return '';
    return `${money(range[0])} – ${money(range[1])}`;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function plural(number, one, few, many) {
    const n = Math.abs(number) % 100;
    const n1 = n % 10;
    if (n > 10 && n < 20) return many;
    if (n1 > 1 && n1 < 5) return few;
    if (n1 === 1) return one;
    return many;
  }

  function days(number) {
    return `${number} ${plural(number, 'день', 'дня', 'дней')}`;
  }

  function monthRange(months) {
    const names = TravelApp.meta.monthNames;
    const sorted = Array.from(new Set(months)).sort((a, b) => a - b);
    if (!sorted.length) return '';

    const runs = [];
    let start = sorted[0];
    let prev = sorted[0];

    for (let i = 1; i < sorted.length; i += 1) {
      const current = sorted[i];
      if (current === prev + 1) {
        prev = current;
      } else {
        runs.push([start, prev]);
        start = current;
        prev = current;
      }
    }
    runs.push([start, prev]);

    return runs
      .map(([from, to]) => (from === to ? names[from - 1] : `${names[from - 1]} — ${names[to - 1]}`))
      .join(', ');
  }

  function difficultyDots(level) {
    return Array.from({ length: 5 }, (_, index) => (
      `<span class="dot ${index < level ? 'is-on' : ''}" aria-hidden="true"></span>`
    )).join('');
  }

  function optionLabel(questionId, optionId) {
    const question = (TravelApp.questions || []).find((item) => item.id === questionId);
    if (!question || !question.options) return optionId;
    const option = question.options.find((item) => item.id === optionId);
    return option ? option.label : optionId;
  }

  function typeLabels(types) {
    return types.map((type) => TravelApp.meta.typeLabels[type] || type);
  }

  function isAnswered(question, answers) {
    const value = answers[question.id];
    switch (question.id) {
      case 'country':
        if (!value || !value.mode) return false;
        if (value.mode === 'open') return true;
        return Boolean(value.id);
      case 'party':
        return Boolean(value);
      case 'dates':
        if (value.mode === 'exact') return Boolean(value.dateFrom);
        if (value.mode === 'season') return Boolean(value.season);
        return value.mode === 'flex';
      case 'duration':
        return Number(value.value) >= question.min;
      case 'budget':
        return Number(value.value) >= question.min;
      case 'restTypes':
        return value.length > 0;
      case 'pace':
        return Boolean(value.id);
      case 'comfort':
        return Boolean(value.hotel && value.flight);
      case 'transfers':
        return Boolean(value.id);
      case 'visa':
        return Boolean(value.id);
      case 'climate':
        return Boolean(value.id);
      case 'interests':
        return value.length > 0;
      case 'constraints':
        return true;
      default:
        return true;
    }
  }

  return {
    money,
    moneyRange,
    escapeHtml,
    plural,
    days,
    monthRange,
    difficultyDots,
    optionLabel,
    typeLabels,
    isAnswered,
  };
})();

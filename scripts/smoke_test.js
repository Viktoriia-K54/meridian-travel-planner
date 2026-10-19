/**
 * Дымовые проверки: целостность данных, подбор, рендер экранов.
 * Запуск: node scripts/smoke_test.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const FILES = [
  'assets/js/data/meta.js',
  'assets/js/data/questions.js',
  'assets/js/data/destinations.js',
  'assets/js/data/itineraries-a.js',
  'assets/js/data/itineraries-b.js',
  'assets/js/data/itineraries-c.js',
  'assets/js/data/itineraries-d.js',
  'assets/js/ui.js',
  'assets/js/matcher.js',
  'assets/js/views/shared.js',
  'assets/js/views/intro.js',
  'assets/js/views/questionnaire.js',
  'assets/js/views/summary.js',
  'assets/js/views/results.js',
  'assets/js/views/detail.js',
];

const context = {
  console,
  Intl,
  Date,
  Math,
  JSON,
  Number,
  String,
  Object,
  Array,
  Set,
  Map,
  Promise,
  setTimeout,
  clearTimeout,
};
context.window = context;
context.globalThis = context;
vm.createContext(context);

for (const file of FILES) {
  const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
  vm.runInContext(code, context, { filename: file });
}

const T = context.TravelApp;
const ui = T.ui;

let failures = 0;
let checks = 0;

function check(condition, message) {
  checks += 1;
  if (!condition) {
    failures += 1;
    console.log(`FAIL: ${message}`);
  }
}

function noBrokenMarkup(label, html) {
  check(!html.includes('undefined'), `${label}: содержит "undefined"`);
  check(!html.includes('NaN'), `${label}: содержит "NaN"`);
  check(!html.includes('[object Object]'), `${label}: содержит "[object Object]"`);
}

function makeAnswers(overrides) {
  const base = {
    country: { mode: 'open', id: null },
    visited: [],
    party: { id: 'couple' },
    dates: { mode: 'flex', dateFrom: '', dateTo: '', season: '', nudge: false },
    duration: { value: 10, flex: true },
    budget: { value: 250000, flex: false },
    restTypes: ['culture', 'food'],
    pace: { id: 'balanced', flex: true },
    comfort: { hotel: '4', flight: 'economy', flex: true },
    transfers: { id: 'one', flex: false },
    visa: { id: 'evisa' },
    climate: { id: 'mild' },
    interests: ['food', 'history'],
    constraints: { items: ['none'], dream: '' },
  };
  return { ...base, ...overrides };
}

/* --- Целостность данных --- */

check(T.destinations.length >= 12, `слишком мало направлений: ${T.destinations.length}`);
check(Object.keys(T.itineraries).length === T.destinations.length,
  `маршрутов ${Object.keys(T.itineraries).length}, направлений ${T.destinations.length}`);

const destinationIds = new Set(T.destinations.map((destination) => destination.id));
for (const id of Object.keys(T.itineraries)) {
  check(destinationIds.has(id), `маршрут ${id}: нет направления в каталоге`);
}

const expectedParts = ['flights', 'stay', 'food', 'transport', 'activities', 'buffer'];

for (const destination of T.destinations) {
  const itinerary = T.itineraries[destination.id];
  check(Boolean(itinerary), `${destination.id}: нет маршрута`);
  if (!itinerary) continue;

  check(Array.isArray(itinerary.days) && itinerary.days.length >= 3, `${destination.id}: мало дней в маршруте`);
  for (const day of itinerary.days) {
    check(day.title && day.place && Array.isArray(day.items) && day.items.length > 0,
      `${destination.id}: неполный день маршрута`);
  }
  check(itinerary.stay.length >= 1, `${destination.id}: нет вариантов жилья`);
  check(itinerary.booking.length >= 3, `${destination.id}: короткий чек-лист`);
  check(itinerary.packing.length >= 2, `${destination.id}: короткий список вещей`);
  check(itinerary.risks.length >= 1, `${destination.id}: нет рисков`);

  for (const key of expectedParts) {
    check(Array.isArray(destination.budgetParts[key]), `${destination.id}: нет бюджета ${key}`);
  }

  const totals = T.Matcher.budgetTotals(destination);
  check(totals.min > 0 && totals.max >= totals.min, `${destination.id}: некорректный бюджет`);

  check(destination.months.every((month) => month >= 1 && month <= 12), `${destination.id}: месяц вне диапазона`);
  check(fs.existsSync(path.join(ROOT, destination.image)), `${destination.id}: нет файла ${destination.image}`);
}

/* --- Подбор на разных профилях --- */

const profiles = [
  {
    name: 'пара · культура и еда',
    answers: makeAnswers({
      dates: { mode: 'exact', dateFrom: '2027-05-10', dateTo: '2027-05-18', season: '', nudge: true },
      duration: { value: 8, flex: false },
      budget: { value: 260000, flex: true },
      transfers: { id: 'one', flex: true },
      visa: { id: 'ready' },
      interests: ['food', 'history', 'photo'],
    }),
  },
  {
    name: 'семья · пляж, август',
    answers: makeAnswers({
      party: { id: 'family' },
      dates: { mode: 'season', dateFrom: '', dateTo: '', season: 'summer', nudge: false },
      duration: { value: 10, flex: true },
      budget: { value: 400000, flex: false },
      restTypes: ['beach', 'relax'],
      pace: { id: 'relaxed', flex: false },
      comfort: { hotel: '4', flight: 'economy', flex: true },
      transfers: { id: 'direct', flex: false },
      visa: { id: 'none' },
      climate: { id: 'warm' },
      interests: ['wildlife', 'local'],
      constraints: { items: ['mobility'], dream: 'Море и минимум переездов' },
    }),
  },
  {
    name: 'соло · без визы, жёсткий бюджет',
    answers: makeAnswers({
      party: { id: 'alone' },
      duration: { value: 7, flex: false },
      budget: { value: 150000, flex: false },
      restTypes: ['nature', 'adventure'],
      pace: { id: 'active', flex: false },
      comfort: { hotel: '3', flight: 'economy', flex: false },
      transfers: { id: 'direct', flex: false },
      visa: { id: 'none' },
      climate: { id: 'cool' },
      interests: ['photo', 'silence'],
    }),
  },
  {
    name: 'друзья · жёсткие условия',
    answers: makeAnswers({
      party: { id: 'friends' },
      dates: { mode: 'exact', dateFrom: '2027-01-10', dateTo: '2027-01-14', season: '', nudge: false },
      duration: { value: 4, flex: false },
      budget: { value: 60000, flex: false },
      restTypes: ['nightlife', 'city'],
      pace: { id: 'extreme', flex: false },
      transfers: { id: 'direct', flex: false },
      visa: { id: 'none' },
      climate: { id: 'warm' },
      interests: ['nightlife', 'food'],
    }),
  },
  {
    name: 'премиум · города и культура',
    answers: makeAnswers({
      duration: { value: 14, flex: false },
      budget: { value: 600000, flex: false },
      restTypes: ['culture', 'city'],
      comfort: { hotel: '5', flight: 'business', flex: false },
      transfers: { id: 'one', flex: false },
      visa: { id: 'ready' },
      climate: { id: 'mild' },
      interests: ['history', 'food', 'photo'],
      constraints: { items: ['none'], dream: 'Годовщина' },
    }),
  },
];

for (const profile of profiles) {
  const result = T.Matcher.match(profile.answers);
  check(Array.isArray(result.items), `${profile.name}: подборка не массив`);
  check(result.items.length <= 5, `${profile.name}: больше 5 вариантов`);
  check(new Set(result.items.map((item) => item.id)).size === result.items.length,
    `${profile.name}: дубли в подборке`);

  for (const item of result.items) {
    check(Boolean(T.itineraries[item.id]), `${profile.name}: нет маршрута для ${item.id}`);
    check(item.percent >= 52 && item.percent <= 98, `${profile.name}: процент вне диапазона`);
    check(item.totals.min <= item.totals.max, `${profile.name}: бюджет min > max`);
    check(Array.isArray(item.reasons) && item.reasons.length > 0, `${profile.name}: нет причин`);
  }

  const state = {
    screen: 'results',
    qIndex: 12,
    answers: profile.answers,
    results: result,
    chosenId: result.items[0] ? result.items[0].id : null,
    checks: {},
    detailId: result.items[0] ? result.items[0].id : null,
    instant: false,
  };

  noBrokenMarkup(`${profile.name} · результаты`, T.views.results.render(state));

  if (!result.empty) {
    const detailHtml = T.views.detail.render(state);
    noBrokenMarkup(`${profile.name} · деталь`, detailHtml);
    check(detailHtml.includes('Бюджет'), `${profile.name}: деталь без блока бюджета`);
  }

  noBrokenMarkup(`${profile.name} · профиль`, T.views.summary.render(state));
}

/* --- Страна и история поездок --- */

check(T.questions[0].id === 'country', 'первый вопрос должен быть про страну');

const countryAnswers = makeAnswers({ country: { mode: 'chosen', id: 'Грузия' } });
const countryResult = T.Matcher.match(countryAnswers);
check(countryResult.items.length > 0, 'страна: для Грузии не нашлось вариантов');
check(countryResult.items.every((item) => item.country === 'Грузия'),
  'страна: выдача вышла за пределы выбранной страны');
noBrokenMarkup('страна · результаты', T.views.results.render({
  screen: 'results',
  qIndex: 12,
  answers: countryAnswers,
  results: countryResult,
  chosenId: null,
  checks: {},
  detailId: null,
  instant: false,
}));

const visitedCountry = T.Matcher.match(makeAnswers({
  visited: [{ id: 'v1', place: 'Грузия', route: 'Тбилиси — Кахетия' }],
}));
check(visitedCountry.items.every((item) => item.id !== 'georgia'),
  'история: Грузия не исключена при наличии свежих альтернатив');
check(visitedCountry.items.every((item) => !item.visited),
  'история: посещённые направления попали в подборку без необходимости');

const visitedCustom = T.Matcher.match(makeAnswers({
  visited: [{ id: 'v2', place: 'Камчатка', route: 'Петропавловск — Авачинский' }],
}));
check(visitedCustom.items.every((item) => item.id !== 'kamchatka'),
  'история: Kamchatka не исключена по пользовательскому месту');

/* --- Деталь для каждого направления без предварительного подбора --- */

for (const destination of T.destinations) {
  const state = {
    screen: 'detail',
    qIndex: 12,
    answers: makeAnswers({}),
    results: null,
    chosenId: null,
    checks: {},
    detailId: destination.id,
    instant: false,
  };
  let html = '';
  try {
    html = T.views.detail.render(state);
  } catch (error) {
    check(false, `деталь ${destination.id}: исключение ${error.message}`);
    continue;
  }
  noBrokenMarkup(`деталь ${destination.id}`, html);
  check(html.includes(ui.money(T.Matcher.budgetTotals(destination).min)),
    `деталь ${destination.id}: нет суммы бюджета`);
}

/* --- Опросник: все 13 экранов --- */

for (let index = 0; index < T.questions.length; index += 1) {
  const state = {
    screen: 'quiz',
    qIndex: index,
    answers: makeAnswers({}),
    results: null,
    chosenId: null,
    checks: {},
    detailId: null,
    instant: false,
  };
  const html = T.views.questionnaire.render(state);
  noBrokenMarkup(`вопрос ${index + 1}`, html);
  check(html.includes(T.questions[index].title), `вопрос ${index + 1}: нет заголовка`);
}

/* --- Утилиты --- */

check(ui.optionLabel('party', 'couple') === 'Вдвоём', 'optionLabel: неверная подпись');
check(ui.monthRange([1, 2, 3, 5]) === 'январь — март, май', `monthRange: ${ui.monthRange([1, 2, 3, 5])}`);

console.log(`\nПроверок: ${checks}, ошибок: ${failures}`);
process.exit(failures ? 1 : 0);

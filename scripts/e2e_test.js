/**
 * Сквозной тест в headless Chrome через DevTools Protocol:
 * опросник → профиль → подборка → детальный маршрут → чек-лист.
 * Запуск: node scripts/e2e_test.js
 */
const { spawn } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

const PORT = 9333;
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'file:///C:/Users/vikak/AI/travel%20agent/index.html';
const USER_DIR = path.join(os.tmpdir(), `meridian-e2e-${process.pid}`);
const SHOTS = process.env.SCREENSHOTS === '1' ? path.join(os.tmpdir(), 'meridian-shots') : null;
const [VIEWPORT_WIDTH, VIEWPORT_HEIGHT] = (process.env.VIEWPORT || '1440x1000')
  .split('x')
  .map(Number);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForTarget(deadline) {
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const targets = await response.json();
      const page = targets.find((target) => target.type === 'page');
      if (page && page.webSocketDebuggerUrl) return page;
    } catch (error) {
      /* браузер ещё стартует */
    }
    await sleep(250);
  }
  throw new Error('Chrome DevTools не ответил');
}

class Client {
  constructor(ws) {
    this.ws = ws;
    this.counter = 0;
    this.pending = new Map();
    this.exceptions = [];
    this.consoleErrors = [];
    ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
        return;
      }
      if (message.method === 'Runtime.exceptionThrown') {
        this.exceptions.push(message.params.exceptionDetails.text);
      }
      if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
        this.consoleErrors.push(message.params.entry.text);
      }
    });
  }

  send(method, params) {
    this.counter += 1;
    const id = this.counter;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    }
    return result.result.value;
  }
}

async function click(client, selector) {
  const clicked = await client.evaluate(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) return false;
    element.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`Не найден элемент: ${selector}`);
  await sleep(30);
}

async function clickNext(client) {
  await click(client, '[data-action="next"]');
}

async function run() {
  fs.mkdirSync(USER_DIR, { recursive: true });

  const chrome = spawn(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--no-first-run',
    '--disable-extensions',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${USER_DIR}`,
    URL,
  ], { stdio: 'ignore' });

  let failures = 0;
  const check = (condition, message) => {
    if (!condition) {
      failures += 1;
      console.log(`FAIL: ${message}`);
    }
  };

  try {
    const target = await waitForTarget(Date.now() + 15000);
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', reject, { once: true });
    });

    const client = new Client(ws);
    await client.send('Runtime.enable');
    await client.send('Log.enable');
    await client.send('Page.enable');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: VIEWPORT_WIDTH,
      height: VIEWPORT_HEIGHT,
      deviceScaleFactor: 1,
      mobile: VIEWPORT_WIDTH < 600,
    });

    async function screenshot(name) {
      if (!SHOTS) return;
      await sleep(900);
      fs.mkdirSync(SHOTS, { recursive: true });
      const { data } = await client.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(SHOTS, `${name}.png`), Buffer.from(data, 'base64'));
    }

    await sleep(400);
    await screenshot('01-intro');
    check(await client.evaluate(`Boolean(document.querySelector('[data-action="start"]'))`),
      'главный экран не отрисован');

    await click(client, '[data-action="start"]');
    check(await client.evaluate(`Boolean(document.querySelector('.screen--quiz'))`), 'опросник не открылся');
    await screenshot('00-quiz');

    /* 1. Страна: проверяем выбор конкретной страны и возврат к свободному подбору */
    check(await client.evaluate(`Boolean(document.querySelector('[data-action="country-mode"]'))`),
      'первый вопрос не про страну');
    await click(client, '[data-action="country-mode"][data-value="chosen"]');
    check(await client.evaluate(`Boolean(document.querySelector('.country-grid'))`),
      'сетка стран не появилась');
    await click(client, '[data-action="country"][data-value="Россия"]');
    check(await client.evaluate(`document.querySelector('[data-action="country"][data-value="Россия"]').getAttribute('aria-pressed') === 'true'`),
      'страна не выбралась');
    await click(client, '[data-action="country-mode"][data-value="open"]');
    check(await client.evaluate(`!document.querySelector('.country-grid')`),
      'сетка стран не скрылась при свободном подборе');
    await clickNext(client);

    /* 2. Кто едет */
    await click(client, '[data-action="select"][data-question="party"][data-value="couple"]');
    await clickNext(client);

    /* 2. Даты: сезон */
    await click(client, '[data-action="date-mode"][data-value="season"]');
    await click(client, '[data-action="season"][data-value="summer"]');
    await clickNext(client);

    /* 3–4. Длительность и бюджет — значения по умолчанию */
    await clickNext(client);
    await clickNext(client);

    /* 5. Форматы отдыха */
    await click(client, '[data-action="multi"][data-question="restTypes"][data-value="beach"]');
    await click(client, '[data-action="multi"][data-question="restTypes"][data-value="relax"]');
    await clickNext(client);

    /* 6. Темп */
    await click(client, '[data-action="select"][data-question="pace"][data-value="relaxed"]');
    await clickNext(client);

    /* 7. Комфорт — по умолчанию */
    await clickNext(client);

    /* 8. Перелёты */
    await click(client, '[data-action="select"][data-question="transfers"][data-value="direct"]');
    await clickNext(client);

    /* 9. Виза */
    await click(client, '[data-action="select"][data-question="visa"][data-value="none"]');
    await clickNext(client);

    /* 10. Климат */
    await click(client, '[data-action="select"][data-question="climate"][data-value="warm"]');
    await clickNext(client);

    /* 11. Акценты */
    await click(client, '[data-action="multi"][data-question="interests"][data-value="wildlife"]');
    await click(client, '[data-action="multi"][data-question="interests"][data-value="local"]');
    await clickNext(client);

    /* 12. Ограничения → профиль */
    await clickNext(client);
    check(await client.evaluate(`Boolean(document.querySelector('.summary'))`), 'профиль не открылся');
    const profileText = await client.evaluate(`document.querySelector('.summary').innerText`);
    check(!profileText.includes('[object Object]'), 'профиль содержит [object Object]');
    check(profileText.includes('Пляж и море'), 'профиль не содержит выбранный формат');
    check(profileText.includes('Страна: предложите варианты'), 'профиль не показывает свободный подбор страны');
    await screenshot('01b-summary');

    /* История поездок: добавление */
    await client.evaluate(`(() => {
      document.querySelector('[data-field="visitedPlace"]').value = 'Грузия';
      document.querySelector('[data-field="visitedRoute"]').value = 'Тбилиси — Кахетия';
    })()`);
    await click(client, '[data-action="add-visited"]');
    check(await client.evaluate(`document.querySelectorAll('.visited-item').length === 1`),
      'поездка не добавилась в историю');
    const historyText = await client.evaluate(`document.querySelector('.visited-profile').innerText`);
    check(historyText.includes('Грузия') && historyText.includes('Тбилиси — Кахетия'),
      'история не содержит место и маршрут');
    await client.evaluate(`document.querySelector('.visited-profile').scrollIntoView({ block: 'center' })`);
    await screenshot('01c-history');

    await click(client, '[data-action="finish"]');
    const cardCount = await client.evaluate(`document.querySelectorAll('.trip-card').length`);
    check(cardCount >= 3 && cardCount <= 5, `ожидалось 3–5 карточек, найдено ${cardCount}`);
    check(await client.evaluate(`Boolean(document.querySelector('.results__head'))`), 'подборка не открылась');
    await screenshot('02-results');

    const resultsText = await client.evaluate(`document.querySelector('.results').innerText`);
    check(!resultsText.includes('[object Object]'), 'подборка содержит [object Object]');
    check(!resultsText.includes('undefined'), 'подборка содержит undefined');
    check(resultsText.includes('Без повторов'), 'подборка не сообщает об исключении посещённых мест');
    check(!resultsText.includes('Грузия'), 'посещённая Грузия попала в подборку при наличии альтернатив');

    await click(client, '.trip-card [data-action="open-trip"]');
    check(await client.evaluate(`Boolean(document.querySelector('.detail'))`), 'детальный маршрут не открылся');
    await screenshot('03-detail');

    const detailText = await client.evaluate(`document.querySelector('.detail').innerText`);
    check(!detailText.includes('undefined'), 'деталь содержит undefined');
    check(!detailText.includes('NaN'), 'деталь содержит NaN');
    check(await client.evaluate(`document.querySelectorAll('.timeline__item').length > 0`), 'нет таймлайна');
    check(await client.evaluate(`document.querySelectorAll('.budget-table tbody tr').length === 6`), 'в бюджете не 6 строк');
    check(await client.evaluate(`document.querySelectorAll('.check-item').length > 0`), 'нет чек-листа');

    /* Отметка в чек-листе */
    await client.evaluate(`document.querySelector('.check-item input').click()`);
    await sleep(60);
    check(await client.evaluate(`document.querySelector('.check-item').classList.contains('is-checked')`),
      'отметка чек-листа не применилась');
    check(await client.evaluate(`document.querySelector('.checklist-head').innerText.includes('1 из')`),
      'счётчик чек-листа не обновился');

    /* Выбор путешествия */
    await click(client, '[data-action="choose-trip"]');
    check(await client.evaluate(`document.querySelector('[data-action="choose-trip"]').innerText.includes('Выбрано')`),
      'выбор путешествия не сохранился');

    /* Возврат к подборке */
    await click(client, '[data-action="back-results"]');
    check(await client.evaluate(`document.querySelectorAll('.trip-card__chosen').length === 1`),
      'метка выбранного варианта не появилась');

    /* Переход в профиль из подборки */
    await click(client, '[data-action="summary"]');
    check(await client.evaluate(`Boolean(document.querySelector('.summary'))`), 'переход в профиль не работает');

    /* История поездок: удаление */
    await click(client, '.visited-item__remove');
    check(await client.evaluate(`document.querySelectorAll('.visited-item').length === 0`),
      'поездка не удалилась из истории');

    check(client.exceptions.length === 0, `исключения: ${client.exceptions.join(' | ')}`);
    check(client.consoleErrors.length === 0, `ошибки консоли: ${client.consoleErrors.join(' | ')}`);

    ws.close();
  } finally {
    chrome.kill();
    await sleep(300);
    try {
      fs.rmSync(USER_DIR, { recursive: true, force: true });
    } catch (error) {
      /* временный профиль может остаться заблокированным */
    }
  }

  console.log(failures ? `\nОшибок: ${failures}` : '\nE2E: все проверки пройдены');
  process.exit(failures ? 1 : 0);
}

run().catch((error) => {
  console.log(`E2E упал: ${error.message}`);
  process.exit(1);
});

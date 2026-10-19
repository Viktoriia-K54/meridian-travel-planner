/**
 * Скриншоты основных экранов презентации через headless Chrome.
 * Запуск: node scripts/capture_screenshots.js
 * Результат: screenshots/*.png
 */
const { spawn } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

const PORT = 9334;
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'file:///C:/Users/vikak/AI/travel%20agent/index.html';
const OUT = path.join(__dirname, '..', 'screenshots');
const USER_DIR = path.join(os.tmpdir(), `meridian-shots-${process.pid}`);

const DESKTOP = { width: 1440, height: 1000 };
const MOBILE = { width: 390, height: 844 };

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
    ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
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

async function run() {
  fs.mkdirSync(OUT, { recursive: true });
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

  try {
    const target = await waitForTarget(Date.now() + 15000);
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', reject, { once: true });
    });

    const client = new Client(ws);
    await client.send('Runtime.enable');
    await client.send('Page.enable');

    async function viewport(size, mobile) {
      await client.send('Emulation.setDeviceMetricsOverride', {
        width: size.width,
        height: size.height,
        deviceScaleFactor: 1,
        mobile,
      });
      await sleep(350);
    }

    async function shot(name) {
      await sleep(700);
      const { data } = await client.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(data, 'base64'));
      console.log(`  ${name}.png`);
    }

    async function click(selector) {
      const clicked = await client.evaluate(`(() => {
        const element = document.querySelector(${JSON.stringify(selector)});
        if (!element) return false;
        element.click();
        return true;
      })()`);
      if (!clicked) throw new Error(`Не найден элемент: ${selector}`);
      await sleep(80);
    }

    async function scrollTo(selector) {
      const scrolled = await client.evaluate(`(() => {
        const element = document.querySelector(${JSON.stringify(selector)});
        if (!element) return false;
        element.scrollIntoView({ block: 'center' });
        return true;
      })()`);
      if (!scrolled) throw new Error(`Не найден элемент: ${selector}`);
      await sleep(350);
    }

    await viewport(DESKTOP, false);
    await sleep(500);

    console.log('Скриншоты:');
    await shot('01-intro');

    /* Опросник: страна */
    await click('[data-action="start"]');
    await shot('02-question-country');
    await click('[data-action="country-mode"][data-value="chosen"]');
    await shot('03-question-country-grid');
    await click('[data-action="country-mode"][data-value="open"]');
    await click('[data-action="next"]');

    /* Опросник: остальные ответы */
    await click('[data-action="select"][data-question="party"][data-value="couple"]');
    await click('[data-action="next"]');
    await click('[data-action="date-mode"][data-value="season"]');
    await click('[data-action="season"][data-value="summer"]');
    await click('[data-action="next"]');
    await click('[data-action="next"]');
    await click('[data-action="next"]');
    await click('[data-action="multi"][data-question="restTypes"][data-value="beach"]');
    await click('[data-action="multi"][data-question="restTypes"][data-value="relax"]');
    await shot('04-question-formats');
    await click('[data-action="next"]');
    await click('[data-action="select"][data-question="pace"][data-value="relaxed"]');
    await click('[data-action="next"]');
    await click('[data-action="next"]');
    await click('[data-action="select"][data-question="transfers"][data-value="direct"]');
    await click('[data-action="next"]');
    await click('[data-action="select"][data-question="visa"][data-value="none"]');
    await click('[data-action="next"]');
    await click('[data-action="select"][data-question="climate"][data-value="warm"]');
    await click('[data-action="next"]');
    await click('[data-action="multi"][data-question="interests"][data-value="wildlife"]');
    await click('[data-action="multi"][data-question="interests"][data-value="local"]');
    await click('[data-action="next"]');
    await click('[data-action="next"]');

    /* Профиль */
    await shot('05-profile');

    await client.evaluate(`(() => {
      document.querySelector('[data-field="visitedPlace"]').value = 'Грузия';
      document.querySelector('[data-field="visitedRoute"]').value = 'Тбилиси — Кахетия';
    })()`);
    await click('[data-action="add-visited"]');
    await sleep(400);
    await client.evaluate(`(() => {
      document.querySelector('[data-field="visitedPlace"]').value = 'Камчатка';
      document.querySelector('[data-field="visitedRoute"]').value = 'Петропавловск-Камчатский — Авачинский вулкан';
    })()`);
    await click('[data-action="add-visited"]');
    await sleep(2800);

    await scrollTo('.visited-profile');
    await shot('06-profile-history');

    /* Подборка */
    await click('[data-action="finish"]');
    await shot('07-results');
    await scrollTo('.cards .trip-card:nth-child(3)');
    await shot('08-results-cards');

    /* Детальный маршрут */
    await click('.trip-card [data-action="open-trip"]');
    await shot('09-detail');
    await scrollTo('.budget-table');
    await shot('10-detail-budget');
    await scrollTo('.checklist');
    await shot('11-detail-checklist');

    /* Мобильная версия */
    await viewport(MOBILE, true);
    await click('[data-action="back-results"]');
    await shot('12-mobile-results');
    await click('[data-action="summary"]');
    await shot('13-mobile-profile');
    await scrollTo('.visited-profile');
    await shot('14-mobile-history');

    ws.close();
    console.log(`\nГотово: ${OUT}`);
  } finally {
    chrome.kill();
    await sleep(300);
    try {
      fs.rmSync(USER_DIR, { recursive: true, force: true });
    } catch (error) {
      /* временный профиль может остаться заблокированным */
    }
  }
}

run().catch((error) => {
  console.log(`Скриншоты не сделаны: ${error.message}`);
  process.exit(1);
});

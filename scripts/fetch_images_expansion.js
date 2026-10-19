/**
 * Догружает фотографии для новых направлений (Россия и Кавказ).
 * Не перезаписывает существующие файлы и не трогает старые строки CREDITS.md.
 * Запуск: node scripts/fetch_images_expansion.js
 */
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'assets', 'img');
const CREDITS = path.join(OUT_DIR, 'CREDITS.md');
const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'TravelAtelierDemo/1.0 (personal educational project)';

const TARGETS = [
  { id: 'kamchatka', queries: ['Valley of Geysers Kamchatka', 'Klyuchevskaya Sopka Kamchatka'] },
  { id: 'sakhalin', queries: ['Cape Velikan Sakhalin', 'Aniva lighthouse Sakhalin'] },
  { id: 'murmansk', queries: ['Aurora Murmansk region', 'Teriberka Murmansk'] },
  { id: 'dagestan', queries: ['Sulak Canyon Dagestan', 'Gunib Dagestan'] },
  { id: 'solovki', queries: ['Solovetsky Monastery', 'Solovki islands White Sea'] },
  { id: 'karelia', queries: ['Ruskeala marble canyon Karelia', 'Kizhi Karelia'] },
  { id: 'baikal', queries: ['Lake Baikal Olkhon Island', 'Baikal ice'] },
  { id: 'kaliningrad', queries: ['Curonian Spit Russia', 'Kaliningrad Königsberg cathedral'] },
  { id: 'azerbaijan', queries: ['Baku Old City Icherisheher', 'Baku skyline'] },
  { id: 'sochi', queries: ['Rosa Khutor Krasnaya Polyana', 'Sochi seafront'] },
  { id: 'kavminvody', queries: ['Kislovodsk resort park', 'Pyatigorsk Mashuk'] },
  { id: 'elbrus', queries: ['Mount Elbrus Caucasus', 'Elbrus observatory'] },
  { id: 'dombay', queries: ['Dombay Caucasus mountains', 'Arkhyz mountains'] },
  { id: 'north-ossetia', queries: ['Dargavs North Ossetia', 'Fiagdon North Ossetia'] },
  { id: 'chechnya', queries: ['Akhmad Kadyrov Mosque Grozny', 'Grozny city'] },
  { id: 'ingushetia', queries: ['Erzi Ingushetia towers', 'Dzheyrakh Ingushetia'] },
  { id: 'adygea', queries: ['Lago-Naki Adygea', 'Guam gorge Adygea'] },
];

function stripHtml(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function searchImage(query) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrsearch: `${query} filetype:bitmap`,
    gsrnamespace: '6',
    gsrlimit: '16',
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: '1600',
  });

  const response = await fetch(`${API}?${params}`, {
    headers: { 'User-Agent': UA, 'Accept': 'application/json' },
  });
  if (!response.ok) throw new Error(`API ${response.status}`);

  const data = await response.json();
  const pages = Object.values(data?.query?.pages || {});

  const candidates = pages
    .map((page) => ({ page, info: page.imageinfo?.[0] }))
    .filter(({ page, info }) => {
      if (!info) return false;
      const isBitmap = /image\/(jpeg|png|webp)/.test(info.mime || '');
      const landscape = info.width / info.height >= 1.25;
      const bigEnough = info.width >= 1200;
      const titleOk = !/map|coat|flag|logo|diagram|chart|seal|locator|schema/i.test(page.title);
      return isBitmap && landscape && bigEnough && titleOk;
    });

  if (!candidates.length) return null;

  const { page, info } = candidates[0];
  const meta = info.extmetadata || {};
  return {
    url: info.thumburl || info.url,
    title: stripHtml(page.title.replace(/^File:/, '')),
    artist: stripHtml(meta.Artist?.value) || 'Wikimedia Commons contributor',
    license: stripHtml(meta.LicenseShortName?.value) || 'See source page',
    source: info.descriptionurl,
  };
}

async function download(url, dest) {
  const response = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!response.ok) throw new Error(`download ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 20000) throw new Error('file too small');
  fs.writeFileSync(dest, buffer);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function creditRows() {
  if (!fs.existsSync(CREDITS)) return new Set();
  return new Set(
    fs.readFileSync(CREDITS, 'utf8')
      .split('\n')
      .filter((line) => line.startsWith('| '))
      .map((line) => line.split('|')[1].trim())
  );
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const existingCredits = creditRows();
  const newRows = [];

  for (const target of TARGETS) {
    const dest = path.join(OUT_DIR, `${target.id}.jpg`);
    if (fs.existsSync(dest)) {
      console.log(`SKIP ${target.id}: файл уже есть`);
      continue;
    }

    let image = null;
    let lastError = null;

    for (const query of target.queries) {
      for (let attempt = 0; attempt < 2 && !image; attempt += 1) {
        try {
          image = await searchImage(query);
          if (image) {
            image.query = query;
            break;
          }
        } catch (error) {
          lastError = error;
          await sleep(3500 * (attempt + 1));
        }
      }
      if (image) break;
    }

    if (!image) {
      console.log(`FAIL ${target.id}: ${lastError ? lastError.message : 'no suitable image'}`);
      continue;
    }

    try {
      await download(image.url, dest);
      const row = `| ${target.id}.jpg | ${image.query} | ${image.artist} | ${image.license} | [Commons](${image.source}) |`;
      if (!existingCredits.has(`${target.id}.jpg`)) newRows.push(row);
      console.log(`OK   ${target.id}: ${image.title}`);
    } catch (error) {
      console.log(`FAIL ${target.id}: ${error.message}`);
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
    }

    await sleep(1600);
  }

  if (newRows.length) {
    if (!fs.existsSync(CREDITS)) {
      fs.writeFileSync(CREDITS, [
        '# Изображения',
        '',
        'Фотографии загружены с Wikimedia Commons в демонстрационных целях.',
        'Лицензии и авторы указаны ниже; перед публичным использованием проверьте условия каждой лицензии.',
        '',
        '| Файл | Направление | Автор | Лицензия | Источник |',
        '| --- | --- | --- | --- | --- |',
        ...newRows,
      ].join('\n') + '\n');
    } else {
      const current = fs.readFileSync(CREDITS, 'utf8').replace(/\s*$/, '');
      fs.writeFileSync(CREDITS, `${current}\n${newRows.join('\n')}\n`);
    }
  }

  console.log(`\nГотово. Новых строк в CREDITS.md: ${newRows.length}`);
})();

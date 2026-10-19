/**
 * Скачивает по одной фотографии для каждого направления с Wikimedia Commons.
 * Запуск: node scripts/fetch_images.js
 * Результат: assets/img/<id>.jpg + assets/img/CREDITS.md
 */
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'assets', 'img');
const API = 'https://commons.wikimedia.org/w/api.php';

const TARGETS = [
  { id: 'georgia',   query: 'Tbilisi Old Town Georgia' },
  { id: 'turkey',    query: 'Cappadocia hot air balloons' },
  { id: 'italy',     query: 'Tuscany landscape Val d Orcia' },
  { id: 'iceland',   query: 'Iceland Skogafoss waterfall' },
  { id: 'morocco',   query: 'Marrakech medina Morocco' },
  { id: 'thailand',  query: 'Krabi Railay beach Thailand' },
  { id: 'portugal',  query: 'Lisbon Alfama tram' },
  { id: 'armenia',   query: 'Tatev monastery Armenia' },
  { id: 'norway',    query: 'Geirangerfjord Norway' },
  { id: 'japan',     query: 'Kyoto Kiyomizu-dera temple' },
  { id: 'sri-lanka', query: 'Ella Sri Lanka Nine Arch Bridge' },
  { id: 'altai',     query: 'Altai Republic mountains Russia' },
];

const UA = 'TravelAtelierDemo/1.0 (personal educational project)';

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
    gsrlimit: '12',
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
      const titleOk = !/map|coat|flag|logo|diagram|chart|seal|locator/i.test(page.title);
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

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const credits = [
    '# Изображения',
    '',
    'Фотографии загружены с Wikimedia Commons в демонстрационных целях.',
    'Лицензии и авторы указаны ниже; перед публичным использованием проверьте условия каждой лицензии.',
    '',
    '| Файл | Направление | Автор | Лицензия | Источник |',
    '| --- | --- | --- | --- | --- |',
  ];

  for (const target of TARGETS) {
    const dest = path.join(OUT_DIR, `${target.id}.jpg`);
    try {
      let image = null;
      for (let attempt = 0; attempt < 3 && !image; attempt += 1) {
        try {
          image = await searchImage(target.query);
        } catch (error) {
          if (attempt === 2) throw error;
          console.log(`RETRY ${target.id}: ${error.message}`);
          await sleep(4000 * (attempt + 1));
        }
      }
      if (!image) throw new Error('no suitable image');
      await download(image.url, dest);
      await sleep(1400);
      credits.push(
        `| ${target.id}.jpg | ${target.query} | ${image.artist} | ${image.license} | [Commons](${image.source}) |`
      );
      console.log(`OK   ${target.id}: ${image.title}`);
    } catch (error) {
      console.log(`FAIL ${target.id}: ${error.message}`);
    }
  }

  fs.writeFileSync(path.join(OUT_DIR, 'CREDITS.md'), credits.join('\n') + '\n');
})();

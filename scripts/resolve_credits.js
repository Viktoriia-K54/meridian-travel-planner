/**
 * Восстанавливает строки атрибуции для уже скачанных фотографий:
 * находит на Wikimedia Commons файл, байты которого совпадают с локальным.
 * Запуск: node scripts/resolve_credits.js
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const OUT_DIR = path.join(__dirname, '..', 'assets', 'img');
const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'TravelAtelierDemo/1.0 (personal educational project)';

const TARGETS = [
  { id: 'georgia', query: 'Tbilisi Old Town Georgia' },
  { id: 'altai', query: 'Altai Republic mountains Russia' },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function sha1(buffer) {
  return crypto.createHash('sha1').update(buffer).digest('hex');
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function candidates(query) {
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
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`API ${response.status}`);
  const data = await response.json();
  const pages = Object.values(data?.query?.pages || {});

  return pages
    .map((page) => ({ page, info: page.imageinfo?.[0] }))
    .filter(({ page, info }) => {
      if (!info) return false;
      const isBitmap = /image\/(jpeg|png|webp)/.test(info.mime || '');
      const landscape = info.width / info.height >= 1.25;
      const bigEnough = info.width >= 1200;
      const titleOk = !/map|coat|flag|logo|diagram|chart|seal|locator/i.test(page.title);
      return isBitmap && landscape && bigEnough && titleOk;
    })
    .slice(0, 8);
}

async function findMatch(target) {
  const local = fs.readFileSync(path.join(OUT_DIR, `${target.id}.jpg`));
  const localHash = sha1(local);

  for (const { page, info } of await candidates(target.query)) {
    const url = info.thumburl || info.url;
    try {
      const response = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!response.ok) throw new Error(`download ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (sha1(buffer) === localHash) {
        const meta = info.extmetadata || {};
        return {
          id: target.id,
          query: target.query,
          title: stripHtml(page.title.replace(/^File:/, '')),
          artist: stripHtml(meta.Artist?.value) || 'Wikimedia Commons contributor',
          license: stripHtml(meta.LicenseShortName?.value) || 'See source page',
          source: info.descriptionurl,
        };
      }
      await sleep(1200);
    } catch (error) {
      console.log(`SKIP ${target.id}: ${error.message}`);
      await sleep(2000);
    }
  }
  return null;
}

(async () => {
  for (const target of TARGETS) {
    const match = await findMatch(target);
    if (!match) {
      console.log(`NOT FOUND ${target.id}`);
      continue;
    }
    console.log(`MATCH ${match.id}: ${match.title}`);
    console.log(
      `| ${match.id}.jpg | ${match.query} | ${match.artist} | ${match.license} | [Commons](${match.source}) |`
    );
  }
})();

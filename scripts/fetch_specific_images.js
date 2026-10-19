/**
 * Скачивает выбранные вручную фотографии с Wikimedia Commons во временные файлы .new.jpg.
 * Запуск без аргументов — только скачивание; замена и правка CREDITS.md выполняются отдельно.
 */
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'assets', 'img');
const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'TravelAtelierDemo/1.0 (personal educational project)';

const TARGETS = [
  { id: 'sochi', title: 'Mountain Olympic Village in Krasnaya Polyana.jpg' },
  { id: 'adygea', title: 'Panorama plato L-N.jpg' },
  { id: 'kavminvody', title: 'Pyatigorsk Mashuk view of the city.jpg' },
  { id: 'azerbaijan', title: 'Vista de Baku, Azerbaiyán, 2016-09-26, DD 138.jpg' },
];

function stripHtml(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function imageInfo(title) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    titles: `File:${title}`,
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: '1600',
  });

  const response = await fetch(`${API}?${params}`, {
    headers: { 'User-Agent': UA, 'Accept': 'application/json' },
  });
  if (!response.ok) throw new Error(`API ${response.status}`);

  const data = await response.json();
  const page = Object.values(data?.query?.pages || {})[0];
  const info = page?.imageinfo?.[0];
  if (!info) throw new Error('файл не найден');

  const meta = info.extmetadata || {};
  return {
    url: info.thumburl || info.url,
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

(async () => {
  for (const target of TARGETS) {
    try {
      const image = await imageInfo(target.title);
      await download(image.url, path.join(OUT_DIR, `${target.id}.new.jpg`));
      console.log(`OK   ${target.id}: ${target.title}`);
      console.log(`     ${image.artist} · ${image.license}`);
    } catch (error) {
      console.log(`FAIL ${target.id}: ${error.message}`);
    }
  }
})();

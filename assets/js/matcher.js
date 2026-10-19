/* Движок подбора: жёсткие фильтры + взвешенный скоринг. */
window.TravelApp = window.TravelApp || {};

TravelApp.Matcher = (function () {
  const M = TravelApp.meta;
  const SEASON_MONTHS = {
    spring: [3, 4, 5],
    summer: [6, 7, 8],
    autumn: [9, 10, 11],
    winter: [12, 1, 2],
  };
  const PACE_TARGET = { relaxed: 1, balanced: 2, active: 3, extreme: 4 };
  const MAX_SCORE = 155;

  function budgetTotals(destination) {
    const parts = destination.budgetParts;
    return Object.keys(parts).reduce(
      (acc, key) => ({
        min: acc.min + parts[key][0],
        max: acc.max + parts[key][1],
      }),
      { min: 0, max: 0 }
    );
  }

  function monthsFor(answers) {
    const dates = answers.dates;
    if (dates.mode === 'season' && dates.season) return SEASON_MONTHS[dates.season] || [];
    if (dates.mode === 'exact' && dates.dateFrom) {
      const start = new Date(`${dates.dateFrom}T12:00:00`);
      const end = dates.dateTo ? new Date(`${dates.dateTo}T12:00:00`) : start;
      if (Number.isNaN(start.getTime())) return [];
      const safeEnd = Number.isNaN(end.getTime()) || end < start ? start : end;
      const months = [];
      const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
      const last = new Date(safeEnd.getFullYear(), safeEnd.getMonth(), 1);
      while (cursor <= last && months.length < 6) {
        months.push(cursor.getMonth() + 1);
        cursor.setMonth(cursor.getMonth() + 1);
      }
      return months;
    }
    return [];
  }

  function uniqueReasons(list) {
    const seen = new Set();
    return list.filter((reason) => {
      if (seen.has(reason)) return false;
      seen.add(reason);
      return true;
    });
  }

  function normalize(value) {
    return String(value == null ? '' : value)
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[^a-zа-я0-9]+/gi, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  function matchesCountry(destination, answers) {
    const country = answers.country;
    if (!country || country.mode !== 'chosen' || !country.id) return true;
    return destination.country === country.id;
  }

  function isVisited(destination, answers) {
    const visits = answers.visited || [];
    if (!visits.length) return false;

    const country = normalize(destination.country);
    const haystack = normalize([
      destination.country,
      destination.place,
      destination.title,
      destination.tagline,
      (destination.highlights || []).join(' '),
    ].join(' '));
    const hayTokens = new Set(haystack.split(' '));

    return visits.some((entry) => {
      const place = normalize(entry.place);
      if (!place) return false;

      if (place === country || haystack.includes(place)) return true;

      const placeTokens = place.split(' ').filter((token) => token.length >= 4);
      if (placeTokens.length >= 2) {
        const hits = placeTokens.filter((token) => hayTokens.has(token));
        if (hits.length >= 2 && hits.length / placeTokens.length >= 0.6) return true;
      }

      const routeSegments = String(entry.route || '')
        .split(/[—–→,;/]|\s-\s/)
        .map(normalize)
        .filter((segment) => segment.length >= 4);
      return routeSegments.some((segment) => haystack.includes(segment));
    });
  }

  function evaluate(destination, answers, mode, visited) {
    const totals = budgetTotals(destination);
    const reasons = [];
    const notes = [];
    let score = 35;

    /* --- Жёсткие фильтры --- */
    if (answers.visa.id === 'none' && destination.visa !== 'none') return null;
    if (answers.visa.id === 'evisa' && destination.visa === 'required') return null;

    if (answers.party.id === 'family' && (!destination.family || destination.difficulty > 3)) {
      return null;
    }

    const budget = answers.budget.value;
    const stretch = answers.budget.flex ? 1.15 : 1;
    const ceiling = mode === 'relaxed' ? Math.max(stretch, 1.35) : stretch;
    if (totals.min > budget * ceiling) return null;

    const duration = answers.duration.value;
    const [dayMin, dayMax] = destination.days;
    if (!answers.duration.flex && (duration < dayMin || duration > dayMax) && mode !== 'relaxed') {
      return null;
    }

    if (
      answers.transfers.id === 'direct' &&
      !answers.transfers.flex &&
      !destination.flight.direct &&
      mode !== 'relaxed'
    ) {
      return null;
    }

    /* --- Бюджет --- */
    if (budget >= totals.max) {
      score += 10;
      reasons.push(`Бюджет с запасом: ориентир ${TravelApp.ui.moneyRange([totals.min, totals.max])} на человека.`);
    } else if (budget >= totals.min) {
      score += 7;
      reasons.push(`Укладывается в бюджет: ${TravelApp.ui.moneyRange([totals.min, totals.max])} на человека.`);
    } else {
      score += 2;
      notes.push('Нижняя оценка выше вашего ориентира — потребуется гибкость по жилью или сезону.');
    }

    /* --- Виза --- */
    if (destination.visa === 'none') {
      score += 3;
      reasons.push('Без визы — меньше подготовки и рисков.');
    } else if (destination.visa === 'evisa' && answers.visa.id !== 'have') {
      score += 1;
    }

    /* --- Компания --- */
    if (destination.party.includes(answers.party.id)) score += 5;

    /* --- Длительность --- */
    if (answers.duration.flex) {
      const distance = duration < dayMin ? dayMin - duration : duration > dayMax ? duration - dayMax : 0;
      score += distance === 0 ? 6 : Math.max(-6, 3 - distance * 2);
      if (distance > 0) {
        notes.push(
          `Маршрут рассчитан на ${dayMin}–${dayMax} дней — под ваш срок его нужно ${duration < dayMin ? 'сократить' : 'расширить'}.`
        );
      }
    } else {
      score += 8;
    }

    /* --- Даты и сезон --- */
    const months = monthsFor(answers);
    if (months.length) {
      const overlap = months.filter((month) => destination.months.includes(month)).length;
      if (overlap > 0) {
        score += 8;
        reasons.push(`Хороший сезон: ${TravelApp.ui.monthRange(destination.months)}.`);
      } else {
        score -= answers.dates.mode === 'exact' && !answers.dates.nudge ? 18 : 8;
        notes.push('Выбранные даты — не лучший сезон для этого направления.');
      }
    }
    if (answers.dates.mode === 'flex') {
      score += 4;
      reasons.push('Даты гибкие — можно выбрать лучшее окно по цене и погоде.');
    }

    /* --- Формат отдыха --- */
    const typeMatches = answers.restTypes.filter((type) => destination.types.includes(type));
    if (typeMatches.length) {
      score += Math.min(42, typeMatches.length * 14);
      reasons.push(`Совпадает по формату: ${TravelApp.ui.typeLabels(typeMatches).join(', ').toLowerCase()}.`);
    } else {
      score -= 14;
      notes.push('Формат отдыха совпадает лишь частично — это вариант «расширить горизонт».');
    }

    /* --- Темп --- */
    const target = PACE_TARGET[answers.pace.id] || 2;
    const paceDistance = Math.abs(destination.difficulty - target);
    score += Math.max(0, 12 - paceDistance * 6);
    if (answers.pace.flex) score += 2;
    if (paceDistance === 0) reasons.push('Темп совпадает с вашим запросом.');

    /* --- Климат --- */
    if (answers.climate.id === 'any') {
      score += 4;
    } else if (destination.climate === answers.climate.id) {
      score += 8;
      reasons.push(`Климат: ${M.climateLabels[destination.climate].toLowerCase()}.`);
    } else {
      score -= 4;
    }

    /* --- Акценты --- */
    const interestMatches = answers.interests.filter((interest) => destination.interests.includes(interest));
    if (interestMatches.length) {
      score += Math.min(12, interestMatches.length * 4);
      reasons.push(`Ваши акценты: ${interestMatches.map((id) => M.interestLabels[id].toLowerCase()).join(', ')}.`);
    }

    /* --- Перелёт --- */
    if (answers.transfers.id === 'direct') {
      if (destination.flight.direct) {
        score += 8;
        reasons.push(`Прямой перелёт — около ${destination.flight.hours} ч.`);
      } else {
        score -= 8;
      }
    } else if (answers.transfers.id === 'one') {
      score += destination.flight.direct ? 6 : 3;
      if (destination.flight.direct) reasons.push(`Прямой перелёт — около ${destination.flight.hours} ч.`);
    } else {
      score += 3;
    }

    /* --- Комфорт --- */
    const hotelLevel = answers.comfort.hotel === 'boutique' ? 4 : Number(answers.comfort.hotel);
    if (destination.comfort.includes(hotelLevel)) {
      score += 6;
    } else {
      score -= 6;
      notes.push(`Комфорт уровня «${M.hotelLabels[answers.comfort.hotel]}» здесь встречается редко.`);
    }

    /* --- Ограничения --- */
    const constraints = answers.constraints.items || [];
    if (constraints.includes('mobility') && destination.difficulty >= 3) {
      score -= 8;
      notes.push('Из-за ограничений по мобильности маршрут потребует более спокойной версии.');
    }
    if (constraints.includes('heights') && destination.types.includes('adventure')) {
      score -= 4;
      notes.push('Есть участки, которые стоит заменить при страхе высоты.');
    }
    if (constraints.includes('water') && destination.types.includes('beach')) {
      score -= 4;
      notes.push('Пляжная часть может быть некомфортна — предложим альтернативы.');
    }
    if (constraints.includes('pet') && destination.flight.hours > 6) {
      score -= 6;
      notes.push('Перелёт с питомцем долгий — нужны отдельные правила перевозки.');
    }
    if (constraints.includes('food')) {
      notes.push('Учтём аллергии и dietary-ограничения в рекомендациях по питанию.');
    }

    /* --- История поездок --- */
    if (visited) {
      score -= 20;
      notes.push('Вы уже были в этом месте — показываем как повтор, если свежих альтернатив мало.');
    }

    const percent = Math.max(52, Math.min(98, Math.round((score / MAX_SCORE) * 100)));

    return {
      ...destination,
      totals,
      score,
      percent,
      reasons: uniqueReasons(reasons).slice(0, 5),
      notes: uniqueReasons(notes).slice(0, 4),
      compromise: false,
      wildcard: false,
      visited,
    };
  }

  function run(answers, mode) {
    return TravelApp.destinations
      .filter((destination) => matchesCountry(destination, answers))
      .map((destination) => evaluate(destination, answers, mode, isVisited(destination, answers)))
      .filter(Boolean)
      .sort((a, b) => b.score - a.score || a.totals.min - b.totals.min);
  }

  function selectVariants(strictList, relaxedList) {
    const top = strictList.slice(0, 4);
    const pool = [...strictList.slice(4), ...relaxedList];
    const usedPrimaryTypes = new Set(top.map((item) => item.types[0]));

    const wildcardCandidate = pool.find((item) => !usedPrimaryTypes.has(item.types[0])) || pool[0];
    if (!wildcardCandidate) return top;

    return [
      ...top,
      {
        ...wildcardCandidate,
        wildcard: !usedPrimaryTypes.has(wildcardCandidate.types[0]),
      },
    ];
  }

  function match(answers) {
    const strictList = run(answers, 'strict');
    let relaxed = false;
    let list = strictList;
    let compromiseIds = new Set();

    if (strictList.length < 3) {
      relaxed = true;
      const strictIds = new Set(strictList.map((item) => item.id));
      const all = run(answers, 'relaxed');
      list = all.map((item) => ({ ...item, compromise: !strictIds.has(item.id) }));
      compromiseIds = new Set(list.filter((item) => item.compromise).map((item) => item.id));
    }

    const fresh = list.filter((item) => !item.visited);
    const source = fresh.length >= 3 ? fresh : list;
    const selected = selectVariants(source, []).map((item) => ({
      ...item,
      compromise: compromiseIds.has(item.id) || item.compromise,
    }));

    return {
      items: selected,
      total: list.length,
      strictCount: strictList.length,
      relaxed,
      empty: selected.length === 0,
      visitedAvoided: Math.max(0, list.filter((item) => item.visited).length - selected.filter((item) => item.visited).length),
    };
  }

  return {
    match,
    budgetTotals,
    monthsFor,
  };
})();

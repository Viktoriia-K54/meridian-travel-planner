/* Сохранение состояния. Работает и там, где localStorage недоступен. */
window.TravelApp = window.TravelApp || {};

TravelApp.Storage = (function () {
  const KEY = 'meridian.travel.v1';
  let memory = null;
  let storageWorks = null;

  function canUseStorage() {
    if (storageWorks !== null) return storageWorks;
    try {
      const probe = '__meridian_probe__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      storageWorks = true;
    } catch (error) {
      storageWorks = false;
    }
    return storageWorks;
  }

  function load() {
    if (!canUseStorage()) return memory;
    try {
      const raw = window.localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return memory;
    }
  }

  function save(state) {
    const payload = {
      answers: state.answers,
      qIndex: state.qIndex,
      chosenId: state.chosenId,
      checks: state.checks,
      screen: state.screen,
      detailId: state.detailId,
      updatedAt: new Date().toISOString(),
    };
    memory = payload;
    if (!canUseStorage()) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(payload));
    } catch (error) {
      /* тихо остаёмся в памяти */
    }
  }

  function clear() {
    memory = null;
    if (!canUseStorage()) return;
    try {
      window.localStorage.removeItem(KEY);
    } catch (error) {
      /* ignore */
    }
  }

  return { load, save, clear };
})();

/* Стартовый экран. */
window.TravelApp = window.TravelApp || {};
TravelApp.views = TravelApp.views || {};

TravelApp.views.intro = function intro(state) {
  const hasProgress = Boolean(state.hasProgress);

  return `
    <section class="screen screen--intro">
      <div class="hero">
        <div class="hero__media" aria-hidden="true">
          <img src="assets/img/turkey.jpg" alt="" decoding="async"
            onerror="this.classList.add('is-missing'); this.removeAttribute('src');">
        </div>
        <div class="hero__shade" aria-hidden="true"></div>
        ${TravelApp.views.topbar({
          dark: true,
          meta: '<span class="topbar__note">Планировщик путешествий</span>',
        })}

        <div class="hero__content">
          <p class="eyebrow eyebrow--light">13 вопросов · 3–5 направлений · 1 маршрут</p>
          <h1>Путешествие,<br><em>собранное под вас</em></h1>
          <p class="hero__lead">
            Ответьте на двенадцать вопросов о ритме, бюджете и желаниях.
            Мы покажем направления, которые действительно подходят, — и разберём выбранное по дням.
          </p>
          <div class="hero__actions">
            ${hasProgress
              ? `<button class="btn btn--primary btn--large" data-action="resume">Продолжить подбор</button>
                 <button class="btn btn--outline-light" data-action="restart">Начать заново</button>`
              : `<button class="btn btn--primary btn--large" data-action="start">Начать подбор</button>
                 <button class="btn btn--outline-light" data-action="scroll-steps">Как это работает</button>`}
          </div>
          <p class="hero__note">
            <span class="hero__note-key">Жёстко</span> — обязательное условие.
            <span class="hero__note-key">Гибко</span> — можно варьировать.
          </p>
        </div>

        <div class="hero__steps" id="steps">
          <article class="hero-step">
            <span class="hero-step__num">01</span>
            <h2>Расскажите о себе</h2>
            <p>Даты, бюджет, темп, виза и три главных желания. Без длинных анкет.</p>
          </article>
          <article class="hero-step">
            <span class="hero-step__num">02</span>
            <h2>Получите подборку</h2>
            <p>От трёх до пяти направлений с процентом совпадения и честными оговорками.</p>
          </article>
          <article class="hero-step">
            <span class="hero-step__num">03</span>
            <h2>Разберите маршрут</h2>
            <p>Дни, бюджет, логистика, чек-лист бронирований и список вещей.</p>
          </article>
        </div>
      </div>
    </section>`;
};

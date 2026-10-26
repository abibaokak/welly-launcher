/* Welly Launcher — landing page behaviour */
(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  /* ---------- Toast ---------- */

  const toast = $('#toast');
  let toastTimer = 0;

  function showToast(message, isError = false) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.toggle('is-error', isError);
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2800);
  }

  /* ---------- Downloads & GitHub links ---------- */

  // На своём домене (wellylauncher.ru) имя репозитория из адреса не вычислить,
  // поэтому используем явный запасной вариант.
  const FALLBACK_REPO = { owner: 'abibaokak', repo: 'welly-launcher' };

  function resolveRepo() {
    const match = location.hostname.match(/^([a-z0-9-]+)\.github\.io$/i);
    if (!match) return FALLBACK_REPO;
    const owner = match[1];
    const firstSegment = location.pathname.split('/').filter(Boolean)[0];
    const repo = firstSegment || `${owner}.github.io`;
    return { owner, repo };
  }

  const repo = resolveRepo();
  const releaseUrl = `https://github.com/${repo.owner}/${repo.repo}/releases/latest/download/WellyLauncher.exe`;

  $$('[data-download]').forEach((link) => {
    link.href = releaseUrl;
    link.setAttribute('download', '');
    link.addEventListener('click', () => {
      showToast('Скачивание началось — проверь папку «Загрузки».');
    });
  });

  $$('[data-github]').forEach((link) => {
    link.href = `https://github.com/${repo.owner}/${repo.repo}`;
  });

  $$('[data-version]').forEach((chip) => {
    chip.addEventListener('click', () => {
      showToast(`Версия ${chip.dataset.version} — выбери её в лаунчере.`);
    });
  });

  /* ---------- Copy server IP ---------- */

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      let copied = false;
      try {
        copied = document.execCommand('copy');
      } catch {
        copied = false;
      }
      area.remove();
      return copied;
    }
  }

  $$('.copy-ip').forEach((button) => {
    button.addEventListener('click', async () => {
      const ip = button.dataset.ip || 'wellyfun.x2mc.ru';
      const ok = await copyText(ip);
      showToast(ok ? `IP ${ip} скопирован` : `IP сервера: ${ip}`, !ok);
    });
  });

  /* ---------- Live server status ---------- */

  const statusPill = $('[data-status-pill]');
  const statusText = $('[data-status-text]');
  const statusBadge = $('[data-status-badge]');
  const statusMotd = $('[data-status-motd]');
  const statusUpdated = $('[data-status-updated]');
  const serverCard = $('[data-server-card]');
  const refreshButton = $('#status-refresh');
  const playersNodes = $$('[data-status-players]');
  const versionNodes = $$('[data-status-version]');
  const stateNodes = $$('[data-status-state]');
  const dots = $$('[data-status-dot]');

  // Два независимых API: если первый не ответил, пробуем второй.
  // «Оффлайн» засчитываем только от основного API: резервный умеет отдавать
  // online:false из кеша неудачной проверки, и это не значит, что сервер лежит.
  const PROVIDERS = [
    {
      name: 'api.mcstatus.io',
      url: 'https://api.mcstatus.io/v2/status/java/wellyfun.x2mc.ru',
      reliableOffline: true,
      parse(data) {
        return {
          online: Boolean(data.online),
          onlinePlayers: Number(data.players?.online),
          maxPlayers: Number(data.players?.max),
          version: data.version?.name_clean || data.version?.name || '',
          motd: cleanMessage(data.motd?.clean || data.motd?.raw)
        };
      }
    },
    {
      name: 'api.mcsrvstat.us',
      url: 'https://api.mcsrvstat.us/3/wellyfun.x2mc.ru',
      parse(data) {
        const clean = data.motd?.clean;
        return {
          online: Boolean(data.online),
          onlinePlayers: Number(data.players?.online),
          maxPlayers: Number(data.players?.max),
          version: data.version || '',
          motd: cleanMessage(Array.isArray(clean) ? clean.join(' ') : clean)
        };
      }
    }
  ];

  const REQUEST_TIMEOUT = 6000;
  let statusSeq = 0;
  let retryTimer = 0;
  let retryAttempts = 0;

  function setPill(state, text) {
    if (!statusPill) return;
    statusPill.classList.toggle('is-online', state === 'online');
    statusPill.classList.toggle('is-offline', state === 'offline');
    dots.forEach((dot) => dot.classList.toggle('is-online', state === 'online'));
    if (statusText && text) statusText.textContent = text;
  }

  function setPlayers(online, max) {
    const count = Number.isFinite(online) ? formatNumber(online) : '0';
    const cap = Number.isFinite(max) ? formatNumber(max) : '—';
    const text = `${count} / ${cap}`;
    playersNodes.forEach((node) => {
      node.textContent = text;
    });
  }

  function cleanMessage(raw) {
    if (!raw) return '';
    return String(raw)
      .split(/\n/)
      .map((line) => line.replace(/§[0-9a-fk-or]/gi, '').trim())
      .filter(Boolean)
      .join(' ');
  }

  function formatTime(date) {
    try {
      return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  function pluralPlayers(count) {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return 'игрок';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'игрока';
    return 'игроков';
  }

  function formatNumber(value) {
    try {
      return value.toLocaleString('ru-RU');
    } catch {
      return String(value);
    }
  }

  function setLoading(loading) {
    if (serverCard) serverCard.classList.toggle('is-loading', loading);
    if (refreshButton) {
      refreshButton.disabled = loading;
      refreshButton.innerHTML = loading
        ? '<span aria-hidden="true">↻</span> Обновляем…'
        : '<span aria-hidden="true">↻</span> Обновить';
    }
    if (loading && statusUpdated) statusUpdated.textContent = 'Обновляем статус…';
  }

  function renderStatus(result) {
    const online = result.onlinePlayers;
    const max = result.maxPlayers;

    if (result.online) {
      const count = Number.isFinite(online) ? online : 0;
      setPill('online', `Сервер онлайн · ${count} ${pluralPlayers(count)}`);
      setPlayers(online, max);
      stateNodes.forEach((node) => (node.textContent = 'онлайн'));

      if (result.version) versionNodes.forEach((node) => (node.textContent = result.version));

      if (statusBadge) {
        statusBadge.textContent = 'Онлайн';
        statusBadge.classList.add('is-online');
        statusBadge.classList.remove('is-offline');
      }

      if (statusMotd) {
        statusMotd.textContent = result.motd || 'Выживание, матчмейкинг и хаб ждут тебя!';
      }
    } else {
      setPill('offline', 'Сервер сейчас оффлайн');
      setPlayers(0, '—');
      stateNodes.forEach((node) => (node.textContent = 'оффлайн'));

      if (statusBadge) {
        statusBadge.textContent = 'Оффлайн';
        statusBadge.classList.add('is-offline');
        statusBadge.classList.remove('is-online');
      }
      if (statusMotd) {
        statusMotd.textContent =
          'Сервер сейчас недоступен. Загляни чуть позже — обычно он быстро возвращается.';
      }
    }

    if (statusUpdated) {
      statusUpdated.textContent = `Обновлено в ${formatTime(new Date())} · ${result.provider}`;
    }
  }

  async function requestProvider(provider) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    try {
      const response = await fetch(provider.url, {
        signal: controller.signal,
        cache: 'no-store',
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return { provider: provider.name, ...provider.parse(data) };
    } finally {
      window.clearTimeout(timer);
    }
  }

  async function loadStatus(manual = false) {
    window.clearTimeout(retryTimer);
    const requestId = ++statusSeq;
    setLoading(true);

    // Опрашиваем оба API одновременно: побеждает первый ответивший «онлайн».
    // Если оба говорят «оффлайн», ждём второй ответ, чтобы не показать ложный оффлайн.
    const outcome = await new Promise((resolve) => {
      let remaining = PROVIDERS.length;
      let offlineResult = null;
      let lastError = null;

      PROVIDERS.forEach(async (provider) => {
        try {
          const result = await requestProvider(provider);
          if (result.online) {
            resolve({ result });
            return;
          }
          if (provider.reliableOffline && !offlineResult) offlineResult = result;
        } catch (error) {
          lastError = error;
        } finally {
          remaining -= 1;
          if (remaining === 0) {
            resolve(offlineResult ? { result: offlineResult } : { error: lastError });
          }
        }
      });
    });

    if (requestId !== statusSeq) return;

    if (outcome.result) {
      retryAttempts = 0;
      renderStatus(outcome.result);
      setLoading(false);
      return;
    }

    // Оба API не ответили — показываем честный статус и пробуем ещё раз.
    const failure = outcome.error;
    const isTimeout = failure?.name === 'AbortError';
    setPill('offline', isTimeout ? 'Сервер не ответил вовремя' : 'Статус сервера временно недоступен');
    stateNodes.forEach((node) => (node.textContent = 'нет данных'));

    if (statusBadge) {
      statusBadge.textContent = 'Нет данных';
      statusBadge.classList.remove('is-online');
      statusBadge.classList.add('is-offline');
    }
    if (statusMotd) {
      statusMotd.textContent =
        'Не удалось получить статус. Сервер может быть онлайн — зайди по IP или нажми «Обновить».';
    }

    const willRetry = !manual && retryAttempts < 2;
    if (willRetry) {
      retryAttempts += 1;
      retryTimer = window.setTimeout(() => loadStatus(), 4000);
    }

    if (statusUpdated) {
      statusUpdated.textContent = willRetry
        ? 'Пробуем ещё раз через пару секунд…'
        : isTimeout
          ? 'API не ответил — нажми «Обновить»'
          : 'Проверь подключение к интернету';
    }

    if (manual) showToast('Не удалось обновить статус сервера', true);
    setLoading(false);
  }

  if (refreshButton) {
    refreshButton.addEventListener('click', () => loadStatus(true));
  }

  // Статус нужен только там, где на странице есть его элементы.
  const statusEnabled = Boolean(
    statusPill || serverCard || playersNodes.length || stateNodes.length
  );

  if (statusEnabled) {
    loadStatus();
    window.setInterval(() => {
      if (!document.hidden) loadStatus();
    }, 120000);
  }

  /* ---------- Header / mobile navigation ---------- */

  const header = $('.site-header');
  const burger = $('#burger');
  const nav = $('#nav');

  const onScroll = () => {
    if (header) header.classList.toggle('is-scrolled', window.scrollY > 12);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  function closeNav() {
    if (!nav || !burger) return;
    nav.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
  }

  if (burger && nav) {
    burger.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', String(open));
    });

    $$('.nav__link', nav).forEach((link) => link.addEventListener('click', closeNav));

    document.addEventListener('click', (event) => {
      if (!nav.classList.contains('is-open')) return;
      if (!nav.contains(event.target) && !burger.contains(event.target)) closeNav();
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 940) closeNav();
    });
  }

  /* ---------- Active page in navigation ---------- */

  const currentPage = (location.pathname.split('/').pop() || 'index.html').toLowerCase();

  $$('.nav__link').forEach((link) => {
    const href = (link.getAttribute('href') || '').split('#')[0].toLowerCase();
    if (!href || /^(https?:|mailto:|tel:)/.test(href)) return;
    if (href === currentPage) {
      link.classList.add('is-active');
      link.setAttribute('aria-current', 'page');
    }
  });

  /* ---------- Reveal on scroll ---------- */

  const revealItems = $$('.reveal');

  if ('IntersectionObserver' in window && revealItems.length) {
    const revealer = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );
    revealItems.forEach((item) => revealer.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  }

  // Страховка: если браузер не прислал IntersectionObserver (или вкладка
  // открыта в фоне), показываем всё, что уже находится в первом экране.
  window.addEventListener('load', () => {
    window.setTimeout(() => {
      revealItems.forEach((item) => {
        if (item.classList.contains('is-visible')) return;
        const rect = item.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          item.classList.add('is-visible');
        }
      });
    }, 700);
  });

  /* ---------- Screenshot lightbox ---------- */

  const lightbox = $('#lightbox');
  const lightboxImg = $('.lightbox__img');
  const lightboxCaption = $('.lightbox__caption');
  const closeButton = $('.lightbox__close');
  const prevButton = $('.lightbox__nav--prev');
  const nextButton = $('.lightbox__nav--next');
  const shots = $$('.shot__btn');

  let activeShot = 0;
  let lastFocused = null;

  function renderShot(index) {
    if (!shots.length) return;
    activeShot = (index + shots.length) % shots.length;
    const button = shots[activeShot];
    const img = button.querySelector('img');
    const caption = button.dataset.caption || img?.alt || '';
    if (lightboxImg) {
      lightboxImg.src = button.dataset.full || img?.src || '';
      lightboxImg.alt = img?.alt || caption;
    }
    if (lightboxCaption) lightboxCaption.textContent = `${activeShot + 1} / ${shots.length} · ${caption}`;
  }

  function openLightbox(index) {
    if (!lightbox) return;
    lastFocused = document.activeElement;
    renderShot(index);
    lightbox.hidden = false;
    document.body.classList.add('is-locked');
    // Принудительный reflow: без него transition не сработает,
    // а requestAnimationFrame может не выполниться в фоновой вкладке.
    void lightbox.offsetWidth;
    lightbox.classList.add('is-open');
    closeButton?.focus();
  }

  function closeLightbox() {
    if (!lightbox || lightbox.hidden) return;
    lightbox.classList.remove('is-open');
    document.body.classList.remove('is-locked');
    window.setTimeout(() => {
      lightbox.hidden = true;
      if (lightboxImg) lightboxImg.src = '';
    }, 220);
    if (lastFocused instanceof HTMLElement) lastFocused.focus();
  }

  shots.forEach((button, index) => {
    button.addEventListener('click', () => openLightbox(index));
  });

  closeButton?.addEventListener('click', closeLightbox);
  prevButton?.addEventListener('click', () => renderShot(activeShot - 1));
  nextButton?.addEventListener('click', () => renderShot(activeShot + 1));

  lightbox?.addEventListener('click', (event) => {
    if (event.target === lightbox) closeLightbox();
  });

  document.addEventListener('keydown', (event) => {
    if (!lightbox || lightbox.hidden) {
      if (event.key === 'Escape') closeNav();
      return;
    }
    if (event.key === 'Escape') closeLightbox();
    if (event.key === 'ArrowLeft') renderShot(activeShot - 1);
    if (event.key === 'ArrowRight') renderShot(activeShot + 1);
  });

  /* ---------- Misc ---------- */

  const year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());
})();

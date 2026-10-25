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

  function resolveRepo() {
    const match = location.hostname.match(/^([a-z0-9-]+)\.github\.io$/i);
    if (!match) return null;
    const owner = match[1];
    const firstSegment = location.pathname.split('/').filter(Boolean)[0];
    const repo = firstSegment || `${owner}.github.io`;
    return { owner, repo };
  }

  const repo = resolveRepo();
  const releaseUrl = repo
    ? `https://github.com/${repo.owner}/${repo.repo}/releases/latest/download/WellyLauncher.exe`
    : null;

  $$('[data-download]').forEach((link) => {
    if (releaseUrl) {
      link.href = releaseUrl;
      link.setAttribute('download', '');
    }
    link.addEventListener('click', (event) => {
      if (!releaseUrl) {
        event.preventDefault();
        showToast('Ссылка появится после публикации сайта на GitHub Pages.', true);
        return;
      }
      showToast('Скачивание началось — проверь папку «Загрузки».');
    });
  });

  if (repo) {
    $$('[data-github]').forEach((link) => {
      link.href = `https://github.com/${repo.owner}/${repo.repo}`;
    });
  }

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

  const API = 'https://api.mcstatus.io/v2/status/java/wellyfun.x2mc.ru';
  let statusRequest = null;

  function setPill(state, text) {
    if (!statusPill) return;
    statusPill.classList.toggle('is-online', state === 'online');
    statusPill.classList.toggle('is-offline', state === 'offline');
    dots.forEach((dot) => dot.classList.toggle('is-online', state === 'online'));
    if (statusText && text) statusText.textContent = text;
  }

  function setPlayers(online, max) {
    const text = Number.isFinite(online) ? `${online} / ${max ?? '—'}` : '0 / —';
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

  async function loadStatus(manual = false) {
    if (statusRequest) statusRequest.abort();
    const controller = new AbortController();
    statusRequest = controller;
    const timeout = window.setTimeout(() => controller.abort(), 9000);

    if (serverCard) serverCard.classList.add('is-loading');
    if (refreshButton) {
      refreshButton.disabled = true;
      refreshButton.innerHTML = '<span aria-hidden="true">↻</span> Обновляем…';
    }
    if (statusUpdated) statusUpdated.textContent = 'Обновляем статус…';

    try {
      const response = await fetch(API, {
        signal: controller.signal,
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      if (data.online) {
        const players = data.players || {};
        const online = Number(players.online);
        const max = Number(players.max);
        const count = Number.isFinite(online) ? online : 0;

        setPill('online', `Сервер онлайн · ${count} ${count === 1 ? 'игрок' : 'игроков'}`);
        setPlayers(online, max);
        stateNodes.forEach((node) => (node.textContent = 'онлайн'));

        const versionName = data.version?.name_clean || data.version?.name;
        if (versionName) versionNodes.forEach((node) => (node.textContent = versionName));

        if (statusBadge) {
          statusBadge.textContent = 'Онлайн';
          statusBadge.classList.add('is-online');
          statusBadge.classList.remove('is-offline');
        }

        if (statusMotd) {
          const motd = cleanMessage(data.motd?.clean || data.motd?.raw);
          statusMotd.textContent = motd || 'Выживание, матчмейкинг и хаб ждут тебя!';
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
        if (statusMotd) statusMotd.textContent = 'Сервер сейчас недоступен. Загляни чуть позже — обычно он быстро возвращается.';
      }

      if (statusUpdated) {
        statusUpdated.textContent = `Обновлено в ${formatTime(new Date())} · api.mcstatus.io`;
      }
    } catch (error) {
      if (error.name === 'AbortError' && !manual) return;
      setPill('offline', 'Статус сервера временно недоступен');
      stateNodes.forEach((node) => (node.textContent = 'нет данных'));

      if (statusBadge) {
        statusBadge.textContent = 'Нет данных';
        statusBadge.classList.remove('is-online');
        statusBadge.classList.add('is-offline');
      }
      if (statusMotd) {
        statusMotd.textContent = 'Не удалось получить статус. Сервер может быть онлайн — попробуй обновить или зайди по IP.';
      }
      if (statusUpdated) statusUpdated.textContent = 'Проверь подключение к интернету';
      if (manual) showToast('Не удалось обновить статус сервера', true);
    } finally {
      window.clearTimeout(timeout);
      if (statusRequest === controller) statusRequest = null;
      if (serverCard) serverCard.classList.remove('is-loading');
      if (refreshButton) {
        refreshButton.disabled = false;
        refreshButton.innerHTML = '<span aria-hidden="true">↻</span> Обновить';
      }
    }
  }

  if (refreshButton) {
    refreshButton.addEventListener('click', () => loadStatus(true));
  }

  loadStatus();
  window.setInterval(() => {
    if (!document.hidden) loadStatus();
  }, 120000);

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

  /* ---------- Scroll spy ---------- */

  const navLinks = $$('.nav__link');
  const sections = navLinks
    .map((link) => {
      const id = link.getAttribute('href')?.slice(1);
      return id ? document.getElementById(id) : null;
    })
    .filter(Boolean);

  if ('IntersectionObserver' in window && sections.length) {
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          navLinks.forEach((link) => {
            link.classList.toggle('is-active', link.getAttribute('href') === `#${entry.target.id}`);
          });
        });
      },
      { rootMargin: '-45% 0px -50% 0px', threshold: 0 }
    );
    sections.forEach((section) => spy.observe(section));
  }

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
    requestAnimationFrame(() => lightbox.classList.add('is-open'));
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

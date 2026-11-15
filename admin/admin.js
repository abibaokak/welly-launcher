/* Welly Admin — статическая панель управления лаунчером.
 *
 * Работает целиком в браузере: читает и записывает launcher-config.json
 * в репозиторий сайта через GitHub API. Токен хранится только на устройстве
 * администратора и никогда не попадает в сам сайт.
 */
(() => {
  'use strict';

  const API = 'https://api.github.com';
  const FALLBACK_REPO = { owner: 'abibaokak', repo: 'welly-launcher' };
  const BRANCH = 'main';
  const CONFIG_PATH = 'launcher-config.json';
  const TOKEN_KEY = 'welly.admin.token';
  const REMEMBER_KEY = 'welly.admin.remember';
  const MAX_NEWS = 30;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  /* ── Конфигурация репозитория ─────────────────────────── */

  function resolveRepo() {
    const match = location.hostname.match(/^([a-z0-9-]+)\.github\.io$/i);
    if (!match) return { ...FALLBACK_REPO };
    const owner = match[1];
    const first = location.pathname.split('/').filter(Boolean)[0];
    return { owner, repo: first || `${owner}.github.io` };
  }

  const repo = resolveRepo();
  const REPO_LABEL = `${repo.owner}/${repo.repo}`;

  /* ── Состояние ────────────────────────────────────────── */

  const state = {
    token: '',
    user: '',
    config: null,
    sha: null,
    dirty: false,
    busy: false
  };

  /* ── Утилиты ──────────────────────────────────────────── */

  const toastEl = $('#toast');
  let toastTimer = 0;

  function toast(message, isError = false) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.toggle('is-error', isError);
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toastEl.classList.remove('is-visible'), 3600);
  }

  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function b64encode(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  function b64decode(text) {
    const binary = atob(String(text || '').replace(/\n/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  }

  function formatDate(value) {
    if (!value) return 'ещё не публиковалось';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function toLocalInput(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
      date.getHours()
    )}:${pad(date.getMinutes())}`;
  }

  function fromLocalInput(value) {
    if (!value) return new Date().toISOString();
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  }

  /* ── GitHub API ───────────────────────────────────────── */

  async function github(path, options = {}) {
    const headers = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {})
    };
    if (state.token) headers.Authorization = `Bearer ${state.token}`;
    const response = await fetch(`${API}${path}`, { ...options, headers });
    if (!response.ok) {
      let detail = '';
      try {
        const data = await response.json();
        detail = data && data.message ? String(data.message) : '';
      } catch {
        detail = '';
      }
      const error = new Error(detail || `GitHub API ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return response;
  }

  async function verifyToken(token) {
    state.token = token;
    const userResponse = await github('/user');
    const user = await userResponse.json();
    state.user = user.login || '';

    const repoResponse = await github(`/repos/${REPO_LABEL}`);
    const data = await repoResponse.json();
    if (data.permissions && data.permissions.push === false) {
      throw Object.assign(new Error('У токена нет права записи в этот репозиторий'), {
        status: 403
      });
    }
    return state.user;
  }

  /* ── Конфиг по умолчанию (как в панели и лаунчере) ─────── */

  function defaultConfig() {
    return {
      schema: 1,
      branding: {
        name: 'Welly Launcher',
        tagline: 'Minecraft Java Edition с Welly ID, скинами и живым сервером',
        siteUrl: 'https://abibaokak.github.io/welly-launcher',
        donateUrl: 'https://donatesmp.mydonate.io',
        discordUrl: '',
        telegramUrl: '',
        supportEmail: ''
      },
      server: {
        host: 'wellyfun.x2mc.ru',
        name: 'WellyFun',
        versionRange: '1.7.2 – 26.2',
        modes: [
          {
            id: 'wellyfun-smp',
            name: 'WellyFun SMP',
            description:
              'Классическое выживание с дружелюбным сообществом: строй базу, исследуй мир, торгуй и собирай команду.',
            emoji: '🌲',
            mode: 'SMP',
            tag: 'Выживание'
          },
          {
            id: 'wellyfun-matchmaking',
            name: 'WellyFun Matchmaking',
            description:
              'Быстрые матчи и мини-игры: заходи в хаб, выбирай режим и прыгай в бой — всё начинается за пару кликов.',
            emoji: '⚡',
            mode: 'Матчмейкинг',
            tag: 'Мини-игры'
          },
          {
            id: 'wellyfun-hub',
            name: 'WellyFun Hub',
            description:
              'Главная точка входа. Из хаба можно перейти в любой режим сервера и найти компанию для игры.',
            emoji: '🪐',
            mode: 'Хаб',
            tag: 'Все режимы'
          }
        ]
      },
      news: {
        includeExternal: true,
        includePublished: true,
        externalFeeds: [
          { url: 'https://minecraft-inside.ru/feed', name: 'Minecraft Inside' },
          { url: 'https://ru-minecraft.ru/rss.xml', name: 'Ru-Minecraft' }
        ],
        items: []
      },
      defaults: {
        language: 'ru',
        theme: 'dark',
        minMemory: 2048,
        maxMemory: 4096,
        resolutionWidth: 1280,
        resolutionHeight: 720,
        fullscreen: false,
        hideLauncherOnGame: true,
        autoConnectServer: '',
        selectedVersion: '',
        accountApiUrl: 'http://127.0.0.1:8787'
      },
      updates: {
        enabled: true,
        latestVersion: '1.0.9',
        downloadUrl: 'https://abibaokak.github.io/welly-launcher/WellyLauncher.exe',
        releaseNotesUrl: 'https://abibaokak.github.io/welly-launcher',
        sha256: '',
        mandatory: false,
        message: 'Доступна новая версия лаунчера'
      },
      maintenance: {
        enabled: false,
        message: 'Идут технические работы. Лаунчер скоро вернётся.',
        until: ''
      },
      publishedAt: null,
      generatedAt: undefined
    };
  }

  /** Аккуратно совмещает загруженный конфиг с заводской структурой. */
  function normalizeLoaded(value) {
    const base = defaultConfig();
    if (!value || typeof value !== 'object') return base;
    const result = {
      ...base,
      ...value,
      branding: { ...base.branding, ...(value.branding || {}) },
      server: { ...base.server, ...(value.server || {}) },
      news: { ...base.news, ...(value.news || {}) },
      defaults: { ...base.defaults, ...(value.defaults || {}) },
      updates: { ...base.updates, ...(value.updates || {}) },
      maintenance: { ...base.maintenance, ...(value.maintenance || {}) }
    };
    if (!Array.isArray(result.server.modes)) result.server.modes = [];
    if (!Array.isArray(result.news.externalFeeds)) result.news.externalFeeds = [];
    if (!Array.isArray(result.news.items)) result.news.items = [];
    return result;
  }

  /* ── Чтение / запись файла ────────────────────────────── */

  async function loadConfig() {
    let response;
    try {
      response = await github(
        `/repos/${REPO_LABEL}/contents/${CONFIG_PATH}?ref=${encodeURIComponent(BRANCH)}`
      );
    } catch (error) {
      if (error.status === 404) {
        state.sha = null;
        state.config = defaultConfig();
        state.dirty = false;
        render();
        return state.config;
      }
      throw error;
    }
    const data = await response.json();
    state.sha = data.sha || null;
    const text = b64decode(data.content);
    state.config = normalizeLoaded(JSON.parse(text));
    state.dirty = false;
    render();
    return state.config;
  }

  async function putConfig(config) {
    const body = {
      message: `admin: обновление настроек лаунчера (${new Date().toISOString()})`,
      content: b64encode(`${JSON.stringify(config, null, 2)}\n`),
      branch: BRANCH
    };
    if (state.sha) body.sha = state.sha;

    const response = await github(`/repos/${REPO_LABEL}/contents/${CONFIG_PATH}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    state.sha = data.content ? data.content.sha : state.sha;
    return data;
  }

  /* ── Рендер формы ─────────────────────────────────────── */

  const SCALAR_FIELDS = [
    'branding.name',
    'branding.tagline',
    'branding.siteUrl',
    'branding.donateUrl',
    'branding.discordUrl',
    'branding.telegramUrl',
    'branding.supportEmail',
    'server.host',
    'server.name',
    'server.versionRange',
    'defaults.language',
    'defaults.theme',
    'defaults.minMemory',
    'defaults.maxMemory',
    'defaults.resolutionWidth',
    'defaults.resolutionHeight',
    'defaults.autoConnectServer',
    'defaults.selectedVersion',
    'defaults.accountApiUrl',
    'updates.latestVersion',
    'updates.downloadUrl',
    'updates.releaseNotesUrl',
    'updates.sha256',
    'updates.message',
    'maintenance.message',
    'maintenance.until'
  ];

  const CHECK_FIELDS = [
    'news.includeExternal',
    'news.includePublished',
    'defaults.fullscreen',
    'defaults.hideLauncherOnGame',
    'updates.enabled',
    'updates.mandatory',
    'maintenance.enabled'
  ];

  function getByPath(object, path) {
    return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), object);
  }

  function render() {
    const config = state.config || defaultConfig();
    const form = $('#config-form');

    for (const path of [...SCALAR_FIELDS, ...CHECK_FIELDS]) {
      const input = form.querySelector(`[name="${path}"]`);
      if (!input) continue;
      const value = getByPath(config, path);
      if (input.type === 'checkbox') input.checked = Boolean(value);
      else input.value = value == null ? '' : String(value);
    }

    renderModes(config.server.modes || []);
    renderFeeds(config.news.externalFeeds || []);
    renderNews(config.news.items || []);
    renderStatus();
  }

  function renderStatus() {
    const config = state.config || {};
    const version = config.updates ? config.updates.latestVersion : '—';
    const published = config.publishedAt;
    const box = $('#intro-status');
    if (box) {
      box.innerHTML = `
        <div class="status-chip"><b>${esc(version || '—')}</b><span>версия в конфиге</span></div>
        <div class="status-chip"><b>${esc(formatDate(published))}</b><span>последняя публикация</span></div>
        <div class="status-chip"><b>${esc(REPO_LABEL)}</b><span>репозиторий · ${BRANCH}</span></div>`;
    }
    updatePublishBar();
  }

  function updatePublishBar() {
    const title = $('#publish-title');
    const detail = $('#publish-detail');
    if (!title || !detail) return;
    if (state.busy) {
      title.textContent = 'Публикую…';
      detail.textContent = 'Отправляю launcher-config.json в GitHub';
      return;
    }
    if (state.dirty) {
      title.textContent = 'Есть неопубликованные изменения';
      detail.textContent = 'Нажмите «Опубликовать на сайте», чтобы доставить их лаунчерам';
      return;
    }
    title.textContent = 'Готово к публикации';
    detail.textContent = state.config && state.config.publishedAt
      ? `Последняя публикация: ${formatDate(state.config.publishedAt)}`
      : 'Изменения ещё не отправлены на сайт';
  }

  /* ── Режимы ───────────────────────────────────────────── */

  function renderModes(modes) {
    const list = $('#modes-list');
    if (!list) return;
    if (!modes.length) {
      list.innerHTML = '<div class="empty">Пока нет ни одного режима. Добавьте первый.</div>';
      return;
    }
    list.innerHTML = modes
      .map(
        (mode, index) => `
      <div class="item" data-mode-row>
        <div class="item__head">
          <span class="item__num">${index + 1}</span>
          <button class="item__remove" type="button" data-remove="mode" title="Удалить режим">✕</button>
        </div>
        <div class="grid grid--3">
          <label class="field"><span>Название</span><input data-field="name" maxlength="64" value="${esc(mode.name)}" /></label>
          <label class="field"><span>Эмодзи</span><input data-field="emoji" maxlength="8" value="${esc(mode.emoji)}" /></label>
          <label class="field"><span>ID</span><input data-field="id" maxlength="64" value="${esc(mode.id)}" /></label>
          <label class="field"><span>Режим</span><input data-field="mode" maxlength="32" value="${esc(mode.mode)}" /></label>
          <label class="field"><span>Тег</span><input data-field="tag" maxlength="32" value="${esc(mode.tag)}" /></label>
        </div>
        <label class="field"><span>Описание</span><textarea data-field="description" rows="2" maxlength="500">${esc(mode.description)}</textarea></label>
      </div>`
      )
      .join('');
  }

  /* ── RSS ──────────────────────────────────────────────── */

  function renderFeeds(feeds) {
    const list = $('#feeds-list');
    if (!list) return;
    if (!feeds.length) {
      list.innerHTML = '<div class="empty">Внешние ленты отключены. Добавьте RSS-ссылку при необходимости.</div>';
      return;
    }
    list.innerHTML = feeds
      .map(
        (feed, index) => `
      <div class="item" data-feed-row>
        <div class="item__head">
          <span class="item__num">${index + 1}</span>
          <button class="item__remove" type="button" data-remove="feed" title="Удалить ленту">✕</button>
        </div>
        <div class="grid grid--2">
          <label class="field"><span>Название</span><input data-field="name" maxlength="64" value="${esc(feed.name)}" /></label>
          <label class="field"><span>Ссылка на RSS</span><input data-field="url" maxlength="300" value="${esc(feed.url)}" /></label>
        </div>
      </div>`
      )
      .join('');
  }

  /* ── Новости ──────────────────────────────────────────── */

  function renderNews(items) {
    const list = $('#news-list');
    if (!list) return;
    if (!items.length) {
      list.innerHTML = '<div class="empty">Новостей пока нет. Добавьте первую — она появится в лаунчере.</div>';
      return;
    }
    list.innerHTML = items
      .map(
        (item, index) => `
      <div class="item" data-news-row data-id="${esc(item.id || '')}">
        <div class="item__head">
          <span class="item__num">${index + 1}</span>
          <label class="check">
            <input type="checkbox" data-field="pinned"${item.pinned ? ' checked' : ''} />
            <span>Закрепить</span>
          </label>
          <button class="item__remove" type="button" data-remove="news" title="Удалить новость">✕</button>
        </div>
        <div class="grid grid--2">
          <label class="field"><span>Заголовок</span><input data-field="title" maxlength="200" value="${esc(item.title)}" /></label>
          <label class="field"><span>Дата</span><input type="datetime-local" data-field="date" value="${esc(toLocalInput(item.date))}" /></label>
        </div>
        <label class="field"><span>Краткий текст</span><textarea data-field="excerpt" rows="2" maxlength="500">${esc(item.excerpt)}</textarea></label>
        <div class="grid grid--2">
          <label class="field"><span>Ссылка</span><input data-field="url" maxlength="300" value="${esc(item.url)}" /></label>
          <label class="field"><span>Картинка (URL)</span><input data-field="image" maxlength="500" value="${esc(item.image || '')}" placeholder="необязательно" /></label>
        </div>
      </div>`
      )
      .join('');
  }

  /* ── Сбор данных формы ────────────────────────────────── */

  function readText(form, name) {
    const input = form.querySelector(`[name="${name}"]`);
    return String(input ? input.value : '').trim();
  }

  function readBool(form, name) {
    const input = form.querySelector(`[name="${name}"]`);
    return Boolean(input && input.checked);
  }

  function readInt(form, name, min, max, fallback) {
    const value = Number(readText(form, name));
    if (!Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, Math.round(value)));
  }

  function cleanUrl(value, fallback, { allowEmpty = false, label = 'ссылка' } = {}) {
    const raw = String(value || '').trim();
    if (!raw) {
      if (allowEmpty) return '';
      return fallback;
    }
    let url;
    try {
      url = new URL(raw);
    } catch {
      throw new Error(`Некорректная ${label}: ${raw}`);
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error(`Некорректная ${label}: ${raw}`);
    }
    if (url.username || url.password) throw new Error(`Некорректная ${label}: ${raw}`);
    return `${url.origin}${url.pathname.replace(/\/+$/, '')}${url.search}`;
  }

  function cleanText(value, max, fallback = '') {
    const text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
    if (!text) return fallback;
    if (text.length > max) throw new Error(`Слишком длинное значение (максимум ${max} символов)`);
    return text;
  }

  function cleanMultiline(value, max, fallback = '') {
    const text = String(value == null ? '' : value).replace(/\r\n/g, '\n').trim();
    if (!text) return fallback;
    if (text.length > max) throw new Error(`Слишком длинный текст (максимум ${max} символов)`);
    return text;
  }

  function collectRow(row) {
    const field = (name) => row.querySelector(`[data-field="${name}"]`);
    return {
      text: (name) => String(field(name) ? field(name).value : '').trim(),
      bool: (name) => Boolean(field(name) && field(name).checked),
      raw: (name) => String(field(name) ? field(name).value : '')
    };
  }

  function collectConfig() {
    const form = $('#config-form');
    const base = state.config || defaultConfig();

    const host = cleanText(readText(form, 'server.host'), 80, 'wellyfun.x2mc.ru');
    if (!/^[a-zA-Z0-9.-]+(:\d{1,5})?$/.test(host)) {
      throw new Error('Адрес сервера должен быть вида wellyfun.x2mc.ru или host:port');
    }

    const modes = $$('[data-mode-row]', form)
      .slice(0, 12)
      .map((row, index) => {
        const data = collectRow(row);
        return {
          id:
            cleanText(data.text('id'), 64, `mode-${index + 1}`).replace(/[^a-zA-Z0-9_-]/g, '-') ||
            `mode-${index + 1}`,
          name: cleanText(data.text('name'), 64, `Режим ${index + 1}`),
          description: cleanMultiline(data.raw('description'), 500, ''),
          emoji: cleanText(data.text('emoji'), 8, '🎮'),
          mode: cleanText(data.text('mode'), 32, ''),
          tag: cleanText(data.text('tag'), 32, '')
        };
      });

    const feeds = $$('[data-feed-row]', form)
      .slice(0, 10)
      .map((row, index) => {
        const data = collectRow(row);
        return {
          url: cleanUrl(data.text('url'), '', { allowEmpty: true, label: `RSS-ссылка №${index + 1}` }),
          name: cleanText(data.text('name'), 64, 'RSS')
        };
      })
      .filter((feed) => feed.url);

    const items = $$('[data-news-row]', form)
      .slice(0, MAX_NEWS)
      .map((row, index) => {
        const data = collectRow(row);
        const title = cleanText(data.text('title'), 200, '');
        if (!title) return null;
        const rawDate = data.raw('date');
        const date = fromLocalInput(rawDate);
        const image = data.text('image');
        if (image) cleanUrl(image, '', { allowEmpty: true, label: `картинка новости «${title}»` });
        const fallbackUrl = `${cleanUrl(readText(form, 'branding.siteUrl'), 'https://abibaokak.github.io/welly-launcher')}#/news`;
        return {
          id: row.dataset.id || `admin-${Date.now().toString(36)}-${index}`,
          title,
          date,
          image: image || undefined,
          excerpt: cleanMultiline(data.raw('excerpt'), 500, ''),
          url: cleanUrl(data.text('url'), fallbackUrl, { allowEmpty: true, label: `ссылка новости «${title}»` }) || fallbackUrl,
          source: 'wellyfun',
          sourceName: 'WellyFun',
          pinned: data.bool('pinned'),
          demo: false
        };
      })
      .filter(Boolean);

    const minMemory = readInt(form, 'defaults.minMemory', 512, 32768, 2048);
    const maxMemory = readInt(form, 'defaults.maxMemory', minMemory, 65536, 4096);

    return {
      schema: 1,
      branding: {
        name: cleanText(readText(form, 'branding.name'), 64, 'Welly Launcher'),
        tagline: cleanText(readText(form, 'branding.tagline'), 200, ''),
        siteUrl: cleanUrl(
          readText(form, 'branding.siteUrl'),
          'https://abibaokak.github.io/welly-launcher',
          { label: 'ссылка на сайт' }
        ),
        donateUrl: cleanUrl(readText(form, 'branding.donateUrl'), '', {
          allowEmpty: true,
          label: 'ссылка на донат'
        }),
        discordUrl: cleanUrl(readText(form, 'branding.discordUrl'), '', {
          allowEmpty: true,
          label: 'ссылка Discord'
        }),
        telegramUrl: cleanUrl(readText(form, 'branding.telegramUrl'), '', {
          allowEmpty: true,
          label: 'ссылка Telegram'
        }),
        supportEmail: cleanText(readText(form, 'branding.supportEmail'), 120, '')
      },
      server: {
        host,
        name: cleanText(readText(form, 'server.name'), 64, 'WellyFun'),
        versionRange: cleanText(readText(form, 'server.versionRange'), 64, ''),
        modes
      },
      news: {
        includeExternal: readBool(form, 'news.includeExternal'),
        includePublished: readBool(form, 'news.includePublished'),
        externalFeeds: feeds,
        items
      },
      defaults: {
        language: readText(form, 'defaults.language') === 'en' ? 'en' : 'ru',
        theme: ['dark', 'light', 'system'].includes(readText(form, 'defaults.theme'))
          ? readText(form, 'defaults.theme')
          : 'dark',
        minMemory,
        maxMemory,
        resolutionWidth: readInt(form, 'defaults.resolutionWidth', 0, 10000, 1280),
        resolutionHeight: readInt(form, 'defaults.resolutionHeight', 0, 10000, 720),
        fullscreen: readBool(form, 'defaults.fullscreen'),
        hideLauncherOnGame: readBool(form, 'defaults.hideLauncherOnGame'),
        autoConnectServer: cleanText(readText(form, 'defaults.autoConnectServer'), 120, ''),
        selectedVersion: cleanText(readText(form, 'defaults.selectedVersion'), 64, ''),
        accountApiUrl: cleanUrl(readText(form, 'defaults.accountApiUrl'), 'http://127.0.0.1:8787', {
          label: 'API аккаунтов'
        })
      },
      updates: {
        enabled: readBool(form, 'updates.enabled'),
        latestVersion: cleanText(readText(form, 'updates.latestVersion'), 32, '1.0.9'),
        downloadUrl: cleanUrl(readText(form, 'updates.downloadUrl'), '', {
          label: 'ссылка на обновление'
        }),
        releaseNotesUrl: cleanUrl(readText(form, 'updates.releaseNotesUrl'), '', {
          allowEmpty: true,
          label: 'ссылка на список изменений'
        }),
        sha256: (() => {
          const raw = readText(form, 'updates.sha256').toLowerCase();
          if (!raw) return '';
          if (!/^[a-f0-9]{64}$/.test(raw)) {
            throw new Error('SHA-256 должен состоять из 64 шестнадцатеричных символов');
          }
          return raw;
        })(),
        mandatory: readBool(form, 'updates.mandatory'),
        message: cleanText(readText(form, 'updates.message'), 200, 'Доступна новая версия лаунчера')
      },
      maintenance: {
        enabled: readBool(form, 'maintenance.enabled'),
        message: cleanMultiline(
          readText(form, 'maintenance.message'),
          500,
          'Идут технические работы. Лаунчер скоро вернётся.'
        ),
        until: cleanText(readText(form, 'maintenance.until'), 64, '')
      },
      publishedAt: base.publishedAt || null,
      generatedAt: base.generatedAt
    };
  }

  /* ── Публикация ───────────────────────────────────────── */

  async function publish() {
    if (state.busy) return;
    const errorEl = $('#publish-error');
    errorEl.textContent = '';

    let config;
    try {
      config = collectConfig();
    } catch (error) {
      errorEl.textContent = error.message;
      toast(error.message, true);
      return;
    }

    state.busy = true;
    updatePublishBar();
    const button = $('#publish');
    button.disabled = true;
    button.textContent = 'Публикую…';

    try {
      const now = new Date().toISOString();
      config.publishedAt = now;
      config.generatedAt = now;

      await putConfig(config);

      state.config = normalizeLoaded(config);
      state.dirty = false;
      render();
      $('#pages-note').hidden = false;
      toast(
        `Опубликовано: ${config.updates.latestVersion}, новостей — ${config.news.items.length}. Pages обновится через 30–90 секунд.`
      );
    } catch (error) {
      const message =
        error.status === 409
          ? 'Файл изменился в другом месте. Нажмите «Перечитать» и повторите публикацию.'
          : error.status === 401
            ? 'Токен больше не действует. Выйдите и войдите заново.'
            : error.status === 403
              ? 'Нет прав на запись в репозиторий. Проверьте права токена (Contents: Read and write).'
              : error.message;
      errorEl.textContent = message;
      toast(message, true);
    } finally {
      state.busy = false;
      button.disabled = false;
      button.textContent = 'Опубликовать на сайте';
      updatePublishBar();
    }
  }

  /* ── SHA-256 файла обновления ─────────────────────────── */

  async function computeHash() {
    const form = $('#config-form');
    const hint = $('#hash-hint');
    const button = $('#hash-button');
    const url = readText(form, 'updates.downloadUrl');
    if (!url) {
      toast('Сначала укажите ссылку на файл обновления', true);
      return;
    }

    button.disabled = true;
    button.textContent = 'Считаю…';
    hint.textContent = 'Скачиваю файл и считаю SHA-256 в браузере…';

    try {
      const response = await fetch(`${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`, {
        cache: 'no-store'
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = await response.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', buffer);
      const hex = [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
      form.querySelector('[name="updates.sha256"]').value = hex;
      state.dirty = true;
      updatePublishBar();
      hint.textContent = `Посчитано: ${(buffer.byteLength / 1024 / 1024).toFixed(1)} МБ, SHA-256 ${hex.slice(0, 12)}…`;
      toast('SHA-256 посчитан и подставлен в поле');
    } catch (error) {
      hint.textContent =
        'Не удалось скачать файл из браузера (CORS или сеть). Впишите SHA-256 вручную — его можно получить командой Get-FileHash.';
      toast(`Ошибка: ${error.message}`, true);
    } finally {
      button.disabled = false;
      button.textContent = 'Посчитать';
    }
  }

  /* ── Скачивание / импорт JSON ─────────────────────────── */

  function exportJson() {
    try {
      const config = collectConfig();
      const blob = new Blob([`${JSON.stringify(config, null, 2)}\n`], {
        type: 'application/json'
      });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'launcher-config.json';
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      toast('Файл launcher-config.json скачан');
    } catch (error) {
      toast(error.message, true);
    }
  }

  function importJson(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        state.config = normalizeLoaded(parsed);
        state.dirty = true;
        render();
        updatePublishBar();
        toast('JSON загружен. Проверьте данные и опубликуйте.');
      } catch (error) {
        toast(`Не удалось прочитать JSON: ${error.message}`, true);
      }
    };
    reader.readAsText(file);
  }

  /* ── Вход / выход ─────────────────────────────────────── */

  function showApp() {
    $('#auth').hidden = true;
    $('#app').hidden = false;
    $('#bar-user').textContent = state.user ? `@${state.user}` : '';
    $('#bar-repo').textContent = `${REPO_LABEL} · ${BRANCH}`;
    $('#auth-repo').textContent = REPO_LABEL;
  }

  function showAuth(message = '') {
    $('#app').hidden = true;
    $('#auth').hidden = false;
    $('#auth-error').textContent = message;
    $('#auth-submit').disabled = false;
    $('#auth-submit').textContent = 'Войти';
  }

  function storeToken(token, remember) {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0');
    if (remember) localStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.setItem(TOKEN_KEY, token);
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    state.token = '';
  }

  function readStoredToken() {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || '';
  }

  async function boot() {
    $('#auth-repo').textContent = REPO_LABEL;
    $('#auth-remember').checked = localStorage.getItem(REMEMBER_KEY) === '1';

    const token = readStoredToken();
    if (!token) {
      showAuth();
      return;
    }

    showAuth('Проверяю токен…');
    try {
      await verifyToken(token);
      await loadConfig();
      showApp();
    } catch (error) {
      clearToken();
      showAuth(
        error.status === 401
          ? 'Токен недействителен или истёк. Введите новый.'
          : `Не удалось войти: ${error.message}`
      );
    }
  }

  $('#auth-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const token = $('#auth-token').value.trim();
    const remember = $('#auth-remember').checked;
    const errorEl = $('#auth-error');
    const submit = $('#auth-submit');
    errorEl.textContent = '';

    if (!token) {
      errorEl.textContent = 'Вставьте GitHub-токен';
      return;
    }

    submit.disabled = true;
    submit.textContent = 'Проверяю…';

    try {
      await verifyToken(token);
      storeToken(token, remember);
      await loadConfig();
      $('#auth-token').value = '';
      showApp();
      toast(`Добро пожаловать, ${state.user}`);
    } catch (error) {
      clearToken();
      errorEl.textContent =
        error.status === 401
          ? 'GitHub отклонил токен. Проверьте, что он скопирован целиком.'
          : error.status === 404
            ? `Нет доступа к репозиторию ${REPO_LABEL}. Проверьте права токена.`
            : `Ошибка входа: ${error.message}`;
    } finally {
      submit.disabled = false;
      submit.textContent = 'Войти';
    }
  });

  $('#logout').addEventListener('click', () => {
    if (state.dirty && !confirm('Есть неопубликованные изменения. Выйти без публикации?')) return;
    clearToken();
    location.reload();
  });

  $('#reload').addEventListener('click', async () => {
    if (state.dirty && !confirm('Перечитать файл и потерять неопубликованные изменения?')) return;
    try {
      await loadConfig();
      toast('Конфиг перечитан из репозитория');
    } catch (error) {
      toast(`Не удалось перечитать: ${error.message}`, true);
    }
  });

  /* ── События формы ────────────────────────────────────── */

  const form = $('#config-form');

  form.addEventListener('input', () => {
    if (!state.dirty) {
      state.dirty = true;
      updatePublishBar();
    }
  });

  form.addEventListener('change', () => {
    if (!state.dirty) {
      state.dirty = true;
      updatePublishBar();
    }
  });

  form.addEventListener('click', (event) => {
    const remove = event.target.closest('[data-remove]');
    if (!remove) return;
    const item = remove.closest('.item');
    if (!item) return;
    item.remove();
    const kind = remove.dataset.remove;
    if (kind === 'mode') {
      renderModes(readModesFromDom());
    } else if (kind === 'feed') {
      renderFeeds(readFeedsFromDom());
    } else if (kind === 'news') {
      renderNews(readNewsFromDom());
    }
    state.dirty = true;
    updatePublishBar();
  });

  document.addEventListener('click', (event) => {
    const add = event.target.closest('[data-add]');
    if (!add) return;
    const kind = add.dataset.add;
    if (kind === 'mode') {
      const modes = readModesFromDom();
      modes.push({
        id: `mode-${modes.length + 1}`,
        name: `Режим ${modes.length + 1}`,
        description: '',
        emoji: '🎮',
        mode: '',
        tag: ''
      });
      renderModes(modes);
    } else if (kind === 'feed') {
      const feeds = readFeedsFromDom();
      feeds.push({ url: '', name: 'RSS' });
      renderFeeds(feeds);
    } else if (kind === 'news') {
      const items = readNewsFromDom();
      if (items.length >= MAX_NEWS) {
        toast(`Максимум ${MAX_NEWS} новостей`, true);
        return;
      }
      items.unshift({
        id: `admin-${Date.now().toString(36)}`,
        title: '',
        date: new Date().toISOString(),
        excerpt: '',
        url: '',
        image: '',
        pinned: false
      });
      renderNews(items);
    }
    state.dirty = true;
    updatePublishBar();
  });

  function readModesFromDom() {
    return $$('[data-mode-row]', form).map((row) => {
      const data = collectRow(row);
      return {
        id: data.text('id'),
        name: data.text('name'),
        description: data.raw('description'),
        emoji: data.text('emoji'),
        mode: data.text('mode'),
        tag: data.text('tag')
      };
    });
  }

  function readFeedsFromDom() {
    return $$('[data-feed-row]', form).map((row) => {
      const data = collectRow(row);
      return { url: data.text('url'), name: data.text('name') };
    });
  }

  function readNewsFromDom() {
    return $$('[data-news-row]', form).map((row) => {
      const data = collectRow(row);
      return {
        id: row.dataset.id || '',
        title: data.text('title'),
        date: fromLocalInput(data.raw('date')),
        excerpt: data.raw('excerpt'),
        url: data.text('url'),
        image: data.text('image'),
        pinned: data.bool('pinned')
      };
    });
  }

  $('#publish').addEventListener('click', publish);
  $('#hash-button').addEventListener('click', computeHash);
  $('#export').addEventListener('click', exportJson);
  $('#import').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', (event) => {
    const file = event.target.files && event.target.files[0];
    if (file) importJson(file);
    event.target.value = '';
  });

  window.addEventListener('beforeunload', (event) => {
    if (!state.dirty) return;
    event.preventDefault();
    event.returnValue = '';
  });

  boot();
})();

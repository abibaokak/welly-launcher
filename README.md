# Welly Launcher — сайт

Многостраничный сайт лаунчера на русском: главная, возможности, загрузчики,
скриншоты, сервер, установка и FAQ. Сайт описывает актуальную версию **0.6**:
Fabric, Forge и OptiFine, сворачивание лаунчера на время игры, тёмную, светлую
и системную темы, RU/EN, 3D-редактор скинов и аккаунт Welly ID.

- Чистый HTML + CSS + JS, без сборки. Общие `styles.css` и `script.js` для всех
  страниц.
- Автоматическая публикация на GitHub Pages из ветки `main`.
- Активный пункт меню подсвечивается по имени текущего файла в `script.js`.
- Кнопки «Скачать» ведут на последний релиз:
  `https://github.com/<owner>/<repo>/releases/latest/download/WellyLauncher.exe`
  Адрес владельца и репозитория вычисляется из `*.github.io`, ничего вручную
  вписывать не нужно.
- Статус сервера берётся из `api.mcstatus.io`, при сбое — из `api.mcsrvstat.us`:
  оба API опрашиваются параллельно, побеждает первый успешный ответ. Если не
  ответил ни один, сайт честно пишет «нет данных» и повторяет попытку. Запрос
  выполняется только на страницах, где есть блок статуса.
- Ссылки «Магазин» / «Сайт и магазин» ведут на официальный сайт сервера
  `https://donatesmp.mydonate.io/`. Адрес повторяется в шапке и подвале каждой
  страницы, а также в блоке помощи FAQ — при смене адреса обнови все страницы.

> Welly ID — функция лаунчера. Серверная часть находится в
> `../welly-launcher/server`; этот репозиторий остаётся статическим и backend
> не содержит.

## Структура

```
index.html                  главная: hero, что нового, короткий список возможностей
features.html               все возможности и блок «Что нового в 0.6»
loaders.html                Fabric, Forge, OptiFine: как ставить и что важно знать
screenshots.html            галерея скриншотов с лайтбоксом
server.html                 сервер WellyFun, статус, режимы и подключение
install.html                требования, три шага установки, SmartScreen
faq.html                    11 частых вопросов
404.html                    страница ошибки (GitHub Pages)
sitemap.xml                 карта сайта
robots.txt                  разрешает индексацию и указывает sitemap
styles.css                  оформление, включая блок Multi-page
script.js                   навигация, статус, скачивание, галерея, меню, toast
assets/logo.png             логотип
assets/favicon.ico          иконка
assets/screenshots/*.png    реальные скриншоты лаунчера
```

Каждая страница содержит одинаковые шапку и подвал. При добавлении нового
пункта меню обнови навигацию во всех HTML-файлах и ссылки в подвале.

`404.html` использует абсолютные пути с префиксом `/welly-launcher/`, потому что
GitHub Pages отдаёт её по любому несуществующему адресу. Если переименовать
репозиторий, замени префикс в `404.html`, а также `canonical` и `og:url`-адреса
на остальных страницах.

## Как опубликовать

1. Создай на GitHub новый **публичный** репозиторий, например `welly-launcher`.
2. Загрузи в него всё содержимое этой папки.
3. Открой **Settings → Pages** и в разделе **Build and deployment** выбери
   **Source: Deploy from a branch**, ветку `main` и папку `/ (root)`.
4. Через минуту сайт будет доступен по адресу
   `https://<твой-ник>.github.io/welly-launcher/`.

После каждого пуша в ветку `main` GitHub Pages пересобирает сайт автоматически.

### Если есть Git и GitHub CLI

```bash
cd welly-site
git init -b main
git add .
git commit -m "Welly Launcher site"
gh repo create welly-launcher --public --source=. --remote=origin --push
gh api -X POST repos/:owner/welly-launcher/pages \
  -f 'source[branch]=main' -f 'source[path]=/'
```

## Как добавить файл для скачивания

Сайт скачивает файл из последнего релиза с именем ровно `WellyLauncher.exe`.

1. Открой репозиторий → **Releases** → **Draft a new release**.
2. Тег: `v0.6`, заголовок: `Welly Launcher v0.6`.
3. Прикрепи собранный `WellyLauncher.exe` и опубликуй релиз.

Кнопки на сайте сразу начнут отдавать этот файл — ссылка `…/releases/latest/download/WellyLauncher.exe`.
Если выпустить релиз с тем же тегом заново, GitHub сам заменит файл.

## Как обновить скриншоты

Скриншоты снимаются встроенным режимом лаунчера:

```powershell
$env:WELLY_SCREENSHOT = "C:\путь\welly-site\assets\screenshots\home.png"
$env:WELLY_SCREENSHOT_ROUTE = "/home"
$env:WELLY_SCREENSHOT_LANG = "ru"
$env:WELLY_SCREENSHOT_THEME = "dark"
& "C:\путь\WellyLauncher.exe"
```

Доступные маршруты: `/home`, `/versions`, `/servers`, `/news`, `/settings`,
`/skin`, `/account`. Для светлой темы задай `WELLY_SCREENSHOT_THEME=light`,
для английского — `WELLY_SCREENSHOT_LANG=en`.

В галерее девять файлов: `home.png` и `skin.png` — широкие,
`versions.png`, `versions-loaders.png`, `servers.png`, `news.png`, `settings.png`,
`account.png` и `home-light.png` (главная в светлой теме) — парами.
`versions-loaders.png` дополнительно используется на главной и на странице
загрузчиков.

После запуска лаунчер сам сохранит PNG и закроется.

## Локальный просмотр

Из папки `welly-site` запусти любой статический сервер, например:

```powershell
npx serve .
```

Или открой `index.html` в браузере. Кнопка скачивания на локальной копии
показывает подсказку — настоящая ссылка появляется только на GitHub Pages.
Для проверки `404.html` по абсолютным путям удобно поднять сервер на уровень
выше и открыть `/welly-launcher/404.html` (папку можно связать junction-ссылкой).

## Дисклеймер

Фанатский проект для сервера WellyFun. Не связан с Mojang Studios или Microsoft.
Minecraft — торговая марка Mojang Studios.

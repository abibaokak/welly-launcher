# Welly Launcher — сайт

Многостраничный сайт лаунчера на русском: главная, возможности, загрузчики,
скриншоты, сервер, установка и FAQ. Сайт описывает актуальную версию **1.0.7**:
вход через Microsoft, аккаунт Welly ID с аватаркой, автоматический вход после
регистрации, генератор паролей и «запомнить пароль», роли с цветными галочками,
скины в одиночной игре и на
серверах с `online-mode=false` через CustomSkinLoader, Fabric, Quilt, Forge,
NeoForge и OptiFine, косметику для скинов (шляпы, маски, ушки), сворачивание
лаунчера на время игры, тёмную, светлую и системную темы, RU/EN и 3D-редактор
скинов.

- Чистый HTML + CSS + JS, без сборки. Общие `styles.css` и `script.js` для всех
  страниц.
- Публикация на GitHub Pages из ветки `main`:
  **https://abibaokak.github.io/welly-launcher/**.
- Активный пункт меню подсвечивается по имени текущего файла в `script.js`.
- Кнопки «Скачать» ведут на последний релиз:
  `https://github.com/abibaokak/welly-launcher/releases/latest/download/WellyLauncher.exe`
  Владелец и репозиторий берутся из `FALLBACK_REPO` в `script.js`; на
  `*.github.io` они по-прежнему вычисляются из адреса.
- Статус сервера берётся из `api.mcstatus.io`, при сбое — из `api.mcsrvstat.us`:
  оба API опрашиваются параллельно, побеждает первый успешный ответ. Если не
  ответил ни один, сайт честно пишет «нет данных» и повторяет попытку. Запрос
  выполняется только на страницах, где есть блок статуса.
- Ссылки «Магазин» / «Сайт и магазин» ведут на официальный сайт сервера
  `https://donatesmp.mydonate.io/`. Адрес повторяется в шапке и подвале каждой
  страницы, а также в блоке помощи FAQ — при смене адреса обнови все страницы.

> Welly ID — функция лаунчера: сервер аккаунтов встроен в приложение и работает
> локально, поэтому разворачивать `../welly-launcher/server` больше не нужно.
> Этот репозиторий остаётся статическим и backend не содержит. Роли хранятся на
> сервере аккаунтов: с встроенным локальным сервером они действуют на этом
> компьютере, а с общим сервером видны всем его пользователям.

## Структура

```
index.html                  главная: hero, что нового, короткий список возможностей
features.html               все возможности и блок «Что нового в 1.0.7»
loaders.html                Fabric, Quilt, Forge, NeoForge, OptiFine: как ставить и что важно знать
screenshots.html            галерея скриншотов с лайтбоксом
server.html                 сервер WellyFun, статус, режимы и подключение
install.html                требования, три шага установки, SmartScreen, SHA-256 и Welly ID
faq.html                    14 частых вопросов
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
GitHub Pages отдаёт её по любому несуществующему адресу. Так же устроены
`canonical` и `og:url` на остальных страницах: они указывают на
`https://abibaokak.github.io/welly-launcher/`. Если переименовать репозиторий
или подключить свой домен, обнови префикс в `404.html`, эти адреса,
`sitemap.xml` и `robots.txt`.

## Как опубликовать

1. Создай на GitHub новый **публичный** репозиторий, например `welly-launcher`.
2. Загрузи в него всё содержимое этой папки.
3. Открой **Settings → Pages** и в разделе **Build and deployment** выбери
   **Source: Deploy from a branch**, ветку `main` и папку `/ (root)`.
4. Через минуту сайт будет доступен по адресу
   `https://abibaokak.github.io/welly-launcher/`.

После каждого пуша в ветку `main` GitHub Pages пересобирает сайт автоматически.

### Свой домен

Домен должен быть зарегистрирован и делегирован (у него должны быть NS-записи).
Для apex-домена добавь A-записи GitHub Pages `185.199.108.153`,
`185.199.109.153`, `185.199.110.153`, `185.199.111.153` (и AAAA
`2606:50c0:8000::153` … `2606:50c0:8003::153`), для `www` — CNAME на
`abibaokak.github.io`. Затем укажи домен в **Settings → Pages**, включи
**Enforce HTTPS** и обнови адреса в HTML, `sitemap.xml` и `robots.txt`.

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

Установщик и portable-версия лежат прямо в репозитории и раздаются GitHub Pages
(файлы больше 50 МБ GitHub не даёт загружать в Releases без LFS, поэтому выбран
этот способ).

1. Собери установщик: `npm run build:win`.
2. Скопируй `dist/WellyLauncher-Setup-<версия>.exe` и `dist/WellyLauncher.exe`
   в корень этого репозитория, заменив старые файлы.
3. Обнови имя файла в `script.js` (`DOWNLOAD_FILE`), текст и SHA-256 установщика
   в callout на `install.html` (`Get-FileHash .\WellyLauncher-Setup-<версия>.exe`).
4. Закоммить и запушь — GitHub Pages обновит файлы через минуту.

Кнопки на сайте отдают файл из корня сайта, без GitHub Releases.

## Общий каталог скинов

`skins/catalog.json` — список скинов, которые видят все игроки с Welly Launcher.
Формат и правила описаны в `skins/README.md`. Картинки лежат в той же папке,
имя файла — SHA-256 от PNG.

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
`/skin`, `/accessories`, `/account`. Для светлой темы задай
`WELLY_SCREENSHOT_THEME=light`, для английского — `WELLY_SCREENSHOT_LANG=en`.

В галерее десять файлов. Широкие карточки: `home.png`, `skin.png` и
`accessories.png`; обычные: `versions.png`, `versions-loaders.png`,
`servers.png`, `news.png`, `settings.png`, `account.png` и `home-light.png`
(главная в светлой теме). `versions-loaders.png` дополнительно используется
на главной и на странице загрузчиков, `account.png` — на главной и в блоке
«Что нового» на странице возможностей.

После запуска лаунчер сам сохранит PNG и закроется.

## Локальный просмотр

Из папки `welly-site` запусти любой статический сервер, например:

```powershell
npx serve .
```

Или открой `index.html` в браузере. Кнопка скачивания ведёт на последний
релиз на GitHub, поэтому работает и на локальной копии.
Для проверки `404.html` по абсолютным путям подними сервер на уровень выше
папки `welly-site` и открой `/welly-launcher/404.html` (папку можно связать
junction-ссылкой).

## Дисклеймер

Фанатский проект для сервера WellyFun. Не связан с Mojang Studios или Microsoft.
Minecraft — торговая марка Mojang Studios.

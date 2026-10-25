# Welly Launcher — сайт

Одностраничный сайт лаунчера на русском: скачивание, скриншоты, возможности,
живой статус сервера WellyFun и FAQ.

- Чистый HTML + CSS + JS, без сборки.
- Автоматическая публикация на GitHub Pages из ветки `main`.
- Кнопки «Скачать» ведут на последний релиз:
  `https://github.com/<owner>/<repo>/releases/latest/download/WellyLauncher.exe`
  Адрес владельца и репозитория вычисляется из `*.github.io`, ничего вручную
  вписывать не нужно.
- Статус сервера берётся из `api.mcstatus.io` и мягко деградирует, если API
  недоступен.

## Структура

```
index.html                  страница
styles.css                  оформление
script.js                   статус сервера, скачивание, галерея, меню
assets/logo.png             логотип
assets/favicon.ico          иконка
assets/screenshots/*.png    реальные скриншоты лаунчера
```

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
2. Тег: `v0.2` (или любой новый), заголовок: `Welly Launcher v0.2`.
3. Прикрепи собранный `WellyLauncher.exe` (около 71 МБ) и опубликуй релиз.

Кнопки на сайте сразу начнут отдавать этот файл — ссылка `…/releases/latest/download/WellyLauncher.exe`.
Если выпустить релиз с тем же тегом заново, GitHub сам заменит файл.

## Как обновить скриншоты

Скриншоты снимаются встроенным режимом лаунчера:

```powershell
$env:WELLY_SCREENSHOT = "C:\путь\welly-site\assets\screenshots\home.png"
$env:WELLY_SCREENSHOT_ROUTE = "/home"
& "C:\путь\WellyLauncher.exe"
```

Доступные маршруты: `/home`, `/versions`, `/servers`, `/news`, `/settings`.
После запуска лаунчер сам сохранит PNG и закроется.

## Локальный просмотр

```powershell
# из папки welly-site
python -m http.server 8000
```

Или просто открой `index.html` в браузере. Кнопка скачивания на локальной
копии показывает подсказку — настоящая ссылка появляется только на GitHub Pages.

## Дисклеймер

Фанатский проект для сервера WellyFun. Не связан с Mojang Studios или Microsoft.
Minecraft — торговая марка Mojang Studios.

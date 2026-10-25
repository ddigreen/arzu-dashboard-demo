# Показ демоверсии через GitHub Pages

Демоверсия опубликована **25 октября 2026 года**:

- Сайт: [ddigreen.github.io/arzu-dashboard-demo](https://ddigreen.github.io/arzu-dashboard-demo/).
- Публичный репозиторий: [ddigreen/arzu-dashboard-demo](https://github.com/ddigreen/arzu-dashboard-demo).
- Первый успешный запуск: [GitHub Actions № 40188270171](https://github.com/ddigreen/arzu-dashboard-demo/actions/runs/40188270171). Проверка JavaScript, 53 теста, сборка и развёртывание завершились успешно; HTTPS-адрес вернул HTTP 200.

Текущая версия — статический сайт без серверных зависимостей. Ернар Отаров и сотрудники могут открыть HTTPS-ссылку с компьютера или телефона, без запущенного сервера на вашем Mac. Публикация предназначена для показа интерфейса с синтетическими данными и не превращает демоверсию в общую рабочую систему.

## Настройка размещения

Исходники загружены в публичный репозиторий `ddigreen/arzu-dashboard-demo`, ветка публикации — `main`, источник Pages — **GitHub Actions**. Для GitHub Free репозиторий Pages должен быть публичным; любой человек может просматривать его файлы. [Доступность GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).

Обычный Pages-сайт публичен даже при размещении из закрытого репозитория на подходящем тарифе. Ограничение доступа к самому сайту предусмотрено для организаций GitHub Enterprise Cloud; закрытый репозиторий сам по себе такого ограничения не создаёт. [Видимость сайта](https://docs.github.com/en/enterprise-cloud@latest/pages/getting-started-with-github-pages/changing-the-visibility-of-your-github-pages-site).

## Обновление опубликованной версии

1. Изменить исходники проекта в `src/` и связанные тесты или документацию. Корень репозитория содержит только проект ARZU; не загружать рабочий каталог Codex, личные файлы или реальные данные компании.
2. Локально выполнить `npm run check`, `npm test` и `npm run build`.
3. Закоммитить изменения и отправить их в ветку `main`, сохранив `.github/workflows/pages.yml`. Публикация начнётся автоматически.
4. Дождаться успешного завершения **Publish ARZU demo to GitHub Pages** на вкладке [Actions](https://github.com/ddigreen/arzu-dashboard-demo/actions).
5. Открыть [сайт](https://ddigreen.github.io/arzu-dashboard-demo/), обновить страницу и проверить изменённые сценарии на компьютере и мобильной ширине.

Для повторной публикации без изменений можно открыть **Actions → Publish ARZU demo to GitHub Pages → Run workflow → main**. Источник размещения уже выбран в **Settings → Pages → Build and deployment → Source → GitHub Actions**. Ссылка остаётся прежней при обновлениях `main`.

Workflow использует Node.js 22, выполняет проверку синтаксиса, тесты и `npm run build`, публикует только `dist/`. Установка зависимостей не требуется. Относительные пути ресурсов поддерживают адрес с именем репозитория. Ручной запуск разрешён только из `main`. [Официальный порядок настройки](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Границы демонстрации

- Логины и пароли проверяются в клиентском JavaScript. Это демонстрация сценария входа, а не защита от доступа к данным; не используйте реальные рабочие пароли. Исходные демоданные и механизмы входа доступны посетителю.
- Отчёты, настройки и демодоступ сохраняются только в текущем браузере; вложения — в его IndexedDB. Изменения на телефоне сотрудника не появятся у директора на другом устройстве. Переход с localhost на опубликованный адрес создаёт отдельное локальное состояние.
- GitHub Pages раздаёт статические файлы и не предоставляет нашему проекту серверную базу, проверку ролей или синхронизацию. Реальную работу сотрудников нужно строить с backend и общей базой.
- HTTPS поддерживается Pages, но не заменяет серверную авторизацию. GitHub не рекомендует Pages для чувствительных операций, включая передачу реальных паролей. [HTTPS и ограничения](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https).

GitHub Pages предназначен здесь для ознакомительного показа. Для промышленной системы нужно выбрать другое размещение; Pages не предназначен для ведения онлайн-бизнеса или коммерческого SaaS. [Ограничения Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).

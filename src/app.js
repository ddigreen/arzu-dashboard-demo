(() => {
  "use strict";
  const D = window.ARZUData,
    S = window.ARZUStore,
    A = window.ARZUAuth,
    T = window.ARZUTheme,
    C = window.ARZUCharts,
    TODAY = "2026-10-25";
  const app = document.getElementById("app"),
    overlay = document.getElementById("overlay-root");
  let db = S.load(),
    userId = null,
    loginError = "";
  try {
    userId = A.getSession(db.users);
  } catch (error) {
    loginError = error.message;
  }
  let view = "overview",
    from = "2026-10-01",
    to = TODAY,
    dept = "all",
    search = "",
    statusFilter = "all",
    sort = "desc",
    seriesOn = { revenue: true, receipts: true, payments: false },
    chartType = "area",
    formFiles = [],
    formDirty = false,
    draftTimer = null,
    uploadBusy = false,
    modalReturnFocus = null;
  const DEPTS = {
    production: "Производство",
    warehouse: "Склад",
    sales: "Продажи",
    finance: "Финансы",
  };
  const ROLES = {
    director: "Руководитель",
    admin: "Администратор",
    staff: "Сотрудник",
  };
  const STATUS = {
    approved: "Подтверждён",
    submitted: "На проверке",
    returned: "На уточнении",
    draft: "Черновик",
    active: "Активен",
    invited: "Создан в демо",
    disabled: "Отключён",
  };
  const FIELDS = {
    production: [
      ["output", "Выпуск продукции", "ед."],
      ["defects", "Брак", "ед."],
      ["raw", "Сырьё в производство", "кг"],
    ],
    warehouse: [
      ["stock", "Фактический остаток сырья", "кг"],
      ["received", "Поступление сырья", "кг"],
      ["issued", "Выдача в производство", "кг"],
    ],
    sales: [
      ["units", "Реализовано продукции", "ед."],
      ["revenue", "Выручка от продаж", "₸"],
      ["cost", "Себестоимость проданного", "₸"],
    ],
    finance: [
      ["receipts", "Внешние поступления", "₸"],
      ["payments", "Внешние выплаты", "₸"],
      ["opex", "В том числе операционные расходы", "₸"],
      ["transfers", "Внутренние переводы", "₸"],
    ],
  };
  const paths = {
    moon: "M20.8 13a9 9 0 1 1-9.8-9.8 7 7 0 0 0 9.8 9.8z",
    sun: "M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1.5 1.5 M17.5 17.5L19 19 M5 19l1.5-1.5 M17.5 6.5L19 5 M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
    grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    chart: "M4 19V5 M4 19h16 M8 15l4-5 4 2 4-7",
    factory: "M3 21V10l6 3V8l6 3V3h5v18H3 M7 17h1 M12 17h1 M17 17h1",
    camera: "M3 7h4l2-3h6l2 3h4v14H3V7 M16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
    box: "M3 7l9-4 9 4v10l-9 4-9-4V7 M3 7l9 4 9-4 M12 11v10 M8 5l9 4",
    wallet: "M20 8V5H4a2 2 0 0 0 0 4h16v11H4a2 2 0 0 1-2-2V7 M16 12h6v5h-6z",
    file: "M14 2H5v20h14V7l-5-5z M14 2v6h5 M8 12h8 M8 16h6",
    users:
      "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M17 4a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87",
    clock: "M12 8v4l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
    help: "M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3 M12 17h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
    chevron: "M9 5l7 7-7 7",
    down: "M6 9l6 6 6-6",
    search: "M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
    bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4",
    calendar: "M8 2v4 M16 2v4 M3 10h18 M3 4h18v17H3z",
    download: "M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5",
    upload: "M12 16V4 M7 9l5-5 5 5 M4 16v5h16v-5",
    arrow: "M4 12h16 M14 6l6 6-6 6",
    switch: "M4 7h16l-4-4 M20 17H4l4 4",
    close: "M6 6l12 12 M6 18L18 6",
    check: "M5 12l4 4L19 6",
    alert: "M12 3L2 21h20L12 3z M12 9v5 M12 18h.01",
    info: "M12 11v6 M12 7h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
    plus: "M12 4v16 M4 12h16",
    shield: "M12 2l9 4v6c0 6-9 10-9 10S3 18 3 12V6l9-4z M8 12l3 3 5-6",
    settings: "M4 7h16 M4 17h16 M8 4v6 M16 14v6",
    menu: "M4 6h16 M4 12h16 M4 18h16",
    logout: "M9 4H4v16h5 M10 12h11 M17 8l4 4-4 4",
    sort: "M8 3v18 M4 7l4-4 4 4 M16 21V3 M12 17l4 4 4-4",
    refresh: "M20 7V3l-3 3A9 9 0 1 0 3 16 M20 3h-5",
    eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
    paperclip: "M8 13l7-7a3 3 0 0 1 4 4l-9 9a5 5 0 0 1-7-7l9-9",
    save: "M19 21H5a2 2 0 0 1-2-2V3h15l3 3v13a2 2 0 0 1-2 2 M7 3v6h10V3 M7 21v-8h10v8",
  };
  const I = (name, cls = "") =>
    `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.file}"/></svg>`;
  const E = (x) =>
    String(x ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const num = (n, d = 0) =>
    n === null || n === undefined
      ? "—"
      : new Intl.NumberFormat("ru-RU", { maximumFractionDigits: d }).format(n);
  const money = (n) => `${num(n)} ₸`,
    compact = (n) =>
      n === null ? "—" : n >= 1e6 ? num(n / 1e6, 2) + " млн" : num(n);
  const date = (d) =>
    new Date(d + "T12:00:00Z").toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
    });
  const dateShort = (d) =>
    new Date(d + "T12:00:00Z").toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  const time = (at) =>
    new Date(at).toLocaleString("ru-RU", {
      timeZone: "Asia/Almaty",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  const actorName = (name, id) =>
    id === "u-dir" || name === "Руслан Есенов"
      ? db.users.find((x) => x.id === "u-dir")?.name || name
      : name;
  const initials = (n) =>
    n
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("");
  const badge = (status) =>
    `<span class="badge ${E(status)}">${E(STATUS[status] || status)}</span>`;
  const u = () =>
    db.users.find((x) => x.id === userId && x.status === "active");
  const deptIcon = (d) =>
    I(
      {
        production: "factory",
        warehouse: "box",
        sales: "chart",
        finance: "wallet",
      }[d],
    );
  const deptName = (d) =>
    `<span class="department"><span class="dept-icon ${d}">${deptIcon(d)}</span>${DEPTS[d]}</span>`;
  const btn = (text, action, icon = "", cls = "", attrs = "") =>
    `<button class="btn ${cls}" data-action="${action}" ${attrs}>${icon ? I(icon) : ""}${text}</button>`;
  const empty = (title, text = "Попробуйте изменить фильтры.") =>
    `<div class="empty">${I("file")}<strong>${title}</strong>${text}</div>`;
  function toast(message) {
    let t = document.getElementById("toast");
    t.textContent = message;
    t.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove("show"), 3600);
  }
  function refresh() {
    db = S.get();
    render();
  }
  function run(fn) {
    try {
      return fn();
    } catch (err) {
      toast(err.message);
      return null;
    }
  }
  function currentReports() {
    return db.reports.filter(
      (r) =>
        r.date >= from && r.date <= to && (dept === "all" || r.dept === dept),
    );
  }
  function agg() {
    return D.aggregate(db.reports, from, to, dept);
  }
  function available(d) {
    return (
      (dept === "all" || dept === d) &&
      currentReports().some((r) => r.dept === d && r.status === "approved")
    );
  }
  function stats() {
    const a = agg();
    return {
      ...a,
      revenue: available("sales") ? a.revenue : null,
      receipts: available("finance") ? a.receipts : null,
      payments: available("finance") ? a.payments : null,
      output: available("production") ? a.output : null,
    };
  }
  function brand() {
    return `<div class="brand"><span class="brand-mark">A</span><div><div class="brand-name">ARZU</div><small>OPERATIONS PLATFORM</small></div></div>`;
  }
  function themeButton(extra = "") {
    const dark = T.get() === "dark",
      label = dark ? "Включить светлую тему" : "Включить тёмную тему";
    return `<button type="button" class="icon-button theme-button ${extra}" data-action="toggle-theme" aria-label="${label}" title="${label}" aria-pressed="${dark}">${I(dark ? "sun" : "moon")}</button>`;
  }
  function updateThemeButtons() {
    document
      .querySelectorAll('[data-action="toggle-theme"]')
      .forEach((button) => {
        const dark = T.get() === "dark",
          label = dark ? "Включить светлую тему" : "Включить тёмную тему";
        button.innerHTML = I(dark ? "sun" : "moon");
        button.setAttribute("aria-label", label);
        button.setAttribute("title", label);
        button.setAttribute("aria-pressed", String(dark));
      });
  }
  window.addEventListener("arzu:theme", updateThemeButtons);
  function login() {
    window.scrollTo(0, 0);
    app.innerHTML = `<main class="login-page"><section class="login-left">${brand()}<div class="login-content"><div class="eyebrow">ТА-МАК / УПРАВЛЕНИЕ ПРОИЗВОДСТВОМ</div><h1>Всё производство.<br><span>В одном ритме.</span></h1><p>От ежедневных данных до решений.<br>Единое пространство для команды<br>и руководителя.</p><div class="login-flow"><span>Данные</span>${I("arrow")}<span>Проверка</span>${I("arrow")}<span>Решения</span></div><div class="login-illustration" aria-hidden="true">${[38, 53, 47, 70, 62, 85, 78, 97, 90, 110, 103, 118].map((n) => `<i style="--height:${n}px"></i>`).join("")}</div></div><div class="login-left-footer"><span>СИСТЕМНОСТЬ В КАЖДОМ ДНЕ</span><span>Версия 1.2</span></div></section><section class="login-right">${themeButton("login-theme-toggle")}<div class="login-form"><div class="eyebrow">РАБОЧЕЕ ПРОСТРАНСТВО</div><h2>Войти в ARZU</h2><p>Введите логин и пароль.<br>Ваше рабочее пространство откроется автоматически.</p><form id="login-form" novalidate><label class="field login-field"><span>Логин</span><input id="login-name" name="login" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="Ваш логин" required maxlength="40"></label><label class="field login-field"><span>Пароль</span><div class="password-control"><input id="login-password" type="password" name="password" aria-label="Пароль" autocomplete="current-password" placeholder="Введите пароль" required maxlength="128"><button class="password-toggle" type="button" data-action="toggle-password" data-target="login-password" aria-label="Показать пароль" aria-pressed="false">${I("eye")}</button></div></label><div id="login-error" role="alert" aria-live="polite">${loginError ? `<div class="error-text">${E(loginError)}</div>` : ""}</div><button class="btn primary login-submit" type="submit">Войти в систему ${I("arrow")}</button></form><div class="login-help"><span>${I("shield")} Доступ по вашей учётной записи</span><button type="button" data-action="login-help">Демо-доступы</button></div><div class="login-footer">Демонстрационная версия · Вход проверяется локально.<br>Не используйте рабочие пароли.</div></div></section></main>`;
    document
      .getElementById("login-form")
      .addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.currentTarget,
          button = form.querySelector('[type="submit"]'),
          error = document.getElementById("login-error"),
          fields = new FormData(form);
        if (button.disabled) return;
        error.innerHTML = "";
        if (!fields.get("login")?.trim() || !fields.get("password")) {
          error.innerHTML =
            '<div class="error-text">Введите логин и пароль.</div>';
          return;
        }
        button.disabled = true;
        button.textContent = "Входим…";
        try {
          db = S.get();
          userId = await A.signIn(
            fields.get("login"),
            fields.get("password"),
            db.users,
          );
          loginError = "";
          view =
            u().role === "director"
              ? "overview"
              : u().role === "admin"
                ? "team"
                : "daily";
          from = "2026-10-01";
          to = TODAY;
          dept = "all";
          daily.date = TODAY;
          search = "";
          statusFilter = "all";
          render();
        } catch (err) {
          error.innerHTML = `<div class="error-text">${E(err.message)}</div>`;
          button.disabled = false;
          button.innerHTML = "Войти в систему " + I("arrow");
        }
      });
  }
  function loginHelp() {
    modal(
      "Доступы для проверки",
      `<p>Это общедоступные демонстрационные пароли для показа интерфейса. Проверка выполняется в текущем браузере.</p><div class="table-container"><table><thead><tr><th>Панель / участок</th><th>Логин</th><th>Пароль</th></tr></thead><tbody>${[
        ["Ернар Отаров · руководитель", "ernar", "Ernar2026!"],
        ["Администратор", "admin", "Admin2026!"],
        ["Сотрудник · производство", "worker", "Worker2026!"],
        ["Сотрудник · склад", "sklad", "Sklad2026!"],
        ["Сотрудник · продажи", "sales", "Sales2026!"],
        ["Сотрудник · финансы", "finance", "Finance2026!"],
      ]
        .map(
          ([role, name, password]) =>
            `<tr><td>${role}</td><td><code>${name}</code></td><td><code>${password}</code></td></tr>`,
        )
        .join(
          "",
        )}</tbody></table></div><p>Если администратор изменил демо-пароль, используйте новые данные. Для рабочего запуска нужна серверная авторизация.</p>`,
      btn("Понятно", "close", "check", "primary"),
      true,
    );
  }
  function credentialModal(id) {
    const target = db.users.find((x) => x.id === id);
    if (!target || u()?.role !== "admin") {
      toast("Настроить вход может только администратор.");
      return;
    }
    let currentLogin;
    try {
      currentLogin = A.getLogin(id);
    } catch (error) {
      toast(error.message);
      return;
    }
    modal(
      "Логин и пароль",
      `<p>${E(target.name)} · ${ROLES[target.role]}</p><form id="credential-form" data-id="${target.id}"><label class="field"><span>Логин</span><input name="login" value="${E(currentLogin)}" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Например, worker2" required minlength="3" maxlength="40"><small>От 3 до 40 латинских букв, цифр или символов . _ -</small></label><label class="field"><span>${currentLogin ? "Новый пароль" : "Пароль"}</span><div class="password-control"><input type="password" id="credential-password" name="password" autocomplete="new-password" minlength="8" maxlength="128" ${currentLogin ? 'placeholder="Оставьте пустым, чтобы сохранить текущий"' : 'placeholder="Не менее 8 символов" required'}><button type="button" class="password-toggle" data-action="toggle-password" data-target="credential-password" aria-label="Показать пароль" aria-pressed="false">${I("eye")}</button></div><small>Передайте логин и демо-пароль сотруднику самостоятельно. Письмо не отправляется.</small></label><div class="info-box">Локальный доступ работает только в этом браузере. Для входа статус сотрудника должен быть «Активен».</div><div id="credential-error" role="alert"></div><div class="modal-actions">${btn("Отмена", "close")}<button class="btn primary" type="submit">Сохранить доступ</button></div></form>`,
    );
    document
      .getElementById("credential-form")
      .addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.currentTarget,
          values = new FormData(form),
          button = form.querySelector('[type="submit"]'),
          error = document.getElementById("credential-error");
        if (button.disabled) return;
        button.disabled = true;
        button.textContent = "Сохраняем…";
        try {
          await A.upsertCredential(
            form.dataset.id,
            values.get("login"),
            values.get("password"),
            u(),
            db.users,
          );
          userId = A.getSession(db.users);
          closeModal();
          render();
          toast(
            userId
              ? "Логин и пароль сохранены в демо"
              : "Данные входа изменены. Войдите снова.",
          );
        } catch (err) {
          error.innerHTML = `<div class="error-text">${E(err.message)}</div>`;
          button.disabled = false;
          button.textContent = "Сохранить доступ";
        }
      });
  }
  function nav() {
    const me = u(),
      n =
        me.role === "director"
          ? [
              ["overview", "Обзор компании", "grid"],
              ["finance", "Финансы", "wallet"],
              ["production", "Производство", "factory"],
              ["warehouse", "Склад и сырьё", "box"],
              ["reports", "Отчёты", "file"],
            ]
          : me.role === "admin"
            ? [
                ["team", "Сотрудники", "users"],
                ["access", "Роли и доступы", "shield"],
                ["settings", "Настройки", "settings"],
              ]
            : [
                ["daily", "Мой рабочий день", "grid"],
                ["reports", "Мои отчёты", "file"],
              ];
    return n
      .map(
        ([id, label, ic]) =>
          `<button class="nav-link ${view === id ? "active" : ""}" data-action="nav" data-view="${id}">${I(ic)}${label}${id === "reports" && db.reports.filter((r) => r.status === "submitted" && (me.role === "director" || r.dept === me.dept)).length ? `<span class="count">${db.reports.filter((r) => r.status === "submitted" && (me.role === "director" || r.dept === me.dept)).length}</span>` : ""}</button>`,
      )
      .join("");
  }
  function render() {
    if (!u()) {
      login();
      return;
    }
    const me = u();
    app.innerHTML = `<div class="app-layout ${me.role === "staff" ? "staff-mode" : ""}"><div class="mobile-backdrop" data-action="toggle-menu"></div><aside class="sidebar" id="sidebar">${brand()}<div class="workspace"><span class="company">ТМ</span><div><strong>Та-мак</strong><small>Производственная компания</small></div></div><p class="nav-label">РАБОЧЕЕ ПРОСТРАНСТВО</p><nav aria-label="Основная навигация">${nav()}</nav><div class="nav-secondary"><p class="nav-label">УПРАВЛЕНИЕ</p>${me.role !== "staff" ? `<button class="nav-link ${view === "journal" ? "active" : ""}" data-action="nav" data-view="journal">${I("clock")}Журнал действий</button>` : ""}<button class="nav-link" data-action="help">${I("help")}Помощь и инструкции</button></div><div class="sidebar-bottom"><div class="demo-info"><strong><span style="width:5px;height:5px;border-radius:50%;background:#c4a56c"></span> ДЕМОНСТРАЦИОННАЯ ВЕРСИЯ</strong><p>Синтетические данные.<br>Изменения сохраняются локально.</p></div><button class="profile" data-action="logout" aria-label="Выйти из аккаунта" title="Выйти из аккаунта"><span class="avatar">${initials(me.name)}</span><span><strong>${E(me.name)}</strong><small>${ROLES[me.role]}</small></span>${I("logout")}</button></div></aside><div class="main-wrap"><header class="topbar"><button class="icon-button mobile-menu" data-action="toggle-menu" aria-label="Открыть меню" aria-controls="sidebar" aria-expanded="false">${I("menu")}</button><div class="breadcrumb">Рабочее пространство<span>/</span><strong>${ROLES[me.role]}</strong></div><div class="top-actions">${themeButton()}<button class="search-button" data-action="global-search">${I("search")}<span>Найти отчёт...</span><span class="key">⌘ K</span></button><button class="icon-button" data-action="notifications" aria-label="Уведомления">${I("bell")}<i class="notification-dot"></i></button><span class="top-divider"></span><span class="avatar top-avatar">${initials(me.name)}</span></div></header><main class="page" id="main-content">${content()}<footer class="page-footer"><span>© 2026 Та-мак / ARZU · Рабочая концепция</span><button class="footer-link" data-action="about">Деморежим · Данные в этом браузере ${I("info")}</button></footer></main></div></div>`;
    bindPage();
    syncSidebar();
    const signature = userId + "|" + view;
    if (render.signature !== signature) window.scrollTo(0, 0);
    render.signature = signature;
  }
  function syncSidebar() {
    const sidebar = document.querySelector(".sidebar");
    if (!sidebar) return;
    const open = sidebar.classList.contains("open");
    sidebar.inert = window.matchMedia("(max-width: 700px)").matches && !open;
    document
      .querySelector(".mobile-menu")
      ?.setAttribute("aria-expanded", String(open));
  }
  window.addEventListener("resize", syncSidebar);
  function heading(title, desc, actions = "") {
    return `<div class="page-heading"><div><div class="eyebrow">${u().role === "director" ? "ОПЕРАЦИОННЫЙ КОНТРОЛЬ" : u().role === "admin" ? "АДМИНИСТРИРОВАНИЕ" : "ЕЖЕДНЕВНАЯ ОТЧЁТНОСТЬ"}</div><h1>${title}</h1><p>${desc}</p></div>${actions ? `<div class="heading-actions">${actions}</div>` : ""}</div>`;
  }
  function filters() {
    return `<div class="filters"><label class="filter-control">${I("calendar")}<select id="period-filter" aria-label="Период"><option value="month" ${from === "2026-10-01" && to === TODAY ? "selected" : ""}>1–25 октября 2026</option><option value="week" ${from === "2026-10-19" && to === TODAY ? "selected" : ""}>Последние 7 дней</option><option value="yesterday" ${from === "2026-10-24" && to === from ? "selected" : ""}>24 октября</option><option value="custom" ${!(((from === "2026-10-01" || from === "2026-10-19") && to === TODAY) || (from === "2026-10-24" && to === from)) ? "selected" : ""}>Выбрать период...</option></select></label><label class="filter-control">${I("factory")}<select id="dept-filter" aria-label="Подразделение"><option value="all">Все подразделения</option>${Object.entries(
      DEPTS,
    )
      .map(
        ([v, t]) =>
          `<option value="${v}" ${dept === v ? "selected" : ""}>${t}</option>`,
      )
      .join(
        "",
      )}</select></label><span class="period-label">${date(from)} — ${date(to)}</span><span class="live-badge"><i class="dot"></i>Синтетические данные · на 25.10.2026</span></div>`;
  }
  function coverage(a) {
    return `<div class="coverage-strip">${I("info")}<span><strong>${a.approvedCount} из ${a.expectedCount} отчётов подтверждены</strong> · ${a.coverage < 100 ? "Показатели предварительные: есть непроверенные или отсутствующие данные." : "Данные выбранного периода полные."}</span><div class="coverage-track"><i style="width:${a.coverage}%"></i></div><button data-action="pending-reports">Проверить ${I("arrow")}</button></div>`;
  }
  function spark(key) {
    const rows = agg()
      .series.filter((r) => r[key] !== null)
      .map((r) => r[key]);
    if (!rows.length) return "";
    const min = Math.min(...rows) * 0.9,
      max = Math.max(...rows);
    return `<svg class="spark" viewBox="0 0 70 24" aria-hidden="true"><polyline points="${rows.map((v, i) => `${(i / Math.max(1, rows.length - 1)) * 70},${22 - ((v - min) / (max - min || 1)) * 19}`).join(" ")}" fill="none" stroke="#a9bff1" stroke-width="1.5"/></svg>`;
  }
  function kpi(label, value, unit, key, icon, note) {
    return `<button class="card kpi" data-action="metric" data-key="${key}"><span class="kpi-label">${label}${I(icon)}</span><div class="kpi-value">${compact(value)}<small>${unit}</small></div><div class="kpi-bottom"><span class="kpi-tag">${note}</span><span>${key === "balance" ? "на конец периода" : "подтв. данные"}</span>${spark(key)}</div></button>`;
  }
  function overview() {
    const a = stats();
    return (
      heading(
        "Обзор компании",
        "Воскресенье, 25 октября 2026 · Каждый показатель начинается с данных.",
        btn("Сравнить", "compare", "switch") +
          btn("Экспорт", "export", "download"),
      ) +
      filters() +
      coverage(a) +
      `<section class="kpi-grid" aria-label="Ключевые показатели">${kpi("Выручка от продаж", a.revenue, "₸", "revenue", "chart", "Продажи")}${kpi("Поступления денег", a.receipts, "₸", "receipts", "wallet", "Внешние платежи")}${kpi("Деньги компании", a.balance, "₸", "balance", "wallet", "Остаток")}${kpi("Выпуск продукции", a.output, "ед.", "output", "factory", "Производство")}</section><div class="analytics-grid">${financeChart(a)}${productionCard(a)}</div><div class="analytics-grid secondary-analytics">${productionDailyChart(a)}${paymentBreakdown()}</div><div class="bottom-grid"><section class="card">${reportsPreview()}</section>${attention(a)}</div>`
    );
  }
  function financeChart(a) {
    return `<section class="card"><div class="card-head"><div><h2>Финансовая динамика</h2><p>Выручка и движение денег · ${date(from)} — ${date(to)}</p></div><div class="segmented" aria-label="Вид графика"><button class="${chartType === "area" ? "active" : ""}" data-action="chart-type" data-type="area">Области</button><button class="${chartType === "line" ? "active" : ""}" data-action="chart-type" data-type="line">Линии</button><button class="${chartType === "bar" ? "active" : ""}" data-action="chart-type" data-type="bar">Столбцы</button></div></div><div class="chart-summary"><div><div class="small-label">ВЫРУЧКА ОТ ПРОДАЖ</div><strong>${compact(a.revenue)} <small>₸</small></strong></div><div><div class="small-label">ПОСТУПЛЕНИЯ</div><strong>${compact(a.receipts)} <small>₸</small></strong></div><div><div class="small-label">ВЫПЛАТЫ</div><strong>${compact(a.payments)} <small>₸</small></strong></div></div><div class="chart-wrap">${chartSVG(a.series)}</div><div class="chart-legend">${[
      ["revenue", "Выручка", "var(--chart-blue)"],
      ["receipts", "Поступления", "var(--chart-violet)"],
      ["payments", "Выплаты", "var(--chart-gold)"],
    ]
      .map(
        ([k, n, c]) =>
          `<button class="legend-item ${seriesOn[k] ? "" : "off"}" data-action="toggle-series" data-key="${k}" aria-pressed="${seriesOn[k]}"><span class="legend-dot" style="background:${c}"></span>${n}</button>`,
      )
      .join("")}</div></section>`;
  }
  function chartSVG(rows) {
    return C.financeSVG(rows, { type: chartType, seriesOn });
  }
  function productionDailyChart(a) {
    return C.productionCard(a.series, {
      dailyPlan: db.settings.dailyPlan,
      from,
      to,
    });
  }
  function paymentBreakdown() {
    return C.paymentsCard(currentReports(), { from, to });
  }
  function productionCard(a) {
    let count = currentReports().filter(
        (r) => r.dept === "production" && r.status === "approved",
      ).length,
      plan = D.rangeDays(from, to).length * db.settings.dailyPlan,
      ratio = plan && a.output !== null ? (a.output / plan) * 100 : null,
      defect = a.output ? (a.defects / a.output) * 100 : null;
    return `<section class="card production-card"><div class="card-head"><div><h2>Выполнение плана</h2><p>Выпуск продукции · Подтверждено дней: ${count}</p></div><span class="subtle-tag">План / факт</span></div><div class="production-ring-wrap"><div class="ring"><svg viewBox="0 0 130 130" aria-hidden="true"><circle cx="65" cy="65" r="55" stroke="#edf1f8" stroke-width="10" fill="none"/><circle cx="65" cy="65" r="55" stroke="#315fdf" stroke-width="10" fill="none" stroke-dasharray="${Math.min(ratio || 0, 100) * 3.456} 345.6" stroke-linecap="round"/></svg><div class="ring-value"><strong>${ratio === null ? "—" : num(ratio, 1) + "%"}</strong><small>от плана периода</small></div></div><div class="production-numbers"><div><span>Фактический выпуск</span><strong>${num(a.output)} <small>ед.</small></strong></div><div><span>Демо-план на период</span><strong>${num(plan)} <small>ед.</small></strong></div></div></div><div class="production-foot"><div><span>Доля брака</span><strong>${num(defect, 2)} <small>%</small></strong></div><div><span>Расход сырья</span><strong>${available("production") ? num(a.raw / 1000, 1) : "—"} <small>т</small></strong></div><div><span>Демо-порог брака</span><strong>${num(db.settings.defectLimit)} <small>%</small></strong></div></div><div class="production-mini" aria-hidden="true">${a.series.map((r) => `<i style="height:${r.output === null ? 2 : Math.max(4, (r.output / db.settings.dailyPlan) * 24)}px;${r.output === null ? "background:#eee" : ""}"></i>`).join("")}</div></section>`;
  }
  function reportsPreview() {
    let rows = Object.keys(DEPTS)
      .filter((d) => dept === "all" || dept === d)
      .map(
        (d) =>
          currentReports()
            .filter((r) => r.dept === d)
            .sort((a, b) => b.date.localeCompare(a.date))[0],
      )
      .filter(Boolean);
    return `<div class="card-head table-head"><div><h2>Отчёты подразделений</h2><p>Последние данные по каждому участку</p></div>${btn("Все отчёты", "all-reports", "arrow", "text small")}</div>${rows.length ? `<div class="table-container"><table><thead><tr><th>Подразделение</th><th>Дата</th><th>Ответственный</th><th>Статус</th><th></th></tr></thead><tbody>${rows.map((r) => `<tr class="clickable" data-action="report" data-id="${r.id}"><td>${deptName(r.dept)}</td><td class="muted">${dateShort(r.date)}</td><td class="muted">${E(r.author.split(" ")[0])}</td><td>${badge(r.status)}</td><td><button class="btn text small" data-action="report" data-id="${r.id}" aria-label="Открыть отчёт ${DEPTS[r.dept]}">${I("chevron")}</button></td></tr>`).join("")}</tbody></table></div>` : empty("В этом периоде отчётов нет")}`;
  }
  function attention(a) {
    let pending = currentReports().filter(
        (r) => r.status === "submitted",
      ).length,
      returned = currentReports().filter((r) => r.status === "returned").length;
    return `<section class="card"><div class="card-head"><h2>Требует внимания</h2><span class="subtle-tag">${(pending ? 1 : 0) + (returned ? 1 : 0) + (a.coverage < 100 ? 1 : 0)} задачи</span></div><div class="attention-list">${pending ? `<button class="attention-item" data-action="pending-reports"><span class="attention-icon">${I("clock")}</span><span><strong>Ожидают проверки: ${pending}</strong><small>Проверьте данные перед включением в сводку</small></span>${I("chevron")}</button>` : ""}${returned ? `<button class="attention-item" data-action="returned-reports"><span class="attention-icon red">${I("refresh")}</span><span><strong>Есть отчёты на уточнении</strong><small>Ответственным переданы замечания</small></span>${I("chevron")}</button>` : ""}<button class="attention-item" data-action="coverage"><span class="attention-icon blue">${I("file")}</span><span><strong>${a.coverage < 100 ? "Данные периода неполные" : "Все данные подтверждены"}</strong><small>${a.approvedCount} / ${a.expectedCount} отчётов · открыть контроль полноты</small></span>${I("chevron")}</button></div></section>`;
  }
  function reportRows() {
    const me = u();
    return currentReports()
      .filter(
        (r) =>
          (me.role !== "staff" || r.dept === me.dept) &&
          (statusFilter === "all" || r.status === statusFilter) &&
          (!search ||
            [DEPTS[r.dept], r.author, dateShort(r.date), r.id, r.comment]
              .join(" ")
              .toLowerCase()
              .includes(search.toLowerCase())),
      )
      .sort((a, b) =>
        sort === "desc"
          ? b.date.localeCompare(a.date)
          : a.date.localeCompare(b.date),
      );
  }
  function reportTable(rows) {
    return rows.length
      ? `<div class="table-container"><table><thead><tr><th>Отчёт / участок</th><th><button class="sort-button" data-action="sort">Рабочая дата ${I("sort")}</button></th><th>Ответственный</th><th>Показатель</th><th>Статус</th><th></th></tr></thead><tbody>${rows.map((r) => `<tr class="clickable" data-action="report" data-id="${r.id}"><td>${deptName(r.dept)}</td><td>${dateShort(r.date)}</td><td class="muted">${E(r.author)}</td><td>${r.noOperations ? "Без операций" : r.values[FIELDS[r.dept][0][0]] === null ? "—" : num(r.values[FIELDS[r.dept][0][0]]) + " " + FIELDS[r.dept][0][2]}</td><td>${badge(r.status)}</td><td><button class="btn text small" data-action="report" data-id="${r.id}" aria-label="Открыть отчёт">${I("chevron")}</button></td></tr>`).join("")}</tbody></table></div>`
      : empty("Отчёты не найдены");
  }
  function reports() {
    const rows = reportRows(),
      me = u();
    return (
      heading(
        me.role === "staff" ? "Мои отчёты" : "Реестр отчётов",
        "От черновика до подтверждённых данных. Все изменения сохраняются в истории.",
        me.role === "staff"
          ? btn("Заполнить отчёт", "new-report", "plus", "primary")
          : btn("Экспорт CSV", "export", "download"),
      ) +
      (me.role === "director"
        ? filters()
        : `<div class="filters"><span class="filter-control">${deptIcon(me.dept)} ${DEPTS[me.dept]} · октябрь 2026</span></div>`) +
      `<section class="card"><div class="table-tools"><label class="input-search">${I("search")}<input id="report-search" value="${E(search)}" placeholder="Участок, автор или дата..." aria-label="Поиск отчётов"></label><select class="select" id="status-filter" aria-label="Статус отчёта"><option value="all">Все статусы</option>${["submitted", "approved", "returned", "draft"].map((s) => `<option value="${s}" ${statusFilter === s ? "selected" : ""}>${STATUS[s]}</option>`).join("")}</select><span class="muted" id="report-count" style="font-size:10px">Найдено: ${rows.length}</span></div><div id="report-results">${reportTable(rows)}</div><div class="table-caption">Все записи — синтетические · Отсутствующий отчёт не означает ноль операций</div></section>`
    );
  }
  function finances() {
    const a = stats();
    return (
      heading(
        "Финансы",
        "Продажи, движение денег и дебиторская задолженность.",
        btn("Сравнить периоды", "compare", "switch") +
          btn("Экспорт CSV", "export", "download"),
      ) +
      filters() +
      coverage(a) +
      `<div class="kpi-grid">${kpi("Выручка", a.revenue, "₸", "revenue", "chart", "Продажи")}${kpi("Поступления", a.receipts, "₸", "receipts", "wallet", "Внешние")}${kpi("Выплаты", a.payments, "₸", "payments", "wallet", "Внешние")}${kpi("Остаток денег", a.balance, "₸", "balance", "wallet", "На дату")}</div><div class="analytics-grid">${financeChart(a)}${paymentBreakdown()}</div><section class="card section-gap"><div class="card-head table-head"><div><h2>Долги клиентов</h2><p>Отдельные демонстрационные счета · Срез на 25 октября 2026</p></div><span class="subtle-tag">${money(db.invoices.reduce((s, i) => s + i.amount - i.paid, 0))}</span></div><div class="table-container"><table><thead><tr><th>Клиент / счёт</th><th>Продажа</th><th>Оплачено</th><th>Остаток долга</th><th>Срок оплаты</th><th>Статус</th></tr></thead><tbody>${db.invoices.map((i) => `<tr><td><strong>${E(i.client)}</strong><br><small class="muted">${i.id}</small></td><td>${money(i.amount)}</td><td>${money(i.paid)}</td><td>${money(i.amount - i.paid)}</td><td>${dateShort(i.dueDate)}</td><td>${i.dueDate < TODAY ? '<span class="badge returned">Просрочен</span>' : '<span class="badge approved">По графику</span>'}</td></tr>`).join("")}</tbody></table></div></section><div class="info-box">${I("info")} Прибыль не рассчитывается: методика себестоимости и финансового результата требует согласования. Внутренние переводы не входят во внешние поступления и выплаты. Долги показаны отдельным срезом счетов и не пересчитываются фильтром периода.</div>`
    );
  }
  function production() {
    const a = stats(),
      rows = currentReports().filter((r) => r.dept === "production");
    return (
      heading(
        "Производство",
        "Выпуск, расход сырья и качество продукции.",
        btn("Экспорт CSV", "export", "download"),
      ) +
      filters() +
      coverage(a) +
      `<div class="analytics-grid">${productionCard(a)}<section class="card full-card"><h2 class="section-title">Контроль качества</h2><p class="section-desc">Доля брака по подтверждённым дням. Пороги демонстрационные.</p>${
        a.series
          .filter((r) => r.hasProduction)
          .slice(-6)
          .map((r) => {
            const pct = r.output ? (r.defects / r.output) * 100 : null;
            return `<button class="stat-row" style="width:100%;background:transparent;text-align:left" data-action="chart-day" data-date="${r.date}"><span>${date(r.date)}</span><span style="flex:1;margin:0 18px"><span class="mini-progress"><i style="width:${Math.min(((pct || 0) / 4) * 100, 100)}%;${pct > db.settings.defectLimit ? "background:#ce9a63" : ""}"></i></span></span><strong class="${pct > db.settings.defectLimit ? "metric-warning" : ""}">${num(pct, 2)} %</strong></button>`;
          })
          .join("") || empty("Нет подтверждённых данных")
      }</section></div><div class="section-gap">${productionDailyChart(a)}</div><section class="card"><div class="card-head table-head"><h2>Исходные отчёты производства</h2><span class="subtle-tag">${rows.length} записей</span></div>${reportTable(rows.sort((a, b) => b.date.localeCompare(a.date)))}</section>`
    );
  }
  function warehouse() {
    const a = agg(),
      rows = currentReports()
        .filter((r) => r.dept === "warehouse")
        .sort((a, b) => b.date.localeCompare(a.date)),
      last = db.reports
        .filter(
          (r) =>
            r.dept === "warehouse" && r.status === "approved" && r.date <= to,
        )
        .sort((a, b) => b.date.localeCompare(a.date))[0],
      approved = rows.filter((r) => r.status === "approved");
    return (
      heading(
        "Склад и сырьё",
        "Фактические остатки и движение материалов.",
        btn("Экспорт CSV", "export", "download"),
      ) +
      filters() +
      `<div class="kpi-grid">${kpi("Остаток сырья", a.stock, "кг", "stock", "box", last ? date(last.date) : "Нет среза")}${kpi("Поступило за период", approved.length ? approved.reduce((s, r) => s + r.values.received, 0) : null, "кг", "received", "download", "По отчётам")}${kpi("Выдано в производство", approved.length ? approved.reduce((s, r) => s + r.values.issued, 0) : null, "кг", "issued", "upload", "По отчётам")}${kpi("Минимальный запас", db.settings.stockMin, "кг", "stock", "alert", "Демо-порог")}</div><div class="info-box ${a.stock !== null && a.stock < db.settings.stockMin ? "amber" : ""}">${I("info")} Остаток — последний подтверждённый фактический срез ${last ? "за " + date(last.date) : ""}. Остатки разных дней не складываются. Поступления и выдача — потоки за выбранный период.</div><section class="card"><div class="card-head table-head"><h2>Движение сырья</h2><span class="subtle-tag">Условное сырьё А · кг</span></div><div class="table-container"><table><thead><tr><th>Дата</th><th>Поступление, кг</th><th>Выдача, кг</th><th>Остаток, кг</th><th>Статус</th><th></th></tr></thead><tbody>${rows.map((r) => `<tr class="clickable" data-action="report" data-id="${r.id}"><td>${dateShort(r.date)}</td><td>${num(r.values.received)}</td><td>${num(r.values.issued)}</td><td><strong>${num(r.values.stock)}</strong></td><td>${badge(r.status)}</td><td>${btn("Открыть", "report", "chevron", "text small", `data-id="${r.id}"`)}</td></tr>`).join("")}</tbody></table>${rows.length ? "" : empty("Нет складских отчётов")}</div></section>`
    );
  }
  function daily() {
    const me = u(),
      r = db.reports.find(
        (x) => x.dept === me.dept && x.date === (daily.date || TODAY),
      ),
      locked =
        r &&
        (["submitted", "approved"].includes(r.status) ||
          (r.authorId ? r.authorId !== me.id : r.author !== me.name));
    formFiles = r?.files ? [...r.files] : [];
    formDirty = false;
    return (
      heading(
        "Мой рабочий день",
        `${E(me.name)} · ${DEPTS[me.dept]}`,
        btn("Мои отчёты", "all-reports", "file"),
      ) +
      `<div class="form-grid"><section class="card full-card daily-card"><div class="form-meta"><div><h2 class="section-title">Ежедневный отчёт</h2><span class="muted" style="font-size:10px">${DEPTS[me.dept]} · ${FIELDS[me.dept].length} показателя</span></div>${r ? badge(r.status) : '<span class="badge draft">Новый отчёт</span>'}</div>${r?.status === "returned" ? `<div class="info-box amber"><strong>Отчёт возвращён на уточнение</strong><br>${E(r.history.at(-1).action)}</div>` : ""}${locked ? `<div class="info-box">${(r.authorId ? r.authorId !== me.id : r.author !== me.name) ? "Отчёт этого участка за выбранный день создан другим ответственным. Его редактирование недоступно." : r.status === "approved" ? "Отчёт подтверждён и включён в показатели. Его изменение заблокировано." : "Отчёт отправлен руководителю. Дождитесь проверки."}</div>` : ""}<form id="daily-form" data-locked="${!!locked}" novalidate><label class="field" style="max-width:240px;margin-bottom:24px"><span>Рабочая дата</span><input type="date" id="work-date" name="date" value="${daily.date || TODAY}" min="2026-10-01" max="${TODAY}" required></label><div class="field-grid">${FIELDS[me.dept].map(([k, n, unit]) => `<label class="field"><span>${n} <span class="muted">*</span></span><div class="field-unit"><input type="number" inputmode="decimal" name="${k}" min="0" step="${unit === "ед." ? "1" : "0.01"}" max="1000000000000" placeholder="0" value="${r?.values?.[k] ?? ""}" ${locked ? "disabled" : ""} ${r?.noOperations ? "disabled" : ""} required><em>${unit}</em></div></label>`).join("")}</div><label class="check-label"><input type="checkbox" name="noOperations" ${r?.noOperations ? "checked" : ""} ${locked ? "disabled" : ""}><span>Операций за день не было<br><small class="muted">Явное подтверждение, что нулевые значения корректны</small></span></label>${me.dept === "finance" ? '<div class="info-box">Выплаты включают операционные расходы. Внутренние переводы указываются отдельно и не влияют на остаток денег компании.</div>' : ""}<hr class="form-divider"><label class="field"><span>Комментарий</span><textarea name="comment" placeholder="Особенности дня, причины отклонений..." maxlength="2000" ${locked ? "disabled" : ""}>${E(r?.comment || "")}</textarea></label>${r?.status === "returned" ? '<label class="field" style="margin-top:18px"><span>Причина исправления *</span><textarea name="reason" placeholder="Что изменено и почему" required></textarea></label>' : ""}<hr class="form-divider"><h3 style="font-size:11px;margin:0 0 12px">Подтверждающие документы</h3>${locked ? "" : `<div class="upload-options"><label class="upload-choice">${I("camera")}<strong>Сфотографировать</strong><small>Документ или показания</small><input type="file" id="camera-attachment" accept="image/*" capture="environment"></label><label class="upload-choice">${I("paperclip")}<strong>Выбрать файл</strong><small>Фото, Excel, CSV или PDF</small><input type="file" id="attachments" accept=".xlsx,.xls,.csv,.pdf,image/*" multiple></label></div><div class="upload-hint">До 10 МБ на файл · не более 20 вложений</div>`}<div id="file-list">${filesHTML(formFiles, !locked)}</div><div class="local-note">${I("info")} Файлы хранятся в этом браузере. Автоимпорт из Excel не подключён.</div><div id="form-error" role="alert"></div><div class="form-actions"><span class="auto-save" id="save-state">${I("save")}${locked ? "Отчёт доступен для просмотра" : r?.status === "draft" ? "Черновик сохранён" : "Автосохранение черновика"}</span>${locked ? btn("Открыть отчёт", "report", "eye", "", `data-id="${r.id}"`) : `<button type="button" class="btn" data-action="save-draft">${I("save")}Сохранить черновик</button><button type="submit" class="btn primary">${I("arrow")}Отправить на проверку</button>`}</div></form></section><aside><section class="card full-card section-gap"><h2 class="section-title">Как это работает</h2><p class="section-desc">Один отчёт — один рабочий день.</p><ol class="timeline"><li><strong>Заполните показатели участка</strong><small>Неизвестные значения оставьте в черновике.</small></li><li><strong>Добавьте пояснения и файлы</strong><small>Для отклонений укажите причину.</small></li><li><strong>Отправьте руководителю</strong><small>После подтверждения данные попадут в сводку.</small></li></ol></section><section class="card full-card"><h2 class="section-title">Последние отчёты</h2>${db.reports
        .filter((x) => x.dept === me.dept)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 4)
        .map(
          (r) =>
            `<button class="stat-row" style="width:100%;background:transparent;text-align:left" data-action="report" data-id="${r.id}"><span>${date(r.date)}</span>${badge(r.status)}</button>`,
        )
        .join("")}</section></aside></div>`
    );
  }
  function filesHTML(files, editable = false) {
    return files
      .map(
        (f) =>
          `<div class="file-item">${I("paperclip")}<span>${E(f.name)} <small class="muted">${f.size ? num(f.size / 1024, 1) + " КБ" : ""}</small></span><button type="button" data-action="download-file" data-id="${E(f.id)}" aria-label="Скачать ${E(f.name)}">${I("download")}</button>${editable ? `<button type="button" data-action="remove-file" data-id="${E(f.id)}" aria-label="Убрать файл">${I("close")}</button>` : ""}</div>`,
      )
      .join("");
  }
  function team() {
    return (
      heading(
        "Сотрудники",
        "Команда и распределение ответственности по участкам.",
        btn("Добавить сотрудника", "add-user", "plus", "primary"),
      ) +
      `<div class="info-box">${I("shield")} Управление сотрудниками в демо локальное. Логин и пароль настраиваются кнопкой «Доступ». Приглашения по почте не отправляются.</div><section class="card"><div class="table-tools"><label class="input-search">${I("search")}<input id="team-search" placeholder="Найти сотрудника..." aria-label="Поиск сотрудников"></label><span class="muted" style="font-size:10px">${db.users.length} пользователей</span></div><div class="table-container"><table><thead><tr><th>Сотрудник</th><th>Роль</th><th>Участок</th><th>Статус</th><th></th></tr></thead><tbody id="team-results">${teamRows(db.users)}</tbody></table></div></section>`
    );
  }
  function teamRows(users) {
    return users
      .map(
        (x) =>
          `<tr><td><div style="display:flex;align-items:center;gap:10px"><span class="avatar">${initials(x.name)}</span><div><strong>${E(x.name)}</strong><br><small class="muted">${E(x.email)}</small></div></div></td><td>${ROLES[x.role]}<br><small class="muted">Логин: ${E(A.getLogin(x.id) || "не настроен")}</small></td><td class="muted">${DEPTS[x.dept] || (x.role === "director" ? "Все участки" : "Управление доступом")}</td><td>${badge(x.status)}</td><td>${btn("Изменить", "edit-user", "settings", "text small", `data-id="${x.id}"`)} ${btn("Доступ", "credentials", "shield", "text small", `data-id="${x.id}"`)}</td></tr>`,
      )
      .join("");
  }
  function access() {
    return (
      heading(
        "Роли и доступы",
        "Права привязаны к роли и участку сотрудника.",
      ) +
      `<div class="info-box">${I("info")} Вход по логину и паролю и правила доступа проверяются в браузере. Серверная авторизация пока не реализована.</div><section class="card section-gap"><div class="card-head table-head"><h2>Матрица доступа</h2><span class="subtle-tag">3 роли</span></div><div class="table-container"><table class="permissions"><thead><tr><th>Действие</th><th>Руководитель</th><th>Администратор</th><th>Сотрудник</th></tr></thead><tbody>${[
        ["Просмотр финансов и общей сводки", 1, 0, 0],
        ["Ввод отчёта своего участка", 0, 0, 1],
        ["Исправление возвращённого отчёта", 0, 0, 1],
        ["Подтверждение и возврат отчётов", 1, 0, 0],
        ["Управление сотрудниками и ролями", 0, 1, 0],
        ["Демо-планы и пороги", 0, 1, 0],
        ["Журнал системных событий", 1, 1, 0],
      ]
        .map(
          ([n, ...v]) =>
            `<tr><td>${n}</td>${v.map((x) => `<td class="${x ? "permission-check" : "permission-cross"}">${I(x ? "check" : "close")}</td>`).join("")}</tr>`,
        )
        .join(
          "",
        )}</tbody></table></div></section><section class="card full-card"><h2 class="section-title">Назначение доступа</h2><p class="section-desc">У каждого сотрудника один ответственный участок. Измените роль или участок в карточке сотрудника.</p>${btn("Перейти к сотрудникам", "nav", "users", "", 'data-view="team"')}</section>`
    );
  }
  function settings() {
    return (
      heading(
        "Настройки платформы",
        "Демонстрационные ориентиры для контроля показателей.",
      ) +
      `<div class="two-col"><section class="card full-card"><h2 class="section-title">Планы и контрольные пороги</h2><p class="section-desc">Значения условные. Реальные планы и допуски нужно согласовать с заказчиком.</p><form id="settings-form"><label class="field" style="margin-bottom:18px"><span>План выпуска в день, ед.</span><input type="number" name="dailyPlan" min="1" step="1" value="${db.settings.dailyPlan}" required></label><label class="field" style="margin-bottom:18px"><span>Порог доли брака, %</span><input type="number" name="defectLimit" min="0.01" max="100" step="0.01" value="${db.settings.defectLimit}" required></label><label class="field"><span>Минимальный запас сырья, кг</span><input type="number" name="stockMin" min="0" step="1" value="${db.settings.stockMin}" required></label><div class="form-actions"><button class="btn primary" type="submit">${I("save")}Сохранить настройки</button></div></form></section><aside><section class="card full-card section-gap"><h2 class="section-title">Источники данных</h2><div class="stat-row"><span>Ежедневные формы</span><strong><span class="status-dot"></span>Работают в демо</strong></div><div class="stat-row"><span>Excel / CSV</span><strong>Вложения к отчётам</strong></div><div class="stat-row"><span>Обмен с 1С</span><strong class="muted">Не подключён</strong></div><p class="section-desc" style="margin-top:17px;margin-bottom:0">Формат обмена и версия 1С пока неизвестны. Подключение не имитируется.</p></section><section class="card full-card"><h2 class="section-title">Демонстрационные данные</h2><p class="section-desc">Можно восстановить исходные записи. Это удалит локальные изменения и вложения.</p>${btn("Восстановить демоданные", "reset", "refresh", "danger")}</section></aside></div>`
    );
  }
  function journal() {
    return (
      heading(
        "Журнал действий",
        "Кто, когда и что изменил · время Алматы (UTC+5).",
      ) +
      `<section class="card full-card">${
        db.events
          .slice()
          .sort((a, b) => b.at.localeCompare(a.at))
          .map(
            (ev) =>
              `<div class="journal-item"><span class="dept-icon ${ev.type === "returned" ? "warehouse" : ""}">${I(ev.type === "approved" ? "check" : ev.type === "returned" ? "refresh" : "clock")}</span><div><strong>${E(ev.action)}</strong><p>${E(ev.detail || "")}</p><small>${E(actorName(ev.actor, ev.actorId))} · ${time(ev.at)}</small></div>${ev.reportId && u().role === "director" ? btn("Отчёт", "report", "chevron", "text small", `data-id="${ev.reportId}"`) : ""}</div>`,
          )
          .join("") || empty("Журнал пока пуст")
      }</section>`
    );
  }
  function content() {
    const map = {
      overview,
      finance: finances,
      production,
      warehouse,
      reports,
      daily,
      team,
      access,
      settings,
      journal,
    };
    const allowed =
      u().role === "director"
        ? [
            "overview",
            "finance",
            "production",
            "warehouse",
            "reports",
            "journal",
          ]
        : u().role === "admin"
          ? ["team", "access", "settings", "journal"]
          : ["daily", "reports"];
    if (!allowed.includes(view)) view = allowed[0];
    return map[view]();
  }
  function closeModal() {
    overlay.innerHTML = "";
    document.querySelector(".tooltip")?.remove();
    document.body.style.overflow = "";
    modalReturnFocus?.focus?.();
  }
  function modal(title, body, actions = "", wide = false) {
    modalReturnFocus = document.activeElement;
    overlay.innerHTML = `<div class="overlay"><section class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-label="${E(title)}"><div class="modal-heading"><h2>${title}</h2><button class="icon-button" data-action="close" aria-label="Закрыть">${I("close")}</button></div>${body}${actions ? `<div class="modal-actions">${actions}</div>` : ""}</section></div>`;
    document.body.style.overflow = "hidden";
    setTimeout(
      () => overlay.querySelector("input,select,textarea,button")?.focus(),
      0,
    );
  }
  function showReport(id) {
    const r = db.reports.find((x) => x.id === id),
      me = u();
    if (
      !r ||
      me.role === "admin" ||
      (me.role === "staff" && r.dept !== me.dept)
    ) {
      toast("Этот отчёт недоступен для выбранной роли.");
      return;
    }
    modalReturnFocus = document.activeElement;
    overlay.innerHTML = `<div class="overlay drawer-overlay"><section class="drawer" role="dialog" aria-modal="true" aria-label="Детали отчёта"><div class="modal-heading"><div><div class="eyebrow">ИСХОДНЫЕ ДАННЫЕ</div><h2>${DEPTS[r.dept]}</h2><p>Отчёт за ${dateShort(r.date)}</p></div><button class="icon-button" data-action="close" aria-label="Закрыть">${I("close")}</button></div><div style="display:flex;justify-content:space-between;align-items:center">${badge(r.status)}<span class="report-id">${E(r.id)}</span></div><div class="detail-values">${FIELDS[r.dept].map(([k, n, un]) => `<div class="stat-row"><span>${n}</span><strong>${num(r.values[k])} ${un}</strong></div>`).join("")}</div>${r.noOperations ? '<div class="info-box">Ответственный подтвердил: операций за день не было.</div>' : ""}<div class="stat-row"><span>Ответственный</span><strong>${E(r.author)}</strong></div>${r.comment ? `<div style="margin:20px 0"><div class="eyebrow">КОММЕНТАРИЙ</div><p style="font-size:11px;color:#7e8b9e;line-height:1.8">${E(r.comment)}</p></div>` : ""}${r.returnReason ? `<div class="info-box amber"><strong>Причина возврата</strong><br>${E(r.returnReason)}</div>` : ""}${r.files.length ? `<h3 style="font-size:12px;margin-top:24px">Вложения</h3>${filesHTML(r.files)}` : ""}${me.role === "director" && r.status === "submitted" ? `<div class="drawer-actions">${btn("Вернуть на уточнение", "return", "refresh", "", `data-id="${r.id}"`)}${btn("Принять отчёт", "approve", "check", "primary", `data-id="${r.id}"`)}</div>` : ""}${me.role === "staff" && ["draft", "returned"].includes(r.status) && (r.authorId ? r.authorId === me.id : r.author === me.name) ? `<div class="drawer-actions">${btn(r.status === "returned" ? "Исправить отчёт" : "Продолжить заполнение", "edit-report", "file", "primary", `data-date="${r.date}"`)}</div>` : ""}<hr class="form-divider"><h3 style="font-size:12px">История отчёта</h3><ol class="timeline">${r.history
      .slice()
      .reverse()
      .map(
        (h) =>
          `<li><strong>${E(h.action)}</strong><small>${E(actorName(h.actor, h.actorId))} · ${time(h.at)}</small>${h.reason ? `<div class="history-change">Причина: ${E(h.reason)}</div>` : ""}${
            h.oldValues && h.newValues
              ? FIELDS[r.dept]
                  .filter(([k]) => h.oldValues[k] !== h.newValues[k])
                  .map(
                    ([k, n, un]) =>
                      `<div class="history-change">${n}: ${num(h.oldValues[k])} → ${num(h.newValues[k])} ${un}</div>`,
                  )
                  .join("")
              : ""
          }</li>`,
      )
      .join("")}</ol></section></div>`;
    document.body.style.overflow = "hidden";
    overlay.querySelector("button")?.focus();
  }
  function dayDetails(d) {
    const rows = db.reports.filter(
      (r) => r.date === d && (dept === "all" || dept === r.dept),
    );
    modal(
      `${date(d)} · исходные записи`,
      `<p>Непроверенные записи не включены в показатели.</p>${rows.map((r) => `<button class="stat-row" style="width:100%;background:transparent;text-align:left;gap:10px" data-action="report" data-id="${r.id}"><span style="color:#445975">${DEPTS[r.dept]}<small style="display:block;color:#9ba6b4;margin-top:5px">${FIELDS[r.dept].map(([k, n, un]) => `${n}: ${num(r.values[k])} ${un}`).join(" · ")}</small></span>${badge(r.status)}</button>`).join("") || empty("За этот день отчётов нет", "Пропуск не считается нулём.")}`,
      btn("Закрыть", "close"),
    );
  }
  function metricDetails(key) {
    const maps = {
        revenue: ["Выручка от продаж", "sales", "revenue", "₸"],
        receipts: ["Поступления денег", "finance", "receipts", "₸"],
        payments: ["Внешние выплаты", "finance", "payments", "₸"],
        output: ["Выпуск продукции", "production", "output", "ед."],
        balance: ["Остаток денег", "finance", null, "₸"],
        stock: ["Остаток сырья", "warehouse", "stock", "кг"],
        received: ["Поступление сырья", "warehouse", "received", "кг"],
        issued: ["Выдача сырья", "warehouse", "issued", "кг"],
      },
      [title, d, field, unit] = maps[key] || maps.revenue;
    let rows = db.reports
      .filter(
        (r) =>
          r.dept === d &&
          r.status === "approved" &&
          r.date <= to &&
          (["balance", "stock"].includes(key) || r.date >= from) &&
          (dept === "all" || dept === d || ["balance", "stock"].includes(key)),
      )
      .sort((a, b) => b.date.localeCompare(a.date));
    if (key === "stock") rows = rows.slice(0, 1);
    const value =
      key === "balance"
        ? agg().balance
        : key === "stock"
          ? agg().stock
          : rows.length
            ? rows.reduce((s, r) => s + (r.values[field] || 0), 0)
            : null;
    modal(
      title,
      `<div class="compare-box"><div><small>${key === "balance" || key === "stock" ? "Срез на " + date(to) : date(from) + " — " + date(to)}</small><strong>${num(value)} ${unit}</strong></div><div><small>Источник</small><strong style="font-size:15px">${DEPTS[d]}</strong></div></div><div class="info-box">${key === "balance" ? "Начальный остаток 8 400 000 ₸ + внешние поступления − внешние выплаты всех подтверждённых финансовых отчётов до выбранной даты. Внутренние переводы исключены." : key === "stock" ? "Последний подтверждённый фактический остаток. Ежедневные остатки не суммируются." : "Сумма показателя только из подтверждённых отчётов выбранного периода."}</div><div style="max-height:350px;overflow:auto">${rows.map((r) => `<button class="stat-row" style="width:100%;background:transparent;text-align:left" data-action="report" data-id="${r.id}"><span>${date(r.date)}<small style="display:block;color:#9ba6b4;margin-top:4px">${E(r.author)}</small></span><strong>${key === "balance" ? `${money(r.values.receipts)} / ${money(r.values.payments)}` : num(r.values[field]) + " " + unit} ${I("chevron")}</strong></button>`).join("") || empty("Нет подтверждённых данных")}</div>`,
      btn("Закрыть", "close"),
    );
  }
  function compare() {
    modal(
      "Сравнение периодов",
      `<p>Сравнение строится по тому же источнику подтверждённых данных. При неполных данных процент изменения скрыт.</p><div class="field-grid"><label class="field"><span>Период A: начало</span><input type="date" id="a-from" value="2026-10-01" max="${TODAY}"></label><label class="field"><span>Период A: конец</span><input type="date" id="a-to" value="2026-10-07" max="${TODAY}"></label><label class="field"><span>Период B: начало</span><input type="date" id="b-from" value="2026-10-08" max="${TODAY}"></label><label class="field"><span>Период B: конец</span><input type="date" id="b-to" value="2026-10-14" max="${TODAY}"></label></div><div id="comparison-result"></div>`,
      btn("Пересчитать", "compare-calc", "refresh", "primary"),
      true,
    );
    calculateCompare();
  }
  function calculateCompare() {
    const el = overlay.querySelector("#comparison-result");
    if (!el) return;
    const val = (id) => overlay.querySelector("#" + id).value,
      aFrom = val("a-from"),
      aTo = val("a-to"),
      bFrom = val("b-from"),
      bTo = val("b-to");
    if (![aFrom, aTo, bFrom, bTo].every((d) => /^2026-10-\d{2}$/.test(d))) {
      el.innerHTML =
        '<div class="error-text">Для сравнения выберите даты октября 2026.</div>';
      return;
    }
    const da = D.rangeDays(aFrom, aTo),
      dd = D.rangeDays(bFrom, bTo);
    if (!da.length || !dd.length || aTo > TODAY || bTo > TODAY) {
      el.innerHTML =
        '<div class="error-text">Укажите корректные периоды до 25 октября 2026.</div>';
      return;
    }
    const a = D.aggregate(db.reports, aFrom, aTo),
      b = D.aggregate(db.reports, bFrom, bTo),
      full = a.coverage === 100 && b.coverage === 100,
      same = da.length === dd.length;
    el.innerHTML = `<div class="compare-box"><div><small>Период A · ${da.length} дн.</small><strong>${a.approvedCount}/${a.expectedCount} отчётов</strong></div><div><small>Период B · ${dd.length} дн.</small><strong>${b.approvedCount}/${b.expectedCount} отчётов</strong></div></div>${!full || !same ? '<div class="info-box amber">Процент изменения не показан: ' + (!full ? "данные неполные." : "периоды разной длины.") + "</div>" : ""}<div class="table-container"><table><thead><tr><th>Показатель</th><th>Период A</th><th>Период B</th><th>Изменение</th></tr></thead><tbody>${[
      ["Выручка", "revenue", "₸"],
      ["Поступления", "receipts", "₸"],
      ["Выпуск", "output", "ед."],
    ]
      .map(
        ([n, k, un]) =>
          `<tr><td>${n}</td><td>${a.series.some((r) => r[k] !== null) ? num(a[k]) : "—"} ${un}</td><td>${b.series.some((r) => r[k] !== null) ? num(b[k]) : "—"} ${un}</td><td>${full && same && a[k] > 0 ? (b[k] >= a[k] ? "+" : "") + num(((b[k] - a[k]) / a[k]) * 100, 1) + " %" : "—"}</td></tr>`,
      )
      .join("")}</tbody></table></div>`;
  }
  function showCoverage() {
    const days = D.rangeDays(from, to),
      ds = dept === "all" ? Object.keys(DEPTS) : [dept],
      missing = [];
    days.forEach((day) =>
      ds.forEach((d) => {
        const r = db.reports.find((x) => x.date === day && x.dept === d);
        if (!r || r.status !== "approved") missing.push({ day, d, r });
      }),
    );
    modal(
      "Полнота данных",
      `<p>Пропущенные и непроверенные отчёты за ${date(from)} — ${date(to)}. Пропуски не заменяются нулями.</p>${missing.map(({ day, d, r }) => `<div class="stat-row"><span>${DEPTS[d]} · ${date(day)}</span>${r ? `<button class="btn text small" data-action="report" data-id="${r.id}">${badge(r.status)}</button>` : '<span class="badge draft">Не сдан</span>'}</div>`).join("") || empty("Все отчёты подтверждены", "Покрытие выбранного периода — 100%.")}`,
      btn("Закрыть", "close"),
    );
  }
  function userModal(id) {
    const x = db.users.find((x) => x.id === id);
    modal(
      x ? "Изменить сотрудника" : "Добавить сотрудника",
      `<form id="user-form" data-id="${x?.id || ""}"><label class="field"><span>Имя и фамилия</span><input name="name" value="${E(x?.name || "")}" placeholder="Имя Фамилия" required maxlength="160"></label><label class="field"><span>Электронная почта</span><input type="email" name="email" value="${E(x?.email || "")}" placeholder="name@company.kz" required></label><div class="field-grid"><label class="field"><span>Роль</span><select name="role">${Object.entries(
        ROLES,
      )
        .map(
          ([v, n]) =>
            `<option value="${v}" ${(x?.role || "staff") === v ? "selected" : ""}>${n}</option>`,
        )
        .join(
          "",
        )}</select></label><label class="field"><span>Участок сотрудника</span><select name="dept">${Object.entries(
        DEPTS,
      )
        .map(
          ([v, n]) =>
            `<option value="${v}" ${x?.dept === v ? "selected" : ""}>${n}</option>`,
        )
        .join(
          "",
        )}</select></label><label class="field full"><span>Статус</span><select name="status">${["active", "invited", "disabled"].map((s) => `<option value="${s}" ${(x?.status || "invited") === s ? "selected" : ""}>${STATUS[s]}</option>`).join("")}</select></label></div><div class="local-note">${I("info")} Это локальная запись. Письмо-приглашение не отправляется.</div><div id="user-error" role="alert"></div><div class="modal-actions">${btn("Отмена", "close")}<button class="btn primary" type="submit">Сохранить</button></div></form>`,
    );
  }
  function about() {
    modal(
      "О демонстрационной версии",
      `<p>ARZU — первая рабочая версия интерфейса компании «Та-мак». Финансовые и производственные записи, счета и планы синтетические. Имя руководителя — Ернар Отаров.</p><div class="info-box">Данные отчётов хранятся в localStorage, вложения — в IndexedDB текущего браузера. Вход по логину и паролю проверяется локально и не заменяет серверную авторизацию.</div><p>Реализованы ежедневные формы, черновики, проверка, возврат с причиной, история, фильтры, детализация, графики и локальное управление сотрудниками.</p><p>Перед рабочим запуском нужны серверная база, проверка прав на сервере, настоящие аккаунты, резервное копирование и согласованная методика финансов. Excel и 1С автоматически не подключены.</p><p>Демонстрационная рабочая дата зафиксирована: 25 октября 2026. Рабочее название и палитра ARZU требуют утверждения.</p>`,
      btn("Понятно", "close", "check", "primary"),
    );
  }
  function help() {
    modal(
      "Работа с платформой",
      `<ol class="timeline"><li><strong>Сотрудник заполняет день</strong><small>Войдите по логину своего участка. Заполните поля, добавьте файлы и сохраните черновик.</small></li><li><strong>Отправка на проверку</strong><small>Все обязательные поля должны быть заполнены. Дублирование даты и участка блокируется.</small></li><li><strong>Руководитель проверяет</strong><small>В реестре откройте отчёт и примите его либо верните с причиной.</small></li><li><strong>Показатели обновляются</strong><small>Сводка использует только подтверждённые данные. Карточки и дни графика раскрывают источники.</small></li><li><strong>Исправления видны в истории</strong><small>Вернувшийся отчёт редактирует его автор с указанием причины. Подтверждённый отчёт заблокирован.</small></li></ol><div class="local-note">${I("logout")} Для другого аккаунта выйдите через значок внизу меню и введите его логин и пароль.</div>`,
      btn("Понятно", "close", "check", "primary"),
    );
  }
  function exportCSV() {
    let rows = reportRows();
    if (view === "production")
      rows = rows.filter((r) => r.dept === "production");
    if (view === "warehouse") rows = rows.filter((r) => r.dept === "warehouse");
    if (view === "finance")
      rows = rows.filter((r) => ["sales", "finance"].includes(r.dept));
    const csvCell = (v) => {
      let t = String(v ?? "");
      if (/^[=+@\-\t\r]/.test(t)) t = "'" + t;
      return '"' + t.replace(/"/g, '""') + '"';
    };
    let lines = [
      [
        "Дата",
        "Участок",
        "Ответственный",
        "Статус",
        "Показатель",
        "Значение",
        "Ед.",
        "Комментарий",
      ],
    ];
    rows.forEach((r) =>
      FIELDS[r.dept].forEach(([k, n, un]) =>
        lines.push([
          r.date,
          DEPTS[r.dept],
          r.author,
          STATUS[r.status],
          n,
          r.values[k],
          un,
          r.comment,
        ]),
      ),
    );
    download(
      new Blob(
        ["\ufeff" + lines.map((r) => r.map(csvCell).join(";")).join("\r\n")],
        { type: "text/csv;charset=utf-8" },
      ),
      `ARZU-отчёты-${from}-${to}.csv`,
    );
    toast(`Экспортировано ${rows.length} отчётов с текущими фильтрами`);
  }
  function download(blob, name) {
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  let idb;
  function fileDB() {
    if (idb) return Promise.resolve(idb);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("arzu.attachments", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("files");
      req.onerror = () => reject(new Error("Хранилище файлов недоступно."));
      req.onsuccess = () => {
        idb = req.result;
        resolve(idb);
      };
    });
  }
  async function putFile(file) {
    const store = await fileDB(),
      id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const tx = store.transaction("files", "readwrite");
      tx.objectStore("files").put(file, id);
      tx.oncomplete = () =>
        resolve({ id, name: file.name, size: file.size, type: file.type });
      tx.onerror = () =>
        reject(
          new Error(
            "Не удалось сохранить файл. Возможно, хранилище браузера заполнено.",
          ),
        );
    });
  }
  async function getFile(id) {
    const store = await fileDB();
    return new Promise((resolve, reject) => {
      const req = store.transaction("files").objectStore("files").get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(new Error("Не удалось прочитать файл."));
    });
  }
  function payload() {
    const form = document.getElementById("daily-form");
    if (!form) return null;
    const data = new FormData(form),
      noOps = data.get("noOperations") === "on",
      values = {};
    FIELDS[u().dept].forEach(([k]) => {
      const input = form.elements.namedItem(k);
      values[k] = noOps ? 0 : input.value === "" ? null : Number(input.value);
    });
    return {
      date: data.get("date"),
      dept: u().dept,
      values,
      comment: data.get("comment"),
      reason: data.get("reason") || "",
      files: [...formFiles],
      noOperations: noOps,
    };
  }
  function saveDraft(explicit = false) {
    clearTimeout(draftTimer);
    draftTimer = null;
    const p = payload();
    if (!p || document.getElementById("daily-form").dataset.locked === "true")
      return;
    const existing = db.reports.find(
      (r) => r.date === p.date && r.dept === p.dept,
    );
    if (existing && ["approved", "submitted"].includes(existing.status)) return;
    if (existing?.status === "returned" && !p.reason && !explicit) {
      const label = document.getElementById("save-state");
      if (label) label.textContent = "Укажите причину исправления";
      return false;
    }
    try {
      S.saveDraft(p, u());
      db = S.get();
      formDirty = false;
      const label = document.getElementById("save-state");
      if (label) label.innerHTML = I("check") + "Черновик сохранён";
      if (explicit) toast("Черновик сохранён в этом браузере");
      document.getElementById("form-error").innerHTML = "";
      return true;
    } catch (err) {
      const el = document.getElementById("form-error");
      if (el) el.innerHTML = `<div class="error-text">${E(err.message)}</div>`;
      return false;
    }
  }
  function scheduleDraft() {
    formDirty = true;
    const label = document.getElementById("save-state");
    if (label) label.innerHTML = I("save") + "Сохраняем...";
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => saveDraft(), 500);
  }
  function bindPage() {
    const byId = (id) => document.getElementById(id);
    byId("period-filter")?.addEventListener("change", (e) => {
      let v = e.target.value;
      if (v === "custom") {
        modal(
          "Выбрать период",
          `<div class="field-grid"><label class="field"><span>С даты</span><input type="date" id="custom-from" value="${from}" max="${TODAY}"></label><label class="field"><span>По дату</span><input type="date" id="custom-to" value="${to}" max="${TODAY}"></label></div><div id="period-error"></div>`,
          btn("Применить", "set-period", "check", "primary"),
        );
        return;
      }
      from =
        v === "week"
          ? "2026-10-19"
          : v === "yesterday"
            ? "2026-10-24"
            : "2026-10-01";
      to = v === "yesterday" ? from : TODAY;
      render();
    });
    byId("dept-filter")?.addEventListener("change", (e) => {
      dept = e.target.value;
      render();
    });
    byId("status-filter")?.addEventListener("change", (e) => {
      statusFilter = e.target.value;
      render();
    });
    byId("report-search")?.addEventListener("input", (e) => {
      search = e.target.value;
      const rows = reportRows();
      byId("report-results").innerHTML = reportTable(rows);
      byId("report-count").textContent = "Найдено: " + rows.length;
    });
    byId("team-search")?.addEventListener("input", (e) => {
      const q = e.target.value.toLowerCase();
      byId("team-results").innerHTML = teamRows(
        db.users.filter((x) =>
          (x.name + " " + x.email + " " + ROLES[x.role])
            .toLowerCase()
            .includes(q),
        ),
      );
    });
    const form = byId("daily-form");
    form?.addEventListener("input", (e) => {
      if (e.target.id === "work-date") return;
      if (e.target.name === "noOperations") {
        FIELDS[u().dept].forEach(([k]) => {
          const input = form.elements.namedItem(k);
          input.disabled = e.target.checked;
          if (e.target.checked) {
            input.dataset.before = input.value;
            input.value = k === "stock" ? agg().stock || 0 : 0;
          } else input.value = input.dataset.before || "";
        });
      }
      scheduleDraft();
    });
    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      clearTimeout(draftTimer);
      if (uploadBusy) {
        toast("Дождитесь загрузки файлов.");
        return;
      }
      try {
        const r = S.submitReport(payload(), u());
        db = S.get();
        toast("Отчёт отправлен руководителю на проверку");
        render();
        showReport(r.id);
      } catch (err) {
        byId("form-error").innerHTML =
          `<div class="error-text">${E(err.message)}</div>`;
        toast(err.message);
        const firstEmpty = [...form.querySelectorAll("input[required]")].find(
          (input) => !input.disabled && !input.value,
        );
        firstEmpty?.focus();
      }
    });
    byId("work-date")?.addEventListener("change", (e) => {
      const chosen = e.target.value || TODAY;
      if (uploadBusy) {
        e.target.value = daily.date || TODAY;
        toast("Дождитесь сохранения вложений.");
        return;
      }
      if (formDirty) {
        const previous = daily.date || TODAY;
        e.target.value = previous;
        if (!saveDraft(true)) return;
        e.target.value = chosen;
      }
      daily.date = chosen;
      render();
    });
    const handleAttachment = async (e) => {
      if (uploadBusy) {
        toast("Дождитесь завершения загрузки.");
        e.target.value = "";
        return;
      }
      uploadBusy = true;
      const originForm = byId("daily-form"),
        originDate = originForm.elements.date.value,
        originUserId = userId;
      let draftSaved = false;
      const submitButton = byId("daily-form")?.querySelector('[type="submit"]');
      if (submitButton) submitButton.disabled = true;
      const saveLabel = byId("save-state");
      if (saveLabel) saveLabel.textContent = "Сохраняем вложения…";
      let count = 0;
      try {
        for (const f of e.target.files) {
          if (f.size > 10 * 1024 * 1024)
            throw new Error(`${f.name}: максимальный размер — 10 МБ.`);
          if (formFiles.length >= 20)
            throw new Error("Не более 20 файлов в отчёте.");
          if (
            !/\.(xlsx?|csv|pdf|png|jpe?g|webp|heic|heif)$/i.test(f.name) &&
            !f.type.startsWith("image/")
          )
            throw new Error("Этот формат файла не поддерживается.");
          const storedFile = await putFile(f);
          if (
            !originForm.isConnected ||
            originUserId !== userId ||
            originForm.elements.date.value !== originDate
          )
            throw new Error(
              "Форма изменилась. Прикрепите файл к нужному дню повторно.",
            );
          formFiles.push(storedFile);
          formDirty = true;
          count++;
        }
        byId("file-list").innerHTML = filesHTML(formFiles, true);
        draftSaved = saveDraft() === true;
        if (count)
          toast(
            draftSaved
              ? `Файлы и черновик сохранены: ${count}`
              : "Файл выбран. Заполните причину исправления и сохраните отчёт.",
          );
      } catch (err) {
        toast(err.message);
        if (originForm.isConnected) {
          const list = byId("file-list");
          if (list) list.innerHTML = filesHTML(formFiles, true);
          if (count) draftSaved = saveDraft() === true;
        }
      } finally {
        uploadBusy = false;
        if (submitButton) submitButton.disabled = false;
        if (saveLabel)
          saveLabel.textContent = draftSaved
            ? "Вложения и черновик сохранены"
            : formDirty
              ? "Нужно сохранить изменения"
              : "Автосохранение черновика";
        e.target.value = "";
      }
    };
    byId("attachments")?.addEventListener("change", handleAttachment);
    byId("camera-attachment")?.addEventListener("change", handleAttachment);
    byId("settings-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      if (
        run(() =>
          S.updateSettings(
            Object.fromEntries([...f].map(([k, v]) => [k, Number(v)])),
            u(),
          ),
        )
      ) {
        refresh();
        toast("Настройки сохранены");
      }
    });
    document.querySelectorAll(".chart-day").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        if (e.pointerType === "touch") return;
        const r = agg().series.find((r) => r.date === el.dataset.date);
        document.querySelector(".tooltip")?.remove();
        let tip = document.createElement("div");
        tip.className = "tooltip";
        tip.style.left = Math.min(e.clientX + 13, innerWidth - 200) + "px";
        tip.style.top = Math.max(10, e.clientY - 117) + "px";
        tip.innerHTML = `<strong>${date(r.date)}</strong>${[
          ["revenue", "Выручка"],
          ["receipts", "Поступления"],
          ["payments", "Выплаты"],
        ]
          .map(
            ([k, n]) =>
              `<div><span>${n}</span><span>${r[k] === null ? "нет данных" : money(r[k])}</span></div>`,
          )
          .join("")}<small>Нажмите, чтобы открыть записи</small>`;
        document.body.appendChild(tip);
      });
      el.addEventListener("pointerleave", () =>
        document.querySelector(".tooltip")?.remove(),
      );
    });
  }
  async function action(el, e) {
    const a = el.dataset.action;
    if (!a) return;
    e?.preventDefault();
    if (a === "close") {
      closeModal();
      return;
    }
    if (a === "toggle-theme") {
      T.toggle();
      return;
    }
    if (a === "login-help") {
      loginHelp();
      return;
    }
    if (a === "toggle-password") {
      const input = document.getElementById(el.dataset.target),
        show = input.type === "password";
      input.type = show ? "text" : "password";
      el.setAttribute("aria-label", show ? "Скрыть пароль" : "Показать пароль");
      el.setAttribute("aria-pressed", String(show));
      return;
    }
    if (!u()) return;
    if (
      [
        "nav",
        "logout",
        "all-reports",
        "new-report",
        "edit-report",
        "global-search",
        "report",
      ].includes(a)
    ) {
      if (uploadBusy) {
        toast("Дождитесь сохранения вложений.");
        return;
      }
      if (formDirty && !saveDraft(true)) return;
    }
    switch (a) {
      case "toggle-menu":
        document.querySelector(".sidebar").classList.toggle("open");
        document.querySelector(".mobile-backdrop").classList.toggle("open");
        syncSidebar();
        break;
      case "nav":
        if (draftTimer) saveDraft();
        view = el.dataset.view;
        search = "";
        statusFilter = "all";
        render();
        break;
      case "logout":
        if (draftTimer) saveDraft();
        A.signOut();
        userId = null;
        loginError = "";
        closeModal();
        render();
        break;
      case "credentials":
        credentialModal(el.dataset.id);
        break;
      case "about":
        about();
        break;
      case "help":
        help();
        break;
      case "all-reports":
        view = "reports";
        search = "";
        statusFilter = "all";
        render();
        break;
      case "pending-reports":
        view = "reports";
        search = "";
        statusFilter = "submitted";
        render();
        break;
      case "returned-reports":
        view = "reports";
        search = "";
        statusFilter = "returned";
        render();
        break;
      case "new-report":
        view = "daily";
        daily.date = TODAY;
        render();
        break;
      case "edit-report":
        closeModal();
        daily.date = el.dataset.date;
        view = "daily";
        render();
        break;
      case "report":
        document.querySelector(".tooltip")?.remove();
        showReport(el.dataset.id);
        break;
      case "chart-day":
        dayDetails(el.dataset.date);
        break;
      case "metric":
        metricDetails(el.dataset.key);
        break;
      case "coverage":
        showCoverage();
        break;
      case "toggle-series":
        seriesOn[el.dataset.key] = !seriesOn[el.dataset.key];
        render();
        break;
      case "chart-type":
        chartType = el.dataset.type;
        render();
        break;
      case "sort":
        sort = sort === "desc" ? "asc" : "desc";
        render();
        break;
      case "compare":
        compare();
        break;
      case "compare-calc":
        calculateCompare();
        break;
      case "set-period": {
        const f = overlay.querySelector("#custom-from").value,
          t = overlay.querySelector("#custom-to").value;
        if (
          !/^2026-10-\d{2}$/.test(f) ||
          !/^2026-10-\d{2}$/.test(t) ||
          !D.rangeDays(f, t).length ||
          t > TODAY
        ) {
          overlay.querySelector("#period-error").innerHTML =
            '<div class="error-text">Выберите корректный период с 1 по 25 октября 2026.</div>';
          break;
        }
        from = f;
        to = t;
        closeModal();
        render();
        break;
      }
      case "export":
        exportCSV();
        break;
      case "save-draft":
        saveDraft(true);
        break;
      case "remove-file":
        formDirty = true;
        formFiles = formFiles.filter((f) => f.id !== el.dataset.id);
        document.getElementById("file-list").innerHTML = filesHTML(
          formFiles,
          true,
        );
        saveDraft();
        break;
      case "download-file":
        try {
          const file = await getFile(el.dataset.id);
          if (!file) throw new Error("Файл не найден в этом браузере.");
          download(file, file.name);
        } catch (err) {
          toast(err.message);
        }
        break;
      case "approve": {
        const id = el.dataset.id;
        if (run(() => S.approve(id, u()))) {
          db = S.get();
          render();
          showReport(id);
          toast("Отчёт принят. Показатели обновлены.");
        }
        break;
      }
      case "return": {
        const id = el.dataset.id;
        modal(
          "Вернуть отчёт на уточнение",
          `<p>Ответственный увидит замечание и сможет исправить отчёт.</p><form id="return-form" data-id="${id}"><label class="field"><span>Причина возврата *</span><textarea name="reason" required maxlength="2000" placeholder="Укажите, что нужно проверить или исправить"></textarea></label><div id="return-error" role="alert"></div><div class="modal-actions">${btn("Отмена", "report", "", "", `data-id="${id}"`)}<button class="btn primary" type="submit">Вернуть на уточнение</button></div></form>`,
        );
        break;
      }
      case "add-user":
        userModal();
        break;
      case "edit-user":
        userModal(el.dataset.id);
        break;
      case "notifications": {
        if (u().role === "admin") {
          modal(
            "Системные уведомления",
            `<div class="info-box">Платформа работает в локальном деморежиме. Настоящих приглашений и подключённых внешних сервисов нет.</div><p>Последнее событие: ${E(db.events.at(0)?.action || "нет событий")}</p>`,
            btn("Журнал действий", "notification-journal", "clock", "primary"),
          );
          break;
        }
        let rows = db.reports.filter(
          (r) =>
            ["submitted", "returned"].includes(r.status) &&
            (u().role === "director" || r.dept === u().dept),
        );
        modal(
          "Центр уведомлений",
          rows
            .map(
              (r) =>
                `<button class="stat-row" style="width:100%;background:transparent;text-align:left;gap:10px" data-action="report" data-id="${r.id}"><span>${DEPTS[r.dept]} · ${date(r.date)}<small style="display:block;font-size:9px;margin-top:4px">${E(r.author)}</small></span>${badge(r.status)}</button>`,
            )
            .join("") ||
            empty("Новых уведомлений нет", "Все отчёты обработаны."),
          btn("Закрыть", "close"),
        );
        break;
      }
      case "notification-journal":
        closeModal();
        view = "journal";
        render();
        break;
      case "global-search":
        if (u().role === "admin") {
          view = "team";
          render();
          document.getElementById("team-search")?.focus();
        } else {
          view = "reports";
          search = "";
          statusFilter = "all";
          render();
          document.getElementById("report-search")?.focus();
        }
        break;
      case "reset":
        modal(
          "Восстановить демоданные?",
          `<p>Локальные отчёты, настройки, добавленные сотрудники и вложения будут удалены. Исходные демонстрационные записи восстановятся.</p>`,
          btn("Отмена", "close") +
            btn("Восстановить", "confirm-reset", "refresh", "danger"),
        );
        break;
      case "confirm-reset":
        try {
          if (u().role !== "admin")
            throw new Error("Нужна роль администратора.");
          clearTimeout(draftTimer);
          const store = await fileDB();
          await new Promise((resolve, reject) => {
            const tx = store.transaction("files", "readwrite");
            tx.objectStore("files").clear();
            tx.oncomplete = resolve;
            tx.onerror = reject;
          });
          localStorage.removeItem(S.KEY);
          db = S.load();
          A.reset();
          userId = null;
          closeModal();
          render();
          toast("Демоданные и доступы восстановлены. Войдите снова.");
        } catch (err) {
          toast("Не удалось сбросить данные: " + err.message);
        }
        break;
    }
  }
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (el) void action(el, e);
    else if (e.target.classList.contains("overlay")) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      if (u()) action({ dataset: { action: "global-search" } });
    }
    if (e.key === "Escape") {
      closeModal();
      document.querySelector(".sidebar")?.classList.remove("open");
      document.querySelector(".mobile-backdrop")?.classList.remove("open");
      syncSidebar();
    }
    if (
      (e.key === "Enter" || e.key === " ") &&
      (e.target.classList.contains("chart-day") ||
        e.target.classList.contains("production-day"))
    ) {
      e.preventDefault();
      action(e.target, e);
    }
    if (e.key === "Tab" && overlay.firstChild) {
      const focusable = [
          ...overlay.querySelectorAll("button,input,select,textarea,a[href]"),
        ].filter((x) => !x.disabled),
        first = focusable[0],
        last = focusable.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  });
  overlay.addEventListener("submit", (e) => {
    if (e.target.id === "return-form") {
      e.preventDefault();
      try {
        S.returnReport(
          e.target.dataset.id,
          new FormData(e.target).get("reason"),
          u(),
        );
        const id = e.target.dataset.id;
        db = S.get();
        render();
        showReport(id);
        toast("Отчёт возвращён автору с замечанием");
      } catch (err) {
        overlay.querySelector("#return-error").innerHTML =
          `<div class="error-text">${E(err.message)}</div>`;
      }
    }
    if (e.target.id === "user-form") {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target));
      if (e.target.dataset.id) data.id = e.target.dataset.id;
      try {
        const created = S.upsertUser(data, u());
        db = S.get();
        closeModal();
        render();
        toast("Сотрудник сохранён в демо");
        if (!data.id && u()?.role === "admin") credentialModal(created.id);
      } catch (err) {
        overlay.querySelector("#user-error").innerHTML =
          `<div class="error-text">${E(err.message)}</div>`;
      }
    }
  });
  window.addEventListener("pagehide", () => {
    if (formDirty) saveDraft();
  });
  window.addEventListener("storage", (e) => {
    if (e.key === S.KEY || e.key === "arzu.demo.credentials.v1") {
      db = S.load();
      try {
        userId = A.getSession(db.users);
      } catch (error) {
        userId = null;
        loginError = error.message;
      }
      clearTimeout(draftTimer);
      draftTimer = null;
      if (formDirty && u() && document.getElementById("daily-form")) {
        toast(
          "Данные обновлены в другой вкладке. Ваш ввод сохранён на экране; проверьте и сохраните отчёт.",
        );
        return;
      }
      render();
      toast("Данные изменены в другой вкладке. Форма обновлена.");
    }
  });
  render();
})();

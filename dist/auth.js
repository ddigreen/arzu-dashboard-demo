(function () {
  "use strict";

  // Browser-local demonstration accounts. This is not server authentication:
  // the browser owner can edit both the credentials and the current session.
  var CREDENTIALS_KEY = "arzu.demo.credentials.v1";
  var SESSION_KEY = "arzu.demo.session.v2";
  var ITERATIONS = 150000;
  var LOGIN_PATTERN = /^[a-z0-9._-]{3,40}$/;
  var INVALID_LOGIN = "Неверный логин или пароль.";
  // Public demo salts and hashes; demo passwords are documented in README.
  var DEFAULTS = [
    {
      userId: "u-dir",
      login: "ernar",
      salt: "d53426a6d39f5c351451a97db2d1738d",
      hash: "d1e88927974fe3723267f0f29bb3ff027976f3927fb9356462704754cf11d6b5",
      iterations: ITERATIONS,
    },
    {
      userId: "u-admin",
      login: "admin",
      salt: "9dc5ac5dd0b6990b3a9c64403ea5b94c",
      hash: "176ca97f1ca24b0468846312b24d4bb60dad040bb9c9de87de800ca9a268beb1",
      iterations: ITERATIONS,
    },
    {
      userId: "u-prod",
      login: "worker",
      salt: "47610f1d667d92edf2087f9ac854d1ff",
      hash: "4f58c22f1e58175314a7fe6793d70bcb242ab986c498ed03fbec7221e2bd25cc",
      iterations: ITERATIONS,
    },
    {
      userId: "u-wh",
      login: "sklad",
      salt: "fd62d433b3d5133000f923c7abb6b124",
      hash: "82890d226db1167ee56ad0a611e52e156663792f200daf9c287a667f9e124334",
      iterations: ITERATIONS,
    },
    {
      userId: "u-sales",
      login: "sales",
      salt: "e743d35fc8dacf116458cc9a8b08edc6",
      hash: "6f5ef85f655dca57f300d5ab0d2ccf736263a35a2b02eb4e753ac3bddaf220d6",
      iterations: ITERATIONS,
    },
    {
      userId: "u-fin",
      login: "finance",
      salt: "f41f06b97244eb06a4f6fad81eae9e22",
      hash: "2b08a916ec786c418ac665a8ec44f903cce00d330f7b81cf5ba6759550add94a",
      iterations: ITERATIONS,
    },
  ];

  function normalizeLogin(login) {
    return typeof login === "string" ? login.trim().toLowerCase() : "";
  }

  function findUser(users, id) {
    return Array.isArray(users)
      ? users.find(function (user) {
          return user && user.id === id;
        })
      : null;
  }

  function isActive(user) {
    return !!user && user.status === "active";
  }

  function saveCredentials(records) {
    try {
      window.localStorage.setItem(
        CREDENTIALS_KEY,
        JSON.stringify({ version: 1, credentials: records }),
      );
    } catch (_) {
      throw new Error(
        "Не удалось сохранить данные входа. Проверьте доступ к хранилищу браузера.",
      );
    }
  }

  function readCredentials() {
    var raw;
    try {
      raw = window.localStorage.getItem(CREDENTIALS_KEY);
    } catch (_) {
      throw new Error(
        "Не удалось прочитать данные входа из хранилища браузера.",
      );
    }
    if (raw === null) {
      var initial = DEFAULTS.map(function (entry) {
        return Object.assign({}, entry);
      });
      saveCredentials(initial);
      return initial;
    }
    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (_) {
      parsed = null;
    }
    var seenIds = new Set();
    var seenLogins = new Set();
    var valid =
      parsed &&
      parsed.version === 1 &&
      Array.isArray(parsed.credentials) &&
      parsed.credentials.length <= 1000 &&
      parsed.credentials.every(function (entry) {
        if (
          !entry ||
          typeof entry.userId !== "string" ||
          !entry.userId ||
          typeof entry.login !== "string" ||
          !LOGIN_PATTERN.test(entry.login) ||
          typeof entry.salt !== "string" ||
          !/^[a-f0-9]{32}$/.test(entry.salt) ||
          typeof entry.hash !== "string" ||
          !/^[a-f0-9]{64}$/.test(entry.hash) ||
          !Number.isInteger(entry.iterations) ||
          entry.iterations < 100000 ||
          entry.iterations > 1000000 ||
          seenIds.has(entry.userId) ||
          seenLogins.has(entry.login)
        )
          return false;
        seenIds.add(entry.userId);
        seenLogins.add(entry.login);
        return true;
      });
    if (!valid)
      throw new Error(
        "Локальные данные входа повреждены. Сбросьте демоданные для восстановления.",
      );
    return parsed.credentials;
  }

  function hex(bytes) {
    return Array.from(bytes, function (byte) {
      return byte.toString(16).padStart(2, "0");
    }).join("");
  }

  function fromHex(value) {
    return new Uint8Array(
      value.match(/.{2}/g).map(function (byte) {
        return parseInt(byte, 16);
      }),
    );
  }

  function cryptoApi() {
    if (
      !window.crypto ||
      !window.crypto.subtle ||
      !window.crypto.getRandomValues
    ) {
      throw new Error(
        "Для входа нужен браузер с Web Crypto. Откройте дашборд через localhost или HTTPS.",
      );
    }
    return window.crypto;
  }

  async function derive(password, salt, iterations) {
    var api = cryptoApi();
    var material = await api.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveBits"],
    );
    var bits = await api.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: fromHex(salt),
        iterations: iterations,
        hash: "SHA-256",
      },
      material,
      256,
    );
    return hex(new Uint8Array(bits));
  }

  function equalHash(left, right) {
    var difference = left.length ^ right.length;
    for (var index = 0; index < left.length; index += 1)
      difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
    return difference === 0;
  }

  function signOut() {
    try {
      window.sessionStorage.removeItem(SESSION_KEY);
    } catch (_) {
      throw new Error(
        "Не удалось завершить демосессию. Проверьте настройки браузера.",
      );
    }
  }

  function getSession(users) {
    // The former role-picker key (arzu.demo.user) is deliberately ignored.
    var raw;
    try {
      raw = window.sessionStorage.getItem(SESSION_KEY);
    } catch (_) {
      return null;
    }
    if (!raw) return null;
    var session;
    try {
      session = JSON.parse(raw);
    } catch (_) {
      session = null;
    }
    var credentials = readCredentials();
    var entry =
      session &&
      credentials.find(function (credential) {
        return (
          credential.userId === session.userId &&
          credential.salt === session.credentialSalt &&
          credential.login === session.login
        );
      });
    if (entry && isActive(findUser(users, entry.userId))) return entry.userId;
    signOut();
    return null;
  }

  async function signIn(login, password, users) {
    var normalized = normalizeLogin(login);
    var records = readCredentials();
    var entry = records.find(function (credential) {
      return credential.login === normalized;
    });
    var user = entry && findUser(users, entry.userId);
    if (
      !LOGIN_PATTERN.test(normalized) ||
      typeof password !== "string" ||
      password.length > 128 ||
      !entry ||
      !isActive(user)
    )
      throw new Error(INVALID_LOGIN);
    var candidate = await derive(password, entry.salt, entry.iterations);
    // Re-read after the asynchronous hash to reject credentials changed by another tab.
    var current = readCredentials().find(function (credential) {
      return credential.userId === entry.userId;
    });
    if (
      !equalHash(candidate, entry.hash) ||
      !current ||
      current.login !== entry.login ||
      current.hash !== entry.hash ||
      current.salt !== entry.salt ||
      !isActive(findUser(users, entry.userId))
    )
      throw new Error(INVALID_LOGIN);
    try {
      window.sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          userId: entry.userId,
          login: entry.login,
          credentialSalt: entry.salt,
        }),
      );
    } catch (_) {
      throw new Error(
        "Не удалось сохранить демосессию. Проверьте настройки браузера.",
      );
    }
    return entry.userId;
  }

  async function upsertCredential(userId, login, password, actor, users) {
    var actorId = typeof actor === "string" ? actor : actor && actor.id;
    var administrator = findUser(users, actorId);
    if (!isActive(administrator) || administrator.role !== "admin")
      throw new Error("Недостаточно прав для настройки входа.");
    if (!findUser(users, userId)) throw new Error("Пользователь не найден.");
    var normalized = normalizeLogin(login);
    if (!LOGIN_PATTERN.test(normalized))
      throw new Error(
        "Логин: от 3 до 40 латинских букв, цифр или символов . _ -.",
      );
    var records = readCredentials();
    var original = JSON.stringify(records);
    var existing = records.find(function (credential) {
      return credential.userId === userId;
    });
    if (
      records.some(function (credential) {
        return credential.login === normalized && credential.userId !== userId;
      })
    )
      throw new Error("Этот логин уже используется другим пользователем.");
    if (password === undefined || password === null) password = "";
    if (
      typeof password !== "string" ||
      (password !== "" && (password.length < 8 || password.length > 128)) ||
      (!existing && password === "")
    )
      throw new Error("Пароль должен содержать от 8 до 128 символов.");
    var next;
    if (password === "")
      next = Object.assign({}, existing, { login: normalized });
    else {
      var salt = hex(cryptoApi().getRandomValues(new Uint8Array(16)));
      next = {
        userId: userId,
        login: normalized,
        salt: salt,
        hash: await derive(password, salt, ITERATIONS),
        iterations: ITERATIONS,
      };
    }
    if (JSON.stringify(readCredentials()) !== original)
      throw new Error(
        "Данные входа изменились в другой вкладке. Повторите сохранение.",
      );
    administrator = findUser(users, actorId);
    if (!isActive(administrator) || administrator.role !== "admin")
      throw new Error("Недостаточно прав для настройки входа.");
    var updated = records.filter(function (credential) {
      return credential.userId !== userId;
    });
    updated.push(next);
    saveCredentials(updated);
    return { login: normalized, userId: userId };
  }

  function getLogin(userId) {
    var entry = readCredentials().find(function (credential) {
      return credential.userId === userId;
    });
    return entry ? entry.login : "";
  }

  function reset() {
    try {
      window.localStorage.removeItem(CREDENTIALS_KEY);
    } catch (_) {
      throw new Error(
        "Не удалось сбросить демодоступ. Проверьте настройки браузера.",
      );
    }
    signOut();
  }

  window.ARZUAuth = {
    signIn: signIn,
    getSession: getSession,
    signOut: signOut,
    upsertCredential: upsertCredential,
    getLogin: getLogin,
    reset: reset,
  };
})();

"use client";

const KEY = "atp_token";

/** Токен в памяти — работает, даже если браузер блокирует localStorage/cookie. */
let memoryToken: string | null = null;

export function getAuthToken(): string | null {
  if (memoryToken) return memoryToken;
  try {
    const t = localStorage.getItem(KEY);
    if (t) {
      memoryToken = t;
      return t;
    }
  } catch {
    /* localStorage заблокирован — работаем через память */
  }
  return null;
}

/** Сохраняет токен. Возвращает true, если удалось сохранить надолго (localStorage). */
export function saveAuthToken(token: string): boolean {
  memoryToken = token;
  try {
    localStorage.setItem(KEY, token);
    return true;
  } catch {
    return false;
  }
}

export function clearAuthToken() {
  memoryToken = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function isStorageAvailable(): boolean {
  try {
    const k = "__atp_test__";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

export function isInIframe(): boolean {
  try {
    return typeof window !== "undefined" && window.self !== window.top;
  } catch {
    return true;
  }
}

function withAuthHeaders(initHeaders: HeadersInit | undefined, token: string | null): Headers {
  const headers = new Headers(initHeaders);
  if (token) {
    if (!headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
    // Дублирующий заголовок — на случай, если прокси режет Authorization
    if (!headers.has("x-atp-token")) headers.set("x-atp-token", token);
  }
  return headers;
}

/**
 * Запрос с авторизацией: прикладывает токен заголовками
 * Authorization + x-atp-token и включает cookie.
 */
export async function apiFetch(input: string, init?: RequestInit, explicitToken?: string | null): Promise<Response> {
  const token = explicitToken || getAuthToken();
  const headers = withAuthHeaders(init?.headers, token);
  const res = await fetch(input, { ...init, headers, credentials: "include", cache: init?.cache ?? "no-store" });
  // Любой 401 (кроме неверного пароля на входе) = сессия слетела.
  if (res.status === 401 && !input.includes("/api/auth/login") && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("atp:unauthorized"));
  }
  return res;
}

let patched = false;

/**
 * Запасной вариант: подменяем window.fetch, чтобы даже забытые
 * прямые вызовы fetch("/api/...") шли с токеном.
 */
export function installAuthFetch() {
  if (typeof window === "undefined" || patched) return;
  patched = true;
  const orig = window.fetch.bind(window);
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      let url = "";
      if (typeof input === "string") url = input;
      else if (input instanceof URL) url = input.toString();
      else url = (input as Request).url;
      if (url.includes("/api/")) {
        const token = getAuthToken();
        const baseHeaders =
          init?.headers || (typeof input !== "string" && !(input instanceof URL) ? (input as Request).headers : undefined);
        const headers = withAuthHeaders(baseHeaders, token);
        return await orig(input, { ...init, headers, credentials: "include" });
      }
    } catch {
      /* fall through */
    }
    return await orig(input, init);
  }) as typeof window.fetch;
}

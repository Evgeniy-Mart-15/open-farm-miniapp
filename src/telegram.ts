// Очень лёгкая обёртка над Telegram WebApp API, чтобы
// код работал и в браузере, и внутри Telegram (iOS, Android, desktop).

interface TelegramWebAppUser {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface InvoiceClosedEvent {
  status?: string;
}

export interface TelegramWebApp {
  initDataUnsafe?: {
    user?: TelegramWebAppUser;
    start_param?: string;
  };
  ready: () => void;
  openInvoice?: (url: string, callback?: (status: string) => void) => void;
  openTelegramLink?: (url: string) => void;
  platform?: string;
  showAlert?: (message: string) => void;
  onEvent?: (eventType: string, callback: (event: InvoiceClosedEvent) => void) => void;
  offEvent?: (eventType: string, callback?: (event: InvoiceClosedEvent) => void) => void;
}

interface TelegramWindow extends Window {
  Telegram?: {
    WebApp?: TelegramWebApp;
  };
}

declare const window: TelegramWindow;

/** Получить объект WebApp или null (в браузере без Telegram). */
export function getTelegramWebApp(): TelegramWebApp | null {
  try {
    return window.Telegram?.WebApp ?? null;
  } catch {
    return null;
  }
}

export interface TelegramContext {
  userId: string;
  username?: string;
  isTelegram: boolean;
  startParam?: string;
}

export function getTelegramContext(): TelegramContext {
  try {
    if (typeof window === 'undefined') return { userId: 'DEMO_USER', isTelegram: false };
    const tg = window.Telegram?.WebApp;
    // Основной источник — Telegram WebApp initData
    if (tg && tg.initDataUnsafe?.user) {
      const user = tg.initDataUnsafe.user;
      return {
        userId: String(user.id),
        username: user.username,
        isTelegram: true,
        startParam: tg.initDataUnsafe.start_param
      };
    }
    // Fallback: uid из query (?uid=...) — кнопки бота с /start, /mini_app
    try {
      const params = new URLSearchParams(window.location.search);
      const uid = params.get('uid');
      if (uid) {
        return { userId: String(uid), isTelegram: true, startParam: undefined };
      }
    } catch {
      // ignore
    }
    return { userId: 'DEMO_USER', isTelegram: false };
  } catch {
    return { userId: 'DEMO_USER', isTelegram: false };
  }
}

export function notifyTelegramReady() {
  const tg = window.Telegram?.WebApp;
  if (tg && typeof tg.ready === 'function') {
    tg.ready();
  }
}


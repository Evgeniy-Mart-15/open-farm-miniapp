// Очень лёгкая обёртка над Telegram WebApp API, чтобы
// код работал и в браузере, и внутри Telegram.

interface TelegramWebAppUser {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
}

interface TelegramWebApp {
  initDataUnsafe?: {
    user?: TelegramWebAppUser;
    start_param?: string;
  };
  ready: () => void;
}

interface TelegramWindow extends Window {
  Telegram?: {
    WebApp?: TelegramWebApp;
  };
}

declare const window: TelegramWindow;

export interface TelegramContext {
  userId: string;
  username?: string;
  isTelegram: boolean;
  startParam?: string;
}

export function getTelegramContext(): TelegramContext {
  const tg = window.Telegram?.WebApp;
  if (!tg || !tg.initDataUnsafe?.user) {
    return {
      userId: 'DEMO_USER',
      isTelegram: false
    };
  }

  const user = tg.initDataUnsafe.user;
  return {
    userId: String(user.id),
    username: user.username,
    isTelegram: true,
    startParam: tg.initDataUnsafe.start_param
  };
}

export function notifyTelegramReady() {
  const tg = window.Telegram?.WebApp;
  if (tg && typeof tg.ready === 'function') {
    tg.ready();
  }
}


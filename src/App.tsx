import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { GameState, TabId, CropSlot, AnimalSlot, CropType, AnimalType } from './gameTypes';
import { createInitialState } from './initialState';
import {
  ensureExtendedState,
  getTimerProgress,
  isTimerReady,
  plantCrop,
  feedAnimal,
  harvestCrop,
  collectAnimalProduct,
  sellProduce,
  buyFeed,
  boostCrop,
  boostAnimal,
  upgradeCrop,
  upgradeAnimal,
  getUpgradeCost,
  getBoostCost
} from './gameLogic';
import { getTelegramContext, getTelegramWebApp, notifyTelegramReady } from './telegram';
import { getMe, getFarm, syncFarm, bindReferral, getReferralStats, claimDailyReward, createInvoice, createCustomInvoice, confirmPaid, getGlobalStats, getGemPackages, GEM_PACKAGES, adminReward, type ReferralStats, type GlobalStats, type GemPackage, type DailyClaimResult } from './api';

function getStateStorageKey(userId: string) {
  return `farm-miniapp-state-v1-${userId}`;
}

function persistState(state: GameState, userId: string) {
  if (!userId) return;
  try {
    window.localStorage.setItem(getStateStorageKey(userId), JSON.stringify(state));
  } catch {
    // ignore
  }
}

function formatTimer(timerMs: number): string {
  const totalSec = Math.max(0, Math.round(timerMs / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

function getRemainingMs(slotTimer: CropSlot['timer'] | AnimalSlot['timer']): number {
  if (!slotTimer) return 0;
  const elapsed = Date.now() - slotTimer.startedAt;
  return Math.max(0, slotTimer.durationMs - elapsed);
}

interface FarmTileProps {
  slot: CropSlot | AnimalSlot;
  kind: 'crop' | 'animal';
  onAction: () => void;
  onBoost: () => void;
  onUpgrade: () => void;
  onGemUpgrade: () => void;
  canBoost: boolean;
  canUpgrade: boolean;
  canGemUpgrade: boolean;
  boostCost: number;
  upgradeCost: number;
  gemUpgradeLevel: number;
  maxGemUpgradeLevel: number;
}

const FarmTile: React.FC<FarmTileProps> = ({
  slot,
  kind,
  onAction,
  onBoost,
  onUpgrade,
  onGemUpgrade,
  canBoost,
  canUpgrade,
  canGemUpgrade,
  boostCost,
  upgradeCost,
  gemUpgradeLevel,
  maxGemUpgradeLevel
}) => {
  const [showHint, setShowHint] = useState(false);
  const ready = isTimerReady(slot.timer);
  const progress = slot.timer ? getTimerProgress(slot.timer) : 0;
  const remaining = slot.timer ? getRemainingMs(slot.timer) : 0;

  const isCrop = kind === 'crop';
  const hintText = isCrop
    ? 'При переходе всех растений на второй уровень открывается новое растение, которое можно купить за 30 гемов.'
    : 'При переходе всех растений на второй уровень и животных на первый и второй уровень открывается новое животное, которое можно купить за 30 гемов.';

  let title = '';
  let icon = '';
  let yieldText = '';

  if (isCrop) {
    const cropType = slot.type as CropType;
    switch (cropType) {
      case 'tomato':
        title = 'Помидоры';
        icon = '🍅';
        yieldText = 'томаты';
        break;
      case 'cucumber':
        title = 'Огурцы';
        icon = '🥒';
        yieldText = 'огурцы';
        break;
      case 'corn':
        title = 'Кукуруза';
        icon = '🌽';
        yieldText = 'кукуруза';
        break;
      case 'watermelon':
        title = 'Арбуз';
        icon = '🍉';
        yieldText = 'арбуз';
        break;
      case 'apple':
        title = 'Яблоко';
        icon = '🍎';
        yieldText = 'яблоки';
        break;
      default:
        title = 'Грядка';
        icon = '🌱';
        yieldText = 'урожай';
    }
  } else {
    const animalType = slot.type as AnimalType;
    switch (animalType) {
      case 'cow':
        title = 'Корова';
        icon = '🐄';
        yieldText = 'молоко';
        break;
      case 'chicken':
        title = 'Курица';
        icon = '🐔';
        yieldText = 'яйца';
        break;
      case 'goat':
        title = 'Коза';
        icon = '🐐';
        yieldText = 'сыр';
        break;
      case 'sheep':
        title = 'Овца';
        icon = '🐑';
        yieldText = 'шерсть';
        break;
      case 'pig':
        title = 'Поросёнок';
        icon = '🐖';
        yieldText = 'мясо';
        break;
      case 'goose':
        title = 'Гусь';
        icon = '🦢';
        yieldText = 'перья';
        break;
      default:
        title = 'Животное';
        icon = '🐾';
        yieldText = 'продукция';
    }
  }

  const actionLabel = !slot.timer
    ? isCrop
      ? 'Посадить'
      : 'Покормить'
    : ready
      ? 'Собрать'
      : 'Идёт рост';

  const showBoost = slot.timer && !ready && boostCost > 0;
  const harvestsSinceLevel = (slot as any).harvestsSinceLevel ?? 0;

  return (
    <div className={`tile ${isCrop ? 'vegetable' : 'animal'}`}>
      <div className={`tile-inner ${showHint ? 'is-flipped' : ''}`}>
        {/* Передняя сторона — исходная карточка, как на скрине */}
        <div className="tile-face tile-face-front">
          <div className="tile-header">
            <span className="tile-name">
              {title}
            </span>
            <span className="tile-level">Ур. {slot.level}</span>
          </div>
          <div className="tile-main">
            <span className="tile-icon">{icon}</span>
            <div className="tile-yield">
              <div>Выход: ×{slot.baseYield * slot.level} {yieldText}</div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>
                До след. уровня: {harvestsSinceLevel}/5 сборов
              </div>
              {slot.timer && (
                <div className="tile-timer">
                  {ready ? 'Готово к сбору' : `Осталось: ${formatTimer(remaining)}`}
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
                  </div>
                </div>
              )}
              {!slot.timer && <div className="tile-timer">Ожидает действия</div>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={onAction}
              style={{ flex: 1 }}
            >
              {actionLabel}
            </button>
            {showBoost && (
              <button
                className="btn btn-primary"
                type="button"
                onClick={onBoost}
                disabled={!canBoost}
                style={{ fontSize: 10, padding: '6px 8px' }}
                title={canBoost ? `Ускорить за ${boostCost} 💎` : 'Не хватает гемов'}
              >
                ⚡ {boostCost}💎
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            {maxGemUpgradeLevel > 0 && (
              <button
                className="btn btn-secondary"
                type="button"
                onClick={onGemUpgrade}
                disabled={!canGemUpgrade || gemUpgradeLevel >= maxGemUpgradeLevel}
                style={{ fontSize: 10, opacity: canGemUpgrade && gemUpgradeLevel < maxGemUpgradeLevel ? 1 : 0.5 }}
              >
                💎 Ур.{gemUpgradeLevel}/{maxGemUpgradeLevel} — {kind === 'crop' ? 20 : slot.type === 'cow' ? 30 : slot.type === 'chicken' ? 20 : 60} 💎
              </button>
            )}
            {maxGemUpgradeLevel > 0 && (
              <button
                type="button"
                onClick={() => setShowHint(true)}
                style={{
                  fontSize: 10,
                  color: '#9ca3af',
                  marginLeft: 4,
                  alignSelf: 'center',
                  width: 20,
                  height: 20,
                  minWidth: 20,
                  padding: 0,
                  borderRadius: '50%',
                  border: '1px solid rgba(148,163,184,0.5)',
                  background: 'rgba(15,23,42,0.8)',
                  cursor: 'pointer',
                  lineHeight: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Подсказка"
              >
                ?
              </button>
            )}
          </div>
        </div>

        {/* Обратная сторона — синий фон + текст подсказки и стрелка назад */}
        <div className="tile-face tile-face-back">
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              textAlign: 'center',
              fontSize: 11,
              color: '#e2e8f0',
              padding: '0 8px'
            }}
          >
            <div>{hintText}</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 6px 6px' }}>
            <button
              type="button"
              onClick={() => setShowHint(false)}
              style={{
                fontSize: 10,
                color: '#9ca3af',
                width: 22,
                height: 22,
                minWidth: 22,
                padding: 0,
                borderRadius: '50%',
                border: '1px solid rgba(148,163,184,0.5)',
                background: 'rgba(15,23,42,0.9)',
                cursor: 'pointer',
                lineHeight: 1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Назад"
            >
              ↩
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const API_BASE = import.meta.env.VITE_API_URL || '';
const BOT_LINK = 'https://t.me/Youdic_Bot';

function isIOS(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.platform === 'ios') return true;
    return typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent || '');
  } catch {
    return false;
  }
}

export const App: React.FC = () => {
  const [telegramCtx] = useState(() => {
    try {
      return getTelegramContext();
    } catch {
      return { userId: 'DEMO_USER', isTelegram: false };
    }
  });
  const [state, setState] = useState<GameState>(() => createInitialState());
  const [tab, setTab] = useState<TabId>('fields');
  const [isAdmin] = useState<boolean>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('admin') === '1';
    } catch {
      return false;
    }
  });
  const [referralStats, setReferralStats] = useState<ReferralStats | null>(null);
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  const [dailyMessage, setDailyMessage] = useState<string | null>(null);
  const [dailyInfo, setDailyInfo] = useState<DailyClaimResult | null>(null);
  const [gemPackages, setGemPackages] = useState<GemPackage[]>(() => GEM_PACKAGES);
  const [adminRewardUserId, setAdminRewardUserId] = useState('');
  const [adminRewardAmount, setAdminRewardAmount] = useState('');
  const [adminRewardResource, setAdminRewardResource] = useState<'gems' | 'coins'>('gems');
  const [adminRewardStatus, setAdminRewardStatus] = useState<string | null>(null);
  const refreshTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Ref, который всегда хранит последнее актуальное состояние (для sendBeacon и периодической синхронизации).
  const latestStateRef = useRef<GameState>(state);
  useEffect(() => { latestStateRef.current = state; }, [state]);

  // Флаг «есть несохранённые изменения» — ставится при каждом действии, снимается после успешного syncFarm.
  const dirtyRef = useRef(false);

  // Ref для debounce таймера синхронизации.
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Синхронизация с сервером: GET /api/me.
  // ВАЖНО: если есть несохранённые локальные изменения (dirtyRef), НЕ перезаписываем state,
  // чтобы не затереть свежие локальные данные старыми серверными.
  const syncGameState = useCallback(() => {
    if (!API_BASE || !telegramCtx.userId) return;
    // Не затираем несохранённые локальные изменения серверными данными.
    if (dirtyRef.current) return;
    getMe(telegramCtx.userId).then((data) => {
      try {
        // Повторная проверка: пока GET шёл, пользователь мог что-то сделать.
        if (dirtyRef.current) return;
        if (!data || data.level === undefined) return;
        const base = createInitialState();
        const serverRevision = (data as any).revision as number | undefined;
        const next = ensureExtendedState({
          ...base,
          level: data.level,
          resources: data.resources != null ? data.resources : base.resources,
          crops: Array.isArray(data.crops) ? data.crops : base.crops,
          animals: Array.isArray(data.animals) ? data.animals : base.animals,
          revision: typeof serverRevision === 'number' ? serverRevision : base.revision,
          referrerId: data.referrerId ?? undefined,
          referrerUsername: data.referrerUsername ?? undefined
        });
        setState(next);
      } catch (_) {
        // не ломаем приложение при некорректном ответе
      }
    }).catch(() => {});
  }, [telegramCtx.userId]);

  // Гарантированная отправка состояния через sendBeacon (переживает закрытие страницы).
  const flushStateBeacon = useCallback(() => {
    if (!API_BASE || !telegramCtx.userId) return;
    const s = latestStateRef.current;
    if (!s) return;
    try {
      const payload = JSON.stringify({
        userId: telegramCtx.userId,
        state: s,
        username: telegramCtx.username ?? undefined
      });
      navigator.sendBeacon(`${API_BASE}/api/farm/sync`, new Blob([payload], { type: 'application/json' }));
    } catch {
      // не все браузеры поддерживают sendBeacon, но Telegram WebView поддерживает
    }
  }, [API_BASE, telegramCtx.userId, telegramCtx.username]);

  // При уходе со страницы / закрытии мини-аппа гарантированно отправляем последнее состояние.
  useEffect(() => {
    const onUnload = () => flushStateBeacon();
    window.addEventListener('pagehide', onUnload);
    window.addEventListener('beforeunload', onUnload);
    const onVisHidden = () => {
      if (document.visibilityState === 'hidden') flushStateBeacon();
    };
    document.addEventListener('visibilitychange', onVisHidden);
    return () => {
      window.removeEventListener('pagehide', onUnload);
      window.removeEventListener('beforeunload', onUnload);
      document.removeEventListener('visibilitychange', onVisHidden);
    };
  }, [flushStateBeacon]);

  // Периодическая страховочная синхронизация: если есть несохранённые изменения, отправляем на сервер каждые 5 секунд.
  useEffect(() => {
    if (!API_BASE || !telegramCtx.userId) return;
    const id = setInterval(() => {
      if (dirtyRef.current) {
        const s = latestStateRef.current;
        syncFarm(telegramCtx.userId, s, telegramCtx.username).then(() => {
          dirtyRef.current = false;
        }).catch(() => {});
      }
    }, 5000);
    return () => clearInterval(id);
  }, [API_BASE, telegramCtx.userId, telegramCtx.username]);

  type AchievementsState = {
    plantHarvests: number;
    animalFeeds: number;
    rewardClaimed: boolean;
  };

  const getAchievementsKey = (uid: string) => `farm-miniapp-achievements-v1-${uid}`;
  const loadAchievements = (uid: string): AchievementsState => {
    try {
      const raw = window.localStorage.getItem(getAchievementsKey(uid));
      if (!raw) return { plantHarvests: 0, animalFeeds: 0, rewardClaimed: false };
      const parsed = JSON.parse(raw) as AchievementsState;
      return {
        plantHarvests: parsed.plantHarvests ?? 0,
        animalFeeds: parsed.animalFeeds ?? 0,
        rewardClaimed: !!parsed.rewardClaimed
      };
    } catch {
      return { plantHarvests: 0, animalFeeds: 0, rewardClaimed: false };
    }
  };

  const [achievements, setAchievements] = useState<AchievementsState>(() => loadAchievements(telegramCtx.userId));

  type WeeklyState = { harvestsThisWeek: number; coinsEarnedThisWeek: number };
  const getWeeklyKey = (uid: string) => `farm-miniapp-weekly-v1-${uid}`;
  const loadWeekly = (uid: string): WeeklyState => {
    try {
      const raw = window.localStorage.getItem(getWeeklyKey(uid));
      if (!raw) return { harvestsThisWeek: 0, coinsEarnedThisWeek: 0 };
      const p = JSON.parse(raw) as WeeklyState;
      return { harvestsThisWeek: p.harvestsThisWeek ?? 0, coinsEarnedThisWeek: p.coinsEarnedThisWeek ?? 0 };
    } catch {
      return { harvestsThisWeek: 0, coinsEarnedThisWeek: 0 };
    }
  };
  const [weekly, setWeekly] = useState<WeeklyState>(() => loadWeekly(telegramCtx.userId));

  const persistWeekly = (w: WeeklyState, uid: string) => {
    if (!uid) return;
    try {
      window.localStorage.setItem(getWeeklyKey(uid), JSON.stringify(w));
    } catch {
      // ignore
    }
  };

  const persistAchievements = (next: AchievementsState, uid: string) => {
    if (!uid) return;
    try {
      window.localStorage.setItem(getAchievementsKey(uid), JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  // Чтобы клики по «Собрать» не лагали из-за синхронной записи в localStorage,
  // сохраняем достижения и weekly-статистику в эффектах после рендера.
  useEffect(() => {
    persistAchievements(achievements, telegramCtx.userId);
  }, [achievements, telegramCtx.userId]);

  useEffect(() => {
    persistWeekly(weekly, telegramCtx.userId);
  }, [weekly, telegramCtx.userId]);

  // Подгружаем пакеты гемов с бэкенда; при ошибке остаётся дефолтный список (GEM_PACKAGES).
  useEffect(() => {
    getGemPackages().then((list) => list.length > 0 && setGemPackages(list)).catch(() => {});
  }, []);

  useEffect(() => {
    if (telegramCtx.isTelegram && tab === 'referrals' && API_BASE && telegramCtx.userId) {
      getReferralStats(telegramCtx.userId).then(setReferralStats);
    }
    if (telegramCtx.isTelegram && tab === 'stats' && API_BASE) {
      getGlobalStats().then(setGlobalStats);
    }
  }, [tab, telegramCtx.userId, telegramCtx.isTelegram, syncGameState]);

  useEffect(() => {
    persistState(state, telegramCtx.userId);
  }, [state, telegramCtx.userId]);

  // При наличии сервера всегда подтягиваем состояние с него при старте.
  // localStorage используется только как запасной вариант, если API недоступен.
  useEffect(() => {
    const uid = telegramCtx.userId;
    if (!uid) return;
    if (API_BASE) {
      syncGameState();
      return;
    }
    try {
      const raw = window.localStorage.getItem(getStateStorageKey(uid));
      if (!raw) return;
      const parsed = JSON.parse(raw) as GameState;
      setState(ensureExtendedState(parsed));
    } catch {
      // ignore
    }
  }, [telegramCtx.userId, syncGameState]);

  useEffect(() => {
    notifyTelegramReady();

    const sp = telegramCtx.startParam;
    if (telegramCtx.isTelegram && API_BASE && sp && sp.startsWith('ref_') && telegramCtx.userId) {
      const referrerId = sp.slice(4);
      if (referrerId) bindReferral(telegramCtx.userId, referrerId);
    }

    if (telegramCtx.isTelegram && API_BASE && telegramCtx.userId) {
      getReferralStats(telegramCtx.userId).then(setReferralStats).catch(() => {});
      getGemPackages().then(setGemPackages).catch(() => {});
    }

    const id = window.setInterval(() => {
      setState((prev) => ({ ...prev }));
    }, 1000);
    return () => window.clearInterval(id);
  }, [telegramCtx.isTelegram, telegramCtx.userId, syncGameState]);

  useEffect(() => {
    if (telegramCtx.userId === 'DEMO_USER') {
      window.location.replace(`${BOT_LINK}?start=app`);
    }
  }, [telegramCtx.userId]);

  // Принудительная загрузка состояния с сервера (для оплаты и вкладки «Магазин»).
  // Сначала отправляет несохранённые локальные изменения, затем загружает серверные данные.
  const forceRefreshFromServer = useCallback(() => {
    if (!API_BASE || !telegramCtx.userId) return;
    const doLoad = () => {
      getMe(telegramCtx.userId).then((data) => {
        try {
          if (dirtyRef.current) return; // пока грузили, пользователь снова что-то сделал
          if (!data || data.level === undefined) return;
          const base = createInitialState();
          const serverRevision = (data as any).revision as number | undefined;
          const next = ensureExtendedState({
            ...base,
            level: data.level,
            resources: data.resources != null ? data.resources : base.resources,
            crops: Array.isArray(data.crops) ? data.crops : base.crops,
            animals: Array.isArray(data.animals) ? data.animals : base.animals,
            revision: typeof serverRevision === 'number' ? serverRevision : base.revision,
            referrerId: data.referrerId ?? undefined,
            referrerUsername: data.referrerUsername ?? undefined
          });
          setState(next);
        } catch (_) { /* ignore */ }
      }).catch(() => {});
    };
    if (dirtyRef.current) {
      // Сначала отправляем несохранённые изменения, потом загружаем.
      syncFarm(telegramCtx.userId, latestStateRef.current, telegramCtx.username)
        .then(() => { dirtyRef.current = false; doLoad(); })
        .catch(() => doLoad());
    } else {
      doLoad();
    }
  }, [telegramCtx.userId, telegramCtx.username]);

  // Алиас для обратной совместимости (используется в handleBuyGems, handleBuyCustomGems и т.д.)
  const refreshFarmState = forceRefreshFromServer;

  // При открытии вкладки «Магазин» подтягиваем баланс с сервера (безопасно — forceRefresh сначала сохранит локальные).
  useEffect(() => {
    if (tab !== 'shop' || !API_BASE || !telegramCtx.userId) return;
    forceRefreshFromServer();
  }, [tab, API_BASE, telegramCtx.userId, forceRefreshFromServer]);

  // На вкладке «Магазин» периодически подтягиваем баланс (💎 Гемы), чтобы после оплаты в боте или в mini-app счётчик обновился.
  useEffect(() => {
    if (tab !== 'shop' || !API_BASE || !telegramCtx.userId) return;
    const id = setInterval(forceRefreshFromServer, 5000);
    return () => clearInterval(id);
  }, [tab, API_BASE, telegramCtx.userId, forceRefreshFromServer]);

  // При возврате в мини-ап (после оплаты) подтягиваем баланс: безопасно через forceRefresh.
  useEffect(() => {
    if (!API_BASE || !telegramCtx.userId || !telegramCtx.isTelegram) return;
    const scheduleRefreshes = () => {
      forceRefreshFromServer();
      refreshTimersRef.current.push(setTimeout(forceRefreshFromServer, 1000));
      refreshTimersRef.current.push(setTimeout(forceRefreshFromServer, 3000));
    };
    let hidden = document.visibilityState === 'hidden';
    const onVisibility = () => {
      if (hidden && document.visibilityState === 'visible') scheduleRefreshes();
      hidden = document.visibilityState === 'hidden';
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', scheduleRefreshes);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', scheduleRefreshes);
      refreshTimersRef.current.forEach(clearTimeout);
      refreshTimersRef.current = [];
    };
  }, [API_BASE, telegramCtx.userId, telegramCtx.isTelegram, forceRefreshFromServer]);

  // СВЯЗЬ ОПЛАТЫ И GEMS: invoiceClosed(paid) → forceRefresh → setState. Gems уже изменены сервером.
  useEffect(() => {
    const tg = getTelegramWebApp();
    if (!tg?.onEvent || !API_BASE || !telegramCtx.userId) return;
    const handler = (event: { status?: string }) => {
      if (event?.status === 'paid' || event?.status === 'completed') {
        forceRefreshFromServer();
      }
    };
    tg.onEvent('invoiceClosed', handler);
    return () => {
      if (tg.offEvent) tg.offEvent('invoiceClosed', handler);
    };
  }, [API_BASE, telegramCtx.userId, forceRefreshFromServer]);

  // Обёртка: применяем изменение состояния и увеличиваем ревизию.
  // Синхронизация с сервером происходит через debounced setTimeout (50 мс) ПОСЛЕ setState.
  // Это гарантирует, что:
  // 1) syncFarm вызывается ВНЕ setState (не антипаттерн React).
  // 2) При нескольких быстрых действиях подряд отправляется только последнее состояние.
  // 3) latestStateRef всегда содержит самое свежее состояние.
  const applyStateUpdate = useCallback(
    (updater: (prev: GameState) => GameState) => {
      setState((prev) => {
        const current = prev ?? createInitialState();
        const updated = updater(current);
        const nextRevision = (current.revision ?? 0) + 1;
        const next: GameState = { ...updated, revision: nextRevision };
        dirtyRef.current = true;
        // Немедленно обновляем ref — для sendBeacon и для setTimeout ниже.
        latestStateRef.current = next;
        return next;
      });
      // Планируем отправку на сервер СНАРУЖИ setState.
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = setTimeout(() => {
        if (!API_BASE || !telegramCtx.userId || !dirtyRef.current) return;
        const stateToSync = latestStateRef.current;
        syncFarm(telegramCtx.userId, stateToSync, telegramCtx.username)
          .then(() => { dirtyRef.current = false; })
          .catch(() => { /* периодический sync и sendBeacon подхватят */ });
      }, 50);
    },
    [telegramCtx.userId, telegramCtx.username]
  );

  const handlePlant = (id: string) => {
    applyStateUpdate((prev) => plantCrop(prev, id));
  };

  const handleFeed = (id: string) => {
    applyStateUpdate((prev) => feedAnimal(prev, id));
    setAchievements((prev) => ({
      ...prev,
      animalFeeds: prev.animalFeeds + 1
    }));
  };

  const handleHarvestCrop = (id: string) => {
    applyStateUpdate((prev) => harvestCrop(prev, id));
    setAchievements((prev) => ({
      ...prev,
      plantHarvests: prev.plantHarvests + 1
    }));
    setWeekly((w) => ({
      ...w,
      harvestsThisWeek: w.harvestsThisWeek + 1
    }));
  };

  const handleCollectProduct = (id: string) => {
    applyStateUpdate((prev) => collectAnimalProduct(prev, id));
  };

  const handleSell = () => {
    applyStateUpdate((prev) => {
      const next = sellProduce(prev);
      const income = next.resources.coins - (prev.resources?.coins ?? 0);
      setWeekly((w) => ({
        ...w,
        coinsEarnedThisWeek: w.coinsEarnedThisWeek + income
      }));
      return next;
    });
  };

  const handleBuyFeed = () => {
    applyStateUpdate((prev) => buyFeed(prev));
  };

  const handleBoostCrop = (id: string) => {
    applyStateUpdate((prev) => boostCrop(prev, id));
  };

  const handleBoostAnimal = (id: string) => {
    applyStateUpdate((prev) => boostAnimal(prev, id));
  };

  const handleUpgradeCrop = (id: string) => {
    applyStateUpdate((prev) => upgradeCrop(prev, id));
  };

  const handleUpgradeAnimal = (id: string) => {
    applyStateUpdate((prev) => upgradeAnimal(prev, id));
  };

  const handleDailyClaim = async () => {
    if (!API_BASE || !telegramCtx.userId) {
      setDailyMessage('Подключи backend (VITE_API_URL) для ежедневной награды.');
      return;
    }
    const result = await claimDailyReward(telegramCtx.userId);
    if (!result) {
      setDailyMessage('Ошибка запроса.');
      return;
    }
    setDailyInfo(result);
    if (result.claimed && result.reward && result.resources) {
      const parts = [];
      if (result.reward.coins) parts.push(`${result.reward.coins} монет`);
      if (result.reward.gems) parts.push(`${result.reward.gems} гемов`);
      if (result.reward.feed) parts.push(`${result.reward.feed} корма`);
      setDailyMessage(`Награда: ${parts.join(', ')}. Марафон: день ${result.streak ?? 1} из 5.`);
      applyStateUpdate((prev) => ({
        ...prev,
        resources: { ...prev.resources, ...result.resources }
      }));
    } else if (!result.claimed) {
      const next = result.nextAt
        ? new Date(result.nextAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
        : '';
      setDailyMessage(`Уже забрал сегодня. Следующая награда после ${next}`);
    }
  };

  const coins = (state.resources.coins ?? 0).toLocaleString('ru-RU');
  const gems = (state.resources.gems ?? 0).toLocaleString('ru-RU');
  const feed = (state.resources.feed ?? 0).toLocaleString('ru-RU');

  const cropsReady = state.crops.some((c) => isTimerReady(c.timer));
  const animalsReady = state.animals.some((a) => isTimerReady(a.timer));

  const referralLink = `https://t.me/Youdic_Bot?start=ref_${telegramCtx.userId}`;

  const handleCopyReferral = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      // В проде можно показать toast, здесь просто тихо копируем.
    } catch {
      // ignore
    }
  };

  // Проверка условий разблокировки слотов
  const canUnlockCrop = (type: CropType, s: GameState): boolean => {
    const cropById = (id: string) => s.crops.find((c) => c.id === id);
    const gem2 = (c: CropSlot | undefined) => (c?.gemUpgradeLevel ?? 0) >= 2;

    if (type === 'corn') {
      // Все три базовые грядки 2/2
      return gem2(cropById('c1')) && gem2(cropById('c2')) && gem2(cropById('c3'));
    }
    if (type === 'watermelon') {
      // Кукуруза 2/2
      return gem2(cropById('c4'));
    }
    if (type === 'apple') {
      // Арбуз 2/2
      return gem2(cropById('c5'));
    }
    return false;
  };

  const canUnlockAnimal = (type: AnimalType, s: GameState): boolean => {
    const animalByType = (t: AnimalType) => s.animals.find((a) => a.type === t);
    const cropById = (id: string) => s.crops.find((c) => c.id === id);
    const gem2Crop = (c: CropSlot | undefined) => (c?.gemUpgradeLevel ?? 0) >= 2;
    const gem2Animal = (a: AnimalSlot | undefined) => (a?.gemUpgradeLevel ?? 0) >= 2;

    if (type === 'goat') {
      // Все базовые растения 2/2 + корова/курица апгрейжены хотя бы раз
      const cow = animalByType('cow');
      const chicken = animalByType('chicken');
      const baseCropsOk =
        gem2Crop(cropById('c1')) && gem2Crop(cropById('c2')) && gem2Crop(cropById('c3'));
      const baseAnimalsOk =
        (cow?.gemUpgradeLevel ?? 0) >= 1 && (chicken?.gemUpgradeLevel ?? 0) >= 1;
      return baseCropsOk && baseAnimalsOk;
    }
    if (type === 'sheep') {
      // Коза 2/2
      return gem2Animal(animalByType('goat'));
    }
    if (type === 'pig') {
      // Овца 2/2
      return gem2Animal(animalByType('sheep'));
    }
    if (type === 'goose') {
      // Поросёнок 2/2
      return gem2Animal(animalByType('pig'));
    }
    return false;
  };

  const handleUnlockCrop = (id: string) => {
    applyStateUpdate((prev) => {
      const slot = prev.crops.find((c) => c.id === id);
      if (!slot || slot.unlocked) return prev;
      if (prev.resources.gems < 30) return prev;
      if (!canUnlockCrop(slot.type, prev)) return prev;

      return {
        ...prev,
        resources: { ...prev.resources, gems: prev.resources.gems - 30 },
        crops: prev.crops.map((c) =>
          c.id === id ? { ...c, unlocked: true } : c
        )
      };
    });
  };

  const handleUnlockAnimal = (id: string) => {
    applyStateUpdate((prev) => {
      const slot = prev.animals.find((a) => a.id === id);
      if (!slot || slot.unlocked) return prev;
      if (prev.resources.gems < 30) return prev;
      if (!canUnlockAnimal(slot.type, prev)) return prev;

      return {
        ...prev,
        resources: { ...prev.resources, gems: prev.resources.gems - 30 },
        animals: prev.animals.map((a) =>
          a.id === id ? { ...a, unlocked: true } : a
        )
      };
    });
  };

  // Гем-апгрейды культур и животных
  const getCropGemMaxLevel = (type: CropType): number => {
    switch (type) {
      case 'tomato':
      case 'cucumber':
      case 'corn':
      case 'watermelon':
      case 'apple':
        return 2;
      default:
        return 0;
    }
  };

  const getAnimalGemMaxLevel = (type: AnimalType): number => {
    switch (type) {
      case 'cow':
        return 1;
      case 'chicken':
        return 1;
      case 'goat':
      case 'sheep':
      case 'pig':
      case 'goose':
        return 2;
      default:
        return 0;
    }
  };

  const handleGemUpgradeCrop = (id: string) => {
    applyStateUpdate((prev) => {
      const crops = prev.crops.map((c) => {
        if (c.id !== id) return c;
        const current = c.gemUpgradeLevel ?? 0;
        const max = getCropGemMaxLevel(c.type);
        if (current >= max) return c;
        if (prev.resources.gems < 20) return c;
        return { ...c, gemUpgradeLevel: current + 1 };
      });
      const changed = prev.crops !== crops;
      if (!changed) return prev;
      return {
        ...prev,
        resources: { ...prev.resources, gems: prev.resources.gems - 20 },
        crops
      };
    });
  };

  const handleGemUpgradeAnimal = (id: string) => {
    applyStateUpdate((prev) => {
      const animals = prev.animals.map((a) => {
        if (a.id !== id) return a;
        const current = a.gemUpgradeLevel ?? 0;
        const max = getAnimalGemMaxLevel(a.type);
        if (current >= max) return a;
        const price = a.type === 'cow' ? 30 : a.type === 'chicken' ? 20 : 60;
        if (prev.resources.gems < price) return a;
        return { ...a, gemUpgradeLevel: current + 1 };
      });
      const changed = prev.animals !== animals;
      if (!changed) return prev;
      // вычитаем гемы по фактической цене последнего срабатывания
      // для простоты считаем, что в одном вызове апгрейднулся только один слот
      const upgraded = animals.find((a, idx) => a.gemUpgradeLevel !== (prev.animals[idx].gemUpgradeLevel ?? 0));
      if (!upgraded) return prev;
      const price = upgraded.type === 'cow' ? 30 : upgraded.type === 'chicken' ? 20 : 60;
      return {
        ...prev,
        resources: { ...prev.resources, gems: prev.resources.gems - price },
        animals
      };
    });
  };
  const handleExchangeGemsToCoins = () => {
    setState((prev) => {
      if (prev.resources.gems < 10) return prev;
      return {
        ...prev,
        resources: {
          ...prev.resources,
          gems: prev.resources.gems - 10,
          coins: prev.resources.coins + 100
        }
      };
    });
  };

  const COINS_TO_GEMS_COST = 100_000;
  const COINS_TO_GEMS_AMOUNT = 10_000;
  // Обмен монет на гемы внутри игры (не Telegram Stars). Оплата Stars → только через бэкенд + refetch.
  const handleExchangeCoinsToGems = () => {
    setState((prev) => {
      if ((prev.resources.coins ?? 0) < COINS_TO_GEMS_COST) return prev;
      return {
        ...prev,
        resources: {
          ...prev.resources,
          coins: (prev.resources.coins ?? 0) - COINS_TO_GEMS_COST,
          gems: (prev.resources.gems ?? 0) + COINS_TO_GEMS_AMOUNT
        }
      };
    });
  };

  const [buyingPackage, setBuyingPackage] = useState<string | null>(null);
  const [customGems, setCustomGems] = useState<string>('');
  const [customBuying, setCustomBuying] = useState<boolean>(false);
  /** Последняя попытка покупки — для кнопки «Я оплатил», если callback openInvoice не сработал */
  const [pendingPaymentConfirm, setPendingPaymentConfirm] = useState<{ packageId: string } | { gems: number } | null>(null);

  const getCustomUsernameKey = (uid: string) => `farm-miniapp-custom-username-v1-${uid}`;
  const [customUsername, setCustomUsername] = useState<string>(() => {
    try {
      return window.localStorage.getItem(getCustomUsernameKey(telegramCtx.userId)) || '';
    } catch {
      return '';
    }
  });
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');

  const schedulePaymentRefreshes = useCallback(() => {
    refreshFarmState();
    setTimeout(refreshFarmState, 1000);
    setTimeout(refreshFarmState, 2500);
    setTimeout(refreshFarmState, 5000);
    setTimeout(refreshFarmState, 10000);
    setTimeout(refreshFarmState, 20000);
  }, [refreshFarmState]);

  const handleBuyGems = async (packageId: string) => {
    if (!telegramCtx.userId || !API_BASE) {
      alert('Покупка доступна только в Telegram');
      return;
    }
    setBuyingPackage(packageId);
    try {
      const result = await createInvoice(telegramCtx.userId, packageId);
      if (!result?.invoiceLink) {
        alert('Не удалось создать платёж');
        return;
      }
      const tg = getTelegramWebApp();
      const doRefresh = () => {
        try {
          schedulePaymentRefreshes();
        } catch (_) {
          refreshFarmState();
        }
      };
      // Критично для прогресса: после оплаты гемы приходят ТОЛЬКО с сервера. Refetch → setState(serverState) → UI и игровая логика (слоты, апгрейды) пересчитываются.
      const onPaid = () => {
        setPendingPaymentConfirm({ packageId });
        const refetchBalanceFromServer = () => {
          refreshFarmState();
          setTimeout(refreshFarmState, 400);
          schedulePaymentRefreshes();
        };
        if (telegramCtx.userId && API_BASE) {
          confirmPaid(telegramCtx.userId, { packageId })
            .then((r) => {
              if (r?.ok) {
                setPendingPaymentConfirm(null);
                refetchBalanceFromServer();
                return;
              }
              setTimeout(() => confirmPaid(telegramCtx.userId!, { packageId }).then((r2) => { if (r2?.ok) setPendingPaymentConfirm(null); refetchBalanceFromServer(); }), 1500);
            })
            .catch(() => {
              setTimeout(() => confirmPaid(telegramCtx.userId!, { packageId }).then((r2) => { if (r2?.ok) setPendingPaymentConfirm(null); refetchBalanceFromServer(); }), 1500);
            });
        } else {
          refetchBalanceFromServer();
        }
      };
      const isPaid = (s: unknown) => (s === 'paid' || s === 'completed') || (typeof s === 'object' && s !== null && (s as { status?: string }).status === 'paid');
      if (tg?.openInvoice) {
        try {
          tg.openInvoice(result.invoiceLink, (status: string | { status?: string }) => {
            const statusStr = typeof status === 'object' && status !== null && 'status' in status ? (status as { status: string }).status : String(status);
            if (isPaid(statusStr) || isPaid(status)) onPaid();
          });
        } catch (_) {}
        doRefresh();
      } else if (tg?.openTelegramLink) {
        try {
          tg.openTelegramLink(result.invoiceLink);
          if (tg.platform === 'ios' && tg.showAlert) {
            tg.showAlert('Если окно оплаты не открылось — нажмите внизу «Открыть бота для оплаты», затем в чате введите /donate и выберите пакет.');
          }
        } catch (_) {}
        doRefresh();
      } else {
        window.open(result.invoiceLink, '_blank');
        doRefresh();
      }
    } catch (_) {
      alert('Ошибка при создании платежа');
    } finally {
      setBuyingPackage(null);
    }
  };

  const parsedCustomGems = Number(customGems.replace(/\D/g, ''));
  const customStars = parsedCustomGems > 0 ? Math.max(1, Math.ceil(parsedCustomGems / 5)) : 0;

  const handleBuyCustomGems = async () => {
    if (!telegramCtx.userId || !API_BASE) {
      alert('Покупка доступна только в Telegram');
      return;
    }
    if (!parsedCustomGems || parsedCustomGems <= 0) return;
    setCustomBuying(true);
    try {
      const result = await createCustomInvoice(telegramCtx.userId, parsedCustomGems);
      if (!result?.invoiceLink) {
        const errMsg = (result as { error?: string })?.error || 'Не удалось создать платёж';
        alert(errMsg);
        return;
      }
      const tg = getTelegramWebApp();
      const doRefresh = () => {
        try {
          schedulePaymentRefreshes();
        } catch (_) {
          refreshFarmState();
        }
      };
      // Та же критичная логика: после оплаты своей суммы — confirm, refetch, state только с сервера → слоты/апгрейды обновляются.
      const onPaid = () => {
        setPendingPaymentConfirm({ gems: parsedCustomGems });
        const refetchBalanceFromServer = () => {
          refreshFarmState();
          setTimeout(refreshFarmState, 400);
          schedulePaymentRefreshes();
        };
        if (telegramCtx.userId && API_BASE) {
          confirmPaid(telegramCtx.userId, { gems: parsedCustomGems })
            .then((r) => {
              if (r?.ok) {
                setPendingPaymentConfirm(null);
                refetchBalanceFromServer();
                return;
              }
              setTimeout(() => confirmPaid(telegramCtx.userId!, { gems: parsedCustomGems }).then((r2) => { if (r2?.ok) setPendingPaymentConfirm(null); refetchBalanceFromServer(); }), 1500);
            })
            .catch(() => {
              setTimeout(() => confirmPaid(telegramCtx.userId!, { gems: parsedCustomGems }).then((r2) => { if (r2?.ok) setPendingPaymentConfirm(null); refetchBalanceFromServer(); }), 1500);
            });
        } else {
          refetchBalanceFromServer();
        }
      };
      const isPaid = (s: unknown) => (s === 'paid' || s === 'completed') || (typeof s === 'object' && s !== null && (s as { status?: string }).status === 'paid');
      if (tg?.openInvoice) {
        try {
          tg.openInvoice(result.invoiceLink, (status: string | { status?: string }) => {
            const statusStr = typeof status === 'object' && status !== null && 'status' in status ? (status as { status: string }).status : String(status);
            if (isPaid(statusStr) || isPaid(status)) onPaid();
          });
        } catch (_) {}
        doRefresh();
      } else if (tg?.openTelegramLink) {
        try {
          tg.openTelegramLink(result.invoiceLink);
          if (tg.platform === 'ios' && tg.showAlert) {
            tg.showAlert('Если окно оплаты не открылось — нажмите внизу «Открыть бота для оплаты», затем в чате введите /donate и выберите свою сумму.');
          }
        } catch (_) {}
        doRefresh();
      } else {
        window.open(result.invoiceLink, '_blank');
        doRefresh();
      }
    } catch (_) {
      alert('Ошибка при создании платежа');
    } finally {
      setCustomBuying(false);
    }
  };

  const canClaimAchievement =
    achievements.plantHarvests >= 10 && achievements.animalFeeds >= 5 && !achievements.rewardClaimed;

  const WEEKLY_HARVEST_GOAL = 100;
  const WEEKLY_COINS_GOAL = 1000;
  const WEEKLY_REWARD_COINS = 200;
  const canClaimWeekly =
    weekly.harvestsThisWeek >= WEEKLY_HARVEST_GOAL && weekly.coinsEarnedThisWeek >= WEEKLY_COINS_GOAL;

  const handleClaimWeeklyReward = () => {
    if (!canClaimWeekly) return;
    applyStateUpdate((prev) => ({
      ...prev,
      resources: {
        ...prev.resources,
        coins: (prev.resources.coins ?? 0) + WEEKLY_REWARD_COINS
      }
    }));
    const reset = { harvestsThisWeek: 0, coinsEarnedThisWeek: 0 };
    setWeekly(reset);
  };

  const handleClaimAchievementReward = () => {
    if (!canClaimAchievement) return;
    const rewardCoins = 100;
    applyStateUpdate((prev) => ({
      ...prev,
      resources: {
        ...prev.resources,
        coins: (prev.resources.coins ?? 0) + rewardCoins
      }
    }));
    setAchievements((prev) => ({
      ...prev,
      rewardClaimed: true
    }));
  };

  if (telegramCtx.userId === 'DEMO_USER') {
    return (
      <div className="app-root">
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 18 }}>Открываем…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-root">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="title">Томатная ферма</div>
            <div className="subtitle">
              {telegramCtx.username ? `@${telegramCtx.username}` : 'Мини‑апп'} · Ур. {state.level}
            </div>
          </div>
          <div style={{ fontSize: 18 }}>🚜</div>
        </div>

        <div className="resources">
          <div className="pill">
            <span className="pill-label">Монеты</span>
            <span className="pill-value">🪙 {coins}</span>
          </div>
          <div className="pill secondary">
            <span className="pill-label">Гемы</span>
            <span className="pill-value">💎 {gems}</span>
          </div>
          <div className="pill secondary">
            <span className="pill-label">Корм</span>
            <span className="pill-value">🥣 {feed}</span>
          </div>
        </div>

        <div className="tabs">
          <button
            type="button"
            className={`tab ${tab === 'fields' ? 'active' : ''}`}
            onClick={() => setTab('fields')}
          >
            Грядки
          </button>
          <button
            type="button"
            className={`tab ${tab === 'animals' ? 'active' : ''}`}
            onClick={() => setTab('animals')}
          >
            Животные
          </button>
          <button
            type="button"
            className={`tab ${tab === 'market' ? 'active' : ''}`}
            onClick={() => setTab('market')}
          >
            Рынок
          </button>
          <button
            type="button"
            className={`tab ${tab === 'referrals' ? 'active' : ''}`}
            onClick={() => setTab('referrals')}
          >
            Рефералы
          </button>
          <button
            type="button"
            className={`tab ${tab === 'shop' ? 'active' : ''}`}
            onClick={() => setTab('shop')}
          >
            Магазин
          </button>
          <button
            type="button"
            className={`tab ${tab === 'stats' ? 'active' : ''}`}
            onClick={() => setTab('stats')}
          >
            📊
          </button>
        </div>

        <div className="card-content">
        {tab === 'fields' && (
          <>
            <div className="section-title-row">
              <div className="section-title">Грядки</div>
              <div className="section-caption">
                Трать монеты, чтобы посадить, и собирай урожай
              </div>
            </div>
            <div className="grid">
              {(state.crops ?? []).map((crop) => {
                if (crop.unlocked === false) {
                  const canUnlock = canUnlockCrop(crop.type, state);
                  const titleMap: Record<CropType, string> = {
                    tomato: 'Помидоры',
                    cucumber: 'Огурцы',
                    corn: 'Кукуруза',
                    watermelon: 'Арбуз',
                    apple: 'Яблоко'
                  };
                  return (
                    <div
                      key={crop.id}
                      className="tile vegetable"
                      style={{ opacity: 0.7, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                    >
                      <div className="tile-header">
                        <span className="tile-name">{titleMap[crop.type]}</span>
                        <span className="tile-level">🔒</span>
                      </div>
                      <div className="tile-main">
                        <span className="tile-icon">🌱</span>
                        <div className="tile-yield">
                          <div style={{ fontSize: 10, color: '#9ca3af' }}>
                            Откроется при выполнении условий
                          </div>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => handleUnlockCrop(crop.id)}
                            disabled={!canUnlock || state.resources.gems < 30}
                            style={{ marginTop: 4, fontSize: 10 }}
                          >
                            Открыть за 30 💎
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }
                const boostCost = getBoostCost(crop.timer);
                const upgradeCost = getUpgradeCost(crop.level);
                const gemLevel = crop.gemUpgradeLevel ?? 0;
                const maxGemLevel = getCropGemMaxLevel(crop.type);
                return (
                  <FarmTile
                    key={crop.id}
                    slot={crop}
                    kind="crop"
                    onAction={() => {
                      if (!crop.timer) {
                        handlePlant(crop.id);
                      } else if (isTimerReady(crop.timer)) {
                        handleHarvestCrop(crop.id);
                      }
                    }}
                    onBoost={() => handleBoostCrop(crop.id)}
                    onUpgrade={() => handleUpgradeCrop(crop.id)}
                    onGemUpgrade={() => handleGemUpgradeCrop(crop.id)}
                    canBoost={state.resources.gems >= boostCost && boostCost > 0}
                    canUpgrade={state.resources.coins >= upgradeCost}
                    canGemUpgrade={state.resources.gems >= 20 && gemLevel < maxGemLevel}
                    boostCost={boostCost}
                    upgradeCost={upgradeCost}
                    gemUpgradeLevel={gemLevel}
                    maxGemUpgradeLevel={maxGemLevel}
                  />
                );
              })}
            </div>
          </>
        )}

        {tab === 'animals' && (
          <>
            <div className="section-title-row">
              <div className="section-title">Животные</div>
              <div className="section-caption">
                Трать корм, чтобы они приносили молоко и яйца
              </div>
            </div>
            <div className="grid">
              {(state.animals ?? []).map((animal) => {
                if (animal.unlocked === false) {
                  const canUnlock = canUnlockAnimal(animal.type, state);
                  const titleMap: Record<AnimalType, string> = {
                    cow: 'Корова',
                    chicken: 'Курица',
                    goat: 'Коза',
                    sheep: 'Овца',
                    pig: 'Поросёнок',
                    goose: 'Гусь'
                  };
                  return (
                    <div
                      key={animal.id}
                      className="tile animal"
                      style={{ opacity: 0.7, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                    >
                      <div className="tile-header">
                        <span className="tile-name">{titleMap[animal.type]}</span>
                        <span className="tile-level">🔒</span>
                      </div>
                      <div className="tile-main">
                        <span className="tile-icon">🐾</span>
                        <div className="tile-yield">
                          <div style={{ fontSize: 10, color: '#9ca3af' }}>
                            Откроется при выполнении условий
                          </div>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => handleUnlockAnimal(animal.id)}
                            disabled={!canUnlock || state.resources.gems < 30}
                            style={{ marginTop: 4, fontSize: 10 }}
                          >
                            Открыть за 30 💎
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }
                const boostCost = getBoostCost(animal.timer);
                const upgradeCost = getUpgradeCost(animal.level);
                const gemLevel = animal.gemUpgradeLevel ?? 0;
                const maxGemLevel = getAnimalGemMaxLevel(animal.type);
                return (
                  <FarmTile
                    key={animal.id}
                    slot={animal}
                    kind="animal"
                    onAction={() => {
                      if (!animal.timer) {
                        handleFeed(animal.id);
                      } else if (isTimerReady(animal.timer)) {
                        handleCollectProduct(animal.id);
                      }
                    }}
                    onBoost={() => handleBoostAnimal(animal.id)}
                    onUpgrade={() => handleUpgradeAnimal(animal.id)}
                    onGemUpgrade={() => handleGemUpgradeAnimal(animal.id)}
                    canBoost={state.resources.gems >= boostCost && boostCost > 0}
                    canUpgrade={state.resources.coins >= upgradeCost}
                    canGemUpgrade={
                      state.resources.gems >= (animal.type === 'cow' ? 30 : animal.type === 'chicken' ? 20 : 60) &&
                      gemLevel < maxGemLevel
                    }
                    boostCost={boostCost}
                    upgradeCost={upgradeCost}
                    gemUpgradeLevel={gemLevel}
                    maxGemUpgradeLevel={maxGemLevel}
                  />
                );
              })}
            </div>
          </>
        )}

        {tab === 'market' && (
          <>
            <div className="section-title-row">
              <div className="section-title">Рынок и лавка</div>
              <div className="section-caption">
                Продавай продукцию и покупай корм, забирай ежедневные бонусы.
              </div>
            </div>
            <div style={{ fontSize: 12, marginBottom: 8, color: '#9ca3af' }}>
              Урожай:
              {' '}
              🍅 {(state.resources?.tomato ?? 0).toLocaleString('ru-RU')}
              {' · '}
              🥒 {(state.resources?.cucumber ?? 0).toLocaleString('ru-RU')}
              {' · '}
              🥛 {(state.resources?.milk ?? 0).toLocaleString('ru-RU')}
              {' · '}
              🥚 {(state.resources?.egg ?? 0).toLocaleString('ru-RU')}
              {' · '}
              🌽 {(state.resources?.corn ?? 0).toLocaleString('ru-RU')}
              {' · '}
              🍉 {(state.resources?.watermelon ?? 0).toLocaleString('ru-RU')}
              {' · '}
              🍎 {(state.resources?.apple ?? 0).toLocaleString('ru-RU')}
              {' · '}
              🧀 {(state.resources?.cheese ?? 0).toLocaleString('ru-RU')}
              {' · '}
              🥩 {(state.resources?.meat ?? 0).toLocaleString('ru-RU')}
              {' · '}
              🪶 {(state.resources?.feathers ?? 0).toLocaleString('ru-RU')}
              {' · '}
              🧶 {(state.resources?.wool ?? 0).toLocaleString('ru-RU')}
            </div>
            {API_BASE && (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleDailyClaim}
                  style={{ marginBottom: 6 }}
                >
                  🎁 Забрать ежедневную награду
                </button>
                {dailyMessage && (
                  <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>{dailyMessage}</div>
                )}
                {dailyInfo?.streak && (
                  <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 6 }}>
                    Марафон: день {dailyInfo.streak} из 5 (день 1: 20🪙+5🥣, 2: 30+5, 3: 40+5, 4: 50+5, 5: 100💎+20🥣)
                  </div>
                )}
              </>
            )}
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSell}
            >
              Продать всё на рынке
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleBuyFeed}
              style={{ marginTop: 6 }}
            >
              Купить корм (5 шт. за 20 монет)
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleExchangeGemsToCoins}
              style={{ marginTop: 6 }}
              disabled={(state.resources.gems ?? 0) < 10}
            >
              Обменять 10 💎 на 100 🪙
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleExchangeCoinsToGems}
              style={{ marginTop: 6 }}
              disabled={(state.resources.coins ?? 0) < 100000}
            >
              Обменять 100 000 🪙 на 10 000 💎
            </button>
            {/* Тестовые подписи больше не показываем — на рынке уже финальная логика */}
          </>
        )}

        {tab === 'referrals' && (
          <>
            <div className="section-title-row">
              <div className="section-title">Реферальная программа</div>
              <div className="section-caption">
                Делись ссылкой и получай гемы за друзей.
              </div>
            </div>
            {referralStats !== null && (
              <div style={{ fontSize: 12, color: '#e5e7eb', marginBottom: 8, display: 'flex', gap: 12 }}>
                <span>Приглашено: <strong>{referralStats.referredCount}</strong></span>
                <span>Награда: <strong>{referralStats.rewardsGems} 💎</strong></span>
              </div>
            )}
            <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span>Твой юзернейм:</span>
              {editingUsername ? (
                <>
                  <input
                    type="text"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    placeholder="Введи юзернейм"
                    style={{
                      flex: 1,
                      minWidth: 120,
                      padding: '6px 10px',
                      borderRadius: 8,
                      border: '1px solid rgba(148,163,184,0.5)',
                      background: 'rgba(15,23,42,0.9)',
                      color: '#e5e7eb',
                      fontSize: 12
                    }}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      const v = usernameInput.trim();
                      try {
                        if (v) window.localStorage.setItem(getCustomUsernameKey(telegramCtx.userId), v);
                        else window.localStorage.removeItem(getCustomUsernameKey(telegramCtx.userId));
                      } catch {}
                      setCustomUsername(v);
                      setEditingUsername(false);
                    }}
                    style={{ fontSize: 12, padding: '6px 12px' }}
                  >
                    OK
                  </button>
                </>
              ) : (
                <>
                  <strong style={{ color: '#e5e7eb' }}>
                    {customUsername ? `@${customUsername.replace(/^@/, '')}` : (telegramCtx.username ? `@${telegramCtx.username}` : '—')}
                  </strong>
                  <button
                    type="button"
                    onClick={() => {
                      setUsernameInput(customUsername || telegramCtx.username || '');
                      setEditingUsername(true);
                    }}
                    title="Изменить юзернейм"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      border: '1px solid rgba(148,163,184,0.5)',
                      background: 'rgba(30,41,59,0.8)',
                      color: '#94a3b8',
                      fontSize: 14,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    ✏️
                  </button>
                </>
              )}
            </div>
            {state.referrerId && (
              <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>
                Вас пригласил: <strong style={{ color: '#e5e7eb' }}>{state.referrerUsername ? `@${state.referrerUsername}` : 'пользователь'}</strong>
              </div>
            )}
            {isAdmin && (
              <div style={{ marginTop: 12, padding: 8, borderRadius: 8, border: '1px dashed rgba(148,163,184,0.6)', background: 'rgba(15,23,42,0.8)' }}>
                <div style={{ fontSize: 11, color: '#f97316', marginBottom: 4 }}>Админ: разовая награда игроку</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <input
                    type="text"
                    placeholder="ID игрока (userId)"
                    value={adminRewardUserId}
                    onChange={(e) => setAdminRewardUserId(e.target.value)}
                    style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(148,163,184,0.6)', fontSize: 12, background: 'rgba(15,23,42,0.9)', color: '#e5e7eb' }}
                  />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      type="number"
                      min={1}
                      placeholder="Количество"
                      value={adminRewardAmount}
                      onChange={(e) => setAdminRewardAmount(e.target.value)}
                      style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(148,163,184,0.6)', fontSize: 12, background: 'rgba(15,23,42,0.9)', color: '#e5e7eb' }}
                    />
                    <select
                      value={adminRewardResource}
                      onChange={(e) => setAdminRewardResource(e.target.value as 'gems' | 'coins')}
                      style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(148,163,184,0.6)', fontSize: 12, background: 'rgba(15,23,42,0.9)', color: '#e5e7eb' }}
                    >
                      <option value="gems">💎 Гемы</option>
                      <option value="coins">🪙 Монеты</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ fontSize: 12, padding: '6px 10px' }}
                    onClick={async () => {
                      const amt = Math.floor(Number(adminRewardAmount || '0'));
                      if (!adminRewardUserId.trim() || !amt || amt <= 0) {
                        setAdminRewardStatus('Укажи ID игрока и положительное число.');
                        return;
                      }
                      setAdminRewardStatus('Отправляю награду…');
                      const res = await adminReward(telegramCtx.userId, adminRewardUserId.trim(), adminRewardResource, amt);
                      if (res?.ok) {
                        setAdminRewardStatus('Награда отправлена.');
                      } else {
                        setAdminRewardStatus('Ошибка при отправке награды.');
                      }
                    }}
                  >
                    Начислить {adminRewardAmount || '?'} {adminRewardResource === 'gems' ? '💎' : '🪙'}
                  </button>
                  {adminRewardStatus && (
                    <div style={{ fontSize: 10, color: '#9ca3af' }}>{adminRewardStatus}</div>
                  )}
                </div>
              </div>
            )}
            <div
              style={{
                fontSize: 11,
                background: 'rgba(15,23,42,0.9)',
                borderRadius: 12,
                padding: 8,
                border: '1px solid rgba(148,163,184,0.4)',
                wordBreak: 'break-all'
              }}
            >
              <div style={{ marginBottom: 4 }}>Твоя реферальная ссылка:</div>
              <div style={{ marginBottom: 6 }}>
                https://t.me/Youdic_Bot?start=ref_{telegramCtx.userId}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCopyReferral}
                  style={{ flex: 1, minWidth: 120 }}
                >
                  Скопировать ссылку
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    const text = encodeURIComponent('Заходи в мою томатную ферму и получи бонус:');
                    const url = encodeURIComponent(referralLink);
                    const shareUrl = `https://t.me/share/url?url=${url}&text=${text}`;
                    window.open(shareUrl, '_blank');
                  }}
                  style={{ flex: 1, minWidth: 120 }}
                >
                  Отправить другу
                </button>
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 10 }}>
              За первых трёх друзей ты получаешь по 10 💎, а когда пригласишь 5 — дополнительные 25 💎.
            </div>
          </>
        )}

        {tab === 'shop' && (
          <>
            <div className="section-title-row">
              <div className="section-title">Магазин</div>
              <div className="section-caption">
                Покупай гемы за Telegram Stars ⭐
              </div>
            </div>
            {telegramCtx.isTelegram && !API_BASE && (
              <div style={{ padding: 10, marginBottom: 10, borderRadius: 10, background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.5)', fontSize: 12 }}>
                ⚠️ Сервер не подключён — гемы не сохранятся. В Cloudflare Pages → Settings → Environment variables добавь <strong>VITE_API_URL</strong> = <code style={{ fontSize: 11 }}>https://open-farm-1.onrender.com</code>, затем пересобери и задеплой проект.
              </div>
            )}
            {pendingPaymentConfirm && API_BASE && telegramCtx.userId && (
              <div style={{ padding: 10, marginBottom: 10, borderRadius: 10, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.5)', fontSize: 12 }}>
                <div style={{ marginBottom: 6 }}>Оплатили, но гемы не пришли? Нажмите — начислим по последней покупке:</div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={async () => {
                    const payload = pendingPaymentConfirm;
                    if (!payload) return;
                    const r = 'packageId' in payload
                      ? await confirmPaid(telegramCtx.userId!, { packageId: payload.packageId })
                      : await confirmPaid(telegramCtx.userId!, { gems: payload.gems });
                    if (r?.ok) {
                      setPendingPaymentConfirm(null);
                      refreshFarmState();
                      setTimeout(refreshFarmState, 400);
                      if (typeof (window as any).Telegram?.WebApp?.showAlert === 'function') {
                        (window as any).Telegram.WebApp.showAlert('Гемы начислены. Баланс обновлён.');
                      } else {
                        alert('Гемы начислены.');
                      }
                    } else {
                      if (typeof (window as any).Telegram?.WebApp?.showAlert === 'function') {
                        (window as any).Telegram.WebApp.showAlert('Не удалось начислить. Попробуйте ещё раз.');
                      } else {
                        alert('Не удалось начислить.');
                      }
                    }
                  }}
                  style={{ fontSize: 12 }}
                >
                  Я оплатил — начислить гемы
                </button>
              </div>
            )}
            {isAdmin && API_BASE && telegramCtx.userId && (
              <>
                <div style={{ marginBottom: 8 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={async () => {
                      const show = (msg: string) => {
                        if (typeof (window as any).Telegram?.WebApp?.showAlert === 'function') {
                          (window as any).Telegram.WebApp.showAlert(msg);
                        } else {
                          alert(msg);
                        }
                      };
                      const uiGems = state.resources.gems ?? 0;
                      let msg = `ОПЛАТА\nuserId: ${telegramCtx.userId}\nAPI: ${API_BASE}\nUI gems: ${uiGems}\n`;
                      try {
                        const healthRes = await fetch(`${API_BASE}/health`, { credentials: 'include' });
                        msg += `health: ${healthRes.status}\n`;
                        if (!healthRes.ok) {
                          show(msg);
                          return;
                        }
                        const meRes = await fetch(
                          `${API_BASE}/api/me?userId=${encodeURIComponent(telegramCtx.userId!)}`,
                          { credentials: 'include' }
                        );
                        msg += `api/me: ${meRes.status}\n`;
                        if (!meRes.ok) {
                          show(msg);
                          return;
                        }
                        const data = await meRes.json();
                        const serverGems = data?.resources?.gems ?? 0;
                        msg += `server gems: ${serverGems}\n`;
                        show(msg);
                      } catch (e: any) {
                        msg += `error: ${e?.message || String(e)}`;
                        show(msg);
                      }
                    }}
                    style={{ fontSize: 12, marginBottom: 4 }}
                  >
                    Диагностика оплаты (admin)
                  </button>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={async () => {
                      const show = (msg: string) => {
                        if (typeof (window as any).Telegram?.WebApp?.showAlert === 'function') {
                          (window as any).Telegram.WebApp.showAlert(msg);
                        } else {
                          alert(msg);
                        }
                      };
                      const r = state.resources;
                      let msg = `ПРОГРЕСС (монеты/урожай)\nuserId: ${telegramCtx.userId}\nAPI: ${API_BASE}\n`;
                      msg += `UI coins: ${r.coins ?? 0}\n`;
                      msg += `UI tomato: ${r.tomato ?? 0}, cucumber: ${r.cucumber ?? 0}, corn: ${r.corn ?? 0}, watermelon: ${r.watermelon ?? 0}, apple: ${r.apple ?? 0}\n`;
                      msg += `UI milk: ${r.milk ?? 0}, egg: ${r.egg ?? 0}, cheese: ${r.cheese ?? 0}, meat: ${r.meat ?? 0}, feathers: ${r.feathers ?? 0}, wool: ${r.wool ?? 0}\n`;
                      try {
                        // 1) Отправляем текущее состояние на сервер.
                        const syncRes = await fetch(`${API_BASE}/api/farm/sync`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'include',
                          body: JSON.stringify({
                            userId: telegramCtx.userId,
                            state,
                            username: telegramCtx.username ?? undefined
                          })
                        });
                        msg += `sync status: ${syncRes.status}\n`;
                        // 2) Сразу читаем состояние с сервера.
                        const meRes = await fetch(
                          `${API_BASE}/api/me?userId=${encodeURIComponent(telegramCtx.userId!)}`,
                          { credentials: 'include' }
                        );
                        msg += `api/me: ${meRes.status}\n`;
                        if (!meRes.ok) {
                          show(msg);
                          return;
                        }
                        const data = await meRes.json();
                        const sr = data?.resources || {};
                        msg += `SERVER coins: ${sr.coins ?? 0}\n`;
                        const fields = [
                          'tomato',
                          'cucumber',
                          'corn',
                          'watermelon',
                          'apple',
                          'milk',
                          'egg',
                          'cheese',
                          'meat',
                          'feathers',
                          'wool'
                        ] as const;
                        let anyMismatch = false;
                        for (const key of fields) {
                          const uiVal = (r as any)[key] ?? 0;
                          const srvVal = (sr as any)[key] ?? 0;
                          if (uiVal !== srvVal) {
                            anyMismatch = true;
                            msg += `MISMATCH ${key}: ui=${uiVal}, server=${srvVal}\n`;
                          }
                        }
                        const cropsEqual =
                          JSON.stringify(state.crops) === JSON.stringify(data?.crops ?? []);
                        const animalsEqual =
                          JSON.stringify(state.animals) === JSON.stringify(data?.animals ?? []);
                        msg += `crops equal: ${cropsEqual}\n`;
                        msg += `animals equal: ${animalsEqual}\n`;
                        if (anyMismatch || !cropsEqual || !animalsEqual) {
                          msg += '⚠️ Серверные данные отличаются от UI — проблема сохранения прогресса.\n';
                        } else {
                          msg += 'Ресурсы и слоты совпадают — проблема, скорее всего, в другом месте UI.\n';
                        }
                        show(msg);
                      } catch (e: any) {
                        msg += `error: ${e?.message || String(e)}`;
                        show(msg);
                      }
                    }}
                    style={{ fontSize: 12 }}
                  >
                    Диагностика прогресса (admin)
                  </button>
                </div>
              </>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {gemPackages.map((pkg) => (
                <div
                  key={pkg.id}
                  style={{
                    padding: 10,
                    borderRadius: 14,
                    background: 'radial-gradient(circle at top, #166534 0, #020617 60%)',
                    border: '1px solid rgba(34,197,94,0.6)',
                    fontSize: 12
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{pkg.title}</div>
                  <div style={{ marginBottom: 6, color: '#9ca3af' }}>
                    +{pkg.gems} 💎 за {pkg.stars} ⭐
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => handleBuyGems(pkg.id)}
                    disabled={buyingPackage === pkg.id}
                  >
                    {buyingPackage === pkg.id ? 'Загрузка...' : `Купить за ${pkg.stars} ⭐`}
                  </button>
                </div>
              ))}
              
              {/* Кастомная покупка по курсу 1 ⭐ = 5 💎 */}
              <div
                style={{
                  padding: 10,
                  borderRadius: 14,
                  background: 'radial-gradient(circle at top, #0f172a 0, #020617 60%)',
                  border: '1px solid rgba(148,163,184,0.5)',
                  fontSize: 12,
                  color: '#e5e7eb'
                }}
              >
                <div style={{ marginBottom: 6, fontWeight: 600 }}>Своя сумма</div>
                <div style={{ marginBottom: 6, fontSize: 11, color: '#9ca3af' }}>
                  Введи, сколько гемов хочешь купить. Курс: 1 ⭐ = 5 💎.
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                  <input
                    type="number"
                    min={1}
                    value={customGems}
                    onChange={(e) => setCustomGems(e.target.value)}
                    placeholder="Например, 80"
                    style={{
                      flex: 1,
                      borderRadius: 999,
                      border: '1px solid rgba(148,163,184,0.6)',
                      background: 'rgba(15,23,42,0.9)',
                      color: '#e5e7eb',
                      padding: '6px 10px',
                      fontSize: 12
                    }}
                  />
                  <div style={{ alignSelf: 'center', fontSize: 11, color: '#9ca3af' }}>
                    ≈ {customStars || 0} ⭐
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!parsedCustomGems || customBuying}
                  onClick={handleBuyCustomGems}
                >
                  {customBuying
                    ? 'Загрузка...'
                    : parsedCustomGems
                      ? `Купить ${parsedCustomGems} 💎 за ${customStars} ⭐`
                      : 'Введи количество гемов'}
                </button>
              </div>

              {/* На iPhone при открытии из меню оплата часто не открывается — даём переход в бота */}
              {isIOS() && (
                <div
                  style={{
                    padding: 10,
                    borderRadius: 14,
                    background: 'rgba(59,130,246,0.15)',
                    border: '1px solid rgba(59,130,246,0.5)',
                    fontSize: 12,
                    color: '#e5e7eb'
                  }}
                >
                  <div style={{ marginBottom: 8 }}>
                    На iPhone оплата из мини-приложения может не открываться. Нажмите кнопку ниже — откроется чат с ботом (мини-приложение закроется). В чате введите <strong>/donate</strong> и выберите пакет или «Своя сумма».
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      const tg = (window as any).Telegram?.WebApp;
                      if (tg?.openTelegramLink) {
                        tg.openTelegramLink(BOT_LINK);
                        setTimeout(() => tg?.close?.(), 400);
                      } else if (tg?.openLink) {
                        tg.openLink(BOT_LINK);
                        setTimeout(() => tg?.close?.(), 400);
                      } else {
                        window.location.href = BOT_LINK;
                      }
                    }}
                  >
                    Открыть бота для оплаты
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'stats' && (
          <>
            <div className="section-title-row">
              <div className="section-title">📊 Статистика</div>
              <div className="section-caption">
                Твоя ферма и цели
              </div>
            </div>

            {/* Статистика игрока */}
            <div
              style={{
                padding: 12,
                borderRadius: 14,
                background: 'rgba(15,23,42,0.9)',
                border: '1px solid rgba(148,163,184,0.4)',
                fontSize: 13,
                marginBottom: 10
              }}
            >
              <div style={{ marginBottom: 8, fontWeight: 600 }}>Твоя ферма</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <div style={{ color: '#9ca3af', fontSize: 11 }}>
                    Собрано урожая за неделю (цель {WEEKLY_HARVEST_GOAL})
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>
                    {weekly.harvestsThisWeek.toLocaleString('ru-RU')}
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${Math.min(1, weekly.harvestsThisWeek / WEEKLY_HARVEST_GOAL) * 100}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div style={{ color: '#9ca3af', fontSize: 11 }}>
                    Заработано монет за неделю (цель {WEEKLY_COINS_GOAL})
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>
                    {weekly.coinsEarnedThisWeek.toLocaleString('ru-RU')}
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${Math.min(1, weekly.coinsEarnedThisWeek / WEEKLY_COINS_GOAL) * 100}%` }}
                    />
                  </div>
                </div>
                {canClaimWeekly && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleClaimWeeklyReward}
                    style={{ marginTop: 4 }}
                  >
                    Забрать {WEEKLY_REWARD_COINS} монет (цикл сбросится)
                  </button>
                )}
              </div>
            </div>

            {/* Маленькая цель / достижение */}
            <div
              style={{
                padding: 10,
                borderRadius: 14,
                background: 'rgba(15,23,42,0.9)',
                border: '1px solid rgba(34,197,94,0.4)',
                fontSize: 12,
                marginBottom: 10
              }}
            >
              <div style={{ marginBottom: 4, fontWeight: 600 }}>Цель</div>
              <div style={{ marginBottom: 4 }}>
                • Собрать любое растение 10 раз: {Math.min(achievements.plantHarvests, 10)}/10
              </div>
              <div style={{ marginBottom: 6 }}>
                • Покормить любое животное 5 раз: {Math.min(achievements.animalFeeds, 5)}/5
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!canClaimAchievement}
                onClick={handleClaimAchievementReward}
              >
                Забрать 100 монет
              </button>
            </div>

            {/* Глобальная статистика только в дев‑режиме (?admin=1) */}
            {isAdmin && (
              <>
                {globalStats ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div
                      style={{
                        padding: 12,
                        borderRadius: 14,
                        background: 'rgba(15,23,42,0.9)',
                        border: '1px solid rgba(148,163,184,0.4)',
                        fontSize: 13
                      }}
                    >
                      <div style={{ marginBottom: 6, fontWeight: 600 }}>Общая статистика игры</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <div style={{ color: '#9ca3af', fontSize: 11 }}>Всего игроков</div>
                          <div style={{ fontSize: 20, fontWeight: 600 }}>{globalStats.totalUsers}</div>
                        </div>
                        <div>
                          <div style={{ color: '#9ca3af', fontSize: 11 }}>Активны сегодня</div>
                          <div style={{ fontSize: 20, fontWeight: 600 }}>{globalStats.activeToday}</div>
                        </div>
                        <div>
                          <div style={{ color: '#9ca3af', fontSize: 11 }}>Рефералов</div>
                          <div style={{ fontSize: 20, fontWeight: 600 }}>{globalStats.totalReferrals}</div>
                        </div>
                        <div>
                          <div style={{ color: '#9ca3af', fontSize: 11 }}>Всего гемов 💎</div>
                          <div style={{ fontSize: 20, fontWeight: 600 }}>
                            {globalStats.totalGems.toLocaleString('ru-RU')}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: 10, color: '#6b7280', textAlign: 'center' }}>
                      Обновлено: {new Date(globalStats.updatedAt).toLocaleString('ru-RU')}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>Загрузка общей статистики...</div>
                )}
              </>
            )}
          </>
        )}
        </div>

        <div className="footer">
          <span>
            {cropsReady || animalsReady
              ? 'Часть урожая уже готова к сбору!'
              : 'Запусти рост и возвращайся позже.'}
          </span>
          <span>v0.6 Youdic</span>
        </div>
      </div>
    </div>
  );
};


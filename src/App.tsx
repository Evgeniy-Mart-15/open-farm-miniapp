import React, { useEffect, useRef, useState } from 'react';
import type { GameState, TabId, CropSlot, AnimalSlot, CropType, AnimalType } from './gameTypes';
import {
  createInitialState,
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
import { getTelegramContext, notifyTelegramReady } from './telegram';
import { getFarm, syncFarm, bindReferral, getReferralStats, claimDailyReward, createInvoice, createCustomInvoice, getGlobalStats, getGemPackages, type ReferralStats, type GlobalStats, type GemPackage, type DailyClaimResult } from './api';

const STORAGE_KEY = 'farm-miniapp-state-v1';

function loadState(): GameState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw) as GameState;
    return ensureExtendedState(parsed);
  } catch {
    return createInitialState();
  }
}

function persistState(state: GameState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
  const ready = isTimerReady(slot.timer);
  const progress = slot.timer ? getTimerProgress(slot.timer) : 0;
  const remaining = slot.timer ? getRemainingMs(slot.timer) : 0;

  const isCrop = kind === 'crop';

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
          <span
            style={{ fontSize: 10, color: '#9ca3af', marginLeft: 4, alignSelf: 'center', cursor: 'help' }}
            title="Улучшение увеличивает урожай ×2 и ускоряет рост таймера. Максимум 2 уровня."
          >
            ?
          </span>
        )}
      </div>
    </div>
  );
};

const API_BASE = import.meta.env.VITE_API_URL || '';

export const App: React.FC = () => {
  const [state, setState] = useState<GameState>(() => loadState());
  const [tab, setTab] = useState<TabId>('fields');
  const [telegramCtx] = useState(() => getTelegramContext());
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
  const [gemPackages, setGemPackages] = useState<GemPackage[]>([]);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  type AchievementsState = {
    plantHarvests: number;
    animalFeeds: number;
    rewardClaimed: boolean;
  };

  const loadAchievements = (): AchievementsState => {
    try {
      const raw = window.localStorage.getItem('farm-miniapp-achievements-v1');
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

  const [achievements, setAchievements] = useState<AchievementsState>(() => loadAchievements());

  const persistAchievements = (next: AchievementsState) => {
    try {
      window.localStorage.setItem('farm-miniapp-achievements-v1', JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (tab === 'referrals' && API_BASE && telegramCtx.userId) {
      getReferralStats(telegramCtx.userId).then(setReferralStats);
      getFarm(telegramCtx.userId).then((data) => {
        if (data?.state?.resources) {
          setState((prev) =>
            ensureExtendedState({
              ...prev,
              resources: data.state.resources,
              crops: data.state.crops ?? prev.crops,
              animals: data.state.animals ?? prev.animals
            })
          );
        }
      });
    }
    if (tab === 'stats' && API_BASE) {
      getGlobalStats().then(setGlobalStats);
    }
  }, [tab, telegramCtx.userId]);

  useEffect(() => {
    persistState(state);
    if (API_BASE && telegramCtx.userId) {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = setTimeout(() => {
        syncFarm(telegramCtx.userId, state).then(() => {
          syncTimeoutRef.current = null;
        });
      }, 800);
    }
    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [state, telegramCtx.userId]);

  useEffect(() => {
    notifyTelegramReady();

    const sp = telegramCtx.startParam;
    if (API_BASE && sp && sp.startsWith('ref_') && telegramCtx.userId) {
      const referrerId = sp.slice(4);
      if (referrerId) bindReferral(telegramCtx.userId, referrerId);
    }

    if (API_BASE && telegramCtx.userId) {
      getFarm(telegramCtx.userId).then((data) => {
        if (data?.state && data.state.level !== undefined) {
          setState((prev) =>
            ensureExtendedState({
              ...prev,
              level: data.state.level,
              resources: data.state.resources,
              crops: data.state.crops ?? [],
              animals: data.state.animals ?? []
            })
          );
        }
      });
      getReferralStats(telegramCtx.userId).then(setReferralStats);
      getGemPackages().then(setGemPackages);
    }

    const id = window.setInterval(() => {
      setState((prev) => ({ ...prev }));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const handlePlant = (id: string) => {
    setState((prev) => plantCrop(prev, id));
  };

  const handleFeed = (id: string) => {
    setState((prev) => feedAnimal(prev, id));
    setAchievements((prev) => {
      const next = { ...prev, animalFeeds: prev.animalFeeds + 1 };
      persistAchievements(next);
      return next;
    });
  };

  const handleHarvestCrop = (id: string) => {
    setState((prev) => harvestCrop(prev, id));
    setAchievements((prev) => {
      const next = { ...prev, plantHarvests: prev.plantHarvests + 1 };
      persistAchievements(next);
      return next;
    });
  };

  const handleCollectProduct = (id: string) => {
    setState((prev) => collectAnimalProduct(prev, id));
  };

  const handleSell = () => {
    setState((prev) => sellProduce(prev));
  };

  const handleBuyFeed = () => {
    setState((prev) => buyFeed(prev));
  };

  const handleBoostCrop = (id: string) => {
    setState((prev) => boostCrop(prev, id));
  };

  const handleBoostAnimal = (id: string) => {
    setState((prev) => boostAnimal(prev, id));
  };

  const handleUpgradeCrop = (id: string) => {
    setState((prev) => upgradeCrop(prev, id));
  };

  const handleUpgradeAnimal = (id: string) => {
    setState((prev) => upgradeAnimal(prev, id));
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
      setDailyMessage(`Награда: ${parts.join(', ')}. Стрик: ${result.streak ?? 1} дн.`);
      setState((prev) => ({
        ...prev,
        resources: {
          ...prev.resources,
          coins: result.resources!.coins,
          gems: result.resources!.gems,
          feed: result.resources!.feed
        }
      }));
    } else if (!result.claimed) {
      const next = result.nextAt
        ? new Date(result.nextAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
        : '';
      setDailyMessage(`Уже забрал сегодня. Следующая награда после ${next}`);
    }
  };

  const coins = state.resources.coins.toLocaleString('ru-RU');
  const gems = state.resources.gems.toLocaleString('ru-RU');
  const feed = state.resources.feed.toLocaleString('ru-RU');

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

  const handleFakePurchase = (amountGems: number) => {
    setState((prev) => ({
      ...prev,
      resources: {
        ...prev.resources,
        gems: prev.resources.gems + amountGems
      }
    }));
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
    setState((prev) => {
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
    setState((prev) => {
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
    setState((prev) => {
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
    setState((prev) => {
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

  const [buyingPackage, setBuyingPackage] = useState<string | null>(null);
  const [customGems, setCustomGems] = useState<string>('');
  const [customBuying, setCustomBuying] = useState<boolean>(false);

  const handleBuyGems = async (packageId: string) => {
    if (!telegramCtx.userId || !API_BASE) {
      alert('Покупка доступна только в Telegram');
      return;
    }
    
    setBuyingPackage(packageId);
    try {
      const result = await createInvoice(telegramCtx.userId, packageId);
      if (result?.invoiceLink) {
        // Открываем invoice через Telegram WebApp API
        const tg = (window as any).Telegram?.WebApp;
        if (tg?.openInvoice) {
          tg.openInvoice(result.invoiceLink, (status: string) => {
            if (status === 'paid') {
              // Обновляем баланс после оплаты
              getFarm(telegramCtx.userId).then((data) => {
                if (data?.state?.resources) {
                  setState((prev) => ({ ...prev, resources: data.state.resources }));
                }
              });
            }
          });
        } else {
          // Fallback — открываем ссылку в новой вкладке
          window.open(result.invoiceLink, '_blank');
        }
      } else {
        alert('Не удалось создать платёж');
      }
    } catch (e) {
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
    if (!parsedCustomGems || parsedCustomGems <= 0) {
      return;
    }
    setCustomBuying(true);
    try {
      const result = await createCustomInvoice(telegramCtx.userId, parsedCustomGems);
      if (result?.invoiceLink) {
        const tg = (window as any).Telegram?.WebApp;
        if (tg?.openInvoice) {
          tg.openInvoice(result.invoiceLink, (status: string) => {
            if (status === 'paid') {
              getFarm(telegramCtx.userId).then((data) => {
                if (data?.state?.resources) {
                  setState((prev) => ({ ...prev, resources: data.state.resources }));
                }
              });
            }
          });
        } else {
          window.open(result.invoiceLink, '_blank');
        }
      } else {
        alert('Не удалось создать платёж');
      }
    } catch (e) {
      alert('Ошибка при создании платежа');
    } finally {
      setCustomBuying(false);
    }
  };

  const canClaimAchievement =
    achievements.plantHarvests >= 10 && achievements.animalFeeds >= 5 && !achievements.rewardClaimed;

  const handleClaimAchievementReward = () => {
    if (!canClaimAchievement) return;
    const rewardCoins = 100;
    setState((prev) => ({
      ...prev,
      resources: {
        ...prev.resources,
        coins: prev.resources.coins + rewardCoins
      }
    }));
    setAchievements((prev) => {
      const next = { ...prev, rewardClaimed: true };
      persistAchievements(next);
      return next;
    });
  };

  return (
    <div className="app-root">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="title">Томатная ферма</div>
            <div className="subtitle">Мини‑апп для Telegram · Ур. {state.level}</div>
          </div>
          <div style={{ fontSize: 18 }}>🚜</div>
        </div>

        <div className="resources">
          <div className="pill">
            <span className="pill-label">Монеты</span>
            <span className="pill-value">🪙 {coins}</span>
          </div>
          <div className="pill secondary">
            <span className="pill-label">Премиум</span>
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
              {state.crops.map((crop) => {
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
              {state.animals.map((animal) => {
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
                    Серия: {dailyInfo.streak} дней (цикл наград 7 дней)
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
              disabled={state.resources.gems < 10}
            >
              Обменять 10 💎 на 100 🪙
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
            <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>
              Твой ID: <strong style={{ color: '#e5e7eb' }}>{telegramCtx.userId}</strong>
              {telegramCtx.isTelegram ? ' (Telegram)' : ' (демо)'}
            </div>
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

              {!telegramCtx.isTelegram && (
                <div
                  style={{
                    padding: 8,
                    borderRadius: 14,
                    background: 'radial-gradient(circle at top, #0f172a 0, #020617 60%)',
                    border: '1px solid rgba(148,163,184,0.5)',
                    fontSize: 11,
                    color: '#9ca3af'
                  }}
                >
                  Демо-режим: покупка Stars работает только в Telegram.
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleFakePurchase(50)}
                    style={{ marginTop: 6 }}
                  >
                    Тестово добавить 50 💎
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
              {(() => {
                const harvestTotal =
                  (state.resources.tomato ?? 0) +
                  (state.resources.cucumber ?? 0) +
                  (state.resources.corn ?? 0) +
                  (state.resources.watermelon ?? 0) +
                  (state.resources.apple ?? 0) +
                  (state.resources.milk ?? 0) +
                  (state.resources.egg ?? 0) +
                  (state.resources.cheese ?? 0) +
                  (state.resources.meat ?? 0) +
                  (state.resources.feathers ?? 0) +
                  (state.resources.wool ?? 0);
                const harvestGoal = 100;
                const coinsGoal = 1000;
                const harvestProgress = Math.min(1, harvestTotal / harvestGoal);
                const coinsProgress = Math.min(1, state.resources.coins / coinsGoal);
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div>
                      <div style={{ color: '#9ca3af', fontSize: 11 }}>
                        Собрано урожая за неделю (цель {harvestGoal})
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 600 }}>
                        {harvestTotal.toLocaleString('ru-RU')}
                      </div>
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{ width: `${harvestProgress * 100}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div style={{ color: '#9ca3af', fontSize: 11 }}>
                        Заработано монет за неделю (цель {coinsGoal})
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 600 }}>
                        {state.resources.coins.toLocaleString('ru-RU')}
                      </div>
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{ width: `${coinsProgress * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })()}
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


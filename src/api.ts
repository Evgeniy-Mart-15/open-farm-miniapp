import type { GameState } from './gameTypes';

const BASE = import.meta.env.VITE_API_URL || '';

/** Ответ GET /api/me — единственный источник истины для game state (гемы, монеты, слоты). */
export interface MeResponse {
  id: string;
  level: number;
  resources: GameState['resources'];
  crops: GameState['crops'];
  animals: GameState['animals'];
  referrerId?: string | null;
  referrerUsername?: string | null;
  username?: string | null;
}

export interface FarmStateResponse {
  state: GameState & { referrerId?: string | null; referrerUsername?: string | null; username?: string | null };
}

export interface SyncResponse {
  state: Pick<GameState, 'level' | 'resources' | 'crops' | 'animals'>;
}

/** Запросить актуальное состояние игрока с сервера. Без этого фронт не узнает об изменении баланса после оплаты. */
export async function getMe(userId: string): Promise<MeResponse | null> {
  if (!BASE) return null;
  try {
    const res = await fetch(`${BASE}/api/me?userId=${encodeURIComponent(userId)}`, {
      credentials: 'include'
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function getFarm(userId: string): Promise<FarmStateResponse | null> {
  if (!BASE) return null;
  try {
    const res = await fetch(`${BASE}/api/farm?userId=${encodeURIComponent(userId)}`, {
      credentials: 'include'
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data;
  } catch {
    return null;
  }
}

export async function syncFarm(userId: string, state: GameState, username?: string | null): Promise<SyncResponse | null> {
  if (!BASE) return null;
  try {
    const res = await fetch(`${BASE}/api/farm/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ userId, state, username: username ?? undefined })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data;
  } catch {
    return null;
  }
}

export async function bindReferral(userId: string, referrerId: string): Promise<boolean> {
  if (!BASE) return false;
  try {
    const res = await fetch(`${BASE}/api/referral/bind`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ userId, referrerId })
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface ReferralStats {
  referredCount: number;
  rewardsGems: number;
}

export async function getReferralStats(userId: string): Promise<ReferralStats | null> {
  if (!BASE) return null;
  try {
    const res = await fetch(`${BASE}/api/referral/stats?userId=${encodeURIComponent(userId)}`, {
      credentials: 'include'
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { referredCount: data.referredCount ?? 0, rewardsGems: data.rewardsGems ?? 0 };
  } catch {
    return null;
  }
}

export interface DailyClaimResult {
  claimed: boolean;
  error?: string;
  nextAt?: number;
  reward?: {
    coins: number;
    gems: number;
    feed: number;
  };
  streak?: number;
  resources?: {
    coins: number;
    gems: number;
    feed: number;
  };
}

export async function claimDailyReward(userId: string): Promise<DailyClaimResult | null> {
  if (!BASE) return null;
  try {
    const res = await fetch(`${BASE}/api/daily/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ userId })
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export interface GemPackage {
  id: string;
  gems: number;
  stars: number;
  title: string;
  description: string;
}

// Локальный fallback, если API не отдал пакеты (должны совпадать с бэкендом).
export const GEM_PACKAGES: GemPackage[] = [
  { id: 'gems_50', gems: 50, stars: 10, title: '50 гемов', description: '50 гемов за 10 ⭐' },
  { id: 'gems_100', gems: 100, stars: 20, title: '100 гемов', description: '100 гемов за 20 ⭐' },
  { id: 'gems_200', gems: 200, stars: 25, title: '200 гемов', description: '200 гемов за 25 ⭐' },
];

export async function getGemPackages(): Promise<GemPackage[]> {
  if (!BASE) return GEM_PACKAGES;
  try {
    const res = await fetch(`${BASE}/api/payments/packages`, { credentials: 'include' });
    if (!res.ok) return GEM_PACKAGES;
    const data = await res.json();
    const list = data?.packages;
    if (Array.isArray(list) && list.length > 0 && list.every((p: any) => p?.id && typeof p.stars === 'number')) {
      return list as GemPackage[];
    }
  } catch {
    // ignore
  }
  return GEM_PACKAGES;
}

export interface CreateInvoiceResponse {
  ok: boolean;
  invoiceLink?: string;
  error?: string;
}

export async function createInvoice(userId: string, packageId: string): Promise<CreateInvoiceResponse | null> {
  if (!BASE) return null;
  try {
    const res = await fetch(`${BASE}/api/payments/create-invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ userId, packageId })
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function createCustomInvoice(userId: string, gems: number): Promise<CreateInvoiceResponse | null> {
  if (!BASE) return null;
  try {
    const res = await fetch(`${BASE}/api/payments/create-custom-invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ userId, gems })
    });
    // Даже если статус не 200, попытаемся прочитать тело,
    // чтобы показать пользователю текст ошибки.
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return (data as any) || { ok: false, error: `HTTP ${res.status}` };
    }
    return data as CreateInvoiceResponse;
  } catch {
    return null;
  }
}

/** Подтвердить оплату из мини-аппа (после callback "paid"), чтобы гемы начислились даже если webhook не дошёл. */
export async function confirmPaid(
  userId: string,
  payload: { packageId: string } | { gems: number }
): Promise<{ ok: boolean; gems?: number } | null> {
  if (!BASE) return null;
  try {
    const res = await fetch(`${BASE}/api/payments/confirm-paid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ userId, ...payload })
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export interface GlobalStats {
  totalUsers: number;
  totalReferrals: number;
  totalCoins: number;
  totalGems: number;
  activeToday: number;
  updatedAt: string;
}

export async function getGlobalStats(): Promise<GlobalStats | null> {
  if (!BASE) return null;
  try {
    const res = await fetch(`${BASE}/api/stats`, {
      credentials: 'include'
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function adminReward(
  adminId: string,
  targetUserId: string,
  resource: 'gems' | 'coins',
  amount: number
): Promise<{ ok: boolean } | null> {
  if (!BASE) return null;
  try {
    const res = await fetch(`${BASE}/api/admin/reward`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ adminId, targetUserId, resource, amount })
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

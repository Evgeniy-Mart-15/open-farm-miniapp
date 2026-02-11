export type CropType = 'tomato' | 'cucumber' | 'corn' | 'watermelon' | 'apple';
export type AnimalType = 'cow' | 'chicken' | 'goat' | 'sheep' | 'pig' | 'goose';

export interface TimerState {
  startedAt: number;
  durationMs: number;
}

export interface CropSlot {
  id: string;
  type: CropType;
  level: number;
  baseYield: number;
  timer: TimerState | null;
  gemUpgradeLevel?: number; // 0-2
  unlocked?: boolean;
   // Сколько урожаев собрано на текущем уровне (0–5)
  harvestsSinceLevel?: number;
}

export interface AnimalSlot {
  id: string;
  type: AnimalType;
  level: number;
  baseYield: number;
  timer: TimerState | null;
  gemUpgradeLevel?: number; // 0-2 (1 для базовых, 2 для премиум)
  unlocked?: boolean;
  // Сколько кормлений/сборов на текущем уровне (0–5)
  harvestsSinceLevel?: number;
}

export interface Resources {
  coins: number;
  gems: number;
  tomato: number;
  cucumber: number;
  corn: number;
  watermelon: number;
  apple: number;
  milk: number;
  egg: number;
  cheese: number;
  meat: number;
  feathers: number;
  wool: number;
  feed: number;
}

export interface GameState {
  level: number;
  resources: Resources;
  crops: CropSlot[];
  animals: AnimalSlot[];
  /** Ревизия состояния, увеличивается при каждом изменении на клиенте (для защиты от отката старым клиентом). */
  revision?: number;
  /** Кто пригласил (userId), заполняется с сервера */
  referrerId?: string | null;
  /** Ник пригласившего (@username), заполняется с сервера */
  referrerUsername?: string | null;
}

export type TabId = 'fields' | 'animals' | 'market' | 'referrals' | 'shop' | 'stats';


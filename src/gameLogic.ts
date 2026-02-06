import type { GameState, CropType, AnimalType, TimerState } from './gameTypes';

const MINUTE = 60 * 1000;

function createTimer(durationMinutes: number): TimerState {
  return {
    startedAt: Date.now(),
    durationMs: durationMinutes * MINUTE
  };
}

export function getTimerProgress(timer: TimerState | null): number {
  if (!timer) return 0;
  const elapsed = Date.now() - timer.startedAt;
  const p = Math.min(1, Math.max(0, elapsed / timer.durationMs));
  return p;
}

export function isTimerReady(timer: TimerState | null): boolean {
  if (!timer) return false;
  return Date.now() - timer.startedAt >= timer.durationMs;
}

export function createInitialState(): GameState {
  const crops = [
    {
      id: 'c1',
      type: 'tomato' as CropType,
      level: 1,
      baseYield: 3,
      timer: null,
      harvestsSinceLevel: 0,
      gemUpgradeLevel: 0,
      unlocked: true
    },
    {
      id: 'c2',
      type: 'cucumber' as CropType,
      level: 1,
      baseYield: 2,
      timer: null,
      harvestsSinceLevel: 0,
      gemUpgradeLevel: 0,
      unlocked: true
    },
    {
      id: 'c3',
      type: 'tomato' as CropType,
      level: 1,
      baseYield: 2,
      timer: null,
      harvestsSinceLevel: 0,
      gemUpgradeLevel: 0,
      unlocked: true
    },
    // Будущие слоты: кукуруза, арбуз, яблоко — изначально заблокированы
    {
      id: 'c4',
      type: 'corn' as CropType,
      level: 1,
      baseYield: 3,
      timer: null,
      harvestsSinceLevel: 0,
      gemUpgradeLevel: 0,
      unlocked: false
    },
    {
      id: 'c5',
      type: 'watermelon' as CropType,
      level: 1,
      baseYield: 4,
      timer: null,
      harvestsSinceLevel: 0,
      gemUpgradeLevel: 0,
      unlocked: false
    },
    {
      id: 'c6',
      type: 'apple' as CropType,
      level: 1,
      baseYield: 5,
      timer: null,
      harvestsSinceLevel: 0,
      gemUpgradeLevel: 0,
      unlocked: false
    }
  ];

  const animals = [
    {
      id: 'a1',
      type: 'cow' as AnimalType,
      level: 1,
      baseYield: 1,
      timer: null,
      harvestsSinceLevel: 0,
      gemUpgradeLevel: 0,
      unlocked: true
    },
    {
      id: 'a2',
      type: 'chicken' as AnimalType,
      level: 1,
      baseYield: 1,
      timer: null,
      harvestsSinceLevel: 0,
      gemUpgradeLevel: 0,
      unlocked: true
    },
    {
      id: 'a3',
      type: 'goat' as AnimalType,
      level: 1,
      baseYield: 1,
      timer: null,
      harvestsSinceLevel: 0,
      gemUpgradeLevel: 0,
      unlocked: false
    },
    {
      id: 'a4',
      type: 'sheep' as AnimalType,
      level: 1,
      baseYield: 1,
      timer: null,
      harvestsSinceLevel: 0,
      gemUpgradeLevel: 0,
      unlocked: false
    },
    {
      id: 'a5',
      type: 'pig' as AnimalType,
      level: 1,
      baseYield: 1,
      timer: null,
      harvestsSinceLevel: 0,
      gemUpgradeLevel: 0,
      unlocked: false
    },
    {
      id: 'a6',
      type: 'goose' as AnimalType,
      level: 1,
      baseYield: 1,
      timer: null,
      harvestsSinceLevel: 0,
      gemUpgradeLevel: 0,
      unlocked: false
    }
  ];

  const state: GameState = {
    level: 1,
    resources: {
      coins: 100,
      gems: 5,
      tomato: 0,
      cucumber: 0,
      corn: 0,
      watermelon: 0,
      apple: 0,
      milk: 0,
      egg: 0,
      cheese: 0,
      meat: 0,
      feathers: 0,
      wool: 0,
      feed: 5
    },
    crops,
    animals
  };

  return state;
}

// Нормализуем ресурсы: все поля из эталона присутствуют, отсутствующие = 0
function normalizeResources(resources: GameState['resources'] | undefined): GameState['resources'] {
  const base = createInitialState().resources;
  if (!resources) return { ...base };
  return {
    ...base,
    ...resources,
    coins: typeof resources.coins === 'number' ? resources.coins : base.coins,
    gems: typeof resources.gems === 'number' ? resources.gems : base.gems,
    tomato: typeof resources.tomato === 'number' ? resources.tomato : (base.tomato ?? 0),
    cucumber: typeof resources.cucumber === 'number' ? resources.cucumber : (base.cucumber ?? 0),
    corn: typeof resources.corn === 'number' ? resources.corn : 0,
    watermelon: typeof resources.watermelon === 'number' ? resources.watermelon : 0,
    apple: typeof resources.apple === 'number' ? resources.apple : 0,
    milk: typeof resources.milk === 'number' ? resources.milk : 0,
    egg: typeof resources.egg === 'number' ? resources.egg : 0,
    cheese: typeof resources.cheese === 'number' ? resources.cheese : 0,
    meat: typeof resources.meat === 'number' ? resources.meat : 0,
    feathers: typeof resources.feathers === 'number' ? resources.feathers : 0,
    wool: typeof resources.wool === 'number' ? resources.wool : 0,
    feed: typeof resources.feed === 'number' ? resources.feed : (base.feed ?? 5)
  };
}

// Дополнительно гарантируем, что в состоянии есть все новые слоты и ресурсы
export function ensureExtendedState(state: GameState): GameState {
  const base = createInitialState();

  const cropsById = new Map(state.crops.map((c) => [c.id, c]));
  const animalsById = new Map(state.animals.map((a) => [a.id, a]));

  const crops = base.crops.map((tpl) => {
    const existing = cropsById.get(tpl.id);
    return {
      ...tpl,
      ...existing,
      harvestsSinceLevel: existing?.harvestsSinceLevel ?? 0
    };
  });

  const animals = base.animals.map((tpl) => {
    const existing = animalsById.get(tpl.id);
    return {
      ...tpl,
      ...existing,
      harvestsSinceLevel: existing?.harvestsSinceLevel ?? 0
    };
  });

  const resources = normalizeResources(state.resources);

  return {
    ...state,
    resources,
    crops,
    animals
  };
}

export function plantCrop(state: GameState, slotId: string): GameState {
  const slot = state.crops.find((c) => c.id === slotId);
  if (!slot) return state;

  // Стоимость посадки зависит от типа культуры
  let cost = 5;
  if (slot.type === 'corn') cost = 10;
  if (slot.type === 'watermelon') cost = 15;
  if (slot.type === 'apple') cost = 20;

  if (state.resources.coins < cost) return state;
  if (slot.timer) return state;

  let durationMinutes: number;
  switch (slot.type) {
    case 'tomato':
      durationMinutes = 3;
      break;
    case 'cucumber':
      durationMinutes = 5;
      break;
    case 'corn':
      durationMinutes = 6;
      break;
    case 'watermelon':
      durationMinutes = 8;
      break;
    case 'apple':
      durationMinutes = 10;
      break;
    default:
      durationMinutes = 5;
  }

  // Учитываем гем-апгрейд (каждый уровень в 2 раза быстрее)
  const gemLevel = slot.gemUpgradeLevel ?? 0;
  durationMinutes = durationMinutes / Math.pow(2, gemLevel);

  const newState: GameState = {
    ...state,
    resources: {
      ...state.resources,
      coins: state.resources.coins - cost
    },
    crops: state.crops.map((c) =>
      c.id === slotId ? { ...c, timer: createTimer(durationMinutes) } : c
    )
  };

  return newState;
}

export function feedAnimal(state: GameState, slotId: string): GameState {
  const slot = state.animals.find((a) => a.id === slotId);
  if (!slot) return state;

  const feedCost = 1;
  if (state.resources.feed < feedCost) return state;
  if (slot.timer) return state;

  let durationMinutes: number;
  switch (slot.type) {
    case 'cow':
      durationMinutes = 10;
      break;
    case 'chicken':
      durationMinutes = 8;
      break;
    case 'goat':
      durationMinutes = 9;
      break;
    case 'sheep':
      durationMinutes = 9;
      break;
    case 'pig':
      durationMinutes = 12;
      break;
    case 'goose':
      durationMinutes = 7;
      break;
    default:
      durationMinutes = 10;
  }

  // Учитываем гем-апгрейд (каждый уровень в 2 раза быстрее)
  const gemLevel = slot.gemUpgradeLevel ?? 0;
  durationMinutes = durationMinutes / Math.pow(2, gemLevel);

  const newState: GameState = {
    ...state,
    resources: {
      ...state.resources,
      feed: state.resources.feed - feedCost
    },
    animals: state.animals.map((a) =>
      a.id === slotId ? { ...a, timer: createTimer(durationMinutes) } : a
    )
  };

  return newState;
}

export function harvestCrop(state: GameState, slotId: string): GameState {
  const slot = state.crops.find((c) => c.id === slotId);
  if (!slot || !slot.timer) return state;
  if (!isTimerReady(slot.timer)) return state;

  const gemLevel = slot.gemUpgradeLevel ?? 0;
  const yieldMultiplier = Math.pow(2, gemLevel);
  const yieldAmount = slot.baseYield * yieldMultiplier;

  const newResources = { ...state.resources };
  if (slot.type === 'tomato') {
    newResources.tomato += yieldAmount;
  } else if (slot.type === 'cucumber') {
    newResources.cucumber += yieldAmount;
  } else if (slot.type === 'corn') {
    newResources.corn += yieldAmount;
  } else if (slot.type === 'watermelon') {
    newResources.watermelon += yieldAmount;
  } else if (slot.type === 'apple') {
    newResources.apple += yieldAmount;
  }

  // Обновляем прогресс уровня: каждые 5 сборов +1 уровень
  const currentHarvests = slot.harvestsSinceLevel ?? 0;
  const totalHarvests = currentHarvests + 1;
  const levelUps = Math.floor(totalHarvests / 5);
  const newHarvestsSinceLevel = totalHarvests % 5;

  const newState: GameState = {
    ...state,
    resources: newResources,
    crops: state.crops.map((c) =>
      c.id === slotId
        ? {
            ...c,
            timer: null,
            level: c.level + levelUps,
            harvestsSinceLevel: newHarvestsSinceLevel
          }
        : c
    )
  };

  return newState;
}

export function collectAnimalProduct(state: GameState, slotId: string): GameState {
  const slot = state.animals.find((a) => a.id === slotId);
  if (!slot || !slot.timer) return state;
  if (!isTimerReady(slot.timer)) return state;

  const gemLevel = slot.gemUpgradeLevel ?? 0;
  const yieldMultiplier = Math.pow(2, gemLevel);
  const yieldAmount = slot.baseYield * yieldMultiplier;

  const newResources = { ...state.resources };
  if (slot.type === 'cow') {
    newResources.milk += yieldAmount;
  } else if (slot.type === 'chicken') {
    newResources.egg += yieldAmount;
  } else if (slot.type === 'goat') {
    newResources.cheese += yieldAmount;
  } else if (slot.type === 'sheep') {
    newResources.wool += yieldAmount;
  } else if (slot.type === 'pig') {
    newResources.meat += yieldAmount;
  } else if (slot.type === 'goose') {
    newResources.feathers += yieldAmount;
  }

  const currentHarvests = slot.harvestsSinceLevel ?? 0;
  const totalHarvests = currentHarvests + 1;
  const levelUps = Math.floor(totalHarvests / 5);
  const newHarvestsSinceLevel = totalHarvests % 5;

  const newState: GameState = {
    ...state,
    resources: newResources,
    animals: state.animals.map((a) =>
      a.id === slotId
        ? {
            ...a,
            timer: null,
            level: a.level + levelUps,
            harvestsSinceLevel: newHarvestsSinceLevel
          }
        : a
    )
  };

  return newState;
}

export function sellProduce(state: GameState): GameState {
  const {
    tomato,
    cucumber,
    corn,
    watermelon,
    apple,
    milk,
    egg,
    cheese,
    meat,
    feathers,
    wool
  } = state.resources;
  const income =
    tomato * 3 +   // 2.55 → 3
    cucumber * 4 + // 3.4  → 4
    corn * 5 +     // 4.25 → 5
    watermelon * 6 + // 7 * 0.85 = 5.95 → 6
    apple * 6 +    // 5.1  → 6
    milk * 9 +     // 10 * 0.85 = 8.5 → 9
    egg * 6 +      // 5.1  → 6
    cheese * 11 +  // 10.2 → 11
    meat * 13 +    // 12.75→ 13
    feathers * 4 + // 3.4  → 4
    wool * 7;      // 6.8  → 7

  if (income === 0) return state;

  return {
    ...state,
    resources: {
      ...state.resources,
      coins: state.resources.coins + income,
      tomato: 0,
      cucumber: 0,
      corn: 0,
      watermelon: 0,
      apple: 0,
      milk: 0,
      egg: 0,
      cheese: 0,
      meat: 0,
      feathers: 0,
      wool: 0
    }
  };
}

export function buyFeed(state: GameState): GameState {
  const packCost = 20;
  const packAmount = 5;
  if (state.resources.coins < packCost) return state;

  return {
    ...state,
    resources: {
      ...state.resources,
      coins: state.resources.coins - packCost,
      feed: state.resources.feed + packAmount
    }
  };
}

// Стоимость ускорения в гемах (1 гем = 1 минута)
export const BOOST_GEM_PER_MINUTE = 1;

// Ускорить таймер (мгновенно завершить) за гемы
export function boostCrop(state: GameState, slotId: string): GameState {
  const slot = state.crops.find((c) => c.id === slotId);
  if (!slot || !slot.timer) return state;
  if (isTimerReady(slot.timer)) return state;

  const remainingMs = slot.timer.durationMs - (Date.now() - slot.timer.startedAt);
  const remainingMinutes = Math.ceil(remainingMs / 60000);
  const gemCost = Math.max(1, remainingMinutes * BOOST_GEM_PER_MINUTE);

  if (state.resources.gems < gemCost) return state;

  return {
    ...state,
    resources: {
      ...state.resources,
      gems: state.resources.gems - gemCost
    },
    crops: state.crops.map((c) =>
      c.id === slotId
        ? { ...c, timer: { ...c.timer!, startedAt: Date.now() - c.timer!.durationMs } }
        : c
    )
  };
}

export function boostAnimal(state: GameState, slotId: string): GameState {
  const slot = state.animals.find((a) => a.id === slotId);
  if (!slot || !slot.timer) return state;
  if (isTimerReady(slot.timer)) return state;

  const remainingMs = slot.timer.durationMs - (Date.now() - slot.timer.startedAt);
  const remainingMinutes = Math.ceil(remainingMs / 60000);
  const gemCost = Math.max(1, remainingMinutes * BOOST_GEM_PER_MINUTE);

  if (state.resources.gems < gemCost) return state;

  return {
    ...state,
    resources: {
      ...state.resources,
      gems: state.resources.gems - gemCost
    },
    animals: state.animals.map((a) =>
      a.id === slotId
        ? { ...a, timer: { ...a.timer!, startedAt: Date.now() - a.timer!.durationMs } }
        : a
    )
  };
}

// Стоимость улучшения слота: уровень * 50 монет
export function getUpgradeCost(level: number): number {
  return level * 50;
}

export function upgradeCrop(state: GameState, slotId: string): GameState {
  const slot = state.crops.find((c) => c.id === slotId);
  if (!slot) return state;

  const cost = getUpgradeCost(slot.level);
  if (state.resources.coins < cost) return state;

  return {
    ...state,
    resources: {
      ...state.resources,
      coins: state.resources.coins - cost
    },
    crops: state.crops.map((c) =>
      c.id === slotId ? { ...c, level: c.level + 1 } : c
    )
  };
}

export function upgradeAnimal(state: GameState, slotId: string): GameState {
  const slot = state.animals.find((a) => a.id === slotId);
  if (!slot) return state;

  const cost = getUpgradeCost(slot.level);
  if (state.resources.coins < cost) return state;

  return {
    ...state,
    resources: {
      ...state.resources,
      coins: state.resources.coins - cost
    },
    animals: state.animals.map((a) =>
      a.id === slotId ? { ...a, level: a.level + 1 } : a
    )
  };
}

// Рассчитать стоимость ускорения в гемах
export function getBoostCost(timer: TimerState | null): number {
  if (!timer) return 0;
  const remainingMs = timer.durationMs - (Date.now() - timer.startedAt);
  if (remainingMs <= 0) return 0;
  return Math.max(1, Math.ceil(remainingMs / 60000) * BOOST_GEM_PER_MINUTE);
}


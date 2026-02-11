import type { GameState, CropType, AnimalType } from './gameTypes';

export function createInitialState(): GameState {
  const crops = [
    { id: 'c1', type: 'tomato' as CropType, level: 1, baseYield: 3, timer: null, harvestsSinceLevel: 0, gemUpgradeLevel: 0, unlocked: true },
    { id: 'c2', type: 'cucumber' as CropType, level: 1, baseYield: 2, timer: null, harvestsSinceLevel: 0, gemUpgradeLevel: 0, unlocked: true },
    { id: 'c3', type: 'tomato' as CropType, level: 1, baseYield: 2, timer: null, harvestsSinceLevel: 0, gemUpgradeLevel: 0, unlocked: true },
    { id: 'c4', type: 'corn' as CropType, level: 1, baseYield: 3, timer: null, harvestsSinceLevel: 0, gemUpgradeLevel: 0, unlocked: false },
    { id: 'c5', type: 'watermelon' as CropType, level: 1, baseYield: 4, timer: null, harvestsSinceLevel: 0, gemUpgradeLevel: 0, unlocked: false },
    { id: 'c6', type: 'apple' as CropType, level: 1, baseYield: 5, timer: null, harvestsSinceLevel: 0, gemUpgradeLevel: 0, unlocked: false }
  ];
  const animals = [
    { id: 'a1', type: 'cow' as AnimalType, level: 1, baseYield: 1, timer: null, harvestsSinceLevel: 0, gemUpgradeLevel: 0, unlocked: true },
    { id: 'a2', type: 'chicken' as AnimalType, level: 1, baseYield: 1, timer: null, harvestsSinceLevel: 0, gemUpgradeLevel: 0, unlocked: true },
    { id: 'a3', type: 'goat' as AnimalType, level: 1, baseYield: 1, timer: null, harvestsSinceLevel: 0, gemUpgradeLevel: 0, unlocked: false },
    { id: 'a4', type: 'sheep' as AnimalType, level: 1, baseYield: 1, timer: null, harvestsSinceLevel: 0, gemUpgradeLevel: 0, unlocked: false },
    { id: 'a5', type: 'pig' as AnimalType, level: 1, baseYield: 1, timer: null, harvestsSinceLevel: 0, gemUpgradeLevel: 0, unlocked: false },
    { id: 'a6', type: 'goose' as AnimalType, level: 1, baseYield: 1, timer: null, harvestsSinceLevel: 0, gemUpgradeLevel: 0, unlocked: false }
  ];
  return {
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
}

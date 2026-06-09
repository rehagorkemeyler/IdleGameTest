const MAX_INVENTORY = 10;
const SOURCE_PAD_INTERVAL = 0.3;
const SOURCE_PAD_MAX_STACK = 5;
const CUSTOMER_SPAWN_INTERVAL = 5;
const MAX_CUSTOMERS = 10;
const CUSTOMER_QUOTA = 2;

const state = {
  totalWorkerSales: 0,
  player: {
    x: 0,
    z: 0,
    isMoving: false,
    inventory: [],
    cashBalance: 0
  },
  maxInventory: MAX_INVENTORY,
  sourcePad: {
    x: -3,
    z: -3,
    items: [],
    lastSpawnTime: 0,
    lastPickupTime: 0,
    interval: SOURCE_PAD_INTERVAL,
    maxStack: SOURCE_PAD_MAX_STACK
  },
  counter: {
    x: 3,
    z: 3,
    customerQueue: [],
    droppedOffItems: 0,
    playerAtCounter: false,
    lastCustomerSpawnTime: 0,
    customerSpawnInterval: CUSTOMER_SPAWN_INTERVAL,
    maxCustomers: MAX_CUSTOMERS,
    customerQuota: CUSTOMER_QUOTA
  },
  cashPile: {
    x: 5,
    z: 1,
    activeCash: []
  },
  unlockZones: [
    {
      id: 'worker_1',
      x: 0,
      z: 3,
      cost: 100,
      currentProgress: 0,
      unlocked: false,
      isUpgradePhase: false
    }
  ],
  workers: []
};

export default state;
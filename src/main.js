import * as THREE from 'three';
import state from './state.js';
import eventBus from './EventBus.js';

let scene, camera, renderer, playerMesh;
const clock = new THREE.Clock();
const itemMeshes = [];
const customerMeshes = [];
const transferringBoxes = [];
const cashMeshes = [];

const CASH_VALUE = 10;
const CASH_PILE_X = 5;
const CASH_PILE_Z = 1;
const CASH_SPACING = 0.35;
const CASH_VACUUM_RADIUS = 0.5;
const CASH_VACUUM_SPEED = 8;

const MOVE_SPEED = 5;
const keys = {};

const PROXIMITY_THRESHOLD = 1.2;
const ITEM_BOX_SIZE = { width: 0.4, height: 0.12, depth: 0.4 };
const STACK_OFFSET_Z = -0.6;
const ITEM_COLORS = [0xff6b6b, 0x4ecdc4, 0xffe66d, 0x95e1d3, 0xf38181];

const CUSTOMER_SPACING = 0.8;
const CUSTOMER_SPEED = 2;
const HANDOFF_INTERVAL = 0.3;

const UNLOCK_X = 0;
const UNLOCK_Z = 3;
const UNLOCK_COST = 100;
const DRAIN_INTERVAL = 0.1;
const DRAIN_AMOUNT = 10;
const UNLOCK_PROXIMITY = 1.0;

const WORKER_SPEED = 2.5;
const WORKER_MAX_CARRY = 10;
const WORKER_HANDOFF_INTERVAL = 0.3;
const WORKER_PICKUP_INTERVAL = 1.0;

let lastHandoffTime = 0;
let counterMesh = null;

let unlockPadMesh = null;
let unlockTextMesh = null;
let unlockCanvas = null;
let unlockCtx = null;
let unlockTexture = null;
let lastDrainTime = 0;
const workerMeshes = [];
const workerStackMeshes = [];

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);

  const aspect = window.innerWidth / window.innerHeight;
  const frustumSize = 15;
  camera = new THREE.OrthographicCamera(
    frustumSize * aspect / -2,
    frustumSize * aspect / 2,
    frustumSize / 2,
    frustumSize / -2,
    0.1,
    1000
  );

  camera.position.set(10, 10, 10);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  document.body.appendChild(renderer.domElement);

  createGrid();
  createPlayer();
  createSourcePad();
  createCounterMesh();
  createUnlockPad();
  setupInput();
  setupEventListeners();

  window.addEventListener('resize', onWindowResize);
}

function createGrid() {
  const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x333333);
  scene.add(gridHelper);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(5, 10, 5);
  scene.add(directionalLight);
}

function createPlayer() {
  const geometry = new THREE.CapsuleGeometry(0.3, 0.6, 8, 16);
  const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
  playerMesh = new THREE.Mesh(geometry, material);
  playerMesh.position.set(state.player.x, 0.45, state.player.z);
  scene.add(playerMesh);
}

function createSourcePad() {
  const padSize = 1.2;
  const geometry = new THREE.BoxGeometry(padSize, 0.1, padSize);
  const material = new THREE.MeshStandardMaterial({ color: 0x3498db });
  const padMesh = new THREE.Mesh(geometry, material);
  padMesh.position.set(state.sourcePad.x, 0.05, state.sourcePad.z);
  scene.add(padMesh);
}

function createCounterMesh() {
  const width = 2;
  const height = 0.3;
  const depth = 0.8;
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const material = new THREE.MeshStandardMaterial({ color: 0x9b59b6 });
  counterMesh = new THREE.Mesh(geometry, material);
  counterMesh.position.set(state.counter.x, height / 2, state.counter.z);
  scene.add(counterMesh);
}

function createUnlockCanvasTexture() {
  unlockCanvas = document.createElement('canvas');
  unlockCanvas.width = 256;
  unlockCanvas.height = 128;
  unlockCtx = unlockCanvas.getContext('2d');
  unlockTexture = new THREE.CanvasTexture(unlockCanvas);
  unlockTexture.needsUpdate = true;
}

function redrawUnlockText(progress, cost, title) {
  const w = unlockCanvas.width;
  const h = unlockCanvas.height;

  unlockCtx.clearRect(0, 0, w, h);

  unlockCtx.fillStyle = 'rgba(20, 20, 40, 0.85)';
  unlockCtx.beginPath();
  unlockCtx.roundRect(4, 4, w - 8, h - 8, 8);
  unlockCtx.fill();

  unlockCtx.font = 'bold 20px monospace';
  unlockCtx.fillStyle = '#ffffff';
  unlockCtx.textAlign = 'center';
  unlockCtx.textBaseline = 'middle';
  unlockCtx.fillText(title, w / 2, 32);

  unlockCtx.font = 'bold 28px monospace';
  unlockCtx.fillStyle = progress >= cost ? '#00ff88' : '#ffcc00';
  unlockCtx.fillText('$' + progress + ' / $' + cost, w / 2, 72);

  const barWidth = 200;
  const barHeight = 12;
  const barX = (w - barWidth) / 2;
  const barY = 96;
  const fillRatio = Math.min(progress / cost, 1);

  unlockCtx.fillStyle = '#333333';
  unlockCtx.fillRect(barX, barY, barWidth, barHeight);

  unlockCtx.fillStyle = fillRatio >= 1 ? '#00ff88' : '#ffcc00';
  unlockCtx.fillRect(barX, barY, barWidth * fillRatio, barHeight);

  unlockTexture.needsUpdate = true;
}

function createUnlockPad() {
  const zone = state.unlockZones[0];

  const padGeometry = new THREE.BoxGeometry(1.2, 0.08, 1.2);
  const padMaterial = new THREE.MeshStandardMaterial({ color: 0x555555 });
  unlockPadMesh = new THREE.Mesh(padGeometry, padMaterial);
  unlockPadMesh.position.set(zone.x, 0.04, zone.z);
  scene.add(unlockPadMesh);

  createUnlockCanvasTexture();
  redrawUnlockText(zone.currentProgress, zone.cost, '1st Employee');

  const textGeometry = new THREE.PlaneGeometry(1.4, 0.7);
  const textMaterial = new THREE.MeshBasicMaterial({
    map: unlockTexture,
    transparent: true,
    side: THREE.DoubleSide
  });
  unlockTextMesh = new THREE.Mesh(textGeometry, textMaterial);
  unlockTextMesh.position.set(zone.x, 0.5, zone.z);
  unlockTextMesh.rotation.x = -Math.PI / 4;
  scene.add(unlockTextMesh);
}

function setupInput() {
  window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
  });

  window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
  });
}

function setupEventListeners() {
  eventBus.on('player_at_counter', (isAtCounter) => {
    state.counter.playerAtCounter = isAtCounter;
    if (!isAtCounter) {
      lastHandoffTime = 0;
    }
  });

  eventBus.on('customer_satisfied', (customerIndex) => {
    removeCustomer(customerIndex);
    spawnCashPile();
  });
}

function handleMovement(delta) {
  let moved = false;
  let dx = 0;
  let dz = 0;

  if (keys['w']) { dz -= 1; moved = true; }
  if (keys['s']) { dz += 1; moved = true; }
  if (keys['a']) { dx -= 1; moved = true; }
  if (keys['d']) { dx += 1; moved = true; }

  if (moved) {
    const length = Math.sqrt(dx * dx + dz * dz);
    if (length > 0) {
      dx /= length;
      dz /= length;
    }

    state.player.x += dx * MOVE_SPEED * delta;
    state.player.z += dz * MOVE_SPEED * delta;

    playerMesh.position.x = state.player.x;
    playerMesh.position.z = state.player.z;
  }

  state.player.isMoving = moved;
}

function checkSourcePadProximity() {
  const dx = state.player.x - state.sourcePad.x;
  const dz = state.player.z - state.sourcePad.z;
  const distance = Math.sqrt(dx * dx + dz * dz);
  return distance < PROXIMITY_THRESHOLD;
}

function checkCounterProximity() {
  const dx = state.player.x - state.counter.x;
  const dz = state.player.z - state.counter.z;
  const distance = Math.sqrt(dx * dx + dz * dz);
  const isAtCounter = distance < PROXIMITY_THRESHOLD;
  
  if (isAtCounter !== state.counter.playerAtCounter) {
    eventBus.emit('player_at_counter', isAtCounter);
  }
  
  return isAtCounter;
}

function transferItems(elapsed) {
  if (!checkSourcePadProximity()) {
    state.sourcePad.lastPickupTime = 0;
    return;
  }
  if (state.player.inventory.length >= state.maxInventory) return;
  if (state.sourcePad.items.length === 0) return;

  if (state.sourcePad.lastPickupTime === 0) {
    state.sourcePad.lastPickupTime = elapsed;
  } else if (elapsed - state.sourcePad.lastPickupTime < state.sourcePad.interval) {
    return;
  }

  const itemId = state.sourcePad.items.pop();
  state.player.inventory.push(itemId);
  spawnItemMesh(itemId);
  state.sourcePad.lastPickupTime = elapsed;
}

function spawnItemMesh(itemId) {
  const colorIndex = itemId % ITEM_COLORS.length;
  const geometry = new THREE.BoxGeometry(ITEM_BOX_SIZE.width, ITEM_BOX_SIZE.height, ITEM_BOX_SIZE.depth);
  const material = new THREE.MeshStandardMaterial({ color: ITEM_COLORS[colorIndex] });
  const mesh = new THREE.Mesh(geometry, material);

  const stackIndex = state.player.inventory.length - 1;
  mesh.position.set(
    state.player.x,
    0.45 + 0.6 + (stackIndex * ITEM_BOX_SIZE.height),
    state.player.z + STACK_OFFSET_Z
  );

  scene.add(mesh);
  itemMeshes.push(mesh);
}

function updateStackPositions() {
  for (let i = 0; i < itemMeshes.length; i++) {
    const mesh = itemMeshes[i];
    mesh.position.x = state.player.x;
    mesh.position.z = state.player.z + STACK_OFFSET_Z;
    mesh.position.y = 0.45 + 0.6 + (i * ITEM_BOX_SIZE.height);
  }
}

function produceSourceItems(elapsed) {
  const pad = state.sourcePad;
  if (elapsed - pad.lastSpawnTime >= pad.interval && pad.items.length < pad.maxStack) {
    const itemId = Date.now() % 1000;
    pad.items.push(itemId);
    pad.lastSpawnTime = elapsed;
  }
}

function getCustomerSpawnInterval() {
  if (state.totalWorkerSales < 20) return 5.0;
  if (state.totalWorkerSales < 30) return 3.5;
  return 2.0;
}

function produceCustomers(elapsed) {
  const counter = state.counter;
  const interval = getCustomerSpawnInterval();
  if (elapsed - counter.lastCustomerSpawnTime >= interval && 
      counter.customerQueue.length < counter.maxCustomers) {
    spawnCustomer();
    counter.lastCustomerSpawnTime = elapsed;
  }
}

function spawnCustomer() {
  const spawnX = 5;
  const spawnZ = 15;

  const customer = {
    id: Date.now(),
    itemsReceived: 0,
    status: 'walking',
    x: spawnX,
    z: spawnZ,
    targetX: state.counter.x,
    targetZ: state.counter.z
  };

  const geometry = new THREE.CapsuleGeometry(0.25, 0.5, 8, 16);
  const material = new THREE.MeshStandardMaterial({ color: 0x95a5a6 });
  const mesh = new THREE.Mesh(geometry, material);
  
  mesh.position.set(spawnX, 0.5, spawnZ);
  scene.add(mesh);

  customer.mesh = mesh;
  state.counter.customerQueue.push(customer);
  customerMeshes.push(mesh);
}

function updateCustomerMovement(delta) {
  const queue = state.counter.customerQueue;
  const cx = state.counter.x;
  const cz = state.counter.z;

  queue.sort((a, b) => {
    const meshA = a.mesh;
    const meshB = b.mesh;
    const distA = Math.sqrt((meshA.position.x - cx) ** 2 + (meshA.position.z - cz) ** 2);
    const distB = Math.sqrt((meshB.position.x - cx) ** 2 + (meshB.position.z - cz) ** 2);
    return distA - distB;
  });

  for (let i = 0; i < queue.length; i++) {
    const customer = queue[i];
    const mesh = customer.mesh;

    customer.targetX = cx;
    customer.targetZ = cz + (i + 1) * CUSTOMER_SPACING;

    const dx = customer.targetX - mesh.position.x;
    const dz = customer.targetZ - mesh.position.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    if (distance > 0.2) {
      const moveX = (dx / distance) * CUSTOMER_SPEED * delta;
      const moveZ = (dz / distance) * CUSTOMER_SPEED * delta;

      mesh.position.x += moveX;
      mesh.position.z += moveZ;
    } else {
      mesh.position.x = customer.targetX;
      mesh.position.z = customer.targetZ;
      customer.status = 'waiting';
    }
  }
}

function transferItemsToCounter(elapsed) {
  if (!checkCounterProximity()) return;
  if (state.player.inventory.length === 0) return;
  if (state.counter.customerQueue.length === 0) return;

  if (elapsed - lastHandoffTime < HANDOFF_INTERVAL) return;

  const customer = state.counter.customerQueue[0];
  if (customer.status !== 'waiting') return;
  if (customer.itemsReceived >= state.counter.customerQuota) return;

  const topStackIndex = state.player.inventory.length - 1;
  const boxMesh = itemMeshes[topStackIndex];

  if (boxMesh) {
    const targetX = state.counter.x;
    const targetY = 0.3 + (customer.itemsReceived * ITEM_BOX_SIZE.height);
    const targetZ = state.counter.z - 0.5;

    const transferBox = {
      mesh: boxMesh,
      startPosition: boxMesh.position.clone(),
      targetPosition: new THREE.Vector3(targetX, targetY, targetZ),
      progress: 0,
      customerId: customer.id
    };

    transferringBoxes.push(transferBox);

    state.player.inventory.pop();
    itemMeshes.pop();

    customer.itemsReceived++;
    state.counter.droppedOffItems++;
    lastHandoffTime = elapsed;

    if (customer.itemsReceived >= state.counter.customerQuota) {
      eventBus.emit('customer_satisfied', 0);
    }
  }
}

function updateTransferringBoxes(delta) {
  for (let i = transferringBoxes.length - 1; i >= 0; i--) {
    const box = transferringBoxes[i];
    box.progress += delta * 2;

    if (box.progress >= 1) {
      box.mesh.position.copy(box.targetPosition);
      scene.remove(box.mesh);
      transferringBoxes.splice(i, 1);
    } else {
      const eased = 1 - Math.pow(1 - box.progress, 3);
      box.mesh.position.lerpVectors(box.startPosition, box.targetPosition, eased);
      box.mesh.position.y += Math.sin(box.progress * Math.PI) * 0.5;
    }
  }
}

function removeCustomer(index) {
  if (index < 0 || index >= state.counter.customerQueue.length) return;

  const customer = state.counter.customerQueue[index];

  if (customer.mesh) {
    scene.remove(customer.mesh);
    customer.mesh.geometry.dispose();
    customer.mesh.material.dispose();

    const meshIndex = customerMeshes.indexOf(customer.mesh);
    if (meshIndex > -1) {
      customerMeshes.splice(meshIndex, 1);
    }
  }

  state.counter.customerQueue.splice(index, 1);
}

function spawnCashPile() {
  const count = state.cashPile.activeCash.length;
  const layer = Math.floor(count / 9);
  const slot = count % 9;
  const row = Math.floor(slot / 3);
  const col = slot % 3;

  const cashEntity = {
    id: Date.now() + count,
    status: 'idle',
    gridX: col,
    gridZ: row,
    layer: layer
  };

  const geometry = new THREE.BoxGeometry(0.3, 0.1, 0.3);
  const material = new THREE.MeshStandardMaterial({ color: 0x00ff88 });
  const mesh = new THREE.Mesh(geometry, material);

  const worldX = CASH_PILE_X + (col - 1) * CASH_SPACING;
  const worldZ = CASH_PILE_Z + (row - 1) * CASH_SPACING;
  const worldY = 0.05 + layer * 0.1;

  mesh.position.set(worldX, worldY, worldZ);
  scene.add(mesh);

  cashEntity.mesh = mesh;
  state.cashPile.activeCash.push(cashEntity);
  cashMeshes.push(mesh);
}

function updateCashVacuum(delta) {
  for (let i = state.cashPile.activeCash.length - 1; i >= 0; i--) {
    const cash = state.cashPile.activeCash[i];
    const mesh = cash.mesh;

    const dx = state.player.x - mesh.position.x;
    const dz = state.player.z - mesh.position.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    if (cash.status === 'idle' && distance < CASH_VACUUM_RADIUS) {
      cash.status = 'vacuuming';
    }

    if (cash.status === 'vacuuming') {
      const moveX = (dx / distance) * CASH_VACUUM_SPEED * delta;
      const moveZ = (dz / distance) * CASH_VACUUM_SPEED * delta;

      mesh.position.x += moveX;
      mesh.position.z += moveZ;

      if (distance < 0.3) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();

        const meshIndex = cashMeshes.indexOf(mesh);
        if (meshIndex > -1) cashMeshes.splice(meshIndex, 1);

        state.cashPile.activeCash.splice(i, 1);
        state.player.cashBalance += CASH_VALUE;
      }
    }
  }
}

function updateCashDrain(elapsed) {
  const zone = state.unlockZones[0];
  if (zone.unlocked && !zone.isUpgradePhase) return;

  const dx = state.player.x - zone.x;
  const dz = state.player.z - zone.z;
  const distance = Math.sqrt(dx * dx + dz * dz);

  if (distance >= UNLOCK_PROXIMITY) {
    lastDrainTime = 0;
    return;
  }

  if (state.player.cashBalance <= 0) return;

  if (lastDrainTime === 0) {
    lastDrainTime = elapsed;
  } else if (elapsed - lastDrainTime >= DRAIN_INTERVAL) {
    const deduction = Math.min(DRAIN_AMOUNT, state.player.cashBalance);
    state.player.cashBalance -= deduction;
    zone.currentProgress += deduction;
    lastDrainTime = elapsed;

  const drainTitle = zone.isUpgradePhase ? 'Upgrade Speed' : '1st Employee';
  redrawUnlockText(zone.currentProgress, zone.cost, drainTitle);

    if (zone.currentProgress >= zone.cost) {
      if (!zone.unlocked) {
        unlockWorker(zone);
      } else if (zone.isUpgradePhase) {
        applySpeedUpgrade(zone);
      }
    }
  }
}

function unlockWorker(zone) {
  zone.unlocked = true;
  zone.isUpgradePhase = true;
  zone.currentProgress = 0;
  zone.cost = 300;

  redrawUnlockText(0, 300, 'Upgrade Speed');

  spawnWorkerMesh(zone);
}

function applySpeedUpgrade(zone) {
  zone.isUpgradePhase = false;

  if (state.workers.length > 0) {
    state.workers[0].speed += 0.8;
    state.workers[0].pickupInterval -= 0.4;
    state.workers[0].handoffInterval -= 0.1;
  }

  if (unlockTextMesh) {
    unlockTextMesh.visible = false;
  }
}

function spawnWorkerMesh(zone) {
  const geometry = new THREE.CapsuleGeometry(0.3, 0.6, 8, 16);
  const material = new THREE.MeshStandardMaterial({ color: 0xff8c00 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(zone.x, 0.45, zone.z);
  scene.add(mesh);

  const worker = {
    mesh: mesh,
    state: 'GETTING_PIZZA',
    targetX: state.sourcePad.x,
    targetZ: state.sourcePad.z,
    carriedItems: 0,
    maxCarry: WORKER_MAX_CARRY,
    speed: WORKER_SPEED,
    lastHandoffTime: 0,
    lastPickupTime: 0,
    pickupInterval: WORKER_PICKUP_INTERVAL,
    handoffInterval: WORKER_HANDOFF_INTERVAL,
    stackMeshes: []
  };

  workerMeshes.push(mesh);
  workerStackMeshes.push(worker.stackMeshes);
  state.workers.push(worker);
}

function spawnWorkerItemMesh(worker) {
  const stackIndex = worker.carriedItems - 1;
  const colorIndex = stackIndex % ITEM_COLORS.length;
  const geometry = new THREE.BoxGeometry(ITEM_BOX_SIZE.width, ITEM_BOX_SIZE.height, ITEM_BOX_SIZE.depth);
  const material = new THREE.MeshStandardMaterial({ color: ITEM_COLORS[colorIndex] });
  const mesh = new THREE.Mesh(geometry, material);

  mesh.position.set(
    worker.mesh.position.x,
    0.45 + 0.6 + (stackIndex * ITEM_BOX_SIZE.height),
    worker.mesh.position.z + STACK_OFFSET_Z
  );

  scene.add(mesh);
  worker.stackMeshes.push(mesh);
}

function updateWorkerStackPositions() {
  for (let i = 0; i < state.workers.length; i++) {
    const worker = state.workers[i];
    for (let j = 0; j < worker.stackMeshes.length; j++) {
      const mesh = worker.stackMeshes[j];
      mesh.position.x = worker.mesh.position.x;
      mesh.position.z = worker.mesh.position.z + STACK_OFFSET_Z;
      mesh.position.y = 0.45 + 0.6 + (j * ITEM_BOX_SIZE.height);
    }
  }
}

function updateWorkerBehavior(delta, elapsed) {
  for (let i = 0; i < state.workers.length; i++) {
    const worker = state.workers[i];
    const mesh = worker.mesh;

    const dx = worker.targetX - mesh.position.x;
    const dz = worker.targetZ - mesh.position.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    if (distance > 0.2) {
      const moveX = (dx / distance) * worker.speed * delta;
      const moveZ = (dz / distance) * worker.speed * delta;
      mesh.position.x += moveX;
      mesh.position.z += moveZ;
      continue;
    }

    mesh.position.x = worker.targetX;
    mesh.position.z = worker.targetZ;

    if (worker.state === 'GETTING_PIZZA') {
      if (worker.lastPickupTime === 0) {
        worker.lastPickupTime = elapsed;
      } else if (elapsed - worker.lastPickupTime >= worker.pickupInterval) {
        if (state.sourcePad.items.length > 0 && worker.carriedItems < worker.maxCarry) {
          state.sourcePad.items.pop();
          worker.carriedItems++;
          spawnWorkerItemMesh(worker);
          worker.lastPickupTime = elapsed;
        }
      }

      if (worker.carriedItems >= worker.maxCarry) {
        worker.state = 'DELIVERING';
        worker.targetX = state.counter.x;
        worker.targetZ = state.counter.z;
      }
    } else if (worker.state === 'DELIVERING') {
      const hasWaitingCustomer = state.counter.customerQueue.length > 0 &&
        state.counter.customerQueue[0].status === 'waiting';

      if (hasWaitingCustomer && worker.carriedItems > 0) {
        if (elapsed - worker.lastHandoffTime >= worker.handoffInterval) {
          const customer = state.counter.customerQueue[0];
          customer.itemsReceived++;
          state.counter.droppedOffItems++;
          worker.carriedItems--;
          worker.lastHandoffTime = elapsed;

          const topMesh = worker.stackMeshes.pop();
          if (topMesh) {
            scene.remove(topMesh);
            topMesh.geometry.dispose();
            topMesh.material.dispose();
          }

          if (customer.itemsReceived >= state.counter.customerQuota) {
            state.totalWorkerSales++;
            eventBus.emit('customer_satisfied', 0);
          }
        }
      }

      if (worker.carriedItems === 0) {
        worker.state = 'GETTING_PIZZA';
        worker.targetX = state.sourcePad.x;
        worker.targetZ = state.sourcePad.z;
        worker.lastPickupTime = 0;
      }
    }
  }
}

function updateOverlay() {
  const overlay = document.getElementById('overlay');
  const invCount = state.player.inventory.length;
  const queueLength = state.counter.customerQueue.length;
  const droppedOff = state.counter.droppedOffItems;
  const cash = state.player.cashBalance;
  const workers = state.workers.length;
  
  overlay.innerHTML = `
    X: ${state.player.x.toFixed(2)} | Z: ${state.player.z.toFixed(2)}<br>
    Inventory: ${invCount} / ${state.maxInventory}<br>
    Queue: ${queueLength} / ${state.counter.maxCustomers}<br>
    Delivered: ${droppedOff}<br>
    Cash: $${cash}<br>
    Workers: ${workers}
  `;
}

function onWindowResize() {
  const aspect = window.innerWidth / window.innerHeight;
  const frustumSize = 15;

  camera.left = frustumSize * aspect / -2;
  camera.right = frustumSize * aspect / 2;
  camera.top = frustumSize / 2;
  camera.bottom = frustumSize / -2;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  handleMovement(delta);
  produceSourceItems(elapsed);
  produceCustomers(elapsed);
  transferItems(elapsed);
  checkCounterProximity();
  transferItemsToCounter(elapsed);
  updateTransferringBoxes(delta);
  updateCashVacuum(delta);
  updateCashDrain(elapsed);
  updateWorkerBehavior(delta, elapsed);
  updateCustomerMovement(delta);
  updateStackPositions();
  updateWorkerStackPositions();
  updateOverlay();

  renderer.render(scene, camera);
}

init();
animate();
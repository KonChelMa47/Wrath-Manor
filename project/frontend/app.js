let provider;
let signer;
let shop;
let currentAccount = "";

const els = {
  connectWallet: document.getElementById("connectWallet"),
  switchSepolia: document.getElementById("switchSepolia"),
  setContract: document.getElementById("setContract"),
  contractAddress: document.getElementById("contractAddress"),
  walletAddress: document.getElementById("walletAddress"),
  networkStatus: document.getElementById("networkStatus"),
  contractStatus: document.getElementById("contractStatus"),
  playerName: document.getElementById("playerName"),
  registerPlayer: document.getElementById("registerPlayer"),
  loadPlayer: document.getElementById("loadPlayer"),
  playerOutput: document.getElementById("playerOutput"),
  buyItemId: document.getElementById("buyItemId"),
  buyItem: document.getElementById("buyItem"),
  sellItemId: document.getElementById("sellItemId"),
  sellItem: document.getElementById("sellItem"),
  weaponId: document.getElementById("weaponId"),
  upgradeType: document.getElementById("upgradeType"),
  upgradeWeapon: document.getElementById("upgradeWeapon"),
  loadInventory: document.getElementById("loadInventory"),
  inventory: document.getElementById("inventory"),
  txLog: document.getElementById("txLog"),
  clearLog: document.getElementById("clearLog")
};

const shopUi = {
  tabs: document.querySelectorAll(".tab-button"),
  views: document.querySelectorAll(".shop-view"),
  rows: document.querySelectorAll(".shop-row"),
  title: document.getElementById("selectedTitle"),
  description: document.getElementById("selectedDescription"),
  displayVisual: document.getElementById("displayVisual"),
  displayCount: document.getElementById("displayCount"),
  walletEthBalances: document.querySelectorAll(".walletEthBalance"),
  roomName: document.getElementById("roomName"),
  roomHint: document.getElementById("roomHint"),
  gameCanvas: document.getElementById("gameCanvas"),
  commentBox: document.getElementById("commentBox"),
  merchantMenu: document.getElementById("merchantMenu"),
  merchantCancel: document.getElementById("merchantCancel"),
  gameInventoryOverlay: document.getElementById("gameInventoryOverlay"),
  gameInventoryContent: document.getElementById("gameInventoryContent"),
  closeGameInventory: document.getElementById("closeGameInventory")
};

const debugUi = {
  canvas: document.getElementById("debugCanvas"),
  roomName: document.getElementById("debugRoomName"),
  roomSelect: document.getElementById("debugRoomSelect"),
  phaseSelect: document.getElementById("debugPhaseSelect"),
  deletePhase: document.getElementById("debugDeletePhase"),
  wallMode: document.getElementById("debugWallMode"),
  commentMode: document.getElementById("debugCommentMode"),
  doorMode: document.getElementById("debugDoorMode"),
  merchantMode: document.getElementById("debugMerchantMode"),
  candleMode: document.getElementById("debugCandleMode"),
  spawnMode: document.getElementById("debugSpawnMode"),
  deleteMode: document.getElementById("debugDeleteMode"),
  undo: document.getElementById("debugUndo"),
  clear: document.getElementById("debugClear"),
  status: document.getElementById("debugStatus")
};

function shortAddress(address) {
  if (!address) return "Not connected";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function shortHash(hash) {
  if (!hash) return "";
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

function log(message, txHash) {
  const item = document.createElement("li");
  if (txHash) {
    const link = document.createElement("a");
    link.href = `https://sepolia.etherscan.io/tx/${txHash}`;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = shortHash(txHash);
    item.append(`${message}: `, link);
  } else {
    item.textContent = message;
  }
  els.txLog.prepend(item);
}

function logError(error) {
  const reason = error?.shortMessage || error?.reason || error?.message || String(error);
  const item = document.createElement("li");
  item.className = "error";
  item.textContent = `Error: ${reason}`;
  els.txLog.prepend(item);
}

function requireShop() {
  if (!shop) throw new Error("Set contract address first");
}

async function connectWallet() {
  if (!window.ethereum) throw new Error("MetaMask is not installed");

  provider = new ethers.BrowserProvider(window.ethereum);
  const accounts = await provider.send("eth_requestAccounts", []);
  signer = await provider.getSigner();
  currentAccount = accounts[0];

  els.walletAddress.textContent = currentAccount;
  await updateNetworkStatus();

  const address = els.contractAddress.value.trim() || SHOP_CONFIG.contractAddress;
  if (address) setContract(address);

  log(`Connected ${shortAddress(currentAccount)}`);
}

async function updateNetworkStatus() {
  if (!provider) return;
  const network = await provider.getNetwork();
  const chainIdHex = `0x${network.chainId.toString(16)}`;
  els.networkStatus.textContent = chainIdHex === SHOP_CONFIG.sepoliaChainId
    ? `Sepolia (${chainIdHex})`
    : `Wrong network (${chainIdHex})`;
  await updateWalletEthBalance();
}

async function updateWalletEthBalance() {
  if (!provider || !currentAccount) return;
  const balance = await provider.getBalance(currentAccount);
  const formatted = Number(ethers.formatEther(balance)).toFixed(5);
  shopUi.walletEthBalances.forEach((item) => {
    item.textContent = `${formatted} ETH`;
  });
}

async function switchToSepolia() {
  if (!window.ethereum) throw new Error("MetaMask is not installed");

  await window.ethereum.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: SHOP_CONFIG.sepoliaChainId }]
  });

  provider = new ethers.BrowserProvider(window.ethereum);
  signer = await provider.getSigner();
  await updateNetworkStatus();
  log("Switched to Sepolia");
}

function setContract(address) {
  if (!ethers.isAddress(address)) throw new Error("Invalid contract address");
  if (!signer) throw new Error("Connect wallet first");

  els.contractAddress.value = address;
  shop = new ethers.Contract(address, RE4_MERCHANT_SHOP_ABI, signer);
  els.contractStatus.textContent = address;
  log(`Contract set ${shortAddress(address)}`);
}

async function waitForTx(tx, label) {
  log(`${label} submitted`, tx.hash);
  const receipt = await tx.wait();
  log(`${label} confirmed in block ${receipt.blockNumber}`, tx.hash);
  return receipt;
}

async function registerPlayer() {
  requireShop();
  const name = els.playerName.value.trim();
  if (!name) throw new Error("Player name is required");

  const tx = await shop.registerPlayer(name);
  await waitForTx(tx, "Player registration");
  await loadPlayer();
}

async function loadPlayer() {
  requireShop();
  if (!currentAccount) throw new Error("Connect wallet first");

  const [name, registered] = await shop.getPlayer(currentAccount);
  els.playerOutput.textContent = JSON.stringify({ address: currentAccount, name, registered }, null, 2);
}

async function buyItem() {
  requireShop();
  const itemId = BigInt(els.buyItemId.value);
  const item = await shop.getItemInfo(itemId);
  const tx = await shop.buyItem(itemId, { value: item.price });
  await waitForTx(tx, `Buy ${item.name}`);
  await updateWalletEthBalance();
  await loadInventory();
}

async function sellItem() {
  requireShop();
  const itemId = BigInt(els.sellItemId.value);
  const tx = await shop.sellItem(itemId);
  await waitForTx(tx, `Sell item ${itemId}`);
  await updateWalletEthBalance();
  await loadInventory();
}

async function upgradeWeapon() {
  requireShop();
  const weaponId = BigInt(els.weaponId.value);
  const upgradeType = Number(els.upgradeType.value);
  const cost = await shop.getUpgradeCost(upgradeType);
  const tx = await shop.upgradeWeapon(weaponId, upgradeType, { value: cost });
  await waitForTx(tx, `Upgrade weapon ${weaponId}`);
  await updateWalletEthBalance();
  await loadInventory();
}

async function loadInventory() {
  requireShop();
  if (!currentAccount) throw new Error("Connect wallet first");

  els.inventory.textContent = "Loading...";
  const itemIds = await shop.getAllItemIds();
  els.inventory.innerHTML = "";

  for (const itemId of itemIds) {
    const item = await shop.getItemInfo(itemId);
    const quantity = await shop.getItemQuantity(currentAccount, itemId);
    const card = document.createElement("article");
    const typeLabel = Number(item.itemType) === 0 ? "Weapon" : "Consumable";
    card.className = `item-card ${Number(item.itemType) === 0 ? "weapon-card" : "supply-card"} ${quantity > 0n ? "owned" : ""}`;

    let statsHtml = "";
    if (Number(item.itemType) === 0 && quantity > 0n) {
      const stats = await shop.getWeaponStats(currentAccount, itemId);
      statsHtml = `
        <p>Power: ${stats.power}</p>
        <p>Fire Rate: ${stats.fireRate}</p>
        <p>Reload Speed: ${stats.reloadSpeed}</p>
        <p>Capacity: ${stats.capacity}</p>
        <p>Exclusive: ${stats.exclusive ? "Yes" : "No"}</p>
      `;
    }

    card.innerHTML = `
      <h3>${item.name}</h3>
      <p>ID: ${item.id}</p>
      <p>Type: ${typeLabel}</p>
      <p>Price: ${ethers.formatEther(item.price)} ETH</p>
      <p>Owned: ${quantity}</p>
      ${statsHtml}
    `;
    els.inventory.appendChild(card);
  }
}

async function loadGameInventory() {
  if (!shopUi.gameInventoryContent) return;
  requireShop();
  if (!currentAccount) throw new Error("Connect wallet first");

  shopUi.gameInventoryContent.textContent = "Loading...";
  const itemIds = await shop.getAllItemIds();
  shopUi.gameInventoryContent.innerHTML = "";

  for (const itemId of itemIds) {
    const item = await shop.getItemInfo(itemId);
    const quantity = await shop.getItemQuantity(currentAccount, itemId);
    if (quantity === 0n) continue;

    const card = document.createElement("article");
    card.className = `item-card owned ${Number(item.itemType) === 0 ? "weapon-card" : "supply-card"}`;
    let statsHtml = "";
    if (Number(item.itemType) === 0) {
      const stats = await shop.getWeaponStats(currentAccount, itemId);
      statsHtml = `
        <p>Power: ${stats.power}</p>
        <p>Fire Rate: ${stats.fireRate}</p>
        <p>Reload Speed: ${stats.reloadSpeed}</p>
        <p>Capacity: ${stats.capacity}</p>
      `;
    }
    card.innerHTML = `
      <h3>${item.name}</h3>
      <p>ID: ${item.id}</p>
      <p>Owned: ${quantity}</p>
      ${statsHtml}
    `;
    shopUi.gameInventoryContent.appendChild(card);
  }

  if (!shopUi.gameInventoryContent.children.length) {
    shopUi.gameInventoryContent.textContent = "所持品なし";
  }
}

function bind(id, handler) {
  els[id].addEventListener("click", async () => {
    try {
      await handler();
    } catch (error) {
      logError(error);
    }
  });
}

function setShopSelection(row) {
  row.closest(".shop-list").querySelectorAll(".shop-row").forEach((item) => {
    item.classList.toggle("active", item === row);
  });

  shopUi.title.textContent = row.dataset.title || row.querySelector("span").textContent;
  shopUi.description.textContent = row.dataset.desc || "";
  shopUi.displayVisual.textContent = (row.dataset.title || "?").slice(0, 1);
  shopUi.displayCount.textContent = row.dataset.count || "0";

  if (row.dataset.buyId) els.buyItemId.value = row.dataset.buyId;
  if (row.dataset.sellId) els.sellItemId.value = row.dataset.sellId;
  if (row.dataset.upgradeType) {
    els.weaponId.value = "1";
    els.upgradeType.value = row.dataset.upgradeType;
  }
}

const mapDirectory = "../assest/map/";
const roomMetadata = {
  mainhall: {
    label: "Main Hall",
    hint: "左: Piano Room / 中央階段: Library / 右: Dining Room",
    start: { x: 438, y: 390 }
  },
  pianoroom: {
    label: "Piano Room",
    hint: "ドア追加モードで Main Hall への出口を設定できます",
    start: { x: 782, y: 292 }
  },
  library: {
    label: "Library",
    hint: "ドア追加モードで Main Hall への階段を設定できます",
    start: { x: 430, y: 372 }
  },
  diningroom: {
    label: "Dining Room",
    hint: "ドア追加モードで Main Hall への出口を設定できます",
    start: { x: 86, y: 292 }
  }
};
let rooms = {};
const storageKey = "re4MerchantDebugData:v1";
const disabledPhaseStorageKey = "re4MerchantDisabledPhases:v1";
let debugData = {};
let disabledPhases = {};
const playerCollisionRadius = 15;

const game = {
  canvas: shopUi.gameCanvas,
  ctx: shopUi.gameCanvas?.getContext("2d"),
  roomId: "mainhall",
  images: {},
  foregroundImages: {},
  keys: new Set(),
  zoom: 1.7,
  world: { w: 900, h: 506 },
  player: { x: 438, y: 390, w: 30, h: 46, speed: 2.8 },
  lastExitAt: 0,
  message: "",
  messageUntil: 0,
  paused: false
};

const editor = {
  canvas: debugUi.canvas,
  ctx: debugUi.canvas?.getContext("2d"),
  roomId: "mainhall",
  mode: "wall",
  pendingPoint: null,
  pendingDoor: null,
  history: [],
  view: { x: 0, y: 0, zoom: 1 }
};

function loadDebugData() {
  const base = {};
  Object.keys(rooms).forEach((id) => {
      base[id] = { walls: [], comments: [], doors: [], candles: [], spawn: null, merchant: null };
  });

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
    Object.keys(base).forEach((id) => {
      base[id].walls = Array.isArray(saved[id]?.walls) ? saved[id].walls : [];
      base[id].comments = Array.isArray(saved[id]?.comments) ? saved[id].comments : [];
      base[id].doors = Array.isArray(saved[id]?.doors) ? saved[id].doors : [];
      base[id].candles = Array.isArray(saved[id]?.candles) ? saved[id].candles : [];
      base[id].spawn = saved[id]?.spawn || null;
      base[id].merchant = id === "mainhall" ? (saved[id]?.merchant || null) : null;
      if (base[id].merchant) {
        base[id].merchant.bodyRadius ??= 20;
        base[id].merchant.accessY ??= base[id].merchant.y + 34;
        base[id].merchant.accessRadius ??= 12;
      }
    });
  } catch {
    // Keep blank debug data if localStorage is corrupted.
  }

  return base;
}

function loadDisabledPhases() {
  try {
    const saved = JSON.parse(localStorage.getItem(disabledPhaseStorageKey) || "{}");
    return saved && typeof saved === "object" ? saved : {};
  } catch {
    return {};
  }
}

function saveDisabledPhases() {
  localStorage.setItem(disabledPhaseStorageKey, JSON.stringify(disabledPhases));
}

function isPhaseDisabled(roomId, phase) {
  return Array.isArray(disabledPhases[roomId]) && disabledPhases[roomId].includes(Number(phase));
}

function parseMapFile(file) {
  const extensionless = file.replace(/\.(png|jpg|jpeg|webp)$/i, "");
  const isForeground = /_objectives$/i.test(extensionless);
  const baseName = extensionless.replace(/_objectives$/i, "");
  const phaseMatch = baseName.match(/^(.+?)(\d+)$/);
  const roomId = (phaseMatch ? phaseMatch[1] : baseName).toLowerCase();
  const phase = phaseMatch ? Number(phaseMatch[2]) : 1;
  return { roomId, phase, isForeground };
}

async function discoverRooms() {
  const fallbackFiles = [
    "mainhall.png",
    "mainhall_objectives.png",
    "pianoroom.png",
    "pianoroom2.png",
    "library.png",
    "diningroom.png"
  ];
  let files = fallbackFiles;

  try {
    const response = await fetch(mapDirectory);
    if (response.ok) {
      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const discovered = [...doc.querySelectorAll("a")]
        .map((link) => decodeURIComponent(link.getAttribute("href") || ""))
        .map((href) => href.split("/").pop())
        .filter((name) => /\.(png|jpg|jpeg|webp)$/i.test(name));
      if (discovered.length) files = discovered;
    }
  } catch {
    // Some servers do not expose directory listings. Keep the known starter maps.
  }

  const foregrounds = new Map();
  const mapFiles = [];
  files
    .filter((name) => /\.(png|jpg|jpeg|webp)$/i.test(name))
    .forEach((file) => {
      const parsed = parseMapFile(file);
      const key = `${parsed.roomId}:${parsed.phase}`;
      if (parsed.isForeground) {
        foregrounds.set(key, file);
      } else {
        mapFiles.push({ file, ...parsed });
      }
    });

  const addRoomPhase = ({ file, roomId, phase }, ignoreDisabled = false) => {
    if (!ignoreDisabled && isPhaseDisabled(roomId, phase)) return;
    const metadata = roomMetadata[roomId] || {};
    const foregroundFile = foregrounds.get(`${roomId}:${phase}`) || foregrounds.get(`${roomId}:1`) || null;
    if (!rooms[roomId]) {
      rooms[roomId] = {
        label: metadata.label || roomId.replace(/[_-]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
        hint: metadata.hint || "Debugでドア、当たり判定、イベントを設定できます",
        start: metadata.start || { x: 450, y: 390 },
        exits: [],
        currentPhase: phase,
        phases: {}
      };
    }
    rooms[roomId].phases[phase] = {
      phase,
      src: `${mapDirectory}${file}`,
      foreground: foregroundFile ? `${mapDirectory}${foregroundFile}` : null
    };
  };

  rooms = {};
  mapFiles.forEach((entry) => addRoomPhase(entry));

  if (!Object.keys(rooms).length && mapFiles.length) {
    disabledPhases = {};
    saveDisabledPhases();
    mapFiles.forEach((entry) => addRoomPhase(entry, true));
  }

  Object.values(rooms).forEach((room) => {
    const phases = Object.keys(room.phases).map(Number).sort((a, b) => a - b);
    room.currentPhase = phases.includes(1) ? 1 : phases[0];
  });
}

function populateRoomSelect() {
  if (!debugUi.roomSelect) return;
  debugUi.roomSelect.innerHTML = "";
  Object.entries(rooms).forEach(([id, room]) => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = room.label;
    debugUi.roomSelect.appendChild(option);
  });
  populatePhaseSelect(editor.roomId);
}

function getRoomPhases(roomId) {
  return Object.keys(rooms[roomId]?.phases || {}).map(Number).sort((a, b) => a - b);
}

function getCurrentPhase(roomId) {
  const phases = getRoomPhases(roomId);
  return rooms[roomId]?.currentPhase || phases[0] || 1;
}

function populatePhaseSelect(roomId) {
  if (!debugUi.phaseSelect) return;
  debugUi.phaseSelect.innerHTML = "";
  const phases = getRoomPhases(roomId);
  phases.forEach((phase) => {
    const option = document.createElement("option");
    option.value = String(phase);
    option.textContent = `Phase ${phase}`;
    debugUi.phaseSelect.appendChild(option);
  });
  debugUi.phaseSelect.value = String(getCurrentPhase(roomId));
  if (debugUi.deletePhase) {
    debugUi.deletePhase.disabled = phases.length <= 1;
  }
}

function setRoomPhase(roomId, phase) {
  if (!rooms[roomId]?.phases?.[phase]) return;
  rooms[roomId].currentPhase = Number(phase);
  populatePhaseSelect(roomId);
  drawGame();
  drawDebug();
}

function deleteCurrentPhase() {
  const roomId = editor.roomId;
  const phase = getCurrentPhase(roomId);
  const phases = getRoomPhases(roomId);
  if (phases.length <= 1) {
    alert("最後のフェーズは削除できません。assets/map から画像を外す場合だけ部屋自体が消えます。");
    return;
  }

  if (!confirm(`${rooms[roomId].label} の Phase ${phase} をDebug上で非表示にしますか？\n画像ファイル自体は削除されません。`)) return;
  disabledPhases[roomId] = Array.from(new Set([...(disabledPhases[roomId] || []), phase]));
  saveDisabledPhases();
  delete rooms[roomId].phases[phase];
  rooms[roomId].currentPhase = getRoomPhases(roomId)[0];
  populatePhaseSelect(roomId);
  drawGame();
  drawDebug();
}

function saveDebugData() {
  localStorage.setItem(storageKey, JSON.stringify(debugData));
}

function cloneDebugData() {
  return JSON.parse(JSON.stringify(debugData));
}

function pushDebugHistory() {
  editor.history.push(cloneDebugData());
  if (editor.history.length > 80) editor.history.shift();
}

function restoreDebugData(snapshot) {
  Object.keys(debugData).forEach((id) => delete debugData[id]);
  Object.assign(debugData, snapshot);
  saveDebugData();
}

function loadRoomImages() {
  game.images = {};
  game.foregroundImages = {};
  Object.entries(rooms).forEach(([id, room]) => {
    game.images[id] = {};
    game.foregroundImages[id] = {};

    Object.entries(room.phases).forEach(([phase, phaseData]) => {
      const image = new Image();
      image.src = phaseData.src;
      image.onload = () => {
        drawGame();
        drawDebug();
      };
      game.images[id][phase] = image;

      if (phaseData.foreground) {
        const foreground = new Image();
        foreground.src = phaseData.foreground;
        foreground.onload = () => {
          drawGame();
          drawDebug();
        };
        game.foregroundImages[id][phase] = foreground;
      }
    });
  });
}

function setRoom(roomId, spawn) {
  const room = rooms[roomId];
  game.roomId = roomId;
  const defaultSpawn = debugData[roomId]?.spawn || room.start;
  game.player.x = spawn?.x ?? defaultSpawn.x;
  game.player.y = spawn?.y ?? defaultSpawn.y;
  shopUi.roomName.textContent = room.label;
  shopUi.roomHint.textContent = room.hint;
  hideComment();
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function distancePointToSegment(point, segment) {
  const vx = segment.x2 - segment.x1;
  const vy = segment.y2 - segment.y1;
  const wx = point.x - segment.x1;
  const wy = point.y - segment.y1;
  const lenSq = vx * vx + vy * vy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, (wx * vx + wy * vy) / lenSq));
  const x = segment.x1 + t * vx;
  const y = segment.y1 + t * vy;
  return Math.hypot(point.x - x, point.y - y);
}

function closestPointOnSegment(point, segment) {
  const vx = segment.x2 - segment.x1;
  const vy = segment.y2 - segment.y1;
  const wx = point.x - segment.x1;
  const wy = point.y - segment.y1;
  const lenSq = vx * vx + vy * vy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, (wx * vx + wy * vy) / lenSq));
  return {
    x: segment.x1 + t * vx,
    y: segment.y1 + t * vy
  };
}

function resolveWallCollisions(position) {
  const roomData = debugData[game.roomId];
  if (!roomData) return position;
  const resolved = { ...position };

  for (let iteration = 0; iteration < 4; iteration += 1) {
    let pushed = false;

    for (const wall of roomData.walls) {
      const closest = closestPointOnSegment(resolved, wall);
      let nx = resolved.x - closest.x;
      let ny = resolved.y - closest.y;
      let distance = Math.hypot(nx, ny);

      if (distance === 0) {
        const wx = wall.x2 - wall.x1;
        const wy = wall.y2 - wall.y1;
        distance = 0.0001;
        nx = -wy;
        ny = wx;
      }

      if (distance < playerCollisionRadius) {
        const push = playerCollisionRadius - distance;
        resolved.x += (nx / distance) * push;
        resolved.y += (ny / distance) * push;
        pushed = true;
      }
    }

    const merchant = roomData.merchant;
    if (merchant) {
      let nx = resolved.x - merchant.x;
      let ny = resolved.y - merchant.y;
      let distance = Math.hypot(nx, ny);
      const combinedRadius = playerCollisionRadius + merchant.bodyRadius;

      if (distance === 0) {
        distance = 0.0001;
        nx = 0;
        ny = 1;
      }

      if (distance < combinedRadius) {
        const push = combinedRadius - distance;
        resolved.x += (nx / distance) * push;
        resolved.y += (ny / distance) * push;
        pushed = true;
      }
    }

    if (!pushed) break;
  }

  resolved.x = Math.max(game.player.w / 2, Math.min(game.world.w - game.player.w / 2, resolved.x));
  resolved.y = Math.max(game.player.h / 2, Math.min(game.world.h - game.player.h / 2, resolved.y));
  return resolved;
}

function updateGame() {
  if (!game.canvas) return;
  if (game.paused) return;

  let dx = 0;
  let dy = 0;
  if (game.keys.has("arrowleft") || game.keys.has("a")) dx -= 1;
  if (game.keys.has("arrowright") || game.keys.has("d")) dx += 1;
  if (game.keys.has("arrowup") || game.keys.has("w")) dy -= 1;
  if (game.keys.has("arrowdown") || game.keys.has("s")) dy += 1;

  if (dx || dy) {
    const length = Math.hypot(dx, dy);
    const next = resolveWallCollisions({
      x: game.player.x + (dx / length) * game.player.speed,
      y: game.player.y + (dy / length) * game.player.speed
    });

    game.player.x = next.x;
    game.player.y = next.y;
  }

  const now = performance.now();
  if (shopUi.commentBox && now > game.messageUntil) hideComment();
}

function getCamera() {
  return {
    x: game.canvas.width / 2 - game.player.x * game.zoom,
    y: game.canvas.height / 2 - game.player.y * game.zoom
  };
}

function worldToScreen(point, camera = getCamera()) {
  return {
    x: camera.x + point.x * game.zoom,
    y: camera.y + point.y * game.zoom
  };
}

function drawRoomImage(ctx, roomId, x, y, w, h) {
  const phase = getCurrentPhase(roomId);
  const image = game.images[roomId]?.[phase];
  if (image?.complete && image.naturalWidth > 0) {
    ctx.drawImage(image, x, y, w, h);
  } else {
    ctx.fillStyle = "#10130f";
    ctx.fillRect(x, y, w, h);
  }
}

function drawForegroundImage(ctx, roomId, x, y, w, h) {
  const phase = getCurrentPhase(roomId);
  const image = game.foregroundImages[roomId]?.[phase];
  if (image?.complete && image.naturalWidth > 0) {
    ctx.drawImage(image, x, y, w, h);
  }
}

function drawCandleLight(ctx, screenX, screenY, scale, time, seed = 0) {
  const flicker = 0.72 + Math.sin(time * 0.006 + seed) * 0.12 + Math.sin(time * 0.017 + seed * 3.1) * 0.07;
  const radius = (34 + Math.sin(time * 0.011 + seed) * 5) * scale;
  const glow = ctx.createRadialGradient(screenX, screenY, 1, screenX, screenY, radius);
  glow.addColorStop(0, `rgba(255, 221, 145, ${0.82 * flicker})`);
  glow.addColorStop(0.22, `rgba(255, 151, 55, ${0.42 * flicker})`);
  glow.addColorStop(0.62, `rgba(168, 76, 24, ${0.16 * flicker})`);
  glow.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(255, 232, 164, ${0.95 * flicker})`;
  ctx.beginPath();
  ctx.ellipse(screenX, screenY - 2 * scale, 2.2 * scale, 5.5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawDebugOverlays(ctx, roomId, transform) {
  const data = debugData[roomId];
  if (!data) return;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(237, 93, 84, 0.92)";
  ctx.lineWidth = transform.lineWidth;
  data.walls.forEach((wall) => {
    const p1 = transform.point({ x: wall.x1, y: wall.y1 });
    const p2 = transform.point({ x: wall.x2, y: wall.y2 });
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  });
  ctx.restore();

  data.comments.forEach((comment) => {
    const p = transform.point(comment);
    const radius = comment.radius * transform.scale;
    ctx.save();
    ctx.fillStyle = "rgba(143, 184, 163, 0.16)";
    ctx.strokeStyle = "rgba(143, 184, 163, 0.86)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#e8dfce";
    ctx.font = "700 14px Segoe UI, sans-serif";
    ctx.fillText("E", p.x - 4, p.y + 5);
    ctx.restore();
  });

  data.doors.forEach((door) => {
    const p = transform.point(door);
    const radius = door.radius * transform.scale;
    ctx.save();
    ctx.fillStyle = "rgba(96, 159, 224, 0.16)";
    ctx.strokeStyle = "rgba(126, 189, 255, 0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#d8ebff";
    ctx.font = "700 14px Segoe UI, sans-serif";
    ctx.fillText("D", p.x - 5, p.y + 5);
    if (door.label) {
      ctx.font = "700 12px Segoe UI, sans-serif";
      ctx.fillText(door.label, p.x + 12, p.y - 10);
    }
    ctx.restore();
  });

  data.candles.forEach((candle) => {
    const p = transform.point(candle);
    ctx.save();
    ctx.fillStyle = "rgba(255, 176, 76, 0.95)";
    ctx.strokeStyle = "#21140a";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(3, 4 * transform.scale), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  });

  if (data.merchant) {
    const p = transform.point(data.merchant);
    const radius = data.merchant.bodyRadius * transform.scale;
    const access = transform.point({
      x: data.merchant.x,
      y: data.merchant.accessY
    });
    const accessRadius = data.merchant.accessRadius * transform.scale;
    ctx.save();
    ctx.fillStyle = "rgba(209, 168, 95, 0.14)";
    ctx.strokeStyle = "rgba(241, 198, 116, 0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(143, 184, 163, 0.22)";
    ctx.strokeStyle = "rgba(143, 184, 163, 0.95)";
    ctx.beginPath();
    ctx.arc(access.x, access.y, accessRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#f4efe4";
    ctx.font = "700 14px Segoe UI, sans-serif";
    ctx.fillText("商", p.x - 7, p.y + 5);
    ctx.fillText("E", access.x - 4, access.y + 5);
    ctx.restore();
  }

  if (data.spawn) {
    const p = transform.point(data.spawn);
    ctx.save();
    ctx.fillStyle = "rgba(209, 168, 95, 0.95)";
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 12);
    ctx.lineTo(p.x + 10, p.y + 8);
    ctx.lineTo(p.x - 10, p.y + 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function drawGame() {
  if (!game.ctx || !game.canvas) return;
  if (!rooms[game.roomId]) return;
  const ctx = game.ctx;
  const camera = getCamera();

  ctx.clearRect(0, 0, game.canvas.width, game.canvas.height);
  drawRoomImage(ctx, game.roomId, camera.x, camera.y, game.world.w * game.zoom, game.world.h * game.zoom);

  const screenPlayer = {
    x: game.canvas.width / 2 - game.player.w / 2,
    y: game.canvas.height / 2 - game.player.h / 2
  };

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.75)";
  ctx.shadowBlur = 12;
  ctx.fillStyle = "#d7c7a5";
  ctx.fillRect(screenPlayer.x, screenPlayer.y, game.player.w, game.player.h);
  ctx.fillStyle = "#6f1e1b";
  ctx.fillRect(screenPlayer.x + 6, screenPlayer.y + 6, game.player.w - 12, 7);
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 2;
  ctx.strokeRect(screenPlayer.x, screenPlayer.y, game.player.w, game.player.h);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "rgba(143, 184, 163, 0.95)";
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.arc(game.canvas.width / 2, game.canvas.height / 2, playerCollisionRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  const roomDebugData = debugData[game.roomId];
  const merchant = roomDebugData?.merchant;
  if (merchant) {
    const p = worldToScreen(merchant, camera);
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.82)";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#211f1b";
    ctx.fillRect(p.x - 15, p.y - 32, 30, 48);
    ctx.fillStyle = "#4f4638";
    ctx.fillRect(p.x - 18, p.y - 8, 36, 26);
    ctx.fillStyle = "#d1a85f";
    ctx.fillRect(p.x - 9, p.y - 26, 18, 6);
    ctx.strokeStyle = "#080806";
    ctx.lineWidth = 2;
    ctx.strokeRect(p.x - 18, p.y - 32, 36, 50);
    ctx.restore();
  }

  (roomDebugData?.candles || []).forEach((candle, index) => {
    const p = worldToScreen(candle, camera);
    drawCandleLight(ctx, p.x, p.y, game.zoom, performance.now(), index * 1.73);
  });

  drawForegroundImage(ctx, game.roomId, camera.x, camera.y, game.world.w * game.zoom, game.world.h * game.zoom);
}

function gameLoop() {
  updateGame();
  drawGame();
  requestAnimationFrame(gameLoop);
}

function nearestComment(roomId, point) {
  let best = null;
  for (const comment of debugData[roomId]?.comments || []) {
    const distance = Math.hypot(point.x - comment.x, point.y - comment.y);
    if (!best || distance < best.distance) best = { comment, distance };
  }
  return best;
}

function nearestDoor(roomId, point) {
  let best = null;
  for (const door of debugData[roomId]?.doors || []) {
    const distance = Math.hypot(point.x - door.x, point.y - door.y);
    if (!best || distance < best.distance) best = { door, distance };
  }
  return best;
}

function nearestMerchant(roomId, point) {
  const merchant = debugData[roomId]?.merchant;
  if (!merchant) return null;
  return {
    merchant,
    distance: Math.hypot(point.x - merchant.x, point.y - merchant.accessY)
  };
}

function showComment(text) {
  if (!shopUi.commentBox) return;
  shopUi.commentBox.textContent = text;
  shopUi.commentBox.hidden = false;
  game.messageUntil = performance.now() + 3500;
}

function hideComment() {
  if (!shopUi.commentBox) return;
  shopUi.commentBox.hidden = true;
  shopUi.commentBox.textContent = "";
}

function interactComment() {
  const nearest = nearestComment(game.roomId, game.player);
  if (nearest && nearest.distance <= nearest.comment.radius) {
    showComment(nearest.comment.text);
  }
}

function interactAction() {
  const door = nearestDoor(game.roomId, game.player);
  if (door && door.distance <= door.door.radius) {
    game.lastExitAt = performance.now();
    setRoom(door.door.targetRoom, { x: door.door.targetX, y: door.door.targetY });
    return;
  }
  const merchant = nearestMerchant(game.roomId, game.player);
  if (merchant && merchant.distance <= merchant.merchant.accessRadius) {
    openMerchantMenu();
    return;
  }
  interactComment();
}

function openMerchantMenu() {
  if (!shopUi.merchantMenu) return;
  game.paused = true;
  game.keys.clear();
  shopUi.merchantMenu.hidden = false;
}

function closeMerchantMenu() {
  if (!shopUi.merchantMenu) return;
  shopUi.merchantMenu.hidden = true;
  game.paused = false;
}

async function openGameInventory() {
  if (!shopUi.gameInventoryOverlay) return;
  game.paused = true;
  game.keys.clear();
  shopUi.gameInventoryOverlay.hidden = false;
  try {
    await loadGameInventory();
  } catch (error) {
    shopUi.gameInventoryContent.textContent = error?.message || String(error);
  }
}

function closeGameInventory() {
  if (!shopUi.gameInventoryOverlay) return;
  shopUi.gameInventoryOverlay.hidden = true;
  game.paused = false;
}

function activateShopView(viewId) {
  closeMerchantMenu();
  closeGameInventory();
  shopUi.tabs.forEach((item) => item.classList.toggle("active", item.dataset.view === viewId));
  shopUi.views.forEach((view) => view.classList.toggle("active", view.id === viewId));
  const activeRow = document.querySelector(`#${viewId} .shop-row.active`);
  if (activeRow) setShopSelection(activeRow);
}

function setDebugMode(mode) {
  editor.mode = mode;
  editor.pendingPoint = null;
  editor.pendingDoor = null;
  [debugUi.wallMode, debugUi.commentMode, debugUi.doorMode, debugUi.merchantMode, debugUi.candleMode, debugUi.spawnMode, debugUi.deleteMode].forEach((button) => button.classList.remove("active-tool"));
  if (mode === "wall") {
    debugUi.wallMode.classList.add("active-tool");
    debugUi.status.textContent = "線モード: クリックで点を置くと、次の点までが当たり判定になります。";
  }
  if (mode === "comment") {
    debugUi.commentMode.classList.add("active-tool");
    debugUi.status.textContent = "コメント追加: クリックした場所に反応範囲つきコメントを置きます。";
  }
  if (mode === "door") {
    debugUi.doorMode.classList.add("active-tool");
    debugUi.status.textContent = "ドア追加: 入口をクリックし、移動先の部屋IDを選んだあと、移動先マップ上の到着場所をクリックします。";
  }
  if (mode === "merchant") {
    debugUi.merchantMode.classList.add("active-tool");
    debugUi.status.textContent = "商人設定: Main Hall上でクリックした場所に武器商人を配置します。";
  }
  if (mode === "candle") {
    debugUi.candleMode.classList.add("active-tool");
    debugUi.status.textContent = "ろうそく: 既に描かれている炎の中心をクリックすると、揺れるオレンジの光を追加します。";
  }
  if (mode === "spawn") {
    debugUi.spawnMode.classList.add("active-tool");
    debugUi.status.textContent = "Spawn設定: クリックした場所を、この部屋の初期スポーン地点にします。";
  }
  if (mode === "delete") {
    debugUi.deleteMode.classList.add("active-tool");
    debugUi.status.textContent = "削除: 線、コメント、ドアの近くをクリックすると削除します。";
  }
  drawDebug();
}
function getCanvasWorldPoint(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (((event.clientX - rect.left) / rect.width) * canvas.width - editor.view.x) / editor.view.zoom,
    y: (((event.clientY - rect.top) / rect.height) * canvas.height - editor.view.y) / editor.view.zoom
  };
}

function getCanvasPoint(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height
  };
}

function drawDebug() {
  if (!editor.ctx || !editor.canvas) return;
  const ctx = editor.ctx;
  ctx.clearRect(0, 0, editor.canvas.width, editor.canvas.height);
  const view = editor.view;
  const toViewPoint = (point) => ({
    x: view.x + point.x * view.zoom,
    y: view.y + point.y * view.zoom
  });

  drawRoomImage(ctx, editor.roomId, view.x, view.y, game.world.w * view.zoom, game.world.h * view.zoom);

  drawDebugOverlays(ctx, editor.roomId, {
    scale: view.zoom,
    lineWidth: Math.max(2, 4 * view.zoom),
    point: toViewPoint
  });

  if (editor.pendingPoint) {
    const pendingPoint = toViewPoint(editor.pendingPoint);
    ctx.save();
    ctx.fillStyle = "#d1a85f";
    ctx.beginPath();
    ctx.arc(pendingPoint.x, pendingPoint.y, Math.max(4, 6 * view.zoom), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (editor.pendingDoor) {
    const pendingDoor = toViewPoint(editor.pendingDoor);
    ctx.save();
    ctx.fillStyle = "rgba(96, 159, 224, 0.28)";
    ctx.strokeStyle = "rgba(126, 189, 255, 0.95)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(pendingDoor.x, pendingDoor.y, 56 * view.zoom, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#d8ebff";
    ctx.font = "700 14px Segoe UI, sans-serif";
    ctx.fillText("入口", pendingDoor.x + 14, pendingDoor.y - 12);
    ctx.restore();
  }
}

function deleteNearestDebugItem(point) {
  const data = debugData[editor.roomId];
  let changed = false;
  let bestWall = null;
  data.walls.forEach((wall, index) => {
    const distance = distancePointToSegment(point, wall);
    if (!bestWall || distance < bestWall.distance) bestWall = { index, distance };
  });

  let bestComment = null;
  data.comments.forEach((comment, index) => {
    const distance = Math.hypot(point.x - comment.x, point.y - comment.y);
    if (!bestComment || distance < bestComment.distance) bestComment = { index, distance };
  });

  let bestDoor = null;
  data.doors.forEach((door, index) => {
    const distance = Math.hypot(point.x - door.x, point.y - door.y);
    if (!bestDoor || distance < bestDoor.distance) bestDoor = { index, distance };
  });

  const merchant = data.merchant;
  const merchantDistance = merchant ? Math.hypot(point.x - merchant.x, point.y - merchant.y) : Infinity;
  let bestCandle = null;
  data.candles.forEach((candle, index) => {
    const distance = Math.hypot(point.x - candle.x, point.y - candle.y);
    if (!bestCandle || distance < bestCandle.distance) bestCandle = { index, distance };
  });

  if (bestCandle && bestCandle.distance <= 18) {
    data.candles.splice(bestCandle.index, 1);
    changed = true;
  } else if (merchant && merchantDistance <= Math.max(28, merchant.bodyRadius || 20)) {
    data.merchant = null;
    changed = true;
  } else if (bestDoor && bestDoor.distance <= Math.max(28, data.doors[bestDoor.index].radius)) {
    data.doors.splice(bestDoor.index, 1);
    changed = true;
  } else if (bestComment && bestComment.distance <= Math.max(28, data.comments[bestComment.index].radius)) {
    data.comments.splice(bestComment.index, 1);
    changed = true;
  } else if (bestWall && bestWall.distance <= 18) {
    data.walls.splice(bestWall.index, 1);
    changed = true;
  }

  if (changed) saveDebugData();
  drawDebug();
  return changed;
}

function handleDebugClick(event) {
  const point = getCanvasWorldPoint(editor.canvas, event);
  const data = debugData[editor.roomId];

  if (editor.mode === "wall") {
    if (!editor.pendingPoint) {
      editor.pendingPoint = point;
    } else {
      pushDebugHistory();
      data.walls.push({
        x1: Math.round(editor.pendingPoint.x),
        y1: Math.round(editor.pendingPoint.y),
        x2: Math.round(point.x),
        y2: Math.round(point.y)
      });
      editor.pendingPoint = point;
      saveDebugData();
    }
  } else if (editor.mode === "comment") {
    const text = window.prompt("表示するコメントを入力してください");
    if (text) {
      pushDebugHistory();
      data.comments.push({
        x: Math.round(point.x),
        y: Math.round(point.y),
        radius: 54,
        text
      });
      saveDebugData();
    }
  } else if (editor.mode === "door") {
    if (!editor.pendingDoor) {
      const roomIds = Object.keys(rooms);
      const targetRoom = window.prompt(`移動先の部屋IDを入力: ${roomIds.join(", ")}`, "mainhall");
      if (!targetRoom || !rooms[targetRoom]) {
        window.alert("存在する部屋IDを入力してください。");
        drawDebug();
        return;
      }
      const label = window.prompt("表示名", `${rooms[targetRoom].label}へ`) || `${rooms[targetRoom].label}へ`;
      editor.pendingDoor = {
        sourceRoom: editor.roomId,
        x: Math.round(point.x),
        y: Math.round(point.y),
        radius: 56,
        label,
        targetRoom
      };
      editor.roomId = targetRoom;
      debugUi.roomSelect.value = targetRoom;
      populatePhaseSelect(targetRoom);
      debugUi.roomName.textContent = rooms[targetRoom].label;
      debugUi.status.textContent = "移動先マップ上で、到着させたい場所をクリックしてください。";
    } else {
      const sourceRoom = editor.pendingDoor.sourceRoom;
      pushDebugHistory();
      debugData[sourceRoom].doors.push({
        ...editor.pendingDoor,
        targetX: Math.round(point.x),
        targetY: Math.round(point.y)
      });
      saveDebugData();
      editor.roomId = sourceRoom;
      debugUi.roomSelect.value = sourceRoom;
      populatePhaseSelect(sourceRoom);
      debugUi.roomName.textContent = rooms[sourceRoom].label;
      debugUi.status.textContent = "ドアを追加しました。次の入口をクリックできます。";
      editor.pendingDoor = null;
    }
  } else if (editor.mode === "merchant") {
    if (editor.roomId !== "mainhall") {
      window.alert("武器商人はMain Hallにだけ配置できます。");
      drawDebug();
      return;
    }
    pushDebugHistory();
    data.merchant = {
      x: Math.round(point.x),
      y: Math.round(point.y),
      bodyRadius: 20,
      accessY: Math.round(point.y + 34),
      accessRadius: 12
    };
    saveDebugData();
  } else if (editor.mode === "candle") {
    pushDebugHistory();
    data.candles.push({
      x: Math.round(point.x),
      y: Math.round(point.y)
    });
    saveDebugData();
  } else if (editor.mode === "spawn") {
    pushDebugHistory();
    data.spawn = {
      x: Math.round(point.x),
      y: Math.round(point.y)
    };
    if (game.roomId === editor.roomId) {
      game.player.x = data.spawn.x;
      game.player.y = data.spawn.y;
    }
    saveDebugData();
  } else if (editor.mode === "delete") {
    pushDebugHistory();
    deleteNearestDebugItem(point);
  }

  drawDebug();
}
function undoDebug() {
  if (editor.pendingPoint) {
    editor.pendingPoint = null;
  } else if (editor.pendingDoor) {
    const sourceRoom = editor.pendingDoor.sourceRoom;
    editor.pendingDoor = null;
    editor.roomId = sourceRoom;
    debugUi.roomSelect.value = sourceRoom;
    populatePhaseSelect(sourceRoom);
    debugUi.roomName.textContent = rooms[sourceRoom].label;
  } else {
    const snapshot = editor.history.pop();
    if (!snapshot) {
      drawDebug();
      return;
    }
    restoreDebugData(snapshot);
  }
  drawDebug();
}

function clearDebugRoom() {
  if (!window.confirm(`${rooms[editor.roomId].label} のデバッグ設定を全部消しますか？`)) return;
  pushDebugHistory();
  debugData[editor.roomId] = { walls: [], comments: [], doors: [], candles: [], spawn: null, merchant: null };
  editor.pendingPoint = null;
  editor.pendingDoor = null;
  saveDebugData();
  drawDebug();
}

function handleDebugWheel(event) {
  if (!event.altKey && !event.shiftKey && !event.ctrlKey) return;
  event.preventDefault();

  if (event.altKey) {
    const mouse = getCanvasPoint(editor.canvas, event);
    const before = {
      x: (mouse.x - editor.view.x) / editor.view.zoom,
      y: (mouse.y - editor.view.y) / editor.view.zoom
    };
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    editor.view.zoom = Math.max(0.7, Math.min(5, editor.view.zoom * factor));
    editor.view.x = mouse.x - before.x * editor.view.zoom;
    editor.view.y = mouse.y - before.y * editor.view.zoom;
    debugUi.status.textContent = `Zoom: ${Math.round(editor.view.zoom * 100)}%`;
  } else if (event.shiftKey) {
    editor.view.x -= event.deltaY;
    debugUi.status.textContent = "Shift + wheel: X軸移動";
  } else if (event.ctrlKey) {
    editor.view.y -= event.deltaY;
    debugUi.status.textContent = "Ctrl + wheel: Y軸移動";
  }

  drawDebug();
}

function handleDebugShortcut(event) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    undoDebug();
  }
}

async function initializeMapSystem() {
  disabledPhases = loadDisabledPhases();
  await discoverRooms();
  debugData = loadDebugData();
  populateRoomSelect();

  const initialRoomId = rooms.mainhall ? "mainhall" : Object.keys(rooms)[0];
  if (!initialRoomId) return;

  game.roomId = initialRoomId;
  editor.roomId = initialRoomId;
  if (debugUi.roomSelect) debugUi.roomSelect.value = initialRoomId;
  populatePhaseSelect(initialRoomId);
  if (debugUi.roomName) debugUi.roomName.textContent = rooms[initialRoomId].label;

  loadRoomImages();
  setRoom(initialRoomId);
  drawDebug();
}

shopUi.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    shopUi.tabs.forEach((item) => item.classList.toggle("active", item === tab));
    shopUi.views.forEach((view) => view.classList.toggle("active", view.id === tab.dataset.view));
    const activeRow = document.querySelector(`#${tab.dataset.view} .shop-row.active`);
    if (activeRow) setShopSelection(activeRow);
    if (tab.dataset.view === "debugView") drawDebug();
  });
});

shopUi.rows.forEach((row) => {
  row.addEventListener("click", () => setShopSelection(row));
});

const initialShopRow = document.querySelector(".shop-view.active .shop-row.active");
if (initialShopRow) setShopSelection(initialShopRow);

if (game.canvas) {
  initializeMapSystem();
  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (key === "escape") {
      closeMerchantMenu();
      closeGameInventory();
    }
    if (key === "i") {
      event.preventDefault();
      if (shopUi.gameInventoryOverlay && !shopUi.gameInventoryOverlay.hidden) {
        closeGameInventory();
      } else {
        openGameInventory();
      }
      return;
    }
    if (game.paused) return;
    if (["arrowleft", "arrowright", "arrowup", "arrowdown", "w", "a", "s", "d"].includes(key)) {
      event.preventDefault();
      game.keys.add(key);
    }
    if (key === "e") interactAction();
  });
  window.addEventListener("keyup", (event) => {
    game.keys.delete(event.key.toLowerCase());
  });
  requestAnimationFrame(gameLoop);
}

if (editor.canvas) {
  debugUi.roomSelect.addEventListener("change", () => {
    editor.roomId = debugUi.roomSelect.value;
    editor.pendingPoint = null;
    populatePhaseSelect(editor.roomId);
    debugUi.roomName.textContent = rooms[editor.roomId].label;
    drawDebug();
  });
  debugUi.phaseSelect?.addEventListener("change", () => {
    setRoomPhase(editor.roomId, Number(debugUi.phaseSelect.value));
  });
  debugUi.deletePhase?.addEventListener("click", deleteCurrentPhase);
  debugUi.wallMode.addEventListener("click", () => setDebugMode("wall"));
  debugUi.commentMode.addEventListener("click", () => setDebugMode("comment"));
  debugUi.doorMode.addEventListener("click", () => setDebugMode("door"));
  debugUi.merchantMode.addEventListener("click", () => setDebugMode("merchant"));
  debugUi.candleMode.addEventListener("click", () => setDebugMode("candle"));
  debugUi.spawnMode.addEventListener("click", () => setDebugMode("spawn"));
  debugUi.deleteMode.addEventListener("click", () => setDebugMode("delete"));
  debugUi.undo.addEventListener("click", undoDebug);
  debugUi.clear.addEventListener("click", clearDebugRoom);
  editor.canvas.addEventListener("click", handleDebugClick);
  editor.canvas.addEventListener("wheel", handleDebugWheel, { passive: false });
  window.addEventListener("keydown", handleDebugShortcut);
  setDebugMode("wall");
}

document.querySelectorAll("[data-shop-open]").forEach((button) => {
  button.addEventListener("click", () => activateShopView(button.dataset.shopOpen));
});

shopUi.merchantCancel?.addEventListener("click", closeMerchantMenu);
shopUi.closeGameInventory?.addEventListener("click", closeGameInventory);

bind("connectWallet", connectWallet);
bind("switchSepolia", switchToSepolia);
bind("registerPlayer", registerPlayer);
bind("loadPlayer", loadPlayer);
bind("buyItem", buyItem);
bind("sellItem", sellItem);
bind("upgradeWeapon", upgradeWeapon);
bind("loadInventory", loadInventory);

els.setContract.addEventListener("click", () => {
  try {
    setContract(els.contractAddress.value.trim());
  } catch (error) {
    logError(error);
  }
});

els.clearLog.addEventListener("click", () => {
  els.txLog.innerHTML = "";
});

if (SHOP_CONFIG.contractAddress) els.contractAddress.value = SHOP_CONFIG.contractAddress;

if (window.ethereum) {
  window.ethereum.on("accountsChanged", () => window.location.reload());
  window.ethereum.on("chainChanged", () => window.location.reload());
}





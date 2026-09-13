const mineflayer = require('mineflayer');
const config = require('./config.json');

let bot = null;

let movementPhase = 0;
let movementTimer = null;
let hungerTimer = null;
let reconnectTimer = null;

const STEP_INTERVAL = 1500;
const JUMP_DURATION = 500;

// Eat when hunger reaches this level or lower
const MIN_FOOD_LEVEL = 14;

// Seconds between reconnect attempts
const RECONNECT_DELAY = 10000;

// Foods the bot can eat
const FOOD_ITEMS = [
  'cooked_beef',
  'cooked_porkchop',
  'cooked_chicken',
  'cooked_mutton',
  'cooked_rabbit',
  'bread',
  'baked_potato',
  'carrot',
  'potato',
  'apple',
  'golden_carrot'
];

let isEating = false;
let isConnecting = false;

function createBot() {
  if (isConnecting) return;

  isConnecting = true;

  console.log(`🔄 Connecting ${config.botUsername}...`);

  bot = mineflayer.createBot({
    host: config.serverHost,
    port: config.serverPort,
    username: config.botUsername,
    auth: 'offline',
    version: false,
    viewDistance: config.botChunk
  });

  bot.once('spawn', () => {
    isConnecting = false;

    console.log(`✅ ${config.botUsername} is Ready!`);

    isEating = false;
    movementPhase = 0;

    // Clear old timers
    if (movementTimer) clearTimeout(movementTimer);
    if (hungerTimer) clearInterval(hungerTimer);

    // Sneak after joining
    setTimeout(() => {
      if (!bot || !bot.entity) return;

      bot.setControlState('sneak', true);
      console.log(`🥷 ${config.botUsername} is now AFK.`);
    }, 3000);

    // Start movement
    movementTimer = setTimeout(movementCycle, STEP_INTERVAL);

    // Check hunger every 5 seconds
    hungerTimer = setInterval(checkHunger, 5000);
  });

  bot.on('error', (err) => {
    console.error(`⚠️ Bot error: ${err.message}`);
  });

  bot.on('end', () => {
    console.log(`⛔️ ${config.botUsername} disconnected.`);

    isConnecting = false;
    isEating = false;

    // Stop timers
    if (movementTimer) {
      clearTimeout(movementTimer);
      movementTimer = null;
    }

    if (hungerTimer) {
      clearInterval(hungerTimer);
      hungerTimer = null;
    }

    // Reset bot reference
    bot = null;

    // Automatically reconnect
    scheduleReconnect();
  });

  bot.on('kicked', (reason) => {
    console.log(`🚪 ${config.botUsername} was kicked:`, reason);
  });
}

function scheduleReconnect() {
  if (reconnectTimer) return;

  console.log(`🔄 Reconnecting in ${RECONNECT_DELAY / 1000} seconds...`);

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;

    console.log(`🔌 Attempting to reconnect...`);
    createBot();
  }, RECONNECT_DELAY);
}

function movementCycle() {
  if (!bot || !bot.entity || isEating) {
    if (bot && bot.entity) {
      movementTimer = setTimeout(movementCycle, STEP_INTERVAL);
    }
    return;
  }

  switch (movementPhase) {
    case 0:
      bot.setControlState('forward', true);
      bot.setControlState('back', false);
      bot.setControlState('jump', false);
      break;

    case 1:
      bot.setControlState('forward', false);
      bot.setControlState('back', true);
      bot.setControlState('jump', false);
      break;

    case 2:
      bot.setControlState('forward', false);
      bot.setControlState('back', false);
      bot.setControlState('jump', true);

      setTimeout(() => {
        if (bot && bot.entity) {
          bot.setControlState('jump', false);
        }
      }, JUMP_DURATION);

      break;

    case 3:
      bot.setControlState('forward', false);
      bot.setControlState('back', false);
      bot.setControlState('jump', false);
      break;
  }

  movementPhase = (movementPhase + 1) % 4;

  movementTimer = setTimeout(movementCycle, STEP_INTERVAL);
}

async function checkHunger() {
  if (!bot || !bot.entity || isEating) return;

  if (bot.food === undefined || bot.food > MIN_FOOD_LEVEL) {
    return;
  }

  const food = findFood();

  if (!food) {
    console.log(
      `⚠️ Hunger is ${bot.food}/20, but no food was found in inventory.`
    );
    return;
  }

  await eatFood(food);
}

function findFood() {
  if (!bot) return null;

  return bot.inventory.items().find(item =>
    FOOD_ITEMS.includes(item.name)
  );
}

async function eatFood(food) {
  if (!bot || !bot.entity || isEating) return;

  isEating = true;

  console.log(
    `🍖 Hunger: ${bot.food}/20. Eating ${food.name}...`
  );

  // Stop movement while eating
  bot.setControlState('forward', false);
  bot.setControlState('back', false);
  bot.setControlState('jump', false);

  try {
    await bot.equip(food, 'hand');
    await bot.consume();

    console.log(
      `✅ Ate ${food.name}. Hunger is now ${bot.food}/20.`
    );
  } catch (err) {
    console.error(`⚠️ Could not eat food: ${err.message}`);
  }

  isEating = false;
}

// Start the bot
createBot();

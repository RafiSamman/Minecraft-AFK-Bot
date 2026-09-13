const mineflayer = require('mineflayer');
const { Vec3 } = require('vec3');
const config = require('./config.json');

const bot = mineflayer.createBot({
  host: config.serverHost,
  port: config.serverPort,
  username: config.botUsername,
  auth: 'offline',
  version: false,
  viewDistance: config.botChunk
});

let movementPhase = 0;

const STEP_INTERVAL = 1500;
const JUMP_DURATION = 500;

// Hunger settings
const MIN_FOOD_LEVEL = 14;
let isEating = false;

// Foods the bot will automatically eat
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

bot.on('spawn', () => {
  setTimeout(() => {
    bot.setControlState('sneak', true);
    console.log(`✅ ${config.botUsername} is Ready!`);
  }, 3000);

  setTimeout(movementCycle, STEP_INTERVAL);

  // Check hunger regularly
  setInterval(checkHunger, 5000);
});

function movementCycle() {
  if (!bot.entity || isEating) {
    setTimeout(movementCycle, STEP_INTERVAL);
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
        bot.setControlState('jump', false);
      }, JUMP_DURATION);
      break;

    case 3:
      bot.setControlState('forward', false);
      bot.setControlState('back', false);
      bot.setControlState('jump', false);
      break;
  }

  movementPhase = (movementPhase + 1) % 4;

  setTimeout(movementCycle, STEP_INTERVAL);
}

async function checkHunger() {
  if (!bot.entity || isEating) return;

  // Mineflayer food level is normally 0-20
  if (bot.food === undefined || bot.food > MIN_FOOD_LEVEL) {
    return;
  }

  const food = findFood();

  if (!food) {
    console.log(`⚠️ Hunger is ${bot.food}/20, but no food was found in inventory.`);
    return;
  }

  await eatFood(food);
}

function findFood() {
  return bot.inventory.items().find(item =>
    FOOD_ITEMS.includes(item.name)
  );
}

async function eatFood(food) {
  isEating = true;

  console.log(`🍖 Hunger: ${bot.food}/20. Eating ${food.name}...`);

  // Stop movement while eating
  bot.setControlState('forward', false);
  bot.setControlState('back', false);
  bot.setControlState('jump', false);

  try {
    await bot.equip(food, 'hand');
    await bot.consume();

    console.log(`✅ Ate ${food.name}. Hunger is now ${bot.food}/20.`);
  } catch (err) {
    console.error('⚠️ Could not eat food:', err.message);
  }

  isEating = false;
}

bot.on('error', (err) => {
  console.error('⚠️ Error:', err);
});

bot.on('end', () => {
  console.log('⛔️ Bot Disconnected!');
});

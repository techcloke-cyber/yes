const fs = require('node:fs');
const path = require('node:path');

const STORE_PATH = path.join(__dirname, '..', 'data', 'store.json');

function ensureStore() {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(
      STORE_PATH,
      JSON.stringify({ tickets: {}, settings: {} }, null, 2),
      'utf8'
    );
  }
}

function loadStore() {
  ensureStore();
  const raw = fs.readFileSync(STORE_PATH, 'utf8');
  return JSON.parse(raw);
}

function saveStore(store) {
  ensureStore();
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

function getGuildSettings(store, guildId) {
  if (!store.settings[guildId]) {
    store.settings[guildId] = {
      supportRoleIds: [],
      ticketCategoryId: null,
      logChannelId: null,
      openCount: 0,
      closedCount: 0
    };
  }
  return store.settings[guildId];
}

module.exports = {
  loadStore,
  saveStore,
  getGuildSettings
};

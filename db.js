// db.js

import { getTodayKey, safeJsonParse, generateId, log } from "./utils.js";

const STORAGE_VERSION = "v2";
const MENU_KEY_PREFIX = `almoco_menu_${STORAGE_VERSION}_`;
const ORDERS_KEY_PREFIX = `almoco_orders_${STORAGE_VERSION}_`;
const ADMIN_REMEMBER_KEY = `almoco_admin_remember_${STORAGE_VERSION}`;

function getMenuKeyForToday() {
  return MENU_KEY_PREFIX + getTodayKey();
}

function getOrdersKeyForToday() {
  return ORDERS_KEY_PREFIX + getTodayKey();
}

export function loadMenuForToday() {
  const key = getMenuKeyForToday();
  const raw = localStorage.getItem(key);
  const menu = safeJsonParse(raw, null);
  log("Menu carregado:", menu);
  return menu;
}

export function saveMenuForToday(menu) {
  const key = getMenuKeyForToday();
  localStorage.setItem(key, JSON.stringify(menu));
  log("Menu salvo:", menu);
}

export function loadOrdersForToday() {
  const key = getOrdersKeyForToday();
  const raw = localStorage.getItem(key);
  const orders = safeJsonParse(raw, []);
  log("Pedidos carregados:", orders);
  return orders;
}

export function saveOrdersForToday(orders) {
  const key = getOrdersKeyForToday();
  localStorage.setItem(key, JSON.stringify(orders));
  log("Pedidos salvos:", orders);
}

export function addOrderForToday({ name }) {
  const orders = loadOrdersForToday();
  const now = new Date().toISOString();
  const newOrder = {
    id: generateId("order"),
    name,
    notes: "",
    createdAt: now,
    paid: false,
  };
  orders.push(newOrder);
  saveOrdersForToday(orders);
  return newOrder;
}

export function updateOrderPaid(orderId, paid) {
  const orders = loadOrdersForToday();
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) return null;
  orders[idx] = { ...orders[idx], paid: !!paid };
  saveOrdersForToday(orders);
  return orders[idx];
}

export function clearOrdersForToday() {
  const key = getOrdersKeyForToday();
  localStorage.removeItem(key);
  log("Pedidos de hoje limpos.");
}

export function loadAdminRemembered() {
  const value = localStorage.getItem(ADMIN_REMEMBER_KEY);
  return value === "1";
}

export function saveAdminRemembered(remembered) {
  if (remembered) {
    localStorage.setItem(ADMIN_REMEMBER_KEY, "1");
  } else {
    localStorage.removeItem(ADMIN_REMEMBER_KEY);
  }
}

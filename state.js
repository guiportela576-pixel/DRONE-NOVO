// state.js

import { log } from "./utils.js";

const initialState = {
  activeTab: "almocar",
  isAdmin: false,
  adminRemembered: false,
  menuForToday: null,
  ordersForToday: [],
};

let state = { ...initialState };
const listeners = new Set();

export function getState() {
  return { ...state };
}

export function setState(patch) {
  state = { ...state, ...patch };
  log("Novo estado:", state);
  listeners.forEach((fn) => fn(getState()));
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

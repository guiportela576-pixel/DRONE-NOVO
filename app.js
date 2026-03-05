// app.js

import { getState, setState, subscribe } from "./state.js";
import {
  loadMenuForToday,
  saveMenuForToday,
  clearMenuForToday,
  loadOrdersForToday,
  addOrderForToday,
  updateOrderPaid,
  clearOrdersForToday,
  subscribeOrdersForToday,
  loadAdminRemembered,
  saveAdminRemembered,
} from "./db.js";

const ADMIN_PIN = "2749";
const SAVED_NAME_KEY = "almoco_saved_name";

let unsubscribeRealtime = null;
let ordersPollTimer = null;
let menuPollTimer = null;

function init() {
  window.__APP_DEBUG__ = false;

  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Tabs
  const tabAlmocarBtn = document.getElementById("tab-almocar-btn");
  const tabCozinhaBtn = document.getElementById("tab-cozinha-btn");
  tabAlmocarBtn.addEventListener("click", () => switchTab("almocar"));
  tabCozinhaBtn.addEventListener("click", () => switchTab("cozinha"));

  // Forms e botões
  document.getElementById("order-form").addEventListener("submit", handleOrderSubmit);
  document.getElementById("admin-pin-form").addEventListener("submit", handleAdminPinSubmit);
  document.getElementById("menu-form").addEventListener("submit", handleMenuSubmit);
  document.getElementById("clear-orders-btn").addEventListener("click", handleClearOrders);
  document.getElementById("admin-logout-btn").addEventListener("click", handleAdminLogout);
  document.getElementById("clear-menu-btn").addEventListener("click", handleClearMenu);

  // Nome salvo (opcional)
  const savedName = localStorage.getItem(SAVED_NAME_KEY) || "";
  const nameInput = document.getElementById("order-name");
  const rememberNameCheckbox = document.getElementById("remember-name");
  if (savedName && nameInput && rememberNameCheckbox) {
    nameInput.value = savedName;
    rememberNameCheckbox.checked = true;
  }

  const remembered = loadAdminRemembered();
  setState({ adminRemembered: remembered, isAdmin: remembered });

  subscribe(render);
  render(getState());

  // Carrega dados iniciais
  refreshAll().catch((err) => showGlobalError(err));

  // Começa atualizando o cardápio automaticamente (aba Almoçar)
  startMenuPolling();


  // Service worker
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }
}

async function refreshAll() {
  const [menu, orders] = await Promise.all([loadMenuForToday(), loadOrdersForToday()]);
  setState({ menuForToday: menu, ordersForToday: orders });
}

function switchTab(tab) {
  setState({ activeTab: tab });

  const state = getState();
  if (tab === "cozinha" && state.isAdmin) {
    ensureRealtime();
    // enquanto o cozinheiro está editando, não fica sobrescrevendo o formulário
    stopMenuPolling();
  } else {
    stopOrdersPolling();
  }

  // no modo Almoçar, mantém o cardápio sempre atualizado
  if (tab === "almocar") startMenuPolling();
  else stopMenuPolling();
}


function ensureRealtime() {
  // Fallback: atualiza a lista a cada 5s (ajuda em alguns navegadores/celulares)
  startOrdersPolling();

  if (unsubscribeRealtime) return;

  unsubscribeRealtime = subscribeOrdersForToday(async () => {
    try {
      const orders = await loadOrdersForToday();
      setState({ ordersForToday: orders });
    } catch {
      // Se falhar, o polling cobre
    }
  });
}

function stopRealtime() {
  if (unsubscribeRealtime) {
    unsubscribeRealtime();
    unsubscribeRealtime = null;
  }
  stopOrdersPolling();
}

function startOrdersPolling() {
  if (ordersPollTimer) return;
  ordersPollTimer = setInterval(async () => {
    try {
      const orders = await loadOrdersForToday();
      setState({ ordersForToday: orders });
    } catch {
      // silencioso
    }
  }, 5000);
}

function stopOrdersPolling() {
  if (ordersPollTimer) {
    clearInterval(ordersPollTimer);
    ordersPollTimer = null;
  }

function startMenuPolling() {
  if (menuPollTimer) return;
  // Atualiza o cardápio automaticamente (para todo mundo ver mudanças sem recarregar)
  menuPollTimer = setInterval(async () => {
    try {
      const menu = await loadMenuForToday();
      setState({ menuForToday: menu });
    } catch {
      // silencioso
    }
  }, 7000);
}

function stopMenuPolling() {
  if (menuPollTimer) {
    clearInterval(menuPollTimer);
    menuPollTimer = null;
  }
}
}

async function handleOrderSubmit(event) {
  event.preventDefault();
  const state = getState();
  const feedbackEl = document.getElementById("order-feedback");
  setFeedback(feedbackEl, "");

  if (!state.menuForToday) {
    setFeedback(feedbackEl, "Ainda não há cardápio registrado para hoje.", "error");
    return;
  }

  const nameInput = document.getElementById("order-name");
  const rememberNameCheckbox = document.getElementById("remember-name");
  const name = nameInput.value.trim();

  if (!name) {
    setFeedback(feedbackEl, "Por favor, preencha seu nome.", "error");
    return;
  }

  if (rememberNameCheckbox && rememberNameCheckbox.checked) {
    localStorage.setItem(SAVED_NAME_KEY, name);
  } else {
    localStorage.removeItem(SAVED_NAME_KEY);
  }

  try {
    await addOrderForToday({ name });
    setFeedback(feedbackEl, "Seu pedido de almoço foi registrado para hoje. ✅", "success");
  } catch (err) {
    setFeedback(feedbackEl, humanizeDbError(err), "error");
  }
}

function handleAdminPinSubmit(event) {
  event.preventDefault();
  const pinInput = document.getElementById("admin-pin");
  const rememberCheckbox = document.getElementById("remember-admin");
  const feedbackEl = document.getElementById("admin-pin-feedback");
  setFeedback(feedbackEl, "");

  const value = pinInput.value.trim();
  if (value !== ADMIN_PIN) {
    setFeedback(feedbackEl, "PIN incorreto.", "error");
    return;
  }

  const remember = rememberCheckbox.checked;
  saveAdminRemembered(remember);
  setState({ isAdmin: true, adminRemembered: remember });

  setFeedback(feedbackEl, "Acesso liberado para a cozinha.", "success");
  pinInput.value = "";

  ensureRealtime();
  refreshAll().catch(() => {});
}

async function handleMenuSubmit(event) {
  event.preventDefault();
  const mainDishInput = document.getElementById("menu-main-dish");
  const sidesInput = document.getElementById("menu-sides");
  const priceInput = document.getElementById("menu-price");
  const deadlineInput = document.getElementById("menu-deadline");
  const notesInput = document.getElementById("menu-notes");
  const feedbackEl = document.getElementById("menu-save-feedback");
  setFeedback(feedbackEl, "");

  const mainDish = mainDishInput.value.trim();
  const sides = sidesInput.value.trim();
  const price = Number(priceInput.value);
  const deadline = deadlineInput.value;
  const notes = notesInput.value.trim();

  if (!mainDish || !sides || !Number.isFinite(price) || price < 0) {
    setFeedback(feedbackEl, "Preencha os campos obrigatórios com valores válidos.", "error");
    return;
  }

  const menu = { mainDish, sides, price, deadline: deadline || "", notes: notes || "" };

  try {
    await saveMenuForToday(menu);
    const fresh = await loadMenuForToday();
    setState({ menuForToday: fresh });
    setFeedback(feedbackEl, "Cardápio de hoje salvo com sucesso. ✅", "success");
  } catch (err) {
    setFeedback(feedbackEl, humanizeDbError(err), "error");
  }
}

async function handleClearOrders() {
  if (!confirm("Tem certeza que deseja limpar todos os pedidos de hoje?")) return;
  try {
    await clearOrdersForToday();
    setState({ ordersForToday: [] });
  } catch (err) {
    alert(humanizeDbError(err));
  }
}


async function handleClearMenu() {
  if (!confirm("Tem certeza que deseja LIMPAR o cardápio de hoje?")) return;

  const feedbackEl = document.getElementById("menu-save-feedback");
  setFeedback(feedbackEl, "");

  try {
    await clearMenuForToday();
    setState({ menuForToday: null });
    // Limpa os campos na tela de cozinha
    document.getElementById("menu-main-dish").value = "";
    document.getElementById("menu-sides").value = "";
    document.getElementById("menu-price").value = "";
    document.getElementById("menu-deadline").value = "";
    document.getElementById("menu-notes").value = "";

    setFeedback(feedbackEl, "Cardápio de hoje removido. ✅", "success");
  } catch (err) {
    setFeedback(feedbackEl, humanizeDbError(err), "error");
  }
}

function handleAdminLogout() {
  saveAdminRemembered(false);
  setState({ isAdmin: false, adminRemembered: false });
  stopRealtime();
}

function formatTimeFromISO(isoString) {
  if (!isoString) return "—";
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "—";
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function render(state) {
  // Tabs
  document.getElementById("tab-almocar-btn").classList.toggle("active", state.activeTab === "almocar");
  document.getElementById("tab-cozinha-btn").classList.toggle("active", state.activeTab === "cozinha");

  document.getElementById("tab-almocar").classList.toggle("active", state.activeTab === "almocar");
  document.getElementById("tab-cozinha").classList.toggle("active", state.activeTab === "cozinha");

  // Almoçar - menu
  const menuContent = document.getElementById("menu-content");
  if (!state.menuForToday) {
    menuContent.innerHTML = '<p class="muted">Ainda não há cardápio registrado para hoje.</p>';
  } else {
    const { mainDish, sides, price, notes, deadline } = state.menuForToday;
    menuContent.innerHTML = `
      <p><strong>Prato principal:</strong> ${escapeHtml(mainDish)}</p>
      <p><strong>Acompanhamentos:</strong> ${escapeHtml(sides)}</p>
      <p><strong>Valor:</strong> R$ ${Number(price).toFixed(2)}</p>
      ${deadline ? `<p><strong>Horário limite para pedidos:</strong> ${escapeHtml(deadline)}</p>` : ""}
      ${notes ? `<p><strong>Observações:</strong> ${escapeHtml(notes)}</p>` : ""}
    `;
  }

  // Cozinha lock
  const cozinhaLocked = document.getElementById("cozinha-locked");
  const cozinhaPanel = document.getElementById("cozinha-panel");

  if (state.isAdmin) {
    cozinhaLocked.classList.add("hidden");
    cozinhaPanel.classList.remove("hidden");
  } else {
    cozinhaLocked.classList.remove("hidden");
    cozinhaPanel.classList.add("hidden");
  }

// Cozinha - preencher menu (não sobrescrever enquanto o usuário está digitando)
const mainDishInput = document.getElementById("menu-main-dish");
const sidesInput = document.getElementById("menu-sides");
const priceInput = document.getElementById("menu-price");
const deadlineInput = document.getElementById("menu-deadline");
const notesInput = document.getElementById("menu-notes");

const focused = document.activeElement;
const isEditingMenu =
  focused === mainDishInput ||
  focused === sidesInput ||
  focused === priceInput ||
  focused === deadlineInput ||
  focused === notesInput;

if (!isEditingMenu) {
  if (state.menuForToday) {
    mainDishInput.value = state.menuForToday.mainDish || "";
    sidesInput.value = state.menuForToday.sides || "";
    priceInput.value = state.menuForToday.price ?? "";
    deadlineInput.value = state.menuForToday.deadline || "";
    notesInput.value = state.menuForToday.notes || "";
  } else {
    mainDishInput.value = "";
    sidesInput.value = "";
    priceInput.value = "";
    deadlineInput.value = "";
    notesInput.value = "";
  }
}

  // Cozinha - pedidos
  const ordersSummary = document.getElementById("orders-summary");
  const tbody = document.getElementById("orders-table-body");
  tbody.innerHTML = "";

  const orders = state.ordersForToday || [];
  const total = orders.length;
  ordersSummary.textContent = total === 0 ? "Nenhum pedido registrado hoje." : `Total de pedidos hoje: ${total}`;

  orders.forEach((order) => {
    const tr = document.createElement("tr");

    const nameTd = document.createElement("td");
    nameTd.textContent = order.name;
    tr.appendChild(nameTd);

    const timeTd = document.createElement("td");
    timeTd.textContent = formatTimeFromISO(order.createdAt);
    tr.appendChild(timeTd);

    const paidTd = document.createElement("td");
    paidTd.className = "orders-paid-checkbox";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = !!order.paid;
    checkbox.addEventListener("change", async () => {
      try {
        await updateOrderPaid(order.id, checkbox.checked);
      } catch (err) {
        alert(humanizeDbError(err));
        checkbox.checked = !checkbox.checked;
      }
    });
    paidTd.appendChild(checkbox);
    tr.appendChild(paidTd);

    tbody.appendChild(tr);
  });
}

function setFeedback(el, text, type) {
  el.textContent = text || "";
  el.className = "feedback";
  if (type) el.classList.add(type);
}

function humanizeDbError(err) {
  const msg = err?.message || String(err);
  if (msg.includes("Credenciais do Supabase")) return msg;
  return msg || "Erro ao acessar o banco. Verifique internet e configuração do Supabase.";
}

function showGlobalError(err) {
  console.error(err);
  const el = document.getElementById("order-feedback");
  if (el) setFeedback(el, humanizeDbError(err), "error");
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

document.addEventListener("DOMContentLoaded", init);

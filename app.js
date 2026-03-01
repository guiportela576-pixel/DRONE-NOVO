// app.js

import { getState, setState, subscribe } from "./state.js";
import {
  loadMenuForToday,
  saveMenuForToday,
  loadOrdersForToday,
  addOrderForToday,
  updateOrderPaid,
  clearOrdersForToday,
  loadAdminRemembered,
  saveAdminRemembered,
} from "./db.js";
import { log } from "./utils.js";

const ADMIN_PIN = "2749";
const SAVED_NAME_KEY = "almoco_saved_name";

function init() {
  window.__APP_DEBUG__ = false;

  const yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  // Tabs
  const tabAlmocarBtn = document.getElementById("tab-almocar-btn");
  const tabCozinhaBtn = document.getElementById("tab-cozinha-btn");

  tabAlmocarBtn.addEventListener("click", () => switchTab("almocar"));
  tabCozinhaBtn.addEventListener("click", () => switchTab("cozinha"));

  // Forms e botões
  const orderForm = document.getElementById("order-form");
  orderForm.addEventListener("submit", handleOrderSubmit);

  const adminPinForm = document.getElementById("admin-pin-form");
  adminPinForm.addEventListener("submit", handleAdminPinSubmit);

  const menuForm = document.getElementById("menu-form");
  menuForm.addEventListener("submit", handleMenuSubmit);

  const clearOrdersBtn = document.getElementById("clear-orders-btn");
  clearOrdersBtn.addEventListener("click", handleClearOrders);

  const adminLogoutBtn = document.getElementById("admin-logout-btn");
  adminLogoutBtn.addEventListener("click", handleAdminLogout);

  // Preencher nome salvo, se existir
  const savedName = localStorage.getItem(SAVED_NAME_KEY) || "";
  const nameInput = document.getElementById("order-name");
  if (savedName && nameInput) {
    nameInput.value = savedName;
  }

  // Carregar dados iniciais
  const remembered = loadAdminRemembered();
  const menu = loadMenuForToday();
  const orders = loadOrdersForToday();

  setState({
    adminRemembered: remembered,
    isAdmin: remembered,
    menuForToday: menu,
    ordersForToday: orders,
  });

  // Inscrever renderizador
  subscribe(render);
  render(getState());

  // Service worker
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("./service-worker.js")
      .then(() => log("Service worker registrado."))
      .catch((err) => console.error("Erro ao registrar service worker:", err));
  }
}

function switchTab(tab) {
  setState({ activeTab: tab });
}

function handleOrderSubmit(event) {
  event.preventDefault();
  const state = getState();
  const feedbackEl = document.getElementById("order-feedback");
  feedbackEl.textContent = "";
  feedbackEl.className = "feedback";

  if (!state.menuForToday) {
    feedbackEl.textContent = "Ainda não há cardápio registrado para hoje.";
    feedbackEl.classList.add("error");
    return;
  }

  const nameInput = document.getElementById("order-name");
  const notesInput = document.getElementById("order-notes");

  const name = nameInput.value.trim();
  const notes = notesInput.value.trim();

  if (!name) {
    feedbackEl.textContent = "Por favor, preencha seu nome.";
    feedbackEl.classList.add("error");
    return;
  }

  // Salvar nome para próximos acessos neste aparelho
  localStorage.setItem(SAVED_NAME_KEY, name);

  addOrderForToday({ name, notes });
  const orders = loadOrdersForToday();
  setState({ ordersForToday: orders });

  feedbackEl.textContent = "Seu pedido de almoço foi registrado para hoje. ✅";
  feedbackEl.classList.add("success");

  // Mantém o nome preenchido; limpa apenas observações
  notesInput.value = "";
}

function handleAdminPinSubmit(event) {
  event.preventDefault();
  const pinInput = document.getElementById("admin-pin");
  const rememberCheckbox = document.getElementById("remember-admin");
  const feedbackEl = document.getElementById("admin-pin-feedback");

  feedbackEl.textContent = "";
  feedbackEl.className = "feedback";

  const value = pinInput.value.trim();
  if (value !== ADMIN_PIN) {
    feedbackEl.textContent = "PIN incorreto.";
    feedbackEl.classList.add("error");
    return;
  }

  const remember = rememberCheckbox.checked;
  saveAdminRemembered(remember);
  setState({
    isAdmin: true,
    adminRemembered: remember,
  });

  feedbackEl.textContent = "Acesso liberado para a cozinha.";
  feedbackEl.classList.add("success");
  pinInput.value = "";
}

function handleMenuSubmit(event) {
  event.preventDefault();
  const mainDishInput = document.getElementById("menu-main-dish");
  const sidesInput = document.getElementById("menu-sides");
  const veggieInput = document.getElementById("menu-veggie");
  const priceInput = document.getElementById("menu-price");
  const deadlineInput = document.getElementById("menu-deadline");
  const notesInput = document.getElementById("menu-notes");
  const feedbackEl = document.getElementById("menu-save-feedback");

  feedbackEl.textContent = "";
  feedbackEl.className = "feedback";

  const mainDish = mainDishInput.value.trim();
  const sides = sidesInput.value.trim();
  const veggie = veggieInput.value.trim();
  const price = Number(priceInput.value);
  const deadline = deadlineInput.value;
  const notes = notesInput.value.trim();

  if (!mainDish || !sides || !Number.isFinite(price) || price < 0) {
    feedbackEl.textContent = "Preencha os campos obrigatórios com valores válidos.";
    feedbackEl.classList.add("error");
    return;
  }

  const menu = {
    mainDish,
    sides,
    veggie: veggie || "",
    price,
    deadline: deadline || "",
    notes: notes || "",
  };

  saveMenuForToday(menu);
  setState({ menuForToday: menu });

  feedbackEl.textContent = "Cardápio de hoje salvo com sucesso. ✅";
  feedbackEl.classList.add("success");
}

function handleClearOrders() {
  if (!confirm("Tem certeza que deseja limpar todos os pedidos de hoje?")) {
    return;
  }
  clearOrdersForToday();
  setState({ ordersForToday: [] });
}

function handleAdminLogout() {
  saveAdminRemembered(false);
  setState({ isAdmin: false, adminRemembered: false });
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
  const tabAlmocarBtn = document.getElementById("tab-almocar-btn");
  const tabCozinhaBtn = document.getElementById("tab-cozinha-btn");
  const almocarSection = document.getElementById("tab-almocar");
  const cozinhaSection = document.getElementById("tab-cozinha");

  tabAlmocarBtn.classList.toggle("active", state.activeTab === "almocar");
  tabCozinhaBtn.classList.toggle("active", state.activeTab === "cozinha");

  almocarSection.classList.toggle("active", state.activeTab === "almocar");
  cozinhaSection.classList.toggle("active", state.activeTab === "cozinha");

  // Aba Almoçar - cardápio
  const menuContent = document.getElementById("menu-content");
  if (!state.menuForToday) {
    menuContent.innerHTML = '<p class="muted">Ainda não há cardápio registrado para hoje.</p>';
  } else {
    const { mainDish, sides, veggie, price, notes, deadline } = state.menuForToday;
    menuContent.innerHTML = `
      <p><strong>Prato principal:</strong> ${mainDish}</p>
      <p><strong>Acompanhamentos:</strong> ${sides}</p>
      ${veggie ? `<p><strong>Opção vegetariana:</strong> ${veggie}</p>` : ""}
      <p><strong>Valor:</strong> R$ ${price.toFixed(2)}</p>
      ${deadline ? `<p><strong>Horário limite para pedidos:</strong> ${deadline}</p>` : ""}
      ${notes ? `<p><strong>Observações:</strong> ${notes}</p>` : ""}
    `;
  }

  // Aba Cozinha - bloqueio por PIN
  const cozinhaLocked = document.getElementById("cozinha-locked");
  const cozinhaPanel = document.getElementById("cozinha-panel");

  if (state.isAdmin) {
    cozinhaLocked.classList.add("hidden");
    cozinhaPanel.classList.remove("hidden");
  } else {
    cozinhaLocked.classList.remove("hidden");
    cozinhaPanel.classList.add("hidden");
  }

  // Aba Cozinha - preencher formulário de menu com dados atuais (se tiver)
  const mainDishInput = document.getElementById("menu-main-dish");
  const sidesInput = document.getElementById("menu-sides");
  const veggieInput = document.getElementById("menu-veggie");
  const priceInput = document.getElementById("menu-price");
  const deadlineInput = document.getElementById("menu-deadline");
  const notesInput = document.getElementById("menu-notes");

  if (state.menuForToday) {
    mainDishInput.value = state.menuForToday.mainDish || "";
    sidesInput.value = state.menuForToday.sides || "";
    veggieInput.value = state.menuForToday.veggie || "";
    priceInput.value = state.menuForToday.price ?? "";
    deadlineInput.value = state.menuForToday.deadline || "";
    notesInput.value = state.menuForToday.notes || "";
  } else {
    mainDishInput.value = "";
    sidesInput.value = "";
    veggieInput.value = "";
    priceInput.value = "";
    deadlineInput.value = "";
    notesInput.value = "";
  }

  // Aba Cozinha - tabela de pedidos
  const ordersSummary = document.getElementById("orders-summary");
  const tbody = document.getElementById("orders-table-body");
  tbody.innerHTML = "";

  const orders = state.ordersForToday || [];
  const total = orders.length;

  if (total === 0) {
    ordersSummary.textContent = "Nenhum pedido registrado hoje.";
  } else {
    ordersSummary.textContent = `Total de pedidos hoje: ${total}`;
  }

  orders.forEach((order) => {
    const tr = document.createElement("tr");

    const nameTd = document.createElement("td");
    nameTd.textContent = order.name;
    tr.appendChild(nameTd);

    const timeTd = document.createElement("td");
    timeTd.textContent = formatTimeFromISO(order.createdAt);
    tr.appendChild(timeTd);

    const notesTd = document.createElement("td");
    notesTd.textContent = order.notes || "—";
    tr.appendChild(notesTd);

    const paidTd = document.createElement("td");
    paidTd.className = "orders-paid-checkbox";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = !!order.paid;
    checkbox.addEventListener("change", () => {
      const updated = updateOrderPaid(order.id, checkbox.checked);
      if (updated) {
        const refreshed = loadOrdersForToday();
        setState({ ordersForToday: refreshed });
      }
    });
    paidTd.appendChild(checkbox);
    tr.appendChild(paidTd);

    tbody.appendChild(tr);
  });
}

document.addEventListener("DOMContentLoaded", init);

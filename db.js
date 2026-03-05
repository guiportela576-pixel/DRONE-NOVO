// db.js (Supabase)
// Cole suas credenciais aqui:
// 1) SUPABASE_URL: Project URL (Settings > API)
// 2) SUPABASE_ANON_KEY: anon/publishable key (Settings > API)
//
// Esta versão usa Realtime (Postgres Changes) para a tabela "orders".

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { getTodayKey, log } from "./utils.js";

// >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
// COLE AQUI
export const SUPABASE_URL = "COLE_AQUI_SEU_SUPABASE_URL";
export const SUPABASE_ANON_KEY = "COLE_AQUI_SUA_SUPABASE_ANON_KEY";
// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

let supabase = null;

export function getSupabaseClient() {
  if (supabase) return supabase;

  if (
    !SUPABASE_URL ||
    !SUPABASE_ANON_KEY ||
    SUPABASE_URL.includes("COLE_AQUI") ||
    SUPABASE_ANON_KEY.includes("COLE_AQUI")
  ) {
    throw new Error(
      "Credenciais do Supabase não configuradas em db.js (SUPABASE_URL / SUPABASE_ANON_KEY)."
    );
  }

  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return supabase;
}

export async function loadMenuForToday() {
  const dateKey = getTodayKey();
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("menu")
    .select("*")
    .eq("date_key", dateKey)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    mainDish: data.main_dish || "",
    sides: data.sides || "",
    price: Number(data.price ?? 0),
    deadline: data.deadline || "",
    notes: data.notes || "",
  };
}

export async function saveMenuForToday(menu) {
  const dateKey = getTodayKey();
  const client = getSupabaseClient();
  const payload = {
    date_key: dateKey,
    main_dish: menu.mainDish,
    sides: menu.sides,
    price: menu.price,
    deadline: menu.deadline || "",
    notes: menu.notes || "",
  };

  const { error } = await client.from("menu").upsert(payload, { onConflict: "date_key" });
  if (error) throw error;
}


export async function clearMenuForToday() {
  const dateKey = getTodayKey();
  const client = getSupabaseClient();
  const { error } = await client.from("menu").delete().eq("date_key", dateKey);
  if (error) throw error;
}

export async function loadOrdersForToday() {
  const dateKey = getTodayKey();
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("orders")
    .select("*")
    .eq("date_key", dateKey)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    paid: !!row.paid,
  }));
}

export async function addOrderForToday({ name }) {
  const dateKey = getTodayKey();
  const client = getSupabaseClient();

  const { data, error } = await client
    .from("orders")
    .insert({ date_key: dateKey, name })
    .select("*")
    .single();

  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    createdAt: data.created_at,
    paid: !!data.paid,
  };
}

export async function updateOrderPaid(orderId, paid) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("orders")
    .update({ paid: !!paid })
    .eq("id", orderId)
    .select("*")
    .single();

  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    createdAt: data.created_at,
    paid: !!data.paid,
  };
}

export async function clearOrdersForToday() {
  const dateKey = getTodayKey();
  const client = getSupabaseClient();
  const { error } = await client.from("orders").delete().eq("date_key", dateKey);
  if (error) throw error;
}

// Realtime subscription for today's orders
export function subscribeOrdersForToday(onChange) {
  const dateKey = getTodayKey();
  const client = getSupabaseClient();

  const channel = client
    .channel("orders-today")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "orders", filter: `date_key=eq.${dateKey}` },
      (payload) => {
        log("Realtime payload:", payload);
        onChange(payload);
      }
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}

// Admin remember permanece local no aparelho
const STORAGE_VERSION = "supabase_v2";
const ADMIN_REMEMBER_KEY = `almoco_admin_remember_${STORAGE_VERSION}`;

export function loadAdminRemembered() {
  const value = localStorage.getItem(ADMIN_REMEMBER_KEY);
  return value === "1";
}

export function saveAdminRemembered(remembered) {
  if (remembered) localStorage.setItem(ADMIN_REMEMBER_KEY, "1");
  else localStorage.removeItem(ADMIN_REMEMBER_KEY);
}

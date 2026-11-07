
import { supabase } from "./config.js";

const message = document.getElementById("statusMessage");

const avatarMap = {
  "hunter-01": "⚔️",
  "hunter-02": "🛡️",
  "hunter-03": "🔥",
  "hunter-04": "🌑",
  "hunter-05": "⚡",
  "hunter-06": "🐉"
};

const attributes = [
  { key: "str", label: "STR" },
  { key: "vit", label: "VIT" },
  { key: "agi", label: "AGI" },
  { key: "int", label: "INT" },
  { key: "per", label: "PER" },
  { key: "sen", label: "SEN" }
];

const effectLabels = {
  bonus_str: "STRENGTH",
  bonus_vit: "VITALITY",
  bonus_int: "INTELLIGENCE",
  focus: "FOCUS",
  stamina: "STAMINA"
};

let effectsTimer = null;

// =========================================
// GENERAL HELPERS
// =========================================

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function setBar(id, percentage) {
  const element = document.getElementById(id);

  if (element) {
    element.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
  }
}

// =========================================
// ATTRIBUTES
// =========================================

function renderAttributes(hunterStats) {
  const container = document.getElementById("statusStatsList");

  if (!container) return;

  container.replaceChildren();

  attributes.forEach(({ key, label }) => {
    const base = hunterStats.base_stats[key] ?? 0;
    const bonus = hunterStats.equipment_bonus[key] ?? 0;
    const total = hunterStats.total_stats[key] ?? 0;

    const card = document.createElement("div");
    card.className = "status-stat-card";

    const name = document.createElement("span");
    name.className = "status-stat-name";
    name.textContent = label;

    const totalValue = document.createElement("strong");
    totalValue.className = "status-stat-total";
    totalValue.textContent = total;

    const breakdown = document.createElement("div");
    breakdown.className = "status-stat-breakdown";

    const baseValue = document.createElement("span");
    baseValue.textContent = `BASE ${base}`;

    const bonusValue = document.createElement("span");
    bonusValue.textContent = `EQUIPMENT +${bonus}`;

    breakdown.append(baseValue, bonusValue);
    card.append(name, totalValue, breakdown);
    container.appendChild(card);
  });
}

// =========================================
// EQUIPMENT
// =========================================

function renderEquipment(items) {
  const container = document.getElementById("statusEquipmentList");

  if (!container) return;

  container.replaceChildren();

  if (!items || items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "status-empty";
    empty.textContent = "NO EQUIPMENT CURRENTLY EQUIPPED";
    container.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "status-equipment-card";

    const top = document.createElement("div");
    top.className = "status-equipment-top";

    const slot = document.createElement("span");
    slot.className = "status-equipment-slot";
    slot.textContent = item.equipment_slot || item.item_type || "EQUIPMENT";

    const rarity = document.createElement("span");
    rarity.className = "status-equipment-rarity";
    rarity.textContent = item.rarity || "COMMON";

    top.append(slot, rarity);

    const name = document.createElement("h3");
    name.textContent = item.item_name;

    const enhancement = document.createElement("span");
    enhancement.className = "status-equipment-enhancement";
    enhancement.textContent = `ENHANCEMENT +${item.enhancement_level ?? 0}`;

    const bonuses = document.createElement("div");
    bonuses.className = "status-equipment-bonuses";

    const bonusKeys = [
      ["STR", "bonus_str"],
      ["VIT", "bonus_vit"],
      ["AGI", "bonus_agi"],
      ["INT", "bonus_int"],
      ["PER", "bonus_per"],
      ["SEN", "bonus_sen"]
    ];

    bonusKeys.forEach(([label, key]) => {
      const baseBonus = Number(item[key] ?? 0);
      const multiplier = 1 + 0.1 * (item.enhancement_level ?? 0);
      const finalBonus = Math.round(baseBonus * multiplier);

      if (finalBonus > 0) {
        const bonus = document.createElement("span");
        bonus.textContent = `+${finalBonus} ${label}`;
        bonuses.appendChild(bonus);
      }
    });

    if (!bonuses.children.length) {
      const noBonus = document.createElement("span");
      noBonus.textContent = "NO ATTRIBUTE BONUS";
      bonuses.appendChild(noBonus);
    }

    card.append(top, name, enhancement, bonuses);
    container.appendChild(card);
  });
}

// =========================================
// HP AND ENERGY
// =========================================

function renderResources(resources) {
  const hp = Number(resources.hp ?? 0);
  const maxHP = Number(resources.max_hp ?? 100);

  const energy = Number(resources.energy ?? 0);
  const maxEnergy = Number(resources.max_energy ?? 100);

  const hpPercentage = maxHP > 0
    ? (hp / maxHP) * 100
    : 0;

  const energyPercentage = maxEnergy > 0
    ? (energy / maxEnergy) * 100
    : 0;

  setText("statusHP", `${hp} / ${maxHP}`);
  setText("statusEnergy", `${energy} / ${maxEnergy}`);

  setBar("statusHPBar", hpPercentage);
  setBar("statusEnergyBar", energyPercentage);
}

// =========================================
// ACTIVE EFFECTS
// =========================================

function formatRemainingTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}H ${minutes}M`;
  }

  if (minutes > 0) {
    return `${minutes}M ${remainingSeconds}S`;
  }

  return `${remainingSeconds}S`;
}

function renderActiveEffects(effects) {
  const container = document.getElementById("statusActiveEffects");

  if (!container) return;

  if (effectsTimer) {
    clearInterval(effectsTimer);
    effectsTimer = null;
  }

  container.replaceChildren();

  if (!effects || effects.length === 0) {
    const empty = document.createElement("div");
    empty.className = "status-empty";
    empty.textContent = "NO ACTIVE EFFECTS";
    container.appendChild(empty);
    return;
  }

  effects.forEach(effect => {
    const card = document.createElement("article");
    card.className = "active-effect-card";

    const icon = document.createElement("div");
    icon.className = "active-effect-icon";
    icon.textContent = "✦";

    const info = document.createElement("div");
    info.className = "active-effect-info";

    const category = document.createElement("span");
    category.className = "active-effect-category";
    category.textContent = "ACTIVE BUFF";

    const name = document.createElement("h3");
    name.textContent = effectLabels[effect.effect_type] || effect.effect_type.toUpperCase();

    const value = document.createElement("strong");
    const numericValue = Number(effect.effect_value);
    const isAttributeBonus = effect.effect_type.startsWith("bonus_");

    value.textContent = `${isAttributeBonus ? "+" : ""}${numericValue}${isAttributeBonus ? " STAT" : ""}`;

    const timeContainer = document.createElement("div");
    timeContainer.className = "active-effect-time";

    const timeLabel = document.createElement("span");
    timeLabel.textContent = "TIME REMAINING";

    const countdown = document.createElement("span");
    countdown.className = "effect-countdown";

    timeContainer.append(timeLabel, countdown);

    const bar = document.createElement("div");
    bar.className = "active-effect-bar";

    const barFill = document.createElement("div");
    barFill.className = "active-effect-bar-fill";

    bar.appendChild(barFill);

    info.append(category, name, value, timeContainer, bar);
    card.append(icon, info);

    card.dataset.expires = new Date(effect.expires_at).getTime();
    card.dataset.activated = new Date(effect.activated_at).getTime();

    container.appendChild(card);
  });

  updateEffectCountdowns();
  effectsTimer = setInterval(updateEffectCountdowns, 1000);
}

function updateEffectCountdowns() {
  const container = document.getElementById("statusActiveEffects");

  if (!container) return;

  const now = Date.now();
  let hasExpired = false;

  container.querySelectorAll(".active-effect-card").forEach(card => {
    const expiresAt = Number(card.dataset.expires);
    const activatedAt = Number(card.dataset.activated);

    const totalDuration = Math.max(1, expiresAt - activatedAt);
    const remainingMilliseconds = Math.max(0, expiresAt - now);
    const remainingSeconds = Math.ceil(remainingMilliseconds / 1000);

    const percentage = Math.min(
      100,
      Math.max(0, (remainingMilliseconds / totalDuration) * 100)
    );

    const countdown = card.querySelector(".effect-countdown");
    const barFill = card.querySelector(".active-effect-bar-fill");

    if (countdown) {
      countdown.textContent = formatRemainingTime(remainingSeconds);
    }

    if (barFill) {
      barFill.style.width = `${percentage}%`;
    }

    if (remainingSeconds <= 0) {
      hasExpired = true;
    }
  });

  if (hasExpired) {
    clearInterval(effectsTimer);
    effectsTimer = null;
    loadActiveEffects();
  }
}

async function loadActiveEffects() {
  const { data, error } = await supabase
    .from("active_effects")
    .select("effect_type, effect_value, activated_at, expires_at")
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: true });

  if (error) throw error;

  renderActiveEffects(data || []);
}

// =========================================
// INITIALIZE STATUS
// =========================================

async function initializeStatus() {
  try {
    // 1. VERIFY SESSION

    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) {
      window.location.href = "login.html";
      return;
    }

    // 2. VERIFY AUTHORIZATION

    const { data: authorized, error: authError } =
      await supabase.rpc("is_authorized");

    if (authError || authorized !== true) {
      await supabase.auth.signOut();
      window.location.href = "login.html";
      return;
    }

    // 3. LOAD PROFILE

    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select(`
          display_name,
          avatar_id,
          rank,
          level,
          xp,
          coins,
          current_streak,
          longest_streak
        `)
        .eq("user_id", user.id)
        .single();

    if (profileError) throw profileError;

    setText("statusName", profile.display_name || "UNKNOWN HUNTER");
    setText("statusAvatar", avatarMap[profile.avatar_id] || "⚔️");
    setText("statusRank", `RANK ${profile.rank}`);
    setText("statusLevel", `LV. ${profile.level}`);
    setText("statusCoins", `${profile.coins ?? 0} COINS`);
    setText("statusXP", `${profile.xp ?? 0} XP`);

    // XP PROGRESS

    const currentLevelXp =
      100 * (profile.level - 1) * profile.level / 2;

    const nextLevelXp =
      100 * profile.level * (profile.level + 1) / 2;

    const xpIntoLevel = Math.max(
      0,
      (profile.xp ?? 0) - currentLevelXp
    );

    const xpNeeded = nextLevelXp - currentLevelXp;

    const xpProgress = xpNeeded > 0
      ? Math.min(100, (xpIntoLevel / xpNeeded) * 100)
      : 0;

    setBar("statusXPBar", xpProgress);

    setText(
      "statusXPNext",
      `${Math.max(0, nextLevelXp - (profile.xp ?? 0))} XP TO NEXT LEVEL · ${Math.round(xpProgress)}%`
    );

    // 4. LOAD HP AND ENERGY

    const { data: resources, error: resourcesError } =
      await supabase
        .from("player_stats")
        .select("hp, max_hp, energy, max_energy")
        .eq("user_id", user.id)
        .single();

    if (resourcesError) throw resourcesError;

    renderResources(resources);

    // 5. LOAD ACTIVE EFFECTS

    await loadActiveEffects();

    // 6. LOAD ATTRIBUTES

    const { data: hunterStats, error: hunterStatsError } =
      await supabase.rpc("get_hunter_stats");

    if (hunterStatsError) throw hunterStatsError;

    renderAttributes(hunterStats);

    // 7. LOAD EQUIPPED ITEMS

    const { data: equipment, error: equipmentError } =
      await supabase
        .from("inventory")
        .select(`
          id,
          item_name,
          item_type,
          rarity,
          enhancement_level,
          shop_items (
            equipment_slot,
            bonus_str,
            bonus_vit,
            bonus_agi,
            bonus_int,
            bonus_per,
            bonus_sen
          )
        `)
        .eq("user_id", user.id)
        .eq("is_equipped", true);

    if (equipmentError) throw equipmentError;

    const formattedEquipment = (equipment || []).map((item) => ({
      ...item,
      equipment_slot: item.shop_items?.equipment_slot,
      bonus_str: item.shop_items?.bonus_str ?? 0,
      bonus_vit: item.shop_items?.bonus_vit ?? 0,
      bonus_agi: item.shop_items?.bonus_agi ?? 0,
      bonus_int: item.shop_items?.bonus_int ?? 0,
      bonus_per: item.shop_items?.bonus_per ?? 0,
      bonus_sen: item.shop_items?.bonus_sen ?? 0
    }));

    renderEquipment(formattedEquipment);

    // 8. LOAD STREAKS

    setText("statusCurrentStreak", profile.current_streak ?? 0);
    setText("statusLongestStreak", profile.longest_streak ?? 0);

    // 9. LOAD ACHIEVEMENTS

    const { count: achievementCount, error: achievementError } =
      await supabase
        .from("user_achievements")
        .select("achievement_id", {
          count: "exact",
          head: true
        })
        .eq("user_id", user.id);

    if (achievementError) throw achievementError;

    setText("statusAchievements", achievementCount ?? 0);

    setText("statusMessage", "SYSTEM ONLINE · HUNTER DATA LOADED");

  } catch (error) {
    console.error("Status error:", error);
    setText("statusMessage", `SYSTEM ERROR · ${error.message}`);
  }
}

// =========================================
// LOGOUT
// =========================================

document.getElementById("logoutButton")?.addEventListener("click", async () => {
  const { error } = await supabase.auth.signOut();

  if (error) {
    setText("statusMessage", error.message);
    return;
  }

  window.location.href = "login.html";
});

// =========================================
// START
// =========================================

initializeStatus();

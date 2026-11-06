
import { supabase } from "./config.js";

const inventoryContainer = document.getElementById("inventoryItems");
const inventoryMessage = document.getElementById("inventoryMessage");
const inventoryTotal = document.getElementById("inventoryTotal");
const inventoryFilter = document.getElementById("inventoryFilter");

const weaponCount = document.getElementById("weaponCount");
const armorCount = document.getElementById("armorCount");
const consumableCount = document.getElementById("consumableCount");
const materialCount = document.getElementById("materialCount");

let allItems = [];

const itemIcons = {
  consumable: "🧪",
  weapon: "⚔️",
  armor: "🛡️",
  accessory: "💍",
  material: "💎",
  skill_item: "📜",
  cosmetic: "✨",
  boost: "⚡"
};

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function formatCategory(type) {
  const categories = {
    consumable: "CONSUMABLE",
    weapon: "WEAPON",
    armor: "ARMOR",
    accessory: "ACCESSORY",
    material: "MATERIAL",
    skill_item: "SKILL ITEM",
    cosmetic: "COSMETIC",
    boost: "BOOST"
  };

  return categories[type] || type.toUpperCase();
}

function canEquip(item) {
  return (
    ["weapon", "armor", "accessory"].includes(item.item_type) &&
    item.shop_items?.equipment_slot
  );
}
function getEnhancedBonus(item, column) {
  const baseBonus = Number(item.shop_items?.[column] || 0);
  const enhancementLevel = Number(item.enhancement_level || 0);

  return Math.round(baseBonus * (1 + 0.10 * enhancementLevel));
}
// LOAD INVENTORY AND EQUIPMENT
async function loadInventory() {
  const { data: authData, error: authError } =
    await supabase.auth.getUser();

  if (authError) throw authError;

  if (!authData.user) {
    window.location.href = "index.html";
    return false;
  }

  const { data: authorization, error: authorizationError } =
    await supabase.rpc("is_authorized");

  if (authorizationError) throw authorizationError;

  if (!authorization) {
    await supabase.auth.signOut();
    window.location.href = "index.html";
    return false;
  }
const { data: profile, error: profileError } = await supabase
  .from("profiles")
  .select("display_name, rank, level")
  .eq("user_id", authData.user.id)
  .single();

if (profileError) throw profileError;

const nameEl = document.getElementById("equipmentHunterName");
const rankEl = document.getElementById("equipmentHunterRank");
const levelEl = document.getElementById("equipmentHunterLevel");

if (nameEl) nameEl.textContent = profile.display_name || "HUNTER";
if (rankEl) rankEl.textContent = `RANK ${profile.rank || "E"}`;
if (levelEl) levelEl.textContent = `LV. ${profile.level ?? 1}`;
  const { data, error } = await supabase
    .from("inventory")
    .select(`
      id,
      item_name,
      item_description,
      item_type,
      rarity,
      quantity,
      is_equipped,
      enhancement_level,
      shop_item_id,
      shop_items (
        equipment_slot,
        bonus_str,
        bonus_agi,
        bonus_vit,
        bonus_int,
        bonus_per,
        bonus_sen,
        hp_restore,
        energy_restore
      )
    `)
    .order("obtained_at", { ascending: false });

  if (error) throw error;

  allItems = data || [];

  updateSummary();
  renderEquipment();
  renderInventory();

  return true;
}

// SUMMARY COUNTERS
function updateSummary() {
  inventoryTotal.textContent = allItems.reduce(
    (total, item) => total + item.quantity,
    0
  );

  weaponCount.textContent = allItems
    .filter(item => item.item_type === "weapon").length;

  armorCount.textContent = allItems
    .filter(item => item.item_type === "armor").length;

  consumableCount.textContent = allItems
    .filter(item => item.item_type === "consumable").length;

  materialCount.textContent = allItems
    .filter(item => item.item_type === "material").length;
}

// HUNTER EQUIPMENT DISPLAY


function renderEquipment() {
  const slots = document.querySelectorAll(".equipment-slot");

  slots.forEach(slot => {
    const slotName = slot.dataset.slot;

    const equippedItem = allItems.find(item =>
      item.is_equipped &&
      item.shop_items?.equipment_slot === slotName
    );

    const small = slot.querySelector("small");

    if (!small) return;

    // Reset slot content
    slot.classList.toggle("slot-equipped", Boolean(equippedItem));

    if (equippedItem) {
      small.textContent = "";

      const itemName = document.createElement("span");
      itemName.className = "equipped-item-name";
      itemName.textContent = equippedItem.item_name;

      const rarity = document.createElement("span");
      rarity.className = "equipped-item-rarity";
      rarity.textContent = equippedItem.rarity.toUpperCase();

      small.append(itemName, rarity);

      slot.title = equippedItem.item_name;
    } else {
      small.textContent = "EMPTY";
      slot.title = "Empty equipment slot";
    }
  });

  // CALCULATE TOTAL EQUIPMENT BONUSES
  const bonusAttributes = {
    STR: "bonus_str",
    AGI: "bonus_agi",
    VIT: "bonus_vit",
    INT: "bonus_int",
    PER: "bonus_per",
    SEN: "bonus_sen"
  };

  const equippedItems = allItems.filter(item => item.is_equipped);

  Object.entries(bonusAttributes).forEach(([attribute, column]) => {
   const totalBonus = equippedItems.reduce((total, item) => {
  return total + getEnhancedBonus(item, column);
}, 0);

    const element = document.getElementById(`bonus${attribute}`);

    if (element) {
      element.textContent = `+${totalBonus}`;
    }
  });
}


// INVENTORY CARDS
function renderInventory() {
  const filter = inventoryFilter.value;

  const filteredItems = allItems.filter(item =>
    filter === "all" || item.item_type === filter
  );

  if (!filteredItems.length) {
    inventoryContainer.innerHTML = `
      <div class="inventory-empty">
        <h3>INVENTORY EMPTY</h3>
        <p>Visit the SYSTEM SHOP to acquire new items.</p>
      </div>
    `;
    return;
  }

  inventoryContainer.innerHTML = filteredItems.map(item => {
    const icon = itemIcons[item.item_type] || "📦";
    const equipment = item.shop_items || {};

    const stats = [
  ["STR", getEnhancedBonus(item, "bonus_str")],
  ["AGI", getEnhancedBonus(item, "bonus_agi")],
  ["VIT", getEnhancedBonus(item, "bonus_vit")],
  ["INT", getEnhancedBonus(item, "bonus_int")],
  ["PER", getEnhancedBonus(item, "bonus_per")],
  ["SEN", getEnhancedBonus(item, "bonus_sen")]
].filter(([, value]) => value > 0);

    const equipButton = canEquip(item)
      ? item.is_equipped
        ? `<button class="inventory-action unequip-button"
             data-unequip-id="${item.id}">
             UNEQUIP
           </button>`
        : `<button class="inventory-action equip-button"
             data-equip-id="${item.id}">
             EQUIP
           </button>`
      : "";
const enhanceButton = canEquip(item) &&
  Number(item.enhancement_level || 0) < 10
    ? `<button class="inventory-action enhance-button"
         data-enhance-id="${item.id}">
         ENHANCE
       </button>`
    : "";
    return `
      <article class="inventory-item rarity-${escapeHTML(item.rarity)}">

        <div class="inventory-item-icon">${icon}</div>

        <span class="inventory-item-category">
          ${escapeHTML(formatCategory(item.item_type))}
        </span>

        <h3>${escapeHTML(item.item_name)}</h3>

        <p class="inventory-item-description">
          ${escapeHTML(item.item_description || "No description available.")}
        </p>

        <span class="inventory-item-rarity">
          ${escapeHTML(item.rarity.toUpperCase())}
        </span>

        <div class="inventory-item-footer">
          <span>QUANTITY: ${item.quantity}</span>
          <span>+${item.enhancement_level || 0} ENH</span>
        </div>

        ${
          stats.length
            ? `<div class="inventory-item-stats">
                ${stats.map(([name, value]) =>
                  `<span>${name} +${value}</span>`
                ).join("")}
              </div>`
            : ""
        }

        ${
          item.is_equipped
            ? `<span class="inventory-equipped">EQUIPPED</span>`
            : ""
        }

        ${equipButton}
        ${enhanceButton}

      </article>
    `;
  }).join("");
}

// EQUIP / UNEQUIP ACTIONS
inventoryContainer.addEventListener("click", async event => {
 const equipButton = event.target.closest("[data-equip-id]");
const unequipButton = event.target.closest("[data-unequip-id]");
const enhanceButton = event.target.closest("[data-enhance-id]");

if (!equipButton && !unequipButton && !enhanceButton) return;

const button = equipButton || unequipButton || enhanceButton;

const isEnhancing = Boolean(enhanceButton);
const isEquipping = Boolean(equipButton);

  const itemId = Number(
  isEnhancing
    ? enhanceButton.dataset.enhanceId
    : isEquipping
      ? equipButton.dataset.equipId
      : unequipButton.dataset.unequipId
);

  button.disabled = true;
  button.textContent = "PROCESSING...";

  try {
    const rpcName = isEnhancing
  ? "enhance_inventory_item"
  : isEquipping
    ? "equip_inventory_item"
    : "unequip_inventory_item";

const { data, error } = await supabase.rpc(
  rpcName,
  { p_inventory_id: itemId }
);

    if (error) throw error;

    if (!data.success) {
  inventoryMessage.textContent = data.message || "ACTION FAILED.";
  await loadInventory();
  return;
}

if (isEnhancing) {
  inventoryMessage.textContent =
    `${data.item_name.toUpperCase()} ENHANCED TO +${data.enhancement_level}! ` +
    `${data.cost} COINS SPENT. ${data.remaining_coins} COINS REMAINING.`;

} else if (isEquipping) {
  inventoryMessage.textContent =
    `${data.item_name.toUpperCase()} EQUIPPED SUCCESSFULLY!`;

} else {
  inventoryMessage.textContent =
    `${data.item_name.toUpperCase()} UNEQUIPPED SUCCESSFULLY!`;
}

    await loadInventory();

  } catch (error) {
    console.error(error);
    inventoryMessage.textContent =
      error.message || "EQUIPMENT UPDATE FAILED.";

    renderInventory();
  }
});

// FILTER
inventoryFilter.addEventListener("change", renderInventory);

// LOGOUT
document.getElementById("logoutButton")
  .addEventListener("click", async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error(error);
      inventoryMessage.textContent = error.message;
      return;
    }

    window.location.href = "index.html";
  });

// INITIALIZE
async function initializeInventory() {
  try {
    inventoryMessage.textContent = "CONNECTING TO SYSTEM...";

    const success = await loadInventory();

    if (success) {
      inventoryMessage.textContent = "";
    }
  } catch (error) {
    console.error(error);
    inventoryMessage.textContent =
      error.message || "SYSTEM CONNECTION ERROR.";
  }
}

initializeInventory();

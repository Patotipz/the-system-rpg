
import { supabase } from "./config.js";

const inventoryContainer = document.getElementById("inventoryItems");
const inventoryMessage = document.getElementById("inventoryMessage");
const inventoryTotal = document.getElementById("inventoryTotal");
const inventoryFilter = document.getElementById("inventoryFilter");

const weaponCount = document.getElementById("weaponCount");
const armorCount = document.getElementById("armorCount");
const consumableCount = document.getElementById("consumableCount");
const materialCount = document.getElementById("materialCount");

// ITEM INSPECTION MODAL
const itemModal = document.getElementById("itemDetailsModal");
const modalCategory = document.getElementById("itemModalCategory");
const modalIcon = document.getElementById("itemModalIcon");
const modalName = document.getElementById("itemModalName");
const modalRarity = document.getElementById("itemModalRarity");
const modalDescription = document.getElementById("itemModalDescription");
const modalQuantity = document.getElementById("itemModalQuantity");
const modalEnhancement = document.getElementById("itemModalEnhancement");
const modalStatus = document.getElementById("itemModalStatus");
const modalStatsSection = document.getElementById("itemModalStatsSection");
const modalStats = document.getElementById("itemModalStats");

// EQUIPMENT COMPARISON MODAL
const compareModal = document.getElementById("itemCompareModal");
const compareCurrentIcon = document.getElementById("compareCurrentIcon");
const compareCurrentName = document.getElementById("compareCurrentName");
const compareCurrentRarity = document.getElementById("compareCurrentRarity");
const compareCurrentEnhancement = document.getElementById("compareCurrentEnhancement");

const compareNewIcon = document.getElementById("compareNewIcon");
const compareNewName = document.getElementById("compareNewName");
const compareNewRarity = document.getElementById("compareNewRarity");
const compareNewEnhancement = document.getElementById("compareNewEnhancement");

const compareStatsList = document.getElementById("compareStatsList");
const compareTotalDifference = document.getElementById("compareTotalDifference");

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

const attributeColumns = {
  STR: "bonus_str",
  AGI: "bonus_agi",
  VIT: "bonus_vit",
  INT: "bonus_int",
  PER: "bonus_per",
  SEN: "bonus_sen"
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

function getItemImagePath(item) {
  const itemCode = item?.shop_items?.item_code;

  if (!itemCode) return null;

  const filename = String(itemCode)
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

  return filename
    ? `images/equipment/${filename}.png`
    : null;
}

function createItemVisualMarkup(item, className = "") {
  const imagePath = getItemImagePath(item);
  const fallbackIcon = itemIcons[item?.item_type] || "📦";

  return `
    <div class="${escapeHTML(className)} item-visual">
      ${
        imagePath
          ? `<img
               class="item-visual-image"
               src="${escapeHTML(imagePath)}"
               alt="${escapeHTML(item?.item_name || "Item")}"
             >`
          : ""
      }
      <span class="item-visual-fallback"
        ${imagePath ? 'style="display:none"' : ""}>
        ${fallbackIcon}
      </span>
    </div>
  `;
}

function applyImageFallbacks(container) {
  if (!container) return;

  container.querySelectorAll(".item-visual-image").forEach(image => {
    if (image.dataset.fallbackBound) return;

    image.dataset.fallbackBound = "true";

    const showFallback = () => {
      image.style.display = "none";

      const fallback = image.parentElement?.querySelector(
        ".item-visual-fallback"
      );

      if (fallback) fallback.style.display = "grid";
    };

    image.addEventListener("error", showFallback);

    if (image.complete && image.naturalWidth === 0) {
      showFallback();
    }
  });
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

  return categories[type] || String(type || "ITEM").toUpperCase();
}

function canEquip(item) {
  return (
    ["weapon", "armor", "accessory"].includes(item.item_type) &&
    item.shop_items?.equipment_slot
  );
}

function getEnhancedBonus(item, column) {
  const baseBonus = Number(item?.shop_items?.[column] || 0);
  const enhancementLevel = Number(item?.enhancement_level || 0);

  return Math.round(baseBonus * (1 + 0.10 * enhancementLevel));
}

function canConsume(item) {
  const shopItem = item.shop_items || {};

  if (item.item_type === "boost") {
    return (
      ["xp_multiplier", "coin_multiplier", "reward_multiplier"]
        .includes(shopItem.effect_type) &&
      Number(shopItem.effect_value || 0) > 0 &&
      Number(shopItem.duration_seconds || 0) > 0
    );
  }

  return (
    item.item_type === "consumable" &&
    (
      Number(shopItem.hp_restore || 0) > 0 ||
      Number(shopItem.energy_restore || 0) > 0 ||
      (
        Boolean(shopItem.effect_type) &&
        Number(shopItem.effect_value || 0) > 0 &&
        Number(shopItem.duration_seconds || 0) > 0
      )
    )
  );
}

// =========================================
// MODAL SCROLL MANAGEMENT
// =========================================

function updateModalScroll() {
  const inspectionOpen = itemModal?.classList.contains("active");
  const comparisonOpen = compareModal?.classList.contains("active");

  document.body.style.overflow =
    inspectionOpen || comparisonOpen ? "hidden" : "";
}

// =========================================
// ITEM INSPECTION
// =========================================

function openItemDetails(itemId) {
  const item = allItems.find(
    currentItem => String(currentItem.id) === String(itemId)
  );

  if (!item || !itemModal) return;

  const icon = itemIcons[item.item_type] || "📦";
  const rarity = String(item.rarity || "common").toUpperCase();

  let status = "AVAILABLE";

  if (item.is_equipped || item.is_cosmetic_equipped) {
    status = "EQUIPPED";
  } else if (item.is_skill_unlocked) {
    status = "UNLOCKED";
  }

  modalCategory.textContent = formatCategory(item.item_type);
  modalIcon.innerHTML = createItemVisualMarkup(
  item,
  "item-modal-image"
);

applyImageFallbacks(modalIcon);
  modalName.textContent = item.item_name || "UNKNOWN ITEM";
  modalRarity.textContent = rarity;
  modalDescription.textContent =
    item.item_description || "No description available.";

  modalQuantity.textContent = Number(item.quantity || 0);
  modalEnhancement.textContent =
    `+${Number(item.enhancement_level || 0)}`;
  modalStatus.textContent = status;

  const stats = Object.entries(attributeColumns)
    .map(([attribute, column]) => ({
      attribute,
      value: getEnhancedBonus(item, column)
    }))
    .filter(stat => stat.value > 0);

  if (stats.length) {
    modalStats.innerHTML = stats.map(stat => `
      <div class="item-modal-stat">
        <span>${escapeHTML(stat.attribute)}</span>
        <strong>+${stat.value}</strong>
      </div>
    `).join("");

    modalStatsSection.style.display = "block";
  } else {
    modalStats.innerHTML = "";
    modalStatsSection.style.display = "none";
  }

  itemModal.classList.add("active");
  itemModal.setAttribute("aria-hidden", "false");

  updateModalScroll();
}

function closeItemDetails() {
  if (!itemModal) return;

  itemModal.classList.remove("active");
  itemModal.setAttribute("aria-hidden", "true");

  updateModalScroll();
}

if (itemModal) {
  itemModal.querySelectorAll("[data-close-modal]").forEach(element => {
    element.addEventListener("click", closeItemDetails);
  });
}

// =========================================
// EQUIPMENT COMPARISON
// =========================================

function getEquippedItemForSlot(slot) {
  return allItems.find(item =>
    item.is_equipped &&
    item.shop_items?.equipment_slot === slot
  ) || null;
}

function formatDifference(value) {
  if (value > 0) return `+${value}`;
  if (value < 0) return String(value);
  return "0";
}

function renderComparison(currentItem, newItem) {
  if (!compareModal || !newItem) return;

  const isCosmetic = newItem.item_type === "cosmetic";

    // CURRENT ITEM
  if (currentItem) {
    compareCurrentIcon.innerHTML = createItemVisualMarkup(
      currentItem,
      "compare-item-image"
    );

    applyImageFallbacks(compareCurrentIcon);
  } else {
    compareCurrentIcon.textContent = "—";
  }

  compareCurrentName.textContent =
    currentItem?.item_name || "NO EQUIPMENT";

  compareCurrentRarity.textContent = currentItem
    ? String(currentItem.rarity || "common").toUpperCase()
    : "EMPTY";

  compareCurrentEnhancement.textContent = isCosmetic
    ? currentItem?.item_description || "NO AURA EQUIPPED"
    : `+${Number(currentItem?.enhancement_level || 0)} ENHANCEMENT`;
    // NEW ITEM
  compareNewIcon.innerHTML = createItemVisualMarkup(
    newItem,
    "compare-item-image"
  );

  applyImageFallbacks(compareNewIcon);

  compareNewName.textContent =
    newItem.item_name || "UNKNOWN ITEM";

  compareNewRarity.textContent =
    String(newItem.rarity || "common").toUpperCase();

  compareNewEnhancement.textContent = isCosmetic
    ? newItem.item_description || "NO DESCRIPTION"
    : `+${Number(newItem.enhancement_level || 0)} ENHANCEMENT`;
  // ATTRIBUTE COMPARISON
  let totalDifference = 0;

  compareStatsList.innerHTML = Object.entries(attributeColumns)
    .map(([attribute, column]) => {
      const currentValue = getEnhancedBonus(currentItem, column);
      const newValue = getEnhancedBonus(newItem, column);
      const difference = newValue - currentValue;

      totalDifference += difference;

      const differenceClass =
        difference > 0
          ? "positive"
          : difference < 0
            ? "negative"
            : "neutral";

      return `
        <div class="compare-stat-row">
          <span>${escapeHTML(attribute)}</span>
          <span class="compare-stat-current">${currentValue}</span>
          <span class="compare-stat-new">${newValue}</span>
          <span class="compare-stat-difference ${differenceClass}">
            ${formatDifference(difference)}
          </span>
        </div>
      `;
    })
    .join("");

  compareTotalDifference.textContent =
    formatDifference(totalDifference);

  compareTotalDifference.classList.remove(
    "positive",
    "negative",
    "neutral"
  );

  compareTotalDifference.classList.add(
    totalDifference > 0
      ? "positive"
      : totalDifference < 0
        ? "negative"
        : "neutral"
  );
}

function openCompareModal(itemId) {
  if (!compareModal) return;

  const newItem = allItems.find(
    item => String(item.id) === String(itemId)
  );

  if (!newItem) return;

  const isEquipment =
    ["weapon", "armor", "accessory"].includes(newItem.item_type) &&
    !newItem.is_equipped &&
    Boolean(newItem.shop_items?.equipment_slot);

  const isCosmetic =
    newItem.item_type === "cosmetic" &&
    !newItem.is_cosmetic_equipped &&
    Boolean(newItem.shop_items?.equipment_slot);

  if (!isEquipment && !isCosmetic) return;

  const slot = newItem.shop_items.equipment_slot;

  const currentItem = isCosmetic
    ? allItems.find(item =>
        item.item_type === "cosmetic" &&
        item.is_cosmetic_equipped &&
        item.shop_items?.equipment_slot === slot
      ) || null
    : getEquippedItemForSlot(slot);

  renderComparison(currentItem, newItem);

  compareModal.classList.add("active");
  compareModal.setAttribute("aria-hidden", "false");

  updateModalScroll();
}

function closeCompareModal() {
  if (!compareModal) return;

  compareModal.classList.remove("active");
  compareModal.setAttribute("aria-hidden", "true");

  updateModalScroll();
}

if (compareModal) {
  compareModal.querySelectorAll("[data-close-compare]").forEach(element => {
    element.addEventListener("click", closeCompareModal);
  });
}

// CLOSE MODALS WITH ESCAPE
document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;

  if (compareModal?.classList.contains("active")) {
    closeCompareModal();
    return;
  }

  if (itemModal?.classList.contains("active")) {
    closeItemDetails();
  }
});

// =========================================
// LOAD INVENTORY AND EQUIPMENT
// =========================================

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
    .select("display_name, rank, level, coins")
    .eq("user_id", authData.user.id)
    .single();

  if (profileError) throw profileError;

  const coinsEl = document.getElementById("inventoryCoins");

  if (coinsEl) {
    coinsEl.textContent =
      `${Number(profile.coins || 0).toLocaleString()} COINS`;
  }

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
        item_code,
        equipment_slot,
        bonus_str,
        bonus_agi,
        bonus_vit,
        bonus_int,
        bonus_per,
        bonus_sen,
        hp_restore,
        energy_restore,
        effect_type,
        effect_value,
        duration_seconds
      )
    `)
    .order("obtained_at", { ascending: false });

  if (error) throw error;

  const { data: unlockedSkills, error: skillsError } = await supabase
    .from("user_skills")
    .select("skill_code")
    .eq("user_id", authData.user.id);

  if (skillsError) throw skillsError;

  const unlockedSkillCodes = new Set(
    (unlockedSkills || []).map(skill => skill.skill_code)
  );

  const { data: equippedCosmetics, error: cosmeticsError } =
    await supabase
      .from("user_equipped_cosmetics")
      .select("shop_item_id, equipment_slot")
      .eq("user_id", authData.user.id);

  if (cosmeticsError) throw cosmeticsError;

  const equippedCosmeticIds = new Set(
    (equippedCosmetics || []).map(item => item.shop_item_id)
  );

  allItems = (data || []).map(item => ({
    ...item,

    is_skill_unlocked:
      item.item_type === "skill_item" &&
      unlockedSkillCodes.has(item.shop_items?.item_code),

    is_cosmetic_equipped:
      item.item_type === "cosmetic" &&
      equippedCosmeticIds.has(item.shop_item_id)
  }));

  updateSummary();
  renderEquipment();
  renderInventory();

  return true;
}

// =========================================
// SUMMARY COUNTERS
// =========================================

function updateSummary() {
  inventoryTotal.textContent = allItems.reduce(
    (total, item) => total + Number(item.quantity || 0),
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
// =========================================
// HUNTER AURA VISUAL
// =========================================

function renderHunterAura() {
  const auraElement = document.querySelector(".hunter-aura");

  if (!auraElement) return;

  const equippedAura = allItems.find(item =>
    item.is_cosmetic_equipped &&
    item.shop_items?.equipment_slot === "aura"
  );

  const auraCode = equippedAura?.shop_items?.item_code;

  const auraColors = {
    hunter_aura: "#55aaff",
    shadow_aura: "#8b5cf6",
    monarch_aura: "#f5c542",
    green_hunter_aura: "#35d69a",
    crimson_hunter_aura: "#ef4444",
    violet_hunter_aura: "#a855f7",
    golden_hunter_aura: "#fbbf24",
    abyssal_hunter_aura: "#2563eb"
  };

  const color = auraCode
    ? auraColors[auraCode] || "#55aaff"
    : "#00aeff";

  auraElement.style.setProperty("--aura-color", color);
}
// =========================================
// EQUIPMENT DISPLAY
// =========================================


function renderEquipment() {
  const slots = document.querySelectorAll(".equipment-slot");

  slots.forEach(slot => {
    const slotName = slot.dataset.slot;

    const equippedItem = allItems.find(item =>
      item.is_equipped &&
      item.shop_items?.equipment_slot === slotName
    );

    const equippedCosmetic = allItems.find(item =>
      item.is_cosmetic_equipped &&
      item.shop_items?.equipment_slot === slotName
    );

    const equipped = equippedItem || equippedCosmetic;
    const icon = slot.querySelector(":scope > span");
    const small = slot.querySelector("small");

    if (!small || !icon) return;

    slot.classList.toggle("slot-equipped", Boolean(equipped));
    slot.classList.toggle(
      "cosmetic-slot-equipped",
      Boolean(equippedCosmetic)
    );

    // Remove previous visual
    slot.querySelector(".equipment-item-visual")?.remove();

    if (equipped) {
      const imagePath = getItemImagePath(equipped);

      const visual = document.createElement("div");
      visual.className = "equipment-item-visual";

      if (imagePath) {
        const image = document.createElement("img");
        image.className = "equipment-item-image";
        image.src = imagePath;
        image.alt = equipped.item_name || "Equipped item";

        const fallback = document.createElement("span");
        fallback.className = "equipment-item-fallback";
        fallback.textContent = itemIcons[equipped.item_type] || "📦";
        fallback.style.display = "none";

        image.addEventListener("error", () => {
          image.style.display = "none";
          fallback.style.display = "grid";
        });

        visual.append(image, fallback);
      } else {
        const fallback = document.createElement("span");
        fallback.className = "equipment-item-fallback";
        fallback.textContent = itemIcons[equipped.item_type] || "📦";
        visual.append(fallback);
      }

      icon.style.display = "none";

      const itemName = document.createElement("span");
      itemName.className = "equipped-item-name";
      itemName.textContent = equipped.item_name;

      const rarity = document.createElement("span");
      rarity.className = "equipped-item-rarity";
      rarity.textContent =
        (equipped.rarity || "common").toUpperCase();

      small.replaceChildren(itemName, rarity);

      slot.insertBefore(visual, small);
      slot.title = equipped.item_name;

    } else {
      icon.style.display = "";
      small.textContent = "EMPTY";
      slot.title = "Empty equipment slot";
    }
  });

  const equippedItems = allItems.filter(item =>
    item.is_equipped || item.is_cosmetic_equipped
  );

  Object.entries(attributeColumns).forEach(([attribute, column]) => {
    const totalBonus = equippedItems.reduce((total, item) => {
      return total + getEnhancedBonus(item, column);
    }, 0);

    const element = document.getElementById(`bonus${attribute}`);

    if (element) {
      element.textContent = `+${totalBonus}`;
    }
  });
  renderHunterAura();
}

// =========================================
// INVENTORY CARDS
// =========================================

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

    const stats = Object.entries(attributeColumns)
      .map(([attribute, column]) => [
        attribute,
        getEnhancedBonus(item, column)
      ])
      .filter(([, value]) => value > 0);

    const equipButton = canEquip(item)
      ? item.is_equipped
        ? `<button class="inventory-action unequip-button"
             data-unequip-id="${escapeHTML(item.id)}">
             UNEQUIP
           </button>`
        : `<button class="inventory-action equip-button"
             data-equip-id="${escapeHTML(item.id)}">
             EQUIP
           </button>`
      : "";

    // COMPARISON BUTTON
const isComparableEquipment =
  ["weapon", "armor", "accessory"].includes(item.item_type) &&
  !item.is_equipped;

const isComparableCosmetic =
  item.item_type === "cosmetic" &&
  !item.is_cosmetic_equipped &&
  Boolean(item.shop_items?.equipment_slot);

const compareButton =
  isComparableEquipment || isComparableCosmetic
    ? `<button
         type="button"
         class="inventory-action compare-button"
         data-compare-id="${escapeHTML(item.id)}">
         ⇄ COMPARE
       </button>`
    : "";

    const enhancementCosts = [
      100, 200, 350, 500, 700,
      900, 1200, 1500, 1900, 2500
    ];

    const currentLevel = Number(item.enhancement_level || 0);
    const nextEnhancementCost = enhancementCosts[currentLevel];

    const enhanceButton = canEquip(item) && currentLevel < 10
      ? `<button class="inventory-action enhance-button"
           data-enhance-id="${escapeHTML(item.id)}">
           <span class="enhance-icon">✦</span>
           ENHANCE
           <span class="enhance-cost">${nextEnhancementCost} COINS</span>
         </button>`
      : "";

    const useButton = ["consumable", "boost"].includes(item.item_type)
      ? canConsume(item)
        ? `<button class="inventory-action use-button"
             data-use-id="${escapeHTML(item.id)}">
             ${item.item_type === "boost" ? "ACTIVATE BOOST" : "USE"}
           </button>`
        : `<button class="inventory-action use-button"
             disabled
             title="This item has no configured effect">
             NOT AVAILABLE
           </button>`
      : "";

    const skillButton = item.item_type === "skill_item"
      ? item.is_skill_unlocked
        ? `<button class="inventory-action skill-button skill-unlocked"
             disabled>
             ✓ UNLOCKED
           </button>`
        : `<button class="inventory-action skill-button"
             data-skill-id="${escapeHTML(item.id)}">
             UNLOCK SKILL
           </button>`
      : "";

    const cosmeticSlot = (
      item.shop_items?.equipment_slot || "cosmetic"
    ).toUpperCase();

    const cosmeticButton = item.item_type === "cosmetic"
      ? item.is_cosmetic_equipped
        ? `<button class="inventory-action cosmetic-button cosmetic-equipped"
             data-unequip-cosmetic="${escapeHTML(item.shop_items?.equipment_slot)}">
             UNEQUIP ${escapeHTML(cosmeticSlot)}
           </button>`
        : `<button class="inventory-action cosmetic-button"
             data-equip-cosmetic="${escapeHTML(item.id)}">
             EQUIP ${escapeHTML(cosmeticSlot)}
           </button>`
      : "";

    return `
      <article class="inventory-item rarity-${escapeHTML(item.rarity || "common")}">

       ${createItemVisualMarkup(item, "inventory-item-icon")}

        <span class="inventory-item-category">
          ${escapeHTML(formatCategory(item.item_type))}
        </span>

        <h3>${escapeHTML(item.item_name)}</h3>

        <p class="inventory-item-description">
          ${escapeHTML(item.item_description || "No description available.")}
        </p>

        <span class="inventory-item-rarity">
          ${escapeHTML((item.rarity || "common").toUpperCase())}
        </span>

        <div class="inventory-item-footer">
          <span>QUANTITY: ${Number(item.quantity || 0)}</span>
          <span class="enhancement-level-badge">
            ✦ +${Number(item.enhancement_level || 0)}
          </span>
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
          item.is_equipped || item.is_cosmetic_equipped
            ? `<span class="inventory-equipped">EQUIPPED</span>`
            : ""
        }
<div class="inventory-primary-actions ${compareButton ? "has-compare" : "inspect-only"}">
  <button
    type="button"
    class="inventory-action inspect-button"
    data-inspect-id="${escapeHTML(item.id)}"
  >
    ⌕ INSPECT
  </button>

  ${compareButton}
</div>

${equipButton}
        ${enhanceButton}
        ${useButton}
        ${skillButton}
        ${cosmeticButton}

      </article>
    `;
  }).join("");
    applyImageFallbacks(inventoryContainer);
}

// =========================================
// CONSUMABLE ACTION
// =========================================

async function useConsumable(button, itemId) {
  button.disabled = true;
  button.textContent = "USING...";

  try {
    const { data, error } = await supabase.rpc("use_consumable", {
      p_inventory_id: itemId
    });

    if (error) throw error;

    if (!data?.success) {
      throw new Error(data?.message || "CONSUMABLE USE FAILED.");
    }

    const messages = [];

    if (Number(data.hp_restored) > 0) {
      messages.push(`HP +${data.hp_restored}`);
    }

    if (Number(data.energy_restored) > 0) {
      messages.push(`ENERGY +${data.energy_restored}`);
    }

    if (data.effect_type) {
      const effectNames = {
        bonus_str: "STRENGTH",
        bonus_vit: "VITALITY",
        bonus_int: "INTELLIGENCE",
        focus: "FOCUS",
        stamina: "STAMINA",
        xp_multiplier: "XP BOOST",
        coin_multiplier: "COIN BOOST",
        reward_multiplier: "DOUBLE REWARD"
      };

      const effectName =
        effectNames[data.effect_type] || data.effect_type.toUpperCase();

      messages.push(`${effectName} EFFECT ACTIVATED`);
    }

    inventoryMessage.textContent =
      `${data.item_name.toUpperCase()} USED SUCCESSFULLY! ` +
      messages.join(" · ");

    await loadInventory();

  } catch (error) {
    console.error("Consumable error:", error);

    inventoryMessage.textContent =
      error.message || "CONSUMABLE USE FAILED.";

    await loadInventory();
  }
}

// =========================================
// INVENTORY ACTIONS
// =========================================

inventoryContainer.addEventListener("click", async event => {
  // INSPECT
  const inspectButton = event.target.closest("[data-inspect-id]");

  if (inspectButton) {
    openItemDetails(inspectButton.dataset.inspectId);
    return;
  }

  // COMPARE
  const compareButton = event.target.closest("[data-compare-id]");

  if (compareButton) {
    openCompareModal(compareButton.dataset.compareId);
    return;
  }

  const equipButton = event.target.closest("[data-equip-id]");
  const unequipButton = event.target.closest("[data-unequip-id]");
  const enhanceButton = event.target.closest("[data-enhance-id]");
  const useButton = event.target.closest("[data-use-id]");
  const skillButton = event.target.closest("[data-skill-id]");
  const equipCosmeticButton = event.target.closest("[data-equip-cosmetic]");
  const unequipCosmeticButton = event.target.closest("[data-unequip-cosmetic]");

  if (
    !equipButton &&
    !unequipButton &&
    !enhanceButton &&
    !useButton &&
    !skillButton &&
    !equipCosmeticButton &&
    !unequipCosmeticButton
  ) {
    return;
  }

  if (useButton) {
    const itemId = useButton.dataset.useId;
    await useConsumable(useButton, itemId);
    return;
  }

  if (skillButton) {
    const itemId = skillButton.dataset.skillId;

    skillButton.disabled = true;
    skillButton.textContent = "UNLOCKING...";

    try {
      const { data, error } = await supabase.rpc(
        "use_skill_item",
        { p_inventory_id: itemId }
      );

      if (error) throw error;

      if (!data.success) {
        inventoryMessage.textContent =
          data.message || "SKILL UNLOCK FAILED.";

        await loadInventory();
        return;
      }

      inventoryMessage.textContent =
        `${data.skill_name.toUpperCase()} UNLOCKED! ` +
        `BONUSES: STR +${data.bonuses.str}, ` +
        `AGI +${data.bonuses.agi}, ` +
        `VIT +${data.bonuses.vit}, ` +
        `INT +${data.bonuses.int}, ` +
        `PER +${data.bonuses.per}, ` +
        `SEN +${data.bonuses.sen}.`;

      await loadInventory();

    } catch (error) {
      console.error("Skill unlock error:", error);

      inventoryMessage.textContent =
        error.message || "SKILL UNLOCK FAILED.";

      await loadInventory();
    }

    return;
  }

  // COSMETIC ACTIONS
  if (equipCosmeticButton || unequipCosmeticButton) {
    const button = equipCosmeticButton || unequipCosmeticButton;

    button.disabled = true;
    button.textContent = "PROCESSING...";

    try {
      let rpcName;
      let rpcParams;

      if (equipCosmeticButton) {
        rpcName = "equip_cosmetic_item";
        rpcParams = {
          p_inventory_id: equipCosmeticButton.dataset.equipCosmetic
        };
      } else {
        rpcName = "unequip_cosmetic_item";
        rpcParams = {
          p_equipment_slot:
            unequipCosmeticButton.dataset.unequipCosmetic
        };
      }

      const { data, error } = await supabase.rpc(
        rpcName,
        rpcParams
      );

      if (error) throw error;

      if (!data.success) {
        inventoryMessage.textContent =
          data.message || "COSMETIC ACTION FAILED.";

        await loadInventory();
        return;
      }

      inventoryMessage.textContent = equipCosmeticButton
        ? `${data.item_name.toUpperCase()} EQUIPPED SUCCESSFULLY!`
        : `${data.equipment_slot.toUpperCase()} COSMETIC UNEQUIPPED!`;

      await loadInventory();

    } catch (error) {
      console.error("Cosmetic error:", error);

      inventoryMessage.textContent =
        error.message || "COSMETIC ACTION FAILED.";

      await loadInventory();
    }

    return;
  }

  // EQUIP / UNEQUIP / ENHANCE
  const button = equipButton || unequipButton || enhanceButton;

  const isEnhancing = Boolean(enhanceButton);
  const isEquipping = Boolean(equipButton);

  const itemId = isEnhancing
    ? enhanceButton.dataset.enhanceId
    : isEquipping
      ? equipButton.dataset.equipId
      : unequipButton.dataset.unequipId;

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
      inventoryMessage.textContent =
        data.message || "ACTION FAILED.";

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
      error.message || "INVENTORY ACTION FAILED.";

    await loadInventory();
  }
});

// =========================================
// FILTER
// =========================================

inventoryFilter.addEventListener("change", renderInventory);

// =========================================
// LOGOUT
// =========================================

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

// =========================================
// INITIALIZE
// =========================================

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


import { supabase } from "./config.js";

const shopItemsContainer = document.getElementById("shopItems");
const shopCoins = document.getElementById("shopCoins");
const shopMessage = document.getElementById("shopMessage");
const shopItemCount = document.getElementById("shopItemCount");

const searchInput = document.getElementById("shopSearch");
const categoryFilter = document.getElementById("categoryFilter");
const rarityFilter = document.getElementById("rarityFilter");

let currentUser = null;
let allItems = [];
let currentCoins = 0;

// ITEM ICONS
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

// FORMAT ITEM TYPES
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

// ESCAPE HTML
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

// LOAD PLAYER
async function loadPlayer() {
  const { data: authData, error: authError } =
    await supabase.auth.getUser();

  if (authError) throw authError;

  if (!authData.user) {
    window.location.href = "index.html";
    return false;
  }

  currentUser = authData.user;

  const { data: authorization, error: authorizationError } =
    await supabase.rpc("is_authorized");

  if (authorizationError) throw authorizationError;

  if (!authorization) {
    await supabase.auth.signOut();
    window.location.href = "index.html";
    return false;
  }

  const { data: profile, error: profileError } =
    await supabase
      .from("profiles")
      .select("coins")
      .eq("user_id", currentUser.id)
      .single();

  if (profileError) throw profileError;

  currentCoins = profile.coins || 0;
  shopCoins.textContent = currentCoins.toLocaleString();

  return true;
}

// LOAD SHOP ITEMS
async function loadShopItems() {
  const { data, error } = await supabase
    .from("shop_items")
    .select("*")
    .eq("is_active", true)
    .order("price_coins", { ascending: true });

  if (error) throw error;

  allItems = data || [];

  renderShopItems();
}

// RENDER SHOP
function renderShopItems() {
  const search = searchInput.value.toLowerCase().trim();
  const category = categoryFilter.value;
  const rarity = rarityFilter.value;

  const filteredItems = allItems.filter(item => {
    const matchesSearch =
      item.item_name.toLowerCase().includes(search) ||
      (item.item_description || "").toLowerCase().includes(search);

    const matchesCategory =
      category === "all" || item.item_type === category;

    const matchesRarity =
      rarity === "all" || item.rarity === rarity;

    return matchesSearch && matchesCategory && matchesRarity;
  });

  shopItemCount.textContent =
    `${filteredItems.length} ITEMS`;

  if (!filteredItems.length) {
    shopItemsContainer.innerHTML = `
      <div class="shop-empty">
        NO ITEMS FOUND.
      </div>
    `;
    return;
  }

  shopItemsContainer.innerHTML = filteredItems.map(item => {
    const icon = itemIcons[item.item_type] || "📦";
    const canAfford = currentCoins >= item.price_coins;

    return `
      <article class="shop-item rarity-${escapeHTML(item.rarity)}">

        <div class="shop-item-icon">
          ${icon}
        </div>

        <span class="shop-item-category">
          ${escapeHTML(formatCategory(item.item_type))}
        </span>

        <h3>${escapeHTML(item.item_name)}</h3>

        <p class="shop-item-description">
          ${escapeHTML(item.item_description || "No description available.")}
        </p>

        <span class="shop-item-rarity">
          ${escapeHTML(item.rarity.toUpperCase())}
        </span>

        <div class="shop-item-footer">

          <span class="shop-item-price">
            ◈ ${Number(item.price_coins).toLocaleString()}
          </span>

          <button
            class="shop-buy-button"
            data-buy-id="${item.id}"
            ${canAfford ? "" : "disabled"}
          >
            ${canAfford ? "BUY ITEM" : "NOT ENOUGH COINS"}
          </button>

        </div>

      </article>
    `;
  }).join("");
}

// PURCHASE ITEM
shopItemsContainer.addEventListener("click", async event => {
  const button = event.target.closest("[data-buy-id]");

  if (!button || button.disabled) return;

  const itemId = Number(button.dataset.buyId);
  const item = allItems.find(item => item.id === itemId);

  if (!item) return;

  if (currentCoins < item.price_coins) {
    shopMessage.textContent = "NOT ENOUGH COINS.";
    return;
  }

  const confirmed = window.confirm(
    `Purchase ${item.item_name} for ${item.price_coins} coins?`
  );

  if (!confirmed) return;

  button.disabled = true;
  button.textContent = "PROCESSING...";

  try {
    const { data, error } = await supabase.rpc(
      "purchase_shop_item",
      { p_item_id: itemId }
    );

    if (error) throw error;

    currentCoins = data.remaining_coins;

    shopCoins.textContent =
      currentCoins.toLocaleString();

    shopMessage.textContent =
      `${data.item_name.toUpperCase()} PURCHASED SUCCESSFULLY!`;

    renderShopItems();

  } catch (error) {
    console.error(error);

    shopMessage.textContent =
      error.message || "PURCHASE FAILED.";

    renderShopItems();
  }
});

// FILTER EVENTS
searchInput.addEventListener("input", renderShopItems);
categoryFilter.addEventListener("change", renderShopItems);
rarityFilter.addEventListener("change", renderShopItems);

// LOG OUT
document.getElementById("logoutButton")
  .addEventListener("click", async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error(error);
      shopMessage.textContent = error.message;
      return;
    }

    window.location.href = "index.html";
  });

// INITIALIZE SHOP
async function initializeShop() {
  try {
    shopMessage.textContent = "CONNECTING TO SYSTEM...";

    const authorized = await loadPlayer();

    if (!authorized) return;

    await loadShopItems();

    shopMessage.textContent = "";
    
  } catch (error) {
    console.error(error);
    shopMessage.textContent =
      error.message || "SYSTEM CONNECTION ERROR.";
  }
}

initializeShop();

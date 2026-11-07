
import { supabase } from "./config.js";

// ==========================================
// DOM ELEMENTS
// ==========================================

const availableContainer = document.getElementById("availableQuests");
const featuredContainer = document.getElementById("featuredQuests");
const myQuestsContainer = document.getElementById("myQuests");
const message = document.getElementById("questMessage");

const activeCount = document.getElementById("activeQuestCount");
const availableCount = document.getElementById("availableQuestCount");
const completedCount = document.getElementById("completedQuestCount");

const rankElement = document.getElementById("hunterRank");
const levelElement = document.getElementById("hunterLevel");
const logoutButton = document.getElementById("logoutButton");

// ENERGY ELEMENTS

const energyValue = document.getElementById("questEnergyValue");
const energyMax = document.getElementById("questEnergyMax");
const energyBar = document.getElementById("questEnergyBar");
const energyPercentage = document.getElementById("questEnergyPercentage");

// ACHIEVEMENT MODAL

const achievementModal = document.getElementById("achievementModal");
const modalIcon = document.getElementById("modalAchievementIcon");
const modalTitle = document.getElementById("modalAchievementTitle");
const modalDescription = document.getElementById("modalAchievementDescription");
const modalXP = document.getElementById("modalAchievementXP");
const modalCoins = document.getElementById("modalAchievementCoins");
const closeAchievementModal = document.getElementById("closeAchievementModal");

// ==========================================
// GLOBAL VARIABLES
// ==========================================

let currentFilter = "all";
let currentUser = null;

let catalog = [];
let userQuests = [];

let achievementQueue = [];

// ==========================================
// NOTIFICATION SYSTEM
// ==========================================

function showSystemNotification(title, description, icon) {

  achievementQueue.push({
    title,
    description,
    icon,
    isSystem: true
  });

  if (achievementModal.classList.contains("hidden")) {
    showNextAchievement();
  }
}

function showNextAchievement() {

  if (!achievementQueue.length) {
    achievementModal.classList.add("hidden");
    return;
  }

  const achievement = achievementQueue.shift();

  const modalContent = achievementModal.querySelector(
    ".achievement-modal-content"
  );

  modalContent.classList.remove(
    "system-level-up",
    "system-rank-up"
  );

  if (achievement.isSystem) {

    if (achievement.title === "RANK UP!") {
      modalContent.classList.add("system-rank-up");
    } else {
      modalContent.classList.add("system-level-up");
    }
  }

  modalIcon.textContent = achievement.icon || "🏆";

  modalTitle.textContent = achievement.title;

  modalDescription.textContent =
    achievement.description ||
    "A new achievement has been unlocked.";

  modalXP.textContent = achievement.isSystem
    ? "SYSTEM ALERT"
    : `+${achievement.xp_reward || 0} XP`;

  modalCoins.textContent = achievement.isSystem
    ? "PROGRESSION UPDATE"
    : `+${achievement.coin_reward || 0} COINS`;

  achievementModal.classList.remove("hidden");
}

function showAchievementNotifications(achievements) {

  if (!Array.isArray(achievements) || !achievements.length) {
    return;
  }

  achievementQueue.push(...achievements);

  if (achievementModal.classList.contains("hidden")) {
    showNextAchievement();
  }
}

closeAchievementModal.addEventListener(
  "click",
  showNextAchievement
);

// ==========================================
// DATE SYSTEM - MEXICO CITY
// ==========================================

function getMexicoDate() {

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map(part => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function getMexicoDateFromTimestamp(timestamp) {

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(timestamp));

  const values = Object.fromEntries(
    parts.map(part => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function getMexicoWeekStart(dateString) {

  const [year, month, day] = dateString.split("-").map(Number);

  const date = new Date(Date.UTC(year, month - 1, day));

  const dayOfWeek = date.getUTCDay();

  const daysToMonday = (dayOfWeek + 6) % 7;

  date.setUTCDate(date.getUTCDate() - daysToMonday);

  return date.toISOString().slice(0, 10);
}

// ==========================================
// AUTOMATIC DAILY REFRESH
// ==========================================

function startDailyRefresh() {

  let lastDate = getMexicoDate();

  async function checkNewDay() {

    const today = getMexicoDate();

    if (today === lastDate) return;

    lastDate = today;

    try {

      await loadQuests();
      await loadQuestEnergy();

      message.textContent = "NEW DAY. DAILY QUESTS RESET.";

    } catch (error) {

      console.error(error);
      message.textContent = error.message;
    }
  }

  setInterval(checkNewDay, 30000);

  document.addEventListener("visibilitychange", async () => {

    if (document.visibilityState !== "visible") return;

    await checkNewDay();
  });
}

// ==========================================
// INITIALIZATION
// ==========================================

async function initialize() {

  const { data: authData, error: authError } =
    await supabase.auth.getUser();

  if (authError) throw authError;

  currentUser = authData.user;

  if (!currentUser) {

    window.location.href = "login.html";
    return;
  }

  const { data: authorized, error } =
    await supabase.rpc("is_authorized");

  if (error) throw error;

  if (!authorized) {

    await supabase.auth.signOut();

    window.location.href = "login.html";
    return;
  }

  await loadProfile();
  await loadQuestEnergy();
  await loadQuests();

  startDailyRefresh();
}

// ==========================================
// LOAD PROFILE
// ==========================================

async function loadProfile() {

  const { data, error } = await supabase
    .from("profiles")
    .select("rank, level")
    .eq("user_id", currentUser.id)
    .single();

  if (error) throw error;

  rankElement.textContent = `RANK ${data.rank}`;

  levelElement.textContent = `LV. ${data.level}`;
}

// ==========================================
// LOAD ENERGY
// ==========================================

async function loadQuestEnergy() {

  const { data, error } = await supabase
    .from("player_stats")
    .select("energy, max_energy")
    .eq("user_id", currentUser.id)
    .single();

  if (error) throw error;

  const energy = Number(data.energy ?? 0);
  const maxEnergy = Number(data.max_energy ?? 0);

  const percentage = maxEnergy > 0
    ? Math.min(100, (energy / maxEnergy) * 100)
    : 0;

  // Update only if the HTML elements exist.

  if (energyValue) {
    energyValue.textContent = energy;
  }

  if (energyMax) {
    energyMax.textContent = maxEnergy;
  }

  if (energyBar) {
    energyBar.style.width = `${percentage}%`;
  }

  if (energyPercentage) {
    energyPercentage.textContent =
      `${Math.round(percentage)}% AVAILABLE`;
  }
}

// ==========================================
// LOAD QUESTS
// ==========================================

async function loadQuests() {

  // LOAD QUEST CATALOG

  const { data: questData, error: questError } = await supabase
    .from("quests")
    .select(`
      id,
      title,
      description,
      quest_type,
      difficulty,
      xp_reward,
      coin_reward,
      energy_cost,
      is_active
    `)
    .eq("is_active", true);

  if (questError) throw questError;

  catalog = questData || [];

  // LOAD USER ASSIGNED QUESTS

  const { data: assignedData, error: assignedError } =
    await supabase
      .from("user_quests")
      .select(`
        id,
        quest_id,
        status,
        assigned_at,
        quests (
          title,
          description,
          quest_type,
          difficulty,
          xp_reward,
          coin_reward,
          energy_cost
        )
      `)
      .eq("user_id", currentUser.id);

  if (assignedError) throw assignedError;

  userQuests = assignedData || [];

  renderAll();
}

// ==========================================
// AVAILABLE QUESTS
// ==========================================

function getAvailableQuests() {

  const today = getMexicoDate();

  const currentWeek = getMexicoWeekStart(today);

  return catalog.filter(quest => {

    const assignments = userQuests.filter(
      uq => uq.quest_id === quest.id
    );

    // DAILY QUESTS

    if (quest.quest_type === "daily") {

      return !assignments.some(uq =>
        getMexicoDateFromTimestamp(uq.assigned_at) === today
      );
    }

    // WEEKLY QUESTS

    if (quest.quest_type === "weekly") {

      return !assignments.some(uq =>
        getMexicoWeekStart(
          getMexicoDateFromTimestamp(uq.assigned_at)
        ) === currentWeek
      );
    }

    // MAIN AND SPECIAL QUESTS

    if (
      quest.quest_type === "main" ||
      quest.quest_type === "special"
    ) {

      return assignments.length === 0;
    }

    return true;
  });
}

// ==========================================
// RENDER ALL
// ==========================================

function renderAll() {

  const active = userQuests.filter(q =>
    q.status === "active" ||
    q.status === "pending"
  );

  const completed = userQuests.filter(q =>
    q.status === "completed"
  );

  const available = getAvailableQuests();

  activeCount.textContent = active.length;

  availableCount.textContent = available.length;

  completedCount.textContent = completed.length;

  renderAvailable(available);

  renderFeatured(available);

  renderMyQuests(active.concat(completed));
}

// ==========================================
// QUEST TYPES
// ==========================================

const questTypes = {

  daily: {
    label: "DAILY QUEST",
    class: "type-daily",
    icon: "◈"
  },

  weekly: {
    label: "WEEKLY QUEST",
    class: "type-weekly",
    icon: "◷"
  },

  special: {
    label: "SPECIAL QUEST",
    class: "type-special",
    icon: "✦"
  },

  main: {
    label: "MAIN QUEST",
    class: "type-main",
    icon: "♛"
  },

  dungeon: {
    label: "DUNGEON",
    class: "type-dungeon",
    icon: "⚔"
  }
};

function getQuestType(type) {

  return questTypes[type] || {
    label: "QUEST",
    class: "type-default",
    icon: "◇"
  };
}

// ==========================================
// QUEST REWARDS HTML
// ==========================================

function renderRewards(quest) {

  return `
    <div class="quest-rewards">

      <span>✦ +${quest.xp_reward || 0} XP</span>

      <span>◈ +${quest.coin_reward || 0} COINS</span>

      <span>⚡ ${Number(quest.energy_cost || 0)} ENERGY</span>

    </div>
  `;
}

// ==========================================
// RENDER AVAILABLE QUESTS
// ==========================================

function renderAvailable(quests) {

  const priority = {
    main: 1,
    special: 2,
    weekly: 3,
    daily: 4,
    dungeon: 5
  };

  const filtered = (

    currentFilter === "all"
      ? [...quests]
      : quests.filter(q =>
          q.quest_type === currentFilter
        )

  ).sort((a, b) =>
    (priority[a.quest_type] || 99) -
    (priority[b.quest_type] || 99)
  );

  if (!filtered.length) {

    availableContainer.innerHTML =
      '<p class="muted">No available missions.</p>';

    return;
  }

  availableContainer.innerHTML = filtered.map(q => {

    const type = getQuestType(q.quest_type);

    return `

      <article class="quest-card ${type.class}">

        <div class="quest-card-top">

          <span class="quest-type">
            ${type.icon} ${type.label}
          </span>

          <span class="quest-difficulty">
            RANK ${q.difficulty}
          </span>

        </div>

        <h3>${q.title}</h3>

        <p>${q.description || "No description available."}</p>

        ${renderRewards(q)}

        <button
          class="quest-action"
          data-quest-id="${q.id}"
        >
          ACCEPT QUEST
        </button>

      </article>

    `;

  }).join("");
}

// ==========================================
// FEATURED QUESTS
// ==========================================

function renderFeatured(quests) {

  const featured = quests
    .filter(q =>
      q.quest_type === "main" ||
      q.quest_type === "special"
    )
    .sort((a, b) => {

      const priority = {
        main: 1,
        special: 2
      };

      return priority[a.quest_type] -
        priority[b.quest_type];
    });

  if (!featured.length) {

    featuredContainer.innerHTML =
      '<p class="muted">No featured missions available.</p>';

    return;
  }

  featuredContainer.innerHTML = featured.map(q => {

    const type = getQuestType(q.quest_type);

    return `

      <article class="quest-card ${type.class} featured-card">

        <div class="quest-card-top">

          <span class="quest-type">
            ${type.icon} ${type.label}
          </span>

          <span class="quest-difficulty">
            RANK ${q.difficulty}
          </span>

        </div>

        <h3>${q.title}</h3>

        <p>${q.description || "No description available."}</p>

        ${renderRewards(q)}

        <button
          class="quest-action"
          data-featured-quest-id="${q.id}"
        >
          ACCEPT QUEST
        </button>

      </article>

    `;

  }).join("");
}

// ==========================================
// RENDER MY QUESTS
// ==========================================

function renderMyQuests(quests) {

  if (!quests.length) {

    myQuestsContainer.innerHTML =
      '<p class="muted">You have no active missions.</p>';

    return;
  }

  myQuestsContainer.innerHTML = quests.map(q => {

    const quest = q.quests;

    if (!quest) return "";

    const type = getQuestType(quest.quest_type);

    let action = "";

    if (
      q.status === "active" ||
      q.status === "pending"
    ) {

      action = `

        <button
          class="quest-action"
          data-complete-id="${q.id}"
        >
          COMPLETE QUEST
        </button>

      `;

    } else if (q.status === "completed") {

      action = `

        <button
          class="quest-action"
          data-claim-id="${q.id}"
        >
          CLAIM REWARDS
        </button>

      `;
    }

    const completed = q.status === "completed";

    const progress = completed ? 100 : 25;

    return `

      <article class="quest-card ${type.class}">

        <div class="quest-card-top">

          <span class="quest-type">
            ${type.icon} ${type.label}
          </span>

          <span class="quest-difficulty">
            RANK ${quest.difficulty}
          </span>

        </div>

        <h3>${quest.title}</h3>

        <p>${quest.description || ""}</p>

        ${renderRewards(quest)}

        <div class="quest-progress">

          <div class="quest-progress-info">

            <span>MISSION PROGRESS</span>

            <strong>${progress}%</strong>

          </div>

          <div class="quest-progress-track">

            <div
              class="quest-progress-fill ${
                completed
                  ? "progress-completed"
                  : "progress-active"
              }"
              style="width: ${progress}%"
            ></div>

          </div>

        </div>

        <p class="quest-status-label ${
          completed ? "status-ready" : "status-active"
        }">

          ${
            completed
              ? "✦ READY TO CLAIM"
              : "◈ ACTIVE MISSION"
          }

        </p>

        ${action}

      </article>

    `;

  }).join("");
}

// ==========================================
// FILTER BUTTONS
// ==========================================

document.querySelectorAll(".filter-button").forEach(button => {

  button.addEventListener("click", () => {

    document.querySelectorAll(".filter-button")
      .forEach(b => b.classList.remove("active"));

    button.classList.add("active");

    currentFilter = button.dataset.filter;

    renderAvailable(getAvailableQuests());
  });

});

// ==========================================
// ACCEPT QUEST
// ==========================================

async function acceptQuest(questId, button) {

  button.disabled = true;

  try {

    const { error } = await supabase.rpc(
      "assign_quest",
      {
        p_quest_id: Number(questId)
      }
    );

    if (error) throw error;

    message.textContent = "QUEST ACCEPTED.";

    await loadQuests();

    await loadQuestEnergy();

  } catch (error) {

    console.error(error);

    message.textContent = error.message;

    button.disabled = false;
  }
}

availableContainer.addEventListener("click", async event => {

  const button = event.target.closest("[data-quest-id]");

  if (!button) return;

  await acceptQuest(button.dataset.questId, button);
});

featuredContainer.addEventListener("click", async event => {

  const button = event.target.closest("[data-featured-quest-id]");

  if (!button) return;

  await acceptQuest(button.dataset.featuredQuestId, button);
});

// ==========================================
// COMPLETE OR CLAIM QUEST
// ==========================================

myQuestsContainer.addEventListener("click", async event => {

  const completeButton = event.target.closest("[data-complete-id]");

  const claimButton = event.target.closest("[data-claim-id]");

  if (!completeButton && !claimButton) return;

  const button = completeButton || claimButton;

  button.disabled = true;

  try {

    // ======================================
    // COMPLETE QUEST
    // ======================================

    if (completeButton) {

      const { data, error } = await supabase.rpc(
        "complete_quest",
        {
          p_user_quest_id: Number(
            completeButton.dataset.completeId
          )
        }
      );

      if (error) throw error;

      const energySpent = Number(
        data?.energy_spent ?? 0
      );

      const energyRemaining = Number(
        data?.energy_remaining ?? 0
      );

      message.textContent =
        `QUEST COMPLETED. -${energySpent} ENERGY. ` +
        `${energyRemaining} ENERGY REMAINING.`;

      showAchievementNotifications(
        data?.achievements || []
      );
    }

    // ======================================
    // CLAIM REWARDS
    // ======================================

    if (claimButton) {

      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError) throw userError;

      const { data: oldProfile, error: oldProfileError } =
        await supabase
          .from("profiles")
          .select("level, rank")
          .eq("user_id", userData.user.id)
          .single();

      if (oldProfileError) throw oldProfileError;

      const { data, error } = await supabase.rpc(
        "claim_quest",
        {
          p_user_quest_id: Number(
            claimButton.dataset.claimId
          )
        }
      );

      if (error) throw error;

      message.textContent =
        "REWARDS CLAIMED SUCCESSFULLY.";

      // LEVEL UP

      if (data.level > oldProfile.level) {

        showSystemNotification(
          "LEVEL UP!",
          `YOU REACHED LEVEL ${data.level}`,
          "⚡"
        );
      }

      // RANK UP

      if (data.rank !== oldProfile.rank) {

        showSystemNotification(
          "RANK UP!",
          `HUNTER RANK ${oldProfile.rank} → ${data.rank}`,
          "👑"
        );
      }

      // ACHIEVEMENTS

      const achievements =
        data.achievements?.unlocked || [];

      showAchievementNotifications(achievements);
    }

    // ======================================
    // REFRESH SYSTEM DATA
    // ======================================

    await loadQuests();

    await loadProfile();

    await loadQuestEnergy();

  } catch (error) {

    console.error(error);

    const errorMessage = error.message || "";

    if (
      errorMessage.includes("Not enough energy") ||
      errorMessage.includes("Insufficient energy")
    ) {

      message.textContent =
        "INSUFFICIENT ENERGY. RESTORE YOUR ENERGY BEFORE COMPLETING THIS QUEST.";

    } else {

      message.textContent = errorMessage;
    }

    // Refresh data even if an operation fails.

    try {
      await loadQuests();
      await loadProfile();
      await loadQuestEnergy();
    } catch (refreshError) {
      console.error(refreshError);
    }

  }

});

// ==========================================
// LOGOUT
// ==========================================

logoutButton.addEventListener("click", async () => {

  await supabase.auth.signOut();

  window.location.href = "login.html";

});

// ==========================================
// START SYSTEM
// ==========================================

initialize().catch(error => {

  console.error(error);

  message.textContent =
    "SYSTEM ERROR: " + error.message;

});

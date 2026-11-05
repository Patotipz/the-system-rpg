
import { supabase } from "./config.js";

const availableContainer = document.getElementById("availableQuests");
const myQuestsContainer = document.getElementById("myQuests");
const message = document.getElementById("questMessage");

const activeCount = document.getElementById("activeQuestCount");
const availableCount = document.getElementById("availableQuestCount");
const completedCount = document.getElementById("completedQuestCount");

const rankElement = document.getElementById("hunterRank");
const levelElement = document.getElementById("hunterLevel");
const logoutButton = document.getElementById("logoutButton");

let currentFilter = "all";
let currentUser = null;
let catalog = [];
let userQuests = [];
// ACHIEVEMENT NOTIFICATIONS
const achievementModal = document.getElementById("achievementModal");
const modalIcon = document.getElementById("modalAchievementIcon");
const modalTitle = document.getElementById("modalAchievementTitle");
const modalDescription = document.getElementById("modalAchievementDescription");
const modalXP = document.getElementById("modalAchievementXP");
const modalCoins = document.getElementById("modalAchievementCoins");
const closeAchievementModal = document.getElementById("closeAchievementModal");

let achievementQueue = [];

function showNextAchievement() {
  if (!achievementQueue.length) {
    achievementModal.classList.add("hidden");
    return;
  }

  const achievement = achievementQueue.shift();

  modalIcon.textContent = "🏆";
  modalTitle.textContent = achievement.title;
  modalDescription.textContent = "A new achievement has been unlocked.";
  modalXP.textContent = `+${achievement.xp_reward || 0} XP`;
  modalCoins.textContent = `+${achievement.coin_reward || 0} COINS`;

  achievementModal.classList.remove("hidden");
}

function showAchievementNotifications(achievements) {
  if (!Array.isArray(achievements) || !achievements.length) return;

  achievementQueue.push(...achievements);

  if (achievementModal.classList.contains("hidden")) {
    showNextAchievement();
  }
}

closeAchievementModal.addEventListener("click", showNextAchievement);
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

function startDailyRefresh() {
  let lastDate = getMexicoDate();

  setInterval(async () => {
    const today = getMexicoDate();

    if (today !== lastDate) {
      lastDate = today;

      try {
        await loadQuests();
        message.textContent = "NEW DAY. DAILY QUESTS RESET.";
      } catch (error) {
        console.error(error);
        message.textContent = error.message;
      }
    }
  }, 30000);

  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState !== "visible") return;

    const today = getMexicoDate();

    if (today !== lastDate) {
      lastDate = today;

      try {
        await loadQuests();
        message.textContent = "DAILY QUESTS UPDATED.";
      } catch (error) {
        console.error(error);
        message.textContent = error.message;
      }
    }
  });
}

async function initialize() {
  const { data: authData } = await supabase.auth.getUser();
  currentUser = authData.user;

  if (!currentUser) {
    window.location.href = "login.html";
    return;
  }

  const { data: authorized, error: authError } =
    await supabase.rpc("is_authorized");

  if (authError) throw authError;

  if (!authorized) {
    await supabase.auth.signOut();
    window.location.href = "login.html";
    return;
  }

  await loadProfile();
  await loadQuests();
  startDailyRefresh();
}

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

async function loadQuests() {
  const { data: questData, error: questError } = await supabase
    .from("quests")
    .select("id, title, description, quest_type, difficulty, xp_reward, coin_reward");

  if (questError) throw questError;

  catalog = questData || [];

  const { data: assignedData, error: assignedError } = await supabase
    .from("user_quests")
    .select("id, quest_id, status, assigned_at, quests(title, description, quest_type, difficulty, xp_reward, coin_reward)")
    .eq("user_id", currentUser.id);

  if (assignedError) throw assignedError;

  userQuests = assignedData || [];

  renderAll();
}


function getMexicoWeekStart(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);

  const date = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = date.getUTCDay();

  // Monday is the first day of the week
  const daysToMonday = (dayOfWeek + 6) % 7;

  date.setUTCDate(date.getUTCDate() - daysToMonday);

  return date.toISOString().slice(0, 10);
}

function getAvailableQuests() {
  const today = getMexicoDate();
  const currentWeek = getMexicoWeekStart(today);

  return catalog.filter(quest => {
    const assignments = userQuests.filter(
      uq => uq.quest_id === quest.id
    );

    if (quest.quest_type === "daily") {
      return !assignments.some(uq =>
        getMexicoDateFromTimestamp(uq.assigned_at) === today
      );
    }

    if (quest.quest_type === "weekly") {
      return !assignments.some(uq =>
        getMexicoWeekStart(
          getMexicoDateFromTimestamp(uq.assigned_at)
        ) === currentWeek
      );
    }

    if (
      quest.quest_type === "main" ||
      quest.quest_type === "special"
    ) {
      return assignments.length === 0;
    }

    // Preserve existing dungeon behavior
    return true;
  });
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

function renderAll() {
  const active = userQuests.filter(q =>
    q.status === "active" || q.status === "pending"
  );

  const completed = userQuests.filter(q =>
    q.status === "completed"
  );

  const available = getAvailableQuests();

  activeCount.textContent = active.length;
  availableCount.textContent = available.length;
  completedCount.textContent = completed.length;

  renderAvailable(available);
  renderMyQuests(active.concat(completed));
}

function renderAvailable(quests) {
  const filtered = currentFilter === "all"
    ? quests
    : quests.filter(q => q.quest_type === currentFilter);

  if (!filtered.length) {
    availableContainer.innerHTML =
      '<p class="muted">No available missions.</p>';
    return;
  }

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

  availableContainer.innerHTML = filtered.map(q => {
    const type = questTypes[q.quest_type] || {
      label: "QUEST",
      class: "type-default",
      icon: "◇"
    };

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

        <div class="quest-rewards">
          <span>✦ +${q.xp_reward} XP</span>
          <span>◈ +${q.coin_reward} COINS</span>
        </div>

        <button class="quest-action" data-quest-id="${q.id}">
          ACCEPT QUEST
        </button>
      </article>
    `;
  }).join("");
}

function renderMyQuests(quests) {
  if (!quests.length) {
    myQuestsContainer.innerHTML =
      '<p class="muted">You have no active missions.</p>';
    return;
  }

  myQuestsContainer.innerHTML = quests.map(q => {
    const quest = q.quests;

    let action = "";

    if (q.status === "active" || q.status === "pending") {
      action = `
        <button class="quest-action" data-complete-id="${q.id}">
          COMPLETE QUEST
        </button>`;
    } else if (q.status === "completed") {
      action = `
        <button class="quest-action" data-claim-id="${q.id}">
          CLAIM REWARDS
        </button>`;
    }

    return `
      <article class="quest-card">
        <span class="quest-difficulty">${quest.difficulty}</span>
        <h3>${quest.title}</h3>
        <p>${quest.description || ""}</p>
        <p>STATUS: ${q.status.toUpperCase()}</p>
        ${action}
      </article>
    `;
  }).join("");
}

// FILTER BUTTONS
document.querySelectorAll(".filter-button").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".filter-button")
      .forEach(b => b.classList.remove("active"));

    button.classList.add("active");
    currentFilter = button.dataset.filter;

    renderAvailable(getAvailableQuests());
  });
});

// ACCEPT QUEST
availableContainer.addEventListener("click", async event => {
  const button = event.target.closest("[data-quest-id]");
  if (!button) return;

  button.disabled = true;

  try {
    const questId = Number(button.dataset.questId);

    const { error } = await supabase.rpc("assign_quest", {
      p_quest_id: questId
    });

    if (error) throw error;

    message.textContent = "QUEST ACCEPTED.";
    await loadQuests();
  } catch (error) {
    console.error(error);
    message.textContent = error.message;
    button.disabled = false;
  }
});

// COMPLETE OR CLAIM QUEST
myQuestsContainer.addEventListener("click", async event => {
  const completeButton = event.target.closest("[data-complete-id]");
  const claimButton = event.target.closest("[data-claim-id]");

  try {
    if (completeButton) {
      completeButton.disabled = true;

      const { data, error } = await supabase.rpc("complete_quest", {
        p_user_quest_id: Number(completeButton.dataset.completeId)
      });

      if (error) throw error;

      message.textContent = "QUEST COMPLETED. CLAIM YOUR REWARDS.";

      showAchievementNotifications(data?.achievements || []);
    }

    if (claimButton) {
      claimButton.disabled = true;

      const { error } = await supabase.rpc("claim_quest", {
        p_user_quest_id: Number(claimButton.dataset.claimId)
      });

      if (error) throw error;

      message.textContent = "REWARDS CLAIMED SUCCESSFULLY.";
    }

    await loadQuests();
    await loadProfile();

  } catch (error) {
    console.error(error);
    message.textContent = error.message;
  }
});


// LOGOUT
logoutButton.addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.href = "login.html";
});

initialize().catch(error => {
  console.error(error);
  message.textContent = "SYSTEM ERROR: " + error.message;
});

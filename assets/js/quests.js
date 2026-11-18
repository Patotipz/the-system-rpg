
import { supabase } from "./config.js";

// ==========================================
// CONFIGURATION
// ==========================================

const EVIDENCE_BUCKET = "quest-evidence";
const MAX_EVIDENCE_SIZE = 10 * 1024 * 1024;

const ALLOWED_EVIDENCE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf"
];

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

// ENERGY

const energyValue = document.getElementById("questEnergyValue");
const energyMax = document.getElementById("questEnergyMax");
const energyBar = document.getElementById("questEnergyBar");
const energyPercentage = document.getElementById("questEnergyPercentage");

// HP

const hpValue = document.getElementById("questHPValue");
const hpMax = document.getElementById("questHPMax");
const hpBar = document.getElementById("questHPBar");
const hpPercentage = document.getElementById("questHPPercentage");
const exhaustedWarning = document.getElementById("questExhaustedWarning");
const hpRegenIndicator = document.getElementById("questHPRegen");
const energyRegenIndicator = document.getElementById("questEnergyRegen");

// ACHIEVEMENT MODAL

const achievementModal = document.getElementById("achievementModal");
const modalIcon = document.getElementById("modalAchievementIcon");
const modalTitle = document.getElementById("modalAchievementTitle");
const modalDescription = document.getElementById("modalAchievementDescription");
const modalXP = document.getElementById("modalAchievementXP");
const modalCoins = document.getElementById("modalAchievementCoins");
const closeAchievementModal = document.getElementById("closeAchievementModal");

// ADMIN EVIDENCE

const adminEvidenceSection = document.getElementById("adminEvidenceSection");
const adminEvidenceList = document.getElementById("adminEvidenceList");

// ==========================================
// GLOBAL VARIABLES
// ==========================================

let currentFilter = "all";
let currentUser = null;
let isAdmin = false;

let catalog = [];
let userQuests = [];
let userEvidence = [];

let achievementQueue = [];

// ==========================================
// HELPERS
// ==========================================

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };

    return entities[character];
  });
}

function safeExternalURL(value) {
  try {
    const url = new URL(value);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

function getEvidenceForQuest(userQuestId) {
  return userEvidence
    .filter(item => Number(item.user_quest_id) === Number(userQuestId))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function getApprovedEvidence(userQuestId) {
  return getEvidenceForQuest(userQuestId)
    .find(item => item.review_status === "approved");
}

function getPendingEvidence(userQuestId) {
  return getEvidenceForQuest(userQuestId)
    .find(item => item.review_status === "pending");
}

function getLatestEvidence(userQuestId) {
  return getEvidenceForQuest(userQuestId)[0] || null;
}

function getQuestErrorMessage(error) {
  const errorMessage = [
    error?.message,
    error?.details,
    error?.hint
  ].filter(Boolean).join(" ");

  if (errorMessage.includes("EXHAUSTED")) {
    return "⚠ SYSTEM WARNING: YOU ARE EXHAUSTED. RECOVER AT LEAST 50% HP BEFORE ACCEPTING OR COMPLETING QUESTS.";
  }

  if (
    errorMessage.includes("Not enough energy") ||
    errorMessage.includes("Insufficient energy")
  ) {
    return "INSUFFICIENT ENERGY. RESTORE YOUR ENERGY BEFORE COMPLETING THIS QUEST.";
  }

  if (errorMessage.includes("EVIDENCE_REQUIRED")) {
    return "EVIDENCE REQUIRED. SUBMIT YOUR OFFICIAL RESULT AND WAIT FOR APPROVAL.";
  }

  if (errorMessage.includes("special quest has already been assigned")) {
    return "YOU HAVE ALREADY ACCEPTED A SPECIAL QUEST THIS MONTH.";
  }

  if (errorMessage.includes("already assigned this week")) {
    return "YOU HAVE ALREADY ACCEPTED THIS WEEKLY QUEST.";
  }

  if (errorMessage.includes("already assigned today")) {
    return "YOU HAVE ALREADY ACCEPTED THIS DAILY QUEST TODAY.";
  }

  if (errorMessage.includes("already assigned this year")) {
    return "YOU HAVE ALREADY ACCEPTED THIS ANNUAL QUEST THIS YEAR.";
  }

  if (errorMessage.includes("Physical challenge already assigned")) {
    return "YOU HAVE ALREADY ACCEPTED THIS PHYSICAL CHALLENGE.";
  }

  return "SYSTEM ERROR: " + (error?.message || "UNKNOWN ERROR.");
}

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

function getMexicoMonth(timestamp) {
  return getMexicoDateFromTimestamp(timestamp).slice(0, 7);
}

function getMexicoYear(timestamp) {
  return getMexicoDateFromTimestamp(timestamp).slice(0, 4);
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

  const { data: adminResult, error: adminError } =
    await supabase.rpc("is_admin");

  if (adminError) {
    console.warn("ADMIN CHECK:", adminError.message);
  }

  isAdmin = Boolean(adminResult);

  if (adminEvidenceSection) {
    adminEvidenceSection.hidden = !isAdmin;
  }

  await loadProfile();
  await loadQuestEnergy();
  await loadQuests();

  if (isAdmin) {
    await loadAdminEvidence();
  }

  startResourceRefresh();
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
// LOAD HP AND ENERGY
// ==========================================

async function loadQuestEnergy() {
  const { data, error } = await supabase
    .from("player_stats")
    .select("hp, max_hp, energy, max_energy, exhausted")
    .eq("user_id", currentUser.id)
    .single();

  if (error) throw error;

  // ENERGY

  const energy = Number(data.energy ?? 0);
  const maxEnergy = Number(data.max_energy ?? 0);

  const energyPercent = maxEnergy > 0
    ? Math.min(100, (energy / maxEnergy) * 100)
    : 0;

  if (energyValue) energyValue.textContent = energy;
  if (energyMax) energyMax.textContent = maxEnergy;

  if (energyBar) {
    energyBar.style.width = `${energyPercent}%`;
  }

  if (energyPercentage) {
    energyPercentage.textContent =
      `${Math.round(energyPercent)}% AVAILABLE`;
  }

  // HP

  const hp = Number(data.hp ?? 0);
  const maxHP = Number(data.max_hp ?? 0);
  const exhausted = Boolean(data.exhausted);

  const hpPercent = maxHP > 0
    ? Math.min(100, (hp / maxHP) * 100)
    : 0;

  if (hpValue) hpValue.textContent = hp;
  if (hpMax) hpMax.textContent = maxHP;

  if (hpBar) {
    hpBar.style.width = `${hpPercent}%`;
  }

  if (hpPercentage) {
    hpPercentage.textContent =
      `${Math.round(hpPercent)}% HP`;
  }

  if (exhaustedWarning) {
    exhaustedWarning.hidden = !exhausted;
  }
}

// ==========================================
// AUTOMATIC RESOURCE REGENERATION
// ==========================================

function showResourceGain(element, amount, label) {
  if (!element) return;

  if (amount <= 0) {
    element.hidden = true;
    return;
  }

  element.textContent = `+${amount} ${label}`;
  element.hidden = false;

  element.style.animation = "none";
  void element.offsetWidth;
  element.style.animation = "";

  setTimeout(() => {
    element.hidden = true;
  }, 2500);
}

function startResourceRefresh() {
  async function refreshResources() {
    try {
      const { data, error } = await supabase.rpc(
        "regenerate_player_resources"
      );

      if (error) throw error;

      const hpRegenerated = Number(
        data?.hp_regenerated ?? 0
      );

      const energyRegenerated = Number(
        data?.energy_regenerated ?? 0
      );

      await loadQuestEnergy();

      showResourceGain(hpRegenIndicator, hpRegenerated, "HP");
      showResourceGain(energyRegenIndicator, energyRegenerated, "ENERGY");

    } catch (error) {
      console.error("RESOURCE REFRESH ERROR:", error);
    }
  }

  setInterval(refreshResources, 30000);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      refreshResources();
    }
  });
}

// ==========================================
// LOAD QUESTS AND EVIDENCE
// ==========================================

async function loadQuests() {
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

  const { data: assignedData, error: assignedError } =
    await supabase
      .from("user_quests")
      .select(`
        id,
        quest_id,
        status,
        assigned_at,
        completed_at,
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

  await loadUserEvidence();

  renderAll();
}

async function loadUserEvidence() {
  const assignmentIds = userQuests.map(item => item.id);

  if (!assignmentIds.length) {
    userEvidence = [];
    return;
  }

  const { data, error } = await supabase
    .from("quest_evidence")
    .select(`
      id,
      user_quest_id,
      evidence_url,
      evidence_type,
      notes,
      review_status,
      review_notes,
      created_at
    `)
    .in("user_quest_id", assignmentIds)
    .eq("user_id", currentUser.id);

  if (error) throw error;

  userEvidence = data || [];
}

// ==========================================
// AVAILABLE QUESTS
// ==========================================

function getAvailableQuests() {
  const today = getMexicoDate();
  const currentWeek = getMexicoWeekStart(today);
  const currentMonth = today.slice(0, 7);
  const currentYear = today.slice(0, 4);

  const hasSpecialThisMonth = userQuests.some(item => {
    const type = item.quests?.quest_type;

    return type === "special" &&
      getMexicoMonth(item.assigned_at) === currentMonth;
  });

  return catalog.filter(quest => {
    const assignments = userQuests.filter(
      item => Number(item.quest_id) === Number(quest.id)
    );

    if (quest.quest_type === "daily") {
      return !assignments.some(item =>
        getMexicoDateFromTimestamp(item.assigned_at) === today
      );
    }

    if (quest.quest_type === "weekly") {
      return !assignments.some(item =>
        getMexicoWeekStart(
          getMexicoDateFromTimestamp(item.assigned_at)
        ) === currentWeek
      );
    }

    if (quest.quest_type === "special") {
      return !hasSpecialThisMonth;
    }

    if (quest.quest_type === "main") {
      return assignments.length === 0;
    }

    if (quest.quest_type === "annual") {
      return !assignments.some(item =>
        getMexicoYear(item.assigned_at) === currentYear
      );
    }

    if (quest.quest_type === "physical") {
      return assignments.length === 0;
    }

    if (quest.quest_type === "dungeon") {
      return true;
    }

    return false;
  });
}

// ==========================================
// RENDER ALL
// ==========================================

function renderAll() {
  const active = userQuests.filter(item =>
    item.status === "active" ||
    item.status === "pending"
  );

  const completed = userQuests.filter(item =>
    item.status === "completed"
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

  annual: {
    label: "ANNUAL QUEST",
    class: "type-annual",
    icon: "⌛"
  },

  physical: {
    label: "PHYSICAL CHALLENGE",
    class: "type-physical",
    icon: "🏅"
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
// QUEST REWARDS
// ==========================================

function renderRewards(quest) {
  return `
    <div class="quest-rewards">
      <span>✦ +${Number(quest.xp_reward || 0)} XP</span>
      <span>◈ +${Number(quest.coin_reward || 0)} COINS</span>
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
    physical: 2,
    special: 3,
    annual: 4,
    weekly: 5,
    daily: 6,
    dungeon: 7
  };

  const filtered = (
    currentFilter === "all"
      ? [...quests]
      : quests.filter(item => item.quest_type === currentFilter)
  ).sort((a, b) =>
    (priority[a.quest_type] || 99) -
    (priority[b.quest_type] || 99)
  );

  if (!filtered.length) {
    availableContainer.innerHTML =
      '<p class="muted">No available missions in this category.</p>';
    return;
  }

  availableContainer.innerHTML = filtered.map(quest => {
    const type = getQuestType(quest.quest_type);

    return `
      <article class="quest-card ${type.class}">
        <div class="quest-card-top">
          <span class="quest-type">
            ${type.icon} ${type.label}
          </span>

          <span class="quest-difficulty">
            RANK ${escapeHTML(quest.difficulty)}
          </span>
        </div>

        <h3>${escapeHTML(quest.title)}</h3>

        <p>${escapeHTML(
          quest.description || "No description available."
        )}</p>

        ${renderRewards(quest)}

        <button
          class="quest-action"
          data-quest-id="${Number(quest.id)}">
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
    .filter(item =>
      item.quest_type === "main" ||
      item.quest_type === "special" ||
      item.quest_type === "physical"
    )
    .sort((a, b) => {
      const priority = {
        main: 1,
        physical: 2,
        special: 3
      };

      return priority[a.quest_type] - priority[b.quest_type];
    });

  if (!featured.length) {
    featuredContainer.innerHTML =
      '<p class="muted">No featured missions available.</p>';
    return;
  }

  featuredContainer.innerHTML = featured.map(quest => {
    const type = getQuestType(quest.quest_type);

    return `
      <article class="quest-card ${type.class} featured-card">
        <div class="quest-card-top">
          <span class="quest-type">
            ${type.icon} ${type.label}
          </span>

          <span class="quest-difficulty">
            RANK ${escapeHTML(quest.difficulty)}
          </span>
        </div>

        <h3>${escapeHTML(quest.title)}</h3>

        <p>${escapeHTML(
          quest.description || "No description available."
        )}</p>

        ${renderRewards(quest)}

        <button
          class="quest-action"
          data-featured-quest-id="${Number(quest.id)}">
          ACCEPT QUEST
        </button>
      </article>
    `;
  }).join("");
}

// ==========================================
// PHYSICAL EVIDENCE UI
// ==========================================


function renderEvidenceSubmission(userQuestId) {
  const approved = getApprovedEvidence(userQuestId);
  const pending = getPendingEvidence(userQuestId);

  if (approved || pending) return "";

  return `
    <form
      class="evidence-form"
      data-evidence-form
      data-user-quest-id="${Number(userQuestId)}">

      <p class="evidence-form-title">
        [ SUBMIT OFFICIAL PROOF ]
      </p>

      <label>
        Upload result / certificate / photo
      </label>

      <input
        type="file"
        name="evidence_file"
        accept="image/jpeg,image/png,image/webp,application/pdf">

      <p class="evidence-or">OR</p>

      <label>Official result URL</label>

      <input
        type="url"
        name="evidence_link"
        placeholder="https://...">

      <label>Notes (optional)</label>

      <textarea
        name="evidence_notes"
        rows="2"
        maxlength="500"
        placeholder="Event name, date, category..."></textarea>

      <button type="submit" class="quest-action">
        SUBMIT EVIDENCE
      </button>

    </form>
  `;
}
function renderEvidenceStatus(userQuestId) {
  const evidence = getLatestEvidence(userQuestId);

  if (!evidence) return "";

  if (evidence.review_status === "pending") {
    return `
      <div class="evidence-status evidence-pending">
        <strong>◷ EVIDENCE UNDER REVIEW</strong>
        <p>Your submission is waiting for admin approval.</p>
      </div>
    `;
  }

  if (evidence.review_status === "approved") {
    return `
      <div class="evidence-status evidence-approved">
        <strong>✓ EVIDENCE APPROVED</strong>
        <p>Your official result has been verified.</p>
      </div>
    `;
  }

  if (evidence.review_status === "rejected") {
    return `
      <div class="evidence-status evidence-rejected">
        <strong>✕ EVIDENCE REJECTED</strong>
        <p>${escapeHTML(
          evidence.review_notes || "Please submit new evidence."
        )}</p>
        <p>You can submit new evidence below.</p>
      </div>
    `;
  }

  return "";
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

  myQuestsContainer.innerHTML = quests.map(item => {
    const quest = item.quests;

    if (!quest) return "";

    const type = getQuestType(quest.quest_type);
    const completed = item.status === "completed";
    const physical = quest.quest_type === "physical";

    const approvedEvidence = physical
      ? getApprovedEvidence(item.id)
      : null;

    let action = "";

    if (completed) {
      action = `
        <button
          class="quest-action"
          data-claim-id="${Number(item.id)}">
          CLAIM REWARDS
        </button>
      `;
    } else if (physical && !approvedEvidence) {
      action = renderEvidenceSubmission(item.id);
    } else {
      action = `
        <button
          class="quest-action"
          data-complete-id="${Number(item.id)}">
          COMPLETE QUEST
        </button>
      `;
    }

    const progress = completed ? 100 : 25;

    let statusText = "◈ ACTIVE MISSION";

    if (completed) {
      statusText = "✦ READY TO CLAIM";
    } else if (physical && approvedEvidence) {
      statusText = "✓ EVIDENCE APPROVED — READY TO COMPLETE";
    }

    return `
      <article class="quest-card ${type.class}">
        <div class="quest-card-top">
          <span class="quest-type">
            ${type.icon} ${type.label}
          </span>

          <span class="quest-difficulty">
            RANK ${escapeHTML(quest.difficulty)}
          </span>
        </div>

        <h3>${escapeHTML(quest.title)}</h3>

        <p>${escapeHTML(quest.description || "")}</p>

        ${renderRewards(quest)}

        <div class="quest-progress">
          <div class="quest-progress-info">
            <span>MISSION PROGRESS</span>
            <strong>${progress}%</strong>
          </div>

          <div class="quest-progress-track">
            <div
              class="quest-progress-fill ${
                completed ? "progress-completed" : "progress-active"
              }"
              style="width: ${progress}%">
            </div>
          </div>
        </div>

        <p class="quest-status-label ${
          completed ? "status-ready" : "status-active"
        }">
          ${statusText}
        </p>

        ${physical && !completed
          ? renderEvidenceStatus(item.id)
          : ""}

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
      .forEach(item => item.classList.remove("active"));

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
    const { error } = await supabase.rpc("assign_quest", {
      p_quest_id: Number(questId)
    });

    if (error) throw error;

    message.textContent = "QUEST ACCEPTED.";

    await loadQuests();
    await loadQuestEnergy();

  } catch (error) {
    console.error(error);

    message.textContent = getQuestErrorMessage(error);
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
// SUBMIT PHYSICAL EVIDENCE
// ==========================================

myQuestsContainer.addEventListener("submit", async event => {
  const form = event.target.closest("[data-evidence-form]");

  if (!form) return;

  event.preventDefault();

  const submitButton = form.querySelector('button[type="submit"]');
  const fileInput = form.querySelector('[name="evidence_file"]');
  const linkInput = form.querySelector('[name="evidence_link"]');
  const notesInput = form.querySelector('[name="evidence_notes"]');

  const userQuestId = Number(form.dataset.userQuestId);
  const file = fileInput.files?.[0] || null;
  const rawLink = linkInput.value.trim();
  const notes = notesInput.value.trim();

  if (!file && !rawLink) {
    message.textContent = "PLEASE UPLOAD A FILE OR PROVIDE A RESULT URL.";
    return;
  }

  if (file && rawLink) {
    message.textContent = "PLEASE SUBMIT EITHER A FILE OR A LINK, NOT BOTH.";
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "SUBMITTING...";

  try {
    let evidenceURL = "";
    let evidenceType = "";

    if (file) {
      if (!ALLOWED_EVIDENCE_TYPES.includes(file.type)) {
        throw new Error(
          "INVALID FILE TYPE. USE JPG, PNG, WEBP OR PDF."
        );
      }

      if (file.size > MAX_EVIDENCE_SIZE) {
        throw new Error("FILE TOO LARGE. MAXIMUM SIZE IS 10 MB.");
      }

      const safeName = file.name
        .normalize("NFKD")
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .slice(-100);

      const filePath =
        `${currentUser.id}/${userQuestId}/` +
        `${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase
        .storage
        .from(EVIDENCE_BUCKET)
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false
        });

      if (uploadError) throw uploadError;

      evidenceURL = filePath;
      evidenceType = "file";

    } else {
      const safeURL = safeExternalURL(rawLink);

      if (!safeURL) {
        throw new Error("PLEASE PROVIDE A VALID HTTP OR HTTPS URL.");
      }

      evidenceURL = safeURL;
      evidenceType = "link";
    }

    const { error: insertError } = await supabase
      .from("quest_evidence")
      .insert({
        user_quest_id: userQuestId,
        user_id: currentUser.id,
        evidence_url: evidenceURL,
        evidence_type: evidenceType,
        notes: notes || null
      });

    if (insertError) throw insertError;

    message.textContent =
      "EVIDENCE SUBMITTED. WAITING FOR ADMIN APPROVAL.";

    await loadQuests();

    if (isAdmin) {
      await loadAdminEvidence();
    }

  } catch (error) {
    console.error("EVIDENCE SUBMISSION ERROR:", error);
    message.textContent = getQuestErrorMessage(error);

    submitButton.disabled = false;
    submitButton.textContent = "SUBMIT EVIDENCE";
  }
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
    // COMPLETE QUEST

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

      const energySpent = Number(data?.energy_spent ?? 0);
      const energyRemaining = Number(data?.energy_remaining ?? 0);

      message.textContent =
        `QUEST COMPLETED. -${energySpent} ENERGY. ` +
        `${energyRemaining} ENERGY REMAINING.`;

      showAchievementNotifications(
        data?.achievements || []
      );
    }

    // CLAIM REWARDS

    if (claimButton) {
      const { data: oldProfile, error: oldProfileError } =
        await supabase
          .from("profiles")
          .select("level, rank")
          .eq("user_id", currentUser.id)
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

      message.textContent = "REWARDS CLAIMED SUCCESSFULLY.";

      if (data.level > oldProfile.level) {
        showSystemNotification(
          "LEVEL UP!",
          `YOU REACHED LEVEL ${data.level}`,
          "⚡"
        );
      }

      if (data.rank !== oldProfile.rank) {
        showSystemNotification(
          "RANK UP!",
          `HUNTER RANK ${oldProfile.rank} → ${data.rank}`,
          "👑"
        );
      }

      const achievements = data.achievements?.unlocked || [];

      showAchievementNotifications(achievements);
    }

    await loadQuests();
    await loadProfile();
    await loadQuestEnergy();

  } catch (error) {
    console.error(error);

    message.textContent = getQuestErrorMessage(error);

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
// ADMIN: LOAD PENDING EVIDENCE
// ==========================================

async function loadAdminEvidence() {
  if (adminEvidenceList) {
  adminEvidenceList.addEventListener("click", async event => {
    const button = event.target.closest("[data-review-id]");

    if (!button || !isAdmin) return;

    const evidenceId = Number(button.dataset.reviewId);
    const decision = button.dataset.decision;

    const notesInput = adminEvidenceList.querySelector(
      `[data-review-notes="${evidenceId}"]`
    );

    const reviewNotes = notesInput?.value.trim() || null;

    button.disabled = true;

    try {
      const { error } = await supabase.rpc(
        "review_quest_evidence",
        {
          p_evidence_id: evidenceId,
          p_decision: decision,
          p_review_notes: reviewNotes
        }
      );

      if (error) throw error;

      message.textContent = decision === "approved"
        ? "EVIDENCE APPROVED."
        : "EVIDENCE REJECTED.";

      await loadAdminEvidence();
      await loadQuests();

    } catch (error) {
      console.error("EVIDENCE REVIEW ERROR:", error);

      message.textContent = getQuestErrorMessage(error);
      button.disabled = false;
    }
  });
}

// ==========================================
// ADMIN: APPROVE OR REJECT EVIDENCE
// ==========================================

if (adminEvidenceList) {
  adminEvidenceList.addEventListener("click", async event => {
    const button = event.target.closest("[data-review-id]");

    if (!button || !isAdmin) return;

    const evidenceId = Number(button.dataset.reviewId);
    const decision = button.dataset.decision;

    const notesInput = adminEvidenceList.querySelector(
      `[data-review-notes="${evidenceId}"]`
    );

    const reviewNotes = notesInput?.value.trim() || null;

    button.disabled = true;

    try {
      const { error } = await supabase.rpc(
        "review_quest_evidence",
        {
          p_evidence_id: evidenceId,
          p_decision: decision,
          p_review_notes: reviewNotes
        }
      );

      if (error) throw error;

      message.textContent = decision === "approved"
        ? "EVIDENCE APPROVED."
        : "EVIDENCE REJECTED.";

      await loadAdminEvidence();
      await loadQuests();

    } catch (error) {
      console.error("EVIDENCE REVIEW ERROR:", error);

      message.textContent = getQuestErrorMessage(error);
      button.disabled = false;
    }
  });
}

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

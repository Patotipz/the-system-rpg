
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

async function initialize() {
  const { data: authData } = await supabase.auth.getUser();
  currentUser = authData.user;

  if (!currentUser) {
    window.location.href = "login.html";
    return;
  }

  const { data: authorized } = await supabase.rpc("is_authorized");

  if (!authorized) {
    await supabase.auth.signOut();
    window.location.href = "login.html";
    return;
  }

  await loadProfile();
  await loadQuests();
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

function renderAll() {
 const active = userQuests.filter(q =>
  q.status === "active" || q.status === "pending"
);
  const completed = userQuests.filter(q => q.status === "completed");
  const today = new Date().toLocaleDateString("en-CA", {
  timeZone: "America/Mexico_City"
});

const available = catalog.filter(quest => {
  const assignments = userQuests.filter(
    uq => uq.quest_id === quest.id
  );

  if (quest.quest_type === "daily") {
    return !assignments.some(uq => {
      const assignedDate = new Date(uq.assigned_at)
        .toLocaleDateString("en-CA", {
          timeZone: "America/Mexico_City"
        });

      return assignedDate === today;
    });
  }

  if (quest.quest_type === "main") {
    return assignments.length === 0;
  }

  return true;
});

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

  availableContainer.innerHTML = filtered.map(q => `
    <article class="quest-card">
      <span class="quest-difficulty">${q.difficulty}</span>
      <h3>${q.title}</h3>
      <p>${q.description || "No description available."}</p>
      <p>+${q.xp_reward} XP · +${q.coin_reward} COINS</p>
      <button class="quest-action" data-quest-id="${q.id}">
        ACCEPT QUEST
      </button>
    </article>
  `).join("");
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

document.querySelectorAll(".filter-button").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".filter-button")
      .forEach(b => b.classList.remove("active"));

    button.classList.add("active");
    currentFilter = button.dataset.filter;

   const today = new Date().toLocaleDateString("en-CA", {
  timeZone: "America/Mexico_City"
});

const available = catalog.filter(quest => {
  const assignments = userQuests.filter(
    uq => uq.quest_id === quest.id
  );

  if (quest.quest_type === "daily") {
    return !assignments.some(uq => {
      const assignedDate = new Date(uq.assigned_at)
        .toLocaleDateString("en-CA", {
          timeZone: "America/Mexico_City"
        });

      return assignedDate === today;
    });
  }

  if (quest.quest_type === "main") {
    return assignments.length === 0;
  }

  return true;
});

renderAvailable(available);
});

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

myQuestsContainer.addEventListener("click", async event => {
  const completeButton = event.target.closest("[data-complete-id]");
  const claimButton = event.target.closest("[data-claim-id]");

  try {
    if (completeButton) {
      completeButton.disabled = true;

      const { error } = await supabase.rpc("complete_quest", {
        p_user_quest_id: Number(completeButton.dataset.completeId)
      });

      if (error) throw error;

      message.textContent = "QUEST COMPLETED. CLAIM YOUR REWARDS.";
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

logoutButton.addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.href = "login.html";
});

initialize().catch(error => {
  console.error(error);
  message.textContent = "SYSTEM ERROR: " + error.message;
});

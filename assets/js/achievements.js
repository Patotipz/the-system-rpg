
import { supabase } from "./config.js";

const grid = document.getElementById("achievementsGrid");
const message = document.getElementById("achievementMessage");

const unlockedCount = document.getElementById("unlockedCount");
const lockedCount = document.getElementById("lockedCount");
const totalCount = document.getElementById("totalCount");

const rankElement = document.getElementById("hunterRank");
const levelElement = document.getElementById("hunterLevel");
const logoutButton = document.getElementById("logoutButton");

let currentUser = null;
let achievements = [];
let unlockedAchievements = [];
let currentFilter = "all";

let hunterStats = {
  level: 1,
  xp: 0,
  current_streak: 0
};

let questCount = 0;

// HTML safety
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

// INITIALIZATION
async function initialize() {
  const { data: authData, error: authError } =
    await supabase.auth.getUser();

  if (authError) throw authError;

  currentUser = authData.user;

  if (!currentUser) {
    window.location.href = "login.html";
    return;
  }

  const { data: authorized, error: authorizationError } =
    await supabase.rpc("is_authorized");

  if (authorizationError) throw authorizationError;

  if (!authorized) {
    await supabase.auth.signOut();
    window.location.href = "login.html";
    return;
  }

  // Refresh expired streak before reading profile.
  const { error: streakError } =
    await supabase.rpc("refresh_streak");

  if (streakError) throw streakError;

  await loadAchievements();
}

// LOAD DATA
async function loadAchievements() {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("rank, level, xp, current_streak")
    .eq("user_id", currentUser.id)
    .single();

  if (profileError) throw profileError;

  hunterStats = profile;

  rankElement.textContent = `RANK ${profile.rank}`;
  levelElement.textContent = `LV. ${profile.level}`;

  const { count, error: questError } = await supabase
    .from("user_quests")
    .select("*", { count: "exact", head: true })
    .eq("user_id", currentUser.id)
    .in("status", ["completed", "claimed"]);

  if (questError) throw questError;

  questCount = count || 0;

  const { data: achievementData, error: achievementError } =
    await supabase
      .from("achievements")
      .select(`
        id,
        title,
        description,
        icon,
        category,
        condition_type,
        condition_value,
        xp_reward,
        coin_reward
      `)
      .eq("is_active", true)
      .order("id");

  if (achievementError) throw achievementError;

  achievements = achievementData || [];

  const { data: unlockedData, error: unlockedError } =
    await supabase
      .from("user_achievements")
      .select("achievement_id, unlocked_at")
      .eq("user_id", currentUser.id);

  if (unlockedError) throw unlockedError;

  unlockedAchievements = unlockedData || [];

  renderAll();
}

// PROGRESS
function getProgress(achievement) {
  const target = Number(achievement.condition_value) || 0;

  let current = 0;

  switch (achievement.condition_type) {
    case "level":
      current = hunterStats.level;
      break;

    case "quests_completed":
      current = questCount;
      break;

    case "streak":
      current = hunterStats.current_streak;
      break;

    default:
      current = 0;
  }

  const percentage = target > 0
    ? Math.min(100, (current / target) * 100)
    : 0;

  return {
    current,
    target,
    percentage
  };
}

// UNLOCKED LOOKUP
function getUnlockedAchievement(id) {
  return unlockedAchievements.find(
    item => item.achievement_id === id
  );
}

// RENDER
function renderAll() {
  const unlocked = achievements.filter(
    achievement => getUnlockedAchievement(achievement.id)
  );

  unlockedCount.textContent = unlocked.length;
  lockedCount.textContent = achievements.length - unlocked.length;
  totalCount.textContent = achievements.length;

  renderAchievements();
}

function renderAchievements() {
  const filtered = currentFilter === "all"
    ? achievements
    : achievements.filter(
        achievement => achievement.category === currentFilter
      );

  if (!filtered.length) {
    grid.innerHTML =
      '<p class="muted">No achievements found.</p>';
    return;
  }

  grid.innerHTML = filtered.map(achievement => {
    const unlocked = getUnlockedAchievement(achievement.id);
    const progress = getProgress(achievement);

    const isSecret = achievement.category === "secret";
    const hiddenSecret = isSecret && !unlocked;

    const title = hiddenSecret
      ? "???"
      : escapeHTML(achievement.title);

    const description = hiddenSecret
      ? "A mysterious achievement. Its requirements are classified."
      : escapeHTML(achievement.description || "No description available.");

    const icon = hiddenSecret
      ? "🔒"
      : escapeHTML(achievement.icon || "🏆");

    const status = unlocked
      ? `<span class="achievement-unlocked-label">
          ✓ UNLOCKED · ${formatDate(unlocked.unlocked_at)}
         </span>`
      : `<span class="achievement-locked-label">
          🔒 LOCKED
         </span>`;

    const progressHTML = unlocked
      ? ""
      : `
        <div class="achievement-progress">
          <div
            class="achievement-progress-fill"
            style="width: ${progress.percentage}%">
          </div>
        </div>
        <p class="muted">
          ${progress.current} / ${progress.target}
        </p>
      `;

    return `
      <article class="achievement-card ${unlocked ? "unlocked" : "locked"}">

        <div class="achievement-icon">${icon}</div>

        <h3>${title}</h3>

        <p>${description}</p>

        <div class="achievement-meta">
          <span class="achievement-tag">
            ${escapeHTML(achievement.category.toUpperCase())}
          </span>
        </div>

        <div class="achievement-rewards">
          <span>✦ ${achievement.xp_reward} XP</span>
          <span>◈ ${achievement.coin_reward} COINS</span>
        </div>

        ${progressHTML}

        ${status}

      </article>
    `;
  }).join("");
}

// DATE
function formatDate(date) {
  if (!date) return "";

  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

// FILTERS
document.querySelectorAll(".achievement-filter").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".achievement-filter")
      .forEach(item => item.classList.remove("active"));

    button.classList.add("active");

    currentFilter = button.dataset.filter;

    renderAchievements();
  });
});

// LOGOUT
logoutButton.addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.href = "login.html";
});

// START
initialize().catch(error => {
  console.error(error);
  message.textContent = "SYSTEM ERROR: " + error.message;
});


import { supabase } from "./config.js";

// ======================================
// ELEMENTS
// ======================================

const activityFeed = document.getElementById("activityFeed");
const activityMessage = document.getElementById("activityMessage");

const totalActivitiesElement = document.getElementById("totalActivities");
const totalXPElement = document.getElementById("totalXP");
const questActivitiesElement = document.getElementById("questActivities");
const achievementActivitiesElement = document.getElementById("achievementActivities");

const loadMoreButton = document.getElementById("loadMoreButton");
const logoutButton = document.getElementById("logoutButton");

const filterButtons = document.querySelectorAll(".activity-filter");

// ======================================
// STATE
// ======================================

let allActivities = [];
let currentFilter = "all";
let visibleActivities = 20;

const PAGE_SIZE = 20;
const QUERY_SIZE = 1000;

// ======================================
// AUTHENTICATION
// ======================================

async function verifyUser() {
  const { data: authData, error: authError } =
    await supabase.auth.getUser();

  if (authError) throw authError;

  const currentUser = authData.user;

  if (!currentUser) {
    window.location.href = "login.html";
    return null;
  }

  const { data: authorized, error: authorizationError } =
    await supabase.rpc("is_authorized");

  if (authorizationError) throw authorizationError;

  if (!authorized) {
    await supabase.auth.signOut();
    window.location.href = "login.html";
    return null;
  }

  return currentUser;
}

// ======================================
// LOAD ACTIVITY
// ======================================

async function loadActivities(userId) {
  try {
    activityMessage.textContent =
      "[ SYNCHRONIZING ACTIVITY RECORDS... ]";

    let activities = [];
    let start = 0;
    let hasMore = true;

    // FETCH ALL RECORDS IN BATCHES
    while (hasMore) {
      const { data, error } = await supabase
        .from("activity_log")
        .select("id, activity_type, description, xp_earned, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(start, start + QUERY_SIZE - 1);

      if (error) throw error;

      activities = activities.concat(data || []);

      hasMore = data && data.length === QUERY_SIZE;
      start += QUERY_SIZE;
    }

    allActivities = activities;

    calculateStatistics();
    renderActivities();

    activityMessage.textContent =
      `[ ${allActivities.length} ACTIVITY RECORDS SYNCHRONIZED ]`;

  } catch (error) {
    console.error("Activity loading error:", error);

    activityMessage.textContent =
      "[ SYSTEM ERROR: UNABLE TO LOAD RECORDS ]";

    activityFeed.innerHTML = `
      <div class="activity-empty">
        Unable to load activity records.
        Please refresh the page.
      </div>
    `;
  }
}

// ======================================
// STATISTICS
// ======================================

function calculateStatistics() {
  const totalXP = allActivities.reduce(
    (sum, activity) => sum + Number(activity.xp_earned || 0),
    0
  );

  const questCount = allActivities.filter(
    activity => activity.activity_type === "quest_completed"
  ).length;

  const achievementCount = allActivities.filter(
    activity => activity.activity_type === "achievement_unlocked"
  ).length;

  totalActivitiesElement.textContent =
    allActivities.length.toLocaleString();

  totalXPElement.textContent =
    totalXP.toLocaleString() + " XP";

  questActivitiesElement.textContent =
    questCount.toLocaleString();

  achievementActivitiesElement.textContent =
    achievementCount.toLocaleString();
}

// ======================================
// FILTER ACTIVITIES
// ======================================

function getFilteredActivities() {
  if (currentFilter === "all") {
    return allActivities;
  }

  return allActivities.filter(
    activity => activity.activity_type === currentFilter
  );
}

// ======================================
// RENDER ACTIVITIES
// ======================================

function renderActivities() {
  const filteredActivities = getFilteredActivities();

  const visible = filteredActivities.slice(0, visibleActivities);

  if (filteredActivities.length === 0) {
    activityFeed.innerHTML = `
      <div class="activity-empty">
        No activity records found in this category.
      </div>
    `;

    loadMoreButton.hidden = true;
    return;
  }

  activityFeed.innerHTML = visible.map(activity => {
    const date = new Date(activity.created_at);

    const formattedDate = date.toLocaleString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

    const isAchievement =
      activity.activity_type === "achievement_unlocked";

    const icon = isAchievement ? "🏆" : "⚔";

    const title = isAchievement
      ? "ACHIEVEMENT UNLOCKED"
      : activity.activity_type === "quest_completed"
        ? "QUEST COMPLETED"
        : "SYSTEM ACTIVITY";

    const xp = Number(activity.xp_earned || 0);

    return `
      <article class="activity-entry">

        <div class="activity-entry-icon">
          ${icon}
        </div>

        <div class="activity-entry-info">

          <strong>${title}</strong>

          <p>
            ${escapeHTML(
              activity.description || "Activity recorded"
            )}
          </p>

          <span>${formattedDate}</span>

        </div>

        <div class="activity-entry-xp">
          +${xp.toLocaleString()} XP
        </div>

      </article>
    `;
  }).join("");

  loadMoreButton.hidden =
    visibleActivities >= filteredActivities.length;
}

// ======================================
// LOAD MORE
// ======================================

loadMoreButton.addEventListener("click", () => {
  visibleActivities += PAGE_SIZE;
  renderActivities();
});

// ======================================
// FILTER BUTTONS
// ======================================

filterButtons.forEach(button => {
  button.addEventListener("click", () => {
    filterButtons.forEach(filter => {
      filter.classList.remove("active");
    });

    button.classList.add("active");

    currentFilter = button.dataset.filter;
    visibleActivities = PAGE_SIZE;

    renderActivities();
  });
});

// ======================================
// HTML SECURITY
// ======================================

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

// ======================================
// LOG OUT
// ======================================

logoutButton.addEventListener("click", async () => {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("Logout error:", error);

    activityMessage.textContent =
      "[ LOGOUT ERROR ]";

    return;
  }

  window.location.href = "login.html";
});

// ======================================
// INITIALIZE
// ======================================

async function initializeActivity() {
  try {
    const currentUser = await verifyUser();

    if (!currentUser) return;

    await loadActivities(currentUser.id);

  } catch (error) {
    console.error("Activity initialization error:", error);

    activityMessage.textContent =
      "[ SYSTEM ERROR: " + error.message + " ]";
  }
}

initializeActivity();

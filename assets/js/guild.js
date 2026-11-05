
import { supabase } from "./config.js";

const rankingContainer = document.getElementById("rankingContainer");
const guildMessage = document.getElementById("guildMessage");
const activityContainer = document.getElementById("guildActivity");
const logoutButton = document.getElementById("logoutButton");

const membersElement = document.getElementById("guildMembers");
const xpElement = document.getElementById("guildXP");
const questsElement = document.getElementById("guildQuests");
const levelElement = document.getElementById("guildLevel");

async function loadGuild() {
  try {
    // VERIFY AUTHENTICATED USER
    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError) throw authError;

    const currentUser = authData.user;

    if (!currentUser) {
      window.location.href = "login.html";
      return;
    }

    // VERIFY AUTHORIZATION
    const { data: authorized, error: authorizationError } =
      await supabase.rpc("is_authorized");

    if (authorizationError) throw authorizationError;

    if (!authorized) {
      await supabase.auth.signOut();
      window.location.href = "login.html";
      return;
    }

    // LOAD GUILD RANKING
    const { data: hunters, error: rankingError } =
      await supabase.rpc("get_guild_ranking");

    if (rankingError) throw rankingError;

  renderRanking(hunters || []);

await loadGuildActivity();

guildMessage.textContent = "[ GUILD DATA SYNCHRONIZED ]";

  } catch (error) {
    console.error("Guild error:", error);

    rankingContainer.innerHTML =
      '<p class="muted">Unable to load guild ranking.</p>';

    guildMessage.textContent =
      "[ SYSTEM ERROR: " + error.message + " ]";
  }
}

function renderRanking(hunters) {
  if (!hunters.length) {
    rankingContainer.innerHTML =
      '<p class="muted">No hunters found in this guild.</p>';
    return;
  }

  // CALCULATE GUILD STATISTICS
  const totalXP = hunters.reduce(
    (sum, hunter) => sum + Number(hunter.xp || 0),
    0
  );

  const totalQuests = hunters.reduce(
    (sum, hunter) => sum + Number(hunter.completed_quests || 0),
    0
  );

  const averageLevel = hunters.reduce(
    (sum, hunter) => sum + Number(hunter.level || 0),
    0
  ) / hunters.length;

  membersElement.textContent = hunters.length;
  xpElement.textContent = totalXP.toLocaleString() + " XP";
  questsElement.textContent = totalQuests;
  levelElement.textContent = averageLevel.toFixed(1);

  // RENDER HUNTER RANKING
  rankingContainer.innerHTML = hunters.map((hunter, index) => `
    <div class="hunter-row">
      <div class="hunter-position">#${index + 1}</div>

      <div class="hunter-info">
        <div class="hunter-name">
          ${escapeHTML(hunter.display_name || "Unknown Hunter")}
        </div>
        <div class="hunter-details">
          ${escapeHTML(hunter.hunter_rank || "E")} RANK
          · LV. ${Number(hunter.level || 1)}
        </div>
      </div>

      <div class="hunter-progress">
        <strong>${Number(hunter.xp || 0).toLocaleString()} XP</strong>
        <span>${Number(hunter.completed_quests || 0)} quests</span>
      </div>

      <div class="hunter-streak">
        🔥 ${Number(hunter.current_streak || 0)}
      </div>
    </div>
  `).join("");
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

async function loadGuildActivity() {
  try {
    const { data, error } = await supabase.rpc(
      "get_guild_activity",
      { p_limit: 20 }
    );

    if (error) throw error;

    if (!data || data.length === 0) {
      activityContainer.innerHTML =
        '<p class="muted">No guild activity yet. Complete a quest to get started!</p>';
      return;
    }

    activityContainer.innerHTML = data.map(activity => {
      const date = new Date(activity.created_at);

      const formattedDate = date.toLocaleString("en-US", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      });

      return `
        <div class="activity-row">
          <div class="activity-icon">⚔</div>

          <div class="activity-info">
            <strong>${escapeHTML(activity.display_name || "Unknown Hunter")}</strong>
            <p>${escapeHTML(activity.description || activity.activity_type || "Guild activity")}</p>
            <span>${formattedDate}</span>
          </div>

          <div class="activity-xp">
            +${Number(activity.xp_earned || 0)} XP
          </div>
        </div>
      `;
    }).join("");

  } catch (error) {
    console.error("Guild activity error:", error);

    activityContainer.innerHTML =
      '<p class="muted">Unable to load guild activity.</p>';
  }
}

// LOG OUT
logoutButton.addEventListener("click", async () => {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("Logout error:", error);
    guildMessage.textContent = "[ LOGOUT ERROR ]";
    return;
  }

  window.location.href = "login.html";
});

// INITIALIZE
loadGuild();


import { supabase } from "./config.js";

const rankingContainer = document.getElementById("rankingContainer");
const guildMessage = document.getElementById("guildMessage");
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

/* HUNTER RANKING */

.hunter-row {
  display: grid;
  grid-template-columns: 55px 1fr 130px 65px;
  align-items: center;
  gap: 15px;
  padding: 18px 12px;
  border-bottom: 1px solid var(--border);
  transition: background 0.2s ease;
}

.hunter-row:hover {
  background: var(--surface-light);
}

.hunter-position {
  color: var(--blue-light);
  font-size: 1.2rem;
  font-weight: 800;
}

.hunter-name {
  color: var(--text);
  font-weight: 700;
  margin-bottom: 6px;
}

.hunter-details {
  color: var(--muted);
  font-size: 0.7rem;
  letter-spacing: 1px;
}

.hunter-progress {
  display: flex;
  flex-direction: column;
  gap: 5px;
  text-align: right;
}

.hunter-progress strong {
  color: var(--blue-light);
  font-size: 0.9rem;
}

.hunter-progress span {
  color: var(--muted);
  font-size: 0.7rem;
}

.hunter-streak {
  text-align: right;
  font-size: 0.9rem;
}

@media (max-width: 600px) {
  .hunter-row {
    grid-template-columns: 35px 1fr 75px;
    gap: 8px;
    padding: 15px 5px;
  }

  .hunter-progress {
    font-size: 0.8rem;
  }

  .hunter-streak {
    display: none;
  }
}

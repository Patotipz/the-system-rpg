
import { supabase } from "./config.js";

const message = document.getElementById("dashboardMessage");
const statsList = document.getElementById("statsList");
const questsList = document.getElementById("questsList");

const avatarMap = {
  "hunter-01": "⚔️",
  "hunter-02": "🛡️",
  "hunter-03": "🔥",
  "hunter-04": "🌑",
  "hunter-05": "⚡",
  "hunter-06": "🐉"
};

async function initializeDashboard() {
  try {
    // 1. Verify user session
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) {
      window.location.href = "login.html";
      return;
    }

    // 2. Verify authorization
    const { data: authorized, error: authError } =
      await supabase.rpc("is_authorized");

    if (authError || authorized !== true) {
      await supabase.auth.signOut();
      window.location.href = "login.html";
      return;
    }
// 3. Refresh streak before loading profile
const { data: refreshedStreak, error: streakError } =
  await supabase.rpc("refresh_streak");

if (streakError) throw streakError;
    // 3. Load Hunter profile
    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("display_name, avatar_id, rank, level, xp, coins, current_streak, longest_streak")
        .eq("user_id", user.id)
        .single();

    if (profileError) throw profileError;

    document.getElementById("hunterName").textContent =
      profile.display_name;

    document.getElementById("hunterAvatar").textContent =
      avatarMap[profile.avatar_id] || "⚔️";

    document.getElementById("hunterRank").textContent =
      `RANK ${profile.rank}`;

    document.getElementById("hunterLevel").textContent =
      `LV. ${profile.level}`;

    document.getElementById("hunterCoins").textContent =
      profile.coins ?? 0;

  document.getElementById("xpText").textContent =
  `${profile.xp} XP`;

const currentLevelXp =
  100 * (profile.level - 1) * profile.level / 2;

const nextLevelXp =
  100 * profile.level * (profile.level + 1) / 2;

const xpIntoLevel = Math.max(
  0,
  profile.xp - currentLevelXp
);

const xpNeededForLevel =
  nextLevelXp - currentLevelXp;

const xpProgress = Math.min(
  100,
  (xpIntoLevel / xpNeededForLevel) * 100
);

document.getElementById("xpBar").style.width =
  `${xpProgress}%`;

document.getElementById("xpNext").textContent =
  `${Math.max(0, nextLevelXp - profile.xp)} XP TO NEXT LEVEL · ${Math.round(xpProgress)}%`;
document.getElementById("currentStreak").textContent =
  profile.current_streak ?? 0;

document.getElementById("longestStreak").textContent =
  profile.longest_streak ?? 0;
    // 4. Load Hunter attributes
    const { data: stats, error: statsError } =
      await supabase
        .from("player_stats")
        .select("hp, energy, strength, vitality, agility, intelligence, perception, sense")
        .eq("user_id", user.id)
        .single();

    if (statsError) throw statsError;

    document.getElementById("hunterHP").textContent = stats.hp;
    document.getElementById("hunterEnergy").textContent = stats.energy;

    const attributes = [
      ["STR", stats.strength],
      ["VIT", stats.vitality],
      ["AGI", stats.agility],
      ["INT", stats.intelligence],
      ["PER", stats.perception],
      ["SEN", stats.sense]
    ];

    statsList.replaceChildren();

    attributes.forEach(([name, value]) => {
      const row = document.createElement("div");
      row.className = "stat-row";

      const label = document.createElement("span");
      label.textContent = name;

      const amount = document.createElement("strong");
      amount.textContent = value;

      row.append(label, amount);
      statsList.appendChild(row);
    });

    // 5. Load player's quests
    const { data: quests, error: questsError } =
      await supabase
        .from("user_quests")
        .select(`
          id,
          status,
          assigned_at,
          quests (
            title,
            description,
            quest_type,
            difficulty,
            xp_reward,
            coin_reward
          )
        `)
        .eq("user_id", user.id)
        .neq("status", "claimed")
        .order("assigned_at", { ascending: false })
        .limit(5);

    if (questsError) throw questsError;

    questsList.replaceChildren();

    if (!quests || quests.length === 0) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "No active quests. Your next mission awaits.";
      questsList.appendChild(empty);
    } else {
      quests.forEach((item) => {
        if (!item.quests) return;

        const card = document.createElement("div");
        card.className = "quest-card";

        const title = document.createElement("h3");
        title.textContent = item.quests.title;

        const description = document.createElement("p");
        description.textContent = item.quests.description || "";

        const details = document.createElement("p");
        details.textContent =
          `${item.status.toUpperCase()} · ${item.quests.difficulty} · ${item.quests.xp_reward} XP · ${item.quests.coin_reward} COINS`;

        card.append(title, description, details);
        questsList.appendChild(card);
      });
    }

    message.textContent = "SYSTEM ONLINE · HUNTER DATA LOADED";

  } catch (error) {
    console.error("Dashboard error:", error);
    message.textContent = error.message;
  }
}

// Logout
document.getElementById("logoutButton").addEventListener("click", async () => {
  const { error } = await supabase.auth.signOut();

  if (error) {
    message.textContent = error.message;
    return;
  }

  window.location.href = "login.html";
});

initializeDashboard();

import { supabase } from "./config.js";

const message = document.getElementById("dashboardMessage");
const statsList = document.getElementById("statsList");
const questsList = document.getElementById("questsList");
const activityList = document.getElementById("activityList");

const avatarMap = {
  "hunter-01": "⚔️",
  "hunter-02": "🛡️",
  "hunter-03": "🔥",
  "hunter-04": "🌑",
  "hunter-05": "⚡",
  "hunter-06": "🐉"
};

// MEXICO CITY DATE
function getMexicoDateKey(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.map(part => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

async function initializeDashboard() {
  try {
    // 1. VERIFY USER SESSION
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) {
      window.location.href = "login.html";
      return;
    }

    // 2. VERIFY AUTHORIZATION
    const { data: authorized, error: authError } =
      await supabase.rpc("is_authorized");

    if (authError || authorized !== true) {
      await supabase.auth.signOut();
      window.location.href = "login.html";
      return;
    }

    // 3. REFRESH STREAK
    const { error: streakError } =
      await supabase.rpc("refresh_streak");

    if (streakError) throw streakError;

    // 4. LOAD HUNTER PROFILE
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

    // XP PROGRESS
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

// HUNTER RANK PROGRESSION
const rankRequirements = {
  E: { next: "D", currentXP: 0, nextXP: 1000, nextLevel: 5 },
  D: { next: "C", currentXP: 1000, nextXP: 4500, nextLevel: 10 },
  C: { next: "B", currentXP: 4500, nextXP: 19000, nextLevel: 20 },
  B: { next: "A", currentXP: 19000, nextXP: 43500, nextLevel: 30 },
  A: { next: "S", currentXP: 43500, nextXP: 122500, nextLevel: 50 },
  S: null
};

const currentRank = profile.rank;
const rankData = rankRequirements[currentRank];

document.getElementById("currentRankDisplay").textContent = currentRank;

if (rankData) {
  const rankProgress = Math.min(
    100,
    Math.max(
      0,
      ((profile.xp - rankData.currentXP) /
        (rankData.nextXP - rankData.currentXP)) * 100
    )
  );

  const remainingXP = Math.max(0, rankData.nextXP - profile.xp);

  document.getElementById("nextRankDisplay").textContent = rankData.next;
  document.getElementById("nextRankLevel").textContent =
    `REACH LEVEL ${rankData.nextLevel}`;

  document.getElementById("rankXpText").textContent =
    `${profile.xp.toLocaleString()} / ${rankData.nextXP.toLocaleString()} XP`;

  document.getElementById("rankProgressBar").style.width =
    `${rankProgress}%`;

  document.getElementById("rankProgressStatus").textContent =
    `${remainingXP.toLocaleString()} XP TO NEXT RANK`;
} else {
  document.getElementById("nextRankDisplay").textContent = "MAX";
  document.getElementById("nextRankLevel").textContent = "HIGHEST RANK";
  document.getElementById("rankXpText").textContent = "MAXIMUM RANK";
  document.getElementById("rankProgressBar").style.width = "100%";
  document.getElementById("rankProgressStatus").textContent =
    "YOU HAVE REACHED THE HIGHEST HUNTER RANK";
}

    // STREAKS
    document.getElementById("currentStreak").textContent =
      profile.current_streak ?? 0;

    document.getElementById("longestStreak").textContent =
      profile.longest_streak ?? 0;

    // 5. LOAD HUNTER ATTRIBUTES

// LOAD HP AND ENERGY
const { data: stats, error: statsError } =
  await supabase
    .from("player_stats")
    .select("hp, energy")
    .eq("user_id", user.id)
    .single();

if (statsError) throw statsError;

document.getElementById("hunterHP").textContent =
  stats.hp;

document.getElementById("hunterEnergy").textContent =
  stats.energy;

// LOAD BASE STATS + EQUIPMENT BONUSES
const { data: hunterStats, error: hunterStatsError } =
  await supabase.rpc("get_hunter_stats");

if (hunterStatsError) throw hunterStatsError;

const attributes = [
  { key: "str", label: "STR" },
  { key: "vit", label: "VIT" },
  { key: "agi", label: "AGI" },
  { key: "int", label: "INT" },
  { key: "per", label: "PER" },
  { key: "sen", label: "SEN" }
];

statsList.replaceChildren();

attributes.forEach(({ key, label }) => {
  const base = hunterStats.base_stats[key] ?? 0;
  const bonus = hunterStats.equipment_bonus[key] ?? 0;
  const total = hunterStats.total_stats[key] ?? 0;

  const row = document.createElement("div");
  row.className = "stat-row";

  const name = document.createElement("span");
  name.className = "stat-label";
  name.textContent = label;

  const amount = document.createElement("strong");
  amount.className = "stat-total";
  amount.textContent = total;

  const breakdown = document.createElement("div");
  breakdown.className = "stat-breakdown";

  const baseValue = document.createElement("span");
  baseValue.textContent = `BASE ${base}`;

  const bonusValue = document.createElement("span");
  bonusValue.textContent = `EQUIPMENT +${bonus}`;

  breakdown.append(baseValue, bonusValue);
  row.append(name, amount, breakdown);

  statsList.appendChild(row);
});
    // 6. LOAD PLAYER QUESTS
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
      empty.textContent =
        "No active quests. Your next mission awaits.";

      questsList.appendChild(empty);

    } else {
      quests.forEach((item) => {
        if (!item.quests) return;

        const card = document.createElement("div");
        card.className = "quest-card";

        const title = document.createElement("h3");
        title.textContent = item.quests.title;

        const description = document.createElement("p");
        description.textContent =
          item.quests.description || "";

        const details = document.createElement("p");
        details.textContent =
          `${item.status.toUpperCase()} · ${item.quests.difficulty} · ${item.quests.xp_reward} XP · ${item.quests.coin_reward} COINS`;

        card.append(title, description, details);
        questsList.appendChild(card);
      });
    }

    // 7. LOAD COMPLETED QUEST COUNT
    const { count: completedCount, error: completedError } =
      await supabase
        .from("user_quests")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .in("status", ["completed", "claimed"]);

    if (completedError) throw completedError;

    document.getElementById("completedQuestCount").textContent =
      completedCount ?? 0;

    // 8. LOAD DAILY AND WEEKLY QUEST COUNTS
    const now = new Date();
    const todayKey = getMexicoDateKey(now);

    // GET MONDAY OF CURRENT WEEK
    const today = new Date(`${todayKey}T12:00:00`);
    const dayOfWeek = today.getDay();

    const daysFromMonday = (dayOfWeek + 6) % 7;

    today.setDate(today.getDate() - daysFromMonday);

    const weekStartKey = getMexicoDateKey(today);

    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const weekEndKey = getMexicoDateKey(weekEnd);

    // LOAD COMPLETED QUESTS
    const {
      data: completedQuests,
      error: dailyWeeklyError
    } = await supabase
      .from("user_quests")
      .select(`
        completed_at,
        quests (
          quest_type
        )
      `)
      .eq("user_id", user.id)
      .in("status", ["completed", "claimed"])
      .not("completed_at", "is", null);

    if (dailyWeeklyError) throw dailyWeeklyError;

    let dailyCount = 0;
    let weeklyCount = 0;

    completedQuests.forEach(item => {
      const completedDate = getMexicoDateKey(
        new Date(item.completed_at)
      );

      if (completedDate === todayKey) {
        dailyCount++;
      }

      if (
        completedDate >= weekStartKey &&
        completedDate < weekEndKey
      ) {
        weeklyCount++;
      }
    });

    document.getElementById("dailyQuestCount").textContent =
      dailyCount;

    document.getElementById("weeklyQuestCount").textContent =
      weeklyCount;
// DAILY GOAL PROGRESS
const dailyGoal = 4;

const dailyProgress = Math.min(
  100,
  (dailyCount / dailyGoal) * 100
);

document.getElementById("dailyGoalText").textContent =
  `${dailyCount} / ${dailyGoal}`;

document.getElementById("dailyGoalBar").style.width =
  `${dailyProgress}%`;

document.getElementById("dailyGoalStatus").textContent =
  dailyCount >= dailyGoal
    ? "DAILY GOAL COMPLETED!"
    : `${Math.round(dailyProgress)}% COMPLETE · ${dailyGoal - dailyCount} MISSIONS REMAINING`;

// WEEKLY GOAL PROGRESS
const weeklyGoal = 20;

const weeklyProgress = Math.min(
  100,
  (weeklyCount / weeklyGoal) * 100
);

document.getElementById("weeklyGoalText").textContent =
  `${weeklyCount} / ${weeklyGoal}`;

document.getElementById("weeklyGoalBar").style.width =
  `${weeklyProgress}%`;

document.getElementById("weeklyGoalStatus").textContent =
  weeklyCount >= weeklyGoal
    ? "WEEKLY GOAL COMPLETED!"
    : `${Math.round(weeklyProgress)}% COMPLETE · ${weeklyGoal - weeklyCount} MISSIONS REMAINING`;
    // 9. LOAD RECENT ACTIVITY LOG
if (activityList) {
  activityList.replaceChildren();

  const { data: activities, error: activityError } =
    await supabase
      .from("activity_log")
      .select("id, activity_type, description, xp_earned, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(7);

  if (activityError) {
    console.error("Activity log error:", activityError);

    const errorMessage = document.createElement("p");
    errorMessage.className = "muted";
    errorMessage.textContent = "Unable to load recent activity.";

    activityList.appendChild(errorMessage);
  } else if (!activities || activities.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "muted";
    emptyMessage.textContent = "No recent activity.";

    activityList.appendChild(emptyMessage);
  } else {
    activities.forEach((activity) => {
      const card = document.createElement("div");
      card.className = "activity-card";

      const info = document.createElement("div");
      info.className = "activity-info";

      const title = document.createElement("strong");
      title.className = "activity-title";

      title.textContent =
        activity.activity_type === "quest_completed"
          ? "QUEST COMPLETED"
          : activity.activity_type.replaceAll("_", " ").toUpperCase();

      const description = document.createElement("p");
      description.className = "activity-description";
      description.textContent = activity.description || "";

      const date = document.createElement("span");
      date.className = "activity-date";
      date.textContent = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Mexico_City",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }).format(new Date(activity.created_at));

      const xp = document.createElement("strong");
      xp.className = "activity-xp";
      xp.textContent = `+${activity.xp_earned ?? 0} XP`;

      info.append(title, description, date);
      card.append(info, xp);

      activityList.appendChild(card);
    });
  }
}
    // 9. SYSTEM MESSAGE
    message.textContent =
      "SYSTEM ONLINE · HUNTER DATA LOADED";

  } catch (error) {
    console.error("Dashboard error:", error);
    message.textContent = error.message;
  }
}

// LOGOUT
document.getElementById("logoutButton").addEventListener("click", async () => {
  const { error } = await supabase.auth.signOut();

  if (error) {
    message.textContent = error.message;
    return;
  }

  window.location.href = "login.html";
});

initializeDashboard();

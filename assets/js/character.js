
import { supabase } from "./config.js";

const form = document.getElementById("characterForm");
const hunterName = document.getElementById("hunterName");
const avatarGrid = document.getElementById("avatarGrid");
const saveButton = document.getElementById("saveCharacter");
const message = document.getElementById("characterMessage");

let selectedAvatar = "hunter-01";
let currentUser = null;

// Initialize character creation
async function initializeCharacter() {
  try {
    const {
      data: { user },
      error
    } = await supabase.auth.getUser();

    if (error || !user) {
      window.location.href = "login.html";
      return;
    }

    const { data: authorized, error: authError } =
      await supabase.rpc("is_authorized");

    if (authError || authorized !== true) {
      await supabase.auth.signOut();
      window.location.href = "login.html";
      return;
    }

    currentUser = user;

    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("display_name, avatar_id")
        .eq("user_id", user.id)
        .single();

    if (profileError) throw profileError;

    hunterName.value = profile.display_name || "";
    selectedAvatar = profile.avatar_id || "hunter-01";

    setupAvatarSelection();

  } catch (error) {
    console.error("CHARACTER INITIALIZATION ERROR:", error);
    message.textContent = error.message;
  }
}

// Configure individual avatar buttons
function setupAvatarSelection() {
  const avatars = document.querySelectorAll(".avatar");

  avatars.forEach((avatar) => {
    avatar.addEventListener("click", () => {
      selectedAvatar = avatar.dataset.avatar;

      updateAvatarSelection();

      console.log("SELECTED AVATAR:", selectedAvatar);
    });
  });

  updateAvatarSelection();
}

// Update visual selection
function updateAvatarSelection() {
  document.querySelectorAll(".avatar").forEach((avatar) => {
    const isSelected = avatar.dataset.avatar === selectedAvatar;

    avatar.classList.toggle("selected", isSelected);
    avatar.setAttribute("aria-pressed", String(isSelected));
  });
}

// Save character
form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentUser) return;

  const name = hunterName.value.trim();

  if (name.length < 3) {
    message.textContent = "Hunter name must have at least 3 characters.";
    return;
  }

  saveButton.disabled = true;
  saveButton.textContent = "SAVING...";
  message.textContent = "";

  try {
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: name,
        avatar_id: selectedAvatar,
        character_created: true
      })
      .eq("user_id", currentUser.id);

    if (error) throw error;

    message.textContent = "HUNTER CONFIRMED.";

    window.location.href = "dashboard.html";

  } catch (error) {
    console.error("CHARACTER SAVE ERROR:", error);
    message.textContent = error.message;

    saveButton.disabled = false;
    saveButton.textContent = "CONFIRM HUNTER";
  }
});

initializeCharacter();

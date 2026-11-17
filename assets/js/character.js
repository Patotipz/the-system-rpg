
import { supabase } from "./config.js";

const form = document.getElementById("characterForm");
const hunterName = document.getElementById("hunterName");
const avatarGrid = document.getElementById("avatarGrid");
const saveButton = document.getElementById("saveCharacter");
const message = document.getElementById("characterMessage");

let selectedAvatar = "hunter-01";
let currentUser = null;

async function initializeCharacter() {
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

  if (profileError) {
    message.textContent = profileError.message;
    return;
  }

  hunterName.value = profile.display_name || "";
  selectedAvatar = profile.avatar_id || "hunter-01";

  updateAvatarSelection();
}

avatarGrid.addEventListener("click", (event) => {
  const avatar = event.target.closest("[data-avatar]");

  if (!avatar) return;

  selectedAvatar = avatar.dataset.avatar;
  updateAvatarSelection();
});

function updateAvatarSelection() {
  document.querySelectorAll(".avatar").forEach((avatar) => {
    avatar.classList.toggle(
      "selected",
      avatar.dataset.avatar === selectedAvatar
    );
  });
}

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

    window.location.href = "dashboard.html";

  } catch (error) {
    console.error(error);
    message.textContent = error.message;
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "CONFIRM HUNTER";
  }
});

initializeCharacter();

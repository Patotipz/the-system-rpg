
import { supabase } from "./config.js";

const form = document.getElementById("authForm");
const loginTab = document.getElementById("loginTab");
const registerTab = document.getElementById("registerTab");
const inviteGroup = document.getElementById("inviteGroup");
const inviteCode = document.getElementById("inviteCode");
const submitButton = document.getElementById("submitButton");
const message = document.getElementById("message");

let mode = "login";

function setMode(nextMode) {
  mode = nextMode;

  loginTab.classList.toggle("active", mode === "login");
  registerTab.classList.toggle("active", mode === "register");

  // El código también se puede introducir al iniciar sesión,
  // por ejemplo, después de confirmar el correo.
  inviteGroup.hidden = false;
  inviteCode.required = mode === "register";

  submitButton.textContent =
    mode === "login" ? "ENTER THE SYSTEM" : "CREATE HUNTER";

  message.textContent = "";
}

loginTab.addEventListener("click", () => setMode("login"));
registerTab.addEventListener("click", () => setMode("register"));

async function redeemCode(code) {
  const { data, error } = await supabase.rpc(
    "redeem_access_code",
    { p_code: code }
  );

  if (error) throw error;

  return data === true;
}

async function checkAuthorization() {
  const { data, error } = await supabase.rpc("is_authorized");

  if (error) throw error;

  return data === true;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const code = inviteCode.value.trim();

  submitButton.disabled = true;
  submitButton.textContent = "CONNECTING...";
  message.textContent = "";

  try {
    if (mode === "register") {
      if (!code) {
        throw new Error("An invitation code is required.");
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo:
            window.location.origin + window.location.pathname
        }
      });

      if (error) throw error;

      if (!data.session) {
        message.textContent =
          "Account created. Confirm your email, then return to LOGIN and enter your invitation code.";
        return;
      }

      const authorized = await redeemCode(code);

      if (!authorized) {
        message.textContent =
          "Your account was created, but the invitation code is invalid or already used.";
        return;
      }

      message.textContent =
        "HUNTER AUTHORIZED. Your character awaits.";
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    let authorized = await checkAuthorization();

    if (!authorized && code) {
      authorized = await redeemCode(code);
    }

    if (!authorized) {
      await supabase.auth.signOut();

      message.textContent =
        "Access denied. Enter a valid invitation code.";
      return;
    }

const { data: profile, error: profileError } =
  await supabase
    .from("profiles")
    .select("display_name, avatar_id")
    .eq("user_id", (await supabase.auth.getUser()).data.user.id)
    .single();

if (profileError) throw profileError;

const hasCharacter =
  profile.display_name &&
  profile.display_name.trim().length >= 3;

window.location.href = hasCharacter
  ? "dashboard.html"
  : "character.html";
  } catch (error) {
    console.error(error);
    message.textContent = error.message;
  } finally {
    submitButton.disabled = false;
    submitButton.textContent =
      mode === "login" ? "ENTER THE SYSTEM" : "CREATE HUNTER";
  }
});

setMode("login");

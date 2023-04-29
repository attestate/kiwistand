// @format
import themes from "../../themes.mjs";

function applyTheme(theme) {
  const hnName = document.querySelector(".hnname a");
  hnName.innerHTML = ` ${theme.name} News`;
  const hnEmoji = document.querySelector(".hnname span");
  hnEmoji.innerHTML = theme.emoji;
  document.getElementById("hnmain").querySelector("td").style.backgroundColor =
    theme.color;
}

function changeTheme() {
  const randomIndex = Math.floor(Math.random() * themes.length);
  const newTheme = themes[randomIndex];
  applyTheme(newTheme);
  saveTheme(newTheme);
}

function saveTheme(theme) {
  document.cookie = `currentTheme=${theme.id};path=/;max-age=2592000`;
}

export function loadTheme() {
  const cookies = document.cookie.split("; ");
  const savedThemeCookie = cookies.find((cookie) =>
    cookie.startsWith("currentTheme=")
  );

  if (!savedThemeCookie) {
    applyTheme({ id: 14, emoji: "🥝", name: "Kiwi", color: "limegreen" });
    return;
  }

  const themeId = parseInt(savedThemeCookie.split("=")[1], 10);
  const savedTheme = themes.find((theme) => theme.id === themeId);

  if (!savedTheme) {
    applyTheme({ id: 14, emoji: "🥝", name: "Kiwi", color: "limegreen" });
    return;
  }

  applyTheme(savedTheme);
}

document.querySelector(".hnname span").addEventListener("click", (e) => {
  e.preventDefault();
  changeTheme();
});

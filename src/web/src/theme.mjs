// @format
import themes from "../../themes.mjs";
import { getCookie, setCookie } from "./session.mjs";

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
  setCookie("currentTheme", theme.id, 2592000);
}

export function loadTheme() {
  const themeId = parseInt(getCookie("currentTheme"), 10);

  if (!themeId) {
    applyTheme({ id: 14, emoji: "🥝", name: "Kiwi", color: "limegreen" });
    return;
  }

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

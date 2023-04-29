// @format
const themes = [
  { emoji: "🍎", name: "Apple", color: "#ff0800" },
  { emoji: "🍏", name: "Green Apple", color: "#7cb342" },
  { emoji: "🍊", name: "Tangerine", color: "#ff9800" },
  { emoji: "🍋", name: "Lemon", color: "#ffeb3b" },
  { emoji: "🍌", name: "Banana", color: "#ffeb3b" },
  { emoji: "🍉", name: "Watermelon", color: "#f44336" },
  { emoji: "🍇", name: "Grapes", color: "#673ab7" },
  { emoji: "🍓", name: "Strawberry", color: "#e91e63" },
  { emoji: "🍈", name: "Melon", color: "#8bc34a" },
  { emoji: "🍒", name: "Cherry", color: "#d32f2f" },
  { emoji: "🍑", name: "Peach", color: "#ff5722" },
  { emoji: "🍍", name: "Pineapple", color: "#ffeb3b" },
  { emoji: "🥭", name: "Mango", color: "#ff9800" },
  { emoji: "🥥", name: "Coconut", color: "#795548" },
  { emoji: "🥝", name: "Kiwi", color: "limegreen" },
  { emoji: "🍅", name: "Tomato", color: "#ff6347" },
  { emoji: "🍆", name: "Eggplant", color: "#9c27b0" },
  { emoji: "🥑", name: "Avocado", color: "#4caf50" },
  { emoji: "🥦", name: "Broccoli", color: "#4caf50" },
  { emoji: "🥒", name: "Cucumber", color: "#8bc34a" },
  { emoji: "🌶️", name: "Hot Pepper", color: "#f44336" },
  { emoji: "🌽", name: "Corn", color: "#ffeb3b" },
  { emoji: "🥕", name: "Carrot", color: "#ff9800" },
  { emoji: "🥔", name: "Potato", color: "#9e9e9e" },
  { emoji: "🍠", name: "Sweet Potato", color: "#ff5722" },
  { emoji: "🥐", name: "Croissant", color: "#795548" },
  { emoji: "🥖", name: "Baguette", color: "#795548" },
  { emoji: "🥨", name: "Pretzel", color: "#795548" },
  { emoji: "🥯", name: "Bagel", color: "#795548" },
  { emoji: "🥞", name: "Pancakes", color: "#795548" },
  {
    emoji: "🥀",
    name: "Wilted Dreams",
    color: "#9c27b0",
  },
  {
    emoji: "🎭",
    name: "Forgotten Performance",
    color: "#3f51b5",
  },
  {
    emoji: "🚶",
    name: "Lonely Stroll",
    color: "#607d8b",
  },
  {
    emoji: "🔕",
    name: "Silenced Laughter",
    color: "#9e9e9e",
  },
  {
    emoji: "🪓",
    name: "Lumberjack",
    color: "#795548",
  },
  {
    emoji: "🦩",
    name: "Flamingo Tango",
    color: "#e91e63",
  },
  {
    emoji: "🪐",
    name: "Planet of Baguettes",
    color: "#795548",
  },
  {
    emoji: "🧊",
    name: "Ice Cube Comedy",
    color: "#00bcd4",
  },
  {
    emoji: "🥤",
    name: "Soda Geyser",
    color: "#2196f3",
  },
];

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
  localStorage.setItem("currentTheme", JSON.stringify(newTheme));
}

export function loadTheme() {
  const savedTheme = localStorage.getItem("currentTheme");
  if (savedTheme) {
    applyTheme(JSON.parse(savedTheme));
  }
}

document.querySelector(".hnname span").addEventListener("click", (e) => {
  e.preventDefault();
  changeTheme();
});

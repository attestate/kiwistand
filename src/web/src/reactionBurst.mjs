// A reaction notification (views/activity.mjs) links to the comment with the
// emoji: /stories/…?index=0x…&reaction=🥝#0x<comment>. The browser scrolls to
// the comment and :target highlights it, like a comment notification. Then,
// like Telegram (and the iOS app's ReactionBurst in StoryDetailView.swift),
// the comment's reaction chip bounces, the emoji flies up from it with a few
// small copies spraying out, and the phone gives a success haptic. With
// prefers-reduced-motion only the highlight and the haptic remain. The styles
// are .kn-reaction-* in news.css.
import { triggerHaptic } from "./haptics.js";

// The small copies: angle in degrees (0 = up) and distance in px, the iOS
// app's numbers.
const SPARKS = [
  [-60, 34],
  [-25, 44],
  [20, 42],
  [55, 36],
  [85, 28],
];
// The iOS app pops the emoji 0.45s after it scrolled to the comment.
const DELAY = 450;
const DURATION = 850;

// Reads the emoji and removes it from the address, so a reload or a shared
// link doesn't replay the burst.
function takeReaction() {
  const url = new URL(window.location.href);
  const emoji = url.searchParams.get("reaction");
  if (emoji === null) return null;
  url.searchParams.delete("reaction");
  try {
    history.replaceState(
      history.state,
      "",
      url.pathname + url.search + url.hash,
    );
  } catch (err) {}
  return emoji;
}

function inView(element) {
  const { top, bottom } = element.getBoundingClientRect();
  return top >= 0 && bottom <= window.innerHeight;
}

function burst(origin, emoji) {
  const { left, top, width, height } = origin.getBoundingClientRect();
  const layer = document.createElement("span");
  layer.className = "kn-reaction-burst";
  layer.setAttribute("aria-hidden", "true");
  layer.style.left = `${left + width / 2}px`;
  layer.style.top = `${top + height / 2}px`;
  for (const [angle, distance] of SPARKS) {
    const spark = document.createElement("span");
    spark.className = "kn-reaction-spark";
    spark.textContent = emoji;
    const radians = (angle * Math.PI) / 180;
    spark.style.setProperty("--x", `${Math.sin(radians) * distance}px`);
    spark.style.setProperty("--y", `${-Math.cos(radians) * distance}px`);
    layer.appendChild(spark);
  }
  const main = document.createElement("span");
  main.className = "kn-reaction-fly";
  main.textContent = emoji;
  layer.appendChild(main);
  main.addEventListener("animationend", () => layer.remove());
  document.body.appendChild(layer);
  // NOTE: In case the animation never ends (a background tab).
  setTimeout(() => layer.remove(), DURATION * 4);
}

function pop(comment, emoji) {
  const reduce = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  triggerHaptic("success");
  if (reduce) return;

  const chip = [
    ...comment.querySelectorAll(".kn-reactions button[data-emoji]"),
  ].find((button) => button.dataset.emoji === emoji);
  const origin =
    chip?.querySelector("span") ||
    comment.querySelector(".kn-reactions") ||
    comment;
  if (chip) {
    chip.classList.add("kn-reaction-pop");
    chip.addEventListener(
      "animationend",
      () => chip.classList.remove("kn-reaction-pop"),
      { once: true },
    );
  }
  burst(origin, emoji);
}

export default function celebrateReaction() {
  const emoji = takeReaction();
  if (!emoji) return;
  const hash = window.location.hash.slice(1);
  if (!hash.startsWith("0x")) return;
  const comment = document.getElementById(hash);
  if (!comment) return;

  setTimeout(() => {
    // NOTE: Normally the browser already scrolled to the comment (#0x…);
    // when it didn't (e.g. a restored scroll position), scroll first.
    const target = comment.querySelector(".kn-reactions") || comment;
    if (inView(target)) return pop(comment, emoji);
    comment.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => pop(comment, emoji), DELAY);
  }, DELAY);
}

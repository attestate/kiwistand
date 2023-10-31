import { readFile, writeFile } from "fs/promises";
import satori from "satori";
import htm from "htm";

function h(type, props, ...children) {
  return { type, props: { ...props, children: children.pop() } };
}

export async function generate(index, title) {
  const fontData = await readFile("./Arial.ttf");
  const arial = {
    name: "Arial",
    data: fontData,
    weight: 400,
    style: "normal",
  };
  const html = htm.bind(h);
  const content = html`<div style=${{ color: "black" }}>👋 ${title}</div>`;
  const svgData = await satori(content, {
    width: 1200,
    height: 630,
    fonts: [arial],
  });

  // Write the SVG data to a file in the ./public folder
  await writeFile(`./public/${index}.svg`, svgData);
}

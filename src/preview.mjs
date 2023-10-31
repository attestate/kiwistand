import { readFile, writeFile, access } from "fs/promises";
import { resolve } from "path";

import satori from "satori";
import htm from "htm";

const html = htm.bind(h);

function h(type, props, ...children) {
  if (props) {
    return { type, props: { ...props, children: children.pop() } };
  } else {
    return { type, props: { children: children.pop() } };
  }
}

function content(title, submitter) {
  const text = `"${title}" submitted by ${submitter.displayName}`;
  return html`
    <div
      style=${{
        height: "100%",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0F3106",
        color: "white",
        fontSize: "5rem",
        fontWeight: "bold",
        padding: "0 0.5rem 0 0.5rem",
      }}
    >
      ${text}
    </div>
  `;
}

export async function generate(index, title, submitter) {
  const filePath = resolve(`./src/public/previews/${index}.svg`);

  try {
    await access(filePath);
    return; // File exists, so we just return
  } catch (err) {
    // File doesn't exist, we continue with the generation
  }

  const fontData = await readFile("./Verdana.ttf");
  const arial = {
    name: "Verdana",
    data: fontData,
    weight: 400,
    style: "normal",
  };
  const body = content(title, submitter);
  const svgData = await satori(body, {
    width: 1200,
    height: 630,
    fonts: [arial],
  });

  await writeFile(filePath, svgData);
}

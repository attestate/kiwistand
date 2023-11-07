import { readFile, writeFile, access } from "fs/promises";
import { resolve } from "path";

import satori from "satori";
import sharp from "sharp";
import htm from "htm";

const html = htm.bind(h);

function h(type, props, ...children) {
  if (props) {
    return { type, props: { ...props, children } };
  } else {
    return { type, props: { children } };
  }
}

function content(title, submitter) {
  const text = `submitted by ${submitter.displayName}`;
  return html`
    <div
      style=${{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        backgroundColor: "#0F3106",
        color: "white",
        fontWeight: "bold",
        padding: "0 5vw 0 5vw",
      }}
    >
      <p
        style=${{
          fontSize: "6rem",
          color: "#38C910",
          padding: 0,
          lineHeight: 0.9,
          margin: 0,
        }}
      >
        ${title}
      </p>
      <p style=${{ fontSize: "3rem" }}>${text}</p>
    </div>
  `;
}

export async function generate(index, title, submitter) {
  const filePath = resolve(`./src/public/previews/${index}.jpg`);

  try {
    await access(filePath);
    return; // File exists, so we just return
  } catch (err) {
    // File doesn't exist, we continue with the generation
  }

  const fontData = await readFile("./Verdana-Bold.ttf");
  const arial = {
    name: "Verdana",
    data: fontData,
    weight: 700,
    style: "bold",
  };
  const body = content(title, submitter);
  const svgData = await satori(body, {
    width: 1200,
    height: 630,
    fonts: [arial],
  });

  sharp(Buffer.from(svgData)).jpeg().toFile(filePath);
}

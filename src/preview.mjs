import { readFile, writeFile, access } from "fs/promises";
import { resolve } from "path";

import emojiRegex from "emoji-regex";
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

const emojiMatcher = emojiRegex();
function content(title, displayName, avatar) {
  title = title.replace(emojiMatcher, "");
  return html`
    <div
      style=${{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        backgroundColor: "#F6F6EF",
        color: "#828282",
        padding: "0 5vw 0 5vw",
      }}
    >
      <p
        style=${{
          fontFamily: "VerdanaBold",
          fontSize: "4.5rem",
          color: "black",
          padding: "1.5rem 1rem",
          lineHeight: 1.05,
          margin: 0,
          backgroundColor: "rgba(0,0,0,0.1)",
          borderRadius: "2px",
          border: "2px solid rgba(0,0,0,0.1)",
        }}
      >
        ${title}
      </p>
      <p
        style=${{
          fontSize: "2rem",
          marginBottom: 0,
        }}
      >
        submitted by
      </p>
      <div
        style=${{
          marginTop: "0.5rem",
          display: "flex",
          alignItems: "center",
        }}
      >
        ${avatar
          ? html`
              <img
                style=${{
                  height: "3rem",
                  width: "3rem",
                  borderRadius: "2px",
                  border: "2px solid black",
                  marginRight: "1rem",
                }}
                src="${avatar}"
              />
            `
          : null}
        <div
          style=${{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            height: "3rem",
          }}
        >
          <p
            style=${{
              fontFamily: "VerdanaBold",
              color: "black",
              fontSize: "3rem",
              marginTop: 0,
              paddingTop: 0,
            }}
          >
            ${displayName}
          </p>
        </div>
      </div>
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

  const fontData = await readFile("./Verdana.ttf");
  const fontDataBold = await readFile("./Verdana-Bold.ttf");
  const verdanaBold = {
    name: "VerdanaBold",
    data: fontDataBold,
    weight: 700,
    style: "bold",
  };
  const verdana = {
    name: "Verdana",
    data: fontData,
    weight: 700,
    style: "normal",
  };

  async function generatePreview(title, displayName, safeAvatar) {
    const body = content(title, displayName, safeAvatar);
    const svgData = await satori(body, {
      width: 1200,
      height: 630,
      fonts: [verdana, verdanaBold],
    });
    await sharp(Buffer.from(svgData))
      .jpeg({
        quality: 100,
        chromaSubsampling: "4:4:4",
      })
      .toFile(filePath);
  }

  try {
    await generatePreview(title, submitter.displayName, submitter.safeAvatar);
  } catch (err) {
    await generatePreview(title, submitter.displayName);
  }
}

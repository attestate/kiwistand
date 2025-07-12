import { readFile, writeFile, access } from "fs/promises";
import { resolve } from "path";
import { env } from "process";

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

export function writersFrame(username, avatar) {
  return html`
    <div
      style=${{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        height: "100%",
        width: "100%",
        backgroundColor: "#F6F6EF",
        color: "#828282",
        padding: "0 5vw",
      }}
    >
      ${avatar
        ? html`<img
            style=${{
              height: "20rem",
              width: "20rem",
              borderRadius: "2px",
              border: "2px solid black",
              marginBottom: "2rem",
            }}
            src="${cfTransform(avatar, 500)}"
          />`
        : ""}
      <p
        style=${{
          fontFamily: "VerdanaBold",
          fontSize: "4rem",
          color: "black",
          margin: "0 0 1rem 0",
        }}
      >
        @${username}
      </p>
      <p
        style=${{
          fontSize: "3rem",
          textAlign: "center",
          color: "black",
        }}
      >
        Support my writing by buying me a coffee!
      </p>
    </div>
  `;
}

export function cfTransform(url, size) {
  if (env.CF_IMAGES_SECRET) {
    const newurl = `https://images.kiwistand.com/?secret=${env.CF_IMAGES_SECRET}&avatarURL=${url}&width=${size}`;
    return newurl;
  }
  return url;
}

const emojiMatcher = emojiRegex();
export function story(title, displayName, avatar, domain) {
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
      ${domain
        ? html`
            <p
              style=${{
                fontSize: "1.8rem",
                margin: "0.5rem 0 0 0",
                opacity: 0.7,
              }}
            >
              ${domain}
            </p>
          `
        : null}
      <p
        style=${{
          fontSize: "2rem",
          marginBottom: 0,
          marginTop: domain ? "1rem" : 0,
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
                src="${cfTransform(avatar, 500)}"
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

export function storyFrame(title, displayName, avatar, domain) {
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
        padding: "2rem",
      }}
    >
      <p
        style=${{
          fontFamily: "VerdanaBold",
          fontSize: "3.5rem",
          color: "black",
          padding: "1rem",
          lineHeight: 1.1,
          margin: "0 0 1rem 0",
          backgroundColor: "rgba(0,0,0,0.1)",
          borderRadius: "2px",
          border: "2px solid rgba(0,0,0,0.1)",
          textAlign: "center",
        }}
      >
        ${title}
      </p>
      ${domain
        ? html`
            <p
              style=${{
                fontSize: "1.5rem",
                margin: "-0.5rem 0 1rem 0",
                opacity: 0.7,
                textAlign: "center",
              }}
            >
              ${domain}
            </p>
          `
        : null}
      <div
        style=${{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
        }}
      >
        ${avatar
          ? html`
              <img
                style=${{
                  height: "2.5rem",
                  width: "2.5rem",
                  borderRadius: "2px",
                  border: "2px solid black",
                }}
                src="${cfTransform(avatar, 300)}"
              />
            `
          : null}
        <div
          style=${{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <p
            style=${{
              fontSize: "1.5rem",
              margin: "0 0 0.2rem 0",
              color: "black",
            }}
          >
            submitted by
          </p>
          <p
            style=${{
              fontFamily: "VerdanaBold",
              color: "black",
              fontSize: "2rem",
              margin: 0,
            }}
          >
            ${displayName}
          </p>
        </div>
      </div>
    </div>
  `;
}

export async function generate(name, body, isFrame = false) {
  const suffix = isFrame ? "-frame" : "";
  const filePath = resolve(`./src/public/previews/${name}${suffix}.jpg`);

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

  // Farcaster frames must be 3:2 aspect ratio per docs, OG images use 1.91:1
  const dimensions = isFrame ? { width: 1200, height: 800 } : { width: 1200, height: 630 };
  
  const svgData = await satori(body, {
    ...dimensions,
    fonts: [verdana, verdanaBold],
  });
  await sharp(Buffer.from(svgData))
    .jpeg({
      quality: 100,
      chromaSubsampling: "4:4:4",
    })
    .toFile(filePath);
}

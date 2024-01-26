import { readFile, writeFile, access } from "fs/promises";
import { resolve } from "path";

import satori from "satori";
import sharp from "sharp";
import htm from "htm";
import fetch from "node-fetch";
global.fetch = fetch;

const html = htm.bind(h);

function h(type, props, ...children) {
  if (props) {
    return { type, props: { ...props, children } };
  } else {
    return { type, props: { children } };
  }
}

function content(title, submitter, domain) {
  const text = `submitted by `;
  const submitterStyle = {
    textDecoration: "underline",
    color: "red",
  };
  return html`
    <div
      style=${{
        width: "1200px",
        height: "630px",
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
          fontSize: "4rem",
          color: "#38C910",
          padding: 0,
          lineHeight: 0.9,
          margin: "2rem 0 1rem 0",
          textShadow: "0px 0.15rem 0.15rem black",
        }}
      >
        ${title}
      </p>
      <img
        src="https://news.kiwistand.com/KiwiPass.png"
        style=${{
          width: "200",
          height: "300",
        }}
      />,
      <p
        style=${{
          fontSize: "3rem",
          margin: "0 0 3rem 0",
          textShadow: "0px 0.1rem 0.1rem black",
        }}
      >
        (${domain})
      </p>
      <p>***</p>
      <p
        style=${{
          fontSize: "2rem",
          margin: "0 0 3rem 0",
          fontWeight: "normal",
        }}
      >
        ${text}
        <span
          style=${{
            textDecorationLine: "underline",
            textDecorationColor: "#3DC617",
          }}
          >${submitter}</span
        >
      </p>
    </div>
  `;
}

export async function generate(index, title, submitter, domain) {
  const filePath = resolve(`./src/public/previews/${index}.jpg`);

  // try {
  //   await access(filePath);
  //   return; // File exists, so we just return
  // } catch (err) {
  //   // File doesn't exist, we continue with the generation
  // }

  const fontData = await readFile("./Verdana-Bold.ttf");
  const arial = {
    name: "Verdana",
    data: fontData,
    weight: 400,
    style: "normal",
  };
  const body = content(title, submitter, domain);
  const svgData = await satori(body, {
    width: 1200,
    height: 630,
    fonts: [arial],
  });

  sharp(Buffer.from(svgData)).jpeg().toFile(filePath);
}

// Test function
async function test() {
  // Test different titles and submitters
  console.log("started generation");
  await generate(
    1,
    "This is a test title that has eighty characters to see how Kiwi renders OG:Image",
    "Test Submitter 1",
    "testdomain1.com",
  );
  await generate(2, "Short title test", "Test Submitter 2", "domain2.com");
  await generate(
    3,
    "Medium length title test about 30 chars",
    "Test Submitter 2 longname",
    "veryverylongdomain2.com",
  );
  // Add more tests as needed
}

// Run the test function
test().catch(console.error);

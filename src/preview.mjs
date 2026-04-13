import { readFile, writeFile, access } from "fs/promises";
import { readFileSync } from "fs";
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
          fontFamily: "InterSemiBold",
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

let _kiwiIconSrc = null;
function getKiwiIconSrc() {
  if (!_kiwiIconSrc) {
    const buf = readFileSync(resolve("./kiwi-icon.png"));
    _kiwiIconSrc = `data:image/png;base64,${buf.toString("base64")}`;
  }
  return _kiwiIconSrc;
}

export function story(title, displayName, avatar, domain) {
  title = title.replace(emojiMatcher, "");
  const kiwiIconSrc = getKiwiIconSrc();

  // Adaptive font size based on title length
  let titleFontSize = "54px";
  let titleLineHeight = 1.2;
  if (title.length > 120) {
    titleFontSize = "36px";
    titleLineHeight = 1.3;
  } else if (title.length > 80) {
    titleFontSize = "42px";
    titleLineHeight = 1.25;
  } else if (title.length < 30) {
    titleFontSize = "60px";
    titleLineHeight = 1.15;
  }

  return html`
    <div
      style=${{
        height: "100%",
        width: "100%",
        display: "flex",
        backgroundColor: "#fafaf7",
      }}
    >
      <div
        style=${{
          width: "10px",
          height: "100%",
          backgroundColor: "#AFC046",
          display: "flex",
          flexShrink: 0,
        }}
      ></div>
      <div
        style=${{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          padding: "40px 56px 40px 48px",
        }}
      >
        <div
          style=${{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "8px",
          }}
        >
          <div
            style=${{
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <img
              style=${{
                width: "36px",
                height: "36px",
                borderRadius: "6px",
              }}
              src="${kiwiIconSrc}"
            />
            <div
              style=${{
                fontSize: "24px",
                fontFamily: "InterSemiBold",
                color: "#333",
                display: "flex",
              }}
            >
              Kiwi News
            </div>
          </div>
          ${domain
            ? html`
                <div
                  style=${{
                    fontSize: "20px",
                    color: "#aaa",
                    display: "flex",
                  }}
                >
                  ${domain}
                </div>
              `
            : null}
        </div>
        <div
          style=${{
            display: "flex",
            alignItems: "center",
            flex: 1,
          }}
        >
          <div
            style=${{
              fontFamily: "InterSemiBold",
              fontSize: titleFontSize,
              color: "#111",
              lineHeight: titleLineHeight,
              display: "flex",
              wordBreak: "break-word",
            }}
          >
            ${title}
          </div>
        </div>
        <div
          style=${{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            borderTop: "2px solid #e8e5dc",
            paddingTop: "20px",
            marginTop: "8px",
          }}
        >
          ${avatar
            ? html`
                <img
                  style=${{
                    width: "40px",
                    height: "40px",
                    borderRadius: "20px",
                    border: "2px solid #ddd",
                  }}
                  src="${cfTransform(avatar, 500)}"
                />
              `
            : html`
                <div
                  style=${{
                    width: "40px",
                    height: "40px",
                    borderRadius: "20px",
                    backgroundColor: "#AFC046",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <div
                    style=${{
                      color: "white",
                      fontSize: "18px",
                      fontFamily: "InterSemiBold",
                      display: "flex",
                    }}
                  >
                    ${displayName.charAt(0).toUpperCase()}
                  </div>
                </div>
              `}
          <div
            style=${{
              fontFamily: "InterSemiBold",
              fontSize: "22px",
              color: "#555",
              display: "flex",
            }}
          >
            ${displayName}
          </div>
        </div>
      </div>
    </div>
  `;
}

export function comment(commentText, authorName, authorAvatar, storyTitle, timestamp, reactions) {
  // Remove emojis from text for better rendering in Satori
  // Satori doesn't handle emojis well without an emoji font
  const emojiMatcher = emojiRegex();
  let processedText = commentText.replace(emojiMatcher, '').trim();
  
  // Truncate long URLs to prevent overflow
  processedText = processedText.replace(/(https?:\/\/[^\s]+)/g, (url) => {
    if (url.length > 60) {
      return url.substring(0, 57) + '...';
    }
    return url;
  });
  
  // Handle quoted text (lines starting with ">")
  const lines = processedText.split('\n');
  const processedLines = [];
  let totalLength = 0;
  const maxLength = 280;
  
  for (const line of lines) {
    if (totalLength >= maxLength) break;
    
    const trimmedLine = line.trim();
    const remaining = maxLength - totalLength;
    
    if (trimmedLine.startsWith('>')) {
      // This is a quoted line
      const quotedText = trimmedLine.substring(1).trim();
      const truncatedQuote = quotedText.length > remaining 
        ? quotedText.substring(0, remaining) + '...'
        : quotedText;
      processedLines.push({ type: 'quote', text: truncatedQuote });
      totalLength += truncatedQuote.length;
    } else if (trimmedLine) {
      // Regular text
      const truncatedText = trimmedLine.length > remaining
        ? trimmedLine.substring(0, remaining) + '...'
        : trimmedLine;
      processedLines.push({ type: 'normal', text: truncatedText });
      totalLength += truncatedText.length;
    }
  }
  
  // If no lines processed but we have text, just use the raw text
  if (processedLines.length === 0 && processedText) {
    const displayText = processedText.length > maxLength 
      ? processedText.substring(0, maxLength) + "..." 
      : processedText;
    processedLines.push({ type: 'normal', text: displayText });
  }
  
  return html`
    <div
      style=${{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        backgroundColor: "#F6F6EF",
        color: "#333",
        padding: "3rem",
      }}
    >
      <div
        style=${{
          backgroundColor: "white",
          padding: "2rem",
          borderRadius: "8px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
          border: "2px solid rgba(166, 110, 78, 0.2)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style=${{
            fontSize: "1.2rem",
            color: "#828282",
            marginBottom: "1.5rem",
            borderBottom: "1px solid #e0e0e0",
            paddingBottom: "1rem",
            display: "flex",
          }}
        >
          <span style=${{ display: "flex" }}>Comment on:</span>
          <span style=${{ color: "#000", fontWeight: "bold", marginLeft: "0.5rem", display: "flex" }}>${storyTitle}</span>
        </div>
        
        <div
          style=${{
            display: "flex",
            alignItems: "flex-start",
            gap: "1rem",
          }}
        >
          ${authorAvatar
            ? html`
                <img
                  style=${{
                    width: "48px",
                    height: "48px",
                    borderRadius: "4px",
                    border: "2px solid #828282",
                    flexShrink: 0,
                  }}
                  src="${cfTransform(authorAvatar, 500)}"
                />
              `
            : html`
                <div style=${{
                  width: "48px",
                  height: "48px",
                  borderRadius: "4px",
                  border: "2px solid #828282",
                  backgroundColor: "#f0f0f0",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <span style=${{ fontSize: "24px", color: "#828282" }}>?</span>
                </div>
              `}
          <div style=${{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div
              style=${{
                fontFamily: "InterSemiBold",
                fontSize: "1.4rem",
                color: "black",
                marginBottom: "0.8rem",
                display: "flex",
              }}
            >
              ${authorName}
            </div>
            <div
              style=${{
                fontSize: "0.9rem",
                color: "#828282",
                marginBottom: "0.8rem",
                display: "flex",
              }}
            >
              ${timestamp}
            </div>
            <div
              style=${{
                fontSize: "1.6rem",
                lineHeight: 1.4,
                color: "black",
                display: "flex",
                flexDirection: "column",
              }}
            >
          ${processedLines.length === 1 && processedLines[0].type === 'normal'
            ? html`<span style=${{ display: "flex" }}>${processedLines[0].text}</span>`
            : processedLines.map((line, i) => {
                if (line.type === 'quote') {
                  return html`
                    <div style=${{
                      display: "flex",
                      borderLeft: "3px solid #ccc",
                      paddingLeft: "12px",
                      marginTop: i > 0 ? "8px" : 0,
                      marginBottom: "8px",
                      color: "#666",
                      fontStyle: "italic",
                    }}>
                      ${line.text}
                    </div>
                  `;
                } else if (line.type === 'more') {
                  return html`
                    <div style=${{
                      display: "flex",
                      marginTop: "12px",
                      color: "#828282",
                      fontStyle: "italic",
                      fontSize: "1.4rem",
                    }}>
                      ${line.text}
                    </div>
                  `;
                } else {
                  return html`
                    <div style=${{
                      display: "flex",
                      marginTop: i > 0 && processedLines[i-1] && processedLines[i-1].type === 'quote' ? "8px" : (i > 0 ? "4px" : 0),
                    }}>
                      ${line.text}
                    </div>
                  `;
                }
              })
          }
            </div>
            ${reactions && reactions.length > 0
              ? html`
                  <div
                    style=${{
                      display: "flex",
                      gap: "0.5rem",
                      fontSize: "1.2rem",
                      marginTop: "1rem",
                    }}
                  >
                    ${reactions.slice(0, 5).map(r => html`
                      <span
                        style=${{
                          padding: "0.3rem 0.6rem",
                          backgroundColor: "#f0f0f0",
                          borderRadius: "4px",
                        }}
                      >
                        ${r.emoji} ${r.count}
                      </span>
                    `)}
                  </div>
                `
              : null}
          </div>
        </div>
      </div>
      
      <div
        style=${{
          marginTop: "2rem",
          textAlign: "center",
          fontSize: "1.2rem",
          color: "#828282",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <span style=${{ fontWeight: "bold", color: "#ff6600", display: "flex" }}>Kiwi News</span>
        <span style=${{ margin: "0 0.5rem", display: "flex" }}>•</span>
        <span style=${{ display: "flex" }}>news.kiwistand.com</span>
      </div>
    </div>
  `;
}

export function commentFrame(commentText, authorName, authorAvatar, storyTitle, timestamp, reactions) {
  // Remove emojis from text for better rendering in Satori
  const emojiMatcher = emojiRegex();
  let processedText = commentText.replace(emojiMatcher, '').trim();
  
  // Truncate long URLs to prevent overflow
  processedText = processedText.replace(/(https?:\/\/[^\s]+)/g, (url) => {
    if (url.length > 50) {
      return url.substring(0, 47) + '...';
    }
    return url;
  });
  
  // Handle quoted text for frames
  const lines = processedText.split('\n');
  const processedLines = [];
  let totalLength = 0;
  const maxLength = 200;
  let wasTruncated = false;
  
  for (let i = 0; i < lines.length; i++) {
    if (totalLength >= maxLength) {
      wasTruncated = true;
      break;
    }
    
    const line = lines[i];
    const trimmedLine = line.trim();
    const remaining = maxLength - totalLength;
    
    if (trimmedLine.startsWith('>')) {
      const quotedText = trimmedLine.substring(1).trim();
      if (quotedText.length > remaining) {
        processedLines.push({ type: 'quote', text: quotedText.substring(0, remaining) + '...' });
        wasTruncated = true;
        break;
      }
      processedLines.push({ type: 'quote', text: quotedText });
      totalLength += quotedText.length;
    } else if (trimmedLine) {
      if (trimmedLine.length > remaining) {
        processedLines.push({ type: 'normal', text: trimmedLine.substring(0, remaining) + '...' });
        wasTruncated = true;
        break;
      }
      processedLines.push({ type: 'normal', text: trimmedLine });
      totalLength += trimmedLine.length;
    }
  }
  
  // If we truncated, add a "Read more" indicator
  if (wasTruncated) {
    processedLines.push({ type: 'more', text: '[Read more...]' });
  }
  
  if (processedLines.length === 0 && processedText) {
    const displayText = processedText.length > maxLength 
      ? processedText.substring(0, maxLength) + "..." 
      : processedText;
    processedLines.push({ type: 'normal', text: displayText });
    if (processedText.length > maxLength) {
      processedLines.push({ type: 'more', text: '[Read more...]' });
    }
  }
  
  const truncatedTitle = storyTitle.length > 60 
    ? storyTitle.substring(0, 60) + "..."
    : storyTitle;
  
  return html`
    <div
      style=${{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        backgroundColor: "#F6F6EF",
        color: "#333",
        padding: "2rem",
      }}
    >
      <div
        style=${{
          backgroundColor: "white",
          padding: "1.5rem",
          borderRadius: "6px",
          border: "2px solid rgba(166, 110, 78, 0.2)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style=${{
            fontSize: "1rem",
            color: "#828282",
            marginBottom: "1rem",
            display: "flex",
          }}
        >
          <span style=${{ display: "flex" }}>Comment on:</span>
          <span style=${{ fontWeight: "bold", marginLeft: "0.4rem", display: "flex" }}>${truncatedTitle}</span>
        </div>
        
        <div
          style=${{
            display: "flex",
            alignItems: "flex-start",
            gap: "0.8rem",
          }}
        >
          ${authorAvatar
            ? html`
                <img
                  style=${{
                    width: "36px",
                    height: "36px",
                    borderRadius: "3px",
                    border: "1px solid #828282",
                    flexShrink: 0,
                  }}
                  src="${cfTransform(authorAvatar, 300)}"
                />
              `
            : html`
                <div style=${{
                  width: "36px",
                  height: "36px",
                  borderRadius: "3px",
                  border: "1px solid #828282",
                  backgroundColor: "#f0f0f0",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <span style=${{ fontSize: "18px", color: "#828282" }}>?</span>
                </div>
              `}
          <div style=${{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div
              style=${{
                fontFamily: "InterSemiBold",
                fontSize: "1.2rem",
                color: "black",
                marginBottom: "0.6rem",
                display: "flex",
              }}
            >
              ${authorName}
            </div>
            <div
              style=${{
                fontSize: "0.8rem",
                color: "#828282",
                marginBottom: "0.6rem",
                display: "flex",
              }}
            >
              ${timestamp}
            </div>
            <div
              style=${{
                fontSize: "1.3rem",
                lineHeight: 1.3,
                color: "black",
                display: "flex",
                flexDirection: "column",
              }}
            >
          ${processedLines.length === 1 && processedLines[0].type === 'normal'
            ? html`<span style=${{ display: "flex" }}>${processedLines[0].text}</span>`
            : processedLines.map((line, i) => {
                if (line.type === 'quote') {
                  return html`
                    <div style=${{
                      display: "flex",
                      borderLeft: "2px solid #ccc",
                      paddingLeft: "8px",
                      marginTop: i > 0 ? "6px" : 0,
                      marginBottom: "6px",
                      color: "#666",
                      fontStyle: "italic",
                      fontSize: "1.3rem",
                    }}>
                      ${line.text}
                    </div>
                  `;
                } else if (line.type === 'more') {
                  return html`
                    <div style=${{
                      display: "flex",
                      marginTop: "10px",
                      color: "#828282",
                      fontStyle: "italic",
                      fontSize: "1.1rem",
                    }}>
                      ${line.text}
                    </div>
                  `;
                } else {
                  return html`
                    <div style=${{
                      display: "flex",
                      marginTop: i > 0 && processedLines[i-1] && processedLines[i-1].type === 'quote' ? "6px" : (i > 0 ? "3px" : 0),
                    }}>
                      ${line.text}
                    </div>
                  `;
                }
              })
          }
            </div>
            ${reactions && reactions.length > 0
              ? html`
                  <div
                    style=${{
                      display: "flex",
                      gap: "0.4rem",
                      fontSize: "1rem",
                      marginTop: "0.8rem",
                    }}
                  >
                    ${reactions.slice(0, 3).map(r => html`
                      <span
                        style=${{
                          padding: "0.2rem 0.4rem",
                          backgroundColor: "#f0f0f0",
                          borderRadius: "3px",
                        }}
                      >
                        ${r.emoji} ${r.count}
                      </span>
                    `)}
                  </div>
                `
              : null}
          </div>
        </div>
      </div>
      
      <div
        style=${{
          marginTop: "1rem",
          textAlign: "center",
          fontSize: "1rem",
          color: "#828282",
          display: "flex",
          justifyContent: "center",
        }}
      >
        🥝 Kiwi News
      </div>
    </div>
  `;
}

export function storyFrame(title, displayName, avatar, domain) {
  title = title.replace(emojiMatcher, "");
  const kiwiIconSrc = getKiwiIconSrc();

  let titleFontSize = "50px";
  let titleLineHeight = 1.2;
  if (title.length > 120) {
    titleFontSize = "34px";
    titleLineHeight = 1.3;
  } else if (title.length > 80) {
    titleFontSize = "40px";
    titleLineHeight = 1.25;
  } else if (title.length < 30) {
    titleFontSize = "56px";
    titleLineHeight = 1.15;
  }

  return html`
    <div
      style=${{
        height: "100%",
        width: "100%",
        display: "flex",
        backgroundColor: "#fafaf7",
      }}
    >
      <div
        style=${{
          width: "10px",
          height: "100%",
          backgroundColor: "#AFC046",
          display: "flex",
          flexShrink: 0,
        }}
      ></div>
      <div
        style=${{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          padding: "40px 52px 40px 44px",
        }}
      >
        <div
          style=${{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "8px",
          }}
        >
          <div
            style=${{
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <img
              style=${{
                width: "32px",
                height: "32px",
                borderRadius: "5px",
              }}
              src="${kiwiIconSrc}"
            />
            <div
              style=${{
                fontSize: "22px",
                fontFamily: "InterSemiBold",
                color: "#333",
                display: "flex",
              }}
            >
              Kiwi News
            </div>
          </div>
          ${domain
            ? html`
                <div
                  style=${{
                    fontSize: "18px",
                    color: "#aaa",
                    display: "flex",
                  }}
                >
                  ${domain}
                </div>
              `
            : null}
        </div>
        <div
          style=${{
            display: "flex",
            alignItems: "center",
            flex: 1,
          }}
        >
          <div
            style=${{
              fontFamily: "InterSemiBold",
              fontSize: titleFontSize,
              color: "#111",
              lineHeight: titleLineHeight,
              display: "flex",
              wordBreak: "break-word",
            }}
          >
            ${title}
          </div>
        </div>
        <div
          style=${{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            borderTop: "2px solid #e8e5dc",
            paddingTop: "18px",
            marginTop: "8px",
          }}
        >
          ${avatar
            ? html`
                <img
                  style=${{
                    width: "36px",
                    height: "36px",
                    borderRadius: "18px",
                    border: "2px solid #ddd",
                  }}
                  src="${cfTransform(avatar, 300)}"
                />
              `
            : html`
                <div
                  style=${{
                    width: "36px",
                    height: "36px",
                    borderRadius: "18px",
                    backgroundColor: "#AFC046",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <div
                    style=${{
                      color: "white",
                      fontSize: "16px",
                      fontFamily: "InterSemiBold",
                      display: "flex",
                    }}
                  >
                    ${displayName.charAt(0).toUpperCase()}
                  </div>
                </div>
              `}
          <div
            style=${{
              fontFamily: "InterSemiBold",
              fontSize: "20px",
              color: "#555",
              display: "flex",
            }}
          >
            ${displayName}
          </div>
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

  const fontData = await readFile("./Inter-Regular.ttf");
  const fontDataBold = await readFile("./Inter-SemiBold.ttf");
  const interSemiBold = {
    name: "InterSemiBold",
    data: fontDataBold,
    weight: 600,
    style: "normal",
  };
  const inter = {
    name: "Inter",
    data: fontData,
    weight: 400,
    style: "normal",
  };

  // Farcaster frames must be 3:2 aspect ratio per docs, OG images use 1.91:1
  const dimensions = isFrame ? { width: 1200, height: 800 } : { width: 1200, height: 630 };

  const svgData = await satori(body, {
    ...dimensions,
    fonts: [inter, interSemiBold],
  });
  await sharp(Buffer.from(svgData))
    .jpeg({
      quality: 100,
      chromaSubsampling: "4:4:4",
    })
    .toFile(filePath);
}

//@format
import { env } from "process";
import { URL } from "url";

import htm from "htm";
import vhtml from "vhtml";
import DOMPurify from "isomorphic-dompurify";

import theme from "../theme.mjs";
import head from "./components/head.mjs";

const html = htm.bind(vhtml);

export default async function (url, theme) {
  // Validate and sanitize the URL
  let targetUrl;
  try {
    targetUrl = new URL(url);
    // Only allow http and https protocols
    if (!["http:", "https:"].includes(targetUrl.protocol)) {
      throw new Error("Invalid protocol");
    }
    
  } catch (error) {
    return html`
      <html lang="en" op="news">
        <head>
          ${head}
          <style>
            body {
              font-family: Verdana, Geneva, sans-serif;
              margin: 0;
              padding: 20px;
              background-color: ${theme.color};
            }
            .error-container {
              max-width: 600px;
              margin: 50px auto;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="error-container">
            <h2>Invalid URL</h2>
            <p>The URL you're trying to access is invalid or not allowed.</p>
            <a href="/" style="color: ${theme.color};">Go back to home</a>
          </div>
        </body>
      </html>
    `;
  }

  const sanitizedUrl = DOMPurify.sanitize(targetUrl.href);

  return html`
    <html lang="en" op="news">
      <head>
        ${head}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
        />
        <style>
          body {
            font-family: Verdana, Geneva, sans-serif;
            margin: 0;
            padding: 0;
            height: 100vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            background-color: var(--background-color0);
          }
          .embed-header {
            background-color: ${theme.color};
            padding: 4px 10px;
            display: flex;
            align-items: center;
            gap: 10px;
            z-index: 1000;
            position: relative;
            min-height: 40px;
          }
          .back-button {
            display: inline-flex;
            align-items: center;
            text-decoration: none;
            color: var(--text-primary);
            font-size: 11pt;
            min-height: 44px;
            min-width: 44px;
            padding: 0 5px;
          }
          .back-button:hover {
            opacity: 0.7;
          }
          .back-button svg {
            margin-right: 6px;
          }
          .embed-info {
            flex: 1;
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 11pt;
          }
          .embed-info a {
            color: var(--text-primary);
            text-decoration: none;
            display: flex;
            align-items: center;
            gap: 4px;
          }
          .embed-info a:hover {
            text-decoration: underline;
          }
          .iframe-container {
            flex: 1;
            position: relative;
            overflow: hidden;
          }
          iframe {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            border: none;
          }
          .loading-spinner {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 40px;
            height: 40px;
            border: 4px solid var(--middle-beige);
            border-top: 4px solid ${theme.color};
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            0% { transform: translate(-50%, -50%) rotate(0deg); }
            100% { transform: translate(-50%, -50%) rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <div class="embed-header">
          <a href="javascript:history.back()" class="back-button">
            <svg
              height="21px"
              viewBox="0 0 13 21"
              stroke="currentColor"
              stroke-width="2.5"
              fill="none"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="11.5 1.5 1.5 10.5 11.5 19.5" />
            </svg>
            <span style="margin-top: 1px;">Back</span>
          </a>
          <div class="embed-info">
            <a href="${sanitizedUrl}" target="_blank">
              ${targetUrl.hostname}
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 256 256"
                width="16"
                height="16"
                style="opacity: 0.5;"
              >
                <rect width="256" height="256" fill="none"/>
                <path d="M141.38,64.68l11-11a46.62,46.62,0,0,1,65.94,0h0a46.62,46.62,0,0,1,0,65.94L193.94,144,183.6,154.34a46.63,46.63,0,0,1-66-.05h0A46.48,46.48,0,0,1,104,120.06" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/>
                <path d="M114.62,191.32l-11,11a46.63,46.63,0,0,1-66-.05h0a46.63,46.63,0,0,1,.06-65.89L72.4,101.66a46.62,46.62,0,0,1,65.94,0h0A46.45,46.45,0,0,1,152,135.94" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/>
              </svg>
            </a>
          </div>
        </div>
        <div class="iframe-container">
          <div class="loading-spinner"></div>
          <iframe 
            src="${sanitizedUrl}"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            onload="this.parentElement.querySelector('.loading-spinner').style.display = 'none';"
            onerror="this.parentElement.innerHTML = '<div style=\"text-align: center; padding: 50px;\"><h3>This site cannot be displayed in the embed view</h3><p>The website blocks embedding for security reasons.</p><a href=\"${sanitizedUrl}\" style=\"color: ${theme.color};\">Open the site directly</a></div>';"
          ></iframe>
        </div>
      </body>
    </html>
  `;
}
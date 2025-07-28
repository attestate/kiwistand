import fetch from 'node-fetch';

const testUrl = "https://teia.art/";

console.log("Testing iframe detection for:", testUrl);

try {
  const response = await fetch(testUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    },
  });

  const xFrameOptions = response.headers.get('x-frame-options');
  const csp = response.headers.get('content-security-policy');
  
  console.log("\nHTTP Headers:");
  console.log("X-Frame-Options:", xFrameOptions);
  console.log("Content-Security-Policy:", csp);
  
  let canIframe = true;
  
  // Check X-Frame-Options
  if (xFrameOptions && (xFrameOptions.toLowerCase() === 'deny' || xFrameOptions.toLowerCase() === 'sameorigin')) {
    canIframe = false;
    console.log("\n❌ X-Frame-Options blocks iframe:", xFrameOptions);
  }
  
  // Check CSP frame-ancestors
  if (csp && csp.includes('frame-ancestors')) {
    const frameAncestorsMatch = csp.match(/frame-ancestors\s+([^;]+)/);
    if (frameAncestorsMatch) {
      const frameAncestorsValue = frameAncestorsMatch[1].trim();
      console.log("\nframe-ancestors value:", frameAncestorsValue);
      
      // Default to blocking unless explicitly allowed
      canIframe = false;
      
      // Only allow if it explicitly allows all origins
      if (frameAncestorsValue.includes('*') && !frameAncestorsValue.includes("'self'")) {
        canIframe = true;
      }
      // Check if it only allows specific domains (like Substack allowing only *.substack.com)
      else if (frameAncestorsValue.includes('https://') || frameAncestorsValue.includes('http://')) {
        // If it specifies specific domains, it won't work from kiwistand.com
        canIframe = false;
        console.log("❌ CSP frame-ancestors blocks iframe (domain-specific):", frameAncestorsValue);
      } else {
        console.log("❌ CSP frame-ancestors blocks iframe:", frameAncestorsValue);
      }
    }
  }
  
  console.log("\n✅ Result: canIframe =", canIframe);
  
} catch (error) {
  console.error("Error:", error.message);
}

process.exit(0);
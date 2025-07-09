import dotenv from "dotenv";
import { env } from "process";

// Load environment variables
dotenv.config();

// Set required environment variables if not already set
env.CACHE_DIR = env.CACHE_DIR || "./cache";
env.USER_AGENT = env.USER_AGENT || "Mozilla/5.0 (compatible; KiwiNews/1.0)";

// Import after setting env vars
import { extractParagraphContent } from "./src/parser.mjs";

async function debugParagraph() {
  const url = "https://paragraph.xyz/@jacque/rewriting-the-rules";
  
  console.log("Debugging Paragraph.xyz content extraction...\n");
  
  try {
    const result = await extractParagraphContent(url);
    
    console.log("=== EXTRACTION RESULT ===");
    console.log("Title:", result.title);
    console.log("Author:", result.author);
    console.log("Arweave ID:", result.arweaveId);
    console.log("\n=== CONTENT ===");
    console.log("Content length:", result.content?.length || 0);
    console.log("\nFirst 500 chars of content:");
    console.log(result.content?.substring(0, 500));
    console.log("\n=== CONTENT ANALYSIS ===");
    console.log("Contains <p> tags:", result.content?.includes('<p>'));
    console.log("Contains <br> tags:", result.content?.includes('<br>'));
    console.log("Contains \\n newlines:", result.content?.includes('\n'));
    console.log("Contains <div> tags:", result.content?.includes('<div>'));
    
    // Check if content looks like plain text that needs formatting
    if (result.content && !result.content.includes('<p>') && !result.content.includes('<br>')) {
      console.log("\nContent appears to be plain text. Sample with visible newlines:");
      console.log(JSON.stringify(result.content.substring(0, 500)));
    }
    
  } catch (error) {
    console.error("Error:", error);
  }
}

debugParagraph().catch(console.error);
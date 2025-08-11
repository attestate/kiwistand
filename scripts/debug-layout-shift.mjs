
import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command-line arguments
const args = process.argv.slice(2);
const helpFlag = args.includes('--help') || args.includes('-h');

if (helpFlag) {
  console.log(`
Usage: node debug-layout-shift.mjs [BASE_URL] [PATHS...]

Examples:
  # Use default localhost:4000 with default paths
  node debug-layout-shift.mjs
  
  # Use custom URL with default paths
  node debug-layout-shift.mjs https://news.kiwistand.com
  
  # Use custom URL with custom paths
  node debug-layout-shift.mjs https://news.kiwistand.com / /new /best /submit
  
  # Use environment variable
  BASE_URL=https://staging.example.com node debug-layout-shift.mjs

Options:
  --help, -h    Show this help message
  
Environment Variables:
  BASE_URL      Override the base URL (default: http://localhost:4000)
  SCREENSHOT_DIR Override screenshot directory (default: ./layout-shift-debug)
`);
  process.exit(0);
}

// Get configuration from environment or arguments
const BASE_URL = process.env.BASE_URL || args[0] || 'http://localhost:4000';
const SITES = args.length > 1 ? args.slice(1) : ['/', '/new', '/stories'];
const SCREENSHOT_DIR = process.env.SCREENSHOT_DIR || path.join(__dirname, '..', 'layout-shift-debug');

async function main() {
  console.log(`Configuration:
  - Base URL: ${BASE_URL}
  - Paths to test: ${SITES.join(', ')}
  - Screenshot directory: ${SCREENSHOT_DIR}
`);
  // Create screenshot directory if it doesn't exist
  try {
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
    console.log(`Screenshot directory created/verified: ${SCREENSHOT_DIR}`);
  } catch (error) {
    console.error('Error creating screenshot directory:', error);
  }

  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setDefaultNavigationTimeout(60000);

  // Store all results for JSON output
  const allResults = [];
  
  for (const site of SITES) {
    const url = `${BASE_URL}${site}`;
    console.log(`Analyzing ${url}...`);

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // Wait for page to be fully loaded and then measure CLS
    const cls = await page.evaluate(() => {
      return new Promise((resolve) => {
        let cumulativeLayoutShift = 0;
        let layoutShifts = [];
        
        // Helper to get element selector
        const getSelector = (element) => {
          if (!element) return 'unknown';
          
          // Try to get a meaningful selector
          if (element.id) return `#${element.id}`;
          if (element.className) {
            const classes = element.className.split(' ').filter(c => c).join('.');
            if (classes) return `.${classes}`;
          }
          
          // Get tag name with index among siblings
          const parent = element.parentElement;
          if (!parent) return element.tagName.toLowerCase();
          
          const siblings = Array.from(parent.children);
          const index = siblings.indexOf(element);
          return `${element.tagName.toLowerCase()}:nth-child(${index + 1})`;
        };
        
        // Helper to get element details
        const getElementDetails = (node) => {
          if (!node || !node.node) return null;
          
          try {
            const element = node.node;
            const rect = element.getBoundingClientRect();
            const computedStyle = window.getComputedStyle(element);
            
            return {
              selector: getSelector(element),
              tagName: element.tagName,
              classList: Array.from(element.classList || []),
              id: element.id || null,
              dimensions: {
                width: rect.width,
                height: rect.height,
                top: rect.top,
                left: rect.left
              },
              text: element.textContent ? element.textContent.substring(0, 100) : '',
              styles: {
                position: computedStyle.position,
                display: computedStyle.display,
                margin: computedStyle.margin,
                padding: computedStyle.padding
              },
              previousRect: node.previousRect,
              currentRect: node.currentRect
            };
          } catch (e) {
            return { error: e.message };
          }
        };
        
        // Check if PerformanceObserver is available
        if (typeof PerformanceObserver === 'undefined') {
          console.warn('PerformanceObserver not available');
          resolve({ cls: 0, shifts: [] });
          return;
        }

        try {
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              // Only count layout shifts without recent input
              if (!entry.hadRecentInput) {
                cumulativeLayoutShift += entry.value;
                
                // Extract detailed source information
                const sources = (entry.sources || []).map(source => getElementDetails(source)).filter(Boolean);
                
                layoutShifts.push({
                  value: entry.value,
                  startTime: entry.startTime,
                  sources: sources,
                  hadRecentInput: entry.hadRecentInput
                });
              }
            }
          });
          
          // Observe layout-shift entries
          observer.observe({ type: 'layout-shift', buffered: true });

          // Wait for potential layout shifts to occur
          setTimeout(() => {
            observer.disconnect();
            resolve({ cls: cumulativeLayoutShift, shifts: layoutShifts });
          }, 3000);
        } catch (error) {
          console.error('Error observing layout shifts:', error);
          resolve({ cls: 0, shifts: [] });
        }
      });
    });

    console.log(`  Cumulative Layout Shift: ${cls.cls.toFixed(4)}`);
    if (cls.shifts.length > 0) {
      console.log(`  Number of layout shifts: ${cls.shifts.length}`);
      // Show summary of shifting elements
      const shiftingSources = cls.shifts.flatMap(shift => 
        shift.sources.map(s => s.selector || 'unknown')
      ).filter((v, i, a) => a.indexOf(v) === i); // unique selectors
      console.log(`  Elements causing shifts: ${shiftingSources.join(', ')}`);
    }

    // Generate better filename for screenshots
    const filename = site === '/' ? 'index' : site.replace(/^\//g, '').replace(/\//g, '_');
    const screenshotPath = path.join(SCREENSHOT_DIR, `${filename}.png`);
    
    try {
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`  Screenshot saved to ${screenshotPath}`);
    } catch (error) {
      console.error(`  Error saving screenshot: ${error.message}`);
    }
    
    // Store results for JSON output
    allResults.push({
      url,
      path: site,
      cumulativeLayoutShift: cls.cls,
      numberOfShifts: cls.shifts.length,
      shifts: cls.shifts,
      screenshot: screenshotPath,
      timestamp: new Date().toISOString()
    });
  }

  await browser.close();
  
  // Write detailed results to JSON file
  const resultsPath = path.join(SCREENSHOT_DIR, 'layout-shift-analysis.json');
  try {
    await fs.writeFile(resultsPath, JSON.stringify(allResults, null, 2));
    console.log(`\nDetailed results saved to: ${resultsPath}`);
    
    // Summary for console
    console.log('\n=== SUMMARY ===');
    allResults.forEach(result => {
      console.log(`${result.path}: CLS=${result.cumulativeLayoutShift.toFixed(4)}`);
      if (result.shifts.length > 0) {
        result.shifts.forEach((shift, i) => {
          console.log(`  Shift ${i + 1}: value=${shift.value.toFixed(4)}, time=${shift.startTime.toFixed(0)}ms`);
          shift.sources.forEach(source => {
            if (source.selector) {
              console.log(`    - ${source.selector} (${source.tagName})`);
            }
          });
        });
      }
    });
  } catch (error) {
    console.error('Error writing results file:', error);
  }
  
  console.log('\nAnalysis complete!');
}

main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});

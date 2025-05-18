// @format
import test from 'ava';
import fetch from 'node-fetch';
import https from 'https';

// Create an https agent that doesn't validate certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

// Define thresholds - we want to ensure responses are under 150KB after compression
const SIZE_CRITICAL_THRESHOLD = 150 * 1024; // 150KB

// Always test against the development server (91.107.210.214)
const host = 'https://91.107.210.214';
const apiHost = 'https://91.107.210.214:8443';

console.log(`Testing compression against host: ${host}`);

// Test the home feed (/) - This is what we care about most
test('Home feed should be compressed and under 150KB', async t => {
  const url = `${host}/`;
  
  // First check uncompressed size
  const uncompressedResponse = await fetch(url, {
    headers: {
      'Accept-Encoding': 'identity',
      'User-Agent': 'KiwiNews-CompressionTest/1.0'
    },
    agent: httpsAgent
  });
  
  t.is(uncompressedResponse.status, 200, 'Home page should return 200 status');
  
  const uncompressedBody = await uncompressedResponse.text();
  const uncompressedSize = Buffer.byteLength(uncompressedBody, 'utf8');
  
  console.log(`Home feed uncompressed size: ${(uncompressedSize/1024).toFixed(1)}KB`);
  console.log(`Home feed cache headers: ${uncompressedResponse.headers.get('cache-control')}`);
  console.log(`CloudFlare age: ${uncompressedResponse.headers.get('age') || 'not present'}`);
  
  // Now check with compression enabled
  const compressedResponse = await fetch(url, {
    headers: {
      'Accept-Encoding': 'gzip, deflate',
      'User-Agent': 'KiwiNews-CompressionTest/1.0'
    },
    agent: httpsAgent,
    compress: false // Important: disable built-in decompression
  });
  
  // Use content-length header instead of reading the body
  // because node-fetch automatically decompresses responses
  const compressedSize = parseInt(compressedResponse.headers.get('content-length') || '0', 10);
  
  // If content-length is missing (chunked encoding), we need to get the raw body
  if (compressedSize === 0) {
    console.log(`NOTE: No content-length header, using curl to check compressed size`);
    try {
      // Use curl to get the actual compressed size
      const { execSync } = await import('child_process');
      const cmd = `curl -k -s -H "Accept-Encoding: gzip, deflate" ${url} | wc -c`;
      const result = execSync(cmd).toString().trim();
      console.log(`  - curl compressed size result: ${result}`);
      
      // If we got a valid number from curl, use that
      if (/^\d+$/.test(result)) {
        const curlSize = parseInt(result, 10);
        console.log(`  - Using curl size: ${curlSize} bytes`);
        compressedResponse.curlSize = curlSize;
      }
    } catch (error) {
      console.error('Error running curl:', error);
    }
  }
  
  // Check if compression is enabled
  const contentEncoding = compressedResponse.headers.get('content-encoding');
  
  // First verify content-encoding header exists
  const headerExists = contentEncoding && 
    (contentEncoding.includes('gzip') || contentEncoding.includes('deflate'));
    
  // Get the compressed size, using curl result if available
  const effectiveCompressedSize = compressedResponse.curlSize || compressedSize;
  
  // Then verify that compression is actually happening (compressed size should be smaller)
  const actuallyCompressed = effectiveCompressedSize < uncompressedSize * 0.9; // Should be at least 10% smaller
  
  const isCompressed = headerExists && actuallyCompressed;
  
  // Print detailed diagnostics
  console.log(`Home feed response details:`);
  console.log(`  - Status: ${compressedResponse.status}`);
  console.log(`  - Uncompressed size: ${(uncompressedSize/1024).toFixed(1)}KB`);
  console.log(`  - Compressed size: ${(effectiveCompressedSize/1024).toFixed(1)}KB`);
  console.log(`  - Content-Encoding: ${contentEncoding || 'none'}`);
  console.log(`  - Transfer-Encoding: ${compressedResponse.headers.get('transfer-encoding') || 'none'}`);
  
  // Diagnostics for compression
  console.log(`  - Compression header present: ${headerExists ? 'YES' : 'NO'}`);
  console.log(`  - Compression ratio: ${(effectiveCompressedSize/uncompressedSize*100).toFixed(1)}%`);
  console.log(`  - Actually compressed: ${actuallyCompressed ? 'YES' : 'NO'}`);
  
  if (isCompressed) {
    console.log(`✅ Compression IS working properly`);
  } else {
    console.log(`⚠️ WARNING: Compression NOT working properly`);
    if (headerExists && !actuallyCompressed) {
      console.log(`  - The content-encoding header is present but compression is not actually reducing the size.`);
      console.log(`  - This may indicate that gzip is configured but not working properly.`);
    } else if (!headerExists) {
      console.log(`  - The content-encoding header is missing.`);
      console.log(`  - Compression middleware may not be installed or not working.`);
    }
    console.log(`Response headers:`);
    console.log(JSON.stringify(Object.fromEntries([...compressedResponse.headers.entries()]), null, 2));
  }
  
  // Two key assertions:
  t.true(isCompressed, 'Home feed should be compressed');
  
  // If compressed, we also need to check the size is under threshold
  if (isCompressed) {
    t.true(
      effectiveCompressedSize < SIZE_CRITICAL_THRESHOLD,
      `Compressed size (${effectiveCompressedSize} bytes) should be under ${SIZE_CRITICAL_THRESHOLD} bytes`
    );
  }
});
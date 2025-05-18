# Home Feed Compression Test

This test verifies that HTTP compression is properly enabled for the home feed. This is crucial for ensuring that our CloudFlare caching works correctly.

## Background

When response sizes exceed a certain threshold (~150KB), CloudFlare may stop performing background revalidation of cached content. This results in stale content being served to users. By implementing compression, we significantly reduce response sizes (by about 91%), allowing CloudFlare to continue performing background revalidation.

## Test Description

The `compression_test.mjs` file focuses on the home feed page (/), which is our most critical page for CloudFlare caching. The test:

1. Checks if compression is enabled by examining the Content-Encoding header
2. Verifies that the compressed size is under 150KB
3. Provides detailed diagnostics about compression ratios and response sizes

## GitHub Actions Integration

We have set up two GitHub Actions workflows:

1. **Regular CI Tests** (`node.js.yml`): Runs all tests including compression tests
2. **Dedicated Compression Tests** (`compression-test.yml`): Runs only compression tests on a schedule (every 6 hours)

The dedicated workflow runs tests against the development server (91.107.210.214).

## Configuration

The tests are configured to always test against the development server:

- Host: `https://91.107.210.214`
- API Host: `https://91.107.210.214:8443`
- SSL verification is disabled with `NODE_TLS_REJECT_UNAUTHORIZED=0` since we're testing against an IP address

## Running Tests Locally

To run the compression tests locally:

```bash
# Run the compression tests
npm run test:compression

# Alternative: Run using the standard test command
npm test test/compression_test.mjs
```

## Interpreting Results

- Uncompressed response size should be under 150KB (critical threshold)
- When response size is over 10KB, compression should be enabled
- Compression ratio should be below 0.5 (at least 50% reduction)
# Coding Conventions

1. JavaScript/ES Style
   1.1. Import Organization
       - Node stdlib imports first
       - NPM package imports second
       - Local file imports third
       - Blank line between each group
   1.2. Async Code Patterns
       - Prefer async/await for sequential operations
       - Use Promise.allSettled for parallel operations
       - Never use Promise.all (fails entire chain on single error)
       - Consider promises when blocking would harm performance
   1.3. Use single short words as variables over camelCase
   1.4. Early Returns
       - Return or throw early to avoid nesting
       - Keep code flat, avoid nested if statements
       - Handle failure cases first
   1.5. One statement per try {} block in try/catch
   1.6. Function Parameter Declaration
       - Always declare parameters as variables first for clarity:
       ```js
       const key1 = a
       const key2 = b
       function(key1, key2)
       ```
       This ensures every parameter has a clear, named purpose

2. Code Quality
   2.1. Comments only for information not expressed in code
   2.2. CSS Organization
       - Use inline styles for all possible styling
       - Only use CSS files for media queries and other special cases
   2.3. Prefer open source over commercial/proprietary dependencies
   2.4. Maximum line length of 80 characters
   2.5. Indentation
       - Use 2 spaces for indentation
       - No tabs, convert to spaces (expandtab)

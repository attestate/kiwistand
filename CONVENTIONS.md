# Coding & Design Conventions

This conventions file is written to help
[aider](https://aider.chat/docs/usage/conventions.html) comply with our
conventions.

## Principles

- Always make chirurgical changes. Never try to improve any of the surrounding
  code, just make the intented change and minimize the change set.
- Keep the change set to achieve something minimal and elegant. We highly
  prefer a narrow solution and then to iterate on it.
- Avoid regressions at all costs. If unsure about what to prioritize then take
  the top five options and rank them based on their impact versus their risk of
  introducing a regression.

## 1. JavaScript/ES Style

### 1.1. Import Organization
- Node stdlib imports first
- NPM package imports second  
- Local file imports third
- Blank line between each group

### 1.2. Async Code Patterns
- Prefer async/await for sequential operations
- Use Promises (then and catch) if there is a code block that can be executed
  without having to await its result
- Use Promise.allSettled for parallel operations
- Never use Promise.all (fails entire chain on single error)

### 1.3. Variable Naming
- Use single short words as variables over camelCase
- Within a module or a context you can use quite generic names that then
  resolve within the name space. E.g. in a module named "email" you can call a
  function "send" and it then should be used as "email.send"

### 1.4. Early Returns
- Return or throw early to avoid nesting
- Keep code flat, avoid nested if statements
- Handle failure cases first

### 1.5. Error Handling
- One statement per try {} block in try/catch

### 1.6. Function Parameter Declaration
Always declare parameters as variables first for clarity:
```js
const key1 = a
const key2 = b
function(key1, key2)
```
This ensures every parameter has a clear, named purpose and improves code
readability.

### 1.7. Keep functions pure and stateless
- Don't try to maintain state through complex classes etc., instead write a
  series of pure functions that all do one thing well.

## 2. Code Quality

### 2.1. Comments
- Comments only for information not expressed in code

### 2.2. CSS Organization  
- Use inline styles for all possible styling
- Only use CSS files for media queries and other special cases

### 2.3. Dependencies
- Prefer open source over commercial/proprietary dependencies

### 2.4. Formatting
- Maximum line length of 80 characters

### 2.5. Indentation
- Use 2 spaces for indentation
- No tabs, convert to spaces (expandtab)

### 2.6. Don't embrace abstractions
- Abstractions always leak.
- Tightly act according to scope
- Abstractions grow naturally through iteration on code through making
  chirurgical changes. These are acceptable abstractions

## 3. Design & Branding Guidelines

### 3.1. CSS Variables
- Always use the authoritative CSS variables defined in src/public/news.css:root
- Reference the root variables for colors, borders, fonts and other design tokens
- Never hardcode values that are defined in the root variables

### 3.2. Typography
- Use Inter font family exclusively
- Default text color should be black
- Implement clear text hierarchy based on content relevance:
  * Prioritize primary information for immediate comprehension
  * De-emphasize secondary and tertiary information
  * Use visual weight and spacing to create natural reading flow
- Utilize browser features to reduce visual clutter:
  * Apply :visited pseudo-class for viewed links
  * Implement hover states thoughtfully
- Desktop links must have text-decoration: underline on hover

### 3.3. Components & Layout
- Border radius must always be 2px
- Primary buttons must follow #button-onboarding style from news.css:
  * Border radius: 2px
  * Clear hover states
  * Consistent padding
  * Black background with white text in base state

### 3.4. Mobile-First Design
- Design mobile layouts first
- Follow Apple's touch target size recommendations:
  * Minimum 44x44 points for all touch targets
  * Maintain adequate spacing between interactive elements
- Ensure proper scroll margins for mobile
- Use appropriate text sizes for mobile readability
- Consider thumb zones in mobile layouts

### 3.5. Interaction Design
- Clear hover states for interactive elements
- Consistent touch feedback on mobile
- Use opacity changes to indicate state
- Implement proper touch-action handling
- Ensure proper user-select behavior

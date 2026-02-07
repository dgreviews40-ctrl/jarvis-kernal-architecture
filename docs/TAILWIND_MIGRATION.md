# Tailwind CSS Version Resolution

## Issue
Project had conflicting Tailwind CSS versions:
- **v3**: `tailwindcss@^3.4.19` in devDependencies (actively used)
- **v4**: `@tailwindcss/postcss@^4.1.18` and `@tailwindcss/vite@^4.1.18` in dependencies (unused)

## Root Cause
Tailwind CSS v4 was accidentally added alongside v3, creating:
1. Package duplication (wasted disk space)
2. Potential build conflicts
3. Confusion about which version is active

## Resolution
**Removed v4 packages** - Project is standardized on Tailwind v3.

### Removed Packages
```json
// From dependencies
"@tailwindcss/postcss": "^4.1.18"
"@tailwindcss/vite": "^4.1.18"
```

### Kept (v3)
```json
// In devDependencies
"tailwindcss": "^3.4.19"
"autoprefixer": "^10.4.24"
"postcss": "^8.5.6"
```

## Current Configuration (v3)

### CSS Entry (`src/index.css`)
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### PostCSS Config (`postcss.config.js`)
```js
export default {
  plugins: {
    'tailwindcss': {},
    'autoprefixer': {},
  },
}
```

### Tailwind Config (`tailwind.config.js`)
```js
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./App.tsx",
    "./**/*.{js,ts,jsx,tsx}"
  ],
  theme: { extend: { ... } },
  plugins: [],
}
```

## Migration to v4 (Future)

If upgrading to Tailwind v4 later:

1. **Install v4 packages:**
   ```bash
   npm install -D tailwindcss@latest
   npm install @tailwindcss/postcss @tailwindcss/vite
   ```

2. **Update CSS entry** to use v4 syntax:
   ```css
   @import "tailwindcss";
   ```

3. **Update PostCSS config:**
   ```js
   export default {
     plugins: {
       '@tailwindcss/postcss': {},
     },
   }
   ```

4. **Remove `tailwind.config.js`** (v4 uses CSS-based config)

5. **Test thoroughly** - v4 has breaking changes

## Verification

After running `npm install`, verify with:
```bash
npm ls tailwindcss
# Should show: tailwindcss@3.4.19

npm ls @tailwindcss/postcss
# Should show: (empty)
```

## Date
Fixed: 2026-02-06

# Plugin Marketplace

## Overview

The Plugin Marketplace allows users to discover, browse, and install plugins to extend JARVIS functionality.

## Features

### Browse & Search
- **Search**: Real-time search by name, description, or tags
- **Categories**: Filter by plugin category (utility, productivity, etc.)
- **Rating Filter**: Show only plugins with 4+ or 4.5+ stars
- **Verified Filter**: Show only verified plugins

### Plugin Cards
Each plugin displays:
- Icon and name
- Author and rating
- Description
- Download count and version
- Install button (or "Installed" badge)
- Verified badge (for verified plugins)

### Plugin Details
Click any plugin to view:
- Full description
- All tags
- Required permissions
- Dependencies
- Screenshots (if available)
- Install button with progress

### Featured Plugins
Curated list of top-rated, verified plugins shown on marketplace home.

## Access

### Method 1: Top Toolbar
Click the **purple Sparkles icon** in the top toolbar.

### Method 2: Plugin Manager
In the Plugin Manager panel, click the **"Marketplace"** button.

## Mock Data

The marketplace currently uses mock data with 8 example plugins:

| Plugin | Category | Rating | Verified |
|--------|----------|--------|----------|
| Hello World Demo | demo | 4.5 | ✅ |
| Weather Forecast | utility | 4.8 | ✅ |
| Calendar Integration | productivity | 4.2 | ❌ |
| Smart Home Hub | iot | 4.7 | ✅ |
| News Aggregator | media | 4.0 | ✅ |
| Fitness Tracker | health | 4.5 | ❌ |
| Crypto Price Tracker | finance | 4.3 | ✅ |
| Language Translator | utility | 4.6 | ✅ |

## API

```typescript
// Search plugins
const { plugins, error } = await searchPlugins('weather', {
  category: 'utility',
  verified: true,
  minRating: 4.5
});

// Get featured plugins
const { plugins } = await getFeaturedPlugins();

// Get plugin details
const { listing } = await getPluginDetails('weather.forecast');

// Install plugin
const { success, error } = await installFromMarketplace(
  'weather.forecast',
  (stage, progress) => console.log(`${stage}: ${progress}%`)
);

// Get marketplace stats
const stats = getMarketplaceStats();
// { totalPlugins, totalDownloads, averageRating, verifiedPlugins }
```

## Future Enhancements

- [ ] Real API backend
- [ ] User reviews and ratings
- [ ] Plugin versioning and updates
- [ ] Developer portal for submitting plugins
- [ ] Plugin analytics dashboard
- [ ] Paid/premium plugins
- [ ] Plugin dependencies auto-install

## File Structure

```
plugins/
  marketplace.ts       # Marketplace API
  types.ts             # TypeScript types
  
components/
  PluginMarketplace.tsx    # Main marketplace UI
  PluginManager.tsx        # Updated with marketplace link
```

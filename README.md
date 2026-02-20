# TimeTracker

A focused, offline-first time tracking PWA. Track time spent on tasks, analyse your patterns, and stay on top of what you're working on.

## Features

- **Folders & tasks** — Organise your work into a hierarchy of folders and tasks, each with a custom colour
- **Timer** — Start, pause, and stop a stopwatch-style timer for any task; continues running in the background and shows a floating widget when you navigate away
- **Analytics** — Bar chart of daily sessions, per-task averages, day-of-week breakdown, custom date ranges, and a category filter
- **Manual sessions** — Add sessions retroactively with a duration and start/end anchor
- **Dark mode** — Light, dark, or follows system preference
- **Offline-first PWA** — Fully cached by the service worker; works with no network connection
- **Import/export** — Back up and restore all data as JSON
- **IndexedDB storage** — All data stored locally on your device, never sent anywhere

## Getting started

```bash
# Install dependencies
npm install

# Dev server (hot reload)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

After running `npm run build`, the `dist/` folder contains a fully self-contained PWA. Deploy it to any static host (Netlify, Vercel, GitHub Pages, your own server).

## Tech stack

- **React 18 + TypeScript** (Vite)
- **CSS Modules** for scoped styling
- **IndexedDB** for persistent storage
- **vite-plugin-pwa + Workbox** for offline caching and service worker generation
- **DM Sans + DM Mono** typefaces

## Architecture

```
src/
  db/          IndexedDB wrapper (categories, sessions, settings)
  store/       React context + reducer for app-wide state
  components/  Shared UI (NavBar, TimerWidget, Button, Modal, ColorPicker)
  screens/     TimingScreen, AnalyticsScreen, CategoriesScreen, SettingsScreen
  types.ts     All TypeScript types
  colors.ts    20-colour task palette
  global.css   CSS custom properties + reset
```

## Including in a larger app

Each screen is a self-contained React component. The `AppProvider` handles all state. To embed TimeTracker:

1. Mount `<AppProvider>` somewhere above your app's router
2. Render `<App />` (or individual screens) wherever needed
3. CSS variables (`--bg`, `--text`, etc.) can be overridden by the parent app's theme
4. CSS Modules ensure no class name conflicts

## Notes

- Timer state is kept in memory (React context) and also persisted to IndexedDB with each pause/stop, so if the app is force-closed mid-session the interval will have an open end; the analytics layer handles this by treating open intervals as ending now
- On mobile, the timer continues running as long as the browser tab/PWA stays loaded; browsers may suspend service workers on some platforms

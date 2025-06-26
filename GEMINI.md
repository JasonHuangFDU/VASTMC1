# Project Overview
This is a web application for visualizing music artists' influence networks and career trajectories, named "oceanus-weaver".


# Tech Stack
- **Framework**: Vue.js 3
- **Build Tool**: Vite
- **Routing**: Vue Router
- **State Management**: Pinia
- **Visualization**: D3.js
- **Linting**: ESLint
- **Formatting**: Prettier

# Important Commands
- **Install dependencies**: `npm install`
- **Run development server**: `npm run dev`
- **Build for production**: `npm run build`
- **Preview production build**: `npm run preview`
- **Lint files**: `npm run lint`
- **Format code**: `npm run format`

# Coding Conventions
- Use Vue 3 Composition API for new components.
- Component names should be in PascalCase (e.g., `MyComponent.vue`).
- Use `const` over `let` where possible.
- offer explanation of generated code

# Directory Structure
- `src/components`: Reusable Vue components.
  - `src/components/controls`: UI control components like search bars.
  - `src/components/visualizations`: Charting and visualization components.
- `src/services`: Modules for data fetching and processing.
- `src/stores`: Pinia state management stores.
- `src/router`: Vue Router configuration.
- `public/`: Static assets, including the graph data files.

# Data description
- The origin data is `public/MC1_graph.json`
- The description about `MC1_graph.json` is in `public/VAST 2025 MC1 Data Description.pdf`

# Rules and Guidelines
- use Chinese to answer

# Sunpetal Valley

Sunpetal Valley is an underwater browser game about dressing up, farming, cooking, and exploration. This repository includes the animation playtest built on release v32. It uses JavaScript, Three.js, WebGL, and GLB models.

## Play

From the repository folder, serve the included build with Python 3:

```sh
python3 -m http.server 8000 --directory dist
```

Open http://localhost:8000 in a current desktop browser with WebGL. Use WASD or the arrow keys to move, E to interact, and L to open Life. Progress is saved in the browser.

## Rebuild

Use Node.js 20 or newer and npm. Install the pinned build dependencies and regenerate the portable 3D preview:

```sh
npm ci
npm run build:preview
```

The build writes `dist/index.html` and embeds optimized copies of the models and portraits. The standalone page can also be opened locally from a browser that permits local HTML files.

## Project map

| Path | Purpose |
| --- | --- |
| `dist/reef3d.js` | Player input, navigation, quest progression, and the cooking sequence |
| `dist/reef-activities.js` | Farming, wardrobe, cooking, crafting, and saved progress |
| `dist/reef-scene.js`, `dist/reef-layout.js`, `dist/reef-homestead.js` | Homebase, Moonlace Reef, Farm Island, cottage interior, and camera behavior |
| `dist/reef-avatar.js`, `dist/character-*.js`, `dist/reef-motion.js` | Outfits, rigs, movement, expressions, and animation |
| `dist/reef-juice.js`, `dist/luma.js` | Effects for actions and Luma's movement and reactions |
| `dist/characters/`, `dist/environment/`, `dist/vendor/` | Models, environment assets, and bundled browser runtime dependencies |
| `web/sunpetal.html.in`, `scripts/build-preview.mjs` | HTML template and preview build script |
| `ART-DIRECTION.md`, `sunpetal_step1/`, `dist/art-review/`, `dist/asset-import-review/` | Art direction, asset credits, and prior review materials |
| `SunpetalAssets_Fixed/` | Asset acquisition notes and historical downloader |

The included game and its build use the local asset copies. The historical downloader is optional.

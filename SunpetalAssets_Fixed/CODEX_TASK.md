# CODEX — SUNPETAL VALLEY ASSET IMPORT

You are working in the user's EXISTING playable underwater farming/crafting game repository. Preserve active game mechanics, controls, layout, and asset placement. This package is a sourcing pipeline; YOU must do the integration.

1. Discover engine/framework and inspect both Sunpetal Homebase and Moonlace Reef code. Confirm which repository you are actually editing; don't touch NOVA, Seraphina, or a staging-only HTML file.
2. Extract this folder inside the game repository. Run `python SunpetalAssets_Fixed/get_assets.py --dest <engine-public-assets-folder> --tint` with a path appropriate for the existing app. Example for Vite/Three.js: `public/assets/sunpetal`. If the runtime has no internet, report failure and provide one clear alternative. Never fake downloaded assets.
3. Read `<engine-public-assets-folder>/asset-manifest.json`; ONLY integrate entries with `status=downloaded`. If individual models fail, do not abort successful downloads; log exact error and request a verified catalog replacement. Use originals first; tint variants are previews. Rework texture maps/materials carefully for pearlescent Winx/Bratz/Monster High/Y2K underwater style (original creations, not copying trademarks).
4. Add a reusable GLB loader/cache with disposal and graceful failures, according to the project's existing engine. Inspect real dimensions/rotation before placing. Don't draw meshes as 2D sprites or add proxy primitives pretending to be external models.
5. Sunpetal: cluster coral/kelp/pebbles around courtyard perimeter, berry/plants by garden, flower basket near cottage. Keep central courtyard empty, path to town open, kitchen beside crops and creature nook near house.
6. Moonlace Reef: layer geodes, rock arch, cave, coral, kelp and glowing mushroom props. Keep entrance, travel corridors and fountain accessible. No extra collision on decorative props unless truly needed.
7. Fix perceived clay look: PBR material response, varied roughness, proper normals, textured sand, visually controlled bloom/emissive highlights, underwater haze and subtle particles. Avoid changing all materials to one shiny plastic material.
8. Use low-cost materials, texture compression and object instancing for iPhone Safari. Don't indiscriminately load all 16 at once; lazy-load per area. Don't download high-detail assets if a lightweight GLB exists.
9. Take before/after screenshots from same camera in BOTH areas. Report actual imported models, paths, GLB byte sizes, triangle counts when available, material replacements, FPS/performance where measurable, and failures. Run movement, transitions, and fountain interaction checks. Clearly distinguish unverified iPhone tests.
10. Both areas need independent >=65/100 concept-fidelity review AND all functional gates passing before you hand back for review; don't invent metrics. If blocked, report actual blocker rather than claim success.

Do not buy anything, use credits, deploy to production, or overwrite original source art without backups. Keep an asset credits/license manifest for future sources even though this Grab3D selection is CC0.

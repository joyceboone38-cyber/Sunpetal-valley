SUNPETAL ASSETS — REPAIRED CATALOG-RESOLVED HANDOFF

Previous downloader used guessed model slugs and could return 404. Do not use that script.

THIS VERSION fetches the official live models.json catalog ONCE, looks up each model by exact English display name, and uses its published GLB download URL. It never constructs API URLs from guessed slugs.

Codex command: python SunpetalAssets_Fixed/get_assets.py --dest public/assets/sunpetal --tint

If a model is missing, its asset-manifest.json entry is FAILED; continue with all successful models, report the failed names, and do not make up replacements.

No GLBs are included in this ZIP, and live download tests are not possible in this workspace. Requires internet in Codex. Original and tint files are saved separately.

Source: https://grab3d.com/developers/

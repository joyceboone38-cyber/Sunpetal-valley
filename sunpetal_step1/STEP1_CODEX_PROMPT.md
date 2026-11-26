# Sunpetal Valley — Step 1 Production Task for Codex

## Objective
Execute the **first high-impact improvement pass** for Sunpetal Valley.

This step is **not** about adding lots of new systems or remaking the game. It is focused on the fastest meaningful win:

1. Reduce the current clay-like look
2. Make the world feel alive
3. Improve materials, lighting, atmosphere, and scene dressing
4. Preserve gameplay and the approved layout

Target both:
- **Sunpetal Homebase**
- **Moonlace Reef**

---

## Main Result Expected
After this step, the game should feel:
- more underwater
- more magical
- more dimensional
- more polished
- less flat
- less matte
- less empty
- less like a rough prototype

Do **not** rebuild the game from scratch.
Do **not** replace approved area layouts.
Do **not** add bloated systems before visual polish.

---

## Priority Order

### Priority 1 — Material Polish Pass
Do a full visual material review.

#### Required changes
- Reduce flat matte surfaces
- Add stylized pearlescent / shell-like response where appropriate
- Add soft gloss and shimmer selectively
- Give crystals emissive glow
- Add subtle color variation to coral, plants, sand, rocks, paths, and props
- Improve roughness variation so not every surface reflects light the same way
- Fix obvious shading issues, bad normals, faceting, or material mismatches

#### Avoid
- making everything high-gloss
- plastic toy look
- muddy washed-out materials
- same roughness for every object

---

### Priority 2 — Lighting Pass
Build a coherent underwater lighting setup.

#### Required changes
- Add stronger top-down underwater key light
- Add soft ambient fill to prevent flat shading
- Add selective colored accent lighting (lavender / aqua / pink / pearl)
- Add glow to magical landmarks and crystals
- Add gentle depth fog or distance haze if supported
- Improve scene contrast without making it harsh

#### Nice-to-have if affordable
- subtle bloom
- subtle water-caustic style motion
- soft rim light on hero areas

#### Avoid
- overblown bloom
- darkness that hurts readability
- effects that make the game lag on mobile

---

### Priority 3 — Atmospheric Pass
Make the world feel alive.

#### Required changes
Add lightweight environmental motion such as:
- swaying kelp / sea plants
- drifting particles
- occasional bubbles
- soft shimmer in magical areas
- subtle animated background life if available

#### Rules
- keep animation gentle
- do not obscure gameplay
- preserve clear visibility for crops, paths, stations, and interactables
- do not add noisy visual clutter

---

### Priority 4 — Scene Dressing Pass
Reduce dead empty space.

Use existing and reusable assets first, especially from the previously provided SunpetalAssets package.

#### Add layered decoration with purpose
Possible assets:
- coral clusters
- sea grass
- kelp
- crystals
- glowing mushrooms
- shells
- pearls
- pebbles
- decorative rocks
- treasure accents
- baskets / crates / props
- farming detail props

#### Placement rules
- cluster items naturally
- preserve navigation space
- decorate edges, corners, borders, and focal points first
- keep central gameplay space readable
- use foreground / midground / background layering

#### Avoid
- random clutter scatter
- blocking walkways
- filling everything equally
- breaking the clean central courtyard feel

---

## Area-Specific Notes

### Sunpetal Homebase
Preserve:
- shell cottage
- open courtyard
- crop gardens
- creature nook
- kitchen near crops
- crafting/storage zones
- path to town

Improve:
- charm and richness of the cottage exterior
- decorative richness around paths and farming areas
- magical but usable look
- better material quality on architecture, paths, and props

Do not overcrowd the central area.

### Moonlace Reef
Make it feel distinct from Homebase.

Improve:
- reef depth
- magical glow
- crystal/coral drama
- layered silhouettes
- mood and atmosphere

Preserve path readability, transitions, and the fountain location/access.

---

## Technical Constraints
- Keep the project playable
- Do not introduce breaking changes
- Use lightweight effects suitable for browser + iPhone testing
- Reuse or adapt existing assets before making new ones
- Do not spend paid generation credits
- Keep draw calls and heavy transparency under control

---

## Acceptance Criteria for Step 1
This step passes only if all are true:

1. The world visibly looks less clay-like
2. Both areas feel more alive and underwater
3. Materials show more variation and polish
4. Lighting is clearly improved
5. Empty space is better dressed
6. Movement and interactions still work
7. Fountain access still works
8. Travel between areas still works
9. No major missing textures or broken assets
10. Mobile/browser playability remains reasonable

---

## Deliverables Required From Codex
For **each** location (Homebase and Moonlace Reef), provide:

1. Before screenshot
2. After screenshot from same camera
3. One close-up showing material/detail improvement
4. Short summary of what changed
5. List of changed files
6. Performance / playability notes
7. Remaining weaknesses

Also include a quick self-score out of 100 for:
- Materials (25)
- Lighting (20)
- Atmosphere (15)
- Scene dressing / richness (20)
- Readability + playability (20)

Minimum acceptable after this step: **65/100 per area**

Do not invent a passing score if the improvement is not visually obvious.

---

## Instruction to Codex
Work directly in the existing Sunpetal Valley project.
Use the previously provided asset package if helpful.
Prioritize real visual improvement over task-box completion.
Stop only if you hit a real technical blocker or once Step 1 is substantially complete.

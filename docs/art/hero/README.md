# Hero Art

Job ID: `hero` (勇者). R1 was approved after the style revision.
The shared illustration reference is `crusader`, the red-haired female 聖戦士.

## Identity And Progression

Preserve the existing blond male hero, blue eyes, blue and gold clothing,
silver sword, blue shield, and holy emblems. Use the approved
`hero-r1-final.png` directly for the face, anatomy, pose, and fine shading.

- R1: blue tunic and scarf, modest silver armor, simple sword and shield.
- R2: layered shoulder and leg armor, small blue gems, reinforced shield.
- R3: gold chest detailing, sun emblem on the shield, decorated cape.
- R4: blue-gem circlet, ornate armor, larger sun shield and cape.
- R5: winged crown, richest gold/blue-gem armor, winged sword and sun shield.

Generate each rank as a separate transparent image. Keep the figure scale
and face fixed; grow equipment and decoration around the body.
Main integration was authorized by the user after the final art review.

## Import And Verification

`import-settings.json` records each source's measured main hair dome, chin,
cheeks, sole contour, and scale. `import-art.py` calls `tools/jobimg.py` with
the shared 90x92 frame and head top 9, then fixes the face anchor at [45, 20].
A five-source-pixel sampling allowance keeps the resampled foot contour clear
of the frame edge; it changes the displayed height by less than half a dot.

The approved hero R1 has a slightly shorter head than Crusader R1. The shared
review tool's `--require-photos` also imposes a 0.3-dot head tolerance against
Crusader, so this session uses its rendering without that option and checks
exact photo selection in `review-game.py`. `verify-import.py` checks every
hero rank against the approved hero R1 within 0.3 dots, shared head-top/face
anchors, and a 1.1-dot limit against Crusader. The measured values remain in
the reports; the reference and shared review tool are unchanged.

Run from the repository root with a server on port 8001:

```bash
python3 docs/art/hero/import-art.py
python3 tools/review-job-art.py hero --label 勇者 --url http://127.0.0.1:8001/ --output docs/art/hero/final-review
python3 docs/art/hero/verify-import.py
python3 docs/art/hero/review-game.py
node --check src/jobphotos.js
node --check sw.js
```

`sw.js` already lists all five hero image paths. Its asset list and `dos-dev`
cache key need no change. `src/jobart.js` has no overriding hero entry.
`final-review.png` is the six-character comparison from actual game rendering;
`game-verification.json` records full-body/bust selection, 56/36/26px canvas
content, and desktop/mobile startup checks. Drafts remain for traceability.

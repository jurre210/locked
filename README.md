# locked — 3d

**Live:** https://jurre210.github.io/locked/

A gallery and viewer for 3D models made in Blender. You can orbit, zoom, play the animations,
switch lighting, toggle wireframe, go fullscreen and save screenshots. Drag any `.glb`/`.gltf`
onto the page to view it locally; it is never uploaded.

## Adding a model

1. Export it into `models/` with the Blender tool:

   ```
   blender -b scene.blend --python tools\send_to_site.py -- --id my-model --name "my model" --collection MyCollection --tags "vehicle,animated" --desc "what it is"
   ```

   This writes `models/my-model.glb`. It uses Draco compression and bakes animations,
   constraints and drivers. It also writes a poster (`models/my-model.jpg`) and adds the model
   to the top of `models/models.json`.
   Procedural materials are flattened to plain colours, because glTF can't carry node setups.
2. Run `2 - PUBLISH.cmd` to commit and push. GitHub Pages rebuilds in about a minute.

## Local preview

`start.cmd` (or `node server.js`), then open http://localhost:5180

## Files

| Path | What it is |
|---|---|
| `index.html`, `css/style.css`, `js/viewer.js` | The site: three.js 0.169 from jsdelivr, no build step |
| `models/models.json` | The library: id, name, file, poster, tags, description, date |
| `models/*.glb`, `models/*.jpg` | The models and their posters |
| `tools/send_to_site.py` | Blender to site exporter |

The old minigames (locked, basement, songless …) were removed on 2026-10-30. They are still in
the git history; commit `08c06bc` is the last version that had them.

"""Send a Blender model to the locked 3d site.

Exports a collection (or the selection) to models/<id>.glb (Draco, animations sampled so
constraints/drivers come along), renders a poster with the scene camera if there is one,
and adds/updates the entry in models/models.json. Publish with "2 - PUBLISH.cmd".

Headless:
    blender -b scene.blend --python tools/send_to_site.py -- --id my-model --name "my model"
            [--collection Name] [--desc "..."] [--tags "a,b"] [--poster path.png]
Inside Blender's Python console: exec(open(r"...\\tools\\send_to_site.py").read()) with
sys.argv set the same way, or select objects first and omit --collection.
"""
import bpy, sys, os, json, datetime

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
opt = {}
i = 0
while i < len(argv):
    if argv[i].startswith('--'):
        opt[argv[i][2:]] = argv[i + 1] if i + 1 < len(argv) else ''
        i += 2
    else:
        i += 1
mid = opt.get('id') or os.path.splitext(os.path.basename(bpy.data.filepath))[0].lower().replace(' ', '-')
name = opt.get('name', mid.replace('-', ' '))
out_glb = os.path.join(SITE, 'models', mid + '.glb')
out_jpg = os.path.join(SITE, 'models', mid + '.jpg')
sc = bpy.context.scene

# materials driven by procedural nodes can't be expressed in glTF: fall back to flat values
for m in bpy.data.materials:
    if not m.node_tree:
        continue
    b = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if b is None:
        continue
    for sock, prop in (('Base Color', 'gltf_base'), ('Roughness', 'gltf_rough'), ('Metallic', 'gltf_metal')):
        s = b.inputs[sock]
        if s.is_linked:
            for l in list(s.links):
                if l.from_node.type != 'TEX_IMAGE':
                    m.node_tree.links.remove(l)
                    if prop in m:
                        v = m[prop]
                        s.default_value = (*v, 1) if sock == 'Base Color' else float(v)
                    elif sock == 'Base Color':
                        s.default_value = tuple(m.diffuse_color)

# selection
if 'collection' in opt:
    col = bpy.data.collections[opt['collection']]
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for c in [col] + list(col.children_recursive):
        for o in c.objects:
            if o.name in bpy.context.view_layer.objects and not o.hide_render:
                o.hide_set(False)
                o.select_set(True)

opts = dict(filepath=out_glb, export_format='GLB', use_selection=True, export_apply=True,
            export_animations=True, export_force_sampling=True, export_cameras=False, export_lights=False,
            export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6, export_yup=True)
props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
for k, v in (('export_bake_animation', True), ('export_gn_mesh', True), ('export_optimize_animation_size', True)):
    if k in props:
        opts[k] = v
bpy.ops.export_scene.gltf(**opts)

# poster: given image, or a quick Eevee render through the scene camera
poster = opt.get('poster')
if not poster and sc.camera:
    r = sc.render
    keep = (r.engine, r.resolution_x, r.resolution_y, r.resolution_percentage, r.filepath)
    try:
        r.engine = 'BLENDER_EEVEE'
    except TypeError:
        pass
    r.resolution_x, r.resolution_y, r.resolution_percentage = 960, 540, 100
    r.filepath = out_jpg[:-4] + '_poster.png'
    bpy.ops.render.render(write_still=True)
    poster = r.filepath
    r.engine, r.resolution_x, r.resolution_y, r.resolution_percentage, r.filepath = keep
if poster:
    img = bpy.data.images.load(poster)
    if img.size[0] > 960:
        img.scale(960, int(img.size[1] * 960 / img.size[0]))
    img.file_format = 'JPEG'
    img.filepath_raw = out_jpg
    bpy.context.scene.render.image_settings.quality = 85
    img.save()
    if poster.endswith('_poster.png') and os.path.exists(poster):
        os.remove(poster)

# models.json: newest first, replace an entry with the same id
lib = os.path.join(SITE, 'models', 'models.json')
data = json.load(open(lib, encoding='utf-8')) if os.path.exists(lib) else {'models': []}
entry = {'id': mid, 'name': name, 'file': f'models/{mid}.glb', 'bytes': os.path.getsize(out_glb),
         'made': datetime.date.today().isoformat(),
         'tags': [t.strip() for t in opt.get('tags', '').split(',') if t.strip()],
         'description': opt.get('desc', '')}
if os.path.exists(out_jpg):
    entry['poster'] = f'models/{mid}.jpg'
data['models'] = [entry] + [m for m in data['models'] if m.get('id') != mid]
json.dump(data, open(lib, 'w', encoding='utf-8'), indent=2)
print(f'[site] {mid}: {os.path.getsize(out_glb) / 1e6:.2f} MB -> {out_glb}', flush=True)

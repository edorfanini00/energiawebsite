#!/usr/bin/env python3
"""Inventory retained V3 art and verify the raw -> retouched -> web-master chain.
No rendering, retouching or encoding. Writes the private manifest in the evidence root.
Requires Pillow and numpy, already used by the retained retouch script.
"""
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image

root = Path(__file__).resolve().parents[1]
evidence = Path(sys.argv[1]).resolve()
art = evidence / 'art'
masters = art / 'masters'
def record(path, image=False):
    data = path.read_bytes()
    r = {'path': str(path), 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)}
    if image:
        with Image.open(path) as im:
            im.load()
            r.update(width=im.width, height=im.height, format=im.format)
    return r

retouches = {Path(r['src']).stem:r for r in map(json.loads, (masters/'retouched/retouch-log.jsonl').read_text().splitlines())}
manifest = {
    'schema_version': 1, 'generated_at': datetime.now(timezone.utc).isoformat(),
    'project': 'Energia V3, selected direction B',
    'provenance': 'Original fictional architecture; preserved Blender 5.2.1 Cycles renders. No new renders in continuation.',
    'scene': record(art/'blend/v3-c2-final.blend'),
    'scripts': [record(art/'scripts'/s) for s in ['build_scene.py','render_view.py','run_render.sh','run_finals.sh','retouch_horizon.py']] + [record(root/'scripts/export-art.sh')],
    'render_status': record(masters/'finals-status.log'),
    'export_log': record(art/'logs/export.log'),
    'retouch_log': record(masters/'retouched/retouch-log.jsonl'),
    'encoding': {'resize': 'ffmpeg Lanczos rgb24, width:-2', 'webp': 'cwebp -q 80 -m 6 -sharp_yuv -metadata none', 'avif': 'avifenc -q 60 -s 4 -y 444 -j all'},
    'masters': [], 'exports': [],
    'limitations': ['Render receipts identify temporary scene copies, not full scene hashes; final status records a 16-character scene hash prefix, checked here against the retained scene. Full current hashes do not retroactively add missing receipt fields.', 'Export log has no per-file source hashes; current source chain, dimensions and full hashes are inventoried, but no fresh encoding or rerender was performed.']
}
assert manifest['scene']['sha256'][:16] in (masters/'finals-status.log').read_text()
for path in sorted(masters.glob('*.png')):
    name = path.stem
    raw = record(path, True)
    receipt_path = path.with_suffix('.receipt.json')
    receipt = json.loads(receipt_path.read_text())
    assert receipt['res'] == [raw['width'], raw['height']]
    assert receipt['pct'] == 100 and not receipt['clay']
    assert 'RENDER_DONE' in path.with_suffix('.log').read_text()
    assert f'rc=0 {name}' in (masters/'finals-status.log').read_text()
    web = record(masters/'web'/path.name, True)
    entry = {'id':name, 'raw':raw, 'render_receipt':record(receipt_path), 'render_log':record(path.with_suffix('.log')), 'render':receipt, 'web_master':web, 'retouch':None}
    if name in retouches:
        r = retouches[name]
        retouched = record(Path(r['dst']), True)
        assert raw['sha256'] == r['src_sha256']
        assert retouched['sha256'] == r['dst_sha256'] == web['sha256']
        before = np.array(Image.open(path).convert('RGB'))
        after = np.array(Image.open(r['dst']).convert('RGB'))
        changed = np.any(before != after, axis=2)
        ys, xs = np.where(changed)
        assert len(ys) == r['pixels']
        assert ys.min() >= min(r['band'])-1 and ys.max() <= max(r['band'])+1
        # The mask is restricted to flat sky runs reaching the frame edge.
        r0, r1 = min(r['band'])-2, max(r['band'])+2
        luminance = before.astype(float).mean(2)
        above, below = luminance[r0-10:r0+1], luminance[r1:r1+11]
        sky = (above.std(0)<2.5)&(below.std(0)<2.5)&(abs(above.mean(0)-below.mean(0))<12)
        support = np.zeros_like(sky)
        i=0
        while i<len(sky):
            if not sky[i]: i+=1; continue
            end=i
            while end+1<len(sky) and sky[end+1]: end+=1
            if end-i+1>=20 and (i==0 or end==len(sky)-1): support[i:end+1]=True
            i=end+1
        assert support[xs].all()
        entry['retouch'] = {'file':retouched, 'receipt':r, 'verified_changed_pixels':int(changed.sum()), 'changed_bounds':[int(xs.min()),int(ys.min()),int(xs.max()),int(ys.max())], 'outside_edge_sky_support_unchanged':True}
    else:
        assert raw['sha256'] == web['sha256']
    manifest['masters'].append(entry)
    widths = [780,1170] if name=='hero-phone' else [1440,2160,2880] if name=='hero-desktop' else [1400,2100,2800] if name=='plan-desktop' else [600,900,1200] if name.endswith('phone') else [1200,1800,2400]
    for width in widths:
        for ext in ['avif','webp']:
            export = record(root/'assets/img'/f'{name}-{width}.{ext}', True)
            assert export['width'] == width
            assert abs(export['height']-width*raw['height']/raw['width']) <= 1
            export.update(master_id=name, source_sha256=web['sha256'], source_path=web['path'])
            manifest['exports'].append(export)
assert len(manifest['masters']) == 12
assert len(manifest['exports']) == len(list((root/'assets/img').iterdir())) == 70
manifest['counts'] = {'raw_masters':12,'retouched_masters':len(retouches),'web_masters':12,'responsive_exports':70}
manifest['export_bytes'] = sum(e['bytes'] for e in manifest['exports'])
manifest['count_correction'] = 'The inherited continuation said 56 exports. Actual script, file inventory and decoded images establish 70: hero 10 + day 48 + plan 12.'
(evidence/'ART-MANIFEST.json').write_text(json.dumps(manifest, indent=2)+'\n')
print(json.dumps({'counts':manifest['counts'], 'export_bytes':manifest['export_bytes'], 'scene_sha256':manifest['scene']['sha256'], 'manifest':str(evidence/'ART-MANIFEST.json')},indent=2))

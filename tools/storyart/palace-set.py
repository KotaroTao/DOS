"""王宮の撮影用セット。Blender 4.3以降で実行する。ゲーム画像は変更しない。

blender -b -t 8 --python tools/storyart/palace-set.py -- --views front --width 1536
保存済みセットから再撮影:
blender -b docs/art/story-refs/palace-3d/palace.blend -t 8 \
  --python tools/storyart/palace-set.py -- --reuse --views left,right
"""
import argparse
import json
import math
import random
import subprocess
import sys
import tempfile
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'docs/art/story-refs/palace-3d'
VIEWS = {
    'front': ((0, -8.7, 2.4), (0, 7.0, 3.3), 27),
    'left': ((-4.8, -3.7, 2.8), (0.4, 7.1, 3.0), 25),
    'right': ((4.8, -3.7, 2.8), (-0.4, 7.1, 3.0), 25),
    'reverse': ((-2.1, 8.6, 3.2), (0, -7, 3.6), 23),
    'high': ((-4.8, -7.0, 7.7), (0.2, 5.2, 1.8), 24),
    'audience': ((-2.5, 3.3, 2.25), (0.1, 7.7, 2.85), 32),
}


def mat(name, color, metallic=0, roughness=.5, texture=False, emission=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    n = m.node_tree.nodes
    bs = n.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = (*color, 1)
    bs.inputs['Metallic'].default_value = metallic
    bs.inputs['Roughness'].default_value = roughness
    if emission:
        bs.inputs['Emission Color'].default_value = (*color, 1)
        bs.inputs['Emission Strength'].default_value = emission
    if texture:
        tex = n.new('ShaderNodeTexNoise')
        tex.inputs['Scale'].default_value = 7 if name == '石灰岩' else 28
        tex.inputs['Detail'].default_value = 3
        ramp = n.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].position = .15
        ramp.color_ramp.elements[0].color = (*(c * .55 for c in color), 1)
        ramp.color_ramp.elements[1].position = .85
        ramp.color_ramp.elements[1].color = (*(min(1, c * 1.4) for c in color), 1)
        m.node_tree.links.new(tex.outputs['Fac'], ramp.inputs[0])
        m.node_tree.links.new(ramp.outputs[0], bs.inputs['Base Color'])
        bump = n.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = .18
        bump.inputs['Distance'].default_value = .035
        m.node_tree.links.new(tex.outputs['Fac'], bump.inputs['Height'])
        m.node_tree.links.new(bump.outputs[0], bs.inputs['Normal'])
    return m


def finish(o, name, material, bevel=0):
    o.name = name
    if material:
        o.data.materials.append(material)
    if bevel:
        mod = o.modifiers.new('角の面取り', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
        o.modifiers.new('面の法線', 'WEIGHTED_NORMAL')
    return o


def box(name, loc, size, material, bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(o, name, material, bevel)


def cyl(name, loc, radius, depth, material, vertices=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc)
    return finish(bpy.context.object, name, material, .015)


def ball(name, loc, radius, material, scale=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=radius, location=loc)
    o = finish(bpy.context.object, name, material)
    if scale:
        o.scale = scale
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def line(name, pts, radius, material, cyclic=False):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.resolution_u = 1
    curve.bevel_depth = radius
    curve.bevel_resolution = 2
    sp = curve.splines.new('POLY')
    sp.points.add(len(pts) - 1)
    for p, xyz in zip(sp.points, pts):
        p.co = (*xyz, 1)
    sp.use_cyclic_u = cyclic
    o = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(material)
    return o


def panel(name, pts, material):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(pts, [], [tuple(range(len(pts)))])
    mesh.update()
    o = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(material)
    return o


def arch_points(cx, y, bottom, width, spring, top):
    r = width / 2
    pts = [(cx - r, y, bottom), (cx - r, y, spring)]
    for i in range(1, 25):
        t = i / 24
        pts.append((cx - r * (1 - t * t), y,
                    (1-t)**2 * spring + 2*t*(1-t)*(spring + (top-spring)*.7) + t*t*top))
    for i in range(1, 25):
        t = 1 - i / 24
        pts.append((cx + r * (1 - t * t), y,
                    (1-t)**2 * spring + 2*t*(1-t)*(spring + (top-spring)*.7) + t*t*top))
    pts.append((cx + r, y, bottom))
    return pts


def arch(name, cx, y, bottom, width, spring, top, material, radius=.06, fill=None):
    pts = arch_points(cx, y, bottom, width, spring, top)
    if fill:
        panel(name + '・面', pts, fill)
    return line(name, pts, radius, material)


def light(name, loc, target, color, energy, size=3, kind='AREA'):
    data = bpy.data.lights.new(name, kind)
    data.color = color
    data.energy = energy
    if kind == 'AREA':
        data.shape = 'DISK'
        data.size = size
    else:
        data.shadow_soft_size = size
    o = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = (Vector(target) - o.location).to_track_quat('-Z', 'Y').to_euler()
    o.visible_camera = False
    return o


def build():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    random.seed(19)
    stone = mat('石灰岩', (.19, .225, .27), roughness=.76, texture=True)
    darkstone = mat('黒い磨き石', (.035, .045, .058), .22, .3, True)
    trim = mat('石の縁', (.29, .32, .36), .05, .6, True)
    iron = mat('黒鉄', (.022, .026, .035), .75, .33)
    gold = mat('古い金', (.53, .30, .072), .72, .28, True)
    cloth = mat('深紅の織物', (.19, .008, .024), 0, .83, True)
    wood = mat('暗い樫', (.06, .028, .019), 0, .68, True)
    wax = mat('白いろう', (.8, .69, .43), 0, .6)
    flame = mat('ろうそくの火', (1, .38, .065), emission=8)
    sky = mat('窓外の夜空', (.055, .16, .39), emission=.8)
    sky_bs=sky.node_tree.nodes.get('Principled BSDF')
    sky_bs.inputs['Base Color'].default_value=(0,0,0,1)
    sky_bs.inputs['Specular IOR Level'].default_value=0
    sky_bs.inputs['Roughness'].default_value=1
    glass = mat('窓の菱形組み', (.11, .15, .21), .45, .4)

    # 南が入口、北が玉座。人物を含まない一つの建物。
    box('基礎', (0, 0, -.22), (14.8, 22, .4), darkstone)
    for ix in range(-7, 7):
        for iy in range(-10, 10):
            tile = box('床石', (ix+.5, iy+.5, -.035), (.98, .98, .07), darkstone, .012)
    # 五段の階段。北へ進むごとに一段ずつ高くなる。
    for i in range(5):
        south = 4.2 + i * .44
        top = .2 * (i + 1)
        box('玉座の壇・第%d段' % (i+1), (0, (south+9.8)/2, top/2),
            (10.8-i*.36, 9.8-south, top), darkstone, .035)
        line('段鼻の金縁', [(-5.4+i*.18, south-.025, top), (5.4-i*.18, south-.025, top)], .014, gold)
    box('中央の深紅の通路', (0, -3.0, .018), (2.5, 14.4, .025), cloth)
    for x in (-1.18, 1.18):
        box('通路の金糸の縁', (x, -3.0, .035), (.045, 14.4, .008), gold)
    for i in range(5):
        y = 4.2 + i*.44
        z = (i+1)*.2
        box('階段の絨毯', (0, y+.22, z+.018), (2.5, .44, .025), cloth)
        box('階段の絨毯・垂直', (0, y-.012, z-.1), (2.5, .025, .2), cloth)
        for x in (-1.18, 1.18):
            box('階段の金糸', (x, y+.22, z+.035), (.045, .44, .008), gold)
    box('壇上の絨毯', (0, 7.9, 1.018), (2.5, 3, .025), cloth)
    for x in (-1.18, 1.18):
        box('壇上の金糸', (x, 7.9, 1.035), (.045, 3, .008), gold)
    for y in [i*.48-9.7 for i in range(29)]:
        for x in (-1.07, 1.07):
            line('絨毯の菱形刺しゅう', [(x, y, .036), (x+.07, y+.13, .036),
                 (x, y+.26, .036), (x-.07, y+.13, .036)], .009, gold, True)

    # 壁と細い石積みの目地。
    for x in (-7.1, 7.1):
        box('側壁', (x, 0, 5), (.45, 20.5, 10), stone)
        for z in (1.2, 3.2, 6.0, 9.4):
            box('側壁の水平帯', (x*.975, 0, z), (.22, 20.5, .14), trim, .02)
    box('北壁', (0, 10, 6.5), (14.5, .45, 13), stone)
    box('南壁', (0, -10.3, 6.5), (14.5, .45, 13), stone)
    for z in [i*.6+.3 for i in range(17)]:
        box('北壁の目地', (0, 9.765, z), (14, .008, .012), darkstone)
        box('南壁の目地', (0, -10.06, z), (14, .008, .012), darkstone)
    for z in (1.2, 9.5):
        box('北壁の石帯', (0, 9.68, z), (14, .3, .18), trim, .03)

    # 束ね柱と、同じ支点を結ぶリブ。天井は暗い木組みのヴォールト。
    for x in (-5.9, 5.9):
        for y in (-8, -4, 0, 4, 9.3):
            box('柱の基壇', (x, y, .3), (1.25, 1.25, .6), darkstone, .05)
            for dx, dy, r in [(0, 0, .36), (-.32, 0, .14), (.32, 0, .14), (0, -.32, .14), (0, .32, .14)]:
                cyl('束ね柱', (x+dx, y+dy, 4.3), r, 7.5, stone)
            for z, r, h, m in [(.65,.58,.14,trim), (.85,.48,.12,gold), (7.7,.48,.16,gold), (7.92,.6,.22,trim)]:
                cyl('柱頭と柱脚', (x, y, z), r, h, m)
            if x < 0:
                pts = arch_points(0, y, 7.95, 11.8, 7.95, 11.8)[1:-1]
                line('天井の横断リブ', pts, .12, trim)
                line('天井の金のリブ', [(a,b,c-.12) for a,b,c in pts], .022, gold)
    # 閉じた曲面を、各リブの輪郭から作る。
    section = arch_points(0, 0, 7.95, 13.8, 7.95, 12.5)[1:-1]
    verts = [(x,y,z) for y in (-10.5,10.4) for x,_,z in section]
    count = len(section)
    faces = [(i,i+1,count+i+1,count+i) for i in range(count-1)]
    mesh = bpy.data.meshes.new('天井曲面')
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    roof = bpy.data.objects.new('閉じた天井', mesh)
    bpy.context.collection.objects.link(roof)
    roof.data.materials.append(darkstone)
    line('天井の棟', [(0,-10.2,12.4),(0,10,12.4)], .1, trim)

    # 玉座背後の尖頭装飾。中央に第二の玉座は作らない。
    arch('玉座背後の壁掛け', 0, 9.65, 1.2, 4.8, 6.4, 9.45, gold, .095, cloth)
    arch('背後の石枠', 0, 9.69, 1.05, 5.35, 6.5, 9.85, trim, .16)
    arch('背後の内側金枠', 0, 9.59, 1.3, 4.5, 6.4, 9.16, gold, .025)

    # 窓外は画像でなく同じセット内の簡素な夜空。窓の形と桟を固定する。
    for x in (-3.65, 3.65):
        arch('ランセット窓', x, 9.49, 1.3, 1.75, 7.25, 9.15, trim, .13, sky)
        arch('窓内の縁', x, 9.44, 1.35, 1.5, 7.2, 8.85, iron, .045)
        for dx in (-.32, .32):
            arch('窓の二連トレーサリー', x+dx, 9.4, 1.35, .64, 6.7, 7.6, trim, .035)
        for z in [1.5+i*.55 for i in range(11)]:
            for dx in (-.65, -.22, .22, .65):
                line('窓の菱形鉛桟', [(x+dx-.2,9.39,z),(x+dx+.2,9.39,z+.55)], .008, glass)
                line('窓の菱形鉛桟', [(x+dx+.2,9.39,z),(x+dx-.2,9.39,z+.55)], .008, glass)
        for i in range(5):
            angle = i*2*math.pi/5
            pts = [(x+.17*math.cos(t*2*math.pi/24)+.18*math.cos(angle),9.37,
                    8.0+.17*math.sin(t*2*math.pi/24)+.18*math.sin(angle)) for t in range(24)]
            line('窓上部の花形', pts, .025, trim, True)
        box('窓台', (x,9.32,1.3),(2.05,.65,.16),trim,.025)
        light('夜の窓光', (x,8.05,5.8),(0,2,1),(.27,.46,1),850,3)

    # 無紋章の金刺しゅう。十字架や新しい王家の印は作らない。
    for x in (-5.15,5.15):
        y=9.37
        pts=[(x-.48,y,9.3),(x+.48,y,9.3),(x+.48,y,4.1),(x,y,3.65),(x-.48,y,4.1)]
        panel('深紅の旗',pts,cloth)
        line('旗の金縁',[(a,b-.015,c) for a,b,c in pts],.025,gold,True)
        line('旗の横棒',[(x-.62,y,9.35),(x+.62,y,9.35)],.045,gold)
        for z in (4.5,5.5,6.5,7.5,8.5):
            line('旗の蔓模様',[(x,y-.02,z-.3),(x+.22,y-.02,z),
                 (x,y-.02,z+.3),(x-.22,y-.02,z)],.018,gold,True)

    # 玉座は北向きの壁を背にし、南を向く。すべてのカメラで同じ実体を使う。
    def chair(name,x,y,z,s):
        def b(label,offset,size,m,bev=.02):
            return box(name+'・'+label,(x+offset[0]*s,y+offset[1]*s,z+offset[2]*s),
                       tuple(v*s for v in size),m,bev*s)
        b('台座',(0,0,.1),(1.65,1.42,.2),iron)
        b('台座金帯',(0,-.02,.23),(1.64,1.45,.08),gold)
        for dx in (-.63,.63):
            for dy in (-.5,.5):
                b('脚',(dx,dy,.46),(.16,.16,.65),iron)
                ball(name+'・脚の金飾り',(x+dx*s,y+dy*s,z+.2*s),.13*s,gold)
        b('座面木枠',(0,0,.78),(1.6,1.3,.2),iron)
        b('座面の金縁',(0,-.03,.86),(1.55,1.3,.06),gold)
        b('深紅の座面',(0,-.02,.94),(1.27,1.12,.16),cloth,.065)
        arch(name+'・尖頭背もたれ',x,y+.5*s,z+.82*s,1.38*s,z+2.52*s,z+3.4*s,iron,.09*s,cloth)
        arch(name+'・背の金縁',x,y+.46*s,z+.84*s,1.22*s,z+2.48*s,z+3.22*s,gold,.032*s)
        arch(name+'・背の内縁',x,y+.43*s,z+1.04*s,1.01*s,z+2.4*s,z+3.05*s,gold,.012*s)
        for dx in (-.77,.77):
            b('背の支柱',(dx,.5,1.8),(.12,.12,2.8),iron)
            b('支柱の金帯',(dx,.5,2.8),(.17,.17,.07),gold)
            ball(name+'・背の頂飾り',(x+dx*s,y+.5*s,z+3.33*s),.07*s,gold, (1,1,2.8))
            b('肘掛け',(dx,-.1,1.36),(.23,1.1,.18),iron,.06)
            b('肘の深紅',(dx,-.1,1.45),(.17,.9,.08),cloth)
            b('肘の金支柱',(dx,-.56,1.02),(.1,.1,.63),gold)
            ball(name+'・肘の金飾り',(x+dx*s,y-.56*s,z+1.45*s),.11*s,gold)
        for iz in range(4):
            for ix in range(3):
                dx=(ix-1)*.28+(.13 if iz%2 else 0)
                ball(name+'・留め鋲',(x+dx*s,y+.42*s,z+(1.25+iz*.32)*s),.022*s,gold)
        for dx in (-.43,0,.43):
            line(name+'・前板の金細工',[(x+(dx-.17)*s,y-.68*s,z+.42*s),
                 (x+dx*s,y-.69*s,z+.69*s),(x+(dx+.17)*s,y-.68*s,z+.42*s)],.018*s,gold)
    chair('王の玉座',0,8.0,1.0,1.0)
    chair('宰相の小さな椅子',2.05,7.85,1.0,.66)
    # 西側の小卓。杯などの物語固有の小道具は置かない。
    cyl('小卓の脚',(-1.85,7.7,1.53),.09,1.05,gold)
    cyl('小卓の足',(-1.85,7.7,1.08),.38,.12,iron)
    cyl('小卓の天板',(-1.85,7.7,2.06),.5,.1,iron,48)
    cyl('小卓の金縁',(-1.85,7.7,2.08),.51,.035,gold,48)

    # 燭台は炎と実際の照明を分離し、光量を再現可能にする。
    def candelabra(x,y,z):
        cyl('燭台の足',(x,y,z+.1),.32,.2,iron)
        cyl('燭台の支柱',(x,y,z+.95),.06,1.7,gold)
        for dx in (-.26,0,.26):
            height = 1.9 if dx==0 else 1.65
            line('燭台の腕',[(x,y,z+1.25),(x+dx,y,z+1.45),(x+dx,y,z+height)],.035,gold)
            cyl('ろう受け',(x+dx,y,z+height),.09,.035,gold)
            cyl('白いろうそく',(x+dx,y,z+height+.14),.04,.28,wax)
            ball('炎',(x+dx,y,z+height+.33),.055,flame,(.7,.7,2.4))
        light('暖かな燭光',(x,y-.12,z+2),(x,y-1,z+1),(1,.54,.2),95,.5,'POINT')
    for x in (-4.4,4.4):
        candelabra(x,6.95,1)
    for x in (-5.3,5.3):
        for y in (-7,-2,3):
            candelabra(x,y,0)

    # 南の入口と上の小さな回廊。
    arch('南の入口',0,-9.99,0,3.3,4.4,6.4,trim,.15,wood)
    for x in (-1.4,-1,-.6,-.2,.2,.6,1,1.4):
        box('樫の扉の縦板',(x,-9.95,2.1),(.025,.03,4.1),iron)
    box('両開き扉の合わせ目',(0,-9.91,2.4),(.045,.04,4.8),iron)
    for z in (.6,1.8,3.7):
        box('扉の黒鉄の帯',(0,-9.88,z),(3.2,.08,.13),iron,.02)
        for x in (-1.35,-.85,-.35,.35,.85,1.35):
            ball('扉の鋲',(x,-9.82,z),.035,gold)
    for x in (-.22,.22):
        ball('扉の取手',(x,-9.76,2.1),.08,gold)
    box('南の回廊の床',(0,-9.6,6.95),(11.7,1.2,.25),stone,.03)
    for x in [i*.45-5.4 for i in range(25)]:
        cyl('回廊の手すり子',(x,-8.99,7.48),.035,.9,iron)
    box('回廊の金の手すり',(0,-8.99,7.96),(11.7,.1,.1),gold,.025)
    candelabra(-2.4,-9.1,0)
    candelabra(2.4,-9.1,0)
    light('南の青い環境光',(0,-8.5,6),(0,2,2),(.3,.42,.65),600,5)
    light('天井からの柔らかい補助光',(0,1,8),(0,5,0),(.48,.57,.74),1000,7)
    light('王の席の反射光',(0,5,5),(0,8,2),(1,.68,.34),450,4)
    light('入口側の反射光',(0,-5,4),(0,7,2),(.55,.61,.75),700,5)

    scene=bpy.context.scene
    scene.unit_settings.system='METRIC'
    scene.unit_settings.scale_length=1.0
    scene.world.color=(.055,.07,.11)
    scene.render.engine='CYCLES'
    scene.cycles.samples=32
    # 配布版によってはOpenImageDenoiseが無いため、外部デノイザーへ依存しない。
    scene.cycles.use_denoising=False
    scene.cycles.max_bounces=6
    scene.render.image_settings.file_format='PNG'
    scene.render.image_settings.color_mode='RGB'
    scene.view_settings.view_transform='AgX'
    scene.view_settings.look='AgX - Medium High Contrast'
    scene.view_settings.exposure=-1.0
    scene.render.film_transparent=False
    # 火の小さなにじみ。形状を変える画風変換は行わない。
    scene.use_nodes=True
    nodes=scene.node_tree.nodes
    nodes.clear()
    render=nodes.new('CompositorNodeRLayers')
    glow=nodes.new('CompositorNodeGlare')
    glow.glare_type='FOG_GLOW'
    glow.quality='MEDIUM'
    glow.threshold=2
    glow.mix=-.92
    output=nodes.new('CompositorNodeComposite')
    scene.node_tree.links.new(render.outputs['Image'],glow.inputs['Image'])
    scene.node_tree.links.new(glow.outputs['Image'],output.inputs['Image'])
    for name,(loc,target,lens) in VIEWS.items():
        data=bpy.data.cameras.new('camera-'+name)
        cam=bpy.data.objects.new('camera-'+name,data)
        bpy.context.collection.objects.link(cam)
        cam.location=loc
        cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler()
        cam.data.lens=lens
        cam.data.clip_end=150
    scene['座標系']='X=東、Y=北（玉座）、Z=上。単位m。南に入口。'
    scene['用途']='建築・構図の固定用3D原型。既存の基準画の完全な複製ではない。'
    scene['家具']='玉座(0,8,1)、宰相の椅子(2.05,7.85,1)、小卓(-1.85,7.7,1)'


def render_denoised(scene,path,oidn_path,python):
    import numpy as np
    with tempfile.TemporaryDirectory(prefix='dos-palace-') as temp:
        scene.render.image_settings.file_format='OPEN_EXR'
        scene.render.image_settings.color_mode='RGBA'
        scene.render.image_settings.color_depth='32'
        scene.render.filepath=str(Path(temp)/'linear.exr')
        bpy.ops.render.render(write_still=True)
        img=bpy.data.images.load(scene.render.filepath,check_existing=False)
        w,h=img.size
        rgba=np.empty(w*h*4,dtype=np.float32)
        img.pixels.foreach_get(rgba)
        rgba=rgba.reshape(h,w,4)
        color=np.ascontiguousarray(rgba[:,:,:3])
        try:
            src=Path(temp)/'color.npy'
            dst=Path(temp)/'denoised.npy'
            np.save(src,color)
            subprocess.run([python,str(ROOT/'tools/storyart/palace-denoise.py'),
                            '--oidn-path',str(Path(oidn_path).resolve()),
                            '--input',str(src),'--output',str(dst)],check=True)
            output=np.load(dst)
            rgba[:,:,:3]=output
            img.pixels.foreach_set(rgba.ravel())
            scene.render.image_settings.file_format='PNG'
            scene.render.image_settings.color_mode='RGB'
            scene.render.image_settings.color_depth='8'
            img.save_render(str(path),scene=scene)
            print('ノイズ除去済みPNG: '+str(path),flush=True)
        finally:
            bpy.data.images.remove(img)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--views',default=','.join(VIEWS))
    parser.add_argument('--width',type=int,default=1536)
    parser.add_argument('--samples',type=int,default=32)
    parser.add_argument('--reuse',action='store_true')
    parser.add_argument('--day',action='store_true')
    parser.add_argument('--build-only',action='store_true')
    parser.add_argument('--oidn-path',help='任意。pip --targetで導入したoidnの親ディレクトリ')
    parser.add_argument('--oidn-python',default='python3',help='外部OIDN用のPython実行ファイル')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    names=args.views.split(',')
    if not all(n in VIEWS for n in names):
        parser.error('利用できる構図: '+','.join(VIEWS))
    if args.width<96 or args.samples<1:
        parser.error('widthは96以上、samplesは1以上')
    OUT.mkdir(parents=True,exist_ok=True)
    if not args.reuse:
        build()
    scene=bpy.context.scene
    scene.render.resolution_x=args.width
    scene.render.resolution_y=round(args.width*2/3)
    scene.render.resolution_percentage=100
    scene.cycles.samples=args.samples
    scene.cycles.use_denoising=False
    scene.camera=bpy.data.objects['camera-'+names[0]]
    if args.day:
        for data in bpy.data.lights:
            if data.name.startswith('夜の窓光'):
                data.color=(.62,.78,1)
                data.energy=2300
        bs=bpy.data.materials['窓外の夜空'].node_tree.nodes.get('Principled BSDF')
        bs.inputs['Base Color'].default_value=(0,0,0,1)
        bs.inputs['Emission Color'].default_value=(.28,.56,.85,1)
        bs.inputs['Emission Strength'].default_value=1.2
    # 昼の再撮影で夜の原本を上書きしない。
    if not args.reuse:
        bpy.ops.wm.save_as_mainfile(filepath=str(OUT/('palace-day.blend' if args.day else 'palace.blend')))
    if not args.build_only:
        for name in names:
            scene.camera=bpy.data.objects['camera-'+name]
            path=OUT/(name+('-day' if args.day else '')+'.png')
            if args.oidn_path:
                render_denoised(scene,path,args.oidn_path,args.oidn_python)
            else:
                scene.render.filepath=str(path)
                bpy.ops.render.render(write_still=True)
    meta={'coordinate_system':'X=east, Y=north/throne, Z=up; metres',
          'views':{n:{'position':p,'target':t,'lens_mm':l} for n,(p,t,l) in VIEWS.items()},
          'furniture':{'throne':[0,8,1], 'chancellor_chair':[2.05,7.85,1], 'side_table':[-1.85,7.7,1]},
          'room':{'width_m':14.2,'length_m':20.3,'dais_height_m':1,'step_count':5},
          'note':'All views share the same geometry. This is a new 3D interpretation of palace-front.png.'}
    if not args.reuse or not (OUT/'cameras.json').exists():
        (OUT/'cameras.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')


if __name__=='__main__':
    main()

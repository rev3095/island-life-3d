"""배경 빌더가 쓰는 공용 도구: 기본 도형, 툰 재질, 외곽선, 렌더 세팅.

좌표계: Blender Z-up, 정면 = -Y. 1.0 = 게임 타일 1칸.
"""
import bpy, bmesh, math, random
from mathutils import Vector, Matrix

V = Vector


def lin(hexstr):
    h = hexstr.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c) + (1.0,)


def reset_scene():
    scene = bpy.context.scene
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras, bpy.data.lights, bpy.data.actions):
        for d in list(coll):
            coll.remove(d)
    scene.render.fps = 24
    return scene


# ---------------------------------------------------------------- 기본 도형 (bmesh 를 돌려준다)
def _place(bm, center=(0, 0, 0), rot=None, scale=(1, 1, 1)):
    R = rot.to_4x4() if rot is not None else Matrix.Identity(4)
    M = Matrix.Translation(V(center)) @ R @ Matrix.Diagonal((*scale, 1.0))
    bmesh.ops.transform(bm, matrix=M, verts=bm.verts)
    return bm


def ellipsoid(center, radii, rot=None, seg=24, rings=14):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0)
    return _place(bm, center, rot, radii)


def capsule(a, b, r, seg=16, rings=10):
    a, b = V(a), V(b)
    d = b - a
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=r)
    for v in bm.verts:
        if v.co.z > 1e-5:
            v.co.z += d.length
    return _place(bm, a, align_z(d))


def cylinder(a, b, r1, r2=None, seg=20):
    """a → b 방향 원기둥(원뿔대). 양 끝 막힘."""
    a, b = V(a), V(b)
    d = b - a
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r1, radius2=r1 if r2 is None else r2, depth=d.length)
    return _place(bm, a + d / 2, align_z(d))


def cone(base, tip, r1, r2=0.0, squash=1.0, seg=20):
    base, tip = V(base), V(tip)
    d = tip - base
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r1, radius2=r2, depth=d.length)
    return _place(bm, base + d / 2, align_z(d), (1.0, squash, 1.0))


def box(center, size, bevel=0.03, rot=None, segments=2):
    """모서리를 둥글린 상자. size = (가로, 깊이, 높이)."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=V(size), verts=bm.verts)
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=bm.verts[:] + bm.edges[:], offset=min(bevel, min(size) * 0.45), segments=segments,
                        profile=0.5, affect='EDGES', clamp_overlap=True)
    return _place(bm, center, rot)


def prism(center, length, span, height, overhang=0.0, ridge='x'):
    """박공지붕용 삼각기둥. ridge='x' 면 용마루가 X 방향(앞에서 보면 경사면),
    ridge='y' 면 용마루가 Y 방향(앞에서 보면 삼각형 박공)."""
    bm = bmesh.new()
    hl, hs = length / 2 + overhang, span / 2 + overhang
    pts = [(-hl, -hs, 0), (hl, -hs, 0), (hl, hs, 0), (-hl, hs, 0), (-hl, 0, height), (hl, 0, height)]
    vs = [bm.verts.new(V(p)) for p in pts]
    for f in ((0, 1, 5, 4), (2, 3, 4, 5), (0, 4, 3), (1, 2, 5), (0, 3, 2, 1)):
        bm.faces.new([vs[i] for i in f])
    return _place(bm, center, rot_xyz(z=math.pi / 2) if ridge == 'y' else None)


def wedge(width, length, height, center=(0, 0, 0)):
    """경사로: X 폭 width, Y 길이 length, 앞(-Y) 높이 0 → 뒤(+Y) 높이 height."""
    bm = bmesh.new()
    hw, hl = width / 2, length / 2
    pts = [(-hw, -hl, 0), (hw, -hl, 0), (hw, hl, 0), (-hw, hl, 0), (-hw, hl, height), (hw, hl, height)]
    vs = [bm.verts.new(V(p)) for p in pts]
    for f in ((0, 1, 5, 4), (2, 3, 4, 5), (0, 4, 3), (1, 2, 5), (0, 3, 2, 1)):
        bm.faces.new([vs[i] for i in f])
    return _place(bm, center)


def tube(points, radii, seg=12, closed=False, flat=1.0):
    """점들을 따라가는 관. flat < 1 이면 납작한 띠(잎사귀)."""
    bm = bmesh.new()
    rings, n = [], len(points)
    for i, p in enumerate(points):
        t = (points[(i + 1) % n] - points[(i - 1) % n]) if closed else (points[min(i + 1, n - 1)] - points[max(i - 1, 0)])
        t = t.normalized()
        up = V((0, 0, 1)) if abs(t.z) < 0.9 else V((1, 0, 0))
        x = t.cross(up).normalized()
        y = t.cross(x).normalized()
        rings.append([bm.verts.new(p + (x * math.cos(a) + y * math.sin(a) * flat) * radii[i])
                      for a in (2 * math.pi * k / seg for k in range(seg))])
    for i in range(n if closed else n - 1):
        a, b = rings[i], rings[(i + 1) % n]
        for k in range(seg):
            bm.faces.new([a[k], a[(k + 1) % seg], b[(k + 1) % seg], b[k]])
    if not closed:
        bm.faces.new(list(reversed(rings[0])))
        bm.faces.new(rings[-1])
    return bm


def bezier(p0, p1, p2, p3, n):
    p0, p1, p2, p3 = V(p0), V(p1), V(p2), V(p3)
    return [p0 * (1 - t) ** 3 + p1 * 3 * (1 - t) ** 2 * t + p2 * 3 * (1 - t) * t * t + p3 * t ** 3 for t in (i / n for i in range(n + 1))]


def align_z(d):
    d = V(d)
    if d.length < 1e-9:
        return Matrix.Identity(3)
    return V((0, 0, 1)).rotation_difference(d.normalized()).to_matrix()


def rot_xyz(x=0.0, y=0.0, z=0.0):
    from mathutils import Euler
    return Euler((x, y, z)).to_matrix()


def jitter(bm, amount, seed, keep_bottom=None):
    """정점을 살짝 흔들어 바위처럼 울퉁불퉁하게. keep_bottom 높이 아래는 평평하게 누른다."""
    rnd = random.Random(seed)
    for v in bm.verts:
        v.co += V((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1))) * amount
        if keep_bottom is not None and v.co.z < keep_bottom:
            v.co.z = keep_bottom
    return bm


# ---------------------------------------------------------------- 모델 조립
class Part:
    """오브젝트 하나: 여러 bmesh 조각을 합치고 조각마다 재질 이름과 외곽선 여부를 기록한다."""

    def __init__(self, model, name, parent=None, pivot=(0, 0, 0)):
        self.model, self.name, self.parent, self.pivot = model, name, parent, V(pivot)
        self.bm = bmesh.new()
        self.dl = self.bm.verts.layers.deform.verify()
        self.mats = []

    def add(self, tmp, mat, outline=True, smooth=None):
        """mat: 재질(팔레트 색) 이름, 또는 (면 중심, 면 법선) → 이름 함수 (타일 윗면/옆면 나누기 등)."""
        vmap = {}
        for v in tmp.verts:
            nv = self.bm.verts.new(v.co + self.model.offset)
            if outline:
                nv[self.dl][0] = 1.0
            vmap[v] = nv
        bmesh.ops.recalc_face_normals(tmp, faces=tmp.faces[:])
        for f in tmp.faces:
            key = mat(f.calc_center_median(), f.normal) if callable(mat) else mat
            if key not in self.mats:
                self.mats.append(key)
            nf = self.bm.faces.new([vmap[v] for v in f.verts])
            nf.material_index = self.mats.index(key)
            nf.smooth = self.model.smooth if smooth is None else smooth
        tmp.free()
        return self


class Model:
    """요소 하나의 오브젝트 묶음. palette 의 색 이름이 곧 재질 이름이다 (suffix 로 변형별 재질 구분)."""

    def __init__(self, name, palette, suffix='', offset=(0, 0, 0), smooth=True):
        self.name, self.palette, self.suffix, self.offset, self.smooth = name, palette, suffix, V(offset), smooth
        self.parts = {}
        self.objects = {}
        self.root = None

    def part(self, name, parent=None, pivot=(0, 0, 0)):
        if name not in self.parts:
            self.parts[name] = Part(self, name, parent, V(pivot) + self.offset)
        return self.parts[name]

    def material(self, key):
        name = key + self.suffix
        m = bpy.data.materials.get(name)
        if m is None:
            m = principled(name, self.palette[key])
        return m

    def finish(self, scene):
        self.root = bpy.data.objects.new(self.name + self.suffix, None)
        scene.collection.objects.link(self.root)
        for name, p in self.parts.items():
            bmesh.ops.recalc_face_normals(p.bm, faces=p.bm.faces[:])
            bmesh.ops.translate(p.bm, vec=-p.pivot, verts=p.bm.verts[:])
            me = bpy.data.meshes.new(name + self.suffix)
            p.bm.to_mesh(me)
            p.bm.free()
            for key in p.mats:
                me.materials.append(self.material(key))
            obj = bpy.data.objects.new(name + self.suffix, me)
            obj.vertex_groups.new(name='outline')
            scene.collection.objects.link(obj)
            obj.location = p.pivot
            self.objects[name] = obj
        for name, p in self.parts.items():
            parent = self.objects.get(p.parent) if p.parent else self.root
            obj = self.objects[name]
            if p.parent:
                obj.location = p.pivot - self.parts[p.parent].pivot
            obj.parent = parent
        return self


def principled(name, hexstr):
    m = bpy.data.materials.new(name)
    color = lin(hexstr)
    m.diffuse_color = color
    try:
        m.use_nodes = True
    except AttributeError:
        pass
    bsdf = next((nd for nd in m.node_tree.nodes if nd.type == 'BSDF_PRINCIPLED'), None)
    if bsdf is None:
        bsdf = m.node_tree.nodes.new('ShaderNodeBsdfPrincipled')
        out = next(nd for nd in m.node_tree.nodes if nd.type == 'OUTPUT_MATERIAL')
        m.node_tree.links.new(bsdf.outputs[0], out.inputs['Surface'])
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Roughness'].default_value = 0.75
    m['hex'] = hexstr
    return m


# ---------------------------------------------------------------- 툰 렌더
TOON_SHADOW = (0.76, 0.72, 0.82, 1.0)


def toonify(m, flat=False):
    rgba = lin(m.get('hex', '#FFFFFF'))
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    em = nt.nodes.new('ShaderNodeEmission')
    nt.links.new(em.outputs[0], out.inputs['Surface'])
    if flat:
        em.inputs['Color'].default_value = rgba
        return
    dif = nt.nodes.new('ShaderNodeBsdfDiffuse')
    s2r = nt.nodes.new('ShaderNodeShaderToRGB')
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.interpolation = 'CONSTANT'
    e0, e1 = ramp.color_ramp.elements[0], ramp.color_ramp.elements[1]
    e0.position, e0.color = 0.0, TOON_SHADOW
    e1.position, e1.color = 0.6, (1, 1, 1, 1)
    mul = nt.nodes.new('ShaderNodeVectorMath')
    mul.operation = 'MULTIPLY'
    mul.inputs[1].default_value = rgba[:3]
    nt.links.new(dif.outputs[0], s2r.inputs[0])
    nt.links.new(s2r.outputs['Color'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], mul.inputs[0])
    nt.links.new(mul.outputs[0], em.inputs['Color'])


def add_outlines(scene, objects, width, color='#4A3B32'):
    """뒤집은 껍데기(inverted hull) 외곽선: 법선을 뒤집은 복제 메시를 바깥으로 살짝 부풀린다."""
    omat = bpy.data.materials.get('outline_ink') or principled('outline_ink', color)
    toonify(omat, flat=True)
    omat.use_backface_culling = True
    for obj in objects:
        hull_me = obj.data.copy()
        bm = bmesh.new()
        bm.from_mesh(hull_me)
        bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
        bm.to_mesh(hull_me)
        bm.free()
        hull_me.materials.clear()
        hull_me.materials.append(omat)
        for poly in hull_me.polygons:
            poly.material_index = 0
        hull = obj.copy()
        hull.data = hull_me
        hull.name = obj.name + '_outline'
        hull.animation_data_clear()
        scene.collection.objects.link(hull)
        hull.parent = obj
        hull.matrix_parent_inverse.identity()
        hull.location = (0, 0, 0)
        hull.rotation_euler = (0, 0, 0)
        disp = hull.modifiers.new('Hull', 'DISPLACE')
        disp.direction = 'NORMAL'
        disp.mid_level = 0.0
        disp.strength = -width
        disp.vertex_group = 'outline'
        try:
            hull.visible_shadow = False
        except AttributeError:
            pass


def setup_render(scene):
    try:
        scene.render.engine = 'BLENDER_EEVEE'
    except TypeError:
        scene.render.engine = 'BLENDER_EEVEE_NEXT'
    try:
        scene.eevee.taa_render_samples = 32
    except AttributeError:
        pass
    scene.view_settings.view_transform = 'Standard'
    world = bpy.data.worlds.new('sky')
    scene.world = world
    try:
        world.use_nodes = True
    except AttributeError:
        pass
    wn = world.node_tree.nodes
    wn.clear()
    amb = wn.new('ShaderNodeBackground')      # 조명용 주변광
    amb.inputs['Color'].default_value = lin('#CDEBF5')
    amb.inputs['Strength'].default_value = 0.55
    sky = wn.new('ShaderNodeBackground')      # 카메라에 보이는 하늘
    sky.inputs['Color'].default_value = lin('#BFE6F7')
    lp, mix, wout = wn.new('ShaderNodeLightPath'), wn.new('ShaderNodeMixShader'), wn.new('ShaderNodeOutputWorld')
    wl = world.node_tree.links
    wl.new(lp.outputs['Is Camera Ray'], mix.inputs[0])
    wl.new(amb.outputs[0], mix.inputs[1])
    wl.new(sky.outputs[0], mix.inputs[2])
    wl.new(mix.outputs[0], wout.inputs['Surface'])
    sun_data = bpy.data.lights.new('sun', 'SUN')
    sun_data.energy = 3.2
    sun_data.angle = math.radians(4)
    sun = bpy.data.objects.new('sun', sun_data)
    sun.rotation_euler = (math.radians(58), 0, math.radians(-30))
    scene.collection.objects.link(sun)
    cam_data = bpy.data.cameras.new('cam')
    cam = bpy.data.objects.new('cam', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    target = bpy.data.objects.new('cam_target', None)
    scene.collection.objects.link(target)
    con = cam.constraints.new('TRACK_TO')
    con.target = target
    con.track_axis = 'TRACK_NEGATIVE_Z'
    con.up_axis = 'UP_Y'
    return cam, target


def world_bounds(objects):
    pts = [o.matrix_world @ v.co for o in objects for v in o.data.vertices]
    lo = V((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = V((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def aim(cam, target, center, yaw_deg, pitch_deg, ortho_scale=None, dist=20.0, lens=50):
    """center 를 yaw(정면 기준 왼쪽 +)·pitch(위 +) 방향에서 바라본다."""
    yaw, pitch = math.radians(yaw_deg), math.radians(pitch_deg)
    d = V((-math.sin(yaw) * math.cos(pitch), -math.cos(yaw) * math.cos(pitch), math.sin(pitch)))
    target.location = center
    cam.location = center + d * dist
    if ortho_scale is not None:
        cam.data.type = 'ORTHO'
        cam.data.ortho_scale = ortho_scale
    else:
        cam.data.type = 'PERSP'
        cam.data.lens = lens
    cam.data.clip_end = 200


def shot(scene, path, w, h, transparent=True, jpeg=False):
    scene.render.resolution_x, scene.render.resolution_y = w, h
    scene.render.film_transparent = transparent
    scene.render.image_settings.file_format = 'JPEG' if jpeg else 'PNG'
    scene.render.image_settings.color_mode = 'RGB' if jpeg else 'RGBA'
    if jpeg:
        scene.render.image_settings.quality = 88
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def thumbnail(src, dst, w=240):
    img = bpy.data.images.load(src)
    img.scale(w, round(img.size[1] * w / img.size[0]))
    img.filepath_raw = dst
    img.file_format = 'PNG'
    img.save()
    bpy.data.images.remove(img)

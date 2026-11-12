"""옷 빌더 (11차 M11-P2·P3, 보드 wave11 D100-A · D101-A): assets/clothes/specs/<slug>.json → 옷 .glb / 렌더 / 통계

실행:  blender -b --factory-startup --python build_clothes.py -- <옷 스펙.json> <assets_dir> [--no-render]
(보통은 tools/build-clothes.mjs 로 실행한다)

옷은 주인공(스펙 "body", 지금 player) 몸에 끼운다. 몸을 따로 만들지 않고 build_character.py 를 그대로 exec 해서
같은 몸 수치(BODY_C · HEAD_C · ARMS · LEGS …) · 같은 뼈대(root·hips·spine·head·arm·leg·shin)를 얻은 뒤,
여기의 BUILD[kind] 가 그 수치로 옷 껍데기를 만든다. 내보내는 .glb 에는 뼈대 + 옷 메시만 있다 (동작 없음) —
게임(src/player/outfit.js)이 뼈 이름으로 주인공 뼈대에 다시 묶는다. 렌더는 옷을 입은 주인공.

끼우는 틀 (CONTRACTS 「11차 옷」):
- 칸 slot: hat 모자 → 뼈 head 하나 · top 윗옷 → hips·spine·arm.L·arm.R (몸 무게와 같게, 기본 윗옷 player_top 을 숨기고 그 자리를 덮는다)
  · shoes 신발 → shin.L·shin.R (장화 목은 leg 까지).
- 윗옷은 기본 윗옷이 덮던 곳(몸통 pantsTop 위 + 소매)을 모두 덮어야 한다 (몸에는 그 자리가 비어 있다).
- 모자는 머리카락(머리 × 1.07) 위에 얹고 귀(옆, 높이 0)는 피한다. 사람 말고 귀 있는 종족에 씌우는 일은 지금 없다 (D101-A 주인공만).
- 재질 이름 = 옷 스펙 팔레트 키이고 주인공 팔레트 키(fur·hair·shirt·pants·eye·blush·outline)와 겹치면 안 된다 (Blender 가 이름 뒤에 .001 을 붙인다).
"""
import bpy, bmesh, json, math, os, sys
from mathutils import Vector, Matrix

args = sys.argv[sys.argv.index('--') + 1:]
CL_PATH, ASSETS = os.path.abspath(args[0]), os.path.abspath(args[1])
FLAGS = [a for a in args[2:] if a.startswith('--')]
CL = json.load(open(CL_PATH, encoding='utf-8'))
if CL.get('builtin'):
    raise SystemExit(f"[clothes] {CL['slug']} 는 몸 모델에 든 기본 옷이라 따로 만들지 않는다 (build-character)")
BODY = CL.get('body', 'player')
BODY_SPEC = os.path.join(ASSETS, 'specs', BODY + '.json')
CDIR = os.path.join(ASSETS, 'clothes')
for sub in ('models', 'renders'):
    os.makedirs(os.path.join(CDIR, sub), exist_ok=True)

PALETTE = dict(CL['palette'])
RESERVED = set(json.load(open(BODY_SPEC, encoding='utf-8'))['palette']) | {'eyeHighlight', 'outline'}
clash = sorted(set(PALETTE) & RESERVED)
if clash:
    raise SystemExit(f"[clothes] 팔레트 키 {clash} 가 몸 팔레트와 겹친다 — 다른 이름을 쓴다")
PR = {k: v.get('value', v) if isinstance(v, dict) else v for k, v in CL.get('params', {}).items()}


def prm(name, default):
    return PR.get(name, default)


# ------------------------------------------------------------------ 옷 만들기 (ns = build_character.py 의 전역)
def build(ns):
    V = Vector
    Builder, ellipsoid, capsule, cone, tube = ns['Builder'], ns['ellipsoid'], ns['capsule'], ns['cone'], ns['tube']
    ell_point, decal = ns['ell_point'], ns['decal']
    BODY_C, BODY_R, bodyTop, pantsTop = ns['BODY_C'], ns['BODY_R'], ns['bodyTop'], ns['pantsTop']
    HEAD_C, HEAD_R, ARMS, LEGS, H = ns['HEAD_C'], ns['HEAD_R'], ns['ARMS'], ns['LEGS'], ns['H']
    body_w, leg_w, KNEE_Z = ns['body_w'], ns['leg_w'], ns['KNEE_Z']
    B = Builder()
    kind = CL['kind']
    TAU = math.pi * 2

    # 머리카락 겉 (build_character 의 HR 과 같다) — 모자는 이 위에
    HC = HEAD_C + V((0, 0.006, 0.01))
    HR = tuple(r * 1.07 for r in HEAD_R)

    def squash_body(bm, C):
        for v in bm.verts:   # 몸통과 같게 아래쪽을 살짝 누른다
            if v.co.z < C.z:
                v.co.z = C.z - (C.z - v.co.z) * 0.82
        return bm

    def torso(d, keep, mat, w=body_w, seg=32, rings=22):
        """몸통 껍데기: 몸 타원체 + d. keep(c) 인 면만"""
        bm = squash_body(ellipsoid(BODY_C, tuple(r + d for r in BODY_R), seg=seg, rings=rings), BODY_C)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if not keep(f.calc_center_median())], context='FACES')
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
        B.add(bm, mat, w)

    def sleeves(d, long, mat):
        for side in ('L', 'R'):
            sh, hand = ARMS[side]
            cut = hand.z + 0.032 if long else sh.z - 0.035
            bm = capsule(sh, hand, 0.04 + d, seg=14, rings=10)
            bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.calc_center_median().z <= cut], context='FACES')
            bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
            B.add(bm, mat, 'arm.' + side)
            if long and prm('cuff', True):
                dd = (hand - sh).normalized()
                c = sh + dd * ((sh.z - cut) / max(1e-6, -dd.z))
                B.add(tube(ns['ring_points'](c, dd, 0.04 + d + 0.004, seg=16), [0.009] * 16, seg=8, closed=True), CL.get('cuffMat', mat), 'arm.' + side)

    def body_ring(z, d, r, mat, seg=28):
        """몸통을 두르는 고리 (밑단·목둘레). 높이 z 의 몸 단면 타원 + d"""
        k = math.sqrt(max(0.0, 1 - ((z - BODY_C.z) / ((BODY_R[2] + d) * (0.82 if z < BODY_C.z else 1))) ** 2))
        pts = [V((math.sin(a) * (BODY_R[0] + d) * k, -math.cos(a) * (BODY_R[1] + d) * k, z)) for a in (TAU * i / seg for i in range(seg))]
        B.add(tube(pts, [r] * seg, seg=8, closed=True), mat, body_w)

    def front_point(x, z, d):
        """몸 앞면(-Y)의 점 (x, z) + d"""
        Ry, Rx = BODY_R[1] + d, BODY_R[0] + d
        Rz = (BODY_R[2] + d) * (0.82 if z < BODY_C.z else 1)
        q = 1 - (x / Rx) ** 2 - ((z - BODY_C.z) / Rz) ** 2
        return V((x, -Ry * math.sqrt(max(0.0, q)), z))

    D = prm('offset', 0.007)

    # ---------------- 윗옷
    if kind == 'striped-tee':
        n = prm('stripes', 3)
        bands = [pantsTop + (i + 1) * (bodyTop - 0.03 - pantsTop) / (n + 1) for i in range(n)]
        torso(D, lambda c: c.z > pantsTop - 0.004, lambda c: 'teeStripe' if any(abs(c.z - z) < prm('stripeWidth', 0.009) for z in bands) else 'tee')
        hemZ = {side: ARMS[side][0].z - 0.035 for side in ('L', 'R')}
        sleeves(D, False, lambda c: 'teeStripe' if c.z < max(hemZ.values()) + 0.014 else 'tee')   # 소매 끝 한 줄
    elif kind == 'overalls':
        torso(D, lambda c: c.z > pantsTop - 0.004, 'shirtIn')
        sleeves(D, False, 'shirtIn')
        D2 = D + 0.006
        bibTop = bodyTop - 0.06

        def bib(c):
            if c.z < pantsTop + 0.012:
                return True
            return c.y < -BODY_R[1] * 0.25 and abs(c.x) < BODY_R[0] * 0.55 and c.z < bibTop
        torso(D2, bib, 'denim')
        for sx in (1, -1):   # 멜빵 끈: 가슴받이 위 모서리 → 어깨 너머 → 등 허리
            x = sx * BODY_R[0] * 0.42
            pts = []
            for i in range(13):
                a = math.radians(-35 + 250 * i / 12)   # 앞 아래 → 위 → 뒤 아래
                Rx, Ry, Rz = BODY_R[0] + D2 + 0.004, BODY_R[1] + D2 + 0.004, BODY_R[2] + D2 + 0.004
                k = math.sqrt(max(0.0, 1 - (x / Rx) ** 2))
                y, z = -Ry * k * math.cos(a), BODY_C.z + Rz * k * math.sin(a) * (0.82 if math.sin(a) < 0 else 1)
                if z < bibTop - 0.01 and y < 0 and i > 0:
                    continue
                pts.append(V((x, y, z)))
            pts = [front_point(x, bibTop - 0.005, D2 + 0.004)] + [p for p in pts if p.z >= bibTop - 0.01 or p.y > 0]
            pts = [p for p in pts if p.y < 0 or p.z > pantsTop + 0.01]
            B.add(tube(pts, [0.009] * len(pts), seg=6), 'denim', body_w)
            B.add(ellipsoid(front_point(x, bibTop - 0.008, D2 + 0.007), (0.012, 0.006, 0.012), seg=10, rings=6), 'button', body_w)
        B.add(ellipsoid(front_point(0, (pantsTop + bibTop) / 2 + 0.01, D2 + 0.003), (0.034, 0.004, 0.024), seg=12, rings=6), 'denim', body_w)   # 가슴 주머니
    elif kind == 'sweater':
        hem = pantsTop - prm('hemDrop', 0.035)
        band = BODY_C.z + 0.05
        torso(D + 0.002, lambda c: c.z > hem, lambda c: 'knitBand' if abs(c.z - band) < 0.018 else 'knit')
        sleeves(D + 0.002, True, lambda c: 'knit')
        body_ring(hem + 0.004, D + 0.004, 0.011, 'rib')
        body_ring(bodyTop - 0.03, D, 0.013, 'rib')
    elif kind == 'raincoat':
        hem = pantsTop - prm('hemDrop', 0.07)
        torso(D + 0.005, lambda c: c.z > hem, 'coat')
        sleeves(D + 0.005, True, lambda c: 'coat')
        body_ring(hem + 0.004, D + 0.007, 0.009, 'coat')
        for i in range(3):   # 앞 단추
            z = bodyTop - 0.06 - i * 0.045
            B.add(ellipsoid(front_point(0, z, D + 0.009), (0.011, 0.006, 0.011), seg=10, rings=6), 'button', body_w)
        B.add(ellipsoid(V((0, BODY_R[1] * 0.55, bodyTop - 0.015)), (0.12, 0.07, 0.045), seg=20, rings=10), 'coat', 'spine')   # 접은 모자 (목 뒤)
    elif kind == 'vest':
        torso(D, lambda c: c.z > pantsTop - 0.004, 'vestShirt')
        sleeves(D, False, 'vestShirt')
        D2 = D + 0.006
        hem = pantsTop - 0.02
        gap = prm('opening', 0.03)

        def vest(c):
            if c.z <= hem:
                return None
            if c.y < 0 and abs(c.x) < gap:
                return None
            if c.y < 0 and abs(c.x) < gap + 0.018:
                return 'vestTrim'
            if c.z < hem + 0.014:
                return 'vestTrim'
            return 'vest'
        torso(D2, lambda c: vest(c) is not None, vest)
        k = front_point(-gap - 0.012, BODY_C.z + 0.035, D2 + 0.006)   # 고름 매듭 + 늘어진 끈 둘
        B.add(ellipsoid(k, (0.018, 0.009, 0.014), seg=12, rings=8), 'ribbon', body_w)
        for dx, ln in ((-0.012, 0.075), (0.006, 0.06)):
            pts = [k + V((0, -0.004, 0)), k + V((dx, -0.008, -ln * 0.5)), k + V((dx * 1.6, -0.006, -ln))]
            B.add(tube(pts, [0.007, 0.007, 0.006], seg=6), 'ribbon', body_w)
    # ---------------- 모자 (뼈 head)
    elif kind == 'straw-hat':
        CR = tuple(r * 1.05 for r in HR)
        lift = prm('brimHeight', 0.38)
        bm = ellipsoid(HC, CR, seg=36, rings=22)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if (f.calc_center_median() - HC).z < CR[2] * lift], context='FACES')
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
        B.add(bm, 'straw', 'head')
        bz = HC.z + CR[2] * lift
        B.add(ellipsoid(V((HC.x, HC.y, bz)), (HR[0] * prm('brim', 1.55), HR[1] * prm('brim', 1.55), 0.011), seg=40, rings=10), 'straw', 'head')
        pitch = math.asin(lift + 0.09)
        pts = [ell_point(HC, CR, a, pitch, inset=-0.006)[0] for a in (TAU * i / 28 for i in range(28))]
        B.add(tube(pts, [0.014] * 28, seg=8, closed=True), 'hatBand', 'head')
    elif kind == 'beanie':
        CR = tuple(r * 1.09 for r in HR)

        def edge(c):
            rel = c - HC
            front = max(0.0, min(1.0, -rel.y / CR[1]))
            return (prm('back', 0.12) + prm('front', 0.36) * front) * CR[2]
        bm = ellipsoid(HC, CR, seg=36, rings=22)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if (f.calc_center_median() - HC).z < edge(f.calc_center_median())], context='FACES')
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
        B.add(bm, 'beanie', 'head')
        pts = []
        for i in range(32):   # 접은 단: 잘린 선을 따라
            a = TAU * i / 32
            front = max(0.0, math.cos(a))
            z = (prm('back', 0.12) + prm('front', 0.36) * front) * CR[2] + 0.012
            pts.append(ell_point(HC, CR, a, math.asin(max(-1, min(1, z / CR[2]))), inset=-0.004)[0])
        B.add(tube(pts, [0.02] * 32, seg=8, closed=True), 'beanieRib', 'head')
        B.add(ellipsoid(HC + V((0, 0.01, CR[2] + 0.025)), (0.045, 0.045, 0.04), seg=16, rings=10), 'pompom', 'head')
    elif kind == 'flower-pin':
        yaw, pitch = prm('yaw', 0.62), prm('pitch', 0.5)
        p, n = ell_point(HC, HR, yaw, pitch)
        R = decal(n)
        r_, u_ = ns['surface_frame'](n)
        for i in range(5):
            a = TAU * i / 5
            off = (r_ * math.cos(a) + u_ * math.sin(a)) * 0.027
            B.add(ellipsoid(p + n * 0.008 + off, (0.021, 0.008, 0.021), rot=R, seg=12, rings=8), 'pinPetal', 'head')
        B.add(ellipsoid(p + n * 0.013, (0.014, 0.008, 0.014), rot=R, seg=10, rings=6), 'pinCenter', 'head')
        B.add(ellipsoid(p + n * 0.004 - u_ * 0.03 + r_ * 0.02, (0.016, 0.005, 0.008), rot=R, seg=10, rings=6), 'pinLeaf', 'head')
    elif kind == 'sailor-cap':
        z0 = prm('base', 0.62)
        r0 = HR[0] * prm('width', 0.92)
        base = HC + V((0, 0.012, HR[2] * z0))
        tip = base + V((0, 0.012, HR[2] * (1.04 - z0) + 0.012))
        B.add(cone(base, tip, r0, r0 * 1.06, seg=32), 'cap', 'head')
        pts = [base + V((math.sin(a) * (r0 + 0.006), -math.cos(a) * (r0 + 0.006), 0.012)) for a in (TAU * i / 32 for i in range(32))]
        B.add(tube(pts, [0.015] * 32, seg=8, closed=True), 'capBand', 'head')
        for sx in (1, -1):   # 뒤로 늘어진 리본 둘
            a = base + V((sx * 0.03, r0 * 0.95, 0.01))
            B.add(tube([a, a + V((sx * 0.012, 0.03, -0.05)), a + V((sx * 0.02, 0.04, -0.09))], [0.008, 0.008, 0.007], seg=6), 'capBand', 'head')
    # ---------------- 신발 (뼈 shin)
    elif kind in ('sneakers', 'rain-boots', 'sandals'):
        for side in ('L', 'R'):
            x = LEGS[side][2].x
            FC, FR = V((x, -0.02, 0.032)), (0.054, 0.068, 0.036)
            w = 'shin.' + side
            if kind == 'sneakers':
                B.add(ellipsoid(FC + V((0, -0.002, 0.002)), (FR[0] + 0.009, FR[1] + 0.009, FR[2] + 0.008), seg=20, rings=12), 'shoe', w)
                B.add(ellipsoid(V((x, -0.022, 0.006)), (FR[0] + 0.012, FR[1] + 0.013, 0.012), seg=20, rings=8), 'sole', w)
                for i in range(3):   # 끈
                    p = FC + V((0, -0.035 + i * 0.016, FR[2] + 0.004 - i * 0.002))
                    B.add(ellipsoid(p, (0.022, 0.004, 0.004), seg=8, rings=4), 'lace', w)
            elif kind == 'rain-boots':
                B.add(ellipsoid(FC, (FR[0] + 0.01, FR[1] + 0.01, FR[2] + 0.009), seg=20, rings=12), 'boot', w)
                top = V((x, 0, prm('height', KNEE_Z - 0.008)))
                B.add(capsule(V((x, 0, 0.03)), top, 0.058, seg=16, rings=8), 'boot', leg_w(side))
                B.add(tube(ns['ring_points'](top, V((0, 0, 1)), 0.06, seg=18), [0.009] * 18, seg=8, closed=True), 'bootRim', leg_w(side))
            else:
                B.add(ellipsoid(V((x, -0.022, 0.004)), (FR[0] + 0.007, FR[1] + 0.009, 0.008), seg=20, rings=8), 'sandalSole', w)
                for y0 in (-0.058, -0.006):   # 끈 둘 (발가락 쪽 · 발목 쪽)
                    bm = ellipsoid(FC, (FR[0] + 0.006, FR[1] + 0.006, FR[2] + 0.006), seg=28, rings=16)
                    bmesh.ops.delete(bm, geom=[f for f in bm.faces if not (abs(f.calc_center_median().y - y0) < 0.009 and f.calc_center_median().z > 0.014)], context='FACES')
                    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
                    B.add(bm, 'sandalStrap', w)
    # ---------------- 잠수복 (M16, 칸 suit — 바다에서 헤엄칠 때만 게임이 입힌다): 몸통·팔·다리 + 물안경(눈 앞) + 등 공기통
    elif kind == 'wetsuit':
        DS, half = D + 0.004, prm('stripe', 0.022)
        cuffZ = ARMS['L'][1].z + 0.058   # 소매 끝 띠 (sleeves 는 손목 위 +0.032 에서 자른다)
        torso(DS, lambda c: True, lambda c: 'suitStripe' if abs(c.y) < half and abs(c.x) > BODY_R[0] * 0.55 else 'suit', seg=28, rings=18)

        def arm_mat(c):   # 소매 끝 띠 + 팔 바깥 옆줄 (몸통 옆줄은 팔에 가려서)
            sh, hand = ARMS['L' if c.x > 0 else 'R']
            ax = sh.x + (hand.x - sh.x) * max(0.0, min(1.0, (sh.z - c.z) / (sh.z - hand.z)))
            return 'suitStripe' if c.z < cuffZ or (abs(c.x) - abs(ax) > 0.03 and abs(c.y) < half) else 'suit'
        sleeves(DS, True, arm_mat)
        ankle = prm('ankle', 0.075)
        for side in ('L', 'R'):   # 다리: 발목에서 자르고 바깥 옆줄 · 발목 띠
            x = LEGS[side][0].x
            sx = 1 if x > 0 else -1
            bm = capsule(V((x, 0, ns['legLen'] + 0.05)), V((x, 0, 0.05)), 0.05 + DS, seg=14, rings=8)
            bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.calc_center_median().z < ankle], context='FACES')
            bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
            B.add(bm, lambda c, x=x, sx=sx: 'suitStripe' if c.z < ankle + 0.022 or ((c.x - x) * sx > 0.035 and abs(c.y) < half) else 'suit', leg_w(side))
        # 물안경 (M17-P1): 두 눈을 한 장으로 덮는 작은 마스크 — 얼굴 겉을 따라 도는 둥근 네모 테 + 코 위 홈 +
        # 렌즈 반짝임 둘 + 머리 뒤로 두른 끈. 예전 두 고리 안경은 커서 「큰 안경」처럼 보였다 (이마 위로 올리지 않는다)
        EYES, hs = ns['EYES'], ns['hs']
        MR = tuple(r * 1.0 for r in HEAD_R)

        def eye_angles(p):   # 머리 타원체에서 눈 자리의 (yaw, pitch)
            d = p - HEAD_C
            return math.atan2(d.x / MR[0], -d.y / MR[1]), math.asin(max(-1.0, min(1.0, d.z / MR[2])))
        ey, ep = eye_angles(EYES['L'][0])
        ey = abs(ey)
        YW, PH = ey + prm('maskSide', 0.12), prm('maskHeight', 0.2)   # 테 반폭(yaw) · 반높이(pitch)
        lift = 0.013 * hs

        def mask_pt(t, grow=0.0):
            c, s = math.cos(t), math.sin(t)
            yaw = (YW + grow) * math.copysign(abs(c) ** 0.5, c)        # 둥근 네모 (superellipse k=4)
            pit = (PH + grow) * math.copysign(abs(s) ** 0.5, s)
            if s < 0:   # 아래 가운데는 코 위로 살짝 올라간 홈
                pit += PH * 0.55 * math.exp(-(yaw / 0.14) ** 2) * min(1.0, -s * 2)
            p, n = ell_point(HEAD_C, MR, yaw, ep + pit)
            return p + n * lift, n
        loop = [mask_pt(TAU * i / 28)[0] for i in range(28)]
        B.add(tube(loop, [0.0105 * hs] * 28, seg=5, closed=True), 'maskFrame', 'head')
        for sx in (1, -1):   # 렌즈 반짝임 (눈은 테 사이로 그대로 보인다)
            p, n = ell_point(HEAD_C, MR, sx * ey * 0.55, ep + PH * 0.55)
            B.add(ellipsoid(p + n * (lift + 0.002), (0.014 * hs, 0.004 * hs, 0.007 * hs), rot=ns['decal'](n), seg=8, rings=4), 'maskLens', 'head', outline=False)
        endL, _ = mask_pt(0.0)
        endR, _ = mask_pt(math.pi)
        SR = tuple(r * 1.02 for r in HR)
        y0 = YW + 0.08
        strap = [ell_point(HC, SR, y0 + (TAU - 2 * y0) * i / 12, ep + 0.05 + 0.2 * math.sin(math.pi * i / 12))[0] for i in range(13)]
        B.add(tube([endL] + strap + [endR], [0.0075 * hs] * 15, seg=5), 'maskStrap', 'head')
        # 등 공기통 (M17-P1): 등 곡면에 붙도록 높이마다 몸 뒤 겉(y)을 재서 기울여 세우고, 받침판 + 허리띠로 묶는다.
        # 예전엔 곧게 세운 통이 등 윗부분에서 떨어져 옆에서 떠 보였다
        def back_y(z, d):
            Rz = (BODY_R[2] + d) * (0.82 if z < BODY_C.z else 1)
            return (BODY_R[1] + d) * math.sqrt(max(0.0, 1 - ((z - BODY_C.z) / Rz) ** 2))
        TR = prm('tankRadius', 0.044)
        tz0, tz1 = BODY_C.z - 0.06, bodyTop - 0.045
        sink = 0.012   # 통 앞면이 몸(받침판) 속으로 묻히는 깊이
        a0, a1 = V((0, back_y(tz0, DS) + TR - sink, tz0)), V((0, back_y(tz1, DS) + TR - sink, tz1))
        B.add(capsule(a0, a1, TR, seg=16, rings=8), 'tank', 'spine')
        ax = (a1 - a0).normalized()
        v0, v1 = a1 + ax * (TR + 0.004), a1 + ax * (TR + 0.03)
        B.add(cone(v0, v1, 0.014, 0.014, seg=10), 'tankValve', 'spine')
        B.add(cone(v1, v1 + ax * 0.012, 0.024, 0.024, seg=10), 'tankValve', 'spine')
        torso(DS + 0.005, lambda c: c.y > BODY_R[1] * 0.45 and abs(c.x) < 0.06 and tz0 - 0.03 < c.z < tz1 + 0.02, 'maskStrap', seg=28, rings=18)   # 받침판
        body_ring(BODY_C.z - 0.045, DS + 0.003, 0.009, 'maskStrap', seg=20)   # 허리띠 (통 아래쪽을 묶음)
        for sx in (1, -1):   # 어깨 끈: 통 위 → 어깨 → 가슴 앞
            top = a1 + V((sx * 0.035, -TR * 0.6, 0))
            pts = [top, V((sx * 0.075, 0.03, bodyTop + 0.004)), front_point(sx * 0.075, bodyTop - 0.05, DS + 0.006), front_point(sx * 0.07, BODY_C.z - 0.045, DS + 0.006)]
            B.add(tube(pts, [0.009] * 4, seg=6), 'maskStrap', 'spine')
    else:
        raise SystemExit(f'[clothes] 모르는 kind: {kind}')

    # 마무리: 몸과 같게 법선 정리 · 키 적용 → 메시 객체
    bmesh.ops.recalc_face_normals(B.bm, faces=B.bm.faces[:])
    bmesh.ops.scale(B.bm, vec=V((H, H, H)), verts=B.bm.verts[:])
    me = bpy.data.meshes.new(CL['slug'])
    B.bm.to_mesh(me)
    B.bm.free()
    o = bpy.data.objects.new(CL['slug'], me)
    ns['scene'].collection.objects.link(o)
    for g in B.groups:
        o.vertex_groups.new(name=g)
    for name in B.mats:
        if name not in PALETTE:
            raise SystemExit(f'[clothes] 재질 {name} 가 옷 팔레트에 없다')
        m = bpy.data.materials.new(name)
        if m.name != name:
            raise SystemExit(f'[clothes] 재질 이름 {name} 가 이미 있어 {m.name} 이 됐다 — 팔레트 키를 바꾼다')
        c = ns['lin'](PALETTE[name])
        m.diffuse_color = c
        m.use_nodes = True
        bsdf = next((nd for nd in m.node_tree.nodes if nd.type == 'BSDF_PRINCIPLED'), None)
        if bsdf:
            bsdf.inputs['Base Color'].default_value = c
            bsdf.inputs['Roughness'].default_value = 0.8
        me.materials.append(m)
    return [(o, me)]


WEAR = {
    'spec': CL, 'palette': PALETTE, 'build': build,
    'glb': os.path.join(CDIR, 'models', CL['slug'] + '.glb'),
    'stats': os.path.join(CDIR, 'models', CL['slug'] + '.stats.json'),
    'renders': os.path.join(CDIR, 'renders'),
}
sys.argv = [sys.argv[0], '--', BODY_SPEC, ASSETS, *FLAGS]
src = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'build_character.py')
ns = {'__name__': '__main__', '__file__': src, 'WEAR': WEAR}
exec(compile(open(src, encoding='utf-8').read(), src, 'exec'), ns)

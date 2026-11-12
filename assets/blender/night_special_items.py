"""P54 밤 특별 상점 — 미술품 아이템 빌더 (IC-AR-01–16, 결정 D165–D169)

build_item.py 가 BUILDERS 를 만든 뒤 한 줄로 부른다:
    import night_special_items; BUILDERS.update(night_special_items.builders(globals()))
builders(g) 는 build_item.py 의 도우미(box·cylinder·ellipsoid·rail·slab·star_bm …)를 이 모듈로 가져와 쓰고,
렌더 방향 표 RENDER 에 'art' 분류를 더한다.

kind 둘:
  art-painting  : 나무 액자 + 캔버스, 뒤 다리 하나로 바닥에 비스듬히 선다. 그림은 params.motif 로 고른다 (캔버스 면 = -Y).
  art-sculpture : 작은 돌 받침(앞에 금빛 이름표) 위 조각. 조각은 params.motif 로 고른다.
그림 속 모양은 모두 이 게임만의 단순한 구성 (상자·타원·판) — 실제 명화를 따라 그리지 않는다.
원점 = 바닥 가운데 (hold: false — 바닥이나 미술품 받침 위에 선다). 재질 이름 = 팔레트 키.
"""
import math

HELPERS = ('V', 'box', 'cylinder', 'cone', 'ellipsoid', 'tube', 'rail', 'slab', 'star_bm', 'rot_xyz', 'align_z', 'bezier',
           'oval2d', 'spline2d', 'P', 'TAU', 'bmesh')

# ---------------------------------------------------------------- 그림 (art-painting)
FRAME_T, FRAME_D = 0.045, 0.045     # 액자 테 굵기 · 깊이
FOOT = 0.035                        # 액자 아래 받침 높이
TILT = 0.16                         # 뒤로 기운 각도 (라디안)


def _layer(k):
    """캔버스 면(y = -0.004)에서 앞으로 k 번째 물감 층의 y"""
    return -0.006 - 0.0018 * k


class Canvas:
    """캔버스 위에 납작한 물감 조각을 붙이는 도우미. 좌표 (x, z) 는 캔버스 가운데 기준, 단위 = 칸."""

    def __init__(self, part, cz, w, h):
        self.p, self.cz, self.w, self.h = part, cz, w, h

    def dab(self, x, z, rx, rz, mat, k=1, rot=0.0, seg=16):
        """타원 물감 (rot = 캔버스 면에서 돌린 각도)"""
        self.p.add(ellipsoid((x, _layer(k), self.cz + z), (rx, 0.0016, rz), rot=rot_xyz(y=rot), seg=seg, rings=6), mat, outline=False)

    def rect(self, x, z, w, h, mat, k=1, rot=0.0):
        self.p.add(box((x, _layer(k), self.cz + z), (w, 0.0032, h), bevel=0.0, rot=rot_xyz(y=rot)), mat, outline=False)

    def poly(self, pts, mat, k=1):
        """다각형 판 (점 = 캔버스 (x, z))"""
        self.p.add(slab([(x, self.cz + z) for x, z in pts], origin=(0, _layer(k), 0), u=(1, 0, 0), v=(0, 0, 1), thick=0.003), mat, outline=False)

    def line(self, pts, r, mat, k=1, seg=6):
        """붓 선: 캔버스 면을 따라 납작한 띠 (r = 반 굵기)"""
        P3 = [V((x, _layer(k), self.cz + z)) for x, z in pts]
        side = (0, -1, 0)
        t = P3[-1] - P3[0]
        if t.length < 1e-6:
            t = V((1, 0, 0))
        w = t.normalized().cross(V(side)).normalized()
        self.p.add(rail(P3, r, seg=seg, flat=0.12, side=tuple(w)), mat, outline=False)

    def star(self, x, z, r, mat, k=2, rot=0.0):
        self.p.add(star_bm((x, _layer(k), self.cz + z), r, 0.003, rot=rot_xyz(x=math.pi / 2) @ rot_xyz(z=rot)), mat, outline=False)

    def half_disc(self, x, z, r, mat, k=1, a0=0.0, a1=math.pi, n=12, squash=1.0):
        pts = [(x + math.cos(a0 + (a1 - a0) * i / n) * r, z + math.sin(a0 + (a1 - a0) * i / n) * r * squash) for i in range(n + 1)]
        self.poly(pts, mat, k)


# ----- 그림마다 (c = Canvas, w·h = 캔버스 안쪽 크기)
def m_sea(c, w, h):
    """「아침 바다의 돛」: 아침 하늘 · 수평선 아래 바다 · 흰 물결 줄 · 해 · 작은 돛단배"""
    c.rect(0, -h * 0.25, w, h * 0.5, 'sea', 1)
    for i, (x, z, ww) in enumerate(((-0.12, -0.06, 0.14), (0.08, -0.1, 0.18), (-0.04, -0.15, 0.2), (0.13, -0.035, 0.08))):
        c.dab(x, z, ww / 2, 0.006, 'wave', 2)
    c.dab(0.13, 0.09, 0.05, 0.05, 'sun', 1, seg=20)
    c.dab(0.13, 0.09, 0.07, 0.07, 'sunGlow', 0, seg=20)
    bx, bz = -0.07, -0.035
    c.poly([(bx - 0.065, bz + 0.015), (bx + 0.065, bz + 0.015), (bx + 0.045, bz - 0.012), (bx - 0.045, bz - 0.012)], 'boat', 2)
    c.rect(bx, bz + 0.065, 0.006, 0.1, 'boat', 2)
    c.poly([(bx + 0.006, bz + 0.11), (bx + 0.006, bz + 0.022), (bx + 0.06, bz + 0.022)], 'sail', 3)
    c.poly([(bx - 0.004, bz + 0.1), (bx - 0.004, bz + 0.03), (bx - 0.045, bz + 0.03)], 'sail', 3)


def m_hill(c, w, h):
    """「도토리 언덕」: 겹친 초록 언덕 · 큰 도토리나무 한 그루 · 구름"""
    c.dab(0.1, -h * 0.4, 0.26, 0.13, 'hill2', 1, seg=24)
    c.dab(-0.12, -h * 0.47, 0.24, 0.12, 'hill', 2, seg=24)
    c.rect(0, -h * 0.47, w, 0.04, 'hill', 2)
    tx, tz = 0.06, -0.03
    c.rect(tx, tz - 0.02, 0.022, 0.1, 'trunk', 3)
    for dx, dz, r in ((0, 0.07, 0.07), (-0.05, 0.04, 0.05), (0.05, 0.045, 0.05), (0, 0.11, 0.045)):
        c.dab(tx + dx, tz + dz, r, r * 0.85, 'leaf', 4)
    for dx, dz in ((-0.03, 0.05), (0.035, 0.07), (0.0, 0.03), (0.045, 0.02)):
        c.dab(tx + dx, tz + dz, 0.009, 0.011, 'acorn', 5, seg=10)
    for x, z, r in ((-0.15, 0.11, 0.035), (-0.11, 0.12, 0.03), (-0.19, 0.1, 0.025)):
        c.dab(x, z, r, r * 0.7, 'cloud', 1)


def m_starriver(c, w, h):
    """「별이 흐르는 강」: 밤하늘 · 굽이치는 강(앞으로 올수록 넓게) · 작은 별 · 검은 언덕 그림자"""
    c.dab(-0.12, -h * 0.36, 0.17, 0.08, 'hill', 1, seg=20)
    c.dab(0.14, -h * 0.38, 0.17, 0.07, 'hill', 1, seg=20)
    c.rect(0, -h * 0.45, w, 0.045, 'hill', 1)
    pts = [(0.03 + 0.09 * math.sin(3.6 * t + 0.4) * (1.1 - 0.6 * t), -h * 0.5 + t * h * 0.66) for t in (i / 12 for i in range(13))]
    radii = [0.045 * (1 - 0.85 * i / 12) + 0.004 for i in range(13)]
    P3 = [V((x, _layer(2), c.cz + z)) for x, z in pts]
    c.p.add(rail(P3, radii, seg=8, flat=0.06, side=(1, 0, 0)), 'river', outline=False)
    for i, (x, z, r) in enumerate(((-0.16, 0.12, 0.022), (-0.06, 0.15, 0.014), (0.05, 0.12, 0.02), (0.15, 0.14, 0.016),
                                   (0.18, 0.05, 0.012), (-0.18, 0.04, 0.012), (0.1, 0.07, 0.01), (-0.1, 0.07, 0.012))):
        c.star(x, z, r, 'star', 2, rot=i * 0.4)
    c.dab(-0.14, 0.13, 0.045, 0.045, 'starGlow', 0, seg=14)


def m_lady(c, w, h):
    """「조용한 부엉이 부인」: 초상 — 보라 옷 · 갈색 깃 머리 · 크림색 얼굴 원판 · 큰 눈 · 부리 · 꽃 달린 모자"""
    c.dab(0, -h * 0.42, 0.16, 0.12, 'dress', 1, seg=20)
    c.dab(0, -h * 0.3, 0.05, 0.03, 'collar', 2, seg=12)
    hz = 0.02
    c.dab(0, hz, 0.12, 0.11, 'feather', 2, seg=22)
    for sx in (1, -1):
        c.dab(sx * 0.045, hz + 0.005, 0.045, 0.05, 'face', 3, seg=16)
        c.dab(sx * 0.045, hz + 0.008, 0.02, 0.02, 'eye', 4, seg=12)
        c.dab(sx * 0.04, hz + 0.015, 0.006, 0.006, 'face', 5, seg=8)
        c.poly([(sx * 0.07, hz + 0.1), (sx * 0.1, hz + 0.16), (sx * 0.11, hz + 0.09)], 'feather', 2)
    c.poly([(-0.014, hz - 0.03), (0.014, hz - 0.03), (0, hz - 0.06)], 'beak', 4)
    c.dab(0, hz + 0.12, 0.15, 0.025, 'hat', 4, seg=20)
    c.poly([(-0.08, hz + 0.13), (0.08, hz + 0.13), (0.06, hz + 0.2), (-0.06, hz + 0.2)], 'hat', 4)
    c.rect(0, hz + 0.145, 0.16, 0.018, 'ribbon', 5)
    for dx, mat in ((0.055, 'flower'), (0.075, 'flower2')):
        c.dab(dx, hz + 0.155, 0.018, 0.018, mat, 6, seg=10)


def m_vase(c, w, h):
    """「창가의 꽃병」: 크림 벽 · 하늘이 보이는 창 (흰 창살) · 탁자 · 파란 꽃병 · 꽃 셋"""
    c.rect(0.0, 0.05, w * 0.62, h * 0.62, 'sill', 1)
    c.rect(0.0, 0.05, w * 0.56, h * 0.56, 'pane', 2)
    c.rect(0.0, 0.05, 0.012, h * 0.56, 'sill', 3)
    c.rect(0.0, 0.05, w * 0.56, 0.012, 'sill', 3)
    c.dab(0.07, 0.12, 0.04, 0.02, 'cloud', 3)
    c.rect(0, -h * 0.4, w, h * 0.2, 'table', 4)
    vz = -h * 0.24
    c.dab(0, vz, 0.055, 0.065, 'vase', 5, seg=18)
    c.rect(0, vz + 0.07, 0.03, 0.04, 'vase', 5)
    for dx, z, mat in ((-0.05, 0.14, 'petal'), (0.0, 0.17, 'petal2'), (0.05, 0.13, 'petal')):
        c.line([(dx * 0.2, vz + 0.08), (dx, vz + z)], 0.004, 'stem', 4)
        c.dab(dx, vz + z, 0.03, 0.03, mat, 6, seg=12)
        c.dab(dx, vz + z, 0.01, 0.01, 'petalCenter', 7, seg=8)


def m_umbrella(c, w, h):
    """「빗속의 노란 우산」: 회청색 빗속 · 비스듬한 빗줄기 · 노란 우산 하나 · 땅과 웅덩이"""
    c.rect(0, -h * 0.42, w, h * 0.16, 'ground', 1)
    c.dab(0.08, -h * 0.4, 0.09, 0.015, 'puddle', 2, seg=16)
    for i in range(14):
        x = -w * 0.45 + (i * 0.37 % 1.0) * w * 0.9
        z = -0.08 + ((i * 0.61) % 1.0) * 0.24
        c.rect(x, z, 0.004, 0.05, 'rain', 1, rot=0.3)
    ux, uz = -0.02, 0.0
    c.half_disc(ux, uz, 0.12, 'umbrella', 3, squash=0.7, n=14)
    for i in range(4):   # 우산 살 (아래 가장자리 물결)
        x = ux - 0.09 + i * 0.06
        c.dab(x, uz, 0.03, 0.01, 'bg', 4, seg=10)
    c.rect(ux, uz - 0.07, 0.008, 0.14, 'handle', 2)
    c.line([(ux, uz - 0.14), (ux + 0.012, uz - 0.158), (ux + 0.026, uz - 0.145)], 0.005, 'handle', 2)
    c.rect(ux, uz + 0.09, 0.006, 0.02, 'handle', 3)


def m_pears(c, w, h):
    """「배 세 알」: 정물 — 따뜻한 벽 · 탁자 · 흰 천 · 연두빛 배 셋 · 꼭지와 잎 하나"""
    c.rect(0, -h * 0.32, w, h * 0.36, 'table', 1)
    c.poly([(-0.2, -0.04), (0.16, -0.06), (0.22, -0.16), (-0.18, -0.17)], 'cloth', 2)
    for i, (x, z, s) in enumerate(((-0.09, -0.06, 1.0), (0.02, -0.05, 1.12), (0.12, -0.07, 0.9))):
        c.dab(x, z, 0.045 * s, 0.045 * s, 'pear', 3 + i % 2, seg=18)
        c.dab(x + 0.004, z + 0.05 * s, 0.028 * s, 0.035 * s, 'pear', 3 + i % 2, seg=14)
        c.dab(x - 0.015 * s, z + 0.01, 0.012 * s, 0.018 * s, 'pearLight', 5, seg=10)
        c.rect(x + 0.006, z + 0.095 * s, 0.006, 0.025, 'stem', 5, rot=0.2)
    c.dab(0.045, 0.08, 0.025, 0.01, 'leaf', 6, rot=-0.4, seg=12)


def m_lighthouse(c, w, h):
    """「등대가 있는 곶」: 하늘 · 바다 · 초록 곶 · 흰 바탕 빨간 띠 등대 · 노란 불빛과 빛줄기"""
    c.rect(0, -h * 0.3, w, h * 0.4, 'sea', 1)
    c.poly([(-w / 2, -h / 2), (-w / 2, -0.02), (-0.12, 0.0), (0.02, -0.06), (0.1, -h / 2)], 'cliff', 2)
    for i, (x, z) in enumerate(((0.12, -0.12), (0.18, -0.15), (0.06, -0.16))):
        c.dab(x, z, 0.03, 0.005, 'wave', 2)
    lx, lz = -0.1, 0.0
    c.poly([(lx - 0.03, lz), (lx + 0.03, lz), (lx + 0.02, lz + 0.14), (lx - 0.02, lz + 0.14)], 'tower', 3)
    for zz in (0.03, 0.085):
        c.rect(lx, lz + zz, 0.056 - zz * 0.14, 0.022, 'stripe', 4)
    c.rect(lx, lz + 0.155, 0.034, 0.03, 'lamp', 4)
    c.poly([(lx - 0.026, lz + 0.17), (lx + 0.026, lz + 0.17), (lx, lz + 0.2)], 'stripe', 4)
    c.poly([(lx + 0.02, lz + 0.16), (w / 2 - 0.01, lz + 0.2), (w / 2 - 0.01, lz + 0.11)], 'beam', 1)
    c.dab(0.12, 0.13, 0.03, 0.012, 'cloud', 2)


def m_leaves(c, w, h):
    """「춤추는 단풍」: 크림 바탕에 단풍잎 여럿이 소용돌이 선을 따라 돈다 (추상)"""
    pts = []
    for i in range(22):
        t = i / 21
        a = 5.2 * t
        r = 0.02 + 0.15 * t
        pts.append((math.cos(a) * r * 1.2, math.sin(a) * r))
    c.line(pts, 0.006, 'swirl', 1, seg=6)
    cols = ('leafA', 'leafB', 'leafC')
    for i, (x, z, r) in enumerate(((0.0, 0.0, 0.045), (0.14, 0.06, 0.035), (-0.12, 0.09, 0.03), (-0.16, -0.06, 0.04),
                                   (0.1, -0.1, 0.03), (0.2, -0.04, 0.022), (-0.04, -0.13, 0.025), (0.04, 0.12, 0.022))):
        c.star(x, z, r, cols[i % 3], 2 + i % 2, rot=i * 0.7)
        c.line([(x, z), (x + r * 0.5 * math.sin(i), z - r * 1.1)], 0.003, cols[i % 3], 2 + i % 2, seg=4)


def m_mooncat(c, w, h):
    """「달을 보는 고양이」: 밤하늘 · 큰 둥근 달 · 지붕 비탈 · 지붕 위에 앉아 달을 보는 고양이 그림자"""
    c.dab(0.07, 0.06, 0.11, 0.11, 'moon', 1, seg=24)
    c.dab(0.05, 0.09, 0.02, 0.018, 'moonShade', 2, seg=10)
    c.dab(0.11, 0.03, 0.015, 0.013, 'moonShade', 2, seg=10)
    c.poly([(-w / 2, -h / 2), (-w / 2, -0.07), (0.0, -0.1), (w / 2, -0.17), (w / 2, -h / 2)], 'roof', 2)
    c.rect(-0.16, -0.03, 0.03, 0.06, 'roof', 2)
    cx, cz = -0.06, -0.06
    c.dab(cx, cz, 0.032, 0.04, 'cat', 3, seg=14)
    c.dab(cx + 0.012, cz + 0.05, 0.022, 0.021, 'cat', 3, seg=12)
    for dx in (-0.004, 0.026):
        c.poly([(cx + dx - 0.008, cz + 0.064), (cx + dx + 0.008, cz + 0.064), (cx + dx + 0.003, cz + 0.085)], 'cat', 3)
    c.line([(cx - 0.03, cz - 0.03), (cx - 0.06, cz - 0.02), (cx - 0.065, cz + 0.02), (cx - 0.05, cz + 0.035)], 0.007, 'cat', 3)
    for i, (x, z, r) in enumerate(((-0.18, 0.14, 0.012), (-0.08, 0.12, 0.01), (-0.15, 0.06, 0.008), (0.2, 0.15, 0.01))):
        c.star(x, z, r, 'star', 2, rot=i)


MOTIFS = {'sea': m_sea, 'hill': m_hill, 'starriver': m_starriver, 'lady': m_lady, 'vase': m_vase, 'umbrella': m_umbrella,
          'pears': m_pears, 'lighthouse': m_lighthouse, 'leaves': m_leaves, 'mooncat': m_mooncat}
PORTRAIT = {'lady', 'vase'}


def b_art_painting(M):
    """미술품 그림 (art-painting): 나무 액자 + 그림 캔버스. 아래 받침 막대에 올려 뒤로 살짝 기울이고, 뒤 다리 하나로 버틴다."""
    motif = P.get('motif', 'sea')
    w, h = (0.36, 0.46) if motif in PORTRAIT else (0.46, 0.36)
    W, H = w + FRAME_T * 2, h + FRAME_T * 2
    cz = FOOT + H / 2
    m = M.part('art')
    m.add(box((0, 0.006, cz), (w + 0.012, 0.02, h + 0.012), bevel=0.0), 'bg')
    for x, z, sx, sz in ((0, cz + H / 2 - FRAME_T / 2, W, FRAME_T), (0, cz - H / 2 + FRAME_T / 2, W, FRAME_T),
                         (-W / 2 + FRAME_T / 2, cz, FRAME_T, H), (W / 2 - FRAME_T / 2, cz, FRAME_T, H)):
        m.add(box((x, 0, z), (sx, FRAME_D, sz), bevel=0.008), 'frame')
    for x, z, sx, sz in ((0, cz + h / 2 + 0.006, w + 0.02, 0.008), (0, cz - h / 2 - 0.006, w + 0.02, 0.008),
                         (-w / 2 - 0.006, cz, 0.008, h + 0.02), (w / 2 + 0.006, cz, 0.008, h + 0.02)):
        m.add(box((x, -FRAME_D / 2 - 0.001, z), (sx, 0.004, sz), bevel=0.0), 'frameTrim', outline=False)   # 안쪽 금빛 줄
    n0 = len(m.bm.verts)
    MOTIFS[motif](Canvas(m, cz, w, h), w, h)
    for v in list(m.bm.verts)[n0:]:   # 캔버스 밖으로 나간 물감은 테두리에서 자른다 (납작한 판이라 눌러도 모양이 맞다)
        v.co.x = max(-w / 2, min(w / 2, v.co.x))
        v.co.z = max(cz - h / 2, min(cz + h / 2, v.co.z))
    # 뒤로 기울이기: 아래 앞 모서리(받침 위)를 축으로
    pivot = V((0, -FRAME_D / 2, FOOT))
    R = rot_xyz(x=-TILT)
    for v in m.bm.verts:
        v.co = pivot + R @ (v.co - pivot)
    # 받침 막대 (액자 아래) · 뒤 다리 · 앞 턱
    m.add(box((0, -0.005, FOOT / 2), (W + 0.02, 0.09, FOOT), bevel=0.008), 'stand')
    m.add(box((0, -0.05, FOOT + 0.012), (W * 0.9, 0.012, 0.024), bevel=0.003), 'stand')
    top = pivot + R @ (V((0, FRAME_D, cz + H * 0.25)) - pivot)
    foot = V((0, top.y + (top.z) * 0.42, 0.0))
    m.add(rail([top, foot], 0.012, seg=6), 'stand')


# ---------------------------------------------------------------- 조각 (art-sculpture)
PED_W, PED_H = 0.28, 0.16


def pedestal(m):
    """작은 돌 받침 (위·아래 테 + 앞 금빛 이름표). 윗면 높이 = PED_H"""
    m.add(box((0, 0, 0.015), (PED_W + 0.04, PED_W + 0.04, 0.03), bevel=0.008), 'baseDark')
    m.add(box((0, 0, 0.03 + (PED_H - 0.055) / 2), (PED_W, PED_W, PED_H - 0.055), bevel=0.01), 'base')
    m.add(box((0, 0, PED_H - 0.0125), (PED_W + 0.03, PED_W + 0.03, 0.025), bevel=0.008), 'baseDark')
    m.add(box((0, -PED_W / 2 - 0.002, 0.085), (0.12, 0.006, 0.04), bevel=0.002), 'plate', outline=False)
    return PED_H


def s_frog(m, z0):
    """「생각하는 개구리」: 바위에 앉아 무릎에 팔꿈치를 대고 손으로 턱을 괸 개구리 (청동)"""
    m.add(ellipsoid((0, 0.015, z0 + 0.035), (0.1, 0.085, 0.04), seg=12, rings=6), 'bronzeDark')   # 앉은 바위
    b = V((0, 0.015, z0 + 0.115))
    m.add(ellipsoid(b, (0.08, 0.068, 0.07), rot=rot_xyz(x=0.2), seg=16, rings=10), 'bronze')
    hd = V((0, -0.02, z0 + 0.2))
    m.add(ellipsoid(hd, (0.092, 0.07, 0.046), rot=rot_xyz(x=0.15), seg=18, rings=10), 'bronze')
    for sx in (1, -1):
        e = hd + V((sx * 0.052, -0.012, 0.038))
        m.add(ellipsoid(e, (0.03, 0.028, 0.028), seg=12, rings=8), 'bronze')
        m.add(ellipsoid(e + V((0, -0.024, 0.004)), (0.014, 0.008, 0.014), seg=8, rings=5), 'bronzeDark', outline=False)
        # 뒷다리 (접어 앉음) + 발
        m.add(ellipsoid((sx * 0.07, -0.025, z0 + 0.09), (0.032, 0.065, 0.03), rot=rot_xyz(z=sx * 0.25), seg=10, rings=6), 'bronze')
        m.add(ellipsoid((sx * 0.075, -0.085, z0 + 0.065), (0.03, 0.022, 0.01), seg=8, rings=4), 'bronze')
    mouth = [hd + V((math.sin(a) * 0.06, -0.066 + 0.02 * (1 - math.cos(a)), -0.012 + 0.006 * math.cos(a))) for a in (-1.0, -0.5, 0.0, 0.5, 1.0)]
    m.add(rail(mouth, 0.0035, seg=4), 'bronzeDark', outline=False)
    # 오른팔: 팔꿈치를 무릎에 대고 손으로 턱을 괸다, 왼팔: 무릎 위에 손을 얹음
    r = [V((-0.065, 0.0, z0 + 0.14)), V((-0.075, -0.075, z0 + 0.115)), V((-0.04, -0.09, z0 + 0.145)), V((-0.015, -0.085, z0 + 0.165))]
    m.add(rail(r, [0.017, 0.015, 0.014, 0.013], seg=8), 'bronze')
    m.add(ellipsoid(r[-1] + V((0.005, 0, 0.004)), (0.024, 0.018, 0.012), seg=8, rings=5), 'bronze')
    l = [V((0.065, 0.0, z0 + 0.14)), V((0.08, -0.06, z0 + 0.11)), V((0.07, -0.095, z0 + 0.095))]
    m.add(rail(l, [0.017, 0.015, 0.013], seg=8), 'bronze')
    m.add(ellipsoid(l[-1], (0.022, 0.018, 0.01), seg=8, rings=4), 'bronze')


def s_spiral(m, z0):
    """「물결 나선」: 바닥에서 감아 올라 끝이 파도처럼 말리는 나선 띠 + 꼭대기 물보라"""
    pts, radii = [], []
    n = 26
    for i in range(n + 1):
        t = i / n
        a = TAU * 1.35 * t
        r = 0.09 * (1 - 0.55 * t)
        pts.append(V((math.cos(a) * r, math.sin(a) * r, z0 + 0.02 + 0.3 * t)))
        radii.append(0.032 * (1 - 0.6 * t) + 0.008)
    m.add(rail(pts, radii, seg=8, flat=0.55), 'wave')
    tip = pts[-1]
    curl = [tip + V((math.cos(a) * 0.035, 0, 0.035 + math.sin(a) * 0.035)) for a in (math.pi * (1.5 - 1.3 * t) for t in (i / 6 for i in range(7)))]
    m.add(rail([tip] + curl, [0.012] + [0.012 * (1 - 0.6 * i / 6) + 0.003 for i in range(7)], seg=6), 'wave')
    for k, (x, y, z, r) in enumerate(((0.02, -0.01, 0.36, 0.014), (-0.02, 0.01, 0.37, 0.011), (0.0, -0.02, 0.39, 0.009))):
        m.add(ellipsoid((x, y, z0 + z), (r, r, r), seg=8, rings=5), 'foam')
    m.add(cylinder((0, 0, z0), (0, 0, z0 + 0.02), 0.1, 0.09, seg=16), 'wave')


def s_acorn(m, z0):
    """「큰 도토리 조각」: 매끈한 도토리 알 + 비늘 무늬 깍정이(모자) + 꼭지"""
    c = V((0, 0, z0 + 0.13))
    m.add(ellipsoid(c, (0.1, 0.1, 0.12), seg=18, rings=12), 'nut')
    m.add(cone(c + V((0, 0, -0.12)), c + V((0, 0, -0.14)), 0.02, 0.0, seg=8), 'nut')
    capc = c + V((0, 0, 0.06))
    cap = ellipsoid(capc, (0.112, 0.112, 0.075), seg=18, rings=10)
    bmesh.ops.delete(cap, geom=[v for v in cap.verts if v.co.z < capc.z - 0.012], context='VERTS')
    m.add(cap, 'cap')
    m.add(cylinder(capc - V((0, 0, 0.012)), capc - V((0, 0, 0.0)), 0.112, seg=18), 'cap')
    for ring, (zz, rr) in enumerate(((0.012, 0.106), (0.04, 0.088), (0.062, 0.058))):
        for k in range(10 - ring * 3):
            a = TAU * (k + 0.5 * ring) / (10 - ring * 3)
            p = capc + V((math.cos(a) * rr, math.sin(a) * rr, zz))
            m.add(ellipsoid(p, (0.016, 0.016, 0.008), rot=align_z(p - capc), seg=6, rings=3), 'capDark', outline=False)
    m.add(rail([capc + V((0, 0, 0.07)), capc + V((0.01, 0, 0.1)), capc + V((0.025, 0, 0.11))], 0.01, seg=6), 'cap')


def s_bird(m, z0):
    """「날아오르는 새」: 받침에서 휘어 오르는 가는 기둥 끝에 날개를 위로 펼친 새 (은빛 금속)"""
    stem = bezier((0, 0.02, z0), (0, 0.02, z0 + 0.1), (-0.04, 0.0, z0 + 0.14), (-0.01, -0.01, z0 + 0.22), 8)
    m.add(rail(stem, [0.014 - 0.006 * i / 8 for i in range(9)], seg=6), 'rod')
    m.add(cylinder((0, 0.02, z0), (0, 0.02, z0 + 0.02), 0.05, 0.04, seg=12), 'rod')
    b = V((0, -0.01, z0 + 0.27))
    R = rot_xyz(x=-0.7)
    m.add(ellipsoid(b, (0.032, 0.075, 0.032), rot=R, seg=12, rings=8), 'bird')
    head = b + R @ V((0, -0.08, 0.0))
    m.add(ellipsoid(head, (0.026, 0.026, 0.026), seg=10, rings=6), 'bird')
    m.add(cone(head + V((0, -0.022, 0.0)), head + V((0, -0.05, 0.004)), 0.01, 0.0, seg=6), 'beak')
    tail = b + R @ V((0, 0.08, 0))
    m.add(slab([(-0.02, 0), (0.02, 0), (0.035, -0.06), (0, -0.045), (-0.035, -0.06)], origin=tail, u=(1, 0, 0), v=tuple(R @ V((0, 0, -1))), thick=0.008), 'bird')
    for sx in (1, -1):   # 날개: 어깨에서 위·바깥으로
        pts = [(0, 0), (0.05, 0.03), (0.11, 0.1), (0.13, 0.16), (0.09, 0.12), (0.075, 0.13), (0.05, 0.08), (0.02, 0.06)]
        wing = slab([(sx * x, y) for x, y in pts], origin=b + V((sx * 0.02, 0.0, 0.0)), u=(1, 0, 0), v=(0, 0.25, 1), thick=0.01)
        m.add(wing, 'bird')


def s_bust(m, z0):
    """「곰 흉상」: 둥근 곰 머리와 어깨 (흰 대리석), 둥근 귀 · 주둥이 · 감은 눈, 아래 작은 받침"""
    m.add(cylinder((0, 0, z0), (0, 0, z0 + 0.03), 0.08, 0.07, seg=16), 'marbleDark')
    m.add(ellipsoid((0, 0.0, z0 + 0.09), (0.12, 0.075, 0.07), seg=18, rings=10), 'marble')   # 어깨
    m.add(cylinder((0, 0, z0 + 0.12), (0, 0, z0 + 0.17), 0.05, seg=14), 'marble')            # 목
    hd = V((0, -0.005, z0 + 0.23))
    m.add(ellipsoid(hd, (0.085, 0.075, 0.075), seg=18, rings=12), 'marble')
    for sx in (1, -1):
        m.add(ellipsoid(hd + V((sx * 0.06, 0.01, 0.06)), (0.03, 0.018, 0.03), seg=10, rings=6), 'marble')
        m.add(rail([hd + V((sx * 0.045, -0.068, 0.015)), hd + V((sx * 0.03, -0.073, 0.02)), hd + V((sx * 0.015, -0.07, 0.015))], 0.004, seg=4), 'marbleDark')
    m.add(ellipsoid(hd + V((0, -0.065, -0.02)), (0.04, 0.03, 0.03), seg=12, rings=8), 'marble')   # 주둥이
    m.add(ellipsoid(hd + V((0, -0.093, -0.008)), (0.013, 0.008, 0.01), seg=8, rings=4), 'marbleDark', outline=False)


def s_tower(m, z0):
    """「돌탑 셋」: 크기·색이 조금씩 다른 매끈한 돌 셋을 쌓은 탑"""
    z = z0
    for k, (rx, ry, rz, mat, tilt) in enumerate(((0.11, 0.09, 0.05, 'stoneA', 0.0), (0.08, 0.07, 0.042, 'stoneB', 0.12), (0.055, 0.05, 0.035, 'stoneC', -0.1))):
        z += rz * 0.92
        m.add(ellipsoid((0.006 * k, 0, z), (rx, ry, rz), rot=rot_xyz(y=tilt, z=k * 0.6), seg=16, rings=10), mat)
        z += rz * 0.92


SCULPTS = {'frog': s_frog, 'spiral': s_spiral, 'acorn': s_acorn, 'bird': s_bird, 'bust': s_bust, 'tower': s_tower}


def b_art_sculpture(M):
    """미술품 조각 (art-sculpture): 작은 돌 받침 + 조각 (params.motif)"""
    m = M.part('art')
    z0 = pedestal(m)
    SCULPTS[P.get('motif', 'tower')](m, z0)


def builders(g):
    """build_item.py 의 globals 를 받아 도우미를 이 모듈에 묶고, 새 빌더 표를 돌려준다."""
    globals().update({k: g[k] for k in HELPERS if k in g})
    if 'bmesh' not in globals():
        import bmesh as _b
        globals()['bmesh'] = _b
    if 'RENDER' in g:
        g['RENDER']['art'] = (-20, 12)
    return {'art-painting': b_art_painting, 'art-sculpture': b_art_sculpture}

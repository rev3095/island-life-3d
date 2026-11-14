"""M19-P2 주민 사연 ② 답례 가구 빌더 (FU-105–108, 16차 보드 wave16 D201-A)

build_furniture.py 가 BUILDERS 를 만든 뒤 한 줄로 부른다:
    import story_furniture; BUILDERS.update(story_furniture.builders(globals()))

가구 (assets/furniture, 아이템 furn.*, src/data/story-items.js):
  보리 낮잠 방석 FU-105 (바닥 1×1) · 모찌 꽃말 액자 FU-106 (벽) · 퐁 할머니 요리책 FU-107 (바닥 1×1, 책 받침대) · 구름 등대 그림 FU-108 (벽)
좌표: Blender Z-up, 정면 = -Y, 1.0 = 한 칸, 원점 = 바닥 가운데 (벽 가구는 벽면 바닥 — 액자 그림 FU-16 · 타로 액자 FU-78 과 같은 자리).
"""
import math

HELPERS = ('V', 'box', 'cylinder', 'cone', 'ellipsoid', 'capsule', 'tube', 'rail', 'annulus', 'star_shape', 'rot_xyz', 'align_z', 'bezier',
           'P', 'TAU')


def _wall_frame(m, cz, W, H, T=0.06, mat='frame', dark='frameDark'):
    """벽 액자 테 넷 + 걸이 끈 (원점 = 벽면 바닥, 앞 = -Y)"""
    for cx, z, sx, sz in ((0, cz + H / 2 - T / 2, W, T), (0, cz - H / 2 + T / 2, W, T), (-W / 2 + T / 2, cz, T, H), (W / 2 - T / 2, cz, T, H)):
        m.add(box((cx, -0.04, z), (sx, 0.06, sz), bevel=0.015), mat)
    nail = V((0, -0.02, cz + H / 2 + 0.12))
    for sx in (1, -1):
        m.add(tube([V((sx * W * 0.32, -0.02, cz + H / 2 - 0.02)), nail], [0.005, 0.005], seg=6), 'string', outline=False)
    m.add(ellipsoid(nail, (0.018, 0.012, 0.018), seg=10, rings=6), dark)


def b_nap_cushion(M):
    """FU-105 보리의 낮잠 방석 (바닥 1×1): 둥글넓적한 방석 + 가운데 오목 + 뼈다귀 무늬 둘 + 접힌 담요 한 장 + 작은 달 베개."""
    s = P.get('puff', 1.0)
    m = M.part('cushion')
    m.add(ellipsoid((0, 0, 0.09 * s), (0.44, 0.42, 0.1 * s), seg=32, rings=12), 'cushion')
    m.add(annulus((0, 0, 0.12 * s), 0.3, 0.43, thick=0.05 * s, seg=32), 'cushionEdge')   # 도톰한 테
    m.add(ellipsoid((0, 0.02, 0.16 * s), (0.3, 0.28, 0.035), seg=28, rings=8), 'cushionTop')
    for k in range(10):   # 테 둘레 바느질 땀
        a = TAU * k / 10
        m.add(box((math.cos(a) * 0.4, math.sin(a) * 0.38, 0.16 * s), (0.04, 0.012, 0.01), bevel=0.0, rot=rot_xyz(z=a + math.pi / 2)), 'stitch', outline=False)
    for x, y, a in ((-0.12, -0.08, 0.5), (0.14, 0.1, -0.4)):   # 뼈다귀 무늬 (윗면)
        c, d = math.cos(a), math.sin(a)
        p0, p1 = V((x - c * 0.06, y - d * 0.06, 0.195 * s)), V((x + c * 0.06, y + d * 0.06, 0.195 * s))
        m.add(capsule(p0, p1, 0.014, seg=8, rings=4), 'bone', outline=False)
        for p in (p0, p1):
            for sx in (1, -1):
                m.add(ellipsoid(p + V((-d * sx * 0.015, c * sx * 0.015, 0)), (0.02, 0.02, 0.008), seg=8, rings=4), 'bone', outline=False)
    # 접힌 담요 (방석 뒤쪽에 걸침)
    m.add(box((0.1, 0.24, 0.2 * s), (0.42, 0.16, 0.05), bevel=0.02, rot=rot_xyz(x=-0.25, z=0.12)), 'blanket')
    m.add(box((0.1, 0.25, 0.235 * s), (0.42, 0.14, 0.012), bevel=0.004, rot=rot_xyz(x=-0.25, z=0.12)), 'blanketLine', outline=False)
    # 작은 달 모양 베개 (앞 왼쪽)
    m.add(ellipsoid((-0.2, -0.16, 0.22 * s), (0.11, 0.07, 0.06), rot=rot_xyz(z=0.4), seg=16, rings=8), 'pillow')
    m.add(ellipsoid((-0.16, -0.19, 0.24 * s), (0.08, 0.06, 0.05), rot=rot_xyz(z=0.4), seg=14, rings=6), 'cushionTop', outline=False)


def b_flower_word_frame(M):
    """FU-106 모찌의 꽃말 액자 (벽): 연분홍 테 · 크림 바탕 위 눌러 말린 꽃 다섯 (튤립·데이지·제비꽃·장미·안개꽃) + 아래 리본 (글자 없음)."""
    m = M.part('frame')
    cz, W, H = 1.5, 0.78, 0.56
    _wall_frame(m, cz, W, H)
    m.add(box((0, -0.025, cz), (W - 0.07, 0.02, H - 0.07), bevel=0.003), 'paper')
    y = -0.038
    flowers = ((-0.25, 0.06, 'petalA'), (-0.12, 0.1, 'petalB'), (0.0, 0.07, 'petalC'), (0.12, 0.11, 'petalD'), (0.25, 0.05, 'petalE'))
    for i, (x, dz, mat) in enumerate(flowers):
        top = cz + dz
        m.add(box((x, y, top - 0.1), (0.008, 0.004, 0.2), bevel=0.0, rot=rot_xyz(y=(i - 2) * 0.12)), 'stem', outline=False)
        m.add(ellipsoid((x + 0.03, y, top - 0.12), (0.03, 0.003, 0.012), rot=rot_xyz(y=0.6), seg=10, rings=4), 'stem', outline=False)
        n = 5 if i != 4 else 7
        r = 0.035 if i != 4 else 0.02
        for k in range(n):
            a = TAU * k / n
            m.add(ellipsoid((x + math.cos(a) * r, y, top + math.sin(a) * r), (r * 0.8, 0.003, r * 0.55), rot=rot_xyz(y=-a), seg=10, rings=4), mat, outline=False)
        m.add(ellipsoid((x, y - 0.002, top), (r * 0.45, 0.003, r * 0.45), seg=10, rings=4), 'center', outline=False)
    # 아래 리본 (꽃줄기를 묶은)
    m.add(ellipsoid((0, y - 0.004, cz - 0.17), (0.05, 0.004, 0.025), seg=12, rings=4), 'ribbon', outline=False)
    for sx in (1, -1):
        m.add(box((sx * 0.04, y - 0.004, cz - 0.2), (0.025, 0.004, 0.06), bevel=0.0, rot=rot_xyz(y=sx * 0.3)), 'ribbon', outline=False)


def b_grandma_cookbook(M):
    """FU-107 퐁 할머니의 요리책 (바닥 1×1): 나무 책 받침대 위 펼친 두꺼운 요리책 · 끼운 쪽지 · 책갈피 끈 · 옆에 작은 국자."""
    m = M.part('stand')
    # 받침대: 다리 넷 + 기울어진 판
    for sx in (1, -1):
        for sy in (1, -1):
            m.add(box((sx * 0.22, sy * 0.14, 0.32), (0.05, 0.05, 0.64), bevel=0.012), 'wood')
    m.add(box((0, 0, 0.2), (0.48, 0.3, 0.03), bevel=0.01), 'wood')   # 가운데 선반
    tilt = rot_xyz(x=0.35)
    m.add(box((0, 0.0, 0.68), (0.56, 0.4, 0.04), bevel=0.012, rot=tilt), 'woodDark')
    m.add(box((0, -0.2, 0.62), (0.56, 0.04, 0.05), bevel=0.01), 'woodDark')   # 앞 턱
    b = M.part('book')
    # 펼친 책: 표지 둘 + 쪽 묶음 (왼·오)
    for sx in (1, -1):
        b.add(box((sx * 0.13, 0.0, 0.715), (0.25, 0.34, 0.02), bevel=0.006, rot=rot_xyz(x=0.35, y=sx * -0.08)), 'cover')
        b.add(box((sx * 0.125, -0.005, 0.735), (0.23, 0.32, 0.03), bevel=0.008, rot=rot_xyz(x=0.35, y=sx * -0.08)), 'page')
        for k in range(4):   # 쪽 위 레시피 줄 (글자 없음)
            b.add(box((sx * 0.125, 0.06 - k * 0.055, 0.77 - k * 0.02), (0.16 - (k % 2) * 0.04, 0.008, 0.003), bevel=0.0, rot=rot_xyz(x=0.35, y=sx * -0.08)), 'ink', outline=False)
    b.add(box((0.15, -0.06, 0.75), (0.08, 0.06, 0.003), bevel=0.0, rot=rot_xyz(x=0.35, z=0.2)), 'note', outline=False)   # 끼운 쪽지
    b.add(box((0.0, -0.17, 0.62), (0.012, 0.004, 0.14), bevel=0.0), 'ribbon', outline=False)   # 책갈피 끈
    # 아래 선반의 작은 국자
    b.add(ellipsoid((0.1, 0.0, 0.24), (0.05, 0.05, 0.025), seg=14, rings=6), 'metal')
    b.add(capsule((0.1, 0.0, 0.24), (-0.14, 0.04, 0.25), 0.01, seg=8, rings=4), 'metal')


def b_lighthouse_painting(M):
    """FU-108 구름의 등대 그림 (벽): 나무 테 · 노을 하늘 · 바다 · 곶 위 빨강·하양 등대(불빛 줄기) · 작은 섬 그림자 (M19-P4 「등대 다시 켜기」로 이어지는 옛 그림)."""
    m = M.part('frame')
    cz, W, H = 1.5, 0.9, 0.62
    _wall_frame(m, cz, W, H, mat='frame', dark='frameDark')
    y = -0.026
    iw, ih = W - 0.08, H - 0.08
    m.add(box((0, y, cz + ih * 0.18), (iw, 0.018, ih * 0.64), bevel=0.0), 'sky', outline=False)
    m.add(box((0, y - 0.001, cz + ih * 0.32), (iw, 0.018, ih * 0.2), bevel=0.0), 'skyGlow', outline=False)
    m.add(box((0, y, cz - ih * 0.32), (iw, 0.018, ih * 0.36), bevel=0.0), 'sea', outline=False)
    for k in range(3):   # 물결 줄
        m.add(box((-0.1 + k * 0.12, y - 0.012, cz - 0.16 - k * 0.04), (0.14, 0.003, 0.008), bevel=0.0), 'wave', outline=False)
    fy = y - 0.012
    m.add(ellipsoid((0.22, fy, cz - 0.11), (0.17, 0.004, 0.07), seg=18, rings=4), 'land', outline=False)   # 곶
    m.add(ellipsoid((-0.25, fy, cz - 0.1), (0.08, 0.004, 0.025), seg=14, rings=4), 'landDark', outline=False)   # 먼 작은 섬
    # 등대: 띠 셋 + 불빛 칸 + 지붕
    lx = 0.22
    for k in range(4):
        m.add(box((lx, fy - 0.002, cz - 0.06 + k * 0.045), (0.06 - k * 0.006, 0.004, 0.045), bevel=0.0), 'tower' if k % 2 == 0 else 'towerBand', outline=False)
    m.add(box((lx, fy - 0.003, cz + 0.13), (0.05, 0.004, 0.035), bevel=0.0), 'lamp', outline=False)
    m.add(box((lx, fy - 0.003, cz + 0.165), (0.06, 0.004, 0.02), bevel=0.0), 'towerBand', outline=False)
    for sx in (1, -1):   # 불빛 줄기
        m.add(box((lx + sx * 0.12, fy - 0.004, cz + 0.13), (0.2, 0.003, 0.018), bevel=0.0, rot=rot_xyz(y=sx * 0.08)), 'beam', outline=False)
    m.add(star_shape(V((-0.3, fy - 0.003, cz + 0.2)), 0.02, 0.003, puff=0.1), 'beam', outline=False)
    # 그림 아래 작은 붓 서명 자리 (글자 없음)
    m.add(box((-0.32, fy - 0.003, cz - 0.24), (0.06, 0.003, 0.01), bevel=0.0), 'frameDark', outline=False)


def builders(g):
    """build_furniture.py 의 globals 를 받아 도우미를 이 모듈에 묶고, 새 빌더 표를 돌려준다."""
    globals().update({k: g[k] for k in HELPERS if k in g})
    return {
        'nap-cushion': b_nap_cushion, 'flower-word-frame': b_flower_word_frame,
        'grandma-cookbook': b_grandma_cookbook, 'lighthouse-painting': b_lighthouse_painting,
    }

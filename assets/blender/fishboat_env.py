"""east-fishboat 어선 선착장 BD-19 — 작은 부두(fish-dock) · 어선(fish-boat) 빌더 (D275).

build_env.py 가 BUILDERS 를 만든 뒤 한 줄로 부른다:
    import fishboat_env; BUILDERS.update(fishboat_env.builders(globals()))
게임은 src/gameplay/boat/ 가 섬 동쪽 끝 바닷가(assets/island/layout.json fishDock)에 놓는다 (world.objects persist:false).
먼바다(x 1100)에서는 어선만 따로 띄워 갑판 위에서 낚시한다.
좌표: Blender Z-up, +X = 게임 동쪽(바다 쪽), -Y = 남쪽(카메라 쪽), 1.0 = 한 칸. 원점 = 바닷가 칸 바닥 (물 윗면 -0.15).
재질 이름 = 스펙 팔레트 키. 'glow' 는 밤에 켜진다 (부두 등불·조타실 등).
"""
import math

HELPERS = ('V', 'box', 'cylinder', 'cone', 'ellipsoid', 'tube', 'wedge', 'prism', 'rot_xyz', 'P', 'TAU')


def b_fish_dock(M):
    """BD-19 부두: 바다 쪽(+X)으로 뻗은 짧은 나무 잔교 + 말뚝 + 등불 + 어망 상자. 뿌리(x 0)가 모래 끝."""
    L, W = 3.0 * P.get('length', 1), 1.1 * P.get('width', 1)
    deck = 0.22
    m = M.part('dock')
    n = int(L / 0.22)
    for i in range(n):
        x = (i + 0.5) * L / n
        m.add(box((x, 0, deck), (L / n * 0.86, W, 0.07), bevel=0.012), 'wood' if i % 2 else 'woodDark')
    for sy in (1, -1):
        m.add(box((L / 2, sy * (W / 2 - 0.06), deck - 0.07), (L, 0.09, 0.09), bevel=0.02), 'woodDark')
        for k in range(4):
            x = 0.15 + k * (L - 0.3) / 3
            m.add(cylinder((x, sy * (W / 2 - 0.04), -0.7), (x, sy * (W / 2 - 0.04), deck + 0.16), 0.07, seg=10), 'woodDark')
    # 끝 말뚝 + 밧줄 고리
    tip = V((L - 0.15, -W / 2 + 0.05, deck))
    m.add(cylinder(tip, tip + V((0, 0, 0.32)), 0.08, 0.07, seg=12), 'woodDark')
    ring = [tip + V((math.cos(a) * 0.11, math.sin(a) * 0.11, 0.18)) for a in (TAU * i / 16 for i in range(16))]
    m.add(tube(ring, [0.02] * 16, seg=8, closed=True), 'rope')
    # 등불 기둥 (뿌리 쪽 북쪽)
    lamp = M.part('lamp')
    base = V((0.35, W / 2 - 0.12, deck))
    lamp.add(cylinder(base, base + V((0, 0, 1.05)), 0.04, 0.035, seg=10), 'woodDark')
    lamp.add(box(base + V((0.12, 0, 1.0)), (0.28, 0.04, 0.04), bevel=0.01), 'woodDark')
    lamp.add(box(base + V((0.24, 0, 0.86)), (0.13, 0.13, 0.16), bevel=0.02), 'glow', outline=False)
    lamp.add(prism(base + V((0.24, 0, 0.95)), 0.17, 0.17, 0.07, ridge='x'), 'roof')
    # 어망 상자 · 둘둘 만 그물
    props = M.part('props')
    c = V((1.1, W / 2 - 0.25, deck + 0.13))
    props.add(box(c, (0.36, 0.26, 0.22), bevel=0.02), 'crate')
    props.add(ellipsoid(c + V((0, 0, 0.13)), (0.15, 0.1, 0.05), seg=12, rings=6), 'net')
    props.add(ellipsoid(V((1.65, W / 2 - 0.2, deck + 0.07)), (0.2, 0.14, 0.07), seg=14, rings=7), 'net')
    props.add(ellipsoid(V((1.65, W / 2 - 0.2, deck + 0.12)), (0.09, 0.06, 0.03), seg=10, rings=5), 'buoy')


def b_fish_boat(M):
    """BD-19 어선: 통통한 나무 고깃배 + 앞쪽 조타실 + 뒤쪽 갑판(낚시 자리) + 깃발. 길이는 X (+X = 뱃머리, 게임 동쪽).
    원점 = 물 위 기준 (부두 옆 바다 칸 바닥 0). 갑판 높이 DECK = 0.18 (게임 boat.json deck 와 같게)."""
    L, W = 2.8 * P.get('length', 1), 1.25 * P.get('width', 1)
    DECK = 0.18
    zc = -0.1
    hull = M.part('hull')
    hull.add(ellipsoid((0, 0, zc), (L / 2, W / 2, 0.32), seg=24, rings=10), 'hull')
    hull.add(ellipsoid((0, 0, zc - 0.04), (L / 2 + 0.01, W / 2 + 0.01, 0.13), seg=24, rings=8), 'stripe', outline=False)
    hull.add(ellipsoid((0, 0, DECK - 0.02), (L * 0.44, W * 0.4, 0.04), seg=24, rings=6), 'deck')
    rail = [V((math.cos(a) * L * 0.47, math.sin(a) * W * 0.46, DECK + 0.08)) for a in (TAU * i / 28 for i in range(28))]
    hull.add(tube(rail, [0.045] * 28, seg=8, closed=True), 'hullDark')
    # 뱃머리 이름판 · 부표 둘
    hull.add(box((L * 0.36, -W * 0.45, DECK - 0.02), (0.36, 0.03, 0.1), bevel=0.01), 'trim')
    for sx in (-0.18, 0.12):
        hull.add(ellipsoid((sx * L, -W * 0.5, DECK - 0.08), (0.07, 0.05, 0.09), seg=10, rings=6), 'buoy')
    # 조타실 (앞쪽)
    cab = M.part('cabin')
    cx = L * 0.17
    cab.add(box((cx, 0, DECK + 0.33), (0.62, 0.66, 0.62), bevel=0.04), 'cabin')
    cab.add(prism((cx, 0, DECK + 0.66), 0.66, 0.78, 0.2, overhang=0.06, ridge='y'), 'roof')
    for sy in (-1, 1):
        cab.add(box((cx, sy * 0.335, DECK + 0.42), (0.34, 0.03, 0.2), bevel=0.01), 'window', outline=False)
    cab.add(box((cx + 0.315, 0, DECK + 0.44), (0.03, 0.42, 0.18), bevel=0.01), 'window', outline=False)
    cab.add(ellipsoid((cx, 0, DECK + 0.86), (0.05, 0.05, 0.05), seg=10, rings=6), 'glow', outline=False)
    # 돛대 · 깃발 (조타실 뒤)
    mast = M.part('mast')
    top = 1.45 * P.get('mastHeight', 1)
    mast.add(cylinder((cx - 0.38, 0, DECK), (cx - 0.38, 0, top), 0.03, 0.024, seg=10), 'hullDark')
    mast.add(box((cx - 0.38, -0.12, top - 0.1), (0.02, 0.22, 0.13), bevel=0.005), 'flag')
    mast.add(tube([V((cx - 0.38, 0, top - 0.05)), V((L * 0.42, 0, DECK + 0.2))], [0.01, 0.01], seg=5), 'rope')
    # 뒤 갑판: 낚싯대 꽂이 · 아이스박스
    aft = M.part('aft')
    aft.add(box((-L * 0.3, W * 0.22, DECK + 0.12), (0.3, 0.24, 0.22), bevel=0.03), 'cooler')
    aft.add(box((-L * 0.3, W * 0.22, DECK + 0.24), (0.32, 0.26, 0.04), bevel=0.015), 'trim')
    for sy in (-1, 1):
        b = V((-L * 0.42, sy * W * 0.34, DECK + 0.08))
        aft.add(cylinder(b, b + V((0, 0, 0.18)), 0.025, seg=8), 'trim')
        aft.add(cylinder(b + V((0, 0, 0.18)), b + V((-0.25, sy * 0.15, 0.85)), 0.01, 0.006, seg=6), 'hullDark')


def builders(g):
    """build_env.py 의 globals 를 받아 도우미를 이 모듈에 묶고, 새 빌더 표를 돌려준다."""
    globals().update({k: g[k] for k in HELPERS if k in g})
    return {'fish-dock': b_fish_dock, 'fish-boat': b_fish_boat}

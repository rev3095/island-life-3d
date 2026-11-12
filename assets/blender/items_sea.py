"""M16 잠수 바다 생물 빌더 (IC-SE-01–20, M18-P1 계절 생물 IC-SE-21–38) + 스쿠버 키트 (IC-TL-06).

build_item.py 가 RENDER 정의 바로 뒤에서 이 파일을 exec 한다 → 같은 전역(V · ellipsoid · cone · rail · slab · oval2d ·
spline2d · dot_on · eyes · pv · P · TAU …)을 그대로 쓴다. 여기서는 SEA_BUILDERS(kind → 함수)와 RENDER['sea'] 만 내놓고,
build_item.py 가 BUILDERS.update(SEA_BUILDERS) 로 합친다 (다른 트랙과 같은 파일을 덜 건드리려고 따로 둔 파일).

좌표·규칙은 build_item.py 와 같다: Z-up, 정면(머리) = -Y, 1.0 = 타일 1칸. 바다 생물은 모두 hold(잡아서 머리 위로 들어 보임) —
한 손에 드는 크기(물고기 0.2~0.45 근처)이고 원점은 build() 가 한가운데로 맞춘다. 재질 이름 = 스펙 팔레트 키.
게·새우처럼 닮은 것은 함수 하나를 params(다리 길이·집게 크기·말림 …)로 나눠 쓴다.
"""

# 바다 생물 아이콘: 위에서 비스듬히 (게 등딱지·불가사리 팔·해파리 갓 무늬가 보이게)
RENDER['sea'] = (-30, 40)

NACRE = ('nacre', 'nacreB', 'nacreC')   # 진주층 무지갯빛 띠 (전복·진주조개 안쪽)


# ================================================================ 도우미
def fib_dirs(n):
    """공 겉을 고르게 덮는 방향 n 개 (해바라기 씨 배치)"""
    ga = math.pi * (3 - math.sqrt(5))
    out = []
    for i in range(n):
        z = 1 - 2 * (i + 0.5) / n
        r = math.sqrt(max(0.0, 1 - z * z))
        out.append(V((math.cos(ga * i) * r, math.sin(ga * i) * r, z)))
    return out


def ell_surf(C, R, d):
    """타원체(C, R) 가운데에서 d 방향으로 나간 겉면 점과 법선"""
    d = V(d).normalized()
    s = 1 / math.sqrt((d.x / R[0]) ** 2 + (d.y / R[1]) ** 2 + (d.z / R[2]) ** 2)
    rel = d * s
    return V(C) + rel, V((rel.x / R[0] ** 2, rel.y / R[1] ** 2, rel.z / R[2] ** 2)).normalized()


def dot_lo(m, center, normal, r, mat, depth=0.4):
    """dot_on 의 가벼운 판 (점이 많은 불가사리·게 돌기용 — 삼각형 예산)"""
    m.add(ellipsoid(V(center), (r, r, r * depth), rot=align_z(normal), seg=8, rings=4), mat, outline=False)


def joint_rail(m, pts, r0, r1, mat, seg=8):
    """마디 다리: 점마다 끊어 이은 관 + 마디 공 (게·새우 다리, 집게 팔)"""
    n = len(pts) - 1
    for i in range(n):
        ra, rb = r0 + (r1 - r0) * i / n, r0 + (r1 - r0) * (i + 1) / n
        m.add(rail([pts[i], pts[i + 1]], [ra, rb], seg=seg), mat)
        if 0 < i:
            m.add(ellipsoid(pts[i], (ra * 1.08,) * 3, seg=seg, rings=max(4, seg - 2)), mat)


def pincer(m, wrist, pd, PL, sx, mat='claw', tip='clawTip', open_=0.35):
    """집게: 손바닥(타원체) + 아래 고정 손가락 + 위 움직이는 손가락. pd = 집게가 향하는 방향, sx = 몸 쪽 부호."""
    pd = V(pd).normalized()
    up = V((0, 0, 1))
    side = pd.cross(up).normalized() * sx
    PW, PH = PL * 0.36, PL * 0.28
    pc = wrist + pd * PL * 0.5
    m.add(ellipsoid(pc, (PW, PH, PL * 0.5), rot=align_z(pd), seg=14, rings=10), mat)
    for k, (dz, ang) in enumerate(((-0.35, -0.08), (0.4, open_))):
        base = pc + pd * PL * 0.42 + up * PH * dz
        dirn = (pd * math.cos(ang) + up * math.sin(ang) - side * 0.12).normalized()
        mid = base + dirn * PL * 0.38
        end = mid + (dirn - up * (0.25 if k else -0.25) - side * 0.15).normalized() * PL * 0.3
        r = PW * (0.5 if k == 0 else 0.44)
        m.add(cone(base, mid, r, r * 0.68, seg=10), mat)
        m.add(cone(mid, end, r * 0.68, 0.0, seg=10), tip)


# ================================================================ 해조·극피·멍게
def b_seaweed(M):
    """IC-SE-01 미역: 바위에 붙는 뿌리 덩이 + 짧은 줄기에서 물결치는 넓은 띠 잎이 몇 갈래 올라간다."""
    H = pv('height', 0.4)
    n = int(pv('blades', 5))
    m = M.part('seaweed')
    rnd = random.Random(int(P.get('seed', 3)))
    m.add(jitter(ellipsoid((0, 0, 0), (0.045, 0.04, 0.026), seg=10, rings=6), 0.006, 2), 'holdfast', smooth=False)
    for k in range(6):   # 뿌리 갈래
        a = TAU * k / 6 + 0.3
        d = V((math.cos(a), math.sin(a), 0))
        m.add(rail([d * 0.02, d * 0.055 + V((0, 0, -0.018)), d * 0.08 + V((0, 0, -0.03))], [0.01, 0.008, 0.005], seg=6), 'holdfast')
    top = V((0, 0, H * 0.12))
    m.add(rail([V((0, 0, 0.01)), V((0.006, 0, H * 0.06)), top], [0.014, 0.012, 0.011], seg=8), 'kelpDark')
    W = H * pv('width', 0.11)
    ruf = pv('ruffle', 0.6)
    for i in range(n):   # M17-P1: 넓은 잎 풀 → 길고 가장자리가 주름진 갈색 띠 (가운데 굵은 잎맥)
        a = TAU * i / n + rnd.uniform(-0.3, 0.3)
        d = V((math.cos(a), math.sin(a), 0))
        side = V((-d.y, d.x, 0))
        ln = H * (1.0 if i == 0 else rnd.uniform(0.62, 0.85))
        lean = rnd.uniform(0.18, 0.34) * (0.6 if i == 0 else 1.0)
        w = W * rnd.uniform(0.85, 1.1)
        N = 28
        pts, wid = [], []
        for j in range(N + 1):
            t = j / N
            wave = math.sin(t * math.pi * 2.4 + i * 1.7) * 0.07 * H * t
            p = top + d * (ln * (lean * t + 0.3 * t * t)) + V((0, 0, ln * (t - 0.2 * t * t))) + side * wave
            pts.append(p)
            wid.append(w * (0.25 + 0.75 * min(1.0, t / 0.12)) * (1 - 0.55 * max(0.0, (t - 0.75) / 0.25) ** 1.5))
        m.add(ruffle_strip(pts, wid, side, ruf * w * 0.6, 13 + i * 1.7, i * 1.1, thick=0.0035), 'kelp' if i % 2 == 0 else 'kelpLight', smooth=True)
        m.add(rail(pts[:-2], [max(wd * 0.11, 0.0035) for wd in wid[:-2]], seg=6, flat=0.6, side=side), 'kelpDark', outline=False)   # 가운데 잎맥


def ruffle_strip(pts, widths, side_hint, amp, freq, phase, thick=0.004, K=10):
    """가장자리가 물결치는 얇은 띠 (미역): 가운데 선 pts · 반폭 widths. 가운데는 평평하고 가장자리로 갈수록
    앞뒤로 출렁인다 (u² × sin). 앞뒤 두 장 + 옆 테두리 + 끝 마구리로 닫힌 메시."""
    bm = bmesh.new()
    N = len(pts) - 1
    top, bot = [], []
    for j, p in enumerate(pts):
        t = j / N
        T = (pts[min(j + 1, N)] - pts[max(j - 1, 0)]).normalized()
        S = (V(side_hint) - T * T.dot(V(side_hint))).normalized()
        Nn = T.cross(S).normalized()
        rt, rb = [], []
        for k in range(K + 1):
            u = -1 + 2 * k / K
            sgn = 1 if u >= 0 else -1
            off = amp * u * u * math.sin(freq * t * TAU / 3 + phase + sgn * 1.3) * min(1.0, t * 5)
            c = p + S * u * widths[j] + Nn * off
            rt.append(bm.verts.new(c + Nn * thick / 2))
            rb.append(bm.verts.new(c - Nn * thick / 2))
        top.append(rt)
        bot.append(rb)
    for j in range(N):
        for k in range(K):
            bm.faces.new([top[j][k], top[j][k + 1], top[j + 1][k + 1], top[j + 1][k]])
            bm.faces.new([bot[j][k], bot[j + 1][k], bot[j + 1][k + 1], bot[j][k + 1]])
        for k in (0, K):   # 옆 테두리
            a, b = (top, bot) if k == 0 else (bot, top)
            bm.faces.new([a[j][k], a[j + 1][k], b[j + 1][k], b[j][k]])
    for j in (0, N):   # 끝 마구리
        ring = top[j] + list(reversed(bot[j]))
        bm.faces.new(ring if j == N else list(reversed(ring)))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def b_urchin(M):
    """IC-SE-02 성게: 보라·검은 공에 사방으로 뻗은 가시"""
    R = pv('radius', 0.075)
    SL = pv('spine', 0.085)
    m = M.part('urchin')
    RZ = R * 0.8
    m.add(ellipsoid((0, 0, 0), (R, R, RZ), seg=20, rings=12), 'urchin')
    rnd = random.Random(8)
    for d in fib_dirs(int(pv('spines', 120))):
        if d.z < -0.88:
            continue   # 바닥 입 둘레는 비운다
        base, nrm = ell_surf((0, 0, 0), (R, R, RZ), d)
        ln = SL * rnd.uniform(0.75, 1.15) * (0.55 if d.z < -0.4 else 1.0)
        tip = base + (nrm + V((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1))) * 0.12).normalized() * ln
        m.add(cone(base - nrm * R * 0.08, tip, R * 0.075, 0.0, seg=5), 'spine' if rnd.random() < 0.82 else 'spineTip', smooth=False)
    m.add(ellipsoid((0, 0, -RZ * 0.97), (R * 0.25, R * 0.25, R * 0.07), seg=10, rings=4), 'mouth', outline=False)


def b_cucumber(M):
    """IC-SE-03 해삼: 길쭉하고 통통한 몸(배는 납작, 양 끝이 살짝 처짐) + 등 오돌토돌 돌기 + 입 둘레 작은 촉수 + 눈"""
    L = pv('length', 0.3)
    R = L * pv('girth', 0.19)
    m = M.part('cucumber')
    RZ = R * 0.85
    bend = R * 0.35

    def surf(t, a):   # t: -1 머리(-Y) … 1 꼬리, a: 0 오른쪽 · π/2 위
        k = math.sqrt(max(0.0, 1 - t * t))
        z = RZ * k * math.sin(a)
        if z < -RZ * 0.45:
            z = -RZ * 0.45 + (z + RZ * 0.45) * 0.3
        return V((R * k * math.cos(a), t * L / 2, z - bend * t * t)), V((math.cos(a), t * 0.4, math.sin(a))).normalized()
    body = ellipsoid((0, 0, 0), (R, L / 2, RZ), seg=24, rings=18)
    for v in body.verts:
        t = v.co.y / (L / 2)
        if v.co.z < -RZ * 0.45:
            v.co.z = -RZ * 0.45 + (v.co.z + RZ * 0.45) * 0.3   # 배 납작
        v.co.z -= bend * t * t
    m.add(body, lambda c, n: 'belly' if n.z < -0.55 else 'body')
    rnd = random.Random(int(P.get('seed', 4)))
    for row, a in enumerate((0.35, 0.95, 1.57, 2.19, 2.79)):   # 돌기 줄
        for j in range(6):
            t = -0.62 + 1.3 * (j + 0.5 * (row % 2)) / 6 + rnd.uniform(-0.04, 0.04)
            if abs(t) > 0.8:
                continue
            p, n = surf(t, a)
            h = R * rnd.uniform(0.28, 0.42) * (1.2 if row == 2 else 1.0)
            m.add(cone(p - n * R * 0.05, p + n * h, R * 0.17, R * 0.05, seg=7), 'bump')
    mouth, _ = surf(-0.98, math.pi / 2)
    mouth = V((0, -L / 2 + R * 0.06, mouth.z - RZ * 0.15))
    for k in range(8):   # 입 둘레 작은 꽃 같은 촉수
        a = TAU * k / 8
        d = V((math.cos(a) * 0.9, -0.5, math.sin(a) * 0.9)).normalized()
        m.add(rail([mouth, mouth + d * R * 0.35, mouth + d * R * 0.55 + V((0, -R * 0.1, 0))], [R * 0.08, R * 0.07, R * 0.05], seg=6), 'tentacle')
    ep, _ = surf(-0.72, 1.0)
    eyes(m, ep.x, ep.y, ep.z, R * 0.2)


def b_squirt(M):
    """IC-SE-04 멍게: 주황빨강 울퉁불퉁 덩이 + 혹 돌기 + 위에 입수공·출수공 둘 (끝에 + 자국)"""
    H = pv('height', 0.2)
    m = M.part('squirt')
    R = (H * 0.38, H * 0.35, H * 0.5)
    body = ellipsoid((0, 0, 0), R, seg=22, rings=14)
    for v in body.verts:
        n = v.co.normalized()
        v.co *= 1 + 0.08 * math.sin(n.x * 9 + 1) * math.sin(n.y * 8) * math.cos(n.z * 7)
    m.add(body, 'squirt')
    rnd = random.Random(5)
    for d in fib_dirs(34):   # 혹
        if d.z < -0.55 or d.z > 0.9:
            continue
        p, n = ell_surf((0, 0, 0), R, d)
        h = H * rnd.uniform(0.035, 0.07)
        m.add(cone(p - n * H * 0.02, p + n * h, H * rnd.uniform(0.03, 0.045), H * 0.012, seg=7), 'squirtLight' if rnd.random() < 0.45 else 'squirt')
    for d, ln in ((V((0.0, -0.25, 1.0)), 0.14), (V((0.75, 0.35, 0.7)), 0.11)):   # 입수공(위) · 출수공(옆)
        p, n = ell_surf((0, 0, 0), R, d)
        d2 = (n + V((0, 0, 0.6))).normalized()
        end = p + d2 * H * ln
        m.add(cylinder(p - d2 * H * 0.03, end, H * 0.085, H * 0.07, seg=14), 'squirt')
        Rm = align_z(d2)
        for sz in ((H * 0.1, H * 0.02, H * 0.012), (H * 0.02, H * 0.1, H * 0.012)):   # + 자국
            m.add(box(end + d2 * H * 0.002, sz, bevel=H * 0.004, rot=Rm), 'squirtDark', outline=False)
    m.add(jitter(ellipsoid((0, 0, -R[2] * 0.92), (H * 0.2, H * 0.18, H * 0.07), seg=10, rings=6), H * 0.01, 3), 'squirtDark', smooth=False)


def b_starfish(M):
    """IC-SE-07 불가사리: 둥근 가운데 + 끝이 살짝 들린 통통한 팔 다섯 + 점 무늬 + 귀여운 눈"""
    R = pv('radius', 0.15)
    m = M.part('star')
    m.add(ellipsoid((0, 0, 0), (R * 0.32, R * 0.32, R * 0.17), seg=20, rings=10), 'star')
    N = 8
    for k in range(5):
        a = -math.pi / 2 + TAU * k / 5
        d = V((math.cos(a), math.sin(a), 0))
        side = V((-d.y, d.x, 0))
        ts = [i / N for i in range(N + 1)]
        pts = [d * (R * 0.08 + R * 0.92 * t) + V((0, 0, R * 0.16 * t * t)) for t in ts]
        radii = [R * 0.24 * (1 - 0.78 * t) + R * 0.02 for t in ts]
        m.add(rail(pts, radii, seg=12, flat=0.55, side=side), 'star')
        for t in (0.28, 0.46, 0.64, 0.82):   # 점: 가운데 줄 + 양옆 줄
            i = t * N
            j = min(int(i), N - 1)
            p = pts[j].lerp(pts[j + 1], i - j)
            r = radii[j] + (radii[j + 1] - radii[j]) * (i - j)
            up = V((0, 0, 1))
            dot_lo(m, p + up * r * 0.55, up, r * 0.24, 'starDot', depth=0.5)
            for s in (1, -1):
                q = p + side * s * r * 0.6 + up * r * 0.38
                dot_lo(m, q, (side * s * 0.6 + up).normalized(), r * 0.17, 'starDot', depth=0.5)
    eyes(m, R * 0.1, -R * 0.08, R * 0.15, R * 0.055)


# ================================================================ 조개 (전복·굴·진주조개·홍합)
def dish(RX, RY, RZ, inner=0.65, seg=30, rings=12, shape=None):
    """속이 오목한 조개 한 장: 바깥은 아래로 볼록, 안쪽(+Z 를 보는 면)은 inner 깊이로 파인다. shape(v) 로 테두리 모양을 바꾼다."""
    bm = ellipsoid((0, 0, 0), (RX, RY, RZ), seg=seg, rings=rings)
    for v in bm.verts:
        if shape:
            shape(v)
        if v.co.z > 0:
            v.co.z = -v.co.z * inner
    return bm


def b_abalone(M):
    """IC-SE-05 전복: 납작한 귀 모양 껍데기를 안쪽이 보이게 놓음 — 무지갯빛 진주층 + 가장자리 구멍 한 줄 + 바깥 테"""
    L = pv('length', 0.24)
    m = M.part('abalone')
    RX, RY, RZ = L * 0.36, L * 0.5, L * 0.13

    def ear(v):   # 귀 모양: 뒤(+Y)가 좁고 한쪽(+X)으로 휜다
        u = max(0.0, v.co.y / RY)
        v.co.x = v.co.x * (1 - 0.24 * u) + RX * 0.2 * u * u

    def warp_x(x, y):
        u = max(0.0, y / RY)
        return x * (1 - 0.24 * u) + RX * 0.2 * u * u
    centre = V((RX * 0.08, RY * 0.2, 0))
    m.add(dish(RX, RY, RZ, 0.7, seg=34, rings=14, shape=ear),
          lambda c, n: NACRE[int((c - centre).length / (L * 0.035)) % 3] if n.z > 0.35 else 'shell')
    rim = [V((warp_x(RX * math.cos(a), RY * math.sin(a)), RY * math.sin(a), 0.0)) for a in (TAU * k / 40 for k in range(40))]
    m.add(tube(rim, [L * 0.014] * 40, seg=6, closed=True), 'shell')
    for i in range(8):   # 가장자리 구멍 한 줄 (꼭지 쪽 셋은 막혀 작다)
        u = -0.62 + i * 0.16
        x0 = -0.76 * RX * math.sqrt(1 - u * u)
        z0 = RZ * math.sqrt(max(0.0, 1 - (x0 / RX) ** 2 - u * u))
        p = V((warp_x(x0, u * RY), u * RY, -z0 * 0.7 + 0.002))
        r = L * (0.022 if i < 5 else 0.013)
        dot_on(m, p, V((0.35, 0, 1)).normalized(), r * 1.35, 'shell', depth=0.5)
        dot_on(m, p + V((0, 0, 0.002)), V((0.35, 0, 1)).normalized(), r, 'hole', depth=0.4)
    sp = V((warp_x(RX * 0.35, RY * 0.72), RY * 0.72, -RZ * 0.3))   # 꼭지 쪽 소용돌이
    curl = [sp + V((math.cos(a) * L * 0.035 * (1 - a / 9), math.sin(a) * L * 0.035 * (1 - a / 9), 0.003)) for a in (k * 0.5 for k in range(16))]
    m.add(rail(curl, [L * 0.008] * 16, seg=5), 'nacreB', outline=False)
    m.add(ellipsoid((-RX * 0.1, -RY * 0.18, -RZ * 0.62), (L * 0.05, L * 0.11, L * 0.006), rot=rot_xyz(z=0.25), seg=12, rings=4), 'shine', outline=False)


def b_oyster(M):
    """IC-SE-06 굴: 두툼한 아래 껍데기 위에 울퉁불퉁 겹겹이 쌓인 회색 판 (경첩 쪽이 좁은 물방울꼴)"""
    L = pv('length', 0.24)
    m = M.part('oyster')
    RX, RY = L * 0.34, L * 0.5

    def plate(sc, z0, h, dy, seed, mat):
        bm = ellipsoid((0, dy, z0), (RX * sc, RY * sc, h), seg=24, rings=8)
        for v in bm.verts:
            u = (v.co.y - dy) / (RY * sc)
            v.co.x *= 1 - 0.38 * max(0.0, u)
            a = math.atan2(v.co.y - dy, v.co.x)
            r = 1 + 0.07 * math.sin(a * 7 + seed) + 0.04 * math.sin(a * 13 + seed * 2)
            v.co.x *= r
            v.co.y = dy + (v.co.y - dy) * r
        m.add(jitter(bm, L * 0.006, seed), mat, smooth=False)
    plate(1.0, 0.0, L * 0.1, 0.0, 1, 'shellDark')
    for i, (sc, z) in enumerate(((0.96, L * 0.055), (0.8, L * 0.085), (0.62, L * 0.105), (0.42, L * 0.12))):
        plate(sc, z, L * 0.034, RY * (1 - sc) * 0.6, i + 3, 'shell' if i % 2 == 0 else 'shellLayer')


def b_pearl_oyster(M):
    """IC-SE-19 진주조개: 살짝 벌어진 짙은 두 장 껍데기(경첩 뒤 +Y) + 안쪽 무지갯빛 진주층 + 하얀 진주 하나"""
    L = pv('length', 0.24)
    opened = math.radians(pv('open', 34))
    m = M.part('pearl')
    RX, RY, RZ = L * 0.5, L * 0.45, L * 0.075
    hinge = V((0, RY * 0.78, 0))

    def wing(v):   # 경첩 쪽을 곧게 (진주조개는 경첩이 일자)
        if v.co.y > RY * 0.78:
            v.co.y = RY * 0.78 + (v.co.y - RY * 0.78) * 0.3
    lo = dish(RX, RY, RZ, 0.6, shape=wing)

    def mat_for(inner, centre):
        def f(c, n):
            if n.dot(inner) > 0.3:
                return NACRE[int((c - centre).length / (L * 0.04)) % 3]
            return 'shellLine' if int((c - hinge).length / (L * 0.05)) % 2 else 'shell'
        return f
    m.add(lo, mat_for(V((0, 0, 1)), V((0, 0, 0))))
    up = dish(RX * 0.98, RY * 0.98, RZ, 0.6, shape=wing)
    for v in up.verts:
        v.co.z = -v.co.z
    Rm = Matrix.Rotation(-opened, 3, 'X')
    bmesh.ops.rotate(up, cent=hinge, matrix=Rm, verts=up.verts)
    m.add(up, mat_for(Rm @ V((0, 0, -1)), hinge + Rm @ (V((0, 0, 0)) - hinge)))
    m.add(box(hinge + V((0, 0.004, 0.004)), (RX * 1.3, L * 0.035, L * 0.03), bevel=L * 0.01), 'shell')   # 경첩 날개
    pr = L * pv('pearl', 0.1)
    pc = V((0, -RY * 0.12, -RZ * 0.6 + pr * 0.9))
    m.add(ellipsoid(pc, (pr,) * 3, seg=18, rings=12), 'pearl')
    m.add(ellipsoid(pc + V((-pr * 0.35, -pr * 0.4, pr * 0.45)), (pr * 0.28,) * 3, seg=8, rings=6), 'pearlShine', outline=False)


def b_mussel(M):
    """IC-SE-20 홍합: 길쭉한 물방울꼴(앞 -Y 가 뾰족한 꼭지) 검푸른 두 장 껍데기 + 이음매 테 + 결 줄 + 수염"""
    L = pv('length', 0.2)
    m = M.part('mussel')
    W, H = L * 0.27, L * 0.17
    umbo = V((-W * 0.25, -L / 2, 0))
    body = ellipsoid((0, 0, 0), (W, L / 2, H), seg=28, rings=16)
    for v in body.verts:
        t = v.co.y / (L / 2)
        k = 0.3 + 0.7 * ((t + 1) / 2) ** 0.6
        v.co.x *= k
        v.co.z *= k
        v.co.x += -W * 0.3 * (1 - t) ** 2 / 4 + W * 0.15 * t   # 바나나처럼 살짝 휨

    def mat(c, n):
        if abs(c.z) < H * 0.1:
            return 'shellEdge'
        return 'shellRib' if int((c - umbo).length / (L * 0.07)) % 2 else 'shell'
    m.add(body, mat)
    m.add(ellipsoid((W * 0.05, L * 0.08, H * 0.82), (W * 0.12, L * 0.18, H * 0.06), rot=rot_xyz(z=-0.2), seg=10, rings=4), 'shine', outline=False)
    for k in range(4):   # 족사 (수염)
        a = V((W * 0.55 + k * 0.004, -L * 0.08 + k * L * 0.05, 0))
        m.add(rail([a, a + V((W * 0.5, -L * 0.02, -H * 0.2)), a + V((W * 0.85, L * 0.03 * (k - 1.5), -H * 0.55))], [0.0018, 0.0015, 0.0012], seg=4), 'byssus')


# ================================================================ 게 (꽃게 · 대게 · 키다리게)
def b_crab(M):
    """IC-SE-08 꽃게 · 15 대게 · 16 키다리게: 등딱지 + 집게 둘 + 걷는 다리 넷 쌍 + 자루 눈. params 로 모양을 나눈다:
    width 등딱지 너비 · bodyLength 길이 비 · spike 옆 가시(꽃게) · pear 앞이 좁은 배 모양(대게·키다리게) ·
    legLength · legThick · claw 집게 크기 · clawArm 집게 팔 길이 · paddle 뒷다리 노(꽃게) · bumps 등 돌기"""
    W = pv('width', 0.24)
    Lc = W * pv('bodyLength', 0.6)
    Hc = W * pv('bodyHeight', 0.24)
    spike, pear = pv('spike', 0.0), pv('pear', 0.0)
    legL, legR = pv('legLength', 0.16), pv('legThick', 0.012)
    claw, armL = pv('claw', 1.0), pv('clawArm', 0.12)
    paddle = bool(pv('paddle', 0))
    m = M.part('crab')
    body = ellipsoid((0, 0, 0), (W / 2, Lc / 2, Hc), seg=30, rings=14)
    for v in body.verts:
        if v.co.z < 0:
            v.co.z *= 0.45
        tx = abs(v.co.x) / (W / 2)
        if spike:
            v.co.y *= 1 - 0.35 * spike * tx * tx   # 옆 끝이 얇은 넓적 마름모
        if pear and v.co.y < 0:
            v.co.x *= 1 - pear * (-v.co.y / (Lc / 2)) ** 1.5   # 앞(-Y)이 좁다
    m.add(body, lambda c, n: 'belly' if n.z < -0.3 else 'carapace')

    def half_w(y):
        t = max(-1.0, min(1.0, y / (Lc / 2)))
        w = W / 2 * math.sqrt(max(0.0, 1 - t * t))
        return w * (1 - pear * (-t) ** 1.5) if (pear and t < 0) else w
    rnd = random.Random(int(P.get('seed', 6)))
    if spike:   # 앞옆 가장자리 톱니 + 옆 큰 가시
        for sx in (1, -1):
            for j, phi in enumerate((-62, -48, -34, -20, -4)):
                a = math.radians(phi)
                x = W / 2 * math.cos(a)
                y = Lc / 2 * math.sin(a) * (1 - 0.35 * spike * math.cos(a) ** 2)
                p = V((sx * x, y, Hc * 0.05))
                out = V((sx * math.cos(a) * Lc, math.sin(a) * W * 0.5, 0)).normalized()
                ln = W * (0.15 * spike if j == 4 else 0.045)
                m.add(cone(p - out * W * 0.02, p + out * ln, W * (0.03 if j == 4 else 0.02), 0.0, seg=6), 'carapace')
    if pear:   # 앞 뿔 둘 (대게는 짧게, 키다리게는 길게)
        for sx in (1, -1):
            b0 = V((sx * W * 0.04, -Lc / 2 * 0.92, Hc * 0.3))
            m.add(cone(b0, b0 + V((sx * W * 0.06, -Lc * 0.22 * pear, Hc * 0.15)), W * 0.035, 0.0, seg=6), 'carapace')
    for _ in range(int(pv('bumps', 0))):   # 등 돌기
        x, y = rnd.uniform(-0.6, 0.6), rnd.uniform(-0.5, 0.75)
        if x * x + y * y > 0.62:
            continue
        p, n = ell_surf((0, 0, 0), (half_w(y * Lc / 2) or W * 0.1, Lc / 2, Hc), V((x * 0.9, y, 0.6)))
        dot_lo(m, p, n, W * rnd.uniform(0.03, 0.05), 'spot', depth=0.7)
    if not pv('bumps', 0):   # 등 무늬 점 (꽃게)
        for x, y in ((0.18, -0.15), (-0.18, -0.15), (0.0, 0.1), (0.3, 0.15), (-0.3, 0.15)):
            p, n = ell_surf((0, 0, 0), (half_w(y * Lc / 2), Lc / 2, Hc), V((x, y, 0.75)))
            dot_on(m, p, n, W * 0.04, 'spot', depth=0.4)
    # 자루 눈 (앞)
    for sx in (1, -1):
        b0 = V((sx * W * 0.1, -Lc / 2 * 0.82, Hc * 0.3))
        top = b0 + V((sx * W * 0.03, -Lc * 0.05, W * 0.09))
        m.add(cylinder(b0, top, W * 0.022, W * 0.018, seg=8), 'carapace')
    eyes(m, W * 0.13, -Lc / 2 * 0.82 - Lc * 0.05, Hc * 0.3 + W * 0.1, W * 0.04)
    # 걷는 다리 넷 쌍
    for i in range(4):
        y = Lc / 2 * (-0.2 + 0.3 * i)
        yaw = math.radians(-12 + 26 * i)
        last = i == 3
        for sx in (1, -1):
            root = V((sx * half_w(y) * 0.85, y, -Hc * 0.1))
            out = V((sx * math.cos(yaw), math.sin(yaw), 0))
            ln = legL * (0.85 if last and paddle else 1.0) * (1.0 - 0.06 * abs(i - 1.5))
            lift = ln * pv('kneeLift', 0.35)
            knee = root + out * ln * 0.4 + V((0, 0, lift))
            ankle = root + out * ln * 0.78 + V((0, 0, lift * 0.35))
            tip = root + out * ln + V((0, 0, -Hc * 1.1 - ln * 0.1))
            if last and paddle:   # 노 같은 뒷다리: 끝 마디가 납작한 타원 판
                tip = root + out * ln * 1.02 + V((0, 0, lift * 0.1))
                joint_rail(m, [root, knee, ankle], legR, legR * 0.8, 'leg')
                pd = (tip - ankle).normalized()
                m.add(slab(oval2d(ln * 0.2, ln * 0.09, 14, cx=ln * 0.17), origin=ankle, u=pd, v=pd.cross(V((0, 0, 1))).normalized(), thick=legR * 0.6), 'leg', smooth=False)
            else:
                joint_rail(m, [root, knee, ankle, tip], legR, legR * 0.35, 'leg', seg=8 if legR >= 0.01 else 6)
    # 집게 둘
    for sx in (1, -1):
        root = V((sx * half_w(-Lc * 0.3) * 0.8, -Lc * 0.3, -Hc * 0.05))
        elbow = root + V((sx * armL * 0.55, -armL * 0.25, Hc * 0.35))
        wrist = elbow + V((-sx * armL * 0.08, -armL * 0.6, Hc * 0.1))
        joint_rail(m, [root, elbow, wrist], legR * 1.35, legR * 1.15, 'claw')
        pincer(m, wrist, (wrist - elbow).normalized() + V((-sx * 0.2, 0, 0)), W * 0.3 * claw, sx)


# ================================================================ 새우 (단새우 · 바닷가재) · 갯가재
def body_path(L, curl, steps=48):
    """머리(-Y)에서 꼬리로 가는 몸 중심선. 뒤로 갈수록 아래로 말린다 (curl 0 곧음 … 1 둥글게)."""
    p = V((0, -L / 2, 0))
    pts = [p.copy()]
    for i in range(steps):
        t = (i + 0.5) / steps
        phi = curl * math.pi * max(0.0, (t - 0.3) / 0.7) ** 1.1
        p = p + V((0, math.cos(phi), -math.sin(phi))) * (L / steps)
        pts.append(p.copy())
    return pts


def along(pts, t):
    f = max(0.0, min(1.0, t)) * (len(pts) - 1)
    i = min(int(f), len(pts) - 2)
    d = (pts[i + 1] - pts[i]).normalized()
    return pts[i].lerp(pts[i + 1], f - i), d, V((1, 0, 0)).cross(d)   # 점 · 앞뒤 방향 · 등 쪽


def b_shrimp(M):
    """IC-SE-09 단새우 · 10 바닷가재: 머리가슴 + 배 마디 여섯 + 꼬리부채 + 이마뿔 + 더듬이 + 다리. claw > 0 이면 큰 집게 둘."""
    L = pv('length', 0.22)
    curl = pv('curl', 0.7)
    R0 = L * pv('girth', 0.11)
    claw = pv('claw', 0.0)
    antL = pv('antenna', 1.0)
    tc = pv('head', 0.36)       # 머리가슴 길이 비
    m = M.part('shrimp')
    pts = body_path(L, curl)
    c, d, up = along(pts, tc * 0.5)
    m.add(ellipsoid(c + up * R0 * 0.08, (R0 * 0.85, R0 * 1.0, L * tc * 0.55), rot=align_z(d), seg=20, rings=12), 'body')
    for k in range(6):
        t0 = tc + k * (0.9 - tc) / 6
        c, d, up = along(pts, t0 + (0.9 - tc) / 12)
        m.add(ellipsoid(c, (R0 * (0.82 - 0.07 * k), R0 * (0.95 - 0.08 * k), L * (0.9 - tc) / 6 * 0.62), rot=align_z(d), seg=16, rings=10), 'body' if k % 2 == 0 else 'band')
        if k < 5:   # 헤엄다리
            for sx in (1, -1):
                r0 = c - up * R0 * 0.6 + V((sx * R0 * 0.3, 0, 0))
                m.add(rail([r0, r0 - up * R0 * 0.45 + d * L * 0.03], [L * 0.012, L * 0.007], seg=5), 'leg')
    c, d, up = along(pts, 0.9)   # 꼬리부채 (옆으로 펼친 판)
    fan = spline2d([(-0.01, 0.035), (0.07, 0.11), (0.14, 0.095), (0.155, 0.0), (0.14, -0.095), (0.07, -0.11), (-0.01, -0.035)])
    m.add(slab([(x * L * pv('fan', 1.0), y * L * pv('fan', 1.0)) for x, y in fan], origin=c, u=d, v=(1, 0, 0), thick=L * 0.025), 'fan', smooth=False)
    m.add(ellipsoid(c + d * L * 0.07 + up * L * 0.01, (L * 0.022, L * 0.012, L * 0.07), rot=align_z(d), seg=10, rings=6), 'band')
    h, d0, up0 = along(pts, 0.02)   # 머리 앞
    base = h + up0 * R0 * 0.55 + d0 * L * 0.02
    m.add(cone(base, base - d0 * L * pv('rostrum', 0.14) + up0 * R0 * 0.35, R0 * 0.2, 0.0, seg=8), 'body')
    for sx in (1, -1):   # 더듬이 (길게 뒤로 휘어 넘어감) + 짧은 더듬이
        s = h + V((sx * R0 * 0.3, 0, 0)) + up0 * R0 * 0.1
        ap = bezier(s, s - d0 * L * 0.12 + up0 * L * 0.05 + V((sx * L * 0.05, 0, 0)), s + up0 * L * 0.2 + d0 * L * 0.2 * antL + V((sx * L * 0.16, 0, 0)),
                    s + d0 * L * 0.62 * antL + up0 * L * 0.1 + V((sx * L * 0.22, 0, 0)), 14)
        m.add(rail(ap, [max(L * 0.008 * (1 - 0.7 * i / 14), 0.0014) for i in range(15)], seg=5), 'antenna')
        m.add(rail([s, s - d0 * L * 0.12 + V((sx * L * 0.03, 0, L * 0.02)), s - d0 * L * 0.2 + V((sx * L * 0.06, 0, L * 0.05))], [L * 0.009, L * 0.007, L * 0.004], seg=5), 'antenna')
    for j in range(5):   # 걷는 다리
        c, d, up = along(pts, 0.06 + j * 0.055)
        for sx in (1, -1):
            r0 = c - up * R0 * 0.55 + V((sx * R0 * 0.45, 0, 0))
            mid = r0 + V((sx * R0 * 0.55, 0, 0)) - up * R0 * 0.45 - d * L * 0.015
            m.add(rail([r0, mid, mid + V((sx * R0 * 0.15, 0, 0)) - up * R0 * 0.6 + d * L * 0.03], [L * 0.011, L * 0.009, L * 0.005], seg=5), 'leg')
    e, _, _ = along(pts, 0.03)
    eyes(m, R0 * 0.55, e.y - L * 0.01, e.z + R0 * 0.38, R0 * 0.3)
    if claw:   # 바닷가재 큰 집게
        c, d, up = along(pts, 0.1)
        for sx in (1, -1):
            root = c + V((sx * R0 * 0.6, 0, 0)) - up * R0 * 0.4
            k = max(1.0, claw)   # M17-P1: 집게가 클수록 팔을 굵게 · 양옆으로 벌려 두 집게가 겹치지 않게
            elbow = root + V((sx * L * 0.13 * k, -L * 0.07, R0 * 0.2))
            wrist = elbow + V((sx * L * 0.05 * (k - 1), -L * 0.15, R0 * 0.15))
            joint_rail(m, [root, elbow, wrist], R0 * 0.32 * (0.7 + 0.3 * k), R0 * 0.36 * (0.7 + 0.3 * k), 'claw')
            pincer(m, wrist, (wrist - elbow).normalized() + V((sx * 0.12 * (k - 1) - sx * 0.1, 0, 0)), L * 0.3 * claw, sx, open_=0.3)


def b_mantis_shrimp(M):
    """IC-SE-14 갯가재: 납작하고 긴 몸 마디(초록·짙은 초록) + 접힌 사마귀 같은 앞발 + 자루 눈 + 주황 다리·꼬리 판의 파란 점"""
    L = pv('length', 0.34)
    W = L * 0.11
    m = M.part('mantis')
    head = V((0, -L / 2 + L * 0.1, 0))
    m.add(ellipsoid(head, (W * 0.85, L * 0.09, W * 0.55), seg=16, rings=10), 'body')
    nseg = 8
    step = L * 0.075
    for k in range(nseg):
        y = -L / 2 + L * 0.21 + k * step
        z = W * 0.18 * math.sin(math.pi * k / nseg)
        w = W * (0.92 + 0.18 * math.sin(math.pi * (k + 1) / (nseg + 1)))
        m.add(ellipsoid((0, y, z), (w, step * 0.62, W * 0.48), seg=16, rings=8), 'body' if k % 2 == 0 else 'bodyDark')
        for sx in (1, -1):   # 옆 테 점
            dot_on(m, (sx * w * 0.92, y, z + W * 0.12), V((sx, 0, 0.6)).normalized(), W * 0.16, 'limb', depth=0.5)
        if k < 3:   # 걷는 다리
            for sx in (1, -1):
                r0 = V((sx * w * 0.6, y, z - W * 0.35))
                m.add(rail([r0, r0 + V((sx * W * 0.6, 0, -W * 0.3)), r0 + V((sx * W * 0.8, step * 0.3, -W * 0.8))], [W * 0.1, W * 0.08, W * 0.05], seg=5), 'limb')
    ty = -L / 2 + L * 0.21 + nseg * step - step * 0.3
    m.add(slab(spline2d([(-W * 0.6, 0), (-W * 0.55, step * 1.1), (0, step * 1.5), (W * 0.55, step * 1.1), (W * 0.6, 0)]), origin=(0, ty, W * 0.08),
               u=(1, 0, 0), v=(0, 1, 0), thick=W * 0.22), 'bodyDark', smooth=False)
    for sx in (1, -1):   # 꼬리 옆 판 (주황 + 파란 눈알 무늬)
        o = V((sx * W * 0.55, ty + step * 0.2, W * 0.08))
        u = V((sx * 0.6, 1, 0)).normalized()
        m.add(slab(oval2d(step * 0.95, W * 0.32, 14, cx=step * 0.8, squeeze=0.4), origin=o, u=u, v=V((0, 0, 1)).cross(u), thick=W * 0.12), 'limb', smooth=False)
        dot_on(m, o + u * step * 1.0 + V((0, 0, W * 0.07)), (0, 0, 1), W * 0.18, 'accent', depth=0.4)
    # 자루 눈 + 더듬이 비늘판 + 더듬이
    for sx in (1, -1):
        b0 = head + V((sx * W * 0.22, -L * 0.07, W * 0.3))
        top = b0 + V((sx * W * 0.28, -L * 0.04, W * 0.65))
        m.add(cylinder(b0, top, W * 0.14, W * 0.11, seg=8), 'limb')
        o = head + V((sx * W * 0.5, -L * 0.08, 0))
        u = V((sx * 0.8, -1, 0.1)).normalized()
        m.add(slab(oval2d(L * 0.05, W * 0.28, 12, cx=L * 0.045), origin=o, u=u, v=V((0, 0, 1)).cross(u), thick=W * 0.1), 'limb', smooth=False)
        a = head + V((sx * W * 0.15, -L * 0.09, W * 0.1))
        m.add(rail(bezier(a, a + V((sx * W * 0.2, -L * 0.1, W * 0.3)), a + V((sx * W * 0.6, -L * 0.2, W * 0.5)), a + V((sx * W * 1.2, -L * 0.25, W * 0.3)), 8),
                   [max(W * 0.07 * (1 - i / 10), 0.0015) for i in range(9)], seg=5), 'limb')
    eyes(m, W * 0.5, head.y - L * 0.11, head.z + W * 0.98, W * 0.26)
    # 접힌 사마귀 앞발: 아래팔이 앞으로 → 끝 마디(낫)가 뒤로 접혀 붙는다
    for sx in (1, -1):
        r0 = head + V((sx * W * 0.45, L * 0.02, -W * 0.35))
        elbow = r0 + V((sx * W * 0.5, -L * 0.12, -W * 0.25))
        m.add(rail([r0, elbow], [W * 0.22, W * 0.24], seg=8), 'limb')
        m.add(ellipsoid(elbow, (W * 0.25,) * 3, seg=10, rings=8), 'limb')
        fold = elbow + V((sx * W * 0.08, L * 0.15, W * 0.12))
        m.add(rail([elbow, fold], [W * 0.2, W * 0.12], seg=8, flat=0.7, side=(0, 0, 1)), 'limbTip')
        m.add(cone(fold, fold + V((0, L * 0.03, -W * 0.25)), W * 0.1, 0.0, seg=6), 'limbTip')


# ================================================================ 해파리 · 말미잘 · 갯민숭달팽이
def b_jellyfish(M):
    """IC-SE-11 보름달물해파리: 반투명 느낌의 옅은 하늘색 갓(외곽선 없이 밝게) + 갓 위 분홍 고리 넷 + 가장자리 짧은 촉수 + 입팔 넷"""
    R = pv('radius', 0.14)
    Hb = R * pv('dome', 0.48)
    m = M.part('jelly')
    bell = ellipsoid((0, 0, 0), (R, R, Hb), seg=40, rings=16)
    for v in bell.verts:
        a = math.atan2(v.co.y, v.co.x)
        rr = math.hypot(v.co.x, v.co.y) / R
        k = 1 + 0.035 * math.cos(16 * a) * rr ** 4   # 가장자리 물결
        v.co.x *= k
        v.co.y *= k
        if v.co.z < 0:
            v.co.z = -v.co.z * 0.55   # 갓 아래는 오목하게
    m.add(bell, lambda c, n: 'bellRim' if math.hypot(c.x, c.y) > R * 0.82 else 'bell', outline=False)
    for k in range(4):   # 고리 무늬 넷 (네잎 모양)
        a0 = TAU * k / 4 + math.pi / 4
        cc = V((math.cos(a0), math.sin(a0), 0)) * R * 0.36
        ring = []
        for j in range(20):
            a = TAU * j / 20
            p = cc + V((math.cos(a), math.sin(a), 0)) * R * 0.17
            ring.append(V((p.x, p.y, Hb * math.sqrt(max(0.0, 1 - (p.length / R) ** 2)) + R * 0.012)))
        m.add(tube(ring, [R * 0.035] * 20, seg=6, closed=True), 'gonad', outline=False)
    for j in range(36):   # 가장자리 짧은 촉수
        a = TAU * j / 36
        b0 = V((math.cos(a) * R * 0.97, math.sin(a) * R * 0.97, -R * 0.005))
        out = V((math.cos(a), math.sin(a), 0))
        sw = 0.04 * math.sin(j * 1.7)
        m.add(rail([b0, b0 + out * R * (0.03 + sw) + V((0, 0, -R * 0.14)), b0 + out * R * 0.02 + V((0, 0, -R * 0.26))], [R * 0.012, R * 0.01, R * 0.006], seg=4), 'tentacle', outline=False)
    for k in range(4):   # 입팔 (가운데 아래 주름진 짧은 팔)
        a = TAU * k / 4
        out = V((math.cos(a), math.sin(a), 0))
        side = V((-out.y, out.x, 0))
        p0 = V((0, 0, Hb * 0.1))
        ap = [p0 + out * R * 0.08 * t + side * R * 0.05 * math.sin(t * 7) + V((0, 0, -R * 0.42 * t)) for t in (i / 8 for i in range(9))]
        m.add(rail(ap, [R * (0.07 - 0.04 * i / 8) for i in range(9)], seg=8, flat=0.45, side=side), 'oralArm', outline=False)


def b_anemone(M):
    """IC-SE-12 말미잘: 발판 + 기둥 몸 + 위 입판 둘레 촉수 왕관(두 겹, 끝이 둥글게)"""
    H = pv('height', 0.15)
    R = pv('radius', 0.065)
    nt = int(pv('tentacles', 20))
    m = M.part('anemone')
    m.add(ellipsoid((0, 0, 0.0), (R * 1.35, R * 1.35, R * 0.22), seg=22, rings=8), 'column')
    m.add(rail([V((0, 0, 0)), V((0, 0, H * 0.5)), V((0, 0, H))], [R * 1.1, R * 0.92, R * 1.15], seg=22), 'column')
    for k in range(10):   # 기둥 세로 줄
        a = TAU * k / 10
        pts = [V((math.cos(a) * r, math.sin(a) * r, z)) for r, z in ((R * 1.09, H * 0.08), (R * 0.93, H * 0.5), (R * 1.12, H * 0.92))]
        m.add(rail(pts, [R * 0.06] * 3, seg=5), 'columnDark', outline=False)
    m.add(ellipsoid((0, 0, H), (R * 1.18, R * 1.18, R * 0.22), seg=22, rings=8), 'disk')
    m.add(ellipsoid((0, 0, H + R * 0.2), (R * 0.22, R * 0.14, R * 0.05), seg=12, rings=4), 'mouth', outline=False)
    rnd = random.Random(9)
    for ring, (rr, cnt, ln) in enumerate(((R * 1.0, nt, 1.0), (R * 0.62, int(nt * 0.6), 0.75))):
        for j in range(cnt):
            a = TAU * (j + 0.5 * ring) / cnt
            out = V((math.cos(a), math.sin(a), 0))
            b0 = V((0, 0, H + R * 0.12)) + out * rr
            l = H * 0.7 * ln * rnd.uniform(0.85, 1.1)
            ap = bezier(b0, b0 + V((0, 0, l * 0.45)) + out * l * 0.1, b0 + V((0, 0, l * 0.7)) + out * l * 0.45, b0 + V((0, 0, l * 0.55)) + out * l * 0.75, 6)
            m.add(rail(ap, [R * (0.16 - 0.06 * i / 6) for i in range(7)], seg=6), 'tentacle')
            m.add(ellipsoid(ap[-1], (R * 0.13,) * 3, seg=8, rings=5), 'tentacleTip')


def b_sea_slug(M):
    """IC-SE-13 갯민숭달팽이: 보라 몸(외투막) + 노란 테·점 + 머리 더듬이 둘 + 등 뒤 아가미 다발 + 눈"""
    L = pv('length', 0.26)
    W = L * 0.22
    m = M.part('slug')
    RX, RY, RZ = W, L / 2, W * 0.55
    body = ellipsoid((0, 0, 0), (RX, RY, RZ), seg=30, rings=14)
    for v in body.verts:
        u = v.co.y / RY
        v.co.x *= 1 - 0.35 * max(0.0, u) ** 2   # 꼬리 쪽이 좁게
        if v.co.z < 0:
            v.co.z *= 0.45

    def mat(c, n):
        if n.z < -0.5:
            return 'foot'
        q = math.hypot(c.x / RX, c.y / RY)
        return 'rim' if q > 0.86 else 'slug'
    m.add(body, mat)
    m.add(ellipsoid((0, RY * 0.95, -RZ * 0.25), (W * 0.32, L * 0.12, RZ * 0.25), seg=12, rings=6), 'foot')   # 꼬리 끝
    rnd = random.Random(7)
    for _ in range(int(pv('spots', 12))):   # 등 노란 점
        x, y = rnd.uniform(-0.55, 0.55), rnd.uniform(-0.5, 0.6)
        if x * x + y * y > 0.45:
            continue
        p, n = ell_surf((0, 0, 0), (RX, RY, RZ), V((x * RX, y * RY, RZ * 0.7)))
        dot_on(m, p, n, W * rnd.uniform(0.07, 0.11), 'rim', depth=0.4)
    for sx in (1, -1):   # 더듬이 (주름진 막대)
        b0, n = ell_surf((0, 0, 0), (RX, RY, RZ), V((sx * 0.35, -0.75, 0.55)))
        top = b0 + V((sx * W * 0.12, -L * 0.04, W * 0.6))
        m.add(cylinder(b0 - V((0, 0, W * 0.05)), top, W * 0.11, W * 0.08, seg=10), 'rhino')
        for k in range(3):
            m.add(ellipsoid(b0.lerp(top, 0.45 + 0.2 * k), (W * 0.12, W * 0.12, W * 0.04), rot=align_z(top - b0), seg=10, rings=4), 'rhino')
        m.add(ellipsoid(top, (W * 0.09,) * 3, seg=8, rings=6), 'rhino')
    g0 = V((0, RY * 0.45, RZ * 0.75))   # 아가미 다발 (깃털처럼 퍼진 가지)
    for k in range(8):
        a = math.pi * (0.1 + 0.8 * k / 7)
        d = V((math.cos(a), 0.55, math.sin(a) * 0.9 + 0.5)).normalized()
        tip = g0 + d * W * 0.75
        m.add(rail([g0, g0 + d * W * 0.4 + V((0, 0, W * 0.08)), tip], [W * 0.07, W * 0.06, W * 0.035], seg=5), 'gill')
        for s in (0.45, 0.7):
            q = g0.lerp(tip, s)
            m.add(rail([q, q + (d + V((0, 0, 0.6))).normalized() * W * 0.18], [W * 0.035, W * 0.02], seg=4), 'gill')
    ep, _ = ell_surf((0, 0, 0), (RX, RY, RZ), V((0.32, -0.85, 0.45)))
    eyes(m, ep.x, ep.y, ep.z, W * 0.12)


# ================================================================ 투구게 · 앵무조개
def b_horseshoe_crab(M):
    """IC-SE-17 투구게: 둥근 투구 등판(앞 반달) + 가시 난 뒷판 + 긴 꼬리 가시. 올리브 갈색."""
    L = pv('length', 0.3)
    T = pv('tail', 0.22)
    W = L * 0.5
    m = M.part('horseshoe')
    pc = V((0, -L * 0.12, 0))
    PR = (W, L * 0.38, W * 0.34)
    pro = ellipsoid(pc, PR, seg=32, rings=14)
    for v in pro.verts:
        if v.co.z < 0:
            v.co.z *= 0.3
        if v.co.y > pc.y:
            v.co.y = pc.y + (v.co.y - pc.y) * 0.5   # 뒤를 편평하게 (뒷판과 이음)
    m.add(pro, lambda c, n: 'belly' if n.z < -0.4 else 'carapace')
    for sx in (0, 1, -1):   # 등줄 (가운데 하나 + 옆 둘)
        pts = []
        for i in range(9):
            t = -0.9 + 1.4 * i / 8
            x = sx * W * 0.42 * (1 - 0.15 * t)
            y = pc.y + t * PR[1] * (1 if t < 0 else 0.5)
            q = 1 - (x / PR[0]) ** 2 - ((y - pc.y) / PR[1] / (1 if t < 0 else 0.5)) ** 2
            pts.append(V((x, y, PR[2] * math.sqrt(max(0.0, q)) + W * 0.01)))
        m.add(rail(pts, [W * 0.03] * 9, seg=6), 'carapaceDark')
    oc = V((0, L * 0.2, -W * 0.01))   # 뒷판
    ob = ellipsoid(oc, (W * 0.62, L * 0.2, W * 0.2), seg=6, rings=8)
    for v in ob.verts:
        if v.co.z < oc.z:
            v.co.z = oc.z + (v.co.z - oc.z) * 0.35
        u = (v.co.y - oc.y) / (L * 0.2)
        v.co.x *= 1 - 0.35 * max(0.0, u)
    m.add(ob, lambda c, n: 'belly' if n.z < -0.4 else 'carapace', smooth=False)
    m.add(rail([oc + V((0, -L * 0.17, W * 0.2)), oc + V((0, L * 0.15, W * 0.13))], [W * 0.035, W * 0.03], seg=6), 'carapaceDark')
    for sx in (1, -1):   # 뒷판 옆 가시
        for i in range(5):
            y = oc.y - L * 0.12 + i * L * 0.06
            x = sx * W * 0.62 * (1 - 0.35 * max(0.0, (y - oc.y) / (L * 0.2))) * 0.95
            m.add(cone(V((x, y, oc.z)), V((x + sx * W * 0.12, y + L * 0.03, oc.z - W * 0.02)), W * 0.03, 0.0, seg=6), 'carapaceDark')
    t0 = V((0, oc.y + L * 0.18, oc.z))
    m.add(cone(t0, t0 + V((0, T, W * 0.06)), W * 0.06, 0.0, seg=8), 'tail')
    for sx in (1, -1):   # 겹눈 (귀엽게)
        p, n = ell_surf(pc, PR, V((sx * 0.5, -0.25, 0.6)))
        m.add(ellipsoid(p, (W * 0.08, W * 0.11, W * 0.05), rot=align_z(n), seg=12, rings=8), 'carapaceDark')
    eyes(m, W * 0.46, pc.y - L * 0.08, PR[2] * 0.82, W * 0.065)


def b_nautilus(M):
    """IC-SE-18 앵무조개: 둥글게 말린 껍데기(x=0 대칭, 입구 앞 -Y) + 갈색 불꽃 줄무늬 + 입구의 두건·짧은 촉수 + 눈"""
    S = pv('size', 0.24)
    m = M.part('nautilus')
    C = V((0, S * 0.08, 0))
    turns, k = 1.35, 0.3
    th_end = turns * TAU
    r_end = S * 0.36
    phi_end = math.pi * 0.95
    n = 60
    pts, radii = [], []
    for i in range(n + 1):
        th = th_end * i / n
        r = r_end * math.exp(-k * (th_end - th))
        phi = phi_end - (th_end - th)
        pts.append(C + V((0, math.cos(phi) * r, math.sin(phi) * r)))
        radii.append(r * 0.48 + S * 0.004)

    def mat(c, nn):
        rel = c - C
        ph = math.atan2(rel.z, rel.y)
        old = ((phi_end - ph) % TAU) > math.pi * 0.65   # 입구 가까운 쪽은 줄무늬 없이
        dist = math.hypot(rel.y, rel.z)
        return 'stripe' if old and math.sin(ph * 7 + dist * 40) > 0.25 else 'shell'
    m.add(rail(pts, radii, seg=18, flat=1.35, side=(1, 0, 0)), mat)
    for sx in (1, -1):   # 배꼽 (나선 가운데)
        m.add(ellipsoid(C + V((sx * S * 0.07, 0, 0)), (S * 0.012, S * 0.05, S * 0.05), seg=12, rings=6), 'shellDark', outline=False)
    a, d = pts[-1], (pts[-1] - pts[-2]).normalized()
    hood = a + d * S * 0.03 + V((0, -S * 0.02, S * 0.05))
    m.add(ellipsoid(hood, (radii[-1] * 0.85, S * 0.08, S * 0.07), seg=16, rings=10), 'hood')
    rnd = random.Random(10)
    for j in range(11):   # 짧은 촉수
        x = (j / 10 - 0.5) * radii[-1] * 1.3
        b0 = hood + V((x, -S * 0.03, -S * 0.04 - abs(x) * 0.3))
        ln = S * rnd.uniform(0.12, 0.17)
        dirn = V((x * 1.5, -1.0, -0.45 + rnd.uniform(-0.15, 0.15))).normalized()
        m.add(rail([b0, b0 + dirn * ln * 0.55 + V((0, 0, -ln * 0.1)), b0 + dirn * ln], [S * 0.012, S * 0.011, S * 0.008], seg=6), 'tentacle')
    eyes(m, radii[-1] * 0.78, hood.y + S * 0.03, hood.z + S * 0.01, S * 0.035)


# ================================================================ 스쿠버 키트 (도구, 바닥에 놓는 꾸러미)
def b_scuba(M):
    """IC-TL-06 스쿠버 키트: 눕힌 노란 공기통(밸브·호스) + 그 앞 오리발 한 켤레 + 기대 놓은 물안경 + 옆 숨대롱"""
    m = M.part('tool')
    TR = 0.075
    a, b = V((-0.17, 0.12, TR)), V((0.17, 0.12, TR))
    m.add(capsule(a, b, TR, seg=22, rings=10), 'tank')
    for x in (-0.1, 0.11):
        m.add(tube([V((x, 0.12 + math.cos(t) * (TR + 0.003), TR + math.sin(t) * (TR + 0.003))) for t in (TAU * k / 22 for k in range(22))], [0.008] * 22, seg=6, closed=True), 'tankBand')
    m.add(cylinder((0.24, 0.12, TR), (0.29, 0.12, TR), 0.024, seg=12), 'metal')
    m.add(cylinder((0.272, 0.12, TR), (0.272, 0.12, TR + 0.055), 0.012, seg=10), 'metalDark')
    m.add(cylinder((0.272, 0.12, TR + 0.05), (0.272, 0.12, TR + 0.065), 0.028, seg=14), 'metalDark')
    hose = bezier(V((0.29, 0.12, TR)), V((0.36, 0.1, TR)), V((0.36, -0.02, 0.03)), V((0.29, -0.06, 0.02)), 10)
    m.add(rail(hose, [0.011] * 11, seg=6), 'hose')
    m.add(ellipsoid((0.27, -0.08, 0.022), (0.028, 0.03, 0.02), seg=12, rings=8), 'hose')
    for sx in (1, -1):   # 오리발: 발 넣는 곳(뒤꿈치 쪽) + 넓적한 날개판 + 판 위 줄 둘
        o = V((sx * 0.095, 0.02, 0.008))
        u = V((sx * 0.14, -1, 0)).normalized()
        v = V((0, 0, 1)).cross(u).normalized()
        outline = spline2d([(0, -0.045), (0.1, -0.055), (0.3, -0.09), (0.345, -0.05), (0.335, 0.0), (0.345, 0.05), (0.3, 0.09), (0.1, 0.055), (0, 0.045)])
        m.add(slab(outline, origin=o, u=u, v=v, thick=0.012), 'fin', smooth=False)
        m.add(ellipsoid(o + u * 0.07 + V((0, 0, 0.018)), (0.05, 0.07, 0.024), rot=Matrix.Rotation(math.atan2(u.y, u.x) - math.pi / 2, 3, 'Z'), seg=14, rings=8), 'finDark')
        for s in (1, -1):
            m.add(rail([o + u * 0.13 + v * s * 0.04 + V((0, 0, 0.008)), o + u * 0.3 + v * s * 0.065 + V((0, 0, 0.008))], [0.006, 0.004], seg=5), 'finDark', outline=False)
    mc = V((-0.02, -0.02, 0.085))   # 물안경: 통에 기대 앞을 보게
    Rm = rot_xyz(x=-0.5)
    m.add(ellipsoid(mc, (0.105, 0.022, 0.055), rot=Rm, seg=18, rings=10), 'mask')
    for sx in (1, -1):
        m.add(ellipsoid(mc + Rm @ V((sx * 0.047, -0.016, 0.004)), (0.04, 0.008, 0.035), rot=Rm, seg=16, rings=8), 'lens')
    m.add(ellipsoid(mc + Rm @ V((0, -0.012, -0.035)), (0.022, 0.016, 0.022), rot=Rm, seg=10, rings=6), 'mask')   # 코 덮개
    strap = [mc + Rm @ V((math.cos(t) * 0.11, 0.02 + max(0.0, math.sin(t)) * 0.09, 0)) for t in (math.pi * k / 12 for k in range(13))]
    m.add(rail(strap, [0.007] * 13, seg=5, flat=0.5, side=Rm @ V((0, 0, 1))), 'strap')
    sn = [V((-0.3, -0.24, 0.035)), V((-0.31, -0.2, 0.02)), V((-0.29, -0.16, 0.02)), V((-0.26, -0.02, 0.07)), V((-0.23, 0.13, 0.17))]   # 숨대롱: J 자
    m.add(rail(bezier(sn[0], sn[1], sn[2], sn[2], 4)[:-1] + [sn[2], sn[3], sn[4]], [0.014] * 7, seg=10), 'snorkel')
    m.add(ellipsoid(sn[0] + V((0.0, -0.01, 0.0)), (0.024, 0.014, 0.018), seg=10, rings=6), 'hose')
    m.add(cylinder(sn[4], sn[4] + (sn[4] - sn[3]).normalized() * 0.02, 0.017, 0.017, seg=10), 'hose')


# ================================================================ M18-P1 계절 생물 (IC-SE-21–38) — 새 모양 둘
# 나머지 16종은 있는 빌더(fish · crab · shrimp · octopus · sea-slug · mussel · clam · scallop · turban)를 스펙 params·팔레트로 나눠 쓴다.
def b_anglerfish(M):
    """IC-SE-35 아귀: 몸 앞쪽 절반이 넓적한 큰 머리(위에서 눌린 타원), 아래턱이 앞으로 나온 큰 입과 이빨,
    머리 위 낚싯대 가시 끝에 미끼 혹, 몸 옆 가장자리 술 장식, 뒤로 가늘어지는 꼬리와 둥근 꼬리지느러미. 머리 -Y."""
    L = pv('length', 0.44)
    m = M.part('fish')
    HW, HL, HH = L * 0.36 * pv('width', 1.0), L * 0.5, L * 0.14
    hc = V((0, -L * 0.18, 0))
    head = ellipsoid(hc, (HW / 2, HL / 2, HH / 2), seg=26, rings=14)
    for v in head.verts:
        t = (v.co.y - hc.y) / (HL / 2)
        if t > 0:   # 뒤로 갈수록 좁아져 꼬리로 이어짐
            v.co.x *= 1 - 0.45 * t ** 1.3
            v.co.z *= 1 - 0.25 * t
    m.add(head, lambda c, n: 'back' if n.z > 0.25 else ('belly' if n.z < -0.4 else 'body'))
    # 꼬리 몸통 + 꼬리지느러미
    tail = rail([hc + V((0, HL * 0.35, 0)), V((0, L * 0.2, 0.004)), V((0, L * 0.36, 0.006))], [HW * 0.22, HW * 0.13, HW * 0.06], seg=14)
    m.add(tail, lambda c, n: 'back' if n.z > 0.2 else 'body')
    m.add(slab(tail_pts('round', L * 0.16, HH * 1.3), origin=(0, L * 0.34, 0.006), u=(0, 1, 0), v=(0, 0, 1), thick=0.006), 'fin', smooth=False)
    # 입: 아래턱(넓은 반달) + 위·아래 이빨
    mouth_y = hc.y - HL / 2 + L * 0.02
    m.add(ellipsoid((0, mouth_y + L * 0.01, -HH * 0.16), (HW * 0.42, L * 0.04, HH * 0.2), seg=20, rings=8), lambda c, n: 'body' if n.z > -0.2 else 'belly')
    m.add(ellipsoid((0, mouth_y + L * 0.004, -HH * 0.02), (HW * 0.4, L * 0.03, HH * 0.1), seg=18, rings=6), 'mouth', outline=False)
    for k in range(9):
        x = HW * 0.38 * (k / 4 - 1)
        y = mouth_y - L * 0.03 * math.cos((k / 4 - 1) * 1.2)
        m.add(cone(V((x, y, -HH * 0.08)), V((x, y - L * 0.004, HH * 0.04)), L * 0.008, 0.0, seg=5), 'tooth', outline=False)
    # 눈 (머리 위쪽에 작게)
    er = L * 0.022
    for sx in (1, -1):
        c = V((sx * HW * 0.18, hc.y - HL * 0.18, HH * 0.42))
        m.add(ellipsoid(c, (er, er, er * 0.9), seg=12, rings=8), 'eye')
        m.add(ellipsoid(c + V((sx * er * 0.3, -er * 0.4, er * 0.5)), (er * 0.38,) * 3, seg=8, rings=6), 'eyeHighlight')
    # 낚싯대 가시 + 미끼 혹
    base = V((0, hc.y - HL * 0.3, HH * 0.45))
    rod = bezier(base, base + V((0, -L * 0.02, L * 0.12)), base + V((0, -L * 0.1, L * 0.18)), base + V((0, -L * 0.17, L * 0.14)), 6)
    m.add(rail(rod, [L * 0.008 * (1 - 0.4 * i / 6) for i in range(7)], seg=6), 'fin')
    m.add(ellipsoid(rod[-1] + V((0, -L * 0.005, -L * 0.012)), (L * 0.026,) * 3, seg=12, rings=8), 'lure')
    # 가슴지느러미 (넓적한 팔 같은 것) + 옆 술 장식
    for sx in (1, -1):
        m.add(slab(oval2d(L * 0.09, L * 0.05, 12, cx=L * 0.07, squeeze=0.4), origin=(sx * HW * 0.4, hc.y + HL * 0.2, -HH * 0.2),
                   u=(sx, 0.4, -0.2), v=(0, 1, 0), thick=0.006), 'fin', smooth=False)
        for k in range(7):
            t = -0.75 + 1.4 * k / 6
            y = hc.y + HL / 2 * t
            w = HW / 2 * math.sqrt(max(0.0, 1 - t * t)) * (1 - 0.45 * max(0.0, t) ** 1.3)
            p = V((sx * w * 0.98, y, -HH * 0.05))
            m.add(cone(p, p + V((sx * L * 0.035, 0, -L * 0.01)), L * 0.01, 0.0, seg=5), 'fringe', outline=False)
    rnd = random.Random(int(P.get('seed', 7)))
    for _ in range(int(P.get('spots', 12))):
        x, y = rnd.uniform(-0.35, 0.35) * HW, hc.y + rnd.uniform(-0.35, 0.4) * HL
        dot_on(m, (x, y, HH * 0.48), (0, 0, 1), L * 0.014 * rnd.uniform(0.7, 1.3), 'mark')


def b_cuttlefish(M):
    """IC-SE-29 갑오징어: 넓고 납작한 타원 몸통(+Y 뒤) 둘레를 치마처럼 두른 얇은 지느러미, 짧은 다리 여덟 + 촉완 둘(-Y 앞),
    등에 줄무늬. 오징어(b_squid)보다 짧고 통통하다."""
    L = pv('length', 0.3)
    m = M.part('squid')
    ML, MW, MH = L * 0.62, L * 0.32, L * 0.13
    mc = V((0, L / 2 - ML / 2, 0))
    m.add(ellipsoid(mc, (MW / 2, ML / 2, MH / 2), seg=24, rings=14), lambda c, n: 'back' if n.z > 0.3 else 'body')
    # 치마 지느러미: 몸통 둘레 바깥 띠
    ring_o, ring_i = [], []
    for k in range(25):
        a = math.pi * (0.04 + 0.92 * k / 24)
        ring_o.append((math.sin(a) * (MW / 2 + L * 0.035), mc.y - math.cos(a) * (ML / 2 + L * 0.01)))
        ring_i.append((math.sin(a) * MW / 2 * 0.9, mc.y - math.cos(a) * ML / 2 * 0.9))
    for sx in (1, -1):
        poly = [(sx * x, y) for x, y in ring_o] + [(sx * x, y) for x, y in reversed(ring_i)]
        m.add(slab(poly, origin=(0, 0, -MH * 0.05), u=(1, 0, 0), v=(0, 1, 0), thick=0.004), 'fin', smooth=False)
    # 등 줄무늬 (가로 물결)
    for j in range(int(P.get('stripes', 7))):
        y = mc.y + ML / 2 * (-0.6 + 1.2 * j / 6)
        w = MW / 2 * math.sqrt(max(0.0, 1 - ((y - mc.y) / (ML / 2)) ** 2)) * 0.8
        pts = [V((x, y + L * 0.008 * math.sin(i * 1.7), MH / 2 * math.sqrt(max(0.0, 1 - (x / (MW / 2)) ** 2 - ((y - mc.y) / (ML / 2)) ** 2)) + 0.0015)) for i, x in enumerate((-w, -w / 2, 0, w / 2, w))]
        m.add(rail(pts, [L * 0.006] * 5, seg=5), 'mark', outline=False)
    hc = V((0, mc.y - ML / 2 - L * 0.05, 0))
    m.add(ellipsoid(hc, (MW * 0.36, L * 0.07, MH * 0.48), seg=16, rings=10), 'body')
    eyes(m, MW * 0.3, hc.y, MH * 0.12, L * 0.035)
    base = hc + V((0, -L * 0.05, 0))
    for k in range(8):
        a = TAU * k / 8
        d = V((math.cos(a), 0, math.sin(a) * 0.6))
        pts = bezier(base + d * L * 0.03, base + d * L * 0.045 + V((0, -L * 0.06, 0)), base + d * L * 0.05 + V((0, -L * 0.12, 0)), base + d * L * 0.03 + V((0, -L * 0.16, -L * 0.015)), 5)
        m.add(rail(pts, [L * 0.024 * (1 - 0.7 * i / 5) for i in range(6)], seg=7), 'fin')
    for sx in (1, -1):
        a = base + V((sx * L * 0.015, 0, -L * 0.01))
        pts = bezier(a, a + V((sx * L * 0.03, -L * 0.08, -L * 0.01)), a + V((sx * L * 0.05, -L * 0.17, -L * 0.03)), a + V((sx * L * 0.035, -L * 0.24, -L * 0.02)), 7)
        m.add(rail(pts, [L * 0.01] * 7 + [L * 0.022], seg=7), 'fin')


SEA_BUILDERS = {
    'seaweed': b_seaweed, 'urchin': b_urchin, 'sea-cucumber': b_cucumber, 'sea-squirt': b_squirt,
    'abalone': b_abalone, 'oyster': b_oyster, 'starfish': b_starfish, 'crab': b_crab, 'shrimp': b_shrimp,
    'jellyfish': b_jellyfish, 'anemone': b_anemone, 'sea-slug': b_sea_slug, 'mantis-shrimp': b_mantis_shrimp,
    'horseshoe-crab': b_horseshoe_crab, 'nautilus': b_nautilus, 'pearl-oyster': b_pearl_oyster, 'mussel': b_mussel,
    'scuba': b_scuba,
    'anglerfish': b_anglerfish, 'cuttlefish': b_cuttlefish,   # M18-P1
}

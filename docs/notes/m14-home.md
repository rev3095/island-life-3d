# M14 집과 섬이 자란다 — 트랙 노트 (브랜치 p55-m14-home, 작업 트리 ../island-worktrees/m14-home, 포트 4262)

## 상태 (2026-11-12, 사용량 한도로 중간에 멈춤 — 진행 중 커밋)
이 커밋은 **아직 테스트를 돌리지 않았다.** 아래 「남은 것」부터 이어서 할 것.

### 된 것
- 모델 (Blender 스크립트, 모두 status review): BD-12 `house-grown-1/2/3` (build_env.py `b_house_grown`, 집터·문 자리 BD-01 과 같음) ·
  TI-13 `bridge-built` · TI-14 `ramp-built` · 붙박이 FU-67 `home-stairs` · FU-68 `attic-stairs` · FU-69 `stair-rail` · FU-70 `attic-hatch`
  (build_furniture.py, assets/furniture/fixtures). 빌드 끝 (env 81개, 붙박이 16개). 렌더는 아직 눈으로 안 봄.
- 집 증축 규칙 `src/gameplay/house/home.js` (순수): 단계·빚·갚기·층 목록·계단 높이/트리거/막는 상자/도착 자리·방 검사.
  설정 `assets/interior/home.json`, 방 `assets/interior/rooms/rm-15|16|17.json` (owner 'player', floorIndex), interior index·WEB_FILES 에 추가.
- `house/index.js` 다시 씀: 층마다 방·구역(1층 x500 z0 · 2층 z40 · 다락 z80), rec.floor, 층별 벽지·바닥(`grow.decor`),
  계단 걸어 올라 꼭대기/구멍 열린 쪽 → 짧은 어둠 → 다른 층 + 자동 몇 걸음, 우편함(92, 안 읽은 편지 없을 때) 밤톨 대화로 짓기·갚기,
  다음 날(data:newday) 완공 (집 안이면 나올 때), 겉모양 교체 `applyExterior` (BD-01 치우고 persist:false 로 BD-12), 서비스 `house.grow`.
- room.js `buildRoom` 옵션 `wallH`·`door: null` · grid.js `wallInFront` 에 `d`.
- world: `src/world/built.js` (다리·경사로 자리 고르기·칸 표 바꾸기·되돌리기), `world.build`, island.js deckHeight 에 rot·y,
  decorKinds 에 decor.json `builds`·`homes` (lazy), occlusion 에 house-grown-*. build-web DECOR_FILES 도.

### 남은 것 (순서대로)
1. `node --test tests/` — 걸릴 것: interior.test (rooms 10개·owner 검사 → owner!=='player' 로 거르기), assets.test env count 76→81, 붙박이 수, res-editor 전체 수, 편집기 게시 목록(editor-files) 에 home.js.
2. decor 에 다리·경사로 놓기 (decor/index.js catalog 에 builds, 놓기 → world.build.bridgeSpot/rampSpot → addBridge/addRamp + objects.add persist:false, 저장 `state.island.built`, 시작 때 다시 적용, 고치기 치우기). tests/built.test.mjs.
3. 섬 별점 `src/gameplay/rating/` (rules.js 순수 점수: 꽃·나무·꾸민 가구·길·잡초 → 별 1–5, 주민 한마디, 별 오르면 도토리), 섬폰 APPS 줄 `rating` (UI-25), gameplay/index.js 줄, build-web island 묶음 정규식에 rating, story/rules.js 트리거 `rating-five` + 장면 s25 (files.js·index.json).
4. 자동 플레이 단계 (`tests/playthrough/scenario.js`: 우편함 → 짓기 → 내일 ▶ → 계단 오르내리기 · 섬폰 섬 평가), `--port=4262`.
5. `tools/check-interiors.mjs` 에 내 집 단계별(0–3) 확인, 개발 서버 콘솔 오류 0, 모델 렌더 눈으로 확인.

## 결정 (추천안으로 정함, D150–D154)
- D150-A 단계 넷: 0 처음(8×8) · 1 방 넓히기 20,000 (1층 10×10) · 2 2층 50,000 · 3 다락 100,000. 빚을 다 갚아야 다음, 짓기는 다음 날 아침. 묻기·갚기는 내 집 우편함(상점 주인 대화는 places.js 가 다른 트랙이라 안 함).
- D151-A 계단은 팝업 없이 걸어서: 1층 동쪽 벽 계단(남→북 오름), 위층은 구멍+난간의 열린 쪽으로 들어서면 내려감. 층 사이는 원 없는 짧은 어둠.
- D152-A (예정) 섬 별점: 하루 리셋·섬폰을 열 때 계산, 보상은 도토리, 별 다섯 첫 달성에 s25.
- D153-A 다리는 강폭 2칸 줄(동서·남북), 경사로는 남쪽 보는 절벽 앞 아래 두 칸 — 생성기 칸 표를 바꿔 이동·길찾기가 그대로 따라옴.
- D154-A 겉모양은 BD-12 세 모델, 처음 집 BD-01 은 치우고 저장하지 않는 물체로 놓는다.

## 문서 세션이 반영할 문장
- (작업이 끝나면 채운다) CLAUDE.md 「큰 구조」에 집 증축·층·계단, 「섬 꾸미기」에 다리·경사로, 섬 별점 절.

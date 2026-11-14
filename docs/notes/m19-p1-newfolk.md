# M19-P1 검수 확정 · 새 주민 컨셉 보드 (브랜치 `m19-p1-newfolk`, 16차 보드 D207-A · D204-A)

16차 검수 보드(wave16) 반영 v1 — D200–D207 모두 A. 이 트랙은 ① M18 검수 대기 40 확정 (D207-A) ② 새 주민 CH-18 · CH-19 컨셉 보드 (D204-A). main 2194691 에서 갈라짐. 점검 포트 4301. 결정 번호 D210–D219 중 D210–D217 사용.

## 1. 검수 대기 40 확정 (D207-A)

`assets` 아래 `"status": "review"` 를 스펙에서 직접 셈 (편집기 묶음 `assets/res/editor-index.json` 은 생성물이라 작업 트리에 없음): 배경 1 · 가구 16 · 벽지 4 · 아이템 19 = **40**. 장면 s29–s32 (스토리, 검수 대기) 는 이번 범위 밖 — 그대로 둠.

### 본 것
- 모델 36: Blender 렌더 `_main.png` (가구는 `_front.png` 도) · 아이콘 `_thumb.png` 를 모아 한 장씩 봄.
- 벽지 4: 개발 서버 4301 에서 `src/gameplay/house/pattern.js swatchURL` 로 그려 WP-09 와 나란히 봄. 견본 모서리에서 무늬가 반쯤 잘려 보이는 것은 견본을 2.4m 로 자른 탓이고, 무늬 한 칸은 `paint()` 가 옆 칸에도 그려서 이어진다 — 깨짐 아님.

### 고친 것
**없음.** 눈에 띄게 깨진 모델이 없었다. 아쉬운 점 둘은 고치지 않고 적어 둠:
- IC-SE-27 뿔소라: 초록 공에 뿔이 난 덤불처럼 보여 소라 소용돌이가 잘 안 읽힘. 이미 확정된 소라(`shell-turban`, 같은 `b_turban`)와 같은 모양이라 깨짐은 아님 — 고치려면 `build_item.py b_turban` 에 소용돌이 줄 재질(`shellDark`)을 넣는 것이 두 아이템을 같이 낫게 함.
- IC-SE-23 키조개: 족사 네 가닥이 작은 아이콘에서 다리처럼 보임. 확정된 홍합(`sea-mussel`, 같은 `b_mussel`)과 같은 모양.

### 확정한 것 (스펙 `"status": "approved"`, version 그대로 — M17-P1 과 같은 모양)
| 묶음 | 수 | ID · slug |
|---|---|---|
| 계절 바다 생물 | 18 | IC-SE-21–38: 바지락 · 주꾸미 · 키조개 · 털게 · 쥐치 · 군소 · 뿔소라 · 갯장어 · 갑오징어 · 전어 · 낙지 · 대하 · 삼치 · 대구 · 아귀 · 청어 · 홍게 · 가리비 (21→38 차례) (`sea-*`) |
| 곤충 | 1 | IC-BG-25 청개구리 `bug-tree-frog` |
| 대회 무대 | 1 | BD-17 `contest-stage` |
| 트로피 | 3 | FU-89–91 `trophy-gold` · `trophy-silver` · `trophy-bronze` |
| 계절 가구 | 13 | FU-92–104 `cherry-bonsai·chair·table·wall` · `maple-lamp·rug·shelf` · `shell-chair·lamp·mirror` · `snowflake-lamp·table·wall` |
| 계절 벽지 | 4 | WP-10–13 `wp-10` 벚꽃 비 · `wp-11` 조개 모래 · `wp-12` 단풍 바람 · `wp-13` 눈 결정 |
| **합** | **40** | |

- 목록: `node tools/build-env.mjs --index` · `build-furniture.mjs --index` · `build-item.mjs --index` (Blender 없이). 벽지 목록 `assets/interior/index.json` 은 `--index` 도구가 없어 그 네 줄의 status 만 고침 (M17-P1 과 같음).
- 확정 뒤 `assets` 아래 status `review` 는 장면 s29–s32 넷뿐.
- 테스트 둘이 「검수 대기」를 박아 두고 있어 확정값으로 고침: `tests/contest.test.mjs` (무대·트로피 `approved`, 장면 s29 는 그대로 `review`) · `tests/seasonal.test.mjs` (계절 가구 13 `approved`). 개수는 그대로.

## 2. 새 주민 CH-18 · CH-19 컨셉 보드 (D204-A)

- **보드** https://claude.ai/artifact/ELNHkTZpbyjHvzqLy2jY65 (slug `6bfb0dcb-8aff-4767-843a-36e72c0244e2`, 보드 id `newfolk`, seq 2, 아이콘 palette) — 원본 `concept/newfolk-board.html` + `concept/board-kit.js`. 새 아티팩트 도구라 `dist/newfolk/index.html` 에 문서 틀을 감싸 `publish_files` (index.html · board-kit.js) → `declare_capabilities` `db` (`applied`·`history` read view · write admin) + `user`.
- 모양: 16차 보드와 같은 책자 — 지금 섬 사람들 표(주민 10 + 가게 주인 6, 추천안 줄) → D210 CH-18 · D211 CH-19 (후보 셋씩, 라디오 카드 + SVG 정면 스케치 + 몸색·옷·성격·말끝·좋아하는 것·사연 ① ② ·이어지는 놀이·모델 비용) → 세부 결정 D212–D217 → 고른 뒤 진행 표 → 요청 글. 결정마다 의견 칸.

| 결정 | 물음 | 추천 | 다른 안 |
|---|---|---|---|
| D210 | CH-18 (집터 spare-1, 「손으로 만드는 주민」) | **A 햄스터 쌀알** — 정리왕·목공, 말끝 '쪼르', 해바라기씨·나무 상자, 사연 「부서진 첫 의자」·「볼주머니 씨앗」 | B 비버 나루 (목수, '뚝딱', 다리 짓기·증축) · C 두더지 포실 (땅굴 탐험가, '꼼지락', 화석·별밤) |
| D211 | CH-19 (집터 spare-2, 「어른스러운 결」) | **A 코끼리 보름** — 어르신 이야기꾼, '뿌우', 옛 사진·차, 사연 「빛바랜 사진」(등대 BD-18 실마리)·「코로 부는 노래」 | B 알파카 라떼 (다정한 언니, '뽀송', 뜨개질) · C 레서판다 노을 (멋쟁이, '랄라', 옷·앨범) |
| D212 | 이름 | A 초안 그대로 | B 의견 칸 이름 |
| D213 | 오는 차례 | A 이사 후보로 7일마다 CH-18 → CH-19 (`arrives: "moving"`, 연결은 P5) | B CH-19 먼저 · C 처음부터 섬에 |
| D214 | 모델 | A 빌더 `FEATURES` 에 종족 하나씩 (뼈대·동작 그대로, 특징 부품만) | B 비슷한 종족 다시 쓰기 |
| D215 | 대사 | A 220줄 안팎 | B 120줄 먼저 |
| D216 | 목소리 | A 새 목소리 둘 (`voices.json`) | B 빌려 쓰기 |
| D217 | 집 | A 지금 집 틀 + 색, spare-1·2 | B 새 집 모양 |

- 기존 종족 15 (주인공 빼고: 고양이·강아지·토끼·곰·오리·개구리·다람쥐·여우·거북·양·펭귄·부엉이·박쥐·고슴도치·나방) 과 말끝 10 (멍·개굴·냥·콘·…·깡·꽥·뭉·펭·부엉) 과 겹치지 않음. 너구리는 다른 게임의 상인 이미지와 겹쳐 후보에서 뺌.
- 스케치는 보드 안 SVG (`critter()`), Blender 렌더 아님 — 모델은 **고른 뒤에** 만든다.

### 고른 뒤 (이 세션에 "검수 보드 반영"이 오면)
`boards/newfolk` 를 읽어 → `assets/specs/<slug>.json` (status review) → `build_character.py FEATURES` 에 종족 + 새 부품 → `node tools/build-character.mjs <slug>` → 주민 파일 `assets/villagers/<slug>.json` (220줄 안팎, `town/files.js`, 생일 `rules.json birthdays`) → 목소리 · 방 배치 → `"arrives": "moving"` (실제 이사 연결·첫 만남 장면은 P5) → 개수 테스트 (`villagers`·캐릭터 수·`res-editor` 전체 수) → `applied/newfolk` v1 · `history/newfolk-v1`.

## 확인
- `node --test tests/`: **577 · 통과 576 · 실패 0 · 건너뜀 1** (건너뜀 = 리소스 편집기 옷 영역 — 이 작업 트리엔 `build-editor-index.mjs` 묶음이 없어서, 원래 그럼).
- 보드: 개발 서버 4301 `/concept/newfolk-board.html` 에서 스케치 여섯·표·결정 카드 확인, 콘솔 오류 0 (저장소가 없는 로컬이라 「이 창에서는 보드 저장소를 쓸 수 없어요」 표시는 정상). 게시본은 claude.ai 로그인이 필요해 Claude 가 직접 열어 보지 못함.

## 남은 것
- 게시는 보드만. **리소스 편집기 다시 게시는 안 함** (조정 세션 게시 차례 — 40개가 「확정」으로 바뀐 목록 `node tools/build-editor-index.mjs` → `dist/res-editor/publish.json`). 게임 링크는 status 를 거르지 않아 다시 게시할 것 없음.
- 편집기 홈: 목록 `editors.html` 에 새 보드 줄 · 보관함 `archive/<n차 id>` 한 줄 (`node tools/hub-archive.mjs`) · `status/newfolk` · `catalog/*` 다시 쓰기 (`node tools/hub-catalog.mjs`) — 다른 트랙과 `editors.html` 충돌을 피하려 이 브랜치에선 안 고침.
- 장면 s29–s32 는 아직 검수 대기 (스토리 편집기 쪽, D207 범위 밖).

## 문서 세션이 반영할 문장
- CLAUDE.md 「편집기와 "요청 확인" 흐름」 확정 문단 끝: 「2026-11-14 M19-P1 (16차 D207-A) 에 M18 검수 대기 40개 (계절 바다 생물 18 · 청개구리 · 대회 무대 BD-17 · 트로피 FU-89–91 · 계절 가구 FU-92–104 · 계절 벽지 WP-10–13) 를 고칠 것 없이 모두 확정 — 남은 검수 대기는 장면 s29–s32 (`docs/notes/m19-p1-newfolk.md`).」
- CLAUDE.md 「계절 행사 (M8)」 등에 남은 「검수 대기」 표현 중 M18 모델에 해당하는 것 (`docs/notes/m18-p3-contest.md`·`m18-p4-seasonal.md`·`m18-p1-creatures.md` 의 「검수 대기」) → 「확정 (M19-P1)」.
- `concept/README.md` 보드 목록: 「새 주민 검수 보드 v1 | https://claude.ai/artifact/ELNHkTZpbyjHvzqLy2jY65 | `concept/newfolk-board.html` + `board-kit.js` (보드 id `newfolk`) | M19-P1, 16차 D204-A 의 새 주민 CH-18 · CH-19 후보 셋씩 · 결정 D210–D217, 선택 대기」.
- devlog 「게시물」 표에 같은 줄 · 「현재 상태」 에 「검수 대기 40 확정 (M19-P1), 새 주민 보드 선택 대기」.
- 편집기 홈 `editors.html` `editors-list` 와 `archive-index` 에 `newfolk` (16차 뒤, 「16-newfolk」 처럼) 한 줄.
- 바깥 `Subculture projects/.claude/launch.json` 에 미리보기 설정 `m19-p1-newfolk` (포트 4301) 를 더했다 (저장소 밖).

# 검수 보드 보관함 (편집기 홈 「검수 보드 보관함」 · 홈 저장소 `archive/<n차 id>`)

사용자 요청 (2026-11-12): 「이전까지의 검수 보드를 편집기 안에 archive 로 만들어서 전부 n차 검수 보드로 저장·기록」. 브랜치 `board-archive` (main 2299be4 에서), 편집기 홈·보드 문서만 고침 (게임 `src` 는 안 건드림).

## 한 것

- **편집기 홈** `editors.html` 에 칸 `#archive-boards` 「검수 보드 보관함」 (목차 「보드 보관함」): 모든 보드를 n차 순서로 — 차수(`#순번 · id`) · 보드 이름·id·보드 열기 링크 · 만든 날 · 결정 범위 · 반영 버전·날짜 · 고른 것 요약(+의견) · 반영 요약(기록이 둘 이상이면 「반영 기록 n개」 펼침) · 반영 커밋(오래된 것 → 새 것).
- **차례** = `editors.html` 의 `<script type="application/json" id="archive-index">` (n차 번호·결정 범위·만든 날·주제 보드 설명 `also`, 저장 없는 보드의 문서 기록 `fallback`). 이름·링크·파일은 `editors-list` 에서 보드 id 로 가져온다.
- **기록** = 홈 저장소 `archive/<n차 id>` 15개. 보드 저장소마다 `applied/<보드 id>`·`history/<보드 id>-v<n>` 을 db 도구로 읽어 `tools/hub-archive.mjs` 로 만들었다. 1차 컨셉 보드는 저장소가 없어 `fallback` (devlog 세션 1 · `concept-board.html` 결정 표 · README 보드 표) 으로 채움 — 고른 것은 보드의 추천안(*)이고 `picksFrom: 'recommended'` 로 표시.
- 화면 계산은 `HubLogic.pickSummary` · `archiveDoc` · `archiveRows` (홈과 도구가 같은 함수). 저장소를 못 읽는 창에서도 차례·보드 링크는 그대로 그린다 (기록 칸만 비고 「저장소 기록 전」 표시). 차례에 없는 `archive/*` 문서(홈을 다시 게시하기 전에 더한 새 보드)도 seq 순으로 끝에 보인다.
- 로컬 dev-server 는 `/api/db/hub-archive` (`assets/review/hub-archive.json`, 행마다 `docId` — `node tools/hub-archive.mjs --boards <파일> --local`).
- 홈 capabilities db 규칙에 `{"path":"archive","read":"view","write":"admin"}` 추가 (전체 다시 선언).
- 테스트 `tests/hub.test.mjs` 셋: 차례 ↔ 홈 목록 보드 · README ID 표 D 줄 · 차수 규칙 / 계산·도구 / 구독·노트.

## 차수 규칙 (n차 번호 매기기)

1. 줄은 **결정 번호(D) 순서** = 보드를 만든 순서. `seq` 는 1부터 빈틈없이.
2. 마일스톤 N 을 정한 **본 보드**는 「N차」: `wave<N>` → N차 (보드 이름 「N차 검수 보드」와 같은 번호). 1차 = 컨셉 보드 v0.1 (M1 계획). 2–4차는 보드가 없다 (M2–M4 는 컨셉 보드 계획대로 진행).
3. 12차 wave 보드는 없고 **M12 를 정한 night 보드가 12차 본 보드** — 이름은 「12차 · 밤·새벽」.
4. 그 사이 따로 연 **주제 보드**는 결정 번호상 **바로 앞 본 보드의 차수**에 붙여 「N차 · 주제」: Z5 축제 → 5차 · 축제, 하늘·실내 → 7차 · 하늘 / 7차 · 실내, 투어·셰이더 → 12차 · 투어 / 12차 · 셰이더 (투어는 11차 D100-B 「새 곳」에서 나왔지만 결정 D120– 이 night D106– 다음이라 12차; 관계는 `also` 에 적음).
5. 문서 id = `<두 자리 차수>-<보드 id>` (예 `07-sky`), 홈 저장소 `archive/<id>`.

| 순번 | 차수 | id | 보드 | 결정 | 반영 | 고른 것 |
|---|---|---|---|---|---|---|
| 1 | 1차 | `01-concept` | 컨셉 보드 v0.1 (저장 없음) | D1–D7 | v0 (문서 기록) | 추천안: D1-B · D2-B · D6-B · 나머지 A |
| 2 | 5차 | `05-wave5` | 5차 v0.5 | D8–D13 | v1 | D8-B · D13-CH10 · 나머지 A |
| 3 | 5차 · 축제 | `05-z5` | Z5 축제 v0.1 | D14–D25 | v1 | D20-B · 나머지 A |
| 4 | 6차 | `06-wave6` | 6차 v0.6 | D26–D35 | v1 | 모두 A |
| 5 | 7차 | `07-wave7` | 7차 v0.7 (+QA 결과) | D36–D57 | v2 | D37-B · D41-B · 나머지 A (의견 D41) |
| 6 | 7차 · 하늘 | `07-sky` | 하늘 v0.1 | D58–D66 | v1 | 모두 A |
| 7 | 7차 · 실내 | `07-interiors` | 실내 v0.1 | D67–D73 | v2 | 모두 A |
| 8 | 8차 | `08-wave8` | 8차 v0.8 | D74–D85 | v1 | 모두 A |
| 9 | 9차 | `09-wave9` | 9차 v0.9 | D86–D92 | v1 | 모두 A |
| 10 | 10차 | `10-wave10` | 10차 v1.0 | D93–D99 | v1 | 모두 A |
| 11 | 11차 | `11-wave11` | 11차 v1.1 | D100–D105 | v1 | 모두 A |
| 12 | 12차 · 밤·새벽 | `12-night` | 밤·새벽 v0.1 | D106–D114 | v1 | 모두 A |
| 13 | 12차 · 투어 | `12-tour` | 무인도 투어 v0.1 | D120–D128 | v1 | 모두 A |
| 14 | 12차 · 셰이더 | `12-shader` | 셰이더 v0.1 | D130–D139 | v1 | D130-B · 나머지 A (+사양 고르기 6) |
| 15 | 13차 | `13-wave13` | 13차 v1 | D140–D147 | v1 | 모두 A |

## `archive/<id>` 문서 모양

```
{ id: '07-wave7', seq: 5, cha: 7, label: '7차', kind: 'concept'|'main'|'theme', board: 'wave7',
  name, url, file, made: 'YYYY-MM-DD', decisions: 'D36–D57', also: '한 줄'|null,
  source: 'store'|'docs'|'none', from: '문서 기록 출처'|null, picksFrom: 'board'|'recommended',
  applied: { version, appliedAt: <ms>, summary, commit } | null,      // 보드 applied/<id> (없으면 history 마지막)
  picks: { D36: 'A', … }, picksSummary: 'D37-B · D41-B · 나머지 A (22개)', notes: { D41: '…' }, notesCount,
  versions: n, history: [{ version, appliedAt, summary, commit, picks, notes }],   // 새 것부터
  commits: ['5223e1e', '20b52a0'],    // 반영 커밋, 오래된 것부터
  builtAt: <ms>, by: 'claude' }
```

## 새 보드 · 새 반영이 생기면

1. 새 보드(14차 이후): `editors.html` `archive-index` 끝에 한 줄 `{ id: '<NN>-<보드 id>', seq: <다음>, cha, label: 'N차' | 'N차 · 주제', kind, board, decisions: 'Dn–Dm', made }` (규칙 위 1–5). 홈을 다시 게시하기 전이어도 `archive/<id>` 문서만 쓰면 보관함 끝에 보인다.
2. 기록: "검수 보드 반영" 7번(홈 `status/<보드 id>`)과 같이 — 바뀐 보드 저장소의 `applied`·`history` 를 `db_list` 로 읽어 `{ <보드 id>: { applied, history: [...] } }` 파일로 → `node tools/hub-archive.mjs --boards <파일>` → `assets/review/hub/archive/<id>.json` 을 홈 저장소 `archive/<id>` 에 `db_write` `set` (있던 문서는 `ifVersion`). 바뀐 보드만 넘기면 나머지 문서는 기록 없음으로 나오니, **바뀐 보드의 문서만** 쓴다.

## 문서 세션이 반영할 문장

- `concept/README.md` 「편집기 홈 (ET-01)」 문서 표에 한 줄:
  `| \`archive/<n차 id>\` | 검수 보드 보관함 — 보드마다 \`applied\`·\`history\` 를 모은 기록 (\`{ id, seq, cha, label, kind, board, name, url, made, decisions, source, applied, picks, picksSummary, notes, history, commits, builtAt, by: 'claude' }\`, id = \`<두 자리 차수>-<보드 id>\`) | Claude (쓰기 admin, \`tools/hub-archive.mjs\`) |`
- 같은 절 게시 capabilities 에 `{"path":"archive","read":"view","write":"admin"}` 를 더한다 (지금 규칙 6개: status·meta·catalog·marks·archive 쓰기 admin, manage 쓰기 interact).
- 같은 절에 문단: 「홈의 **검수 보드 보관함** (`#archive-boards`) 은 모든 보드를 n차 순서로 보여 준다 — 차례는 `editors.html` 의 `archive-index`, 기록은 홈 저장소 `archive/<n차 id>`. 차수 규칙: 결정 번호 순서대로, 마일스톤 N 을 정한 본 보드는 「N차」(wave<N>, M12 는 night), 그 사이 주제 보드는 바로 앞 본 보드의 차수에 붙여 「N차 · 주제」. 저장 없는 1차 컨셉 보드는 문서 기록(`fallback`). 자세히 `docs/notes/board-archive.md`.」
- 「새 보드 만드는 법」 6번 끝에: 「… 편집기 홈 목록에 더하고, 보관함 차례(`archive-index`)에 n차 한 줄을 더한다 → 홈 다시 게시.」
- 「"검수 보드 반영"」 7번 끝에: 「그리고 그 보드의 `applied`·`history` 로 `node tools/hub-archive.mjs --boards <파일>` → 홈 `archive/<n차 id>` 를 고친다.」
- 보드 표 첫 열(또는 새 열 「차수」)에 n차 이름: 컨셉 1차 · wave5 5차 · Z5 5차 · 축제 · wave6 6차 · wave7 7차 · sky 7차 · 하늘 · interiors 7차 · 실내 · wave8 8차 · wave9 9차 · wave10 10차 · wave11 11차 · night 12차 · 밤·새벽 · tour 12차 · 투어 · shader 12차 · 셰이더 · wave13 13차.
- CLAUDE.md 「편집기와 "요청 확인" 흐름」 편집기 홈 줄의 저장소 문서 목록에 「검수 보드 보관함 `archive/<n차 id>` (`tools/hub-archive.mjs`)」 를 더한다.
- devlog 「게시물」 편집기 홈 줄: 게시 버전(아래)·보관함.

## 게시 · 저장소

- 홈 다시 게시: 사본 `dist/hub/index.html` (main 사본과 같은 문서 틀 + 이 브랜치 `editors.html`) → `publish_files`, 그다음 `declare_capabilities` (위 규칙 6개 + `user`).
- 결과는 아래 「게시 기록」.

## 게시 기록

- 2026-11-12 편집기 홈 다시 게시 **seq 21, 버전 1794463315-04f8** (`publish_files` seq 20 `1794463308-7e5e` → `declare_capabilities` seq 21). 게시 전 live 게시본 = main 2299be4 의 `editors.html` 을 같은 틀로 감싼 것과 sha256 같음(c30c04dd…) 확인 → 이 브랜치 사본(92,640 B, sha256 4bec412a…)과 게시본 `list_files` sha256 같음. `concept/board-kit.js` 는 그대로(e3c48bdb…).
- capabilities db 규칙 6개: status · meta · catalog · marks · **archive** 쓰기 admin (읽기 view), manage 쓰기 interact. `user` 그대로.
- 홈 저장소 `archive/*` **15개** 처음 씀 (모두 version 1, 저장소 문서 합계 54). `asLevel: view` 로 `archive/12-tour` 읽힘 확인.
- 확인: claude.ai 게시본은 미리보기 창이 로그인 전이라 직접 못 열었다. 대신 로컬 dev-server(4258)에서 ① 로컬 흉내(`hub-archive`) ② `window.claude.use('db')` 흉내(archive 만 있는 저장소) ③ 저장소 없음 — 셋 모두 보관함 15줄·오류 0, 1200px·390px 에서 페이지 가로 넘침 0 (표만 칸 안에서 가로 스크롤). 테스트 `node --test tests/` 483 (통과 482 · 건너뜀 1 · 실패 0), `tests/hub.test.mjs` 16.

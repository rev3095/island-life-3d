// 편집기 홈 게임 카드 — 게임 저장소의 문제 알리기(reports)·기기 점검(checks)을 읽어 홈 저장소 status/game 에 쓸 요약을 만든다.
//   node tools/hub-game.mjs [--reports <폴더|파일>] [--checks <폴더|파일>] [--out <파일>] [--print]
// 아티팩트는 서로의 저장소를 못 읽어서, "전체 요청 확인" 때 Claude 가 게임 저장소를 ArtifactData list … out_dir 로 내려받고
// (<폴더>/reports/<id>.json · <폴더>/checks/<id>.json) 이걸 돌려 나온 칸을 홈 status/game 에 update 한다.
//   --reports · --checks  ArtifactData out_dir 폴더(<id>.json 들, 또는 그 부모 폴더) · 행 배열 JSON 파일(dev-server 흉내, 행마다 docId|id).
//                         기본 = 로컬 흉내 assets/review/game-reports.json · assets/review/checks.json
//   --out     update 할 칸을 쓸 파일 (기본 assets/review/hub/status-game.json — gitignore)
// 요약 계산은 editors.html 의 HubLogic.game (홈이 로컬에서 바로 읽을 때와 같은 함수). 모양·처리 순서는 concept/README.md 「게임 저장소」.
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, join, dirname, basename } from 'node:path';
import vm from 'node:vm';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const LOCAL = { reports: 'assets/review/game-reports.json', checks: 'assets/review/checks.json' };

/** 문제 종류 → D47-A 처리: fix = 그 자리에서 고침(status 'done' + reply + commit) · board = 7차 보드 QA 칸(status 'board' + qa) · judge = 글을 보고 둘 중 하나 */
export const ROUTE = { stuck: 'fix', error: 'fix', save: 'fix', look: 'board', other: 'judge' };

/** editors.html 의 <script id="hub-logic"> 만 돌려 HubLogic 을 꺼낸다 (화면과 같은 계산) */
export function hubLogic(html = readFileSync(join(ROOT, 'editors.html'), 'utf8')) {
  const m = html.match(/<script id="hub-logic">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('editors.html 에 hub-logic 이 없어요');
  const window = {};
  vm.runInNewContext(m[1], { window });
  return window.HubLogic;
}

/** 폴더(<id>.json 들 — 문서 id 는 파일 이름) · 부모 폴더(<col>/ 를 찾음) · 행 배열 파일 → [{ id, …문서 }] */
export function readRows(path, col) {
  if (!path || !existsSync(path)) return [];
  if (statSync(path).isDirectory()) {
    const dir = existsSync(join(path, col)) && statSync(join(path, col)).isDirectory() ? join(path, col) : path;
    return readdirSync(dir).filter(f => f.endsWith('.json')).sort()
      .map(f => ({ ...JSON.parse(readFileSync(join(dir, f), 'utf8')), id: basename(f, '.json') }));
  }
  const data = JSON.parse(readFileSync(path, 'utf8'));
  if (Array.isArray(data)) return data.map(r => ({ ...r, id: r.docId ?? r.id }));
  return Object.entries(data).map(([id, d]) => ({ ...d, id }));   // { id: 문서 } 모양도 받는다
}

/** 홈 status/game 에 update 할 칸 (published·note 같은 다른 칸은 건드리지 않는다) */
export function gameStatus({ reports = [], checks = [], now = Date.now(), html } = {}) {
  const sum = JSON.parse(JSON.stringify(hubLogic(html).game(reports, checks)));   // vm 안 값 → 이쪽 값
  return { ...sum, checkedAt: now, updatedAt: now, updatedBy: 'claude' };
}

/* ---------- 실행 ---------- */
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const from = col => resolve(ROOT, opt(`--${col}`) ?? LOCAL[col]);
  const reports = readRows(from('reports'), 'reports');
  const checks = readRows(from('checks'), 'checks');
  const out = resolve(ROOT, opt('--out') ?? 'assets/review/hub/status-game.json');
  const doc = gameStatus({ reports, checks });
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(doc, null, 1));
  const r = doc.reports;
  console.log(`status/game 칸 → ${out}`);
  console.log(`  문제 알리기 ${r.total}개 · 새 문제 ${doc.open} · 처리 중 ${r.working} · 고침 ${r.done} · 보드로 ${r.board} · 겹침 ${r.dup}`);
  const fresh = reports.filter(x => x.status === 'new' || x.status === 'working');
  for (const x of fresh) {
    const how = { fix: '바로 고침 → done + reply + commit', board: '보드 QA 칸 → board + qa', judge: '글 보고 판단 (막힘·저장·오류면 바로, 아니면 보드)' }[ROUTE[x.kind] ?? 'judge'];
    console.log(`  · ${x.id} [${x.status}] ${x.kind ?? '?'} — ${String(x.text ?? '').replace(/\s+/g, ' ').slice(0, 60) || '(글 없음)'} · 오류 ${x.errorTotal ?? 0} · ${x.game?.build ?? '?'} → ${how}`);
  }
  const c = doc.checks;
  console.log(`  기기 점검 ${c.total}번${c.slow ? ` · 광장 느림 ${c.slow}` : ''}`);
  for (const x of c.recent) console.log(`  · ${new Date(x.at).toISOString().slice(0, 16)} ${x.gpu ?? '?'} ${x.screen ?? ''} · 광장 ${x.plaza.avg ?? '—'}ms ${x.plaza.ok === false ? '느림' : x.plaza.ok ? '✓' : ''} · 품질 ${x.quality.start}→${x.quality.end} · 오류 ${x.errors}`);
  if (args.includes('--print')) console.log(JSON.stringify(doc, null, 1));
}

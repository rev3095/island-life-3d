-- 포근섬 저장 서버 (Cloudflare D1). 컬렉션마다 문서 하나 = 한 줄.
--   islands/<쓴 사람 id> (섬 사진, code 로 찾기) · visits/<쓴 사람 id> (방명록·편지·선물)
--   game-reports · checks (문제 알리기 · 기기 점검 — 추가만)
CREATE TABLE IF NOT EXISTS docs (
  col  TEXT NOT NULL,
  id   TEXT NOT NULL,
  code TEXT,
  data TEXT NOT NULL,
  at   INTEGER NOT NULL,
  PRIMARY KEY (col, id)
);
CREATE INDEX IF NOT EXISTS docs_code ON docs (col, code);

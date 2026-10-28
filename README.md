# 포근섬 이야기

웹 브라우저에서 바로 하는 3D 섬 생활 게임 (오리지널 IP). three.js + Blender 스크립트 파이프라인.

## 실행

```bash
node dev-server.mjs
```

- 게임: http://localhost:4180/index.html (`?debug` 를 붙이면 모듈 로딩 기록)
- 캐릭터 편집기: http://localhost:4180/editor.html
- 배경 편집기: http://localhost:4180/bg-editor.html

## 구조

| 경로 | 내용 |
|---|---|
| `index.html`, `src/main.js` | 게임 시작점, 모듈 로더 |
| `src/core/` | 공용 기반: 이벤트, 상태, 입력, 모델 불러오기, 툰 재질·곡면 월드 |
| `src/<트랙>/` | 각 개발 트랙 모듈 (`docs/PLAN.md`) |
| `docs/PLAN.md` | 개발 단계 P1~P6, 병렬 트랙 |
| `docs/CONTRACTS.md` | 모듈끼리의 약속 (이벤트, 서비스, 상태) |
| `assets/` | Blender 빌더·스펙·모델·렌더 |
| `tools/` | 모델 빌드 스크립트 |

## 모델 다시 만들기

```bash
node tools/build-character.mjs --all
node tools/build-env.mjs --all
```

// 대사 묶음: 주민 7명(단풍은 5차에 이사 옴) + 가게 주인 2명. 모두 이 게임을 위해 새로 쓴 문장이다.
// 6차 M6-P3 부터 대사는 주민 파일 assets/villagers/<slug>.json 의 lines 칸 (생일 대사 birthday · letters.birthday · playerBirthday 도 그 안에).
// 형식: 항목 하나 = 한 줄, 배열 = 이어지는 여러 줄. 자리 {want} 부탁한 것, {item} 물건 이름, {reward} 보상 — ':을' 처럼 붙이면 받침에 맞는 조사 (town/rules.js fill).
export { LINES as default } from '../people.js';

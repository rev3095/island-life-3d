// 대사 묶음: 주민 7명(단풍은 5차에 이사 옴) + 가게 주인 2명. 모두 이 게임을 위해 새로 쓴 문장이다.
// 생일 대사(birthday.js)는 주민마다 L.birthday 와 L.letters.birthday · playerBirthday 로 합친다.
import coco from './coco.js';
import bori from './bori.js';
import mochi from './mochi.js';
import dubu from './dubu.js';
import pong from './pong.js';
import chorong from './chorong.js';
import danpung from './danpung.js';
import bamtol from './bamtol.js';
import neuru from './neuru.js';
import BIRTHDAY from './birthday.js';

const LINES = { coco, bori, mochi, dubu, pong, chorong, danpung, bamtol, neuru };
for (const [slug, { letters, ...rest }] of Object.entries(BIRTHDAY)) {
  const L = LINES[slug];
  if (!L) continue;
  L.birthday = rest;
  L.letters = { ...L.letters, ...letters };
}
export default LINES;

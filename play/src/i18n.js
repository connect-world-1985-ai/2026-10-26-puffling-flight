// The single string table for all on-screen text (English and Simplified Chinese).
export const STRINGS = {
  en: {
    pageTitle: 'Puffling Flight · a tiny flying game',
    title: 'Puffling Flight',
    tagline: 'Flap between the sea stacks. How far can you go?',
    play: 'Play',
    settings: 'Settings',
    best: 'Best',
    score: 'Score',
    hintDesktop: 'Press Space, ↑ or click to flap',
    hintTouch: 'Tap anywhere to flap',
    keysHelp: 'P or Esc: pause · M: mute',
    credits: 'All graphics and sounds are generated in code.',
    getReady: 'Get ready!',
    paused: 'Paused',
    resume: 'Resume',
    restart: 'Restart',
    menu: 'Main menu',
    gameOver: 'Game over',
    playAgain: 'Play again',
    newBest: 'New best!',
    medalNone: 'Score 10 to earn a medal',
    medalBronze: 'Bronze medal',
    medalSilver: 'Silver medal',
    medalGold: 'Gold medal',
    medalPlatinum: 'Platinum medal',
    sound: 'Sound effects',
    music: 'Music',
    reduceMotion: 'Reduce motion',
    language: 'Language',
    on: 'On',
    off: 'Off',
    resetBest: 'Reset best score',
    resetConfirm: 'Tap again to confirm',
    resetDone: 'Best score cleared',
    back: 'Back',
    langToggle: '中文',
    langNameEn: 'English',
    langNameZh: '中文',
    ariaLang: 'Switch language to Chinese',
    ariaPause: 'Pause',
    ariaMute: 'Mute sound',
    ariaUnmute: 'Turn sound on',
    ariaCanvas: 'Game area: press Space or tap to flap',
    announceOver: 'Game over. Score {score}. Best {best}.',
  },
  zh: {
    pageTitle: '小海鹦飞飞 · 迷你飞行小游戏',
    title: '小海鹦飞飞',
    tagline: '穿过海蚀柱，看你能飞多远！',
    play: '开始',
    settings: '设置',
    best: '最高分',
    score: '得分',
    hintDesktop: '按空格键、↑ 键或点击鼠标振翅',
    hintTouch: '轻触屏幕任意位置振翅',
    keysHelp: 'P 或 Esc：暂停 · M：静音',
    credits: '所有画面和声音均由代码生成。',
    getReady: '准备好了吗？',
    paused: '已暂停',
    resume: '继续',
    restart: '重新开始',
    menu: '主菜单',
    gameOver: '游戏结束',
    playAgain: '再玩一次',
    newBest: '新纪录！',
    medalNone: '得到 10 分即可获得奖牌',
    medalBronze: '铜牌',
    medalSilver: '银牌',
    medalGold: '金牌',
    medalPlatinum: '白金奖牌',
    sound: '音效',
    music: '音乐',
    reduceMotion: '减少动态效果',
    language: '语言',
    on: '开',
    off: '关',
    resetBest: '清除最高分',
    resetConfirm: '再点一次以确认',
    resetDone: '最高分已清除',
    back: '返回',
    langToggle: 'EN',
    langNameEn: 'English',
    langNameZh: '中文',
    ariaLang: '切换语言为英文',
    ariaPause: '暂停',
    ariaMute: '静音',
    ariaUnmute: '打开声音',
    ariaCanvas: '游戏区域：按空格键或轻触屏幕振翅',
    announceOver: '游戏结束。得分 {score}，最高分 {best}。',
  },
};

export const LANGS = ['en', 'zh'];

// Saved choice wins; otherwise the first browser language we support; otherwise English.
export function detectLang(saved, navLangs) {
  if (saved === 'en' || saved === 'zh') return saved;
  for (const tag of Array.isArray(navLangs) ? navLangs : []) {
    const l = String(tag || '').toLowerCase();
    if (l === 'zh' || l.startsWith('zh-')) return 'zh';
    if (l === 'en' || l.startsWith('en-')) return 'en';
  }
  return 'en';
}

export function t(lang, key, vars) {
  const table = STRINGS[lang] || STRINGS.en;
  let s = key in table ? table[key] : key in STRINGS.en ? STRINGS.en[key] : key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  return s;
}

export function htmlLang(lang) {
  return lang === 'zh' ? 'zh-Hans' : 'en';
}

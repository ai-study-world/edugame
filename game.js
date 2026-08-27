/* ============================================================
   幼小衔接 · 趣味学习乐园  -  游戏逻辑
   ============================================================ */

(() => {
  'use strict';

  // ---------- 常量 ----------
  const GAMES = {
    math:    { name: '口算小达人', desc: '10以内加减法' },
    count:   { name: '数一数',     desc: '点物数数' },
    pinyin:  { name: '拼音大闯关', desc: '声母韵母配对' },
    memory:  { name: '记忆翻牌',   desc: '动物配对' },
    clock:   { name: '认识钟表',   desc: '读出时间' },
    spot:    { name: '找不同',     desc: '观察找茬' },
    hanzi:   { name: '汉字启蒙',   desc: '象形识字' },
    money:   { name: '认识人民币', desc: '钱币换算' },
    pattern: { name: '找规律',     desc: '序列推理' },
    season:  { name: '认识四季',   desc: '季节特征' },
    shadow:  { name: '找影子',     desc: '影子配对' },
    shapes:  { name: '认图形颜色', desc: '图形颜色认知' },
    direction: { name: '找方向',   desc: '方位判断' },
    family:  { name: '亲属称谓',   desc: '家人怎么称呼' },
    behavior: { name: '行为判断',   desc: '什么行为不对' },
  };
  const STAR_KEY = 'edugame_stars';
  const STATS_KEY = 'edugame_stats';

  // ---------- DOM ----------
  const $ = (s) => document.querySelector(s);
  const menuScreen = $('#menuScreen');
  const gameScreen = $('#gameScreen');
  const reportScreen = $('#reportScreen');
  const gameTitle = $('#gameTitle');
  const gameStars = $('#gameStars');
  const gameArea = $('#gameArea');
  const modal = $('#modal');
  const modalEmoji = $('#modalEmoji');
  const modalTitle = $('#modalTitle');
  const modalText = $('#modalText');
  const modalBtn = $('#modalBtn');
  const modalBackBtn = $('#modalBackBtn');

  // ---------- 音频（Web Audio 合成音效，无需外部文件） ----------
  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audioCtx = null; }
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  }
  function playTone(freq, dur, type = 'sine', vol = 0.2, when = 0) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const t = audioCtx.currentTime + when;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  const sfx = {
    correct() { playTone(880, .12); playTone(1318, .18, 'sine', .18, .08); },
    wrong()   { playTone(220, .25, 'sawtooth', .12); },
    click()   { playTone(600, .06, 'triangle', .1); },
    win()     { [523, 659, 784, 1047].forEach((f, i) => playTone(f, .2, 'sine', .2, i * .13)); },
    star()    { playTone(1568, .15, 'sine', .18, .05); },
  };

  // ---------- 星级 & 进度 ----------
  const stars = JSON.parse(localStorage.getItem(STAR_KEY) || '{}');
  function saveStars() { localStorage.setItem(STAR_KEY, JSON.stringify(stars)); }
  function totalStars() { return Object.values(stars).reduce((a, b) => a + (b || 0), 0); }
  function refreshStars() {
    $('#totalStars').textContent = totalStars();
    for (const g of Object.keys(GAMES)) {
      const n = stars[g] || 0;
      $('#stars-' + g).textContent = '★'.repeat(n) + '☆'.repeat(3 - n);
    }
  }
  function addStar(gameId, count = 1) {
    stars[gameId] = Math.min(3, (stars[gameId] || 0) + count);
    saveStars(); refreshStars();
    // 浮动星星动画
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const el = document.createElement('div');
        el.className = 'float-star';
        el.textContent = '⭐';
        el.style.left = (20 + Math.random() * 60) + 'vw';
        el.style.top = '40%';
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 1300);
      }, i * 150);
    }
    sfx.star();
  }

  // ---------- 成绩记录系统（正确率 + 用时） ----------
  // stat 结构: { plays, best, totalCorrect, totalQuestions, totalTimeMs }
  const stats = JSON.parse(localStorage.getItem(STATS_KEY) || '{}');
  function saveStats() { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); }
  /**
   * 记录一次游戏成绩（每次完整玩完一轮调用）
   * @param {string} gameId 游戏id
   * @param {number} correct 答对数
   * @param {number} total 总题数
   * @param {number} timeMs 用时毫秒
   */
  function recordGame(gameId, correct, total, timeMs) {
    const s = stats[gameId] || { plays: 0, best: 0, totalCorrect: 0, totalQuestions: 0, totalTimeMs: 0 };
    const rate = total > 0 ? correct / total : 0;
    s.plays++;
    s.best = Math.max(s.best, rate);
    s.totalCorrect += correct;
    s.totalQuestions += total;
    s.totalTimeMs += timeMs;
    stats[gameId] = s;
    saveStats();
  }
  function statRate(gameId) {
    const s = stats[gameId];
    if (!s || s.totalQuestions === 0) return null;
    return s.totalCorrect / s.totalQuestions;
  }
  function statAvgTime(gameId) {
    const s = stats[gameId];
    if (!s || s.plays === 0) return null;
    return Math.round(s.totalTimeMs / s.plays);
  }

  // ---------- 能力维度（雷达图 6 维） ----------
  const DIMENSIONS = [
    { key: 'math',    name: '数学运算', games: ['math', 'money', 'pattern'] },
    { key: 'num',     name: '数感认知', games: ['count', 'clock'] },
    { key: 'lang',    name: '语言启蒙', games: ['pinyin', 'hanzi'] },
    { key: 'memory',  name: '记忆观察', games: ['memory', 'spot'] },
    { key: 'logic',   name: '逻辑推理', games: ['pattern', 'direction'] },
    { key: 'nature',  name: '自然认知', games: ['season', 'shadow', 'shapes'] },
    { key: 'social',  name: '社会认知', games: ['family'] },
    { key: 'habit',   name: '行为习惯', games: ['behavior'] },
  ];
  // 计算各维度得分（0-100）
  function dimensionScores() {
    return DIMENSIONS.map(d => {
      let correct = 0, total = 0;
      d.games.forEach(g => {
        const s = stats[g];
        if (s && s.totalQuestions > 0) { correct += s.totalCorrect; total += s.totalQuestions; }
      });
      return { ...d, score: total > 0 ? Math.round(correct / total * 100) : 0, played: total > 0 };
    });
  }

  // ---------- 雷达图绘制（Canvas 手绘） ----------
  function drawRadar(ctx, w, h, scores) {
    const cx = w / 2, cy = h / 2 + 8, R = Math.min(w, h) / 2 - 46;
    const n = scores.length;
    ctx.clearRect(0, 0, w, h);
    // 网格（5 层）
    for (let level = 1; level <= 5; level++) {
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
        const r = R * level / 5;
        const x = cx + r * Math.cos(ang), y = cy + r * Math.sin(ang);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = level === 5 ? '#cbd5e1' : '#e2e8f0';
      ctx.lineWidth = level === 5 ? 1.5 : 1;
      ctx.stroke();
    }
    // 轴线 + 标签
    ctx.font = '13px "PingFang SC", sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < n; i++) {
      const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo(cx + R * Math.cos(ang), cy + R * Math.sin(ang));
      ctx.strokeStyle = '#e2e8f0'; ctx.stroke();
      const lx = cx + (R + 22) * Math.cos(ang), ly = cy + (R + 22) * Math.sin(ang);
      const label = scores[i].name;
      // 标签位置微调（避免遮挡）
      ctx.fillText(label, lx, ly);
      // 数值
      ctx.font = '11px sans-serif';
      const vx = cx + (R - 16) * Math.cos(ang) * (scores[i].score / 100), vy = cy + (R - 16) * Math.sin(ang) * (scores[i].score / 100);
      if (scores[i].played) { ctx.fillStyle = '#26a69a'; ctx.fillText(String(scores[i].score), vx, vy - 12); }
      ctx.font = '13px "PingFang SC", sans-serif';
      ctx.fillStyle = '#64748b';
    }
    // 数据多边形
    const hasPlayed = scores.some(s => s.played);
    if (hasPlayed) {
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
        const r = R * scores[i].score / 100;
        const x = cx + r * Math.cos(ang), y = cy + r * Math.sin(ang);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(38,166,154,.25)';
      ctx.fill();
      ctx.strokeStyle = '#26a69a';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      // 顶点
      for (let i = 0; i < n; i++) {
        const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
        const r = R * scores[i].score / 100;
        ctx.beginPath(); ctx.arc(cx + r * Math.cos(ang), cy + r * Math.sin(ang), 4, 0, Math.PI * 2);
        ctx.fillStyle = '#26a69a'; ctx.fill();
      }
    } else {
      ctx.font = '14px "PingFang SC", sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('还没有游戏记录', cx, cy);
    }
  }

  // ---------- 家长报告屏 ----------
  function showReport() {
    menuScreen.classList.remove('active');
    gameScreen.classList.remove('active');
    reportScreen.classList.add('active');
    renderReport();
  }
  function renderReport() {
    // 汇总统计
    const totalPlays = Object.values(stats).reduce((a, s) => a + s.plays, 0);
    let sumRate = 0, rateCount = 0;
    Object.keys(GAMES).forEach(g => { const r = statRate(g); if (r !== null) { sumRate += r; rateCount++; } });
    const avgRate = rateCount > 0 ? Math.round(sumRate / rateCount * 100) : 0;
    const sumTime = Object.values(stats).reduce((a, s) => a + s.totalTimeMs, 0);
    const totalMinutes = Math.round(sumTime / 60000 * 10) / 10;
    $('#reportTotalStars').textContent = totalStars();
    $('#reportSummary').innerHTML = `
      <div class="report-stat"><div class="num">${totalPlays}</div><div class="lbl">游玩次数</div></div>
      <div class="report-stat"><div class="num">${avgRate}%</div><div class="lbl">平均正确率</div></div>
      <div class="report-stat"><div class="num">${totalMinutes}</div><div class="lbl">累计时长(分钟)</div></div>
      <div class="report-stat"><div class="num">⭐ × ${totalStars()}</div><div class="lbl">获得星星</div></div>
    `;
    // 雷达图
    const scores = dimensionScores();
    const canvas = $('#radarCanvas');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = 360 * dpr; canvas.height = 300 * dpr;
    canvas.style.width = '360px'; canvas.style.height = '300px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    drawRadar(ctx, 360, 300, scores);
    $('#radarLegend').innerHTML = scores.map((s, i) => `<span><i style="background:#26a69a"></i>${s.name}</span>`).join('');
    // 游戏列表
    const rows = Object.keys(GAMES).map(g => {
      const s = stats[g];
      const rate = statRate(g);
      const avgT = statAvgTime(g);
      return { g, icon: { math: '🔢', count: '🐟', pinyin: '🔤', memory: '🧠', clock: '⏰', spot: '🔍', hanzi: '🀄', money: '💰', pattern: '🔢', season: '🍂', shadow: '🌓', shapes: '🔷', direction: '🧭', family: '👨‍👩‍👧', behavior: '✅' }[g], s, rate, avgT };
    });
    $('#reportList').innerHTML = rows.map(r => {
      if (!r.s || r.s.plays === 0) {
        return `<div class="report-row noplay"><span class="g-icon">${r.icon}</span><span class="g-name">${GAMES[r.g].name}</span><span class="g-time">未游玩</span></div>`;
      }
      const pct = Math.round(r.rate * 100);
      const timeStr = r.avgT < 60000 ? `${Math.round(r.avgT / 1000)}秒/局` : `${Math.round(r.avgT / 60000 * 10) / 10}分/局`;
      const starN = stars[r.g] || 0;
      return `<div class="report-row">
        <span class="g-icon">${r.icon}</span>
        <span class="g-name">${GAMES[r.g].name} <span style="color:#ffb300">${'★'.repeat(starN)}</span></span>
        <span class="g-bar"><i style="width:${pct}%"></i></span>
        <span class="g-rate">${pct}%</span>
        <span class="g-time">${timeStr} · ${r.s.plays}次</span>
      </div>`;
    }).join('');
  }

  // ---------- 屏幕切换 ----------
  let currentGame = null;
  let gameStartTime = 0;
  function showMenu() {
    gameScreen.classList.remove('active');
    reportScreen.classList.remove('active');
    menuScreen.classList.add('active');
    refreshStars();
  }
  function showGame(id) {
    currentGame = id;
    gameStartTime = Date.now();
    menuScreen.classList.remove('active');
    reportScreen.classList.remove('active');
    gameScreen.classList.add('active');
    gameTitle.textContent = GAMES[id].name + ' · ' + GAMES[id].desc;
    gameStars.textContent = stars[id] || 0;
    renderers[id]();
  }

  // ---------- 弹窗 ----------
  function showModal(emoji, title, text, starsCount = 0, onAgain) {
    modalEmoji.textContent = emoji;
    modalTitle.textContent = title;
    modalText.innerHTML = text;
    modal.classList.remove('hidden');
    const starLine = modal.querySelector('.modal-stars');
    if (starLine) starLine.remove();
    if (starsCount > 0) {
      const div = document.createElement('div');
      div.className = 'modal-stars';
      div.textContent = '⭐'.repeat(starsCount);
      modalText.before(div);
    }
    modalBtn.onclick = () => { modal.classList.add('hidden'); onAgain && onAgain(); };
    modalBackBtn.onclick = () => { modal.classList.add('hidden'); showMenu(); };
    sfx.win();
  }

  // ---------- 通用：10以内加减法 ----------
  function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /**
   * 答错统一处理：标红错误项 + 标绿正确答案 + 禁用点击 + 短暂停顿后自动进入下一题
   * @param {HTMLElement} wrongEl 用户点错的元素
   * @param {string|Function} correctSelector 正确答案选择器（CSS选择器字符串）或查找正确元素的函数
   * @param {Function} next 进入下一题的回调
   * @param {number} delay 停顿毫秒数（默认 1400）
   */
  function handleWrong(wrongEl, correctSelector, next, delay = 1400) {
    wrongEl.classList.add('wrong');
    sfx.wrong();
    // 标绿正确答案（支持选择器字符串或查找函数）
    let correctEl = null;
    if (typeof correctSelector === 'function') {
      correctEl = correctSelector();
    } else if (wrongEl.parentElement && wrongEl.closest('#gameArea')) {
      correctEl = wrongEl.closest('#gameArea').querySelector(correctSelector);
    }
    if (correctEl) {
      correctEl.classList.add('correct-highlight');
      correctEl.classList.add('disabled');
    }
    // 禁用所有可点击项，防止小孩继续点
    gameArea.querySelectorAll('.option-btn, .season-opt, .shape-opt, .hanzi-opt, .pattern-opt, .money-opt, .match-slot, .shadow-item, .count-check')
      .forEach(b => b.classList.add('disabled'));
    // 短暂停顿后自动跳下一题
    setTimeout(() => {
      wrongEl.classList.remove('wrong');
      if (correctEl) correctEl.classList.remove('correct-highlight');
      next();
    }, delay);
  }

  // ============================================================
  // 游戏1：口算小达人
  // ============================================================
  let math = { round: 0, total: 10, correct: 0 };

  function mathQuestion() {
    const add = Math.random() < 0.6;
    let a, b, op, ans;
    if (add) { a = randInt(0, 9); b = randInt(0, 9 - a); op = '+'; ans = a + b; }
    else { a = randInt(1, 9); b = randInt(1, a); op = '-'; ans = a - b; }
    return { a, b, op, ans };
  }

  function renderMath() {
    const q = mathQuestion();
    const opts = shuffle([q.ans, q.ans + randInt(1, 3), q.ans - randInt(1, 3)].filter((v, i, arr) => v >= 0 && arr.indexOf(v) === i)).slice(0, 3);
    if (!opts.includes(q.ans)) opts[randInt(0, opts.length - 1)] = q.ans;
    const optSet = shuffle(opts);
    gameArea.innerHTML = `
      <div class="game-hint">第 ${math.round + 1} / ${math.total} 题</div>
      <div class="game-hint" style="font-size:2.6rem;">${q.a} ${q.op} ${q.b} = ?</div>
      <div class="option-grid">${optSet.map(v => `<button class="option-btn" data-ans="${v}">${v}</button>`).join('')}</div>
    `;
    gameArea.querySelectorAll('.option-btn').forEach(btn => {
      btn.onclick = () => {
        sfx.click();
        const val = parseInt(btn.dataset.ans, 10);
        if (val === q.ans) {
          btn.classList.add('correct');
          math.correct++;
          sfx.correct();
          gameArea.querySelectorAll('.option-btn').forEach(b => b.classList.add('disabled'));
          setTimeout(() => {
            math.round++;
            if (math.round >= math.total) mathEnd();
            else renderMath();
          }, 600);
        } else {
          // 答错：标红 + 展示正确答案 + 自动跳下一题
          handleWrong(btn, `.option-btn[data-ans="${q.ans}"]`, () => {
            math.round++;
            if (math.round >= math.total) mathEnd();
            else renderMath();
          });
        }
      };
    });
  }

  function mathEnd() {
    const rate = math.correct / math.total;
    let s = 1;
    if (rate >= 0.9) s = 3; else if (rate >= 0.7) s = 2;
    addStar('math', s);
    recordGame('math', math.correct, math.total, Date.now() - gameStartTime);
    showModal(rate >= 0.9 ? '🏆' : rate >= 0.7 ? '🌟' : '💪',
      rate >= 0.9 ? '太棒了！' : rate >= 0.7 ? '不错哦！' : '继续加油！',
      `答对 ${math.correct} / ${math.total} 题`, s, () => { math.round = 0; math.correct = 0; renderMath(); });
  }

  // ============================================================
  // 游戏2：数一数
  // ============================================================
  let count = { round: 0, total: 5, correct: 0, fishCount: 0 };

  const FISH_EMOJI = ['🐟', '🐠', '🐡', '🦀', '🐙', '🐳', '🐬', '🦐'];

  function renderCount() {
    const n = randInt(3, 12);
    count.fishCount = n;
    const emoji = FISH_EMOJI[randInt(0, FISH_EMOJI.length - 1)];
    const fishArr = Array.from({ length: n }, (_, i) => i);
    gameArea.innerHTML = `
      <div class="game-hint">第 ${count.round + 1} / ${count.total} 题</div>
      <div class="game-hint">数一数，下面有几个 ${emoji}？</div>
      <div class="fish-pond">${fishArr.map((_, i) => `<div class="fish" data-idx="${i}">${emoji}</div>`).join('')}</div>
      <div class="count-input-row">
        <input type="number" class="count-input" min="0" max="20" placeholder="填数字">
        <button class="count-check">确认</button>
      </div>
    `;
    const input = gameArea.querySelector('.count-input');
    input.focus();
    gameArea.querySelectorAll('.fish').forEach(f => {
      f.onclick = () => f.classList.toggle('selected');
    });
    gameArea.querySelector('.count-check').onclick = () => {
      const val = parseInt(input.value, 10);
      if (isNaN(val)) {
        // 空输入：提示后也自动跳下一题，避免卡住
        sfx.wrong();
        input.style.borderColor = '#ef5350';
        input.disabled = true;
        const hint = document.createElement('div');
        hint.style.cssText = 'text-align:center;margin-top:8px;font-size:1.1rem;color:#2e7d32;font-weight:700;';
        hint.textContent = `正确答案是 ${count.fishCount} 个哦`;
        input.parentElement.appendChild(hint);
        setTimeout(() => {
          count.round++;
          if (count.round >= count.total) countEnd();
          else renderCount();
        }, 1400);
        return;
      }
      if (val === count.fishCount) {
        sfx.correct();
        gameArea.querySelectorAll('.fish').forEach(f => f.classList.add('answered'));
        input.disabled = true;
        count.correct++;
        setTimeout(() => {
          count.round++;
          if (count.round >= count.total) countEnd();
          else renderCount();
        }, 700);
      } else {
        // 答错：标红 + 提示正确数量 + 自动跳下一题
        sfx.wrong();
        input.style.borderColor = '#ef5350';
        input.disabled = true;
        // 正确数量高亮显示
        const hint = document.createElement('div');
        hint.style.cssText = 'text-align:center;margin-top:8px;font-size:1.1rem;color:#2e7d32;font-weight:700;';
        hint.textContent = `正确答案是 ${count.fishCount} 个哦`;
        input.parentElement.appendChild(hint);
        // 清空选中的小鱼，标绿正确数量
        gameArea.querySelectorAll('.fish').forEach(f => f.classList.remove('selected'));
        setTimeout(() => {
          count.round++;
          if (count.round >= count.total) countEnd();
          else renderCount();
        }, 1400);
      }
    };
  }

  function countEnd() {
    const rate = count.correct / count.total;
    let s = 1;
    if (rate >= 0.9) s = 3; else if (rate >= 0.7) s = 2;
    addStar('count', s);
    recordGame('count', count.correct, count.total, Date.now() - gameStartTime);
    showModal(rate >= 0.9 ? '🎉' : rate >= 0.7 ? '🌟' : '💪',
      rate >= 0.9 ? '数得真准！' : rate >= 0.7 ? '很棒！' : '再练练',
      `答对 ${count.correct} / ${count.total} 题`, s, () => { count.round = 0; count.correct = 0; renderCount(); });
  }

  // ============================================================
  // 游戏3：拼音大闯关
  // ============================================================
  let pinyin = { round: 0, total: 5, correct: 0, selLeft: null };

  const PINYIN_PAIRS = [
    { s: 'b', y: 'ā', w: 'bā', t: '八' },
    { s: 'm', y: 'ā', w: 'mā', t: '妈' },
    { s: 'd', y: 'à', w: 'dà', t: '大' },
    { s: 't', y: 'ù', w: 'tù', t: '兔' },
    { s: 'n', y: 'í', w: 'ní', t: '泥' },
    { s: 'l', y: 'í', w: 'lí', t: '梨' },
    { s: 'g', y: 'ē', w: 'gē', t: '哥' },
    { s: 'k', y: 'ǔ', w: 'kǔ', t: '苦' },
    { s: 'h', y: 'uā', w: 'huā', t: '花' },
    { s: 'j', y: 'ī', w: 'jī', t: '鸡' },
  ];

  function renderPinyin() {
    const shuffledPairs = shuffle(PINYIN_PAIRS);
    const pair = shuffledPairs[0];
    const pool = shuffle(shuffledPairs.slice(1, 5));
    pinyin.selLeft = null;
    const items = [pair, ...pool];
    const left = shuffle(items).map(p => p);
    const right = shuffle(items).map(p => p);
    gameArea.innerHTML = `
      <div class="game-hint">第 ${pinyin.round + 1} / ${pinyin.total} 题</div>
      <div class="game-hint">把声母和韵母拼起来，组成 <b>${pair.w}</b>（${pair.t}）</div>
      <div class="match-grid">
        <div class="match-col">
          <div class="match-col-label">声母</div>
          ${left.map((p, i) => `<div class="match-slot left" data-val="${p.s}" data-idx="${i}">${p.s}</div>`).join('')}
        </div>
        <div class="match-col">
          <div class="match-col-label">韵母</div>
          ${right.map((p, i) => `<div class="match-slot right" data-val="${p.y}" data-idx="${i}">${p.y}</div>`).join('')}
        </div>
      </div>
    `;
    const target = pair.s;
    gameArea.querySelectorAll('.match-slot.left').forEach(el => {
      el.onclick = () => {
        sfx.click();
        gameArea.querySelectorAll('.match-slot.left').forEach(x => x.classList.remove('selected'));
        el.classList.add('selected');
      };
    });
    gameArea.querySelectorAll('.match-slot.right').forEach(el => {
      el.onclick = () => {
        const selL = gameArea.querySelector('.match-slot.left.selected');
        if (!selL) { el.classList.add('wrong-flash'); setTimeout(() => el.classList.remove('wrong-flash'), 500); sfx.wrong(); return; }
        if (selL.dataset.val === target && el.dataset.val === pair.y) {
          // 正确配对
          selL.classList.remove('selected');
          selL.classList.add('matched');
          el.classList.add('matched');
          const badge = document.createElement('span');
          badge.className = 'badge';
          badge.textContent = '✓';
          el.appendChild(badge);
          sfx.correct();
          pinyin.correct++;
          setTimeout(() => {
            pinyin.round++;
            if (pinyin.round >= pinyin.total) pinyinEnd();
            else renderPinyin();
          }, 700);
        } else {
          // 答错：标绿正确组合 + 自动跳下一题
          el.classList.add('wrong-flash');
          selL.classList.remove('selected');
          // 高亮正确的声母和韵母
          gameArea.querySelectorAll('.match-slot.left').forEach(x => {
            if (x.dataset.val === target) x.classList.add('matched-highlight');
          });
          gameArea.querySelectorAll('.match-slot.right').forEach(x => {
            if (x.dataset.val === pair.y) x.classList.add('matched-highlight');
          });
          gameArea.querySelectorAll('.match-slot').forEach(x => x.style.pointerEvents = 'none');
          sfx.wrong();
          setTimeout(() => {
            pinyin.round++;
            if (pinyin.round >= pinyin.total) pinyinEnd();
            else renderPinyin();
          }, 1500);
        }
      };
    });
  }

  function pinyinEnd() {
    const rate = pinyin.correct / pinyin.total;
    let s = 1;
    if (rate >= 0.9) s = 3; else if (rate >= 0.7) s = 2;
    addStar('pinyin', s);
    recordGame('pinyin', pinyin.correct, pinyin.total, Date.now() - gameStartTime);
    showModal(rate >= 0.9 ? '🎓' : rate >= 0.7 ? '🌟' : '💪',
      rate >= 0.9 ? '拼音小天才！' : rate >= 0.7 ? '很棒！' : '再试试',
      `拼对 ${pinyin.correct} / ${pinyin.total} 组`, s, () => { pinyin.round = 0; pinyin.correct = 0; renderPinyin(); });
  }

  // ============================================================
  // 游戏4：记忆翻牌
  // ============================================================
  let memory = { cards: [], flipped: [], matchedCount: 0, moves: 0, lock: false };

  const MEM_ITEMS = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼'];
  // 3 星级：完成 4 对（8张卡）

  function initMemory() {
    const chosen = shuffle(MEM_ITEMS).slice(0, 4);
    memory.cards = shuffle([...chosen, ...chosen]).map((emoji, i) => ({ emoji, id: i }));
    memory.flipped = [];
    memory.matchedCount = 0;
    memory.moves = 0;
    memory.lock = false;
  }

  function renderMemory() {
    initMemory();
    gameArea.innerHTML = `
      <div class="game-hint">找出相同的两张卡片 👀 <span id="memMoves">步数：0</span></div>
      <div class="memory-grid">
        ${memory.cards.map((c, i) => `
          <div class="mem-card" data-idx="${i}">
            <div class="mem-inner">
              <div class="mem-face mem-back">❓</div>
              <div class="mem-face mem-front">${c.emoji}</div>
            </div>
          </div>`).join('')}
      </div>
    `;
    gameArea.querySelectorAll('.mem-card').forEach(card => {
      card.onclick = () => {
        if (memory.lock) return;
        const idx = parseInt(card.dataset.idx, 10);
        if (card.classList.contains('flipped') || card.classList.contains('matched')) return;
        sfx.click();
        card.classList.add('flipped');
        memory.flipped.push(idx);
        if (memory.flipped.length === 2) {
          memory.moves++;
          $('#memMoves').textContent = `步数：${memory.moves}`;
          const [i1, i2] = memory.flipped;
          memory.lock = true;
          if (memory.cards[i1].emoji === memory.cards[i2].emoji) {
            setTimeout(() => {
              const c1 = gameArea.querySelector(`.mem-card[data-idx="${i1}"]`);
              const c2 = gameArea.querySelector(`.mem-card[data-idx="${i2}"]`);
              c1.classList.add('matched');
              c2.classList.add('matched');
              memory.matchedCount++;
              memory.flipped = [];
              memory.lock = false;
              sfx.correct();
              if (memory.matchedCount === 4) memoryEnd();
            }, 500);
          } else {
            setTimeout(() => {
              gameArea.querySelector(`.mem-card[data-idx="${i1}"]`).classList.remove('flipped');
              gameArea.querySelector(`.mem-card[data-idx="${i2}"]`).classList.remove('flipped');
              memory.flipped = [];
              memory.lock = false;
              sfx.wrong();
            }, 800);
          }
        }
      };
    });
  }

  function memoryEnd() {
    let s = 1;
    if (memory.moves <= 5) s = 3; else if (memory.moves <= 8) s = 2;
    addStar('memory', s);
    // 记忆翻牌用「配对完成」计正确（4对），用时反映熟练度
    recordGame('memory', 4, 4, Date.now() - gameStartTime);
    showModal('🧠', '记忆大师！', `用了 ${memory.moves} 步完成配对`, s, () => renderMemory());
  }

  // ============================================================
  // 游戏5：认识钟表
  // ============================================================
  let clock = { round: 0, total: 6, correct: 0, hour: 0, minute: 0 };

  const CLOCK_OPTIONS = [
    [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0],
    [6, 0], [7, 0], [8, 0], [9, 0], [10, 0], [11, 0],
    [1, 30], [2, 30], [3, 30], [4, 30], [5, 30], [6, 30], [7, 30], [8, 30], [9, 30], [10, 30], [11, 30],
    [0, 30], [12, 15], [3, 15], [6, 15], [9, 15], [12, 45], [3, 45], [6, 45], [9, 45],
  ];

  function clockTimeText(h, m) {
    const hh = h % 12 === 0 ? 12 : h % 12;
    if (m === 0) return `${hh}点整`;
    if (m === 30) return `${hh}点半`;
    if (m === 15) return `${hh}点15分`;
    if (m === 45) return `${hh}点45分`;
    return `${hh}点${m}分`;
  }

  function clockSvg(h, m) {
    const cx = 120, cy = 120;
    const hourAngle = ((h % 12) * 30 + m * 0.5 - 90) * Math.PI / 180;
    const minAngle = (m * 6 - 90) * Math.PI / 180;
    const hx = cx + 52 * Math.cos(hourAngle), hy = cy + 52 * Math.sin(hourAngle);
    const mx = cx + 72 * Math.cos(minAngle), my = cy + 72 * Math.sin(minAngle);
    let ticks = '';
    for (let i = 0; i < 60; i++) {
      const major = i % 5 === 0;
      const ang = i * 6 * Math.PI / 180;
      const r1 = major ? 100 : 106, r2 = major ? 112 : 110;
      ticks += `<line class="${major ? 'clock-tick major' : 'clock-tick'}" x1="${cx + r1 * Math.cos(ang)}" y1="${cy + r1 * Math.sin(ang)}" x2="${cx + r2 * Math.cos(ang)}" y2="${cy + r2 * Math.sin(ang)}"/>`;
    }
    return `<svg class="clock-svg" viewBox="0 0 240 240">
      <circle class="clock-face" cx="${cx}" cy="${cy}" r="110"/>
      ${ticks}
      <line class="clock-hand-h" x1="${cx}" y1="${cy}" x2="${hx}" y2="${hy}"/>
      <line class="clock-hand-m" x1="${cx}" y1="${cy}" x2="${mx}" y2="${my}"/>
      <circle class="clock-center" cx="${cx}" cy="${cy}" r="8"/>
    </svg>`;
  }

  function renderClock() {
    // 选一个目标时间 + 3 个干扰时间
    const target = CLOCK_OPTIONS[randInt(0, CLOCK_OPTIONS.length - 1)];
    clock.hour = target[0]; clock.minute = target[1];
    const others = shuffle(CLOCK_OPTIONS.filter(([h, m]) => !(h === target[0] && m === target[1]))).slice(0, 3);
    const options = shuffle([target, ...others]);
    gameArea.innerHTML = `
      <div class="game-hint">第 ${clock.round + 1} / ${clock.total} 题</div>
      <div class="game-hint">⏰ 钟表显示几点？</div>
      <div class="clock-wrap">${clockSvg(clock.hour, clock.minute)}</div>
      <div class="option-grid">
        ${options.map(([h, m]) => `<button class="option-btn" data-h="${h}" data-m="${m}">${clockTimeText(h, m)}</button>`).join('')}
      </div>
    `;
    gameArea.querySelectorAll('.option-btn').forEach(btn => {
      btn.onclick = () => {
        sfx.click();
        const h = parseInt(btn.dataset.h, 10), m = parseInt(btn.dataset.m, 10);
        if (h === clock.hour && m === clock.minute) {
          btn.classList.add('correct');
          clock.correct++;
          sfx.correct();
          gameArea.querySelectorAll('.option-btn').forEach(b => b.classList.add('disabled'));
          setTimeout(() => {
            clock.round++;
            if (clock.round >= clock.total) clockEnd();
            else renderClock();
          }, 600);
        } else {
          // 答错：标红 + 展示正确答案 + 自动跳下一题
          handleWrong(btn, `.option-btn[data-h="${clock.hour}"][data-m="${clock.minute}"]`, () => {
            clock.round++;
            if (clock.round >= clock.total) clockEnd();
            else renderClock();
          });
        }
      };
    });
  }

  function clockEnd() {
    const rate = clock.correct / clock.total;
    let s = 1;
    if (rate >= 0.9) s = 3; else if (rate >= 0.7) s = 2;
    addStar('clock', s);
    recordGame('clock', clock.correct, clock.total, Date.now() - gameStartTime);
    showModal(rate >= 0.9 ? '⏰' : rate >= 0.7 ? '🌟' : '💪',
      rate >= 0.9 ? '时间小专家！' : rate >= 0.7 ? '很棒！' : '再看看表',
      `答对 ${clock.correct} / ${clock.total} 题`, s, () => { clock.round = 0; clock.correct = 0; renderClock(); });
  }

  // ============================================================
  // 游戏6：找不同（Canvas 绘制两幅场景图，找 N 处差异）
  // ============================================================
  let spot = { round: 0, total: 3, correct: 0, diffs: [], found: 0, totalDiff: 3, current: null };

  // 每个场景：模块化绘制函数，differences 是 [dx, dy, kind] 的数组
  const SPOT_SCENES = [
    { // 池塘（本回合用）
      name: '池塘',
      diffCount: 3,
    },
  ];

  function spotDraw(ctx, W, H, diffs = [], isFind = false) {
    // 背景天空
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#b3e5fc'); g.addColorStop(1, '#e1f5fe');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 草地
    ctx.fillStyle = '#a5d6a7'; ctx.fillRect(0, H * 0.72, W, H * 0.28);
    // 太阳
    ctx.fillStyle = '#ffd54f'; ctx.beginPath(); ctx.arc(W * 0.85, H * 0.15, 22, 0, Math.PI * 2); ctx.fill();
    // 云
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.beginPath(); ctx.arc(W * 0.2, H * 0.18, 16, 0, Math.PI * 2); ctx.arc(W * 0.26, H * 0.13, 12, 0, Math.PI * 2); ctx.arc(W * 0.32, H * 0.18, 14, 0, Math.PI * 2); ctx.fill();
    // 树
    ctx.fillStyle = '#8d6e63'; ctx.fillRect(W * 0.12, H * 0.5, 14, H * 0.22);
    ctx.fillStyle = '#66bb6a'; ctx.beginPath(); ctx.arc(W * 0.19, H * 0.45, 26, 0, Math.PI * 2); ctx.fill();
    // 房子
    ctx.fillStyle = '#ef9a9a'; ctx.fillRect(W * 0.68, H * 0.42, 60, 44);
    ctx.fillStyle = '#d32f2f'; ctx.beginPath(); ctx.moveTo(W * 0.64, H * 0.42); ctx.lineTo(W * 0.98, H * 0.42); ctx.lineTo(W * 0.81, H * 0.28); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#81d4fa'; ctx.fillRect(W * 0.78, H * 0.5, 18, 16);
    // 花
    for (let i = 0; i < 5; i++) {
      const fx = W * (0.3 + i * 0.09), fy = H * 0.78;
      ctx.fillStyle = ['#f48fb1', '#ffb74d', '#ba68c8', '#ff8a65', '#ffd54f'][i];
      ctx.beginPath(); ctx.arc(fx, fy, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffeb3b'; ctx.beginPath(); ctx.arc(fx, fy, 3, 0, Math.PI * 2); ctx.fill();
    }
    // 差异点绘制
    if (isFind) {
      diffs.forEach(([dx, dy, kind]) => {
        if (kind === 'sun') { ctx.fillStyle = '#ff7043'; ctx.beginPath(); ctx.arc(dx, dy, 10, 0, Math.PI * 2); ctx.fill(); }
        else if (kind === 'flower') { ctx.fillStyle = '#00e5ff'; ctx.beginPath(); ctx.arc(dx, dy, 7, 0, Math.PI * 2); ctx.fill(); }
        else if (kind === 'tree') { ctx.fillStyle = '#7e57c2'; ctx.beginPath(); ctx.arc(dx, dy, 12, 0, Math.PI * 2); ctx.fill(); }
        else if (kind === 'window') { ctx.fillStyle = '#000'; ctx.fillRect(dx - 9, dy - 12, 18, 24); }
        else if (kind === 'bird') { ctx.fillStyle = '#37474f'; ctx.beginPath(); ctx.arc(dx, dy, 6, 0, Math.PI * 2); ctx.fill(); }
      });
    }
  }

  function spotSceneDiffs(W, H) {
    return [
      [Math.round(W * 0.85), Math.round(H * 0.15), 'sun'],
      [Math.round(W * 0.5), Math.round(H * 0.55), 'tree'],
      [Math.round(W * 0.78), Math.round(H * 0.58), 'window'],
    ];
  }

  function renderSpot() {
    const W = 340, H = 240;
    const diffs = spotSceneDiffs(W, H);
    spot.diffs = diffs;
    spot.found = 0;
    spot.missCount = 0;
    spot.totalDiff = diffs.length;
    spot.current = { W, H, diffs };
    gameArea.innerHTML = `
      <div class="game-hint">第 ${spot.round + 1} / ${spot.total} 题 · 找出 ${diffs.length} 处不同</div>
      <div class="game-hint">🔍 点击右图中不一样的地方（已找到 <span id="spotFound">0</span> / ${diffs.length}）</div>
      <div class="spot-scene">
        <div class="spot-panel">
          <div class="spot-label">原图</div>
          <canvas class="spot-canvas" id="spotA" width="${W}" height="${H}"></canvas>
        </div>
        <div class="spot-panel">
          <div class="spot-label">找不同</div>
          <canvas class="spot-canvas selected" id="spotB" width="${W}" height="${H}"></canvas>
        </div>
      </div>
    `;
    const ctxA = $('#spotA').getContext('2d');
    const ctxB = $('#spotB').getContext('2d');
    spotDraw(ctxA, W, H, [], false);
    spotDraw(ctxB, W, H, diffs, true);
    // 点击找不同画布
    $('#spotB').addEventListener('click', (e) => {
      const rect = e.target.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (W / rect.width);
      const y = (e.clientY - rect.top) * (H / rect.height);
      // 找最近的差异点
      let best = null, bestDist = 40;
      for (let i = 0; i < spot.diffs.length; i++) {
        const [dx, dy] = spot.diffs[i];
        const d = Math.hypot(x - dx, y - dy);
        if (d < bestDist) { bestDist = d; best = i; }
      }
      if (best !== null) {
        const [dx, dy] = spot.diffs[best];
        // 标记已找到
        const panel = e.target.parentElement;
        const bubble = document.createElement('div');
        bubble.className = 'spot-bubble';
        bubble.textContent = '✓';
        bubble.style.left = (dx / W * rect.width - 13) + 'px';
        bubble.style.top = (dy / H * rect.height - 13) + 'px';
        panel.appendChild(bubble);
        spot.diffs.splice(best, 1);
        spot.found++;
        $('#spotFound').textContent = spot.found;
        sfx.correct();
        if (spot.found >= spot.totalDiff) {
          setTimeout(() => {
            spot.correct++;
            spot.round++;
            if (spot.round >= spot.total) spotEnd();
            else renderSpot();
          }, 700);
        }
      } else {
        // 点错位置：累计，连续错 5 次自动展示答案并跳题
        spot.missCount = (spot.missCount || 0) + 1;
        sfx.wrong();
        e.target.style.borderColor = '#ef5350';
        setTimeout(() => e.target.style.borderColor = '', 400);
        if (spot.missCount >= 5) {
          // 自动展示所有剩余差异点
          const panel = e.target.parentElement;
          const rect = e.target.getBoundingClientRect();
          spot.diffs.forEach(([dx, dy]) => {
            const bubble = document.createElement('div');
            bubble.className = 'spot-bubble';
            bubble.textContent = '✓';
            bubble.style.left = (dx / W * rect.width - 13) + 'px';
            bubble.style.top = (dy / H * rect.height - 13) + 'px';
            panel.appendChild(bubble);
          });
          e.target.style.pointerEvents = 'none';
          setTimeout(() => {
            spot.round++;
            if (spot.round >= spot.total) spotEnd();
            else renderSpot();
          }, 1500);
        }
      }
    });
  }

  function spotEnd() {
    const rate = spot.correct / spot.total;
    let s = 1;
    if (rate >= 0.9) s = 3; else if (rate >= 0.7) s = 2;
    addStar('spot', s);
    recordGame('spot', spot.correct, spot.total, Date.now() - gameStartTime);
    showModal(rate >= 0.9 ? '🔍' : rate >= 0.7 ? '🌟' : '💪',
      rate >= 0.9 ? '火眼金睛！' : rate >= 0.7 ? '真细心！' : '再找找看',
      `找对 ${spot.correct} / ${spot.total} 幅图`, s, () => { spot.round = 0; spot.correct = 0; renderSpot(); });
  }

  // ============================================================
  // 游戏7：汉字启蒙（象形图 → 选汉字）
  // ============================================================
  let hanzi = { round: 0, total: 5, correct: 0 };

  const HANZI_DATA = [
    { char: '日', pic: '🌞', hint: '圆圆的太阳' },
    { char: '月', pic: '🌙', hint: '弯弯的月亮' },
    { char: '山', pic: '⛰️', hint: '高高的山峰' },
    { char: '水', pic: '💧', hint: '流动的水' },
    { char: '火', pic: '🔥', hint: '燃烧的火苗' },
    { char: '木', pic: '🌳', hint: '一棵大树' },
    { char: '田', pic: '🌾', hint: '一块田地' },
    { char: '口', pic: '👄', hint: '张开的小嘴' },
    { char: '目', pic: '👁️', hint: '一只眼睛' },
    { char: '人', pic: '🚶', hint: '直立行走的人' },
    { char: '鸟', pic: '🐦', hint: '飞翔的小鸟' },
    { char: '鱼', pic: '🐟', hint: '游动的小鱼' },
  ];

  function renderHanzi() {
    const target = HANZI_DATA[randInt(0, HANZI_DATA.length - 1)];
    const others = shuffle(HANZI_DATA.filter(d => d.char !== target.char)).slice(0, 3);
    const options = shuffle([target, ...others]);
    gameArea.innerHTML = `
      <div class="game-hint">第 ${hanzi.round + 1} / ${hanzi.total} 题</div>
      <div class="hanzi-quiz">
        <div class="hanzi-pic">${target.pic}</div>
        <div class="game-hint">这是「${target.hint}」，它对应哪个汉字？</div>
        <div class="hanzi-options">
          ${options.map(d => `<button class="hanzi-opt" data-char="${d.char}"><span class="hz">${d.char}</span>${d.hint}</button>`).join('')}
        </div>
      </div>
    `;
    gameArea.querySelectorAll('.hanzi-opt').forEach(btn => {
      btn.onclick = () => {
        sfx.click();
        if (btn.dataset.char === target.char) {
          btn.classList.add('correct');
          hanzi.correct++;
          sfx.correct();
          gameArea.querySelectorAll('.hanzi-opt').forEach(b => b.classList.add('disabled'));
          setTimeout(() => {
            hanzi.round++;
            if (hanzi.round >= hanzi.total) hanziEnd();
            else renderHanzi();
          }, 700);
        } else {
          // 答错：标红 + 展示正确答案 + 自动跳下一题
          handleWrong(btn, `.hanzi-opt[data-char="${target.char}"]`, () => {
            hanzi.round++;
            if (hanzi.round >= hanzi.total) hanziEnd();
            else renderHanzi();
          });
        }
      };
    });
  }

  function hanziEnd() {
    const rate = hanzi.correct / hanzi.total;
    let s = 1;
    if (rate >= 0.9) s = 3; else if (rate >= 0.7) s = 2;
    addStar('hanzi', s);
    recordGame('hanzi', hanzi.correct, hanzi.total, Date.now() - gameStartTime);
    showModal(rate >= 0.9 ? '🏮' : rate >= 0.7 ? '🌟' : '💪',
      rate >= 0.9 ? '识字小状元！' : rate >= 0.7 ? '很棒！' : '多认认',
      `认对 ${hanzi.correct} / ${hanzi.total} 个字`, s, () => { hanzi.round = 0; hanzi.correct = 0; renderHanzi(); });
  }

  // ============================================================
  // 游戏8：认识人民币
  // ============================================================
  let money = { round: 0, total: 6, correct: 0 };

  const MONEY_DENOMS = [
    { icon: '🪙', name: '1角', val: 1 },
    { icon: '🪙', name: '5角', val: 5 },
    { icon: '🪙', name: '1元', val: 10 },
    { icon: '💵', name: '5元', val: 50 },
    { icon: '💵', name: '10元', val: 100 },
    { icon: '💵', name: '20元', val: 200 },
    { icon: '💵', name: '50元', val: 500 },
    { icon: '💵', name: '100元', val: 1000 },
  ];

  // 组合题：比如 "1元 + 5角 = ?" 答案格式（元, 角）
  function renderMoney() {
    // 生成组合题：两张钱币相加
    const type = randInt(0, 2);
    let question = '', answerText = '', options = [];

    if (type === 0) {
      // 同单位相加：x元 + y元
      const a = MONEY_DENOMS.filter(d => d.val >= 50 && d.name.endsWith('元'));
      const b = a[randInt(0, a.length - 1)];
      const c = a[randInt(0, a.length - 1)];
      const sum = b.val + c.val;
      answerText = (sum / 10) + '元';
      question = `${b.icon} ${b.name} + ${c.icon} ${c.name} = ?`;
      // 干扰项
      const wrongs = new Set();
      wrongs.add((sum / 10) + '元');
      while (wrongs.size < 4) {
        const off = [10, 20, 50, 100, 200][randInt(0, 4)];
        const w = sum + (Math.random() < 0.5 ? -off : off);
        if (w > 0) wrongs.add((w / 10) + '元');
      }
      options = shuffle([...wrongs]);
    } else if (type === 1) {
      // 元+角：x元 + y角
      const a = MONEY_DENOMS.filter(d => d.name.endsWith('元') && d.val >= 50);
      const c = MONEY_DENOMS.filter(d => d.name === '1角' || d.name === '5角');
      const yuan = a[randInt(0, a.length - 1)];
      const jiao = c[randInt(0, c.length - 1)];
      const sumVal = yuan.val + jiao.val;
      const yuanPart = Math.floor(sumVal / 10), jiaoPart = sumVal % 10;
      answerText = jiaoPart === 0 ? yuanPart + '元' : yuanPart + '元' + jiaoPart + '角';
      question = `${yuan.icon} ${yuan.name} + ${jiao.icon} ${jiao.name} = ?`;
      const wrongs = new Set();
      wrongs.add(answerText);
      while (wrongs.size < 4) {
        const alt = (yuanPart + (Math.random() < 0.5 ? 1 : -1)) + '元' + ((jiaoPart + 5) % 10 || '') + '角';
        if (alt !== answerText) wrongs.add(alt);
      }
      options = shuffle([...wrongs]);
    } else {
      // 换成零钱：5元 = ?个1元
      const a = MONEY_DENOMS.filter(d => d.name.endsWith('元') && d.val >= 50);
      const big = a[randInt(0, a.length - 1)];
      const small = MONEY_DENOMS.filter(d => d.name === '1元' || d.name === '5角' || d.name === '1角');
      const s = small[randInt(0, small.length - 1)];
      const count = big.val / s.val;
      answerText = count + '个' + s.name;
      question = `${big.icon} ${big.name} = ?（换成${s.name}）`;
      const wrongs = new Set();
      wrongs.add(answerText);
      while (wrongs.size < 4) {
        const w = count + (Math.random() < 0.5 ? 1 : -1) * randInt(1, 3);
        if (w >= 1 && w !== count) wrongs.add(w + '个' + s.name);
      }
      options = shuffle([...wrongs]);
    }

    gameArea.innerHTML = `
      <div class="game-hint">第 ${money.round + 1} / ${money.total} 题</div>
      <div class="money-display"><div class="money-question">${question}</div></div>
      <div class="money-options">
        ${options.map(v => `<button class="money-opt" data-ans="${v}">${v}</button>`).join('')}
      </div>
    `;
    gameArea.querySelectorAll('.money-opt').forEach(btn => {
      btn.onclick = () => {
        sfx.click();
        if (btn.dataset.ans === answerText) {
          btn.classList.add('correct');
          money.correct++;
          sfx.correct();
          gameArea.querySelectorAll('.money-opt').forEach(b => b.classList.add('disabled'));
          setTimeout(() => {
            money.round++;
            if (money.round >= money.total) moneyEnd();
            else renderMoney();
          }, 700);
        } else {
          // 答错：标红 + 展示正确答案 + 自动跳下一题
          handleWrong(btn, () => [...gameArea.querySelectorAll('.money-opt')].find(b => b.dataset.ans === answerText) || null, () => {
            money.round++;
            if (money.round >= money.total) moneyEnd();
            else renderMoney();
          });
        }
      };
    });
  }

  function moneyEnd() {
    const rate = money.correct / money.total;
    let s = 1;
    if (rate >= 0.9) s = 3; else if (rate >= 0.7) s = 2;
    addStar('money', s);
    recordGame('money', money.correct, money.total, Date.now() - gameStartTime);
    showModal(rate >= 0.9 ? '💰' : rate >= 0.7 ? '🌟' : '💪',
      rate >= 0.9 ? '理财小能手！' : rate >= 0.7 ? '很棒！' : '再算算',
      `答对 ${money.correct} / ${money.total} 题`, s, () => { money.round = 0; money.correct = 0; renderMoney(); });
  }

  // ============================================================
  // 游戏9：找规律
  // ============================================================
  let pattern = { round: 0, total: 6, correct: 0 };

  const PATTERN_SHAPES = ['🔴', '🟡', '🔵', '🟢', '🟣', '🟠'];
  const PATTERN_NUMS = [2, 3, 4, 5, 6, 7, 8, 9];

  function renderPattern() {
    const kind = randInt(0, 1); // 0: 数字规律, 1: 图形规律
    let seq = [], answer = '', question = '';

    if (kind === 0) {
      // 数字规律：等差 / 递增
      const step = [2, 3, 5, 10][randInt(0, 3)];
      const start = [1, 2, 3, 4, 5, 10][randInt(0, 5)];
      seq = [];
      for (let i = 0; i < 4; i++) seq.push(start + i * step);
      answer = seq[3] + step;
      seq.push(null);
      question = '找出数字后面的规律，填上问号';
    } else {
      // 图形规律：ABAB 循环
      const a = PATTERN_SHAPES[randInt(0, PATTERN_SHAPES.length - 1)];
      let b = PATTERN_SHAPES[randInt(0, PATTERN_SHAPES.length - 1)];
      while (b === a) b = PATTERN_SHAPES[randInt(0, PATTERN_SHAPES.length - 1)];
      seq = [a, b, a, b, a, null];
      answer = b;
      question = '找出图形的规律，填上问号';
    }

    const wrongs = new Set();
    wrongs.add(answer);
    while (wrongs.size < 4) {
      if (kind === 0) {
        wrongs.add(answer + randInt(1, 5) * (Math.random() < 0.5 ? 1 : -1));
      } else {
        wrongs.add(PATTERN_SHAPES[randInt(0, PATTERN_SHAPES.length - 1)]);
      }
    }
    const options = shuffle([...wrongs]);

    gameArea.innerHTML = `
      <div class="game-hint">第 ${pattern.round + 1} / ${pattern.total} 题</div>
      <div class="game-hint">${question}</div>
      <div class="pattern-seq">
        ${seq.map((v, i) => {
          const isBlank = v === null;
          const isEmoji = typeof v === 'string';
          return `<div class="pattern-item ${isBlank ? 'blank' : ''} ${isEmoji && !isBlank ? 'emoji-item' : ''}">${isBlank ? '?' : v}</div>`;
        }).join('')}
      </div>
      <div class="pattern-options">
        ${options.map(v => `<button class="pattern-opt" data-ans="${v}">${v}</button>`).join('')}
      </div>
    `;
    gameArea.querySelectorAll('.pattern-opt').forEach(btn => {
      btn.onclick = () => {
        sfx.click();
        if (btn.dataset.ans === String(answer)) {
          btn.classList.add('correct');
          pattern.correct++;
          sfx.correct();
          gameArea.querySelectorAll('.pattern-opt').forEach(b => b.classList.add('disabled'));
          setTimeout(() => {
            pattern.round++;
            if (pattern.round >= pattern.total) patternEnd();
            else renderPattern();
          }, 700);
        } else {
          // 答错：标红 + 展示正确答案 + 自动跳下一题
          handleWrong(btn, () => [...gameArea.querySelectorAll('.pattern-opt')].find(b => b.dataset.ans === String(answer)) || null, () => {
            pattern.round++;
            if (pattern.round >= pattern.total) patternEnd();
            else renderPattern();
          });
        }
      };
    });
  }

  function patternEnd() {
    const rate = pattern.correct / pattern.total;
    let s = 1;
    if (rate >= 0.9) s = 3; else if (rate >= 0.7) s = 2;
    addStar('pattern', s);
    recordGame('pattern', pattern.correct, pattern.total, Date.now() - gameStartTime);
    showModal(rate >= 0.9 ? '🔍' : rate >= 0.7 ? '🌟' : '💪',
      rate >= 0.9 ? '推理小博士！' : rate >= 0.7 ? '很不错！' : '再观察观察',
      `答对 ${pattern.correct} / ${pattern.total} 题`, s, () => { pattern.round = 0; pattern.correct = 0; renderPattern(); });
  }

  // ============================================================
  // 游戏10：认识四季
  // ============================================================
  let season = { round: 0, total: 6, correct: 0 };

  const SEASON_DATA = [
    { icon: '🌸', name: '春天', desc: '花儿开了，小草绿了' },
    { icon: '☀️', name: '夏天', desc: '太阳火辣辣，可以吃冰淇淋' },
    { icon: '🍂', name: '秋天', desc: '树叶变黄了，果实成熟了' },
    { icon: '❄️', name: '冬天', desc: '雪花飘飘，可以堆雪人' },
  ];

  function renderSeason() {
    // 随机四季中的一个作为题目，选项固定为4个季节
    const target = SEASON_DATA[randInt(0, SEASON_DATA.length - 1)];
    const options = shuffle(SEASON_DATA.map(d => ({ ...d })));
    gameArea.innerHTML = `
      <div class="game-hint">第 ${season.round + 1} / ${season.total} 题</div>
      <div class="season-quiz">
        <span class="season-big">${target.icon}</span>
        <div class="game-hint">「${target.desc}」，这是哪个季节？</div>
        <div class="season-options">
          ${options.map(d => `<button class="season-opt" data-name="${d.name}"><span class="se-icon">${d.icon}</span><span class="se-name">${d.name}</span></button>`).join('')}
        </div>
      </div>
    `;
    gameArea.querySelectorAll('.season-opt').forEach(btn => {
      btn.onclick = () => {
        sfx.click();
        if (btn.dataset.name === target.name) {
          btn.classList.add('correct');
          season.correct++;
          sfx.correct();
          gameArea.querySelectorAll('.season-opt').forEach(b => b.classList.add('disabled'));
          setTimeout(() => {
            season.round++;
            if (season.round >= season.total) seasonEnd();
            else renderSeason();
          }, 700);
        } else {
          // 答错：标红 + 展示正确答案 + 自动跳下一题
          handleWrong(btn, () => [...gameArea.querySelectorAll('.season-opt')].find(b => b.dataset.name === target.name) || null, () => {
            season.round++;
            if (season.round >= season.total) seasonEnd();
            else renderSeason();
          });
        }
      };
    });
  }

  function seasonEnd() {
    const rate = season.correct / season.total;
    let s = 1;
    if (rate >= 0.9) s = 3; else if (rate >= 0.7) s = 2;
    addStar('season', s);
    recordGame('season', season.correct, season.total, Date.now() - gameStartTime);
    showModal(rate >= 0.9 ? '🍂' : rate >= 0.7 ? '🌟' : '💪',
      rate >= 0.9 ? '四季小达人！' : rate >= 0.7 ? '很棒！' : '再看看',
      `答对 ${season.correct} / ${season.total} 题`, s, () => { season.round = 0; season.correct = 0; renderSeason(); });
  }

  // ============================================================
  // 游戏11：找影子（实物 → 影子配对）
  // ============================================================
  let shadow = { round: 0, total: 4, correct: 0, current: null };

  const SHADOW_ITEMS = [
    { obj: '🐱', shadowChar: '🐈‍⬛', name: '小猫' },
    { obj: '🐶', shadowChar: '🐕', name: '小狗' },
    { obj: '🐰', shadowChar: '🐇', name: '兔子' },
    { obj: '🦆', shadowChar: '🦆', name: '鸭子' },
    { obj: '🐦', shadowChar: '🐦', name: '小鸟' },
    { obj: '🐘', shadowChar: '🐘', name: '大象' },
    { obj: '🌳', shadowChar: '🌳', name: '大树' },
    { obj: '🚗', shadowChar: '🚗', name: '小汽车' },
  ];

  function renderShadow() {
    // 抽取4个物品：左侧实物（乱序），右侧影子（乱序）
    const items = shuffle(SHADOW_ITEMS).slice(0, 4);
    const left = shuffle(items.map(d => ({ ...d })));
    const right = shuffle(items.map(d => ({ ...d })));
    shadow.current = { items };
    let matched = 0;

    gameArea.innerHTML = `
      <div class="game-hint">第 ${shadow.round + 1} / ${shadow.total} 题</div>
      <div class="game-hint">把左边的物品和它的影子连起来（先点物品，再点影子）</div>
      <div class="shadow-grid">
        <div class="shadow-col">
          <div class="shadow-col-label">物品</div>
          ${left.map((d, i) => `<div class="shadow-item obj" data-name="${d.name}" data-idx="${i}">${d.obj}</div>`).join('')}
        </div>
        <div class="shadow-col">
          <div class="shadow-col-label">影子</div>
          ${right.map((d, i) => `<div class="shadow-item shadow" data-name="${d.name}" data-idx="${i}">${d.shadowChar}</div>`).join('')}
        </div>
      </div>
    `;

    const objEls = gameArea.querySelectorAll('.shadow-item.obj');
    const shdEls = gameArea.querySelectorAll('.shadow-item.shadow');

    objEls.forEach(el => {
      el.onclick = () => {
        sfx.click();
        objEls.forEach(x => x.classList.remove('selected'));
        el.classList.add('selected');
      };
    });

    shdEls.forEach(el => {
      el.onclick = () => {
        const sel = gameArea.querySelector('.shadow-item.obj.selected');
        if (!sel) { el.classList.add('wrong-flash'); setTimeout(() => el.classList.remove('wrong-flash'), 500); sfx.wrong(); return; }
        if (sel.dataset.name === el.dataset.name) {
          // 配对成功
          sel.classList.remove('selected');
          sel.classList.add('matched');
          el.classList.add('matched');
          const badge = document.createElement('span');
          badge.className = 'badge';
          badge.textContent = '✓';
          el.appendChild(badge);
          sfx.correct();
          matched++;
          if (matched >= 4) {
            setTimeout(() => {
              shadow.correct++;
              shadow.round++;
              if (shadow.round >= shadow.total) shadowEnd();
              else renderShadow();
            }, 700);
          }
        } else {
          // 配错：标红 + 提示正确配对 + 自动跳下一题
          el.classList.add('wrong-flash');
          sel.classList.remove('selected');
          // 高亮正确的配对项
          const pairs = shadow.current ? shadow.current.items : null;
          if (pairs) {
            const rightName = sel.dataset.name;
            gameArea.querySelectorAll('.shadow-item.shadow').forEach(x => {
              if (x.dataset.name === rightName) x.classList.add('matched-highlight');
            });
            gameArea.querySelectorAll('.shadow-item.obj').forEach(x => {
              if (x.dataset.name === rightName) x.classList.add('matched-highlight');
            });
          }
          gameArea.querySelectorAll('.shadow-item').forEach(x => x.style.pointerEvents = 'none');
          sfx.wrong();
          setTimeout(() => {
            shadow.round++;
            if (shadow.round >= shadow.total) shadowEnd();
            else renderShadow();
          }, 1500);
        }
      };
    });
  }

  function shadowEnd() {
    const rate = shadow.correct / shadow.total;
    let s = 1;
    if (rate >= 0.9) s = 3; else if (rate >= 0.7) s = 2;
    addStar('shadow', s);
    recordGame('shadow', shadow.correct, shadow.total, Date.now() - gameStartTime);
    showModal(rate >= 0.9 ? '🌓' : rate >= 0.7 ? '🌟' : '💪',
      rate >= 0.9 ? '影子专家！' : rate >= 0.7 ? '很棒！' : '再试试',
      `配对 ${shadow.correct} / ${shadow.total} 组`, s, () => { shadow.round = 0; shadow.correct = 0; renderShadow(); });
  }

  // ============================================================
  // 游戏12：认图形/颜色
  // ============================================================
  let shapes = { round: 0, total: 8, correct: 0 };

  const SHAPE_TYPES = [
    { name: '圆形', draw: (ctx, s) => { ctx.beginPath(); ctx.arc(0, 0, s / 2, 0, Math.PI * 2); ctx.fill(); } },
    { name: '正方形', draw: (ctx, s) => { ctx.fillRect(-s / 2, -s / 2, s, s); } },
    { name: '三角形', draw: (ctx, s) => { ctx.beginPath(); ctx.moveTo(0, -s / 2); ctx.lineTo(s / 2, s / 2); ctx.lineTo(-s / 2, s / 2); ctx.closePath(); ctx.fill(); } },
    { name: '长方形', draw: (ctx, s) => { ctx.fillRect(-s / 2, -s / 3, s, s * 2 / 3); } },
    { name: '五角星', draw: (ctx, s) => { ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 === 0 ? s / 2 : s / 4.6; const ang = (Math.PI * 2 * i) / 10 - Math.PI / 2; i === 0 ? ctx.moveTo(r * Math.cos(ang), r * Math.sin(ang)) : ctx.lineTo(r * Math.cos(ang), r * Math.sin(ang)); } ctx.closePath(); ctx.fill(); } },
    { name: '心形', draw: (ctx, s) => { ctx.beginPath(); ctx.moveTo(0, s / 3); ctx.bezierCurveTo(-s / 2, -s / 4, -s / 3, -s / 2, 0, -s / 6); ctx.bezierCurveTo(s / 3, -s / 2, s / 2, -s / 4, 0, s / 3); ctx.closePath(); ctx.fill(); } },
  ];
  const COLORS = [
    { name: '红色', hex: '#ef5350' },
    { name: '黄色', hex: '#fdd835' },
    { name: '蓝色', hex: '#42a5f5' },
    { name: '绿色', hex: '#66bb6a' },
    { name: '紫色', hex: '#ab47bc' },
    { name: '橙色', hex: '#ff9800' },
  ];

  function drawShape(shape, colorHex, size) {
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.translate(size / 2, size / 2);
    ctx.fillStyle = colorHex;
    shape.draw(ctx, size * 0.78);
    const dataUrl = canvas.toDataURL();
    return `<img src="${dataUrl}" class="fig" alt="${shape.name}">`;
  }

  function renderShapes() {
    // 题型：0 = 认识颜色（展示色块），1 = 认识形状（展示图形），2 = 组合（听颜色+形状）
    const qType = randInt(0, 2);
    let question = '', inner = '', options = [], answerKey = '';

    if (qType === 0) {
      // 展示一个色块，问是什么颜色
      const color = COLORS[randInt(0, COLORS.length - 1)];
      question = '这是什么颜色？';
      inner = `<div class="swatch" style="width:70px;height:70px;border-radius:16px;background:${color.hex};display:inline-block;border:3px solid rgba(0,0,0,.08);box-shadow:0 6px 16px rgba(0,0,0,.12)"></div>`;
      answerKey = color.name;
      options = shuffle(COLORS.map(c => c.name));
    } else if (qType === 1) {
      // 展示一个图形，问是什么形状
      const shape = SHAPE_TYPES[randInt(0, SHAPE_TYPES.length - 1)];
      const color = COLORS[randInt(0, COLORS.length - 1)];
      question = '这是什么形状？';
      inner = drawShape(shape, color.hex, 90);
      answerKey = shape.name;
      options = shuffle(SHAPE_TYPES.map(s => s.name));
    } else {
      // 组合题：展示(图形+颜色)，问「它是什么颜色/什么形状」二选一随机
      const shape = SHAPE_TYPES[randInt(0, SHAPE_TYPES.length - 1)];
      const color = COLORS[randInt(0, COLORS.length - 1)];
      const ask = Math.random() < 0.5 ? 'color' : 'shape';
      inner = drawShape(shape, color.hex, 90);
      if (ask === 'color') {
        question = '这个 ' + shape.name + ' 是什么颜色？';
        answerKey = color.name;
        options = shuffle(COLORS.map(c => c.name));
      } else {
        question = '这个' + color.name + '的图形是什么形状？';
        answerKey = shape.name;
        options = shuffle(SHAPE_TYPES.map(s => s.name));
      }
    }

    gameArea.innerHTML = `
      <div class="game-hint">第 ${shapes.round + 1} / ${shapes.total} 题</div>
      <div class="shape-quiz">
        <div class="shape-symbol">${inner}</div>
        <div class="game-hint">${question}</div>
        <div class="shape-options">
          ${options.map(o => {
            const isColor = COLORS.some(c => c.name === o);
            const c = COLORS.find(c => c.name === o);
            return `<button class="shape-opt" data-ans="${o}">${isColor && c ? `<span class="swatch" style="background:${c.hex}"></span>` : ''}<span class="sh-name">${o}</span></button>`;
          }).join('')}
        </div>
      </div>
    `;
    gameArea.querySelectorAll('.shape-opt').forEach(btn => {
      btn.onclick = () => {
        sfx.click();
        if (btn.dataset.ans === answerKey) {
          btn.classList.add('correct');
          shapes.correct++;
          sfx.correct();
          gameArea.querySelectorAll('.shape-opt').forEach(b => b.classList.add('disabled'));
          setTimeout(() => {
            shapes.round++;
            if (shapes.round >= shapes.total) shapesEnd();
            else renderShapes();
          }, 700);
        } else {
          // 答错：标红 + 展示正确答案 + 自动跳下一题
          handleWrong(btn, () => [...gameArea.querySelectorAll('.shape-opt')].find(b => b.dataset.ans === answerKey) || null, () => {
            shapes.round++;
            if (shapes.round >= shapes.total) shapesEnd();
            else renderShapes();
          });
        }
      };
    });
  }

  function shapesEnd() {
    const rate = shapes.correct / shapes.total;
    let s = 1;
    if (rate >= 0.9) s = 3; else if (rate >= 0.7) s = 2;
    addStar('shapes', s);
    recordGame('shapes', shapes.correct, shapes.total, Date.now() - gameStartTime);
    showModal(rate >= 0.9 ? '🌈' : rate >= 0.7 ? '🌟' : '💪',
      rate >= 0.9 ? '图形颜色大师！' : rate >= 0.7 ? '很棒！' : '再认认',
      `答对 ${shapes.correct} / ${shapes.total} 题`, s, () => { shapes.round = 0; shapes.correct = 0; renderShapes(); });
  }

  // ============================================================
  // 游戏13：找方向
  // ============================================================
  let direction = { round: 0, total: 6, correct: 0 };

  const FRIEND_EMOJI = ['🐱', '🐶', '🐰', '🦊', '🐼', '🐨', '🦁', '🐸', '🐵', '🐷'];

  function renderDirection() {
    // 3x3 网格：中心是"我/起点"，随机放置一个朋友
    const grid = Array(9).fill(null);
    const friendIdx = randInt(0, 8);
    while (friendIdx === 4) { /* 不能放中心 */ }
    const friend = FRIEND_EMOJI[randInt(0, FRIEND_EMOJI.length - 1)];
    grid[friendIdx] = friend;
    const myPos = 4;
    // 计算方向：朋友在中心的哪个方位
    const dx = (friendIdx % 3) - (myPos % 3); // -1,0,1
    const dy = Math.floor(friendIdx / 3) - Math.floor(myPos / 3);
    let answerKey = '';
    if (dy === -1 && dx === 0) answerKey = '上面';
    else if (dy === 1 && dx === 0) answerKey = '下面';
    else if (dx === -1 && dy === 0) answerKey = '左边';
    else if (dx === 1 && dy === 0) answerKey = '右边';
    else if (dx === -1 && dy === -1) answerKey = '左上';
    else if (dx === 1 && dy === -1) answerKey = '右上';
    else if (dx === -1 && dy === 1) answerKey = '左下';
    else if (dx === 1 && dy === 1) answerKey = '右下';

    // 选项：方位词
    const allDirs = ['上面', '下面', '左边', '右边', '左上', '右上', '左下', '右下'];
    const options = shuffle([answerKey, ...shuffle(allDirs.filter(d => d !== answerKey)).slice(0, 3)]);

    gameArea.innerHTML = `
      <div class="game-hint">第 ${direction.round + 1} / ${direction.total} 题</div>
      <div class="dir-grid-wrap">
        <div class="dir-question">${friend} 在 ⭐（中间）的哪边？</div>
        <div class="dir-grid">
          ${grid.map((cell, i) => `
            <div class="dir-cell ${i === myPos ? 'center' : ''}">${i === myPos ? '⭐' : cell || ''}</div>
          `).join('')}
        </div>
      </div>
      <div class="option-grid">
        ${options.map(d => `<button class="option-btn" data-ans="${d}">${d}</button>`).join('')}
      </div>
    `;
    gameArea.querySelectorAll('.option-btn').forEach(btn => {
      btn.onclick = () => {
        sfx.click();
        if (btn.dataset.ans === answerKey) {
          btn.classList.add('correct');
          direction.correct++;
          sfx.correct();
          gameArea.querySelectorAll('.option-btn').forEach(b => b.classList.add('disabled'));
          setTimeout(() => {
            direction.round++;
            if (direction.round >= direction.total) directionEnd();
            else renderDirection();
          }, 700);
        } else {
          // 答错：标红 + 展示正确答案 + 自动跳下一题
          handleWrong(btn, () => [...gameArea.querySelectorAll('.option-btn')].find(b => b.dataset.ans === answerKey) || null, () => {
            direction.round++;
            if (direction.round >= direction.total) directionEnd();
            else renderDirection();
          });
        }
      };
    });
  }

  function directionEnd() {
    const rate = direction.correct / direction.total;
    let s = 1;
    if (rate >= 0.9) s = 3; else if (rate >= 0.7) s = 2;
    addStar('direction', s);
    recordGame('direction', direction.correct, direction.total, Date.now() - gameStartTime);
    showModal(rate >= 0.9 ? '🧭' : rate >= 0.7 ? '🌟' : '💪',
      rate >= 0.9 ? '方向小导航！' : rate >= 0.7 ? '很棒！' : '再看看',
      `答对 ${direction.correct} / ${direction.total} 题`, s, () => { direction.round = 0; direction.correct = 0; renderDirection(); });
  }

  // ============================================================
  // 游戏14：亲属称谓（爸爸的爸爸叫什么）
  // ============================================================
  let family = { round: 0, total: 6, correct: 0 };

  const FAMILY_DATA = [
    { rel: '爸爸的爸爸', ans: '爷爷' },
    { rel: '爸爸的妈妈', ans: '奶奶' },
    { rel: '妈妈的爸爸', ans: '外公' },
    { rel: '妈妈的妈妈', ans: '外婆' },
    { rel: '爸爸的哥哥', ans: '伯伯' },
    { rel: '爸爸的弟弟', ans: '叔叔' },
    { rel: '爸爸的姐姐', ans: '姑姑' },
    { rel: '爸爸的妹妹', ans: '姑姑' },
    { rel: '妈妈的哥哥', ans: '舅舅' },
    { rel: '妈妈的弟弟', ans: '舅舅' },
    { rel: '妈妈的姐姐', ans: '姨妈' },
    { rel: '妈妈的妹妹', ans: '姨妈' },
    { rel: '爷爷的儿子', ans: '爸爸' },
    { rel: '外婆的女儿', ans: '妈妈' },
  ];
  const FAMILY_OPTIONS = ['爷爷', '奶奶', '外公', '外婆', '伯伯', '叔叔', '姑姑', '舅舅', '姨妈', '爸爸', '妈妈'];

  function renderFamily() {
    const target = FAMILY_DATA[randInt(0, FAMILY_DATA.length - 1)];
    const others = shuffle(FAMILY_OPTIONS.filter(o => o !== target.ans)).slice(0, 3);
    const options = shuffle([target.ans, ...others]);
    gameArea.innerHTML = `
      <div class="game-hint">第 ${family.round + 1} / ${family.total} 题</div>
      <div class="hanzi-quiz">
        <div class="hanzi-pic">👨‍👩‍👧</div>
        <div class="game-hint">「${target.rel}」应该叫什么？</div>
        <div class="hanzi-options">
          ${options.map(d => `<button class="hanzi-opt" data-ans="${d}"><span class="hz" style="font-size:1.6rem">${d}</span>${d}</button>`).join('')}
        </div>
      </div>
    `;
    gameArea.querySelectorAll('.hanzi-opt').forEach(btn => {
      btn.onclick = () => {
        sfx.click();
        if (btn.dataset.ans === target.ans) {
          btn.classList.add('correct');
          family.correct++;
          sfx.correct();
          gameArea.querySelectorAll('.hanzi-opt').forEach(b => b.classList.add('disabled'));
          setTimeout(() => {
            family.round++;
            if (family.round >= family.total) familyEnd();
            else renderFamily();
          }, 700);
        } else {
          // 答错：标红 + 展示正确答案 + 自动跳下一题（与 family 共用的样式）
          handleWrong(btn, () => [...gameArea.querySelectorAll('.hanzi-opt')].find(b => b.dataset.ans === target.ans) || null, () => {
            family.round++;
            if (family.round >= family.total) familyEnd();
            else renderFamily();
          });
        }
      };
    });
  }

  function familyEnd() {
    const rate = family.correct / family.total;
    let s = 1;
    if (rate >= 0.9) s = 3; else if (rate >= 0.7) s = 2;
    addStar('family', s);
    recordGame('family', family.correct, family.total, Date.now() - gameStartTime);
    showModal(rate >= 0.9 ? '👨‍👩‍👧' : rate >= 0.7 ? '🌟' : '💪',
      rate >= 0.9 ? '家庭小百科！' : rate >= 0.7 ? '很棒！' : '回家问问',
      `答对 ${family.correct} / ${family.total} 题`, s, () => { family.round = 0; family.correct = 0; renderFamily(); });
  }

  // ============================================================
  // 游戏15：行为判断（哪些行为不对）
  // ============================================================
  let behavior = { round: 0, total: 8, correct: 0 };

  const BEHAVIOR_DATA = [
    { scene: '红灯亮了，还要过马路', good: false },
    { scene: '公交车上给老爷爷让座', good: true },
    { scene: '把垃圾扔进垃圾桶', good: true },
    { scene: '抢小朋友的玩具', good: false },
    { scene: '见到老师说"老师好"', good: true },
    { scene: '在图书馆里大声喊叫', good: false },
    { scene: '吃饭前先洗手', good: true },
    { scene: '打人、骂人', good: false },
    { scene: '自己穿衣服、系鞋带', good: true },
    { scene: '把玩具扔得到处都是', good: false },
    { scene: '帮妈妈做家务', good: true },
    { scene: '摘公园里的花', good: false },
    { scene: '排队不插队', good: true },
    { scene: '浪费粮食，饭菜乱倒', good: false },
    { scene: '别人说话时不插嘴', good: true },
    { scene: '乱按电梯按钮玩', good: false },
  ];

  function renderBehavior() {
    const target = BEHAVIOR_DATA[randInt(0, BEHAVIOR_DATA.length - 1)];
    const options = shuffle([
      { label: '✅ 对', val: 'good' },
      { label: '❌ 不对', val: 'bad' },
    ]);
    gameArea.innerHTML = `
      <div class="game-hint">第 ${behavior.round + 1} / ${behavior.total} 题</div>
      <div class="season-quiz">
        <span class="season-big">🤔</span>
        <div class="game-hint">「${target.scene}」这样做对吗？</div>
        <div class="season-options">
          ${options.map(d => `<button class="season-opt" data-ans="${d.val}"><span class="se-icon" style="font-size:1.8rem">${d.label}</span><span class="se-name">${d.label}</span></button>`).join('')}
        </div>
      </div>
    `;
    gameArea.querySelectorAll('.season-opt').forEach(btn => {
      btn.onclick = () => {
        sfx.click();
        const isGood = btn.dataset.ans === 'good';
        if (isGood === target.good) {
          btn.classList.add('correct');
          behavior.correct++;
          sfx.correct();
          gameArea.querySelectorAll('.season-opt').forEach(b => b.classList.add('disabled'));
          setTimeout(() => {
            behavior.round++;
            if (behavior.round >= behavior.total) behaviorEnd();
            else renderBehavior();
          }, 700);
        } else {
          // 答错：标红 + 展示正确答案 + 自动跳下一题
          const correctVal = target.good ? 'good' : 'bad';
          handleWrong(btn, () => [...gameArea.querySelectorAll('.season-opt')].find(b => b.dataset.ans === correctVal) || null, () => {
            behavior.round++;
            if (behavior.round >= behavior.total) behaviorEnd();
            else renderBehavior();
          });
        }
      };
    });
  }

  function behaviorEnd() {
    const rate = behavior.correct / behavior.total;
    let s = 1;
    if (rate >= 0.9) s = 3; else if (rate >= 0.7) s = 2;
    addStar('behavior', s);
    recordGame('behavior', behavior.correct, behavior.total, Date.now() - gameStartTime);
    showModal(rate >= 0.9 ? '🌟' : rate >= 0.7 ? '👍' : '💪',
      rate >= 0.9 ? '行为小标兵！' : rate >= 0.7 ? '很不错！' : '多看看',
      `答对 ${behavior.correct} / ${behavior.total} 题`, s, () => { behavior.round = 0; behavior.correct = 0; renderBehavior(); });
  }

  // ---------- 渲染器注册 ----------
  const renderers = {
    math: renderMath,
    count: renderCount,
    pinyin: renderPinyin,
    memory: renderMemory,
    clock: renderClock,
    spot: renderSpot,
    hanzi: renderHanzi,
    money: renderMoney,
    pattern: renderPattern,
    season: renderSeason,
    shadow: renderShadow,
    shapes: renderShapes,
    direction: renderDirection,
    family: renderFamily,
    behavior: renderBehavior,
  };

  // ---------- 事件绑定 ----------
  document.querySelectorAll('.card').forEach(card => {
    card.onclick = () => { ensureAudio(); sfx.click(); showGame(card.dataset.game); };
  });
  $('#backBtn').onclick = () => { sfx.click(); showMenu(); };
  $('#reportBtn').onclick = () => { ensureAudio(); sfx.click(); showReport(); };
  $('#reportBackBtn').onclick = () => { sfx.click(); showMenu(); };
  $('#reportResetBtn').onclick = () => {
    if (confirm('确定要清除所有学习记录吗？（星星也会清零）')) {
      for (const k of Object.keys(stats)) delete stats[k];
      for (const k of Object.keys(stars)) delete stars[k];
      saveStats(); saveStars(); refreshStars();
      renderReport();
      sfx.click();
    }
  };
  $('#resetBtn').onclick = () => {
    if (confirm('确定要清零所有星星吗？（学习记录保留）')) {
      for (const k of Object.keys(stars)) delete stars[k];
      saveStars(); refreshStars();
      sfx.click();
    }
  };

  // ---------- 初始化 ----------
  refreshStars();
  // 预初始化音效上下文（用户首次交互时）
  document.addEventListener('click', ensureAudio, { once: true });
})();
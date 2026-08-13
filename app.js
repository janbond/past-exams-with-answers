
let ALL = [];
let SUBJECTS = [];
let state = { subject: null, year: null, track: null, section: null, onlyStar: false, search: '', cardMode: false, cardIndex: 0 };
let starred = new Set(JSON.parse(localStorage.getItem('examstar_v1')||'[]'));

function qid(q){ return [q.subject,q.year,q.track,q.section,q.qnum].join('|'); }
function saveStar(){ localStorage.setItem('examstar_v1', JSON.stringify([...starred])); }

function loadPrefs(){
  try{
    const p = JSON.parse(localStorage.getItem('examprefs_v1')||'{}');
    if(p.subject) state.subject = p.subject;
  }catch(e){}
}
function savePrefs(){
  localStorage.setItem('examprefs_v1', JSON.stringify({subject: state.subject}));
}

function uniq(arr){ return [...new Set(arr)]; }

function renderSubjectTabs(){
  const el = document.getElementById('subjectTabs');
  el.innerHTML = '';
  SUBJECTS.forEach(s=>{
    const b = document.createElement('div');
    b.className = 'tab' + (state.subject===s?' active':'');
    b.textContent = s;
    b.onclick = ()=>{ state.subject=s; state.year=null; state.track=null; state.section=null; savePrefs(); render(); };
    el.appendChild(b);
  });
}

function questionsFor(subject){ return ALL.filter(q=>q.subject===subject); }

function renderYearGrid(){
  const qs = questionsFor(state.subject);
  const years = uniq(qs.map(q=>q.year)).sort();
  let html = '<div class="crumb">選擇年份</div><div class="year-grid">';
  years.forEach(y=>{
    const cnt = qs.filter(q=>q.year===y).length;
    html += `<div class="year-btn" data-y="${y}"><span>${y}年</span><span class="cnt">${cnt}題</span></div>`;
  });
  html += '</div>';
  return html;
}

function renderTrackSectionTabs(){
  const qs = questionsFor(state.subject).filter(q=>q.year===state.year);
  const tracks = uniq(qs.map(q=>q.track));
  let html = '<div class="back-link" id="backToYears">‹ 返回年份選擇</div>';
  html += '<div class="subtabs" id="trackTabs">';
  tracks.forEach(t=>{
    html += `<div class="tab track-tab${state.track===t?' active':''}" data-t="${t}">${t}</div>`;
  });
  html += '</div>';
  if(state.track){
    const secs = uniq(qs.filter(q=>q.track===state.track).map(q=>q.section).filter(Boolean));
    if(secs.length>1){
      html += '<div class="subtabs" id="secTabs">';
      secs.forEach(s=>{
        html += `<div class="tab sec-tab${state.section===s?' active':''}" data-s="${s}">${s}</div>`;
      });
      html += '</div>';
    }
  }
  return html;
}

function highlight(text, term){
  if(!term) return escapeHtml(text);
  const esc = escapeHtml(text);
  const t = escapeHtml(term);
  try{
    return esc.replace(new RegExp('('+t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','gi'), '<mark>$1</mark>');
  }catch(e){ return esc; }
}
function escapeHtml(s){
  return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function searchableText(q){
  if(q.type === 'essay'){
    const parts = [q.stem];
    (q.blocks||[]).forEach(b=>{
      if(b.type==='list'){ (b.items||[]).forEach(it=>{ parts.push(it.label); parts.push(it.body); }); }
      else { parts.push(b.text); }
    });
    return parts.join(' ');
  }
  return q.stem + (q.passage||'') + Object.values(q.options||{}).join(' ') + (q.explanation||[]).join(' ');
}

function currentList(){
  let list = ALL.filter(q=>q.subject===state.subject);
  if(state.search){
    const term = state.search.toLowerCase();
    list = list.filter(q => searchableText(q).toLowerCase().includes(term));
  } else {
    if(state.year) list = list.filter(q=>q.year===state.year);
    if(state.track) list = list.filter(q=>q.track===state.track);
    if(state.section) list = list.filter(q=>q.section===state.section);
  }
  if(state.onlyStar) list = list.filter(q=>starred.has(qid(q)));
  list = [...list].sort((a,b)=> a.year===b.year ? a.qnum-b.qnum : a.year.localeCompare(b.year));
  return list;
}

function renderQuestionCard(q){
  return q.type === 'essay' ? renderEssayCard(q) : renderChoiceCard(q);
}

function renderChoiceCard(q){
  const id = qid(q);
  const isStar = starred.has(id);
  let html = '';
  if(q.group && q.passage){
    html += `<div class="group-note">${escapeHtml(q.group)}</div>`;
  }
  html += `<div class="qcard" data-id="${attrEsc(id)}">`;
  if(q.passage){
    html += `<div class="passage" id="pg-${cssEsc(id)}">${highlight(q.passage, state.search)}</div><div class="passage-toggle" data-id="${attrEsc(id)}">展開／收合短文</div>`;
  }
  html += `<div class="qhead">
      <div><span class="qnum-badge">${q.year}年・${q.track}${q.section?('・'+q.section):''}・第${q.qnum}題</span>
      <div class="qstem">${highlight(q.stem, state.search)}</div></div>
      <button class="star-btn ${isStar?'on':''}" data-id="${attrEsc(id)}">${isStar?'★':'☆'}</button>
    </div>`;
  html += '<div class="opts">';
  ['A','B','C','D','E'].forEach(k=>{
    if(q.options[k]===undefined) return;
    html += `<div class="opt" data-id="${attrEsc(id)}" data-k="${k}"><span class="lab">(${k})</span><span>${highlight(q.options[k], state.search)}</span></div>`;
  });
  html += '</div>';
  html += `<div class="answer-panel" id="ap-${cssEsc(id)}"><div class="ans-line">正確答案：(${q.answer})</div><div>${(q.explanation||[]).map(e=>escapeHtml(e)).join('<br><br>')}</div></div>`;
  html += `<button class="reveal-btn" data-id="${attrEsc(id)}">顯示詳解</button>`;
  html += '</div>';
  return html;
}

function renderAnswerBlock(b, term){
  if(b.type === 'heading'){
    return `<div class="ans-heading">${highlight(b.text, term)}</div>`;
  }
  if(b.type === 'list'){
    let rows = '';
    (b.items||[]).forEach(it=>{
      rows += `<div class="ans-label">${highlight(it.label, term)}</div><div class="ans-body">${highlight(it.body, term)}</div>`;
    });
    return `<div class="ans-list">${rows}</div>`;
  }
  return `<p class="ans-para">${highlight(b.text, term)}</p>`;
}

function renderEssayCard(q){
  const id = qid(q);
  const isStar = starred.has(id);
  let html = `<div class="qcard essay-card" data-id="${attrEsc(id)}">`;
  html += `<div class="qhead">
      <div><span class="qnum-badge">${q.year}年・${q.track}${q.section?('・'+q.section):''}・第${q.qnum}題</span>
      <div class="qstem">${highlight(q.stem, state.search)}</div></div>
      <button class="star-btn ${isStar?'on':''}" data-id="${attrEsc(id)}">${isStar?'★':'☆'}</button>
    </div>`;
  const blocksHtml = (q.blocks||[]).map(b=>renderAnswerBlock(b, state.search)).join('');
  html += `<div class="answer-panel" id="ap-${cssEsc(id)}">${blocksHtml}</div>`;
  html += `<button class="reveal-btn" data-id="${attrEsc(id)}">顯示詳解</button>`;
  html += '</div>';
  return html;
}

function cssEsc(s){ return s.replace(/[^a-zA-Z0-9\-_]/g, c=>'_'+c.charCodeAt(0)+'_'); }
function attrEsc(s){ return (s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }

function render(){
  document.body.classList.toggle('card-mode', !!state.cardMode);
  renderSubjectTabs();
  const main = document.getElementById('main');
  if(!state.subject){ state.subject = SUBJECTS[0]; }

  if(state.search){
    const list = currentList();
    main.innerHTML = `<div class="crumb">搜尋結果：${list.length} 題</div>`;
    showList(list);
    return;
  }
  if(!state.year){
    resetStatsBar();
    main.innerHTML = renderYearGrid();
    document.querySelectorAll('.year-btn').forEach(b=>{
      b.onclick = ()=>{ state.year=b.dataset.y; state.track=null; state.section=null; state.cardMode=false; render(); };
    });
    updateStats(questionsFor(state.subject).length);
    return;
  }
  let top = renderTrackSectionTabs();
  const qs = questionsFor(state.subject).filter(q=>q.year===state.year);
  if(!state.track){
    const tracks = uniq(qs.map(q=>q.track));
    if(tracks.length===1) state.track = tracks[0];
  }
  const qs2 = qs.filter(q=> !state.track || q.track===state.track);
  if(state.track && !state.section){
    const secs = uniq(qs2.filter(q=>q.track===state.track).map(q=>q.section).filter(Boolean));
    if(secs.length===1) state.section = secs[0];
  }
  main.innerHTML = top;
  document.getElementById('backToYears').onclick = ()=>{ state.year=null; state.track=null; state.section=null; state.cardMode=false; render(); };
  document.querySelectorAll('.track-tab').forEach(b=>{
    b.onclick = ()=>{ state.track=b.dataset.t; state.section=null; state.cardMode=false; render(); };
  });
  document.querySelectorAll('.sec-tab').forEach(b=>{
    b.onclick = ()=>{ state.section=b.dataset.s; state.cardMode=false; render(); };
  });
  if(state.track){
    const list = currentList();
    showList(list);
  } else {
    resetStatsBar();
    updateStats(qs.length);
  }
}

function showList(list){
  if(state.cardMode) renderCardMode(list);
  else renderListMode(list);
}

function renderListMode(list){
  const main = document.getElementById('main');
  resetStatsBar();
  const toolbar = list.length ? `<div class="list-toolbar"><button class="card-mode-btn" id="enterCardBtn">🃏 卡片模式</button></div>` : '';
  const body = list.length ? `<div class="qlist">${list.map(renderQuestionCard).join('')}</div>` : '<div class="empty">此範圍暫無題目資料</div>';
  main.insertAdjacentHTML('beforeend', toolbar + body);
  const btn = document.getElementById('enterCardBtn');
  if(btn) btn.onclick = ()=>{ state.cardMode = true; state.cardIndex = 0; render(); };
  updateStats(list.length);
  bindCardEvents();
}

function renderCardMode(list){
  const main = document.getElementById('main');
  if(list.length === 0){
    resetStatsBar();
    main.insertAdjacentHTML('beforeend', '<div class="empty">此範圍暫無題目資料</div>');
    updateStats(0);
    return;
  }
  if(state.cardIndex < 0) state.cardIndex = 0;
  if(state.cardIndex > list.length-1) state.cardIndex = list.length-1;
  const q = list[state.cardIndex];
  const html = `<div class="card-toolbar"><span class="back-link" id="exitCardBtn">‹ 返回列表</span><span class="crumb">第 ${state.cardIndex+1} ／ ${list.length} 題</span></div>
    <div class="card-single">${renderQuestionCard(q)}</div>`;
  main.insertAdjacentHTML('beforeend', html);
  document.getElementById('exitCardBtn').onclick = ()=>{ state.cardMode = false; render(); };
  bindCardEvents();
  bindSwipe(document.querySelector('.card-single .qcard'), list.length);
  renderCardNav(list.length);
}

function renderCardNav(total){
  const bar = document.getElementById('statsBar');
  bar.innerHTML = `<button class="nav-btn" id="prevCardBtn" ${state.cardIndex<=0?'disabled':''}>‹ 上一題</button>
    <span>${state.cardIndex+1} ／ ${total}</span>
    <button class="nav-btn" id="nextCardBtn" ${state.cardIndex>=total-1?'disabled':''}>下一題 ›</button>`;
  document.getElementById('prevCardBtn').onclick = ()=> stepCard(-1);
  document.getElementById('nextCardBtn').onclick = ()=> stepCard(1);
}

function stepCard(delta){
  const list = currentList();
  const next = state.cardIndex + delta;
  if(next < 0 || next > list.length-1) return;
  state.cardIndex = next;
  render();
}

function bindSwipe(el, total){
  if(!el) return;
  let x0 = null, y0 = null;
  el.addEventListener('touchstart', (e)=>{
    const t = e.changedTouches[0];
    x0 = t.clientX; y0 = t.clientY;
  }, {passive:true});
  el.addEventListener('touchend', (e)=>{
    if(x0===null) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - x0, dy = t.clientY - y0;
    if(Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)*1.5){
      stepCard(dx < 0 ? 1 : -1);
    }
    x0 = null; y0 = null;
  }, {passive:true});
}

document.addEventListener('keydown', (e)=>{
  if(!state.cardMode) return;
  if(e.key === 'ArrowRight') stepCard(1);
  if(e.key === 'ArrowLeft') stepCard(-1);
});

function resetStatsBar(){
  const bar = document.getElementById('statsBar');
  bar.innerHTML = `<span id="statLeft">—</span><span id="statRight">—</span>`;
}

function bindCardEvents(){
  document.querySelectorAll('.star-btn').forEach(b=>{
    b.onclick = (e)=>{
      e.stopPropagation();
      const id = b.dataset.id;
      if(starred.has(id)){ starred.delete(id); b.classList.remove('on'); b.textContent='☆'; }
      else { starred.add(id); b.classList.add('on'); b.textContent='★'; }
      saveStar();
    };
  });
  document.querySelectorAll('.passage-toggle').forEach(b=>{
    b.onclick = ()=>{
      const id = b.dataset.id;
      document.getElementById('pg-'+cssEsc(id)).classList.toggle('expanded');
    };
  });
  document.querySelectorAll('.reveal-btn').forEach(b=>{
    b.onclick = ()=> toggleAnswer(b.dataset.id, b);
  });
  document.querySelectorAll('.opt').forEach(o=>{
    o.onclick = ()=>{
      const id = o.dataset.id;
      const k = o.dataset.k;
      const q = ALL.find(qq=>qid(qq)===id);
      document.querySelectorAll(`.opt[data-id="${cssAttrEsc(id)}"]`).forEach(oo=>{
        oo.classList.add('dim');
        if(oo.dataset.k === q.answer) oo.classList.add('correct');
      });
      if(k !== q.answer) o.classList.add('wrong');
      revealAnswer(id);
    };
  });
}
function cssAttrEsc(id){ return id.replace(/"/g,'\\"'); }

function revealAnswer(id){
  const p = document.getElementById('ap-'+cssEsc(id));
  if(p) p.classList.add('show');
  const btn = document.querySelector(`.reveal-btn[data-id="${cssAttrEsc(id)}"]`);
  if(btn) btn.textContent = '隱藏詳解';
}

function toggleAnswer(id, btn){
  const p = document.getElementById('ap-'+cssEsc(id));
  if(!p) return;
  const nowShown = p.classList.toggle('show');
  if(btn) btn.textContent = nowShown ? '隱藏詳解' : '顯示詳解';
}

function updateStats(count){
  document.getElementById('statLeft').textContent = `顯示 ${count} 題`;
  document.getElementById('statRight').textContent = `已標記 ${starred.size} 題`;
}

document.getElementById('searchBox').addEventListener('input', (e)=>{
  state.search = e.target.value.trim();
  render();
});
document.getElementById('modeToggle').addEventListener('click', ()=>{
  state.onlyStar = !state.onlyStar;
  document.getElementById('modeToggle').style.color = state.onlyStar ? 'var(--star)' : 'var(--muted)';
  render();
});

async function loadData(){
  const base = 'data/';
  try{
    const manifest = await (await fetch(base + 'manifest.json')).json();
    const chunks = await Promise.all(manifest.map(fn => fetch(base + fn).then(r=>r.json())));
    ALL = chunks.flat();
    SUBJECTS = [...new Set(ALL.map(q=>q.subject))];
    loadPrefs();
    document.getElementById('main').innerHTML = '';
    render();
  }catch(err){
    document.getElementById('main').innerHTML =
      '<div class="empty">資料載入失敗：' + (err && err.message ? err.message : err) +
      '<br><br>若是直接雙擊開啟 index.html，瀏覽器會擋掉本地檔案的 fetch 讀取。'+
      '請改用「網頁伺服器」方式開啟（例如部署到 GitHub Pages，或在此資料夾內執行 <code>python3 -m http.server</code> 後用 http://localhost 開啟）。</div>';
    console.error(err);
  }
}

document.getElementById('main').innerHTML = '<div class="empty">載入題庫中…</div>';
loadData();

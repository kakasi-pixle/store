(() => {
  'use strict';

  const lessons = window.SCIENCE_LESSONS || [];
  const glossary = window.SCIENCE_GLOSSARY || [];
  const labs = window.SCIENCE_LABS || [];
  const experiments = window.HOME_EXPERIMENTS || [];
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const storeKey = 'science-lab-progress-v1';

  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(storeKey) || '{}'); } catch { saved = {}; }
  const completed = new Set(Array.isArray(saved.completed) ? saved.completed : []);
  const answered = new Map();
  let activeLesson = 1;
  let activeView = 'learn';
  let activeLab = labs[0]?.id || 'water';
  let ozonePhase = 0;
  let quizOrder = [];
  let toastTimer;

  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  function persist() {
    try {
      localStorage.setItem(storeKey, JSON.stringify({ completed: [...completed] }));
    } catch { showToast('تعذر حفظ التقدم على هذا المتصفح.'); }
    updateProgress();
  }

  function showToast(message) {
    const toast = $('#toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
  }

  function findTerm(term) {
    const target = String(term).toLowerCase();
    return glossary.find(item => item[0].toLowerCase() === target)
      || glossary.find(item => item[0].toLowerCase().includes(target))
      || glossary.find(item => item[1] === term);
  }

  function richText(value) {
    let text = escapeHTML(value);
    text = text.replace(/\{\{(.+?)\}\}/g, (_, word) => {
      const cleaned = word.trim();
      return `<button class="term" type="button" data-term="${escapeHTML(cleaned)}">${escapeHTML(cleaned)}</button>`;
    });
    return text;
  }

  function renderParagraphs(paragraphs) {
    if (!Array.isArray(paragraphs)) return '';
    return paragraphs.map(p => `<p>${richText(p)}</p>`).join('');
  }

  function renderCards(cards) {
    if (!cards?.length) return '';
    return `<div class="mini-cards">${cards.map(card => `<article class="mini-card"><strong>${richText(card.title)}</strong><p>${richText(card.text)}</p></article>`).join('')}</div>`;
  }

  function renderTable(table) {
    if (!table?.headers || !table?.rows) return '';
    return `<div class="table-scroll"><table class="content-table"><thead><tr>${table.headers.map(head => `<th>${richText(head)}</th>`).join('')}</tr></thead><tbody>${table.rows.map(row => `<tr>${row.map(cell => `<td>${richText(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  function renderCallout(callout) {
    if (!callout) return '';
    const type = callout.type === 'warning' ? 'warning-box' : 'info-box';
    return `<div class="info-box ${type}"><strong>${richText(callout.title || 'معلومة مهمة')}</strong><p>${richText(callout.text || '')}</p></div>`;
  }

  function renderSection(section, index) {
    return `<section class="lesson-section">
      <h3><span class="section-index">${String(index + 1).padStart(2, '0')}</span>${richText(section.title)}</h3>
      ${renderParagraphs(section.paragraphs)}
      ${section.paragraphs2 ? renderParagraphs(section.paragraphs2) : ''}
      ${section.bullets?.length ? `<ul>${section.bullets.map(item => `<li>${richText(item)}</li>`).join('')}</ul>` : ''}
      ${section.formula ? `<div class="formula-box">${escapeHTML(section.formula).replace(/\n/g, '<br>')}</div>` : ''}
      ${renderTable(section.table)}
      ${renderCards(section.cards)}
      ${section.example ? `<div class="info-box"><strong>مثال من الحياة</strong><p>${richText(section.example)}</p></div>` : ''}
      ${renderCallout(section.callout)}
    </section>`;
  }

  function visualMarkup(visual) {
    const baseCaption = '<span class="visual-caption">رسم توضيحي تفاعلي مبسط</span>';
    if (visual === 'water-cycle') return `<div class="lesson-visual"><div class="water-cycle-art"><div class="cycle-sun"></div><div class="cycle-cloud"></div><span class="cycle-arrow arrow-up">➜</span><span class="cycle-arrow arrow-right">➜</span><span class="cycle-arrow arrow-down">➜</span><i class="droplet"></i><i class="droplet"></i><i class="droplet"></i><div class="cycle-sea"></div></div>${baseCaption}</div>`;
    if (visual === 'molecule') return `<div class="lesson-visual"><div class="molecule"><div class="bond left"></div><div class="bond right"></div><div class="atom atom-o">O</div><div class="atom atom-h left">H</div><div class="atom atom-h right">H</div><span class="charge left">δ+</span><span class="charge right">δ+</span><span class="charge" style="left:94px;top:39px">δ−</span></div>${baseCaption}</div>`;
    if (visual === 'layers') return `<div class="lesson-visual"><div class="layers-stack"><div class="layer-row" style="background:#365d89"><b>Exosphere</b><small>500+ km</small></div><div class="layer-row" style="background:#5369a4"><b>Thermosphere</b><small>85–500 km</small></div><div class="layer-row" style="background:#437f9d"><b>Mesosphere</b><small>50–85 km</small></div><div class="layer-row" style="background:#328d91"><b>Stratosphere</b><small>12–50 km</small></div><div class="layer-row" style="background:#3b9b82"><b>Troposphere</b><small>0–12 km</small></div></div>${baseCaption}</div>`;
    if (visual === 'ozone') return `<div class="lesson-visual"><div class="ozone-atoms"><div class="oxygen-particle">O₂</div><span class="reaction-arrow">→</span><div class="reaction-result show"><i class="oxygen-particle small">O</i><i class="oxygen-particle small">O</i></div><span class="reaction-plus">+</span><span class="uv-rays active">UV ✦</span></div>${baseCaption}</div>`;
    if (visual === 'density') return `<div class="lesson-visual"><div class="water-beaker"><div class="beaker-liquid"></div><div class="ice-cube"></div><div class="beaker-label">H₂O</div></div>${baseCaption}</div>`;
    if (visual === 'pressure') return `<div class="lesson-visual"><div class="pressure-depth"><div class="depth-line" style="top:25%"></div><div class="depth-line" style="top:50%"></div><div class="depth-line" style="top:75%"></div><span class="diver" style="top:45%">◉</span><span class="pressure-value">P = ρgh</span></div>${baseCaption}</div>`;
    if (visual === 'osmosis') return `<div class="lesson-visual"><div class="solution-side left"></div><div class="solution-side right"></div><div class="membrane"></div><span class="flow-arrow">⇢</span>${baseCaption}</div>`;
    if (visual === 'greenhouse') return `<div class="lesson-visual"><div class="greenhouse-sky"><div class="greenhouse-sun"></div><div class="heat-layer"></div><div class="heat-ray ray-in"></div><div class="heat-ray ray-out"></div><div class="earth-surface"></div><span class="heat-molecule" style="top:36px;right:27%">CO₂</span><span class="heat-molecule" style="top:80px;right:65%">CH₄</span></div>${baseCaption}</div>`;
    if (visual === 'gases') return `<div class="lesson-visual"><div style="display:grid;grid-template-columns:1fr 1fr;gap:35px;align-items:end"><div style="text-align:center"><span style="font:800 28px var(--latin);color:#75d8ed">O₂</span><div style="font-size:10px;color:#a9c4d0">أكسجين مذاب</div><div style="height:70px;width:95px;margin:10px auto 0;background:linear-gradient(0deg,#137da5,#65cfe0);border-radius:5px 5px 13px 13px;position:relative"><i style="position:absolute;top:13px;left:20px;color:white">○ ○</i><i style="position:absolute;top:35px;right:15px;color:white">○ ○</i></div></div><div style="text-align:center"><span style="font:800 28px var(--latin);color:#f5c878">CO₂</span><div style="font-size:10px;color:#a9c4d0">ثاني أكسيد الكربون</div><div style="height:70px;width:95px;margin:10px auto 0;background:linear-gradient(0deg,#17677d,#4fb3c5);border-radius:5px 5px 13px 13px;position:relative"><i style="position:absolute;top:13px;left:20px;color:white">○ ○</i><i style="position:absolute;top:35px;right:15px;color:white">○ ○</i></div></div></div>${baseCaption}</div>`;
    if (visual === 'light') return `<div class="lesson-visual"><div style="position:absolute;top:0;bottom:0;left:0;right:0;background:linear-gradient(180deg,rgba(250,201,112,.22),rgba(27,126,169,.25) 44%,rgba(4,17,42,.7))"></div><div style="position:absolute;top:14px;left:23%;font-size:27px;color:#ffd57a">☀</div><div style="position:absolute;top:65px;right:15%;left:15%;height:1px;background:linear-gradient(90deg,#fa7676,#f6c26a,#b8df84,#6fd4d5,#7898f5);box-shadow:0 0 16px #64b9e7"></div><div style="position:absolute;bottom:22px;right:18%;left:18%;display:flex;justify-content:space-between;color:#cceaf4;font-size:10px"><span>Photic Zone</span><span>Aphotic Zone</span></div>${baseCaption}</div>`;
    if (visual === 'cell') return `<div class="lesson-visual"><div style="width:200px;height:120px;border:3px solid #80cfa8;border-radius:50%;background:rgba(70,151,130,.13);position:relative;box-shadow:inset 0 0 30px rgba(80,200,160,.1)"><span style="position:absolute;top:34px;right:75px;width:42px;height:42px;border-radius:50%;background:rgba(162,152,255,.5);border:1px solid #b3a7ff"></span><span style="position:absolute;top:15px;right:23px;width:22px;height:11px;border-radius:50%;background:#df9a75"></span><span style="position:absolute;bottom:18px;left:33px;width:24px;height:10px;border-radius:50%;background:#e2b36b"></span></div>${baseCaption}</div>`;
    if (visual === 'fish' || visual === 'ecosystem') return `<div class="lesson-visual"><div style="font-size:54px;filter:drop-shadow(0 5px 12px rgba(0,0,0,.2));animation:float 4s ease-in-out infinite">${visual === 'fish' ? '🐟' : '🐠　🪸　🐟'}</div><div style="position:absolute;bottom:24px;right:16%;left:16%;height:22px;background:linear-gradient(90deg,#176b78,#47af9c);border-radius:50% 50% 0 0"></div>${baseCaption}</div>`;
    if (visual === 'atmosphere') return `<div class="lesson-visual"><div style="width:240px;height:130px;position:relative;border-radius:100% 100% 8px 8px;background:linear-gradient(180deg,rgba(125,161,241,.12),rgba(63,181,186,.23));border-top:1px solid rgba(136,199,245,.6)"><div style="position:absolute;top:14px;left:18px;color:#f6c66d">☀</div><div style="position:absolute;top:44px;right:45px;color:#bbdff4">☁</div><div style="position:absolute;bottom:0;right:0;left:0;height:17px;background:#3e9d83;border-radius:50% 50% 0 0"></div></div>${baseCaption}</div>`;
    return '';
  }

  function renderLesson() {
    const lesson = lessons.find(item => item.id === activeLesson) || lessons[0];
    if (!lesson) return;
    const unitName = lesson.unit === 1 ? 'UNIT 01 • AQUATIC ECOSYSTEMS' : 'UNIT 02 • THE ATMOSPHERE';
    const goals = lesson.goals?.length ? `<div class="info-box"><strong>هتتعلم إيه في الدرس؟</strong><ul>${lesson.goals.map(goal => `<li>${richText(goal)}</li>`).join('')}</ul></div>` : '';
    const content = `<div class="lesson-hero">
      <div class="lesson-unit">${unitName} — الدرس ${String(lesson.id).padStart(2, '0')}</div>
      <h2>${escapeHTML(lesson.title)}</h2><div class="lesson-en">${escapeHTML(lesson.en)}</div>
      <p class="lesson-intro">${escapeHTML(lesson.intro)}</p>
      <div class="lesson-badges"><span>${escapeHTML(lesson.tag)}</span><span>${lesson.sections.length} محاور شرح</span><span>${lesson.quiz.length} أسئلة تدريبية</span></div>
    </div>
    ${visualMarkup(lesson.visual)}
    ${goals}
    ${lesson.sections.map(renderSection).join('')}
    <div class="lesson-bottom-nav"><button data-lesson-prev ${lesson.id === 1 ? 'disabled' : ''}>→ الدرس السابق</button><button data-open-quiz>اختبر فهمك لهذا الدرس ✎</button><button data-lesson-next ${lesson.id === lessons.length ? 'disabled' : ''}>الدرس التالي ←</button></div>`;
    $('#lesson-content').innerHTML = content;
    $('#crumb-current').textContent = lesson.title;
    $('#lesson-keywords').innerHTML = lesson.keywords.map(word => `<span>${escapeHTML(word)}</span>`).join('');
    $('#study-tip').textContent = lesson.tip;
    $('#lesson-progress-value').textContent = completed.has(lesson.id) ? '100%' : '0%';
    $('#lesson-progress-bar').style.width = completed.has(lesson.id) ? '100%' : '0%';
    $('#lesson-progress-text').textContent = completed.has(lesson.id) ? 'أحسنت! هذا الدرس مكتمل.' : 'علّم الدرس كمكتمل بعد المذاكرة.';
    $('#complete-lesson').textContent = completed.has(lesson.id) ? '✓ الدرس مكتمل — اضغط لإلغاء' : '✓ علّمت الدرس كمكتمل';
    renderLessonNav();
  }

  function renderLessonNav() {
    const unitOne = lessons.filter(lesson => lesson.unit === 1);
    const unitTwo = lessons.filter(lesson => lesson.unit === 2);
    const makeGroup = (items, label) => `<div class="unit-label">${label}</div>${items.map(lesson => `<button class="lesson-link ${lesson.id === activeLesson ? 'active' : ''} ${completed.has(lesson.id) ? 'done' : ''}" data-lesson="${lesson.id}"><span class="lesson-number">${completed.has(lesson.id) ? '✓' : String(lesson.id).padStart(2, '0')}</span><span>${escapeHTML(lesson.title)}</span></button>`).join('')}`;
    $('#lesson-nav').innerHTML = makeGroup(unitOne, 'UNIT 01 • النظام البيئي المائي') + makeGroup(unitTwo, 'UNIT 02 • الغلاف الجوي');
  }

  function updateProgress() {
    const percentage = Math.round((completed.size / lessons.length) * 100);
    $('#sidebar-percent').textContent = `${percentage}%`;
    $('#sidebar-ring').style.background = `conic-gradient(var(--aqua) ${percentage * 3.6}deg,rgba(255,255,255,.1) 0deg)`;
    $('#sidebar-progress-label').textContent = completed.size ? `${completed.size} من ${lessons.length} دروس مكتملة` : 'ابدأ أول درس';
    $('#stat-progress').innerHTML = `${percentage}<span>%</span>`;
    renderLessonNav();
    renderMap();
  }

  function setView(view) {
    if (!$('#view-' + view)) return;
    activeView = view;
    $$('.view-panel').forEach(panel => panel.classList.toggle('active', panel.id === `view-${view}`));
    $$('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.view === view));
    const names = {learn:'المحتوى التعليمي',lab:'المعمل التفاعلي',quiz:'مركز الاختبارات',glossary:'قاموس المصطلحات',map:'خريطة المنهج'};
    $('#crumb-current').textContent = names[view] || '';
    if (view === 'lab') renderLab(activeLab);
    if (view === 'quiz') renderQuiz();
    if (view === 'glossary') renderGlossary();
    if (view === 'map') renderMap();
    $('#sidebar').classList.remove('open');
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function renderMap() {
    const groups = [
      {unit:1,title:'النظام البيئي المائي',en:'Aquatic Ecosystems',desc:'10 دروس • الماء والحياة في البيئات المائية'},
      {unit:2,title:'الغلاف الجوي',en:'The Atmosphere',desc:'4 دروس • مكونات الجو وتفاعلاته واستدامته'}
    ];
    $('#curriculum-map').innerHTML = groups.map(group => {
      const items = lessons.filter(lesson => lesson.unit === group.unit);
      return `<section class="map-unit"><div class="map-unit-head"><span class="map-unit-number">0${group.unit}</span><div><strong>${group.title}</strong><small>${group.en} • ${group.desc}</small></div></div>${items.map(lesson => `<button class="map-lesson" data-map-lesson="${lesson.id}"><span class="map-num">${String(lesson.id).padStart(2,'0')}</span><span>${escapeHTML(lesson.title)}</span><span class="map-check">${completed.has(lesson.id) ? '✓' : '›'}</span></button>`).join('')}</section>`;
    }).join('');
  }

  function renderGlossary(filter = '') {
    const term = filter.trim().toLowerCase();
    const entries = glossary.filter(item => !term || item.join(' ').toLowerCase().includes(term));
    $('#glossary-count').textContent = `${entries.length} مصطلح`;
    $('#glossary-grid').innerHTML = entries.map((item, index) => `<button class="glossary-card" data-glossary-index="${glossary.indexOf(item)}"><strong>${escapeHTML(item[0])}</strong><span>${escapeHTML(item[1])}</span><small>${escapeHTML(item[2])}</small></button>`).join('') || '<p class="empty-state">لا توجد نتائج مطابقة. جرّب كتابة المصطلح بالإنجليزية أو العربية.</p>';
  }

  function openTerm(term) {
    const entry = findTerm(term);
    if (!entry) { showToast('المصطلح غير موجود في القاموس حاليًا.'); return; }
    $('#dialog-term').textContent = entry[0];
    $('#dialog-ar').textContent = entry[1];
    $('#dialog-desc').textContent = entry[2];
    $('#dialog-example').textContent = `مثال: ${entry[3]}`;
    $('#term-dialog').showModal();
  }

  function renderQuiz() {
    const select = $('#quiz-lesson-select');
    if (!select.dataset.ready) {
      select.innerHTML = '<option value="all">كل المنهج</option>' + lessons.map(lesson => `<option value="${lesson.id}">الدرس ${lesson.id}: ${escapeHTML(lesson.title)}</option>`).join('');
      select.dataset.ready = '1';
    }
    let questions = [];
    const filter = select.value;
    lessons.forEach(lesson => {
      if (filter === 'all' || Number(filter) === lesson.id) {
        lesson.quiz.forEach((question, index) => questions.push({ ...question, lessonId:lesson.id, lessonTitle:lesson.title, key:`${lesson.id}-${index}` }));
      }
    });
    if (quizOrder.length && filter === 'all') {
      const rank = new Map(quizOrder.map((key,index) => [key,index]));
      questions.sort((a,b) => (rank.get(a.key) ?? 9999) - (rank.get(b.key) ?? 9999));
    }
    $('#quiz-count').textContent = `${questions.length} سؤالًا`;
    $('#stat-questions').innerHTML = `${lessons.reduce((total, lesson) => total + lesson.quiz.length, 0)} <span>سؤالًا</span>`;
    $('#quiz-area').innerHTML = questions.map((question, index) => {
      const chosen = answered.get(question.key);
      const hasAnswer = chosen !== undefined;
      const correct = hasAnswer && chosen === question.a;
      return `<article class="question-card" data-question="${question.key}">
        <div class="question-meta"><span>${escapeHTML(question.lessonTitle)}</span><span>سؤال ${index + 1}</span></div>
        <h3>${escapeHTML(question.q)}</h3>
        <div class="answers">${question.o.map((option, optionIndex) => {
          const state = hasAnswer && optionIndex === question.a ? 'correct' : hasAnswer && optionIndex === chosen ? 'wrong' : '';
          return `<button class="answer-option ${state}" data-answer="${optionIndex}" ${hasAnswer ? 'disabled' : ''}><span class="letter">${String.fromCharCode(65 + optionIndex)}</span><span>${escapeHTML(option)}</span></button>`;
        }).join('')}</div>
        <div class="answer-feedback ${hasAnswer ? 'show' : ''}">${hasAnswer ? (correct ? '✓ إجابة صحيحة. ' : 'ليست الإجابة الصحيحة. ') + escapeHTML(question.e) : ''}</div>
      </article>`;
    }).join('');
  }

  function allQuestions() {
    return lessons.flatMap(lesson => lesson.quiz.map((question,index) => ({ ...question, key:`${lesson.id}-${index}`, lessonId:lesson.id })));
  }

  function labTabMarkup() {
    $('#lab-tabs').innerHTML = labs.map(lab => `<button class="lab-tab ${lab.id === activeLab ? 'active' : ''}" data-lab="${lab.id}">${escapeHTML(lab.title)}</button>`).join('');
  }

  function labHead(lab) {
    return `<div class="lab-head"><div><h3>${escapeHTML(lab.title)}</h3><p>${escapeHTML(lab.desc)}</p></div><span class="lab-badge">SIMULATION • LESSON ${String(lab.lesson).padStart(2,'0')}</span></div>`;
  }

  function sliderControl(id,label,min,max,value,output,step='1') {
    return `<div class="control-row"><label for="${id}"><span>${label}</span><output id="${id}-out">${output}</output></label><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"></div>`;
  }

  function labWorkspace(simulator, controls, explanation) {
    return `<div class="lab-workspace"><div class="simulator">${simulator}</div><div class="controls-panel">${controls}<div class="lab-explain" id="lab-explain">${explanation}</div></div></div>`;
  }

  function renderLab(id = activeLab) {
    const lab = labs.find(item => item.id === id) || labs[0];
    if (!lab) return;
    activeLab = lab.id;
    labTabMarkup();
    let simulator = '';
    let controls = '';
    let explanation = '';

    if (lab.kind === 'water') {
      simulator = `<div class="water-cycle-art"><div class="cycle-sun"></div><div class="cycle-cloud"></div><span class="cycle-arrow arrow-up">➜</span><span class="cycle-arrow arrow-right">➜</span><span class="cycle-arrow arrow-down">➜</span><i class="droplet"></i><i class="droplet"></i><i class="droplet"></i><div class="cycle-sea"></div></div><span class="sim-note">التبخر ↑ • التكاثف ☁ • الهطول ↓</span>`;
      controls = sliderControl('water-temp','درجة حرارة السطح',0,40,24,'24 °C') + sliderControl('water-humidity','الرطوبة النسبية',10,100,45,'45%') + sliderControl('water-wind','سرعة حركة الهواء',0,10,4,'4 وحدات');
      explanation = 'عندما ترتفع الحرارة يزيد معدل التبخر غالبًا. ارتفاع الرطوبة يقلل فرق بخار الماء بين السطح والهواء، والهواء المتحرك يساعد على نقل البخار بعيدًا عن السطح.';
    }
    if (lab.kind === 'molecule') {
      simulator = `<div class="molecule" id="lab-molecule"><div class="bond left"></div><div class="bond right"></div><div class="atom atom-o">O</div><div class="atom atom-h left" id="hydrogen-left">H</div><div class="atom atom-h right" id="hydrogen-right">H</div><span class="charge left">δ+</span><span class="charge right">δ+</span><span class="charge" style="left:94px;top:39px">δ−</span><div class="dipole-arrow"></div><span class="sim-note">اتجاه القطبية نحو جانب الأكسجين</span></div>`;
      controls = sliderControl('molecule-angle','زاوية H–O–H',90,120,104.5,'104.5°','0.5');
      explanation = 'الزاوية الطبيعية لجزيء الماء تقارب 104.5°. ذرة الأكسجين تجذب الإلكترونات بقوة أكبر؛ لذلك يكون جانبها سالبًا جزئيًا، ويكون الجزيء قطبيًا.';
    }
    if (lab.kind === 'ozone') {
      ozonePhase = 0;
      simulator = `<div class="uv-rays" id="uv-rays">UV ✦ أشعة فوق بنفسجية</div><div class="ozone-atoms"><div class="oxygen-particle" id="ozone-reactant">O₂</div><span class="reaction-arrow">→</span><div class="reaction-result" id="ozone-products"><i class="oxygen-particle small">O</i><i class="oxygen-particle small">O</i></div><span class="reaction-plus">+</span><div class="reaction-result" id="ozone-final"><i class="oxygen-particle small">O₃</i></div></div><span class="sim-note" id="ozone-caption">ابدأ بتشغيل الأشعة فوق البنفسجية</span>`;
      controls = `<div class="control-row"><label><span>المرحلة الحالية</span><output id="ozone-step">0 / 2</output></label><div class="lab-actions"><button data-lab-action="uv">1. تشغيل UV</button><button data-lab-action="form-ozone">2. تكوين O₃</button><button data-lab-action="reset-ozone">إعادة التجربة ↻</button></div></div>`;
      explanation = 'في الخطوة الأولى يمتص O₂ فوتونًا فيتفكك إلى ذرتي أكسجين: O₂ + hν → O + O. في الخطوة الثانية تتحد ذرة O مع جزيء O₂ لتكوين O₃، ويساعد جزيء ثالث M على حمل الطاقة الزائدة.';
    }
    if (lab.kind === 'density') {
      simulator = `<span class="density-readout" id="density-readout">ρ = 1000 kg/m³</span><div class="water-beaker"><div class="beaker-liquid" id="density-liquid"></div><div class="ice-cube" id="density-ice"></div><div class="beaker-label" id="density-state">H₂O • سائل</div></div><span class="sim-note">قمة كثافة الماء السائل تكون قرب 4°C</span>`;
      controls = sliderControl('density-temp','درجة الحرارة',-5,30,4,'4 °C','1');
      explanation = 'للماء سلوك غير معتاد: تصل كثافة الماء السائل إلى قيمة عظمى قرب 4°C. عند التجمد تتكون بنية بلورية مفتوحة، فتصبح كثافة الجليد أقل من الماء السائل ويطفو.';
    }
    if (lab.kind === 'osmosis') {
      simulator = `<div class="solution-side left"></div><div class="solution-side right"></div><div class="membrane"></div><div id="osmosis-arrow" class="flow-arrow">⇢</div><span class="pressure-value" id="osmosis-label">الماء: A → B</span><span class="sim-note">الغشاء يسمح بمرور الماء ولا يسمح بمرور كل المذاب</span>`;
      controls = sliderControl('osmosis-a','تركيز المذاب في A',0,10,2,'2 وحدات') + sliderControl('osmosis-b','تركيز المذاب في B',0,10,7,'7 وحدات');
      explanation = 'يتحرك الماء صافيًا عبر الغشاء من الجانب الأقل تركيزًا بالمذاب إلى الجانب الأعلى تركيزًا بالمذاب. إذا تساوى التركيزان، لا يوجد اتجاه صافٍ مفضل في النموذج.';
    }
    if (lab.kind === 'ph') {
      simulator = `<div class="ph-scale"><div class="ph-gradient"><span id="ph-marker" class="ph-marker" style="left:50%"></span></div><div class="ph-labels"><span>0 Acidic</span><span>7 Neutral</span><span>14 Basic</span></div><div class="ph-current" id="ph-current">7</div><div class="ph-state" id="ph-state">متعادل تقريبًا</div></div><span class="sim-note">مقياس توضيحي — لا تختبر مواد منزلية مجهولة</span>`;
      controls = sliderControl('ph-value','قيمة pH',0,14,7,'7');
      explanation = 'عند 25°C: أقل من 7 حمضي، 7 متعادل، أكبر من 7 قاعدي. مقياس pH لوغاريتمي؛ فرق وحدة واحدة يعني فرقًا بعشرة أضعاف في تركيز H₃O⁺.';
    }
    if (lab.kind === 'pressure') {
      simulator = `<div class="pressure-depth"><div class="depth-line" style="top:25%"></div><div class="depth-line" style="top:50%"></div><div class="depth-line" style="top:75%"></div><span id="pressure-diver" class="diver" style="top:12%">◉</span><span class="pressure-value" id="pressure-value">1.0 atm تقريبًا</span></div><span class="sim-note">السطح أعلى الرسم • القاع أسفل الرسم</span>`;
      controls = sliderControl('pressure-depth-input','العمق',0,100,0,'0 m') + '<div class="control-row"><label><span>الضغط الكلي التقريبي</span><output id="pressure-kpa">101.3 kPa</output></label></div>';
      explanation = 'ضغط الماء يزداد بزيادة العمق: P = ρgh. عند إضافة الضغط الجوي على السطح نحصل على الضغط الكلي. في ماء البحر تزداد القيمة بنحو 1 atm تقريبًا لكل 10 m.';
    }
    if (lab.kind === 'gases') {
      simulator = `<div class="water-beaker"><div class="beaker-liquid" id="gas-liquid"></div><div class="beaker-label">O₂ dissolved</div><div class="salt-particles"><i></i><i></i><i></i><i></i><i></i></div></div><div class="ph-current" id="gas-value" style="font-size:25px">9.1</div><span class="sim-note">قيمة إرشادية تقريبية للأكسجين المشبع في الماء العذب عند ضغط قريب من سطح البحر (mg/L)</span>`;
      controls = sliderControl('gas-temp','درجة حرارة الماء',0,35,20,'20 °C','1');
      explanation = 'في الماء العذب وعند ضغط قريب من الضغط الجوي، تقل ذوبانية الأكسجين مع ارتفاع درجة الحرارة. القيمة الفعلية تتأثر أيضًا بالملوحة والضغط والاضطراب والعمق.';
    }
    if (lab.kind === 'greenhouse') {
      simulator = `<div class="greenhouse-sky"><div class="greenhouse-sun"></div><div class="heat-layer" id="greenhouse-layer"></div><div class="heat-ray ray-in"></div><div class="heat-ray ray-out" id="greenhouse-ray"></div><div class="earth-surface"></div><span class="heat-molecule" style="top:36px;right:27%">CO₂</span><span class="heat-molecule" style="top:80px;right:65%">CH₄</span></div><span class="sim-note">نموذج مفاهيمي مبسط لتوازن الطاقة</span>`;
      controls = sliderControl('greenhouse-level','مستوى غازات الدفيئة (نسبي)',0,100,50,'50%');
      explanation = 'غازات الدفيئة تمتص جزءًا من الأشعة تحت الحمراء المنبعثة من سطح الأرض وتعيد إصدارها. هذا نموذج تعليمي مبسط ولا يحسب درجة حرارة حقيقية أو توقعًا مناخيًا.';
    }
    if (lab.kind === 'layers') {
      simulator = `<div class="layers-stack">${[['Exosphere','500+ km','#5369a4'],['Thermosphere','85–500 km','#5369a4'],['Mesosphere','50–85 km','#437f9d'],['Stratosphere','12–50 km','#328d91'],['Troposphere','0–12 km','#3b9b82']].map((row,index)=>`<div class="layer-row" style="background:${row[2]}"><b>${row[0]}</b><small>${row[1]}</small></div>`).join('')}</div><span class="sim-note">اضغط على طبقة من القائمة لاكتشاف ما يميزها.</span>`;
      controls = `<div class="control-row"><label><span>استكشف طبقة</span><output>ATMOSPHERE</output></label><div class="layer-select-list">${[['Troposphere','تحدث فيها معظم ظواهر الطقس.'],['Stratosphere','تتركز بها طبقة الأوزون.'],['Mesosphere','تحترق فيها غالبية الشهب الصغيرة.'],['Thermosphere','تظهر فيها ظواهر الشفق القطبي.'],['Exosphere','الطبقة الخارجية المتدرجة نحو الفضاء.']].map(item=>`<button class="answer-option" data-layer="${item[0]}">${item[0]}</button>`).join('')}</div></div>`;
      explanation = 'تختلف الطبقات بحسب تغير درجة الحرارة مع الارتفاع. الأرقام تقريبية؛ والارتفاعات والحدود تتغير مع خط العرض والفصل والنشاط الشمسي.';
    }
    $('#lab-stage').innerHTML = labHead(lab) + labWorkspace(simulator, controls, explanation);
    $$('#experiment-grid').forEach(() => {});
    if (lab.kind === 'water') updateWater();
    if (lab.kind === 'molecule') updateMolecule();
    if (lab.kind === 'density') updateDensity();
    if (lab.kind === 'osmosis') updateOsmosis();
    if (lab.kind === 'ph') updatePH();
    if (lab.kind === 'pressure') updatePressure();
    if (lab.kind === 'gases') updateGas();
    if (lab.kind === 'greenhouse') updateGreenhouse();
    renderExperiments();
  }

  function updateWater() {
    const temp = Number($('#water-temp')?.value ?? 24);
    const humidity = Number($('#water-humidity')?.value ?? 45);
    const wind = Number($('#water-wind')?.value ?? 4);
    $('#water-temp-out').textContent = `${temp} °C`;
    $('#water-humidity-out').textContent = `${humidity}%`;
    $('#water-wind-out').textContent = `${wind} وحدات`;
    const level = Math.max(0, Math.round(temp * 1.5 + wind * 3 - humidity * .25));
    const rate = level > 65 ? 'مرتفع نسبيًا' : level > 35 ? 'متوسط' : 'منخفض نسبيًا';
    $('#lab-explain').innerHTML = `<strong>معدل التبخر في النموذج: ${rate}.</strong> الحرارة ${temp}°C ترفع ميل الماء للتبخر، والرطوبة ${humidity}% تقلل فرق بخار الماء، وحركة الهواء ${wind} تساعد على نقل البخار بعيدًا عن السطح.`;
  }

  function updateMolecule() {
    const angle = Number($('#molecule-angle')?.value ?? 104.5);
    $('#molecule-angle-out').textContent = `${angle.toFixed(1)}°`;
    const extra = angle - 104.5;
    const left = $('#hydrogen-left');
    const right = $('#hydrogen-right');
    if (left && right) {
      left.style.transform = `translate(${-extra * .28}px, ${extra * .18}px)`;
      right.style.transform = `translate(${extra * .28}px, ${extra * .18}px)`;
    }
    $('#lab-explain').innerHTML = `<strong>زاوية الجزيء: ${angle.toFixed(1)}°.</strong> الزاوية الطبيعية تقارب 104.5°. تغيير المؤشر هنا لأغراض التصور فقط؛ شكل جزيء الماء الحقيقي تحدده قوى الترابط والبنية الإلكترونية، وليس زرًا قابلًا للتغيير في الظروف العادية.`;
  }

  function updateOzone() {
    $('#ozone-step').textContent = `${ozonePhase} / 2`;
    $('#ozone-products')?.classList.toggle('show', ozonePhase >= 1);
    $('#ozone-final')?.classList.toggle('show', ozonePhase >= 2);
    $('#uv-rays')?.classList.toggle('active', ozonePhase >= 1);
    $('#ozone-caption').textContent = ozonePhase === 0 ? 'ابدأ بتشغيل الأشعة فوق البنفسجية' : ozonePhase === 1 ? 'تفكك O₂: تكوّنت ذرتا أكسجين O' : 'اتحاد O مع O₂: تكوّن الأوزون O₃';
    if (ozonePhase === 1) $('#lab-explain').innerHTML = '<strong>الخطوة الأولى:</strong> امتص جزيء الأكسجين فوتونًا من الأشعة فوق البنفسجية، فانفصل إلى ذرتي أكسجين: O₂ + hν → O + O.';
    if (ozonePhase === 2) $('#lab-explain').innerHTML = '<strong>الخطوة الثانية:</strong> تتحد ذرة أكسجين مع جزيء O₂. وجود جزيء ثالث M يساعد على تبديد الطاقة الزائدة: O + O₂ + M → O₃ + M.';
  }

  function waterDensity(temp) {
    if (temp < 0) return 917;
    const t = temp;
    return 1000 * (1 - ((t + 288.9414) / (508929.2 * (t + 68.12963))) * Math.pow(t - 3.9863, 2));
  }

  function updateDensity() {
    const temp = Number($('#density-temp')?.value ?? 4);
    $('#density-temp-out').textContent = `${temp} °C`;
    const density = waterDensity(temp);
    $('#density-readout').textContent = `ρ ≈ ${Math.round(density)} kg/m³`;
    const ice = $('#density-ice');
    const state = $('#density-state');
    const liquid = $('#density-liquid');
    if (temp < 0) {
      ice.style.display = 'block';
      ice.style.bottom = '25px';
      state.textContent = 'جليد • كثافة أقل';
      liquid.style.height = '45%';
      $('#lab-explain').innerHTML = '<strong>الماء في حالة جليد.</strong> النموذج يعرض كثافة تقريبية للجليد 917 kg/m³، وهي أقل من كثافة الماء السائل قرب 4°C؛ لذلك يطفو الجليد.';
    } else {
      ice.style.display = 'none';
      state.textContent = temp === 4 ? 'أعلى كثافة تقريبًا' : 'H₂O • سائل';
      liquid.style.height = '64%';
      const relation = temp === 4 ? 'قريب من أعلى كثافة للماء السائل.' : temp < 4 ? 'عند الاقتراب من التجمد تقل الكثافة عن قيمتها القصوى.' : 'مع الابتعاد عن 4°C نحو درجات أعلى تقل الكثافة تدريجيًا في هذا النطاق.';
      $('#lab-explain').innerHTML = `<strong>${relation}</strong> قراءة النموذج ≈ ${density.toFixed(1)} kg/m³. عند 4°C تقريبًا تبلغ كثافة الماء السائل أقصاها.`;
    }
  }

  function updateOsmosis() {
    const a = Number($('#osmosis-a')?.value ?? 2);
    const b = Number($('#osmosis-b')?.value ?? 7);
    $('#osmosis-a-out').textContent = `${a} وحدات`;
    $('#osmosis-b-out').textContent = `${b} وحدات`;
    const arrow = $('#osmosis-arrow');
    if (a < b) {
      arrow.textContent = '⇢'; arrow.style.left = '43%';
      $('#osmosis-label').textContent = 'الماء: A → B';
      $('#lab-explain').innerHTML = `<strong>الاتجاه الصافي: من A إلى B.</strong> تركيز المذاب في A = ${a}، وفي B = ${b}. الماء يتحرك نحو الجانب الأعلى تركيزًا بالمذاب.`;
    } else if (a > b) {
      arrow.textContent = '⇠'; arrow.style.left = '50%';
      $('#osmosis-label').textContent = 'الماء: B → A';
      $('#lab-explain').innerHTML = `<strong>الاتجاه الصافي: من B إلى A.</strong> تركيز المذاب في A = ${a}، وفي B = ${b}. الماء يتحرك نحو الجانب الأعلى تركيزًا بالمذاب.`;
    } else {
      arrow.textContent = '↔'; arrow.style.left = '47%';
      $('#osmosis-label').textContent = 'لا اتجاه صافٍ مفضل';
      $('#lab-explain').innerHTML = `<strong>التركيزان متساويان.</strong> لا يوجد في هذا النموذج اتجاه صافٍ مفضل لحركة الماء.`;
    }
  }

  function updatePH() {
    const value = Number($('#ph-value')?.value ?? 7);
    $('#ph-value-out').textContent = value;
    $('#ph-current').textContent = value;
    $('#ph-marker').style.left = `${(value / 14) * 100}%`;
    const state = value < 7 ? 'حمضي' : value > 7 ? 'قاعدي' : 'متعادل تقريبًا';
    $('#ph-state').textContent = state;
    $('#lab-explain').innerHTML = `<strong>pH = ${value} (${state}).</strong> ${value < 7 ? 'تركيز H₃O⁺ أكبر نسبيًا من الماء المتعادل.' : value > 7 ? 'تركيز OH⁻ أكبر نسبيًا من الماء المتعادل.' : 'تركيزا H₃O⁺ وOH⁻ متساويان تقريبًا عند 25°C.'} تذكّر أن المقياس لوغاريتمي.`;
  }

  function updatePressure() {
    const depth = Number($('#pressure-depth-input')?.value ?? 0);
    $('#pressure-depth-input-out').textContent = `${depth} m`;
    const totalAtm = 1 + depth / 10;
    const kpa = 101.3 + 9.8 * depth;
    $('#pressure-value').textContent = `${totalAtm.toFixed(1)} atm تقريبًا`;
    $('#pressure-kpa').textContent = `${kpa.toFixed(1)} kPa`;
    $('#pressure-diver').style.top = `${12 + depth * .72}%`;
    $('#lab-explain').innerHTML = `<strong>على عمق ${depth} m: الضغط الكلي ≈ ${totalAtm.toFixed(1)} atm أو ${kpa.toFixed(1)} kPa.</strong> استخدمنا قاعدة تقريبية لماء البحر: يضاف نحو 1 atm لكل 10 m. القيم تقريبية للتعلم فقط.`;
  }

  function oxygenSaturation(temp) {
    const points = [[0,14.6],[5,12.8],[10,11.3],[15,10.1],[20,9.1],[25,8.3],[30,7.6],[35,7.0]];
    for (let i = 0; i < points.length - 1; i++) {
      const [t1,v1] = points[i], [t2,v2] = points[i+1];
      if (temp >= t1 && temp <= t2) return v1 + (v2-v1) * ((temp-t1)/(t2-t1));
    }
    return points[points.length-1][1];
  }

  function updateGas() {
    const temp = Number($('#gas-temp')?.value ?? 20);
    const value = oxygenSaturation(temp);
    $('#gas-temp-out').textContent = `${temp} °C`;
    $('#gas-value').textContent = `${value.toFixed(1)} mg/L`;
    $('#gas-liquid').style.height = `${40 + value * 3}%`;
    $('#lab-explain').innerHTML = `<strong>ذوبانية مشبعة تقريبية: ${value.toFixed(1)} mg/L.</strong> في الماء العذب عند ضغط قريب من سطح البحر، تقل كمية الأكسجين التي يستطيع الماء الاحتفاظ بها كلما ارتفعت الحرارة. هذه قيم تقريبية وليست قراءة ميدانية.`;
  }

  function updateGreenhouse() {
    const level = Number($('#greenhouse-level')?.value ?? 50);
    $('#greenhouse-level-out').textContent = `${level}%`;
    const layer = $('#greenhouse-layer');
    if (layer) layer.style.borderColor = `rgba(102,213,202,${.15 + level / 125})`;
    const ray = $('#greenhouse-ray');
    if (ray) ray.style.opacity = `${Math.max(.18, 1 - level / 130)}`;
    $('#lab-explain').innerHTML = `<strong>مستوى الغازات في النموذج: ${level}%.</strong> عند زيادة غازات الدفيئة في النموذج يزداد امتصاص وإعادة إصدار جزء من الأشعة تحت الحمراء. هذا شرح للفكرة وليس مقياسًا حقيقيًا لدرجة حرارة الأرض.`;
  }

  function renderExperiments() {
    $('#experiment-grid').innerHTML = experiments.map(exp => `<article class="experiment-card"><div class="exp-icon">${exp.icon}</div><h4>${escapeHTML(exp.title)}</h4><p>${escapeHTML(exp.time)} • الدرس ${exp.lesson}</p><button data-experiment="${exp.id}">اعرض خطوات التجربة ←</button></article>`).join('');
  }

  function showExperiment(id) {
    const exp = experiments.find(item => item.id === id);
    if (!exp) return;
    const old = $('#experiment-detail');
    if (old) old.remove();
    const detail = document.createElement('article');
    detail.className = 'experiment-detail';
    detail.id = 'experiment-detail';
    detail.innerHTML = `<h4>${exp.icon} ${escapeHTML(exp.title)}</h4><p class="materials"><strong>الأدوات:</strong> ${escapeHTML(exp.materials)} <span> • ${escapeHTML(exp.time)}</span></p><ol>${exp.steps.map(step => `<li>${escapeHTML(step)}</li>`).join('')}</ol><p class="materials"><strong>التفسير العلمي:</strong> ${escapeHTML(exp.why)}</p><p class="caution">تنبيه: ${escapeHTML(exp.caution)}</p><button class="outline-btn" data-close-experiment>إغلاق التفاصيل ×</button>`;
    $('#experiment-grid').after(detail);
    detail.scrollIntoView({behavior:'smooth',block:'nearest'});
  }

  // Main delegated events keep dynamically rendered controls working.
  document.addEventListener('click', event => {
    const target = event.target.closest('button');
    if (!target) return;

    if (target.dataset.view) { setView(target.dataset.view); return; }
    if (target.dataset.lesson) {
      activeLesson = Number(target.dataset.lesson);
      setView('learn'); renderLesson(); return;
    }
    if (target.dataset.mapLesson) {
      activeLesson = Number(target.dataset.mapLesson);
      setView('learn'); renderLesson(); return;
    }
    if (target.dataset.jump) { setView(target.dataset.jump); return; }
    if (target.id === 'open-map') { setView('map'); return; }
    if (target.dataset.lab) { renderLab(target.dataset.lab); return; }
    if (target.dataset.term) { openTerm(target.dataset.term); return; }
    if (target.dataset.glossaryIndex !== undefined) {
      const entry = glossary[Number(target.dataset.glossaryIndex)];
      if (entry) openTerm(entry[0]);
      return;
    }
    if (target.id === 'dialog-close') { $('#term-dialog').close(); return; }
    if (target.id === 'complete-lesson') {
      if (completed.has(activeLesson)) { completed.delete(activeLesson); showToast('تم إلغاء اكتمال الدرس.'); }
      else { completed.add(activeLesson); showToast('تم حفظ الدرس كمكتمل ✓'); }
      persist(); renderLesson(); return;
    }
    if (target.hasAttribute('data-lesson-prev')) { if (activeLesson > 1) activeLesson--; renderLesson(); return; }
    if (target.hasAttribute('data-lesson-next')) { if (activeLesson < lessons.length) activeLesson++; renderLesson(); return; }
    if (target.hasAttribute('data-open-quiz')) {
      $('#quiz-lesson-select').value = String(activeLesson);
      setView('quiz'); renderQuiz(); return;
    }
    if (target.dataset.answer !== undefined) {
      const card = target.closest('.question-card');
      const key = card?.dataset.question;
      if (!key || answered.has(key)) return;
      const question = allQuestions().find(item => item.key === key);
      if (!question) return;
      answered.set(key, Number(target.dataset.answer));
      renderQuiz();
      return;
    }
    if (target.dataset.experiment) { showExperiment(target.dataset.experiment); return; }
    if (target.hasAttribute('data-close-experiment')) { $('#experiment-detail')?.remove(); return; }
    if (target.dataset.labAction === 'uv') { ozonePhase = Math.max(ozonePhase,1); updateOzone(); return; }
    if (target.dataset.labAction === 'form-ozone') {
      if (ozonePhase < 1) { showToast('شغّل الأشعة فوق البنفسجية أولًا.'); return; }
      ozonePhase = 2; updateOzone(); return;
    }
    if (target.dataset.labAction === 'reset-ozone') { ozonePhase = 0; updateOzone(); return; }
    if (target.dataset.layer) {
      const layerInfo = {
        Troposphere:'التروبوسفير: الطبقة السفلى، وتحدث فيها معظم ظواهر الطقس والسحب.',
        Stratosphere:'الستراتوسفير: تحتوي على طبقة الأوزون التي تمتص قدرًا كبيرًا من الأشعة فوق البنفسجية.',
        Mesosphere:'الميزوسفير: تحترق فيها غالبية الشهب الصغيرة أثناء دخولها الغلاف الجوي.',
        Thermosphere:'الثرموسفير: طبقة علوية ترتبط بها ظواهر الشفق القطبي.',
        Exosphere:'الإكسوسفير: الطبقة الخارجية ذات الغازات المتباعدة جدًا.'
      };
      $('#lab-explain').innerHTML = `<strong>${target.dataset.layer}.</strong> ${layerInfo[target.dataset.layer] || ''}`;
      return;
    }
    if (target.id === 'continue-learning') {
      const next = lessons.find(lesson => !completed.has(lesson.id));
      activeLesson = next?.id || 1;
      setView('learn'); renderLesson(); return;
    }
    if (target.id === 'reset-progress') {
      if (confirm('هل تريد مسح الدروس المكتملة من هذا الجهاز؟')) {
        completed.clear(); persist(); renderLesson(); showToast('تمت إعادة ضبط التقدم.');
      }
      return;
    }
    if (target.id === 'mobile-menu') { $('#sidebar').classList.toggle('open'); return; }
    if (target.id === 'theme-toggle') {
      document.body.classList.toggle('light');
      try { localStorage.setItem('science-lab-theme', document.body.classList.contains('light') ? 'light' : 'dark'); } catch {}
      target.textContent = document.body.classList.contains('light') ? '☾' : '☼';
      return;
    }
    if (target.id === 'shuffle-quiz') {
      quizOrder = allQuestions().map(question => question.key).sort(() => Math.random() - .5);
      renderQuiz(); showToast('تم خلط الأسئلة.'); return;
    }
  });

  document.addEventListener('input', event => {
    const id = event.target.id;
    if (id === 'glossary-search') { renderGlossary(event.target.value); return; }
    if (id === 'global-search') return;
    if (id === 'quiz-lesson-select') return;
    if (id.startsWith('water-')) { updateWater(); return; }
    if (id === 'molecule-angle') { updateMolecule(); return; }
    if (id === 'density-temp') { updateDensity(); return; }
    if (id.startsWith('osmosis-')) { updateOsmosis(); return; }
    if (id === 'ph-value') { updatePH(); return; }
    if (id === 'pressure-depth-input') { updatePressure(); return; }
    if (id === 'gas-temp') { updateGas(); return; }
    if (id === 'greenhouse-level') { updateGreenhouse(); return; }
  });

  $('#quiz-lesson-select').addEventListener('change', () => renderQuiz());
  $('#glossary-search').addEventListener('input', event => renderGlossary(event.target.value));
  $('#global-search').addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    const query = event.target.value.trim().toLowerCase();
    if (!query) return;
    const lesson = lessons.find(item => `${item.title} ${item.en} ${item.intro} ${item.keywords.join(' ')}`.toLowerCase().includes(query));
    const term = glossary.find(item => item.join(' ').toLowerCase().includes(query));
    if (lesson) {
      activeLesson = lesson.id; setView('learn'); renderLesson();
    } else if (term) {
      setView('glossary'); renderGlossary(query); openTerm(term[0]);
    } else {
      showToast('ملقتش نتيجة مطابقة. جرّب كلمة أقصر.');
    }
  });

  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault(); $('#global-search').focus();
    }
    if (event.key === 'Escape') $('#sidebar').classList.remove('open');
  });

  // Initialize the dashboard.
  try {
    if (localStorage.getItem('science-lab-theme') === 'light') {
      document.body.classList.add('light');
      $('#theme-toggle').textContent = '☾';
    }
  } catch {}
  $('#stat-labs').innerHTML = `${labs.length} <span>محاكاة</span>`;
  $('#stat-questions').innerHTML = `${lessons.reduce((total, lesson) => total + lesson.quiz.length, 0)} <span>سؤالًا</span>`;
  renderLessonNav();
  renderLesson();
  updateProgress();
  renderMap();
  renderGlossary();
  renderQuiz();
  renderLab(activeLab);
})();

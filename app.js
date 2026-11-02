/* AquaScience — client-side learning platform, no login, no external libraries. */
(() => {
  'use strict';
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const lessons = window.SCIENCE_LESSONS || [];
  const glossaryRaw = window.SCIENCE_GLOSSARY || [];
  const labs = window.SCIENCE_LABS || [];
  const store = {
    read(key, fallback) { try { const v=localStorage.getItem(key); return v===null?fallback:JSON.parse(v); } catch { return fallback; } },
    write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
  };
  const state = {
    view:'home', lessonId:1, labId:labs[0]?.id || 'water-distribution',
    completed:new Set(store.read('aqua-completed', [])),
    quizQuestions:[], quizIndex:0, quizScore:0, quizAnswers:[], quizDone:false,
    theme:store.read('aqua-theme','dark'), searchTerm:'', toastTimer:null
  };
  const glossary = glossaryRaw.map(row => Array.isArray(row)
    ? {en:row[0]||'', ar:row[1]||'', definition:row[2]||'', example:row[3]||''}
    : {en:row.en||row.english||'', ar:row.ar||row.arabic||'', definition:row.definition||row.meaning||'', example:row.example||''}
  );
  const refs = [
    {name:'كتاب الوزارة — المكتبة الإلكترونية',url:'https://ellibrary.moe.gov.eg/Books-sec/',note:'للوصول إلى الكتب الدراسية الرسمية المتاحة.'},
    {name:'فهرس كتاب العلوم المتكاملة للصف الأول الثانوي',url:'https://sahl.io/eg/book/1411/أول-ثانوي/العلوم-المتكاملة',note:'مطابقة ترتيب الوحدتين والدروس الـ14.'},
    {name:'USGS — توزيع الماء على الأرض',url:'https://www.usgs.gov/water-science-school/science/how-much-water-there-earth',note:'مرجع علمي لنسب خزانات الماء والمياه العذبة.'},
    {name:'USGS — دورة الماء (عربي)',url:'https://water.usgs.gov/edu/watercyclearabic.html',note:'شرح دورة الماء ومصادر المياه.'},
    {name:'NOAA — دورة الماء',url:'https://www.noaa.gov/education/resource-collections/freshwater/water-cycle',note:'التبخر والتكاثف والهطول والجريان.'},
    {name:'NOAA — طبقات الغلاف الجوي',url:'https://www.noaa.gov/jetstream/atmosphere/layers-of-atmosphere',note:'الطبقات والارتفاعات التقريبية والظواهر.'},
    {name:'NASA — كيمياء الأوزون في ضوء الشمس',url:'https://science.nasa.gov/earth/earth-observatory/chemistry-in-the-sunlight/',note:'تفكك الأكسجين وتكوين الأوزون ودور الأشعة.'},
    {name:'NASA — تأثير الاحتباس الحراري',url:'https://science.nasa.gov/climate-change/faq/what-is-the-greenhouse-effect/',note:'آلية امتصاص وإعادة إصدار الأشعة تحت الحمراء.'},
    {name:'EPA — الأمطار الحمضية',url:'https://www.epa.gov/acidrain/what-acid-rain',note:'مصادر المطر الحمضي وآثاره وطرق تقليله.'}
  ];

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const attr = value => esc(value).replace(/`/g,'&#96;');
  const termButton = name => `<button class="term-inline" data-term="${attr(name)}" title="اضغط لشرح المصطلح">${esc(name)}</button>`;
  function rich(text) {
    let safe=esc(text);
    safe=safe.replace(/\{\{([^}]+)\}\}/g,(_,t)=>termButton(t.trim()));
    safe=safe.replace(/(H₂O|O₂|O₃|CO₂|CO|SO₂|SO₃|NO₂|NO₃|N₂|H₂SO₄|HNO₃|CaCO₃|H₃O⁺|OH⁻)/g,'<strong class="chem">$1</strong>');
    safe=safe.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
    return safe;
  }
  function lessonById(id){return lessons.find(l=>l.id===Number(id));}
  function labById(id){return labs.find(l=>l.id===id);}
  function getLessonLab(id){return labs.find(l=>l.lesson===Number(id));}
  function questionsForLesson(lesson){ return [...(lesson.quiz||[])].map(q=>({...q,lessonId:lesson.id,lessonTitle:lesson.title})); }
  function allQuestions(){ return lessons.flatMap(questionsForLesson); }
  function toast(message){ const el=$('#toast'); if(!el)return; el.textContent=message;el.classList.add('show');clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>el.classList.remove('show'),2600); }
  function switchView(name){
    if(!$('#view-'+name))return;
    state.view=name;
    $$('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+name));
    $$('.nav-button').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
    const labels={home:'الرئيسية',lessons:'شرح الدروس',lab:'المعمل الافتراضي',quiz:'بنك الأسئلة',glossary:'قاموس المصطلحات',map:'خريطة المنهج'};
    $('#breadcrumb-current').textContent=labels[name]||'العلوم المتكاملة';
    $('#sidebar').classList.remove('open');
    window.scrollTo({top:0,behavior:'smooth'});
    if(name==='lessons')renderLessonBrowser();
    if(name==='lab')renderLabLibrary();
    if(name==='quiz')renderQuizSetup();
    if(name==='glossary')renderGlossary($('#glossary-search')?.value||'');
    if(name==='map')renderMap();
  }
  function renderSidebar(){
    const host=$('#lesson-tree');
    host.innerHTML=[1,2].map(unit=>`<div class="tree-unit"><div class="tree-unit-title">${unit===1?'UNIT 01 • AQUATIC':'UNIT 02 • ATMOSPHERE'}</div>${lessons.filter(l=>l.unit===unit).map(l=>`<button class="tree-lesson ${l.id===state.lessonId?'selected':''} ${state.completed.has(l.id)?'is-done':''}" data-lesson="${l.id}"><span>${String(l.id).padStart(2,'0')}</span><i>${esc(l.title)}</i>${state.completed.has(l.id)?'<b>✓</b>':''}</button>`).join('')}</div>`).join('');
  }
  function updateProgress(){
    const done=state.completed.size, percent=Math.round(done/Math.max(1,lessons.length)*100);
    $('#sidebar-percent').textContent=percent+'%';$('#sidebar-progress-bar').style.width=percent+'%';
    $('#sidebar-progress-text').textContent=done?`أنهيت ${done} من ${lessons.length} درسًا`:'ابدأ أول درس لتسجيل تقدمك';
    $('#stat-progress').innerHTML=`${percent}<i>%</i>`;
    $('#stat-questions').innerHTML=`${allQuestions().length}<i>سؤال</i>`;
    $('#nav-labs-count').textContent=labs.length;$('#stat-labs').innerHTML=`${labs.length}<i>محاكاة</i>`;
    renderSidebar();
  }
  function renderHome(){
    $('#featured-labs').innerHTML=labs.filter(l=>['water-distribution','water-cycle','water-molecule','osmosis','ozone-formation','greenhouse'].includes(l.id)).map(l=>labCard(l)).join('');
    updateProgress();
  }
  function labCard(lab){return `<button class="lab-card" data-open-lab="${attr(lab.id)}"><span class="lab-card-icon">${lab.icon}</span><span class="lab-card-text"><b>${esc(lab.title)}</b><small>${esc(lab.en)}</small><em>${esc(lab.desc)}</em></span><span class="card-arrow">↗</span></button>`;}
  function renderLessonBrowser(filter=''){
    const host=$('#lesson-browser');
    const term=filter.trim().toLowerCase();
    host.innerHTML=[1,2].map(unit=>{
      const rows=lessons.filter(l=>l.unit===unit && (!term || `${l.title} ${l.en} ${l.intro}`.toLowerCase().includes(term)));
      if(!rows.length)return'';
      return `<section class="lesson-unit-block"><header><div><span>UNIT 0${unit}</span><h2>${unit===1?'النظام البيئي المائي':'الغلاف الجوي'}</h2><small>${unit===1?'Aquatic Ecosystems':'The Atmosphere'}</small></div><b>${rows.length} دروس</b></header><div class="lesson-card-grid">${rows.map(l=>`<button class="lesson-card ${state.completed.has(l.id)?'done':''}" data-lesson="${l.id}"><span class="lesson-num">${String(l.id).padStart(2,'0')}</span><span class="lesson-card-copy"><b>${esc(l.title)}</b><small>${esc(l.en)}</small><em>${esc(l.tag||'شرح تفاعلي')}</em></span><span class="lesson-status">${state.completed.has(l.id)?'✓':'←'}</span></button>`).join('')}</div></section>`;
    }).join('') || '<div class="empty-state">مفيش درس مطابق للبحث ده.</div>';
    if(state.lessonId)renderLesson(state.lessonId);
  }
  const miniVisuals={
    'water-cycle': {title:'دورة الماء',body:`<div class="mini-water-cycle"><div class="mini-sun">☀</div><div class="mini-cloud">☁</div><div class="mini-rain">⋮ ⋮ ⋮</div><div class="mini-mountain">⌁</div><div class="mini-sea">≈ ≈ ≈</div><span class="mini-arrow a1">↑ تبخر</span><span class="mini-arrow a2">↓ هطول</span><span class="mini-arrow a3">↗ نتح</span></div>`},
    'water-distribution':{title:'توزيع ماء الأرض',body:`<div class="water-bars"><div class="water-bar-label"><span>ماء مالح</span><b>97.5%</b></div><div class="water-bar"><i style="width:97.5%"></i></div><div class="water-bar-label"><span>ماء عذب</span><b>2.5%</b></div><div class="water-bar fresh"><i style="width:2.5%"></i></div><div class="fresh-breakdown"><div><b>68.7%</b><span>جليد وأنهار جليدية</span></div><div><b>30.1%</b><span>مياه جوفية</span></div><div><b>1.2%</b><span>سطحية وأخرى</span></div></div><small>النسب الثلاث الأخيرة من إجمالي المياه العذبة فقط.</small></div>`},
    'molecule':{title:'جزيء الماء القطبي',body:`<div class="molecule-mini"><span class="atom oxygen">O<small>δ−</small></span><span class="bond bond-left"></span><span class="atom hydrogen h-left">H<small>δ+</small></span><span class="bond bond-right"></span><span class="atom hydrogen h-right">H<small>δ+</small></span><div class="molecule-caption">شكل منحني • زاوية ≈ 104.5°</div></div>`},
    'density':{title:'لماذا يطفو الجليد؟',body:`<div class="ice-mini"><div class="ice-water"><div class="ice-cube">جليد<br>أقل كثافة</div><i></i><i></i><i></i></div><div class="density-labels"><span>ρ الجليد ≈ 0.917 g/cm³</span><span>ρ الماء عند 4°C ≈ 1.000 g/cm³</span></div></div>`},
    'osmosis':{title:'انتقال الماء عبر غشاء',body:`<div class="osmosis-mini"><div class="osm-side"><b>تركيز مذاب أقل</b><span>H₂O H₂O H₂O</span></div><div class="osm-membrane">◌ ◌ ◌</div><div class="osm-side high"><b>تركيز مذاب أعلى</b><span>● ● ● ● ●</span></div><div class="osm-arrow">الماء ينتقل نحو الجهة الأعلى في تركيز المذاب الفعال</div></div>`},
    'atmosphere-layers':{title:'طبقات الغلاف الجوي',body:`<div class="layer-mini"><div class="layer exo">Exosphere</div><div class="layer thermo">Thermosphere</div><div class="layer meso">Mesosphere</div><div class="layer strato">Stratosphere • O₃</div><div class="layer tropo">Troposphere • Weather</div><div class="layer-earth">Earth</div></div>`},
    'ozone-cycle':{title:'دورة تكوين الأوزون',body:`<div class="ozone-mini"><div>O₂</div><span>UV ↘</span><div>2O</div><span>+ O₂ + M</span><div class="ozone-result">O₃</div><small>تكوين وتحلل مستمران</small></div>`},
    'greenhouse':{title:'تأثير الاحتباس الحراري',body:`<div class="greenhouse-mini"><div class="gh-sun">☀</div><div class="gh-earth">🌍</div><div class="gh-ray down">↓ إشعاع شمسي</div><div class="gh-ray up">↑ Infrared</div><div class="gh-loop">↘ امتصاص وإعادة إصدار ↙</div></div>`}
  };
  function visualBlock(visual, title='', paragraphs=[]){
    const item=miniVisuals[visual];
    if(item)return `<div class="lesson-visual"><div class="visual-head"><span>رسم توضيحي</span><b>${item.title}</b></div>${item.body}<button class="visual-open" data-open-visual="${attr(visual)}">افتح المحاكاة الكاملة ↗</button></div>`;
    const name=visual||'concept';
    const first=String(paragraphs[0]||'').replace(/\{\{([^}]+)\}\}/g,'$1').slice(0,112);
    const second=String(paragraphs[1]||'').replace(/\{\{([^}]+)\}\}/g,'$1').slice(0,112);
    const lab=getLessonLab(state.lessonId);
    return `<div class="lesson-visual concept-visual"><div class="visual-head"><span>خريطة الفكرة</span><b>${esc(title||'تصوّر المفهوم')}</b></div><div class="concept-flow"><div><i>01</i><b>الفكرة</b><small>${esc(title||'المفهوم العلمي')}</small></div><em>←</em><div><i>02</i><b>الآلية</b><small>${esc(first||'نفهم العلاقة بين أجزاء الفكرة.')}</small></div><em>←</em><div><i>03</i><b>النتيجة</b><small>${esc(second||'نربط الشرح بالتطبيق والملاحظة.')}</small></div></div><button class="visual-open" data-open-visual="${attr(name)}">افتح المحاكاة المرتبطة بالدرس ↗</button></div>`;
  }
  function renderCallout(callout){
    if(!callout)return'';
    const type=callout.type||'note';
    return `<aside class="lesson-callout ${attr(type)}"><span>${type==='warning'?'!':type==='important'?'✦':'ⓘ'}</span><div><b>${rich(callout.title||'ملاحظة')}</b><p>${rich(callout.text||'')}</p></div></aside>`;
  }
  function renderSection(section,index){
    const paragraphs=(section.paragraphs||[]).map(p=>`<p>${rich(p)}</p>`).join('');
    const paragraphs2=(section.paragraphs2||[]).map(p=>`<p>${rich(p)}</p>`).join('');
    const bullets=section.bullets?.length?`<ul class="lesson-bullets">${section.bullets.map(x=>`<li>${rich(x)}</li>`).join('')}</ul>`:'';
    const cards=section.cards?.length?`<div class="concept-grid">${section.cards.map(c=>`<article class="concept-card"><b>${rich(c.title)}</b><p>${rich(c.text)}</p></article>`).join('')}</div>`:'';
    const table=section.table?`<div class="science-table-wrap"><table class="science-table"><thead><tr>${section.table.headers.map(h=>`<th>${rich(h)}</th>`).join('')}</tr></thead><tbody>${section.table.rows.map(row=>`<tr>${row.map(cell=>`<td>${rich(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:'';
    const formula=section.formula?`<div class="formula-box"><small>العلاقة أو المعادلة</small><code>${rich(section.formula)}</code></div>`:'';
    const example=section.example?`<div class="worked-example simple-example"><div class="worked-title">مثال تطبيقي</div><p>${rich(section.example)}</p></div>`:'';
    const worked=section.worked?`<div class="worked-example"><div class="worked-title">✦ ${rich(section.worked.title||'مثال محلول')}</div><ol>${section.worked.steps.map(st=>`<li>${rich(st)}</li>`).join('')}</ol><div class="worked-result">${rich(section.worked.result||'')}</div></div>`:'';
    const steps=section.steps?.length?`<div class="step-list">${section.steps.map((st,i)=>`<div><i>${i+1}</i><p>${rich(st)}</p></div>`).join('')}</div>`:'';
    const visual=visualBlock(section.visual||'concept',section.title,section.paragraphs||[]);
    return `<article class="lesson-section" id="lesson-section-${index}"><header class="lesson-section-heading"><span>${String(index+1).padStart(2,'0')}</span><h3>${rich(section.title||'شرح الفكرة')}</h3></header><div class="section-copy">${paragraphs}${paragraphs2}${bullets}${table}${formula}${cards}${example}${worked}${steps}${renderCallout(section.callout)}${visual}</div></article>`;
  }
  function renderLesson(id){
    const lesson=lessonById(id);if(!lesson)return;
    state.lessonId=lesson.id;
    $('#lesson-reader').innerHTML=`<div class="reader-topline"><span>UNIT 0${lesson.unit} • LESSON ${String(lesson.id).padStart(2,'0')}</span><span>${lesson.sections.length} جزءًا للشرح</span></div><header class="lesson-hero"><div class="lesson-hero-number">${String(lesson.id).padStart(2,'0')}</div><div><span class="lesson-tag">${esc(lesson.tag||'شرح تفصيلي')}</span><h2>${esc(lesson.title)}</h2><p class="lesson-en">${esc(lesson.en)}</p><p>${rich(lesson.intro||'')}</p></div></header><div class="lesson-toolbar"><button class="btn-primary" data-complete="${lesson.id}">${state.completed.has(lesson.id)?'✓ تم إنهاء الدرس':'علّم الدرس كمكتمل'}</button><button class="btn-secondary" data-open-lesson-quiz="${lesson.id}">اختبر فهمك <span>✎</span></button><button class="btn-secondary" data-open-lab-for-lesson="${lesson.id}">محاكاة الدرس <span>⚗</span></button></div><section class="learning-goals"><h3>هتكون قادر على إيه بعد الدرس؟</h3><div class="goal-grid">${(lesson.goals||[]).map(g=>`<div><span>✓</span>${rich(g)}</div>`).join('')}</div></section><div class="lesson-sections">${lesson.sections.map(renderSection).join('')}</div><div class="lesson-tip"><span>✦</span><div><b>اختبر نفسك بعد الفهم</b><p>${rich(lesson.tip||'ارجع إلى الأفكار الرئيسية ثم حل أسئلة الدرس.')}</p></div></div><div class="lesson-end-actions"><button class="btn-primary" data-complete="${lesson.id}">${state.completed.has(lesson.id)?'تم تسجيل إنجاز الدرس':'أنهيت الدرس — سجّل إنجازي'}</button><button class="btn-secondary" data-open-lesson-quiz="${lesson.id}">ابدأ أسئلة الدرس ←</button></div>`;
    $$('.tree-lesson').forEach(b=>b.classList.toggle('selected',Number(b.dataset.lesson)===lesson.id));
    const next=lessons.find(l=>l.id===lesson.id+1);if(next){$('#lesson-reader').insertAdjacentHTML('beforeend',`<button class="next-lesson" data-lesson="${next.id}"><span>الدرس التالي</span><b>${esc(next.title)}</b><i>←</i></button>`);}
  }
  function setComplete(id){
    const n=Number(id);state.completed.add(n);store.write('aqua-completed',[...state.completed]);updateProgress();renderLesson(n);toast('تم تسجيل إنجاز الدرس على هذا الجهاز ✓');
  }

  function renderLabLibrary(){
    $('#lab-library').innerHTML=`<div class="lab-library-title"><b>اختر محاكاة</b><small>${labs.length} نموذج تفاعلي</small></div>${[1,2,3,4,5,6,7,8,9,10,11,12,13,14].map(lessonId=>{
      const list=labs.filter(l=>l.lesson===lessonId);if(!list.length)return'';
      const lesson=lessonById(lessonId);
      return `<div class="lab-group"><span>${String(lessonId).padStart(2,'0')} • ${esc(lesson?.title||'')}</span>${list.map(l=>`<button class="lab-list-item ${l.id===state.labId?'selected':''}" data-open-lab="${attr(l.id)}"><i>${l.icon}</i><span><b>${esc(l.title)}</b><small>${esc(l.en)}</small></span><em>↗</em></button>`).join('')}</div>`;
    }).join('')}`;
    renderLab(state.labId);
  }
  function labHeader(lab){return `<div class="lab-reader-head"><div><span class="lab-kicker">VIRTUAL EXPERIMENT • LESSON ${String(lab.lesson).padStart(2,'0')}</span><h2>${esc(lab.title)}</h2><p>${esc(lab.en)}</p></div><span class="level-chip">${esc(lab.level)}</span></div><p class="lab-description">${esc(lab.desc)}</p>`;}
  function labFooter(lab){return `<div class="lab-explain"><span>الفكرة العلمية</span><p>${esc(lab.desc)} القيم المعروضة في هذا النموذج تعليمية وتوضيحية؛ وليست بديلًا عن قياسات معملية حقيقية أو نموذجًا تنبؤيًا كاملًا.</p><button class="text-link" data-lesson="${lab.lesson}" data-switch-lesson>ارجع إلى شرح الدرس ${lab.lesson} ←</button></div>`;}
  function slider(id,label,min,max,value,unit='',step=1){return `<label class="control-field"><span>${label}</span><b><output id="${id}-out">${value}${unit}</output></b><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"></label>`;}
  function labStage(content){return `<div class="simulation-stage">${content}</div>`;}
  const labTemplates={
    distribution:()=>`${labStage(`<div class="distribution-scene"><div class="earth-water"><div class="earth-land"></div><div class="earth-sea"></div><span>الأرض</span></div><div class="distribution-readout"><div class="dist-big"><strong>97.5%</strong><span>مياه مالحة</span></div><div class="dist-big fresh"><strong>2.5%</strong><span>مياه عذبة</span></div></div></div>`)}<div class="lab-controls">${slider('fresh-share','نسبة المياه العذبة من إجمالي ماء الأرض',0,5,2.5,'%',0.1)}<div class="split-bars"><div><span>مالحة</span><b id="salt-share">97.5%</b><i><em id="salt-bar" style="width:97.5%"></em></i></div><div><span>عذبة</span><b id="fresh-share-label">2.5%</b><i><em id="fresh-bar" style="width:2.5%"></em></i></div></div><div class="fresh-reservoirs"><h4>كبّر الجزء العذب فقط</h4><div><b>68.7%</b><span>جليد وأنهار جليدية</span></div><div><b>30.1%</b><span>مياه جوفية</span></div><div><b>1.2%</b><span>مياه سطحية وأخرى</span></div><small>من إجمالي المياه العذبة، وليس من إجمالي مياه الأرض.</small></div></div>`,
    'water-cycle':()=>`${labStage(`<div class="cycle-scene"><div class="cycle-sun">☀</div><div class="cycle-cloud">☁</div><div class="cycle-mountain">▲ ▲</div><div class="cycle-river">≈≈≈≈≈</div><div class="cycle-tree">♣</div><div class="cycle-droplets">💧　💧　💧</div><div class="cycle-label evap">Evaporation ↑</div><div class="cycle-label cond">Condensation</div><div class="cycle-label precip">Precipitation ↓</div><div class="cycle-label trans">Transpiration ↑</div><div class="cycle-label runoff">Runoff ↘</div><div class="cycle-label infil">Infiltration ↓</div></div>`)}<div class="lab-controls"><div class="cycle-buttons"><button class="choice-btn active" data-cycle="evap">1 التبخر</button><button class="choice-btn" data-cycle="cond">2 التكاثف</button><button class="choice-btn" data-cycle="precip">3 الهطول</button><button class="choice-btn" data-cycle="runoff">4 الجريان والتسرب</button><button class="choice-btn" data-cycle="trans">5 النتح</button></div><div class="cycle-explanation" id="cycle-explanation"><b>Evaporation — التبخر</b><p>تكتسب جزيئات الماء طاقة وتتحول من الحالة السائلة إلى بخار يصعد إلى الغلاف الجوي. الطاقة الشمسية هي المصدر الرئيسي للتبخر الطبيعي.</p></div></div>`,
    molecule:()=>`${labStage(`<div class="molecule-stage"><div class="big-molecule"><div class="bond b1"></div><div class="bond b2"></div><button class="big-atom oxygen" id="oxygen-atom">O<small>δ−</small></button><button class="big-atom hydrogen h1">H<small>δ+</small></button><button class="big-atom hydrogen h2">H<small>δ+</small></button><div class="angle-arc">104.5°</div></div><div class="molecule-facts"><b>H₂O</b><span>جزيء منحني وقطبي</span><small>ذرتا هيدروجين + ذرة أكسجين</small></div></div>`)}<div class="lab-controls"><div class="choice-row"><button class="choice-btn active" data-mol="charges">إظهار الشحنات الجزئية</button><button class="choice-btn" data-mol="bonds">إظهار الروابط</button><button class="choice-btn" data-mol="shape">إظهار الشكل والزاوية</button></div><div class="dynamic-explanation" id="molecule-explanation">الأكسجين أعلى سالبية كهربية من الهيدروجين؛ لذلك يجذب إلكترونات الرابطة نحوه نسبيًا، فيحمل شحنة جزئية سالبة δ− بينما يحمل الهيدروجين شحنة جزئية موجبة δ+.</div></div>`,
    hydrogen:()=>`${labStage(`<div class="hydrogen-stage"><div class="water-pair"><div class="mini-water m-one"><b>O</b><i>H</i><i>H</i></div><div class="mini-water m-two"><b>O</b><i>H</i><i>H</i></div><div class="hbond-line"></div><span>Hydrogen bond</span></div><div class="hbond-legend"><span>— رابطة تساهمية داخل الجزيء</span><span>⋯ رابطة هيدروجينية بين الجزيئات</span></div></div>`)}<div class="lab-controls"><button class="btn-primary" id="toggle-hbond">إظهار / إخفاء الرابطة الهيدروجينية</button><div class="dynamic-explanation" id="hbond-explanation">الرابطة الهيدروجينية تجاذب بين جزيئات الماء؛ وهي أضعف من الرابطة التساهمية O–H داخل الجزيء، لكنها تؤثر في الخواص الجماعية للماء.</div></div>`,
    dissolving:()=>`${labStage(`<div class="dissolve-beaker"><div class="beaker-liquid" id="beaker-ions"><span class="ion sodium">Na⁺</span><span class="ion chloride">Cl⁻</span><span class="ion sodium">Na⁺</span><span class="ion chloride">Cl⁻</span><span class="ion sodium">Na⁺</span><span class="ion chloride">Cl⁻</span></div><div class="beaker-caption">ماء + بلورة NaCl</div></div>`)}<div class="lab-controls"><button class="btn-primary" id="dissolve-step">ابدأ الذوبان</button><div class="dynamic-explanation" id="dissolve-explanation">تنجذب النهاية ذات الشحنة الجزئية السالبة في الماء إلى Na⁺، بينما تتجه النهايات ذات الشحنة الجزئية الموجبة نحو Cl⁻. يحيط الماء بالأيونات ويساعد على فصلها واستقرارها في المحلول.</div></div>`,
    ionization:()=>`${labStage(`<div class="ionization-reaction"><div class="water-unit">H₂O</div><span>+</span><div class="water-unit">H₂O</div><span class="reaction-arrow">⇌</span><div class="ion-product">H₃O⁺</div><span>+</span><div class="ion-product base">OH⁻</div></div>`)}<div class="lab-controls"><button class="btn-primary" id="ionize-step">شاهد انتقال البروتون</button><p class="dynamic-explanation" id="ionize-explanation">يتفاعل جزيء ماء مع جزيء آخر؛ ينقل أحدهما بروتونًا H⁺ إلى الآخر، فتتكون أيونات الهيدرونيوم H₃O⁺ والهيدروكسيد OH⁻. يحدث ذلك بدرجة ضئيلة جدًا في الماء النقي.</p></div>`,
    density:()=>`${labStage(`<div class="density-tank"><div class="ice-float" id="density-ice">ICE</div><div class="waterline"></div><div class="water-fill"></div><span class="float-label">الجليد يطفو لأن كثافته أقل</span></div><div class="density-metric"><strong id="density-value">0.99997</strong><small>g/cm³ تقريبًا للماء</small></div>`)}<div class="lab-controls">${slider('water-temp','درجة حرارة الماء',-5,30,4,'°C',1)}<div class="dynamic-explanation" id="density-explanation">تبلغ كثافة الماء النقي قيمة عظمى قرب 4°C. الجليد أقل كثافة من الماء السائل، لذلك يطفو.</div></div>`,
    hydrometer:()=>`${labStage(`<div class="hydrometer-tank"><div class="hydro-liquid" id="hydro-liquid"></div><div class="hydrometer-stick" id="hydrometer-stick"><span></span><i></i><b></b></div><div class="hydrometer-mark">HYDROMETER</div></div><div class="hydro-reading"><strong id="hydro-reading">1.00</strong><small>كثافة نسبية تقريبية</small></div>`)}<div class="lab-controls">${slider('liquid-density','كثافة السائل',0.8,1.3,1,'',0.01)}<div class="dynamic-explanation" id="hydrometer-explanation">في السائل الأعلى كثافة يزيح مقياس الكثافة حجمًا أقل ليوازن وزنه، فيطفو أعلى ويغمر جزءًا أقل منه.</div></div>`,
    'specific-heat':()=>`${labStage(`<div class="heat-vessels"><div class="heat-vessel"><b>ماء</b><div class="thermo"><i id="water-thermo"></i></div><strong id="water-rise">+0°C</strong></div><div class="heat-vessel sand"><b>رمل</b><div class="thermo"><i id="sand-thermo"></i></div><strong id="sand-rise">+0°C</strong></div></div><div class="energy-badge">نفس الطاقة والكتلة</div>`)}<div class="lab-controls">${slider('heat-energy','الطاقة الحرارية المضافة',0,50000,20000,' J',1000)}<div class="dynamic-explanation" id="heat-explanation">عند ثبات الكتلة والطاقة، ترتفع درجة حرارة الرمل أكثر لأن حرارته النوعية أقل من الماء.</div></div>`,
    'heat-transfer':()=>`${labStage(`<div class="transfer-stage" id="transfer-scene"><div class="transfer-object">☀</div><div class="transfer-target">▰</div><div class="transfer-particles">·　·　·　·　·</div><span id="transfer-label">Energy travels as electromagnetic waves</span></div>`)}<div class="lab-controls"><div class="choice-row"><button class="choice-btn active" data-transfer="radiation">الإشعاع</button><button class="choice-btn" data-transfer="conduction">التوصيل</button><button class="choice-btn" data-transfer="convection">الحمل</button></div><div class="dynamic-explanation" id="transfer-explanation">الإشعاع ينقل الطاقة بموجات كهرومغناطيسية، ولا يحتاج إلى وسط مادي؛ لذلك تنتقل طاقة الشمس عبر الفضاء.</div></div>`,
    osmosis:()=>`${labStage(`<div class="osmosis-cup"><div class="osm-compartment left"><b>الجانب A</b><div class="solute-dots" id="dots-a">● ●</div><span>ماء</span></div><div class="semi-membrane">غشاء<br>شبه منفذ</div><div class="osm-compartment right"><b>الجانب B</b><div class="solute-dots" id="dots-b">● ● ● ● ●</div><span>ماء</span></div><div class="osmotic-arrow" id="osmosis-arrow">H₂O →</div></div>`)}<div class="lab-controls">${slider('osm-a','تركيز المذاب في A',0,10,2,' وحدات')}${slider('osm-b','تركيز المذاب في B',0,10,7,' وحدات')}<div class="dynamic-explanation" id="osmosis-explanation">ينتقل الماء عبر غشاء شبه منفذ من الجهة الأقل في تركيز المذاب الفعال إلى الجهة الأعلى، حتى يتوازن التأثير أو تعوقه عوامل أخرى.</div></div>`,
    ph:()=>`${labStage(`<div class="ph-meter"><div class="ph-scale"><span>حمضي</span><span>متعادل</span><span>قاعدي</span></div><div class="ph-spectrum"><i id="ph-marker" style="left:50%"></i></div><div class="ph-big"><strong id="ph-value">7</strong><span id="ph-kind">متعادل</span></div><div class="ph-examples"><span>ليمون ≈ 2</span><span>ماء نقي ≈ 7</span><span>صابون ≈ 10</span></div></div>`)}<div class="lab-controls">${slider('ph-slider','قيمة pH',0,14,7,'',0.1)}<div class="dynamic-explanation" id="ph-explanation">pH أقل من 7 حمضي، ويساوي 7 متعادل تقريبًا للماء النقي عند 25°C، وأكبر من 7 قاعدي. كل وحدة pH تمثل تغيرًا عشريًا في تركيز أيون الهيدرونيوم في النموذج المبسط.</div></div>`,
    cell:()=>`${labStage(`<div class="cell-explorer"><div class="cell-drawing"><div class="cell-membrane"></div><button class="organelle nucleus" data-organelle="nucleus">●</button><button class="organelle mito" data-organelle="mitochondria">ϟ</button><button class="organelle ribo" data-organelle="ribosome">· ·</button><button class="organelle golgi" data-organelle="golgi">≋</button><button class="organelle vacuole" data-organelle="vacuole">◯</button><button class="organelle chloroplast" data-organelle="chloroplast">▥</button><span class="cell-label">خلية حقيقية النواة</span></div><div class="organelle-info" id="organelle-info"><b>اختر عضية</b><p>اضغط على أحد الأجزاء في الرسم لتقرأ وظيفته. الرسم تخطيطي وليس مقياسًا حقيقيًا.</p></div></div>`)}<div class="lab-controls"><div class="choice-row"><button class="choice-btn active" data-celltype="animal">خلية حيوانية</button><button class="choice-btn" data-celltype="plant">خلية نباتية</button></div><div class="dynamic-explanation" id="cell-explanation">الخلايا حقيقية النواة تحتوي نواة محاطة بغشاء وعضيات متخصصة. تختلف الخلية النباتية بوجود جدار خلوي وبلاستيدات خضراء وفجوة عصارية كبيرة غالبًا.</div></div>`,
    fish:()=>`${labStage(`<div class="fish-stage"><div class="fish-figure">🐟<span class="fish-gills">)))</span><span class="fish-arrow" id="fish-water-arrow">H₂O ↓</span></div><div class="fish-salts" id="fish-salts">أملاح تنتقل للخارج؟</div><div class="fish-environment" id="fish-environment">ماء عذب</div></div>`)}<div class="lab-controls"><div class="choice-row"><button class="choice-btn active" data-fish="fresh">سمكة ماء عذب</button><button class="choice-btn" data-fish="sea">سمكة بحرية</button></div><div class="dynamic-explanation" id="fish-explanation">في الماء العذب يميل الماء إلى الدخول إلى جسم السمكة أسموزيًا لأن سوائل جسمها أعلى تركيزًا من الوسط. تطرح السمكة بولًا مخففًا نسبيًا وتمتص الأملاح عبر الخياشيم والغذاء.</div></div>`,
    oxygen:()=>`${labStage(`<div class="oxygen-water"><div class="oxygen-bubbles" id="oxygen-bubbles">○　○ ○　○　○</div><div class="oxygen-fish">🐠</div><div class="oxygen-reading"><b id="oxygen-reading">9.1</b><small>اتجاه تشبّع تقريبي نسبي</small></div></div>`)}<div class="lab-controls">${slider('oxygen-temp','درجة حرارة الماء',0,35,10,'°C')}${slider('oxygen-salt','الملوحة (للتوضيح)',0,40,0,'‰')}<div class="dynamic-explanation" id="oxygen-explanation">ذوبانية الأكسجين في الماء تقل عمومًا عندما ترتفع درجة الحرارة أو الملوحة، عند ثبات الضغط. القيمة المعروضة مؤشر نسبي توضيحي وليست قياسًا مخبريًا بوحدة mg/L.</div></div>`,
    light:()=>`${labStage(`<div class="light-tank"><div class="light-surface"></div><div class="light-rays" id="light-rays"><i></i><i></i><i></i></div><div class="light-zone photic">Photic Zone</div><div class="light-zone aphotic">Aphotic Zone</div><div class="light-bottom"></div><span id="light-depth-label">الضوء متاح قرب السطح</span></div>`)}<div class="lab-controls">${slider('depth-light','العمق',0,200,20,' m') }<div class="choice-row"><button class="choice-btn active" data-light="blue">ضوء أزرق</button><button class="choice-btn" data-light="red">ضوء أحمر</button><button class="choice-btn" data-light="green">ضوء أخضر</button></div><div class="dynamic-explanation" id="light-explanation">تُمتص الأطوال الموجية المختلفة بمعدلات مختلفة؛ غالبًا ينفذ الضوء الأزرق إلى أعماق أكبر من الأحمر في مياه صافية. تقل شدة الضوء مع العمق.</div></div>`,
    pressure:()=>`${labStage(`<div class="pressure-ocean"><div class="pressure-surface">سطح البحر</div><div class="pressure-diver" id="pressure-diver">◉<small>غواص</small></div><div class="pressure-depth-mark">↓ العمق</div><div class="pressure-bubble">ضغط الماء يزداد لأسفل</div></div><div class="pressure-readings"><div><b id="pressure-atm">1.0</b><span>ضغط جوي تقريبي</span></div><div><b id="pressure-kpa">101</b><span>kPa تقريبًا</span></div></div>`)}<div class="lab-controls">${slider('depth-pressure','العمق تحت السطح',0,100,0,' m') }<div class="dynamic-explanation" id="pressure-explanation">يزداد الضغط الكلي مع العمق؛ كقاعدة تعليمية تقريبية يضيف كل 10 أمتار من ماء البحر نحو ضغط جوي واحد فوق ضغط الهواء عند السطح.</div></div>`,
    foodweb:()=>`${labStage(`<div class="foodweb-scene"><div class="food-node producer">عوالق نباتية</div><div class="food-arrow">↓</div><div class="food-node primary">أسماك صغيرة</div><div class="food-arrow">↓</div><div class="food-node predator">أسماك مفترسة</div><div class="food-node decomposer">محللات ↺</div></div>`)}<div class="lab-controls">${slider('fishing-pressure','ضغط الصيد (مؤشر افتراضي)',0,100,20,'%')}<div class="foodweb-status" id="foodweb-status">ضغط منخفض نسبيًا: الشبكة قادرة على تعويض جزء من الفقد مع توافر الموائل والغذاء.</div><p class="small-note">هذا نموذج مفاهيمي يوضح اتجاه التأثير، وليس توقعًا عدديًا لأعداد الأسماك.</p></div>`,
    layers:()=>`${labStage(`<div class="layers-interactive"><div class="layer-stack"><button data-layer="troposphere" class="atm-layer troposphere selected">Troposphere</button><button data-layer="stratosphere" class="atm-layer stratosphere">Stratosphere</button><button data-layer="mesosphere" class="atm-layer mesosphere">Mesosphere</button><button data-layer="thermosphere" class="atm-layer thermosphere">Thermosphere</button><button data-layer="exosphere" class="atm-layer exosphere">Exosphere</button><div class="planet-label">EARTH</div></div><div class="layer-info" id="layer-info"><b>Troposphere — التروبوسفير</b><p>أدنى طبقات الغلاف الجوي، تحدث فيها معظم ظواهر الطقس.</p><small>من سطح الأرض إلى نحو 8–18 km.</small></div></div>`)}<div class="lab-controls"><p class="small-note">اضغط على أي طبقة في الرسم لاستكشافها. الارتفاعات تقريبية وتتغير الحدود حسب الموقع والظروف.</p></div>`,
    ozone:()=>`${labStage(`<div class="ozone-lab"><div class="ozone-molecule" id="ozone-molecules"><span>O₂</span><i>+</i><span>hν</span></div><div class="ozone-reaction" id="ozone-reaction">O₂ + hν → 2O</div><div class="ozone-status" id="ozone-status">الخطوة 1 من 3</div></div>`)}<div class="lab-controls"><div class="lab-button-row"><button class="btn-secondary" id="ozone-prev">السابق</button><button class="btn-primary" id="ozone-next">نفّذ الخطوة التالية</button><button class="btn-secondary" id="ozone-reset">إعادة</button></div><div class="dynamic-explanation" id="ozone-explanation">يمتص جزيء O₂ فوتونًا من الأشعة فوق البنفسجية المناسبة، فيتفكك إلى ذرتين O منفصلتين.</div></div>`,
    wind:()=>`${labStage(`<div class="wind-scene"><div class="pressure-zone high-pressure"><b>H</b><span>ضغط مرتفع</span></div><div class="wind-arrows" id="wind-arrows">→ → → → →</div><div class="pressure-zone low-pressure"><b>L</b><span>ضغط منخفض</span></div><div class="wind-speed-label" id="wind-speed-label">تدرج ضغط متوسط</div></div>`)}<div class="lab-controls">${slider('pressure-difference','فرق الضغط (مؤشر)',0,100,50,'%')}<div class="dynamic-explanation" id="wind-explanation">تؤثر قوة تدرج الضغط في حركة الهواء من الضغط الأعلى نحو الضغط الأقل. اتجاه الرياح الفعلي يتأثر أيضًا بدوران الأرض والاحتكاك والتضاريس.</div></div>`,
    humidity:()=>`${labStage(`<div class="humidity-cloud">☁<span id="humidity-percent">50%</span><small>الرطوبة النسبية</small></div><div class="humidity-person">♧<span id="humidity-condition">تبخر متوسط</span></div>`)}<div class="lab-controls">${slider('humidity-vapour','كمية بخار الماء (مؤشر)',0,100,50,'%')}${slider('humidity-temp','درجة حرارة الهواء',5,40,25,'°C')}<div class="dynamic-explanation" id="humidity-explanation">الرطوبة النسبية تقارن بخار الماء الفعلي بكمية الإشباع عند درجة الحرارة نفسها. تسخين الهواء دون إضافة بخار ماء يخفض الرطوبة النسبية عادةً.</div></div>`,
    greenhouse:()=>`${labStage(`<div class="greenhouse-stage"><div class="gh-sun-large">☀</div><div class="gh-planet">🌍</div><div class="gh-atmosphere"></div><div class="gh-photons" id="gh-photons"><span>↓</span><span>↑</span><span>↘</span></div><div class="gh-label">طاقة داخلة • أشعة تحت حمراء خارجة • امتصاص وإعادة إصدار</div></div>`)}<div class="lab-controls">${slider('gh-gases','كمية غازات الدفيئة (مؤشر)',0,100,40,'%')}<div class="dynamic-explanation" id="gh-explanation">غازات الدفيئة تمتص أطوالًا موجية من الأشعة تحت الحمراء وتعيد إصدارها. هذا نموذج توضيحي لفكرة التأثير، ولا يحسب درجة حرارة الأرض الحقيقية.</div></div>`,
    acidrain:()=>`${labStage(`<div class="acid-stage"><div class="factory-smoke">🏭<span>SO₂ • NOx</span></div><div class="acid-cloud">☁<small>تفاعلات في الجو</small></div><div class="acid-drops">↓ ↓ ↓</div><div class="acid-lake">≈ ماء يتغير pH ≈</div><div class="acid-ph" id="acid-ph">pH: يتجه للانخفاض</div></div>`)}<div class="lab-controls">${slider('acid-emissions','انبعاثات SOx وNOx (مؤشر)',0,100,50,'%')}<div class="dynamic-explanation" id="acid-explanation">تتحول أكاسيد الكبريت والنيتروجين في الجو إلى أحماض مثل H₂SO₄ وHNO₃. يوضح المشهد اتجاه التأثير فقط ولا يتنبأ بقيمة pH الفعلية في بحيرة حقيقية.</div></div>`,
    control:()=>`${labStage(`<div class="control-stage"><div class="factory-pipe">غازات مداخن<div class="pollutant-cloud">SO₂ • CO • NOx</div></div><div class="control-unit">وحدة معالجة</div><div class="clean-pipe">هواء أنظف<div class="clean-cloud">✓</div></div></div>`)}<div class="lab-controls"><div class="choice-row"><button class="choice-btn active" data-control="scrubber">غاسل الغازات</button><button class="choice-btn" data-control="catalyst">المحول الحفاز</button></div><div class="dynamic-explanation" id="control-explanation">غاسل الغازات Scrubber يعالج بعض ملوثات المداخن، ومنها SO₂. المحول الحفاز Catalytic Converter يعالج ملوثات معينة في عادم المركبات مثل CO وNOx والهيدروكربونات.</div></div>`
  };

  function renderLab(id){
    const lab=labById(id)||labs[0];if(!lab)return;state.labId=lab.id;
    $('#lab-reader').innerHTML=labHeader(lab)+(labTemplates[lab.kind]?labTemplates[lab.kind]():labTemplates.distribution())+labFooter(lab);
    $$('.lab-list-item').forEach(b=>b.classList.toggle('selected',b.dataset.openLab===lab.id));
    wireLab(lab);
  }
  function setOutput(id,value){const out=$('#'+id+'-out');if(out)out.textContent=value;}
  function wireLab(lab){
    const on=(id,fn)=>{const el=$('#'+id);if(el)el.addEventListener('input',()=>fn(el.value));};
    const click=(id,fn)=>{const el=$('#'+id);if(el)el.addEventListener('click',fn);};
    if(lab.kind==='distribution'){
      on('fresh-share',v=>{v=Number(v);setOutput('fresh-share',v.toFixed(1)+'%');$('#salt-share').textContent=(100-v).toFixed(1)+'%';$('#fresh-share-label').textContent=v.toFixed(1)+'%';$('#salt-bar').style.width=(100-v)+'%';$('#fresh-bar').style.width=v+'%';$('.dist-big strong').textContent=(100-v).toFixed(1)+'%';$('.dist-big.fresh strong').textContent=v.toFixed(1)+'%';});
    }
    if(lab.kind==='water-cycle'){
      const data={evap:['Evaporation — التبخر','تكتسب جزيئات الماء طاقة وتتحول من الحالة السائلة إلى بخار يصعد إلى الغلاف الجوي. الطاقة الشمسية هي المصدر الرئيسي للتبخر الطبيعي.'],cond:['Condensation — التكاثف','يبرد بخار الماء أو يصل إلى التشبع، فيتحول إلى قطرات ماء صغيرة أو بلورات جليد مكونًا السحب والضباب.'],precip:['Precipitation — الهطول','عندما تكبر قطرات الماء أو بلورات الجليد بما يكفي تسقط إلى سطح الأرض في صورة مطر أو ثلج أو برد بحسب الظروف.'],runoff:['Runoff & Infiltration — الجريان والتسرب','قد يجري الماء فوق السطح إلى الأنهار والبحار، وقد يتسرب إلى التربة ويغذي المياه الجوفية.'],trans:['Transpiration — النتح','تفقد النباتات بخار الماء عبر الثغور، وينتقل إلى الغلاف الجوي.']};
      $$('[data-cycle]').forEach(b=>b.addEventListener('click',()=>{$$('[data-cycle]').forEach(x=>x.classList.toggle('active',x===b));const d=data[b.dataset.cycle];$('#cycle-explanation').innerHTML=`<b>${d[0]}</b><p>${d[1]}</p>`;$('.cycle-scene').dataset.stage=b.dataset.cycle;}));
    }
    if(lab.kind==='molecule'){
      $$('[data-mol]').forEach(b=>b.addEventListener('click',()=>{$$('[data-mol]').forEach(x=>x.classList.toggle('active',x===b));const mode=b.dataset.mol;$('.big-molecule').className='big-molecule show-'+mode;const texts={charges:'الأكسجين أعلى سالبية كهربية من الهيدروجين؛ لذلك يجذب إلكترونات الرابطة نحوه نسبيًا، فيحمل شحنة جزئية سالبة δ− بينما يحمل الهيدروجين شحنة جزئية موجبة δ+.',bonds:'الخطوط الصلبة تمثل رابطتين تساهميتين قطبيتين O–H داخل الجزيء. تتشارك الذرات إلكترونات في كل رابطة.',shape:'جزيء الماء ليس خطيًا؛ بل شكله منحني بسبب ترتيب أزواج الإلكترونات حول ذرة الأكسجين، وزاوية H–O–H تقارب 104.5°.'};$('#molecule-explanation').textContent=texts[mode];}));
    }
    if(lab.kind==='hydrogen')click('toggle-hbond',()=>{$('.hydrogen-stage').classList.toggle('hide-bond');$('#hbond-explanation').textContent=$('.hydrogen-stage').classList.contains('hide-bond')?'تم إخفاء التجاذب بين الجزيئين. الروابط التساهمية داخل كل جزيء ما زالت موجودة.':'الرابطة الهيدروجينية تجاذب بين جزيئات الماء؛ وهي أضعف من الرابطة التساهمية O–H داخل الجزيء، لكنها تؤثر في الخواص الجماعية للماء.';});
    if(lab.kind==='dissolving')click('dissolve-step',()=>{$('.dissolve-beaker').classList.toggle('dissolved');$('#dissolve-explanation').textContent=$('.dissolve-beaker').classList.contains('dissolved')?'انفصلت الأيونات وانتشرت في الماء. يحيط الطرف السالب جزئيًا من جزيئات الماء بأيون Na⁺، وتتجه ذرات الهيدروجين ذات الشحنة الجزئية الموجبة نحو Cl⁻.':'في البلورة الأيونية تتجاذب أيونات Na⁺ وCl⁻. جزيئات الماء القطبية يمكنها إحاطة الأيونات والمساعدة على فصلها.';});
    if(lab.kind==='ionization')click('ionize-step',()=>{$('.ionization-reaction').classList.toggle('ionized');$('#ionize-explanation').textContent=$('.ionization-reaction').classList.contains('ionized')?'انتقل بروتون H⁺ من جزيء ماء إلى الآخر؛ الناتج H₃O⁺ وOH⁻. في الماء النقي يتساوى تركيز الأيونين عند الاتزان.':'التأين الذاتي للماء عملية اتزان ديناميكي: بعض جزيئات الماء تتأين بينما تتحد أيونات مرة أخرى.';});
    if(lab.kind==='density')on('water-temp',v=>{v=Number(v);setOutput('water-temp',v+'°C');let d;if(v<0)d=0.917;else{const t=v;d=(1-((t+288.9414)/(508929.2*(t+68.12963)))*Math.pow(t-3.9863,2));}$('#density-value').textContent=d.toFixed(5);$('#density-ice').style.transform=`translateY(${v<0?18:0}px)`;$('#density-explanation').textContent=v===4?'قرب 4°C تبلغ كثافة الماء النقي قيمتها العظمى تقريبًا.':v<0?'عند التجمد تتكون بنية بلورية مفتوحة نسبيًا، فتقل كثافة الجليد ويطفو فوق الماء السائل.':v>4?'بعد 4°C تقل كثافة الماء تدريجيًا مع ارتفاع الحرارة في هذا النطاق.':'عند درجات أقل من 4°C وحتى التجمد تقل كثافة الماء تدريجيًا؛ وهذا سلوك غير معتاد للماء.';});
    if(lab.kind==='hydrometer')on('liquid-density',v=>{v=Number(v);setOutput('liquid-density',v.toFixed(2));$('#hydro-reading').textContent=v.toFixed(2);$('#hydrometer-stick').style.top=(28+(1.3-v)*80)+'px';$('#hydrometer-explanation').textContent=v>1?'السائل أكثر كثافة؛ يطفو المقياس أعلى ويغمر جزء أقل منه.':v<1?'السائل أقل كثافة؛ يغوص المقياس أكثر حتى يزيح حجمًا أكبر يوازن وزنه.':'عند الكثافة المرجعية للماء في هذا النموذج يطفو المقياس عند مستوى متوسط.';});
    if(lab.kind==='specific-heat')on('heat-energy',v=>{v=Number(v);setOutput('heat-energy',v.toLocaleString()+' J');const water=v/(0.5*4200),sand=v/(0.5*830);$('#water-rise').textContent='+'+water.toFixed(1)+'°C';$('#sand-rise').textContent='+'+sand.toFixed(1)+'°C';$('#water-thermo').style.height=Math.min(92,water*5)+'%';$('#sand-thermo').style.height=Math.min(92,sand*5)+'%';$('#heat-explanation').textContent=`للماء: ΔT = Q/(mc) = ${v}/(0.5×4200) = ${water.toFixed(2)}°C. للرمل: ΔT ≈ ${v}/(0.5×830) = ${sand.toFixed(2)}°C. لذلك يسخن الرمل أكثر لنفس الطاقة والكتلة في هذا المثال.`;});
    if(lab.kind==='heat-transfer')$$('[data-transfer]').forEach(b=>b.addEventListener('click',()=>{const type=b.dataset.transfer;$$('[data-transfer]').forEach(x=>x.classList.toggle('active',x===b));$('#transfer-scene').dataset.type=type;const text={radiation:['Energy travels as electromagnetic waves','الإشعاع ينقل الطاقة بموجات كهرومغناطيسية، ولا يحتاج إلى وسط مادي؛ لذلك تنتقل طاقة الشمس عبر الفضاء.'],conduction:['Energy moves through contact','التوصيل انتقال للطاقة عبر تلامس الجسيمات المتجاورة دون انتقال كلي للمادة.'],convection:['Moving fluid carries energy','الحمل الحراري يحدث عندما تتحرك أجزاء السائل أو الغاز بسبب اختلاف الكثافة الناتج غالبًا عن اختلاف الحرارة.']};$('#transfer-label').textContent=text[type][0];$('#transfer-explanation').textContent=text[type][1];}));
    if(lab.kind==='osmosis'){
      const update=()=>{const a=Number($('#osm-a').value),b=Number($('#osm-b').value);setOutput('osm-a',a+' وحدات');setOutput('osm-b',b+' وحدات');$('#dots-a').textContent='● '.repeat(Math.max(1,Math.round(a/2)+1));$('#dots-b').textContent='● '.repeat(Math.max(1,Math.round(b/2)+1));const arrow=$('#osmosis-arrow');if(a<b){arrow.textContent='H₂O →';$('#osmosis-explanation').textContent='الماء ينتقل من A (مذاب أقل) إلى B (مذاب أعلى) عبر الغشاء شبه المنفذ.';}else if(a>b){arrow.textContent='← H₂O';$('#osmosis-explanation').textContent='الماء ينتقل من B (مذاب أقل) إلى A (مذاب أعلى) عبر الغشاء شبه المنفذ.';}else{arrow.textContent='H₂O ⇄';$('#osmosis-explanation').textContent='التركيزان متساويان في هذا النموذج؛ تستمر حركة الجزيئات في الاتجاهين لكن لا يوجد انتقال صافٍ للماء.';}};on('osm-a',update);on('osm-b',update);
    }
    if(lab.kind==='ph')on('ph-slider',v=>{v=Number(v);setOutput('ph-slider',v.toFixed(1));$('#ph-value').textContent=v.toFixed(1);$('#ph-marker').style.left=(v/14*100)+'%';const kind=v<7?'حمضي':v>7?'قاعدي':'متعادل';$('#ph-kind').textContent=kind;$('#ph-explanation').textContent=v<7?`pH = ${v.toFixed(1)} أقل من 7؛ الوسط حمضي في النموذج. كلما قلت قيمة pH زادت الحموضة.`:v>7?`pH = ${v.toFixed(1)} أكبر من 7؛ الوسط قاعدي في النموذج. كلما ارتفعت القيمة زادت القاعدية.`:'pH = 7؛ متعادل تقريبًا عند 25°C للماء النقي.';});
    if(lab.kind==='cell'){
      const organelles={nucleus:['النواة','تحتوي معظم المادة الوراثية وتشارك في تنظيم أنشطة الخلية.'],mitochondria:['الميتوكوندريا','مكان رئيسي لإنتاج ATP في التنفس الخلوي الهوائي.'],ribosome:['الريبوسومات','مواقع تصنيع البروتينات بترجمة المعلومات الوراثية.'],golgi:['جهاز جولجي','يعدل بعض البروتينات والدهون ويصنفها ويغلفها للنقل.'],vacuole:['الفجوة العصارية','تخزن الماء ومواد مختلفة؛ وتكون كبيرة مركزيًا في كثير من الخلايا النباتية.'],chloroplast:['البلاستيدة الخضراء','توجد في النباتات والطحالب وتحتوي أصباغًا تمتص الضوء للبناء الضوئي.']};
      $$('[data-organelle]').forEach(b=>b.addEventListener('click',()=>{const d=organelles[b.dataset.organelle];$('#organelle-info').innerHTML=`<b>${d[0]}</b><p>${d[1]}</p>`;$$('[data-organelle]').forEach(x=>x.classList.toggle('picked',x===b));}));
      $$('[data-celltype]').forEach(b=>b.addEventListener('click',()=>{$$('[data-celltype]').forEach(x=>x.classList.toggle('active',x===b));$('.cell-drawing').classList.toggle('plant',b.dataset.celltype==='plant');$('#cell-explanation').textContent=b.dataset.celltype==='plant'?'الخلية النباتية تمتلك جدارًا خلويًا وبلاستيدات خضراء وفجوة عصارية كبيرة غالبًا، إضافة إلى النواة والميتوكوندريا والريبوسومات.':'الخلية الحيوانية لا تمتلك جدارًا خلويًا أو بلاستيدات خضراء، وتحتوي غشاءً بلازميًا ونواة وعضيات مثل الميتوكوندريا وجهاز جولجي.';}));
    }
    if(lab.kind==='fish')$$('[data-fish]').forEach(b=>b.addEventListener('click',()=>{const mode=b.dataset.fish;$$('[data-fish]').forEach(x=>x.classList.toggle('active',x===b));$('.fish-stage').dataset.kind=mode;$('#fish-environment').textContent=mode==='fresh'?'ماء عذب':'ماء البحر';$('#fish-water-arrow').textContent=mode==='fresh'?'H₂O → إلى الجسم':'H₂O ← خارج الجسم';$('#fish-salts').textContent=mode==='fresh'?'امتصاص أملاح عبر الخياشيم':'شرب ماء البحر وإخراج أملاح زائدة';$('#fish-explanation').textContent=mode==='fresh'?'في الماء العذب يميل الماء إلى الدخول إلى جسم السمكة أسموزيًا لأن سوائل جسمها أعلى تركيزًا من الوسط. تطرح السمكة بولًا مخففًا نسبيًا وتمتص الأملاح عبر الخياشيم والغذاء.':'في ماء البحر يميل الماء إلى الخروج من جسم السمكة أسموزيًا لأن الوسط أكثر تركيزًا. تشرب كثير من الأسماك البحرية الماء وتطرح الأملاح الزائدة عبر الخياشيم وتنتج بولًا أقل حجمًا.';}));
    if(lab.kind==='oxygen'){
      const update=()=>{const t=Number($('#oxygen-temp').value),s=Number($('#oxygen-salt').value);setOutput('oxygen-temp',t+'°C');setOutput('oxygen-salt',s+'‰');const index=Math.max(0.1,11.5-0.17*t-0.055*s);$('#oxygen-reading').textContent=index.toFixed(1);$('#oxygen-bubbles').style.opacity=Math.max(.12,index/11.5);$('#oxygen-explanation').textContent=`عند ${t}°C وملوحة مؤشرها ${s}‰، يوضح النموذج أن الأكسجين الذائب يميل إلى الانخفاض مع زيادة الحرارة والملوحة. الرقم مؤشر نسبي للتوضيح وليس قياسًا فعليًا.`;};on('oxygen-temp',update);on('oxygen-salt',update);
    }
    if(lab.kind==='light'){
      let color='blue';$$('[data-light]').forEach(b=>b.addEventListener('click',()=>{color=b.dataset.light;$$('[data-light]').forEach(x=>x.classList.toggle('active',x===b));update();}));
      const update=()=>{const d=Number($('#depth-light').value);setOutput('depth-light',d+' m');$('.light-rays').dataset.color=color;$('.light-rays').style.opacity=Math.max(.04,Math.exp(-d/(color==='blue'?90:color==='green'?65:35)));$('#light-depth-label').textContent=d<30?'ضوء قوي نسبيًا في هذا النموذج':d<100?'الضوء يتناقص مع العمق':'ضوء ضعيف جدًا في هذا النموذج';$('#light-explanation').textContent=`عند عمق ${d} m يقل الضوء الواصل عن السطح. اللون ${color==='blue'?'الأزرق':color==='green'?'الأخضر':'الأحمر'} له معدل امتصاص مختلف في النموذج؛ في المياه الصافية ينفذ الأزرق عادة إلى عمق أكبر من الأحمر.`;};on('depth-light',update);
    }
    if(lab.kind==='pressure')on('depth-pressure',v=>{v=Number(v);setOutput('depth-pressure',v+' m');const atm=1+v/10,kpa=101.3+9.8*v;$('#pressure-atm').textContent=atm.toFixed(1);$('#pressure-kpa').textContent=kpa.toFixed(0);$('#pressure-diver').style.top=(20+v/100*65)+'%';$('#pressure-explanation').textContent=`عند ${v} m: الضغط الكلي التقريبي = 1 + ${v}/10 = ${atm.toFixed(1)} atm، أي نحو ${kpa.toFixed(0)} kPa. هذا تقريب لماء البحر مع اعتبار الكثافة ثابتة تقريبًا.`;});
    if(lab.kind==='foodweb')on('fishing-pressure',v=>{v=Number(v);setOutput('fishing-pressure',v+'%');$('.foodweb-scene').dataset.pressure=v>70?'high':v>35?'mid':'low';$('#foodweb-status').textContent=v>70?'ضغط صيد مرتفع في النموذج: تقل الأسماك الكبيرة وقد يتغير عدد الأسماك الصغيرة والعوالق، فتتغير علاقات الشبكة.':v>35?'ضغط متوسط: يبدأ التأثير في مستويات معينة وقد تتغير وفرة المفترسات والفرائس.':'ضغط منخفض نسبيًا: الشبكة قادرة على تعويض جزء من الفقد مع توافر الموائل والغذاء.';});
    if(lab.kind==='layers'){
      const data={troposphere:['Troposphere — التروبوسفير','أدنى طبقات الغلاف الجوي، تحدث فيها معظم ظواهر الطقس ومعظم السحب.','من سطح الأرض إلى نحو 8–18 km.'],stratosphere:['Stratosphere — الستراتوسفير','توجد بها طبقة الأوزون التي تمتص معظم الأشعة فوق البنفسجية الضارة.','نحو 12–50 km.'],mesosphere:['Mesosphere — الميزوسفير','يحترق أو يتوهج فيها معظم ما نراه من الشهب.','نحو 50–85 km.'],thermosphere:['Thermosphere — الثرموسفير','ترتفع فيها درجة الحرارة، وتحدث في أجزائها العليا ظواهر الشفق القطبي.','نحو 85–500/600 km تقريبًا.'],exosphere:['Exosphere — الإكسوسفير','الطبقة الخارجية شديدة التخلخل والانتقال التدريجي إلى الفضاء.','تبدأ تقريبًا من مئات الكيلومترات العليا.']};
      $$('[data-layer]').forEach(b=>b.addEventListener('click',()=>{const d=data[b.dataset.layer];$$('[data-layer]').forEach(x=>x.classList.toggle('selected',x===b));$('#layer-info').innerHTML=`<b>${d[0]}</b><p>${d[1]}</p><small>${d[2]}</small>`;}));
    }
    if(lab.kind==='ozone'){
      let step=0;const stages=[['O₂ + hν → 2O','الخطوة 1: يمتص جزيء الأكسجين فوتونًا مناسبًا فيتفكك إلى ذرتين O منفصلتين.'],['O + O₂ + M → O₃ + M','الخطوة 2: تتحد ذرة O مع جزيء O₂. يساعد الجزيء الثالث M على حمل الطاقة الزائدة واستقرار الأوزون.'],['O₃ + hν → O₂ + O','الخطوة 3: يمتص الأوزون الأشعة فوق البنفسجية ويمكن أن يتحلل إلى أكسجين جزيئي وذرة أكسجين؛ لذلك توجد دورة تكوين وتحلل.']];
      const render=()=>{$('#ozone-reaction').textContent=stages[step][0];$('#ozone-explanation').textContent=stages[step][1];$('#ozone-status').textContent=`الخطوة ${step+1} من 3`;$('#ozone-molecules').dataset.step=step;};
      click('ozone-next',()=>{step=(step+1)%3;render();});click('ozone-prev',()=>{step=(step+2)%3;render();});click('ozone-reset',()=>{step=0;render();});
    }
    if(lab.kind==='wind')on('pressure-difference',v=>{v=Number(v);setOutput('pressure-difference',v+'%');$('#wind-arrows').style.letterSpacing=(Math.max(0.3,v/20))+'rem';$('#wind-speed-label').textContent=v<25?'تدرج ضغط ضعيف':v<65?'تدرج ضغط متوسط':'تدرج ضغط كبير';$('#wind-explanation').textContent=`كلما زاد فرق الضغط عبر مسافة متشابهة زادت قوة تدرج الضغط غالبًا. هذا يشير إلى إمكانية رياح أقوى عند ثبات العوامل الأخرى، لكن السرعة الفعلية تتأثر بالاحتكاك ودوران الأرض والتضاريس.`;});
    if(lab.kind==='humidity'){
      const saturation=t=>Math.max(1,Math.exp(17.625*t/(243.04+t)));const update=()=>{const vap=Number($('#humidity-vapour').value),t=Number($('#humidity-temp').value);setOutput('humidity-vapour',vap+'%');setOutput('humidity-temp',t+'°C');const rh=Math.min(100,Math.round(vap/100*saturation(25)/saturation(t)*100));$('#humidity-percent').textContent=rh+'%';$('#humidity-condition').textContent=rh>75?'تبخر العرق أبطأ غالبًا':rh<30?'تبخر أسرع وفقد ماء أكبر':'تبخر متوسط';$('#humidity-explanation').textContent=`عند مؤشر بخار ${vap}% ودرجة ${t}°C، الرطوبة النسبية التقريبية في هذا النموذج ${rh}%. عند زيادة الحرارة دون إضافة بخار ماء تنخفض الرطوبة النسبية غالبًا لأن سعة الهواء لبخار الماء ترتفع.`;};on('humidity-vapour',update);on('humidity-temp',update);
    }
    if(lab.kind==='greenhouse')on('gh-gases',v=>{v=Number(v);setOutput('gh-gases',v+'%');$('#gh-photons').style.opacity=(0.35+v/150).toString();$('#gh-explanation').textContent=`عند مؤشر ${v}% لغازات الدفيئة، يزيد الجزء الممتص والمعاد إصداره من الأشعة تحت الحمراء في الرسم التوضيحي. هذا ليس قياسًا لتركيز حقيقي ولا توقعًا رقميًا لدرجة حرارة الكوكب.`;});
    if(lab.kind==='acidrain')on('acid-emissions',v=>{v=Number(v);setOutput('acid-emissions',v+'%');$('#acid-ph').textContent=v>65?'انخفاض pH محتمل أكبر':v>30?'تحمّض محتمل':'تأثير أقل في النموذج';$('#acid-explanation').textContent=`كلما ارتفعت انبعاثات SOx وNOx في النموذج زادت كمية المواد التي يمكن أن تتحول إلى أحماض وتترسب. يتحدد pH الفعلي بكمية الترسيب وقدرة الماء والتربة على معادلة الحمض وعوامل أخرى.`;});
    if(lab.kind==='control')$$('[data-control]').forEach(b=>b.addEventListener('click',()=>{$$('[data-control]').forEach(x=>x.classList.toggle('active',x===b));$('.control-stage').dataset.mode=b.dataset.control;$('#control-explanation').textContent=b.dataset.control==='scrubber'?'غاسل الغازات Scrubber يلامس غازات المداخن بسائل أو مادة ماصة لإزالة ملوثات محددة، مثل جزء من SO₂.':'المحول الحفاز Catalytic Converter يستخدم مواد حفازة لتسريع تفاعلات تحول CO وNOx وبعض الهيدروكربونات في العادم إلى نواتج أقل ضررًا.';}));
  }

  function renderQuizSetup(){
    const lessonSelect=$('#quiz-lesson');if(!lessonSelect)return;
    const unit=$('#quiz-unit').value;
    const list=lessons.filter(l=>unit==='all'||String(l.unit)===unit);
    lessonSelect.innerHTML='<option value="all">كل دروس الوحدة</option>'+list.map(l=>`<option value="${l.id}">${String(l.id).padStart(2,'0')} — ${esc(l.title)}</option>`).join('');
    $('#question-total').textContent=allQuestions().length+' سؤال';
  }
  function beginQuiz(){
    const unit=$('#quiz-unit').value,lesson=$('#quiz-lesson').value,count=Number($('#quiz-count-select').value);
    let pool=allQuestions().filter(q=>(unit==='all'||String(lessonById(q.lessonId).unit)===unit)&&(lesson==='all'||String(q.lessonId)===lesson));
    if(!pool.length){toast('لا توجد أسئلة في هذا الاختيار');return;}
    for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
    state.quizQuestions=pool.slice(0,Math.min(count,pool.length));state.quizIndex=0;state.quizScore=0;state.quizAnswers=[];state.quizDone=false;
    $('#quiz-setup').hidden=true;$('#quiz-session').hidden=false;renderQuestion();
  }
  function renderQuestion(){
    const q=state.quizQuestions[state.quizIndex];if(!q)return finishQuiz();
    const n=state.quizIndex+1,total=state.quizQuestions.length;
    $('#quiz-session').innerHTML=`<div class="quiz-progress-line"><span>السؤال ${n} من ${total}</span><b>${Math.round((n-1)/total*100)}%</b></div><div class="quiz-progress"><i style="width:${(n-1)/total*100}%"></i></div><article class="quiz-question-card"><div class="question-meta"><span>LESSON ${String(q.lessonId).padStart(2,'0')}</span><span>${esc(q.lessonTitle)}</span></div><h2>${rich(q.q)}</h2><div class="answer-options">${q.o.map((o,i)=>`<button class="answer-option" data-answer="${i}"><i>${String.fromCharCode(65+i)}</i><span>${rich(o)}</span></button>`).join('')}</div><div class="answer-feedback" id="answer-feedback" hidden></div><div class="quiz-action-row"><button class="btn-primary" id="next-question" disabled>${n===total?'عرض النتيجة':'السؤال التالي'} ←</button><button class="text-link" id="exit-quiz">إنهاء الاختبار</button></div></article>`;
    $$('[data-answer]').forEach(b=>b.addEventListener('click',()=>answerQuestion(Number(b.dataset.answer),q)));
    $('#next-question').addEventListener('click',()=>{state.quizIndex++;renderQuestion();});$('#exit-quiz').addEventListener('click',()=>{if(confirm('هل تريد إنهاء الاختبار وعرض نتيجتك الحالية؟'))finishQuiz();});
  }
  function answerQuestion(choice,q){
    if($('#answer-feedback').hidden===false)return;
    const correct=choice===Number(q.a);if(correct)state.quizScore++;
    state.quizAnswers.push({choice,correct});
    $$('[data-answer]').forEach((b,i)=>{b.disabled=true;if(i===Number(q.a))b.classList.add('correct');if(i===choice&&!correct)b.classList.add('incorrect');});
    const fb=$('#answer-feedback');fb.hidden=false;fb.className='answer-feedback '+(correct?'right':'wrong');fb.innerHTML=`<b>${correct?'إجابة صحيحة ✓':'مش هي دي الإجابة ✕'}</b><p>${rich(q.e||'راجع شرح الدرس ثم حاول مرة أخرى.')}</p>`;$('#next-question').disabled=false;
  }
  function finishQuiz(){
    const total=state.quizAnswers.length,score=state.quizScore,pct=total?Math.round(score/total*100):0;
    $('#quiz-session').innerHTML=`<div class="quiz-result"><div class="result-ring" style="--score:${pct}%"><div><strong>${pct}%</strong><small>نتيجتك</small></div></div><h2>${pct>=80?'ممتاز! فهمك قوي':pct>=60?'أداء جيد، راجع النقاط الصعبة':'محتاج مراجعة وتدريب إضافي'}</h2><p>أجبت عن ${score} إجابة صحيحة من ${total} سؤال.</p><div class="result-stats"><span><b>${score}</b> صحيحة</span><span><b>${total-score}</b> غير صحيحة</span><span><b>${total}</b> إجمالي</span></div><div class="lab-button-row"><button class="btn-primary" id="retry-quiz">اختبار جديد</button><button class="btn-secondary" id="back-quiz">إعدادات الأسئلة</button></div></div>`;
    $('#retry-quiz').addEventListener('click',beginQuiz);$('#back-quiz').addEventListener('click',()=>{$('#quiz-session').hidden=true;$('#quiz-setup').hidden=false;});
  }
  function renderGlossary(filter=''){
    const term=filter.trim().toLowerCase();const items=glossary.filter(g=>`${g.en} ${g.ar} ${g.definition}`.toLowerCase().includes(term));
    $('#glossary-count').textContent=items.length+' مصطلح';$('#glossary-grid').innerHTML=items.map(g=>`<button class="glossary-card" data-term="${attr(g.en)}"><b>${esc(g.en)}</b><strong>${esc(g.ar)}</strong><small>${esc(g.definition)}</small></button>`).join('')||'<div class="empty-state">لا توجد مصطلحات مطابقة.</div>';
  }
  function openTerm(name){
    const key=String(name).toLowerCase();const term=glossary.find(g=>g.en.toLowerCase()===key)||glossary.find(g=>g.ar===name)||glossary.find(g=>g.en.toLowerCase().includes(key));
    if(!term){toast('المصطلح غير موجود في القاموس بعد');return;}
    $('#term-en').textContent=term.en;$('#term-ar').textContent=term.ar;$('#term-description').textContent=term.definition;$('#term-example').textContent=term.example?`مثال: ${term.example}`:'';$('#term-modal').showModal();
  }
  function renderMap(){
    $('#curriculum-grid').innerHTML=[1,2].map(unit=>`<section class="map-unit"><header><span>UNIT 0${unit}</span><b>${unit===1?'النظام البيئي المائي':'الغلاف الجوي'}</b><small>${unit===1?'10 دروس':'4 دروس'}</small></header>${lessons.filter(l=>l.unit===unit).map(l=>`<button class="map-lesson" data-lesson="${l.id}"><i>${String(l.id).padStart(2,'0')}</i><span><b>${esc(l.title)}</b><small>${esc(l.en)}</small></span><em>${state.completed.has(l.id)?'✓':'↗'}</em></button>`).join('')}</section>`).join('');
    $('#reference-links').innerHTML=refs.map(r=>`<a href="${attr(r.url)}" target="_blank" rel="noopener"><b>${esc(r.name)}</b><small>${esc(r.note)}</small><i>↗</i></a>`).join('');
  }
  function performSearch(value){
    const v=value.trim().toLowerCase();if(!v)return;
    const match=lessons.find(l=>`${l.title} ${l.en} ${l.intro} ${l.sections.map(s=>s.title+' '+(s.paragraphs||[]).join(' ')).join(' ')}`.toLowerCase().includes(v));
    const term=glossary.find(g=>`${g.en} ${g.ar} ${g.definition}`.toLowerCase().includes(v));
    const lab=labs.find(l=>`${l.title} ${l.en} ${l.desc}`.toLowerCase().includes(v));
    if(match){switchView('lessons');renderLessonBrowser(v);renderLesson(match.id);return;}
    if(term){switchView('glossary');renderGlossary(value);return;}
    if(lab){switchView('lab');renderLab(lab.id);return;}
    toast('لم أجد نتيجة مطابقة. جرّب كلمة أخرى.');
  }

  document.addEventListener('click',event=>{
    const viewBtn=event.target.closest('[data-view]');if(viewBtn){switchView(viewBtn.dataset.view);return;}
    const lessonBtn=event.target.closest('[data-lesson]');if(lessonBtn){const id=Number(lessonBtn.dataset.lesson);switchView('lessons');renderLessonBrowser();renderLesson(id);return;}
    const labBtn=event.target.closest('[data-open-lab]');if(labBtn){switchView('lab');renderLab(labBtn.dataset.openLab);return;}
    const term=event.target.closest('[data-term]');if(term){openTerm(term.dataset.term);return;}
    const complete=event.target.closest('[data-complete]');if(complete){setComplete(complete.dataset.complete);return;}
    const quiz=event.target.closest('[data-open-lesson-quiz]');if(quiz){switchView('quiz');$('#quiz-unit').value=String(lessonById(quiz.dataset.openLessonQuiz)?.unit||'all');renderQuizSetup();$('#quiz-lesson').value=quiz.dataset.openLessonQuiz;$('#quiz-count-select').value='15';beginQuiz();return;}
    const openLab=event.target.closest('[data-open-lab-for-lesson]');if(openLab){const lab=getLessonLab(openLab.dataset.openLabForLesson);if(lab){switchView('lab');renderLab(lab.id);}return;}
    const visual=event.target.closest('[data-open-visual]');if(visual){const id=visual.dataset.openVisual;const lab=labs.find(l=>l.lesson===state.lessonId&&((id==='water-distribution'&&l.kind==='distribution')||(id==='water-cycle'&&l.kind==='water-cycle')||(id==='molecule'&&l.kind==='molecule')||(id==='osmosis'&&l.kind==='osmosis')||(id==='atmosphere-layers'&&l.kind==='layers')||(id==='ozone-cycle'&&l.kind==='ozone')||(id==='greenhouse'&&l.kind==='greenhouse')))||getLessonLab(state.lessonId);if(lab){switchView('lab');renderLab(lab.id);}else{switchView('lab');renderLab(state.labId);}return;}
    const unit=event.target.closest('[data-unit]');if(unit){switchView('lessons');renderLessonBrowser();const first=lessons.find(l=>String(l.unit)===unit.dataset.unit);if(first)renderLesson(first.id);return;}
    const switchLesson=event.target.closest('[data-switch-lesson]');if(switchLesson){const id=Number(switchLesson.dataset.lesson);switchView('lessons');renderLessonBrowser();renderLesson(id);return;}
  });
  $('#mobile-menu')?.addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
  $('#start-learning')?.addEventListener('click',()=>{switchView('lessons');renderLessonBrowser();renderLesson(1);});
  $('#global-search')?.addEventListener('keydown',e=>{if(e.key==='Enter')performSearch(e.target.value);});
  $('#global-search')?.addEventListener('input',e=>{if(e.target.value.length>2){/* search on Enter to avoid replacing the reading view while typing */}});
  $('#glossary-search')?.addEventListener('input',e=>renderGlossary(e.target.value));
  $('#quiz-unit')?.addEventListener('change',renderQuizSetup);
  $('#begin-quiz')?.addEventListener('click',beginQuiz);
  $('#close-term')?.addEventListener('click',()=>$('#term-modal').close());
  $('#term-modal')?.addEventListener('click',e=>{if(e.target===$('#term-modal'))$('#term-modal').close();});
  $('#theme-toggle')?.addEventListener('click',()=>{state.theme=state.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=state.theme;store.write('aqua-theme',state.theme);});
  $('#reset-progress')?.addEventListener('click',()=>{if(confirm('هل تريد مسح تقدم الدروس المحفوظ على هذا الجهاز؟')){state.completed.clear();store.write('aqua-completed',[]);updateProgress();renderHome();toast('تمت إعادة ضبط التقدم.');}});
  document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('#global-search')?.focus();}if(e.key==='Escape')$('#sidebar').classList.remove('open');});

  document.documentElement.dataset.theme=state.theme;
  renderHome();renderSidebar();renderLessonBrowser();renderLabLibrary();renderQuizSetup();renderMap();
})();

(function(){
    const path = location.pathname;
    document.querySelectorAll('.nav-links a').forEach(a => {
      const h = a.getAttribute('href') || '';
      if((path.endsWith('store.html') && h.includes('store')) ||
         (path.endsWith('about.html') && h.includes('about')) ||
         ((path==='/'||path.endsWith('index.html')) && (h==='/'||h.endsWith('index.html')||h==='./')))
        a.classList.add('active');
    });
  })();

  function copyScript(btn){
    const pre = btn.closest('.script-card').querySelector('pre');
    navigator.clipboard.writeText(pre.textContent).then(()=>{
      const o=btn.textContent;
      btn.textContent='✓ تم النسخ';
      btn.style.color='#22c55e';btn.style.borderColor='#22c55e';
      setTimeout(()=>{btn.textContent=o;btn.style.color='';btn.style.borderColor='';},2000);
    });
  }
  
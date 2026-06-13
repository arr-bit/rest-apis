// ARR Official REST API — script.js
// Frontend auto-render dari /api/endpoints

document.addEventListener('DOMContentLoaded', function () {

  // Clock
  function updateTime() {
    const now = new Date();
    const h = now.getHours().toString().padStart(2, '0');
    const m = now.getMinutes().toString().padStart(2, '0');
    const s = now.getSeconds().toString().padStart(2, '0');
    document.getElementById('jam').textContent = h+':'+m+':'+s;
  }
  function updateDate() {
    const now = new Date();
    const d = now.getDate().toString().padStart(2, '0');
    const mo = (now.getMonth()+1).toString().padStart(2,'0');
    const y = now.getFullYear();
    document.getElementById('tanggal').textContent = d+'/'+mo+'/'+y;
  }
  updateTime(); updateDate();
  setInterval(updateTime, 1000);

  // Copy Code
  const copyBtn = document.getElementById('copyButton');
  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      navigator.clipboard.writeText(document.getElementById('codeBlock').innerText).then(() => {
        showToast('Kode berhasil disalin');
        this.textContent = 'Copied!';
        setTimeout(() => { this.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy'; }, 2000);
      });
    });
  }

  // Copy Dana
  const danaBtn = document.getElementById('copyDanaBtn');
  if (danaBtn) {
    danaBtn.addEventListener('click', function () {
      navigator.clipboard.writeText('085262562560').then(() => {
        showToast('Nomor Dana disalin');
        this.textContent = 'Tersalin!';
        setTimeout(() => { this.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2v1"/></svg> Salin Nomor'; }, 2000);
      });
    });
  }

  // Auto-render endpoints
  loadEndpoints();
});

async function loadEndpoints() {
  const container = document.getElementById('accordion-container');
  const statEl = document.getElementById('stat-endpoints');

  try {
    const res = await fetch('/api/endpoints');
    const data = await res.json();

    if (statEl) statEl.textContent = data.totalEndpoints;

    container.innerHTML = '';
    data.categories.forEach(function(cat, i) {
      var accId = 'acc-auto-' + i;
      var hasEp = cat.endpoints && cat.endpoints.length > 0;
      var countText = hasEp ? cat.endpoints.length + ' endpoint' + (cat.endpoints.length > 1 ? 's' : '') : 'Coming soon';

      var cardsHTML = '';
      if (hasEp) {
        cardsHTML = '<div class="endpoint-grid">' + cat.endpoints.map(function(ep) {
          var paramsHTML = '';
          if (ep.params && ep.params.length > 0) {
            paramsHTML = '<div class="ep-params">' + ep.params.map(function(p) {
              return '<span class="ep-param ' + (p.required ? 'required' : 'optional') + '"><span class="param-name">' + p.name + '</span><span class="param-badge">' + (p.required ? 'required' : 'optional') + '</span></span>';
            }).join('') + '</div>';
          }
          return '<div class="ep-card"><div class="ep-head"><span class="ep-method">' + ep.method + '</span><code class="ep-path">' + ep.path + '</code></div><p class="ep-desc">' + ep.desc + '</p>' + paramsHTML + '<a href="' + ep.tryUrl + '" target="_blank" class="ep-try">Try It <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 9.5L9.5 2.5M9.5 2.5H4M9.5 2.5V8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></a></div>';
        }).join('') + '</div>';
      } else {
        cardsHTML = '<div class="coming-soon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg><p>Segera hadir</p></div>';
      }

      var accEl = document.createElement('div');
      accEl.className = 'accordion';
      accEl.id = accId;
      accEl.innerHTML = '<button class="acc-header" onclick="toggleAcc(\''+accId+'\')">'
        + '<div class="acc-left"><span class="acc-num">'+String(i+1).padStart(2,'0')+'</span>'
        + '<div><span class="acc-title">'+cat.category+'</span><span class="acc-count">'+countText+'</span></div></div>'
        + '<div class="acc-right"><span class="acc-tag">'+cat.tag+'</span>'
        + '<svg class="acc-chevron" width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M4.5 6.75L9 11.25L13.5 6.75" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'
        + '</div></button>'
        + '<div class="acc-body">'+cardsHTML+'</div>';
      container.appendChild(accEl);
    });

  } catch(err) {
    console.error('Gagal load endpoints:', err);
    container.innerHTML = '<div class="coming-soon" style="padding:40px"><p>Gagal memuat daftar endpoint</p></div>';
  }
}

function toggleAcc(accId) {
  var acc = document.getElementById(accId);
  var body = acc.querySelector('.acc-body');
  if (acc.classList.contains('open')) {
    body.classList.remove('open');
    acc.classList.remove('open');
  } else {
    body.classList.add('open');
    acc.classList.add('open');
  }
}

function showToast(msg) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(function(){ t.classList.remove('show'); }, 2200);
}

// ─── Dock Navigation: liquid glass magnification, reflection, scroll-spy ───
document.addEventListener('DOMContentLoaded', function () {
  const dock = document.getElementById('dock');
  if (!dock) return;

  const items     = Array.from(dock.querySelectorAll('.dock-item'));
  const reflItems = Array.from(dock.querySelectorAll('.dock-item-r'));
  const liquid    = document.getElementById('dockLiquid');
  const bubble    = document.getElementById('dockBubble');
  const tooltip   = document.getElementById('dockTooltip');

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const MAX_SCALE = 1.35; // peak magnification
  const MAX_LIFT  = 18;   // px translateY at peak
  const RANGE     = 95;   // px radius of influence on neighbours

  const state = items.map(() => ({ scale: 1, lift: 0, tScale: 1, tLift: 0 }));

  let centers = [];
  let dockRect = null;
  let activeIndex = 0;

  function measure() {
    dockRect = dock.getBoundingClientRect();
    centers = items.map(it => {
      const r = it.getBoundingClientRect();
      return r.left + r.width / 2 - dockRect.left;
    });
  }
  measure();
  window.addEventListener('resize', measure);

  let pointerX = null;
  let liquidX = 0, liquidTargetX = 0;
  let liquidOp = 0, liquidTargetOp = 0;
  let bubbleX = centers[0] || 0, bubbleTarget = bubbleX;

  function setTargets() {
    items.forEach((it, i) => {
      if (pointerX === null) {
        state[i].tScale = 1;
        state[i].tLift  = 0;
        return;
      }
      const dist = Math.abs(pointerX - centers[i]);
      const influence = Math.max(0, 1 - dist / RANGE);
      const eased = influence * influence * (3 - 2 * influence); // smoothstep
      state[i].tScale = 1 + (MAX_SCALE - 1) * eased;
      state[i].tLift  = -MAX_LIFT * eased;
    });
  }

  function setActive(i) {
    if (activeIndex === i) return;
    items[activeIndex].classList.remove('active');
    items[i].classList.add('active');
    activeIndex = i;
    bubbleTarget = centers[i];
  }

  function showTooltip(i) {
    tooltip.textContent = items[i].dataset.label;
    tooltip.style.left = centers[i] + 'px';
    tooltip.classList.add('show');
  }
  function hideTooltip() { tooltip.classList.remove('show'); }

  items.forEach((item, i) => {
    item.addEventListener('click', () => setActive(i));
    item.addEventListener('focus', () => {
      pointerX = centers[i];
      setTargets();
      showTooltip(i);
    });
    item.addEventListener('blur', () => {
      pointerX = null;
      setTargets();
      hideTooltip();
    });
  });

  dock.addEventListener('mousemove', (e) => {
    pointerX = e.clientX - dockRect.left;
    liquidTargetX = pointerX - 48;
    liquidTargetOp = 1;
    setTargets();

    let nearest = 0, best = Infinity;
    centers.forEach((c, i) => {
      const d = Math.abs(pointerX - c);
      if (d < best) { best = d; nearest = i; }
    });
    if (best < 30) showTooltip(nearest); else hideTooltip();
  });

  dock.addEventListener('mouseenter', () => { liquidTargetOp = 1; });

  dock.addEventListener('mouseleave', () => {
    pointerX = null;
    liquidTargetOp = 0;
    setTargets();
    hideTooltip();
  });

  dock.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    pointerX = t.clientX - dockRect.left;
    liquidTargetX = pointerX - 48;
    liquidTargetOp = 1;
    setTargets();
  }, { passive: true });

  dock.addEventListener('touchend', () => {
    pointerX = null;
    liquidTargetOp = 0;
    setTargets();
  });

  function animate() {
    const ease = reduceMotion ? 1 : 0.18;

    items.forEach((item, i) => {
      const s = state[i];
      s.scale += (s.tScale - s.scale) * ease;
      s.lift  += (s.tLift  - s.lift)  * ease;
      item.style.transform = `translateY(${s.lift}px) scale(${s.scale})`;

      const r = reflItems[i];
      if (r) r.style.transform = `scale(${0.94 + (s.scale - 1) * 0.5})`;
    });

    liquidX  += (liquidTargetX  - liquidX)  * 0.16;
    liquidOp += (liquidTargetOp - liquidOp) * 0.14;
    liquid.style.transform = `translateX(${liquidX}px)`;
    liquid.style.opacity = liquidOp;

    bubbleX += (bubbleTarget - bubbleX) * 0.2;
    bubble.style.transform = `translateX(${bubbleX - 3}px)`;

    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);

  // ── Scroll-spy: highlight dock item matching the visible section ──
  const sectionIds = items.map(it => (it.getAttribute('href') || '').replace('#', ''));
  const sections = sectionIds.map(id => document.getElementById(id)).filter(Boolean);

  if (sections.length) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const idx = sectionIds.indexOf(entry.target.id);
          if (idx !== -1) setActive(idx);
        }
      });
    }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });

    sections.forEach(sec => observer.observe(sec));
  }
});

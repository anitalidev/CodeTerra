// Adds an "Analytics" tab to a Codeforces profile page (next to Settings, Blog, ...). Opening it shows the
// analytics panel in place of the profile. Loaded last, after the other analytics-*.js files.
(() => {
  'use strict';

  const match = location.pathname.match(/^\/profile\/(.+?)\/?$/);
  if (!match || document.getElementById('cta-host')) return;
  // Tolerate a pasted URL ending up in the path (e.g. /profile/https%3A%2F%2Fcodeforces.com%2Fprofile%2FX).
  const raw = decodeURIComponent(match[1]);
  const HANDLE = (raw.match(/profile\/([^/?#\s]+)/i) || [null, raw])[1];
  if (!/^[\w.-]{3,24}$/.test(HANDLE) || raw !== HANDLE) return;

  const { esc, fmt, api, compactSubs, compactRatings, readProfileStats, loadProblemset, viewerHandle,
    fetchPrivateSubs, needsLookup, buildCanon, analyze, practicePlan, tip, createViews } = window.CTA;

  const TAB_HASH = '#analytics';
  const JUMPS = [['practice', 'Practice'], ['tags', 'Tags'], ['progress', 'Progress'], ['monthly', 'Monthly'], ['ratings', 'By rating'], ['submissions', 'Submissions'], ['coverage', 'Data']];

  // ---------------------------------------------------------------- the profile page's own tab menu
  const menuList = document.querySelector('.second-level-menu-list') || document.querySelector('.second-level-menu ul');
  const pageContent = document.getElementById('pageContent');
  if (!menuList || !pageContent) return;

  const tabs = [...menuList.querySelectorAll('li')].filter((li) => li.querySelector('a'));
  const samePath = (a) => new URL(a.href, location.origin).pathname.replace(/\/$/, '') === location.pathname.replace(/\/$/, '');
  const ownTab = tabs.find((li) => samePath(li.querySelector('a')));
  const otherTab = tabs.find((li) => li !== ownTab);
  const settingsTab = tabs.find((li) => new URL(li.querySelector('a').href, location.origin).pathname.startsWith('/settings'));
  // Codeforces highlights the current tab with a sliding "lava lamp" element rather than a class.
  // Looked up when needed: the script that creates it can run after this one.
  const getLava = () => menuList.querySelector('.backLava');

  // Whatever classes make the profile's own tab look "current" are moved onto the Analytics tab while it is open.
  const classesOnlyOn = (el, reference) => (el && reference ? [...el.classList].filter((c) => !reference.classList.contains(c)) : []);
  const liMarkers = classesOnlyOn(ownTab, otherTab);
  const aMarkers = classesOnlyOn(ownTab?.querySelector('a'), otherTab?.querySelector('a'));

  const tabItem = document.createElement('li');
  const tabLink = document.createElement('a');
  tabLink.href = `${location.pathname}${TAB_HASH}`;
  tabLink.textContent = 'Analytics';
  tabLink.className = [...(otherTab?.querySelector('a')?.classList ?? [])].join(' ');
  tabItem.className = [...(otherTab?.classList ?? [])].join(' ');
  tabItem.append(tabLink);
  // Second tab: right before Settings (or after the profile's own tab, or last if neither is found).
  if (settingsTab) settingsTab.before(tabItem);
  else if (ownTab) ownTab.after(tabItem);
  else menuList.append(tabItem);

  const pageStyle = document.createElement('style');
  pageStyle.textContent = `
    .cta-open > .backLava { left: var(--cta-lava-left) !important; width: var(--cta-lava-width) !important; transition: left .4s ease, width .4s ease !important; }
    #pageContent .cta-no-lava.cta-tab-current > a { background: #d4d4d4 !important; border-radius: 4px; }
    #pageContent .cta-no-lava.cta-own-tab-off, #pageContent .cta-no-lava.cta-own-tab-off > a { background: transparent !important; }`;
  document.head.append(pageStyle);

  function markCurrent(analyticsOpen) {
    if (ownTab) {
      ownTab.classList.toggle('cta-own-tab-off', analyticsOpen);
      for (const c of liMarkers) ownTab.classList.toggle(c, !analyticsOpen);
      for (const c of aMarkers) ownTab.querySelector('a').classList.toggle(c, !analyticsOpen);
    }
    for (const c of liMarkers) tabItem.classList.toggle(c, analyticsOpen);
    for (const c of aMarkers) tabLink.classList.toggle(c, analyticsOpen);
    tabItem.classList.toggle('cta-tab-current', analyticsOpen);
    const noLava = !getLava();
    ownTab?.classList.toggle('cta-no-lava', noLava);
    tabItem.classList.toggle('cta-no-lava', noLava);
    moveLava(analyticsOpen);
  }

  // Codeforces' lava-lamp script slides a highlight under the hovered tab and snaps it back to the current tab when
  // the mouse leaves; it knows nothing about our tab. So the highlight is driven here instead: while the panel is open
  // it is pinned by an !important rule (the lava-lamp script's own inline styles can't override that) and moved with a
  // CSS transition; while closed, it only slides under Analytics on hover and the lava-lamp script does the rest.
  const slide = (el) => {
    menuList.style.setProperty('--cta-lava-left', `${el.offsetLeft}px`);
    menuList.style.setProperty('--cta-lava-width', `${el.offsetWidth}px`);
  };
  function moveLava(analyticsOpen) {
    const lava = getLava();
    if (!lava) return;
    clearTimeout(moveLava.timer);
    if (analyticsOpen) {
      // Start from where the highlight is now so it slides rather than jumps.
      menuList.style.setProperty('--cta-lava-left', getComputedStyle(lava).left);
      menuList.style.setProperty('--cta-lava-width', getComputedStyle(lava).width);
      menuList.classList.add('cta-open');
      void lava.offsetWidth;
      slide(tabItem);
    } else if (menuList.classList.contains('cta-open')) {
      slide(ownTab || tabs[0]);
      moveLava.timer = setTimeout(() => menuList.classList.remove('cta-open'), 450);
    }
  }
  for (const tab of [...tabs, tabItem]) {
    tab.addEventListener('mouseenter', () => {
      const lava = getLava();
      if (!lava) return;
      if (menuList.classList.contains('cta-open')) { slide(tab); return; }
      lava.style.transition = tab === tabItem ? 'left .4s ease, width .4s ease' : '';
      if (tab === tabItem) { lava.style.left = `${tabItem.offsetLeft}px`; lava.style.width = `${tabItem.offsetWidth}px`; }
    });
  }
  menuList.addEventListener('mouseleave', () => {
    const lava = getLava();
    if (!lava) return;
    if (menuList.classList.contains('cta-open')) slide(tabItem);
    else setTimeout(() => { lava.style.transition = ''; }, 800);
  });
  window.addEventListener('resize', () => { if (menuList.classList.contains('cta-open')) slide(tabItem); });

  // ---------------------------------------------------------------- the panel
  // Mount inside a shadow root so the host page's CSS can't restyle the panel.
  const host = document.createElement('div');
  host.id = 'cta-host';
  host.style.display = 'none'; // not the hidden attribute: the shadow's :host rule would override it
  host.style.marginTop = '0'; // flush under the tab menu, like the profile box it replaces
  const shadow = host.attachShadow({ mode: 'open' });
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(window.CTA_CSS || '');
    shadow.adoptedStyleSheets = [sheet];
  } catch (_) {
    const style = document.createElement('style');
    style.textContent = window.CTA_CSS || '';
    shadow.appendChild(style);
  }
  tip.root = shadow;

  const root = document.createElement('div');
  root.id = 'cta-root';
  root.innerHTML = `
    <div class="cta-topbar"><div class="cta-jump" role="navigation"></div></div>
    <div class="cta-main"></div>`;
  shadow.appendChild(root);
  const main = root.querySelector('.cta-main');

  // While the panel is open, everything after the menu on the profile page is hidden; the panel takes its place.
  let menuBranch = menuList;
  while (menuBranch.parentElement && menuBranch.parentElement !== pageContent) menuBranch = menuBranch.parentElement;
  if (menuBranch.parentElement === pageContent) menuBranch.after(host);
  else pageContent.prepend(host);

  const contentAfterMenu = () => {
    const out = [];
    for (let el = menuList; el && el !== pageContent; el = el.parentElement) {
      for (let sib = el.nextElementSibling; sib; sib = sib.nextElementSibling) if (sib !== host) out.push(sib);
    }
    if (menuBranch.parentElement !== pageContent) out.push(...[...pageContent.children].filter((c) => c !== host));
    return out;
  };

  let isOpen = false;
  let hiddenByUs = [];
  function setOpen(open) {
    if (open === isOpen) return;
    isOpen = open;
    if (open) {
      hiddenByUs = contentAfterMenu().map((el) => [el, el.style.display]);
      hiddenByUs.forEach(([el]) => { el.style.display = 'none'; });
    } else {
      hiddenByUs.forEach(([el, display]) => { el.style.display = display; });
      hiddenByUs = [];
    }
    host.style.display = open ? '' : 'none';
    markCurrent(open);
    if (open) {
      history.replaceState(null, '', `${location.pathname}${location.search}${TAB_HASH}`);
      if (!S.A && !loading) load();
      else renderActive();
    } else {
      history.replaceState(null, '', `${location.pathname}${location.search}`);
    }
  }

  tabLink.addEventListener('click', (e) => { e.preventDefault(); setOpen(true); });
  // The profile's own tab points at this same page, so switch back without reloading it.
  ownTab?.querySelector('a')?.addEventListener('click', (e) => {
    if (!isOpen || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    e.preventDefault();
    setOpen(false);
  });
  window.addEventListener('hashchange', () => setOpen(location.hash === TAB_HASH));

  // ---------------------------------------------------------------- loading
  const S = { A: null, plan: null, HANDLE, showAllTags: false, suggestions: null, problemset: null, rerender: () => renderActive() };
  let loading = false;
  let views = null;

  async function load() {
    loading = true;
    main.innerHTML = '<div class="cta-status"><span class="cta-spinner"></span>Loading submissions and contest history…</div>';
    const status = () => main.querySelector('.cta-status')?.lastChild;
    try {
      let subs = await api('user.status', { handle: HANDLE }, { compact: compactSubs });
      const official = readProfileStats();
      const apiSolved = new Set(subs.filter((x) => x.v === 'OK').map((x) => `${x.c || x.ps}-${x.i}`)).size;
      const viewer = viewerHandle();
      if (official.solved != null && official.solved > apiSolved && viewer && viewer.toLowerCase() === HANDLE.toLowerCase()) {
        try {
          const found = await fetchPrivateSubs(HANDLE, subs, (pg, n) => { status().textContent = `Reading your private submissions (page ${pg} of ${n})…`; });
          subs = subs.concat(found);
        } catch (_) { /* fall back to API-only data */ }
      }
      let ratings = [];
      try { ratings = await api('user.rating', { handle: HANDLE }, { compact: compactRatings }); } catch (_) { /* unrated users */ }
      let canon = null;
      if (subs.some(needsLookup)) {
        status().textContent = 'Matching gym / hidden-set problems against the problemset…';
        try { canon = buildCanon(await loadProblemset()); } catch (_) { /* analysis still works without it */ }
      }
      const A = analyze(subs, ratings, canon);
      A.official = official;
      A.privateSolved = A.all.filter((p) => p.solvedAt != null && p.priv).length;
      A.hidden = official.solved != null ? Math.max(0, official.solved - A.solved.length) : 0;
      A.isOwner = !!(viewer && viewer.toLowerCase() === HANDLE.toLowerCase());
      A.totalSolved = A.solved.length + A.hidden;
      S.A = A;
      S.plan = practicePlan(A);
      S.suggestions = null;
      buildShell();
    } catch (e) {
      main.innerHTML = `<div class="cta-status err">Couldn't load data: ${esc(e.message)}</div>`;
    } finally {
      loading = false;
    }
  }

  function buildShell() {
    views = createViews(S);
    main.innerHTML = '<div class="cta-page"></div>';
    renderActive();
  }

  // ---------------------------------------------------------------- the dashboard
  // Sections can be folded; the choice is remembered per section. A folded section isn't drawn until it's opened,
  // because charts need a visible element to measure.
  const FOLDED_BY_DEFAULT = new Set(['coverage']);
  let folds = {};
  try { folds = JSON.parse(localStorage.getItem('cta:folds2') || '{}'); } catch (_) { /* ignore */ }
  const saveFolds = () => { try { localStorage.setItem('cta:folds2', JSON.stringify(folds)); } catch (_) { /* ignore */ } };
  const isFolded = (id) => (id in folds ? folds[id] : FOLDED_BY_DEFAULT.has(id));

  const sectionEls = () => [...main.querySelectorAll('.cta-section')];

  function setFold(sec, folded) {
    sec.classList.toggle('folded', folded);
    sec.querySelector(':scope > h3').setAttribute('aria-expanded', String(!folded));
    if (!folded) sec._fill();
  }

  function renderActive() {
    if (!S.A || !isOpen || !views) return;
    const page = main.querySelector('.cta-page');
    if (!page) return;
    tip.hide();
    const list = views.renderDashboard(page);
    root.querySelector('.cta-jump').innerHTML = list.map((s, i) => `<button class="cta-jump-btn" data-jump="${s.id}">${JUMPS.find((j) => j[0] === s.id)?.[1] ?? s.title}</button>`).join('');
    root.querySelectorAll('[data-jump]').forEach((b) => b.addEventListener('click', () => {
      const sec = page.querySelector(`[data-sec="${b.dataset.jump}"]`);
      if (!sec) return;
      if (sec.classList.contains('folded')) { folds[sec.dataset.sec] = false; saveFolds(); setFold(sec, false); }
      sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
    for (const sec of sectionEls()) {
      const h3 = sec.querySelector(':scope > h3');
      const toggle = () => {
        const folded = !sec.classList.contains('folded');
        folds[sec.dataset.sec] = folded;
        saveFolds();
        setFold(sec, folded);
      };
      h3.addEventListener('click', toggle);
      h3.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
      sec.classList.toggle('folded', isFolded(sec.dataset.sec));
      h3.setAttribute('aria-expanded', String(!sec.classList.contains('folded')));
    }
    for (const sec of sectionEls()) if (!sec.classList.contains('folded')) sec._fill();
  }

  let resizeT;
  let lastW = root.clientWidth;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      if (!isOpen || root.clientWidth === lastW) return;
      lastW = root.clientWidth;
      sectionEls().forEach((sec) => { if (!sec.classList.contains('folded')) sec._redraw(); });
    }, 150);
  });

  if (location.hash === TAB_HASH) setOpen(true);
})();

// Codeforces data access: the public API (rate limited, cached), the profile page's own numbers, and a viewer's private submissions pages.
(() => {
  'use strict';
  const { sleep } = window.CTA;

  // ---------------------------------------------------------------- API
  let lastCall = 0;
  let problemset = null;
  async function api(method, params, { cacheMin = 10, compact } = {}) {
    const qs = new URLSearchParams(params).toString();
    const cacheKey = `cta3:${method}:${qs}`;
    try {
      const hit = JSON.parse(sessionStorage.getItem(cacheKey) || 'null');
      if (hit && Date.now() - hit.t < cacheMin * 60e3) return hit.d;
    } catch (_) { /* storage unavailable */ }

    for (let attempt = 0; attempt < 5; attempt++) {
      const wait = lastCall + 2100 - Date.now(); // Codeforces allows ~1 call / 2s
      if (wait > 0) await sleep(wait);
      lastCall = Date.now();
      let res, body = null;
      try {
        res = await fetch(`/api/${method}?${qs}`);
        body = await res.json();
      } catch (_) { /* network or non-JSON */ }
      if (body && body.status === 'OK') {
        const data = compact ? compact(body.result) : body.result;
        try { sessionStorage.setItem(cacheKey, JSON.stringify({ t: Date.now(), d: data })); } catch (_) { /* quota */ }
        return data;
      }
      const comment = (body && body.comment) || (res ? `HTTP ${res.status}` : 'Network error');
      if (/limit exceeded/i.test(comment) || !res || res.status >= 500 || res.status === 429) {
        await sleep(1500 * (attempt + 1));
        continue;
      }
      throw new Error(comment);
    }
    throw new Error('Codeforces API is busy (rate limit). Try again in a few seconds.');
  }

  // Keep only the fields we use, so large histories fit in sessionStorage.
  const compactSubs = (subs) => subs.map((s) => ({
    id: s.id, t: s.creationTimeSeconds, c: s.problem.contestId, ps: s.problem.problemsetName, i: s.problem.index,
    n: s.problem.name, r: s.problem.rating, g: s.problem.tags, v: s.verdict || 'TESTING',
    l: s.programmingLanguage, p: s.author && s.author.participantType,
  }));
  const compactRatings = (rs) => rs.map((r) => ({
    t: r.ratingUpdateTimeSeconds, c: r.contestId, n: r.contestName, rank: r.rank, o: r.oldRating, r: r.newRating,
  }));

  function readProfileStats() {
    const frame = document.querySelector('._UserActivityFrame_frame');
    const txt = frame ? frame.textContent.replace(/\s+/g, ' ') : '';
    const num = (re) => { const m = txt.match(re); return m ? Number(m[1]) : null; };
    let calendarDays = null;
    for (const sc of document.scripts) {
      const days = sc.textContent.match(/"\d{4}-\d{2}-\d{2}":\s*\{\s*items/g);
      if (days) calendarDays = Math.max(calendarDays || 0, days.length);
    }
    return {
      solved: num(/(\d+)\s+problems?\s+solved\s+for\s+all\s+time/i),
      maxStreak: num(/(\d+)\s+days?\s+in\s+a\s+row\s+max/i),
      calendarDays,
    };
  }

  async function loadProblemset() {
    if (!problemset) {
      problemset = await api('problemset.problems', {}, {
        cacheMin: 60,
        compact: (res) => {
          const solvedCount = new Map(res.problemStatistics.map((st) => [`${st.contestId}-${st.index}`, st.solvedCount]));
          return res.problems.map((p) => ({
            c: p.contestId, i: p.index, n: p.name, r: p.rating, tags: p.tags, solvedCount: solvedCount.get(`${p.contestId}-${p.index}`) || 0,
          }));
        },
      });
    }
    return problemset;
  }

  const viewerHandle = () => {
    const a = document.querySelector('.lang-chooser a[href^="/profile/"]');
    return a ? a.textContent.trim() : null;
  };
  const MON = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  function parseCfTime(text) {
    const m = text.match(/([A-Z][a-z]{2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
    if (!m || !(m[1] in MON)) return null;
    // Times are shown in the viewer's timezone setting ("UTC-7"); Moscow time when none is shown.
    const tz = text.match(/UTC\s*([+-])\s*(\d{1,2})(?::(\d{2}))?/);
    const offMin = tz ? (tz[1] === '-' ? -1 : 1) * (Number(tz[2]) * 60 + Number(tz[3] || 0)) : 180;
    return (Date.UTC(+m[3], MON[m[1]], +m[2], +m[4], +m[5]) - offMin * 60e3) / 1000;
  }
  function parseSubmissionRows(doc) {
    const out = [];
    for (const tr of doc.querySelectorAll('table.status-frame-datatable tr[data-submission-id]')) {
      const td = tr.querySelectorAll('td');
      const a = td[3] && td[3].querySelector('a');
      const verdict = tr.querySelector('[submissionverdict]');
      const t = td[1] ? parseCfTime(td[1].textContent) : null;
      if (!a || t == null) continue;
      const href = a.getAttribute('href') || '';
      const pm = href.match(/\/(?:contest|gym)\/(\d+)\/problem\/(\w+)/) || href.match(/\/problemset\/problem\/(\d+)\/(\w+)/);
      const label = a.textContent.replace(/\s+/g, ' ').trim();
      const lm = label.match(/^(\w+)\s+-\s+(.+)$/);
      out.push({
        id: Number(tr.dataset.submissionId), t,
        c: pm ? Number(pm[1]) : null, i: pm ? pm[2] : lm ? lm[1] : '?', n: lm ? lm[2] : label,
        r: undefined, g: [], v: verdict ? verdict.getAttribute('submissionverdict') || 'TESTING' : 'TESTING',
        l: td[4] ? td[4].textContent.replace(/\s+/g, ' ').trim() : '', p: null,
        u: new URL(href, location.origin).href, priv: true,
      });
    }
    return out;
  }
  async function fetchPrivateSubs(HANDLE, apiSubs, onProgress) {
    const cacheKey = `cta3:private:${HANDLE}`;
    try {
      const hit = JSON.parse(sessionStorage.getItem(cacheKey) || 'null');
      if (hit && Date.now() - hit.t < 10 * 60e3) return hit.d;
    } catch (_) { /* ignore */ }
    const known = new Set(apiSubs.map((x) => x.id));
    const found = [];
    let pages = 1;
    for (let page = 1; page <= Math.min(pages, 80); page++) {
      onProgress(page, pages);
      const res = await fetch(`/submissions/${encodeURIComponent(HANDLE)}/page/${page}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`); // don't cache a partial read
      const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
      if (page === 1) {
        const idx = [...doc.querySelectorAll('.pagination .page-index')].map((e) => Number(e.getAttribute('pageindex')) || 0);
        pages = Math.max(1, ...idx);
      }
      for (const sub of parseSubmissionRows(doc)) if (!known.has(sub.id)) found.push(sub);
      await sleep(400);
    }
    try { sessionStorage.setItem(cacheKey, JSON.stringify({ t: Date.now(), d: found })); } catch (_) { /* quota */ }
    return found;
  }

  Object.assign(window.CTA, { api, compactSubs, compactRatings, readProfileStats, loadProblemset, viewerHandle, fetchPrivateSubs });
})();

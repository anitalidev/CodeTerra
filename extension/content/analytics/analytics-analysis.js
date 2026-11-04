// Turns raw submissions and contest history into the numbers the panel shows. No DOM access.
(() => {
  'use strict';
  const { avg, monthKey, dayKey, quantile, fmt, pct, CORE_TAGS, problemUrl } = window.CTA;

  const normName = (n) => String(n).trim().toLowerCase().replace(/\s+/g, ' ');
  // A name match is used whenever exactly one problemset problem has that name.
  function buildCanon(problemset) {
    const byName = new Map();
    for (const p of problemset) {
      const k = normName(p.n);
      byName.set(k, byName.has(k) ? null : p);
    }
    for (const [k, p] of byName) if (!p) byName.delete(k);
    return byName;
  }
  // Submissions to gyms, mashups or hidden sets often carry no rating/tags and a link you can't open.
  const needsLookup = (s) => !s.r || !s.c || s.c >= 100000;

  function analyze(subs, ratings, canon) {
    subs = subs.slice().sort((a, b) => a.t - b.t);
    const probs = new Map();
    const byName = new Map();

    for (let s of subs) {
      let matchedFrom = null;
      if (canon && needsLookup(s)) {
        const k = normName(s.n);
        const hit = canon.get(k);
        if (hit && !(hit.c === s.c && hit.i === s.i)) {
          matchedFrom = s.priv ? `private contest${s.c ? ` ${s.c}` : ''}, problem ${s.i}`
            : s.c ? `${s.c >= 100000 ? 'gym' : 'contest'} ${s.c}, problem ${s.i}` : `${s.ps || 'problemset'} ${s.i}`;
          s = { ...s, c: hit.c, i: hit.i, ps: null, u: null, n: hit.n, r: s.r || hit.r, g: s.g && s.g.length ? s.g : hit.tags };
        }
      }
      let key = `${s.c || s.ps}-${s.i}`;
      if (!probs.has(key)) {
        // Div1/Div2 mirrors share a name and live in adjacent contest ids — count them once.
        const twin = (byName.get(s.n) || []).find((k) => {
          const p = probs.get(k);
          return p.c && s.c && Math.abs(p.c - s.c) === 1;
        });
        if (twin) key = twin;
        else {
          probs.set(key, {
            key, c: s.c, i: s.i, n: s.n, r: s.r, tags: s.g || [], url: s.u || problemUrl(s.c, s.i, s.ps),
            tries: 0, wrongBefore: 0, solvedAt: null, firstTry: false, lastTry: 0, solvedHow: null,
          });
          byName.set(s.n, [...(byName.get(s.n) || []), key]);
        }
      }
      const p = probs.get(key);
      if (!p.r && s.r) p.r = s.r;
      if (!p.tags.length && s.g && s.g.length) p.tags = s.g;
      if (matchedFrom && !p.matchedFrom) p.matchedFrom = matchedFrom;
      p.tries++;
      p.lastTry = s.t;
      if (p.solvedAt == null) {
        if (s.v === 'OK') {
          p.solvedAt = s.t;
          p.priv = !!s.priv;
          p.firstTry = p.wrongBefore === 0;
          p.solvedHow = s.p;
        } else if (s.v !== 'COMPILATION_ERROR' && s.v !== 'SKIPPED' && s.v !== 'TESTING') {
          p.wrongBefore++;
        }
      }
    }

    const all = [...probs.values()];
    const solved = all.filter((p) => p.solvedAt != null).sort((a, b) => a.solvedAt - b.solvedAt);
    const unsolved = all.filter((p) => p.solvedAt == null);
    const rated = solved.filter((p) => p.r);
    const ratedSorted = rated.map((p) => p.r).sort((a, b) => a - b);
    const overallAvg = avg(rated.map((p) => p.r));

    // Tags
    const tagMap = new Map();
    const tagOf = (t) => {
      if (!tagMap.has(t)) tagMap.set(t, { tag: t, solved: 0, attempted: 0, ratings: [], firstTry: 0, max: null, min: null });
      return tagMap.get(t);
    };
    for (const p of all) {
      for (const t of p.tags) {
        const e = tagOf(t);
        e.attempted++;
        if (p.solvedAt == null) continue;
        e.solved++;
        if (p.firstTry) e.firstTry++;
        if (p.r) {
          e.ratings.push(p.r);
          e.max = e.max == null ? p.r : Math.max(e.max, p.r);
          e.min = e.min == null ? p.r : Math.min(e.min, p.r);
        }
      }
    }
    const tags = [...tagMap.values()].map((e) => ({
      ...e, avg: avg(e.ratings), success: e.attempted ? e.solved / e.attempted : null,
      firstTryRate: e.solved ? e.firstTry / e.solved : null,
    })).sort((a, b) => b.solved - a.solved || a.tag.localeCompare(b.tag));

    // Months
    const months = new Map();
    const firstT = subs.length ? subs[0].t : null;
    const lastT = subs.length ? subs[subs.length - 1].t : null;
    if (firstT != null) {
      const k0 = monthKey(new Date(firstT * 1000));
      const k1 = monthKey(new Date(Math.max(lastT, Date.now() / 1000) * 1000));
      for (let k = k0; k <= k1; k++) months.set(k, { k, solved: 0, ratings: [], subs: 0 });
    }
    for (const s of subs) { const m = months.get(monthKey(new Date(s.t * 1000))); if (m) m.subs++; }
    for (const p of solved) {
      const m = months.get(monthKey(new Date(p.solvedAt * 1000)));
      if (!m) continue;
      m.solved++;
      if (p.r) m.ratings.push(p.r);
    }
    const monthList = [...months.values()].map((m) => ({
      ...m, avg: avg(m.ratings), max: m.ratings.length ? Math.max(...m.ratings) : null,
    }));

    // Verdicts, languages, how solved
    const count = (arr, f) => {
      const m = new Map();
      for (const x of arr) { const k = f(x); if (k != null) m.set(k, (m.get(k) || 0) + 1); }
      return [...m.entries()].map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v);
    };
    const verdicts = count(subs, (s) => s.v);
    const langs = count(subs, (s) => s.l);
    const how = count(solved, (p) => p.solvedHow);

    // Streaks (days with at least one accepted submission, local time)
    const acDays = [...new Set(subs.filter((s) => s.v === 'OK').map((s) => dayKey(new Date(s.t * 1000))))]
      .map((k) => { const [y, m, d] = k.split('-').map(Number); return Date.UTC(y, m - 1, d) / 864e5; })
      .sort((a, b) => a - b);
    let longest = 0, run = 0;
    for (let i = 0; i < acDays.length; i++) {
      run = i && acDays[i] - acDays[i - 1] === 1 ? run + 1 : 1;
      longest = Math.max(longest, run);
    }
    const now = new Date();
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 864e5;
    let current = 0;
    if (acDays.length && today - acDays[acDays.length - 1] <= 1) {
      current = 1;
      for (let i = acDays.length - 1; i > 0 && acDays[i] - acDays[i - 1] === 1; i--) current++;
    }
    const activeDays = new Set(subs.map((s) => dayKey(new Date(s.t * 1000)))).size;

    // Contests
    const contest = ratings.length ? {
      count: ratings.length,
      current: ratings[ratings.length - 1].r,
      max: Math.max(...ratings.map((r) => r.r)),
      bestRank: Math.min(...ratings.map((r) => r.rank)),
      bestRankContest: ratings.reduce((a, b) => (b.rank < a.rank ? b : a)),
      maxGain: ratings.reduce((a, b) => (b.r - b.o > a.r - a.o ? b : a)),
      maxDrop: ratings.reduce((a, b) => (b.r - b.o < a.r - a.o ? b : a)),
    } : null;

    const hardest = rated.reduce((a, b) => (!a || b.r > a.r || (b.r === a.r && b.solvedAt > a.solvedAt) ? b : a), null);

    return {
      subs, ratings, all, solved, unsolved, rated, ratedSorted, overallAvg, tags, monthList, verdicts, langs, how,
      longest, current, activeDays, contest, hardest, matched: all.filter((p) => p.matchedFrom).length,
      // Problems still pointing at a gym / mashup / hidden set (or no contest at all): no public problem link found.
      untraced: all.filter((p) => !p.c || p.c >= 100000).sort((a, b) => (b.solvedAt || b.lastTry) - (a.solvedAt || a.lastTry)),
      firstTryRate: solved.length ? solved.filter((p) => p.firstTry).length / solved.length : null,
      acceptance: subs.length ? subs.filter((s) => s.v === 'OK').length / subs.length : null,
    };
  }

  function practicePlan(A) {
    const recent = A.rated.slice(-40).map((p) => p.r).sort((a, b) => a - b);
    const comfort = recent.length ? Math.round(quantile(recent, 0.75) / 100) * 100 : 800;
    const cur = A.contest ? Math.round(A.contest.current / 100) * 100 : 0;
    const lo = Math.max(800, Math.max(comfort, cur - 100));
    const band = [lo, Math.min(3500, lo + 200)];

    const byTag = new Map(A.tags.map((t) => [t.tag, t]));
    const overallFirst = A.firstTryRate || 0;
    const weak = [];
    for (const tag of CORE_TAGS) {
      const t = byTag.get(tag);
      const n = t ? t.solved : 0;
      if (A.solved.length >= 20 && n < Math.max(3, A.solved.length * 0.02)) {
        weak.push({ tag, score: 3 - n, why: n ? `only ${n} solved` : 'never solved' });
      } else if (t && t.ratings.length >= 3 && A.overallAvg && t.avg < A.overallAvg - 120) {
        weak.push({ tag, score: (A.overallAvg - t.avg) / 100, why: `avg ${fmt(t.avg)} vs your overall ${fmt(A.overallAvg)}` });
      } else if (t && t.solved >= 5 && t.firstTryRate < overallFirst - 0.15) {
        weak.push({ tag, score: (overallFirst - t.firstTryRate) * 5, why: `first-try AC ${pct(t.firstTryRate)} vs overall ${pct(overallFirst)}` });
      }
    }
    weak.sort((a, b) => b.score - a.score);
    return { band, comfort, weak: weak.slice(0, 6) };
  }

  Object.assign(window.CTA, { normName, buildCanon, needsLookup, analyze, practicePlan });
})();

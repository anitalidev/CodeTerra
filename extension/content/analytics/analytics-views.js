// The Analytics dashboard: a headline row, then collapsible sections (Practice, Tags, Progress, Problems, Data coverage).
// `S` is the panel's shared state: { A (analysis), plan, HANDLE, showAllTags, suggestions, problemset }.
(() => {
  'use strict';
  const { esc, fmt, rt, pct, avg, quantile, dateStr, VERDICTS, PTYPES, MONTHS, monthLabel, ratingColor, problemUrl } = window.CTA;
  const { bindTip, hbarChart, columnChart, progressChart, tagChart, heatmap, legend, sortableTable, problemLink } = window.CTA;
  const { loadProblemset } = window.CTA;

  // A rating shown in its Codeforces rank colour; "–" when there isn't one.
  const rv = (n) => (n == null || Number.isNaN(n) ? '–' : `<span style="color:${ratingColor(n)}">${rt(n)}</span>`);
  const pill = (r) => (r ? `<span class="cta-pill" style="color:${ratingColor(r)}">${rt(r)}</span>` : '–');
  const stat = (label, value, sub) => `<div class="cta-stat"><div class="l">${label}</div><div class="v">${value}</div>${sub ? `<div class="d">${sub}</div>` : ''}</div>`;
  const chip = (label, value, title) => `<span class="cta-chip"${title ? ` title="${esc(title)}"` : ''}><b>${value}</b>${label}</span>`;
  const meter = (v) => (v == null ? '–' : `<span class="cta-bar" style="width:48px"><i style="width:${Math.round(v * 100)}%"></i></span>${pct(v)}`);

  function createViews(S) {
    // ---------------------------------------------------------------- headline
    function headline() {
      const { A } = S;
      const h = A.hardest;
      const activeDays = Math.max(A.activeDays, A.official.calendarDays || 0);
      const longest = Math.max(A.longest, A.official.maxStreak || 0);
      return `
        <div class="cta-hero">
          ${stat('Solved', fmt(A.totalSolved), `${fmt(A.unsolved.length)} tried, not solved`)}
          ${stat('Average rating', rv(A.overallAvg), `median ${rt(quantile(A.ratedSorted, 0.5))} · ${A.rated.length} rated`)}
          ${stat('Contest rating', A.contest ? rv(A.contest.current) : '–', A.contest ? `max ${rt(A.contest.max)} · ${A.contest.count} contests` : 'unrated')}
          ${stat('Longest streak', `${fmt(longest)} days`, `current ${A.current} ${A.current === 1 ? 'day' : 'days'}`)}
        </div>
        <div class="cta-chips">
          ${chip('hardest solved', h ? rv(h.r) : '–', h ? `${h.c || ''}${h.i} ${h.n}` : '')}
          ${chip('first-try AC', pct(A.firstTryRate), 'solved with no wrong attempts')}
          ${chip('submissions', fmt(A.subs.length), `${pct(A.acceptance)} accepted`)}
          ${chip('active days', fmt(activeDays), `since ${dateStr(A.subs[0].t)}`)}
        </div>`;
    }

    // ---------------------------------------------------------------- sections
    // Each section: { id, title, folded, html(), build(body) -> redraw() }. `build` runs once, the first time the
    // section is open; the function it returns redraws the charts (called again when the width changes).
    const sections = () => [practice(), tags(), progress(), monthly(), ratings(), submissions(), coverage()];

    function practice() {
      return {
        id: 'practice', title: 'What to practise next', folded: false,
        html() {
          const { A, plan } = S;
          const [lo, hi] = plan.band;
          const upsolve = A.unsolved.length;
          return `
            <div class="cta-practice">
              <div class="cta-card cta-band">
                <div class="k">Target rating band</div>
                <div class="big">${rv(lo)}–${rv(hi)}</div>
                <p>From the 75th percentile of your last ${Math.min(40, A.rated.length)} rated solves (${plan.comfort})${A.contest ? ` and your contest rating (${rt(A.contest.current)})` : ''}. Hard enough to stretch, close enough to finish.</p>
              </div>
              <div class="cta-card">
                <div class="k">Tags to work on</div>
                ${plan.weak.length
                  ? `<ul class="cta-weak">${plan.weak.map((w) => `<li><b>${esc(w.tag)}</b><span>${esc(w.why)}</span></li>`).join('')}</ul>`
                  : '<div class="cta-empty">No obvious weak spots — nicely balanced.</div>'}
              </div>
            </div>
            <div class="cta-next">
              <div class="cta-next-head">
                <div><b>Problems to try next</b><span>Unsolved, in your band${plan.weak.length ? ', favouring the tags above' : ''}.</span></div>
                <button class="cta-btn primary" data-act="suggest">${S.suggestions ? 'Shuffle' : 'Suggest problems'}</button>
              </div>
              <div data-c="suggest"></div>
            </div>
            <details class="cta-more" data-lazy="upsolve"><summary>Upsolve list <span>${upsolve}</span></summary>
              <p class="cta-sub">Problems you submitted to but never got accepted, most recent first.</p><div data-c="upsolve"></div></details>`;
        },
        build(body) {
          const { A } = S;
          lazy(body, 'upsolve', (el) => {
            const upsolve = A.unsolved.slice().sort((a, b) => b.lastTry - a.lastTry);
            if (!upsolve.length) { el.innerHTML = '<div class="cta-empty">Nothing left to upsolve.</div>'; return; }
            sortableTable(el, [
              { k: 'name', label: 'Problem', left: true, render: (p) => `${problemLink(p)}<div class="cta-tags">${esc(p.tags.join(', '))}</div>` },
              { k: 'r', label: 'Rating', render: (p) => pill(p.r) },
              { k: 'tries', label: 'Attempts' },
              { k: 'lastTry', label: 'Last tried', render: (p) => dateStr(p.lastTry) },
            ], upsolve.map((p) => ({ ...p, name: p.n })), { sortKey: 'lastTry' });
          });

          const sEl = body.querySelector('[data-c="suggest"]');
          const btn = body.querySelector('[data-act="suggest"]');
          const draw = () => {
            if (!S.suggestions) return;
            if (!S.suggestions.length) { sEl.innerHTML = '<div class="cta-empty">No matching unsolved problems found.</div>'; return; }
            sEl.innerHTML = `<div class="cta-scroll"><table class="cta-table"><thead><tr><th>Problem</th><th>Rating</th><th>Solved by</th></tr></thead><tbody>
              ${S.suggestions.map((p) => `<tr><td class="l">${problemLink(p)}<div class="cta-tags">${esc(p.tags.join(', '))}</div></td><td>${pill(p.r)}</td><td>${fmt(p.solvedCount)}</td></tr>`).join('')}
            </tbody></table></div>`;
          };
          draw();
          btn.addEventListener('click', async () => {
            btn.disabled = true;
            sEl.innerHTML = '<div class="cta-status"><span class="cta-spinner"></span>Loading problemset…</div>';
            try {
              S.problemset = await loadProblemset();
              S.suggestions = pickSuggestions();
              btn.textContent = 'Shuffle';
              draw();
            } catch (e) {
              sEl.innerHTML = `<div class="cta-status err">Couldn't load problemset: ${esc(e.message)}</div>`;
            }
            btn.disabled = false;
          });
          return null;
        },
      };
    }

    function tags() {
      return {
        id: 'tags', title: 'Tag performance', folded: false,
        html() {
          const { A } = S;
          const shown = A.tags.filter((t) => t.solved > 0);
          if (!shown.length) return '<div class="cta-empty">No solved problems yet.</div>';
          return `
            <p class="cta-sub">Problems solved by tag and the rating range of those problems. Dot: average rating, with a line from easiest to hardest. Grey rule: your overall average (${rt(A.overallAvg)}).</p>
            <div class="cta-chart" data-c="tags"></div>
            ${shown.length > 12 ? `<button class="cta-btn" style="margin-top:10px" data-act="alltags"></button>` : ''}
            <details class="cta-more" data-lazy="heat"><summary>Tag × difficulty</summary>
              <p class="cta-sub">Where your solves sit for each tag, in 200-point rating bands. Darker means more problems.</p>
              <div class="cta-export">
                <span>Export all tags (name, # solved, avg rating):</span>
                <button class="cta-btn" data-exp="copy" title="Pastes as a table in Docs/Word/Sheets, or as aligned text elsewhere">Copy table</button>
                <button class="cta-btn" data-exp="docx">Download .docx</button>
                <button class="cta-btn" data-exp="csv">Download .csv</button>
                <span class="cta-export-msg" aria-live="polite"></span>
              </div>
              <div data-c="heat"></div></details>
            <details class="cta-more" data-lazy="table"><summary>All tags <span>${shown.length}</span></summary>
              <p class="cta-sub">Click a column to sort. Success is solved ÷ attempted problems; first-try is solved without any wrong attempt.</p>
              <div data-c="table"></div></details>`;
        },
        build(body) {
          const { A } = S;
          const shown = A.tags.filter((t) => t.solved > 0);
          if (!shown.length) return null;
          const btn = body.querySelector('[data-act="alltags"]');
          const draw = () => {
            const list = S.showAllTags ? shown : shown.slice(0, 12);
            tagChart(body.querySelector('[data-c="tags"]'), list, A.overallAvg);
            if (btn) btn.textContent = S.showAllTags ? 'Show top 12' : `Show all ${shown.length} tags`;
          };
          btn?.addEventListener('click', () => { S.showAllTags = !S.showAllTags; draw(); });
          lazy(body, 'heat', (el) => heatmap(el, A, S.showAllTags ? shown : shown.slice(0, 12)));
          bindTagExport(body);
          lazy(body, 'table', (el) => sortableTable(el, [
            { k: 'tag', label: 'Tag' },
            { k: 'solved', label: 'Solved' },
            { k: 'attempted', label: 'Attempted' },
            { k: 'success', label: 'Success', render: (r) => meter(r.success) },
            { k: 'firstTryRate', label: 'First-try', render: (r) => meter(r.firstTryRate) },
            { k: 'avg', label: 'Avg rating', render: (r) => rv(r.avg) },
            { k: 'max', label: 'Max rating', render: (r) => rv(r.max) },
          ], A.tags, { sortKey: 'solved' }));
          return draw;
        },
      };
    }

    function progress() {
      return {
        id: 'progress', title: 'Progress over time', folded: false,
        html() {
          const { A } = S;
          const c = A.contest;
          const yearAgo = Date.now() / 1000 - 365 * 864e2;
          const lastYear = A.rated.filter((p) => p.solvedAt >= yearAgo).map((p) => p.r);
          const before = A.rated.filter((p) => p.solvedAt < yearAgo).map((p) => p.r);
          const delta = lastYear.length && before.length ? avg(lastYear) - avg(before) : null;
          return `
            <div class="cta-chips">
              ${chip('avg rating, last 12 months', rv(avg(lastYear)), delta == null ? '' : `${delta >= 0 ? 'Up' : 'Down'} ${rt(Math.abs(delta))} vs. earlier`)}
              ${chip('solved, last 12 months', fmt(A.solved.filter((p) => p.solvedAt >= yearAgo).length))}
              ${c ? chip('best contest rank', fmt(c.bestRank), c.bestRankContest.n) : ''}
              ${c && c.maxGain.r > c.maxGain.o ? chip('biggest rating gain', `+${rt(c.maxGain.r - c.maxGain.o)}`, c.maxGain.n) : ''}
              ${c && c.maxDrop.r < c.maxDrop.o ? chip('biggest rating drop', `−${rt(c.maxDrop.o - c.maxDrop.r)}`, c.maxDrop.n) : ''}
            </div>
            ${legend([['Monthly average', 'var(--series-1)'], ['Contest rating', 'var(--series-2)'], ['Individual solve', 'rgba(59,89,152,.35)', true]])}
            <div class="cta-chart" data-c="line"></div>`;
        },
        build(body) {
          const { A } = S;
          return () => progressChart(body.querySelector('[data-c="line"]'), A);
        },
      };
    }

    function monthly() {
      return {
        id: 'monthly', title: 'Problems solved per month', folded: false,
        html() { return '<p class="cta-sub">New unique problems accepted each month.</p><div class="cta-chart" data-c="monthly"></div>'; },
        build(body) {
          const { A } = S;
          return () => {
            const ms = A.monthList;
            const every = ms.length > 72 ? 24 : ms.length > 36 ? 12 : ms.length > 12 ? 3 : 1;
            columnChart(body.querySelector('[data-c="monthly"]'), ms.map((m) => ({
              label: m.k % every === 0 ? (every >= 12 ? String(Math.floor(m.k / 12)) : `${MONTHS[m.k % 12]} ${String(Math.floor(m.k / 12)).slice(2)}`) : null,
              value: m.solved,
              tip: `<b>${monthLabel(m.k)}</b><br>${m.solved} solved · ${m.subs} submissions${m.avg != null ? `<br>avg rating ${rt(m.avg)}` : ''}`,
            })), { height: 180, capLabels: ms.length <= 24 });
          };
        },
      };
    }

    function ratings() {
      return {
        id: 'ratings', title: 'Solved problems by rating', folded: false,
        html() {
          const { A } = S;
          if (!A.solved.length) return '<div class="cta-empty">No solved problems yet.</div>';
          return `
            <p class="cta-sub">Unique solved problems with a difficulty rating, per 100-point bucket.</p>
            <div class="cta-chart" data-c="hist"></div>
            <details class="cta-more" data-lazy="solved"><summary>All solved problems <span>${fmt(A.solved.length)}</span></summary>
              <p class="cta-sub">Click a column to sort. Attempts counts every submission to the problem.</p><div data-c="solved"></div></details>`;
        },
        build(body) {
          const { A } = S;
          if (!A.solved.length) return null;
          lazy(body, 'solved', (el) => sortableTable(el, [
            { k: 'name', label: 'Problem', left: true, render: (p) => `${problemLink(p)}${p.tags.length ? `<div class="cta-tags">${esc(p.tags.join(', '))}</div>` : ''}` },
            { k: 'r', label: 'Rating', render: (p) => pill(p.r) },
            { k: 'tries', label: 'Attempts', render: (p) => `${p.tries}${p.firstTry ? '' : ` <span class="cta-tags" style="display:inline">(${p.wrongBefore} wrong)</span>`}` },
            { k: 'solvedAt', label: 'Solved', render: (p) => dateStr(p.solvedAt) },
          ], A.solved.map((p) => ({ ...p, name: p.n })), { sortKey: 'solvedAt' }));
          return () => {
            const hist = new Map();
            for (const p of A.rated) hist.set(p.r, (hist.get(p.r) || 0) + 1);
            const items = [];
            if (A.rated.length) {
              for (let r = A.ratedSorted[0]; r <= A.ratedSorted[A.ratedSorted.length - 1]; r += 100) {
                const n = hist.get(r) || 0;
                items.push({ label: r, value: n, color: ratingColor(r), tip: `<b>${r}</b><br>${n} solved` });
              }
            }
            const histEl = body.querySelector('[data-c="hist"]');
            if (items.length) columnChart(histEl, items, { labelEvery: items.length > 16 ? 2 : 1, height: 220 });
            else histEl.innerHTML = '<div class="cta-empty">No rated problems solved yet.</div>';
          };
        },
      };
    }

    function submissions() {
      return {
        id: 'submissions', title: 'Submissions', folded: false,
        html() {
          const { A } = S;
          if (!A.solved.length) return '<div class="cta-empty">No solved problems yet.</div>';
          return `
            <div class="cta-grid3">
              <div><h4>Verdicts</h4><div class="cta-chart" data-c="verdicts"></div></div>
              <div><h4>How problems were solved</h4><div class="cta-chart" data-c="how"></div></div>
              <div><h4>Languages</h4><div class="cta-chart" data-c="langs"></div></div>
            </div>`;
        },
        build(body) {
          const { A } = S;
          if (!A.solved.length) return null;
          return () => {
            const total = A.subs.length;
            hbarChart(body.querySelector('[data-c="verdicts"]'), A.verdicts.slice(0, 8).map((v) => ({
              label: VERDICTS[v.k] || v.k, value: v.v, tip: `<b>${esc(VERDICTS[v.k] || v.k)}</b><br>${fmt(v.v)} (${pct(v.v / total)})`,
            })), { total });
            hbarChart(body.querySelector('[data-c="how"]'), A.how.map((v) => ({
              label: PTYPES[v.k] || v.k, value: v.v, tip: `<b>${esc(PTYPES[v.k] || v.k)}</b><br>${fmt(v.v)} problems (${pct(v.v / A.solved.length)})`,
            })), { total: A.solved.length });
            hbarChart(body.querySelector('[data-c="langs"]'), A.langs.slice(0, 5).map((v) => ({
              label: v.k.replace(/\s*\(.*\)$/, ''), value: v.v, tip: `<b>${esc(v.k)}</b><br>${fmt(v.v)} submissions (${pct(v.v / total)})`,
            })), { total });
          };
        },
      };
    }

    // Where every solve Codeforces counts came from, and the ones that couldn't be linked to a public problem.
    function coverage() {
      const parts = () => {
        const { A, HANDLE } = S;
        const untraced = new Set(A.untraced);
        return [
          { key: 'public', label: 'Public problems', color: 'var(--series-1)',
            n: A.solved.filter((p) => !p.priv && !untraced.has(p)).length,
            note: 'returned by the Codeforces API, with rating, tags and a public link' },
          { key: 'traced', label: 'Private, traced by name', color: '#30a14e',
            n: A.solved.filter((p) => p.priv && !untraced.has(p)).length,
            note: 'read from your submissions pages and matched to the public problem with the same name' },
          { key: 'nolink', label: 'No public link', color: 'var(--series-2)',
            n: A.solved.filter((p) => untraced.has(p)).length,
            note: 'submitted in a gym, mashup or private group; no public problem has the same name, or several do' },
          { key: 'missing', label: 'Counted, but not found', color: '#b9b9b9',
            n: A.hidden,
            note: A.isOwner ? "in Codeforces' total, but not on your submissions pages either"
              : `in Codeforces' total, but only ${esc(HANDLE)} can see these submissions. Log in as them and refresh to read them` },
        ];
      };
      return {
        id: 'coverage', title: 'Where the solves come from', folded: true,
        html() {
          const { A } = S;
          const privateSubs = A.subs.filter((x) => x.priv).length;
          const apiMatched = A.solved.filter((p) => p.matchedFrom && !p.priv).length;
          const list = parts();
          const total = Math.max(1, A.totalSolved);
          return `
            <p class="cta-sub">Read ${fmt(A.subs.length - privateSubs)} submissions from the Codeforces API${privateSubs ? ` and ${fmt(privateSubs)} private ones from your submissions pages` : ''}${A.official.solved != null ? `. Codeforces counts ${fmt(A.official.solved)} solved` : ''}${apiMatched ? `. ${fmt(apiMatched)} gym/mashup solve${apiMatched === 1 ? ' was' : 's were'} also traced by name` : ''}.</p>
            <div class="cta-stack">${list.filter((x) => x.n > 0).map((x) => `<i data-k="${x.key}" style="flex:${x.n};background:${x.color}"></i>`).join('')}</div>
            <table class="cta-coverage">${list.map((x) => `
              <tr class="${x.n ? '' : 'zero'}"><td><i style="background:${x.color}"></i></td><td class="lab">${x.label}</td><td class="num">${fmt(x.n)}</td><td class="num m">${pct(x.n / total)}</td><td class="note">${x.note}</td></tr>`).join('')}
            </table>
            ${A.untraced.length ? `<details class="cta-more" data-lazy="untraced"><summary>Problems with no public link <span>${fmt(A.untraced.length)}</span></summary>
              <p class="cta-sub">These couldn't be matched to a public Codeforces problem: either no public problem has the same name, or several do (like "Game"). Without a match there's no rating or tags, unless the submission itself had them. The links go to where they were submitted, which may not open for other people.</p>
              <div data-c="untraced"></div></details>` : ''}`;
        },
        build(body) {
          const { A } = S;
          const list = parts();
          const total = Math.max(1, A.totalSolved);
          body.querySelectorAll('.cta-stack i').forEach((el) => {
            const x = list.find((q) => q.key === el.dataset.k);
            bindTip(el, `<b>${x.label}</b><br>${fmt(x.n)} solved (${pct(x.n / total)})`);
          });
          lazy(body, 'untraced', (el) => sortableTable(el, [
            { k: 'name', label: 'Problem', left: true, render: (p) => `${problemLink(p)}${p.tags.length ? `<div class="cta-tags">${esc(p.tags.join(', '))}</div>` : ''}` },
            { k: 'where', label: 'Submitted in', render: (p) => esc(p.where) },
            { k: 'status', label: 'Status', render: (p) => (p.solvedAt != null ? 'Solved' : 'Not solved') },
            { k: 'r', label: 'Rating', render: (p) => pill(p.r) },
            { k: 'when', label: 'Date', render: (p) => dateStr(p.when) },
          ], A.untraced.map((p) => ({
            ...p, name: p.n, when: p.solvedAt || p.lastTry, status: p.solvedAt != null ? 1 : 0,
            where: p.url && p.url.includes('/group/') ? `Private group contest ${p.c || ''}` : p.c ? `${p.c >= 100000 ? 'Gym/mashup' : 'Contest'} ${p.c}` : 'Problemset',
          })), { sortKey: 'when' }));
          return null;
        },
      };
    }

    // Fills a <details> block the first time it is opened (so hidden tables and charts are measured while visible).
    function lazy(root, name, fill) {
      const d = root.querySelector(`details[data-lazy="${name}"]`);
      if (!d) return;
      let done = false;
      const run = () => { if (!done && d.open) { done = true; fill(d.querySelector(`[data-c="${name}"]`)); } };
      d.addEventListener('toggle', run);
      run();
    }

    // Tag summary export: every tag with at least one solve, most-solved first.
    function tagSummaryTable() {
      const { A, HANDLE } = S;
      const rows = A.tags.filter((t) => t.solved > 0).map((t) => [t.tag, t.solved, t.avg]);
      const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      return {
        title: `Codeforces tag summary: ${HANDLE}`,
        subtitle: `${fmt(A.solved.length)} problems solved · average rating ${rt(A.overallAvg)} · exported ${today}`,
        columns: [
          { label: 'Tag', align: 'left', width: 4200 },
          { label: '# Solved', align: 'right', width: 1500 },
          { label: 'Avg rating solved', align: 'right', width: 2200 },
        ],
        rows,
        footer: 'Average rating only counts problems that have a difficulty rating. A problem with several tags is counted under each of them.',
      };
    }
    function bindTagExport(body) {
      const { HANDLE } = S;
      const X = window.CTA_EXPORT;
      const box = body.querySelector('.cta-export');
      if (!box || !X) return;
      const msg = box.querySelector('.cta-export-msg');
      const say = (text) => { msg.textContent = text; clearTimeout(say.t); say.t = setTimeout(() => { msg.textContent = ''; }, 2500); };
      const file = `codeforces-tags-${HANDLE}`;
      box.querySelector('[data-exp="copy"]').addEventListener('click', async () => {
        try { await X.copyTable(tagSummaryTable()); say('Copied'); } catch (_) { say("Couldn't copy"); }
      });
      box.querySelector('[data-exp="docx"]').addEventListener('click', () => {
        X.download(`${file}.docx`, X.toDocx(tagSummaryTable()), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      });
      box.querySelector('[data-exp="csv"]').addEventListener('click', () => {
        X.download(`${file}.csv`, `﻿${X.toCsv(tagSummaryTable())}`, 'text/csv;charset=utf-8');
      });
    }

    function pickSuggestions() {
      const { A, plan } = S;
      const [lo, hi] = plan.band;
      const seenNames = new Set(A.all.map((p) => p.n));
      const seenKeys = new Set(A.all.map((p) => `${p.c}-${p.i}`));
      const weak = new Set(plan.weak.map((w) => w.tag));
      const pool = S.problemset.filter((p) => p.r && p.r >= lo && p.r <= hi && !seenKeys.has(`${p.c}-${p.i}`) && !seenNames.has(p.n)
        && !p.tags.includes('*special'));
      const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
      // Favor recent contests (ids > 1300) and the weak tags; keep a couple of wildcards.
      const recent = pool.filter((p) => p.c > 1300);
      const src = recent.length >= 20 ? recent : pool;
      const weakPool = shuffle(src.filter((p) => p.tags.some((t) => weak.has(t))));
      const rest = shuffle(src.filter((p) => !p.tags.some((t) => weak.has(t))));
      const out = [...weakPool.slice(0, weak.size ? 7 : 0), ...rest].slice(0, 10);
      return out.map((p) => ({ ...p, url: problemUrl(p.c, p.i) })).sort((a, b) => a.r - b.r);
    }

    // ---------------------------------------------------------------- the page
    // Builds the dashboard into `root`. Returns the section descriptors; each section element gets `_fill()` (build
    // once, then draw) and `_redraw()` (charts only) for the panel to call as sections open and the width changes.
    function renderDashboard(root) {
      const { A } = S;
      if (!A.subs.length) { root.innerHTML = '<div class="cta-empty" style="padding:24px">This user has no submissions yet.</div>'; return []; }
      root.innerHTML = `<div class="cta-top" data-sec="overview">${headline()}</div>`;
      const list = sections();
      for (const s of list) {
        const el = document.createElement('section');
        el.className = 'cta-section';
        el.dataset.sec = s.id;
        el.innerHTML = `<h3 role="button" tabindex="0">${esc(s.title)}</h3><div class="cta-sec-body">${s.html()}</div>`;
        let redraw = null;
        let built = false;
        el._fill = () => {
          if (!built) { built = true; redraw = s.build(el.querySelector('.cta-sec-body')); }
          if (redraw) redraw();
        };
        el._redraw = () => { if (built && redraw) redraw(); };
        el._def = s;
        root.append(el);
      }
      return list;
    }

    return { renderDashboard };
  }

  window.CTA.createViews = createViews;
})();

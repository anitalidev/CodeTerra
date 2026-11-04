// Tooltip, SVG charts, the tag heatmap and sortable tables. Each draws into an element it is given.
(() => {
  'use strict';
  const { esc, fmt, pct, MONTHS, monthKey, monthLabel, niceStep } = window.CTA;

  // ---------------------------------------------------------------- tooltip
  const tip = {
    el: null,
    root: null, // set to the panel's shadow root before the first chart is drawn
    show(html, ev) {
      if (!this.el) { this.el = document.createElement('div'); this.el.className = 'cta-tip'; this.root.appendChild(this.el); }
      this.el.innerHTML = html;
      this.el.style.display = 'block';
      this.move(ev);
    },
    move(ev) {
      if (!this.el) return;
      const r = this.el.getBoundingClientRect();
      let x = ev.clientX + 14, y = ev.clientY + 14;
      if (x + r.width > innerWidth - 8) x = ev.clientX - r.width - 14;
      if (y + r.height > innerHeight - 8) y = ev.clientY - r.height - 14;
      this.el.style.left = `${Math.max(8, x)}px`;
      this.el.style.top = `${Math.max(8, y)}px`;
    },
    hide() { if (this.el) this.el.style.display = 'none'; },
  };
  const bindTip = (node, html) => {
    node.addEventListener('mouseenter', (e) => tip.show(typeof html === 'function' ? html() : html, e));
    node.addEventListener('mousemove', (e) => tip.move(e));
    node.addEventListener('mouseleave', () => tip.hide());
  };

  // ---------------------------------------------------------------- SVG helpers
  const NS = 'http://www.w3.org/2000/svg';
  function S(tag, attrs = {}, parent) {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
    if (parent) parent.appendChild(n);
    return n;
  }
  const T = (parent, x, y, text, cls, extra = {}) => { const t = S('text', { x, y, class: cls, ...extra }, parent); t.textContent = text; return t; };
  const hBar = (x, y, w, h, r = 4) => { r = Math.min(r, w, h / 2); return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`; };
  const vBar = (x, y, w, h, r = 4) => { r = Math.min(r, w / 2, h); return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`; };
  const newSvg = (el, W, H) => { el.innerHTML = ''; return S('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img' }, el); };
  const widthOf = (el) => Math.max(260, el.clientWidth || el.parentElement.clientWidth || 600);

  // Text measurement so label columns hug their content instead of using fixed fractions.
  const ctx2d = document.createElement('canvas').getContext('2d');
  const FONT = 'verdana, arial, sans-serif';
  const measure = (s, size = 11, weight = 400) => { ctx2d.font = `${weight} ${size}px ${FONT}`; return ctx2d.measureText(String(s)).width; };
  const truncate = (s, px, size = 11) => {
    if (measure(s, size) <= px) return s;
    let t = s;
    while (t.length > 1 && measure(`${t}…`, size) > px) t = t.slice(0, -1);
    return `${t}…`;
  };
  const labelWidth = (labels, W, cap = 0.4) => Math.min(W * cap, Math.max(40, ...labels.map((l) => measure(l))) + 14);

  // Horizontal bars: [{label, value, tip}]; `total` adds a muted share next to each value.
  function hbarChart(el, items, { total } = {}) {
    const W = widthOf(el), rowH = 26;
    const labelW = labelWidth(items.map((d) => d.label), W);
    const valText = (d) => [fmt(d.value), total ? ` ${pct(d.value / total)}` : ''];
    const valW = Math.max(...items.map((d) => measure(valText(d).join(''), 10, 700))) + 12;
    const H = items.length * rowH;
    const svg = newSvg(el, W, H);
    const max = Math.max(1, ...items.map((d) => d.value));
    const plotW = W - labelW - valW;
    items.forEach((d, i) => {
      const y = i * rowH;
      const g = S('g', { class: 'cta-row' }, svg);
      S('rect', { x: 0, y, width: W, height: rowH, class: 'cta-rowbg', fill: 'transparent', rx: 5 }, g);
      T(g, labelW - 10, y + rowH / 2 + 4, truncate(d.label, labelW - 14), 'cta-lbl', { 'text-anchor': 'end' });
      const w = Math.max(3, (d.value / max) * plotW);
      S('path', { d: hBar(labelW, y + 7, w, rowH - 14), fill: d.color || 'var(--series-1)' }, g);
      const [v, share] = valText(d);
      const t = T(g, labelW + w + 6, y + rowH / 2 + 4, v, 'cta-val');
      if (share) { const s = S('tspan', { class: 'm' }, t); s.textContent = share; }
      if (d.tip) bindTip(g, d.tip);
    });
  }

  // Vertical columns: [{label, value, tip}] with sparse x labels.
  function columnChart(el, items, { height = 200, labelEvery = 1, yTitle, capLabels = true } = {}) {
    const W = widthOf(el), H = height, m = { l: 40, r: 8, t: 18, b: 24 };
    const svg = newSvg(el, W, H);
    const max = Math.max(1, ...items.map((d) => d.value));
    const step = niceStep(max, 4);
    const top = Math.ceil(max / step) * step;
    const y = (v) => m.t + (H - m.t - m.b) * (1 - v / top);
    for (let v = 0; v <= top; v += step) {
      S('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), class: 'cta-gridline' }, svg);
      T(svg, m.l - 6, y(v) + 4, fmt(v), 'cta-axis', { 'text-anchor': 'end' });
    }
    if (yTitle) T(svg, m.l - 6, m.t - 4, yTitle, 'cta-axis', { 'text-anchor': 'end' });
    const band = (W - m.l - m.r) / Math.max(1, items.length);
    const bw = Math.max(1, Math.min(28, band * 0.7, band - 2));
    items.forEach((d, i) => {
      const cx = m.l + band * i + band / 2;
      const g = S('g', { class: 'cta-col' }, svg);
      S('rect', { x: m.l + band * i + 1, y: m.t, width: Math.max(1, band - 2), height: H - m.t - m.b, class: 'cta-hit', rx: 4 }, g);
      if (d.value > 0) S('path', { d: vBar(cx - bw / 2, y(d.value), bw, y(0) - y(d.value), bw >= 8 ? 4 : 1), fill: d.color || 'var(--series-1)' }, g);
      if (capLabels && d.value > 0 && bw >= 14) T(g, cx, y(d.value) - 5, fmt(d.value), 'cta-val', { 'text-anchor': 'middle' });
      if (d.label != null && i % labelEvery === 0) T(svg, cx, H - 6, d.label, 'cta-axis', { 'text-anchor': 'middle' });
      if (d.tip) bindTip(g, d.tip);
    });
  }

  // Rating-over-time: monthly avg solved rating (line), each solve (faint dots), contest rating (line).
  function progressChart(el, A) {
    const W = widthOf(el), H = 300, m = { l: 44, r: 16, t: 14, b: 26 };
    const svg = newSvg(el, W, H);
    const months = A.monthList;
    if (!months.length) return;
    const k0 = months[0].k, k1 = months[months.length - 1].k;
    const tOfK = (k) => new Date(Math.floor(k / 12), k % 12, 15).getTime() / 1000;
    const t0 = new Date(Math.floor(k0 / 12), k0 % 12, 1).getTime() / 1000;
    const t1 = new Date(Math.floor(k1 / 12), k1 % 12 + 1, 1).getTime() / 1000;
    const x = (t) => m.l + ((t - t0) / Math.max(1, t1 - t0)) * (W - m.l - m.r);

    const ys = [...A.rated.map((p) => p.r), ...A.ratings.map((r) => r.r)];
    if (!ys.length) { el.innerHTML = '<div class="cta-empty">No rated problems or contests yet.</div>'; return; }
    const lo = Math.max(0, Math.floor((Math.min(...ys) - 100) / 200) * 200);
    const hi = Math.ceil((Math.max(...ys) + 100) / 200) * 200;
    const y = (v) => m.t + (H - m.t - m.b) * (1 - (v - lo) / (hi - lo));
    const step = niceStep(hi - lo, 5) < 100 ? 100 : niceStep(hi - lo, 5);
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) {
      S('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), class: 'cta-gridline' }, svg);
      T(svg, m.l - 6, y(v) + 4, fmt(v), 'cta-axis', { 'text-anchor': 'end' });
    }
    // x ticks: years, or quarters for short spans
    const spanMonths = k1 - k0 + 1;
    const every = spanMonths > 60 ? 24 : spanMonths > 30 ? 12 : spanMonths > 12 ? 3 : 1;
    for (let k = k0; k <= k1; k++) {
      if ((every >= 12 && k % every === 0) || (every < 12 && k % every === 0)) {
        const tx = x(new Date(Math.floor(k / 12), k % 12, 1).getTime() / 1000);
        S('line', { x1: tx, x2: tx, y1: H - m.b, y2: H - m.b + 4, class: 'cta-gridline' }, svg);
        T(svg, tx, H - 8, every >= 12 ? String(Math.floor(k / 12)) : `${MONTHS[k % 12]} ${String(Math.floor(k / 12)).slice(2)}`, 'cta-axis', { 'text-anchor': 'middle' });
      }
    }
    S('line', { x1: m.l, x2: W - m.r, y1: H - m.b, y2: H - m.b, stroke: 'var(--border)' }, svg);

    // individual solves
    const dots = S('g', { opacity: 0.28 }, svg);
    for (const p of A.rated) S('circle', { cx: x(p.solvedAt), cy: y(p.r), r: 2.5, fill: 'var(--series-1)' }, dots);

    // pts: [x, y, breakBefore?] — a new subpath starts where breakBefore is set.
    const line = (pts, color, { markers = false } = {}) => {
      if (!pts.length) return;
      S('path', { d: pts.map((p, i) => `${!i || p[2] ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(''), fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
      if (markers) for (const [px, py] of pts.slice(0, -1)) S('circle', { cx: px, cy: py, r: 3, fill: color }, svg);
      const [ex, ey] = pts[pts.length - 1];
      S('circle', { cx: ex, cy: ey, r: 4, fill: color, stroke: '#fff', 'stroke-width': 2 }, svg);
    };
    // Break the monthly average line across inactive stretches (> 2 months without rated solves).
    const avgMonths = months.filter((mm) => mm.avg != null);
    const avgPts = avgMonths.map((mm, i) => [x(tOfK(mm.k)), y(mm.avg), i > 0 && mm.k - avgMonths[i - 1].k > 2]);
    line(avgPts, 'var(--series-1)', { markers: true });
    const ratingPts = A.ratings.map((r) => [x(r.t), y(r.r)]);
    line(ratingPts, 'var(--series-2)');

    // hover: snap to month
    const cross = S('line', { y1: m.t, y2: H - m.b, stroke: 'var(--text-muted)', 'stroke-width': 1, visibility: 'hidden' }, svg);
    const hA = S('circle', { r: 5, fill: 'var(--series-1)', stroke: '#fff', 'stroke-width': 2, visibility: 'hidden' }, svg);
    const hR = S('circle', { r: 5, fill: 'var(--series-2)', stroke: '#fff', 'stroke-width': 2, visibility: 'hidden' }, svg);
    const overlay = S('rect', { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b, fill: 'transparent' }, svg);
    const ratingAt = (t) => { let r = null; for (const c of A.ratings) { if (c.t <= t) r = c; else break; } return r; };
    overlay.addEventListener('mousemove', (ev) => {
      const box = svg.getBoundingClientRect();
      const px = ((ev.clientX - box.left) / box.width) * W;
      const t = t0 + ((px - m.l) / (W - m.l - m.r)) * (t1 - t0);
      const d = new Date(t * 1000);
      const mm = months.find((q) => q.k === monthKey(d)) || months[months.length - 1];
      const mx = x(tOfK(mm.k));
      cross.setAttribute('x1', mx); cross.setAttribute('x2', mx); cross.setAttribute('visibility', 'visible');
      if (mm.avg != null) { hA.setAttribute('cx', mx); hA.setAttribute('cy', y(mm.avg)); hA.setAttribute('visibility', 'visible'); } else hA.setAttribute('visibility', 'hidden');
      const endOfMonth = new Date(Math.floor(mm.k / 12), mm.k % 12 + 1, 1).getTime() / 1000;
      const rr = ratingAt(endOfMonth);
      if (rr) { hR.setAttribute('cx', mx); hR.setAttribute('cy', y(rr.r)); hR.setAttribute('visibility', 'visible'); } else hR.setAttribute('visibility', 'hidden');
      tip.show(`<b>${monthLabel(mm.k)}</b><br>
        <span class="k" style="background:var(--series-1)"></span>Avg solved rating: <b>${mm.avg != null ? fmt(mm.avg) : '–'}</b> <span class="m">(${mm.ratings.length} rated, max ${mm.max != null ? fmt(mm.max) : '–'})</span><br>
        <span class="k" style="background:var(--series-2)"></span>Contest rating: <b>${rr ? fmt(rr.r) : '–'}</b><br>
        <span class="m">${mm.solved} solved · ${mm.subs} submissions</span>`, ev);
    });
    overlay.addEventListener('mouseleave', () => { tip.hide(); [cross, hA, hR].forEach((n) => n.setAttribute('visibility', 'hidden')); });
  }

  // Tags: shared rows — solved count bars | avg rating dot with min–max range.
  function tagChart(el, tags, overallAvg) {
    const W = widthOf(el), rowH = 24, headH = 22;
    const labelW = labelWidth(tags.map((t) => t.tag), W, 0.3);
    const gap = 24;
    const countW = (W - labelW - gap) * 0.4;
    const rateX0 = labelW + countW + gap, rateW = W - rateX0 - 10;
    const H = headH + tags.length * rowH + 4;
    const svg = newSvg(el, W, H);
    const maxC = Math.max(1, ...tags.map((t) => t.solved));
    const rated = tags.filter((t) => t.avg != null);
    const lo = Math.floor((Math.min(...rated.map((t) => t.min), overallAvg || 3500) - 100) / 100) * 100;
    const hi = Math.ceil((Math.max(...rated.map((t) => t.max), overallAvg || 800) + 100) / 100) * 100;
    const rx = (v) => rateX0 + ((v - lo) / Math.max(1, hi - lo)) * rateW;

    T(svg, labelW, 13, 'Solved', 'cta-axis');
    T(svg, rateX0, 13, 'Avg rating  (line: min – max)', 'cta-axis');
    const step = niceStep(hi - lo, Math.max(2, Math.floor(rateW / 90)));
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) {
      S('line', { x1: rx(v), x2: rx(v), y1: headH, y2: H, class: 'cta-gridline' }, svg);
      T(svg, rx(v), H + 12, fmt(v), 'cta-axis', { 'text-anchor': 'middle' });
    }
    svg.setAttribute('height', H + 16);
    svg.setAttribute('viewBox', `0 0 ${W} ${H + 16}`);
    if (overallAvg) {
      S('line', { x1: rx(overallAvg), x2: rx(overallAvg), y1: headH - 4, y2: H, stroke: 'var(--text-muted)', 'stroke-width': 1 }, svg);
    }

    tags.forEach((t, i) => {
      const y = headH + i * rowH, cy = y + rowH / 2;
      const g = S('g', { class: 'cta-row' }, svg);
      S('rect', { x: 0, y, width: W, height: rowH, class: 'cta-rowbg', fill: 'transparent', rx: 4 }, g);
      T(g, labelW - 10, cy + 4, truncate(t.tag, labelW - 14), 'cta-lbl', { 'text-anchor': 'end' });
      const w = Math.max(2, (t.solved / maxC) * (countW - 36));
      S('path', { d: hBar(labelW, y + 6, w, rowH - 12), fill: 'var(--series-1)', class: 'cta-mark' }, g);
      T(g, labelW + w + 6, cy + 4, fmt(t.solved), 'cta-val');
      if (t.avg != null) {
        S('line', { x1: rx(t.min), x2: rx(t.max), y1: cy, y2: cy, stroke: 'var(--range)', 'stroke-width': 3, 'stroke-linecap': 'round' }, g);
        S('circle', { cx: rx(t.avg), cy, r: 5, fill: 'var(--series-1-strong)', stroke: '#fff', 'stroke-width': 2 }, g);
      }
      bindTip(g, () => `<b>${esc(t.tag)}</b><br>Solved <b>${t.solved}</b> of ${t.attempted} attempted (${pct(t.success)})<br>
        Avg rating <b>${fmt(t.avg)}</b> <span class="m">(${t.ratings.length} rated)</span><br>
        Range ${fmt(t.min)} – ${fmt(t.max)}<br>First-try AC ${pct(t.firstTryRate)}`);
    });
  }

  // Tag × rating-bucket heatmap (HTML grid).
  function heatmap(el, A, tagList) {
    const rs = A.rated.map((p) => p.r);
    if (!rs.length) { el.innerHTML = '<div class="cta-empty">No rated problems yet.</div>'; return; }
    const b0 = Math.floor(Math.min(...rs) / 200) * 200, b1 = Math.floor(Math.max(...rs) / 200) * 200;
    const buckets = []; for (let b = b0; b <= b1; b += 200) buckets.push(b);
    const grid = new Map();
    for (const p of A.rated) for (const t of p.tags) {
      const k = `${t}|${Math.floor(p.r / 200) * 200}`;
      grid.set(k, (grid.get(k) || 0) + 1);
    }
    const max = Math.max(1, ...grid.values());
    // Same four greens as the profile's activity calendar.
    const ramp = ['#9be9a8', '#40c463', '#30a14e', '#216e39'];
    const labelW = labelWidth(tagList.map((t) => t.tag), widthOf(el), 0.3);
    let html = `<div class="cta-heat" style="grid-template-columns:${labelW}px repeat(${buckets.length}, minmax(26px,1fr))"><div></div>`;
    html += buckets.map((b) => `<div class="h">${b}</div>`).join('');
    for (const t of tagList) {
      html += `<div class="r" title="${esc(t.tag)}">${esc(t.tag)}</div>`;
      for (const b of buckets) {
        const n = grid.get(`${t.tag}|${b}`) || 0;
        if (!n) { html += '<div class="c"></div>'; continue; }
        const step = Math.min(ramp.length - 1, Math.floor(Math.sqrt(n / max) * (ramp.length - 1)));
        const color = ramp[step];
        const ink = step >= 2 ? '#fff' : '#000';
        html += `<div class="c" data-tip="${esc(t.tag)}|${b}|${n}" style="background:${color};color:${ink}">${n}</div>`;
      }
    }
    el.innerHTML = `${html}</div>`;
    el.querySelectorAll('[data-tip]').forEach((c) => {
      const [tag, b, n] = c.dataset.tip.split('|');
      bindTip(c, `<b>${esc(tag)}</b> · ${b}–${+b + 199}<br>${n} solved`);
    });
  }

  function legend(items) {
    return `<div class="cta-legend">${items.map(([label, color, dot]) => `<span><i class="${dot ? 'dot' : ''}" style="background:${color}"></i>${esc(label)}</span>`).join('')}</div>`;
  }

  // ---------------------------------------------------------------- tables
  function sortableTable(el, cols, rows, { sortKey, desc = true } = {}) {
    let key = sortKey, d = desc;
    const draw = () => {
      const sorted = rows.slice().sort((a, b) => {
        const va = a[key], vb = b[key];
        if (va == null && vb == null) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        return (typeof va === 'string' ? va.localeCompare(vb) : va - vb) * (d ? -1 : 1);
      });
      el.innerHTML = `<div class="cta-scroll"><table class="cta-table"><thead><tr>${cols.map((c) => `<th data-k="${c.k}" class="${c.k === key ? `sorted${d ? '' : ' asc'}` : ''}">${c.label}</th>`).join('')}</tr></thead>
        <tbody>${sorted.map((r) => `<tr>${cols.map((c) => `<td class="${c.left ? 'l' : ''}">${c.render ? c.render(r) : esc(r[c.k] ?? '–')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      el.querySelectorAll('th[data-k]').forEach((th) => th.addEventListener('click', () => {
        if (key === th.dataset.k) d = !d; else { key = th.dataset.k; d = key !== 'tag' && key !== 'name'; }
        draw();
      }));
    };
    draw();
  }

  const problemLink = (p) => {
    const label = `${esc(p.c ? `${p.c}${p.i}` : p.i)} · ${esc(p.n)}`;
    const note = p.matchedFrom ? ` <span class="cta-match" title="Submitted in ${esc(p.matchedFrom)}; matched to the public problem by name">via ${esc(p.matchedFrom)}</span>` : '';
    return (p.url ? `<a href="${p.url}" target="_blank" rel="noopener">${label}</a>` : label) + note;
  };

  Object.assign(window.CTA, { tip, bindTip, hbarChart, columnChart, progressChart, tagChart, heatmap, legend, sortableTable, problemLink });
})();

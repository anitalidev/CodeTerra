// Small helpers and constants shared by every analytics file.
window.CTA = window.CTA || {};
(() => {
  'use strict';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => (n == null || Number.isNaN(n) ? '–' : Math.round(n).toLocaleString('en-US'));
  const pct = (n) => (n == null || Number.isNaN(n) ? '–' : `${Math.round(n * 100)}%`);
  const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthKey = (d) => d.getFullYear() * 12 + d.getMonth();
  const monthLabel = (k) => `${MONTHS[k % 12]} ${Math.floor(k / 12)}`;
  const dayKey = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  const dateStr = (sec) => {
    const d = new Date(sec * 1000);
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  };
  const quantile = (sorted, q) => {
    if (!sorted.length) return null;
    const i = (sorted.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
  };
  const niceStep = (range, target) => {
    const raw = range / Math.max(1, target);
    const p = 10 ** Math.floor(Math.log10(raw || 1));
    const f = raw / p;
    return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
  };
  const VERDICTS = {
    OK: 'Accepted', WRONG_ANSWER: 'Wrong answer', TIME_LIMIT_EXCEEDED: 'Time limit',
    MEMORY_LIMIT_EXCEEDED: 'Memory limit', RUNTIME_ERROR: 'Runtime error', COMPILATION_ERROR: 'Compilation error',
    IDLENESS_LIMIT_EXCEEDED: 'Idleness limit', CHALLENGED: 'Hacked', SKIPPED: 'Skipped', PARTIAL: 'Partial',
    PRESENTATION_ERROR: 'Presentation error', FAILED: 'Failed', SECURITY_VIOLATED: 'Security violated',
    CRASHED: 'Crashed', INPUT_PREPARATION_CRASHED: 'Input prep crashed', REJECTED: 'Rejected', TESTING: 'Testing',
  };
  const PTYPES = {
    CONTESTANT: 'In contest', OUT_OF_COMPETITION: 'Out of competition', VIRTUAL: 'Virtual contest', PRACTICE: 'Practice',
  };
  const CORE_TAGS = ['greedy', 'math', 'implementation', 'dp', 'constructive algorithms', 'brute force', 'sortings',
    'data structures', 'binary search', 'graphs', 'number theory', 'strings', 'dfs and similar', 'trees',
    'two pointers', 'bitmasks', 'combinatorics', 'dsu', 'shortest paths', 'games', 'geometry', 'probabilities',
    'interactive', 'hashing', 'divide and conquer'];
  const problemUrl = (c, i, ps) => {
    if (!c) return ps ? `https://codeforces.com/problemsets/${ps}/problem/99999/${i}` : null;
    return c >= 100000 ? `https://codeforces.com/gym/${c}/problem/${i}` : `https://codeforces.com/contest/${c}/problem/${i}`;
  };

  Object.assign(window.CTA, { sleep, esc, fmt, pct, avg, MONTHS, monthKey, monthLabel, dayKey, dateStr, quantile, niceStep, VERDICTS, PTYPES, CORE_TAGS, problemUrl });
})();

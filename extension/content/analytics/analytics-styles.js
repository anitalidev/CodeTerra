// Panel styles. Loaded into the panel's shadow root so Codeforces' own CSS can't leak in (or out).
// Visual language mirrors Codeforces' own boxes: Verdana, #B9B9B9 rounded borders, "→" captions in #3B5998.
window.CTA_CSS = `
:host {
  all: initial;
  display: block;
  margin: 0 0 1em;
}
#cta-root {
  --cf-border: #b9b9b9;
  --cf-line: #e1e1e1;
  --cf-stripe: #f5f5f5;
  --cf-caption: #3b5998;
  --cf-link: #0000cc;
  --text-primary: #000000;
  --text-secondary: #444444;
  --text-muted: #888888;
  --series-1: #3b5998;
  --series-1-strong: #2d4373;
  --series-2: #eb6834;
  --range: #c3cee5;
  --critical: #cc0000;

  color: var(--text-primary);
  font: 13px/1.4 verdana, arial, sans-serif;
  text-align: left;
}
*, *::before, *::after { box-sizing: border-box; }
a { color: var(--cf-link); text-decoration: underline; }
a:hover { text-decoration: none; }
h3, h4, p { margin: 0; padding: 0; background: none; border: 0; }

/* header: styled like a Codeforces "→ caption" box */
.cta-head {
  display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap;
  padding: 12px 12px 8px; border-bottom: 1px solid var(--cf-border);
}
.cta-title { margin-right: auto; min-width: 0; }
.cta-title b { font-size: 15px; font-weight: bold; color: var(--cf-caption); }
.cta-title span { display: block; font-size: 11px; color: var(--text-muted); margin-top: 1px; }
.cta-head .cta-btn { align-self: center; }

/* buttons: match Codeforces' plain form buttons (e.g. "Find" in the Find user box) */
.cta-btn {
  font: 13.33px verdana, arial, sans-serif; padding: 2px 10px; cursor: pointer; border-radius: 3px;
  border: 1px solid #767676; background: #efefef; color: #000;
}
.cta-btn:hover { background: #e5e5e5; border-color: #4f4f4f; }
.cta-btn:active { background: #f5f5f5; }
.cta-btn:disabled { opacity: .5; cursor: default; }

/* tabs: like the profile's second-level menu (MEOWPERS  SETTINGS  BLOG ...) */
.cta-tabs { display: flex; gap: 2px; padding: 6px 8px; border-bottom: 1px solid var(--cf-line); overflow-x: auto; }
.cta-tab {
  font: bold 11px verdana, arial, sans-serif; text-transform: uppercase; letter-spacing: .02em;
  background: none; border: 0; cursor: pointer; border-radius: 4px; padding: 3px 8px; color: #000; white-space: nowrap;
}
.cta-tab:hover { background: var(--cf-stripe); }
.cta-tab[aria-selected="true"] { background: #d4d4d4; }

/* layout */
.cta-body { padding: 10px; display: grid; gap: 12px; }
.cta-body[hidden] { display: none; }
.cta-section {
  border: 1px solid var(--cf-border); border-radius: 6px; background: #fff; min-width: 0;
  padding: 0 0 10px;
}
.cta-section > * { margin-left: 10px; margin-right: 10px; }
.cta-section > h3 {
  margin: 0 0 6px; padding: 4px 7px 4px 8px; border-bottom: 1px solid var(--cf-border);
  font-size: 13px; font-weight: bold; color: var(--cf-caption); line-height: 1.4;
}
.cta-section > h3::before { content: "\\2192\\00a0"; }
.cta-section > h3 { cursor: pointer; user-select: none; display: flex; align-items: baseline; }
.cta-section > h3::after { content: "\\25BE"; margin-left: auto; padding-left: 8px; color: var(--text-muted); font-size: 11px; }
.cta-section > h3:hover { background: var(--cf-stripe); }
.cta-section > h3:focus-visible { outline: 2px solid var(--cf-caption); outline-offset: -2px; }
.cta-section > .cta-sec-body { margin: 0; }
.cta-section > .cta-sec-body > * { margin-left: 10px; margin-right: 10px; }
.cta-section.folded { padding-bottom: 0; }
.cta-section.folded > h3 { border-bottom-color: transparent; margin-bottom: 0; }
.cta-section.folded > h3::after { content: "\\25B8"; }
.cta-section.folded > .cta-sec-body { display: none; }
.cta-sub { color: var(--text-muted); font-size: 11px; margin-top: 0; margin-bottom: 10px; }
.cta-grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; }
.cta-grid3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }

/* stat tiles: like the activity frame counters (big number, small grey caption) */
.cta-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
.cta-tile { border: 1px solid var(--cf-line); border-radius: 6px; padding: 7px 10px 8px; min-width: 0; background: #fff; }
.cta-tile .l { font-size: 11px; color: var(--text-muted); }
.cta-tile .v { font-size: 20px; line-height: 1.3; font-variant-numeric: tabular-nums; }
.cta-tile .d { font-size: 11px; color: var(--text-muted); display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
.cta-tile.hero { border-color: var(--cf-border); }
.cta-tile.hero .v { font-weight: bold; color: var(--cf-caption); }

/* charts */
.cta-chart { position: relative; }
.cta-chart svg { display: block; overflow: visible; }
.cta-chart text { font-family: verdana, arial, sans-serif; }
.cta-axis { fill: var(--text-muted); font-size: 10px; font-variant-numeric: tabular-nums; }
.cta-lbl { fill: var(--text-primary); font-size: 11px; }
.cta-val { fill: var(--text-primary); font-size: 10px; font-weight: bold; font-variant-numeric: tabular-nums; }
.cta-val tspan.m { fill: var(--text-muted); font-weight: normal; }
.cta-gridline { stroke: var(--cf-line); stroke-width: 1; shape-rendering: crispEdges; }
.cta-hit { fill: transparent; }
.cta-col:hover .cta-hit { fill: var(--cf-stripe); }
.cta-row:hover .cta-rowbg { fill: var(--cf-stripe); }

.cta-legend { display: flex; flex-wrap: wrap; gap: 14px; font-size: 11px; color: var(--text-secondary); margin-bottom: 8px; }
.cta-legend span { display: inline-flex; align-items: center; gap: 5px; }
.cta-legend i { display: inline-block; width: 14px; height: 3px; border-radius: 2px; }
.cta-legend i.dot { width: 8px; height: 8px; border-radius: 50%; }

/* tooltip */
.cta-tip {
  position: fixed; z-index: 2147483647; pointer-events: none; max-width: 300px; display: none;
  background: #fff; color: #000; border: 1px solid var(--cf-border); border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0,0,0,.15); padding: 6px 8px;
  font: 11px/1.5 verdana, arial, sans-serif; font-variant-numeric: tabular-nums;
}
.cta-tip b { font-weight: bold; }
.cta-tip .k { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 5px; }
.cta-tip .m { color: var(--text-muted); }

/* tables: like the sidebar's rating tables */
.cta-table-wrap { overflow-x: auto; }
.cta-table { width: 100%; border-collapse: collapse; font-size: 12px; font-variant-numeric: tabular-nums; }
.cta-table th, .cta-table td { padding: 4px 8px; text-align: right; white-space: nowrap; }
.cta-table th { font-weight: bold; color: #000; background: #fff; border-bottom: 1px solid var(--cf-border); position: sticky; top: 0; z-index: 1; padding-top: 6px; }
.cta-table td { border-bottom: 1px solid var(--cf-line); }
.cta-table tbody tr:nth-child(odd) td { background: var(--cf-stripe); }
.cta-table th:first-child, .cta-table td:first-child { text-align: left; }
.cta-table td.l { text-align: left; white-space: normal; }
.cta-table th[data-k] { cursor: pointer; user-select: none; }
.cta-table th[data-k]:hover { text-decoration: underline; }
.cta-table th.sorted::after { content: " \\25BE"; }
.cta-table th.sorted.asc::after { content: " \\25B4"; }
.cta-table tbody tr:last-child td { border-bottom: 0; }
.cta-scroll { max-height: 380px; overflow: auto; border: 1px solid var(--cf-line); border-radius: 4px; }
.cta-bar { display: inline-block; height: 6px; border-radius: 3px; background: var(--range); vertical-align: middle; margin-right: 6px; }
.cta-bar > i { display: block; height: 100%; border-radius: 3px; background: var(--series-1); }

.cta-tags { color: var(--text-muted); font-size: 10px; margin-top: 1px; }
.cta-match { font-size: 10px; color: var(--text-muted); margin-left: 4px; white-space: nowrap; }
.cta-pill { font-weight: bold; }

/* heatmap: same greens as the profile's activity calendar */
.cta-heat { display: grid; gap: 2px; font-size: 10px; font-variant-numeric: tabular-nums; }
.cta-heat .h { color: var(--text-muted); text-align: center; padding: 2px 0 3px; }
.cta-heat .r { font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 8px; align-self: center; text-align: right; }
.cta-heat .c { height: 22px; border-radius: 2px; display: flex; align-items: center; justify-content: center; background: #ebedf0; font-weight: bold; }

/* export row */
.cta-export { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 10px; font-size: 11px; color: var(--text-muted); }
.cta-export span:first-child { margin-right: 2px; }
.cta-export-msg { color: #30a14e; font-weight: bold; }

/* data coverage */
.cta-stack { display: flex; gap: 2px; height: 14px; margin-bottom: 8px; }
.cta-stack i { display: block; min-width: 3px; }
.cta-stack i:first-child { border-radius: 4px 0 0 4px; }
.cta-stack i:last-child { border-radius: 0 4px 4px 0; }
.cta-stack i:only-child { border-radius: 4px; }
.cta-coverage { border-collapse: collapse; font-size: 12px; font-variant-numeric: tabular-nums; }
.cta-coverage td { padding: 3px 6px 3px 0; vertical-align: baseline; }
.cta-coverage td i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; vertical-align: -1px; }
.cta-coverage .lab { font-weight: bold; white-space: nowrap; padding-right: 12px; }
.cta-coverage .num { text-align: right; white-space: nowrap; }
.cta-coverage .m { color: var(--text-muted); padding-right: 14px; }
.cta-coverage .note { color: var(--text-muted); font-size: 11px; }
.cta-coverage tr.zero { opacity: .45; }

/* practice */
.cta-band { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.cta-band .big { font-size: 24px; font-weight: bold; color: var(--cf-caption); font-variant-numeric: tabular-nums; }
.cta-band p { color: var(--text-secondary); font-size: 11px; flex: 1; min-width: 220px; }
.cta-weak { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 6px; }
.cta-weak li { padding: 5px 8px; border: 1px solid var(--cf-line); border-radius: 4px; background: var(--cf-stripe); }
.cta-weak li b { display: block; font-size: 12px; }
.cta-weak li span { color: var(--text-muted); font-size: 11px; }

/* states */
.cta-status { padding: 24px 12px; text-align: center; color: var(--text-muted); font-size: 12px; }
.cta-status.err { color: var(--critical); }
.cta-spinner {
  display: inline-block; width: 12px; height: 12px; margin-right: 8px; vertical-align: -1px;
  border: 2px solid var(--cf-line); border-top-color: var(--cf-caption); border-radius: 50%; animation: cta-spin .8s linear infinite;
}
@keyframes cta-spin { to { transform: rotate(360deg); } }
.cta-empty { color: var(--text-muted); font-style: italic; font-size: 12px; padding: 6px 0; }

/* layout: a row of section links, then a stack of boxes like Codeforces' own */
.cta-topbar { position: sticky; top: 0; z-index: 5; background: #fff; padding: 4px 0 8px; }
.cta-jump { display: flex; gap: 2px; overflow-x: auto; }
.cta-jump-btn {
  font: bold 11px verdana, arial, sans-serif; text-transform: uppercase; letter-spacing: .02em;
  background: none; border: 0; cursor: pointer; border-radius: 4px; padding: 3px 8px; color: #000; white-space: nowrap;
}
.cta-jump-btn:hover { background: var(--cf-stripe); }
.cta-page { display: grid; gap: 12px; }

/* headline numbers */
.cta-hero { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; }
.cta-stat { border: 1px solid var(--cf-border); border-radius: 6px; padding: 8px 14px 10px; min-width: 0; background: #fff; }
.cta-stat .l { font-size: 12px; color: var(--text-secondary); }
.cta-stat .v { font-size: 28px; line-height: 1.25; font-weight: bold; color: #000; font-variant-numeric: tabular-nums; }
.cta-stat .d { font-size: 11px; color: var(--text-muted); }
.cta-top .cta-chips { display: flex; justify-content: space-around; flex-wrap: wrap; gap: 6px 16px; margin-top: 12px; }
.cta-chips { display: flex; flex-wrap: wrap; gap: 6px 0; }
.cta-chip { font-size: 12px; color: var(--text-secondary); }
.cta-chip b { color: #000; font-size: 13px; margin-right: 5px; font-variant-numeric: tabular-nums; }
.cta-section .cta-chips { justify-content: space-between; margin-bottom: 10px; }
.cta-section .cta-chip { flex: 1 1 auto; text-align: center; padding: 0 8px; border-left: 1px solid var(--cf-line); }
.cta-section .cta-chip:first-child { border-left: 0; }

/* sections: boxes with a "→" caption */
.cta-section > .cta-sec-body { padding: 0 0 2px; }
.cta-section > .cta-sec-body > :first-child { margin-top: 0; }
.cta-section h4 { font-size: 12px; font-weight: bold; margin: 14px 10px 6px; }
.cta-card { min-width: 0; }
.cta-card .k { font-size: 12px; color: var(--text-secondary); margin-bottom: 4px; }
.cta-practice { display: grid; grid-template-columns: minmax(200px, 1fr) minmax(260px, 2fr); gap: 0; }
.cta-practice .cta-card { padding: 4px 14px; }
.cta-practice .cta-card:first-child { border-right: 1px solid var(--cf-line); }
.cta-band .big { font-size: 26px; font-weight: bold; color: #000; font-variant-numeric: tabular-nums; line-height: 1.3; }
.cta-band p { color: var(--text-secondary); font-size: 11px; margin-top: 6px; }
.cta-weak { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 6px; }
.cta-weak li { padding: 5px 10px; border: 0; border-radius: 4px; background: var(--cf-stripe); }
.cta-weak li b { display: block; font-size: 12px; }
.cta-weak li span { color: var(--text-muted); font-size: 11px; }
.cta-next { margin: 12px 10px 0; padding-top: 10px; border-top: 1px solid var(--cf-line); }
.cta-next-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
.cta-next-head span { display: block; font-size: 11px; color: var(--text-muted); }
.cta-btn.primary { font-weight: bold; }
.cta-more { margin: 12px 10px 0; border-top: 1px solid var(--cf-line); padding-top: 8px; }
.cta-more > summary { cursor: pointer; font-weight: bold; font-size: 12px; color: var(--cf-caption); list-style: none; }
.cta-more > summary::-webkit-details-marker { display: none; }
.cta-more > summary::before { content: "\\25B8\\00a0"; }
.cta-more[open] > summary::before { content: "\\25BE\\00a0"; }
.cta-more > summary span { color: var(--text-muted); font-weight: normal; margin-left: 4px; }
.cta-more > :not(summary) { margin-top: 8px; }
.cta-more > .cta-sub { margin-bottom: 8px; }
.cta-section > .cta-sec-body > .cta-sub, .cta-section > .cta-sec-body > .cta-chart, .cta-section > .cta-sec-body > .cta-grid3,
.cta-section > .cta-sec-body > .cta-legend, .cta-section > .cta-sec-body > .cta-chips { margin-left: 10px; margin-right: 10px; }
.cta-section > .cta-sec-body > .cta-stack, .cta-section > .cta-sec-body > .cta-coverage { margin-left: 10px; margin-right: 10px; }
`;

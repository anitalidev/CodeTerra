// Export helpers: plain-text / HTML tables for the clipboard, CSV, and a minimal .docx writer.
// No libraries — a .docx is just a zip of three XML files, so we write an uncompressed ("stored") zip by hand.
(() => {
  'use strict';

  const enc = new TextEncoder();

  // ---------------------------------------------------------------- zip (store only)
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  const crc32 = (bytes) => {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };

  function zip(files) {
    const chunks = [];
    const central = [];
    let offset = 0;
    for (const { name, data } of files) {
      const nameBytes = enc.encode(name);
      const body = typeof data === 'string' ? enc.encode(data) : data;
      const crc = crc32(body);
      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true); // local file header
      local.setUint16(4, 20, true); // version needed
      local.setUint16(6, 0x0800, true); // UTF-8 names
      local.setUint16(8, 0, true); // method: store
      local.setUint16(10, 0, true); // time
      local.setUint16(12, 0x21, true); // date: 1980-01-01
      local.setUint32(14, crc, true);
      local.setUint32(18, body.length, true);
      local.setUint32(22, body.length, true);
      local.setUint16(26, nameBytes.length, true);
      local.setUint16(28, 0, true);
      chunks.push(new Uint8Array(local.buffer), nameBytes, body);

      const cen = new DataView(new ArrayBuffer(46));
      cen.setUint32(0, 0x02014b50, true); // central directory header
      cen.setUint16(4, 20, true);
      cen.setUint16(6, 20, true);
      cen.setUint16(8, 0x0800, true);
      cen.setUint16(10, 0, true);
      cen.setUint16(12, 0, true);
      cen.setUint16(14, 0x21, true);
      cen.setUint32(16, crc, true);
      cen.setUint32(20, body.length, true);
      cen.setUint32(24, body.length, true);
      cen.setUint16(28, nameBytes.length, true);
      cen.setUint32(42, offset, true);
      central.push(new Uint8Array(cen.buffer), nameBytes);
      offset += 30 + nameBytes.length + body.length;
    }
    const cenSize = central.reduce((s, c) => s + c.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); // end of central directory
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, cenSize, true);
    end.setUint32(16, offset, true);
    const parts = [...chunks, ...central, new Uint8Array(end.buffer)];
    const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
    let pos = 0;
    for (const p of parts) { out.set(p, pos); pos += p.length; }
    return out;
  }

  // ---------------------------------------------------------------- table formats
  // table: { title, subtitle, columns: [{ label, align: 'left'|'right', width (twips) }], rows: [[cell, ...]], footer }
  // Rows hold raw values; each format decides how to show them (thousands separators, blanks).
  const show = (v) => (v == null || v === '' ? '–' : typeof v === 'number' ? Math.round(v).toLocaleString('en-US') : String(v));
  const xml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));

  function toPlainText(t) {
    const all = [t.columns.map((c) => c.label), ...t.rows.map((r) => r.map(show))];
    const widths = t.columns.map((_, i) => Math.max(...all.map((r) => r[i].length)));
    const line = (r) => r.map((v, i) => (t.columns[i].align === 'right' ? v.padStart(widths[i]) : v.padEnd(widths[i]))).join('   ').trimEnd();
    const rule = widths.map((w) => '-'.repeat(w)).join('   ');
    return [t.title, t.subtitle, '', line(all[0]), rule, ...all.slice(1).map(line), ...(t.footer ? ['', t.footer] : [])]
      .filter((x) => x != null).join('\n');
  }

  function toHtml(t) {
    const cell = (tag, v, c, extra = '') => `<${tag} style="border:1px solid #b9b9b9;padding:4px 10px;text-align:${c.align || 'left'};${extra}">${xml(v)}</${tag}>`;
    return `<div style="font-family:verdana,arial,sans-serif;font-size:13px">
<p style="margin:0 0 2px;font-size:16px;font-weight:bold;color:#3b5998">${xml(t.title)}</p>
${t.subtitle ? `<p style="margin:0 0 8px;color:#888;font-size:12px">${xml(t.subtitle)}</p>` : ''}
<table style="border-collapse:collapse;font-size:13px">
<thead><tr>${t.columns.map((c) => cell('th', c.label, c, 'background:#f5f5f5;font-weight:bold')).join('')}</tr></thead>
<tbody>${t.rows.map((r) => `<tr>${r.map((v, i) => cell('td', show(v), t.columns[i])).join('')}</tr>`).join('\n')}</tbody>
</table>
${t.footer ? `<p style="margin:8px 0 0;color:#888;font-size:12px">${xml(t.footer)}</p>` : ''}
</div>`;
  }

  function toCsv(t) {
    const q = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
    const raw = (v) => (v == null ? '' : typeof v === 'number' ? String(Math.round(v)) : String(v));
    return [t.columns.map((c) => q(c.label)).join(','), ...t.rows.map((r) => r.map((v) => q(raw(v))).join(','))].join('\r\n');
  }

  function toDocx(t) {
    const run = (text, { bold, size = 20, color } = {}) =>
      `<w:r><w:rPr><w:rFonts w:ascii="Verdana" w:hAnsi="Verdana" w:cs="Verdana"/>${bold ? '<w:b/>' : ''}${color ? `<w:color w:val="${color}"/>` : ''}<w:sz w:val="${size}"/></w:rPr><w:t xml:space="preserve">${xml(text)}</w:t></w:r>`;
    const para = (inner, { after = 0, align } = {}) =>
      `<w:p><w:pPr><w:spacing w:before="0" w:after="${after}"/>${align ? `<w:jc w:val="${align}"/>` : ''}</w:pPr>${inner}</w:p>`;
    const border = (side) => `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="B9B9B9"/>`;
    const tc = (text, col, header) =>
      `<w:tc><w:tcPr><w:tcW w:w="${col.width}" w:type="dxa"/>${header ? '<w:shd w:val="clear" w:color="auto" w:fill="F5F5F5"/>' : ''}</w:tcPr>${
        para(run(text, { bold: header }), { align: col.align === 'right' ? 'right' : 'left' })}</w:tc>`;
    const row = (cells, header) =>
      `<w:tr>${header ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}${cells.map((v, i) => tc(header ? String(v) : show(v), t.columns[i], header)).join('')}</w:tr>`;

    const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
${para(run(t.title, { bold: true, size: 32, color: '3B5998' }), { after: 60 })}
${t.subtitle ? para(run(t.subtitle, { size: 18, color: '888888' }), { after: 240 }) : ''}
<w:tbl><w:tblPr><w:tblW w:w="${t.columns.reduce((n, c) => n + c.width, 0)}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(border).join('')}</w:tblBorders>
<w:tblCellMar><w:top w:w="50" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="50" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tblCellMar></w:tblPr>
<w:tblGrid>${t.columns.map((c) => `<w:gridCol w:w="${c.width}"/>`).join('')}</w:tblGrid>
${row(t.columns.map((c) => c.label), true)}
${t.rows.map((r) => row(r, false)).join('\n')}
</w:tbl>
${t.footer ? para(run(t.footer, { size: 18, color: '888888' }), { after: 0 }).replace('w:before="0"', 'w:before="200"') : ''}
<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>
</w:body></w:document>`;

    return zip([
      { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>' },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
      { name: 'word/document.xml', data: doc },
    ]);
  }

  // ---------------------------------------------------------------- browser actions
  function download(filename, data, type) {
    const url = URL.createObjectURL(new Blob([data], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  // Rich copy: pastes as a real table in Docs/Word/Sheets, and as aligned columns anywhere plain-text.
  async function copyTable(t) {
    const plain = toPlainText(t);
    const html = toHtml(t);
    // First try a classic copy command. It must run synchronously inside the click, and it works even
    // where the async Clipboard API is blocked (some browsers, embedded views, permission policies).
    let copied = false;
    const onCopy = (e) => {
      e.clipboardData.setData('text/html', html);
      e.clipboardData.setData('text/plain', plain);
      e.preventDefault();
      copied = true;
    };
    document.addEventListener('copy', onCopy, true);
    try { document.execCommand('copy'); } catch (_) { /* fall through */ }
    document.removeEventListener('copy', onCopy, true);
    if (copied) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plain], { type: 'text/plain' }),
      })]);
    } catch (_) {
      await navigator.clipboard.writeText(plain);
    }
  }

  const api = { zip, crc32, toPlainText, toHtml, toCsv, toDocx, download, copyTable };
  if (typeof window !== 'undefined') window.CTA_EXPORT = api;
})();

/**
 * The Apps Script that goes in the cow Google Sheet (Extensions > Apps
 * Script). It syncs the "Current" and "Gone" tabs with FarmLedger:
 *
 *  1. Reads both tabs and compares every cell with what was there after the
 *     last sync (kept in the sheet's document properties).
 *  2. Sends only what changed to FarmLedger, field by field, so an edit on
 *     the website to a different cell of the same cow isn't overwritten.
 *     Same cell changed in both places before a sync: the sheet's edit wins.
 *  3. Writes FarmLedger's full list back: website edits land in the sheet,
 *     cows marked gone on the website move to the Gone tab, new cows are
 *     added at the bottom, and existing rows keep their order.
 *
 * A "FarmLedger" menu gives "Sync now" and a switch for automatic sync
 * every 10 minutes. Removing a cow from both tabs removes it on the website.
 */
export function buildCattleAppsScript(syncUrl: string, key: string): string {
  return `// FarmLedger cow sync - paste into Extensions > Apps Script, then Save.
// Menu: FarmLedger > Sync now / Turn on automatic sync.
const FARMLEDGER_URL = ${JSON.stringify(syncUrl)};
const SYNC_KEY = ${JSON.stringify(key)};
const CURRENT_TAB = 'Current';
const GONE_TAB = 'Gone';

function onOpen() {
  SpreadsheetApp.getUi().createMenu('FarmLedger')
    .addItem('Sync now', 'syncCattle')
    .addItem('Turn on automatic sync (every 10 min)', 'turnOnAutoSync')
    .addItem('Turn off automatic sync', 'turnOffAutoSync')
    .addToUi();
}

function turnOnAutoSync() {
  turnOffAutoSync();
  ScriptApp.newTrigger('syncCattle').timeBased().everyMinutes(10).create();
  SpreadsheetApp.getActive().toast('Automatic sync is on (every 10 minutes).', 'FarmLedger');
}

function turnOffAutoSync() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'syncCattle') ScriptApp.deleteTrigger(t);
  });
}

function clean_(v) { return String(v == null ? '' : v).trim(); }

function readTab_(name) {
  const sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh || sh.getLastRow() < 1) return { sheet: sh, header: [], rows: [] };
  const values = sh.getRange(1, 1, sh.getLastRow(), Math.max(1, sh.getLastColumn())).getDisplayValues();
  return { sheet: sh, header: values[0].map(clean_), rows: values.slice(1) };
}

// Current + Gone tabs -> { tag: { name, notes, calves: {year: text}, status, goneReason, goneYear } }, plus row order.
function readSheet_(snapshot) {
  const cows = {};
  const order = [];
  const cur = readTab_(CURRENT_TAB);
  const h = cur.header;
  const iTag = h.indexOf('Number'), iName = h.indexOf('Name'), iNotes = h.indexOf('Notes');
  const calfCols = [];
  h.forEach(function (label, i) {
    const m = label.match(/^(\\d{4})\\s*Calf/i);
    if (m) calfCols.push({ year: m[1], i: i });
  });
  if (iTag < 0) throw new Error('The ' + CURRENT_TAB + ' tab needs a "Number" column.');
  cur.rows.forEach(function (r) {
    const tag = clean_(r[iTag]);
    if (!tag) return;
    const calves = {};
    calfCols.forEach(function (c) { const v = clean_(r[c.i]); if (v) calves[c.year] = v; });
    cows[tag] = { name: iName >= 0 ? clean_(r[iName]) : '', notes: iNotes >= 0 ? clean_(r[iNotes]) : '', calves: calves, status: 'current', goneReason: '', goneYear: '' };
    order.push(tag);
  });
  const gone = readTab_(GONE_TAB);
  const g = gone.header;
  const gTag = g.indexOf('Number'), gReason = g.indexOf('Reason'), gYear = g.indexOf('Year'), gName = g.indexOf('Name');
  if (gTag >= 0) {
    gone.rows.forEach(function (r) {
      const tag = clean_(r[gTag]);
      if (!tag) return;
      // A cow moved here by hand keeps what it had (the Gone tab has no notes or calf columns).
      const prev = cows[tag] || (snapshot && snapshot[tag]) || { name: '', notes: '', calves: {} };
      cows[tag] = {
        name: gName >= 0 && clean_(r[gName]) ? clean_(r[gName]) : prev.name,
        notes: prev.notes, calves: prev.calves, status: 'gone',
        goneReason: gReason >= 0 ? clean_(r[gReason]) : '', goneYear: gYear >= 0 ? clean_(r[gYear]) : '',
      };
    });
  }
  return { cows: cows, order: order, calfYears: calfCols.map(function (c) { return c.year; }) };
}

function diff_(tag, now, prev) {
  if (!prev) {
    return { tag: tag, fields: { name: now.name, notes: now.notes, calves: now.calves, status: now.status,
      goneReason: now.goneReason, goneYear: now.goneYear ? Number(now.goneYear) : null } };
  }
  const f = {};
  ['name', 'notes', 'status', 'goneReason'].forEach(function (k) { if ((now[k] || '') !== (prev[k] || '')) f[k] = now[k] || ''; });
  if ((now.goneYear || '') !== (prev.goneYear || '')) f.goneYear = now.goneYear ? Number(now.goneYear) : null;
  const calves = {};
  const years = {};
  Object.keys(now.calves || {}).concat(Object.keys(prev.calves || {})).forEach(function (y) { years[y] = true; });
  Object.keys(years).forEach(function (y) {
    const a = (now.calves || {})[y] || '', b = (prev.calves || {})[y] || '';
    if (a !== b) calves[y] = a;
  });
  if (Object.keys(calves).length) f.calves = calves;
  return Object.keys(f).length ? { tag: tag, fields: f } : null;
}

function syncCattle() {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(30000)) return;
  try {
    const props = PropertiesService.getDocumentProperties();
    const snapshot = JSON.parse(props.getProperty('farmledger_snapshot') || '{}');
    const sheet = readSheet_(snapshot);
    const changes = [];
    Object.keys(sheet.cows).forEach(function (tag) {
      const d = diff_(tag, sheet.cows[tag], snapshot[tag]);
      if (d) changes.push(d);
    });
    Object.keys(snapshot).forEach(function (tag) {
      if (!sheet.cows[tag]) changes.push({ tag: tag, deleted: true });
    });

    const res = UrlFetchApp.fetch(FARMLEDGER_URL, {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + SYNC_KEY },
      payload: JSON.stringify({ changes: changes }),
    });
    const body = JSON.parse(res.getContentText() || '{}');
    if (res.getResponseCode() !== 200) throw new Error(body.error || ('FarmLedger answered ' + res.getResponseCode()));

    const next = writeSheet_(body.cattle || [], sheet);
    props.setProperty('farmledger_snapshot', JSON.stringify(next));
    SpreadsheetApp.getActive().toast('Synced ' + (body.cattle || []).length + ' cows (' + changes.length + ' change' + (changes.length === 1 ? '' : 's') + ' sent).', 'FarmLedger');
  } finally {
    lock.releaseLock();
  }
}

// FarmLedger's list -> both tabs. Returns the snapshot of what's now in the sheet.
function writeSheet_(cattle, sheet) {
  const byTag = {};
  cattle.forEach(function (c) { byTag[String(c.tag).trim()] = c; });
  const snapshot = {};

  const yearSet = {};
  sheet.calfYears.forEach(function (y) { yearSet[y] = true; });
  cattle.forEach(function (c) { Object.keys(c.calves || {}).forEach(function (y) { yearSet[y] = true; }); });
  const years = Object.keys(yearSet).sort().reverse();

  const current = cattle.filter(function (c) { return c.status === 'current'; });
  const orderedTags = sheet.order.filter(function (t) { return byTag[t] && byTag[t].status === 'current'; });
  current.forEach(function (c) { const t = String(c.tag).trim(); if (orderedTags.indexOf(t) < 0) orderedTags.push(t); });

  const curRows = [['Number', 'Name', 'Notes'].concat(years.map(function (y) { return y + ' Calf'; }))];
  orderedTags.forEach(function (t) {
    const c = byTag[t];
    curRows.push([t, c.name || '', c.notes || ''].concat(years.map(function (y) { return (c.calves || {})[y] || ''; })));
    snapshot[t] = { name: c.name || '', notes: c.notes || '', calves: c.calves || {}, status: 'current', goneReason: '', goneYear: '' };
  });
  writeTab_(CURRENT_TAB, curRows);

  const goneOld = readTab_(GONE_TAB);
  const gTag = goneOld.header.indexOf('Number');
  const goneOrder = gTag >= 0 ? goneOld.rows.map(function (r) { return clean_(r[gTag]); }).filter(String) : [];
  const gone = cattle.filter(function (c) { return c.status === 'gone'; });
  const goneTags = goneOrder.filter(function (t) { return byTag[t] && byTag[t].status === 'gone'; });
  gone.forEach(function (c) { const t = String(c.tag).trim(); if (goneTags.indexOf(t) < 0) goneTags.push(t); });
  const goneRows = [['Number', 'Reason', 'Year', 'Name']];
  goneTags.forEach(function (t) {
    const c = byTag[t];
    goneRows.push([t, c.goneReason || '', c.goneYear ? String(c.goneYear) : '', c.name || '']);
    snapshot[t] = { name: c.name || '', notes: c.notes || '', calves: c.calves || {}, status: 'gone', goneReason: c.goneReason || '', goneYear: c.goneYear ? String(c.goneYear) : '' };
  });
  writeTab_(GONE_TAB, goneRows);
  return snapshot;
}

function writeTab_(name, rows) {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  const width = rows.reduce(function (w, r) { return Math.max(w, r.length); }, 1);
  const padded = rows.map(function (r) { while (r.length < width) r.push(''); return r; });
  const oldRows = Math.max(sh.getLastRow(), 1), oldCols = Math.max(sh.getLastColumn(), 1);
  sh.getRange(1, 1, oldRows, Math.max(oldCols, width)).clearContent();
  const range = sh.getRange(1, 1, padded.length, width);
  range.setNumberFormat('@');
  range.setValues(padded);
  sh.getRange(1, 1, 1, width).setFontWeight('bold');
}
`;
}

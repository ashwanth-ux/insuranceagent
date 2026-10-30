/**
 * Kyfr Insurance Guide: receives "Was this helpful?" feedback and writes one row per response to a "Feedback" tab,
 * with a small "Summary" tab beside it.
 *
 * Setup (once): create a new Google Sheet, then Extensions > Apps Script, paste this file, and
 *   1. pick "setup" in the function menu and press Run (creates and formats the two tabs),
 *   2. Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone.
 * Copy the web app URL into the VITE_FEEDBACK_WEBHOOK_URL environment variable (see README), then redeploy the guide.
 *
 * @OnlyCurrentDoc  (limits the permission Google asks for to this one spreadsheet)
 */

const FEEDBACK_TAB = 'Feedback';
const SUMMARY_TAB = 'Summary';
const FIRST_DATA_ROW = 2; // row 1 = column headers
const LAST_ROW = 5000;
const COMMENT_MAX = 500;
const HEADERS = ['Received', 'Helpful', 'Their words', 'Journey', 'Device', 'Where', 'Session', 'Status', 'Notes'];
const JOURNEYS = { term: 'Term life', health: 'Health', full: 'Full guide' };

function doGet() {
  return json_({ ok: true, service: 'kyfr-insurance-feedback' });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const fb = JSON.parse(e.postData.contents);
    const problem = validate_(fb);
    if (problem) return json_({ ok: false, error: problem });
    save_(fb);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: 'server' });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function validate_(fb) {
  if (!fb || typeof fb !== 'object') return 'bad payload';
  if (fb.helpful !== 'yes' && fb.helpful !== 'no') return 'bad rating';
  if (!JOURNEYS[fb.journey]) return 'bad journey';
  if (typeof fb.sessionId !== 'string' || fb.sessionId.length < 8 || fb.sessionId.length > 64) return 'bad session';
  return null;
}

function save_(fb) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FEEDBACK_TAB);
  if (!sheet) throw new Error('Missing tab: ' + FEEDBACK_TAB);
  const row = [
    new Date(),
    fb.helpful === 'yes' ? 'Yes' : 'Not really',
    safe_(String(fb.comment || '').slice(0, COMMENT_MAX)),
    JOURNEYS[fb.journey],
    fb.device === 'phone' ? 'Phone' : 'Computer',
    fb.surface === 'app' ? 'In the app' : 'On the web',
    fb.sessionId,
    'New',
    ''
  ];
  // The same session sending the same journey again (a retry, or a changed mind) updates its row instead of adding one.
  const existing = findRow_(sheet, fb.sessionId, JOURNEYS[fb.journey]);
  if (existing) {
    sheet.getRange(existing, 2, 1, 5).setValues([row.slice(1, 6)]);
    return;
  }
  sheet.appendRow(row);
}

// Stop anything a visitor types from being read as a formula.
function safe_(text) {
  text = text.replace(/\u0000/g, '').trim();
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function findRow_(sheet, sessionId, journey) {
  const last = sheet.getLastRow();
  if (last < FIRST_DATA_ROW) return 0;
  const start = Math.max(FIRST_DATA_ROW, last - LAST_ROW + 1);
  const seen = sheet.getRange(start, 4, last - start + 1, 4).getValues(); // Journey, Device, Where, Session
  for (let i = seen.length - 1; i >= 0; i--) if (String(seen[i][3]) === sessionId && seen[i][0] === journey) return start + i;
  return 0;
}

// Run once from the editor (function menu > setup > Run). Safe to run again.
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const fb = ss.getSheetByName(FEEDBACK_TAB) || ss.insertSheet(FEEDBACK_TAB, 0);
  fb.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
    .setFontFamily('Roboto').setFontWeight('bold').setFontSize(10).setFontColor('#ffffff').setBackground('#4B2A8A').setVerticalAlignment('middle');
  fb.setFrozenRows(1);
  const rows = LAST_ROW - FIRST_DATA_ROW + 1;
  fb.getRange(FIRST_DATA_ROW, 1, rows, HEADERS.length).setFontFamily('Roboto').setFontSize(10).setFontColor('#241B33').setVerticalAlignment('top');
  fb.getRange(FIRST_DATA_ROW, 1, rows, 1).setNumberFormat('dd mmm yyyy, hh:mm').setHorizontalAlignment('left');
  fb.getRange(FIRST_DATA_ROW, 2, rows, 1).setHorizontalAlignment('center');
  fb.getRange(FIRST_DATA_ROW, 3, rows, 1).setWrap(true).setNumberFormat('@');
  fb.getRange(FIRST_DATA_ROW, 4, rows, 5).setNumberFormat('@');
  fb.getRange(FIRST_DATA_ROW, 7, rows, 1).setFontColor('#7A7388');
  [150, 90, 420, 100, 90, 100, 150, 90, 220].forEach(function (w, i) { fb.setColumnWidth(i + 1, w); });
  fb.getRange(FIRST_DATA_ROW, 8, rows, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['New', 'Read', 'Acted on'], true).build()).setHorizontalAlignment('center');
  fb.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Yes').setBackground('#DDF5E6').setFontColor('#0A7A3A').setRanges([fb.getRange(FIRST_DATA_ROW, 2, rows, 1)]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Not really').setBackground('#FDE9D7').setFontColor('#B45309').setRanges([fb.getRange(FIRST_DATA_ROW, 2, rows, 1)]).build()
  ]);

  // A few plain counts over a bounded range, so the sheet stays quick however many rows arrive.
  const sm = ss.getSheetByName(SUMMARY_TAB) || ss.insertSheet(SUMMARY_TAB);
  const F = FEEDBACK_TAB + '!';
  const rng = function (col) { return F + col + FIRST_DATA_ROW + ':' + col + LAST_ROW; };
  sm.clear();
  sm.getRange('A1:D1').setValues([['Kyfr Insurance Guide: feedback', '', '', '']]).setFontWeight('bold').setFontSize(13);
  const table = [
    ['', 'All', 'Helpful', 'Not really'],
    ['Responses', '=COUNTA(' + rng('B') + ')', '=COUNTIF(' + rng('B') + ',"Yes")', '=COUNTIF(' + rng('B') + ',"Not really")'],
    ['Share of responses', '', '=IF(B3=0,"",C3/B3)', '=IF(B3=0,"",D3/B3)'],
    ['With a few words', '=COUNTIF(' + rng('C') + ',"?*")', '=COUNTIFS(' + rng('B') + ',"Yes",' + rng('C') + ',"?*")', '=COUNTIFS(' + rng('B') + ',"Not really",' + rng('C') + ',"?*")']
  ];
  ['Term life', 'Health', 'Full guide'].forEach(function (j) {
    table.push([j, '=COUNTIF(' + rng('D') + ',"' + j + '")', '=COUNTIFS(' + rng('D') + ',"' + j + '",' + rng('B') + ',"Yes")', '=COUNTIFS(' + rng('D') + ',"' + j + '",' + rng('B') + ',"Not really")']);
  });
  ['Phone', 'Computer'].forEach(function (d) {
    table.push([d, '=COUNTIF(' + rng('E') + ',"' + d + '")', '=COUNTIFS(' + rng('E') + ',"' + d + '",' + rng('B') + ',"Yes")', '=COUNTIFS(' + rng('E') + ',"' + d + '",' + rng('B') + ',"Not really")']);
  });
  sm.getRange(3 - 1, 1, table.length, 4).setValues(table);
  sm.getRange('A2:D2').setFontWeight('bold').setFontColor('#ffffff').setBackground('#4B2A8A');
  sm.getRange('C4:D4').setNumberFormat('0%');
  sm.getRange('A2:D' + (table.length + 1)).setFontFamily('Roboto').setFontSize(10).setVerticalAlignment('middle');
  sm.getRange('B2:D' + (table.length + 1)).setHorizontalAlignment('center');
  sm.setColumnWidths(1, 1, 180); sm.setColumnWidths(2, 3, 110);
  sm.getRange('A1').setFontFamily('Roboto');
  sm.setHiddenGridlines(true);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

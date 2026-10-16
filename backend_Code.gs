// 빵을그리다 배송 코스 공유 저장 (내 동선 앱 전용) - 2026-10-16
// 앱(https://lee1812-oss.github.io/dongseon/)이 배송 코스·출고 체크·기본 코스·배송처 주소 수정을 여기에 저장하고 불러온다.
// 저장 위치: 구글 시트 「빵을그리다 배송 코스 공유 저장 (앱 자동)」 store 탭 (key / value(JSON) / updatedAt / by)
// 사람이 보기 좋은 탭: 「보기_코스」 (오늘~7일 뒤 코스, 적재 여부, 특이사항) - 앱에서 바뀔 때마다 자동 갱신
// 접근: 앱 직원용 암호에서 만든 토큰이 맞아야 읽기·쓰기 가능. 암호를 바꾸면 setPass('새암호') 실행.

function setup() {
  const p = PropertiesService.getScriptProperties();
  let id = p.getProperty('SS_ID');
  if (!id) {
    const ss = SpreadsheetApp.create('빵을그리다 배송 코스 공유 저장 (앱 자동)');
    id = ss.getId(); p.setProperty('SS_ID', id);
    const sh = ss.getSheets()[0]; sh.setName('store');
    sh.getRange(1, 1, 1, 4).setValues([['key', 'value', 'updatedAt', 'by']]); sh.setFrozenRows(1);
    const v = ss.insertSheet('보기_코스');
    v.getRange(1, 1, 1, 7).setValues([['날짜', '코스', '순서', '업체', '적재', '특이사항', '마지막 수정']]); v.setFrozenRows(1);
  }
  setPass('2580');
  Logger.log('SS_URL ' + SpreadsheetApp.openById(id).getUrl());
}
function photoFolder_() {
  const p = PropertiesService.getScriptProperties(); const id = p.getProperty('PHOTO_DIR');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { } }
  const f = DriveApp.createFolder('빵을그리다 배송 완료 사진 (앱 자동)'); p.setProperty('PHOTO_DIR', f.getId()); return f;
}
function setupPhoto() { Logger.log('PHOTO_DIR ' + photoFolder_().getUrl()); }
function setPass(pass) { PropertiesService.getScriptProperties().setProperty('TOKEN', sha_('dongseon|' + pass)); }
function sha_(s) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8).map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join(''); }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function ss_() { return SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SS_ID')); }
function readAll_(sh) {
  const v = sh.getDataRange().getValues(); const m = {};
  for (let i = 1; i < v.length; i++) if (v[i][0]) m[v[i][0]] = { row: i + 1, value: v[i][1], at: v[i][2], by: v[i][3] };
  return m;
}
function deepMerge_(a, b) {
  if (b === null) return null;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || Array.isArray(b)) return b;
  const o = Object.assign({}, a);
  for (const k in b) { if (b[k] === null) delete o[k]; else o[k] = deepMerge_(a[k], b[k]); }
  return o;
}
function doGet(e) { return handle_(e.parameter || {}); }
function doPost(e) { let b = {}; try { b = JSON.parse(e.postData.contents); } catch (x) { } return handle_(b); }
function handle_(b) {
  const p = PropertiesService.getScriptProperties();
  if (!b.token || b.token !== p.getProperty('TOKEN')) return out_({ ok: false, err: 'auth' });
  const sh = ss_().getSheetByName('store');
  if (b.op === 'ping') return out_({ ok: true, now: Date.now() });
  if (b.op === 'photo') {
    // 배송 완료 사진: base64 JPEG → 구글 드라이브 폴더 저장, 링크 공유(보기 전용)
    const data = String(b.data || ''); if (!data || data.length > 4000000) return out_({ ok: false, err: 'size' });
    const blob = Utilities.newBlob(Utilities.base64Decode(data), 'image/jpeg', String(b.name || ('photo_' + Date.now())) + '.jpg');
    const f = photoFolder_().createFile(blob);
    f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return out_({ ok: true, id: f.getId(), url: 'https://drive.google.com/file/d/' + f.getId() + '/view', thumb: 'https://drive.google.com/thumbnail?id=' + f.getId() + '&sz=w600' });
  }
  if (b.op === 'get') {
    const all = readAll_(sh); const keys = String(b.keys || '').split(',').filter(String); const res = {};
    keys.forEach(function (k) { if (all[k]) res[k] = { value: JSON.parse(all[k].value), at: all[k].at, by: all[k].by }; });
    return out_({ ok: true, data: res, now: Date.now() });
  }
  if (b.op === 'put' || b.op === 'merge') {
    const lock = LockService.getScriptLock(); lock.waitLock(15000);
    try {
      const all = readAll_(sh); const k = String(b.key || ''); if (!k) return out_({ ok: false, err: 'key' });
      let val = b.value; const now = Date.now();
      if (b.op === 'merge' && all[k]) val = deepMerge_(JSON.parse(all[k].value), val);
      const row = all[k] ? all[k].row : sh.getLastRow() + 1;
      sh.getRange(row, 1, 1, 4).setValues([[k, JSON.stringify(val), now, b.by || '']]);
      if (/^(day|chk):/.test(k)) { try { refreshView_(); } catch (x) { } }
      return out_({ ok: true, at: now, value: val });
    } finally { lock.releaseLock(); }
  }
  return out_({ ok: false, err: 'op' });
}
// 사람이 보는 탭: 오늘~7일 뒤
function refreshView_() {
  const ss = ss_(); const all = readAll_(ss.getSheetByName('store'));
  const v = ss.getSheetByName('보기_코스'); const rows = [];
  const tz = 'Asia/Seoul'; const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const end = Utilities.formatDate(new Date(Date.now() + 7 * 864e5), tz, 'yyyy-MM-dd');
  Object.keys(all).filter(function (k) { return /^day:/.test(k); }).sort().forEach(function (k) {
    const d = k.slice(4); if (d < today || d > end) return;
    const day = JSON.parse(all[k].value) || {}; const chk = all['chk:' + d] ? JSON.parse(all['chk:' + d].value) : {};
    (day.runs || []).forEach(function (r) {
      (r.stops || []).forEach(function (s, i) {
        const key = r.id + '|' + s.placeId; const done = chk.done && chk.done[key];
        rows.push([d, r.run, i + 1, s.name || s.placeId, done ? '적재 완료 ' + (done.t || '') : '', (chk.note && chk.note[key]) || '', Utilities.formatDate(new Date(all[k].at), tz, 'MM/dd HH:mm') + ' ' + (all[k].by || '')]);
      });
    });
  });
  v.getRange(2, 1, Math.max(v.getLastRow(), 2), 7).clearContent();
  if (rows.length) v.getRange(2, 1, rows.length, 7).setValues(rows);
}

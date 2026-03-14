/**
 * Claude Migrator — Google Drive Backup Uploader v6
 *
 * Uses Google Identity Services (GIS) for sign-in instead of Apps Script auth.
 * - User clicks "Sign in with Google" and picks their account
 * - Token lives in memory only — cleared when the tab/page closes
 * - "Switch Account" signs out and prompts re-auth immediately
 * - Files uploaded via Google Drive API using the client-side token
 * - No persistent session, no sticky auth
 *
 * DEPLOY:
 *   Execute as: "Me" (doesn't matter — we don't use server-side auth for Drive)
 *   Who has access: "Anyone" or "Anyone with Google account"
 *
 * REQUIRED: A Google Cloud OAuth Client ID. To create one:
 *   1. Go to https://console.cloud.google.com/apis/credentials
 *   2. Create OAuth 2.0 Client ID → Web application
 *   3. Add authorized JavaScript origins: https://script.google.com
 *   4. Add authorized redirect URIs: https://script.google.com
 *   5. Copy the Client ID and paste it into CLIENT_ID below
 *   6. Enable the Google Drive API in your project:
 *      https://console.cloud.google.com/apis/library/drive.googleapis.com
 */

// ============================================================
// CONFIG — Set your OAuth Client ID as a Script Property:
//   1. In the Apps Script editor, click ⚙️ Project Settings (gear icon)
//   2. Scroll to "Script Properties"
//   3. Click "Add script property"
//   4. Property: OAUTH_CLIENT_ID
//   5. Value: your-client-id.apps.googleusercontent.com
//   6. Save
//
// This keeps credentials out of the source code.
// ============================================================

function getClientId() {
  var id = PropertiesService.getScriptProperties().getProperty('OAUTH_CLIENT_ID');
  if (!id) throw new Error('OAUTH_CLIENT_ID not set. Go to Project Settings → Script Properties and add it.');
  return id;
}

// ============================================================
// BACKEND — Only serves the HTML page
// ============================================================

function doGet() {
  var clientId = getClientId();
  var html = getUploadPage().replace('__CLIENT_ID__', clientId);
  return HtmlService.createHtmlOutput(html)
    .setTitle('Claude Migration Backup')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ============================================================
// FRONTEND — Everything happens client-side with Drive API
// ============================================================

function getUploadPage() {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<script src="https://accounts.google.com/gsi/client"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'DM Sans',-apple-system,sans-serif;background:#0a0a0f;color:#e0e0e8;min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:2rem 1rem}
.c{max-width:660px;width:100%}
.hd{text-align:center;margin-bottom:1.5rem}
.hd h1{font-size:1.8rem;font-weight:700;background:linear-gradient(135deg,#e94560,#53a8b6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:0.3rem}
.hd p{color:#888;font-size:0.92rem}

/* Auth section */
.auth-card{background:#111118;border:1px solid #1a1a2e;border-radius:12px;padding:1.5rem;margin-bottom:1rem;text-align:center}
.auth-card h3{font-size:0.95rem;font-weight:600;margin-bottom:0.8rem}
.auth-card p{font-size:0.82rem;color:#888;margin-bottom:1rem}

/* Account bar (shown after login) */
.acct{background:#111118;border:1px solid #1a1a2e;border-radius:12px;padding:0.9rem 1.2rem;margin-bottom:1rem;display:none;align-items:center;gap:0.8rem}
.acct.v{display:flex}
.av{width:38px;height:38px;border-radius:50%;overflow:hidden;flex-shrink:0;background:linear-gradient(135deg,#e94560,#53a8b6);display:flex;align-items:center;justify-content:center}
.av img{width:100%;height:100%;object-fit:cover}
.av span{font-weight:700;font-size:1rem;color:#fff}
.ai{flex:1;min-width:0}
.ai .lb{font-size:0.68rem;color:#666;text-transform:uppercase;letter-spacing:0.05em}
.ai .nm{font-size:0.9rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ai .em{font-size:0.78rem;color:#888;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sw{font-family:'DM Sans',sans-serif;font-size:0.78rem;font-weight:600;padding:0.4rem 0.9rem;border-radius:8px;border:1px solid #e94560;background:transparent;color:#e94560;cursor:pointer;transition:all 0.15s;white-space:nowrap}
.sw:hover{background:#e9456015}

/* Status */
.sb{background:#111118;border:1px solid #1a1a2e;border-radius:12px;padding:0.8rem 1.2rem;margin-bottom:1.2rem;display:none;align-items:center;gap:0.7rem}
.sb.v{display:flex}
.dot{width:9px;height:9px;border-radius:50%;flex-shrink:0}
.dot.ok{background:#53a8b6}.dot.pe{background:#f0a500}.dot.er{background:#e94560}
.sb .tx{font-size:0.84rem;color:#bbb}
.sb a{color:#53a8b6;text-decoration:none;font-weight:500}

/* Drop zone */
.dz{border:2px dashed #2a2a3e;border-radius:16px;padding:2.5rem 2rem;text-align:center;cursor:pointer;transition:all 0.2s;margin-bottom:1.2rem;background:#0d0d14;display:none}
.dz.v{display:block}
.dz:hover,.dz.dragover{border-color:#53a8b6;background:#0f1520}
.dz .icon{font-size:2.2rem;margin-bottom:0.6rem}
.dz h3{font-size:1.05rem;font-weight:600;margin-bottom:0.3rem}
.dz p{font-size:0.82rem;color:#888}
.zn{margin-top:0.7rem;font-size:0.78rem;color:#53a8b6;background:#53a8b610;padding:0.4rem 0.9rem;border-radius:8px;display:inline-block}
.dz.up{pointer-events:none;opacity:0.6}
input[type="file"]{display:none}

/* Progress */
.ps{background:#111118;border:1px solid #1a1a2e;border-radius:12px;padding:1rem;margin-bottom:0.8rem;display:none}
.ps.v{display:block}
.ps h4{font-size:0.82rem;color:#888;margin-bottom:0.5rem}
.pb{width:100%;height:5px;background:#1a1a2e;border-radius:3px;overflow:hidden}
.pb .fl{height:100%;background:linear-gradient(90deg,#e94560,#53a8b6);border-radius:3px;transition:width 0.3s;width:0%}
.pt{font-family:'JetBrains Mono',monospace;font-size:0.72rem;color:#666;margin-top:0.3rem;text-align:right}

/* File list */
.flist{display:flex;flex-direction:column;gap:0.35rem;margin-bottom:1.2rem;max-height:250px;overflow-y:auto}
.fi{background:#111118;border:1px solid #1a1a2e;border-radius:8px;padding:0.5rem 0.9rem;display:flex;align-items:center;gap:0.6rem;font-size:0.8rem}
.fi .nm{flex:1;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fi .sz{color:#555;font-family:'JetBrains Mono',monospace;font-size:0.68rem;flex-shrink:0}
.si{flex-shrink:0}.si.ok{color:#53a8b6}.si.er{color:#e94560}.si.wa{color:#f0a500}

/* Summary */
.su{background:#111118;border:1px solid #1a1a2e;border-radius:12px;padding:1.4rem;text-align:center;display:none}
.su.v{display:block}
.su h3{color:#53a8b6;font-size:1rem;margin-bottom:0.5rem}
.su>p{font-size:0.84rem;color:#999;line-height:1.5}
.lbox{margin-top:1rem;background:#0a0a0f;border:1px solid #1a1a2e;border-radius:10px;padding:0.8rem 1rem;display:flex;align-items:center;gap:0.6rem}
.lbox input{flex:1;background:transparent;border:none;color:#53a8b6;font-family:'JetBrains Mono',monospace;font-size:0.78rem;outline:none;overflow:hidden;text-overflow:ellipsis}
.cpb{font-family:'DM Sans',sans-serif;font-size:0.75rem;font-weight:600;padding:0.35rem 0.8rem;border-radius:6px;border:1px solid #53a8b6;background:transparent;color:#53a8b6;cursor:pointer;transition:all 0.15s;white-space:nowrap}
.cpb:hover{background:#53a8b620}
.cpb.ok{background:#53a8b6;color:#0a0a0f}
.hint{font-size:0.75rem;color:#555;margin-top:0.8rem}
.br{display:flex;gap:0.6rem;justify-content:center;margin-top:1rem;flex-wrap:wrap}
.br a{display:inline-block;padding:0.55rem 1.2rem;border-radius:8px;font-weight:600;font-size:0.85rem;text-decoration:none;transition:opacity 0.2s}
.br .drl{background:linear-gradient(135deg,#e94560,#53a8b6);color:white}
.br .cll{border:1px solid #53a8b6;color:#53a8b6}
.br a:hover{opacity:0.85}
.ft{margin-top:2rem;text-align:center;font-size:0.73rem;color:#444}
</style>
</head>
<body>
<div class="c">

  <div class="hd">
    <h1>Claude Migration Backup</h1>
    <p>Upload your Claude export to Google Drive</p>
  </div>

  <!-- Auth Card — shown before login -->
  <div class="auth-card" id="authCard">
    <h3>Sign in to upload to your Google Drive</h3>
    <p>Your session ends when you close this tab. No data is stored.</p>
    <div id="gsiBtn"></div>
  </div>

  <!-- Account Bar — shown after login -->
  <div class="acct" id="acctBar">
    <div class="av" id="av"><span>?</span></div>
    <div class="ai">
      <div class="lb">Uploading to Drive for</div>
      <div class="nm" id="uName">—</div>
      <div class="em" id="uEmail">—</div>
    </div>
    <button class="sw" onclick="switchAcct()">Switch Account</button>
  </div>

  <!-- Status -->
  <div class="sb" id="sb">
    <div class="dot pe" id="sd"></div>
    <div class="tx" id="st">Creating backup folder...</div>
  </div>

  <!-- Drop zone -->
  <div class="dz" id="dz">
    <div class="icon">📁</div>
    <h3>Drag & drop files here</h3>
    <p>or click to browse</p>
    <div class="zn">📦 ZIP files are automatically extracted before uploading</div>
  </div>
  <input type="file" id="fileIn" multiple>

  <!-- Progress -->
  <div class="ps" id="ps">
    <h4 id="pl">Processing...</h4>
    <div class="pb"><div class="fl" id="pf"></div></div>
    <div class="pt" id="px">0 / 0</div>
  </div>

  <div class="flist" id="flist"></div>

  <!-- Summary -->
  <div class="su" id="su">
    <h3>✅ All files backed up</h3>
    <p id="sut"></p>
    <div class="lbox">
      <input type="text" id="fli" readonly>
      <button class="cpb" id="cpb" onclick="cpLink()">Copy Link</button>
    </div>
    <div class="hint">📋 Paste this link back into Claude so it knows where your backup is stored</div>
    <div class="br">
      <a class="drl" id="flk" href="#" target="_blank">Open in Drive →</a>
      <a class="cll" href="https://claude.ai" target="_blank">Back to Claude ↩</a>
    </div>
  </div>

  <div class="ft">Claude Migrator — Built by St1ng3r254</div>
</div>

<script>
const CLIENT_ID = '__CLIENT_ID__';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
let accessToken = null;
let sessionFolderId = null;
let sessionFolderUrl = null;
let sessionFolderName = '';
let uc = 0, tf = 0;
let tokenClient = null;

// ============================================================
// AUTH — Google Identity Services
// ============================================================

function initGsi() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: onTokenResponse,
    prompt: '', // empty = auto-select if one account, show picker if multiple
  });

  // Render the sign-in button
  google.accounts.id.initialize({
    client_id: CLIENT_ID,
    callback: onCredentialResponse,
    auto_select: false,
  });
  google.accounts.id.renderButton(
    document.getElementById('gsiBtn'),
    { theme: 'filled_black', size: 'large', width: 300, text: 'signin_with' }
  );
}

function onCredentialResponse(response) {
  // JWT from one-tap / button click — decode to get user info
  var payload = JSON.parse(atob(response.credential.split('.')[1]));
  showUser(payload.name, payload.email, payload.picture);
  // Now request an access token for Drive
  tokenClient.requestAccessToken({ hint: payload.email });
}

function onTokenResponse(resp) {
  if (resp.error) {
    setStatus('er', 'Auth failed: ' + resp.error);
    return;
  }
  accessToken = resp.access_token;
  document.getElementById('authCard').style.display = 'none';
  document.getElementById('sb').classList.add('v');
  document.getElementById('dz').classList.add('v');
  setStatus('pe', 'Creating backup folder...');
  initDriveFolder();
}

function showUser(name, email, picture) {
  var bar = document.getElementById('acctBar');
  bar.classList.add('v');
  document.getElementById('uName').textContent = name || email;
  document.getElementById('uEmail').textContent = email;
  var av = document.getElementById('av');
  if (picture) {
    av.innerHTML = '<img src="' + esc(picture) + '" alt="">';
  } else {
    av.innerHTML = '<span>' + (name || email || '?').charAt(0).toUpperCase() + '</span>';
  }
}

function switchAcct() {
  // Revoke current token
  if (accessToken) {
    google.accounts.oauth2.revoke(accessToken, function() {});
  }
  accessToken = null;
  sessionFolderId = null;

  // Reset UI
  document.getElementById('acctBar').classList.remove('v');
  document.getElementById('sb').classList.remove('v');
  document.getElementById('dz').classList.remove('v');
  document.getElementById('dz').classList.remove('up');
  document.getElementById('su').classList.remove('v');
  document.getElementById('ps').classList.remove('v');
  document.getElementById('flist').innerHTML = '';
  document.getElementById('authCard').style.display = 'block';
  uc = 0; tf = 0;

  // Force account picker on next sign-in
  google.accounts.id.disableAutoSelect();
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: onTokenResponse,
    prompt: 'select_account', // force picker
  });
  tokenClient.requestAccessToken();
}

// ============================================================
// DRIVE API — Client-side calls using access token
// ============================================================

async function driveApi(url, opts) {
  opts = opts || {};
  opts.headers = opts.headers || {};
  opts.headers['Authorization'] = 'Bearer ' + accessToken;
  var resp = await fetch(url, opts);
  if (!resp.ok) throw new Error('Drive API ' + resp.status + ': ' + (await resp.text()).slice(0, 200));
  return resp.json();
}

async function findOrCreateFolder(name, parentId) {
  var q = "name='" + name.replace(/'/g, "\\\\'") + "' and mimeType='application/vnd.google-apps.folder' and trashed=false";
  if (parentId) q += " and '" + parentId + "' in parents";
  var res = await driveApi('https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent(q) + '&fields=files(id,webViewLink)');
  if (res.files && res.files.length > 0) return res.files[0];
  // Create
  var body = { name: name, mimeType: 'application/vnd.google-apps.folder' };
  if (parentId) body.parents = [parentId];
  return driveApi('https://www.googleapis.com/drive/v3/files?fields=id,webViewLink', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

async function uploadFileToDrive(fileName, mimeType, blob, folderId) {
  var metadata = { name: fileName, parents: [folderId] };
  var form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', blob);
  return fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,size', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + accessToken },
    body: form
  }).then(r => r.json());
}

async function initDriveFolder() {
  try {
    var root = await findOrCreateFolder('Claude Migration Backups', null);
    var d = new Date();
    var name = 'Migration — ' + d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0') + ' ' + String(d.getHours()).padStart(2,'0') + '-' + String(d.getMinutes()).padStart(2,'0');
    var session = await findOrCreateFolder(name, root.id);
    sessionFolderId = session.id;
    sessionFolderUrl = session.webViewLink || ('https://drive.google.com/drive/folders/' + session.id);
    sessionFolderName = name;
    setStatus('ok', 'Ready — saving to <a href="' + esc(sessionFolderUrl) + '" target="_blank">' + esc(name) + '</a>');
  } catch (e) {
    setStatus('er', 'Error: ' + e.message);
  }
}

// ============================================================
// FILE HANDLING
// ============================================================

var dz = document.getElementById('dz');
var fileIn = document.getElementById('fileIn');
dz.addEventListener('click', function() { fileIn.click(); });
dz.addEventListener('dragover', function(e) { e.preventDefault(); dz.classList.add('dragover'); });
dz.addEventListener('dragleave', function() { dz.classList.remove('dragover'); });
dz.addEventListener('drop', function(e) { e.preventDefault(); dz.classList.remove('dragover'); go(e.dataTransfer.files); });
fileIn.addEventListener('change', function() { go(fileIn.files); });

async function go(files) {
  if (!sessionFolderId) { alert('Still initializing.'); return; }
  dz.classList.add('up');
  var all = [];

  for (var i = 0; i < files.length; i++) {
    var f = files[i];
    if (f.name.endsWith('.zip') || f.type === 'application/zip' || f.type === 'application/x-zip-compressed') {
      prog('Extracting ' + f.name + '...', 0, 1);
      try {
        var z = await JSZip.loadAsync(f);
        var ek = Object.keys(z.files), ex = 0;
        for (var j = 0; j < ek.length; j++) {
          var en = z.files[ek[j]];
          if (en.dir) continue;
          var bl = await en.async('blob');
          all.push({ name: en.name, blob: bl, mime: mime(en.name), sub: subf(en.name) });
          ex++; prog('Extracting ' + f.name + '...', ex, ek.length);
        }
      } catch (err) { addF(f.name, 0, 'er', 'ZIP failed: ' + err); }
    } else {
      all.push({ name: f.name, blob: f, mime: f.type || 'application/octet-stream', sub: null });
    }
  }

  tf += all.length;
  prog('Uploading to Drive...', 0, all.length);
  var sfCache = {};

  for (var k = 0; k < all.length; k++) {
    var it = all[k];
    var targetId = sessionFolderId;
    if (it.sub) {
      if (!sfCache[it.sub]) {
        try {
          var sf = await findOrCreateFolder(it.sub, sessionFolderId);
          sfCache[it.sub] = sf.id;
        } catch (e) { sfCache[it.sub] = sessionFolderId; }
      }
      targetId = sfCache[it.sub];
    }
    var el = addF(it.name, it.blob.size, 'wa', '');
    try {
      await uploadFileToDrive(it.name.split('/').pop(), it.mime, it.blob, targetId);
      setS(el, 'ok', '✅');
    } catch (e) {
      setS(el, 'er', '❌');
    }
    uc++;
    prog('Uploading to Drive...', uc, all.length);
  }

  dz.classList.remove('up');
  done();
}

function done() {
  if (uc >= tf && tf > 0) {
    hide('ps');
    document.getElementById('su').classList.add('v');
    document.getElementById('sut').textContent = uc + ' file(s) saved to "' + sessionFolderName + '"';
    document.getElementById('fli').value = sessionFolderUrl;
    document.getElementById('flk').href = sessionFolderUrl;
  }
}

// ============================================================
// UI HELPERS
// ============================================================

function setStatus(type, html) {
  document.getElementById('sd').className = 'dot ' + type;
  document.getElementById('st').innerHTML = html;
}

function prog(l, c, t) {
  show('ps');
  document.getElementById('pl').textContent = l;
  document.getElementById('pf').style.width = (t > 0 ? (c / t * 100) : 0) + '%';
  document.getElementById('px').textContent = c + ' / ' + t;
}

function addF(name, size, st, err) {
  var d = document.createElement('div'); d.className = 'fi';
  d.innerHTML = '<span class="si ' + st + '">' + (st === 'ok' ? '✅' : st === 'er' ? '❌' : '⏳') + '</span>'
    + '<span class="nm">' + esc(name.split('/').pop()) + (err ? ' — ' + esc(err) : '') + '</span>'
    + '<span class="sz">' + fz(size) + '</span>';
  document.getElementById('flist').appendChild(d);
  return d;
}

function setS(el, s, i) { var x = el.querySelector('.si'); x.textContent = i; x.className = 'si ' + s; }
function show(id) { document.getElementById(id).classList.add('v'); }
function hide(id) { document.getElementById(id).classList.remove('v'); }

function cpLink() {
  var inp = document.getElementById('fli'); inp.select(); inp.setSelectionRange(0, 99999);
  navigator.clipboard.writeText(inp.value).then(function() {
    var b = document.getElementById('cpb'); b.textContent = 'Copied!'; b.classList.add('ok');
    setTimeout(function() { b.textContent = 'Copy Link'; b.classList.remove('ok'); }, 2000);
  }).catch(function() { document.execCommand('copy'); });
}

function subf(n) { var p = n.split('/'); return p.length > 1 ? p[0] : null; }
function mime(n) {
  var e = n.split('.').pop().toLowerCase();
  return { md:'text/markdown',json:'application/json',txt:'text/plain',csv:'text/csv',html:'text/html',pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',zip:'application/zip',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation' }[e] || 'application/octet-stream';
}
function fz(b) { if (!b) return ''; if (b < 1024) return b + ' B'; if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'; return (b / 1048576).toFixed(1) + ' MB'; }
function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

// Init on load
window.addEventListener('load', initGsi);
</script>
</body>
</html>`;
}

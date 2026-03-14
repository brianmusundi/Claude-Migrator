/**
 * Claude Migrator — Google Drive Backup Uploader v3
 * 
 * Features:
 * - Shows logged-in Google account with avatar
 * - Switch account button (redirects to Google account chooser)
 * - Accepts ZIP files — extracts client-side via JSZip before uploading
 * - Accepts individual files (Markdown, JSON, etc.)
 * - Creates organized Drive folder structure
 * - Generates shareable Drive folder link to paste back into Claude
 * - Copy-to-clipboard for the folder link
 *
 * SETUP: See README at github.com/brianmusundi/Claude-Migrator
 */

// ============================================================
// BACKEND
// ============================================================

function doGet() {
  return HtmlService.createHtmlOutput(getUploadPage())
    .setTitle('Claude Migration Backup')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getUserInfo() {
  var email = Session.getActiveUser().getEmail();
  return {
    email: email,
    initial: email ? email.charAt(0).toUpperCase() : '?'
  };
}

function getRootFolder() {
  var folderName = 'Claude Migration Backups';
  var folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(folderName);
}

function createSessionFolder() {
  var root = getRootFolder();
  var now = new Date();
  var dateStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH-mm');
  var sessionName = 'Migration — ' + dateStr;
  var sessionFolder = root.createFolder(sessionName);
  return {
    folderId: sessionFolder.getId(),
    folderUrl: sessionFolder.getUrl(),
    folderName: sessionName,
    rootUrl: root.getUrl()
  };
}

function createSubfolder(parentFolderId, subfolderName) {
  var parent = DriveApp.getFolderById(parentFolderId);
  var subfolder = parent.createFolder(subfolderName);
  return { folderId: subfolder.getId(), folderUrl: subfolder.getUrl() };
}

function uploadFile(data) {
  try {
    var folder = DriveApp.getFolderById(data.folderId);
    var decoded = Utilities.base64Decode(data.content);
    var blob = Utilities.newBlob(decoded, data.mimeType, data.fileName);
    var file = folder.createFile(blob);
    return {
      success: true,
      fileName: file.getName(),
      fileUrl: file.getUrl(),
      fileSize: file.getSize()
    };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function shareFolderAnyone(folderId) {
  try {
    var folder = DriveApp.getFolderById(folderId);
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return { success: true, url: folder.getUrl() };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}


// ============================================================
// FRONTEND
// ============================================================

function getUploadPage() {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'DM Sans',-apple-system,sans-serif;background:#0a0a0f;color:#e0e0e8;min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:2rem 1rem}
  .container{max-width:660px;width:100%}

  /* Header */
  .header{text-align:center;margin-bottom:1.5rem}
  .header h1{font-size:1.8rem;font-weight:700;background:linear-gradient(135deg,#e94560,#53a8b6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:0.3rem}
  .header p{color:#888;font-size:0.92rem}

  /* Account bar */
  .account-bar{
    background:#111118;border:1px solid #1a1a2e;border-radius:12px;
    padding:0.8rem 1.2rem;margin-bottom:1rem;
    display:flex;align-items:center;gap:0.8rem;
  }
  .avatar{
    width:36px;height:36px;border-radius:50%;
    background:linear-gradient(135deg,#e94560,#53a8b6);
    display:flex;align-items:center;justify-content:center;
    font-weight:700;font-size:0.95rem;color:#fff;flex-shrink:0;
  }
  .account-info{flex:1;min-width:0}
  .account-info .label{font-size:0.7rem;color:#666;text-transform:uppercase;letter-spacing:0.05em}
  .account-info .email{font-size:0.88rem;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .switch-btn{
    font-family:'DM Sans',sans-serif;font-size:0.78rem;font-weight:600;
    padding:0.4rem 0.9rem;border-radius:8px;border:1px solid #2a2a3e;
    background:transparent;color:#53a8b6;cursor:pointer;
    transition:all 0.15s;white-space:nowrap;
  }
  .switch-btn:hover{background:#53a8b615;border-color:#53a8b6}

  /* Status */
  .status-bar{
    background:#111118;border:1px solid #1a1a2e;border-radius:12px;
    padding:0.8rem 1.2rem;margin-bottom:1.2rem;
    display:flex;align-items:center;gap:0.7rem;
  }
  .dot{width:9px;height:9px;border-radius:50%;background:#53a8b6;flex-shrink:0}
  .dot.pending{background:#f0a500}
  .dot.error{background:#e94560}
  .status-bar .text{font-size:0.84rem;color:#bbb}
  .status-bar a{color:#53a8b6;text-decoration:none;font-weight:500}
  .status-bar a:hover{text-decoration:underline}

  /* Drop zone */
  .drop-zone{
    border:2px dashed #2a2a3e;border-radius:16px;padding:2.5rem 2rem;
    text-align:center;cursor:pointer;transition:all 0.2s;
    margin-bottom:1.2rem;background:#0d0d14;
  }
  .drop-zone:hover,.drop-zone.dragover{border-color:#53a8b6;background:#0f1520}
  .drop-zone .icon{font-size:2.2rem;margin-bottom:0.6rem}
  .drop-zone h3{font-size:1.05rem;font-weight:600;margin-bottom:0.3rem}
  .drop-zone p{font-size:0.82rem;color:#888}
  .zip-note{
    margin-top:0.7rem;font-size:0.78rem;color:#53a8b6;
    background:#53a8b610;padding:0.4rem 0.9rem;border-radius:8px;
    display:inline-block;
  }
  .drop-zone.uploading{pointer-events:none;opacity:0.6}
  input[type="file"]{display:none}

  /* Progress */
  .progress-section{background:#111118;border:1px solid #1a1a2e;border-radius:12px;padding:1rem;margin-bottom:0.8rem;display:none}
  .progress-section.visible{display:block}
  .progress-section h4{font-size:0.82rem;color:#888;margin-bottom:0.5rem}
  .pbar{width:100%;height:5px;background:#1a1a2e;border-radius:3px;overflow:hidden}
  .pbar .fill{height:100%;background:linear-gradient(90deg,#e94560,#53a8b6);border-radius:3px;transition:width 0.3s;width:0%}
  .ptxt{font-family:'JetBrains Mono',monospace;font-size:0.72rem;color:#666;margin-top:0.3rem;text-align:right}

  /* File list */
  .file-list{display:flex;flex-direction:column;gap:0.35rem;margin-bottom:1.2rem;max-height:250px;overflow-y:auto}
  .file-item{
    background:#111118;border:1px solid #1a1a2e;border-radius:8px;
    padding:0.5rem 0.9rem;display:flex;align-items:center;
    gap:0.6rem;font-size:0.8rem;
  }
  .file-item .name{flex:1;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .file-item .size{color:#555;font-family:'JetBrains Mono',monospace;font-size:0.68rem;flex-shrink:0}
  .si{flex-shrink:0}
  .si.done{color:#53a8b6}.si.error{color:#e94560}.si.pending{color:#f0a500}

  /* Summary */
  .summary{background:#111118;border:1px solid #1a1a2e;border-radius:12px;padding:1.4rem;text-align:center;display:none}
  .summary.visible{display:block}
  .summary h3{color:#53a8b6;font-size:1rem;margin-bottom:0.5rem}
  .summary p{font-size:0.84rem;color:#999;line-height:1.5}

  .link-box{
    margin-top:1rem;background:#0a0a0f;border:1px solid #1a1a2e;
    border-radius:10px;padding:0.8rem 1rem;display:flex;align-items:center;gap:0.6rem;
  }
  .link-box input{
    flex:1;background:transparent;border:none;color:#53a8b6;
    font-family:'JetBrains Mono',monospace;font-size:0.78rem;
    outline:none;overflow:hidden;text-overflow:ellipsis;
  }
  .copy-btn{
    font-family:'DM Sans',sans-serif;font-size:0.75rem;font-weight:600;
    padding:0.35rem 0.8rem;border-radius:6px;border:1px solid #53a8b6;
    background:transparent;color:#53a8b6;cursor:pointer;
    transition:all 0.15s;white-space:nowrap;
  }
  .copy-btn:hover{background:#53a8b620}
  .copy-btn.copied{background:#53a8b6;color:#0a0a0f;border-color:#53a8b6}

  .btn-row{display:flex;gap:0.6rem;justify-content:center;margin-top:1rem;flex-wrap:wrap}
  .folder-link,.claude-link{
    display:inline-block;padding:0.55rem 1.2rem;border-radius:8px;
    font-weight:600;font-size:0.85rem;text-decoration:none;transition:opacity 0.2s;
  }
  .folder-link{background:linear-gradient(135deg,#e94560,#53a8b6);color:white}
  .folder-link:hover{opacity:0.85}
  .claude-link{border:1px solid #53a8b6;color:#53a8b6;background:transparent}
  .claude-link:hover{background:#53a8b615}

  .hint{font-size:0.75rem;color:#555;margin-top:0.8rem}
  .footer{margin-top:2rem;text-align:center;font-size:0.73rem;color:#444}
</style>
</head>
<body>
<div class="container">

  <div class="header">
    <h1>Claude Migration Backup</h1>
    <p>Upload your Claude export to Google Drive</p>
  </div>

  <!-- Account Bar -->
  <div class="account-bar" id="accountBar">
    <div class="avatar" id="avatar">?</div>
    <div class="account-info">
      <div class="label">Logged in as</div>
      <div class="email" id="accountEmail">Loading...</div>
    </div>
    <button class="switch-btn" id="switchBtn" onclick="switchAccount()">Switch Account</button>
  </div>

  <!-- Status -->
  <div class="status-bar" id="statusBar">
    <div class="dot pending" id="statusDot"></div>
    <div class="text" id="statusText">Initializing...</div>
  </div>

  <!-- Drop zone -->
  <div class="drop-zone" id="dropZone">
    <div class="icon">📁</div>
    <h3>Drag & drop files here</h3>
    <p>or click to browse</p>
    <div class="zip-note">📦 ZIP files are automatically extracted before uploading</div>
  </div>
  <input type="file" id="fileInput" multiple>

  <!-- Progress -->
  <div class="progress-section" id="progressSection">
    <h4 id="progressLabel">Processing...</h4>
    <div class="pbar"><div class="fill" id="progressFill"></div></div>
    <div class="ptxt" id="progressText">0 / 0</div>
  </div>

  <!-- File list -->
  <div class="file-list" id="fileList"></div>

  <!-- Summary -->
  <div class="summary" id="summary">
    <h3>✅ All files backed up</h3>
    <p id="summaryText"></p>

    <div class="link-box">
      <input type="text" id="folderLinkInput" readonly value="">
      <button class="copy-btn" id="copyBtn" onclick="copyLink()">Copy Link</button>
    </div>
    <div class="hint">📋 Copy this link and paste it back into Claude so it knows where your backup is</div>

    <div class="btn-row">
      <a class="folder-link" id="folderLink" href="#" target="_blank">Open in Drive →</a>
      <a class="claude-link" href="https://claude.ai" target="_blank">Back to Claude ↩</a>
    </div>
  </div>

  <div class="footer">Claude Migrator — Built by St1ng3r254</div>
</div>

<script>
let sessionFolder = null;
let uploadedCount = 0;
let totalFiles = 0;

// Load user info
google.script.run
  .withSuccessHandler(function(user) {
    document.getElementById('accountEmail').textContent = user.email || 'Unknown';
    document.getElementById('avatar').textContent = user.initial || '?';
  })
  .withFailureHandler(function() {
    document.getElementById('accountEmail').textContent = 'Could not load account';
  })
  .getUserInfo();

// Create session folder
google.script.run
  .withSuccessHandler(function(folder) {
    sessionFolder = folder;
    document.getElementById('statusDot').className = 'dot';
    document.getElementById('statusText').innerHTML =
      'Ready — saving to: <a href="' + esc(folder.rootUrl) + '" target="_blank">Claude Migration Backups</a> / ' + esc(folder.folderName);
  })
  .withFailureHandler(function(err) {
    document.getElementById('statusDot').className = 'dot error';
    document.getElementById('statusText').textContent = 'Error: ' + err;
  })
  .createSessionFolder();

// Switch account — redirect to Google's account chooser then back here
function switchAccount() {
  var currentUrl = encodeURIComponent(window.location.href);
  // This prompts Google to show the account picker
  window.top.location.href = 'https://accounts.google.com/AccountChooser?continue=' + currentUrl;
}

// Drop zone
var dropZone = document.getElementById('dropZone');
var fileInput = document.getElementById('fileInput');
dropZone.addEventListener('click', function() { fileInput.click(); });
dropZone.addEventListener('dragover', function(e) { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', function() { dropZone.classList.remove('dragover'); });
dropZone.addEventListener('drop', function(e) { e.preventDefault(); dropZone.classList.remove('dragover'); handleFiles(e.dataTransfer.files); });
fileInput.addEventListener('change', function() { handleFiles(fileInput.files); });

async function handleFiles(files) {
  if (!sessionFolder) { alert('Still initializing — wait a moment.'); return; }
  dropZone.classList.add('uploading');
  var allFiles = [];

  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    if (file.name.endsWith('.zip') || file.type === 'application/zip' || file.type === 'application/x-zip-compressed') {
      showProgress('Extracting ' + file.name + '...', 0, 1);
      try {
        var zip = await JSZip.loadAsync(file);
        var entries = Object.keys(zip.files);
        var extracted = 0;
        for (var j = 0; j < entries.length; j++) {
          var entry = zip.files[entries[j]];
          if (entry.dir) continue;
          var blob = await entry.async('blob');
          var ef = new File([blob], entry.name, { type: guessMime(entry.name) });
          allFiles.push({ file: ef, subfolder: getSubfolder(entry.name) });
          extracted++;
          showProgress('Extracting ' + file.name + '...', extracted, entries.length);
        }
      } catch (err) {
        addFileItem(file.name, 0, 'error', 'ZIP extraction failed: ' + err);
      }
    } else {
      allFiles.push({ file: file, subfolder: null });
    }
  }

  totalFiles += allFiles.length;
  showProgress('Uploading to Google Drive...', 0, allFiles.length);
  var subfolderCache = {};

  for (var k = 0; k < allFiles.length; k++) {
    var item = allFiles[k];
    var targetFolderId = sessionFolder.folderId;
    if (item.subfolder) {
      if (!subfolderCache[item.subfolder]) {
        try {
          var sf = await new Promise(function(resolve, reject) {
            google.script.run.withSuccessHandler(resolve).withFailureHandler(reject)
              .createSubfolder(sessionFolder.folderId, item.subfolder);
          });
          subfolderCache[item.subfolder] = sf.folderId;
        } catch (e) { subfolderCache[item.subfolder] = sessionFolder.folderId; }
      }
      targetFolderId = subfolderCache[item.subfolder];
    }
    await uploadSingleFile(item.file, targetFolderId, k + 1, allFiles.length);
  }

  dropZone.classList.remove('uploading');
  checkComplete();
}

function uploadSingleFile(file, folderId, current, total) {
  return new Promise(function(resolve) {
    var itemEl = addFileItem(file.name, file.size, 'pending', '');
    var reader = new FileReader();
    reader.onload = function(e) {
      var base64 = e.target.result.split(',')[1];
      google.script.run
        .withSuccessHandler(function(result) {
          setFileStatus(itemEl, result.success ? 'done' : 'error', result.success ? '✅' : '❌');
          uploadedCount++;
          showProgress('Uploading to Google Drive...', uploadedCount, total);
          resolve();
        })
        .withFailureHandler(function() {
          setFileStatus(itemEl, 'error', '❌');
          uploadedCount++;
          showProgress('Uploading to Google Drive...', uploadedCount, total);
          resolve();
        })
        .uploadFile({
          fileName: file.name.split('/').pop(),
          mimeType: file.type || 'application/octet-stream',
          content: base64,
          folderId: folderId
        });
    };
    reader.readAsDataURL(file);
  });
}

function checkComplete() {
  if (uploadedCount >= totalFiles && totalFiles > 0) {
    document.getElementById('progressSection').classList.remove('visible');
    var summary = document.getElementById('summary');
    summary.classList.add('visible');
    document.getElementById('summaryText').textContent =
      uploadedCount + ' file(s) saved to "' + sessionFolder.folderName + '"';
    document.getElementById('folderLinkInput').value = sessionFolder.folderUrl;
    document.getElementById('folderLink').href = sessionFolder.folderUrl;
  }
}

function copyLink() {
  var input = document.getElementById('folderLinkInput');
  input.select();
  document.execCommand('copy');
  var btn = document.getElementById('copyBtn');
  btn.textContent = 'Copied!';
  btn.classList.add('copied');
  setTimeout(function() { btn.textContent = 'Copy Link'; btn.classList.remove('copied'); }, 2000);
}

function getSubfolder(entryName) {
  var parts = entryName.split('/');
  return parts.length > 1 ? parts[0] : null;
}

function guessMime(name) {
  var ext = name.split('.').pop().toLowerCase();
  return {
    md:'text/markdown', json:'application/json', txt:'text/plain',
    csv:'text/csv', html:'text/html', pdf:'application/pdf',
    png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg',
    zip:'application/zip',
    docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  }[ext] || 'application/octet-stream';
}

function showProgress(label, current, total) {
  var s = document.getElementById('progressSection'); s.classList.add('visible');
  document.getElementById('progressLabel').textContent = label;
  document.getElementById('progressFill').style.width = (total > 0 ? (current/total*100) : 0) + '%';
  document.getElementById('progressText').textContent = current + ' / ' + total;
}

function addFileItem(name, size, status, err) {
  var item = document.createElement('div'); item.className = 'file-item';
  var icon = status==='done'?'✅':status==='error'?'❌':'⏳';
  var cls = status==='done'?'done':status==='error'?'error':'pending';
  item.innerHTML = '<span class="si '+cls+'">'+icon+'</span>'
    +'<span class="name">'+esc(name.split('/').pop())+(err?' — '+esc(err):'')+'</span>'
    +'<span class="size">'+fmtSize(size)+'</span>';
  document.getElementById('fileList').appendChild(item);
  return item;
}

function setFileStatus(el, status, icon) {
  var si = el.querySelector('.si'); si.textContent = icon; si.className = 'si ' + status;
}

function fmtSize(b) {
  if(!b) return '';
  if(b<1024) return b+' B';
  if(b<1048576) return (b/1024).toFixed(1)+' KB';
  return (b/1048576).toFixed(1)+' MB';
}

function esc(s) {
  var d = document.createElement('div'); d.textContent = s; return d.innerHTML;
}
</script>
</body>
</html>`;
}

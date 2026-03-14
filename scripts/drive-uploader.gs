/**
 * Claude Migrator — Google Drive Backup Uploader
 * 
 * A tiny Google Apps Script web app that:
 * 1. Creates a "Claude Migration Backups" folder in the user's Drive
 * 2. Creates a date-stamped subfolder for each migration
 * 3. Provides a drag-and-drop upload page
 * 4. Returns the folder link
 *
 * SETUP (one-time, 2 minutes):
 * 1. Go to https://script.google.com
 * 2. Click "New Project"
 * 3. Delete the default code and paste this entire file
 * 4. Click "Deploy" → "New deployment"
 * 5. Select type: "Web app"
 * 6. Set "Execute as": "Me"
 * 7. Set "Who has access": "Anyone in your organization" (or "Anyone" for personal accounts)
 * 8. Click "Deploy"
 * 9. Authorize when prompted (one-time Google permission)
 * 10. Copy the deployment URL — that's your upload link
 *
 * Staff just open the URL, drag files, done.
 */

// ============================================================
// BACKEND — Google Apps Script server-side functions
// ============================================================

/**
 * Serves the HTML upload page when the web app URL is opened.
 */
function doGet() {
  return HtmlService.createHtmlOutput(getUploadPage())
    .setTitle('Claude Migration Backup')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Gets or creates the root backup folder.
 */
function getRootFolder() {
  var folderName = 'Claude Migration Backups';
  var folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(folderName);
}

/**
 * Creates a date-stamped subfolder for this migration session.
 */
function createSessionFolder() {
  var root = getRootFolder();
  var now = new Date();
  var dateStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
  var sessionName = 'Migration — ' + dateStr;
  var sessionFolder = root.createFolder(sessionName);
  return {
    folderId: sessionFolder.getId(),
    folderUrl: sessionFolder.getUrl(),
    folderName: sessionName,
    rootUrl: root.getUrl()
  };
}

/**
 * Receives a file upload from the client.
 * @param {Object} data - { fileName, mimeType, content (base64), folderId }
 */
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
    return {
      success: false,
      error: e.toString()
    };
  }
}

/**
 * Lists files in a session folder.
 * @param {string} folderId
 */
function listFiles(folderId) {
  var folder = DriveApp.getFolderById(folderId);
  var files = folder.getFiles();
  var result = [];
  while (files.hasNext()) {
    var f = files.next();
    result.push({
      name: f.getName(),
      size: f.getSize(),
      url: f.getUrl()
    });
  }
  return result;
}


// ============================================================
// FRONTEND — HTML/CSS/JS upload page
// ============================================================

function getUploadPage() {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'DM Sans', -apple-system, sans-serif;
    background: #0a0a0f;
    color: #e0e0e8;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2rem 1rem;
  }

  .container {
    max-width: 640px;
    width: 100%;
  }

  .header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .header h1 {
    font-size: 1.8rem;
    font-weight: 700;
    background: linear-gradient(135deg, #e94560, #53a8b6);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-bottom: 0.4rem;
  }

  .header p {
    color: #888;
    font-size: 0.95rem;
  }

  .status-bar {
    background: #111118;
    border: 1px solid #1a1a2e;
    border-radius: 12px;
    padding: 1rem 1.4rem;
    margin-bottom: 1.5rem;
    display: flex;
    align-items: center;
    gap: 0.8rem;
  }

  .status-bar .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #53a8b6;
    flex-shrink: 0;
  }

  .status-bar .dot.pending { background: #f0a500; }
  .status-bar .dot.error { background: #e94560; }

  .status-bar .text {
    font-size: 0.88rem;
    color: #bbb;
  }

  .status-bar a {
    color: #53a8b6;
    text-decoration: none;
    font-weight: 500;
  }

  .status-bar a:hover { text-decoration: underline; }

  .drop-zone {
    border: 2px dashed #2a2a3e;
    border-radius: 16px;
    padding: 3rem 2rem;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s;
    margin-bottom: 1.5rem;
    background: #0d0d14;
  }

  .drop-zone:hover, .drop-zone.dragover {
    border-color: #53a8b6;
    background: #0f1520;
  }

  .drop-zone .icon {
    font-size: 2.5rem;
    margin-bottom: 0.8rem;
  }

  .drop-zone h3 {
    font-size: 1.1rem;
    font-weight: 600;
    margin-bottom: 0.4rem;
  }

  .drop-zone p {
    font-size: 0.85rem;
    color: #888;
  }

  .drop-zone.uploading {
    pointer-events: none;
    opacity: 0.7;
  }

  input[type="file"] { display: none; }

  .file-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
  }

  .file-item {
    background: #111118;
    border: 1px solid #1a1a2e;
    border-radius: 10px;
    padding: 0.8rem 1.2rem;
    display: flex;
    align-items: center;
    gap: 0.8rem;
    font-size: 0.85rem;
  }

  .file-item .name {
    flex: 1;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .file-item .size {
    color: #666;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
    flex-shrink: 0;
  }

  .file-item .status-icon { flex-shrink: 0; }
  .file-item .status-icon.done { color: #53a8b6; }
  .file-item .status-icon.error { color: #e94560; }
  .file-item .status-icon.pending { color: #f0a500; }

  .progress-bar {
    width: 100%;
    height: 3px;
    background: #1a1a2e;
    border-radius: 2px;
    margin-top: 0.4rem;
    overflow: hidden;
  }

  .progress-bar .fill {
    height: 100%;
    background: linear-gradient(90deg, #e94560, #53a8b6);
    border-radius: 2px;
    transition: width 0.3s;
  }

  .summary {
    background: #111118;
    border: 1px solid #1a1a2e;
    border-radius: 12px;
    padding: 1.4rem;
    text-align: center;
    display: none;
  }

  .summary.visible { display: block; }

  .summary h3 {
    color: #53a8b6;
    font-size: 1rem;
    margin-bottom: 0.6rem;
  }

  .summary p {
    font-size: 0.85rem;
    color: #999;
    line-height: 1.5;
  }

  .summary .folder-link {
    display: inline-block;
    margin-top: 0.8rem;
    padding: 0.6rem 1.4rem;
    background: linear-gradient(135deg, #e94560, #53a8b6);
    color: white;
    text-decoration: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.9rem;
    transition: opacity 0.2s;
  }

  .summary .folder-link:hover { opacity: 0.85; }

  .footer {
    margin-top: 2rem;
    text-align: center;
    font-size: 0.75rem;
    color: #444;
  }
</style>
</head>
<body>
<div class="container">

  <div class="header">
    <h1>Claude Migration Backup</h1>
    <p>Drop your exported conversation files here to save them to Google Drive</p>
  </div>

  <div class="status-bar" id="statusBar">
    <div class="dot pending" id="statusDot"></div>
    <div class="text" id="statusText">Initializing — creating backup folder...</div>
  </div>

  <div class="drop-zone" id="dropZone">
    <div class="icon">📁</div>
    <h3>Drag & drop files here</h3>
    <p>or click to browse — accepts any file type</p>
  </div>
  <input type="file" id="fileInput" multiple>

  <div class="file-list" id="fileList"></div>

  <div class="summary" id="summary">
    <h3>✅ All files backed up</h3>
    <p id="summaryText"></p>
    <a class="folder-link" id="folderLink" href="#" target="_blank">Open in Google Drive →</a>
  </div>

  <div class="footer">
    Claude Migrator — Built by St1ng3r254
  </div>

</div>

<script>
  let sessionFolder = null;
  let uploadedCount = 0;
  let totalFiles = 0;

  // Initialize — create session folder on load
  google.script.run
    .withSuccessHandler(function(folder) {
      sessionFolder = folder;
      document.getElementById('statusDot').className = 'dot';
      document.getElementById('statusText').innerHTML =
        'Ready — backup folder: <a href="' + folder.rootUrl + '" target="_blank">Claude Migration Backups</a> / ' + folder.folderName;
    })
    .withFailureHandler(function(err) {
      document.getElementById('statusDot').className = 'dot error';
      document.getElementById('statusText').textContent = 'Error creating folder: ' + err;
    })
    .createSessionFolder();

  // Drop zone events
  var dropZone = document.getElementById('dropZone');
  var fileInput = document.getElementById('fileInput');

  dropZone.addEventListener('click', function() { fileInput.click(); });

  dropZone.addEventListener('dragover', function(e) {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', function() {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', function(e) {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
  });

  fileInput.addEventListener('change', function() {
    handleFiles(fileInput.files);
  });

  function handleFiles(files) {
    if (!sessionFolder) {
      alert('Still initializing — please wait a moment and try again.');
      return;
    }

    totalFiles += files.length;
    dropZone.classList.add('uploading');

    for (var i = 0; i < files.length; i++) {
      uploadFile(files[i]);
    }
  }

  function uploadFile(file) {
    var item = document.createElement('div');
    item.className = 'file-item';
    item.innerHTML =
      '<span class="status-icon pending">⏳</span>' +
      '<span class="name">' + escapeHtml(file.name) + '</span>' +
      '<span class="size">' + formatSize(file.size) + '</span>';
    document.getElementById('fileList').appendChild(item);

    var reader = new FileReader();
    reader.onload = function(e) {
      var base64 = e.target.result.split(',')[1];
      google.script.run
        .withSuccessHandler(function(result) {
          if (result.success) {
            item.querySelector('.status-icon').textContent = '✅';
            item.querySelector('.status-icon').className = 'status-icon done';
          } else {
            item.querySelector('.status-icon').textContent = '❌';
            item.querySelector('.status-icon').className = 'status-icon error';
            item.querySelector('.name').textContent += ' — ' + result.error;
          }
          uploadedCount++;
          checkComplete();
        })
        .withFailureHandler(function(err) {
          item.querySelector('.status-icon').textContent = '❌';
          item.querySelector('.status-icon').className = 'status-icon error';
          uploadedCount++;
          checkComplete();
        })
        .uploadFile({
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          content: base64,
          folderId: sessionFolder.folderId
        });
    };
    reader.readAsDataURL(file);
  }

  function checkComplete() {
    if (uploadedCount >= totalFiles) {
      dropZone.classList.remove('uploading');
      var summary = document.getElementById('summary');
      summary.classList.add('visible');
      document.getElementById('summaryText').textContent =
        uploadedCount + ' file(s) saved to Google Drive in folder "' + sessionFolder.folderName + '"';
      document.getElementById('folderLink').href = sessionFolder.folderUrl;
    }
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  function escapeHtml(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }
</script>
</body>
</html>`;
}

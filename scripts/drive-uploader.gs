/**
 * Claude Migrator — Google Drive Backup Uploader v5
 *
 * DEPLOY SETTINGS:
 *   Execute as: "User accessing the web app"
 *   Who has access: "Anyone with Google account"
 *
 * Each person who opens the link authorizes with their own Google
 * account. Files go to THEIR Drive, not the deployer's.
 *
 * To switch accounts: open in incognito/private window or a
 * different browser profile. Google's auth is sticky per session.
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
    email: email || 'Unknown account',
    initial: email ? email.charAt(0).toUpperCase() : '?'
  };
}

function getRootFolder() {
  var name = 'Claude Migration Backups';
  var it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}

function createSessionFolder() {
  var root = getRootFolder();
  var d = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH-mm');
  var f = root.createFolder('Migration — ' + d);
  return { folderId: f.getId(), folderUrl: f.getUrl(), folderName: 'Migration — ' + d, rootUrl: root.getUrl() };
}

function createSubfolder(parentId, name) {
  return { folderId: DriveApp.getFolderById(parentId).createFolder(name).getId() };
}

function uploadFile(data) {
  try {
    var f = DriveApp.getFolderById(data.folderId);
    var blob = Utilities.newBlob(Utilities.base64Decode(data.content), data.mimeType, data.fileName);
    var file = f.createFile(blob);
    return { success: true, fileName: file.getName(), fileSize: file.getSize() };
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
.c{max-width:660px;width:100%}

.hd{text-align:center;margin-bottom:1.5rem}
.hd h1{font-size:1.8rem;font-weight:700;background:linear-gradient(135deg,#e94560,#53a8b6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:0.3rem}
.hd p{color:#888;font-size:0.92rem}

/* Account */
.acct{background:#111118;border:1px solid #1a1a2e;border-radius:12px;padding:0.9rem 1.2rem;margin-bottom:1rem;display:flex;align-items:center;gap:0.8rem}
.av{width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#e94560,#53a8b6);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1rem;color:#fff;flex-shrink:0}
.ai{flex:1;min-width:0}
.ai .lb{font-size:0.68rem;color:#666;text-transform:uppercase;letter-spacing:0.05em}
.ai .em{font-size:0.9rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* Switch modal */
.sw-btn{font-family:'DM Sans',sans-serif;font-size:0.78rem;font-weight:600;padding:0.4rem 0.9rem;border-radius:8px;border:1px solid #2a2a3e;background:transparent;color:#53a8b6;cursor:pointer;transition:all 0.15s;white-space:nowrap}
.sw-btn:hover{background:#53a8b615;border-color:#53a8b6}

.modal-bg{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);display:none;align-items:center;justify-content:center;z-index:100;padding:1rem}
.modal-bg.open{display:flex}
.modal{background:#111118;border:1px solid #1a1a2e;border-radius:16px;padding:1.8rem;max-width:480px;width:100%}
.modal h3{font-size:1.05rem;font-weight:600;margin-bottom:0.8rem;color:#e0e0e8}
.modal p{font-size:0.85rem;color:#999;line-height:1.6;margin-bottom:0.6rem}
.modal .step{background:#0a0a0f;border:1px solid #1a1a2e;border-radius:10px;padding:0.7rem 1rem;margin-bottom:0.5rem;font-size:0.84rem;display:flex;gap:0.6rem;align-items:flex-start}
.modal .step .num{color:#53a8b6;font-weight:700;flex-shrink:0}
.modal .step .txt{color:#ccc}
.modal .step .txt strong{color:#e0e0e8}
.modal .step .txt code{background:#1a1a2e;padding:0.15rem 0.4rem;border-radius:4px;font-family:'JetBrains Mono',monospace;font-size:0.78rem;color:#53a8b6}
.modal .close-btn{margin-top:1rem;width:100%;padding:0.6rem;border-radius:8px;border:none;background:linear-gradient(135deg,#e94560,#53a8b6);color:white;font-family:'DM Sans',sans-serif;font-weight:600;font-size:0.9rem;cursor:pointer}
.modal .close-btn:hover{opacity:0.85}

/* Status */
.sb{background:#111118;border:1px solid #1a1a2e;border-radius:12px;padding:0.8rem 1.2rem;margin-bottom:1.2rem;display:flex;align-items:center;gap:0.7rem}
.dt{width:9px;height:9px;border-radius:50%;background:#53a8b6;flex-shrink:0}
.dt.pe{background:#f0a500}.dt.er{background:#e94560}
.sb .tx{font-size:0.84rem;color:#bbb}
.sb a{color:#53a8b6;text-decoration:none;font-weight:500}

/* Drop */
.dz{border:2px dashed #2a2a3e;border-radius:16px;padding:2.5rem 2rem;text-align:center;cursor:pointer;transition:all 0.2s;margin-bottom:1.2rem;background:#0d0d14}
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

/* Files */
.fl-list{display:flex;flex-direction:column;gap:0.35rem;margin-bottom:1.2rem;max-height:250px;overflow-y:auto}
.fi{background:#111118;border:1px solid #1a1a2e;border-radius:8px;padding:0.5rem 0.9rem;display:flex;align-items:center;gap:0.6rem;font-size:0.8rem}
.fi .nm{flex:1;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fi .sz{color:#555;font-family:'JetBrains Mono',monospace;font-size:0.68rem;flex-shrink:0}
.si{flex-shrink:0}.si.ok{color:#53a8b6}.si.er{color:#e94560}.si.wa{color:#f0a500}

/* Summary */
.su{background:#111118;border:1px solid #1a1a2e;border-radius:12px;padding:1.4rem;text-align:center;display:none}
.su.v{display:block}
.su h3{color:#53a8b6;font-size:1rem;margin-bottom:0.5rem}
.su p{font-size:0.84rem;color:#999;line-height:1.5}
.lb-box{margin-top:1rem;background:#0a0a0f;border:1px solid #1a1a2e;border-radius:10px;padding:0.8rem 1rem;display:flex;align-items:center;gap:0.6rem}
.lb-box input{flex:1;background:transparent;border:none;color:#53a8b6;font-family:'JetBrains Mono',monospace;font-size:0.78rem;outline:none;overflow:hidden;text-overflow:ellipsis}
.cp{font-family:'DM Sans',sans-serif;font-size:0.75rem;font-weight:600;padding:0.35rem 0.8rem;border-radius:6px;border:1px solid #53a8b6;background:transparent;color:#53a8b6;cursor:pointer;transition:all 0.15s;white-space:nowrap}
.cp:hover{background:#53a8b620}
.cp.ok{background:#53a8b6;color:#0a0a0f}
.hint{font-size:0.75rem;color:#555;margin-top:0.8rem}
.br{display:flex;gap:0.6rem;justify-content:center;margin-top:1rem;flex-wrap:wrap}
.br a{display:inline-block;padding:0.55rem 1.2rem;border-radius:8px;font-weight:600;font-size:0.85rem;text-decoration:none;transition:opacity 0.2s}
.br .dr{background:linear-gradient(135deg,#e94560,#53a8b6);color:white}
.br .cl{border:1px solid #53a8b6;color:#53a8b6}
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

  <div class="acct">
    <div class="av" id="av">?</div>
    <div class="ai">
      <div class="lb">Uploading to Drive for</div>
      <div class="em" id="em">Loading...</div>
    </div>
    <button class="sw-btn" onclick="openModal()">Switch Account</button>
  </div>

  <!-- Switch Account Modal -->
  <div class="modal-bg" id="modal">
    <div class="modal">
      <h3>Switch Google Account</h3>
      <p>Google locks your login for this session. To switch to a different account:</p>
      <div class="step"><span class="num">1</span><span class="txt"><strong>Copy this page's URL</strong> from your browser address bar</span></div>
      <div class="step"><span class="num">2</span><span class="txt">Open an <strong>Incognito / Private window</strong><br><code>Ctrl+Shift+N</code> (Chrome/Edge) or <code>Cmd+Shift+P</code> (Safari/Firefox)</span></div>
      <div class="step"><span class="num">3</span><span class="txt"><strong>Paste the URL</strong> in the incognito window</span></div>
      <div class="step"><span class="num">4</span><span class="txt">Google will ask you to <strong>sign in</strong> — pick the account you want to upload to</span></div>
      <button class="close-btn" onclick="closeModal()">Got it</button>
    </div>
  </div>

  <div class="sb">
    <div class="dt pe" id="sd"></div>
    <div class="tx" id="st">Initializing...</div>
  </div>

  <div class="dz" id="dz">
    <div class="icon">📁</div>
    <h3>Drag & drop files here</h3>
    <p>or click to browse</p>
    <div class="zn">📦 ZIP files are automatically extracted before uploading</div>
  </div>
  <input type="file" id="fi" multiple>

  <div class="ps" id="ps">
    <h4 id="pl">Processing...</h4>
    <div class="pb"><div class="fl" id="pf"></div></div>
    <div class="pt" id="px">0 / 0</div>
  </div>

  <div class="fl-list" id="flist"></div>

  <div class="su" id="su">
    <h3>✅ All files backed up</h3>
    <p id="sut"></p>
    <div class="lb-box">
      <input type="text" id="fli" readonly>
      <button class="cp" id="cpb" onclick="cpLink()">Copy Link</button>
    </div>
    <div class="hint">📋 Paste this link back into Claude so it knows where your backup is stored</div>
    <div class="br">
      <a class="dr" id="flk" href="#" target="_blank">Open in Drive →</a>
      <a class="cl" href="https://claude.ai" target="_blank">Back to Claude ↩</a>
    </div>
  </div>

  <div class="ft">Claude Migrator — Built by St1ng3r254</div>
</div>

<script>
let sf=null,uc=0,tf=0;

function openModal(){document.getElementById('modal').classList.add('open')}
function closeModal(){document.getElementById('modal').classList.remove('open')}
document.getElementById('modal').addEventListener('click',function(e){if(e.target===this)closeModal()});

google.script.run.withSuccessHandler(function(u){
  document.getElementById('em').textContent=u.email;
  document.getElementById('av').textContent=u.initial;
}).withFailureHandler(function(){
  document.getElementById('em').textContent='Could not detect';
}).getUserInfo();

google.script.run.withSuccessHandler(function(f){
  sf=f;
  document.getElementById('sd').className='dt';
  document.getElementById('st').innerHTML='Ready — saving to <a href="'+esc(f.rootUrl)+'" target="_blank">'+esc(f.folderName)+'</a>';
}).withFailureHandler(function(e){
  document.getElementById('sd').className='dt er';
  document.getElementById('st').textContent='Error: '+e;
}).createSessionFolder();

var dz=document.getElementById('dz'),fi=document.getElementById('fi');
dz.addEventListener('click',function(){fi.click()});
dz.addEventListener('dragover',function(e){e.preventDefault();dz.classList.add('dragover')});
dz.addEventListener('dragleave',function(){dz.classList.remove('dragover')});
dz.addEventListener('drop',function(e){e.preventDefault();dz.classList.remove('dragover');go(e.dataTransfer.files)});
fi.addEventListener('change',function(){go(fi.files)});

async function go(files){
  if(!sf){alert('Still initializing.');return}
  dz.classList.add('up');
  var all=[];
  for(var i=0;i<files.length;i++){
    var f=files[i];
    if(f.name.endsWith('.zip')||f.type==='application/zip'||f.type==='application/x-zip-compressed'){
      prog('Extracting '+f.name+'...',0,1);
      try{
        var z=await JSZip.loadAsync(f),ek=Object.keys(z.files),ex=0;
        for(var j=0;j<ek.length;j++){
          var en=z.files[ek[j]];
          if(en.dir)continue;
          var bl=await en.async('blob');
          all.push({file:new File([bl],en.name,{type:mime(en.name)}),sub:subf(en.name)});
          ex++;prog('Extracting '+f.name+'...',ex,ek.length);
        }
      }catch(er){addF(f.name,0,'er','ZIP failed: '+er)}
    }else{all.push({file:f,sub:null})}
  }
  tf+=all.length;prog('Uploading to Drive...',0,all.length);
  var cache={};
  for(var k=0;k<all.length;k++){
    var it=all[k],tid=sf.folderId;
    if(it.sub){
      if(!cache[it.sub]){
        try{var r=await new Promise(function(ok,no){google.script.run.withSuccessHandler(ok).withFailureHandler(no).createSubfolder(sf.folderId,it.sub)});cache[it.sub]=r.folderId}
        catch(e){cache[it.sub]=sf.folderId}
      }
      tid=cache[it.sub];
    }
    await up1(it.file,tid,k+1,all.length);
  }
  dz.classList.remove('up');done();
}

function up1(file,fid,cur,tot){
  return new Promise(function(res){
    var el=addF(file.name,file.size,'wa','');
    var rd=new FileReader();
    rd.onload=function(e){
      google.script.run.withSuccessHandler(function(r){
        setS(el,r.success?'ok':'er',r.success?'✅':'❌');
        uc++;prog('Uploading to Drive...',uc,tot);res();
      }).withFailureHandler(function(){
        setS(el,'er','❌');uc++;prog('Uploading...',uc,tot);res();
      }).uploadFile({fileName:file.name.split('/').pop(),mimeType:file.type||'application/octet-stream',content:e.target.result.split(',')[1],folderId:fid});
    };rd.readAsDataURL(file);
  });
}

function done(){
  if(uc>=tf&&tf>0){
    document.getElementById('ps').classList.remove('v');
    document.getElementById('su').classList.add('v');
    document.getElementById('sut').textContent=uc+' file(s) saved to "'+sf.folderName+'"';
    document.getElementById('fli').value=sf.folderUrl;
    document.getElementById('flk').href=sf.folderUrl;
  }
}

function cpLink(){
  var inp=document.getElementById('fli');inp.select();inp.setSelectionRange(0,99999);
  navigator.clipboard.writeText(inp.value).then(function(){
    var b=document.getElementById('cpb');b.textContent='Copied!';b.classList.add('ok');
    setTimeout(function(){b.textContent='Copy Link';b.classList.remove('ok')},2000);
  }).catch(function(){document.execCommand('copy')});
}

function subf(n){var p=n.split('/');return p.length>1?p[0]:null}
function mime(n){var e=n.split('.').pop().toLowerCase();return{md:'text/markdown',json:'application/json',txt:'text/plain',csv:'text/csv',html:'text/html',pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',zip:'application/zip',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation'}[e]||'application/octet-stream'}
function prog(l,c,t){document.getElementById('ps').classList.add('v');document.getElementById('pl').textContent=l;document.getElementById('pf').style.width=(t>0?(c/t*100):0)+'%';document.getElementById('px').textContent=c+' / '+t}
function addF(name,size,st,err){var d=document.createElement('div');d.className='fi';d.innerHTML='<span class="si '+st+'">'+(st==='ok'?'✅':st==='er'?'❌':'⏳')+'</span><span class="nm">'+esc(name.split('/').pop())+(err?' — '+esc(err):'')+'</span><span class="sz">'+fz(size)+'</span>';document.getElementById('flist').appendChild(d);return d}
function setS(el,s,i){var x=el.querySelector('.si');x.textContent=i;x.className='si '+s}
function fz(b){if(!b)return'';if(b<1024)return b+' B';if(b<1048576)return(b/1024).toFixed(1)+' KB';return(b/1048576).toFixed(1)+' MB'}
function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML}
</script>
</body>
</html>`;
}

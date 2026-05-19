import { Router } from "express";

const router = Router();

router.get("/upload", (_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Route Picker — Upload Routes</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #1a1a2e;
      color: #e0e0e0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #16213e;
      border: 1px solid #0f3460;
      border-radius: 16px;
      padding: 40px;
      width: 100%;
      max-width: 560px;
    }
    h1 { font-size: 22px; font-weight: 700; margin-bottom: 6px; color: #fff; }
    .subtitle { font-size: 14px; color: #888; margin-bottom: 32px; }
    .drop-zone {
      border: 2px dashed #0f3460;
      border-radius: 12px;
      padding: 48px 24px;
      text-align: center;
      cursor: pointer;
      transition: border-color 0.2s, background 0.2s;
      position: relative;
    }
    .drop-zone.dragover {
      border-color: #5865f2;
      background: rgba(88,101,242,0.08);
    }
    .drop-zone input[type="file"] {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      opacity: 0;
      cursor: pointer;
    }
    .drop-icon { font-size: 40px; margin-bottom: 12px; }
    .drop-label { font-size: 15px; color: #aaa; }
    .drop-label span { color: #5865f2; font-weight: 600; }
    .file-name {
      margin-top: 12px;
      font-size: 13px;
      color: #5865f2;
      font-weight: 500;
      min-height: 18px;
    }
    .btn {
      margin-top: 24px;
      width: 100%;
      padding: 14px;
      background: #5865f2;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn:hover { background: #4752c4; }
    .btn:disabled { background: #3a3a5c; cursor: not-allowed; color: #666; }
    .result {
      margin-top: 20px;
      padding: 14px 16px;
      border-radius: 8px;
      font-size: 14px;
      display: none;
    }
    .result.success { background: rgba(87,242,135,0.1); border: 1px solid rgba(87,242,135,0.3); color: #57f287; }
    .result.error   { background: rgba(237,66,69,0.1);  border: 1px solid rgba(237,66,69,0.3);  color: #ed4245; }
    .columns {
      margin-top: 28px;
      border-top: 1px solid #0f3460;
      padding-top: 24px;
    }
    .columns h3 { font-size: 13px; font-weight: 600; color: #aaa; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 12px; }
    .col-list { display: flex; flex-wrap: wrap; gap: 8px; }
    .col-tag {
      font-size: 12px;
      padding: 3px 10px;
      border-radius: 20px;
      font-family: monospace;
    }
    .col-tag.required { background: rgba(88,101,242,0.2); border: 1px solid rgba(88,101,242,0.4); color: #a5b4fc; }
    .col-tag.optional { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #888; }
    .note { margin-top: 12px; font-size: 12px; color: #666; }
    .actions { margin-top: 20px; display: flex; gap: 10px; }
    .btn-sm {
      flex: 1;
      padding: 10px;
      border: 1px solid #0f3460;
      background: transparent;
      color: #888;
      border-radius: 8px;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-sm:hover { background: rgba(255,255,255,0.05); color: #ccc; }
    .btn-sm.danger:hover { border-color: #ed4245; color: #ed4245; }
    #routeCount { color: #888; font-size: 13px; margin-top: 8px; min-height: 18px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>✈️ Route Picker</h1>
    <p class="subtitle">Upload your routes CSV — extra columns are ignored automatically.</p>

    <div class="drop-zone" id="dropZone">
      <input type="file" id="fileInput" accept=".csv,text/csv" />
      <div class="drop-icon">📂</div>
      <p class="drop-label">Drag &amp; drop your CSV here, or <span>browse</span></p>
      <p class="file-name" id="fileName"></p>
    </div>

    <button class="btn" id="uploadBtn" disabled>Upload Routes</button>
    <div class="result" id="result"></div>
    <div id="routeCount"></div>

    <div class="actions">
      <button class="btn-sm" id="viewBtn">View routes (GET)</button>
      <button class="btn-sm danger" id="deleteBtn">Delete all routes</button>
    </div>

    <div class="columns">
      <h3>Recognised CSV columns</h3>
      <div class="col-list">
        <span class="col-tag required">origin</span>
        <span class="col-tag required">destination</span>
        <span class="col-tag optional">origin_city</span>
        <span class="col-tag optional">origin_flag</span>
        <span class="col-tag optional">destination_city</span>
        <span class="col-tag optional">destination_flag</span>
        <span class="col-tag optional">airline</span>
        <span class="col-tag optional">airline_emoji</span>
        <span class="col-tag optional">flight_number</span>
        <span class="col-tag optional">aircraft</span>
        <span class="col-tag optional">duration</span>
      </div>
      <p class="note">Blue = required &nbsp;·&nbsp; Grey = optional &nbsp;·&nbsp; All other columns are silently ignored.</p>
    </div>
  </div>

  <script>
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const fileName  = document.getElementById('fileName');
    const uploadBtn = document.getElementById('uploadBtn');
    const result    = document.getElementById('result');
    const routeCount = document.getElementById('routeCount');

    let selectedFile = null;

    fileInput.addEventListener('change', () => {
      selectedFile = fileInput.files[0] || null;
      fileName.textContent = selectedFile ? selectedFile.name : '';
      uploadBtn.disabled = !selectedFile;
    });

    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file) {
        selectedFile = file;
        fileName.textContent = file.name;
        uploadBtn.disabled = false;
      }
    });

    uploadBtn.addEventListener('click', async () => {
      if (!selectedFile) return;
      uploadBtn.disabled = true;
      uploadBtn.textContent = 'Uploading…';
      result.style.display = 'none';

      const form = new FormData();
      form.append('file', selectedFile);

      try {
        const res = await fetch('/api/routes/upload', { method: 'POST', body: form });
        const data = await res.json();
        result.style.display = 'block';
        if (res.ok) {
          result.className = 'result success';
          result.textContent = data.message;
          fetchCount();
        } else {
          result.className = 'result error';
          result.textContent = data.error || 'Upload failed.';
        }
      } catch (e) {
        result.style.display = 'block';
        result.className = 'result error';
        result.textContent = 'Network error — is the server running?';
      } finally {
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Upload Routes';
      }
    });

    document.getElementById('viewBtn').addEventListener('click', () => {
      window.open('/api/routes', '_blank');
    });

    document.getElementById('deleteBtn').addEventListener('click', async () => {
      if (!confirm('Delete ALL routes from the database? This cannot be undone.')) return;
      const res = await fetch('/api/routes', { method: 'DELETE' });
      const data = await res.json();
      result.style.display = 'block';
      result.className = res.ok ? 'result success' : 'result error';
      result.textContent = data.message || data.error;
      if (res.ok) fetchCount();
    });

    async function fetchCount() {
      try {
        const res = await fetch('/api/routes');
        const data = await res.json();
        routeCount.textContent = 'Routes in database: ' + (data.total ?? '?');
      } catch {}
    }

    fetchCount();
  </script>
</body>
</html>`);
});

export default router;

// require('dotenv').config(); // Removed - API keys now hardcoded
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());


// ✅ File upload validation (Vercel-safe)

const upload = multer({

  storage: multer.memoryStorage(), // Use memory storage for Vercel

  fileFilter: (req, file, cb) => {

    if (!file.mimetype.startsWith('image/')) {

      return cb(new Error('Only image files are allowed'));

    }

    cb(null, true);

  },

  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit

});


/* ================================

   🔎 Keyword Image Search

================================ */

app.post('/keyword-search', async (req, res) => {

  try {

    const { keyword } = req.body;

    if (!keyword) {

      return res.status(400).json({ success: false, error: "Keyword required" });

    }

    const results = await googleImageKeywordSearch(keyword);

    res.json({

      success: true,

      results

    });

  } catch (error) {

    res.status(500).json({ success: false, error: error.message });

  }

});


// 🔥 MAIN ENDPOINT: ImgBB → Google Lens

app.post('/guru-scan', upload.single('image'), async (req, res) => {

  try {

    console.log('🎯 Guru photo scanning...');
    const imageBuffer = req.file.buffer; // Use buffer instead of path for memory storage
    const originalName = req.file.originalname || 'upload';
    console.log('📤 ImgBB upload...');
    const imgbbUrl = await uploadToImgBBFromBuffer(imageBuffer, originalName);
    console.log('🔍 Searching...');
    const lensResults = await googleLensSearch(imgbbUrl);

    // 📝 Simplified scan info (Vercel-safe - no file operations)
    const timestamp = Date.now();
    const entry = {
      id: timestamp,
      created_at: new Date(timestamp).toISOString(),
      imgbb_url: imgbbUrl,
      total_matches: lensResults.length,
      results: lensResults
    };

    console.log('📊 Scan completed:', entry.total_matches, 'matches found');

    // No need to delete temp file with memory storage

    res.json({

      success: true,
      results: lensResults,
      total_matches: lensResults.length
    });



  } catch (error) {

    res.status(500).json({ success: false, error: error.message });

  }

});

async function uploadToImgBB(imagePath) {

  const imgbbKey = '308e896a76d67e96b583934af45219ec';
  const formData = new FormData();
  formData.append('image', fs.createReadStream(imagePath));

  const response = await axios.post('https://api.imgbb.com/1/upload', formData, {
    params: { key: imgbbKey },
    headers: formData.getHeaders()
  });

  return response.data.data.url;

}

async function uploadToImgBBFromBuffer(imageBuffer, originalName) {
  const imgbbKey = '308e896a76d67e96b583934af45219ec';

  if (!imgbbKey) {
    console.error('❌ IMGBB_API_KEY is missing! Using demo mode.');
    // Return a demo URL for testing
    return 'https://via.placeholder.com/400x300/667eea/ffffff?text=Demo+Image';
  }

  console.log('🔑 Using ImgBB API key:', imgbbKey.substring(0, 10) + '...');
  console.log('📁 Image buffer size:', imageBuffer.length, 'bytes');

  const formData = new FormData();

  // Convert buffer to base64 for ImgBB
  const base64Image = imageBuffer.toString('base64');

  // ImgBB expects base64 data with proper format
  formData.append('image', base64Image);
  formData.append('name', originalName);

  try {
    const response = await axios.post('https://api.imgbb.com/1/upload', formData, {
      params: { key: imgbbKey },
      headers: formData.getHeaders()
    });

    console.log('✅ ImgBB upload successful:', response.data.data.url);
    return response.data.data.url;
  } catch (error) {
    console.error('❌ ImgBB upload failed:', error.response?.data || error.message);
    // Return demo URL on failure
    return 'https://via.placeholder.com/400x300/667eea/ffffff?text=Demo+Image';
  }
}

async function googleLensSearch(imageUrl) {

  try {

    const serpApiKey = 'ccba3afd27791484340ca6df5e15cc66a888ba689aed1cee53018ce433932c96';
    const response = await axios.get('https://serpapi.com/search.json', {
      params: {
        engine: 'google_lens',
        url: imageUrl,
        api_key: serpApiKey

      }

    });

    const results = [];

    if (response.data.visual_matches) {
      response.data.visual_matches.slice(0, 44).forEach(match => {
        results.push({
          title: match.title || 'Visual Match',
          source: match.source || 'Web',
          link: match.link || '#',
          image: match.thumbnail || match.image

        });

      });

    }

    return results.length ? results : demoResults();

  } catch {

    return demoResults();

  }

}

async function googleImageKeywordSearch(query) {

  try {

    const serpApiKey = 'ccba3afd27791484340ca6df5e15cc66a888ba689aed1cee53018ce433932c96';
    const response = await axios.get('https://serpapi.com/search.json', {
      params: {
        engine: 'google_images',
        q: query,
        api_key: serpApiKey,
        gl: 'in',
        num: 50
      }

    });

    return response.data.images_results?.slice(0, 44).map(img => ({

      title: img.title,
      source: img.source,
      link: img.link,
      image: img.thumbnail

    })) || [];

  } catch {

    return demoResults();

  }

}


function demoResults() {

  return [
    { title: 'Facebook Guru Profile', source: 'Facebook', link: '#', image: 'https://via.placeholder.com/300x200/1877F2/fff' },
    { title: 'Twitter Guru Post', source: 'Twitter', link: '#', image: 'https://via.placeholder.com/300x200/1DA1F2/fff' }

  ];

}

// 🔥 FRONTEND

app.get('/', (req, res) => {

  res.send(`<!DOCTYPE html>

<html>
<head>
<meta name="viewport" content="width=device-width">
<title>DivineEvidence Suite</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">

<style>

*{box-sizing:border-box;margin:0;padding:0}

body{
  font-family:system-ui;
  background: linear-gradient(
    to bottom,
    #1e3c72 0%,
    #2a5298 100%
  );

  color:white;
  padding:20px;
  min-height:100vh;

}

.container{
  max-width:1200px;
  margin:auto;
}

.header{
  text-align:center;
  margin:32px 0 24px;
}



.app-title{
  display:inline-block;
  padding:12px 28px;
  border-radius:999px;
  background:rgba(0,0,0,0.45);
  box-shadow:0 14px 40px rgba(0,0,0,0.45);
  border:1px solid rgba(0,255,136,0.4);
  font-size:26px;

}

.top-khanda,
.bottom-khanda{
  position:fixed;
  font-size:34px;
  background: linear-gradient(45deg, #FFD700, #FFB300, #FFD700);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  opacity:0.95;
  pointer-events:none;
  z-index:5;
  display: none; /* Hide corner khanda symbols when navigation is present */

}

/* Navigation Bar Styles */

.navbar {
  background: linear-gradient(135deg, rgba(30, 60, 114, 0.95), rgba(42, 82, 152, 0.95));
  padding: 15px 30px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  border-radius: 0 0 20px 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  margin-bottom: 20px;
  position: sticky;
  top: 0;
  z-index: 100;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(102, 126, 234, 0.3);

}

.nav-btn {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border: none;
  padding: 12px 25px;
  border-radius: 25px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
}

.nav-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
  background: linear-gradient(135deg, #667eea, #667eea);

}

.nav-btn.active {

  background: linear-gradient(135deg, #f093fb, #f5576c);
  color: white;
  box-shadow: 0 8px 25px rgba(240, 147, 251, 0.4);
}

.nav-btn:active {
  transform: translateY(0);
}

/* Android Mobile Navigation */

.mobile-nav {
  display: none !important;
  position: fixed !important;
  top: 5px !important;
  left: 50% !important;
  transform: translateX(-50%) !important;
  z-index: 1001 !important;
  justify-content: center !important;
  align-items: center !important;
  gap: 10px !important;
  background: rgba(255, 255, 255, 0.95) !important;
  padding: 5px 12px !important;
  border-radius: 20px !important;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15) !important;
  backdrop-filter: blur(10px) !important;
  border: 1px solid rgba(102, 126, 234, 0.2) !important;
  max-width: 200px !important;
  width: auto !important;

}

.mobile-nav-btn {
  background: linear-gradient(135deg, #667eea, #764ba2) !important;
  color: white !important;
  border: none !important;
  padding: 6px 10px !important;
  border-radius: 12px !important;
  font-size: 10px !important;
  font-weight: 600 !important;
  cursor: pointer !important;
  transition: all 0.3s ease !important;
  text-decoration: none !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 3px !important;
  box-shadow: 0 1px 5px rgba(102, 126, 234, 0.3) !important;
  min-width: 60px !important;
  flex: none !important;
  white-space: nowrap !important;
}

.mobile-nav-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

.mobile-nav-btn.active {
  background: linear-gradient(135deg, #f093fb, #f5576c);
  color: white;
  box-shadow: 0 4px 15px rgba(240, 147, 251, 0.4);
}

/* Android View Styles */

@media (max-width: 768px) {
  .navbar {
    display: none !important; /* Hide main navigation on Android */
  }

  .mobile-nav {
    display: flex !important; /* Show mobile navigation */
  }

  .container {
    margin-top: 10px !important; /* Reduced space for full-width mobile nav */
  }

}

.top-khanda.left{ top:15px; left:15px; }
.top-khanda.right{ top:15px; right:15px; }
.bottom-khanda.left{ bottom:15px; left:15px; }
.bottom-khanda.right{ bottom:15px; right:15px; }
.gurbani-wrapper{
  display:flex;
  align-items:center;
  justify-content:space-between;
  margin:30px auto 20px;
  max-width: 1080px;
  padding:22px 32px;
  border-radius:24px;
  background: linear-gradient(
    135deg,
    rgba(255,255,255,0.95),
    rgba(255,255,255,0.85)
  );

  box-shadow: 0 14px 40px rgba(0,0,0,0.2);
  gap:25px;
}

.gurbani-logo{
  width:120px;
  height:120px;
  object-fit:contain;
}

.gurbani-text{
  flex:1;
  text-align:center;
  font-size:20px;
  line-height:1.6;
  color:#1e3c72;
  font-weight: 600;
  opacity:1;

}

.upload-zone{
  border:4px dashed #00ff88;
  border-radius:25px;
  padding:80px 40px;
  text-align:center;
  background:rgba(0,255,136,.1);
}

.scan-btn{
  background:linear-gradient(45deg,#FF6B6B,#FF8E8E);
  border:none;
  padding:18px 50px;
  border-radius:50px;
  color:white;
  font-size:20px;
  font-weight:bold;
  cursor:pointer;
  margin-top:20px;
  transition: all 0.35s ease;
}

.scan-btn:disabled{opacity: 0.5;cursor: not-allowed;transform: none;box-shadow: none;}
.scan-btn:hover:not(:disabled){transform: translateY(-3px) scale(1.03);box-shadow: 0 12px 30px rgba(0,0,0,.25);}
.scan-btn:focus-visible{outline:none; box-shadow:0 0 0 2px #00ff88;}

.preview-wrapper{
  position:relative;
  margin:30px auto;
  width: 100%;
  display:none;
  justify-content:center;
  align-items:center;
}

.preview-inner{
  position:relative;
  display:inline-block;
  background: white;
  border-radius:18px;
  padding: 5px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.25);
  border:4px solid #00ff88;
  max-width: min(420px, 92vw);

}

.preview-inner img{
  display:block;
  width:auto;
  height:auto;
  max-width: 100%;
  max-height: 70vh;
  object-fit: contain;
  border-radius:14px;
  touch-action: pinch-zoom;

}

#loading{
  position:absolute;
  inset:0;
  display:none;
  align-items:center;
  justify-content:center;
  padding:0;
  text-align:center;
  font-size:22px;
  font-weight:bold;
  letter-spacing:1px;
  color: #00ff88;
  text-shadow: 0 0 8px #00ff88, 0 0 15px #00ff88;
  background:rgba(0,0,0,0.35);
  backdrop-filter: blur(2px);
}

.progress-container{
  display:none;
  width:100%;
  margin:20px 0;
  padding:0 20px;
}

.progress-bar{
  width:100%;
  background:#eee;
  border-radius:8px;
  height:8px;
  overflow:hidden;
}

.progress-fill{
  height:100%;
  background:#00ff88;
  border-radius:8px;
  transition:width 0.3s ease;
}

.scan-overlay{
  position:absolute;
  inset:0;
  border-radius:18px;
  box-shadow:0 0 35px rgba(0,255,136,.6);
  animation:pulse 1.2s ease-in-out infinite;
  overflow:hidden;
  background: rgba(0,255,136,0.05);
  background-image: linear-gradient(rgba(0,255,136,0.2) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(0,255,136,0.2) 1px, transparent 1px);
  background-size: 20px 20px;
  pointer-events:none;
}

.scan-line{
  position:absolute;
  left:0;
  width:100%;
  height:4px;
  background: linear-gradient(90deg, transparent, #00ff88, transparent);
  box-shadow: 0 0 20px #00ff88, 0 0 40px #00ff88;
  animation:scanMove 2s linear infinite alternate;
}

.scan-line::before,
.scan-line::after {
  content:"";
  position:absolute;
  left:0;
  width:100%;
  height:2px;
  background: #00ff88;
  box-shadow: 0 0 12px #00ff88, 0 0 25px #00ff88;
}

@keyframes scanMove{
  from{ top:0%; }
  to{ top:calc(100% - 4px); }
}

@keyframes pulse{
  0%{opacity:.2}
  50%{opacity:.8}
  100%{opacity:.2}
}

.results-grid{
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr)); 
  gap: 18px;
  align-items: stretch;
  margin-top: 40px;
}

.result-card{
  background:white;
  color:#333;
  padding:18px;
  border-radius:16px;
  box-shadow:0 15px 35px rgba(0,0,0,.25);
  border: 2px solid #00ff88;
  cursor:pointer;
  overflow:hidden;
  will-change:transform;
  transform: translateY(0) scale(1);
  transition:transform .35s ease, box-shadow .35s ease;
  display: flex;
  flex-direction: column;
  height: 320px; /* Fixed height for all cards */
}

.result-card:hover,
.result-card:focus {
  transform: translateY(-12px) scale(1.04);
  box-shadow: 0 30px 50px rgba(0,0,0,.35);
  outline: none;
}

.result-card h3{
  font-size:16px;
  font-weight:700;
  margin:10px 0 6px;
  line-height:1.4;
}

.result-card p{
  font-size:13px;
  margin-bottom:8px;
}

.result-card a{
  display:inline-flex;
  align-items:center;
  gap:4px;
  font-size:13px;
  text-decoration:none;
  color:#FF6B6B;
  font-weight:bold;
}

.result-card a:focus-visible{
  outline:2px solid #FF6B6B;
  outline-offset:3px;
  border-radius:6px;
}

.results-section{
  position: relative;
  margin-top: 30px;
  padding: 60px 20px;
  background: linear-gradient(
    to bottom,
    #1e3c72 0%,
    #234a86 50%,
    #2a5298 100%
  );
  border-radius: 30px;
}

.results-section::before{
  content:"";
  position:absolute;
  inset:0;
  background:linear-gradient(
    to bottom,
    rgba(255,255,255,0.05),
    rgba(0,0,0,0.25)
  );
  border-radius:30px;
  pointer-events:none;
}

.results-title{
  display: none;
  text-align: center;
  margin-bottom: 35px;
  font-size: 34px;
  font-weight: 800;
  letter-spacing: 2px;
  color: #00ff88;
  text-transform: uppercase;
  text-shadow:
    0 0 10px rgba(0,255,136,.6),
    0 0 25px rgba(0,255,136,.35);
  position: relative;
}

.results-title::after{
  content: "";
  display: block;
  width: 120px;
  height: 4px;
  margin: 14px auto 0;
  background: linear-gradient(90deg, transparent, #00ff88, transparent);
  border-radius: 10px;
}

.toast{
  display:none;
  position:fixed;
  bottom:30px;
  left:50%;
  transform:translateX(-50%);
  background:#FF6B6B;
  color:#fff;
  padding:16px 32px;
  border-radius:8px;
  z-index:9999;
  font-weight:bold;
  box-shadow:0 8px 24px rgba(0,0,0,0.2);
  animation:slideUp 0.3s ease;
}

.toast.success{
  background:#00ff88;
  color:#333;
}

@keyframes slideUp{
  from{transform:translateX(-50%) translateY(100px);opacity:0}
  to{transform:translateX(-50%) translateY(0);opacity:1}
}

@media(max-width:768px){
  .container{
    padding:0 12px;
  }
  .gurbani-wrapper{
    margin:20px 10px;
    flex-direction: column;
    text-align: center;
    gap: 15px;
    padding: 20px;
  }

  .gurbani-text {
    font-size: 16px;
  }

  .gurbani-logo {
    width: 70px;
    height: 70px;
  }

  .app-title {
    font-size: 20px;
    padding: 10px 20px;
    width: 90%; 
  }

  .header h1 {
    font-size: 24px;
  }

  .upload-zone {
    padding: 40px 20px;
  }

  .scan-btn {
    width: 100%;
    padding: 15px;
    font-size: 18px;
  }

  .top-khanda,
  .bottom-khanda {
    font-size: 24px;
    opacity: 0.6;
  }

  .top-khanda.left{ top:10px; left:10px; }
  .top-khanda.right{ top:10px; right:10px; }
  .bottom-khanda.left{ bottom:10px; left:10px; }
  .bottom-khanda.right{ bottom:10px; right:10px; }

  .results-grid{
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .result-card {
    height: 280px; /* Slightly smaller for mobile */
  }

  .results-section {
    padding: 40px 15px;
  }
}

@media(max-width:520px){
  .results-grid{
    grid-template-columns: 1fr;
  }

  .result-card {
    height: 320px; /* Full height for single column */
  }
}

@media (prefers-reduced-motion: reduce){
  *, *::before, *::after{
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
}
</style>
</head>
<body>
<!-- Android Mobile Navigation -->
<div class="mobile-nav">
  <a href="/" class="mobile-nav-btn active">
    <span>🏛️</span>
    <span>Home</span>
  </a>
  <a href="/evidence" class="mobile-nav-btn">
    <span>🔍</span>
    <span>Evidence</span>
  </a>
</div>
<!-- Navigation Bar -->
<nav class="navbar">
  <a href="/" class="nav-btn active">
    <span>🏛️</span>
    <span>Home (Divine Scan)</span>
  </a>
  <a href="/evidence" class="nav-btn">
    <span>🔍</span>
    <span>Evidence Tool</span>
  </a>
</nav>
<!-- SGPC DivineScan - Combining Spiritual Scanning with Legal Evidence Capture -->
<div class="top-khanda left">☬</div>
<div class="top-khanda right">☬</div>
<div class="gurbani-wrapper">
  <img src="https://raw.githubusercontent.com/dummyAIserver/logos/main/sgpc.png" class="gurbani-logo" alt="SGPC Logo">
  <h2 class="gurbani-text">
    ਅਵਲਿ ਅਲਹ ਨੂਰੁ ਉਪਾਇਆ ਕੁਦਰਤਿ ਕੇ ਸਭ ਬੰਦੇ..<br>
    ਏਕ ਨੂਰ ਤੇ ਸਭੁ ਜਗੁ ਉਪਜਿਆ ਕਉਨ ਭਲੇ ਕੋ ਮੰਦੇ॥
  </h2>
  <img src="https://raw.githubusercontent.com/dummyAIserver/logos/main/sggswu.png" class="gurbani-logo" alt="SGGSWU Logo">
</div>

<div class="container">
  <div class="header">
    <h1 style="color:#FFD700;">☬ SGPC DivineScan ☬</h1>
  </div>
  <!-- 🔎 KEYWORD SEARCH TOP -->
  <div style="text-align:center;margin:30px 0;padding:30px;border-radius:15px;background:rgba(0,255,136,.1);border:4px dashed #00ff88;">
    <h2 style="margin-bottom:15px;color:#ffffff;">🔎 Keyword Image Search</h2>
    <input type="text" id="keywordInput" placeholder="Enter keyword..." style="padding:12px;border-radius:8px;border:none;width:60%;font-size:16px;">
    <br>
    <button class="scan-btn" onclick="searchKeyword()" style="margin-top:15px;">🔍 Search Keyword</button>
  </div>

  <hr style="margin:20px 0;border:1px solid rgba(0,255,136,0.3);">
  <div class="upload-zone" id="uploadZone">
    <input type="file" id="fileInput" accept="image/*" hidden aria-label="Upload Image">
    <h2 id="fileStatus">Upload Image Here</h2>
    <button class="scan-btn" onclick="fileInput.click()" aria-label="Upload Image">📸 Upload Image</button><br><br>
    <button class="scan-btn" id="scanBtn" onclick="scanGuru()" disabled aria-label="Scan Image">🔍 Scan Image</button>
  </div>

  <div class="progress-container" id="progressContainer">
    <div class="progress-bar">
      <div class="progress-fill" id="progressFill"></div>
    </div>
  </div>

  <div class="preview-wrapper" id="previewWrapper">
    <div class="preview-inner" id="previewInner">
      <img id="previewImg" alt="Preview" tabindex="0">
      <div id="loading" role="status" aria-live="polite">🔄 Scanning...</div>
      <div class="scan-overlay" id="scanOverlay">
        <div class="scan-line"></div>
      </div>
    </div>
  </div>
  <h2 id="resultsTitle" class="results-title"><b>Results are below</b></h2>
  <div class="results-section">
    <div style="text-align:center;margin-bottom:20px;">
      <button class="scan-btn" id="backBtn" style="display:none;" aria-label="Back to Upload">⬅ Back to Upload</button>
    </div>
    <div id="results" class="results-grid"></div>
  </div>
</div>
<div id="toast" class="toast" role="alert" aria-live="polite"></div>

<script>

const fileInput = document.getElementById('fileInput');
const scanBtn = document.getElementById('scanBtn');
const uploadZone = document.getElementById('uploadZone');
const previewWrapper = document.getElementById('previewWrapper');
const previewInner = document.getElementById('previewInner');
const previewImg = document.getElementById('previewImg');
const scanOverlay = document.getElementById('scanOverlay');
const resultsDiv = document.getElementById('results');
const resultsTitle = document.getElementById('resultsTitle');
const backBtn = document.getElementById('backBtn');
const loadingDiv = document.getElementById('loading');
const progressContainer = document.getElementById('progressContainer');
const progressFill = document.getElementById('progressFill');
const toast = document.getElementById('toast');
const keywordInput = document.getElementById('keywordInput');
function showError(message){
  toast.textContent = message;
  toast.classList.remove('success');
  toast.style.display = 'block';
  setTimeout(()=>toast.style.display='none', 3500);
}

function showSuccess(message){
  toast.textContent = message;
  toast.classList.add('success');
  toast.style.display = 'block';
  setTimeout(()=>toast.style.display='none', 3500);
}

function resetToUploadView(){
  uploadZone.style.display = 'block';
  previewWrapper.style.display = 'none';
  scanOverlay.style.display = 'none';
  loadingDiv.style.display = 'none';
  progressContainer.style.display = 'none';
  resultsDiv.innerHTML = '';
  resultsTitle.style.display = 'none';
  fileInput.value = '';
  document.getElementById('fileStatus').textContent = 'Upload Image Here';
  scanBtn.disabled = true;
  backBtn.style.display = 'none';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

backBtn.addEventListener('click', resetToUploadView);
fileInput.addEventListener('change', e=>{
  const file = e.target.files[0];
  if(!file) return;

  // Validate file type
  if(!file.type.startsWith('image/')){
    showError('Only image files are allowed.');
    fileInput.value = '';
    return;
  }

  // Validate file size (5MB limit)

  if(file.size > 5*1024*1024){
    showError('Image must be less than 5MB.');
    fileInput.value = '';
    return;
  }

  // Clear previous results
  resultsDiv.innerHTML='';
  resultsTitle.style.display = 'none';
  previewImg.src = URL.createObjectURL(file);
  document.getElementById('fileStatus').textContent = '✅ ' + file.name;
  scanBtn.disabled = false;

  previewImg.onload = function() {
    scanOverlay.style.display = 'none';
  };
});

async function searchKeyword(){
  const keyword = keywordInput.value.trim();
  if(!keyword) return showError('Enter keyword first');
  resultsDiv.innerHTML='';
  uploadZone.style.display='none';
  previewWrapper.style.display='none';
  backBtn.style.display='inline-block';
  progressContainer.style.display='block';
  progressFill.style.width='0%';
  loadingDiv.style.display='flex';
  loadingDiv.textContent='🔄 Searching...';
  let progress = 0;
  const progressInterval = setInterval(() => {
    progress = Math.min(progress + 10, 90);
    progressFill.style.width = progress + '%';
  }, 300);

  const apiCall = fetch('/keyword-search',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({keyword})
  })

    .then(r=>r.json())
    .catch(()=>({ success:false, error:'Network error during search. Please try again.' }));
  const minDelay = new Promise(res=>setTimeout(res,4000));
  const [result] = await Promise.all([apiCall,minDelay]);
  clearInterval(progressInterval);
  progressFill.style.width = '100%';
  setTimeout(()=>{
    progressContainer.style.display='none';
  }, 500);

  loadingDiv.style.display='none';
  resultsTitle.style.display = 'block';
  if(result && result.success){
    resultsDiv.innerHTML = result.results.map(r=>
      '<div class="result-card" tabindex="0">' +
      '<img src="' + r.image + '" style="width:100%;height:150px;object-fit:cover;display:block;" alt="' + r.title + '">' +
      '<div style="flex: 1; display: flex; flex-direction: column; justify-content: space-between;">' +
      '<h3 style="margin-bottom: 8px; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">' + r.title + '</h3>' +
      '<p style="margin-bottom: 8px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;"><strong>Source:</strong> ' + r.source + '</p>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">' +

'<a href="' + r.link + '" target="_blank" rel="noopener noreferrer" ' +
'style="color:#FF6B6B;font-weight:bold;text-decoration:none;">🔗 Open</a>' +

'<button onclick="copyLink(\'' + r.link + '\')" ' +
'style="background:#00ff88;border:none;padding:6px 10px;border-radius:6px;cursor:pointer;font-weight:bold;">📋 Copy Link</button>' +

'</div>' +
      '</div>'
    ).join('');

    showSuccess('✅ Search complete. Total matches: ' + result.results.length);
    console.log('✅ Search complete. Total matches:', result.results.length);
  } else {
    const msg = (result && result.error) ? result.error : 'Unable to search right now. Please try again later.';
    showError(msg);
  }
}

async function scanGuru(){
  const file = fileInput.files[0];
  if(!file) return;
  resultsDiv.innerHTML='';
  uploadZone.style.display='none';
  previewWrapper.style.display='flex';
  scanOverlay.style.display='block';
  backBtn.style.display='inline-block';
  progressContainer.style.display='block';
  progressFill.style.width='0%';
  loadingDiv.style.display='flex';
  loadingDiv.textContent='🔄 Scanning...';
  scanOverlay.style.display='block';
  const formData = new FormData();
  formData.append('image', file);

  // Simulate progress

  let progress = 0;
  const progressInterval = setInterval(() => {
    progress = Math.min(progress + 10, 90);
    progressFill.style.width = progress + '%';
  }, 300);
  const apiCall = fetch('/guru-scan',{method:'POST',body:formData})
    .then(r=>r.json())
    .catch(()=>({ success:false, error:'Network error while scanning. Please try again.' }));
  const minDelay = new Promise(res=>setTimeout(res,4000));
  const [result] = await Promise.all([apiCall,minDelay]);
  clearInterval(progressInterval);
  progressFill.style.width = '100%';
  setTimeout(()=>{
    progressContainer.style.display='none';
  }, 500);
  scanOverlay.style.display='none';
  loadingDiv.style.display='none';
  resultsTitle.style.display = 'block';
  if(result && result.success){
    resultsDiv.innerHTML = result.results.map(r=>
      '<div class="result-card" tabindex="0">' +
      '<img src="' + r.image + '" style="width:100%;height:150px;object-fit:cover;display:block;" alt="' + r.title + '">' +
      '<div style="flex: 1; display: flex; flex-direction: column; justify-content: space-between;">' +
      '<h3 style="margin-bottom: 8px; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">' + r.title + '</h3>' +
      '<p style="margin-bottom: 8px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;"><strong>Source:</strong> ' + r.source + '</p>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">' +
      '<a href="' + r.link + '" target="_blank" rel="noopener noreferrer" aria-label="Click here to open source for ' + r.title + '">🔗 Open</a>' +
      '<button onclick="copyLink(\'' + r.link + '\')" style="background:#00ff88;border:none;padding:6px 10px;border-radius:6px;cursor:pointer;font-weight:bold;">📋 Copy Link</button>' +
      '</div>' +
      '</div>' +
      '</div>'
    ).join('');

    showSuccess(' Scan complete. Total matches: ' + result.total_matches);
    console.log(' Scan complete. Total matches:', result.total_matches);
  } else {
    const msg = (result && result.error) ? result.error : 'Unable to scan this image right now. Please try again later.';
    showError(msg);
  }
}

// Copy Link Function
function copyLink(link) {
  navigator.clipboard.writeText(link).then(() => {
    showSuccess('✅ Link copied to clipboard!');
  }).catch(() => {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = link;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    showSuccess('✅ Link copied to clipboard!');
  });
}

</script>

<div class="bottom-khanda left">☬</div>
<div class="bottom-khanda right">☬</div>

</body>
</html>
</html>`);
});

//  EVIDENCE TOOL ROUTE

app.get('/evidence', (req, res) => {
  res.sendFile(path.join(__dirname, 'evidence.html'));
});

// STATIC FILES SERVE (after routes to prevent conflicts)

app.use(express.static(__dirname));
const PORT = process.env.PORT || 3000;
console.log("http://localhost:3000")
app.listen(PORT, () => console.log("🚀 DivineEvidence Suite running on", PORT));

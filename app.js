/**
 * Make Your Own Fish! - 공유 바다 물고기 앱
 * - 그리기 모드: index.html (아이패드에서 물고기 그리기)
 * - 전시 모드: index.html?mode=exhibit (모니터에서 결과물만 표시)
 */
const SUPABASE_URL = 'https://kgzuoxttqqgnakygdkgo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnenVveHR0cXFnbmFreWdka2dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4Mjk1MTksImV4cCI6MjA4NjQwNTUxOX0.5R_EwKJ_zb7YBPcmOBYMfYQh7Oom0c4GAT3YqQhnzwY';

const BUCKET_NAME = 'fish-images';
const TABLE_NAME = 'fish-ocean';

var isExhibitMode = /[?&](?:mode=exhibit|exhibit)(?:&|$)/i.test(location.search || '');

// Supabase 클라이언트 (키가 설정된 경우에만 초기화, CDN 전역 'supabase'와 이름 충돌 방지)
var supabaseClient = null;
try {
  if (SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_URL.includes('YOUR_') && typeof window.supabase !== 'undefined') {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (e) {
  console.warn('Supabase init skipped', e);
}

// ========== 화면 전환 ==========
const screens = {
  start: document.getElementById('start-screen'),
  draw: document.getElementById('draw-screen'),
  ocean: document.getElementById('ocean-screen'),
};

function showScreen(name) {
  Object.keys(screens).forEach(function (key) {
    var el = screens[key];
    if (el) {
      el.classList.remove('active');
      el.classList.remove('leaving');
    }
  });
  var next = screens[name];
  if (next) {
    next.classList.add('active');
  }
}

function transitionTo(name) {
  const current = Object.values(screens).find((el) => el.classList.contains('active'));
  if (current) {
    current.classList.add('leaving');
    setTimeout(() => {
      showScreen(name);
    }, 400);
  } else {
    showScreen(name);
  }
}

// ========== 그리기 캔버스 ==========
const canvas = document.getElementById('draw-canvas');
const ctx = canvas.getContext('2d');

var currentColor = '#e74c3c';
var isEraser = false;
var isDrawing = false;
var lastX = 0;
var lastY = 0;
var currentLineWidth = 5;
var eraserSize = 24;

function getCanvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

function startDraw(e) {
  e.preventDefault();
  isDrawing = true;
  const { x, y } = getCanvasPoint(e);
  lastX = x;
  lastY = y;
  if (isEraser) {
    ctx.clearRect(x - eraserSize / 2, y - eraserSize / 2, eraserSize, eraserSize);
  }
}

function draw(e) {
  e.preventDefault();
  if (!isDrawing) return;
  const { x, y } = getCanvasPoint(e);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (isEraser) {
    ctx.clearRect(x - eraserSize / 2, y - eraserSize / 2, eraserSize, eraserSize);
  } else {
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = currentLineWidth;
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  lastX = x;
  lastY = y;
}

function endDraw(e) {
  e.preventDefault();
  isDrawing = false;
}

function clearCanvas() {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function initCanvas() {
  clearCanvas();
}

// 캔버스 이벤트
canvas.addEventListener('mousedown', startDraw);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', endDraw);
canvas.addEventListener('mouseleave', endDraw);
canvas.addEventListener('touchstart', startDraw, { passive: false });
canvas.addEventListener('touchmove', draw, { passive: false });
canvas.addEventListener('touchend', endDraw, { passive: false });

// 연필/지우개
document.querySelectorAll('.pencil').forEach(function (btn) {
  btn.addEventListener('click', function () {
    isEraser = false;
    document.querySelectorAll('.pencil').forEach(function (b) { b.classList.remove('active'); });
    document.getElementById('btn-eraser').classList.remove('active');
    btn.classList.add('active');
    currentColor = btn.dataset.color;
  });
});

document.getElementById('btn-eraser').addEventListener('click', function () {
  isEraser = true;
  document.querySelectorAll('.pencil').forEach(function (b) { b.classList.remove('active'); });
  document.querySelectorAll('.pen-size').forEach(function (b) { b.classList.remove('active'); });
  document.getElementById('btn-eraser').classList.add('active');
});

document.querySelectorAll('.pen-size').forEach(function (btn) {
  btn.addEventListener('click', function () {
    currentLineWidth = parseInt(btn.dataset.size, 10) || 5;
    document.querySelectorAll('.pen-size').forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
  });
});

document.getElementById('btn-clear').addEventListener('click', function () {
  clearCanvas();
});

// ========== 물고기 생성 & 업로드 ==========
var LOCAL_FISH_KEY = 'fish_local_fish';
var LOCAL_FISH_MAX = 30;

/** 캔버스에서 흰/밝은 픽셀을 투명하게 바꾼 이미지 data URL 반환 */
function canvasToDataUrlTransparentBg() {
  var w = canvas.width;
  var h = canvas.height;
  var off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  var ctxOff = off.getContext('2d');
  ctxOff.drawImage(canvas, 0, 0);
  var imgData = ctxOff.getImageData(0, 0, w, h);
  var d = imgData.data;
  for (var i = 0; i < d.length; i += 4) {
    var r = d[i];
    var g = d[i + 1];
    var b = d[i + 2];
    if (r >= 248 && g >= 248 && b >= 248) d[i + 3] = 0;
  }
  ctxOff.putImageData(imgData, 0, 0);
  return off.toDataURL('image/png');
}

/** 흰 배경 제거한 캔버스를 Blob으로 (Supabase 업로드용) */
function canvasToBlobTransparentBg() {
  var w = canvas.width;
  var h = canvas.height;
  var off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  var ctxOff = off.getContext('2d');
  ctxOff.drawImage(canvas, 0, 0);
  var imgData = ctxOff.getImageData(0, 0, w, h);
  var d = imgData.data;
  for (var i = 0; i < d.length; i += 4) {
    var r = d[i];
    var g = d[i + 1];
    var b = d[i + 2];
    if (r >= 248 && g >= 248 && b >= 248) d[i + 3] = 0;
  }
  ctxOff.putImageData(imgData, 0, 0);
  return new Promise(function (resolve) {
    off.toBlob(resolve, 'image/png', 0.9);
  });
}

async function createFish() {
  var btn = document.getElementById('btn-create-fish');
  btn.disabled = true;
  if (btn.closest('.draw-actions')) btn.closest('.draw-actions').classList.add('loading');

  if (!supabaseClient) {
    var dataUrl = canvasToDataUrlTransparentBg();
    var list = [];
    try {
      list = JSON.parse(localStorage.getItem(LOCAL_FISH_KEY) || '[]');
    } catch (e) {}
    var newFish = {
      id: 'local-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      image_url: dataUrl,
      created_at: new Date().toISOString()
    };
    list.push(newFish);
    if (list.length > LOCAL_FISH_MAX) list = list.slice(-LOCAL_FISH_MAX);
    try {
      localStorage.setItem(LOCAL_FISH_KEY, JSON.stringify(list));
    } catch (e) {
      if (list.length > 1) list = list.slice(-1);
      localStorage.setItem(LOCAL_FISH_KEY, JSON.stringify(list));
    }
    transitionTo('ocean');
    btn.disabled = false;
    if (btn.closest('.draw-actions')) btn.closest('.draw-actions').classList.remove('loading');
    return;
  }

  try {
    var blob = await canvasToBlobTransparentBg();
    var fileName = 'fish_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9) + '.png';

    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from(BUCKET_NAME)
      .upload(fileName, blob, { contentType: 'image/png', upsert: false });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      alert('이미지 업로드에 실패했습니다. Storage 버킷과 RLS를 확인해 주세요.');
      btn.disabled = false;
      btn.closest('.draw-actions')?.classList.remove('loading');
      return;
    }

    const { data: publicUrl } = supabaseClient.storage.from(BUCKET_NAME).getPublicUrl(uploadData.path);
    const imageUrl = publicUrl.publicUrl;

    const { data: row, error: insertError } = await supabaseClient
      .from(TABLE_NAME)
      .insert({ image_url: imageUrl })
      .select('id, image_url, created_at')
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      alert('저장에 실패했습니다. 테이블과 RLS를 확인해 주세요.');
      btn.disabled = false;
      btn.closest('.draw-actions')?.classList.remove('loading');
      return;
    }

    transitionTo('ocean');
    // 바다 화면 진입 시 loadAllFish에서 새 물고기 포함해 불러옴
  } catch (err) {
    console.error(err);
    alert('오류가 발생했습니다.');
  }

  btn.disabled = false;
  btn.closest('.draw-actions')?.classList.remove('loading');
}

// ========== 바다 장면 & 물고기 애니메이션 ==========
const fishContainer = document.getElementById('fish-container');
const fishInstances = new Map(); // id -> { el, x, y, vx, vy, scale, phase }

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function addFishToOcean(imageUrl, meta = {}) {
  var id = meta.id || 'fish-' + Date.now();
  var scale = meta.scale ?? randomRange(0.85, 1.25);
  var size = Math.round(130 * scale);
  var w = fishContainer.offsetWidth || 400;
  var h = fishContainer.offsetHeight || 300;
  var x = randomRange(size, Math.max(w - size, size + 1)) || 100;
  var y = randomRange(size, Math.max(h - size, size + 1)) || 100;
  var speed = randomRange(0.7, 1.1);
  var vx = (Math.random() < 0.5 ? -1 : 1) * speed;
  var vy = randomRange(-0.2, 0.2);

  const wrap = document.createElement('div');
  wrap.className = 'fish-sprite';
  wrap.dataset.fishId = id;
  wrap.style.width = size + 'px';
  wrap.style.height = size + 'px';
  wrap.style.left = x + 'px';
  wrap.style.top = y + 'px';

  const img = document.createElement('img');
  img.src = imageUrl;
  img.alt = 'Fish';
  img.loading = 'lazy';
  wrap.appendChild(img);

  fishContainer.appendChild(wrap);

  fishInstances.set(id, {
    el: wrap,
    x,
    y,
    vx,
    vy,
    scale,
    phase: randomRange(0, Math.PI * 2),
    width: fishContainer.offsetWidth,
    height: fishContainer.offsetHeight,
    size,
  });
}

function animateFish() {
  fishInstances.forEach(function (fish) {
    var x = fish.x;
    var y = fish.y;
    var vx = fish.vx;
    var vy = fish.vy;
    var phase = fish.phase;
    var width = fish.width;
    var height = fish.height;
    var size = fish.size;
    var el = fish.el;

    x += vx;
    y += vy;
    phase += 0.06;
    var float = Math.sin(phase) * 4;
    var sway = Math.sin(phase * 1.3) * 10;
    var wiggle = Math.sin(phase * 2) * 3;

    if (x < -size) x += width + size * 2;
    if (x > width + size) x -= width + size * 2;
    if (y < -size) y += height + size * 2;
    if (y > height + size) y -= height + size * 2;
    if (Math.random() < 0.012) {
      vx = -vx;
      vy = vy + (Math.random() - 0.5) * 0.08;
    }
    fish.vx = vx;
    fish.vy = vy;
    fish.x = x;
    fish.y = y;
    fish.phase = phase;

    /* 가이드: 머리=왼쪽, 꼬리=오른쪽 → 진행 방향에 머리가 오도록 */
    var dir = vx >= 0 ? -1 : 1;
    el.style.left = (x + wiggle) + 'px';
    el.style.top = (y + float) + 'px';
    el.style.transform = 'scaleX(' + dir + ') rotate(' + sway + 'deg)';
  });
  requestAnimationFrame(animateFish);
}

function loadAllFish() {
  if (!supabaseClient) return;
  supabaseClient
    .from(TABLE_NAME)
    .select('id, image_url, created_at')
    .order('created_at', { ascending: false })
    .limit(50)
    .then(({ data, error }) => {
      if (error) {
        console.warn('Load fish error:', error);
        return;
      }
      (data || []).forEach((row) => addFishToOcean(row.image_url, row));
    });
}

function subscribeNewFish() {
  if (!supabaseClient) return;
  supabaseClient
    .channel('fish-channel')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: TABLE_NAME }, function (payload) {
      var row = payload.new;
      if (!row || !row.image_url) return;
      if (isExhibitMode) {
        location.reload();
        return;
      }
      if (!fishInstances.has(row.id)) addFishToOcean(row.image_url, row);
    })
    .subscribe();
}

function loadLocalFish() {
  var list = [];
  try {
    list = JSON.parse(localStorage.getItem(LOCAL_FISH_KEY) || '[]');
  } catch (e) {}
  list.forEach(function (item) {
    if (item && item.image_url) addFishToOcean(item.image_url, item);
  });
}

function enterOceanScreen() {
  fishContainer.innerHTML = '';
  fishInstances.clear();
  loadLocalFish();
  loadAllFish();
  subscribeNewFish();
  requestAnimationFrame(animateFish);
}

// 바다 화면 진입 시 한 번 로드
const oceanScreen = document.getElementById('ocean-screen');
const observer = new MutationObserver((mutations) => {
  if (oceanScreen.classList.contains('active')) enterOceanScreen();
});
observer.observe(oceanScreen, { attributes: true, attributeFilter: ['class'] });

var exhibitModeOn = isExhibitMode;

function setExhibitMode(on) {
  exhibitModeOn = on;
  var btn = document.getElementById('mode-toggle-btn');
  if (btn) btn.textContent = on ? '✎' : '◐';
  if (on) {
    document.body.classList.add('exhibit-mode');
    showScreen('ocean');
    enterOceanScreen();
  } else {
    document.body.classList.remove('exhibit-mode');
    showScreen('start');
  }
}

// ========== 버튼 연결 (DOM 준비 후 실행) ==========
function initApp() {
  var modeToggle = document.getElementById('mode-toggle-btn');
  if (modeToggle) {
    modeToggle.textContent = exhibitModeOn ? '✎' : '◐';
    modeToggle.title = exhibitModeOn ? '그리기 모드로' : '전시 모드로';
    modeToggle.addEventListener('click', function () {
      setExhibitMode(!exhibitModeOn);
      modeToggle.title = exhibitModeOn ? '그리기 모드로' : '전시 모드로';
    });
  }

  if (isExhibitMode) {
    document.body.classList.add('exhibit-mode');
    showScreen('ocean');
    enterOceanScreen();
    return;
  }

  try {
    if (!sessionStorage.getItem('fish_tank_cleared')) {
      localStorage.removeItem(LOCAL_FISH_KEY);
      sessionStorage.setItem('fish_tank_cleared', '1');
    }
  } catch (e) {}
  var btnDraw = document.getElementById('btn-draw');
  if (btnDraw) {
    btnDraw.addEventListener('click', function () {
      transitionTo('draw');
      initCanvas();
    });
  }

  var btnBack = document.getElementById('btn-back');
  if (btnBack) btnBack.addEventListener('click', function () { transitionTo('start'); });

  var btnCreate = document.getElementById('btn-create-fish');
  if (btnCreate) btnCreate.addEventListener('click', createFish);

  var btnAgain = document.getElementById('btn-draw-again');
  if (btnAgain) {
    btnAgain.addEventListener('click', function () {
      transitionTo('draw');
      initCanvas();
    });
  }

  showScreen('start');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

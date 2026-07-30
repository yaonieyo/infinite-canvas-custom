const els = {
  server: document.getElementById('serverInput'),
  folder: document.getElementById('folderInput'),
  classify: document.getElementById('classifyInput'),
  provider: document.getElementById('providerSelect'),
  model: document.getElementById('modelSelect'),
  prompt: document.getElementById('promptInput'),
  scan: document.getElementById('scanBtn'),
  pin: document.getElementById('pinBtn'),
  github: document.getElementById('githubBtn'),
  settingsToggle: document.getElementById('settingsToggleBtn'),
  settingsPanel: document.getElementById('settingsPanel'),
  settingsSummary: document.getElementById('settingsSummary'),
  test: document.getElementById('testBtn'),
  grid: document.getElementById('grid'),
  status: document.getElementById('statusText'),
  count: document.getElementById('countText'),
  selectAll: document.getElementById('selectAllBtn'),
  clear: document.getElementById('clearBtn'),
  import: document.getElementById('importBtn'),
};

let images = [];
let selected = new Set();
let providers = [];
let settingsCollapsed = false;
let savedSettings = {
  provider: '',
  model: '',
};
let previewItem = null;
const POPUP_PREVIEW_POPUP_WIDTH = 390;
const POPUP_PREVIEW_GAP = 16;
const PREVIEW_POSITION_STORAGE_KEY = 'webPreviewPosition';
const SIDEPANEL_PREVIEW_POSITION_STORAGE_KEY = 'webPreviewPositionSidePanel';
const isSidePanelView = location.pathname.endsWith('/sidepanel.html');
function apiBase(){
  let value = String(els.server.value || '').trim();
  if(!value) value = '127.0.0.1:8767';
  if(!/^https?:\/\//i.test(value)) value = `http://${value}`;
  try {
    const parsed = new URL(value);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return 'http://127.0.0.1:8767';
  }
}

function setStatus(text){
  els.status.textContent = text || '';
}

function updateSettingsUi(){
  els.settingsPanel.classList.toggle('collapsed', settingsCollapsed);
  els.settingsToggle.classList.toggle('active', !settingsCollapsed);
  els.settingsToggle.title = settingsCollapsed ? '展开设置' : '收起设置';
  const provider = providers.find(p => p.id === els.provider.value);
  const model = els.model.value || '';
  els.settingsSummary.textContent = `${apiBase().replace(/^https?:\/\//, '')}${provider ? ` · ${provider.name || provider.id}` : ''}${model ? ` · ${model}` : ''}`;
}

function imageName(url){
  try {
    const parsed = new URL(url);
    const name = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || '');
    return name || parsed.hostname || 'web-image';
  } catch {
    return 'web-image';
  }
}

function mediaKindFromUrl(url){
  const clean = decodeURIComponent(String(url || '').split(/[?#]/, 1)[0]).toLowerCase();
  if(/\.(mp4|webm|mov|m4v)$/.test(clean)) return 'video';
  return 'image';
}

function loadMediaSize(item){
  return new Promise(resolve => {
    const kind = item.kind || mediaKindFromUrl(item.url);
    const done = (width, height) => resolve({
      ...item,
      width: Number(width || 0) || Number(item.width || 0) || 0,
      height: Number(height || 0) || Number(item.height || 0) || 0,
      dimSource: width && height ? 'loaded' : item.dimSource,
    });
    const timer = setTimeout(() => done(0, 0), 4500);
    if(kind === 'video'){
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      video.onloadedmetadata = () => {
        clearTimeout(timer);
        done(video.videoWidth, video.videoHeight);
      };
      video.onerror = () => {
        clearTimeout(timer);
        done(0, 0);
      };
      video.src = item.url;
      return;
    }
    const image = new Image();
    image.referrerPolicy = 'no-referrer';
    image.onload = () => {
      clearTimeout(timer);
      done(image.naturalWidth, image.naturalHeight);
    };
    image.onerror = () => {
      clearTimeout(timer);
      done(0, 0);
    };
    image.src = item.url;
  });
}

async function enrichMediaSizes(items){
  const copy = [...items];
  const targets = copy
    .map((item, index) => ({item, index}))
    .filter(({item}) => item && item.url && item.dimSource !== 'url')
    .slice(0, 120);
  const concurrency = 8;
  let cursor = 0;
  async function worker(){
    while(cursor < targets.length){
      const current = targets[cursor++];
      copy[current.index] = await loadMediaSize(current.item);
    }
  }
  await Promise.all(Array.from({length: Math.min(concurrency, targets.length)}, worker));
  return copy;
}

function renderProviders(){
  const chatProviders = providers
    .filter(p => p && p.enabled !== false && Array.isArray(p.chat_models) && p.chat_models.length);
  if(!chatProviders.length){
    els.provider.innerHTML = '<option value="">暂无聊天平台</option>';
    els.model.innerHTML = '<option value="">暂无模型</option>';
    return;
  }
  const wantedProvider = savedSettings.provider || els.provider.value;
  const current = chatProviders.find(p => p.id === wantedProvider) || chatProviders[0];
  els.provider.innerHTML = chatProviders.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name || p.id)}</option>`).join('');
  els.provider.value = current.id;
  const models = current.chat_models || [];
  const wantedModel = savedSettings.provider === current.id ? savedSettings.model : els.model.value;
  els.model.innerHTML = models.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');
  els.model.value = models.includes(wantedModel) ? wantedModel : (models[0] || '');
  savedSettings.provider = els.provider.value || '';
  savedSettings.model = els.model.value || '';
  updateSettingsUi();
}

function escapeHtml(value){
  return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}

function syncPreviewSelection(){
  return previewItem;
}

async function getActiveTabId(){
  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  return tab?.id || 0;
}

function renderPagePreview(payload){
  const id = '__ic_local_asset_preview__';
  const old = document.getElementById(id);
  if(old) old.remove();

  if(!payload || !payload.url) return;
  const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const theme = dark ? {
    panel: 'rgba(24,27,34,.96)',
    panelSoft: '#20242d',
    text: '#e5e7eb',
    muted: '#98a2b3',
    line: 'rgba(148,163,184,.28)',
    button: '#252a34',
    shadow: '0 22px 70px rgba(0,0,0,.42)'
  } : {
    panel: 'rgba(255,255,255,.96)',
    panelSoft: '#f8fafc',
    text: '#111827',
    muted: '#64748b',
    line: 'rgba(148,163,184,.35)',
    button: '#f8fafc',
    shadow: '0 22px 70px rgba(15,23,42,.28)'
  };

  const root = document.createElement('div');
  root.id = id;
  root.style.cssText = [
    'position:fixed',
    'top:18px',
    'width:min(380px,calc(100vw - 36px))',
    'min-height:240px',
    'max-height:min(82vh,720px)',
    'z-index:2147483647',
    'display:flex',
    'flex-direction:column',
    'overflow:hidden',
    `border:1px solid ${theme.line}`,
    'border-radius:14px',
    `background:${theme.panel}`,
    `box-shadow:${theme.shadow}`,
    'backdrop-filter:blur(14px)',
    'font:12px/1.45 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    `color:${theme.text}`
  ].join(';');

  const placePreview = () => {
    const margin = 18;
    const top = margin;
    if(payload.position && Number.isFinite(payload.position.left) && Number.isFinite(payload.position.top)){
      const rect = root.getBoundingClientRect();
      const left = Math.max(margin, Math.min(payload.position.left, window.innerWidth - rect.width - margin));
      const savedTop = Math.max(margin, Math.min(payload.position.top, window.innerHeight - rect.height - margin));
      root.style.left = `${Math.round(left)}px`;
      root.style.right = '';
      root.style.top = `${Math.round(savedTop)}px`;
      return;
    }
    if(payload.placement === 'center'){
      const rect = root.getBoundingClientRect();
      const left = Math.max(margin, (window.innerWidth - rect.width) / 2);
      const centerTop = Math.max(margin, (window.innerHeight - rect.height) / 2);
      root.style.left = `${Math.round(left)}px`;
      root.style.right = '';
      root.style.top = `${Math.round(centerTop)}px`;
      return;
    }
    const right = payload.placement === 'popup-adjacent'
      ? POPUP_PREVIEW_POPUP_WIDTH + POPUP_PREVIEW_GAP
      : margin;
    const availableWidth = window.innerWidth - right - margin;
    const width = Math.max(220, Math.min(380, availableWidth));
    root.style.left = '';
    root.style.right = `${Math.round(right)}px`;
    root.style.width = `${Math.round(width)}px`;
    root.style.top = `${Math.round(top)}px`;
  };

  const savePreviewPosition = () => {
    const left = Math.round(root.getBoundingClientRect().left);
    const top = Math.round(root.getBoundingClientRect().top);
    const position = {left, top};
    if(globalThis.chrome?.storage?.local && payload.storageKey){
      chrome.storage.local.set({[payload.storageKey]: position});
      return;
    }
    try {
      localStorage.setItem(payload.storageKey || 'webPreviewPosition', JSON.stringify(position));
    } catch {}
  };

  const head = document.createElement('div');
  head.style.cssText = `display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px;border-bottom:1px solid ${theme.line}`;

  const title = document.createElement('div');
  title.textContent = payload.name || '图片预览';
  title.style.cssText = 'min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:800';

  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '×';
  close.title = '关闭预览';
  close.style.cssText = `flex:0 0 auto;width:28px;height:28px;border:1px solid ${theme.line};border-radius:8px;background:${theme.button};color:${theme.text};cursor:pointer;font-size:18px;line-height:1`;
  close.onclick = () => root.remove();

  let dragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  head.style.cursor = 'move';
  head.addEventListener('mousedown', event => {
    if(event.target === close) return;
    const rect = root.getBoundingClientRect();
    dragging = true;
    dragOffsetX = event.clientX - rect.left;
    dragOffsetY = event.clientY - rect.top;
    root.style.left = `${Math.round(rect.left)}px`;
    root.style.top = `${Math.round(rect.top)}px`;
    root.style.right = '';
    event.preventDefault();
  });
  window.addEventListener('mousemove', event => {
    if(!dragging) return;
    const margin = 8;
    const rect = root.getBoundingClientRect();
    const left = Math.max(margin, Math.min(event.clientX - dragOffsetX, window.innerWidth - rect.width - margin));
    const top = Math.max(margin, Math.min(event.clientY - dragOffsetY, window.innerHeight - rect.height - margin));
    root.style.left = `${Math.round(left)}px`;
    root.style.top = `${Math.round(top)}px`;
    event.preventDefault();
  });
  window.addEventListener('mouseup', () => {
    if(!dragging) return;
    dragging = false;
    savePreviewPosition();
  });

  const body = document.createElement('div');
  body.style.cssText = `flex:0 1 auto;min-height:170px;max-height:min(64vh,580px);display:grid;place-items:center;padding:10px;background:${theme.panelSoft};overflow:hidden`;

  const media = document.createElement(payload.kind === 'video' ? 'video' : 'img');
  media.src = payload.url;
  media.style.cssText = 'display:block;max-width:100%;max-height:min(64vh,560px);object-fit:contain';
  if(payload.kind === 'video'){
    media.controls = true;
    media.muted = true;
    media.playsInline = true;
    media.preload = 'metadata';
  } else {
    media.alt = '';
    media.referrerPolicy = 'no-referrer';
  }
  const resizeMedia = () => {
    const naturalWidth = payload.kind === 'video' ? media.videoWidth : media.naturalWidth;
    const naturalHeight = payload.kind === 'video' ? media.videoHeight : media.naturalHeight;
    const ratio = naturalWidth && naturalHeight ? naturalHeight / naturalWidth : 1;
    const target = Math.round(Math.min(560, Math.max(170, 356 * ratio)));
    body.style.height = `${target}px`;
    placePreview();
  };
  media.onload = resizeMedia;
  media.onloadedmetadata = resizeMedia;
  body.appendChild(media);

  const foot = document.createElement('div');
  foot.textContent = `${payload.width || '?'} x ${payload.height || '?'}`;
  foot.style.cssText = `flex:0 0 auto;padding:8px 10px;color:${theme.muted};border-top:1px solid ${theme.line};overflow:hidden;text-overflow:ellipsis;white-space:nowrap`;

  head.append(title, close);
  root.append(head, body, foot);
  document.documentElement.appendChild(root);
  placePreview();
  window.addEventListener('resize', placePreview, {passive: true});
}

async function openImagePreview(item){
  if(!item?.url) return;
  previewItem = item;
  const tabId = await getActiveTabId();
  if(!tabId) throw new Error('没有可预览的当前标签页');
  const storageKey = isSidePanelView ? SIDEPANEL_PREVIEW_POSITION_STORAGE_KEY : PREVIEW_POSITION_STORAGE_KEY;
  const stored = await chrome.storage.local.get([storageKey]);
  await chrome.scripting.executeScript({
    target: {tabId},
    func: renderPagePreview,
    args: [{
      url: item.url,
      name: imageName(item.url),
      width: item.width || '',
      height: item.height || '',
      kind: item.kind || mediaKindFromUrl(item.url),
      placement: isSidePanelView ? 'right' : 'center',
      position: stored[storageKey] || null,
      storageKey,
    }],
  });
}

async function closeImagePreview(){
  previewItem = null;
  const tabId = await getActiveTabId().catch(() => 0);
  if(!tabId) return;
  await chrome.scripting.executeScript({
    target: {tabId},
    func: () => document.getElementById('__ic_local_asset_preview__')?.remove(),
  }).catch(() => {});
}

function renderGrid(){
  els.count.textContent = images.length ? `${images.length} 张图片 / 已选 ${selected.size}` : '未扫描';
  els.import.disabled = selected.size === 0;
  if(!images.length){
    closeImagePreview();
    els.grid.className = 'grid empty';
    els.grid.innerHTML = '<div class="empty-state">没有扫描到可用图片。</div>';
    return;
  }
  els.grid.className = 'grid';
  els.grid.innerHTML = images.map((img, index) => {
    const checked = selected.has(img.url);
    const title = `${img.width || '?'} x ${img.height || '?'} · ${img.url}`;
    const kind = img.kind || mediaKindFromUrl(img.url);
    const media = kind === 'video'
      ? `<video src="${escapeHtml(img.url)}" muted playsinline preload="metadata"></video>`
      : `<img src="${escapeHtml(img.url)}" alt="" loading="lazy" referrerpolicy="no-referrer">`;
    return `<article class="card ${checked ? 'selected' : ''}" data-index="${index}" title="${escapeHtml(title)}">
      <input type="checkbox" ${checked ? 'checked' : ''}>
      <div class="thumb-wrap">
        ${media}
        ${kind === 'video' ? '<span class="media-kind">VIDEO</span>' : ''}
        <span class="broken-tip">预览不可用<br>仍可尝试导入</span>
      </div>
      <div class="meta">${escapeHtml(imageName(img.url))}</div>
    </article>`;
  }).join('');
  els.grid.querySelectorAll('img, video').forEach(media => {
    media.addEventListener('error', () => {
      if(media.tagName === 'IMG' && !media.dataset.fallbackTried){
        const clean = String(media.getAttribute('src') || '').split(/[?#]/, 1)[0];
        if(clean && clean !== media.getAttribute('src')){
          media.dataset.fallbackTried = '1';
          media.src = clean;
          return;
        }
      }
      media.classList.add('is-broken');
      media.closest('.card')?.classList.add('broken');
    });
  });
  els.grid.querySelectorAll('.card').forEach(card => {
    const checkbox = card.querySelector('input[type="checkbox"]');
    checkbox?.addEventListener('click', event => {
      event.stopPropagation();
      const item = images[Number(card.dataset.index)];
      if(!item) return;
      if(selected.has(item.url)) selected.delete(item.url);
      else selected.add(item.url);
      renderGrid();
      syncPreviewSelection();
    });
    card.addEventListener('click', event => {
      event.preventDefault();
      const item = images[Number(card.dataset.index)];
      if(!item) return;
      openImagePreview(item)
        .then(() => {
          setStatus(isSidePanelView ? '已在网页右侧打开预览。' : '已在插件旁边打开预览。');
        })
        .catch(err => setStatus(err.message || '预览失败'));
    });
  });
  syncPreviewSelection();
}

async function saveSettings(){
  savedSettings.provider = els.provider.value || savedSettings.provider || '';
  savedSettings.model = els.model.value || savedSettings.model || '';
  await chrome.storage.local.set(getSettingsPayload());
}

function getSettingsPayload(){
  return {
    server: els.server.value || '127.0.0.1:8767',
    folder: els.folder.value || '网页采集',
    classify: Boolean(els.classify.checked),
    provider: savedSettings.provider,
    model: savedSettings.model,
    prompt: els.prompt.value || '',
    settingsCollapsed,
  };
}

async function loadSettings(){
  const data = await chrome.storage.local.get(['server', 'port', 'folder', 'classify', 'provider', 'model', 'prompt', 'settingsCollapsed']);
  els.server.value = data.server || (data.port ? `127.0.0.1:${data.port}` : '127.0.0.1:8767');
  els.folder.value = data.folder || '网页采集';
  els.classify.checked = data.classify !== false;
  savedSettings.provider = data.provider || '';
  savedSettings.model = data.model || '';
  els.prompt.value = data.prompt || '';
  settingsCollapsed = data.settingsCollapsed === undefined ? true : Boolean(data.settingsCollapsed);
  updateSettingsUi();
}

async function loadProviders(){
  const res = await fetch(`${apiBase()}/api/providers`);
  if(!res.ok) throw new Error(await res.text());
  const data = await res.json();
  providers = Array.isArray(data.providers) ? data.providers : [];
  renderProviders();
}

async function testConnection(){
  await saveSettings();
  setStatus('正在连接本地服务...');
  await loadProviders();
  setStatus('连接成功，可以扫描当前页面图片。');
}

async function openSidePanel(){
  if(isSidePanelView){
    setStatus('当前已经固定在浏览器侧边栏。');
    return;
  }
  await saveSettings();
  if(!chrome.sidePanel?.open){
    setStatus('当前浏览器不支持侧边栏固定，请升级 Chrome 后重试。');
    return;
  }
  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  if(!tab?.id) throw new Error('没有可固定的当前标签页');
  await chrome.sidePanel.setOptions({tabId: tab.id, path: 'sidepanel.html', enabled: true});
  try {
    await chrome.sidePanel.open({tabId: tab.id});
  } catch (error) {
    if(!tab.windowId) throw error;
    await chrome.sidePanel.open({windowId: tab.windowId});
  }
  window.close();
}

function collectPageImages(){
  const urls = new Map();
  const imageUrlPattern = /\.(avif|gif|jpe?g|png|webp)(\?|#|$)/i;
  const videoUrlPattern = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;
  const mediaUrlPattern = /\.(avif|gif|jpe?g|png|webp|mp4|webm|mov|m4v)(\?|#|$)/i;
  const inferSizeFromUrl = url => {
    const text = String(url || '');
    const match = text.match(/[?&#](?:s|size|dimensions|resolution)=([0-9]{2,5})x([0-9]{2,5})(?:[&#]|$)/i)
      || text.match(/(?:^|[^\d])([0-9]{2,5})x([0-9]{2,5})(?:[^\d]|$)/i);
    if(!match) return {};
    return {width: Number(match[1]) || 0, height: Number(match[2]) || 0};
  };
  const add = (url, meta = {}) => {
    if(!url || typeof url !== 'string') return;
    url = url.trim().replace(/&amp;/g, '&');
    if(url.startsWith('data:') || url.startsWith('blob:')) return;
    let abs = '';
    try { abs = new URL(url, location.href).href; } catch { return; }
    if(!/^https?:\/\//i.test(abs)) return;
    const inferred = inferSizeFromUrl(abs);
    const hasInferredSize = Number(inferred.width || 0) > 0 && Number(inferred.height || 0) > 0;
    const kind = meta.kind || (videoUrlPattern.test(abs) ? 'video' : 'image');
    const old = urls.get(abs) || {};
    urls.set(abs, {
      ...old,
      ...inferred,
      ...meta,
      kind,
      width: hasInferredSize ? Number(inferred.width || 0) : (Number(meta.width || 0) || Number(old.width || 0) || 0),
      height: hasInferredSize ? Number(inferred.height || 0) : (Number(meta.height || 0) || Number(old.height || 0) || 0),
      dimSource: hasInferredSize ? 'url' : (meta.dimSource || old.dimSource || ''),
      priority: Math.max(Number(old.priority || 0), Number(meta.priority || 0)),
      url: abs,
    });
  };
  const addSrcset = (srcset, meta = {}) => {
    String(srcset || '').split(',').forEach(part => {
      const url = part.trim().split(/\s+/)[0];
      add(url, meta);
    });
  };
  const collectRoots = root => {
    const roots = [root];
    root.querySelectorAll?.('*').forEach(el => {
      if(el.shadowRoot) roots.push(...collectRoots(el.shadowRoot));
    });
    return roots;
  };
  const roots = collectRoots(document);
  const allElements = roots.flatMap(root => [...root.querySelectorAll('*')]);
  const isVisible = el => {
    if(!el?.getBoundingClientRect) return false;
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return rect.width > 2 && rect.height > 2 && style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity || 1) > 0;
  };
  const elementPriority = el => {
    if(!el?.closest) return 0;
    if(el.closest('[role="dialog"], [aria-modal="true"], dialog[open]')) return 300;
    const modal = el.closest('[class*="modal" i], [class*="dialog" i], [class*="lightbox" i], [class*="overlay" i], [class*="popover" i]');
    if(modal && isVisible(modal)) return 240;
    let current = el;
    let depth = 0;
    while(current && current !== document.documentElement && depth < 6){
      const style = getComputedStyle(current);
      const zIndex = Number.parseInt(style.zIndex, 10);
      if((style.position === 'fixed' || style.position === 'sticky') && Number.isFinite(zIndex) && zIndex >= 10 && isVisible(current)){
        return 180;
      }
      current = current.parentElement;
      depth += 1;
    }
    return 0;
  };
  roots.flatMap(root => [...root.querySelectorAll('img')]).forEach(img => {
    const rect = img.getBoundingClientRect();
    const width = img.naturalWidth || Math.round(rect.width) || 0;
    const height = img.naturalHeight || Math.round(rect.height) || 0;
    const dimSource = img.naturalWidth && img.naturalHeight ? 'natural' : (width && height ? 'rect' : '');
    const priority = elementPriority(img);
    add(img.currentSrc || img.src, {width, height, priority, dimSource});
    [
      'data-src',
      'data-original',
      'data-original-src',
      'data-lazy-src',
      'data-full',
      'data-full-src',
      'data-hires',
      'data-zoom-src',
      'data-url',
      'data-image',
      'data-image-src',
      'data-thumbnail',
      'data-thumbnail-url',
      'poster',
    ].forEach(name => {
      const value = img.getAttribute(name);
      if(value) add(value, {width, height, priority, dimSource});
    });
    addSrcset(img.getAttribute('srcset'), {width, height, priority, dimSource});
    addSrcset(img.getAttribute('data-srcset'), {width, height, priority, dimSource});
  });
  roots.flatMap(root => [...root.querySelectorAll('video')]).forEach(video => {
    const rect = video.getBoundingClientRect();
    const width = video.videoWidth || Math.round(rect.width) || 0;
    const height = video.videoHeight || Math.round(rect.height) || 0;
    const dimSource = video.videoWidth && video.videoHeight ? 'natural' : (width && height ? 'rect' : '');
    const priority = elementPriority(video);
    add(video.currentSrc || video.src, {width, height, priority, kind: 'video', dimSource});
    add(video.getAttribute('data-src'), {width, height, priority, kind: 'video', dimSource});
    video.querySelectorAll('source[src]').forEach(source => {
      add(source.getAttribute('src'), {width, height, priority, kind: 'video', dimSource});
    });
    const poster = video.getAttribute('poster');
    if(poster) add(poster, {width, height, priority: priority + 1, kind: 'image', dimSource});
  });
  roots.flatMap(root => [...root.querySelectorAll('a[href]')]).forEach(link => {
    const href = link.getAttribute('href') || '';
    if(mediaUrlPattern.test(href)) add(href, {kind: videoUrlPattern.test(href) ? 'video' : 'image'});
  });
  roots.flatMap(root => [...root.querySelectorAll('source')]).forEach(source => {
    const priority = elementPriority(source);
    addSrcset(source.getAttribute('srcset'), {priority});
    addSrcset(source.getAttribute('data-srcset'), {priority});
    const src = source.getAttribute('src') || '';
    if(src) add(src, {priority, kind: videoUrlPattern.test(src) ? 'video' : 'image'});
  });
  roots.flatMap(root => [...root.querySelectorAll('meta[property], meta[name], link[href]')]).forEach(el => {
    const key = `${el.getAttribute('property') || ''} ${el.getAttribute('name') || ''} ${el.getAttribute('rel') || ''}`.toLowerCase();
    if(!/(image|thumbnail|preload|icon)/.test(key)) return;
    add(el.getAttribute('content') || el.getAttribute('href'));
  });
  allElements.forEach(el => {
    const rect = el.getBoundingClientRect();
    const meta = {width: Math.round(rect.width) || 0, height: Math.round(rect.height) || 0, dimSource: rect.width && rect.height ? 'rect' : '', priority: elementPriority(el)};
    [
      'data-bg',
      'data-background',
      'data-src',
      'data-original',
      'data-image',
      'data-image-src',
      'data-full',
      'data-hires',
      'data-url',
      'data-video',
      'data-video-src',
      'data-video-url',
      'data-preview',
      'data-preview-src',
      'data-preview-url',
      'data-hover',
      'data-hover-src',
      'data-hover-url',
      'poster',
    ].forEach(name => {
      const value = el.getAttribute?.(name);
      add(value, {...meta, kind: videoUrlPattern.test(value || '') ? 'video' : undefined});
    });
    [...(el.attributes || [])].forEach(attr => {
      const value = attr.value || '';
      if(!value || value.length > 2000) return;
      if(mediaUrlPattern.test(value)){
        const matches = value.match(/https?:\/\/[^"'\s<>]+?\.(?:avif|gif|jpe?g|png|webp|mp4|webm|mov|m4v)(?:\?[^"'\s<>]*)?/gi) || [value];
        matches.slice(0, 20).forEach(match => add(match, {...meta, kind: videoUrlPattern.test(match) ? 'video' : undefined}));
      }
    });
    ['srcset', 'data-srcset'].forEach(name => addSrcset(el.getAttribute?.(name), meta));
    if(allElements.length <= 7000 || rect.width || rect.height){
      const bg = getComputedStyle(el).backgroundImage || '';
      [...bg.matchAll(/url\(["']?([^"')]+)["']?\)/g)].forEach(match => add(match[1], meta));
    }
  });
  roots.flatMap(root => [...root.querySelectorAll('script[type*="json"], script:not([src])')]).forEach(script => {
    const text = script.textContent || '';
    if(!text || text.length > 2_000_000) return;
    const normalizedText = text.replace(/\\u002F/gi, '/');
    const matches = normalizedText.match(/https?:\\?\/\\?\/[^"'\\\s<>]+?\.(?:avif|gif|jpe?g|png|webp|mp4|webm|mov|m4v)(?:\?[^"'\\\s<>]*)?/gi) || [];
    matches.slice(0, 500).forEach(raw => {
      const normalized = raw.replace(/\\\//g, '/');
      add(normalized, {kind: videoUrlPattern.test(normalized) ? 'video' : 'image'});
    });
  });
  return [...urls.values()]
    .filter(item => (Number(item.width || 0) >= 80 && Number(item.height || 0) >= 80) || (!item.width && !item.height))
    .sort((a, b) => {
      const priorityDelta = Number(b.priority || 0) - Number(a.priority || 0);
      if(priorityDelta) return priorityDelta;
      return (Number(b.width || 0) * Number(b.height || 0)) - (Number(a.width || 0) * Number(a.height || 0));
    })
    .slice(0, 300);
}

async function scanImages(){
  setStatus('正在扫描当前页面...');
  await closeImagePreview();
  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  const tabId = tab?.id || 0;
  if(!tabId) throw new Error('没有可扫描的当前标签页');
  const results = await chrome.scripting.executeScript({
    target: {tabId},
    func: collectPageImages,
  });
  images = results?.[0]?.result || [];
  selected = new Set();
  renderGrid();
  images = await enrichMediaSizes(images);
  renderGrid();
  setStatus(images.length ? `已扫描到 ${images.length} 张图片，请勾选需要导入的素材。` : '当前页面没有扫描到可用图片。');
}

async function importSelected(){
  const picked = images.filter(item => selected.has(item.url));
  if(!picked.length) return;
  await saveSettings();
  setStatus(`正在导入 ${picked.length} 张图片...`);
  els.import.disabled = true;
  const body = {
    folder: els.folder.value || '网页采集',
    classify: Boolean(els.classify.checked),
    provider: els.provider.value || 'comfly',
    model: els.model.value || '',
    prompt: els.prompt.value || '',
    items: picked.map(item => ({url: item.url, name: imageName(item.url)})),
  };
  const res = await fetch(`${apiBase()}/api/local-assets/import-urls`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body),
  });
  if(!res.ok) throw new Error(await res.text());
  const data = await res.json();
  const failed = (data.items || []).filter(item => !item.ok).length;
  setStatus(`导入完成：成功 ${data.count || 0} 张${failed ? `，失败 ${failed} 张` : ''}。`);
  els.import.disabled = selected.size === 0;
}

els.test.addEventListener('click', () => testConnection().catch(err => setStatus(err.message || '连接失败')));
els.github?.addEventListener('click', () => {
  chrome.tabs.create({url: 'https://github.com/hero8152/Infinite-Canvas'});
});
els.pin.addEventListener('click', () => openSidePanel().catch(err => setStatus(err.message || '固定侧边栏失败')));
els.settingsToggle.addEventListener('click', () => {
  settingsCollapsed = !settingsCollapsed;
  updateSettingsUi();
  saveSettings();
});
els.scan.addEventListener('click', () => scanImages().catch(err => setStatus(err.message || '扫描失败')));
els.import.addEventListener('click', () => importSelected().catch(err => {
  setStatus(err.message || '导入失败');
  els.import.disabled = selected.size === 0;
}));
els.selectAll.addEventListener('click', () => {
  selected = new Set(images.map(item => item.url));
  renderGrid();
  syncPreviewSelection();
});
els.clear.addEventListener('click', () => {
  selected.clear();
  renderGrid();
  syncPreviewSelection();
});
els.provider.addEventListener('change', () => {
  savedSettings.provider = els.provider.value || '';
  savedSettings.model = '';
  renderProviders();
  saveSettings();
});
[els.server, els.folder, els.classify, els.model, els.prompt].forEach(el => {
  el.addEventListener('change', () => {
    if(el === els.model) savedSettings.model = els.model.value || '';
    updateSettingsUi();
    saveSettings();
  });
  el.addEventListener('input', () => {
    if(el === els.model) savedSettings.model = els.model.value || '';
    updateSettingsUi();
    saveSettings();
  });
});

els.prompt.addEventListener('blur', () => saveSettings());
window.addEventListener('beforeunload', () => {
  savedSettings.provider = els.provider.value || savedSettings.provider || '';
  savedSettings.model = els.model.value || savedSettings.model || '';
  chrome.storage.local.set(getSettingsPayload());
});
window.addEventListener('keydown', event => {
  if(event.key === 'Escape') closeImagePreview();
});

(async function init(){
  await loadSettings();
  try { await loadProviders(); setStatus('连接成功，可以扫描当前页面图片。'); }
  catch { setStatus('请输入服务地址后点击连接，例如 192.168.1.10:3000。'); }
})();

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const canvasId = process.argv[2];
const statePath = process.argv[3];
const baseUrl = process.argv[4] || 'http://127.0.0.1:3000';
const concurrency = Math.max(1, Math.min(4, Number(process.argv[5]) || 2));

if(!canvasId || !statePath){
  console.error('Usage: node tools/codex_batch_storyboard_images.js <canvasId> <statePath> [baseUrl] [concurrency]');
  process.exit(2);
}

const state = {
  canvasId,
  status:'starting',
  total:0,
  completed:0,
  failed:0,
  active:0,
  concurrency,
  startedAt:Date.now(),
  updatedAt:Date.now(),
  attached:false,
  items:[],
  errors:[]
};

function writeState(){
  state.updatedAt = Date.now();
  fs.mkdirSync(path.dirname(statePath), {recursive:true});
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
}

function sleep(ms){
  return new Promise(resolve => setTimeout(resolve, ms));
}

function uid(prefix){
  return `${prefix}_${Math.random().toString(36).slice(2, 12)}`;
}

async function api(endpoint, options={}){
  const res = await fetch(`${baseUrl}${endpoint}`, options);
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {raw:text};
  }
  if(!res.ok){
    const detail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail || data);
    throw new Error(`${res.status} ${detail}`);
  }
  return data;
}

function collectUrls(value, urls=[]){
  if(!value) return urls;
  if(typeof value === 'string'){
    if(value.startsWith('/output/') || value.startsWith('/assets/') || value.startsWith('http://') || value.startsWith('https://')){
      urls.push(value);
    }
    return urls;
  }
  if(Array.isArray(value)){
    value.forEach(item => collectUrls(item, urls));
    return urls;
  }
  if(typeof value === 'object'){
    ['images','outputs','data','result','content','url','path','src','image_url','imageUrl','output_url','outputUrl'].forEach(key => collectUrls(value[key], urls));
  }
  return urls;
}

function loadStoryboardHelpers(){
  const context = {window:{}, console};
  context.globalThis = context;
  vm.createContext(context);
  const source = fs.readFileSync(path.join(process.cwd(), 'static/js/script-to-storyboard.js'), 'utf8');
  vm.runInContext(source, context, {filename:'script-to-storyboard.js'});
  if(!context.window.ScriptToStoryboard?.buildWholeStoryboardPrompt){
    throw new Error('ScriptToStoryboard.buildWholeStoryboardPrompt missing');
  }
  return context.window.ScriptToStoryboard;
}

async function generateOne(item){
  for(let attempt = 1; attempt <= 2; attempt++){
    item.status = 'submitting';
    item.attempt = attempt;
    writeState();
    try {
      const create = await api('/api/canvas-image-tasks', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          prompt:item.prompt,
          provider_id:'codex',
          model:'gpt-image-2',
          size:'2048x1152',
          quality:'auto',
          n:1,
          reference_images:[]
        })
      });
      item.taskId = create.task_id || '';
      item.status = 'running';
      writeState();
      for(let poll = 1; poll <= 140; poll++){
        await sleep(poll < 10 ? 3000 : 5000);
        const task = await api(`/api/canvas-image-tasks/${encodeURIComponent(item.taskId)}`);
        item.taskStatus = task.status;
        item.lastPoll = poll;
        if(task.status === 'succeeded'){
          const urls = [...new Set(collectUrls(task.result || {}))];
          if(!urls.length) throw new Error('task succeeded without image url');
          item.url = urls[0];
          item.status = 'succeeded';
          item.finishedAt = Date.now();
          writeState();
          return item;
        }
        if(task.status === 'failed'){
          throw new Error(task.error || 'image task failed');
        }
        if(poll % 4 === 0) writeState();
      }
      throw new Error('image task timed out');
    } catch (error) {
      item.error = error.message || String(error);
      item.status = attempt < 2 ? 'retrying' : 'failed';
      writeState();
      if(attempt >= 2) return item;
      await sleep(3000);
    }
  }
  return item;
}

function shouldRemoveOldOutput(node){
  if(!node || node.type !== 'smart-image') return false;
  const title = String(node.title || '');
  const settings = node.runSettings || {};
  if(title.includes('整镜故事板') || title.includes('预演图') || title.includes('GPT CLI') || title.includes('视频')) return true;
  if(settings.provider_id === 'codex' && settings.model === 'gpt-image-2') return true;
  return false;
}

async function attachResults(items){
  const fresh = (await api(`/api/canvases/${encodeURIComponent(canvasId)}`)).canvas;
  const nodes = fresh.nodes || [];
  const connections = fresh.connections || [];
  const sourceIds = new Set(items.map(item => item.sourceId));
  const oldOutputIds = new Set(
    connections
      .filter(conn => sourceIds.has(conn.from))
      .map(conn => nodes.find(node => node.id === conn.to))
      .filter(shouldRemoveOldOutput)
      .map(node => node.id)
  );
  fresh.nodes = nodes.filter(node => !oldOutputIds.has(node.id));
  fresh.connections = connections.filter(conn => !oldOutputIds.has(conn.to) && !oldOutputIds.has(conn.from));

  const sourceById = new Map(fresh.nodes.map(node => [node.id, node]));
  const now = Date.now();
  for(const item of items){
    const source = sourceById.get(item.sourceId);
    if(!source || !item.url) continue;
    const y = (Number(source.y) || 0) + Math.max(Number(source.h || 600), 600) + 180;
    const imageNode = {
      id:uid('smart'),
      type:'smart-image',
      x:Number(source.x) || 0,
      y,
      title:`${item.shotNumber || 'shot'} GPT CLI storyboard`,
      images:[{
        url:item.url,
        name:`${item.shotNumber || 'shot'}-storyboard-gpt-cli.png`,
        kind:'image',
        generatedResult:true
      }],
      scale:0.72,
      runPrompt:item.prompt,
      runModelPrompt:item.prompt,
      runPromptRefs:[],
      runInputRefs:[],
      runSettings:{
        engine:'api',
        apiKind:'image',
        provider_id:'codex',
        model:'gpt-image-2',
        ratio:'wide',
        resolution:'2k',
        quality:'auto',
        count:1
      },
      outputKind:'image',
      completedAt:now,
      runFinishedAt:now,
      created_at:now
    };
    fresh.nodes.push(imageNode);
    fresh.connections.push({id:uid('c'), from:source.id, to:imageNode.id, kind:'input'});
  }

  await api(`/api/canvases/${encodeURIComponent(canvasId)}`, {
    method:'PUT',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      title:fresh.title || 'Untitled',
      icon:fresh.icon || 'layers',
      nodes:fresh.nodes,
      connections:fresh.connections,
      viewport:fresh.viewport || {},
      logs:fresh.logs || [],
      settings:{...(fresh.settings || {}), engine:'api', apiKind:'image', provider_id:'codex', model:'gpt-image-2', ratio:'wide', resolution:'2k', quality:'auto', count:1},
      client_id:'codex-batch-storyboard-images',
      base_updated_at:fresh.updated_at || 0
    })
  });
  state.attached = true;
  state.attachedAt = Date.now();
  writeState();
}

async function main(){
  writeState();
  const helpers = loadStoryboardHelpers();
  const data = await api(`/api/canvases/${encodeURIComponent(canvasId)}`);
  const cards = (data.canvas.nodes || [])
    .filter(node => node.type === 'storyboard-card' && node.cardKind === 'storyboard')
    .sort((a, b) => (Number(a.x) || 0) - (Number(b.x) || 0) || (Number(a.y) || 0) - (Number(b.y) || 0));
  state.items = cards.map((card, index) => ({
    index:index + 1,
    sourceId:card.id,
    shotNumber:card.shot?.shotNumber || `shot-${index + 1}`,
    title:card.title || '',
    prompt:helpers.buildWholeStoryboardPrompt(card.shot || {}),
    status:'queued'
  }));
  state.total = state.items.length;
  state.status = 'running';
  writeState();

  let cursor = 0;
  async function worker(){
    while(cursor < state.items.length){
      const item = state.items[cursor++];
      state.active++;
      writeState();
      const result = await generateOne(item);
      state.active--;
      if(result.status === 'succeeded') state.completed++;
      else {
        state.failed++;
        state.errors.push({index:result.index, shotNumber:result.shotNumber, error:result.error || 'failed'});
      }
      writeState();
    }
  }

  await Promise.all(Array.from({length:Math.min(concurrency, state.items.length)}, worker));
  if(state.failed){
    state.status = 'failed';
    writeState();
    process.exitCode = 1;
    return;
  }
  await attachResults(state.items);
  state.status = 'complete';
  state.finishedAt = Date.now();
  writeState();
}

main().catch(error => {
  state.status = 'error';
  state.errors.push({error:error.message || String(error), stack:error.stack || ''});
  writeState();
  console.error(error);
  process.exit(1);
});

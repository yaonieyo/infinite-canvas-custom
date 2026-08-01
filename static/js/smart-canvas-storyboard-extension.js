// Storyboard workflow extension merged from feature package 20260728.
// Loaded after the current smart-canvas.js; it defines only missing storyboard helpers.

var shotAssetPickerStates = window.shotAssetPickerStates || new Map();
window.shotAssetPickerStates = shotAssetPickerStates;
var smartStoryboardDelegationReady = window.smartStoryboardDelegationReady || false;
const composerPromptTools = document.getElementById('composerPromptTools');
const promptVersionStatus = document.getElementById('promptVersionStatus');
const promptOptimizeProfileSelect = document.getElementById('promptOptimizeProfileSelect');
const promptOptimizeBtn = document.getElementById('promptOptimizeBtn');
const promptApplyOptimizedBtn = document.getElementById('promptApplyOptimizedBtn');
const promptRestoreOriginalBtn = document.getElementById('promptRestoreOriginalBtn');
const promptLockBtn = document.getElementById('promptLockBtn');
const promptOptimizedPreview = document.getElementById('promptOptimizedPreview');

function smartMentionKey(value){
    return String(value || '')
        .replace(/^@+/, '')
        .trim()
        .replace(/\s+/g, '')
        .toLowerCase();
}

function referenceImageDedupeKeys(img){
    if(!img || typeof img !== 'object') return [];
    const keys = [];
    const push = value => {
        const key = String(value || '').trim();
        if(key && !keys.includes(key)) keys.push(key);
    };
    push(img.assetCandidateKey);
    push(img.candidateKey);
    push(img.assetId ? `asset|${img.assetId}` : '');
    push(img.asset_id ? `asset|${img.asset_id}` : '');
    push(img.id ? `id|${img.id}` : '');
    if(typeof inputRefKey === 'function') push(inputRefKey(img));
    push(img.url ? `url|${img.url}` : '');
    push(img.name ? `name|${smartMentionKey(img.name)}` : '');
    return keys;
}

function storyboardMediaKindForItem(img){
    if(typeof mediaKindForItem === 'function') return mediaKindForItem(img);
    if(img?.kind) return img.kind;
    const url = String(img?.url || '').split('?')[0].toLowerCase();
    if(/\.(mp4|mov|webm|m4v)$/.test(url)) return 'video';
    if(/\.(mp3|wav|m4a|aac|ogg)$/.test(url)) return 'audio';
    return 'image';
}

function storyboardUniqueRefs(images){
    if(typeof uniqueReferenceImages === 'function') return uniqueReferenceImages(images);
    const refs = [];
    const seen = new Set();
    (images || []).forEach((img, index) => {
        if(!img?.url || seen.has(img.url)) return;
        seen.add(img.url);
        refs.push({
            ...img,
            name:img.name || img.alias || `图${refs.length + 1}`,
            role:img.role || `image_${refs.length + 1}`,
            imageIndex:Number.isFinite(Number(img.imageIndex)) ? Number(img.imageIndex) : index
        });
    });
    return refs;
}

function storyboardImagesForNode(node){
    if(!node) return [];
    if(typeof outputImagesForNode === 'function'){
        const ctx = typeof smartLoopContext !== 'undefined' ? smartLoopContext : {};
        return outputImagesForNode(node, false, ctx).filter(img => img?.url);
    }
    if(typeof imagesForNode === 'function') return imagesForNode(node).filter(img => img?.url);
    return (node.images || []).map((img, index) => ({...img, nodeId:node.id, imageIndex:index})).filter(img => img?.url);
}

function storyboardManualRefsForNode(node){
    if(!node) return [];
    if(typeof manualReferenceImagesFor === 'function') return manualReferenceImagesFor(node).filter(img => img?.url);
    return (node.manualInputRefs || []).map((img, index) => ({...img, imageIndex:img.imageIndex ?? index, manualAdded:true})).filter(img => img?.url);
}

function immediateInputImageCandidatesFor(source){
    if(!source?.id) return [];
    const inputs = typeof inputNodesFor === 'function'
        ? inputNodesFor(source)
        : (canvas?.connections || [])
            .filter(conn => conn?.to === source.id && (conn.kind || 'flow') === 'input')
            .map(conn => nodes.find(node => node.id === conn.from))
            .filter(Boolean);
    const refs = [];
    inputs.forEach(input => {
        [...storyboardImagesForNode(input), ...storyboardManualRefsForNode(input)].forEach((img, index) => {
            if(!img?.url) return;
            refs.push({
                ...img,
                kind:storyboardMediaKindForItem(img),
                name:img.name || img.alias || input.title || `参考图${refs.length + 1}`,
                alias:img.alias || img.name || input.title || `参考图${refs.length + 1}`,
                nodeId:img.nodeId || input.id,
                sourceNodeId:img.nodeId || input.id,
                sourceNodeTitle:input.title || input.frameTitle || '',
                sourceTargetId:source.id,
                sourceTargetType:source.type,
                imageIndex:Number.isFinite(Number(img.imageIndex)) ? Number(img.imageIndex) : index
            });
        });
    });
    return storyboardUniqueRefs(refs);
}

function smartResolvePlainMentionImages(prompt=''){
    const text = String(prompt || '');
    if(!text.includes('@')) return [];
    const wanted = new Set();
    text.replace(/@([^\s@，,；;。:：=]+)/g, (_, name) => {
        const key = smartMentionKey(name);
        if(key) wanted.add(key);
        return '';
    });
    if(!wanted.size) return [];
    const candidates = [];
    const allNodes = Array.isArray(nodes) ? nodes : [];
    allNodes.forEach(node => {
        [...storyboardImagesForNode(node), ...storyboardManualRefsForNode(node), ...(node.runPromptRefs || []), ...(node.runInputRefs || [])].forEach((img, index) => {
            if(!img?.url) return;
            const names = [img.name, img.alias, img.assetLabel, node.title, node.frameTitle].map(smartMentionKey).filter(Boolean);
            if(!names.some(name => wanted.has(name))) return;
            candidates.push({
                ...img,
                kind:storyboardMediaKindForItem(img),
                name:img.name || img.alias || node.title || `参考图${candidates.length + 1}`,
                alias:img.alias || img.name || node.title || `参考图${candidates.length + 1}`,
                nodeId:img.nodeId || node.id,
                imageIndex:Number.isFinite(Number(img.imageIndex)) ? Number(img.imageIndex) : index
            });
        });
    });
    if(typeof assetCategories === 'function'){
        assetCategories('image').forEach(cat => {
            (cat.items || []).forEach((item, index) => {
                const names = [item.name, item.alias, cat.name].map(smartMentionKey).filter(Boolean);
                if(!item?.url || !names.some(name => wanted.has(name))) return;
                candidates.push({
                    url:item.url,
                    kind:storyboardMediaKindForItem(item),
                    name:item.name || item.alias || `资产${index + 1}`,
                    alias:item.alias || item.name || `资产${index + 1}`,
                    assetId:item.id || '',
                    asset_uris:typeof assetRegisteredUris === 'function' ? assetRegisteredUris(item) : {}
                });
            });
        });
    }
    return storyboardUniqueRefs(candidates);
}

function createScriptStoryboardNode(x, y, options={}){
    if(!options.skipUndo) pushUndo();
    const providerId = resolveChatProviderId();
    const node = {
        id:uid('s2s'),
        type:'script-storyboard',
        x,
        y,
        w:430,
        h:610,
        title:'分镜转故事板',
        storyboardMode:'segment',
        scriptText:'',
        llmProvider:providerId,
        llmModel:resolveChatModel('', providerId),
        storyboardPrompt:window.ScriptToStoryboard?.promptForMode?.('segment') || window.ScriptToStoryboard?.DEFAULT_PROMPT || '',
        shots:[],
        running:false,
        lastAiError:'',
        created_at:Date.now()
    };
    nodes.push(node);
    if(options.select !== false) selectedId = node.id;
    render();
    scheduleSave();
    return node;
}

function createAssetHubNode(x, y, options={}){
    if(!options.skipUndo) pushUndo();
    const node = {
        id:uid('assetHub'),
        type:'asset-hub',
        x,
        y,
        w:420,
        h:520,
        title:'全剧资产中枢',
        allowMissing:true,
        useLibrary:true,
        inheritPrevious:true,
        created_at:Date.now()
    };
    nodes.push(node);
    if(options.select !== false) selectedId = node.id;
    render();
    scheduleSave();
    return node;
}

function createShotAssetCollectorNode(x, y, options={}){
    if(!options.skipUndo) pushUndo();
    const node = {
        id:uid('shotAssets'),
        type:'shot-asset-collector',
        x,
        y,
        w:560,
        h:650,
        title:'故事板人物收集器',
        shotAssetBindings:{},
        shotAssetNoAsset:{},
        continuityOverrides:{},
        useAssetLibrary:true,
        manualSelectionOnly:false,
        useCanvasInputs:true,
        inheritPrevious:true,
        enforcePreflight:false,
        preflightExpanded:true,
        created_at:Date.now()
    };
    nodes.push(node);
    if(options.select !== false) selectedId = node.id;
    render();
    scheduleSave();
    return node;
}

function smartStoryboardFieldRows(fields){
    return fields.map(([label, value]) => `<div class="storyboard-field"><b>${escapeHtml(label)}</b><span>${escapeHtml(value || '-')}</span></div>`).join('');
}

function smartStoryboardInputBodyHtml(node){
    if(node.running && (!node.runStartedAt || nowMs() - Number(node.runStartedAt) > 15 * 60 * 1000)){
        node.running = false;
        node.runFinishedAt = nowMs();
        node.runElapsedMs = Math.max(0, Number(node.runFinishedAt) - Number(node.runStartedAt || node.runFinishedAt));
    }
    const previousMode = node.storyboardMode;
    node.storyboardMode = 'segment';
    node.storyboardModeMigrated = true;
    const segmentPrompt = window.ScriptToStoryboard?.promptForMode?.('segment') || window.ScriptToStoryboard?.STORY_SEGMENT_PROMPT || '';
    const legacyPrompt = !node.storyboardPrompt || node.storyboardPrompt === window.ScriptToStoryboard?.DEFAULT_PROMPT || node.storyboardPrompt === window.ScriptToStoryboard?.PURE_SCRIPT_PROMPT || /用户输入的是一段约15秒的完整内容|请把整段内容保留为一个[“\"]故事段|比如总时长40秒|0—15秒、15—30秒、30—40秒/.test(String(node.storyboardPrompt || ''));
    if(legacyPrompt || previousMode !== 'segment'){
        node.storyboardPrompt = segmentPrompt;
        if(typeof scheduleSave === 'function') scheduleSave();
    }
    node.storyboardPrompt = node.storyboardPrompt || segmentPrompt;
    node.llmProvider = resolveChatProviderId(node.llmProvider || '');
    node.llmModel = resolveChatModel(node.llmModel || '', node.llmProvider);
    const continuity = node.continuityReport || {};
    const assets = Array.isArray(node.referenceAssets) ? node.referenceAssets : [];
    return `<div class="script-storyboard-body">
        <div class="storyboard-mode-tabs">
            <button class="storyboard-control active" type="button" disabled>固定：按10—15秒故事段输出</button>
        </div>
        <label class="storyboard-label">完整长剧本或详细分镜输入</label>
        <textarea class="storyboard-control storyboard-script" placeholder="粘贴完整内容，系统会按剧情连续切成10—15秒故事板，不会拆成3秒镜头卡...">${escapeHtml(node.scriptText || '')}</textarea>
        <div class="storyboard-model-row">
            <select class="storyboard-control storyboard-provider">${chatProviderOptions(node.llmProvider)}</select>
            <select class="storyboard-control storyboard-model">${chatModelOptions(node.llmModel, node.llmProvider)}</select>
        </div>
        <div class="storyboard-prompt-head"><span>内设提示词</span><button class="storyboard-control storyboard-reset" type="button">恢复默认</button></div>
        <textarea class="storyboard-control storyboard-prompt">${escapeHtml(node.storyboardPrompt)}</textarea>
        ${continuity.summary ? `<div class="storyboard-summary"><b>连续性检查</b><span>${escapeHtml(continuity.summary)}</span></div>` : ''}
        ${assets.length ? `<div class="storyboard-summary"><b>参考资产</b><span>${escapeHtml(assets.slice(0, 8).map(item => item.name || item).join('、'))}${assets.length > 8 ? ` 等 ${assets.length} 项` : ''}</span></div>` : ''}
        ${node.lastAiError ? `<div class="storyboard-warn">AI 调用失败，已使用本地拆分：${escapeHtml(node.lastAiError.slice(0, 80))}</div>` : ''}
        <button class="storyboard-control storyboard-run ${node.running ? 'running' : ''}" type="button" ${node.running ? 'disabled' : ''}><i data-lucide="sparkles"></i><span>${node.running ? '生成中...' : '生成10—15秒故事板'}</span></button>
    </div>`;
}

function smartStoryboardGroupBodyHtml(node){
    return `<div class="storyboard-group-body">
        <div class="storyboard-group-shot">${escapeHtml(node.shotNumber || '镜头')}</div>
        <div class="storyboard-group-sub">2 张卡 · 已关联输入节点</div>
        <div class="storyboard-group-reserved">已预留：生图提示词卡</div>
    </div>`;
}

function smartStoryboardFramePrompt(node, frameIndex){
    const frame = node?.shot?.frames?.[frameIndex] || {};
    const prompt = window.ScriptToStoryboard?.buildFramePrompt ? window.ScriptToStoryboard.buildFramePrompt(node.shot || {}, frame, frameIndex) : (frame.prompt || frame.description || '');
    return appendStoryboardImagePromptGuard(prompt, node?.shot || {}, 1);
}

function smartStoryboardVideoPrompt(node){
    const shot = node?.shot || {};
    const raw = shot.videoPrompt;
    return window.ScriptToStoryboard?.videoPromptText?.(shot)
        || (typeof raw === 'string' ? raw : '')
        || (raw && typeof raw === 'object' ? (raw.text || raw.prompt || raw.content || '') : '')
        || shot.sourceText
        || '';
}

function storyboardPersonListForGuard(shot){
    return String(shot?.subjects || '')
        .split(/[、，,\/\s]+/)
        .map(item => item.trim())
        .filter(item => item && !/人物|主体|场景|镜头|室内|室外|手机|车|电动车/.test(item));
}

function storyboardImagePromptGuard(shot, frameCount=0){
    const people = storyboardPersonListForGuard(shot);
    const guard = [
        '画幅与排版：必须生成横版16:9、横幅2K故事板图，不生成竖版、手机长图或纵向拼图。',
        '每个故事板帧/子画格本身也必须是横向影视画面，不要把单帧画成9:16竖屏人物海报，不要三张竖构图并排。',
        `帧数按剧情需要排布，当前约${Math.max(1, Number(frameCount) || 1)}帧；不强行四宫格，不为了凑格子新增无意义画面。`,
        '如果是多帧总览，按时间顺序横向优先排列；3帧就做横向三格，2帧就做横向双格，5帧以上才允许自然换行，但整张图和每个子画格仍保持横版。'
    ];
    const source = `${shot?.sourceText || ''}\n${shot?.videoPrompt?.text || ''}\n${shot?.visualExtract?.leftRight || ''}\n${shot?.visualExtract?.focusRelation || ''}`;
    const multi = people.length >= 2 || /两人|二人|对话|面对|过肩|正反打|看着|避开/.test(source);
    if(multi){
        guard.push(
            '多人镜头构图保护：不要生成两人同等大小、同等清晰、侧脸对侧脸的平面对站，不要婚纱写真式摆拍对视。',
            '必须先明确主视觉人物，焦点只落在主视觉人物的眼睛、表情或动作上；另一人作为前景肩线、后脑、侧脸轮廓、虚化遮挡或空间关系存在。',
            '画面要有前景、中景、后景层次，人物站位错开，使用过肩、一虚一实、三分之二侧面、视线错开或前景遮挡来表达剧情。'
        );
    }
    return guard.join('\n');
}

function appendStoryboardImagePromptGuard(prompt, shot, frameCount=0){
    const text = String(prompt || '').trim();
    const guard = storyboardImagePromptGuard(shot, frameCount);
    return text.includes('画幅与排版：必须生成横版16:9') ? text : `${text}\n\n${guard}`.trim();
}

function smartAssetTextKey(value){
    return String(value || '').toLowerCase().replace(/\.[a-z0-9]+$/i, '').replace(/[\s_+\-｜|【】\[\]()（）]/g, '');
}

function smartAssetCategoryForText(text){
    const raw = String(text || '');
    if(/场景|空间|室内|室外|街道|房间|会面|婚礼|婚纱店|酒店|餐厅|小区|走廊|门口|电梯|办公室|车内|夜路|城市|窗|灯/.test(raw)) return 'scene';
    if(/服装|衣服|上衣|外套|裙|婚纱|西装|校服|工装|外卖服|造型|妆造|穿/.test(raw)) return 'wardrobe';
    if(/道具|手机|戒指|花|包|车|电动车|外卖|钥匙|文件|照片|水杯|门票/.test(raw)) return 'prop';
    return 'character';
}

function smartAssetCategoryLabel(cat){
    return cat === 'scene' ? '场景' : cat === 'wardrobe' ? '服装' : cat === 'prop' ? '道具' : cat === 'character' ? '人物' : '其他';
}

function smartAssetNameParts(name){
    return String(name || '').split(/[、，,\/\s|｜_\-]+/).map(s => s.trim()).filter(Boolean);
}

function smartStoryboardAssetText(shot, extra=''){
    const visual = shot?.visualExtract && typeof shot.visualExtract === 'object' ? Object.values(shot.visualExtract).join('\n') : '';
    const frames = Array.isArray(shot?.frames) ? shot.frames.map(frame => [frame.description, frame.composition, frame.emotion, frame.prompt].filter(Boolean).join('\n')).join('\n') : '';
    return [shot?.shotNumber, shot?.timeRange, shot?.shotSize, shot?.cameraType, shot?.focalLength, shot?.subjects, shot?.emotionChange, shot?.cameraMove, shot?.sourceText, shot?.audio, shot?.transition, visual, frames, extra].filter(Boolean).join('\n');
}

function smartStoryboardAssetFields(shot){
    const text = smartStoryboardAssetText(shot);
    const people = shotAssetCharacterNamesForCard({shot}).slice(0, 6);
    const timeState = (text.match(/三年前|三年后|现在|当下|过去|回忆|傍晚|夜晚|清晨|白天|深夜|雨天|婚礼当天/) || [''])[0];
    const scene = (text.match(/室内会面空间|婚礼现场|婚纱店|酒店|餐厅|小区|走廊|电梯|办公室|车内|街道|夜路|房间|门口|城市空间|室内|室外/) || [''])[0];
    // 服装、手提袋、虚化工作人员等属于画面提示词，不自动变成资产需求；需要时可在人物行里手动绑定并选择用途。
    const wardrobe = '';
    const props = [];
    return {
        main:people[0] || '',
        second:people[1] || '',
        third:people[2] || '',
        people,
        scene,
        timeState,
        wardrobe,
        props
    };
}

function smartAssetConnectedNodeIds(hub){
    const ids = new Set();
    (canvas?.connections || []).forEach(conn => {
        if(conn?.from === hub?.id && conn?.to) ids.add(conn.to);
        if(conn?.to === hub?.id && conn?.from) ids.add(conn.from);
    });
    ids.delete(hub?.id);
    return [...ids];
}

function smartAssetHubImageRecords(hub){
    if(!hub) return [];
    const records = [];
    const seen = new Set();
    const pushRecord = (img, sourceNode=null, source='canvas') => {
        if(!img?.url) return;
        const keys = referenceImageDedupeKeys(img);
        if(keys.some(key => seen.has(key))) return;
        keys.forEach(key => seen.add(key));
        const name = img.name || img.alias || sourceNode?.title || `参考图${records.length + 1}`;
        const category = img.assetRole || img.category || smartAssetCategoryForText(`${name} ${sourceNode?.title || ''}`);
        records.push({
            ...img,
            name,
            alias:img.alias || name,
            category,
            source,
            sourceNodeId:sourceNode?.id || img.nodeId || '',
            nodeId:img.nodeId || sourceNode?.id || img.nodeId,
            imageIndex:Number.isFinite(Number(img.imageIndex)) ? Number(img.imageIndex) : records.length
        });
    };
    smartAssetConnectedNodeIds(hub).forEach(id => {
        const node = nodes.find(n => n.id === id);
        if(!node || ['script-storyboard','storyboard-card','image-prompt-card','asset-hub'].includes(node.type)) return;
        imagesForNode(node).forEach((img, index) => pushRecord({...img, imageIndex:Number.isFinite(Number(img.imageIndex)) ? Number(img.imageIndex) : index}, node, 'canvas'));
        manualReferenceImagesFor(node).forEach(img => pushRecord(img, node, 'manual'));
    });
    if(hub.useLibrary !== false){
        assetCategories('image').forEach(cat => {
            (cat.items || []).forEach((item, index) => {
                if(!item?.url) return;
                const img = assetNodeImageFromItem(item, cat.name || `asset-${index + 1}`);
                pushRecord({...img, categoryName:cat.name || '', asset_uris:assetRegisteredUris(item)}, {id:`asset:${cat.id || 'library'}:${index}`, title:item.name || cat.name || ''}, 'library');
            });
        });
    }
    return records;
}

function smartAssetHubForStoryboard(source){
    const hubs = nodes.filter(n => n.type === 'asset-hub');
    if(!hubs.length) return null;
    const sourceIds = new Set([source?.id, source?.sourceStoryboardId].filter(Boolean));
    if(source?.assetHubId) {
        const locked = hubs.find(h => h.id === source.assetHubId);
        if(locked) return locked;
    }
    const linked = hubs.find(hub => (canvas?.connections || []).some(conn => {
        if(!sourceIds.size) return false;
        return (conn.from === hub.id && sourceIds.has(conn.to)) || (conn.to === hub.id && sourceIds.has(conn.from));
    }));
    return linked || hubs[0] || null;
}

function smartScoreAssetForStoryboard(asset, shot, prompt=''){
    const fields = smartStoryboardAssetFields(shot);
    const text = smartStoryboardAssetText(shot, prompt);
    const textKey = smartAssetTextKey(text);
    const aliases = [asset.name, asset.alias, asset.categoryName, ...(Array.isArray(asset.aliases) ? asset.aliases : []), ...smartAssetNameParts(asset.name)].filter(Boolean);
    let score = 0;
    aliases.forEach(alias => {
        const key = smartAssetTextKey(alias);
        if(!key) return;
        if(textKey.includes(key)) score += key.length >= 2 ? 12 : 3;
        fields.people.forEach(person => {
            const p = smartAssetTextKey(person);
            if(p && (key.includes(p) || p.includes(key))) score += 18;
        });
    });
    if(asset.category === 'scene' && fields.scene) score += 7;
    if(asset.category === 'wardrobe' && fields.wardrobe) score += 7;
    if(asset.category === 'prop' && fields.props.some(prop => text.includes(prop) && aliases.some(a => String(a).includes(prop)))) score += 9;
    if(fields.timeState && aliases.some(a => String(a).includes(fields.timeState))) score += 5;
    return score;
}

function smartStoryboardAssetMatch(source, prompt=''){
    const hub = smartAssetHubForStoryboard(source);
    const fields = smartStoryboardAssetFields(source?.shot || {});
    if(!hub) return {hub:null, fields, refs:[], matched:[], missingPeople:fields.people, missingScene:fields.scene || '', allowMissing:true};
    const scored = smartAssetHubImageRecords(hub)
        .map(asset => ({asset, score:smartScoreAssetForStoryboard(asset, source?.shot || {}, prompt)}))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score);
    const refs = uniqueReferenceImages(scored.map(item => ({...item.asset, matchScore:item.score, role:item.asset.category || 'reference'})));
    const matchedNames = new Set(scored.flatMap(item => [item.asset.name, item.asset.alias, ...(Array.isArray(item.asset.aliases) ? item.asset.aliases : [])].filter(Boolean).map(smartAssetTextKey)));
    const missingPeople = fields.people.filter(person => {
        const key = smartAssetTextKey(person);
        return key && ![...matchedNames].some(name => name.includes(key) || key.includes(name));
    });
    const hasScene = !fields.scene || scored.some(item => item.asset.category === 'scene');
    return {hub, fields, refs, matched:scored, missingPeople, missingScene:hasScene ? '' : fields.scene, allowMissing:hub.allowMissing !== false};
}
const STORYBOARD_ASSET_ROLES = [
    ['main', '主角'],
    ['second', '第二人物'],
    ['third', '第三人物'],
    ['scene', '场景'],
    ['wardrobe', '服装'],
    ['prop', '道具'],
    ['style', '风格参考'],
    ['other', '其他参考'],
    ['ignore', '不使用']
];

function storyboardAssetRoleLabel(role){
    const hit = STORYBOARD_ASSET_ROLES.find(item => item[0] === role);
    return hit ? hit[1] : '其他参考';
}

function storyboardAssetBindingKey(img){
    return inputRefKey(img) || (img?.url ? `url|${img.url}` : '');
}

function storyboardAssetBindingFor(target, img){
    const key = storyboardAssetBindingKey(img);
    const bindings = target?.storyboardAssetBindings && typeof target.storyboardAssetBindings === 'object' ? target.storyboardAssetBindings : {};
    return key ? (bindings[key] || null) : null;
}

function setStoryboardAssetBinding(target, img, patch={}){
    if(!target || !img?.url) return;
    const key = storyboardAssetBindingKey(img);
    if(!key) return;
    if(!target.storyboardAssetBindings || typeof target.storyboardAssetBindings !== 'object') target.storyboardAssetBindings = {};
    const prev = target.storyboardAssetBindings[key] || {};
    const next = {
        role:patch.role || prev.role || 'other',
        label:patch.label != null ? String(patch.label || '') : (prev.label || img.name || img.alias || ''),
        url:img.url,
        nodeId:img.nodeId || prev.nodeId || '',
        imageIndex:Number.isFinite(Number(img.imageIndex)) ? Number(img.imageIndex) : prev.imageIndex,
        updatedAt:Date.now()
    };
    target.storyboardAssetBindings[key] = next;
}

function storyboardAssetGroupsFor(card){
    const groups = [];
    const smartGroup = smartGroupContainingNode(card?.id);
    if(smartGroup) groups.push(smartGroup);
    (canvas?.connections || []).forEach(conn => {
        if(conn?.to !== card?.id && conn?.from !== card?.id) return;
        const otherId = conn.to === card.id ? conn.from : conn.to;
        const group = nodes.find(n => n.id === otherId && n.type === 'storyboard-group');
        if(group && !groups.some(item => item.id === group.id)) groups.push(group);
    });
    return groups;
}

function storyboardGroupAssetCandidatesFor(group){
    if(!group) return [];
    const refs = [];
    const seen = new Set();
    if(isSmartGroupNode(group)){
        imagesForNode(group).forEach((img, index) => {
            const keys = referenceImageDedupeKeys(img);
            if(!img?.url || keys.some(key => seen.has(key))) return;
            keys.forEach(key => seen.add(key));
            refs.push({
                ...img,
                imageIndex:Number.isFinite(Number(img.imageIndex)) ? Number(img.imageIndex) : index,
                sourceTargetId:group.id,
                sourceTargetType:group.type,
                inherited:true
            });
        });
    }
    immediateInputImageCandidatesFor(group).forEach(img => {
        const keys = referenceImageDedupeKeys(img);
        if(!img?.url || keys.some(key => seen.has(key))) return;
        keys.forEach(key => seen.add(key));
        refs.push({...img, inherited:true, sourceTargetId:group.id, sourceTargetType:group.type});
    });
    return refs;
}

function storyboardManualAssetCandidates(source){
    if(!source) return [];
    const refs = [];
    const seen = new Set();
    const push = (img, target, inherited=false) => {
        if(!img?.url || !target || seen.has(`${target.id}|${storyboardAssetBindingKey(img)}`)) return;
        seen.add(`${target.id}|${storyboardAssetBindingKey(img)}`);
        const binding = storyboardAssetBindingFor(target, img) || {};
        refs.push({
            ...img,
            sourceTargetId:target.id,
            sourceTargetType:target.type,
            inherited,
            assetRole:binding.role || img.assetRole || img.category || 'other',
            assetLabel:binding.label || img.name || img.alias || ''
        });
    };
    storyboardAssetGroupsFor(source).forEach(group => {
        storyboardGroupAssetCandidatesFor(group).forEach(img => push(img, group, true));
    });
    immediateInputImageCandidatesFor(source).forEach(img => push(img, source, false));
    return refs;
}

function storyboardManualAssetRefsFor(source){
    return uniqueReferenceImages(storyboardManualAssetCandidates(source)
        .filter(img => (img.assetRole || 'other') !== 'ignore')
        .map(img => ({
            ...img,
            name:img.assetLabel || img.name || storyboardAssetRoleLabel(img.assetRole),
            role:img.assetRole || 'reference',
            manualStoryboardAsset:true
        })));
}

function shotAssetDemandKey(type, label){
    return `${type}:${smartMentionKey(label)}`;
}

function shotAssetDemandTypeLabel(type){
    return type === 'shot' ? '\u955c\u5934\u53c2\u8003' : type === 'character' ? '\u4eba\u7269' : type === 'scene' ? '\u573a\u666f' : type === 'wardrobe' ? '\u670d\u88c5' : type === 'prop' ? '\u9053\u5177' : '\u5176\u4ed6';
}

function shotAssetCardLabel(card){
    return card?.shot?.shotNumber || card?.title || '镜头';
}

function shotAssetCleanCharacterName(value){
    return String(value || '')
        .replace(/[（(][^）)]*[）)]/g, '')
        .replace(/^(?:主要人物|主体人物|人物|角色)[：:\s]*/g, '')
        .replace(/(?:是一名|是一个|位于|站在|坐在|穿着).*$/g, '')
        .replace(/(?:声音|看着|低头|抬头|哭着|苦笑|哽咽|发抖|咬着|嘴硬|笑|哭|喊|说|转身|走向|离开|提示|补一句|起).*$/g, '')
        .trim();
}

function shotAssetLooksLikeNamedCharacter(value){
    const name = shotAssetCleanCharacterName(value);
    if(!name || name.length > 12) return false;
    if(/^(?:他|她|他们|她们|有人|众人|人群|路人|工作人员|服务员|店员|宾客|同事|保安|司机|医生|护士|群众|无|未知|-)$/.test(name)) return false;
    if(/旁白|文字|字幕|手机|导航|订单|平台|提示音|画面|镜头|场景|酒店|大厅|入口|门口|宴会厅|电梯|走廊|通道|房间|街道|婚礼|彩排|迎宾|指示牌|标牌|牌子|外卖|手提袋|袋|箱|手机|婚纱|服装|衣服|裙|西装|车辆|汽车|电动车|花束|道具|三年前|三年后|回忆|现在/.test(name)) return false;
    return true;
}

function shotAssetCharacterNamesForCard(card){
    const shot = card?.shot || {};
    const names = [];
    const add = value => {
        const name = shotAssetCleanCharacterName(value);
        if(!shotAssetLooksLikeNamedCharacter(name)) return;
        if(!names.includes(name)) names.push(name);
    };
    const subjectValues = String(shot.subjects || '')
        .split(/[、，,\/|｜;；\n]+/)
        .map(value => value.trim())
        .filter(Boolean);
    subjectValues.forEach(add);
    const visibleSubjectKeys = new Set(names.map(smartMentionKey));
    (Array.isArray(shot.referenceAssets) ? shot.referenceAssets : []).forEach(item => {
        if(!item || typeof item !== 'object' || !/character|人物|角色/i.test(String(item.type || ''))) return;
        const name = shotAssetCleanCharacterName(item.name);
        if(!shotAssetLooksLikeNamedCharacter(name)) return;
        // AI有时会把迎宾牌上的姓名也列为人物资产；只有主体栏实际出现的人才进入收集器。
        if(visibleSubjectKeys.size && !visibleSubjectKeys.has(smartMentionKey(name))) return;
        add(name);
    });
    const sourceText = String(shot.sourceText || '');
    for(const match of sourceText.matchAll(/(?:^|\n)\s*([\u4e00-\u9fa5A-Za-z][\u4e00-\u9fa5A-Za-z0-9·]{0,11})\s*[:：]\s*(?=[“"'])/g)) add(match[1]);
    return names;
}

function shotAssetDemandItemsForCard(card){
    if(!card?.id) return [];
    const shotLabel = shotAssetCardLabel(card);
    const characters = shotAssetCharacterNamesForCard(card);
    const fields = smartStoryboardAssetFields(card.shot || {});
    const items = [];
    if(!characters.length){
        items.push({
            key:shotAssetDemandKey('character', `${card.id}:pending`),
            type:'character',
            label:'人物待指定',
            cardId:card.id,
            shotLabel
        });
    } else {
        characters.forEach(name => items.push({
            key:shotAssetDemandKey('character', name),
            type:'character',
            label:name,
            cardId:card.id,
            shotLabel
        }));
    }
    if(fields.scene){
        items.push({
            key:shotAssetDemandKey('scene', fields.scene),
            type:'scene',
            label:fields.scene,
            cardId:card.id,
            shotLabel
        });
    }
    return items;
}

function storyboardCardsFromNode(node){
    if(!node) return [];
    if(node.type === 'storyboard-card' && node.cardKind === 'storyboard') return [node];
    if(node.type === 'script-storyboard') return nodes.filter(n => n.type === 'storyboard-card' && n.cardKind === 'storyboard' && n.sourceStoryboardId === node.id);
    if(node.type === 'smart-group') return smartGroupMembers(node).flatMap(storyboardCardsFromNode);
    if(node.type === 'storyboard-group'){
        const bySource = nodes.filter(n => n.type === 'storyboard-card' && n.cardKind === 'storyboard' && n.sourceStoryboardId === node.sourceStoryboardId);
        if(node.shotNumber) return bySource.filter(card => card.shot?.shotNumber === node.shotNumber || card.title === node.shotNumber);
        return bySource;
    }
    return [];
}

function shotAssetCollectorConnectedNodes(collector){
    if(!collector) return [];
    const ids = new Set();
    (canvas?.connections || []).forEach(conn => {
        if(conn?.to === collector.id && conn.from) ids.add(conn.from);
        if(conn?.from === collector.id && conn.to) ids.add(conn.to);
    });
    ids.delete(collector.id);
    return [...ids].map(id => nodes.find(n => n.id === id)).filter(Boolean);
}

function shotAssetCollectorCards(collector){
    const seen = new Set();
    return shotAssetCollectorConnectedNodes(collector)
        .flatMap(storyboardCardsFromNode)
        .filter(card => {
            if(!card?.id || seen.has(card.id)) return false;
            seen.add(card.id);
            return true;
        })
        .sort((a, b) => {
            const aTime = Number(String(a?.shot?.timeRange || '').match(/\d+(?:\.\d+)?/)?.[0]);
            const bTime = Number(String(b?.shot?.timeRange || '').match(/\d+(?:\.\d+)?/)?.[0]);
            if(Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) return aTime - bTime;
            const aShot = Number(String(a?.shot?.shotNumber || a?.title || '').match(/\d+/)?.[0]);
            const bShot = Number(String(b?.shot?.shotNumber || b?.title || '').match(/\d+/)?.[0]);
            if(Number.isFinite(aShot) && Number.isFinite(bShot) && aShot !== bShot) return aShot - bShot;
            return (Number(a.x) || 0) - (Number(b.x) || 0) || (Number(a.y) || 0) - (Number(b.y) || 0);
        });
}

function shotAssetCollectorDemands(collector){
    const map = new Map();
    shotAssetCollectorCards(collector).forEach(card => {
        shotAssetDemandItemsForCard(card).forEach(item => {
            const prev = map.get(item.key) || {...item, cardIds:[], shotLabels:[]};
            if(!prev.cardIds.includes(card.id)) prev.cardIds.push(card.id);
            if(!prev.shotLabels.includes(item.shotLabel)) prev.shotLabels.push(item.shotLabel);
            map.set(item.key, prev);
        });
    });
    return [...map.values()].sort((a, b) => {
        const order = {character:1, scene:2, wardrobe:3, prop:4, other:5};
        return (order[a.type] || 9) - (order[b.type] || 9) || String(a.label).localeCompare(String(b.label), 'zh-CN');
    });
}

function shotAssetCandidateKey(img){
    if(!img?.url) return '';
    return img.assetCandidateKey || inputRefKey(img) || `url|${img.url}`;
}

function shotAssetCollectorCanvasCandidates(collector){
    const refs = [];
    const seen = new Set();
    shotAssetCollectorConnectedNodes(collector).forEach(source => {
        if(!source || ['script-storyboard','storyboard-card','storyboard-group','image-prompt-card','asset-hub','shot-asset-collector'].includes(source.type)) return;
        imagesForNode(source).forEach((img, index) => {
            const keys = referenceImageDedupeKeys(img);
            if(!img?.url || keys.some(key => seen.has(key))) return;
            keys.forEach(key => seen.add(key));
            refs.push({
                ...img,
                name:img.name || source.title || `画布参考${refs.length + 1}`,
                source:'canvas',
                assetCandidateKey:inputRefKey(img) || `canvas|${source.id}|${index}`,
                imageIndex:Number.isFinite(Number(img.imageIndex)) ? Number(img.imageIndex) : index
            });
        });
    });
    return refs;
}

function shotAssetCollectorLibraryCandidates(collector){
    // Library-wide assets require an explicit opt-in. Connected canvas assets remain available by default.
    if(collector?.useAssetLibrary !== true || collector?.manualSelectionOnly !== false) return [];
    const refs = [];
    const seen = new Set();
    assetCategories('image').forEach(cat => {
        (cat.items || []).forEach((item, index) => {
            if(!item?.url || seen.has(item.url)) return;
            seen.add(item.url);
            const img = assetNodeImageFromItem(item, cat.name || `asset-${index + 1}`);
            refs.push({
                ...img,
                name:item.name || img.name || `\u8d44\u4ea7${refs.length + 1}`,
                source:'library',
                categoryName:cat.name || '',
                asset_uris:assetRegisteredUris(item),
                assetCandidateKey:`library|${item.id || item.url || index}`
            });
        });
    });
    return refs;
}function shotAssetCollectorCandidates(collector){
    const refs = [];
    const seen = new Set();
    const push = img => {
        const keys = referenceImageDedupeKeys(img);
        if(!img?.url || keys.some(key => seen.has(key))) return;
        keys.forEach(key => seen.add(key));
        refs.push(img);
    };
    if(collector?.useCanvasInputs !== false) shotAssetCollectorCanvasCandidates(collector).forEach(push);
    shotAssetCollectorLibraryCandidates(collector).forEach(push);
    return refs;
}

function shotAssetCollectorBinding(collector, demandKey){
    return shotAssetCollectorBindings(collector, demandKey)[0] || null;
}
const SHOT_ASSET_PURPOSES = [
    ['identity', '人物参考'],
    ['view', '角度/四视图'],
    ['wardrobe', '服装造型'],
    ['expression', '表情状态'],
    ['scene', '场景空间'],
    ['prop', '道具细节'],
    ['lighting', '光线色调'],
    ['style', '画面风格'],
    ['continuity', '上一镜连续'],
    ['other', '参考图']
];

function shotAssetPurposeLabel(purpose){
    return SHOT_ASSET_PURPOSES.find(item => item[0] === purpose)?.[1] || '其他参考';
}

function shotAssetDefaultPurpose(demandType){
    return demandType === 'shot' ? 'other' : demandType === 'character' ? 'identity' : demandType === 'scene' ? 'scene' : demandType === 'wardrobe' ? 'wardrobe' : demandType === 'prop' ? 'prop' : 'other';
}function shotAssetPurposeOptions(selected, demandType){
    const value = selected || shotAssetDefaultPurpose(demandType);
    return SHOT_ASSET_PURPOSES.map(([id, label]) => `<option value="${escapeAttr(id)}" ${id === value ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('');
}

function shotAssetPriorityLabel(priority){
    return priority === 'primary' ? '重点使用' : '一并传入';
}

function shotAssetPriorityOptions(selected){
    const value = selected === 'primary' ? 'primary' : 'support';
    return `<option value="primary" ${value === 'primary' ? 'selected' : ''}>重点使用</option><option value="support" ${value === 'support' ? 'selected' : ''}>一并传入</option>`;
}

function shotAssetBindingFromCandidate(candidate, patch={}){
    if(!candidate?.url) return null;
    return {
        candidateKey:shotAssetCandidateKey(candidate),
        url:candidate.url,
        name:candidate.name || candidate.alias || '',
        alias:candidate.alias || candidate.name || '',
        source:candidate.source || '',
        categoryName:candidate.categoryName || '',
        nodeId:candidate.nodeId || '',
        imageIndex:Number.isFinite(Number(candidate.imageIndex)) ? Number(candidate.imageIndex) : undefined,
        asset_uris:candidate.asset_uris || {},
        purpose:patch.purpose || candidate.purpose || 'other',
        priority:patch.priority === 'primary' ? 'primary' : 'support',
        updatedAt:Date.now()
    };
}

function shotAssetCollectorBindings(collector, demandKey){
    const bindings = collector?.shotAssetBindings && typeof collector.shotAssetBindings === 'object' ? collector.shotAssetBindings : {};
    const raw = bindings[demandKey];
    if(!raw) return [];
    if(Array.isArray(raw)) return raw.filter(item => item?.url);
    if(Array.isArray(raw.items)) return raw.items.filter(item => item?.url);
    if(raw.url) return [raw];
    return [];
}

function setShotAssetCollectorBindings(collector, demandKey, items){
    if(!collector || !demandKey) return;
    if(!collector.shotAssetBindings || typeof collector.shotAssetBindings !== 'object') collector.shotAssetBindings = {};
    const normalized = (Array.isArray(items) ? items : []).filter(item => item?.url);
    if(!normalized.length){
        delete collector.shotAssetBindings[demandKey];
        return;
    }
    collector.shotAssetBindings[demandKey] = {
        items:normalized,
        updatedAt:Date.now()
    };
}

function setShotAssetCollectorBinding(collector, demandKey, candidate){
    if(!collector || !demandKey) return;
    setShotAssetCollectorBindings(collector, demandKey, candidate ? [shotAssetBindingFromCandidate(candidate)] : []);
}

function toggleShotAssetCollectorBinding(collector, demandKey, candidate, checked){
    if(!collector || !demandKey || !candidate?.url) return;
    const candidateKey = shotAssetCandidateKey(candidate);
    const next = shotAssetCollectorBindings(collector, demandKey)
        .filter(item => item?.candidateKey !== candidateKey && item?.url !== candidate.url);
    if(checked){
        const demand = shotAssetCollectorDemands(collector).find(item => item.key === demandKey);
        const activeCategory = shotAssetPickerStateFor(collector)?.category || '';
        const purposeType = activeCategory === 'scene' ? 'scene' : shotAssetDefaultPurpose(demand?.type);
        const binding = shotAssetBindingFromCandidate(candidate, {purpose:purposeType});
        if(binding) next.push(binding);
        setShotAssetCollectorNoAsset(collector, demandKey, false);
    }
    setShotAssetCollectorBindings(collector, demandKey, next);
}

function updateShotAssetCollectorBinding(collector, demandKey, candidateKey, patch={}){
    const next = shotAssetCollectorBindings(collector, demandKey).map(item => {
        if((item.candidateKey || item.url) !== candidateKey && item.url !== candidateKey) return item;
        return {
            ...item,
            ...(patch.purpose ? {purpose:patch.purpose} : {}),
            ...(patch.priority ? {priority:patch.priority === 'primary' ? 'primary' : 'support'} : {}),
            updatedAt:Date.now()
        };
    });
    setShotAssetCollectorBindings(collector, demandKey, next);
}

function shotAssetCollectorNoAsset(collector, demandKey){
    const map = collector?.shotAssetNoAsset && typeof collector.shotAssetNoAsset === 'object' ? collector.shotAssetNoAsset : {};
    return Boolean(map[demandKey]);
}

function setShotAssetCollectorNoAsset(collector, demandKey, checked){
    if(!collector || !demandKey) return;
    if(!collector.shotAssetNoAsset || typeof collector.shotAssetNoAsset !== 'object') collector.shotAssetNoAsset = {};
    if(checked){
        collector.shotAssetNoAsset[demandKey] = true;
        setShotAssetCollectorBindings(collector, demandKey, []);
    } else delete collector.shotAssetNoAsset[demandKey];
}

function shotAssetCollectorBindingKeys(collector, demandKey){
    return new Set(shotAssetCollectorBindings(collector, demandKey).map(item => item.candidateKey || item.url).filter(Boolean));
}

function shotAssetBindingCategory(binding, demand){
    const purpose = binding?.purpose || '';
    if(purpose === 'scene') return 'scene';
    if(['wardrobe','prop','style','lighting','continuity'].includes(purpose)) return 'hidden';
    return shotAssetDemandCategory(demand);
}

function shotAssetBindingsForCategory(collector, demand, category){
    return shotAssetCollectorBindings(collector, demand?.key).filter(binding => shotAssetBindingCategory(binding, demand) === category);
}

function shotAssetPickerStateFor(collector){
    return collector?.id ? (shotAssetPickerStates.get(collector.id) || null) : null;
}
const SHOT_ASSET_PICKER_CATEGORIES = [
    ['character', '人物'],
    ['scene', '场景']
];

function shotAssetDemandCategory(demand){
    const type = demand?.type || 'character';
    return type === 'scene' ? 'scene' : 'character';
}

function shotAssetPickerCategoryLabel(category){
    return SHOT_ASSET_PICKER_CATEGORIES.find(item => item[0] === category)?.[1] || '人物';
}

function shotAssetPickerDemandsForCategory(collector, category){
    const demands = shotAssetCollectorDemands(collector);
    const normalized = category === 'scene' ? 'scene' : 'character';
    return demands.filter(demand => shotAssetDemandCategory(demand) === normalized);
}

function shotAssetPickerEnsureState(collector, demandKey=''){
    if(!collector) return null;
    const demands = shotAssetCollectorDemands(collector);
    const incomingDemand = demands.find(item => item.key === demandKey);
    let state = shotAssetPickerStateFor(collector);
    const previousDemand = demands.find(item => item.key === state?.demandKey);
    const preferredCategory = incomingDemand ? shotAssetDemandCategory(incomingDemand) : (state?.category || shotAssetDemandCategory(previousDemand || demands[0]));
    const category = preferredCategory === 'scene' ? 'scene' : 'character';
    const categoryDemands = shotAssetPickerDemandsForCategory(collector, category);
    const fallbackDemand = incomingDemand?.key || (previousDemand && shotAssetDemandCategory(previousDemand) === category ? previousDemand.key : '') || categoryDemands[0]?.key || demands[0]?.key || '';
    if(!state){
        state = {collectorId:collector.id, demandKey:fallbackDemand, category, query:'', bodyTop:0, demandTop:0, assetTop:0, demandByCategory:{}};
        shotAssetPickerStates.set(collector.id, state);
    } else {
        state.demandKey = fallbackDemand;
        state.category = category || state.category || 'character';
        state.query = state.query || '';
        if(!state.demandByCategory || typeof state.demandByCategory !== 'object') state.demandByCategory = {};
    }
    if(fallbackDemand) state.demandByCategory[category] = fallbackDemand;
    return state;
}

function shotAssetPickerActiveDemand(collector){
    const state = shotAssetPickerStateFor(collector);
    if(!collector || !state) return null;
    return shotAssetCollectorDemands(collector).find(item => item.key === state.demandKey) || null;
}

function shotAssetPickerCandidateCategory(candidate){
    const assetName = [candidate?.name, candidate?.alias].filter(Boolean).join(' ');
    const textValue = [candidate?.category, candidate?.assetRole, candidate?.categoryName, assetName].filter(Boolean).join(' ');
    // 先排除明确的服装、道具和风格资产，避免“婚礼迎宾牌”被“婚礼”误判成场景，
    // 也避免资产库分类名为“人物”时把外卖袋、手机等带入人物候选。
    const objectOrStyle = /迎宾牌|指示牌|标牌|立牌|牌子|外卖袋|外卖箱|手提袋|礼品袋|纸袋|包装袋|袋子|手机|戒指|花束|钥匙|文件|水杯|门票|电动车|自行车|摩托车|汽车|车辆|道具|服装|衣服|上衣|外套|裙装|婚纱(?!店)|西装|校服|工装|外卖服|造型|妆造|画风|风格参考|质感参考|style|look|mood/i;
    if(objectOrStyle.test(assetName)) return '';
    const guessed = smartAssetCategoryForText(textValue);
    if(guessed === 'scene') return 'scene';
    if(['wardrobe','prop','style'].includes(guessed) || objectOrStyle.test(textValue)) return '';
    return 'character';
}

function shotAssetPickerCandidateGroup(candidate, activeDemand=null){
    const cat = shotAssetPickerCandidateCategory(candidate);
    const rawName = String(candidate?.name || candidate?.alias || candidate?.categoryName || '未命名资产').trim();
    if(cat === 'character'){
        const demandLabel = String(activeDemand?.label || '').trim();
        const hit = smartAssetNameParts(rawName).find(part => demandLabel && smartAssetTextKey(part) === smartAssetTextKey(demandLabel));
        return hit || rawName.replace(/(正脸|侧脸|三视图|四视图|表情|服装|特写|参考图|资产图).*/g, '').trim() || rawName;
    }
    if(cat === 'scene') return candidate?.categoryName || rawName.replace(/(场景|环境|空间|参考图).*/g, '').trim() || '场景';
    return candidate?.categoryName || '人物';
}

function shotAssetPickerCandidateLabel(candidate){
    const source = candidate?.source === 'library' ? '资产库' : '画布';
    return `${candidate?.name || candidate?.alias || '参考图'} · ${source}${candidate?.categoryName ? ` · ${candidate.categoryName}` : ''}`;
}

function shotAssetDefaultGenerationPrompt(demand){
    const label = String(demand?.label || '').trim() || (shotAssetDemandCategory(demand) === 'scene' ? '场景' : '人物');
    if(shotAssetDemandCategory(demand) === 'scene'){
        return `场景资产图：${label}。真人情感短剧写实场景参考，横版16:9，清楚呈现空间布局、入口和主要动线，真实自然光与生活质感。画面中不出现人物，不生成文字或水印。`;
    }
    return `人物资产图：${label}。真人情感短剧写实角色参考，清楚呈现正面半身、三分之二侧面和自然表情，五官、发型、年龄感稳定，简洁中性背景，光线均匀。不添加剧情动作、场景道具、文字或水印。`;
}

function shotAssetPromptRecord(collector, demand){
    if(!collector || !demand) return null;
    if(!collector.assetPromptDrafts || typeof collector.assetPromptDrafts !== 'object') collector.assetPromptDrafts = {};
    const original = shotAssetDefaultGenerationPrompt(demand);
    const prev = collector.assetPromptDrafts[demand.key];
    if(!prev || typeof prev !== 'object'){
        collector.assetPromptDrafts[demand.key] = {original, current:original, optimized:'', updatedAt:Date.now()};
    } else {
        prev.original = String(prev.original || original);
        prev.current = String(prev.current || prev.original || original);
        prev.optimized = String(prev.optimized || '');
    }
    return collector.assetPromptDrafts[demand.key];
}

function shotAssetPromptBoxHtml(collector, demand){
    if(!demand) return '';
    const record = shotAssetPromptRecord(collector, demand);
    const optimizing = collector.assetPromptOptimizingKey === demand.key;
    return `<div class="shot-asset-prompt-box" data-asset-prompt-demand="${escapeAttr(demand.key)}">
        <div class="shot-asset-prompt-head"><b>单独生成${escapeHtml(shotAssetPickerCategoryLabel(shotAssetDemandCategory(demand)))}资产</b><span>${record.optimized ? '已有AI优化稿' : '提示词可编辑'}</span></div>
        <textarea class="shot-asset-prompt-text" data-demand-key="${escapeAttr(demand.key)}">${escapeHtml(record.current)}</textarea>
        <div class="shot-asset-prompt-actions">
            <button class="shot-asset-prompt-optimize" type="button" data-demand-key="${escapeAttr(demand.key)}" ${optimizing ? 'disabled' : ''}>${optimizing ? 'AI优化中...' : 'AI优化'}</button>
            <button class="shot-asset-prompt-copy" type="button" data-demand-key="${escapeAttr(demand.key)}">复制</button>
            <button class="shot-asset-prompt-reset" type="button" data-demand-key="${escapeAttr(demand.key)}">恢复默认</button>
            <button class="shot-asset-prompt-create" type="button" data-demand-key="${escapeAttr(demand.key)}">创建生图节点</button>
        </div>
    </div>`;
}

function shotAssetRecommendationItems(collector, demandKey){
    const byDemand = collector?.assetRecommendations?.byDemand;
    return byDemand && typeof byDemand === 'object' && Array.isArray(byDemand[demandKey]) ? byDemand[demandKey] : [];
}

function shotAssetRecommendationFor(collector, demandKey, candidateKey){
    return shotAssetRecommendationItems(collector, demandKey).find(item => item?.candidateKey === candidateKey) || null;
}

function shotAssetRecommendationBarHtml(collector){
    const recommendation = collector?.assetRecommendations;
    const running = collector?.assetRecommendationRunning === true;
    const count = recommendation?.byDemand && typeof recommendation.byDemand === 'object'
        ? Object.values(recommendation.byDemand).reduce((sum, items) => sum + (Array.isArray(items) ? items.length : 0), 0)
        : 0;
    const status = running
        ? 'AI正在比对需求与候选资产...'
        : count
        ? `已推荐 ${count} 项，仍需手动勾选确认`
        : 'AI只做推荐，不会自动绑定或替换资产';
    return `<div class="shot-asset-ai-recommendation ${running ? 'running' : count ? 'ready' : ''}">
        <div><b>AI资产建议</b><span>${escapeHtml(status)}</span>${recommendation?.summary ? `<small>${escapeHtml(recommendation.summary)}</small>` : ''}</div>
        <button class="shot-asset-ai-recommend" type="button" ${running ? 'disabled' : ''}>${running ? '匹配中...' : count ? '重新匹配' : '开始匹配'}</button>
    </div>`;
}

function normalizeShotAssetRecommendations(payload, demandById, candidateById){
    const raw = payload && typeof payload === 'object' ? payload : {};
    const byDemand = {};
    (Array.isArray(raw.recommendations) ? raw.recommendations : []).forEach(item => {
        const demand = demandById.get(String(item?.demandId || ''));
        if(!demand) return;
        const demandCategory = shotAssetDemandCategory(demand);
        const ids = Array.isArray(item?.assetIds) ? item.assetIds : item?.assetId ? [item.assetId] : [];
        const confidenceValue = Number(item?.confidence);
        const confidence = Number.isFinite(confidenceValue) ? Math.max(0, Math.min(1, confidenceValue > 1 ? confidenceValue / 100 : confidenceValue)) : 0.5;
        ids.forEach(assetId => {
            const candidate = candidateById.get(String(assetId || ''));
            if(!candidate || shotAssetPickerCandidateCategory(candidate) !== demandCategory) return;
            const candidateKey = shotAssetCandidateKey(candidate);
            if(!candidateKey) return;
            if(!Array.isArray(byDemand[demand.key])) byDemand[demand.key] = [];
            if(byDemand[demand.key].some(entry => entry.candidateKey === candidateKey)) return;
            byDemand[demand.key].push({
                candidateKey,
                confidence,
                reason:String(item?.reason || '名称与镜头需求相符，建议人工确认画面内容。').trim(),
                recommendedAt:Date.now()
            });
        });
    });
    Object.values(byDemand).forEach(items => items.sort((a, b) => b.confidence - a.confidence));
    return {summary:String(raw.summary || '').trim(), byDemand};
}

async function recommendShotAssetsWithAi(collector){
    if(!collector || collector.assetRecommendationRunning) return;
    const demands = shotAssetCollectorDemands(collector).filter(demand => ['character','scene'].includes(shotAssetDemandCategory(demand)));
    const candidates = shotAssetCollectorCandidates(collector).filter(candidate => ['character','scene'].includes(shotAssetPickerCandidateCategory(candidate)));
    if(!demands.length){ toast('当前没有可匹配的人物或场景需求'); return; }
    if(!candidates.length){ toast('当前没有候选资产，请先连入图片或开启项目资产库'); return; }
    const demandById = new Map();
    const candidateById = new Map();
    const demandRows = demands.map((demand, index) => {
        const id = `D${index + 1}`;
        demandById.set(id, demand);
        const context = demand.cardIds
            .map(cardId => nodes.find(item => item.id === cardId))
            .filter(Boolean)
            .map(card => ({
                story:shotAssetCardLabel(card),
                time:card.shot?.timeRange || '',
                subjects:card.shot?.subjects || '',
                scene:smartStoryboardAssetFields(card.shot || {}).scene || '',
                purpose:card.shot?.purpose || ''
            }));
        return {id, type:shotAssetDemandCategory(demand), name:demand.label, storyboards:demand.shotLabels, context};
    });
    const candidateRows = candidates.slice(0, 120).map((candidate, index) => {
        const id = `A${index + 1}`;
        candidateById.set(id, candidate);
        return {
            id,
            type:shotAssetPickerCandidateCategory(candidate),
            name:candidate.name || candidate.alias || '未命名资产',
            group:shotAssetPickerCandidateGroup(candidate),
            source:candidate.source || 'canvas',
            category:candidate.categoryName || ''
        };
    });
    const message = JSON.stringify({demands:demandRows, candidates:candidateRows}, null, 2);
    const systemPrompt = `你是真人情感短剧的资产匹配助手。根据需求名称、镜头上下文、候选资产名称与分组，给出“建议人工勾选”的匹配结果。规则：1. 人物只能推荐人物候选，场景只能推荐场景候选；2. 同一人物可推荐特写、四视图等多张互补资产；3. 不因共享一个普通词就强行匹配；4. 不确定时该需求不推荐；5. 绝对不能把道具、服装、婚礼迎宾牌、外卖袋等当成人物；6. 只返回输入中存在的D和A编号。只输出JSON：{"summary":"一句话说明","recommendations":[{"demandId":"D1","assetIds":["A1","A2"],"confidence":0.92,"reason":"简短具体理由"}]}。`;
    collector.assetRecommendationRunning = true;
    render();
    try {
        const ai = promptOptimizationConfigForCollector(collector);
        const result = await requestSmartCanvasLlmText(message, {...ai, systemPrompt});
        const payload = window.ScriptToStoryboard?.extractJson?.(result.text);
        if(!payload) throw new Error('AI没有返回可解析的资产建议');
        const normalized = normalizeShotAssetRecommendations(payload, demandById, candidateById);
        collector.assetRecommendations = {...normalized, provider:result.provider, model:result.model, generatedAt:Date.now()};
        const count = Object.values(normalized.byDemand).reduce((sum, items) => sum + items.length, 0);
        toast(count ? `AI已标出 ${count} 项候选，请手动确认` : 'AI没有发现足够可靠的匹配，未改动任何绑定');
        scheduleSave();
    } catch(error){
        toast(`AI资产匹配失败：${String(error?.message || error).slice(0, 100)}`);
    } finally {
        collector.assetRecommendationRunning = false;
        render();
    }
}

function shotAssetPickerHtml(collector){
    const state = shotAssetPickerEnsureState(collector);
    if(!collector || !state || state.collectorId !== collector.id) return '';
    const category = state.category || 'character';
    const demand = shotAssetPickerActiveDemand(collector);
    const bindings = demand ? shotAssetBindingsForCategory(collector, demand, category) : [];
    const selectedKeys = new Set(bindings.flatMap(item => referenceImageDedupeKeys(item)).filter(Boolean));
    const query = String(state.query || '').trim().toLowerCase();
    const filtered = shotAssetCollectorCandidates(collector)
        .map(candidate => ({
            candidate,
            key:shotAssetCandidateKey(candidate),
            category:shotAssetPickerCandidateCategory(candidate),
            group:shotAssetPickerCandidateGroup(candidate, demand),
            label:shotAssetPickerCandidateLabel(candidate)
        }))
        .filter(item => item.category === category)
        .filter(item => {
            if(!query) return true;
            return [item.label, item.group, item.candidate?.alias, item.candidate?.categoryName].join(' ').toLowerCase().includes(query);
        });
    const groups = new Map();
    filtered.forEach(item => {
        const group = item.group || '未分组';
        if(!groups.has(group)) groups.set(group, []);
        groups.get(group).push(item);
    });
    const selectedHtml = bindings.length ? bindings.map(binding => {
        const key = escapeAttr(binding.candidateKey || binding.url || '');
        const usage = shotAssetReadableUsageLabel(demand, binding);
        return `<span class="shot-asset-selected-chip" data-candidate-key="${key}">${escapeHtml(binding.name || binding.alias || '已绑定资产')}<em>${escapeHtml(usage)}</em></span>`;
    }).join('') : '<div class="shot-asset-picker-empty compact">未选择参考图</div>';
    const groupsHtml = demand ? [...groups.entries()].map(([group, items]) => `<div class="shot-asset-picker-group">
        <div class="shot-asset-picker-group-title">${escapeHtml(group)}<span>${items.length}</span></div>
        <div class="shot-asset-picker-grid">
            ${items.map(item => {
                const checked = referenceImageDedupeKeys({...item.candidate, assetCandidateKey:item.key}).some(key => selectedKeys.has(key));
                const recommendation = shotAssetRecommendationFor(collector, demand.key, item.key);
                const recommendationTitle = recommendation ? `${item.label}；AI建议：${recommendation.reason}` : item.label;
                return `<label class="shot-asset-picker-card ${checked ? 'selected' : ''} ${recommendation ? 'ai-recommended' : ''}" title="${escapeAttr(recommendationTitle)}">
                    <input class="shot-asset-check" type="checkbox" data-demand-key="${escapeAttr(demand.key)}" data-candidate-key="${escapeAttr(item.key)}" ${checked ? 'checked' : ''}>
                    <span class="shot-asset-picker-thumb">${item.candidate?.url ? `<img src="${escapeAttr(item.candidate.url)}" alt="">` : ''}</span>
                    <span class="shot-asset-picker-name">${escapeHtml(item.label)}${recommendation ? `<em class="shot-asset-ai-badge">AI推荐 ${Math.round(recommendation.confidence * 100)}%</em>` : ''}</span>
                </label>`;
            }).join('')}
        </div>
    </div>`).join('') : '';
    const emptyCandidateMessage = demand
        ? `当前没有可绑定的${shotAssetPickerCategoryLabel(category)}图。请把图片加入项目资产库、连入收集器，或使用下方“创建生图节点”。`
        : `左侧选择一个${shotAssetPickerCategoryLabel(category)}需求后再绑定资产`;
    return `<div class="shot-asset-picker" data-picker-demand="${escapeAttr(demand?.key || '')}">
        <div class="shot-asset-picker-head">
            <div>
                <b>${escapeHtml(shotAssetPickerCategoryLabel(category))}资产</b>
                <span>${demand ? `${escapeHtml(demand.label)} · ${bindings.length} 张已选` : `当前分类暂无需求`}</span>
            </div>
        </div>
        <input class="shot-asset-picker-query" value="${escapeAttr(state.query || '')}" placeholder="搜索资产名 / 角色名 / 分组">
        <div class="shot-asset-picker-selected">${selectedHtml}</div>
        <div class="shot-asset-picker-results">${groupsHtml || `<div class="shot-asset-picker-empty">${escapeHtml(emptyCandidateMessage)}</div>`}</div>
        ${shotAssetPromptBoxHtml(collector, demand)}
    </div>`;
}

function shotAssetCollectorsForCard(card){
    if(!card) return [];
    const collectors = nodes.filter(n => n.type === 'shot-asset-collector');
    const direct = collectors
        .filter(collector => shotAssetCollectorCards(collector).some(item => item.id === card.id));
    if(direct.length) return direct;
    const sourceId = card.sourceStoryboardId || '';
    const shotLabelKey = smartMentionKey(shotAssetCardLabel(card));
    const timeKey = smartAssetTextKey(card?.shot?.timeRange || '');
    return collectors.filter(collector => {
        if(sourceId && collector.sourceStoryboardId === sourceId) return true;
        return shotAssetCollectorCards(collector).some(item => {
            if(sourceId && item.sourceStoryboardId && item.sourceStoryboardId !== sourceId) return false;
            const sameShot = shotLabelKey && smartMentionKey(shotAssetCardLabel(item)) === shotLabelKey;
            const sameTime = timeKey && smartAssetTextKey(item?.shot?.timeRange || '') === timeKey;
            return sameShot || sameTime;
        });
    });
}

function shotAssetCollectorForCard(card){
    return shotAssetCollectorsForCard(card)[0] || null;
}

function shotAssetCollectorDemandsForCard(collector, card){
    const cardDemandKeys = new Set(shotAssetDemandItemsForCard(card).map(item => item.key));
    return shotAssetCollectorDemands(collector).filter(item => cardDemandKeys.has(item.key));
}

function shotAssetContinuityKey(item){
    return `${item?.from || ''}>${item?.to || ''}`;
}

function shotAssetCollectorContinuityReport(collector){
    const cards = shotAssetCollectorCards(collector);
    const report = window.ScriptToStoryboard?.buildContinuityReport?.(cards.map(card => card.shot || {})) || {summary:'暂无连续性检查结果', items:[]};
    const overrides = collector?.continuityOverrides && typeof collector.continuityOverrides === 'object' ? collector.continuityOverrides : {};
    return {
        ...report,
        items:(report.items || []).map(item => ({...item, key:shotAssetContinuityKey(item), confirmed:Boolean(overrides[shotAssetContinuityKey(item)])}))
    };
}

function shotAssetCollectorPreflight(collector){
    const cards = shotAssetCollectorCards(collector);
    const demands = shotAssetCollectorDemands(collector);
    const demandRows = demands.map(demand => {
        const bindings = shotAssetCollectorBindings(collector, demand.key);
        const noAsset = shotAssetCollectorNoAsset(collector, demand.key);
        return {...demand, bindings, noAsset, status:bindings.length ? 'ready' : noAsset ? 'no-asset' : 'missing'};
    });
    const continuity = shotAssetCollectorContinuityReport(collector);
    const missing = demandRows.filter(item => item.status === 'missing');
    const unconfirmedRisks = continuity.items.filter(item => item.risk === '需要复核' && !item.confirmed);
    const strict = collector?.enforcePreflight === true;
    return {
        cards,
        demands:demandRows,
        missing,
        continuity,
        unconfirmedRisks,
        status:strict && missing.length ? 'blocked' : missing.length || unconfirmedRisks.length ? 'warning' : 'ready',
        strict,
        checkedAt:Date.now()
    };
}

function shotAssetPreviousGeneratedRef(card, collector){
    if(!card || !collector || collector.inheritPrevious === false) return null;
    const cards = shotAssetCollectorCards(collector);
    const index = cards.findIndex(item => item.id === card.id);
    if(index <= 0) return null;
    const previous = cards[index - 1];
    const outputs = (canvas?.connections || [])
        .filter(conn => conn?.from === previous.id)
        .map(conn => nodes.find(node => node.id === conn.to))
        .filter(node => node && isSmartRunnableNode(node) && Array.isArray(node.images) && node.images.length)
        .sort((a, b) => {
            const aFrame = Number.isFinite(Number(a.storyboardFrameIndex)) ? Number(a.storyboardFrameIndex) : -1;
            const bFrame = Number.isFinite(Number(b.storyboardFrameIndex)) ? Number(b.storyboardFrameIndex) : -1;
            return bFrame - aFrame || (Number(b.created_at) || 0) - (Number(a.created_at) || 0);
        });
    for(const output of outputs){
        for(let i = output.images.length - 1; i >= 0; i--){
            const img = output.images[i];
            if(!img?.url || mediaKindForItem(img) !== 'image') continue;
            return {
                ...img,
                name:`${shotAssetCardLabel(previous)}结束帧`,
                alias:`${shotAssetCardLabel(previous)}结束帧`,
                role:'continuity',
                purpose:'continuity',
                priority:'primary',
                nodeId:output.id,
                imageIndex:i,
                fromPreviousStoryboard:true
            };
        }
    }
    return null;
}

function shotAssetCollectorRefsForCard(card){
    const collector = shotAssetCollectorForCard(card);
    if(!collector) return [];
    const refs = shotAssetCollectorDemandsForCard(collector, card)
        .flatMap(demand => shotAssetCollectorBindings(collector, demand.key)
            .filter(binding => ['character','scene'].includes(shotAssetBindingCategory(binding, demand))))
        .filter(binding => binding?.url)
        .map(binding => ({
            ...binding,
            role:'shot_asset',
            name:binding.name || binding.alias || '镜头资产',
            purpose:binding.purpose || 'other',
            priority:binding.priority === 'primary' ? 'primary' : 'support',
            manualStoryboardAsset:true,
            fromShotAssetCollector:collector.id
        }));
    const previousRef = shotAssetPreviousGeneratedRef(card, collector);
    if(previousRef) refs.push(previousRef);
    return uniqueReferenceImages(refs);
}

function shotAssetCollectorMentionsForCard(card){
    const seen = new Set();
    return shotAssetCollectorRefsForCard(card)
        .map(img => String(img.name || img.alias || '').trim())
        .filter(Boolean)
        .map(name => name.replace(/^@+/, '').replace(/\s+/g, '_'))
        .filter(name => {
            const key = smartMentionKey(name);
            if(!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .map(name => `@${name}`);
}

function shotAssetReadableUsageLabel(demand, binding={}){
    const demandLabel = String(demand?.label || '').trim();
    const assetName = String(binding?.name || binding?.alias || '').trim();
    const target = demandLabel || assetName || '参考';
    const purposeType = ['scene','wardrobe','prop','style'].includes(binding?.purpose) ? binding.purpose : '';
    const type = purposeType || shotAssetDemandCategory(demand);
    const tags = [];
    if(/四视图|多视图|三视图|全身|正面|侧面|背面/i.test(assetName)) tags.push('四视图');
    if(/特写|近景|头像|面部|脸/i.test(assetName)) tags.push('特写');
    if(/婚纱|衣服|服装|外套|上衣|造型/i.test(assetName) && type === 'character') tags.push('服装');
    const suffix = tags.length ? ` / ${[...new Set(tags)].join(' / ')}` : '';
    if(type === 'scene') return `场景：${target}${suffix}`;
    if(type === 'wardrobe') return `服装：${target}${suffix}`;
    if(type === 'prop') return `道具：${target}${suffix}`;
    if(type === 'style') return `风格参考：${assetName || target}`;
    return `人物：${target}${suffix}`;
}

function shotAssetCollectorUsageTextForCard(card){
    const collector = shotAssetCollectorForCard(card);
    if(!collector) return '';
    const parts = [];
    shotAssetCollectorDemandsForCard(collector, card).forEach(demand => {
        shotAssetCollectorBindings(collector, demand.key)
            .filter(binding => ['character','scene'].includes(shotAssetBindingCategory(binding, demand)))
            .forEach(binding => {
            const name = String(binding.name || binding.alias || '参考图').replace(/^@+/, '').replace(/\s+/g, '_');
            parts.push(`@${name}=${shotAssetReadableUsageLabel(demand, binding)}`);
        });
    });
    const previousRef = shotAssetPreviousGeneratedRef(card, collector);
    if(previousRef) parts.push(`@${String(previousRef.name || '上一镜结束帧').replace(/\s+/g, '_')}=上一镜结束帧`);
    return [...new Set(parts)].join('；');
}

function storyboardAssetMentionsFor(source){
    const refs = storyboardManualAssetRefsFor(source);
    const seen = new Set();
    return refs.map(img => String(img.name || img.assetLabel || '').trim())
        .filter(Boolean)
        .map(name => name.replace(/^@+/, '').replace(/\s+/g, '_'))
        .filter(name => {
            const key = smartMentionKey(name);
            if(!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .map(name => `@${name}`);
}

function smartStoryboardPromptWithAssetMentions(source, prompt=''){
    const collectorMentions = shotAssetCollectorMentionsForCard(source);
    const mentions = collectorMentions.length ? collectorMentions : storyboardAssetMentionsFor(source);
    const text = String(prompt || '');
    const usage = shotAssetCollectorUsageTextForCard(source);
    if(!mentions.length && !usage) return text;
    const missing = mentions.filter(token => !text.includes(token));
    const head = [missing.join(' '), usage ? `参考图说明：${usage}` : ''].filter(Boolean).join('\n');
    if(!head) return text;
    return `${head}\n${text}`.trim();
}

function smartStoryboardAssetPanelHtml(node){
    const fields = smartStoryboardAssetFields(node?.shot || {});
    const collector = shotAssetCollectorForCard(node);
    const demands = collector ? shotAssetCollectorDemandsForCard(collector, node) : [];
    const refs = collector ? shotAssetCollectorRefsForCard(node) : [];
    const rows = demands.map(demand => {
        const bindings = shotAssetCollectorBindings(collector, demand.key);
        const noAsset = shotAssetCollectorNoAsset(collector, demand.key);
        const names = bindings.map(item => `${item.name || item.alias || '已绑定资产'}（${shotAssetReadableUsageLabel(demand, item)}）`).filter(Boolean).join('、');
        return `<div class="storyboard-asset-row ${bindings.length || noAsset ? 'inherited' : ''}">
            <div class="storyboard-asset-row-main">
                <span class="storyboard-asset-row-name">${escapeHtml(shotAssetDemandTypeLabel(demand.type))} · ${escapeHtml(demand.label)}</span>
                <span class="storyboard-asset-row-source">${bindings.length ? `使用：${escapeHtml(names)}` : noAsset ? '已明确：无资产生成' : '收集器未绑定'}</span>
            </div>
        </div>`;
    }).join('');
    return `<div class="storyboard-asset-panel">
        <div class="storyboard-asset-head">
            <b>收集器分发资产</b>
            <span>${collector ? `${refs.length} 张已分发` : '未连接收集器'}</span>
        </div>
        <div class="storyboard-asset-grid">
            <span><b>主要</b>${escapeHtml(fields.main || '-')}</span>
            <span><b>第二</b>${escapeHtml(fields.second || '-')}</span>
            <span><b>第三</b>${escapeHtml(fields.third || '-')}</span>
            <span><b>场景</b>${escapeHtml(fields.scene || '-')}</span>
            <span><b>时间</b>${escapeHtml(fields.timeState || '-')}</span>
            <span><b>服装</b>${escapeHtml(fields.wardrobe || '-')}</span>
            <span><b>道具</b>${escapeHtml((fields.props || []).join('、') || '-')}</span>
        </div>
        <div class="storyboard-asset-list">${rows || '<div class="storyboard-asset-empty">人物收集器会随故事板自动创建并连接，可在收集器中为人物绑定参考图。</div>'}</div>
        <div class="storyboard-asset-rule">本卡只显示人物绑定结果；每个人可在“故事板人物收集器”中绑定多张参考图。</div>
    </div>`;
}

function shotAssetCollectorPreflightHtml(node){
    const report = shotAssetCollectorPreflight(node);
    const statusLabel = report.status === 'ready' ? '可以生成' : report.strict && report.missing.length ? '严格模式：缺少资产' : report.missing.length ? '快速试片：缺资产只提醒' : '需要确认连续性';
    const statusClass = report.status === 'ready' ? 'ready' : report.status === 'warning' ? 'warning' : 'blocked';
    const missingRows = report.missing.map(item => `<div class="shot-preflight-item ${report.strict ? 'blocked' : 'warning'}"><b>${escapeHtml(shotAssetDemandTypeLabel(item.type))} · ${escapeHtml(item.label)}</b><span>${escapeHtml(item.shotLabels.join('、'))}：${report.strict ? '请绑定资产或勾选“无资产”' : '未绑定也可以先生成，之后可补资产'}</span></div>`).join('');
    const continuityRows = report.continuity.items.map(item => {
        const risky = item.risk === '需要复核';
        const note = (item.notes || []).join('；') || item.transition || '连续性正常';
        return `<div class="shot-preflight-item ${risky && !item.confirmed ? 'warning' : 'ready'}">
            <div><b>${escapeHtml(item.from)} → ${escapeHtml(item.to)}</b><span>${escapeHtml(note)}</span></div>
            ${risky ? `<label><input class="shot-continuity-confirm" type="checkbox" data-continuity-key="${escapeAttr(item.key)}" ${item.confirmed ? 'checked' : ''}>已确认此变化</label>` : '<em>正常</em>'}
        </div>`;
    }).join('');
    return `<div class="shot-preflight ${statusClass}">
        <div class="shot-preflight-head">
            <div><b>生成前检查</b><span>${statusLabel}</span></div>
            <button class="storyboard-control shot-preflight-toggle" type="button">${node.preflightExpanded === false ? '展开' : '收起'}</button>
        </div>
        <div class="shot-preflight-summary">
            <span>镜头 ${report.cards.length}</span><span>需求 ${report.demands.length}</span><span>未处理 ${report.missing.length}</span><span>连续性风险 ${report.unconfirmedRisks.length}</span>
        </div>
        ${node.preflightExpanded === false ? '' : `<div class="shot-preflight-details">
            ${missingRows || '<div class="shot-preflight-empty">所有资产需求都已绑定或明确选择无资产。</div>'}
            <div class="shot-preflight-section-title">镜头连续性</div>
            ${continuityRows || '<div class="shot-preflight-empty">连接两个以上故事板后显示相邻镜头检查。</div>'}
        </div>`}
    </div>`;
}

function shotAssetCollectorBodyHtml(node){
    const cards = shotAssetCollectorCards(node);
    const demands = shotAssetCollectorDemands(node);
    const candidates = shotAssetCollectorCandidates(node);
    const state = shotAssetPickerEnsureState(node);
    const activeCategory = state?.category || 'character';
    const activeDemandKey = state?.demandKey || '';
    const categoryDemands = shotAssetPickerDemandsForCategory(node, activeCategory);
    const categoryTabs = SHOT_ASSET_PICKER_CATEGORIES.map(([id, label]) => {
        const count = shotAssetPickerDemandsForCategory(node, id).length;
        const candidateCount = candidates.filter(candidate => shotAssetPickerCandidateCategory(candidate) === id).length;
        return `<button class="shot-asset-category-tab ${id === activeCategory ? 'active' : ''}" type="button" data-shot-asset-category="${escapeAttr(id)}">
            <b>${escapeHtml(label)}</b><span>${count || candidateCount || 0}</span>
        </button>`;
    }).join('');
    const rows = categoryDemands.map(demand => {
        const bindings = shotAssetBindingsForCategory(node, demand, activeCategory);
        const noAsset = shotAssetCollectorNoAsset(node, demand.key);
        const active = activeDemandKey === demand.key;
        const canMarkNoAsset = shotAssetDemandCategory(demand) === activeCategory;
        const effectiveNoAsset = canMarkNoAsset && noAsset;
        const boundNames = bindings.map(item => item.name || item.alias || '已绑定资产').filter(Boolean);
        const statusText = bindings.length
            ? `已绑定 ${bindings.length} 张：${boundNames.slice(0, 4).join('、')}${bindings.length > 4 ? '…' : ''}`
            : effectiveNoAsset ? '已标记无资产，生成时只用文字描述' : '未绑定，可先生成，也可选择参考图';
        return `<div class="shot-asset-demand-row ${active ? 'active' : ''} ${bindings.length || effectiveNoAsset ? 'ready' : ''}" data-demand-key="${escapeAttr(demand.key)}">
            <div class="shot-asset-demand-main">
                <span class="shot-asset-demand-type">${escapeHtml(shotAssetDemandTypeLabel(demand.type))}</span>
                <strong>${escapeHtml(demand.label)}</strong>
                <em>${escapeHtml(demand.shotLabels.slice(0, 6).join('、') || '-')}</em>
                <small>${escapeHtml(statusText)}</small>
            </div>
            <div class="shot-asset-demand-actions">
                <button class="shot-asset-open-demand" type="button" data-demand-key="${escapeAttr(demand.key)}">${active ? '正在选择' : '选择资产'}</button>
                ${canMarkNoAsset ? `
                <label class="shot-asset-none ${noAsset ? 'selected' : ''}">
                    <input class="shot-asset-no-asset" type="checkbox" data-demand-key="${escapeAttr(demand.key)}" ${noAsset ? 'checked' : ''}>
                    无资产
                </label>` : ''}
            </div>
        </div>`;
    }).join('');
    const boundCount = demands.reduce((sum, demand) => sum + shotAssetCollectorBindings(node, demand.key).length, 0);
    const shotNames = cards.map(shotAssetCardLabel).slice(0, 12).join('、');
    const picker = shotAssetPickerHtml(node);
    return `<div class="shot-asset-collector-body">
        <div class="shot-asset-title">故事板资产收集器</div>
        <div class="shot-asset-sub">只保留人物和场景两类资产。选择后不回弹，参考图可多选，未绑定也可以继续生成。</div>
        <div class="shot-asset-stats">
            <span><b>${cards.length}</b>故事板</span>
            <span><b>${demands.length}</b>需求</span>
            <span><b>${boundCount}</b>已绑定</span>
            <span><b>${candidates.length}</b>候选资产</span>
        </div>
        <div class="shot-asset-switches">
            <label><input class="shot-asset-toggle" data-shot-asset-key="useAssetLibrary" type="checkbox" ${node.useAssetLibrary === true && node.manualSelectionOnly === false ? 'checked' : ''}>读取项目资产库</label>
            <label><input class="shot-asset-toggle" data-shot-asset-key="useCanvasInputs" type="checkbox" ${node.useCanvasInputs !== false ? 'checked' : ''}>读取连入图片</label>
            <label><input class="shot-asset-toggle" data-shot-asset-key="inheritPrevious" type="checkbox" ${node.inheritPrevious !== false ? 'checked' : ''}>继承上一镜结束帧</label>
        </div>
        <div class="shot-asset-linked">故事板：${escapeHtml(shotNames || '未连接故事板')}</div>
        ${shotAssetRecommendationBarHtml(node)}
        <div class="shot-asset-category-tabs">${categoryTabs}</div>
        <div class="shot-asset-workspace">
            <div class="shot-asset-demand-list">${rows || `<div class="shot-asset-empty">当前“${escapeHtml(shotAssetPickerCategoryLabel(activeCategory))}”分类暂无需求。</div>`}</div>
            ${picker}
        </div>
        <div class="shot-asset-rule">绑定的人物/场景图片会在生成图片/视频时自动传入，并写成 @资产名；服装、道具、风格参考不再进入本收集器。</div>
    </div>`;
}

function smartAssetHubBodyHtml(node){
    const assets = smartAssetHubImageRecords(node);
    const counts = assets.reduce((acc, item) => {
        acc[item.category || 'other'] = (acc[item.category || 'other'] || 0) + 1;
        return acc;
    }, {});
    const linkedTargets = smartAssetConnectedNodeIds(node)
        .map(id => nodes.find(n => n.id === id))
        .filter(n => n && ['script-storyboard','storyboard-card'].includes(n.type));
    const assetList = assets.slice(0, 18).map(item => `<span class="asset-hub-item ${escapeAttr(item.category || 'other')}">${escapeHtml(smartAssetCategoryLabel(item.category))} · ${escapeHtml(item.name || '参考图')}</span>`).join('');
    return `<div class="asset-hub-body">
        <div class="asset-hub-title">全剧资产中枢</div>
        <div class="asset-hub-sub">角色、场景、服装、道具参考图先连到这里，再连到“分镜转故事板”或故事板卡。</div>
        <div class="asset-hub-stats">
            <span><b>${assets.length}</b>参考图</span>
            <span><b>${counts.character || 0}</b>人物</span>
            <span><b>${counts.scene || 0}</b>场景</span>
            <span><b>${counts.wardrobe || 0}</b>服装</span>
            <span><b>${counts.prop || 0}</b>道具</span>
        </div>
        <div class="asset-hub-switches">
            <label><input class="asset-hub-toggle" data-asset-hub-key="useLibrary" type="checkbox" ${node.useLibrary !== false ? 'checked' : ''}>读取素材库</label>
            <label><input class="asset-hub-toggle" data-asset-hub-key="allowMissing" type="checkbox" ${node.allowMissing !== false ? 'checked' : ''}>允许无资产</label>
        </div>
        <div class="asset-hub-linked">已连接目标：${escapeHtml(linkedTargets.map(n => n.title || n.shot?.shotNumber || '故事板').join('、') || '未连接')}</div>
        <div class="asset-hub-list">${assetList || '<span class="asset-hub-empty">把人物/场景图片节点连进来，或打开“读取素材库”。</span>'}</div>
        <div class="asset-hub-actions">
            <button class="storyboard-control asset-hub-refresh" type="button">刷新匹配</button>
            <button class="storyboard-control asset-hub-copy" type="button">复制资产清单</button>
        </div>
        <div class="asset-hub-rule">优先级：@指定 > 手动参考 > 中枢匹配 > 文字生成。</div>
    </div>`;
}

function storyboardAiConfigForCard(card){
    const source = nodes.find(item => item.id === card?.sourceStoryboardId && item.type === 'script-storyboard');
    const provider = resolveChatProviderId(source?.llmProvider || '');
    return {provider, model:resolveChatModel(source?.llmModel || '', provider)};
}

function normalizeStoryboardDirectorReview(payload){
    const raw = payload && typeof payload === 'object' ? payload : {};
    const issues = (Array.isArray(raw.issues) ? raw.issues : [])
        .map((item, index) => {
            const category = ['clarity','redundancy','continuity','storyboard-video','asset'].includes(item?.category) ? item.category : 'clarity';
            const severity = ['high','medium','low'].includes(item?.severity) ? item.severity : 'low';
            const message = String(item?.message || '').trim();
            if(!message) return null;
            return {
                id:String(item?.id || `issue-${index + 1}`),
                category,
                severity,
                message,
                suggestion:String(item?.suggestion || '').trim(),
                frameIds:(Array.isArray(item?.frameIds) ? item.frameIds : []).map(value => String(value || '').trim()).filter(Boolean).slice(0, 8)
            };
        })
        .filter(Boolean)
        .slice(0, 12);
    const explicit = String(raw.status || '').toLowerCase();
    const status = ['pass','warning','revise'].includes(explicit)
        ? explicit
        : issues.some(item => item.severity === 'high') ? 'revise' : issues.length ? 'warning' : 'pass';
    const scoreValue = Number(raw.score);
    return {
        status,
        score:Number.isFinite(scoreValue) ? Math.max(0, Math.min(100, Math.round(scoreValue))) : status === 'pass' ? 90 : status === 'warning' ? 75 : 55,
        summary:String(raw.summary || (status === 'pass' ? '故事板清晰、连贯，可以继续生成。' : '发现需要人工判断的故事板风险。')).trim(),
        issues,
        reviewedAt:Date.now()
    };
}

function storyboardDirectorReviewHtml(node){
    const review = node?.directorReview;
    if(node?.directorReviewRunning){
        return `<div class="storyboard-director-review running"><div class="storyboard-director-review-head"><b>导演复核</b><span>AI正在检查剧情可读性与连续性...</span></div></div>`;
    }
    if(!review || typeof review !== 'object') return '';
    const labels = {pass:'通过', warning:'有提醒', revise:'建议修改'};
    const categoryLabels = {clarity:'剧情清晰', redundancy:'重复画面', continuity:'连续性', 'storyboard-video':'图像/视频一致', asset:'资产引用'};
    const issues = (review.issues || []).map(item => `<div class="storyboard-director-issue ${escapeAttr(item.severity || 'low')}">
        <div><b>${escapeHtml(categoryLabels[item.category] || '复核项')}</b><em>${escapeHtml(item.severity === 'high' ? '重要' : item.severity === 'medium' ? '注意' : '建议')}</em></div>
        <span>${escapeHtml(item.message || '')}</span>
        ${item.suggestion ? `<small>${escapeHtml(item.suggestion)}</small>` : ''}
    </div>`).join('');
    return `<div class="storyboard-director-review ${escapeAttr(review.status || 'warning')}">
        <div class="storyboard-director-review-head"><div><b>导演复核 · ${escapeHtml(labels[review.status] || '已完成')}</b><span>${escapeHtml(String(review.score ?? '-'))}分 · 只提醒，不阻断生成</span></div><time>${escapeHtml(new Date(review.reviewedAt || Date.now()).toLocaleString('zh-CN', {hour:'2-digit', minute:'2-digit'}))}</time></div>
        <p>${escapeHtml(review.summary || '')}</p>
        ${issues ? `<div class="storyboard-director-issues">${issues}</div>` : '<div class="storyboard-director-pass">没有发现需要处理的问题。</div>'}
    </div>`;
}

async function reviewStoryboardCardWithAi(node){
    if(!node || node.type !== 'storyboard-card' || node.cardKind !== 'storyboard' || node.directorReviewRunning) return;
    const related = nodes
        .filter(item => item.type === 'storyboard-card' && item.cardKind === 'storyboard' && item.sourceStoryboardId === node.sourceStoryboardId)
        .sort((a, b) => (Number(a.x) || 0) - (Number(b.x) || 0) || (Number(a.y) || 0) - (Number(b.y) || 0));
    const index = related.findIndex(item => item.id === node.id);
    const collector = shotAssetCollectorForCard(node);
    const demands = collector ? shotAssetCollectorDemandsForCard(collector, node).map(demand => ({
        key:demand.key,
        type:shotAssetDemandCategory(demand),
        label:demand.label,
        assets:shotAssetCollectorBindings(collector, demand.key).map(item => item.name || item.alias || '参考图'),
        noAsset:shotAssetCollectorNoAsset(collector, demand.key)
    })) : [];
    const compactShot = card => card ? {
        shotNumber:card.shot?.shotNumber,
        timeRange:card.shot?.timeRange,
        purpose:card.shot?.purpose,
        subjects:card.shot?.subjects,
        leftRight:card.shot?.visualExtract?.leftRight,
        eyeDirection:card.shot?.visualExtract?.eyeDirection,
        transition:card.shot?.transition,
        frames:(card.shot?.frames || []).map(frame => ({frameId:frame.frameId, description:frame.description, composition:frame.composition, emotion:frame.emotion}))
    } : null;
    const message = JSON.stringify({
        current:{...compactShot(node), sourceText:node.shot?.sourceText, cameraType:node.shot?.cameraType, cameraMove:node.shot?.cameraMove, videoPrompt:smartStoryboardVideoPrompt(node)},
        previous:compactShot(related[index - 1]),
        next:compactShot(related[index + 1]),
        assetRequirements:demands
    }, null, 2);
    const systemPrompt = `你是真人情感短剧的导演复核员。检查一张10—15秒故事板卡，不重写剧情，只识别会导致观众看不懂、出图混乱或视频与故事板不一致的问题。重点检查：1. 不看剧本能否从关键帧看懂起因、推进和落点；2. 是否有重复信息帧或缺失关键变化；3. 人物左右站位、视线、轴线、动作衔接是否稳定；4. 每帧是否只有一个明确视觉任务；5. 可见情绪表演是否具体但没有新增剧情；6. 视频提示词是否覆盖相同剧情、人物、站位和节奏；7. 资产缺失只能提醒，不能判定为阻断。帧数必须按剧情需要，不要求固定3、4或9帧。只输出JSON：{"status":"pass|warning|revise","score":0,"summary":"一句总结","issues":[{"id":"issue-1","category":"clarity|redundancy|continuity|storyboard-video|asset","severity":"high|medium|low","message":"具体问题","suggestion":"可执行修改建议","frameIds":["帧ID"]}]}。没有问题时issues输出空数组。`;
    node.directorReviewRunning = true;
    render();
    try {
        const ai = storyboardAiConfigForCard(node);
        const result = await requestSmartCanvasLlmText(message, {...ai, systemPrompt});
        const payload = window.ScriptToStoryboard?.extractJson?.(result.text);
        if(!payload) throw new Error('AI没有返回可解析的复核结果');
        node.directorReview = {...normalizeStoryboardDirectorReview(payload), provider:result.provider, model:result.model};
        toast(node.directorReview.status === 'pass' ? '导演复核通过' : `导演复核完成：${node.directorReview.issues.length} 项提醒`);
        scheduleSave();
    } catch(error){
        toast(`导演复核失败：${String(error?.message || error).slice(0, 100)}`);
    } finally {
        node.directorReviewRunning = false;
        render();
    }
}

function smartStoryboardShotCardBodyHtml(node){
    const shot = node.shot || {};
    const isStorySegment = String(shot.shotNumber || '').includes('故事段') || String(shot.timeRange || '').includes('15');
    const storySegmentLabel = String(shot.timeRange || '').trim() || '10—15秒';
    shot.frames = Array.isArray(shot.frames) && shot.frames.length ? shot.frames : (window.ScriptToStoryboard?.regenerateFrame ? [window.ScriptToStoryboard.regenerateFrame(shot, 0)] : []);
    shot.frameCount = Math.max(1, Number(shot.frameCount) || shot.frames.length || 1);
    shot.videoPrompt = shot.videoPrompt && typeof shot.videoPrompt === 'object' ? shot.videoPrompt : {text:smartStoryboardVideoPrompt(node), source:'auto'};
    const headerFields = (window.ScriptToStoryboard?.storyboardHeaderFields?.(shot) || [
        ['镜头编号', shot.shotNumber],
        ['时间范围', shot.timeRange],
        ['景别', shot.shotSize],
        ['机位类型', shot.cameraType],
        ['焦段', shot.focalLength],
        ['主体人物', shot.subjects],
        ['情绪变化', shot.emotionChange],
        ['运镜方式', shot.cameraMove],
        ['故事板帧数', shot.frameCount]
    ]);
    const assetFields = smartStoryboardAssetFields(shot);
    const assetHeaderFields = [
        ['主要人物', assetFields.main],
        ['第二人物', assetFields.second],
        ['第三人物', assetFields.third],
        ['场景', assetFields.scene],
        ['时间状态', assetFields.timeState],
        ['服装/造型', assetFields.wardrobe],
        ['道具', (assetFields.props || []).join('、')]
    ];
    const headerHtml = [...headerFields, ...assetHeaderFields].map(([label, value]) => `<div class="storyboard-meta-item"><b>${escapeHtml(label)}</b><span>${escapeHtml(value || '-')}</span></div>`).join('');
    const visualExtractText = window.ScriptToStoryboard?.visualExtractText?.(shot) || '暂无提取信息';
    const videoPrompt = smartStoryboardVideoPrompt(node);
    const referenceAssets = Array.isArray(shot.referenceAssets) ? shot.referenceAssets : [];
    const referenceText = referenceAssets.map(item => typeof item === 'string' ? item : `${item.name || '-'}${item.note ? `：${item.note}` : ''}`).join('\n');
    const continuityText = [
        shot.transition && `衔接：${shot.transition}`,
        shot.audio && `声音：${shot.audio}`
    ].filter(Boolean).join('\n');
    const framesHtml = shot.frames.map((frame, index) => `
        <div class="storyboard-frame ${frame.locked ? 'locked' : ''}" data-frame-index="${index}">
            <div class="storyboard-frame-top">
                <strong>${escapeHtml(frame.label || `故事板帧${index + 1}`)}</strong>
                <span>${escapeHtml(frame.frameId || `${shot.shotNumber || '镜头'}-F${index + 1}`)}</span>
                <button class="storyboard-frame-top-preview storyboard-frame-preview" type="button" data-frame-index="${index}">预演图</button>
            </div>
            <div class="storyboard-frame-board">
                <div class="storyboard-frame-tag">${escapeHtml(shot.shotSize || '画面')}</div>
                <div class="storyboard-frame-main">${escapeHtml(frame.description || '等待生成故事板描述')}</div>
                <div class="storyboard-frame-sub">${escapeHtml(frame.composition || '构图信息待补充')}</div>
                <div class="storyboard-frame-emotion">${escapeHtml(frame.emotion || shot.emotionChange || '')}</div>
            </div>
            <textarea class="storyboard-frame-desc" data-frame-desc="${index}" ${frame.locked ? 'disabled' : ''}>${escapeHtml(frame.description || '')}</textarea>
            <div class="storyboard-frame-actions">
                <button class="storyboard-control storyboard-frame-regen" type="button" data-frame-index="${index}" ${frame.locked ? 'disabled' : ''}>单独重新生成</button>
                <button class="storyboard-control storyboard-frame-lock" type="button" data-frame-index="${index}">${frame.locked ? '解锁' : '锁定'}</button>
                <button class="storyboard-control storyboard-frame-edit" type="button" data-frame-index="${index}" ${frame.locked ? 'disabled' : ''}>编辑描述</button>
                <button class="storyboard-control storyboard-frame-preview" type="button" data-frame-index="${index}">生成写实预演图</button>
            </div>
        </div>
    `).join('');
    return `<div class="storyboard-shot-card-body">
        <div class="storyboard-card-topline">
            <div class="storyboard-card-label">${isStorySegment ? `${escapeHtml(storySegmentLabel)} 故事板卡` : '镜头故事板卡'}</div>
            <div class="storyboard-shot-actions">
                <button class="storyboard-control storyboard-director-review-btn" type="button" ${node.directorReviewRunning ? 'disabled' : ''}>${node.directorReviewRunning ? '复核中...' : node.directorReview ? '重新复核' : '导演复核'}</button>
                <button class="storyboard-control storyboard-video-node" type="button">${isStorySegment ? '生成本段视频节点' : '生成视频节点'}</button>
                <div class="storyboard-shot-action-group">
                    <span>导演标注</span>
                    <div>
                        <button class="storyboard-control storyboard-shot-preview" type="button" data-preview-style="director" data-grid-count="9">生成九宫格</button>
                        <button class="storyboard-control storyboard-shot-preview" type="button" data-preview-style="director" data-grid-count="12">生成十二宫格</button>
                    </div>
                </div>
                <div class="storyboard-shot-action-group realistic">
                    <span>写实预演</span>
                    <div>
                        <button class="storyboard-control storyboard-shot-preview" type="button" data-preview-style="realistic" data-grid-count="9">生成九宫格</button>
                        <button class="storyboard-control storyboard-shot-preview" type="button" data-preview-style="realistic" data-grid-count="12">生成十二宫格</button>
                    </div>
                </div>
            </div>
        </div>
        ${storyboardDirectorReviewHtml(node)}
        <div class="storyboard-shot-meta">${headerHtml}</div>
        <div class="storyboard-visual-extract">
            <div class="storyboard-visual-extract-head">
                <b>画面提取</b>
                <button class="storyboard-control storyboard-copy-extract" type="button">复制</button>
            </div>
            <span>${escapeHtml(visualExtractText)}</span>
        </div>
        ${smartStoryboardAssetPanelHtml(node)}
        ${continuityText ? `<div class="storyboard-compact-info"><b>衔接与声音</b><span>${escapeHtml(continuityText)}</span></div>` : ''}
        ${referenceText ? `<div class="storyboard-compact-info"><b>需要参考资产</b><span>${escapeHtml(referenceText)}</span></div>` : ''}
        <div class="storyboard-video-prompt">
            <div class="storyboard-video-prompt-head">
                <b>视频提示词</b>
                <div>
                    <button class="storyboard-control storyboard-copy-video" type="button">复制</button>
                    <button class="storyboard-control storyboard-refresh-from-video" type="button">刷新故事板</button>
                </div>
            </div>
            <textarea class="storyboard-control storyboard-video-text">${escapeHtml(videoPrompt)}</textarea>
        </div>
        <div class="storyboard-frame-list">${framesHtml}</div>
    </div>`;
}

function smartStoryboardCardBodyHtml(node){
    if(node.cardKind === 'storyboard') return smartStoryboardShotCardBodyHtml(node);
    const shot = node.shot || {};
    const fields = node.cardKind === 'visual'
        ? [
            ['镜头编号', shot.shotNumber],
            ['人物/主体', shot.visual?.subject],
            ['动作', shot.visual?.action],
            ['情绪', shot.visual?.emotion],
            ['场景', shot.visual?.scene],
            ['景别/机位', shot.visual?.camera],
            ['视觉重点', shot.visual?.focus],
            ['光线', shot.visual?.lighting],
            ['避免事项', shot.visual?.avoid]
        ]
        : [
            ['镜头编号', shot.shotNumber],
            ['剧情内容', shot.breakdown?.story],
            ['故事目的', shot.breakdown?.purpose],
            ['简要动作概述', shot.breakdown?.actionSummary]
        ];
    const actions = node.cardKind === 'visual'
        ? `<div class="storyboard-card-actions"><button class="storyboard-control storyboard-copy-all" type="button">复制全部信息</button><button class="storyboard-control storyboard-make-prompt" type="button">填入生成框</button></div>`
        : '';
    return `<div class="storyboard-card-body ${node.cardKind || 'breakdown'}">
        <div class="storyboard-card-label">${node.cardKind === 'visual' ? '分镜画面卡' : '分镜拆解卡'}</div>
        ${actions}
        ${smartStoryboardFieldRows(fields)}
    </div>`;
}

function smartImagePromptSourceVisualCard(card){
    if(!card) return null;
    const linked = (canvas?.connections || [])
        .filter(c => c.to === card.id)
        .map(c => nodes.find(n => n.id === c.from))
        .find(n => n?.type === 'storyboard-card' && n.cardKind === 'visual');
    return linked || nodes.find(n => n.id === card.sourceVisualCardId && n.type === 'storyboard-card' && n.cardKind === 'visual') || null;
}

function syncSmartImagePromptCardFromSource(card, options={}){
    if(!card || card.type !== 'image-prompt-card') return false;
    const source = smartImagePromptSourceVisualCard(card);
    if(!source?.shot){
        if(options.clearIfMissing){
            card.sourceVisualCardId = '';
            card.sourceInfo = '';
            if(card.autoPrompt !== false) card.promptText = '';
        }
        return false;
    }
    const info = window.ScriptToStoryboard.visualInfoText(source.shot);
    const draft = window.ScriptToStoryboard.imagePromptDraft(source.shot);
    const changed = card.sourceVisualCardId !== source.id || card.sourceInfo !== info || (card.autoPrompt !== false && card.promptText !== draft);
    card.sourceVisualCardId = source.id;
    card.shotNumber = source.shot.shotNumber || '';
    card.sourceInfo = info;
    if(card.autoPrompt !== false) card.promptText = draft;
    return changed;
}

function smartImagePromptCardBodyHtml(node){
    syncSmartImagePromptCardFromSource(node);
    return `<div class="image-prompt-card-body">
        <div class="storyboard-card-label">生图提示词卡</div>
        <div class="storyboard-prompt-head"><span>来源画面卡信息预览</span><button class="storyboard-control storyboard-sync-source" type="button">重新同步</button></div>
        <pre class="image-prompt-source">${escapeHtml(node.sourceInfo || '未连接分镜画面卡')}</pre>
        <label class="storyboard-label">生图提示词文本</label>
        <textarea class="storyboard-control image-prompt-text">${escapeHtml(node.promptText || '')}</textarea>
    </div>`;
}

function createImagePromptCardNode(x, y, options={}){
    if(!options.skipUndo) pushUndo();
    const node = {id:uid('s2p'), type:'image-prompt-card', x, y, w:360, h:430, sourceStoryboardId:'', sourceVisualCardId:'', sourceInfo:'', promptText:'', autoPrompt:true, created_at:Date.now()};
    nodes.push(node);
    if(options.select !== false) selectedId = node.id;
    render();
    scheduleSave();
    return node;
}

function createSmartImagePromptCardFromVisual(visualCardId){
    const source = nodes.find(n => n.id === visualCardId && n.type === 'storyboard-card' && n.cardKind === 'visual');
    if(!source) return null;
    const prompt = window.ScriptToStoryboard.imagePromptDraft(source.shot);
    let target = activeComposerNode() || selectedNode();
    if(!isSmartRunnableNode(target)){
        const baseX = Number(source.x || 0) + Math.max(Number(source.w || 330), 330) + 220;
        const baseY = Number(source.y || 0) - 120;
        target = createNode(baseX, baseY, []);
    }
    selectedId = target.id;
    selectedIds = [];
    selectedImage = {nodeId:'', index:-1};
    if(!((canvas?.connections || []).some(c => c.from === source.id && c.to === target.id))){
        addConnection(source.id, target.id, 'input');
    }
    setPromptDraftForNode(target, prompt);
    target.runPrompt = prompt;
    target.promptOriginalText = prompt;
    render();
    updateComposer();
    setPromptDraftForNode(target, prompt);
    setPromptText(prompt);
    delete promptInput.dataset.preserveDraftOnce;
    savePromptDraftForCurrent();
    renderInputThumbsRow(target);
    promptInput?.focus({preventScroll:true});
    const selection = window.getSelection?.();
    if(selection && promptInput){
        const range = document.createRange();
        range.selectNodeContents(promptInput);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
    }
    toast('已填入生成输入框');
    scheduleSave();
    return target;
}

function smartStoryboardReferenceImagesFor(source, prompt=''){
    const collectorRefs = shotAssetCollectorRefsForCard(source);
    const refs = [
        ...collectorRefs,
        ...(collectorRefs.length ? [] : storyboardManualAssetRefsFor(source)),
        ...smartResolvePlainMentionImages(prompt),
        ...manualReferenceImagesFor(source)
    ];
    return uniqueReferenceImages(refs);
}

function storyboardDurationSeconds(shot){
    const raw = `${shot?.timeRange || ''} ${shot?.sourceText || ''}`;
    const range = raw.match(/(\d+(?:\.\d+)?)\s*[\u2013\u2014\-~到至]\s*(\d+(?:\.\d+)?)\s*秒?/);
    if(range){
        const diff = Number(range[2]) - Number(range[1]);
        if(Number.isFinite(diff) && diff > 0) return Math.max(1, Math.min(60, Math.round(diff)));
    }
    const single = raw.match(/(?:本镜时长|时长)\s*[:：]?\s*(\d+(?:\.\d+)?)\s*秒/);
    if(single){
        const n = Number(single[1]);
        if(Number.isFinite(n) && n > 0) return Math.max(1, Math.min(60, Math.round(n)));
    }
    return 5;
}

function smartStoryboardVideoSettingsFor(shot){
    const next = cloneSmartSettings(settings || {});
    next.engine = isApiLikeEngine(next.engine) ? next.engine : 'api';
    next.apiKind = 'video';
    const providers = videoApiProviders();
    if(!next.videoProvider || !providers.some(p => p.id === next.videoProvider)) next.videoProvider = providers[0]?.id || 'comfly';
    const models = filterJimengVideoModels(providerVideoModels(next.videoProvider));
    if(!next.videoModel || !models.includes(next.videoModel)) next.videoModel = models[0] || 'veo3-fast';
    next.videoDuration = normalizeSmartVideoDuration(storyboardDurationSeconds(shot), next.videoProvider);
    next.videoAspect = next.videoAspect || '16:9';
    normalizeSmartVideoModeSettings(next, true);
    return settingsForStorage(next);
}

function smartStoryboardImageSettingsFor(){
    const providers = imageProviders();
    const providerId = providers.some(p => p.id === 'codex') ? 'codex' : (providers[0]?.id || '');
    const models = providerImageModels(providerId);
    const model = models.includes('gpt-image-2') ? 'gpt-image-2' : (models[0] || 'gpt-image-2');
    const next = cloneSmartSettings(settings || {});
    next.engine = 'api';
    next.apiKind = 'image';
    next.provider_id = providerId;
    next.model = model;
    next.ratio = 'wide';
    next.aspect_ratio = '16:9';
    next.aspectRatio = '16:9';
    next.width = 2048;
    next.height = 1152;
    next.customWidth = 2048;
    next.customHeight = 1152;
    next.customSize = '2048x1152';
    next.resolution = '2k';
    next.quality = 'auto';
    next.count = 1;
    clearVolcengineSelectionOutsideVolcengine(next);
    sanitizeSmartApiSelection(next);
    next.engine = 'api';
    next.apiKind = 'image';
    next.provider_id = providerId;
    next.model = model;
    next.ratio = 'wide';
    next.aspect_ratio = '16:9';
    next.aspectRatio = '16:9';
    next.width = 2048;
    next.height = 1152;
    next.customWidth = 2048;
    next.customHeight = 1152;
    next.customSize = '2048x1152';
    next.resolution = '2k';
    next.quality = 'auto';
    next.count = 1;
    return settingsForStorage(next);
}

function storyboardProviderLabel(id, type='image'){
    const value = String(id || '').trim();
    const list = type === 'video'
        ? (typeof videoApiProviders === 'function' ? videoApiProviders() : [])
        : (typeof imageProviders === 'function' ? imageProviders() : []);
    const hit = list.find(item => item.id === value);
    return hit?.name || hit?.label || value || '-';
}

function storyboardOutputKindLabel(kind){
    if(kind === 'video') return '视频节点';
    if(kind === 'frame-preview') return '单帧预演图';
    if(kind === 'whole-preview') return '整段故事板';
    if(kind === 'asset-image') return '资产生图';
    return '故事板输出';
}

function storyboardOutputDisplayTitle(node){
    const current = String(node?.title || '').trim();
    const generic = /^(Image|Video|Videos|Group|图片|视频|生成图片)$/i;
    if(current && !generic.test(current)) return current;
    const source = nodes.find(n => n.id === node?.storyboardSourceCardId);
    const label = source?.shot?.shotNumber || source?.title || '故事板';
    return `${label} ${storyboardOutputKindLabel(node?.storyboardOutputKind)}`;
}

function storyboardOutputReferenceImages(node){
    return uniqueReferenceImages([
        ...(node?.manualInputRefs || []),
        ...(node?.runPromptRefs || []),
        ...(node?.runInputRefs || [])
    ]);
}

function storyboardOutputSettingsRows(node){
    const s = node?.runSettings || {};
    if(node?.storyboardOutputKind === 'video' || s.apiKind === 'video'){
        return [
            ['接口', storyboardProviderLabel(s.videoProvider, 'video')],
            ['模型', s.videoModel || '-'],
            ['时长', s.videoDuration ? `${s.videoDuration}秒` : '-'],
            ['画幅', s.videoAspect || s.aspectRatio || s.aspect_ratio || '-']
        ];
    }
    const size = typeof apiImageSize === 'function'
        ? apiImageSize(s.ratio || 'wide', s.resolution || '2k', s.customRatio || '', s.customSize || '')
        : (s.customSize || '');
    const ratioText = ({
        square:'1:1', poster45:'4:5', portrait43:'3:4', portrait:'2:3', story:'9:16',
        landscape54:'5:4', landscape43:'4:3', wide:'16:9', landscape:'3:2', ultrawide:'21:9', ultratall:'9:21'
    })[s.ratio || ''] || s.aspectRatio || s.aspect_ratio || '-';
    return [
        ['接口', storyboardProviderLabel(s.provider_id, 'image')],
        ['模型', s.model || '-'],
        ['画幅', ratioText],
        ['清晰度', [String(s.resolution || '').toUpperCase(), size].filter(Boolean).join(' · ') || '-']
    ];
}

function storyboardOutputMediaHtml(node){
    const imgs = (node?.images || []).map(imageForDisplay).filter(img => img?.url);
    if(!imgs.length){
        const running = Boolean(node?.pending || node?.running || node?.queued || node?.jimengPending);
        return `<div class="storyboard-output-empty">${running ? '生成中...' : '生成结果会显示在这里'}</div>`;
    }
    const first = imgs[0];
    const media = typeof singleMediaHtml === 'function'
        ? singleMediaHtml(first, 500, 180)
        : `<img src="${escapeAttr(first.url)}" alt="">`;
    const badge = typeof imageResolutionBadgeHtml === 'function' ? imageResolutionBadgeHtml(first) : '';
    const selected = selectedImage?.nodeId === node?.id && Number(selectedImage?.index) === 0 ? 'image-selected' : '';
    return `<div class="storyboard-output-media ${selected}" data-image-index="0" data-media-signature="${escapeAttr(`${mediaKindForItem(first)}:${first?.url || ''}`)}">${media}${badge}</div>`;
}

function smartStoryboardOutputNodeBodyHtml(node){
    const prompt = String(node?.runPrompt || node?.promptDraftText || '').trim();
    const isVideo = node?.storyboardOutputKind === 'video' || node?.runSettings?.apiKind === 'video';
    const refs = storyboardOutputReferenceImages(node);
    const rows = storyboardOutputSettingsRows(node).map(([label, value]) => `<div><b>${escapeHtml(label)}</b><span>${escapeHtml(value || '-')}</span></div>`).join('');
    const refThumbs = refs.length && typeof smartNodeInputThumbsHtml === 'function'
        ? `<div class="storyboard-output-refs">${smartNodeInputThumbsHtml(refs, {labelPrefix:'参考'})}</div>`
        : '';
    const promptBody = prompt
        ? `<textarea class="storyboard-output-prompt" readonly>${escapeHtml(prompt)}</textarea>`
        : `<div class="storyboard-output-no-prompt">没有可用提示词。来源故事板没有生成出视频/画面提示词，不能直接生成。</div>`;
    const disabled = !prompt || node?.running || node?.pending || node?.queued ? 'disabled' : '';
    return `<div class="storyboard-output-card">
        <div class="storyboard-output-top">
            <input class="storyboard-output-title" type="text" value="${escapeAttr(storyboardOutputDisplayTitle(node))}" readonly>
            <span>${escapeHtml(storyboardOutputKindLabel(node?.storyboardOutputKind))}</span>
        </div>
        <div class="storyboard-output-settings">${rows}</div>
        ${refThumbs}
        ${promptBody}
        ${storyboardOutputMediaHtml(node)}
        <div class="storyboard-output-actions">
            <button class="storyboard-control storyboard-output-copy" type="button" data-storyboard-output-copy="${escapeAttr(node?.id || '')}" ${prompt ? '' : 'disabled'}>复制提示词</button>
            <button class="storyboard-output-run" type="button" data-storyboard-output-run="${escapeAttr(node?.id || '')}" ${disabled}><i data-lucide="${node?.running || node?.pending ? 'loader-2' : 'sparkles'}"></i><span>${node?.running || node?.pending ? '生成中' : isVideo ? '立即生成视频' : '立即生图'}</span></button>
        </div>
    </div>`;
}

function configureStoryboardOutputNode(target, source, prompt, settingsPatch, kind){
    const cleanPrompt = String(prompt || '').trim();
    if(!target || !source || !cleanPrompt) return false;
    const title = `${source.shot?.shotNumber || '镜头'} ${kind === 'video' ? '视频' : kind === 'frame-preview' ? '预演图' : '整段故事板'}`;
    target.title = title;
    target.storyboardSourceCardId = source.id;
    target.storyboardOutputKind = kind;
    target.runSettings = typeof posterFrameNormalizedRunSettings === 'function' && kind !== 'video'
        ? posterFrameNormalizedRunSettings(settingsPatch)
        : cloneSmartSettings(settingsPatch);
    const refs = smartStoryboardReferenceImagesFor(source, cleanPrompt);
    target.manualInputRefs = refs;
    target.runPromptRefs = refs;
    target.runInputRefs = refs;
    if(kind !== 'video'){
        target.type = 'smart-frame';
        target.frameTitle = title;
        target.prompt = cleanPrompt;
        target.sizeHint = storyboardOutputKindLabel(kind);
        target.images = Array.isArray(target.images) ? target.images : [];
        target.w = Math.max(Number(target.w) || 0, 560);
        target.h = Math.max(Number(target.h) || 0, 650);
    } else {
        target.w = Math.max(Number(target.w) || 0, 560);
        target.h = Math.max(Number(target.h) || 0, 620);
        setPromptDraftForNode(target, cleanPrompt);
    }
    target.runPrompt = cleanPrompt;
    target.promptOriginalText = cleanPrompt;
    return true;
}

async function runStoryboardOutputNode(nodeId){
    let node = nodes.find(n => n.id === nodeId && n.type === 'smart-image' && n.storyboardOutputKind);
    if(!node) return;
    if(typeof smartNodeInFlight === 'function' && smartNodeInFlight(node)) return;
    const prompt = String(node.runPrompt || node.promptDraftText || '').trim();
    if(!prompt){ toast('没有可用提示词'); return; }
    const previousSettings = cloneSmartSettings(settings);
    const runSettings = cloneSmartSettings(node.runSettings || settings);
    settings = {...settings, ...runSettings};
    if((!node.runPromptRefs || !node.runPromptRefs.length) && node.manualInputRefs?.length) node.runPromptRefs = node.manualInputRefs.map(ref => ({...ref}));
    if((!node.runInputRefs || !node.runInputRefs.length) && node.manualInputRefs?.length) node.runInputRefs = node.manualInputRefs.map(ref => ({...ref}));
    let request = null;
    try {
        request = typeof buildPromptRequestForNode === 'function' ? buildPromptRequestForNode(node, null) : null;
    } catch(err) {
        request = null;
    }
    const refs = uniqueReferenceImages([
        ...((request?.refs || []).filter(ref => ref?.url)),
        ...storyboardOutputReferenceImages(node)
    ]).map((ref, index) => ({...ref, role:ref.role || `image_${index + 1}`}));
    const modelPrompt = String(request?.prompt || '').trim() || prompt;
    const displayPrompt = String(request?.displayPrompt || '').trim() || prompt;
    const kind = (settings.apiKind === 'video' || node.storyboardOutputKind === 'video') ? 'video' : 'image';
    const meta = {
        prompt:modelPrompt,
        displayPrompt,
        promptHtml:node.promptDraftHtml || escapeHtml(displayPrompt),
        promptText:displayPrompt,
        promptRefs:refs.map(ref => ({url:ref.url || '', name:ref.name || '', nodeId:ref.nodeId || '', imageIndex:ref.imageIndex ?? '', kind:ref.kind || ''})).filter(ref => ref.url),
        inputRefs:refs.map(ref => ({url:ref.url || '', name:ref.name || '', nodeId:ref.nodeId || '', imageIndex:ref.imageIndex ?? '', kind:ref.kind || ''})).filter(ref => ref.url),
        sourceNodeId:node.id,
        settings:cloneSmartSettings(settings),
        createdAt:Date.now()
    };
    const runLog = typeof smartRunSnapshot === 'function' ? smartRunSnapshot(node, modelPrompt, refs, kind) : null;
    const runLogStart = typeof nowMs === 'function' ? nowMs() : Date.now();
    pushUndo();
    node.pending = 1;
    node.running = true;
    node.runStartedAt = runLogStart;
    delete node.runFinishedAt;
    delete node.runElapsedMs;
    node.runTimerHidden = false;
    render();
    try {
        const result = await generateUrlsForCurrentSettings(node, modelPrompt, refs, settings);
        const urls = result?.urls || resultMediaUrls(result);
        if(!urls?.length) throw new Error(kind === 'video' ? '没有返回视频结果' : '没有返回图片结果');
        finalizePosterFrameNode(node, urls, meta, result?.kind || kind);
        node = nodes.find(n => n.id === nodeId) || node;
        node.storyboardOutputKind = node.storyboardOutputKind || (kind === 'video' ? 'video' : 'whole-preview');
        node.title = storyboardOutputDisplayTitle(node);
        node.w = Math.max(Number(node.w) || 0, 560);
        node.h = Math.max(Number(node.h) || 0, kind === 'video' ? 620 : 650);
        if(typeof addSmartGenerationLog === 'function') addSmartGenerationLog({run:runLog, outputs:node.images || [], runMs:(typeof nowMs === 'function' ? nowMs() : Date.now()) - runLogStart});
        toast(kind === 'video' ? '视频生成完成' : '图片生成完成');
    } catch(err) {
        node.pending = 0;
        node.running = false;
        node.lastError = (err.message || '生成失败').slice(0, 180);
        if(typeof addSmartGenerationLog === 'function') addSmartGenerationLog({run:runLog, outputs:[], runMs:(typeof nowMs === 'function' ? nowMs() : Date.now()) - runLogStart, error:err.message || String(err)});
        toast(node.lastError);
    } finally {
        settings = previousSettings;
        if(!(node.images || []).length && typeof clearNodeRunningState === 'function') clearNodeRunningState(node);
        syncRunButtonState();
        render();
        scheduleSave();
    }
}

function smartStoryboardWholePrompt(source){
    if(window.ScriptToStoryboard?.buildWholeStoryboardPrompt){
        const shot = source?.shot || {};
        return appendStoryboardImagePromptGuard(window.ScriptToStoryboard.buildWholeStoryboardPrompt(shot), shot, Array.isArray(shot.frames) ? shot.frames.length : 0);
    }
    const shot = source?.shot || {};
    const frames = Array.isArray(shot.frames) ? shot.frames : [];
    const prompt = [
        `${shot.shotNumber || '镜头'} 完整故事板总览图`,
        '把以下故事板帧按时间顺序排成一张完整总览图，每一帧独立可读，能看清剧情推进、人物站位、情绪变化和运镜节奏。',
        frames.map((frame, index) => `【${frame.label || `故事板帧${index + 1}`}】\n${frame.description || ''}\n${frame.composition || ''}\n${frame.emotion || ''}`).join('\n\n')
    ].filter(Boolean).join('\n');
    return appendStoryboardImagePromptGuard(prompt, shot, frames.length);
}

function storyboardPromptValueText(value, depth=0){
    if(value == null) return '';
    if(typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'){
        const text = String(value).trim();
        return text === '[object Object]' ? '' : text;
    }
    if(depth >= 4) return '';
    if(Array.isArray(value)) return value.map(item => storyboardPromptValueText(item, depth + 1)).filter(Boolean).join('；');
    if(typeof value === 'object'){
        const direct = ['description', 'text', 'content', 'value', 'prompt']
            .map(key => storyboardPromptValueText(value[key], depth + 1))
            .find(Boolean);
        if(direct) return direct;
        return Object.entries(value).map(([key, nested]) => {
            const text = storyboardPromptValueText(nested, depth + 1);
            return text ? `${key}：${text}` : '';
        }).filter(Boolean).join('；');
    }
    return '';
}

function storyboardLocalTimelineText(value, shot){
    const text = String(value || '');
    const shotRange = String(shot?.timeRange || '').match(/(\d+(?:\.\d+)?)\s*[\u2013\u2014\-~到至]\s*(\d+(?:\.\d+)?)\s*秒?/);
    if(!text || !shotRange) return text;
    const start = Number(shotRange[1]);
    if(!Number.isFinite(start) || start <= 0) return text;
    const format = number => Number.isInteger(number) ? String(number) : String(Math.round(number * 10) / 10);
    return text.replace(/(\d+(?:\.\d+)?)\s*([\u2013\u2014\-~到至])\s*(\d+(?:\.\d+)?)\s*秒/g, (match, rawA, separator, rawB) => {
        const a = Number(rawA);
        const b = Number(rawB);
        if(!Number.isFinite(a) || !Number.isFinite(b) || a < start - 0.01 || b < a) return match;
        return `${format(Math.max(0, a - start))}${separator}${format(Math.max(0, b - start))}秒`;
    });
}

function storyboardVideoGenerationPrompt(source){
    if(!source) return '';
    return storyboardLocalTimelineText(smartStoryboardVideoPrompt(source), source.shot || {})
        .replace(/[，,；;]?不直接生成四宫格或九宫格合成图[。.]?/g, '')
        .trim();
}

function storyboardNarrativeText(source){
    const shot = source?.shot || {};
    const frames = Array.isArray(shot.frames) ? shot.frames : [];
    const visual = shot.visualExtract && typeof shot.visualExtract === 'object'
        ? Object.entries(shot.visualExtract).map(([key, value]) => {
            const text = storyboardPromptValueText(value);
            return text ? `${key}：${text}` : '';
        }).filter(Boolean).join('\n')
        : '';
    const frameText = frames.map((frame, index) => [
        `现有关键画面${String(index + 1).padStart(2, '0')}：${frame.label || ''}`,
        storyboardPromptValueText(frame.description),
        storyboardPromptValueText(frame.composition),
        storyboardPromptValueText(frame.emotion),
        storyboardPromptValueText(frame.videoBeat)
    ].filter(Boolean).join('\n'));
    return storyboardLocalTimelineText([
        shot.sourceText || '', storyboardVideoGenerationPrompt(source), visual, ...frameText
    ].filter(Boolean).join('\n\n'), shot);
}

// This later declaration intentionally upgrades the legacy feature-package prompt.
function smartStoryboardWholePrompt(source, requestedPanelCount=9){
    const panelCount = Number(requestedPanelCount) === 12 ? 12 : 9;
    const gridLayout = panelCount === 12 ? '4列×3行' : '3列×3行';
    return [
        `创建一张专业 PREVIS 导演分镜故事板单页，严格采用${gridLayout}，共${panelCount}个连续分镜。`,
        '【当前故事段】', storyboardNarrativeText(source) || '依据当前故事板卡的完整剧情生成分镜。',
        '【生成逻辑】',
        `先理解时间、地点、人物关系、关键动作、台词、视线和情绪变化，再选择${panelCount}个最必要的视觉节点。不要机械平均拆分台词，不要使用固定剧情模板，每格只承担一个明确视觉任务。`,
        '【参考与连续性】',
        '严格使用输入参考图锁定对应人物和场景。全部画格保持人物五官、发型、年龄、体型、服装、场景布局、时间与光线一致；遵守180度轴线，动作和情绪前后衔接。',
        '【导演分镜风格】',
        '画格内部使用黑白粗铅笔线、快速手势线和清楚轮廓，重点表达构图、景别、调度、动作方向、视线和节奏。允许克制的彩色导演标注：红色表示人物动作，蓝色表示摄影机运动，绿色表示构图，橙色表示光线，紫色表示声音、情绪、视线或停顿。',
        '页面底部、所有画框之外画出固定图例“彩色注释系统”，简短说明五种颜色的含义；没有对应动作或运镜时不要为了装饰添加标记。',
        '【排版】',
        `16:9横版、横幅2K，严格${gridLayout}，从左到右、从上到下编号01—${String(panelCount).padStart(2, '0')}。不要竖屏、字幕、水印、大段说明、重复构图或无关人物。`
    ].filter(Boolean).join('\n');
}

function smartStoryboardRealisticPrompt(source, requestedPanelCount=9){
    const panelCount = Number(requestedPanelCount) === 12 ? 12 : 9;
    const gridLayout = panelCount === 12 ? '4列×3行' : '3列×3行';
    return [
        `创建一张专业真人影视 PREVIS 写实分镜单页，严格采用${gridLayout}，共${panelCount}个连续分镜。`,
        '【当前故事段】', storyboardNarrativeText(source) || '依据当前故事板卡的完整剧情生成分镜。',
        '【叙事与镜头】',
        `先理解时间、地点、人物关系、关键动作、台词、视线、情绪推进和结束状态，再选择${panelCount}个最必要的视觉节点。不要机械平均拆分台词，不要使用固定剧情模板，每格只有一个明确视觉任务。`,
        '根据剧情使用 WIDE、MS、TWO SHOT、OTS、CU、ECU、INSERT、POV 及合理运镜；台词出现时可表现听者反应。通过眼神、呼吸、嘴唇、手指、肩膀、停顿和人物距离表达情绪，表演自然克制。',
        '【参考与连续性】',
        '严格使用输入参考图锁定对应人物和场景，不混合不同参考图的身份与服装。全部画格保持五官、发型、年龄、体型、服装、场景、时间、光线、物件和调色一致；遵守180度轴线，动作连续。',
        '【画面风格】',
        '正常上色的真人写实影视画面，真实皮肤与五官、可信表演、合理机位焦段、清楚前中后景、自然景深、摄影机透视和真实光源，统一克制的电影调色。不是漫画、动漫、油画、黑白速写或夸张概念图。',
        '【排版】',
        `16:9横版、横幅2K，严格${gridLayout}，从左到右、从上到下编号01—${String(panelCount).padStart(2, '0')}。每格只保留阿拉伯数字编号，不生成彩色箭头、导演图例、字幕、对话气泡、水印或大段文字。`
    ].filter(Boolean).join('\n');
}

function storyboardGenerationGuard(source){
    // 资产是可选参考，不应阻断故事板、图片或视频生成。
    return Boolean(source);
}

function legacyStoryboardGenerationGuard(source){
    const collector = shotAssetCollectorForCard(source);
    if(!collector || collector.enforcePreflight !== true) return true;
    const report = shotAssetCollectorPreflight(collector);
    const cardDemandKeys = new Set(shotAssetDemandItemsForCard(source).map(item => item.key));
    const missing = report.missing.filter(item => cardDemandKeys.has(item.key));
    collector.lastPreflightAt = Date.now();
    if(missing.length){
        collector.preflightExpanded = true;
        selectedId = collector.id;
        selectedIds = [];
        render();
        scheduleSave();
        toast(`生成已暂停：${shotAssetCardLabel(source)}还有 ${missing.length} 项资产未处理`);
        return false;
    }
    const currentLabel = shotAssetCardLabel(source);
    const risks = report.unconfirmedRisks.filter(item => item.to === currentLabel);
    if(risks.length){
        const notes = risks.flatMap(item => item.notes || []).join('\n');
        const proceed = window.confirm(`${currentLabel}存在连续性变化：\n${notes}\n\n确认这是合理调度并继续生成吗？`);
        if(!proceed){
            collector.preflightExpanded = true;
            selectedId = collector.id;
            selectedIds = [];
            render();
            scheduleSave();
            return false;
        }
        if(!collector.continuityOverrides || typeof collector.continuityOverrides !== 'object') collector.continuityOverrides = {};
        risks.forEach(item => { collector.continuityOverrides[item.key] = true; });
        scheduleSave();
    }
    return true;
}

function createSmartVideoFromStoryboardShot(cardId){
    const source = nodes.find(n => n.id === cardId && n.type === 'storyboard-card' && n.cardKind === 'storyboard');
    if(!source) return null;
    if(!storyboardGenerationGuard(source)) return null;
    const prompt = smartStoryboardPromptWithAssetMentions(source, storyboardVideoGenerationPrompt(source));
    if(!String(prompt || '').trim()){ toast('没有可用视频提示词'); return null; }
    const previewCount = (canvas?.connections || [])
        .filter(c => c.from === source.id)
        .map(c => nodes.find(n => n.id === c.to))
        .filter(n => isSmartRunnableNode(n) || n?.type === 'smart-frame').length;
    const baseX = Number(source.x || 0);
    const baseY = Number(source.y || 0) + Math.max(Number(source.h || 600), 600) + 120 + previewCount * 44;
    const target = createNode(baseX, baseY, []);
    const videoSettings = smartStoryboardVideoSettingsFor(source.shot || {});
    configureStoryboardOutputNode(target, source, prompt, videoSettings, 'video');
    selectedId = target.id;
    selectedIds = [];
    selectedImage = {nodeId:'', index:-1};
    if(!((canvas?.connections || []).some(c => c.from === source.id && c.to === target.id))){
        addConnection(source.id, target.id, 'input');
    }
    settings = {...settings, ...cloneSmartSettings(videoSettings)};
    render();
    updateComposer();
    settings = {...settings, ...cloneSmartSettings(videoSettings)};
    target.runSettings = cloneSmartSettings(videoSettings);
    setPromptDraftForNode(target, prompt);
    setPromptText(prompt);
    delete promptInput.dataset.preserveDraftOnce;
    savePromptDraftForCurrent();
    target.runSettings = cloneSmartSettings(videoSettings);
    settings = {...settings, ...cloneSmartSettings(videoSettings)};
    syncApiKindToggleVisibility();
    renderDynamicParams();
    renderInputThumbsRow(target);
    promptInput?.focus({preventScroll:true});
    toast('已创建视频生成节点');
    scheduleSave();
    return target;
}

function createSmartPreviewFromStoryboardShot(cardId, requestedPanelCount=9, requestedStyle='director'){
    const source = nodes.find(n => n.id === cardId && n.type === 'storyboard-card' && n.cardKind === 'storyboard');
    if(!source) return null;
    if(!storyboardGenerationGuard(source)) return null;
    const panelCount = Number(requestedPanelCount) === 12 ? 12 : 9;
    const previewStyle = requestedStyle === 'realistic' ? 'realistic' : 'director';
    const imagePrompt = previewStyle === 'realistic'
        ? smartStoryboardRealisticPrompt(source, panelCount)
        : smartStoryboardWholePrompt(source, panelCount);
    const prompt = smartStoryboardPromptWithAssetMentions(source, imagePrompt);
    if(!String(prompt || '').trim()){ toast('没有可用故事板提示词'); return null; }
    const imageSettings = smartStoryboardImageSettingsFor();
    const previewCount = (canvas?.connections || [])
        .filter(c => c.from === source.id)
        .map(c => nodes.find(n => n.id === c.to))
        .filter(n => isSmartRunnableNode(n) || n?.type === 'smart-frame').length;
    const baseX = Number(source.x || 0);
    const baseY = Number(source.y || 0) + Math.max(Number(source.h || 600), 600) + 120 + previewCount * 44;
    const target = createNode(baseX, baseY, []);
    configureStoryboardOutputNode(target, source, prompt, imageSettings, 'whole-preview');
    target.title = `${source.shot?.shotNumber || '镜头'} ${previewStyle === 'realistic' ? '写实' : '导演'}${panelCount === 12 ? '十二宫格' : '九宫格'}分镜`;
    target.frameTitle = target.title;
    target.sizeHint = '整段故事板';
    target.storyboardGridCount = panelCount;
    target.storyboardPreviewStyle = previewStyle;
    target.storyboardImagePrompt = prompt;
    target.storyboardVideoPrompt = smartStoryboardPromptWithAssetMentions(source, storyboardVideoGenerationPrompt(source));
    selectedId = target.id;
    selectedIds = [];
    selectedImage = {nodeId:'', index:-1};
    if(!((canvas?.connections || []).some(c => c.from === source.id && c.to === target.id))){
        addConnection(source.id, target.id, 'input');
    }
    settings = {...settings, ...cloneSmartSettings(imageSettings)};
    render();
    updateComposer();
    settings = {...settings, ...cloneSmartSettings(imageSettings)};
    target.runSettings = cloneSmartSettings(imageSettings);
    setPromptDraftForNode(target, prompt);
    setPromptText(prompt);
    delete promptInput.dataset.preserveDraftOnce;
    savePromptDraftForCurrent();
    target.runSettings = cloneSmartSettings(imageSettings);
    settings = {...settings, ...cloneSmartSettings(imageSettings)};
    syncApiKindToggleVisibility();
    renderDynamicParams();
    renderInputThumbsRow(target);
    promptInput?.focus({preventScroll:true});
    toast(`已创建${previewStyle === 'realistic' ? '写实预演' : '导演标注'}${panelCount === 12 ? '十二宫格' : '九宫格'}分镜节点`);
    scheduleSave();
    return target;
}

function createSmartPreviewFromStoryboardFrame(cardId, frameIndex){
    const source = nodes.find(n => n.id === cardId && n.type === 'storyboard-card' && n.cardKind === 'storyboard');
    if(!source) return null;
    if(!storyboardGenerationGuard(source)) return null;
    const index = Math.max(0, Number(frameIndex) || 0);
    const frame = source.shot?.frames?.[index] || {};
    const prompt = smartStoryboardPromptWithAssetMentions(source, smartStoryboardFramePrompt(source, index));
    if(!String(prompt || '').trim()){ toast('没有可用单帧提示词'); return null; }
    const imageSettings = smartStoryboardImageSettingsFor();
    const previewCount = (canvas?.connections || [])
        .filter(c => c.from === source.id)
        .map(c => nodes.find(n => n.id === c.to))
        .filter(n => isSmartRunnableNode(n) || n?.type === 'smart-frame').length;
    const baseX = Number(source.x || 0);
    const baseY = Number(source.y || 0) + Math.max(Number(source.h || 600), 600) + 120 + previewCount * 44;
    const target = createNode(baseX, baseY, []);
    configureStoryboardOutputNode(target, source, prompt, imageSettings, 'frame-preview');
    target.title = `${source.shot?.shotNumber || '镜头'} ${frame.label || `F${index + 1}`} 预演图`;
    target.frameTitle = target.title;
    target.sizeHint = '预演图';
    target.storyboardFrameIndex = index;
    selectedId = target.id;
    selectedIds = [];
    selectedImage = {nodeId:'', index:-1};
    if(!((canvas?.connections || []).some(c => c.from === source.id && c.to === target.id))){
        addConnection(source.id, target.id, 'input');
    }
    settings = {...settings, ...cloneSmartSettings(imageSettings)};
    render();
    updateComposer();
    settings = {...settings, ...cloneSmartSettings(imageSettings)};
    target.runSettings = cloneSmartSettings(imageSettings);
    setPromptDraftForNode(target, prompt);
    setPromptText(prompt);
    delete promptInput.dataset.preserveDraftOnce;
    savePromptDraftForCurrent();
    target.runSettings = cloneSmartSettings(imageSettings);
    settings = {...settings, ...cloneSmartSettings(imageSettings)};
    syncApiKindToggleVisibility();
    renderDynamicParams();
    renderInputThumbsRow(target);
    promptInput?.focus({preventScroll:true});
    toast('已填入该帧预演图提示词');
    scheduleSave();
    return target;
}

function syncStoryboardFramesToVideoPrompt(node){
    if(!node?.shot || !Array.isArray(node.shot.frames)) return;
    node.shot.frames.forEach((frame, index) => {
        if(frame.locked) return;
        frame.prompt = smartStoryboardFramePrompt(node, index);
    });
}

function updateStoryboardAssetBindingFromControl(sourceNode, control, patch){
    const targetId = control?.dataset?.assetTarget || sourceNode?.id;
    const key = control?.dataset?.assetKey || '';
    const target = nodes.find(n => n.id === targetId) || sourceNode;
    const candidate = storyboardManualAssetCandidates(sourceNode).find(img => img.sourceTargetId === targetId && storyboardAssetBindingKey(img) === key);
    if(!target || !candidate) return false;
    setStoryboardAssetBinding(target, candidate, patch);
    return true;
}

function bindSmartStoryboardShotCardControls(el, node){
    const scrollBody = el.querySelector('.storyboard-shot-card-body');
    if(scrollBody){
        scrollBody.addEventListener('wheel', e => {
            if(scrollBody.scrollHeight > scrollBody.clientHeight) e.stopPropagation();
        }, {passive:true});
    }
    el.querySelectorAll('.storyboard-control, .storyboard-frame-desc, .storyboard-video-text, .storyboard-asset-role, .storyboard-asset-label').forEach(control => {
        control.addEventListener('mousedown', e => e.stopPropagation());
        control.addEventListener('click', e => e.stopPropagation());
        control.addEventListener('dblclick', e => e.stopPropagation());
    });
    el.querySelectorAll('.storyboard-asset-role').forEach(select => {
        select.onchange = e => {
            if(updateStoryboardAssetBindingFromControl(node, select, {role:e.target.value})){
                render();
                scheduleSave();
            }
        };
    });
    el.querySelectorAll('.storyboard-asset-label').forEach(input => {
        input.oninput = e => {
            updateStoryboardAssetBindingFromControl(node, input, {label:e.target.value});
            scheduleSave();
        };
    });
    const videoText = el.querySelector('.storyboard-video-text');
    if(videoText){
        bindScrollableText(videoText);
        videoText.oninput = e => {
            node.shot = node.shot || {};
            node.shot.videoPrompt = node.shot.videoPrompt && typeof node.shot.videoPrompt === 'object' ? node.shot.videoPrompt : {};
            node.shot.videoPrompt.text = e.target.value;
            node.shot.videoPrompt.source = 'user';
            node.shot.videoPrompt.updatedAt = Date.now();
            syncStoryboardFramesToVideoPrompt(node);
            scheduleSave();
        };
    }
    el.querySelectorAll('.storyboard-copy-extract').forEach(btn => {
        btn.onclick = async e => {
            e.preventDefault();
            e.stopPropagation();
            const text = window.ScriptToStoryboard?.visualExtractText?.(node.shot || {}) || '暂无提取信息';
            if(!(await copyTextToClipboard(text))) toast('复制失败');
            else toast('已复制画面提取');
        };
    });
    el.querySelectorAll('.storyboard-copy-video').forEach(btn => {
        btn.onclick = async e => {
            e.preventDefault();
            e.stopPropagation();
            const text = smartStoryboardVideoPrompt(node);
            if(!(await copyTextToClipboard(text))) toast('复制失败');
            else toast('已复制视频提示词');
        };
    });
    el.querySelectorAll('.storyboard-refresh-from-video').forEach(btn => {
        btn.onclick = e => {
            e.preventDefault();
            e.stopPropagation();
            syncStoryboardFramesToVideoPrompt(node);
            render();
            scheduleSave();
            toast('已用视频提示词同步故事板帧');
        };
    });
    el.querySelectorAll('[data-frame-desc]').forEach(ta => {
        bindScrollableText(ta);
        ta.oninput = e => {
            const index = Math.max(0, Number(e.target.dataset.frameDesc) || 0);
            const frame = node.shot?.frames?.[index];
            if(!frame || frame.locked) return;
            frame.description = e.target.value;
            frame.prompt = smartStoryboardFramePrompt(node, index);
            scheduleSave();
        };
    });
    el.querySelectorAll('.storyboard-frame-lock').forEach(btn => {
        btn.onclick = e => {
            e.preventDefault();
            e.stopPropagation();
            const index = Math.max(0, Number(btn.dataset.frameIndex) || 0);
            const frame = node.shot?.frames?.[index];
            if(!frame) return;
            frame.locked = !frame.locked;
            render();
            scheduleSave();
        };
    });
    el.querySelectorAll('.storyboard-frame-edit').forEach(btn => {
        btn.onclick = e => {
            e.preventDefault();
            e.stopPropagation();
            const index = Math.max(0, Number(btn.dataset.frameIndex) || 0);
            const ta = el.querySelector(`[data-frame-desc="${index}"]`);
            if(ta && !ta.disabled) ta.focus({preventScroll:true});
        };
    });
    el.querySelectorAll('.storyboard-frame-regen').forEach(btn => {
        btn.onclick = e => {
            e.preventDefault();
            e.stopPropagation();
            const index = Math.max(0, Number(btn.dataset.frameIndex) || 0);
            const frame = node.shot?.frames?.[index];
            if(!frame || frame.locked) return;
            const next = window.ScriptToStoryboard?.regenerateFrame?.(node.shot, index);
            if(next) node.shot.frames[index] = {...next, locked:false};
            render();
            scheduleSave();
        };
    });
    el.querySelectorAll('.storyboard-frame-preview').forEach(btn => {
        btn.onclick = e => {
            e.preventDefault();
            e.stopPropagation();
            createSmartPreviewFromStoryboardFrame(node.id, btn.dataset.frameIndex);
        };
    });
    el.querySelectorAll('.storyboard-shot-preview').forEach(btn => {
        btn.onclick = e => {
            e.preventDefault();
            e.stopPropagation();
            createSmartPreviewFromStoryboardShot(node.id, btn.dataset.gridCount, btn.dataset.previewStyle);
        };
    });
    el.querySelectorAll('.storyboard-video-node').forEach(btn => {
        btn.onclick = e => {
            e.preventDefault();
            e.stopPropagation();
            createSmartVideoFromStoryboardShot(node.id);
        };
    });
    el.querySelectorAll('.storyboard-director-review-btn').forEach(btn => {
        btn.onclick = e => {
            e.preventDefault();
            e.stopPropagation();
            reviewStoryboardCardWithAi(node);
        };
    });
}

function ensureSmartStoryboardDelegation(){
    if(smartStoryboardDelegationReady || !world) return;
    smartStoryboardDelegationReady = true;
    world.addEventListener('input', e => {
        const ta = e.target?.closest?.('[data-frame-desc],.storyboard-video-text');
        if(!ta) return;
        const nodeEl = ta.closest('.image-node');
        const node = nodes.find(n => n.id === nodeEl?.dataset.id && n.type === 'storyboard-card' && n.cardKind === 'storyboard');
        if(!node) return;
        if(ta.classList.contains('storyboard-video-text')){
            node.shot = node.shot || {};
            node.shot.videoPrompt = node.shot.videoPrompt && typeof node.shot.videoPrompt === 'object' ? node.shot.videoPrompt : {};
            node.shot.videoPrompt.text = ta.value;
            node.shot.videoPrompt.source = 'user';
            node.shot.videoPrompt.updatedAt = Date.now();
            syncStoryboardFramesToVideoPrompt(node);
            scheduleSave();
            return;
        }
        const index = Math.max(0, Number(ta.dataset.frameDesc) || 0);
        const frame = node.shot?.frames?.[index];
        if(!frame || frame.locked) return;
        frame.description = ta.value;
        frame.prompt = smartStoryboardFramePrompt(node, index);
        scheduleSave();
    }, true);
    world.addEventListener('click', e => {
        const outputBtn = e.target?.closest?.('.storyboard-output-run,.storyboard-output-copy');
        if(outputBtn){
            const nodeEl = outputBtn.closest('.image-node');
            const outputNode = nodes.find(n => n.id === nodeEl?.dataset.id && n.type === 'smart-image' && n.storyboardOutputKind);
            if(!outputNode) return;
            e.preventDefault();
            e.stopPropagation();
            const prompt = String(outputNode.runPrompt || outputNode.promptDraftText || '').trim();
            if(outputBtn.classList.contains('storyboard-output-copy')){
                if(!prompt){ toast('没有可复制的提示词'); return; }
                copyTextToClipboard(prompt).then(ok => toast(ok ? '已复制提示词' : '复制失败'));
                return;
            }
            if(!prompt){ toast('没有可用提示词'); return; }
            selectedId = outputNode.id;
            selectedIds = [];
            selectedImage = {nodeId:'', index:-1};
            runStoryboardOutputNode(outputNode.id);
            return;
        }
        const btn = e.target?.closest?.('.storyboard-frame-lock,.storyboard-frame-edit,.storyboard-frame-regen,.storyboard-frame-preview,.storyboard-shot-preview,.storyboard-copy-extract,.storyboard-copy-video,.storyboard-refresh-from-video,.storyboard-video-node,.storyboard-director-review-btn');
        if(!btn) return;
        const nodeEl = btn.closest('.image-node');
        const node = nodes.find(n => n.id === nodeEl?.dataset.id && n.type === 'storyboard-card' && n.cardKind === 'storyboard');
        if(!node) return;
        e.preventDefault();
        e.stopPropagation();
        if(btn.classList.contains('storyboard-copy-extract')){
            const text = window.ScriptToStoryboard?.visualExtractText?.(node.shot || {}) || '暂无提取信息';
            copyTextToClipboard(text).then(ok => toast(ok ? '已复制画面提取' : '复制失败'));
            return;
        }
        if(btn.classList.contains('storyboard-copy-video')){
            copyTextToClipboard(smartStoryboardVideoPrompt(node)).then(ok => toast(ok ? '已复制视频提示词' : '复制失败'));
            return;
        }
        if(btn.classList.contains('storyboard-refresh-from-video')){
            syncStoryboardFramesToVideoPrompt(node);
            render();
            scheduleSave();
            toast('已用视频提示词同步故事板帧');
            return;
        }
        if(btn.classList.contains('storyboard-video-node')){
            createSmartVideoFromStoryboardShot(node.id);
            return;
        }
        if(btn.classList.contains('storyboard-director-review-btn')){
            reviewStoryboardCardWithAi(node);
            return;
        }
        if(btn.classList.contains('storyboard-shot-preview')){
            createSmartPreviewFromStoryboardShot(node.id, btn.dataset.gridCount, btn.dataset.previewStyle);
            return;
        }
        const index = Math.max(0, Number(btn.dataset.frameIndex) || 0);
        const frame = node.shot?.frames?.[index];
        if(btn.classList.contains('storyboard-frame-lock')){
            if(frame) frame.locked = !frame.locked;
            render();
            scheduleSave();
            return;
        }
        if(btn.classList.contains('storyboard-frame-edit')){
            const ta = nodeEl.querySelector(`[data-frame-desc="${index}"]`);
            if(ta && !ta.disabled) ta.focus({preventScroll:true});
            return;
        }
        if(btn.classList.contains('storyboard-frame-regen')){
            if(frame?.locked) return;
            const next = window.ScriptToStoryboard?.regenerateFrame?.(node.shot, index);
            if(next) node.shot.frames[index] = {...next, locked:false};
            render();
            scheduleSave();
            return;
        }
        if(btn.classList.contains('storyboard-frame-preview')){
            createSmartPreviewFromStoryboardFrame(node.id, index);
        }
    }, true);
}

function bindSmartStoryboardCardControls(el, node){
    if(node.cardKind === 'storyboard'){
        bindSmartStoryboardShotCardControls(el, node);
        return;
    }
    el.querySelectorAll('.storyboard-copy-all').forEach(btn => {
        btn.addEventListener('click', async e => {
            e.preventDefault();
            e.stopPropagation();
            const text = window.ScriptToStoryboard.visualInfoText(node.shot);
            if(!(await copyTextToClipboard(text))) toast('复制失败');
            else toast('已复制分镜画面卡完整信息');
        });
    });
    el.querySelectorAll('.storyboard-make-prompt').forEach(btn => {
        btn.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            createSmartImagePromptCardFromVisual(node.id);
        });
    });
}

function bindSmartImagePromptCardControls(el, node){
    el.querySelectorAll('.storyboard-control').forEach(control => {
        control.addEventListener('mousedown', e => e.stopPropagation());
        control.addEventListener('click', e => e.stopPropagation());
        control.addEventListener('dblclick', e => e.stopPropagation());
    });
    const ta = el.querySelector('.image-prompt-text');
    if(ta){
        bindScrollableText(ta);
        ta.oninput = e => {
            node.promptText = e.target.value;
            node.autoPrompt = false;
            scheduleSave();
        };
    }
    const syncBtn = el.querySelector('.storyboard-sync-source');
    if(syncBtn) syncBtn.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        node.autoPrompt = true;
        syncSmartImagePromptCardFromSource(node, {clearIfMissing:true});
        render();
        scheduleSave();
    };
}

function bindSmartAssetHubControls(el, node){
    el.querySelectorAll('.storyboard-control, .asset-hub-toggle').forEach(control => {
        control.addEventListener('mousedown', e => e.stopPropagation());
        control.addEventListener('click', e => e.stopPropagation());
        control.addEventListener('dblclick', e => e.stopPropagation());
    });
    el.querySelectorAll('.asset-hub-toggle').forEach(input => {
        input.onchange = e => {
            const key = input.dataset.assetHubKey;
            if(key) node[key] = Boolean(e.target.checked);
            node.lastRefreshAt = Date.now();
            render();
            scheduleSave();
        };
    });
    const refresh = el.querySelector('.asset-hub-refresh');
    if(refresh) refresh.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        node.lastRefreshAt = Date.now();
        render();
        scheduleSave();
        toast('已刷新资产匹配');
    };
    const copy = el.querySelector('.asset-hub-copy');
    if(copy) copy.onclick = async e => {
        e.preventDefault();
        e.stopPropagation();
        const assets = smartAssetHubImageRecords(node);
        const text = assets.map(item => `${smartAssetCategoryLabel(item.category)}：${item.name || '参考图'}${item.source === 'library' ? '（素材库）' : ''}`).join('\n');
        if(!(await copyTextToClipboard(text || '暂无资产'))) toast('复制失败');
        else toast('已复制资产清单');
    };
}

function bindShotAssetCollectorControls(el, node){
    const savePickerScroll = () => {
        const state = shotAssetPickerStateFor(node);
        if(!state) return;
        const body = el.querySelector('.shot-asset-collector-body');
        const demands = el.querySelector('.shot-asset-demand-list');
        const results = el.querySelector('.shot-asset-picker-results');
        if(body) state.bodyTop = body.scrollTop || 0;
        if(demands) state.demandTop = demands.scrollTop || 0;
        if(results) state.assetTop = results.scrollTop || 0;
    };
    const bindLocalWheel = scroller => {
        if(!scroller) return;
        scroller.addEventListener('wheel', e => {
            const canY = scroller.scrollHeight > scroller.clientHeight;
            const canX = scroller.scrollWidth > scroller.clientWidth;
            if(!canY && !canX) return;
            e.preventDefault();
            e.stopPropagation();
            scroller.scrollTop += e.deltaY;
            scroller.scrollLeft += e.deltaX;
        }, {passive:false});
    };
    el.querySelectorAll('.shot-asset-collector-body, .shot-asset-workspace, .shot-asset-demand-list, .shot-asset-picker, .shot-asset-picker-selected, .shot-asset-picker-results, .shot-preflight-details').forEach(bindLocalWheel);
    const pickerState = shotAssetPickerStateFor(node);
    if(pickerState){
        const body = el.querySelector('.shot-asset-collector-body');
        const demands = el.querySelector('.shot-asset-demand-list');
        if(body) body.scrollTop = Number(pickerState.bodyTop) || 0;
        if(demands) demands.scrollTop = Number(pickerState.demandTop) || 0;
    }
    const pickerResults = el.querySelector('.shot-asset-picker-results');
    if(pickerResults && pickerState){
        pickerResults.scrollTop = Number(pickerState.assetTop ?? pickerState.scrollTop) || 0;
        pickerResults.addEventListener('scroll', () => {
            const state = shotAssetPickerStateFor(node);
            if(state) state.assetTop = pickerResults.scrollTop || 0;
        });
    }
    el.querySelectorAll('.storyboard-control, .shot-asset-toggle, .shot-asset-check, .shot-asset-no-asset, .shot-asset-purpose, .shot-asset-priority, .shot-continuity-confirm, .shot-asset-category-tab, .shot-asset-demand-row, .shot-asset-open-demand, .shot-asset-picker-query, .shot-asset-prompt-text, .shot-asset-prompt-actions button, .shot-asset-ai-recommend').forEach(control => {
        control.addEventListener('mousedown', e => e.stopPropagation());
        control.addEventListener('click', e => e.stopPropagation());
        control.addEventListener('dblclick', e => e.stopPropagation());
    });
    el.querySelectorAll('.shot-asset-category-tab').forEach(btn => {
        btn.onclick = e => {
            e.preventDefault();
            e.stopPropagation();
            savePickerScroll();
            const state = shotAssetPickerEnsureState(node);
            if(state){
                state.category = btn.dataset.shotAssetCategory || 'character';
                const available = shotAssetPickerDemandsForCategory(node, state.category);
                const rememberedKey = state.demandByCategory?.[state.category] || '';
                const nextDemand = available.find(item => item.key === rememberedKey) || available[0];
                state.demandKey = nextDemand?.key || '';
                state.query = '';
                state.demandTop = 0;
                state.assetTop = 0;
            }
            render();
        };
    });
    el.querySelectorAll('.shot-asset-demand-row').forEach(row => {
        row.onclick = e => {
            if(e.target?.closest?.('.shot-asset-none, input, select, button')) return;
            e.preventDefault();
            e.stopPropagation();
            savePickerScroll();
            const state = shotAssetPickerEnsureState(node, row.dataset.demandKey || '');
            if(state){
                state.demandByCategory[state.category] = state.demandKey;
                state.assetTop = 0;
            }
            render();
        };
    });
    el.querySelectorAll('.shot-asset-open-demand').forEach(btn => {
        btn.onclick = e => {
            e.preventDefault();
            e.stopPropagation();
            savePickerScroll();
            const state = shotAssetPickerEnsureState(node, btn.dataset.demandKey || '');
            if(state){
                state.demandByCategory[state.category] = state.demandKey;
                state.assetTop = 0;
            }
            render();
        };
    });
    const query = el.querySelector('.shot-asset-picker-query');
    if(query){
        const applyQueryFilter = () => {
            const value = String(query.value || '').trim().toLowerCase();
            const state = shotAssetPickerStateFor(node);
            if(state) state.query = query.value || '';
            el.querySelectorAll('.shot-asset-picker-group').forEach(group => {
                let visibleCount = 0;
                group.querySelectorAll('.shot-asset-picker-card').forEach(card => {
                    const visible = !value || card.textContent.toLowerCase().includes(value);
                    card.hidden = !visible;
                    if(visible) visibleCount += 1;
                });
                group.hidden = visibleCount === 0;
            });
        };
        query.oninput = applyQueryFilter;
        query.addEventListener('wheel', e => e.stopPropagation(), {passive:true});
    }
    el.querySelectorAll('.shot-asset-toggle').forEach(input => {
        input.onchange = e => {
            const key = input.dataset.shotAssetKey;
            if(key) node[key] = Boolean(e.target.checked);
            if(key === 'useAssetLibrary') node.manualSelectionOnly = !Boolean(e.target.checked);
            render();
            scheduleSave();
        };
    });
    el.querySelectorAll('.shot-asset-ai-recommend').forEach(btn => {
        btn.onclick = e => {
            e.preventDefault();
            e.stopPropagation();
            savePickerScroll();
            recommendShotAssetsWithAi(node);
        };
    });
    el.querySelectorAll('.shot-asset-check').forEach(input => {
        input.onchange = e => {
            savePickerScroll();
            const demandKey = input.dataset.demandKey || '';
            const candidateKey = input.dataset.candidateKey || '';
            const candidate = shotAssetCollectorCandidates(node).find(item => shotAssetCandidateKey(item) === candidateKey);
            toggleShotAssetCollectorBinding(node, demandKey, candidate, Boolean(e.target.checked));
            render();
            scheduleSave();
        };
    });
    el.querySelectorAll('.shot-asset-no-asset').forEach(input => {
        input.onchange = e => {
            savePickerScroll();
            const demandKey = input.dataset.demandKey || '';
            setShotAssetCollectorNoAsset(node, demandKey, Boolean(e.target.checked));
            render();
            scheduleSave();
        };
    });
    const assetPromptText = el.querySelector('.shot-asset-prompt-text');
    if(assetPromptText){
        bindScrollableText(assetPromptText);
        assetPromptText.oninput = e => {
            const demand = shotAssetCollectorDemands(node).find(item => item.key === assetPromptText.dataset.demandKey);
            const record = shotAssetPromptRecord(node, demand);
            if(record){
                record.current = e.target.value;
                record.updatedAt = Date.now();
                scheduleSave();
            }
        };
    }
    el.querySelectorAll('.shot-asset-prompt-optimize').forEach(btn => {
        btn.onclick = e => {
            e.preventDefault();
            e.stopPropagation();
            optimizeShotAssetPrompt(node, btn.dataset.demandKey || '');
        };
    });
    el.querySelectorAll('.shot-asset-prompt-copy').forEach(btn => {
        btn.onclick = async e => {
            e.preventDefault();
            e.stopPropagation();
            const demand = shotAssetCollectorDemands(node).find(item => item.key === btn.dataset.demandKey);
            const record = shotAssetPromptRecord(node, demand);
            if(await copyTextToClipboard(record?.current || '')) toast('资产提示词已复制');
            else toast('复制失败');
        };
    });
    el.querySelectorAll('.shot-asset-prompt-reset').forEach(btn => {
        btn.onclick = e => {
            e.preventDefault();
            e.stopPropagation();
            const demand = shotAssetCollectorDemands(node).find(item => item.key === btn.dataset.demandKey);
            const record = shotAssetPromptRecord(node, demand);
            if(record){
                record.current = shotAssetDefaultGenerationPrompt(demand);
                record.original = record.current;
                record.optimized = '';
                record.updatedAt = Date.now();
                render();
                scheduleSave();
            }
        };
    });
    el.querySelectorAll('.shot-asset-prompt-create').forEach(btn => {
        btn.onclick = e => {
            e.preventDefault();
            e.stopPropagation();
            createShotAssetPromptNode(node, btn.dataset.demandKey || '');
        };
    });
    el.querySelectorAll('.shot-asset-purpose, .shot-asset-priority').forEach(select => {
        select.onchange = e => {
            savePickerScroll();
            const demandKey = select.dataset.demandKey || '';
            const candidateKey = select.dataset.candidateKey || '';
            const patch = select.classList.contains('shot-asset-purpose') ? {purpose:e.target.value} : {priority:e.target.value};
            updateShotAssetCollectorBinding(node, demandKey, candidateKey, patch);
            render();
            scheduleSave();
        };
    });
    el.querySelectorAll('.shot-continuity-confirm').forEach(input => {
        input.onchange = e => {
            const key = input.dataset.continuityKey || '';
            if(!node.continuityOverrides || typeof node.continuityOverrides !== 'object') node.continuityOverrides = {};
            if(e.target.checked) node.continuityOverrides[key] = true;
            else delete node.continuityOverrides[key];
            render();
            scheduleSave();
        };
    });
    const preflightToggle = el.querySelector('.shot-preflight-toggle');
    if(preflightToggle) preflightToggle.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        node.preflightExpanded = node.preflightExpanded === false;
        render();
        scheduleSave();
    };
    const refresh = el.querySelector('.shot-asset-refresh');
    if(refresh) refresh.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        render();
        node.lastPreflightAt = Date.now();
        const report = shotAssetCollectorPreflight(node);
        toast(report.status === 'ready' ? '检查通过，可以生成' : report.status === 'warning' ? '资产已就绪，请确认连续性变化' : `还有 ${report.missing.length} 项资产未处理`);
    };
    const clear = el.querySelector('.shot-asset-clear-empty');
    if(clear) clear.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        const demands = new Set(shotAssetCollectorDemands(node).map(item => item.key));
        if(node.shotAssetBindings && typeof node.shotAssetBindings === 'object'){
            Object.keys(node.shotAssetBindings).forEach(key => {
                if(!demands.has(key)) delete node.shotAssetBindings[key];
            });
        }
        render();
        scheduleSave();
        toast('已清理无效绑定');
    };
}

function bindScriptStoryboardControls(el, node){
    el.querySelectorAll('.storyboard-control').forEach(control => {
        control.addEventListener('mousedown', e => e.stopPropagation());
        control.addEventListener('click', e => e.stopPropagation());
        control.addEventListener('dblclick', e => e.stopPropagation());
    });
    const scriptEl = el.querySelector('.storyboard-script');
    const promptEl = el.querySelector('.storyboard-prompt');
    if(scriptEl){
        bindScrollableText(scriptEl);
        scriptEl.oninput = e => { node.scriptText = e.target.value; scheduleSave(); };
    }
    if(promptEl){
        bindScrollableText(promptEl);
        promptEl.oninput = e => { node.storyboardPrompt = e.target.value; scheduleSave(); };
    }
    el.querySelectorAll('[data-storyboard-mode]').forEach(btn => {
        btn.onclick = e => {
            e.preventDefault();
            e.stopPropagation();
            const nextMode = ['segment', 'script', 'shot'].includes(btn.dataset.storyboardMode) ? btn.dataset.storyboardMode : 'segment';
            if(node.storyboardMode === nextMode) return;
            node.storyboardMode = nextMode;
            node.storyboardModeMigrated = true;
            node.storyboardPrompt = window.ScriptToStoryboard?.promptForMode?.(nextMode) || window.ScriptToStoryboard?.DEFAULT_PROMPT || '';
            node.lastAiError = '';
            render();
            scheduleSave();
        };
    });
    const providerEl = el.querySelector('.storyboard-provider');
    if(providerEl) providerEl.onchange = e => {
        node.llmProvider = resolveChatProviderId(e.target.value);
        node.llmModel = resolveChatModel('', node.llmProvider);
        render();
        scheduleSave();
    };
    const modelEl = el.querySelector('.storyboard-model');
    if(modelEl) modelEl.onchange = e => { node.llmModel = e.target.value; scheduleSave(); };
    const resetEl = el.querySelector('.storyboard-reset');
    if(resetEl) resetEl.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        node.storyboardPrompt = window.ScriptToStoryboard?.promptForMode?.(node.storyboardMode) || window.ScriptToStoryboard?.DEFAULT_PROMPT || '';
        render();
        scheduleSave();
    };
    const runEl = el.querySelector('.storyboard-run');
    if(runEl) runEl.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        runScriptStoryboardSmartNode(node.id);
    };
}

function deleteSmartStoryboardOutputs(sourceId){
    const removeIds = new Set(nodes.filter(n => n.sourceStoryboardId === sourceId).map(n => n.id));
    if(!removeIds.size) return;
    nodes = nodes.filter(n => !removeIds.has(n.id));
    canvas.nodes = nodes;
    canvas.connections = (canvas.connections || []).filter(c => !removeIds.has(c.from) && !removeIds.has(c.to));
}

function ensureAutoShotAssetCollector(source){
    if(!source || source.type !== 'script-storyboard') return false;
    const cards = nodes.filter(node => node.type === 'storyboard-card' && node.cardKind === 'storyboard' && node.sourceStoryboardId === source.id);
    if(!cards.length) return false;
    const hasCollector = nodes.some(node => node.type === 'shot-asset-collector' && (
        node.sourceStoryboardId === source.id ||
        (canvas.connections || []).some(connection => connection.from === source.id && connection.to === node.id)
    ));
    if(hasCollector) return false;
    const baseX = Number(source.x || 0) + Math.max(Number(source.w || 430), 430) + 120;
    const baseY = Number(source.y || 0);
    const collector = {
        id:uid('shotAssets'),
        type:'shot-asset-collector',
        x:baseX,
        y:Math.max(40, baseY - 720),
        w:560,
        h:650,
        title:'故事板人物收集器',
        sourceStoryboardId:source.id,
        shotAssetBindings:{},
        shotAssetNoAsset:{},
        continuityOverrides:{},
        useAssetLibrary:true,
        manualSelectionOnly:false,
        useCanvasInputs:true,
        inheritPrevious:true,
        enforcePreflight:false,
        preflightExpanded:false,
        created_at:Date.now()
    };
    nodes.push(collector);
    cards.forEach(card => addConnection(card.id, collector.id, 'input'));
    return true;
}

function ensureAutoShotAssetCollectors(){
    let changed = false;
    nodes.filter(node => node.type === 'script-storyboard').forEach(source => {
        if(ensureAutoShotAssetCollector(source)) changed = true;
    });
    if(changed){
        canvas.nodes = nodes;
        scheduleSave();
    }
    return changed;
}

function refreshShotAssetCollectorCandidates(){
    if(!canvas || !Array.isArray(nodes) || !nodes.some(node => node?.type === 'shot-asset-collector')) return;
    render();
}

function createSmartStoryboardOutputs(source, shots){
    deleteSmartStoryboardOutputs(source.id);
    const baseX = Number(source.x || 0) + Math.max(Number(source.w || 430), 430) + 120;
    const baseY = Number(source.y || 0);
    const createdCards = [];
    shots.forEach((shot, index) => {
        const card = {
            id:uid('s2b'),
            type:'storyboard-card',
            x:baseX + index * 610,
            y:baseY,
            w:560,
            h:600,
            sourceStoryboardId:source.id,
            cardKind:'storyboard',
            shot,
            created_at:Date.now()
        };
        nodes.push(card);
        createdCards.push(card);
        addConnection(source.id, card.id, 'input');
    });
    // 每次生成故事板自动配一个人物收集器，并直接连接本次生成的全部故事板卡。
    const collector = {
        id:uid('shotAssets'),
        type:'shot-asset-collector',
        x:baseX,
        y:Math.max(40, baseY - 720),
        w:560,
        h:650,
        title:'故事板人物收集器',
        sourceStoryboardId:source.id,
        shotAssetBindings:{},
        shotAssetNoAsset:{},
        continuityOverrides:{},
        useAssetLibrary:true,
        manualSelectionOnly:false,
        useCanvasInputs:true,
        inheritPrevious:true,
        enforcePreflight:false,
        preflightExpanded:true,
        created_at:Date.now()
    };
    nodes.push(collector);
    createdCards.forEach(card => addConnection(card.id, collector.id, 'input'));
    canvas.nodes = nodes;
    return {cards:createdCards, collector};
}

async function runScriptStoryboardSmartNode(nodeId){
    const node = nodes.find(n => n.id === nodeId);
    if(!node || node.running) return;
    const script = String(node.scriptText || '').trim();
    if(!script){ toast('请先输入完整分镜文本'); return; }
    pushUndo();
    node.running = true;
    node.runStartedAt = nowMs();
    delete node.runFinishedAt;
    delete node.runElapsedMs;
    node.runTimerHidden = false;
    node.lastAiError = '';
    render();
    let shots = [];
    const mode = 'segment';
    node.storyboardMode = 'segment';
    try {
        const helper = window.ScriptToStoryboard;
        const provider = resolveChatProviderId(node.llmProvider || '');
        const model = resolveChatModel(node.llmModel || '', provider);
        const message = helper.buildMessage(script, node.storyboardPrompt, mode);
        const result = await fetch('/api/canvas-llm', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({
                message,
                messages:[],
                images:[],
                videos:[],
                model,
                provider,
                ms_model:provider === 'modelscope' ? model : '',
                system_prompt:helper.systemPrompt
            })
        }).then(async r => {
            if(!r.ok) throw new Error(await smartResponseErrorMessage(r, 'LLM 运行失败'));
            return r.json();
        });
        node.llmProvider = provider;
        node.llmModel = model;
        const parsed = helper.extractJson(result.text || '');
        if(!parsed) throw new Error('AI 未返回可解析的故事板 JSON');
        shots = mode === 'segment' ? helper.normalizeStorySegment(parsed, script) : helper.normalizeShots(parsed);
        node.continuityReport = parsed?.continuityReport ? parsed.continuityReport : helper.buildContinuityReport(shots);
        node.referenceAssets = Array.isArray(parsed?.referenceAssets) ? parsed.referenceAssets : helper.mergeReferenceAssets(script, shots);
        if(!shots.length) throw new Error('AI 未返回可解析镜头 JSON');
    } catch(e) {
        node.lastAiError = e.message || String(e);
        shots = [];
        toast('AI 生成失败，未使用本地粗拆生成故事板');
    } finally {
        node.running = false;
        node.runFinishedAt = nowMs();
        node.runElapsedMs = Math.max(0, Number(node.runFinishedAt) - Number(node.runStartedAt || node.runFinishedAt));
    }
    try {
        if(!shots.length){
            render();
            scheduleSave();
            return;
        }
        const helper = window.ScriptToStoryboard;
        shots = helper.normalizeStorySegment({shots}, script);
        node.shots = shots;
        node.continuityReport = helper?.buildContinuityReport?.(shots) || node.continuityReport;
        node.referenceAssets = helper?.mergeReferenceAssets?.(script, shots) || node.referenceAssets || [];
        createSmartStoryboardOutputs(node, shots);
        selectedId = node.id;
        selectedIds = [];
        selectedImage = {nodeId:'', index:-1};
    } finally {
        render();
        scheduleSave();
    }
}

function promptOptimizationSystemPrompt(mode='image', subjectLabel=''){
    if(mode === 'asset') return `你是一名真人情感短剧的资产图提示词优化师。请把用户提供的${subjectLabel || '资产'}提示词整理成可直接用于生图模型的中文提示词。只保留主体身份或空间用途、必要外观、清晰视角、真实光线和干净背景；不要添加剧情，不要把道具写成人物，不要堆砌空泛画质词。人物资产要突出身份一致性与可辨认视角；场景资产要突出横版16:9空间结构与主要动线。原文有@参考资产名时必须原样保留；原文没有@标签时绝对不要自行添加。只输出优化后的提示词，不解释。`;
    if(mode === 'video-text') return `你是真人情感短剧的纯文本视频提示词优化师。输入没有必须依赖的首帧或参考图，因此要把人物、空间、时间、左右站位、动作起点、情绪推进、台词、运镜、光线、声音和结束状态写完整。不得改写剧情、台词、人物关系、服装和时长；按时间顺序写清起因、推进、落点，一个时间段只保留一个主要运镜。情绪必须转化为眼神、呼吸、嘴唇、手部、肌肉紧绷或身体停顿等可见表演。原文有@标签必须原样保留，原文没有时绝对不要新增。删除空泛画质词和重复限制。只输出优化后的中文提示词，不解释。`;
    if(mode === 'video-first-frame') return `你是真人情感短剧的首帧/首尾帧视频提示词优化师。参考画面已经确定人物外观、初始构图和空间，不要大段复述静态画面；重点写“从参考帧之后发生什么”：动作起点、时间推进、可见微表情、视线变化、主要运镜、声音与结束状态。若原文同时描述首帧和尾帧，要明确从首帧自然过渡到尾帧，保持身份、服装、左右位置、轴线和光线连续。不得改写剧情、台词、时长；所有原有@参考资产名必须原样保留并说明用途，绝对不要新增@标签。只输出优化后的中文提示词，不解释。`;
    if(mode === 'video-omni') return `你是真人情感短剧的全能参考视频提示词优化师。输入可能同时引用多个人物、场景和连续性画面。只使用原文已有的@参考资产名，并用简短语句明确每项参考控制什么：人物只锁定身份，场景只锁定空间，上一镜只锁定连续性；绝对不要新增、改名或合并@标签。随后按时间顺序写本段唯一剧情任务、人物动作与具体微表情、站位和视线、一个主要运镜、台词声音和结束状态。不得让参考图内容替代剧情，不得改写台词、人物关系、时长和既定站位。删除无必要细节和空泛画质词。只输出优化后的中文提示词，不解释。`;
    if(mode === 'video') return promptOptimizationSystemPrompt('video-text', subjectLabel);
    return `你是一名真人情感短剧的故事板生图提示词优化师。把用户提示词整理成可直接用于生图模型的中文提示词。不得改写剧情、人物关系、服装、时间和关键动作，不新增人物；保留所有@参考资产名，并且人物参考只控制人物一致性、场景参考只控制空间，绝对不要新增原文不存在的@标签。先写主视觉人物和当前画面的唯一视觉任务，再写可观察的动作与微表情、景别机位、前中后景、人物左右位置、虚实关系、视线、真实光源和构图。必须是横版16:9影视画面；多帧总览中每个子画格也必须横向，不做竖屏海报或人物写真。删除重复限制、空泛画质词和无必要的小道具细节。只输出优化后的提示词，不解释。`;
}

function promptOptimizationConfigForNode(node){
    let provider = node?.promptOptimizeProvider || '';
    let model = node?.promptOptimizeModel || '';
    let source = null;
    if(node?.assetPromptSourceCollectorId){
        const collector = nodes.find(item => item.id === node.assetPromptSourceCollectorId);
        const card = shotAssetCollectorCards(collector)[0];
        source = nodes.find(item => item.id === card?.sourceStoryboardId && item.type === 'script-storyboard') || null;
    }
    if(!source && node?.storyboardSourceCardId){
        const card = nodes.find(item => item.id === node.storyboardSourceCardId);
        source = nodes.find(item => item.id === card?.sourceStoryboardId && item.type === 'script-storyboard') || null;
    }
    if(!source && node?.sourceStoryboardId) source = nodes.find(item => item.id === node.sourceStoryboardId && item.type === 'script-storyboard') || null;
    if(source){
        provider = provider || source.llmProvider || '';
        model = model || source.llmModel || '';
    }
    return {provider:resolveChatProviderId(provider), model:resolveChatModel(model, resolveChatProviderId(provider))};
}

function promptOptimizationConfigForCollector(collector){
    const card = shotAssetCollectorCards(collector)[0];
    const source = nodes.find(item => item.id === card?.sourceStoryboardId && item.type === 'script-storyboard');
    const provider = resolveChatProviderId(source?.llmProvider || '');
    return {provider, model:resolveChatModel(source?.llmModel || '', provider)};
}

async function requestSmartCanvasLlmText(message, options={}){
    const provider = resolveChatProviderId(options.provider || '');
    const model = resolveChatModel(options.model || '', provider);
    const result = await fetch('/api/canvas-llm', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
            message:String(message || '').trim(),
            messages:[],
            images:Array.isArray(options.images) ? options.images.filter(Boolean) : [],
            videos:[],
            model,
            provider,
            ms_model:provider === 'modelscope' ? model : '',
            system_prompt:String(options.systemPrompt || '').trim()
        })
    }).then(async response => {
        if(!response.ok) throw new Error(await response.text());
        return response.json();
    });
    const text = String(result?.text || '').trim();
    if(!text) throw new Error('AI没有返回可用内容');
    return {text, provider, model};
}

async function requestPromptOptimization(text, options={}){
    const result = await requestSmartCanvasLlmText(text, {
        ...options,
        systemPrompt:promptOptimizationSystemPrompt(options.mode || 'image', options.subjectLabel || '')
    });
    let optimized = String(result.text || '').trim()
        .replace(/^【优化后(?:生图|视频|资产)?提示词】\s*/i, '')
        .replace(/^优化后(?:生图|视频|资产)?提示词[：:]\s*/i, '');
    const sourceMentionNames = [];
    const sourceMentionKeys = new Set();
    String(text || '').replace(/@([^@\s，,。；;：:\n\r=]+)/g, (_, raw) => {
        const name = String(raw || '').trim();
        const key = smartMentionKey(name);
        if(name && key && !sourceMentionKeys.has(key)){
            sourceMentionKeys.add(key);
            sourceMentionNames.push(name);
        }
        return _;
    });
    optimized = optimized.replace(/@([^@\s，,。；;：:\n\r=]+)/g, (token, name) => sourceMentionKeys.has(smartMentionKey(name)) ? token : name);
    const optimizedMentionKeys = new Set();
    optimized.replace(/@([^@\s，,。；;：:\n\r=]+)/g, (_, name) => {
        optimizedMentionKeys.add(smartMentionKey(name));
        return _;
    });
    const missingMentions = sourceMentionNames.filter(name => !optimizedMentionKeys.has(smartMentionKey(name)));
    if(missingMentions.length) optimized = `${missingMentions.map(name => `@${name}`).join(' ')}\n${optimized}`.trim();
    if(!optimized) throw new Error('AI没有返回可用提示词');
    return {...result, text:optimized};
}

async function optimizeShotAssetPrompt(collector, demandKey){
    const demand = shotAssetCollectorDemands(collector).find(item => item.key === demandKey);
    const record = shotAssetPromptRecord(collector, demand);
    if(!demand || !record || collector.assetPromptOptimizingKey) return;
    const current = String(record.current || '').trim();
    if(!current){ toast('请先填写资产提示词'); return; }
    collector.assetPromptOptimizingKey = demand.key;
    render();
    try {
        const ai = promptOptimizationConfigForCollector(collector);
        const result = await requestPromptOptimization(current, {mode:'asset', subjectLabel:`${shotAssetPickerCategoryLabel(shotAssetDemandCategory(demand))}“${demand.label}”`, ...ai});
        record.optimized = result.text;
        record.current = result.text;
        record.updatedAt = Date.now();
        toast('资产提示词已由AI优化，可继续编辑');
        scheduleSave();
    } catch(error){
        toast(`AI优化失败：${String(error?.message || error).slice(0, 100)}`);
    } finally {
        delete collector.assetPromptOptimizingKey;
        render();
    }
}

function createShotAssetPromptNode(collector, demandKey){
    const demand = shotAssetCollectorDemands(collector).find(item => item.key === demandKey);
    const record = shotAssetPromptRecord(collector, demand);
    const prompt = String(record?.current || '').trim();
    if(!collector || !demand || !prompt){ toast('资产提示词为空'); return null; }
    const demandIndex = Math.max(0, shotAssetCollectorDemands(collector).findIndex(item => item.key === demand.key));
    const title = `${demand.label} ${shotAssetPickerCategoryLabel(shotAssetDemandCategory(demand))}资产`;
    const target = createPosterFrameNode(
        Number(collector.x || 0) + Math.max(Number(collector.w || 560), 560) + 120,
        Number(collector.y || 0) + demandIndex * 46,
        {
            title,
            prompt,
            sizeHint:'资产生图',
            runSettings:smartStoryboardImageSettingsFor(),
            w:560,
            h:650,
            select:false
        }
    );
    target.title = title;
    target.frameTitle = title;
    target.storyboardOutputKind = 'asset-image';
    target.assetDemandKey = demand.key;
    target.assetPromptSourceCollectorId = collector.id;
    const ai = promptOptimizationConfigForCollector(collector);
    target.promptOptimizeProvider = ai.provider;
    target.promptOptimizeModel = ai.model;
    target.runSettings = posterFrameNormalizedRunSettings(smartStoryboardImageSettingsFor());
    target.promptOriginalText = prompt;
    target.promptUserLocked = false;
    target.runPrompt = prompt;
    addConnection(collector.id, target.id, 'flow');
    selectedId = target.id;
    selectedIds = [];
    selectedImage = {nodeId:'', index:-1};
    settings = {...settings, ...cloneSmartSettings(target.runSettings)};
    render();
    renderDynamicParams();
    renderInputThumbsRow(target);
    scheduleSave();
    toast(`已创建“${demand.label}”资产生图节点`);
    return target;
}

function storyboardFrameTitleFromPrompt(node, fallback=''){
    const prompt = String(node?.prompt || node?.runPrompt || node?.promptDraftText || '').trim();
    const kind = String(node?.storyboardOutputKind || '');
    if(kind === 'asset-image'){
        const assetMatch = prompt.match(/(?:人物|场景|道具|服装)?资产图\s*[：:]\s*([^。；，,\n]{1,24})/);
        if(assetMatch?.[1]) return `${assetMatch[1].trim()} 资产生图`;
    }
    return String(fallback || '').trim();
}

function migrateLegacyStoryboardImageOutputFrames(){
    if(!Array.isArray(nodes)) return false;
    let changed = false;
    nodes.forEach(node => {
        if(!node || !node.storyboardOutputKind || node.storyboardOutputKind === 'video') return;
        const prompt = String(node.runPrompt || node.promptDraftText || node.promptOriginalText || '').trim();
        const hasResult = Array.isArray(node.images) && node.images.some(img => img?.url);
        if(!prompt && !hasResult) return;
        const kind = node.storyboardOutputKind;
        const rawTitle = String(node.frameTitle || node.title || '').trim();
        const genericTitle = !rawTitle || ['Image', '故事板 资产生图', '资产生图'].includes(rawTitle);
        const title = !genericTitle
            ? rawTitle
            : storyboardFrameTitleFromPrompt(node, storyboardOutputDisplayTitle(node));
        if(node.type === 'smart-frame'){
            if(title && title !== rawTitle){
                node.title = title;
                node.frameTitle = title;
                changed = true;
            }
            return;
        }
        if(node.type !== 'smart-image') return;
        const finalTitle = String(title || '').trim() && title !== 'Image'
            ? String(title).trim()
            : storyboardOutputDisplayTitle(node);
        const refs = storyboardOutputReferenceImages(node);
        node.type = 'smart-frame';
        node.title = finalTitle;
        node.frameTitle = finalTitle;
        node.prompt = prompt;
        node.sizeHint = storyboardOutputKindLabel(kind);
        node.runSettings = typeof posterFrameNormalizedRunSettings === 'function'
            ? posterFrameNormalizedRunSettings(node.runSettings || smartStoryboardImageSettingsFor())
            : cloneSmartSettings(node.runSettings || smartStoryboardImageSettingsFor());
        node.manualInputRefs = refs;
        node.runPromptRefs = refs;
        node.runInputRefs = refs;
        node.runPrompt = prompt;
        node.promptOriginalText = String(node.promptOriginalText || prompt || '').trim();
        node.w = Math.max(Number(node.w) || 0, 560);
        node.h = Math.max(Number(node.h) || 0, 650);
        changed = true;
    });
    if(changed){
        render();
        scheduleSave();
    }
    return changed;
}

function scheduleLegacyStoryboardFrameMigration(){
    let attempts = 0;
    const tick = () => {
        attempts += 1;
        if(migrateLegacyStoryboardImageOutputFrames()) return;
        if(attempts < 12) setTimeout(tick, 350);
    };
    setTimeout(tick, 0);
}

function applyPromptVersionToNode(node, text){
    if(!node || !isSmartRunnableNode(node)) return;
    const value = String(text || '').trim();
    const refs = uniqueReferenceImages([...(node.runPromptRefs || []), ...(node.manualInputRefs || [])]);
    node.promptDraftText = value;
    node.promptDraftHtml = promptHtmlWithMentionTokens(value, refs) || escapeHtml(value);
    node.runPrompt = value;
    if(activeComposerNode()?.id === node.id){
        promptInput.innerHTML = node.promptDraftHtml;
        delete promptInput.dataset.preserveDraftOnce;
    }
}

function promptOptimizationVideoProfileLabel(profile){
    return ({text:'纯文本', 'first-frame':'首帧/首尾帧', omni:'全能参考'})[profile] || '自动识别';
}

function inferPromptOptimizationVideoProfile(node){
    const nodeSettings = activeComposerNode()?.id === node?.id ? settings : smartSettingsForNode(node);
    const refs = uniqueReferenceImages([...(node?.runPromptRefs || []), ...(node?.manualInputRefs || [])]);
    if(nodeSettings.videoUseFrameRoles) return 'first-frame';
    if(nodeSettings.videoMultimodal || refs.length > 1) return 'omni';
    if(refs.length === 1) return 'first-frame';
    return 'text';
}

function resolvedPromptOptimizationVideoProfile(node){
    const explicit = String(node?.promptOptimizeProfile || 'auto');
    return ['text','first-frame','omni'].includes(explicit) ? explicit : inferPromptOptimizationVideoProfile(node);
}

function composerNodeIsVideo(node){
    if(!node) return false;
    const nodeSettings = activeComposerNode()?.id === node.id ? settings : smartSettingsForNode(node);
    return node.storyboardOutputKind === 'video' || nodeSettings.apiKind === 'video';
}

function renderComposerPromptTools(node){
    if(!composerPromptTools) return;
    const visible = Boolean(node && isSmartRunnableNode(node));
    composerPromptTools.style.display = visible ? 'flex' : 'none';
    if(!visible) return;
    const locked = node.promptUserLocked === true;
    const optimized = String(node.promptOptimizedText || '').trim();
    const optimizing = node.promptOptimizing === true;
    const isVideo = composerNodeIsVideo(node);
    const videoProfile = isVideo ? resolvedPromptOptimizationVideoProfile(node) : '';
    if(promptOptimizeProfileSelect){
        promptOptimizeProfileSelect.style.display = isVideo ? '' : 'none';
        promptOptimizeProfileSelect.value = ['auto','text','first-frame','omni'].includes(node.promptOptimizeProfile) ? node.promptOptimizeProfile : 'auto';
        promptOptimizeProfileSelect.disabled = optimizing || locked;
    }
    const profileSuffix = isVideo ? ` · ${promptOptimizationVideoProfileLabel(videoProfile)}` : '';
    if(promptVersionStatus) promptVersionStatus.textContent = optimizing ? `AI正在优化提示词${profileSuffix}...` : locked ? `当前提示词已锁定${profileSuffix}` : optimized ? `AI优化稿已就绪${profileSuffix}，当前稿仍可编辑` : `当前提示词可编辑${profileSuffix}，AI优化不会直接覆盖`;
    if(promptOptimizeBtn){
        promptOptimizeBtn.disabled = optimizing || locked;
        promptOptimizeBtn.innerHTML = `<i data-lucide="${optimizing ? 'loader-2' : 'wand-sparkles'}"></i><span>${optimizing ? '优化中' : 'AI优化'}</span>`;
    }
    if(promptApplyOptimizedBtn) promptApplyOptimizedBtn.disabled = optimizing || locked || !optimized;
    if(promptRestoreOriginalBtn) promptRestoreOriginalBtn.disabled = optimizing || locked || !String(node.promptOriginalText || '').trim();
    if(promptLockBtn){
        promptLockBtn.classList.toggle('active', locked);
        promptLockBtn.innerHTML = `<i data-lucide="${locked ? 'lock-keyhole' : 'lock-open'}"></i><span>${locked ? '解锁' : '锁定'}</span>`;
    }
    if(promptOptimizedPreview){
        promptOptimizedPreview.classList.toggle('has-text', Boolean(optimized));
        promptOptimizedPreview.innerHTML = optimized ? `<b>AI优化稿（尚未应用）</b>${escapeHtml(optimized)}` : '';
    }
    refreshIcons(composerPromptTools);
}

async function optimizeCurrentComposerPrompt(){
    const node = activeComposerNode();
    if(!node || node.promptUserLocked === true || node.promptOptimizing) return;
    const current = promptPlainText().trim();
    if(!current){ toast('请先填写提示词'); return; }
    if(!String(node.promptOriginalText || '').trim()) node.promptOriginalText = current;
    node.promptOptimizing = true;
    renderComposerPromptTools(node);
    try {
        const isVideo = composerNodeIsVideo(node);
        const profile = isVideo ? resolvedPromptOptimizationVideoProfile(node) : '';
        const ai = promptOptimizationConfigForNode(node);
        const result = await requestPromptOptimization(current, {mode:isVideo ? `video-${profile}` : 'image', ...ai});
        node.promptOptimizedText = result.text;
        node.promptOptimizeProvider = result.provider;
        node.promptOptimizeModel = result.model;
        node.promptOptimizedProfile = profile;
        toast('AI优化稿已生成，确认后再应用');
        scheduleSave();
    } catch(error){
        toast(`AI优化失败：${String(error?.message || error).slice(0, 100)}`);
    } finally {
        node.promptOptimizing = false;
        renderComposerPromptTools(node);
    }
}

Object.assign(window, {
  createScriptStoryboardNode,
  createAssetHubNode,
  createShotAssetCollectorNode,
  smartStoryboardFieldRows,
  smartStoryboardInputBodyHtml,
  smartStoryboardGroupBodyHtml,
  smartStoryboardFramePrompt,
  smartStoryboardVideoPrompt,
  storyboardPersonListForGuard,
  storyboardImagePromptGuard,
  appendStoryboardImagePromptGuard,
  smartAssetTextKey,
  smartAssetCategoryForText,
  smartAssetCategoryLabel,
  smartAssetNameParts,
  smartStoryboardAssetText,
  smartStoryboardAssetFields,
  smartAssetConnectedNodeIds,
  smartAssetHubImageRecords,
  smartAssetHubForStoryboard,
  smartScoreAssetForStoryboard,
  smartStoryboardAssetMatch,
  storyboardAssetRoleLabel,
  storyboardAssetBindingKey,
  storyboardAssetBindingFor,
  setStoryboardAssetBinding,
  storyboardAssetGroupsFor,
  storyboardGroupAssetCandidatesFor,
  storyboardManualAssetCandidates,
  storyboardManualAssetRefsFor,
  shotAssetDemandKey,
  shotAssetDemandTypeLabel,
  shotAssetCardLabel,
  shotAssetCleanCharacterName,
  shotAssetLooksLikeNamedCharacter,
  shotAssetCharacterNamesForCard,
  shotAssetDemandItemsForCard,
  storyboardCardsFromNode,
  shotAssetCollectorConnectedNodes,
  shotAssetCollectorCards,
  shotAssetCollectorDemands,
  shotAssetCandidateKey,
  shotAssetCollectorCanvasCandidates,
  shotAssetCollectorLibraryCandidates,
  shotAssetCollectorBinding,
  shotAssetPurposeLabel,
  shotAssetDefaultPurpose,
  shotAssetPriorityLabel,
  shotAssetPriorityOptions,
  shotAssetBindingFromCandidate,
  shotAssetCollectorBindings,
  setShotAssetCollectorBindings,
  setShotAssetCollectorBinding,
  toggleShotAssetCollectorBinding,
  updateShotAssetCollectorBinding,
  shotAssetCollectorNoAsset,
  setShotAssetCollectorNoAsset,
  shotAssetCollectorBindingKeys,
  shotAssetBindingCategory,
  shotAssetBindingsForCategory,
  shotAssetPickerStateFor,
  shotAssetDemandCategory,
  shotAssetPickerCategoryLabel,
  shotAssetPickerDemandsForCategory,
  shotAssetPickerEnsureState,
  shotAssetPickerActiveDemand,
  shotAssetPickerCandidateCategory,
  shotAssetPickerCandidateGroup,
  shotAssetPickerCandidateLabel,
  shotAssetDefaultGenerationPrompt,
  shotAssetPromptRecord,
  shotAssetPromptBoxHtml,
  shotAssetRecommendationItems,
  shotAssetRecommendationFor,
  shotAssetRecommendationBarHtml,
  normalizeShotAssetRecommendations,
  recommendShotAssetsWithAi,
  shotAssetPickerHtml,
  shotAssetCollectorsForCard,
  shotAssetCollectorForCard,
  shotAssetCollectorDemandsForCard,
  shotAssetContinuityKey,
  shotAssetCollectorContinuityReport,
  shotAssetCollectorPreflight,
  shotAssetPreviousGeneratedRef,
  shotAssetCollectorRefsForCard,
  shotAssetCollectorMentionsForCard,
  shotAssetReadableUsageLabel,
  shotAssetCollectorUsageTextForCard,
  storyboardAssetMentionsFor,
  smartStoryboardPromptWithAssetMentions,
  smartStoryboardAssetPanelHtml,
  shotAssetCollectorPreflightHtml,
  shotAssetCollectorBodyHtml,
  smartAssetHubBodyHtml,
  storyboardAiConfigForCard,
  normalizeStoryboardDirectorReview,
  storyboardDirectorReviewHtml,
  reviewStoryboardCardWithAi,
  smartStoryboardShotCardBodyHtml,
  smartStoryboardCardBodyHtml,
  smartImagePromptSourceVisualCard,
  syncSmartImagePromptCardFromSource,
  smartImagePromptCardBodyHtml,
  createImagePromptCardNode,
  createSmartImagePromptCardFromVisual,
  smartStoryboardReferenceImagesFor,
  storyboardOutputDisplayTitle,
  storyboardOutputReferenceImages,
  smartStoryboardOutputNodeBodyHtml,
  configureStoryboardOutputNode,
  runStoryboardOutputNode,
  storyboardDurationSeconds,
  smartStoryboardVideoSettingsFor,
  smartStoryboardImageSettingsFor,
  smartStoryboardWholePrompt,
  storyboardGenerationGuard,
  legacyStoryboardGenerationGuard,
  createSmartVideoFromStoryboardShot,
  createSmartPreviewFromStoryboardShot,
  createSmartPreviewFromStoryboardFrame,
  syncStoryboardFramesToVideoPrompt,
  updateStoryboardAssetBindingFromControl,
  bindSmartStoryboardShotCardControls,
  ensureSmartStoryboardDelegation,
  bindSmartStoryboardCardControls,
  bindSmartImagePromptCardControls,
  bindSmartAssetHubControls,
  bindShotAssetCollectorControls,
  bindScriptStoryboardControls,
  deleteSmartStoryboardOutputs,
  ensureAutoShotAssetCollector,
  ensureAutoShotAssetCollectors,
  refreshShotAssetCollectorCandidates,
  createSmartStoryboardOutputs,
  runScriptStoryboardSmartNode,
  promptOptimizationSystemPrompt,
  promptOptimizationConfigForNode,
  promptOptimizationConfigForCollector,
  requestSmartCanvasLlmText,
  requestPromptOptimization,
  optimizeShotAssetPrompt,
  createShotAssetPromptNode,
  migrateLegacyStoryboardImageOutputFrames,
  scheduleLegacyStoryboardFrameMigration,
  applyPromptVersionToNode,
  promptOptimizationVideoProfileLabel,
  inferPromptOptimizationVideoProfile,
  resolvedPromptOptimizationVideoProfile,
  composerNodeIsVideo,
  renderComposerPromptTools,
  optimizeCurrentComposerPrompt,
});

scheduleLegacyStoryboardFrameMigration();

promptOptimizeBtn?.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    window.optimizeCurrentComposerPrompt?.();
});
promptOptimizeProfileSelect?.addEventListener('change', event => {
    const node = activeComposerNode();
    if(!node) return;
    node.promptOptimizeProfile = ['text','first-frame','omni'].includes(event.target.value) ? event.target.value : 'auto';
    renderComposerPromptTools(node);
    scheduleSave();
});
promptApplyOptimizedBtn?.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    const node = activeComposerNode();
    const optimized = String(node?.promptOptimizedText || '').trim();
    if(!node || node.promptUserLocked === true || !optimized) return;
    applyPromptVersionToNode(node, optimized);
    delete node.promptOptimizedText;
    renderComposerPromptTools(node);
    scheduleSave();
});
promptRestoreOriginalBtn?.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    const node = activeComposerNode();
    const original = String(node?.promptOriginalText || '').trim();
    if(!node || node.promptUserLocked === true || !original) return;
    applyPromptVersionToNode(node, original);
    renderComposerPromptTools(node);
    scheduleSave();
});
promptLockBtn?.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    const node = activeComposerNode();
    if(!node) return;
    node.promptUserLocked = node.promptUserLocked !== true;
    setPromptInputLocked(node.promptUserLocked === true);
    renderComposerPromptTools(node);
    scheduleSave();
});

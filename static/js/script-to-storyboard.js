(function(){
    const DEFAULT_PROMPT = `你是专业影视故事板设计师。用户输入的是已经写好的完整单镜头分镜文本，不是待拆分剧本。

请按镜头编号识别每个镜头，不要重新创作剧情，不要再次拆分镜头，不要生成“分镜拆解卡”或“分镜画面文字卡”。

只提取每个镜头的视觉故事板信息，并严格输出 JSON：
{
  "shots": [
    {
      "shotNumber": "镜头01",
      "timeRange": "0-3秒",
      "shotSize": "景别",
      "cameraType": "机位类型",
      "focalLength": "焦段",
      "subjects": "主体人物",
      "characterProfiles": [{"name":"人物名称","ageGender":"年龄和性别","occupation":"职业或剧情身份","appearance":"外貌体型","hair":"发型","wardrobe":"服装","demeanor":"稳定气质","period":"剧情年代或时期"}],
      "emotionChange": "情绪变化",
      "emotionPerformance": "可执行的情绪表演：眉眼、嘴唇、呼吸、肌肉紧绷、视线和身体停顿",
      "cameraMove": "运镜方式",
      "frameCount": 1,
      "sourceText": "该镜头原始文本",
      "visualExtract": {
        "start": "起始画面",
        "middle": "中段变化",
        "end": "结束画面",
        "foreground": "前景",
        "middleground": "中景",
        "background": "后景",
        "leftRight": "人物左右位置",
        "focusRelation": "虚实关系",
        "eyeDirection": "视线方向",
        "lightingComposition": "光线和构图"
      },
      "frames": [
        {
          "frameId": "镜头01-F1",
          "label": "起始帧",
          "description": "这一帧能直接用于生成故事板的完整画面描述",
          "composition": "构图/前中后景/虚实关系",
          "emotion": "该帧可执行的情绪表演，不只写情绪标签",
          "prompt": "写实预演图提示词"
        }
      ]
    }
  ]
}

故事板帧数规则：
- 不要固定输出 3、4 或 9 张
- 根据镜头内容的动作、调度、视线、情绪、构图变化决定帧数
- 只要完成该镜头的场景表达需要更多帧，就继续增加独立帧
- 静态镜头可以较少，有复杂走位、长动作或情绪推进的镜头可以输出更多帧

每张故事板必须是独立帧描述，不能输出四宫格或九宫格合成图。
人物资产字段规则：subjects 只能填写真实人物身份或人物名称，例如“40岁左右中国女性主讲人”或“阿野”。不要把服装、发型、外貌、动作、表情、气质、台词、旁白、运镜、镜头和场景描述拆成 subjects 中的人物；这些信息应写入对应的人物设定、visualExtract 或镜头字段。口播台词、旁白台词、人物台词和视频提示词绝对不能成为人物名称。只输出 JSON，不要输出 Markdown。`;

    const PURE_SCRIPT_PROMPT = `你是一名擅长真人情感短剧的导演、摄影指导和分镜设计师。
用户输入的是纯剧本，可能只有人物、动作和台词，没有景别、机位、运镜、构图和镜头切换。

请先把剧本拆解成可执行的短剧分镜，再为每个镜头输出完整视频生成提示词。不要把整段内容写成一个笼统提示词。

情绪不能只写标签。必须写成可执行表演，例如眉心和眉毛的变化、眼神停留或躲开、眼眶和嘴唇状态、呼吸节奏、喉结、下颌或面部肌肉的紧绷、身体停顿和微动作；只使用原文支持的表演，不增加夸张哭喊或新剧情。

拆镜原则：
- 根据剧情、动作、台词、情绪变化和信息重点，自主判断镜头数量；短剧 15 秒通常 3-5 镜，长剧本按剧情段落和节拍拆分。
- 每个镜头只有一个明确视觉任务：交代环境、表现关键台词、捕捉反应、展示物件、完成反转或节奏打断。
- 对话不要默认双人正面并排；优先使用过肩、正反打、单人近景、反应镜头、前景遮挡、一虚一实、框中框、焦点转移。
- 根据此刻观众应该看谁来决定画面主体；台词不一定拍说话者，可以拍听者反应。
- 保持视线方向、人物轴线和空间关系一致，不添加剧本中不存在的重要剧情、台词或人物行为。
- subjects 只写人物身份或人物名称，不要把服装、发型、外貌、动作、表情、气质、台词、旁白、运镜、镜头和场景描述写进 subjects；建议同时返回 characterProfiles，分别记录年龄性别、职业身份、外貌体型、发型、服装、稳定气质和剧情时期。

每个镜头必须包含：
- shotNumber、timeRange、purpose、sourceText
- shotSize、cameraType、focalLength、subjects、scene、props、emotionChange、cameraMove
- characterProfiles：按人物身份记录稳定设定；不要把具体台词、运镜、一次性动作或临时情绪放入人物资产信息
- transition、audio
- visualExtract.start/middle/end/foreground/middleground/background/leftRight/focusRelation/eyeDirection/lightingComposition
- frames：根据镜头变化生成足够数量的独立故事板帧，不固定 3/4/9
- videoPrompt.text：本镜完整视频生成提示词，必须包含时间场景、人物服装、动作表演、景别机位、前中后景、遮挡、透视、视线、运镜、焦距景深、光源方向、色彩质感、本镜时长、限制项
- referenceAssets：需要提供的角色图、服装图、场景图、上一镜画面等

同时输出全局字段：
- continuityReport：相邻镜头连续性检查，包含人物站位、轴线、服装、场景、光线、情绪推进、衔接风险
- referenceAssets：全局参考资产清单

严格输出 JSON：
{
  "shots": [],
  "continuityReport": {"summary":"","items":[]},
  "referenceAssets": []
}
不要输出 Markdown。`;

    const FRAME_LABELS = ['起始帧', '中段帧', '结束帧'];
    const DEFAULT_AVOID = '不生成字幕，不生成水印，不新增人物，不改变服装，不做夸张表演，不直接生成四宫格或九宫格合成图。';
    const STORY_SEGMENT_PROMPT = `你是真人情感短剧导演和视频分镜设计师。用户输入的可能是一整段长剧本，目标是把它整理成可直接生成视频的连续故事板段落。

请按剧情顺序把全文切成多个“故事段”，每个故事段优先15秒，必要时可根据自然剧情节点使用10秒左右，任何单段不得超过15秒。不要拆成3秒一个镜头节点。总时长必须根据输入时间码或剧情容量动态判断：从起点连续向后分段，最后一段使用剩余时长；如果剧情转折更适合10秒结束，也可以输出连续的10秒或15秒故事段。

每个故事段只生成一张故事板卡，在卡片内部提取足够的独立关键帧。帧数按该段剧情需要决定，不固定3、4、9张；每一帧都要能单独看懂当前画面和剧情推进，不能生成四宫格或九宫格合成图。

不要添加原文没有的剧情。每张卡的视频提示词必须覆盖该卡对应的完整10—15秒连续内容，故事板帧只是其中的关键时刻，二者内容必须一致。
人物资产字段规则：subjects 只能填写真实人物身份或人物名称，例如“40岁左右中国女性主讲人”或“阿野”。不要把服装、发型、外貌、动作、表情、气质、台词、旁白、运镜、镜头和场景描述拆成 subjects 中的人物；这些信息写入 characterProfiles、visualExtract 或其他对应镜头字段。口播台词、旁白台词、人物台词和视频提示词绝对不能成为人物名称。scene 只写真实物理场景，props 只写真实道具或产品，不要把台词、动作、镜头或抽象概念写入资产字段。

情绪不能只写“悲伤、愤怒、紧张”等标签。必须写成可执行的表演：眉毛和眉心如何变化，眼神是否停住或躲开，眼眶和嘴唇状态，呼吸、喉结、下颌或面部肌肉是否紧绷，身体如何停顿或移动。只使用原文能支持的细节，不凭空添加夸张哭喊或新动作。

只输出 JSON：
{
  "shots": [{
    "shotNumber": "故事段01",
    "timeRange": "0-15秒",
    "purpose": "这一段视频的核心剧情任务",
    "sourceText": "完整原文",
    "shotSize": "主要景别关系",
    "cameraType": "主要机位关系",
    "focalLength": "焦段或镜头感觉",
    "subjects": "主要人物",
    "scene": "真实物理场景",
    "props": ["真实道具或产品"],
    "characterProfiles": [{"name":"人物名称","ageGender":"年龄和性别","occupation":"职业或剧情身份","appearance":"外貌体型","hair":"发型","wardrobe":"服装","demeanor":"稳定气质","period":"剧情年代或时期"}],
    "emotionChange": "情绪推进概括",
    "emotionPerformance": "可执行的详细情绪表演",
    "cameraMove": "主要运镜",
    "transition": "内部节奏或声音衔接",
    "audio": "台词、环境声和关键声音",
    "visualExtract": {"start":"起始画面","middle":"中段变化","end":"结束画面","foreground":"前景","middleground":"中景","background":"后景","leftRight":"人物站位","focusRelation":"虚实关系","eyeDirection":"视线方向","lightingComposition":"光线和构图"},
    "frameCount": 1,
    "frames": [{"frameId":"故事段01-F1","label":"关键帧","description":"独立故事板画面描述","composition":"构图和空间关系","emotion":"该帧可见的详细情绪表演","videoBeat":"对应15秒视频中的时间点"}],
    "videoPrompt": {"text":"覆盖本故事段完整时长的一条连续视频生成提示词"},
    "referenceAssets": []
  }, {
    "shotNumber": "故事段02",
    "timeRange": "15-30秒",
    "sourceText": "该时间段对应的完整原文",
    "subjects": "该段主要人物",
    "scene": "该段真实物理场景",
    "props": [],
    "characterProfiles": [],
    "frames": [],
    "videoPrompt": {"text":"覆盖故事段02完整时长的连续视频提示词"}
  }],
  "continuityReport": {"summary":"","items":[]},
  "referenceAssets": []
}
不要输出 Markdown。`;

    function detailedEmotion(source, fallback=''){
        const s = text(source);
        const lines = sentences(s).filter(line => /情绪|眼神|眼睛|眼眶|眉|嘴唇|嘴角|呼吸|喉结|下颌|肌肉|发抖|愣|慌乱|愤怒|生气|悲伤|难过|哭|克制|强忍|沉默|躲开|盯/.test(line));
        if(lines.length) return compact(lines.slice(0, 4).join(''), 360);
        if(/愤怒|生气|恼怒/.test(s)) return '眉心向内收紧，眉头压低，眼神定住，嘴角和下颌绷紧，呼吸变重但不夸张，身体保持压着火的停顿。';
        if(/悲伤|难过|失落/.test(s)) return '眼神变沉并短暂停住，眼眶湿润但不立即流泪，嘴唇轻轻收紧，呼吸变慢或发颤，面部肌肉努力维持平静。';
        if(/紧张|慌乱|害怕/.test(s)) return '眼神快速搜索并短暂躲开，眉心轻收，嘴唇微张或抿住，呼吸变浅变快，肩颈和手指出现轻微紧绷。';
        if(/克制|强忍|忍住/.test(s)) return '眼神停留后刻意压住波动，嘴唇抿紧，喉结或下颌出现一次明显的吞咽和收紧，呼吸沉重但保持克制。';
        return text(fallback) || '通过眼神停顿、嘴唇变化、呼吸和身体微小停顿表现当前情绪，保持自然克制。';
    }

    function text(value){
        return String(value ?? '').trim();
    }

    function compact(value, max=220){
        const cleaned = text(value).replace(/\s+/g, ' ');
        return cleaned.length > max ? `${cleaned.slice(0, max)}...` : cleaned;
    }

    function extractJson(raw){
        const source = text(raw);
        if(!source) return null;
        try { return JSON.parse(source); } catch(_) {}
        const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i);
        if(fenced){
            try { return JSON.parse(fenced[1]); } catch(_) {}
        }
        const start = source.indexOf('{');
        const end = source.lastIndexOf('}');
        if(start >= 0 && end > start){
            try { return JSON.parse(source.slice(start, end + 1)); } catch(_) {}
        }
        const arrStart = source.indexOf('[');
        const arrEnd = source.lastIndexOf(']');
        if(arrStart >= 0 && arrEnd > arrStart){
            try { return {shots:JSON.parse(source.slice(arrStart, arrEnd + 1))}; } catch(_) {}
        }
        return null;
    }

    function firstMatch(source, patterns, fallback=''){
        const s = text(source);
        for(const pattern of patterns){
            const m = s.match(pattern);
            if(m) return compact(m[1] || m[0], 120);
        }
        return fallback;
    }

    function sentences(source){
        return text(source)
            .split(/(?<=[。！？；])|\n+/)
            .map(s => s.trim())
            .filter(Boolean);
    }

    function beatUnits(source){
        return text(source)
            .split(/(?<=[。！？；；，,、])|\n+/)
            .map(s => s.trim())
            .filter(Boolean);
    }

    function pickSentences(source, keys, max=2){
        const list = sentences(source).filter(line => keys.some(key => line.includes(key)));
        return compact((list.length ? list : sentences(source)).slice(0, max).join(''), 260);
    }

    function inferShotSize(source){
        return firstMatch(source, [
            /(面部大特写|大特写|特写|中近景|近景|中景|全景|远景|普通近景|更紧的近景)/,
            /(景别[:：]\s*([^。；\n]+))/
        ], '');
    }

    function inferCameraType(source){
        const hits = [];
        ['平视', '俯拍', '仰拍', '过肩', '肩后', '正面', '三分之二侧面', '侧脸', '跟拍', '固定机位'].forEach(key => {
            if(text(source).includes(key)) hits.push(key);
        });
        return hits.slice(0, 4).join('、');
    }

    function inferFocalLength(source){
        return firstMatch(source, [/(\d+\s*mm[^，。；\n]*)/, /(焦段[:：]\s*([^。；\n]+))/], '');
    }

    function inferSubjects(source){
        const known = ['阿野', '小满妈妈', '小满'];
        const hits = known.filter(name => text(source).includes(name));
        return hits.length ? hits.join('、') : firstMatch(source, [/主体人物[:：]\s*([^。；\n]+)/], '');
    }

    function inferCameraMove(source){
        const hits = [];
        ['缓慢推近', '推近', '跟拍', '拉远', '摇镜', '移镜', '固定', '手持', '环绕'].forEach(key => {
            if(text(source).includes(key)) hits.push(key);
        });
        return hits.length ? hits.slice(0, 3).join('、') : '静态或轻微运动';
    }

    function inferFrameCount(source){
        const s = text(source);
        const beats = new Set();
        const add = label => { if(label) beats.add(label); };
        if(/起始|开头|一开始|先/.test(s)) add('起始');
        if(/中段|随后|接着|然后|开始|逐渐|迅速/.test(s)) add('中段');
        if(/最后|结束|最终|第二次/.test(s)) add('结束');
        if(/迈出|走|跑|追|起身|坐下|转身|回头|靠近|后退|推|拉|拿|放|递|抱|躲|避开|抬头|低头/.test(s)) add('动作');
        if(/眼神|视线|看着|盯住|看向|对视|偏开/.test(s)) add('视线');
        if(/情绪|慌乱|崩溃|发颤|克制|愣住|不理解|呼吸|吞咽|哭|笑/.test(s)) add('情绪');
        if(/推近|拉远|跟拍|摇镜|移镜|环绕|变焦|运镜|机位/.test(s)) add('运镜');
        if(/前景|中景|后景|虚化|清晰|焦点|构图|光线|景深/.test(s)) add('构图');
        const explicitFrames = s.match(/(?:故事板|分镜|关键)?帧(?:数)?\s*[:：]?\s*(\d+)/);
        if(explicitFrames) return Math.max(1, Number(explicitFrames[1]) || 1);
        const unitCount = beatUnits(s).length;
        const sentenceFrames = unitCount >= 12 ? Math.ceil(unitCount / 3) : unitCount >= 7 ? Math.ceil(unitCount / 4) : 0;
        return Math.max(1, beats.size || sentenceFrames || 1);
    }

    function inferVisualExtract(source){
        return {
            start:pickSentences(source, ['先', '起始', '开头', '听见', '面部', '站在', '位于'], 2),
            middle:pickSentences(source, ['随后', '开始', '中段', '呼吸', '吞咽', '迈出', '推近', '搜索'], 2),
            end:pickSentences(source, ['最后', '第二次', '结束', '说出', '发颤', '避开'], 2),
            foreground:pickSentences(source, ['前景', '发丝', '肩线', '右肩', '后脑'], 1),
            middleground:pickSentences(source, ['中景', '面部完全清晰', '位于中景', '主体'], 1),
            background:pickSentences(source, ['后景', '背景', '门框', '走廊', '灯光光斑'], 1),
            leftRight:pickSentences(source, ['左侧', '右侧', '左右位置', '画面左', '画面右'], 2),
            focusRelation:pickSentences(source, ['虚化', '清晰', '焦点', '景深', '软焦'], 2),
            eyeDirection:pickSentences(source, ['看着', '视线', '眼神', '盯住', '看向'], 2),
            lightingComposition:pickSentences(source, ['光', '构图', '色调', '肤色', '安全裁切', '16:9', '2.39:1'], 3)
        };
    }

    function frameSourceForIndex(shot, index, count){
        const v = shot.visualExtract || {};
        const beatLines = beatUnits(shot.sourceText || '').filter(line => /先|随后|接着|然后|开始|逐渐|迅速|最后|最终|迈出|走|跑|拿|放|递|转身|回头|靠近|后退|坐下|站起|视线|眼神|呼吸|发颤|避开|推近|拉远|跟拍|光线|构图|前景|中景|后景/.test(line));
        if(count <= 1) return [v.start, v.middle, v.end].filter(Boolean).join(' ');
        if(count === 2) return index === 0 ? v.start : (v.end || v.middle || v.start);
        if(index === 0) return beatLines[0] || v.start || shot.sourceText || '';
        if(index === count - 1) return beatLines[beatLines.length - 1] || v.end || v.middle || v.start || shot.sourceText || '';
        return beatLines[index] || beatLines[index - 1] || v.middle || v.start || shot.sourceText || '';
    }

    function buildFramePrompt(shot, frame, index=0){
        const v = shot.visualExtract || {};
        const video = videoPromptText(shot);
        return [
            `${shot.shotNumber || '镜头'} ${frame.label || FRAME_LABELS[index] || '故事板帧'}，${frame.description || ''}`,
            `对应视频段落：${frame.videoBeat || frame.description || '按视频提示词保持连续动作'}`,
            `景别/机位：${[shot.shotSize, shot.cameraType, shot.focalLength].filter(Boolean).join('，') || '按镜头文本执行'}`,
            `人物与情绪表演：${[shot.subjects, frame.emotion || shot.emotionPerformance || shot.emotionChange].filter(Boolean).join('，') || '按镜头文本执行'}`,
            `构图：${frame.composition || v.lightingComposition || '保留前中后景、人物站位、虚实关系和视线方向'}`,
            `光线：${v.lightingComposition || '真实自然光线，电影感构图'}`,
            `视频一致性：本帧必须服务于同一条视频提示词，不改变人物、服装、空间、光线和动作方向。`,
            `视频提示词摘要：${compact(video, 420)}`,
            `限制：${DEFAULT_AVOID}`
        ].filter(Boolean).join('\n');
    }

    function inferAudioText(sourceText){
        const source = text(sourceText);
        const quoted = [...source.matchAll(/[“"']([^“”"']{1,80})[”"']/g)].map(m => m[1]).filter(Boolean);
        const sound = pickSentences(source, ['声音', '台词', '呼吸', '脚步', '音乐', '底噪', '说'], 2);
        return [sound, quoted.length ? `台词：${quoted.join(' / ')}` : ''].filter(Boolean).join('；');
    }

    function buildVideoPrompt(shot){
        const v = shot?.visualExtract || {};
        const duration = text(shot?.timeRange) || firstMatch(shot?.sourceText || '', [/本镜时长\s*([\d.]+\s*秒)/], '') || '按镜头文本时长';
        const beats = Array.isArray(shot?.storyBeats) && shot.storyBeats.length
            ? shot.storyBeats.map((beat, index) => `节拍${index + 1}：${beat}`).join('\n')
            : [
                v.start && `起始画面：${v.start}`,
                v.middle && `中段变化：${v.middle}`,
                v.end && `结束画面：${v.end}`
            ].filter(Boolean).join('\n');
        const space = [
            v.foreground && `前景：${v.foreground}`,
            v.middleground && `中景：${v.middleground}`,
            v.background && `后景：${v.background}`,
            v.leftRight && `人物站位：${v.leftRight}`,
            v.focusRelation && `虚实关系：${v.focusRelation}`,
            v.eyeDirection && `视线方向：${v.eyeDirection}`
        ].filter(Boolean).join('\n');
        const audio = text(shot?.audio) || inferAudioText(shot?.sourceText || '');
        return [
            `${shot?.shotNumber || '镜头'} 视频生成提示词`,
            `时长：${duration}`,
            `主体人物：${text(shot?.subjects) || '按镜头文本执行'}`,
            `景别/机位/焦段：${[shot?.shotSize, shot?.cameraType, shot?.focalLength].filter(Boolean).join('，') || '按镜头文本执行'}`,
            `运镜方式：${text(shot?.cameraMove) || '按镜头文本执行'}`,
            `情绪推进：${text(shot?.emotionChange) || '按镜头文本执行'}`,
            `具体表演：${text(shot?.emotionPerformance) || detailedEmotion(shot?.sourceText || '', shot?.emotionChange)}`,
            '',
            '连续动作：',
            beats || compact(shot?.sourceText || '', 700),
            '',
            '空间与构图：',
            space || '保持原分镜里的前景、中景、后景、人物左右位置、虚实关系和视线方向。',
            '',
            `光线/色调：${text(v.lightingComposition) || '按镜头文本保持光线方向、色调和真实质感。'}`,
            audio ? `声音/台词：${audio}` : '',
            '',
            '画面必须与故事板一致：每个故事板帧都只是本视频提示词中的关键时刻，不得改变人物身份、服装、场景、左右站位、光线方向、动作逻辑和情绪推进。',
            `限制：${DEFAULT_AVOID}`
        ].filter(Boolean).join('\n');
    }

    function normalizeVideoPrompt(src, shot){
        const raw = src?.videoPrompt;
        if(typeof raw === 'string') return {text:raw, source:'user'};
        if(raw && typeof raw === 'object'){
            return {
                text:text(raw.text) || buildVideoPrompt(shot),
                duration:text(raw.duration || shot?.timeRange),
                camera:text(raw.camera || [shot?.shotSize, shot?.cameraType, shot?.focalLength].filter(Boolean).join('，')),
                motion:text(raw.motion || shot?.cameraMove),
                audio:text(raw.audio || inferAudioText(shot?.sourceText || '')),
                constraints:text(raw.constraints || DEFAULT_AVOID),
                source:text(raw.source || 'auto'),
                updatedAt:raw.updatedAt || ''
            };
        }
        return {
            text:buildVideoPrompt(shot),
            duration:text(shot?.timeRange),
            camera:[shot?.shotSize, shot?.cameraType, shot?.focalLength].filter(Boolean).join('，'),
            motion:text(shot?.cameraMove),
            audio:inferAudioText(shot?.sourceText || ''),
            constraints:DEFAULT_AVOID,
            source:'auto',
            updatedAt:''
        };
    }

    function videoPromptText(shot){
        const raw = shot?.videoPrompt;
        if(typeof raw === 'string') return raw;
        if(raw && typeof raw === 'object' && text(raw.text)) return text(raw.text);
        return buildVideoPrompt(shot || {});
    }

    function buildWholeStoryboardPrompt(shot){
        const normalized = normalizeShot(shot || {}, 0);
        const frames = ensureFrames(normalized);
        const video = videoPromptText(normalized);
        const header = storyboardHeaderFields(normalized)
            .map(([label, value]) => `${label}：${value || '-'}`)
            .join('\n');
        const frameText = frames.map((frame, index) => [
            `【${frame.label || FRAME_LABELS[index] || `故事板帧${index + 1}`}】`,
            `画面：${frame.description || '-'}`,
            `构图：${frame.composition || '按镜头文本保持前景、中景、后景、人物左右位置、虚实关系和视线方向'}`,
            `情绪：${frame.emotion || normalized.emotionChange || '-'}`,
            `单帧提示：${frame.prompt || buildFramePrompt(normalized, frame, index)}`
        ].join('\n')).join('\n\n');
        return [
            `${normalized.shotNumber || '镜头'} 完整故事板总览图`,
            '目标：生成一张完整的故事板总览图，把本镜头所有关键帧按时间顺序清楚排布在同一张图中，让人一眼能看懂剧情推进、人物站位、情绪变化和运镜节奏。',
            '要求：每一帧都要独立可读，不要丢失关键动作；可以按多行多列自动排版，不强制四宫格、九宫格；不要生成字幕、水印、无关人物或与参考资产冲突的服装外貌。',
            '',
            '镜头信息：',
            header,
            '',
            '故事板帧：',
            frameText,
            '',
            '同源视频提示词：',
            video,
            '',
            `限制：${DEFAULT_AVOID}`
        ].filter(Boolean).join('\n');
    }

    function ensureFrames(shot){
        const frames = Array.isArray(shot.frames) ? shot.frames : [];
        const count = Math.max(1, Number(shot.frameCount) || 0, frames.length || 0, inferFrameCount(shot.sourceText || ''));
        return Array.from({length:count}).map((_, index) => {
            const src = frameSourceForIndex(shot, index, count) || shot.sourceText || '';
            const frame = frames[index] && typeof frames[index] === 'object' ? frames[index] : {};
            const label = text(frame.label) || (count === 1 ? '关键帧' : count === 2 ? (index === 0 ? '起始帧' : '结束帧') : (FRAME_LABELS[index] || `推进帧${index + 1}`));
            const normalized = {
                frameId:text(frame.frameId) || `${shot.shotNumber || '镜头'}-F${index + 1}`,
                label,
                description:text(frame.description) || compact(src, 260),
                composition:text(frame.composition) || compact([
                    shot.visualExtract?.foreground && `前景：${shot.visualExtract.foreground}`,
                    shot.visualExtract?.middleground && `中景：${shot.visualExtract.middleground}`,
                    shot.visualExtract?.background && `后景：${shot.visualExtract.background}`,
                    shot.visualExtract?.focusRelation && `虚实：${shot.visualExtract.focusRelation}`
                ].filter(Boolean).join('；'), 220),
                emotion:text(frame.emotion) || compact(shot.emotionPerformance || detailedEmotion(shot.sourceText, shot.emotionChange), 300),
                videoBeat:text(frame.videoBeat) || compact(src, 220),
                locked:Boolean(frame.locked),
                imageUrl:text(frame.imageUrl)
            };
            // 按需生成帧提示词，避免把整段视频提示词复制到每一帧的画布数据中。
            normalized.prompt = text(frame.prompt);
            return normalized;
        });
    }

    function normalizeShot(item, index){
        const src = item && typeof item === 'object' ? item : {};
        const sourceText = text(src.sourceText || src.text || src.content || src.raw || src.description);
        const shotNumber = text(src.shotNumber || src.shot || src.number) || `镜头${String(index + 1).padStart(2, '0')}`;
        const visualExtract = {
            ...inferVisualExtract(sourceText),
            ...(src.visualExtract && typeof src.visualExtract === 'object' ? src.visualExtract : {})
        };
        const shot = {
            shotNumber,
            timeRange:text(src.timeRange || src.duration || src.time) || firstMatch(sourceText, [/(\d+(?:\.\d+)?\s*[—\-~到至]\s*\d+(?:\.\d+)?\s*秒?)/], ''),
            purpose:text(src.purpose || src.goal || src.intent),
            shotSize:text(src.shotSize || src.sceneSize || src.camera?.shotSize) || inferShotSize(sourceText),
            cameraType:text(src.cameraType || src.camera?.type) || inferCameraType(sourceText),
            focalLength:text(src.focalLength || src.lens || src.camera?.focalLength) || inferFocalLength(sourceText),
            subjects:text(src.subjects || src.subject || src.characters) || inferSubjects(sourceText),
            scene:text(src.scene || src.location || src.setting || src.visualExtract?.background),
            props:(Array.isArray(src.props) ? src.props : (Array.isArray(src.objects) ? src.objects : [])).map(item => text(item?.name || item?.label || item)).filter(Boolean),
            characterProfiles:Array.isArray(src.characterProfiles) ? src.characterProfiles : (Array.isArray(src.characterDetails) ? src.characterDetails : []),
            emotionChange:text(src.emotionChange || src.emotion) || pickSentences(sourceText, ['情绪', '眼神', '呼吸', '慌乱', '崩溃', '发颤', '克制'], 2),
            emotionPerformance:text(src.emotionPerformance || src.performance) || detailedEmotion(sourceText, text(src.emotionChange || src.emotion)),
            cameraMove:text(src.cameraMove || src.motion || src.camera?.move) || inferCameraMove(sourceText),
            transition:text(src.transition || src.cut || src.next),
            audio:text(src.audio || src.sound) || inferAudioText(sourceText),
            referenceAssets:Array.isArray(src.referenceAssets) ? src.referenceAssets : referenceAssetsForText(sourceText),
            frameCount:Math.max(1, Number(src.frameCount) || 0, Array.isArray(src.frames) ? src.frames.length : 0, inferFrameCount(sourceText)),
            sourceText,
            visualExtract
        };
        shot.videoPrompt = normalizeVideoPrompt(src, shot);
        shot.frames = ensureFrames({...shot, frames:src.frames});
        shot.videoPrompt = normalizeVideoPrompt(src, shot);

        // Legacy fields kept so older画布数据/按钮不报错。
        shot.breakdown = src.breakdown || {shotNumber, story:sourceText, purpose:shot.purpose || '已有分镜转故事板', actionSummary:shot.emotionChange || sourceText.slice(0, 80)};
        shot.visual = src.visual || {
            shotNumber,
            subject:shot.subjects,
            action:shot.frames.map(f => f.description).join(' / '),
            emotion:shot.emotionChange,
            scene:shot.visualExtract?.background || sourceText,
            camera:[shot.shotSize, shot.cameraType, shot.focalLength].filter(Boolean).join('，'),
            focus:shot.visualExtract?.focusRelation || '',
            lighting:shot.visualExtract?.lightingComposition || '',
            avoid:DEFAULT_AVOID
        };
        return shot;
    }

    function normalizeShots(data){
        const list = Array.isArray(data) ? data : (Array.isArray(data?.shots) ? data.shots : []);
        return list.map(normalizeShot).filter(shot => shot.sourceText || shot.frames?.length || shot.subjects);
    }

    function uniqueJoined(values, separator='、'){
        return [...new Set((values || []).map(value => text(value)).filter(Boolean))].join(separator);
    }

    function storyRangeText(start, end){
        const format = value => {
            const n = Math.max(0, Number(value) || 0);
            if(n < 60) return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
            const min = Math.floor(n / 60);
            const sec = Math.round((n - min * 60) * 10) / 10;
            return `${min}:${Number.isInteger(sec) ? String(sec).padStart(2, '0') : sec.toFixed(1).padStart(4, '0')}`;
        };
        return `${format(start)}—${format(end)}秒`;
    }

    function storyShotRange(shot, fallbackStart=0){
        const parsed = parseTimeRange(shot?.timeRange) || parseTimeRange(shot?.sourceText);
        if(parsed) return parsed;
        const durationMatch = text(shot?.timeRange).match(/(\d+(?:\.\d+)?)\s*秒/);
        const duration = Math.max(1, Math.min(15, Number(durationMatch?.[1]) || 15));
        return {start:fallbackStart, end:fallbackStart + duration};
    }

    function sectionTextForWindow(source, start, end){
        if(!hasExplicitTimeRange(source)) return '';
        const parts = splitPureScriptSections(source)
            .filter(section => Number(section.end) > start + 0.01 && Number(section.start) < end - 0.01)
            .map(section => [section.heading, section.body].filter(Boolean).join('\n'));
        return text(parts.join('\n'));
    }

    function lineTextForWindow(source, index, count){
        const chunks = chunkLines(splitLinesForShots(source), count);
        return text((chunks[index] || []).join('\n'));
    }

    function framesForWindow(frames, start, end, index, count){
        const list = Array.isArray(frames) ? frames.filter(frame => frame && typeof frame === 'object') : [];
        if(!list.length) return [];
        const timed = list.map(frame => ({frame, range:parseTimeRange(frame.videoBeat || frame.description || '')}));
        if(timed.some(item => item.range)){
            return timed
                .filter(item => item.range && item.range.end > start + 0.01 && item.range.start < end - 0.01)
                .map(item => item.frame);
        }
        return list.filter((_, frameIndex) => Math.floor(frameIndex * count / list.length) === index);
    }

    function frameCountForWindowText(source, frames){
        const explicitCount = hasExplicitTimeRange(source) ? splitPureScriptSections(source).length : 0;
        const lineCount = splitLinesForShots(source).length;
        const lineEstimate = lineCount >= 8 ? 4 : lineCount >= 5 ? 3 : lineCount >= 2 ? 2 : 1;
        return Math.max(frames.length || 0, explicitCount || 0, lineEstimate, inferFrameCount(source));
    }

    function splitLongShotForSegments(shot, range){
        const duration = Math.max(0, Number(range.end) - Number(range.start));
        if(duration <= 15.01) return [{shot, range}];
        const count = Math.max(1, Math.ceil(duration / 15));
        const source = text(shot?.sourceText);
        return Array.from({length:count}).map((_, index) => {
            const start = Number(range.start) + index * 15;
            const end = Math.min(Number(range.end), start + 15);
            const excerpt = sectionTextForWindow(source, start, end) || lineTextForWindow(source, index, count) || source;
            const frames = framesForWindow(shot?.frames, start, end, index, count);
            return {
                shot:{
                    ...shot,
                    timeRange:storyRangeText(start, end),
                    sourceText:excerpt,
                    frames,
                    frameCount:frameCountForWindowText(excerpt, frames)
                },
                range:{start, end}
            };
        });
    }

    function groupShotsIntoStorySegments(shots){
        const groups = [];
        let current = [];
        let groupStart = null;
        let fallbackStart = 0;
        const items = [];
        (shots || []).forEach(shot => {
            const range = storyShotRange(shot, fallbackStart);
            fallbackStart = Math.max(fallbackStart, range.end);
            splitLongShotForSegments(shot, range).forEach(item => items.push(item));
        });
        items.forEach(({shot, range}) => {
            if(current.length && range.end - groupStart > 15.01){
                groups.push(current);
                current = [];
                groupStart = null;
            }
            if(groupStart === null) groupStart = range.start;
            current.push({shot, range});
            if(range.end - groupStart >= 14.5){
                groups.push(current);
                current = [];
                groupStart = null;
            }
        });
        if(current.length) groups.push(current);
        return groups;
    }

    function buildStorySegment(group, index, sourceFallback=''){
        const shots = group.map(item => item.shot);
        const first = shots[0] || {};
        const segmentNumber = `故事段${String(index + 1).padStart(2, '0')}`;
        let frameOrdinal = 0;
        const allFrames = shots.flatMap(shot => (shot.frames || []).map(frame => ({
            ...frame,
            frameId:`${segmentNumber}-F${++frameOrdinal}`,
            label:frame.label || `推进帧${frameOrdinal}`,
            videoBeat:frame.videoBeat || frame.description
        })));
        const source = shots.map(shot => shot.sourceText).filter(Boolean).join('\n') || text(sourceFallback);
        const start = group[0]?.range?.start ?? index * 15;
        const end = group[group.length - 1]?.range?.end ?? start + 15;
        const frameCount = Math.max(
            allFrames.length || 0,
            ...shots.map(shot => Number(shot.frameCount) || 0),
            frameCountForWindowText(source, allFrames)
        );
        const segment = normalizeShot({
            ...first,
            shotNumber:segmentNumber,
            timeRange:storyRangeText(start, end),
            purpose:uniqueJoined(shots.map(shot => shot.purpose), '；') || `完成${storyRangeText(start, end)}内的连续剧情和情绪推进`,
            sourceText:source,
            subjects:uniqueJoined(shots.map(shot => shot.subjects)),
            scene:uniqueJoined(shots.map(shot => shot.scene), '；'),
            props:[...new Set(shots.flatMap(shot => Array.isArray(shot.props) ? shot.props : []))],
            characterProfiles:shots.flatMap(shot => Array.isArray(shot.characterProfiles) ? shot.characterProfiles : []),
            emotionChange:uniqueJoined(shots.map(shot => shot.emotionChange), '；'),
            emotionPerformance:uniqueJoined(shots.map(shot => shot.emotionPerformance), '；'),
            cameraMove:uniqueJoined(shots.map(shot => shot.cameraMove), '；'),
            audio:uniqueJoined(shots.map(shot => shot.audio), '；'),
            referenceAssets:mergeReferenceAssets(source, shots),
            frames:allFrames,
            frameCount,
            storyBeats:allFrames.map(frame => frame.videoBeat || frame.description)
        }, index);
        segment.storyBeats = allFrames.length ? allFrames.map(frame => frame.videoBeat || frame.description) : [segment.sourceText];
        segment.videoPrompt = normalizeVideoPrompt({videoPrompt:{text:buildVideoPrompt(segment), source:'auto'}}, segment);
        return segment;
    }

    function buildStorySegments(shots, sourceText=''){
        return groupShotsIntoStorySegments(shots).map((group, index) => buildStorySegment(group, index, sourceText));
    }

    function fallbackStorySegment(script){
        const source = text(script);
        if(!source) return [];
        const localShots = fallbackScriptBreakdown(source);
        return localShots.length ? buildStorySegments(localShots, source) : [];
    }

    function normalizeStorySegment(data, sourceText=''){
        const source = text(sourceText);
        const list = normalizeShots(data);
        if(!list.length) return fallbackStorySegment(source);
        const segments = buildStorySegments(list, source);
        return segments.length ? segments : fallbackStorySegment(source);
    }

    function parseHeader(header, index){
        const clean = text(header).replace(/^#+\s*/, '');
        const m = clean.match(/(镜头\s*[\d一二三四五六七八九十百]+)\s*[｜|]\s*(.+)$/);
        return {
            shotNumber:text(m?.[1]).replace(/\s+/g, '') || `镜头${String(index + 1).padStart(2, '0')}`,
            timeRange:text(m?.[2] || '')
        };
    }

    function fallbackSplit(script, mode='shot'){
        if(mode === 'segment') return fallbackStorySegment(script);
        if(mode === 'script') return fallbackScriptBreakdown(script);
        const source = text(script);
        if(!source) return [];
        const matches = [...source.matchAll(/(?:^|\n)\s*(镜头\s*[\d一二三四五六七八九十百]+[^\n]*)([\s\S]*?)(?=\n\s*镜头\s*[\d一二三四五六七八九十百]+[^\n]*|$)/g)];
        const chunks = matches.length
            ? matches.map((m, index) => ({...parseHeader(m[1], index), body:text(m[2])}))
            : [{shotNumber:'镜头01', timeRange:'', body:source}];
        return chunks.map((chunk, index) => normalizeShot({
            shotNumber:chunk.shotNumber,
            timeRange:chunk.timeRange,
            sourceText:[chunk.shotNumber, chunk.timeRange].filter(Boolean).join('｜') + '\n' + chunk.body
        }, index));
    }

    function buildMessage(script, prompt, mode='shot'){
        const label = mode === 'script' ? '用户提供的纯剧本文本' : '用户提供的完整镜头分镜文本';
        return `${text(prompt) || promptForMode(mode)}\n\n${label}：\n${text(script)}`;
    }

    function storyboardHeaderFields(shot){
        return [
            ['镜头编号', text(shot?.shotNumber)],
            ['时间范围', text(shot?.timeRange)],
            ['镜头目的', text(shot?.purpose)],
            ['景别', text(shot?.shotSize)],
            ['机位类型', text(shot?.cameraType)],
            ['焦段', text(shot?.focalLength)],
            ['主体人物', text(shot?.subjects)],
            ['情绪变化', text(shot?.emotionChange)],
            ['情绪表演', text(shot?.emotionPerformance)],
            ['运镜方式', text(shot?.cameraMove)],
            ['故事板帧数', String(Math.max(1, Number(shot?.frameCount) || shot?.frames?.length || 1))]
        ];
    }

    function visualFields(shot){
        const visual = shot?.visual || {};
        return [
            ['镜头编号', text(shot?.shotNumber || visual.shotNumber)],
            ['人物/主体', text(visual.subject || shot?.subjects)],
            ['动作', text(visual.action || shot?.frames?.map(f => f.description).join(' / '))],
            ['情绪', text(visual.emotion || shot?.emotionChange)],
            ['场景', text(visual.scene || shot?.sourceText)],
            ['景别/机位', text(visual.camera || [shot?.shotSize, shot?.cameraType, shot?.focalLength].filter(Boolean).join('，'))],
            ['视觉重点', text(visual.focus || shot?.visualExtract?.focusRelation)],
            ['光线', text(visual.lighting || shot?.visualExtract?.lightingComposition)],
            ['避免事项', text(visual.avoid || DEFAULT_AVOID)]
        ];
    }

    function visualInfoText(shot){
        return visualFields(shot).map(([label, value]) => `${label}：${value || '-'}`).join('\n');
    }

    function visualExtractText(shot){
        const v = shot?.visualExtract || {};
        return [
            ['起始', text(v.start)],
            ['中段', text(v.middle)],
            ['结束', text(v.end)],
            ['前景', text(v.foreground)],
            ['中景', text(v.middleground)],
            ['后景', text(v.background)],
            ['站位', text(v.leftRight)],
            ['虚实', text(v.focusRelation)],
            ['视线', text(v.eyeDirection)],
            ['光线构图', text(v.lightingComposition)]
        ]
            .filter(([, value]) => value)
            .map(([label, value]) => `${label}：${value}`)
            .join('\n') || '暂无提取信息';
    }

    function imagePromptDraft(shot){
        const frame = shot?.frames?.[0] || {};
        return frame.prompt || buildFramePrompt(shot || {}, frame, 0);
    }

    function regenerateFrame(shot, frameIndex){
        const normalized = normalizeShot(shot || {}, 0);
        const index = Math.max(0, Math.min(normalized.frames.length - 1, Number(frameIndex) || 0));
        return ensureFrames({...normalized, frames:[]})[index];
    }

    function promptForMode(mode){
        if(mode === 'segment') return STORY_SEGMENT_PROMPT;
        return mode === 'script' ? PURE_SCRIPT_PROMPT : DEFAULT_PROMPT;
    }

    function parseTimecode(value){
        const raw = text(value);
        const m = raw.match(/(\d+)(?::(\d+))?(?:\.(\d+))?/);
        if(!m) return null;
        if(m[2] !== undefined) return Number(m[1]) * 60 + Number(m[2]) + Number(`0.${m[3] || 0}`);
        return Number(m[1]) + Number(`0.${m[3] || 0}`);
    }

    function formatTimecode(seconds){
        const n = Math.max(0, Number(seconds) || 0);
        const min = Math.floor(n / 60);
        const sec = Math.round((n - min * 60) * 10) / 10;
        const secText = Number.isInteger(sec) ? String(sec).padStart(2, '0') : sec.toFixed(1).padStart(4, '0');
        return min ? `${min}:${secText}` : `${secText}秒`;
    }

    function parseTimeRange(textValue){
        const raw = text(textValue);
        const m = raw.match(/(\d{1,2}:\d{2}|\d+(?:\.\d+)?)\s*(?:秒|s)?\s*(?:[\u2013\u2014\-~]|到|至)\s*(\d{1,2}:\d{2}|\d+(?:\.\d+)?)\s*(?:秒|s)?/i);
        if(!m) return null;
        const start = parseTimecode(m[1]);
        const end = parseTimecode(m[2]);
        if(start === null || end === null || end <= start) return null;
        return {start, end};
    }

    function hasExplicitTimeRange(source){
        return /(?:\d{1,2}:\d{2}|\d+(?:\.\d+)?)\s*(?:秒|s)?\s*(?:[\u2013\u2014\-~]|到|至)\s*(?:\d{1,2}:\d{2}|\d+(?:\.\d+)?)/i.test(text(source));
    }

    function splitPureScriptSections(script){
        const source = text(script);
        if(!source) return [];
        const sections = [];
        const preamble = [];
        let current = null;
        source.split(/\n+/).forEach(rawLine => {
            const line = rawLine.trim();
            if(!line) return;
            const match = line.match(/((?:\d{1,2}:\d{2}|\d+(?:\.\d+)?)\s*(?:秒|s)?\s*(?:[\u2013\u2014\-~]|到|至)\s*(?:\d{1,2}:\d{2}|\d+(?:\.\d+)?)\s*(?:秒|s)?)/i);
            const range = match ? parseTimeRange(match[1]) : null;
            if(range){
                if(current) sections.push({...current, body:text(current.lines.join('\n'))});
                const afterRange = line.slice((match.index || 0) + match[0].length).replace(/^[\s：:｜|、，,。-]+/, '').trim();
                const beforeRange = line.slice(0, match.index || 0).replace(/[｜|\s]+$/g, '').trim();
                current = {
                    heading:[beforeRange, match[1]].filter(Boolean).join('｜'),
                    start:range.start,
                    end:range.end,
                    lines:[...preamble.splice(0), ...(afterRange ? [afterRange] : [])]
                };
            } else if(current){
                current.lines.push(line);
            } else {
                preamble.push(line);
            }
        });
        if(current) sections.push({...current, body:text(current.lines.join('\n'))});
        if(!sections.length) return [{heading:'0—15秒', start:0, end:15, body:source}];
        return sections.filter(section => section.body);
    }

    function splitLinesForShots(body){
        return text(body).split(/\n+/).map(line => line.trim()).filter(Boolean);
    }

    function chunkLines(lines, targetCount){
        const count = Math.max(1, Math.min(lines.length || 1, targetCount || 1));
        const chunks = [];
        const per = Math.ceil((lines.length || 1) / count);
        for(let i = 0; i < count; i++){
            const part = lines.slice(i * per, (i + 1) * per);
            if(part.length) chunks.push(part);
        }
        return chunks.length ? chunks : [lines];
    }

    function estimatedShotCount(section){
        const duration = Math.max(1, Number(section.end) - Number(section.start));
        const lines = splitLinesForShots(section.body);
        const dialogueCount = lines.filter(line => /：|:|“|”/.test(line)).length;
        const base = duration <= 18 ? 2 : duration <= 35 ? 3 : duration <= 55 ? 4 : 5;
        return Math.max(1, Math.min(6, base + (dialogueCount >= 8 ? 1 : 0)));
    }

    function shotStyleForChunk(chunk, index, total){
        const body = chunk.join('\n');
        const hasDialogue = /：|:|“|”/.test(body);
        const hasEmotion = /哭|眼眶|愣|慌|沉默|发抖|苦笑|哽咽|红了|难过|后悔/.test(body);
        const hasAction = /走|进|出|骑|追|转身|低头|抬头|握住|停下|撞上|送|拎|摔|搬|接单/.test(body);
        const hasObject = /婚纱|手机|外卖|电动车|橱窗|订单|门|电梯|饭桌|备忘录|玻璃/.test(body);
        const shotSize = hasEmotion ? (index === total - 1 ? '特写' : '近景') : hasDialogue ? '中近景' : hasAction ? '中景' : hasObject ? '特写' : '中景';
        const cameraType = hasDialogue
            ? (index % 2 ? '平视过肩反打，三分之二侧面' : '平视过肩正打，前景虚化')
            : hasAction ? '平视侧后方跟随，保留空间纵深' : '平视固定机位，轻微三分之二侧面';
        const cameraMove = hasAction ? '轻微手持跟随' : hasEmotion ? '缓慢推近' : '固定机位';
        const focalLength = shotSize.includes('特写') ? '85mm' : shotSize.includes('近景') ? '65mm' : '35mm';
        return {shotSize, cameraType, cameraMove, focalLength};
    }

    function inferPurpose(chunk, sectionTitle=''){
        const body = chunk.join(' ');
        if(/婚纱|橱窗|订单|手机|提示/.test(body)) return `交代${sectionTitle || '本段'}中的关键信息和物件线索`;
        if(/哭|眼眶|发抖|沉默|苦笑|哽咽|愣|慌/.test(body)) return '捕捉人物情绪转折和克制反应';
        if(/：|:|“|”/.test(body)) return '呈现关键对话并观察听者反应';
        if(/走|进|出|骑|追|转身|停下/.test(body)) return '完成动作调度并推动场面转换';
        return '交代剧情推进和人物关系';
    }

    function inferTransitionForChunk(chunk, index, total){
        const body = chunk.join(' ');
        if(index === total - 1) return '情绪停顿后切入下一段';
        if(/看|眼神|抬头|低头|愣/.test(body)) return '视线切';
        if(/说|：|:|“|”/.test(body)) return '正反打';
        if(/走|进|出|转身|停下/.test(body)) return '动作切';
        if(/手机|提示音|订单/.test(body)) return '提示音打断';
        return '节奏切';
    }

    function referenceAssetsForText(source){
        const s = text(source);
        const assets = [];
        const add = (type, name, note='') => {
            if(!name) return;
            const key = `${type}:${name}`;
            if(!assets.some(item => `${item.type}:${item.name}` === key)) assets.push({type, name, note});
        };
        ['阿野', '小满', '小满妈妈', '顾承安', '工作人员', '店员'].forEach(name => {
            if(s.includes(name)) add('character', name, `${name}人物资产图，正面/侧面/服装一致性`);
        });
        [
            ['酒店', '酒店门口/酒店宴会厅/电梯空间'],
            ['婚纱店', '婚纱店橱窗与玻璃倒影'],
            ['出租屋', '出租屋室内'],
            ['小满家饭桌', '小满家饭桌'],
            ['小区楼下', '小区楼下夜景'],
            ['街道', '城市街道/夜晚路灯']
        ].forEach(([key, name]) => { if(s.includes(key)) add('scene', name, '场景参考图'); });
        [
            ['婚纱', '小满婚纱参考图'],
            ['外卖服', '阿野外卖服参考图'],
            ['电动车', '电动车/外卖箱参考图'],
            ['外卖袋', '外卖袋道具参考图']
        ].forEach(([key, name]) => { if(s.includes(key)) add('prop', name, '服装或道具参考图'); });
        return assets;
    }

    function fallbackScriptBreakdown(script){
        const sections = splitPureScriptSections(script);
        const shots = [];
        sections.forEach(section => {
            const lines = splitLinesForShots(section.body);
            const chunks = chunkLines(lines, estimatedShotCount(section));
            const sectionTitle = section.heading.replace(/^\s*\d.*?\s+/, '').trim();
            chunks.forEach((chunk, localIndex) => {
                const start = section.start + (section.end - section.start) * (localIndex / chunks.length);
                const end = section.start + (section.end - section.start) * ((localIndex + 1) / chunks.length);
                const style = shotStyleForChunk(chunk, localIndex, chunks.length);
                const sourceText = chunk.join('\n');
                const shot = normalizeShot({
                    shotNumber:`镜头${String(shots.length + 1).padStart(2, '0')}`,
                    timeRange:`${formatTimecode(start)}—${formatTimecode(end)}`,
                    sourceText,
                    purpose:inferPurpose(chunk, sectionTitle),
                    transition:inferTransitionForChunk(chunk, localIndex, chunks.length),
                    audio:inferAudioText(sourceText),
                    shotSize:style.shotSize,
                    cameraType:style.cameraType,
                    focalLength:style.focalLength,
                    cameraMove:style.cameraMove,
                    referenceAssets:referenceAssetsForText(sourceText)
                }, shots.length);
                shots.push(shot);
            });
        });
        return shots;
    }

    function buildContinuityReport(shots){
        const list = Array.isArray(shots) ? shots : [];
        const items = [];
        list.forEach((shot, index) => {
            if(index === 0) return;
            const prev = list[index - 1] || {};
            const currentChars = new Set(text(shot.subjects).split(/[、,，\s]+/).filter(Boolean));
            const prevChars = new Set(text(prev.subjects).split(/[、,，\s]+/).filter(Boolean));
            const shared = [...currentChars].filter(name => prevChars.has(name));
            const warnings = [];
            if(shared.length && text(prev.visualExtract?.leftRight) && text(shot.visualExtract?.leftRight) && prev.visualExtract.leftRight !== shot.visualExtract.leftRight){
                warnings.push('人物左右位置可能变化，生成前确认是否为合理换轴或调度。');
            }
            if(shared.length && text(prev.visualExtract?.lightingComposition) && text(shot.visualExtract?.lightingComposition) && prev.visualExtract.lightingComposition !== shot.visualExtract.lightingComposition){
                warnings.push('光线/色调描述发生变化，注意连续性。');
            }
            if(shared.length && text(prev.cameraType) && text(shot.cameraType) && /过肩|反打|正打/.test(`${prev.cameraType}${shot.cameraType}`)){
                warnings.push('正反打镜头需保持轴线和视线方向一致。');
            }
            items.push({
                from:prev.shotNumber || `镜头${index}`,
                to:shot.shotNumber || `镜头${index + 1}`,
                sharedCharacters:shared,
                transition:text(prev.transition || shot.transition || '情绪/动作切'),
                risk:warnings.length ? '需要复核' : '正常',
                notes:warnings.length ? warnings : ['人物、场景和情绪推进可连续。']
            });
        });
        return {
            summary:items.some(item => item.risk === '需要复核') ? '存在少量连续性点需要人工复核。' : '镜头间连续性初步正常。',
            items
        };
    }

    function mergeReferenceAssets(script, shots){
        const all = [...referenceAssetsForText(script)];
        (shots || []).forEach(shot => {
            (shot.referenceAssets || referenceAssetsForText(shot.sourceText)).forEach(item => {
                if(!all.some(x => x.type === item.type && x.name === item.name)) all.push(item);
            });
        });
        return all;
    }

    window.ScriptToStoryboard = {
        DEFAULT_PROMPT,
        PURE_SCRIPT_PROMPT,
        STORY_SEGMENT_PROMPT,
        systemPrompt:'你是专业影视故事板设计师，只输出可解析 JSON。',
        extractJson,
        normalizeShots,
        normalizeStorySegment,
        fallbackSplit,
        fallbackStorySegment,
        fallbackScriptBreakdown,
        buildContinuityReport,
        mergeReferenceAssets,
        promptForMode,
        buildMessage,
        storyboardHeaderFields,
        visualFields,
        visualInfoText,
        visualExtractText,
        imagePromptDraft,
        videoPromptText,
        buildVideoPrompt,
        buildFramePrompt,
        buildWholeStoryboardPrompt,
        regenerateFrame
    };
})();

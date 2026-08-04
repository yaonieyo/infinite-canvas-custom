(function () {
    'use strict';
    const host = window.CanvasPluginHost;
    if (!host) {
        console.error('[poster-frame] CanvasPluginHost 不存在');
        return;
    }
    const runtime = {
        id: 'poster-frame',
        version: '2026.08.04.1',
        mode: 'core-adapter',
        ready: false
    };
    host.registerRuntime(runtime);

    host.registerNodeType('poster-frame', {
        pluginId: runtime.id,
        label: '画框',
        menuType: 'poster-frame',
        nodeTypes: ['smart-frame-batch', 'smart-frame'],
        create(point) {
            const core = host.getCoreApi?.();
            return core?.createPosterFrameBatchNode?.(
                Number(point?.x || 0) - 210,
                Number(point?.y || 0) - 280
            ) || null;
        }
    });
    host.registerNodeType('smart-frame', {
        pluginId: runtime.id,
        label: '产品海报提示词卡',
        renderedNode: true,
        runSettings: ['provider_id', 'model', 'ratio', 'resolution'],
        referenceImages: true
    });
    host.registerCapability('poster-frame', {
        pluginId: runtime.id,
        nodeType: 'poster-frame',
        outputNodeType: 'smart-frame',
        splitMode: 'ai'
    });

    runtime.ready = true;
    host.registerRuntime(runtime);
})();

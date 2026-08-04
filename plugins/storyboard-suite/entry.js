(function () {
    'use strict';
    const host = window.CanvasPluginHost;
    if (!host) {
        console.error('[storyboard-suite] CanvasPluginHost 不存在');
        return;
    }
    const runtime = {
        id: 'storyboard-suite',
        version: '2026.08.04.1',
        mode: 'legacy-bridge',
        ready: false
    };
    host.registerRuntime(runtime);
    host.loadScript('/static/js/smart-canvas-storyboard-extension.js', {
        id: 'storyboard-suite:legacy-extension',
        pluginId: 'storyboard-suite'
    }).catch(error => {
        console.error('[storyboard-suite] 兼容扩展加载失败', error);
    }).finally(() => {
        runtime.ready = true;
        host.registerRuntime(runtime);
    });
})();

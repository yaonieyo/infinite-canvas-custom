(function () {
    'use strict';
    const host = window.CanvasPluginHost;
    if (!host) {
        console.error('[doubao-video] CanvasPluginHost 不存在');
        return;
    }
    const runtime = {
        id: 'doubao-video',
        version: '2026.08.04.1',
        mode: 'provider-adapter',
        ready: false
    };
    host.registerRuntime(runtime);

    host.registerGenerationProvider('doubao-pool', {
        pluginId: runtime.id,
        providerIds: ['doubao-pool', 'doubao-video'],
        protocol: 'doubao-pool',
        endpoint: '/api/canvas-video',
        backendHandler: 'generate_doubao_pool_video',
        durationOptions: [5, 10],
        fixedDuration: true,
        supports: ['prompt', 'reference-images', 'watermark-removal-return']
    });
    host.registerGenerationProvider('doubao-video', {
        pluginId: runtime.id,
        aliasOf: 'doubao-pool',
        providerIds: ['doubao-video'],
        protocol: 'doubao-pool',
        durationOptions: [5, 10],
        fixedDuration: true
    });
    host.registerCapability('doubao-video', {
        pluginId: runtime.id,
        provider: 'doubao-pool',
        durationOptions: [5, 10],
        endpoint: '/api/canvas-video'
    });

    runtime.ready = true;
    host.registerRuntime(runtime);
})();

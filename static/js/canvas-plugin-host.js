/*
 * Lightweight host for independently loaded canvas extensions.
 * The host owns discovery, lifecycle events, and compatibility checks;
 * feature plugins should use this API instead of patching the core renderer.
 */
(function () {
    'use strict';

    const HOST_API_VERSION = '1.0';
    const listeners = new Map();
    const loadedScripts = new Map();
    const loadedStyles = new Map();
    const runtimePlugins = new Map();

    function on(eventName, listener) {
        if (typeof listener !== 'function') return () => {};
        const bucket = listeners.get(eventName) || new Set();
        bucket.add(listener);
        listeners.set(eventName, bucket);
        return () => bucket.delete(listener);
    }

    function emit(eventName, detail) {
        const bucket = listeners.get(eventName);
        if (!bucket) return;
        bucket.forEach(listener => {
            try { listener(detail); } catch (error) { console.error(`[CanvasPluginHost] ${eventName}`, error); }
        });
    }

    function loadScript(url, options = {}) {
        const key = String(options.id || url || '').trim();
        if (!key) return Promise.reject(new Error('插件脚本缺少 URL'));
        if (loadedScripts.has(key)) return loadedScripts.get(key);
        const promise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.async = false;
            script.dataset.canvasPlugin = options.pluginId || key;
            script.onload = () => resolve(script);
            script.onerror = () => reject(new Error(`插件脚本加载失败：${url}`));
            document.head.appendChild(script);
        });
        loadedScripts.set(key, promise);
        return promise;
    }

    function loadStyle(url, options = {}) {
        const key = String(options.id || url || '').trim();
        if (!key) return Promise.reject(new Error('插件样式缺少 URL'));
        if (loadedStyles.has(key)) return loadedStyles.get(key);
        const promise = new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = url;
            link.dataset.canvasPlugin = options.pluginId || key;
            link.onload = () => resolve(link);
            link.onerror = () => reject(new Error(`插件样式加载失败：${url}`));
            document.head.appendChild(link);
        });
        loadedStyles.set(key, promise);
        return promise;
    }

    function requestCanvasRender() {
        try {
            if (typeof window.render === 'function') window.render();
            window.refreshShotAssetCollectorCandidates?.();
        } catch (error) {
            console.warn('[CanvasPluginHost] 重新渲染失败', error);
        }
    }

    function waitForRuntimePlugin(pluginId, timeoutMs = 5000) {
        if (!pluginId) return Promise.resolve();
        const started = Date.now();
        return new Promise(resolve => {
            const check = () => {
                const runtime = runtimePlugins.get(pluginId);
                if (runtime?.ready === true || Date.now() - started >= timeoutMs) {
                    resolve(runtime || null);
                    return;
                }
                window.setTimeout(check, 20);
            };
            check();
        });
    }

    const host = {
        apiVersion: HOST_API_VERSION,
        plugins: new Map(),
        on,
        emit,
        loadScript,
        loadStyle,
        requestRender: requestCanvasRender,
        registerRuntime(plugin) {
            if (!plugin || !plugin.id) return false;
            runtimePlugins.set(String(plugin.id), plugin);
            emit('plugin:registered', plugin);
            return true;
        },
        getPlugin(pluginId) {
            return host.plugins.get(String(pluginId || '')) || runtimePlugins.get(String(pluginId || '')) || null;
        },
        async loadPlugin(record) {
            if (!record || record.status !== 'ready' || record.enabled !== true) return false;
            const pluginId = String(record.id || '').trim();
            if (!pluginId || !record.entry_url) return false;
            emit('plugin:loading', record);
            try {
                for (const [index, styleUrl] of (record.style_urls || []).entries()) {
                    await loadStyle(styleUrl, { id: `${pluginId}:style:${index}`, pluginId });
                }
                await loadScript(record.entry_url, { id: `${pluginId}:entry`, pluginId });
                if (record.wait_for_runtime) await waitForRuntimePlugin(pluginId);
                host.plugins.set(pluginId, { ...record, loaded: true });
                emit('plugin:loaded', host.plugins.get(pluginId));
                return true;
            } catch (error) {
                const failed = { ...record, loaded: false, load_error: String(error?.message || error) };
                host.plugins.set(pluginId, failed);
                emit('plugin:error', failed);
                console.error(`[CanvasPluginHost] ${pluginId}`, error);
                return false;
            }
        },
        async boot() {
            if (host.ready) return host.ready;
            host.ready = (async () => {
                let payload;
                try {
                    const response = await fetch('/api/canvas-plugins', { cache: 'no-store' });
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    payload = await response.json();
                } catch (error) {
                    console.warn('[CanvasPluginHost] 插件清单不可用，使用兼容回退', error);
                    // 旧版本或静态文件部署没有插件 API 时，保留故事板扩展入口。
                    await loadScript('/static/js/smart-canvas-storyboard-extension.js', {
                        id: 'legacy-storyboard-extension',
                        pluginId: 'storyboard-suite'
                    });
                    requestCanvasRender();
                    emit('host:ready', { fallback: true, error });
                    return { fallback: true, plugins: [] };
                }
                const records = Array.isArray(payload?.plugins) ? payload.plugins : [];
                host.manifest = payload;
                for (const record of records) await host.loadPlugin(record);
                requestCanvasRender();
                emit('host:ready', payload);
                return payload;
            })();
            return host.ready;
        }
    };

    window.CanvasPluginHost = host;
    // 给后续插件一个短名称，同时保留旧代码不受影响。
    window.canvasPlugins = host;
    host.boot();
})();

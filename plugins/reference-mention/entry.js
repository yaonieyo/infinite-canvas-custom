(function () {
    'use strict';
    const host = window.CanvasPluginHost;
    if (!host) {
        console.error('[reference-mention] CanvasPluginHost 不存在');
        return;
    }
    const runtime = {
        id: 'reference-mention',
        version: '2026.08.04.1',
        mode: 'editor-adapter',
        ready: false
    };
    host.registerRuntime(runtime);

    const mentionNodeTypes = new Set([
        'smart-prompt',
        'smart-frame',
        'image-prompt-card',
        'storyboard-card'
    ]);
    host.registerPromptEditorExtension('reference-mentions', {
        pluginId: runtime.id,
        nodeTypes: [...mentionNodeTypes],
        matches(node) {
            return Boolean(node && mentionNodeTypes.has(String(node.type || '')));
        },
        bind(element, node) {
            const controller = host.getCoreApi?.()?.mentionController;
            if (!element || !node || !controller) return false;
            const activate = () => controller.activate(element);
            element.addEventListener('focus', () => { activate(); controller.saveRange(); });
            element.addEventListener('mouseup', () => { activate(); controller.saveRange(); });
            element.addEventListener('keyup', () => { activate(); controller.maybeOpenPicker(); });
            element.addEventListener('input', () => {
                activate();
                controller.setUndoArmed(false);
                controller.maybeOpenPicker();
            });
            element.addEventListener('keydown', event => {
                activate();
                const key = String(event.key || '').toLowerCase();
                if ((event.ctrlKey || event.metaKey) && key === 'z' && controller.isUndoArmed() && controller.canUndo()) {
                    event.preventDefault();
                    controller.setUndoArmed(false);
                    controller.undo();
                    if (node.type === 'smart-prompt') {
                        setTimeout(() => {
                            controller.selectNode(node.id);
                            controller.updateComposer();
                        }, 0);
                    }
                    return;
                }
                if (event.key === 'Escape') controller.closePicker();
            });
            element.dataset.referenceMentionPlugin = runtime.id;
            return true;
        }
    });
    host.registerCapability('reference-mentions', {
        pluginId: runtime.id,
        binding: 'assetId + name',
        nodeTypes: [...mentionNodeTypes]
    });

    runtime.ready = true;
    host.registerRuntime(runtime);
})();

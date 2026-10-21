// DnDForged Canvas Render Scheduler
// Coalesces multiple synchronous render requests into a single requestAnimationFrame callback

export function createRenderScheduler(renderFn) {
    let rafId = null;
    let isScheduled = false;

    function requestRender() {
        if (isScheduled) return;
        isScheduled = true;
        rafId = requestAnimationFrame(() => {
            isScheduled = false;
            rafId = null;
            renderFn();
        });
    }

    function renderImmediate() {
        if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
            isScheduled = false;
        }
        renderFn();
    }

    function cancelPendingRender() {
        if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
            isScheduled = false;
        }
    }

    return {
        requestRender,
        renderImmediate,
        cancelPendingRender,
        isScheduled: () => isScheduled
    };
}

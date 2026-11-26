/**
 * vtt-modals.js
 * Universal modal dismissal, form dirty-checking, backdrop click handlers,
 * tiered Escape key stack, and sidebar tab navigation for ForgeDVTT.
 */

export function setupSidebarTabs() {
    if (typeof document === 'undefined') return;
    const sidebar = document.getElementById('vtt-sidebar');
    const tabs = document.querySelectorAll('.tab-header');
    tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            if (!target) return;
            const targetPanel = document.getElementById(target);
            const isAlreadyActive = tab.classList.contains('active');

            if (isAlreadyActive) {
                // Explicit toggle close when active panel button is clicked again
                tab.classList.remove('active');
                if (targetPanel) targetPanel.classList.remove('active');
                if (sidebar) sidebar.classList.remove('panel-open');
                return;
            }

            // Deactivate all
            tabs.forEach((t) => t.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));

            // Activate current and open flyout drawer
            tab.classList.add('active');
            if (targetPanel) {
                targetPanel.classList.add('active');
            }
            if (sidebar) {
                sidebar.classList.add('panel-open');
            }

            // Auto-scroll chat to latest messages on open
            if (target === 'tab-chat') {
                const msgList = document.getElementById('chat-messages');
                if (msgList) {
                    requestAnimationFrame(() => {
                        msgList.scrollTop = msgList.scrollHeight;
                    });
                }
            }
        });
    });
}

export function getFormValuesSnapshot(container) {
    if (!container || typeof container.querySelectorAll !== 'function') return '';
    const fields = Array.from(
        container.querySelectorAll(
            'input:not([type="button"]):not([type="submit"]):not([type="reset"]), select, textarea'
        )
    );
    return JSON.stringify(
        fields.map((el) => {
            if (el.type === 'checkbox' || el.type === 'radio') return el.checked;
            return el.value;
        })
    );
}

export function tryDismissModal(modalEl) {
    if (!modalEl || (modalEl.classList && modalEl.classList.contains('vtt-hidden'))) return false;

    // Check for unsaved changes
    if (modalEl._initialModalSnapshot !== undefined) {
        const currentSnapshot = getFormValuesSnapshot(modalEl);
        if (currentSnapshot !== modalEl._initialModalSnapshot) {
            if (typeof confirm === 'function' && !confirm('Discard unsaved changes?')) {
                return false;
            }
        }
    }

    // Attempt clicking a standard cancel/close button if present
    const closeBtn = modalEl.querySelector
        ? modalEl.querySelector(
              '#btn-modal-cancel, #btn-map-modal-cancel, #btn-push-players-cancel, #btn-handout-cancel, #btn-view-handout-close, #btn-edit-map-cancel, #btn-edit-map-close-icon, #btn-token-edit-cancel, #btn-close-bestiary-filter, #btn-cancel-gm-password, #modal-cat-cancel, #modal-cat-close, #modal-macro-cancel, #modal-macro-close-btn, #modal-ability-cancel, #btn-import-cat-cancel, #cs-upcast-prompt-cancel, #upcast-prompt-cancel, #delete-prompt-cancel, .btn-close-modal, .vtt-modal-close'
          )
        : null;

    if (closeBtn && typeof closeBtn.click === 'function') {
        closeBtn.click();
    } else if (modalEl.classList && typeof modalEl.classList.add === 'function') {
        modalEl.classList.add('vtt-hidden');
    }

    modalEl._initialModalSnapshot = undefined;
    return true;
}

export function setupUniversalModalDismissal() {
    if (typeof document === 'undefined') return;

    // MutationObserver to automatically record form snapshots when any modal becomes visible
    if (typeof MutationObserver !== 'undefined' && document.body) {
        const modalObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (
                    mutation.type === 'attributes' &&
                    (mutation.attributeName === 'class' || mutation.attributeName === 'style')
                ) {
                    const target = mutation.target;
                    if (
                        target &&
                        target.classList &&
                        (target.classList.contains('vtt-modal') ||
                            target.classList.contains('vtt-overlay-panel') ||
                            target.classList.contains('vtt-sheet-submodal'))
                    ) {
                        const isVisible = !target.classList.contains('vtt-hidden') && target.style.display !== 'none';
                        if (isVisible && target._initialModalSnapshot === undefined) {
                            setTimeout(() => {
                                if (!target.classList.contains('vtt-hidden') && target.style.display !== 'none') {
                                    target._initialModalSnapshot = getFormValuesSnapshot(target);
                                }
                            }, 50);
                        } else if (!isVisible) {
                            target._initialModalSnapshot = undefined;
                        }
                    }
                }
            }
        });
        modalObserver.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['class', 'style'] });
    }

    // Backdrop click handler for desktop & mobile
    document.addEventListener('click', (e) => {
        // 1. Direct click on .vtt-modal backdrop
        if (e.target.classList && e.target.classList.contains('vtt-modal')) {
            tryDismissModal(e.target);
            return;
        }

        // 2. Direct click on .vtt-overlay-panel backdrop (excluding #login-overlay)
        if (e.target.classList && e.target.classList.contains('vtt-overlay-panel') && e.target.id !== 'login-overlay') {
            tryDismissModal(e.target);
            return;
        }

        // 3. Direct click on .vtt-sheet-submodal-overlay
        if (e.target.classList && e.target.classList.contains('vtt-sheet-submodal-overlay')) {
            const overlayId = e.target.id || '';
            let modalId = overlayId.replace('-overlay', '-modal');
            if (overlayId === 'modal-cs-upcast-overlay') modalId = 'modal-cs-upcast-prompt';
            let submodal = document.getElementById(modalId);
            if (
                !submodal &&
                e.target.nextElementSibling &&
                e.target.nextElementSibling.classList &&
                e.target.nextElementSibling.classList.contains('vtt-sheet-submodal')
            ) {
                submodal = e.target.nextElementSibling;
            }
            if (!submodal) {
                submodal = document.querySelector('.vtt-sheet-submodal:not(.vtt-hidden)');
            }
            if (submodal) {
                if (tryDismissModal(submodal)) {
                    e.target.classList.add('vtt-hidden');
                }
            } else {
                e.target.classList.add('vtt-hidden');
            }
            return;
        }
    });

    // Universal Escape Key handler
    if (typeof window !== 'undefined') {
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' || e.keyCode === 27) {
                // 1. High priority submodals
                const highSubmodals = Array.from(
                    document.querySelectorAll('.vtt-sheet-submodal-high:not(.vtt-hidden)')
                );
                if (highSubmodals.length > 0) {
                    const topModal = highSubmodals[highSubmodals.length - 1];
                    if (tryDismissModal(topModal)) {
                        const overlay = document.querySelector(
                            '.vtt-sheet-submodal-overlay.vtt-sheet-submodal-high:not(.vtt-hidden)'
                        );
                        if (overlay) overlay.classList.add('vtt-hidden');
                    }
                    e.stopPropagation();
                    return;
                }

                // 2. Standard submodals
                const standardSubmodals = Array.from(document.querySelectorAll('.vtt-sheet-submodal:not(.vtt-hidden)'));
                if (standardSubmodals.length > 0) {
                    const topModal = standardSubmodals[standardSubmodals.length - 1];
                    if (tryDismissModal(topModal)) {
                        const overlay = document.querySelector('.vtt-sheet-submodal-overlay:not(.vtt-hidden)');
                        if (overlay) overlay.classList.add('vtt-hidden');
                    }
                    e.stopPropagation();
                    return;
                }

                // 3. Modals (.vtt-modal:not(.vtt-hidden))
                const openModals = Array.from(document.querySelectorAll('.vtt-modal:not(.vtt-hidden)'));
                if (openModals.length > 0) {
                    const topModal = openModals[openModals.length - 1];
                    if (tryDismissModal(topModal)) {
                        e.stopPropagation();
                    }
                    return;
                }

                // 4. Overlay panels (.vtt-overlay-panel:not(.vtt-hidden):not(#login-overlay))
                const openOverlayPanels = Array.from(
                    document.querySelectorAll('.vtt-overlay-panel:not(.vtt-hidden)')
                ).filter((p) => p.id !== 'login-overlay');
                if (openOverlayPanels.length > 0) {
                    const topModal = openOverlayPanels[openOverlayPanels.length - 1];
                    if (tryDismissModal(topModal)) {
                        e.stopPropagation();
                    }
                    return;
                }

                // 5. Floating tool panels (.floating-tool-panel:not(.vtt-hidden))
                const openFloatingPanels = Array.from(
                    document.querySelectorAll('.floating-tool-panel:not(.vtt-hidden)')
                );
                if (openFloatingPanels.length > 0) {
                    openFloatingPanels.forEach((p) => p.classList.add('vtt-hidden'));
                    e.stopPropagation();
                    return;
                }
            }
        });

        // Delegated CSP-safe click handlers for declarative modal/toggle/select attributes
        document.addEventListener('click', (e) => {
            const target = e.target;
            if (!(target instanceof Element)) return;

            const closeBtn = target.closest('[data-modal-close]');
            if (closeBtn) {
                const modalId = closeBtn.getAttribute('data-modal-close');
                if (modalId) document.getElementById(modalId)?.classList.add('vtt-hidden');
            }

            const openBtn = target.closest('[data-modal-open]');
            if (openBtn) {
                const modalId = openBtn.getAttribute('data-modal-open');
                if (modalId) document.getElementById(modalId)?.classList.remove('vtt-hidden');
            }

            const toggleBtn = target.closest('[data-toggle-target]');
            if (toggleBtn) {
                const targetId = toggleBtn.getAttribute('data-toggle-target');
                if (targetId) document.getElementById(targetId)?.classList.toggle('vtt-hidden');
            }

            const selectEl = target.closest('[data-select-on-click="true"]');
            if (selectEl && typeof selectEl.select === 'function') {
                selectEl.select();
            }

            const actionBtn = target.closest('[data-action="add-allowlist-user"]');
            if (actionBtn && typeof window.addAllowlistUser === 'function') {
                window.addAllowlistUser();
            }
        });
    }
}

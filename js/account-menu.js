(function () {
    const trigger = document.getElementById('account-trigger'),
        dropdown = document.getElementById('account-dropdown'),
        logout = document.getElementById('logout-trigger'),
        overlay = document.getElementById('logout-overlay'),
        cancel = document.getElementById('logout-cancel'),
        confirm = document.getElementById('logout-confirm');

    if (!trigger || !dropdown || !overlay) return;

    let previousFocus = null;

    function closeMenu() {
        dropdown.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
    }

    trigger.addEventListener('click', () => {
        const open = dropdown.hidden;
        dropdown.hidden = !open;
        trigger.setAttribute('aria-expanded', String(open));
    });

    document.addEventListener('click', e => {
        if (!e.target.closest('.account-menu')) closeMenu();
    });

    function closeDialog() {
        overlay.hidden = true;
        (previousFocus || trigger).focus();
    }

    logout.addEventListener('click', () => {
        previousFocus = trigger;
        closeMenu();
        overlay.hidden = false;
        cancel.focus();
    });

    cancel.addEventListener('click', closeDialog);

    overlay.addEventListener('click', e => {
        if (e.target === overlay) closeDialog();
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            if (!overlay.hidden) closeDialog();
            else closeMenu();
        }

        if (e.key === 'Tab' && !overlay.hidden) {
            const els = [cancel, confirm];

            if (e.shiftKey && document.activeElement === els[0]) {
                e.preventDefault();
                els[1].focus();
            } else if (!e.shiftKey && document.activeElement === els[1]) {
                e.preventDefault();
                els[0].focus();
            }
        }
    });

    confirm.addEventListener('click', () => {
        sessionStorage.removeItem('saltLoggedIn');
        window.location.href = 'index.html';
    });
})();
(function () {
    const form = document.getElementById('profile-form');
    const ids = ['name', 'role', 'email', 'phone'];
    const note = document.getElementById('save-note');

    function render() {
        const p = getSaltProfile();

        ids.forEach(k => {
            document.getElementById('profile-' + k).value = p[k];
        });

        document.getElementById('hero-name').textContent = p.name;
        document.getElementById('hero-role').textContent = p.role;
        document.getElementById('summary-role').textContent = p.role;

        document.getElementById('hero-initials').textContent = p.name.trim()
            .split(/\s+/)
            .slice(0, 2)
            .map(x => x[0] || '')
            .join('')
            .toUpperCase() || 'K';

        updateSaltProfileUI();
    }

    form.addEventListener('submit', e => {
        e.preventDefault();

        if (!form.reportValidity()) return;

        const p = {};

        ids.forEach(k => {
            p[k] = document.getElementById('profile-' + k).value.trim();
        });

        if (!p.name || !p.role) return;

        try {
            localStorage.setItem('saltProfile', JSON.stringify(p));

            render();

            note.textContent = 'Your profile has been saved on this browser.';

            if (typeof showToast === 'function') {
                showToast('Profile updated successfully');
            }
        } catch (e) {
            note.textContent = 'Unable to save changes in this browser.';
        }
    });

    document.getElementById('cancel-profile').addEventListener('click', () => {
        render();
        note.textContent = '';
    });

    render();
})();
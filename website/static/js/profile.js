(function () {
    const form = document.getElementById('profile-form');
    const note = document.getElementById('save-note');
    let current = null;

    function render(p) {
        current = p;
        document.getElementById('profile-name').value = p.name;
        document.getElementById('profile-role').value = p.role;
        document.getElementById('hero-name').textContent = p.name;
        document.getElementById('hero-role').textContent = p.role;
        document.getElementById('summary-role').textContent = p.role;
        document.getElementById('hero-initials').textContent = saltInitials(p.name);
        updateSaltProfileUI(p);
    }

    form.addEventListener('submit', async e => {
        e.preventDefault();
        if (!form.reportValidity()) return;

        const name = document.getElementById('profile-name').value.trim();

        try {
            const res = await fetch('/api/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Save failed.');

            render({ name: data.name, role: current.role });
            note.textContent = 'Your profile has been saved.';
            if (typeof showToast === 'function') showToast('Profile updated successfully');
        } catch (err) {
            note.textContent = err.message;
        }
    });

    document.getElementById('cancel-profile').addEventListener('click', () => {
        if (current) render(current);
        note.textContent = '';
    });

    getSaltProfile().then(render).catch(() => {
        note.textContent = 'Could not load your profile.';
    });
})();
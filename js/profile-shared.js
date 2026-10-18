(function () {
    const defaults = {
        name: 'Kurt',
        role: 'Sales manager',
        email: '',
        phone: ''
    };

    window.getSaltProfile = function () {
        try {
            const value = JSON.parse(localStorage.getItem('saltProfile') || '{}');

            return {
                ...defaults,
                ...Object.fromEntries(
                    Object.entries(value).filter(
                        ([k, v]) => k in defaults && typeof v === 'string'
                    )
                )
            };
        } catch (e) {
            return { ...defaults };
        }
    };

    window.updateSaltProfileUI = function () {
        const p = window.getSaltProfile();

        const initials = p.name.trim()
            .split(/\s+/)
            .slice(0, 2)
            .map(n => n[0] || '')
            .join('')
            .toUpperCase() || 'K';

        document.querySelectorAll('[data-profile-name]').forEach(el => {
            el.textContent = p.name;
        });

        document.querySelectorAll('[data-profile-role]').forEach(el => {
            el.textContent = p.role;
        });

        document.querySelectorAll('[data-profile-initials]').forEach(el => {
            el.textContent = initials;
        });
    };

    window.updateSaltProfileUI();
})();
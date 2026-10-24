(function () {
    window.SALT_ROLES = ['Owner', 'Sales manager'];

    window.saltInitials = function (name) {
        return name.trim().split(/\s+/).slice(0, 2)
            .map(n => n[0] || '').join('').toUpperCase() || '?';
    };

    window.getSaltProfile = async function () {
        const res = await fetch('/api/profile');
        if (!res.ok) throw new Error('Could not load profile.');
        return res.json();
    };

    window.updateSaltProfileUI = function (p) {
        document.querySelectorAll('[data-profile-name]').forEach(el => el.textContent = p.name);
        document.querySelectorAll('[data-profile-role]').forEach(el => el.textContent = p.role);
        document.querySelectorAll('[data-profile-initials]').forEach(el => el.textContent = saltInitials(p.name));
    };

    getSaltProfile().then(updateSaltProfileUI).catch(() => {});
})();
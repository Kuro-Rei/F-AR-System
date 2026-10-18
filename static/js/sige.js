function showToast(message) {
    let toast = document.querySelector('.toast');

    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add('show');

    clearTimeout(toast.timer);

    toast.timer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function addLog(action, details) {
    try {
        const logs = JSON.parse(localStorage.getItem('saltLogs') || '[]');

        logs.unshift({
            time: new Date().toISOString(),
            user: 'Kurt',
            action: action,
            details: details
        });

        localStorage.setItem('saltLogs', JSON.stringify(logs));
    } catch (e) {}
}
const body = document.getElementById('log-body');
const search = document.getElementById('log-search');
const chips = document.querySelectorAll('.chip');
const foot = document.getElementById('log-foot');
const pager = document.getElementById('pager');

const PAGE_SIZE = 5;

const tagColors = {
    'Login': 'blue',
    'Archive': 'red',
    'Restore': 'green',
    'Imported excel': 'violet'
};

const actionLabels = {
    'LOGIN': 'Login',
    'ARCHIVE': 'Archive',
    'ARCHIVED': 'Archive',
    'DELETE': 'Archive',
    'RESTORE': 'Restore',
    'IMPORT': 'Imported excel',
    'IMPORTED EXCEL': 'Imported excel'
};

let filter = 'all';
let query = '';
let page = 1;
let loadError = '';

function formatTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';

    const dateText = date.toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric'
    });

    const timeText = date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
    });

    return dateText + ' · ' + timeText;
}

function displayAction(value) {
    const rawAction = String(value || '').trim();
    return actionLabels[rawAction.toUpperCase()] || rawAction || 'Unknown';
}

// Normalises wording so every log reads "Archive", "Archived" and "Restored".
function displayDetails(value) {
    return String(value)
        .replace(/\bmoved\s+(.+?)\s+to\s+(?:the\s+)?trash\b/gi, 'Archived $1')
        .replace(/\b(from|to|in)\s+(?:the\s+)?trash\b/gi, '$1 Archive')
        .replace(/\btrash\b/gi, 'Archive')
        .replace(/\bdeleted\b/gi, 'Archived')
        .replace(/\bdelete\b/gi, 'Archive');
}

function createCell(row, text, className = '') {
    const cell = document.createElement('td');
    if (className) cell.className = className;
    cell.textContent = text;
    row.appendChild(cell);
    return cell;
}

function createLogRow(log) {
    const row = document.createElement('tr');
    row.dataset.logId = log.log_id;

    createCell(row, formatTime(log.logged_at), 'muted');
    createCell(
        row,
        log.full_name || log.username || ('User #' + log.user_id)
    );

    const action = displayAction(log.action);
    const actionCell = createCell(row, '');
    const tag = document.createElement('span');
    tag.className = 'tag tag-' + (tagColors[action] || 'blue');
    tag.textContent = action;
    actionCell.appendChild(tag);

    const details = log.details ||
        (log.booking_id ? 'Booking #' + log.booking_id : '—');
    createCell(row, displayDetails(details));

    return row;
}

function render() {
    const all = [...body.querySelectorAll('tr[data-log-id]')];

    const matches = all.filter(row => {
        const action = row.querySelector('.tag').textContent.toLowerCase();
        const okFilter = filter === 'all' || action === filter;
        const okSearch = row.textContent.toLowerCase().includes(query);
        return okFilter && okSearch;
    });

    const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
    page = Math.min(page, pages);

    const start = (page - 1) * PAGE_SIZE;
    const shown = matches.slice(start, start + PAGE_SIZE);

    all.forEach(row => {
        row.hidden = !shown.includes(row);
    });

    let empty = body.querySelector('.no-results');
    if (!matches.length) {
        if (!empty) {
            empty = document.createElement('tr');
            empty.className = 'no-results';
            const cell = document.createElement('td');
            cell.colSpan = 4;
            empty.appendChild(cell);
            body.appendChild(empty);
        }

        empty.querySelector('td').textContent = loadError ||
            (all.length ? 'No logs match your search.' : 'No activity logs yet.');
    } else if (empty) {
        empty.remove();
    }

    foot.textContent = matches.length
        ? 'Showing ' + (start + 1) + '–' + (start + shown.length) +
            ' of ' + matches.length + ' logs'
        : 'Showing 0 logs';

    buildPager(pages);
}

function buildPager(pages) {
    pager.innerHTML = '';

    const add = (label, target, active) => {
        const link = document.createElement('a');
        link.href = '#';
        link.textContent = label;

        if (active) link.className = 'active';

        link.addEventListener('click', event => {
            event.preventDefault();
            page = Math.min(Math.max(1, target), pages);
            render();
        });

        pager.appendChild(link);
    };

    add('‹', page - 1);
    for (let index = 1; index <= pages; index++) {
        add(index, index, index === page);
    }
    add('›', page + 1);
}

async function loadLogs() {
    try {
        const response = await fetch('/api/logs');
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Could not load activity logs.');
        }

        const rows = document.createDocumentFragment();
        data.rows.forEach(log => rows.appendChild(createLogRow(log)));
        body.replaceChildren(rows);
        loadError = '';
    } catch (error) {
        body.replaceChildren();
        loadError = error.message || 'Could not load activity logs. Please try again.';
        console.error('Could not load activity logs:', error);
    }

    page = 1;
    render();
}

chips.forEach(chip => {
    chip.addEventListener('click', () => {
        chips.forEach(item => item.classList.remove('active'));
        chip.classList.add('active');

        filter = chip.dataset.filter;
        page = 1;
        render();
    });
});

search.addEventListener('input', () => {
    query = search.value.trim().toLowerCase();
    page = 1;
    render();
});

loadLogs();

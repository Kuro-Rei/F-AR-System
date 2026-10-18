const body = document.getElementById('log-body');
const search = document.getElementById('log-search');
const chips = document.querySelectorAll('.chip');
const foot = document.getElementById('log-foot');
const pager = document.getElementById('pager');

const PAGE_SIZE = 5;

const tagColors = {
    'Login': 'blue',
    'Delete': 'red',
    'Restore': 'green',
    'Imported excel': 'violet'
};

let filter = 'all';
let query = '';
let page = 1;

function formatTime(iso) {
    const d = new Date(iso);

    const date = d.toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric'
    });

    const time = d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
    });

    return date + ' · ' + time;
}

function loadSavedLogs() {
    let saved = [];

    try {
        saved = JSON.parse(localStorage.getItem('saltLogs') || '[]');
    } catch (e) {}

    saved.reverse().forEach(log => {
        const tr = document.createElement('tr');
        const cells = [formatTime(log.time), log.user, null, log.details];

        cells.forEach((text, i) => {
            const td = document.createElement('td');

            if (i === 0) td.className = 'muted';

            if (i === 2) {
                const tag = document.createElement('span');

                tag.className = 'tag tag-' + (tagColors[log.action] || 'blue');
                tag.textContent = log.action;

                td.appendChild(tag);
            } else {
                td.textContent = text;
            }

            tr.appendChild(td);
        });

        body.prepend(tr);
    });
}

function render() {
    const all = [...body.querySelectorAll('tr:not(.no-results)')];

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
            empty.innerHTML = '<td colspan="4">No logs match your search.</td>';

            body.appendChild(empty);
        }
    } else if (empty) {
        empty.remove();
    }

    foot.textContent = matches.length
        ? 'Showing ' + (start + 1) + '–' + (start + shown.length) + ' of ' + matches.length + ' logs'
        : 'Showing 0 logs';

    buildPager(pages);
}

function buildPager(pages) {
    pager.innerHTML = '';

    const add = (label, target, active) => {
        const a = document.createElement('a');

        a.href = '#';
        a.textContent = label;

        if (active) a.className = 'active';

        a.addEventListener('click', e => {
            e.preventDefault();

            page = Math.min(Math.max(1, target), pages);

            render();
        });

        pager.appendChild(a);
    };

    add('‹', page - 1);

    for (let i = 1; i <= pages; i++) {
        add(i, i, i === page);
    }

    add('›', page + 1);
}

chips.forEach(chip => {
    chip.addEventListener('click', () => {
        chips.forEach(c => c.classList.remove('active'));

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

loadSavedLogs();
render();
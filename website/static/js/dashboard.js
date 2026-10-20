const ledgerBody = document.getElementById('ledger-body');
const ledgerSearch = document.getElementById('ledger-search');
const selectAll = document.getElementById('select-all');
const ledgerFoot = document.getElementById('ledger-foot');
const ledgerPager = document.getElementById('ledger-pager');
const importBtn = document.getElementById('import-btn');
const importFile = document.getElementById('import-file');

let totalRecords = 0;
let currentPage = 1;

const ledgerRows = () => [...ledgerBody.querySelectorAll('tr')];

function updateFooter() {
    const visible = ledgerRows().filter(r => !r.hidden && r.querySelector('input')).length;
    ledgerFoot.textContent = 'Showing ' + visible + ' of ' + totalRecords.toLocaleString() + ' records';
}

// helper to show data
const esc = s => String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const fmtDate = d => new Date(d + 'T12:00:00').toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric'
});

const fmtNum = n => n === null ? '—' : n.toLocaleString('en-PH', { maximumFractionDigits: 2 });

const fmtMoney = n => n === null ? '—' : '₱' + n.toLocaleString('en-PH', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
});

function rowHtml(r) {
    const volume = (r.count !== null && r.size !== null) ? r.count * r.size : null;

    return `
        <tr>
            <td><input type="checkbox" aria-label="Select record ${r.id}" /></td>
            <td class="muted">${fmtDate(r.date)}</td>
            <td><strong>${esc(r.location)}</strong></td>
            <td>${r.count === null ? '—' : r.count}</td>
            <td>${fmtNum(r.size)}</td>
            <td>${fmtNum(volume)}</td>
            <td>${fmtMoney(r.price)}</td>
            <td class="num">
                <button class="icon-btn" data-booking-id="${r.id}" aria-label="Delete record ${r.id}">
                    <i class="i fa-solid fa-trash-can"></i><span>Delete</span>
                </button>
            </td>
        </tr>`;
}

function buildPager(pages) {
    const items = [];
    const add = (label, page, active) =>
        items.push(`<a href="#" data-page="${page}"${active ? ' class="active"' : ''}>${label}</a>`);

    add('‹', Math.max(1, currentPage - 1));

    for (let p = 1; p <= pages; p++) {
        if (p === 1 || p === pages || Math.abs(p - currentPage) <= 1) {
            add(p, p, p === currentPage);
        } else if (Math.abs(p - currentPage) === 2) {
            add('…', p);
        }
    }

    add('›', Math.min(pages, currentPage + 1));
    ledgerPager.innerHTML = items.join('');
}

// load records
async function loadRecords() {
    const q = ledgerSearch.value.trim();

    try {
        const res = await fetch('/api/records?page=' + currentPage + '&q=' + encodeURIComponent(q));
        const data = await res.json();

        ledgerBody.innerHTML = data.rows.length
            ? data.rows.map(rowHtml).join('')
            : '<tr><td colspan="8" class="muted">No records found.</td></tr>';

        totalRecords = data.total;
        selectAll.checked = false;
        updateFooter();
        buildPager(data.pages);
    } catch (err) {
        console.log('Could not load records:', err);
    }
}

ledgerPager.addEventListener('click', e => {
    const link = e.target.closest('a');
    if (!link) return;

    e.preventDefault();
    currentPage = Number(link.dataset.page);
    loadRecords();
});

ledgerSearch.addEventListener('input', () => {
    currentPage = 1;
    loadRecords();
});

selectAll.addEventListener('change', () => {
    ledgerRows().filter(r => !r.hidden).forEach(r => {
        const box = r.querySelector('input[type="checkbox"]');
        if (box) box.checked = selectAll.checked;
    });
});

// delete
ledgerBody.addEventListener('click', async e => {
    const btn = e.target.closest('.icon-btn');

    if (!btn || btn.disabled) return;

    const row = btn.closest('tr');
    const name = row.querySelector('strong').textContent;
    const bookingId = btn.dataset.bookingId;

    if (!bookingId) {
        showToast('Could not identify this booking. Please refresh and try again.');
        return;
    }

    if (!confirm('Move ' + name + ' to trash?')) return;

    btn.disabled = true;

    try {
        const res = await fetch(
            '/api/records/' + encodeURIComponent(bookingId) + '/trash',
            { method: 'POST' }
        );
        let data = {};
        try {
            data = await res.json();
        } catch (parseError) {
            // A non-JSON server response is handled below using the HTTP status.
        }

        if (!res.ok) {
            throw new Error(data.error || 'Could not move this booking to Trash.');
        }

        row.remove();
        totalRecords = Math.max(0, totalRecords - 1);
        updateFooter();

        if (currentPage > 1 && !ledgerRows().some(r => r.querySelector('input[type="checkbox"]'))) {
            currentPage--;
        }

        addLog('Delete', 'Moved ' + name + ' to trash');
        showToast(name + ' moved to trash');

        await loadRecords();
        if (typeof window.reloadDashboard === 'function') {
            try {
                await window.reloadDashboard();
            } catch (refreshError) {
                console.error('Could not refresh dashboard charts:', refreshError);
                showToast('Record moved to Trash, but the dashboard could not refresh.');
            }
        }
    } catch (err) {
        btn.disabled = false;
        showToast(err.message || 'Could not move this booking to Trash. Please try again.');
    }
});


// import
importBtn.addEventListener('click', () => importFile.click());

importFile.addEventListener('change', async () => {
    const file = importFile.files[0];
    if (!file) return;

    if (!confirm('Importing "' + file.name + '" will replace ALL existing records, including Trash. Continue?')) {
        importFile.value = '';
        return;
    }

    const form = new FormData();
    form.append('file', file);

    try {
        const res = await fetch('/import', { method: 'POST', body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Import failed');

        addLog('Imported excel', 'Replaced all records with ' + file.name);
        showToast('Imported ' + data.imported + ' rows from ' + file.name);

        ledgerSearch.value = '';  // clear old search
        await window.reloadDashboard(); // KPIs and charts
        currentPage = 1;
        await loadRecords(); // ledger table
    } catch (err) {
        console.log('Import error:', err);
        showToast(err.message);
    }

    importFile.value = '';
});

loadRecords();

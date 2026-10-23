const card = document.querySelector('.has-trash');
const body = document.getElementById('trash-body');
const search = document.getElementById('trash-search');
const selectAll = document.getElementById('select-all');
const selectedCount = document.getElementById('selected-count');
const trashCount = document.getElementById('trash-count');
const trashFoot = document.getElementById('trash-foot');
const restoreAllBtn = document.getElementById('restore-all');
const restoreSelectedBtn = document.getElementById('restore-selected');
const clearBtn = document.getElementById('clear-selection');

let isRestoring = false;

const rows = () => [...body.querySelectorAll('tr[data-booking-id]')];
const isChecked = row => row.querySelector('.row-check')?.checked ?? false;

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

function formatDate(value) {
    if (!value) return '—';

    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-PH', {
        month: 'short', day: 'numeric', year: 'numeric'
    });
}

function formatDateTime(value) {
    if (!value) return '—';

    // MySQL returns a local DATETIME string without a timezone marker.
    const date = new Date(value.replace(' ', 'T'));
    return Number.isNaN(date.getTime())
        ? value
        : date.toLocaleString('en-PH', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: 'numeric', minute: '2-digit'
        });
}

function formatNumber(value) {
    return value == null
        ? '—'
        : Number(value).toLocaleString('en-PH', { maximumFractionDigits: 2 });
}

function formatPrice(value) {
    return value == null
        ? '—'
        : '₱' + Number(value).toLocaleString('en-PH', {
            minimumFractionDigits: 2, maximumFractionDigits: 2
        });
}

function rowHtml(record) {
    const id = Number(record.booking_id);

    return `
        <tr data-booking-id="${id}">
            <td><input type="checkbox" class="row-check" aria-label="Select booking ${id}" /></td>
            <td>${id}</td>
            <td class="muted">${esc(formatDate(record.date))}</td>
            <td>${esc(record.location)}</td>
            <td class="num">${esc(formatNumber(record.count))}</td>
            <td>${esc(formatNumber(record.size))}${record.size == null ? '' : ' kg'}</td>
            <td class="num">${esc(formatPrice(record.price))}</td>
            <td>${esc(record.deleted_by || 'Unknown')}</td>
            <td class="muted">${esc(formatDateTime(record.deleted_at))}</td>
        </tr>`;
}

function refresh() {
    const all = rows();
    const visible = all.filter(row => !row.hidden);
    const selected = all.filter(isChecked);

    selectedCount.textContent = selected.length;
    trashCount.textContent =
        all.length + (all.length === 1 ? ' item' : ' items') + ' in archive';
    trashFoot.textContent =
        'Showing ' + visible.length + ' of ' + all.length + ' records';

    selectAll.checked = visible.length > 0 && visible.every(isChecked);
    restoreAllBtn.disabled = isRestoring || all.length === 0;
    restoreSelectedBtn.disabled = isRestoring || selected.length === 0;
    card.classList.toggle('is-empty', all.length === 0);
}

async function loadTrash() {
    try {
        const response = await fetch('/api/trash');
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Could not load archived records.');
        }

        body.innerHTML = data.rows.length
            ? data.rows.map(rowHtml).join('')
            : '<tr class="empty-row"><td colspan="9">No records in Archive.</td></tr>';
        refresh();
    } catch (error) {
        body.innerHTML = '<tr class="error-row"><td colspan="9">Archived records could not be loaded.</td></tr>';
        refresh();
        showToast(error.message || 'Could not load archived records.');
    }
}

async function restore(list) {
    if (!list.length || isRestoring) return;

    isRestoring = true;
    restoreAllBtn.disabled = true;
    restoreSelectedBtn.disabled = true;

    // This request currently relies on the authenticated session cookie;
    // the Restore endpoint does not yet validate a CSRF token.
    const results = await Promise.all(list.map(async row => {
        const bookingId = row.dataset.bookingId;

        try {
            const response = await fetch(
                '/api/records/' + encodeURIComponent(bookingId) + '/restore',
                { method: 'POST' }
            );
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Restore failed.');
            }

            row.remove();
            return { success: true, bookingId };
        } catch (error) {
            return {
                success: false,
                bookingId,
                message: error.message || 'Restore failed.'
            };
        }
    }));

    isRestoring = false;
    refresh();

    const restored = results.filter(result => result.success);
    const failed = results.filter(result => !result.success);

    if (failed.length) {
        const failedIds = failed.map(result => result.bookingId).join(', ');
        const reason = failed[0].message;
        showToast(
            restored.length + ' restored; ' + failed.length +
            ' failed (booking IDs: ' + failedIds + '). ' + reason
        );
    } else if (restored.length) {
        showToast(
            restored.length +
            (restored.length === 1 ? ' booking restored' : ' bookings restored')
        );
    }
}

restoreSelectedBtn.addEventListener('click', () => {
    restore(rows().filter(isChecked));
});

restoreAllBtn.addEventListener('click', () => {
    if (confirm('Restore every record in the archive?')) {
        restore(rows());
    }
});

clearBtn.addEventListener('click', () => {
    rows().forEach(row => {
        row.querySelector('.row-check').checked = false;
    });

    refresh();
});

selectAll.addEventListener('change', () => {
    rows().filter(row => !row.hidden).forEach(row => {
        row.querySelector('.row-check').checked = selectAll.checked;
    });

    refresh();
});

body.addEventListener('change', refresh);

search.addEventListener('input', () => {
    const query = search.value.trim().toLowerCase();

    rows().forEach(row => {
        row.hidden = !row.textContent.toLowerCase().includes(query);
    });

    refresh();
});

refresh();
loadTrash();

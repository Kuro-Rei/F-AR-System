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

const rows = () => [...body.querySelectorAll('tr')];
const isChecked = row => row.querySelector('.row-check').checked;

function refresh() {
    const all = rows();
    const visible = all.filter(r => !r.hidden);
    const selected = all.filter(isChecked);

    selectedCount.textContent = selected.length;

    trashCount.textContent =
        all.length + (all.length === 1 ? ' item' : ' items') + ' in trash';

    trashFoot.textContent =
        'Showing ' + visible.length + ' of ' + all.length + ' records';

    selectAll.checked = visible.length > 0 && visible.every(isChecked);
    restoreAllBtn.disabled = all.length === 0;

    card.classList.toggle('is-empty', all.length === 0);
}

function restore(list) {
    if (!list.length) return;

    const pages = list.map(r => r.cells[1].textContent);

    list.forEach(r => r.remove());

    addLog(
        'Restore',
        'Restored ' + pages.join(', ') + ' (' + list.length +
        (list.length === 1 ? ' record)' : ' records)')
    );

    showToast(
        list.length +
        (list.length === 1 ? ' record restored' : ' records restored')
    );

    refresh();
}

restoreSelectedBtn.addEventListener('click', () => {
    restore(rows().filter(isChecked));
});

restoreAllBtn.addEventListener('click', () => {
    if (confirm('Restore every record in the trash?')) {
        restore(rows());
    }
});

clearBtn.addEventListener('click', () => {
    rows().forEach(r => {
        r.querySelector('.row-check').checked = false;
    });

    refresh();
});

selectAll.addEventListener('change', () => {
    rows().filter(r => !r.hidden).forEach(r => {
        r.querySelector('.row-check').checked = selectAll.checked;
    });

    refresh();
});

body.addEventListener('change', refresh);

search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();

    rows().forEach(r => {
        r.hidden = !r.textContent.toLowerCase().includes(q);
    });

    refresh();
});

refresh();
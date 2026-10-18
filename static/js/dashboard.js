const ledgerBody = document.getElementById('ledger-body');
const ledgerSearch = document.getElementById('ledger-search');
const selectAll = document.getElementById('select-all');
const ledgerFoot = document.getElementById('ledger-foot');
const importBtn = document.getElementById('import-btn');
const importFile = document.getElementById('import-file');

let totalRecords = 1234;

const ledgerRows = () => [...ledgerBody.querySelectorAll('tr')];

function updateFooter() {
    const visible = ledgerRows().filter(r => !r.hidden).length;
    ledgerFoot.textContent = 'Showing ' + visible + ' of ' + totalRecords.toLocaleString() + ' records';
}

ledgerSearch.addEventListener('input', () => {
    const q = ledgerSearch.value.trim().toLowerCase();

    ledgerRows().forEach(row => {
        row.hidden = !row.textContent.toLowerCase().includes(q);
    });

    selectAll.checked = false;
    updateFooter();
});

selectAll.addEventListener('change', () => {
    ledgerRows().filter(r => !r.hidden).forEach(r => {
        r.querySelector('input[type="checkbox"]').checked = selectAll.checked;
    });
});

ledgerBody.addEventListener('click', e => {
    const btn = e.target.closest('.icon-btn');

    if (!btn) return;

    const row = btn.closest('tr');
    const name = row.querySelector('strong').textContent;

    if (!confirm('Move ' + name + ' to trash?')) return;

    row.remove();
    totalRecords--;
    updateFooter();

    addLog('Delete', 'Moved ' + name + ' to trash');
    showToast(name + ' moved to trash');
});

importBtn.addEventListener('click', () => importFile.click());

importFile.addEventListener('change', () => {
    const file = importFile.files[0];

    if (!file) return;

    addLog('Imported excel', 'Imported ' + file.name);
    showToast('Imported ' + file.name);

    importFile.value = '';
});

updateFooter();
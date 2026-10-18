
(() => {
  'use strict';

  const records = Array.isArray(window.EXCEL_SALES_DATA) ? window.EXCEL_SALES_DATA : [];
  const get = (id) => document.getElementById(id);
  const filters = {
    from: get('report-from'),
    to: get('report-to'),
    location: get('report-location'),
    price: get('report-price'),
    volumeRange: get('report-volume-range'),
    search: get('report-search')
  };
  const currency = (value) => '₱' + value.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const quantity = (value) => value.toLocaleString('en-PH', { maximumFractionDigits: 2 });
  const labelDate = (date) => new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });

  const dates = records.map((item) => item.date).filter(Boolean).sort();
  const defaults = { from: dates[0] || '', to: dates[dates.length - 1] || '' };
  filters.from.value = defaults.from;
  filters.to.value = defaults.to;

  const locations = [...new Set(records.map((item) => item.location).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
  for (const location of locations) {
    filters.location.add(new Option(location, location));
  }

  let visibleRecords = [];
  let dailyRows = [];
  let locationRows = [];

  function groupBy(items, property) {
    const groups = new Map();
    for (const item of items) {
      const key = item[property] || 'Unknown';
      if (!groups.has(key)) groups.set(key, { label: key, orders: 0, volume: 0, sales: 0 });
      const group = groups.get(key);
      group.orders += Number(item.count) || 0;
      group.volume += Number(item.volume) || 0;
      group.sales += Number(item.sales) || 0;
    }
    return [...groups.values()];
  }

  function updateReport() {
    const { from, to, location, price, volumeRange, search } = filters;
    const query = search.value.trim().toLowerCase();
    const invalidRange = Boolean(from.value && to.value && from.value > to.value);

    visibleRecords = invalidRange ? [] : records.filter((item) => (
      (!from.value || item.date >= from.value) &&
      (!to.value || item.date <= to.value) &&
      (location.value === 'All' || item.location === location.value) &&
      (price.value === 'All' ||
        (price.value === 'Below ₱9/kg' && Number(item.priceKg) < 9) ||
        (price.value === '₱9–₱10.99/kg' && Number(item.priceKg) >= 9 && Number(item.priceKg) < 11) ||
        (price.value === '₱11+/kg' && Number(item.priceKg) >= 11)) &&
      (volumeRange.value === 'All' ||
        (volumeRange.value === '<500 kg' && Number(item.volume) < 500) ||
        (volumeRange.value === '500–1,500 kg' && Number(item.volume) >= 500 && Number(item.volume) <= 1500) ||
        (volumeRange.value === '>1,500 kg' && Number(item.volume) > 1500)) &&
      (!query || String(item.location || '').toLowerCase().includes(query) || String(item.date || '').includes(query) || String(item.sales || '').includes(query))
    ));

    const sales = visibleRecords.reduce((sum, item) => sum + (Number(item.sales) || 0), 0);
    const volume = visibleRecords.reduce((sum, item) => sum + (Number(item.volume) || 0), 0);

    get('report-sales').textContent = currency(sales);
    get('report-volume').textContent = quantity(volume) + ' kg';
    get('report-average').textContent = volume ? currency(sales / volume) : '—';
    get('report-count').textContent = `${visibleRecords.length} matching sales records`;
    get('report-status').textContent = invalidRange
      ? 'Start date must be on or before end date.'
      : `${visibleRecords.length} of ${records.length} Excel records included in this report.`;
    get('report-total').textContent = 'Total ' + currency(sales);

    locationRows = groupBy(visibleRecords, 'location').sort((a, b) => b.sales - a.sales);
    dailyRows = groupBy(visibleRecords, 'date').sort((a, b) => b.label.localeCompare(a.label));
    get('report-days').textContent = `${dailyRows.length} days with sales`;

    renderLocations();
    renderDailyTable();
  }

  function empty(message, parent) {
    const element = document.createElement('p');
    element.className = 'report-empty';
    element.textContent = message;
    parent.append(element);
  }

  function renderLocations() {
    const parent = get('report-location-bars');
    parent.replaceChildren();
    if (!locationRows.length) return empty('No locations match the selected filters.', parent);

    const maximum = Math.max(...locationRows.map((row) => row.sales), 1);
    for (const item of locationRows) {
      const row = document.createElement('div');
      row.className = 'bar-row';
      const name = document.createElement('span');
      name.textContent = item.label;
      const track = document.createElement('div');
      track.className = 'track';
      const fill = document.createElement('span');
      fill.style.width = `${Math.max(0, item.sales / maximum * 100)}%`;
      track.append(fill);
      const amount = document.createElement('b');
      amount.textContent = currency(item.sales);
      row.append(name, track, amount);
      parent.append(row);
    }
  }

  function renderDailyTable() {
    const body = get('report-daily-body');
    body.replaceChildren();
    if (!dailyRows.length) {
      const row = body.insertRow();
      const cell = row.insertCell();
      cell.colSpan = 4;
      cell.textContent = 'No sales records match these filters.';
      cell.className = 'report-empty';
      return;
    }

    for (const item of dailyRows) {
      const row = body.insertRow();
      [labelDate(item.label), quantity(item.orders), quantity(item.volume), currency(item.sales)]
        .forEach((value, index) => {
          const cell = row.insertCell();
          cell.textContent = value;
          if (index !== 0) cell.className = 'num';
        });
    }
  }

  function csvCell(value) {
    return '"' + String(value).replace(/"/g, '""') + '"';
  }

  function downloadCsv() {
    const rows = [
      ['Sales report', 'Filtered Excel dataset'],
      ['Date from', filters.from.value],
      ['Date to', filters.to.value],
      ['Location', filters.location.value],
      ['Price per kilo', filters.price.value],
      ['Volume range', filters.volumeRange.value],
      ['Record search', filters.search.value],
      [],
      ['Date', 'Location', 'Orders', 'Kilos', 'Sales (PHP)', 'Price per kg (PHP)'],
      ...visibleRecords.map((item) => [
        item.date, item.location, item.count, item.volume, item.sales, item.priceKg
      ])
    ];
    const csv = '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `andrei-rain-sales-report-${filters.from.value || 'all'}-to-${filters.to.value || 'all'}.csv`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    if (typeof showToast === 'function') showToast('Filtered sales report exported.');
  }

  Object.values(filters).forEach((field) => field.addEventListener('input', updateReport));
  get('report-reset').addEventListener('click', () => {
    filters.from.value = defaults.from;
    filters.to.value = defaults.to;
    filters.location.value = 'All';
    filters.price.value = 'All';
    filters.volumeRange.value = 'All';
    filters.search.value = '';
    updateReport();
  });
  get('export-csv').addEventListener('click', downloadCsv);
  get('print-pdf').addEventListener('click', () => window.print());

  updateReport();
})();

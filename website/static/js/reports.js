
(() => {
  'use strict';

  let records = [];
  let recordsLoaded = false;
  const get = (id) => document.getElementById(id);
  const exportButton = get('export-csv');
  const printButton = get('print-pdf');
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

  const defaults = { from: '', to: '' };

  const compact = (value) => '₱' + Math.round(value).toLocaleString('en-PH');
  const shortDate = (date, withYear) => new Date(date + 'T12:00:00').toLocaleDateString('en-PH', withYear
    ? { month: 'short', day: 'numeric', year: 'numeric' }
    : { month: 'short', day: 'numeric' });
  const isoDate = (d) =>
    d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');

  // weeks start on Monday (same logic as the Dashboard)
  function weekStart(date) {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() - (d.getDay() + 6) % 7);
    return isoDate(d);
  }

  function weeksBetween(start, end) {
    if (!start || !end || start > end) return [];

    const result = [];
    const cursor = new Date(weekStart(start) + 'T12:00:00'),
      limit = new Date(end + 'T12:00:00');

    for (let i = 0; cursor <= limit && i < 110; i++, cursor.setDate(cursor.getDate() + 7)) {
      result.push(isoDate(cursor));
    }

    return result;
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
    if (!recordsLoaded) return;

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
    get('report-average').textContent = visibleRecords.length ? currency(sales / visibleRecords.length) : '—';

    const sortedDates = visibleRecords.map((item) => item.date).sort();
    const rangeStart = from.value || sortedDates[0];
    const rangeEnd = to.value || sortedDates[sortedDates.length - 1];
    const weekCount = weeksBetween(rangeStart, rangeEnd).length;

    get('report-sales-note').textContent = visibleRecords.length && rangeStart && rangeEnd
      ? visibleRecords.length + (visibleRecords.length === 1 ? ' transaction' : ' transactions') +
        ' | ' + shortDate(rangeStart) + ' - ' + shortDate(rangeEnd, true)
      : 'No matching transactions';
    get('report-volume-note').textContent = volume
      ? 'Avg price: ' + currency(sales / volume) + ' per kg'
      : '—';
    get('report-average-note').textContent = 'per transaction | ' +
      (weekCount ? compact(sales / weekCount) + ' per week' : '—');
    get('report-status').textContent = invalidRange
      ? 'Start date must be on or before end date.'
      : `${visibleRecords.length} of ${records.length} active records included in this report.`;
    get('report-total').textContent = 'Total ' + currency(sales);
    get('report-print-total-value').textContent = 'Total ' + currency(sales);

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
    if (!recordsLoaded) return;

    const rows = [
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

  function updatePrintHeading() {
    const brandName = document.querySelector('.company-brand img')?.alt.trim();
    const periodStart = filters.from.value ? labelDate(filters.from.value) : 'Any date';
    const periodEnd = filters.to.value ? labelDate(filters.to.value) : 'Any date';
    const generatedAt = new Date();

    get('report-print-business').textContent = brandName || document.title;
    get('report-print-period').textContent = `${periodStart} to ${periodEnd}`;
    get('report-print-generated').textContent = generatedAt.toLocaleString('en-PH', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
    get('report-print-generated').dateTime = generatedAt.toISOString();
  }

  function showUnavailable(message) {
    get('report-status').textContent = message;
    get('report-sales').textContent = '—';
    get('report-volume').textContent = '—';
    get('report-average').textContent = '—';
    get('report-sales-note').textContent = 'Report unavailable';
    get('report-volume-note').textContent = '—';
    get('report-average-note').textContent = '—';
    get('report-total').textContent = 'Total —';
    get('report-print-total-value').textContent = 'Total —';
    get('report-days').textContent = '—';

    const locationBars = get('report-location-bars');
    locationBars.replaceChildren();
    empty('Active sales data is unavailable.', locationBars);

    const body = get('report-daily-body');
    body.replaceChildren();
    const row = body.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 4;
    cell.className = 'report-empty';
    cell.textContent = 'Active sales data is unavailable.';
  }

  async function loadRecords() {
    try {
      const response = await fetch('/api/sales', { cache: 'no-store' });
      let rows;
      try {
        rows = await response.json();
      } catch (parseError) {
        throw new Error('Could not read active sales data. Please try again.');
      }

      if (!response.ok) {
        throw new Error(rows.error || 'Could not load active sales data. Please try again.');
      }
      if (!Array.isArray(rows)) {
        throw new Error('The active sales response was not in the expected format.');
      }

      // /api/sales returns a bare array with these database-backed fields.
      records = rows.map((row) => ({
        date: row.date,
        location: row.location,
        count: row.count,
        size: row.size,
        volume: row.volume,
        sales: row.sales,
        priceKg: row.priceKg
      }));

      const dates = records.map((item) => item.date).filter(Boolean).sort();
      defaults.from = dates[0] || '';
      defaults.to = dates[dates.length - 1] || '';
      filters.from.value = defaults.from;
      filters.to.value = defaults.to;

      const locations = [...new Set(records.map((item) => item.location).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b));
      filters.location.replaceChildren(new Option('All locations', 'All'));
      for (const location of locations) {
        filters.location.add(new Option(location, location));
      }

      recordsLoaded = true;
      exportButton.disabled = false;
      printButton.disabled = false;
      updateReport();
    } catch (error) {
      recordsLoaded = false;
      exportButton.disabled = true;
      printButton.disabled = true;
      showUnavailable(error.message || 'Could not load active sales data. Please try again.');
    }
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
  exportButton.addEventListener('click', downloadCsv);
  printButton.addEventListener('click', () => {
    if (recordsLoaded) window.print();
  });
  window.addEventListener('beforeprint', updatePrintHeading);

  updatePrintHeading();
  loadRecords();
})();

(() => {
    'use strict';

    let rows = [];
    const el = id => document.getElementById(id);

    const from = el('filter-from'),
        to = el('filter-to'),
        loc = el('filter-location');

    let defaults = { 
        from: '', 
        to: '', 
        location: 'All' 
    };

    const money = n => '₱' + n.toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    const compact = n => '₱' + Math.round(n).toLocaleString('en-PH');

    const number = n => n.toLocaleString('en-PH', {
        maximumFractionDigits: 2
    });

    function fillLocations() {
        const current = loc.value || 'All';
        const names = [...new Set(rows.map(r => r.location).filter(Boolean))]
            .sort((a, b) => a.localeCompare(b));

        loc.replaceChildren(new Option('All', 'All'), ...names.map(s => new Option(s, s)));
        loc.value = names.includes(current) ? current : 'All';
    }

    const SVG = 'http://www.w3.org/2000/svg';

    // Charts
    function svg(tag, attrs = {}, text) {
        const n = document.createElementNS(SVG, tag);

        for (const [k, v] of Object.entries(attrs)) {
            n.setAttribute(k, String(v));
        }

        if (text !== undefined) n.textContent = text;

        return n;
    }

    function draw(id, type, items, format) {
        const root = el(id);
        root.replaceChildren();

        if (!items.length) {
            root.textContent = 'No matching data for these filters.';
            root.classList.add('no-data');
            return;
        }

        root.classList.remove('no-data');

        const horizontal = type === 'horizontal',
            W = horizontal ? 760 : 900,
            H = 300;

        const margin = horizontal
            ? { l: 135, r: 90, t: 18, b: 30 }
            : { l: 80, r: 20, t: 23, b: 57 };

        const innerW = W - margin.l - margin.r,
            innerH = H - margin.t - margin.b;

        const chart = svg('svg', {
            viewBox: `0 0 ${W} ${H}`,
            class: 'dashboard-svg',
            role: 'presentation'
        });

        const max = Math.max(1, ...items.map(x => x.value));
        const ceil = Math.ceil(max / (max <= 10 ? 2 : 5)) * (max <= 10 ? 2 : 5);
        const axisMax = ceil || 1;

        const grid = svg('g', { 'class': 'plot-grid' });
        chart.append(grid);

        const line = (x1, y1, x2, y2) => svg('line', {
            x1,
            y1,
            x2,
            y2,
            stroke: '#dfe5ef',
            'stroke-dasharray': '4 4'
        });

        const txt = (x, y, text, anchor = 'middle') => svg('text', {
            x,
            y,
            'text-anchor': anchor,
            fill: '#61708e',
            'font-size': '12',
            'font-family': 'Inter,system-ui,sans-serif'
        }, text);

        if (horizontal) {
            const rowH = innerH / items.length;

            for (let t = 0; t <= 5; t++) {
                const x = margin.l + innerW * t / 5;

                grid.append(line(x, margin.t, x, margin.t + innerH));
                chart.append(txt(x, H - 8, format(axisMax * t / 5)));
            }

            items.forEach((d, i) => {
                const y = margin.t + i * rowH + rowH / 2;
                const width = innerW * d.value / axisMax;

                chart.append(
                    txt(
                        margin.l - 12,
                        y + 4,
                        d.label.length > 20 ? d.label.slice(0, 19) + '…' : d.label,
                        'end'
                    )
                );

                const bar = svg('rect', {
                    x: margin.l,
                    y: y - Math.min(13, rowH * .28) / 2,
                    width: Math.max(width, 0),
                    height: Math.min(13, rowH * .28),
                    rx: 3,
                    fill: '#315fed'
                });

                bar.append(svg('title', {}, `${d.label}: ${format(d.value)}`));
                chart.append(bar);

                chart.append(
                    txt(
                        Math.min(margin.l + width + 7, W - 85),
                        y + 4,
                        format(d.value),
                        'start'
                    )
                );
            });

        } else {
            for (let t = 0; t <= 5; t++) {
                const y = margin.t + innerH * (1 - t / 5);

                grid.append(line(margin.l, y, W - margin.r, y));
                chart.append(txt(margin.l - 9, y + 4, format(axisMax * t / 5), 'end'));
            }

            const count = items.length;

            const xAt = i => margin.l + (
                count === 1 ? innerW / 2 : (innerW * (i + .5) / count)
            );

            if (type === 'line') {
                const pts = items.map((d, i) => [
                    xAt(i),
                    margin.t + innerH * (1 - d.value / axisMax)
                ]);

                const path = svg('polyline', {
                    points: pts.map(p => p.join(',')).join(' '),
                    fill: 'none',
                    stroke: '#315fed',
                    'stroke-width': 3,
                    'stroke-linecap': 'round',
                    'stroke-linejoin': 'round'
                });

                chart.append(path);

                pts.forEach(([x, y], i) => {
                    const c = svg('circle', {
                        cx: x,
                        cy: y,
                        r: 4,
                        fill: '#315fed',
                        stroke: '#fff',
                        'stroke-width': 1.5
                    });

                    c.append(
                        svg('title', {}, `${items[i].label}: ${format(items[i].value)}`)
                    );

                    chart.append(c);
                });

            } else {
                const barWidth = Math.min(40, innerW / count * .65);

                items.forEach((d, i) => {
                    const h = innerH * d.value / axisMax;

                    const bar = svg('rect', {
                        x: xAt(i) - barWidth / 2,
                        y: margin.t + innerH - h,
                        width: barWidth,
                        height: h,
                        rx: 2,
                        fill: '#4a82c9'
                    });

                    bar.append(svg('title', {}, `${d.label}: ${format(d.value)}`));
                    chart.append(bar);
                });
            }

            const stride = count <= 10 ? 1 : Math.ceil(count / 10);

            items.forEach((d, i) => {
                if (i % stride === 0 || i === count - 1) {
                    chart.append(txt(xAt(i), H - 22, d.label));
                }
            });
        }

        root.append(chart);
    }

    function aggregate(data, key, metric) {
        const m = new Map();

        data.forEach(r =>
            m.set(r[key], (m.get(r[key]) || 0) + r[metric])
        );

        return [...m].map(([label, value]) => ({ label, value }));
    }

    const isoDate = d =>
        d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');

    // weeks start on Monday
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

    const shortDate = (d, withYear) =>
        new Date(d + 'T12:00:00').toLocaleDateString('en-PH', withYear
            ? { month: 'short', day: 'numeric', year: 'numeric' }
            : { month: 'short', day: 'numeric' });

    function render() {
        const selected = rows.filter(r => {
            if ((from.value && r.date < from.value) || (to.value && r.date > to.value)) return false;
            if (loc.value !== 'All' && r.location !== loc.value) return false;

            return true;
        });

        const sales = selected.reduce((sum, r) => sum + r.sales, 0),
            volume = selected.reduce((sum, r) => sum + r.volume, 0);

        const relevant = selected.map(r => r.date).sort();
        const start = from.value || relevant[0],
            end = to.value || relevant[relevant.length - 1];

        const weeks = weeksBetween(start, end);

        el('kpi-sales').textContent = money(sales);
        el('kpi-sales-note').textContent = selected.length && start && end
            ? selected.length + (selected.length === 1 ? ' transaction' : ' transactions') +
              ' | ' + shortDate(start) + ' - ' + shortDate(end, true)
            : 'No matching transactions';

        el('kpi-volume').textContent = number(volume) + ' kg';
        el('kpi-volume-note').textContent = volume
            ? 'Avg price: ' + money(sales / volume) + ' per kg'
            : '—';

        el('kpi-average').textContent = selected.length ? money(sales / selected.length) : '—';
        el('kpi-average-note').textContent = 'per transaction | ' +
            (weeks.length ? compact(sales / weeks.length) + ' per week' : '—');

        el('filter-note').textContent =
            selected.length + ' of ' + rows.length + ' Excel sales records match your filters.';

        const withWeek = selected.map(r => ({ ...r, week: weekStart(r.date) }));

        const ws = new Map(
            aggregate(withWeek, 'week', 'sales').map(x => [x.label, x.value])
        );

        const wv = new Map(
            aggregate(withWeek, 'week', 'volume').map(x => [x.label, x.value])
        );

        const labels = weeks.map(w => shortDate(w));

        draw(
            'chart-sales',
            'line',
            weeks.map((w, i) => ({
                label: labels[i],
                value: ws.get(w) || 0
            })),
            compact
        );

        draw(
            'chart-volume',
            'column',
            weeks.map((w, i) => ({
                label: labels[i],
                value: wv.get(w) || 0
            })),
            v => number(v) + ' kg'
        );

        draw(
            'chart-location',
            'horizontal',
            aggregate(selected, 'location', 'volume')
                .sort((a, b) => b.value - a.value)
                .slice(0, 10),
            v => number(v) + ' kg'
        );
    }

    function reset() {
        from.value = defaults.from;
        to.value = defaults.to;
        loc.value = defaults.location;

        render();
    }

    [from, to, loc].forEach(control =>
        control.addEventListener('change', render)
    );

    el('reset-dashboard-filters').addEventListener('click', reset);

    async function load() {
        const res = await fetch('/api/sales');
        rows = await res.json();
        fillLocations();

        const dates = rows.map(r => r.date).sort();
        defaults.from = dates[0] || '';
        defaults.to = dates[dates.length - 1] || '';
        reset();
    }

    window.reloadDashboard = load;   // dashboard.js calls this after an import
    load();
})();
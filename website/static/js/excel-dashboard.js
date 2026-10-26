(() => {
    'use strict';

    // empty box
    let rows = [];
    const el = id => document.getElementById(id);
    // Filter
    const from = el('filter-from'),
        to = el('filter-to'),
        loc = el('filter-location'),
        month = el('filter-month');

    let defaults = { 
        from: '', 
        to: '', 
        location: 'All' 
    };

    const money = n => '₱' + n.toLocaleString('en-PH', {
        minimumFractionDigits: 2, //always shows 2 decimals, for the KPI cards.
        maximumFractionDigits: 2
    });

    const compact = n => '₱' + Math.round(n).toLocaleString('en-PH'); //rounds to a whole number, for chart axes.

    const number = n => n.toLocaleString('en-PH', {
        maximumFractionDigits: 2 // 1234.5 to 1,234.5
    });

    //builds the dropdown from the unique, sorted location names
    function fillLocations() {
        const current = loc.value || 'All';
        const names = [...new Set(rows.map(r => r.location).filter(Boolean))] //removes duplicates, so “Manila” appears once.
            .sort((a, b) => a.localeCompare(b)); 

        loc.replaceChildren(new Option('All', 'All'), ...names.map(s => new Option(s, s))); // dropdown add “All” first, followed by each name
        loc.value = names.includes(current) ? current : 'All';
    }

    const monthLabel = m =>
        new Date(m + '-01T12:00:00').toLocaleDateString('en-PH', { month: 'long', year: 'numeric' }); //"2026-09" becomes "September 2026"

    function fillMonths() {
        const current = month.value;
        const months = [...new Set(rows.map(r => r.date.slice(0, 7)))].sort();

        // no "All months" option: the dropdown lists real months only
        month.replaceChildren(
            ...months.map(m => new Option(monthLabel(m), m))
        );

        // keep the chosen month on reload, otherwise default to the latest month
        month.value = months.includes(current) ? current : (months[months.length - 1] || '');
    }

    // choosing a month fills the date range with that month's first and last day
    function applyMonth() {
        if (!month.value) {
            from.value = '';
            to.value = '';
        } else {
            const [y, m] = month.value.split('-').map(Number);
            const lastDay = new Date(y, m, 0).getDate();

            from.value = month.value + '-01';
            to.value = month.value + '-' + String(lastDay).padStart(2, '0');
        }
        render();
    }

    const SVG = 'http://www.w3.org/2000/svg';

    // makes the shape of the Charts
    function svg(tag, attrs = {}, text) {
        const n = document.createElementNS(SVG, tag);

        for (const [k, v] of Object.entries(attrs)) {
            n.setAttribute(k, String(v));
        }

        if (text !== undefined) n.textContent = text;

        return n;
    }


    function draw(id, type, items, format, opts = {}) {
        const root = el(id);
        root.replaceChildren();

        // check if there are data to use
        if (!items.length) {
            root.textContent = 'No matching data for these filters.';
            root.classList.add('no-data');
            return;
        }

        root.classList.remove('no-data');

        const horizontal = type === 'horizontal';

        // the chart is drawn at the real size of its card (1 unit = 1 px),
        // so the fonts stay the same size and there is no empty space around it
        const W = Math.max(300, Math.round(root.clientWidth || (horizontal ? 440 : 700)));
        const H = horizontal
            ? Math.max(380, Math.round(root.clientHeight || 420))
            : opts.fill
            ? Math.max(270, Math.round(root.clientHeight || 340))
            : Math.round(Math.min(340, Math.max(270, W * .45)));

        const margin = horizontal
            ? { l: 118, r: 68, t: 10, b: 58 } // Margin left, right, top, bottom
            : { l: 78, r: 12, t: 18, b: 50 };

        // drawing area
        const innerW = W - margin.l - margin.r,
            innerH = H - margin.t - margin.b; 

        const chart = svg('svg', {
            viewBox: `0 0 ${W} ${H}`,
            class: 'dashboard-svg',
            role: 'presentation'
        });

        // even axis: step is 1, 2 or 5 x a power of 10 (10,000 / 20,000 / 50,000 ...)
        const target = horizontal ? Math.max(4, Math.min(8, Math.floor(innerW / 56))) : 5;
        const max = Math.max(1, ...items.map(x => x.value));
        const rawStep = max / target;
        const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
        const step = [1, 2, 5, 10].map(m => m * mag).find(v => v >= rawStep);
        const ticks = Math.max(1, Math.ceil(max / step - 1e-9));
        const axisMax = step * ticks;

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

        const txt = (x, y, text, anchor = 'middle', size = 14, extra = {}) => svg('text', {
            x,
            y,
            'text-anchor': anchor,
            fill: '#61708e',
            'font-size': size,
            'font-family': 'Inter,system-ui,sans-serif',
            ...extra
        }, text);

        if (horizontal) {
            const rowH = innerH / items.length;
            const barH = Math.min(30, rowH * .6);

            // bar chart
            for (let t = 0; t <= ticks; t++) {
                const x = margin.l + innerW * t / ticks;

                grid.append(line(x, margin.t, x, margin.t + innerH));
                chart.append(txt(x, margin.t + innerH + 18, number(step * t), 'middle', 14, { fill: '#4b5563' }));
            }

            items.forEach((d, i) => {
                const y = margin.t + i * rowH + rowH / 2;
                const width = innerW * d.value / axisMax;

                // bar colours: dark blue for the top location, fading to light blue
                const k = items.length > 1 ? i / (items.length - 1) : 0;
                const fill = `rgb(${Math.round(51 + 148 * k)},${Math.round(89 + 119 * k)},${Math.round(138 + 92 * k)})`;

                chart.append(
                    txt(
                        margin.l - 10,
                        y + 6,
                        d.label.length > 14 ? d.label.slice(0, 13) + '…' : d.label,
                        'end',
                        16,
                        { fill: '#1a2d56' }
                    )
                );

                const bar = svg('rect', {
                    x: margin.l,
                    y: y - barH / 2,
                    width: Math.max(width, 0),
                    height: barH,
                    rx: 3,
                    fill
                });

                bar.append(svg('title', {}, `${d.label}: ${format(d.value)}`));
                chart.append(bar);

                chart.append(
                    txt(
                        Math.min(margin.l + width + 7, W - margin.r + 4),
                        y + 5,
                        number(d.value),
                        'start',
                        15,
                        { fill: '#1a2d56', 'font-weight': 600 }
                    )
                );
            });

            if (opts.xTitle) {
                chart.append(txt(margin.l + innerW / 2, margin.t + innerH + 46, opts.xTitle, 'middle', 17, { fill: '#050B47', 'font-weight': 700 }));
            }

        } else {
            const baseY = margin.t + innerH;

            //For line and column charts
            for (let t = 0; t <= ticks; t++) {
                const y = margin.t + innerH * (1 - t / ticks);

                grid.append(line(margin.l, y, W - margin.r, y));
                chart.append(txt(margin.l - 9, y + 5, format(step * t), 'end'));
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

                // average reference line
                if (opts.avg !== undefined) {
                    const ay = margin.t + innerH * (1 - opts.avg / axisMax);

                    chart.append(svg('line', {
                        x1: margin.l,
                        y1: ay,
                        x2: W - margin.r,
                        y2: ay,
                        stroke: '#000000',
                        'stroke-width': 2,
                        'stroke-dasharray': '7 5'
                    }));

                    const lw = opts.avgLabel.length * 8.4, lh = 16;

                    // candidate spots: right/left end, above/below the line
                    const spots = [
                        [W - margin.r - 4 - lw, ay - 5 - lh],
                        [W - margin.r - 4 - lw, ay + 5],
                        [margin.l + 6, ay - 5 - lh],
                        [margin.l + 6, ay + 5]
                    ].filter(([, y0]) => y0 >= margin.t - 4 && y0 + lh <= margin.t + innerH);

                    // how many points along the data line fall inside a spot
                    const hits = ([x0, y0]) => {
                        let n = 0;

                        for (let k = 0; k < pts.length - 1; k++) {
                            const [xa, ya] = pts[k], [xb, yb] = pts[k + 1];

                            for (let f = 0; f <= 1; f += .05) {
                                const px = xa + (xb - xa) * f, py = ya + (yb - ya) * f;

                                if (px >= x0 - 4 && px <= x0 + lw + 4 && py >= y0 - 4 && py <= y0 + lh + 4) n++;
                            }
                        }

                        return n;
                    };

                    const best = spots.reduce((a, b) => hits(b) < hits(a) ? b : a, spots[0] || [W - margin.r - lw, ay - 21]);
                    const ty = best[1] + 13;

                    chart.append(txt(best[0], ty, opts.avgLabel, 'start', 14, {
                        fill: '#fff',
                        stroke: '#fff',
                        'stroke-width': 5,
                        'stroke-linejoin': 'round',
                        'font-weight': 700
                    }));

                    chart.append(txt(best[0], ty, opts.avgLabel, 'start', 14, {
                        fill: '#000000',
                        'font-weight': 700
                    }));
                }

                pts.forEach(([x, y], i) => {
                    const c = svg('circle', {
                        cx: x,
                        cy: y,
                        r: 4.5,
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
                const barWidth = Math.min(44, innerW / count * .7);

                items.forEach((d, i) => {
                    const h = innerH * d.value / axisMax;

                    const bar = svg('rect', {
                        x: xAt(i) - barWidth / 2,
                        y: baseY - h,
                        width: barWidth,
                        height: h,
                        rx: 2,
                        fill: '#4a82c9'
                    });

                    bar.append(svg('title', {}, `${d.label}: ${format(d.value)}`));
                    chart.append(bar);
                });
            }

            // slanted date labels, one per day (thinned only for very long ranges)
            const stride = count <= 31 ? 1 : Math.ceil(count / 31);

            items.forEach((d, i) => {
                if (i % stride === 0) {
                    const x = xAt(i) + 5, y = baseY + 16;

                    chart.append(txt(x, y, d.label, 'end', 13, {
                        transform: `rotate(-45 ${x} ${y})`
                    }));
                }
            });
        }

        root.append(chart); //Put the chart on the page
    }

    function aggregate(data, key, metric) {
        const m = new Map();

        data.forEach(r =>
            m.set(r[key], (m.get(r[key]) || 0) + r[metric])
        );

        return [...m].map(([label, value]) => ({ label, value }));
    }

    // YYYY-MM-DD
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

    function daysBetween(start, end) {
        if (!start || !end || start > end) return [];

        const result = [];
        const cursor = new Date(start + 'T12:00:00'),
            limit = new Date(end + 'T12:00:00');

        for (let i = 0; cursor <= limit && i < 400; i++, cursor.setDate(cursor.getDate() + 1)) {
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

        const relevant = selected.map(r => r.date).sort(); // take the dates from api/sales
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

        // plot only from the first day with records to the last day with records,
        const days = relevant.length
            ? daysBetween(relevant[0], relevant[relevant.length - 1])
            : [];

        const dailySales = new Map(
            aggregate(selected, 'date', 'sales').map(x => [x.label, x.value])
        );

        const dailyVolume = new Map(
            aggregate(selected, 'date', 'volume').map(x => [x.label, x.value])
        );

        // every day in the range is plotted, days with no sales show as 0
        draw(
            'chart-sales',
            'line',
            days.map(d => ({ label: shortDate(d), value: dailySales.get(d) || 0 })),
            compact,
            {
                avg: days.length ? sales / days.length : 0,
                avgLabel: 'Avg ' + compact(days.length ? sales / days.length : 0)
            }
        );

        draw(
            'chart-volume',
            'column',
            days.map(d => ({ label: shortDate(d), value: dailyVolume.get(d) || 0 })),
            v => number(v) + ' kg',
            { fill: true }
        );

        draw(
            'chart-location',
            'horizontal',
            aggregate(selected, 'location', 'volume')
                .sort((a, b) => b.value - a.value)
                .slice(0, 10),
            v => number(v) + ' kg',
            { xTitle: 'Volume (kg)' }
        );
    }

    function reset() {
        loc.value = defaults.location;

        // back to the latest month
        month.value = month.options.length ? month.options[month.options.length - 1].value : '';
        applyMonth();
    }

    [from, to].forEach(control =>
        control.addEventListener('change', () => {
            month.selectedIndex = -1; // manual dates override the month picker
            render();
        })
    );

    loc.addEventListener('change', render);
    month.addEventListener('change', applyMonth);

    el('reset-dashboard-filters').addEventListener('click', reset);

    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(render, 120);
    });

    async function load() {
        const res = await fetch('/api/sales');
        rows = await res.json(); //api is now in rows
        fillLocations();
        fillMonths();

        applyMonth(); // latest month
    }

    window.reloadDashboard = load;   // dashboard.js calls this after an import
    load();
})();
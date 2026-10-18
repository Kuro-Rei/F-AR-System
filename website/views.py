from flask import Blueprint, render_template, request, flash, redirect, url_for, session, jsonify
from .imports import import_excel
from . import db
views = Blueprint('views', __name__)


@views.before_request
def require_login():
    if request.endpoint != 'views.index' and 'user_id' not in session:
        return redirect(url_for('views.index'))
    
@views.route('/')
def index():
    if 'user_id' in session:          # skip the login page
        return redirect(url_for('views.dashboard'))
    return render_template("index.html")

@views.route('/dashboard')
def dashboard():
    return render_template("dashboard.html")

@views.route('/logs')
def logs():
    return render_template("logs.html")

@views.route('/profile')
def profile():
    return render_template("profile.html")

@views.route('/reports')
def reports():
    return render_template("reports.html")

@views.route('/trash')
def trash():
    return render_template("trash.html")

@views.route('/import', methods=['POST'])
def import_file():
    f = request.files.get('file')
    if not f or not f.filename.lower().endswith(('.xlsx', '.xlsm')):
        return jsonify(error='Please upload an .xlsx or .xlsm file'), 400
    try:
        result = import_excel(f.stream, f.filename, session.get('user_id', 1))
        return jsonify(result)
    except ValueError as e:
        return jsonify(error=str(e)), 400
    except Exception as e:
        return jsonify(error='Import failed: ' + str(e)), 500

@views.route('/api/sales')
def api_sales():
    conn = db.get_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute("""
        SELECT DATE_FORMAT(b.booking_date, '%Y-%m-%d') AS date,
               l.location_name                         AS location,
               b.quantity                              AS count,
               s.size_kilos                            AS size,
               b.quantity * s.size_kilos               AS volume,
               p.price                                 AS sales
        FROM booking b
        JOIN location l ON l.location_id = b.location_id
        JOIN salt  s    ON s.booking_id  = b.booking_id
        JOIN price p    ON p.booking_id  = b.booking_id
        WHERE b.deleted_at IS NULL
          AND b.quantity IS NOT NULL AND s.size_kilos IS NOT NULL AND p.price IS NOT NULL
        ORDER BY b.booking_date, b.booking_id
    """)
    rows = cur.fetchall()
    conn.close()

    for r in rows:
        r['size'] = float(r['size'])
        r['volume'] = float(r['volume'])
        r['sales'] = float(r['sales'])
        r['count'] = int(r['count'])
        r['priceKg'] = r['sales'] / r['volume']
    return jsonify(rows)

@views.route('/api/records')
def api_records():
    page = request.args.get('page', 1, type=int)
    search = request.args.get('q', '').strip()
    per_page = 10
    like = '%' + search + '%'

    # counting and fetching the page
    from_part = """
        FROM booking b
        JOIN location l ON l.location_id = b.location_id
        JOIN salt  s    ON s.booking_id  = b.booking_id
        JOIN price p    ON p.booking_id  = b.booking_id
        WHERE b.deleted_at IS NULL
          AND (l.location_name LIKE %s OR CAST(b.booking_date AS CHAR) LIKE %s)
    """

    conn = db.get_connection()
    cur = conn.cursor(dictionary=True)

    # show how many record match to know the page value
    cur.execute("SELECT COUNT(*) AS total " + from_part, (like, like))
    total = cur.fetchone()['total']
    pages = max(1, (total + per_page - 1) // per_page)
    page = min(max(page, 1), pages)

    # Get only the 10 records for each page
    cur.execute("""
        SELECT b.booking_id AS id, b.booking_date AS date, l.location_name AS location,
               b.quantity AS count, s.size_kilos AS size,
               b.quantity * s.size_kilos AS volume, p.price AS price
    """ + from_part + """
        ORDER BY b.booking_date DESC, b.booking_id DESC
        LIMIT %s OFFSET %s
    """, (like, like, per_page, (page - 1) * per_page))
    rows = cur.fetchall()
    conn.close()

    # easy use
    for r in rows:
        r['date'] = r['date'].strftime('%b %d, %Y')
        r['size'] = float(r['size'])
        r['volume'] = float(r['volume'])
        r['price'] = float(r['price'])

    return jsonify(rows=rows, total=total, page=page, pages=pages, per_page=per_page)
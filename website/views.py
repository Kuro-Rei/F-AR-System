from flask import Blueprint, current_app, render_template, request, flash, redirect, url_for, session, jsonify
from .imports import import_excel
from . import db
views = Blueprint('views', __name__)


@views.before_request
def require_login():
    if request.endpoint != 'views.index' and 'user_id' not in session:
        if request.path.startswith('/api/'):
            return jsonify(error='Authentication required.'), 401
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

# name the user that did each actions
@views.route('/api/logs')
def api_logs():
    conn = None
    cur = None

    try:
        conn = db.get_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT al.log_id, al.user_id, al.booking_id, al.action, al.details,
                   DATE_FORMAT(al.logged_at, '%Y-%m-%dT%H:%i:%s') AS logged_at,
                   u.full_name, u.username
            FROM activity_logs al
            LEFT JOIN users u ON u.user_id = al.user_id
            ORDER BY al.logged_at DESC, al.log_id DESC
        """)
        rows = cur.fetchall()
        return jsonify(rows=rows)

    except Exception:
        current_app.logger.exception('Could not load activity logs.')
        return jsonify(error='Could not load activity logs. Please try again.'), 500

    finally:
        if cur is not None:
            try:
                cur.close()
            except Exception:
                current_app.logger.exception('Could not close activity log cursor.')
        if conn is not None:
            try:
                conn.close()
            except Exception:
                current_app.logger.exception('Could not close activity log connection.')

@views.route('/profile')
def profile():
    return render_template("profile.html")

@views.route('/reports')
def reports():
    return render_template("reports.html")

@views.route('/trash')
def trash():
    return render_template("trash.html")


@views.route('/api/trash')
def api_trash():
    conn = None
    cur = None

    try:
        conn = db.get_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT b.booking_id,
                   DATE_FORMAT(b.booking_date, '%Y-%m-%d') AS date,
                   l.location_name AS location,
                   b.quantity AS count,
                   s.size_kilos AS size,
                   p.price AS price,
                   u.full_name AS deleted_by,
                   DATE_FORMAT(b.deleted_at, '%Y-%m-%d %H:%i:%s') AS deleted_at
            FROM booking b
            JOIN location l ON l.location_id = b.location_id
            LEFT JOIN salt s ON s.booking_id = b.booking_id
            LEFT JOIN price p ON p.booking_id = b.booking_id
            LEFT JOIN users u ON u.user_id = b.deleted_by
            WHERE b.deleted_at IS NOT NULL
            ORDER BY b.deleted_at DESC, b.booking_id DESC
        """)
        rows = cur.fetchall()

        #convert to normal num
        for row in rows:
            if row['count'] is not None:
                row['count'] = int(row['count'])
            if row['size'] is not None:
                row['size'] = float(row['size'])
            if row['price'] is not None:
                row['price'] = float(row['price'])

        return jsonify(rows=rows)

    except Exception:
        current_app.logger.exception('Could not load archived records.')
        return jsonify(error='Could not load archived records. Please try again.'), 500

    finally:
        if cur is not None:
            try:
                cur.close()
            except Exception:
                current_app.logger.exception('Could not close archived-record query cursor.')
        if conn is not None:
            try:
                conn.close()
            except Exception:
                current_app.logger.exception('Could not close archived-record query connection.')


@views.route('/import', methods=['POST'])
def import_file():
    f = request.files.get('file')

    # Do not accept file that is not an Excel file
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

# return one page with 10 records
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

    # convert date to text
    for r in rows:
        r['date'] = r['date'].strftime('%Y-%m-%d')
        r['size'] = float(r['size'])
        r['volume'] = float(r['volume'])
        r['price'] = float(r['price'])

    return jsonify(rows=rows, total=total, page=page, pages=pages, per_page=per_page)


# Roles allowed to archive and restore records.
ROLES = ('Owner', 'Sales Manager')

# check login then role then id then row then available records then mark archive then save to log
@views.route('/api/records/<booking_id>/trash', methods=['POST'])
def trash_record(booking_id):
    # Session cookies are used for authentication, but this endpoint does not
    # yet validate a CSRF token. Add that protection with the frontend request.
    user_id = session.get('user_id')
    if user_id is None:
        return jsonify(error='Authentication required.'), 401
    
    if session.get('role') not in ROLES:
        return jsonify(error='This account is not allowed to perform this action.'), 403

    if (
        not booking_id.isascii()
        or not booking_id.isdigit()
        or len(booking_id) > 10
        or int(booking_id) < 1
        or int(booking_id) > 2147483647
    ):
        return jsonify(error='Booking ID must be a positive integer.'), 400

    booking_id = int(booking_id)
    conn = None
    cur = None

    try:
        conn = db.get_connection()
        conn.start_transaction()
        cur = conn.cursor(dictionary=True)

        # Lock this booking while checking and changing its Archive state.
        cur.execute(
            'SELECT deleted_at FROM booking WHERE booking_id = %s FOR UPDATE',
            (booking_id,)
        )
        booking = cur.fetchone()

        if booking is None:
            conn.rollback()
            return jsonify(error='Booking record was not found.'), 404

        if booking['deleted_at'] is not None:
            conn.rollback()
            return jsonify(error='Booking record is already in Archive.'), 409

        cur.execute(
            'UPDATE booking '
            'SET deleted_at = CURRENT_TIMESTAMP, deleted_by = %s '
            'WHERE booking_id = %s AND deleted_at IS NULL',
            (user_id, booking_id)
        )

        if cur.rowcount != 1:
            conn.rollback()
            return jsonify(error='Booking record could not be archived.'), 409

        cur.execute(
            'INSERT INTO activity_logs (user_id, booking_id, action, details) '
            'VALUES (%s, %s, %s, %s)',
            (user_id, booking_id, 'DELETE', f'Archived booking #{booking_id}')
        )

        conn.commit()
        return jsonify(message='Booking archived.', booking_id=booking_id), 200

    except Exception:
        if conn is not None:
            try:
                conn.rollback()
            except Exception:
                current_app.logger.exception('Could not roll back failed Archive operation.')
        current_app.logger.exception('Could not archive booking.')
        return jsonify(error='Could not archive booking. Please try again.'), 500

    finally:
        if cur is not None:
            try:
                cur.close()
            except Exception:
                current_app.logger.exception('Could not close database cursor.')
        if conn is not None:
            try:
                conn.close()
            except Exception:
                current_app.logger.exception('Could not close database connection.')


@views.route('/api/records/<booking_id>/restore', methods=['POST'])
def restore_record(booking_id):
    user_id = session.get('user_id')
    if user_id is None:
        return jsonify(error='Authentication required.'), 401

    if session.get('role') not in ('Admin', 'User'):
        return jsonify(error='This account is not allowed to perform this action.'), 403

    if (
        not booking_id.isascii()
        or not booking_id.isdigit()
        or len(booking_id) > 10
        or int(booking_id) < 1
        or int(booking_id) > 2147483647
    ):
        return jsonify(error='Booking ID must be a positive integer.'), 400

    booking_id = int(booking_id)
    conn = None
    cur = None

    try:
        conn = db.get_connection()
        conn.start_transaction()
        cur = conn.cursor(dictionary=True)

        cur.execute(
            'SELECT deleted_at FROM booking WHERE booking_id = %s FOR UPDATE',
            (booking_id,)
        )
        booking = cur.fetchone()

        if booking is None:
            conn.rollback()
            return jsonify(error='Booking record was not found.'), 404

        if booking['deleted_at'] is None:
            conn.rollback()
            return jsonify(error='Booking record is not in Archive.'), 409

        cur.execute(
            'UPDATE booking '
            'SET deleted_at = NULL, deleted_by = NULL '
            'WHERE booking_id = %s AND deleted_at IS NOT NULL',
            (booking_id,)
        )

        if cur.rowcount != 1:
            conn.rollback()
            return jsonify(error='Booking record could not be restored.'), 409

        cur.execute(
            'INSERT INTO activity_logs (user_id, booking_id, action, details) '
            'VALUES (%s, %s, %s, %s)',
            (user_id, booking_id, 'RESTORE',
             f'Restored booking #{booking_id} from Archive')
        )

        conn.commit()
        return jsonify(
            message='Booking restored successfully.',
            booking_id=booking_id
        ), 200

    except Exception:
        if conn is not None:
            try:
                conn.rollback()
            except Exception:
                current_app.logger.exception(
                    'Could not roll back failed Restore operation.'
                )
        current_app.logger.exception('Could not restore booking.')
        return jsonify(
            error='Could not restore booking. Please try again.'
        ), 500

    finally:
        if cur is not None:
            try:
                cur.close()
            except Exception:
                current_app.logger.exception('Could not close database cursor.')
        if conn is not None:
            try:
                conn.close()
            except Exception:
                current_app.logger.exception('Could not close database connection.')


@views.route('/api/profile')
def api_profile():
    conn = db.get_connection()
    cur = conn.cursor(dictionary=True)

    try:
        cur.execute("SELECT full_name AS name, role FROM users WHERE user_id = %s",
                    (session['user_id'],))
        return jsonify(cur.fetchone())
    finally:
        cur.close()
        conn.close()

@views.route('/api/profile', methods=['POST'])
def update_profile():
    data = request.get_json(silent=True) or {}
    name = str(data.get('name', '')).strip()

    if not name or len(name) > 100:
        return jsonify(error='Name is required (max 100 characters).'), 400

    conn = db.get_connection()
    cur = conn.cursor()
    try:
        cur.execute("UPDATE users SET full_name = %s WHERE user_id = %s",
                    (name, session['user_id']))
        cur.execute("INSERT INTO activity_logs (user_id, action, details) VALUES (%s, %s, %s)",
                    (session['user_id'], 'Profile Update', f'Updated profile name to {name}'))
        conn.commit()
        session['full_name'] = name
        return jsonify(message='Profile updated.', name=name)
    except Exception:
        conn.rollback()
        current_app.logger.exception('Could not update profile.')
        return jsonify(error='Could not update profile. Please try again.'), 500
    finally:
        cur.close()
        conn.close()

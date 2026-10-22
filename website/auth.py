from flask import Blueprint, render_template, request, flash, redirect, url_for, session
from werkzeug.security import check_password_hash
from . import db

auth = Blueprint('auth', __name__)

@auth.route('/', methods=['GET','POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username', '')
        password = request.form.get('password', '')

        conn = db.get_connection()
        cur = None
        try:
            cur = conn.cursor(dictionary=True)
            cur.execute("SELECT * FROM users WHERE username = %s", (username,))
            user = cur.fetchone()

            if user and check_password_hash(user['password_hash'], password):
                session['user_id'] = user['user_id']
                session['full_name'] = user['full_name']
                session['role'] = user['role']

                cur.execute(
                    'INSERT INTO activity_logs (user_id, booking_id, action, details) '
                    'VALUES (%s, %s, %s, %s)',
                    (user['user_id'], None, 'LOGIN', 'Successful login')
                )
                conn.commit()
                return redirect(url_for('views.dashboard'))

            flash('Wrong username or password.')
        finally:
            if cur is not None:
                cur.close()
            conn.close()


    return render_template("index.html", boolean = True)

@auth.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('views.index'))



#@auth.route('/dashboard', methods=['GET','POST'])
#def dashboard():
#    return render_template("dashboard.html")

#@auth.route('/logs', methods=['GET','POST'])
#def logs():
    return render_template("logs.html")

#@auth.route('/profile', methods=['GET','POST'])
#def profile():
    return render_template("profile.html")

#@auth.route('/reports', methods=['GET','POST'])
#def reports():
    return render_template("reports.html")

#@auth.route('/trash', methods=['GET','POST'])
#def trash():
    return render_template("trash.html")

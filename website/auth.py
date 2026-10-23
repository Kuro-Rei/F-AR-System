from flask import Blueprint, render_template, request, flash, redirect, url_for, session, current_app, jsonify
from werkzeug.security import check_password_hash, generate_password_hash
from email.message import EmailMessage
import hashlib, hmac, os, secrets, smtplib
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

                # Remember Me 
                remember = request.form.get('remember') == 'on'
                session.clear()
                session.permanent = remember


                session['user_id'] = user['user_id']
                session['full_name'] = user['full_name']
                session['role'] = user['role']

                # record login in activity logs
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


# char for reset code
CODE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

def _code_hash(email, code):
    key = current_app.config['SECRET_KEY'].encode()
    return hmac.new(key, f'{email}:{code}'.encode(), hashlib.sha256).hexdigest()


# remove space and dashes and make it uppercase
def _clean_code(raw):
    return ''.join(ch for ch in raw.upper() if ch.isalnum())


#sends an email containing the reset code to the given address
def send_reset_email(to, code):
    msg = EmailMessage()
    msg['Subject'] = 'Your password reset code'
    msg['From'] = os.environ['MAIL_USER']
    msg['To'] = to
    msg.set_content(
        f'Your password reset code is: {code[:4]}-{code[4:]}\n\n'
        'It expires in 15 minutes. If you did not request this, you can ignore this email.'
    )
    with smtplib.SMTP_SSL('smtp.gmail.com', 465) as s:
        s.login(os.environ['MAIL_USER'], os.environ['MAIL_PASSWORD'])
        s.send_message(msg)



@auth.route('/forgot-password', methods=['POST'])
def forgot_password():
    email = request.form.get('email', '').strip().lower()
    code = ''.join(secrets.choice(CODE) for _ in range(8)) # Choose 8 random chaacters from the CODE constant

    conn = db.get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "UPDATE users SET reset_password_hash = %s, "
            "reset_password_expiration = DATE_ADD(NOW(), INTERVAL 15 MINUTE) "
            "WHERE email = %s",
            (_code_hash(email, code), email))
        conn.commit()
        found = cur.rowcount == 1
    finally:
        cur.close()
        conn.close()

    if found:
        try:
            send_reset_email(email, code)
        except Exception:
            current_app.logger.exception('Could not send reset email.')

    return jsonify(message='If that email is registered, a reset code has been sent.')



@auth.route('/reset-password', methods=['POST'])
def reset_password():
    email = request.form.get('email', '').strip().lower()
    code = _clean_code(request.form.get('code', ''))
    pw = request.form.get('password', '')

    # <8 password character error message
    if len(pw) < 8 or pw != request.form.get('confirm', ''):
        return jsonify(error='Passwords must match and must be at least 8 characters.'), 400

    conn = db.get_connection()
    cur = conn.cursor(dictionary=True)
    try:
        # find user that have not yet expired their reset code 
        cur.execute(
            "SELECT user_id, reset_password_hash FROM users "
            "WHERE email = %s AND reset_password_hash IS NOT NULL "
            "AND reset_password_expiration > NOW()",
            (email,))
        user = cur.fetchone()

        if not user or not hmac.compare_digest(user['reset_password_hash'], _code_hash(email, code)):
            return jsonify(error='Invalid or expired code.'), 400

        # save hashed passowrd
        cur.execute(
            "UPDATE users SET password_hash = %s, "
            "reset_password_hash = NULL, reset_password_expiration = NULL "
            "WHERE user_id = %s",
            (generate_password_hash(pw), user['user_id']))
        conn.commit()
        return jsonify(message='Password updated. You can log in now.')
    finally:
        cur.close()
        conn.close()



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

from flask import Blueprint, render_template, request, flash, redirect, url_for, session

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
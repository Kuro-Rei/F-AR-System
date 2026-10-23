from flask import Flask
from pathlib import Path
import os
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / '.env', encoding='utf-8-sig')
print('MAIL_USER loaded:', bool(os.environ.get('MAIL_USER')))

def create_app():
    app = Flask(__name__)
    app.config['SECRET_KEY'] = 'GodWillProvide'

    from .views import views
    from .auth import auth

    app.register_blueprint(views, url_prefix='/')
    app.register_blueprint(auth, url_prefix='/')

    return app
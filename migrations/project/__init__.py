# project/__init__.py


#################
#### imports ####
#################

import os

from flask import Flask, render_template
from flask.ext.login import LoginManager
from flask.ext.bcrypt import Bcrypt
from flask_mail import Mail
from flask.ext.debugtoolbar import DebugToolbarExtension
from flask.ext.sqlalchemy import SQLAlchemy


################
#### config ####
################

app = Flask(__name__)

app.config.from_object(os.environ['APP_SETTINGS'])
app.config['FLASK_ADMIN_SWATCH'] = 'cerulean'
####################
#### extensions ####
####################

login_manager = LoginManager()
login_manager.init_app(app)
bcrypt = Bcrypt(app)
mail = Mail(app)
toolbar = DebugToolbarExtension(app)
db = SQLAlchemy(app)


####################
#### blueprints ####
####################

from project.main.views import main_blueprint
from project.user.views import user_blueprint
from project.mixer.views import mixer_blueprint
app.register_blueprint(main_blueprint)
app.register_blueprint(user_blueprint)
app.register_blueprint(mixer_blueprint)


####################
#### flask-login ####
####################

from project.models import User, Track

login_manager.login_view = "user.login"
login_manager.login_message_category = "danger"


@login_manager.user_loader
def load_user(user_id):
    return User.query.filter(User.id == int(user_id)).first()


########################
#### error handlers ####
########################

@app.errorhandler(403)
def forbidden_page(error):
    return render_template("errors/403.html"), 403


@app.errorhandler(404)
def page_not_found(error):
    return render_template("errors/404.html"), 404


@app.errorhandler(500)
def server_error_page(error):
    return render_template("errors/500.html"), 500




###################
### Flask ADMIN ###
###################

from flask_admin import Admin
from project.admin.views import AdminView

admin = Admin(app, name='Mixer', template_mode='bootstrap3')
admin.add_view(AdminView(User, db.session, name='UserAdmin', endpoint='users_'))
admin.add_view(AdminView(Track, db.session, name='TracksAdmin', endpoint='tracks_'))

#############################
###  Mixer Configuration  ###
#############################

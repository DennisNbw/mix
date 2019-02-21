from flask_admin.contrib.sqla import ModelView
from flask import session, redirect, url_for, request, abort
from flask.ext.login import current_user, AnonymousUserMixin
from flask_admin import Admin, expose, AdminIndexView
class AdminView(ModelView):

    def __init__(self, *args, **kwargs):
        ModelView.__init__(self, *args, **kwargs)
        self.static_folder = 'static'

    def is_accessible(self):
        if current_user.is_authenticated():
            return current_user.is_admin
        else:
            return False

    def inaccessible_callback(self, name, **kwargs):
        if not self.is_accessible():
            abort(401)
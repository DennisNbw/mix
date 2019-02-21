# project/user/forms.py


from flask_wtf import Form
from wtforms import TextField, PasswordField, validators
from wtforms.validators import DataRequired, Email, Length, EqualTo

from project.models import User


class InviteForm(Form):
    email = TextField('email', validators=[DataRequired(), Email()])


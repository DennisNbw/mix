# project/main/views.py


#################
#### imports ####
#################

from flask import render_template, Blueprint, url_for, flash
from flask.ext.login import login_required
from flask import request
from .forms import InviteForm
from project.email import send_email
from project.models import User

################
#### config ####
################

main_blueprint = Blueprint('main', __name__,)


################
#### routes ####
################

@main_blueprint.route('/invite', methods=['GET', 'POST'])
@login_required
def home():
    form = InviteForm(request.form)
    logged_user = User.query.filter_by(email=request.args.get('email')).first()
    referred_users = list(User.query.filter_by(referred_by=logged_user.id))
    
    if form.validate_on_submit():
        referral_id = request.args.get('id')

        recipient = form.email.data

        referral_url = url_for('user.register', referral_id=referral_id, _external=True)
        html = render_template('user/invite.html', confirm_url=referral_url)
        subject = "Invite to Join Portal"
        send_email(recipient, subject, html)

        form.email.data = ""
        flash('Invite has been successfully sent to your friend!', 'success')

    return render_template('main/index.html',
                           email=request.args.get('email'),
                           id=request.args.get('id'),
                           form=form,
                           points=logged_user.referral_points,
                           referred_users=referred_users)

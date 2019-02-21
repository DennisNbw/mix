from flask import render_template, Blueprint
from flask.ext.login import login_required
from project.models import User, Track
from flask import request, jsonify
from flask_login import current_user
from project import db


mixer_blueprint = Blueprint('mixer', __name__)

@mixer_blueprint.route('/', methods=['GET'])
@login_required
def mixer():
    logged_user = User.query.filter_by(email=request.args.get('email')).first()
    print(User)
    return render_template('mixer/index.html')


@mixer_blueprint.route('/tracks/', methods=['GET'])
@login_required
def list_tracks():
    page = request.args.get('page', 1, type=int)
    tracks = Track.query.order_by(Track.date_posted.desc()).paginate(page=page, per_page=5)
    return render_template('mixer/tracklist.html', tracks=tracks)

@mixer_blueprint.route('/user/<user_id>', methods=['GET'])
@login_required
def user_tracks(user_id):
    user = User.query.filter_by(id=user_id).first_or_404()
    page = request.args.get('page', 1, type=int)
    tracks = Track.query.filter_by(owner=user.id)\
            .order_by(Track.date_posted.desc())\
            .paginate(page=page, per_page=5)
    return render_template('mixer/usertracks.html', tracks=tracks, user=user)

@mixer_blueprint.route('/tracks/add/', methods=['POST'])
@login_required
def tracks():
    print ('POST REQUEST RECIEVED')
    if request.method == 'POST':
        track = Track(owner=_get_user(), name=request.form['filename'], url=request.form['url'], caption=request.form['caption'], description=request.form['description'])
        db.session.add(track)
        db.session.commit()
        l = [track.owner, track.name, track.url]
        return jsonify({'data': render_template('response.html', mylist=l)})


def _get_user():
    return current_user.id if current_user.is_authenticated else None

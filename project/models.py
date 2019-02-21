# project/models.py


import datetime

from project import db, bcrypt
class User(db.Model):

    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String, unique=True, nullable=False)
    password = db.Column(db.String, nullable=False)
    referral_id = db.Column(db.String, nullable=False)
    referral_points = db.Column(db.Integer, default=0)
    registered_on = db.Column(db.DateTime, nullable=False)
    admin = db.Column(db.Boolean, nullable=False, default=False)
    confirmed = db.Column(db.Boolean, nullable=False, default=False)
    confirmed_on = db.Column(db.DateTime, nullable=True)
    referred_by = db.Column(db.Integer, nullable=True)
    tracks = db.relationship('Track', backref='uploader', lazy=True)

    def __init__(self, email, password, confirmed, paid=False, admin=False, confirmed_on=None, referred_by=None):
        self.email = email
        self.password = bcrypt.generate_password_hash(password)
        self.referral_id = email.split('@')[0] + '-REFERS'
        self.registered_on = datetime.datetime.now()
        self.admin = admin
        self.confirmed = confirmed
        self.confirmed_on = confirmed_on
        self.referred_by = referred_by

    def is_authenticated(self):
        return True

    def is_active(self):
        return True

    def is_anonymous(self):
        return False

    def get_id(self):
        return self.id
    
    def is_admin(self):
        return self.admin

    def __repr__(self):
        return '<email {}'.format(self.email)


class Track(db.Model):
    id   = db.Column('id', db.Integer, primary_key=True)
    owner = db.Column(db.Integer, db.ForeignKey('users.id'),nullable=False)
    name = db.Column('name', db.String(50), nullable=False)
    url  = db.Column('url', db.String(250), unique=True, nullable=False)
    caption = db.Column('caption', db.String(100), nullable=True)
    description = db.Column('description', db.String(250), nullable=True)
    date_posted = db.Column(db.DateTime, nullable=False,default=datetime.datetime.now)

    def __init__(self, owner, name, url, caption, description):
        self.owner = owner
        self.name = name
        self.url = url
        self.caption = caption
        self.description = description

    def __repr__(self):
        return 'Name: '+self.name+','+self.url
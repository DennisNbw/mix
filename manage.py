# manage.py


import os
import unittest
import coverage
import datetime

from flask.ext.script import Manager # no accurate check spellings
from flask_migrate import Migrate, MigrateCommand

from project import app, db
from project.models import User


app.config.from_object(os.environ['APP_SETTINGS'])

migrate = Migrate(app, db)
manager = Manager(app)

# migrations
manager.add_command('db', MigrateCommand)
""" 
You need to tell PyCharm which interpreter you are using.can you send mesourced code.i will look at it today
Let's say you use some virtualenv, on a Mac (is similar on Linux) go to File > Default Settings > Project Interpreter

Then click on the little mechanic wheel next to the project interpreter dropdown menu and choose 'add local' and
pick your interpreter (e.i. the virtual environment you use in which you installed flask).

Hope this helps



from flask.ext.script import Manager, Server
#from tumblelog import app

manager = Manager(app)

 # Turn on debugger by default and reloader 
manager.add_command("runserver", Server(
    use_debugger = True,
    use_reloader = True,
    host = '0.0.0.0') )

#"""

@manager.command
def test():
    """Runs the unit tests without coverage."""
    tests = unittest.TestLoader().discover('tests')
    result = unittest.TextTestRunner(verbosity=2).run(tests)
    if result.wasSuccessful():
        return 0
    else:
        return 1


@manager.command
def cov():
    """Runs the unit tests with coverage."""
    cov = coverage.coverage(branch=True, include='project/*')
    cov.start()
    tests = unittest.TestLoader().discover('tests')
    unittest.TextTestRunner(verbosity=2).run(tests)
    cov.stop()
    cov.save()
    print('Coverage Summary:')
    cov.report()
    basedir = os.path.abspath(os.path.dirname(__file__))
    covdir = os.path.join(basedir, 'tmp/coverage')
    cov.html_report(directory=covdir)
    print('HTML version: file://%s/index.html' % covdir)
    cov.erase()


@manager.command
def create_db():
    """Creates the db tables."""
    db.create_all()


@manager.command
def drop_db():
    """Drops the db tables."""
    db.drop_all()


@manager.command
def create_admin():
    """Creates the admin user."""
    db.session.add(User(email="ad@min.com",
                        password="admin",
                        confirmed=True,
                        confirmed_on=datetime.datetime.now()
                        ))
    db.session.commit()


if __name__ == '__main__':
    manager.run()

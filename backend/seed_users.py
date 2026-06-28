"""
Quick setup script — run this ONCE to create demo users.

Usage:
    cd d:\\Projects\\SafeStep\\backend
    python seed_users.py
"""
import os, sys
os.chdir(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, '.')

from app import create_app, db
from app.models.user import User

app = create_app()

with app.app_context():
    db.create_all()

    users = [
        dict(
            name='Police Admin',
            phone='+919999999999',
            email='admin@safestep.ap',
            password='admin123',
            emergency_contacts=[],
        ),
        dict(
            name='Demo User (Priya)',
            phone='+918888888888',
            email='priya@safestep.ap',
            password='user123',
            emergency_contacts=[
                {'name': 'Mom', 'phone': '+917777777777', 'priority': 1},
                {'name': 'Dad', 'phone': '+916666666666', 'priority': 2},
            ],
        ),
        dict(
            name='Guardian (Family)',
            phone='+917777777777',
            email='guardian@safestep.ap',
            password='guardian123',
            emergency_contacts=[],
        ),
    ]

    created = 0
    for u_data in users:
        try:
            existing = User.query.filter_by(phone=u_data['phone']).first()
            if existing:
                print(f'  [SKIP] {u_data["phone"]} already exists')
                continue
            u = User(
                name=u_data['name'],
                phone=u_data['phone'],
                email=u_data['email'],
                emergency_contacts=u_data['emergency_contacts'],
            )
            u.set_password(u_data['password'])
            db.session.add(u)
            db.session.commit()
            created += 1
            print(f'  [OK] Created: {u_data["name"]} ({u_data["phone"]})')
        except Exception as e:
            db.session.rollback()
            print(f'  [ERR] {u_data["phone"]}: {e}')

    print(f'\nDone — {created} user(s) created.\n')
    print('─' * 55)
    print('POLICE DASHBOARD  →  http://localhost:3002')
    print('  Login: +919999999999  /  admin123')
    print()
    print('GUARDIAN DASHBOARD  →  http://localhost:3001')
    print('  Login: +917777777777  /  guardian123')
    print()
    print('MOBILE APP user:')
    print('  Login: +918888888888  /  user123')
    print('─' * 55)


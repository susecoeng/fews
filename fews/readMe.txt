************************************************************************
SETUP DATABASE
************************************************************************
https://www.geeksforgeeks.org/postgresql-psql-commands/

1.  Enter to pgsql environment
    - sudo -i -u postgres
    - psql

    OR
    - psql postgres

2.  Create database
    - CREATE DATABASE malawi_cbfews;

    -> to delete database
        DROP DATABASE malawi_cbfews;

3.  Create user for application to connect to this database
    - CREATE USER cbfewsmalawi WITH PASSWORD 'cbfews123';

    -> To delete user
        DROP USER cbfewsmalawi;
        
4. Modify a few of the connection parameters for the user we just created. 
   This will speed up database operations so that the correct values do not
    have to be queried and set each time a connection is established.

    - ALTER ROLE cbfewsmalawi SET client_encoding TO 'utf8';
    - ALTER ROLE cbfewsmalawi SET default_transaction_isolation TO 'read committed';
    - ALTER ROLE cbfewsmalawi SET timezone TO 'UTC';

5. Give our user access rights to the database.
    - GRANT ALL PRIVILEGES ON DATABASE malawi_cbfews TO cbfewsmalawi;

6. Exit the SQL prompt
    - \q

7. Migrate database
    - myapps --dbmigrate
    OR
    - python manage.py makemigrations
    - python manage.py migrate

8. Create administrative account
    - myapps --createsuperuser
    OR
    - python manage.py createsuperuser

9. Load data into database
    - python manage.py loaddata fixture.json

10. in server use following 
    - python manage.py collectstatic
************************************************************************
************************************************************************
CONFIGURE settings.py FOR pgsql connection
************************************************************************
0. CHECK AND INSTALL FOR 'psycopg2' PACKAGE
    - pip install psycopg2
    
1. Replace by following
    DATABASES = {
            # 'default': {
            #     'ENGINE': 'django.db.backends.sqlite3',
            #     'NAME': os.path.join(BASE_DIR, 'db.sqlite3'),
            # }
            'default': {
                'ENGINE': 'django.db.backends.postgresql_psycopg2',
                'NAME': 'cbfews',
                'USER': 'cbfewsuser',
                'PASSWORD': 'cbfews123',
                'HOST': 'localhost',
                'PORT': '5432',
            }
        }
************************************************************************
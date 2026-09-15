import os
# Test collection must never require a developer PostgreSQL server.
os.environ.setdefault('DATABASE_URL','sqlite:///./test-suite.db')
os.environ.setdefault('ENVIRONMENT','test')
os.environ.setdefault('STORAGE_PROVIDER','mock')
os.environ.setdefault('EMAIL_PROVIDER','mock')

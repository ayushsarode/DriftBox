from mongoengine import Document, StringField, DateTimeField, ReferenceField
from datetime import datetime

class User(Document):
    username = StringField(required=True, unique=True)
    password_hash = StringField(required=True)

class File(Document):
    owner = ReferenceField(User)
    file_name = StringField(required=True)
    gcs_url = StringField(required=True)
    upload_time = DateTimeField(default=datetime.utcnow)
    expires_at = DateTimeField(required=True)
    scan_status = StringField(choices=["pending", "clean", "infected"], default="pending")

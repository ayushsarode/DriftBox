# VaultDocs API Documentation (currently working)

DriftBox is a cloud storage API that allows users to create folders, upload files (up to 50MB), and manage their storage (2GB limit per user).

## Features

- User authentication (email/password + Google OAuth)
- Folder management (create, list, delete)
- File upload to Google Cloud Storage (up to 50MB per file)
- Storage limit enforcement (2GB per user)
- File deduplication using MD5 hashes
- Secure file downloads with proxy streaming (no GCS permission issues)
- Fallback signed URL support for advanced use cases


- `users` - User accounts
- `folders` - Folder structure
- `files` - File metadata
- `user_storage` - Storage usage tracking

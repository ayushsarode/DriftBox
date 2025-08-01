# DriftBox API Documentation

DriftBox is a cloud storage API that allows users to create folders, upload files (up to 50MB), and manage their storage (2GB limit per user).

## Features

- User authentication (email/password + Google OAuth)
- Folder management (create, list, delete)
- File upload to Google Cloud Storage (up to 50MB per file)
- Storage limit enforcement (2GB per user)
- File deduplication using MD5 hashes
- Secure file downloads using signed URLs

## Setup

### Prerequisites

1. MongoDB Atlas cluster
2. Google Cloud Storage bucket
3. Google OAuth 2.0 credentials

### Environment Variables

```bash
# Database
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/driftbox

# JWT
JWT_SECRET=your-jwt-secret

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URL=http://localhost:8000/auth/google/callback

# Google Cloud Storage
GCS_BUCKET_NAME=your-gcs-bucket-name
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
```

## API Endpoints

### Authentication

#### Register

```
POST /register
Content-Type: application/json

{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "securepassword123"
}
```

#### Login

```
POST /login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "securepassword123"
}

Response:
{
  "token": "jwt-token-here",
  "user": {
    "id": "user-id",
    "name": "john_doe",
    "email": "john@example.com"
  }
}
```

#### Google OAuth

```
GET /auth/google
Response: { "auth_url": "https://accounts.google.com/oauth/..." }

GET /auth/google/callback?code=...&state=...
Response: Same as login
```

### Protected Endpoints (Require Authorization Header)

All protected endpoints require:

```
Authorization: Bearer <jwt-token>
```

#### Folder Management

##### Create Folder

```
POST /api/folders
Content-Type: application/json

{
  "name": "My Documents",
  "parent_id": "optional-parent-folder-id"
}
```

##### List Folders

```
GET /api/folders?parent_id=optional-parent-folder-id
```

##### Delete Folder

```
DELETE /api/folders/{folder-id}
```

#### File Management

##### Upload File

```
POST /api/files/upload
Content-Type: multipart/form-data

Form fields:
- file: (file upload, max 50MB)
- folder_id: (optional) target folder ID
```

##### List Files

```
GET /api/files?folder_id=optional-folder-id
```

##### Download File

```
GET /api/files/{file-id}/download
GET /api/files/{file-id}/download?redirect=true

Response:
{
  "download_url": "signed-gcs-url",
  "expires_in": "1 hour"
}
```

##### Delete File

```
DELETE /api/files/{file-id}
```

#### Storage Information

##### Get Storage Stats

```
GET /api/storage

Response:
{
  "storage": {
    "user_id": "user-id",
    "used_space": 1048576,
    "max_space": 2147483648,
    "file_count": 10,
    "folder_count": 3
  },
  "usage_percentage": 0.05
}
```

## File Storage Structure

Files are stored in Google Cloud Storage with the following structure:

```
users/{user-id}/files/{file-id}.{extension}
```

## Limitations

- Maximum file size: 50MB
- Maximum storage per user: 2GB
- File deduplication prevents duplicate uploads
- Signed URLs expire after 1 hour

## Running the Server

```bash
go run main.go
```

Server will start on port 8000 (or PORT environment variable).

## Database Collections

- `users` - User accounts
- `folders` - Folder structure
- `files` - File metadata
- `user_storage` - Storage usage tracking

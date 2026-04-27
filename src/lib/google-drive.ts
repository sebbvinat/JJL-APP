import { google } from 'googleapis';
import type { Readable } from 'stream';

function getAuth() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not configured');
  }

  const key = JSON.parse(keyJson);
  return new google.auth.GoogleAuth({
    credentials: key,
    scopes: [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
  });
}

// List all files inside a Drive folder (not trashed), filter videos client-side
export async function listDriveFolderVideos(folderId: string) {
  const result = await listDriveFolderAll(folderId);
  return result.videos;
}

// Detailed listing — returns both the filtered video list and all raw files so
// the admin diagnostic can show *exactly* what Drive returned for a folder.
// Useful when uploads aren't being detected: you can see if Drive returns
// nothing (permission/folder mismatch) vs returns files our filter discards
// (mime/extension issue).
export async function listDriveFolderAll(folderId: string, opts: { recursive?: boolean; maxDepth?: number } = {}) {
  const { recursive = true, maxDepth = 5 } = opts;
  const auth = getAuth();
  const drive = google.drive({ version: 'v3', auth });

  const videoExts = /\.(mp4|mov|avi|mkv|webm|m4v|3gp|wmv|flv|mpeg|mpg)$/i;
  const isVideo = (f: { mimeType?: string | null; name?: string | null }) => {
    const mime = f.mimeType || '';
    const name = f.name || '';
    return mime.startsWith('video/') ||
      mime === 'application/vnd.google-apps.video' ||
      videoExts.test(name);
  };

  const all: any[] = [];
  const folders: any[] = [];
  const visited = new Set<string>();

  async function walk(id: string, depth: number) {
    if (visited.has(id) || depth > maxDepth) return;
    visited.add(id);
    const res = await drive.files.list({
      q: `'${id}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink, thumbnailLink, owners(emailAddress, displayName))',
      pageSize: 500,
      orderBy: 'createdTime desc',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    const files = res.data.files || [];
    for (const f of files) {
      if (f.mimeType === 'application/vnd.google-apps.folder') {
        folders.push(f);
        if (recursive && f.id) await walk(f.id, depth + 1);
      } else {
        all.push(f);
      }
    }
  }

  await walk(folderId, 0);

  return {
    all,
    videos: all.filter(isVideo),
    nonVideos: all.filter((f) => !isVideo(f)),
    folders,
  };
}

// List subfolders inside the main JJL Drive folder. Used by sync to match
// student names to folders for users that never created their folder via the
// app (so users.drive_folder_id is null).
export async function listMainSubfolders() {
  const auth = getAuth();
  const drive = google.drive({ version: 'v3', auth });
  const parentId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!parentId) return [];

  const res = await drive.files.list({
    q: `'${parentId}' in parents and trashed = false and mimeType = 'application/vnd.google-apps.folder'`,
    fields: 'files(id, name)',
    pageSize: 500,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return res.data.files || [];
}

function buildFinalName(fileName: string, userName: string) {
  const date = new Date().toISOString().split('T')[0];
  const ext = fileName.split('.').pop() || 'mp4';
  const cleanName = userName.replace(/\s+/g, '_');
  return `${cleanName}_${date}.${ext}`;
}

// Create a resumable upload session — returns a URL the browser can PUT to directly
export async function createResumableUploadSession(
  fileName: string,
  mimeType: string,
  userName: string,
  fileSize: number
) {
  const auth = getAuth();
  const accessToken = await auth.getAccessToken();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const finalName = buildFinalName(fileName, userName);

  const metadata: Record<string, any> = { name: finalName };
  // IMPORTANT: parents must be set so the file is created IN the shared folder
  // (owned by the folder owner, not the service account — avoids storage quota error)
  if (folderId) metadata.parents = [folderId];

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': mimeType,
        'X-Upload-Content-Length': String(fileSize),
      },
      body: JSON.stringify(metadata),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Drive resumable init failed: ${res.status} ${text}`);
  }

  const uploadUrl = res.headers.get('location');
  if (!uploadUrl) throw new Error('No upload URL returned from Drive');

  return { uploadUrl, finalName };
}

// After browser finishes uploading, fetch the file metadata to get webViewLink
// Create a subfolder inside the main Drive folder (for per-student folders)
export async function createDriveFolder(folderName: string) {
  const auth = getAuth();
  const drive = google.drive({ version: 'v3', auth });
  const parentId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  const response = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined,
    },
    fields: 'id, name, webViewLink',
    supportsAllDrives: true,
  });

  // Make the folder accessible to anyone with the link (so students can upload)
  await drive.permissions.create({
    fileId: response.data.id!,
    requestBody: {
      role: 'writer',
      type: 'anyone',
    },
    supportsAllDrives: true,
  });

  return {
    folderId: response.data.id,
    folderName: response.data.name,
    webViewLink: response.data.webViewLink,
  };
}

export async function getDriveFileInfo(fileId: string) {
  const auth = getAuth();
  const drive = google.drive({ version: 'v3', auth });
  const { data } = await drive.files.get({
    fileId,
    fields: 'id, name, webViewLink',
  });
  return {
    fileId: data.id,
    fileName: data.name,
    webViewLink: data.webViewLink,
  };
}

export async function uploadToDriveStream(
  body: Readable,
  fileName: string,
  mimeType: string,
  userName: string
) {
  const auth = getAuth();
  const drive = google.drive({ version: 'v3', auth });
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const finalName = buildFinalName(fileName, userName);

  const response = await drive.files.create({
    requestBody: {
      name: finalName,
      parents: folderId ? [folderId] : undefined,
    },
    media: {
      mimeType,
      body,
    },
    fields: 'id, name, webViewLink',
  });

  return {
    fileId: response.data.id,
    fileName: response.data.name,
    webViewLink: response.data.webViewLink,
  };
}

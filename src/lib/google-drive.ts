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
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });
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
  if (folderId) metadata.parents = [folderId];

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,webViewLink',
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

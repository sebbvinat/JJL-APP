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

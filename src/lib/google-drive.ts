import { google } from 'googleapis';
import { Readable } from 'stream';

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

export async function uploadToDrive(
  file: Buffer,
  fileName: string,
  mimeType: string,
  userName: string
) {
  const auth = getAuth();
  const drive = google.drive({ version: 'v3', auth });
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  // Rename: NombreUsuario_2026-04-12.mp4
  const date = new Date().toISOString().split('T')[0];
  const ext = fileName.split('.').pop() || 'mp4';
  const cleanName = userName.replace(/\s+/g, '_');
  const finalName = `${cleanName}_${date}.${ext}`;

  const stream = new Readable();
  stream.push(file);
  stream.push(null);

  const response = await drive.files.create({
    requestBody: {
      name: finalName,
      parents: folderId ? [folderId] : undefined,
    },
    media: {
      mimeType,
      body: stream,
    },
    fields: 'id, name, webViewLink',
  });

  return {
    fileId: response.data.id,
    fileName: response.data.name,
    webViewLink: response.data.webViewLink,
  };
}

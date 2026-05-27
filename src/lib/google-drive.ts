import { google } from 'googleapis';
import type { Readable } from 'stream';
import { getAuthenticatedOAuthClient } from '@/lib/google-oauth';

type DriveAuth = Awaited<ReturnType<typeof getAuthenticatedOAuthClient>> | ReturnType<typeof getServiceAccountAuth>;

function getServiceAccountAuth() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not configured');
  }
  const key = JSON.parse(keyJson);
  return new google.auth.GoogleAuth({
    credentials: key,
    scopes: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
  });
}

/**
 * Prefiere OAuth (admin conectado vía /admin/google-drive) sobre el service
 * account. Cuando hay OAuth disponible, las subidas quedan a nombre del
 * admin que conectó → usan SU cuota de Drive (~15GB free, o Google One)
 * en vez de la del service account (que es 0 y causa 403 storage).
 *
 * Si no hay OAuth todavía, cae al service account (compat — lecturas y
 * creación de carpetas siguen funcionando; las subidas siguen fallando
 * con 403 hasta que se conecte OAuth).
 */
async function getAuth(): Promise<NonNullable<DriveAuth>> {
  const oauth = await getAuthenticatedOAuthClient();
  if (oauth) return oauth;
  return getServiceAccountAuth();
}

// Helper: normaliza getAccessToken() entre GoogleAuth (devuelve string) y
// OAuth2Client (devuelve { token, res }).
async function getAccessTokenString(auth: NonNullable<DriveAuth>): Promise<string> {
  const result = await (auth as { getAccessToken: () => Promise<unknown> }).getAccessToken();
  if (typeof result === 'string') return result;
  if (result && typeof result === 'object' && 'token' in result) {
    const t = (result as { token: unknown }).token;
    return typeof t === 'string' ? t : '';
  }
  return '';
}

export async function listDriveFolderVideos(folderId: string) {
  const result = await listDriveFolderAll(folderId);
  return result.videos;
}

export async function listDriveFolderAll(folderId: string, opts: { recursive?: boolean; maxDepth?: number } = {}) {
  const { recursive = true, maxDepth = 5 } = opts;
  const auth = await getAuth();
  const drive = google.drive({ version: 'v3', auth });

  const videoExts = /\.(mp4|mov|avi|mkv|webm|m4v|3gp|wmv|flv|mpeg|mpg)$/i;
  const isVideo = (f: { mimeType?: string | null; name?: string | null }) => {
    const mime = f.mimeType || '';
    const name = f.name || '';
    return mime.startsWith('video/') ||
      mime === 'application/vnd.google-apps.video' ||
      videoExts.test(name);
  };

  type DriveFile = { id?: string | null; name?: string | null; mimeType?: string | null; size?: string | null; createdTime?: string | null; modifiedTime?: string | null; webViewLink?: string | null; thumbnailLink?: string | null; owners?: { emailAddress?: string | null; displayName?: string | null }[] | null };
  const all: DriveFile[] = [];
  const folders: DriveFile[] = [];
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
    const files = (res.data.files || []) as DriveFile[];
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

export async function listMainSubfolders() {
  const auth = await getAuth();
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
  const auth = await getAuth();
  const accessToken = await getAccessTokenString(auth);
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const finalName = buildFinalName(fileName, userName);

  const metadata: Record<string, unknown> = { name: finalName };
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

export async function createDriveFolder(folderName: string) {
  const auth = await getAuth();
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
  const auth = await getAuth();
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
  const auth = await getAuth();
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

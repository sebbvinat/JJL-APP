import { NextResponse, type NextRequest } from 'next/server';
import { google } from 'googleapis';
import { requireAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * GET /api/admin/drive-diag — diagnostico del setup de Drive.
 *
 * Reporta:
 *  - Si el folder configurado (GOOGLE_DRIVE_FOLDER_ID) es Shared Drive
 *    o regular folder (driveId vs no driveId)
 *  - Email del service account (para compartir Drives)
 *  - Capabilities del service account sobre ese folder
 *  - Su cuota de storage (si aplica)
 *
 * Si la carpeta es regular y el service account no tiene quota, los
 * uploads van a fallar con 403 ("Service Accounts do not have storage
 * quota..."). Solución: mover el folder a un Shared Drive de Workspace
 * y agregar el service account como Content Manager.
 */
export async function GET(request: NextRequest) {
  const ctx = await requireAdmin(request);
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) return NextResponse.json({ error: 'GOOGLE_DRIVE_FOLDER_ID no configurado' }, { status: 500 });

  const keyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyRaw) return NextResponse.json({ error: 'GOOGLE_SERVICE_ACCOUNT_KEY no configurado' }, { status: 500 });

  let serviceAccountEmail: string | null = null;
  try {
    serviceAccountEmail = JSON.parse(keyRaw).client_email || null;
  } catch { /* ignore */ }

  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(keyRaw),
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  const drive = google.drive({ version: 'v3', auth });

  const checks: Record<string, unknown> = {
    service_account_email: serviceAccountEmail,
    folder_id: folderId,
  };

  // Folder info: driveId presente => Shared Drive. capabilities indica
  // si el SA puede crear archivos ahi.
  try {
    const folder = await drive.files.get({
      fileId: folderId,
      fields: 'id, name, mimeType, driveId, parents, capabilities, owners(emailAddress)',
      supportsAllDrives: true,
    });
    const data = folder.data as {
      id?: string; name?: string; mimeType?: string;
      driveId?: string; parents?: string[];
      capabilities?: Record<string, boolean>;
      owners?: { emailAddress?: string }[];
    };
    checks.folder = {
      id: data.id,
      name: data.name,
      mimeType: data.mimeType,
      is_shared_drive: !!data.driveId,
      drive_id: data.driveId || null,
      parents: data.parents || [],
      owners: (data.owners || []).map((o) => o.emailAddress),
      can_add_children: !!data.capabilities?.canAddChildren,
    };
  } catch (err) {
    checks.folder_error = err instanceof Error ? err.message : String(err);
  }

  // About (incluye storage quota del service account).
  try {
    const about = await drive.about.get({ fields: 'user(emailAddress), storageQuota' });
    const data = about.data as {
      user?: { emailAddress?: string };
      storageQuota?: { limit?: string; usage?: string };
    };
    checks.service_account_storage = {
      authenticated_as: data.user?.emailAddress || null,
      limit_bytes: data.storageQuota?.limit || null,
      usage_bytes: data.storageQuota?.usage || null,
      has_quota: data.storageQuota?.limit !== '0' && data.storageQuota?.limit !== undefined,
    };
  } catch (err) {
    checks.about_error = err instanceof Error ? err.message : String(err);
  }

  // Diagnostico final
  const folder = checks.folder as { is_shared_drive?: boolean; can_add_children?: boolean } | undefined;
  const quota = checks.service_account_storage as { has_quota?: boolean } | undefined;
  const diagnosis: string[] = [];
  if (folder?.is_shared_drive === false) {
    diagnosis.push(
      '⚠️ La carpeta NO está en un Shared Drive — es una carpeta regular. Los archivos subidos por el service account quedan a nombre del service account, que no tiene cuota de storage. Esto causa el error 403.'
    );
    diagnosis.push(
      'Fix: Crear un Shared Drive en Google Workspace, mover la carpeta dentro, y agregar el service account como "Content Manager".'
    );
  }
  if (folder?.is_shared_drive && folder?.can_add_children === false) {
    diagnosis.push('⚠️ La carpeta es Shared Drive pero el service account NO tiene permiso para crear archivos. Agregarlo como Content Manager (o superior).');
  }
  if (folder?.is_shared_drive && folder?.can_add_children) {
    diagnosis.push('✅ Setup correcto. Los uploads deberían funcionar.');
  }
  if (quota?.has_quota === false) {
    diagnosis.push('ℹ️ Service account no tiene quota propia (esto es normal). Solo Shared Drive resuelve.');
  }
  checks.diagnosis = diagnosis;

  return NextResponse.json(checks);
}

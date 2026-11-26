import { auth } from './firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message) as Partial<FirestoreErrorInfo>;
      if (parsed.error) {
        if (parsed.error.includes('Missing or insufficient permissions')) {
          return 'ไม่มีสิทธิ์เข้าถึงข้อมูล หรือโรงเรียนอยู่ในสถานะหมดอายุ (Read-only)';
        }
        return parsed.error;
      }
    } catch {
      // Non-JSON error message
    }
    if (error.message.includes('Missing or insufficient permissions')) {
      return 'ไม่มีสิทธิ์เข้าถึงข้อมูล หรือโรงเรียนอยู่ในสถานะหมดอายุ (Read-only)';
    }
    if (error.message.includes('auth/popup-closed-by-user')) {
      return 'คุณปิดหน้าต่างเข้าสู่ระบบ Google ก่อนเสร็จสิ้น';
    }
    if (error.message.includes('auth/popup-blocked')) {
      return 'เบราว์เซอร์บล็อกหน้าต่างป๊อปอัป กรุณาอนุญาตป๊อปอัปแล้วลองใหม่อีกครั้ง';
    }
    if (error.message.includes('auth/unauthorized-domain')) {
      return 'โดเมนนี้ยังไม่ได้รับอนุญาตใน Firebase Authentication (Authorized domains)';
    }
    return error.message;
  }
  return 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
}

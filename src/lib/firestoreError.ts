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
    if (
      error.message.includes('auth/invalid-credential') ||
      error.message.includes('auth/wrong-password') ||
      error.message.includes('auth/user-not-found')
    ) {
      return 'ชื่อผู้ใช้งาน (Username) หรือรหัสผ่านไม่ถูกต้อง';
    }
    if (error.message.includes('auth/email-already-in-use')) {
      return 'ชื่อผู้ใช้งาน (Username) นี้ถูกใช้งานแล้ว กรุณาเลือกชื่ออื่น';
    }
    if (error.message.includes('auth/weak-password')) {
      return 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร';
    }
    if (error.message.includes('auth/operation-not-allowed')) {
      return 'กรุณาเปิดใช้งาน Email/Password ใน Firebase Console > Authentication > Sign-in method ก่อนเข้าใช้งาน';
    }
    if (error.message.includes('auth/too-many-requests')) {
      return 'ลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่อีกครั้ง';
    }
    if (error.message.includes('auth/invalid-email')) {
      return 'รูปแบบชื่อผู้ใช้งาน (Username) ไม่ถูกต้อง';
    }
    if (error.message.includes('auth/unauthorized-domain')) {
      return 'โดเมนนี้ยังไม่ได้รับอนุญาตใน Firebase Authentication (Authorized domains)';
    }
    return error.message;
  }
  return 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
}

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
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
  };
  throw new Error(errInfo.error);
}

export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message) as Partial<FirestoreErrorInfo>;
      if (parsed.error) {
        return parsed.error;
      }
    } catch {
      // Non-JSON error message
    }
    if (error.message.includes('Missing or insufficient permissions')) {
      return 'ไม่มีสิทธิ์เข้าถึงข้อมูล หรือโรงเรียนอยู่ในสถานะหมดอายุ (Read-only)';
    }
    return error.message;
  }
  return 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
}

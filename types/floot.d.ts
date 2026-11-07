declare module "@floot/email" {
  export function sendEmail(input: {
    from: string; to: string; subject: string; text: string; html?: string;
  }): Promise<{ ok: boolean; error?: { code: string; message: string } }>;
}
declare module "@floot/storage" {
  export function getInfo(input: { visibility: "private" | "public"; filename: string }): Promise<{ ok: boolean; exists?: boolean; error?: { message: string } }>;
  export function getUrl(input: { visibility: "private" | "public"; filename: string; expiresInSeconds?: number }): Promise<{ ok: boolean; url?: string; error?: { message: string } }>;
  export function upload(input: { visibility: "private" | "public"; filename: string; contentType: string; sizeBytes: number; ifAbsent?: boolean }): Promise<{ ok: boolean; presignedUrl?: string; headers?: Record<string, string>; error?: { message: string } }>;
}

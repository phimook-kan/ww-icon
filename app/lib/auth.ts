import { NextRequest, NextResponse } from "next/server";

export function verifyApiAuth(req: NextRequest): NextResponse | null {
  const authHeader = req.headers.get("authorization");
  const secretToken = process.env.API_SECRET_TOKEN;

  // ถ้าไม่ได้ตั้งค่ารหัสใน .env.local ให้ตีว่าปิดการใช้งาน หรือต้องตั้งค่าก่อน
  if (!secretToken) {
    return NextResponse.json(
      { success: false, message: "Server ยังไม่ได้กำหนด API_SECRET_TOKEN" },
      { status: 500 }
    );
  }

  if (!authHeader || authHeader !== `Bearer ${secretToken}`) {
    return NextResponse.json(
      { success: false, message: "Unauthorized: ไม่มีสิทธิ์เข้าใช้งาน API นี้" },
      { status: 401 }
    );
  }

  return null; // ผ่าน (ถูกต้อง)
}
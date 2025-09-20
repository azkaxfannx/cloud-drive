import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(req: Request) {
  const formData = await req.formData();
  const chunk = formData.get("chunk") as Blob | null;
  const fileId = formData.get("fileId") as string | null;
  const chunkIndex = formData.get("chunkIndex") as string | null;

  if (!chunk || !fileId || !chunkIndex) {
    return NextResponse.json(
      { success: false, error: "Invalid request" },
      { status: 400 }
    );
  }

  const uploadDir = process.env.STORAGE_PATH || "D:/cloud_drive/chunks/";
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const buffer = Buffer.from(await chunk.arrayBuffer());
  const chunkPath = path.join(uploadDir, `${fileId}-${chunkIndex}`);
  fs.writeFileSync(chunkPath, buffer);

  return NextResponse.json({ success: true });
}

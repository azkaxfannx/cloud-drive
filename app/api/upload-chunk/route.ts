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
  const fileDir = path.join(uploadDir, fileId);
  const chunkPath = path.join(fileDir, `${chunkIndex}`);

  try {
    // Ensure directories exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true, mode: 0o755 });
    }
    if (!fs.existsSync(fileDir)) {
      fs.mkdirSync(fileDir, { recursive: true, mode: 0o755 });
    }

    // Use async file writing
    const buffer = Buffer.from(await chunk.arrayBuffer());
    await fs.promises.writeFile(chunkPath, buffer);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Chunk upload error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save chunk" },
      { status: 500 }
    );
  }
}

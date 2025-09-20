// app/api/upload/route.ts
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json(
      { success: false, error: "No file uploaded" },
      { status: 400 }
    );
  }

  const uploadDir = process.env.STORAGE_PATH || "D:/cloud_drive/";
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const filename = `file-${Date.now()}-${file.name}`;
  const filepath = path.join(uploadDir, filename);

  fs.writeFileSync(filepath, buffer);

  const savedFile = await prisma.file.create({
    data: {
      filename,
      originalName: file.name,
      filepath,
      filesize: BigInt(buffer.length),
      mimetype: file.type,
    },
  });

  return NextResponse.json({
    success: true,
    message: "File uploaded successfully",
    file: { ...savedFile, filesize: savedFile.filesize.toString() },
  });
}

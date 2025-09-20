import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const { fileId, filename, totalChunks, mimetype } = await req.json();
  if (!fileId || !filename || !totalChunks) {
    return NextResponse.json(
      { success: false, error: "Missing params" },
      { status: 400 }
    );
  }

  const uploadDir = process.env.STORAGE_PATH || "D:/cloud_drive/chunks/";
  const finalDir = process.env.STORAGE_PATH || "D:/cloud_drive/";
  if (!fs.existsSync(finalDir)) fs.mkdirSync(finalDir, { recursive: true });

  const finalPath = path.join(finalDir, `${Date.now()}-${filename}`);
  const writeStream = fs.createWriteStream(finalPath);

  for (let i = 0; i < totalChunks; i++) {
    const chunkPath = path.join(uploadDir, `${fileId}-${i}`);
    if (!fs.existsSync(chunkPath)) continue;
    const data = fs.readFileSync(chunkPath);
    writeStream.write(data);
    fs.unlinkSync(chunkPath); // hapus chunk setelah merge
  }

  writeStream.end();

  const stats = fs.statSync(finalPath);

  const savedFile = await prisma.file.create({
    data: {
      filename: path.basename(finalPath),
      originalName: filename,
      filepath: finalPath,
      filesize: BigInt(stats.size),
      mimetype,
    },
  });

  return NextResponse.json({
    success: true,
    file: { ...savedFile, filesize: savedFile.filesize.toString() },
  });
}

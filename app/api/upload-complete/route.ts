import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { fileId, filename, totalChunks, mimetype } = await req.json();

    if (!fileId || !filename || !totalChunks) {
      return NextResponse.json(
        { success: false, error: "Missing params" },
        { status: 400 }
      );
    }

    const uploadDir = process.env.STORAGE_PATH || "D:/cloud_drive/chunks/";
    const finalDir = process.env.STORAGE_PATH || "D:/cloud_drive/";

    // Ensure directories exist
    if (!fs.existsSync(finalDir)) {
      fs.mkdirSync(finalDir, { recursive: true, mode: 0o755 });
    }

    const finalPath = path.join(finalDir, `${Date.now()}-${filename}`);
    const writeStream = fs.createWriteStream(finalPath);

    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join(uploadDir, fileId, `${i}`);

      if (!fs.existsSync(chunkPath)) {
        writeStream.close();
        // Clean up partial file
        if (fs.existsSync(finalPath)) {
          fs.unlinkSync(finalPath);
        }
        return NextResponse.json(
          { success: false, error: `Chunk ${i} missing` },
          { status: 400 }
        );
      }

      const data = await fs.promises.readFile(chunkPath);
      writeStream.write(data);
      await fs.promises.unlink(chunkPath);
    }

    writeStream.end();

    // Wait for stream to finish
    await new Promise<void>((resolve, reject) => {
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });

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

    // Clean up chunks directory
    const chunkDir = path.join(uploadDir, fileId);
    if (fs.existsSync(chunkDir)) {
      await fs.promises.rm(chunkDir, { recursive: true, force: true });
    }

    return NextResponse.json({
      success: true,
      file: { ...savedFile, filesize: savedFile.filesize.toString() },
    });
  } catch (error) {
    console.error("Merge error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to merge chunks" },
      { status: 500 }
    );
  }
}

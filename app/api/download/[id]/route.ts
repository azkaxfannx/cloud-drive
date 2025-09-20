import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  if (!id) {
    return NextResponse.json({ error: "File ID required" }, { status: 400 });
  }

  const fileId = parseInt(id, 10);
  if (isNaN(fileId)) {
    return NextResponse.json({ error: "Invalid file ID" }, { status: 400 });
  }

  try {
    const file = await prisma.file.findUnique({ where: { id: fileId } });
    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    if (!fs.existsSync(file.filepath)) {
      return NextResponse.json(
        { error: "File not found on disk" },
        { status: 404 }
      );
    }

    // Get file stats for content-length header
    const stats = fs.statSync(file.filepath);
    const fileSize = stats.size;

    // Handle range requests for partial content (optional but recommended)
    const range = req.headers.get("range");

    if (range) {
      // Handle range request for partial content
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;

      const fileStream = fs.createReadStream(file.filepath, { start, end });

      const headers = {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize.toString(),
        "Content-Type": file.mimetype || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(
          file.originalName
        )}"`,
      };

      return new Response(fileStream as any, {
        status: 206,
        headers,
      });
    } else {
      // Full file download with streaming
      const fileStream = fs.createReadStream(file.filepath);

      const headers = {
        "Content-Length": fileSize.toString(),
        "Content-Type": file.mimetype || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(
          file.originalName
        )}"`,
        "Accept-Ranges": "bytes",
      };

      return new Response(fileStream as any, {
        status: 200,
        headers,
      });
    }
  } catch (err: any) {
    console.error("Download error:", err);
    return NextResponse.json(
      { error: "Download failed", details: err.message },
      { status: 500 }
    );
  }
}

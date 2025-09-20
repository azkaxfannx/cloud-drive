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

    const stats = fs.statSync(file.filepath);
    const fileSize = stats.size;
    const range = req.headers.get("range");

    // Common headers
    const commonHeaders = {
      "Content-Type": file.mimetype || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(
        file.originalName
      )}"`,
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=3600",
      ETag: `"${fileId}"`,
      "X-Content-Type-Options": "nosniff",
    };

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize) {
        return NextResponse.json(
          { error: "Range not satisfiable" },
          { status: 416 }
        );
      }

      const chunksize = end - start + 1;
      const fileStream = fs.createReadStream(file.filepath, { start, end });

      return new Response(fileStream as any, {
        status: 206,
        headers: {
          ...commonHeaders,
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Content-Length": chunksize.toString(),
        },
      });
    } else {
      const fileStream = fs.createReadStream(file.filepath);

      return new Response(fileStream as any, {
        status: 200,
        headers: {
          ...commonHeaders,
          "Content-Length": fileSize.toString(),
        },
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

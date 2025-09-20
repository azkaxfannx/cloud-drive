import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> } // 👈 params harus Promise
) {
  const { id } = await context.params; // 👈 await dulu

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

    const buffer = fs.readFileSync(file.filepath);

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": file.mimetype || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${file.originalName}"`,
      },
    });
  } catch (err: any) {
    console.error("Download error:", err);
    return NextResponse.json(
      { error: "Download failed", details: err.message },
      { status: 500 }
    );
  }
}

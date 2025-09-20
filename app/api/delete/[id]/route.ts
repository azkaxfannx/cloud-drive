import { prisma } from "@/lib/prisma";
import fs from "fs";
import { NextResponse } from "next/server";

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> } // 👈 params promise
) {
  const { id } = await context.params; // 👈 wajib await

  if (!id) {
    return NextResponse.json(
      { success: false, error: "File ID required" },
      { status: 400 }
    );
  }

  const fileId = parseInt(id, 10);
  if (isNaN(fileId)) {
    return NextResponse.json(
      { success: false, error: "Invalid file ID" },
      { status: 400 }
    );
  }

  try {
    const file = await prisma.file.findUnique({ where: { id: fileId } });
    if (!file) {
      return NextResponse.json(
        { success: false, error: "File not found" },
        { status: 404 }
      );
    }

    await prisma.file.delete({ where: { id: fileId } });

    try {
      if (fs.existsSync(file.filepath)) {
        fs.unlinkSync(file.filepath);
      }
    } catch (fsErr) {
      console.warn("Failed to delete physical file:", fsErr);
    }

    return NextResponse.json({
      success: true,
      message: "File deleted successfully",
    });
  } catch (err: any) {
    console.error("Delete error:", err);
    return NextResponse.json(
      { success: false, error: `Delete failed: ${err.message}` },
      { status: 500 }
    );
  }
}

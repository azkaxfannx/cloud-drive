import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const files = await prisma.file.findMany({
      select: {
        id: true,
        filename: true,
        originalName: true,
        filesize: true,
        mimetype: true,
        uploadDate: true,
      },
      orderBy: {
        uploadDate: "desc",
      },
    });

    const filesResponse = files.map((file) => ({
      ...file,
      filesize: file.filesize.toString(),
    }));

    return NextResponse.json({
      success: true,
      files: filesResponse,
    });
  } catch (error: any) {
    console.error("Database error:", error);
    return NextResponse.json(
      { success: false, error: `Failed to fetch files: ${error.message}` },
      { status: 500 }
    );
  }
}

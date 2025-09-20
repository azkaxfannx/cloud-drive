"use client";

import { useState, useEffect, ChangeEvent } from "react";

interface FileData {
  id: number;
  filename: string;
  originalName: string;
  filesize: string;
  mimetype: string;
  uploadDate: string;
}

interface ApiResponse {
  success: boolean;
  files?: FileData[];
  file?: FileData;
  message?: string;
  error?: string;
}

export default function Home() {
  const [files, setFiles] = useState<FileData[]>([]);
  const [uploading, setUploading] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      const res = await fetch("/api/files");
      const data: ApiResponse = await res.json();
      if (data.success && data.files) setFiles(data.files);
    } catch (err) {
      console.error("Error fetching files:", err);
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(e.target.files?.[0] || null);
  };

  const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB

  const handleUpload = async () => {
    if (!selectedFile) return alert("Select a file first");

    setUploading(true);
    const fileId = `${Date.now()}-${selectedFile.name}`;
    const totalChunks = Math.ceil(selectedFile.size / CHUNK_SIZE);
    let uploadedBytes = 0;

    for (let i = 0; i < totalChunks; i++) {
      const chunk = selectedFile.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      const formData = new FormData();
      formData.append("chunk", chunk);
      formData.append("fileId", fileId);
      formData.append("chunkIndex", i.toString());

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/upload-chunk");

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            // Update progress berdasarkan total file
            const chunkProgress = event.loaded;
            setUploadProgress(
              Math.floor(
                ((uploadedBytes + chunkProgress) / selectedFile.size) * 100
              )
            );
          }
        };

        xhr.onload = () => {
          if (xhr.status === 200) {
            uploadedBytes += chunk.size; // update uploaded bytes
            resolve();
          } else {
            reject(new Error(`Chunk upload failed: ${xhr.statusText}`));
          }
        };

        xhr.onerror = () => reject(new Error("Chunk upload failed"));
        xhr.send(formData);
      });
    }

    // Merge chunks
    try {
      const res = await fetch("/api/upload-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileId,
          filename: selectedFile.name,
          totalChunks,
          mimetype: selectedFile.type,
        }),
      });

      const data = await res.json();
      if (data.success) {
        alert("Upload complete!");
        setSelectedFile(null);
        setUploadProgress(0);
        fetchFiles();
      } else {
        alert("Upload failed: " + data.error);
      }
    } catch (err) {
      alert("Upload failed");
      console.error(err);
    }

    setUploading(false);
  };

  const handleDownload = (fileId: number, fileName: string) => {
    const link = document.createElement("a");
    link.href = `/api/download/${fileId}`;
    link.download = fileName;
    link.click();
  };

  const handleDelete = async (fileId: number) => {
    if (!confirm("Are you sure you want to delete this file?")) return;

    try {
      const res = await fetch(`/api/delete/${fileId}`, { method: "DELETE" });
      const data: ApiResponse = await res.json();

      if (data.success) {
        alert("File deleted successfully!");
        await fetchFiles();
      } else {
        alert("Delete failed: " + data.error);
      }
    } catch (err) {
      alert("Delete failed");
      console.error("Delete error:", err);
    }
  };

  const formatFileSize = (bytes: string) => {
    const num = parseInt(bytes, 10);
    if (num === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(num) / Math.log(k));
    return parseFloat((num / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("id-ID", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 font-sans">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <header className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-4 flex items-center gap-3">
            <span className="text-blue-600">📁</span> Cloud Drive
          </h1>

          {/* Upload Section */}
          <div className="flex flex-wrap items-center gap-4">
            <input
              id="fileInput"
              type="file"
              onChange={handleFileSelect}
              className="file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border-0 
          file:text-sm file:font-medium file:bg-blue-50 file:text-blue-600 
          hover:file:bg-blue-100 cursor-pointer text-sm text-gray-700"
            />

            <button
              onClick={handleUpload}
              disabled={uploading || !selectedFile}
              className={`px-6 py-2.5 rounded-xl font-semibold text-white text-sm shadow transition
          ${
            uploading || !selectedFile
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
            >
              {uploading ? "⏳ Uploading..." : "📤 Upload File"}
            </button>
          </div>

          {selectedFile && (
            <p className="mt-3 text-sm text-gray-600">
              Selected:{" "}
              <span className="font-medium text-gray-800">
                {selectedFile.name}
              </span>{" "}
              ({formatFileSize(selectedFile.size.toString())})
            </p>
          )}
        </header>

        {/* Files List */}
        <section className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            📋 Files{" "}
            <span className="text-gray-500 text-sm">({files.length})</span>
          </h2>

          {files.length === 0 ? (
            <p className="text-gray-500 text-center py-12 text-sm">
              No files uploaded yet. Upload your first file above!
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-gray-700">
                    <th className="p-3 font-semibold">File Name</th>
                    <th className="p-3 font-semibold">Size</th>
                    <th className="p-3 font-semibold">Type</th>
                    <th className="p-3 font-semibold">Uploaded</th>
                    <th className="p-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {files.map((file) => (
                    <tr
                      key={file.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="p-3 font-medium text-gray-900">
                        {file.originalName}
                      </td>
                      <td className="p-3 text-gray-700">
                        {formatFileSize(file.filesize)}
                      </td>
                      <td className="p-3">
                        <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                          {file.mimetype}
                        </span>
                      </td>
                      <td className="p-3 text-gray-700">
                        {formatDate(file.uploadDate)}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              handleDownload(file.id, file.originalName)
                            }
                            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium shadow transition"
                          >
                            📥 Download
                          </button>
                          <button
                            onClick={() => handleDelete(file.id)}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium shadow transition"
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        {uploading && (
          <div className="w-full bg-gray-200 rounded-full h-3 mt-3">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
        )}
        {uploadProgress > 0 && (
          <p className="text-sm text-gray-700 mt-1">
            {uploadProgress}% uploaded
          </p>
        )}
      </div>
    </main>
  );
}

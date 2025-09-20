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

interface UploadingFile {
  file: File;
  progress: number;
  fileId: string;
}

export default function Home() {
  const [files, setFiles] = useState<FileData[]>([]);
  const [uploading, setUploading] = useState<boolean>(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]); // Ubah ke array
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [downloadProgress, setDownloadProgress] = useState<{
    [key: number]: number;
  }>({});

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
    const files = e.target.files ? Array.from(e.target.files) : [];
    setSelectedFiles(files);
  };

  const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB

  const getOptimalChunkSize = (fileSize: number) => {
    if (fileSize > 1024 * 1024 * 1024) {
      // > 1GB
      return 10 * 1024 * 1024; // 10MB
    } else if (fileSize > 100 * 1024 * 1024) {
      // > 100MB
      return 5 * 1024 * 1024; // 5MB
    } else {
      return 2 * 1024 * 1024; // 2MB
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return alert("Select files first");

    setUploading(true);

    // Inisialisasi progress untuk setiap file
    const initialUploadingFiles: UploadingFile[] = selectedFiles.map(
      (file) => ({
        file,
        progress: 0,
        fileId: `${Date.now()}-${file.name}-${Math.random()
          .toString(36)
          .substr(2, 9)}`,
      })
    );

    setUploadingFiles(initialUploadingFiles);

    // Upload semua file secara paralel
    const uploadPromises = initialUploadingFiles.map(async (uploadingFile) => {
      const { file, fileId } = uploadingFile;
      const CHUNK_SIZE = getOptimalChunkSize(file.size);
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      let uploadedBytes = 0;

      for (let i = 0; i < totalChunks; i++) {
        const chunk = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        const formData = new FormData();
        formData.append("chunk", chunk);
        formData.append("fileId", fileId);
        formData.append("chunkIndex", i.toString());

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", "/api/upload-chunk");

          xhr.onload = () => {
            if (xhr.status === 200) {
              uploadedBytes += chunk.size;

              // Update progress untuk file ini
              setUploadingFiles((prev) =>
                prev.map((uf) =>
                  uf.fileId === fileId
                    ? {
                        ...uf,
                        progress: Math.floor((uploadedBytes / file.size) * 100),
                      }
                    : uf
                )
              );

              resolve();
            } else {
              reject(new Error(`Chunk upload failed: ${xhr.statusText}`));
            }
          };

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const chunkProgress = event.loaded;
              const currentProgress = Math.floor(
                ((uploadedBytes + chunkProgress) / file.size) * 100
              );

              // Update progress real-time
              setUploadingFiles((prev) =>
                prev.map((uf) =>
                  uf.fileId === fileId
                    ? { ...uf, progress: currentProgress }
                    : uf
                )
              );
            }
          };

          xhr.onerror = () => reject(new Error("Chunk upload failed"));
          xhr.send(formData);
        });
      }

      // Merge chunks untuk file ini
      try {
        const res = await fetch("/api/upload-complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileId,
            filename: file.name,
            totalChunks,
            mimetype: file.type,
          }),
        });

        const data = await res.json();
        if (!data.success) {
          console.error(`Upload failed for ${file.name}:`, data.error);
        }
      } catch (err) {
        console.error(`Upload failed for ${file.name}:`, err);
      }
    });

    // Tunggu semua upload selesai
    try {
      await Promise.all(uploadPromises);
      alert("All uploads completed!");
      setSelectedFiles([]);
      setUploadingFiles([]);
      fetchFiles();
    } catch (err) {
      alert("Some uploads failed");
      console.error(err);
    }

    setUploading(false);
  };

  // page.tsx
  useEffect(() => {
    // Network detection
    const updateNetworkStatus = () => {
      if ("connection" in navigator) {
        const connection = (navigator as any).connection;
        if (connection) {
          console.log("Network type:", connection.effectiveType);
          console.log("Download speed:", connection.downlink, "Mbps");
        }
      }
    };

    updateNetworkStatus();
    if ("connection" in navigator) {
      const connection = (navigator as any).connection;
      connection?.addEventListener("change", updateNetworkStatus);
    }
  }, []);

  const handleDownload = (fileId: number, fileName: string) => {
    console.log("Downloading file:", fileId, fileName);

    // Create download link
    const link = document.createElement("a");
    link.href = `/api/download/${fileId}`;
    link.download = fileName;

    // Optional: Add some attributes for better handling
    link.target = "_blank"; // Open in new tab (optional)
    link.rel = "noopener noreferrer";
    link.style.display = "none";

    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log("Download initiated successfully");
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
              multiple // Tambah atribut multiple
              onChange={handleFileSelect}
              className="file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border-0 
          file:text-sm file:font-medium file:bg-blue-50 file:text-blue-600 
          hover:file:bg-blue-100 cursor-pointer text-sm text-gray-700"
            />

            <button
              onClick={handleUpload}
              disabled={uploading || selectedFiles.length === 0}
              className={`px-6 py-2.5 rounded-xl font-semibold text-white text-sm shadow transition
          ${
            uploading || selectedFiles.length === 0
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
            >
              {uploading ? "⏳ Uploading..." : "📤 Upload Files"}
            </button>
          </div>

          {/* Selected Files List */}
          {selectedFiles.length > 0 && (
            <div className="mt-3">
              <p className="text-sm text-gray-600 mb-2">
                Selected files ({selectedFiles.length}):
              </p>
              <ul className="text-sm text-gray-800 space-y-1">
                {selectedFiles.map((file, index) => (
                  <li key={index} className="font-medium">
                    • {file.name} ({formatFileSize(file.size.toString())})
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Upload Progress untuk Multiple Files */}
          {uploadingFiles.length > 0 && (
            <div className="mt-4 space-y-3">
              {uploadingFiles.map((uploadingFile, index) => (
                <div key={uploadingFile.fileId} className="space-y-1">
                  <p className="text-sm text-gray-700">
                    {uploadingFile.file.name} - {uploadingFile.progress}%
                  </p>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${uploadingFile.progress}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
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
      </div>
    </main>
  );
}

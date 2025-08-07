"use client";

import React, { useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import { fileAPI } from "@/lib/api";
import {
  Star,
  File,
  FileText,
  Image,
  Video,
  Music,
  Archive,
  Upload,
} from "lucide-react";

export default function StarredPage() {
  const [favoriteFiles, setFavoriteFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFavoriteFiles = async () => {
      try {
        const files = await fileAPI.getFavorites();
        setFavoriteFiles(files);
      } catch (error) {
        console.error("Error fetching favorite files:", error);
        setFavoriteFiles([]);
      } finally {
        setLoading(false);
      }
    };

    fetchFavoriteFiles();
  }, []);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileIcon = (contentType: string) => {
    if (contentType?.includes("image"))
      return <Image className="h-5 w-5 text-blue-500" />;
    if (contentType?.includes("video"))
      return <Video className="h-5 w-5 text-red-500" />;
    if (contentType?.includes("audio"))
      return <Music className="h-5 w-5 text-green-500" />;
    if (contentType?.includes("pdf") || contentType?.includes("document"))
      return <FileText className="h-5 w-5 text-orange-500" />;
    if (contentType?.includes("zip") || contentType?.includes("archive"))
      return <Archive className="h-5 w-5 text-purple-500" />;
    return <File className="h-5 w-5 text-gray-500" />;
  };

  const handleFileClick = async (file: any) => {
    try {
      const response = await fileAPI.download(file.id);

      if (response.method === "proxy") {
        const link = document.createElement("a");
        link.href = response.download_url;

        if (
          file.content_type?.includes("image") ||
          file.content_type?.includes("pdf") ||
          file.content_type?.includes("text")
        ) {
          link.target = "_blank";
          link.click();
        } else {
          link.download = file.original_name;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }

        setTimeout(
          () => window.URL.revokeObjectURL(response.download_url),
          100
        );
      } else {
        window.open(response.download_url, "_blank");
      }
    } catch (error) {
      console.error("Error opening file:", error);
      alert("Failed to open file. Please try again.");
    }
  };

  const handleToggleFavorite = async (
    fileId: string,
    event: React.MouseEvent
  ) => {
    event.stopPropagation();
    try {
      await fileAPI.toggleFavorite(fileId);
      // Remove from favorites list since it's no longer favorited
      setFavoriteFiles((prev) => prev.filter((file) => file.id !== fileId));
    } catch (error) {
      console.error("Error toggling favorite:", error);
      alert("Failed to update favorite status. Please try again.");
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                <div className="w-12 h-12 border-4 border-blue-200 rounded-full animate-spin"></div>
                <div className="w-12 h-12 border-4 border-blue-600 rounded-full animate-spin absolute top-0 left-0 border-t-transparent"></div>
              </div>
              <p className="text-gray-600">Loading your starred files...</p>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-8 space-y-8 bg-white min-h-screen">
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-3xl font-light text-gray-900">
                Starred Files
              </h1>
              <p className="text-gray-600 mt-2 font-light">
                Your favorite files in one place
              </p>
            </div>
          </div>

          {/* Files Grid */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
            <div className="p-8 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-medium text-gray-900 mb-1">
                    Starred Files
                  </h3>
                  <p className="text-sm text-gray-600">
                    {favoriteFiles.length} file
                    {favoriteFiles.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-8">
              {favoriteFiles.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {favoriteFiles.map((file) => (
                    <div
                      key={file.id}
                      className="group cursor-pointer"
                      onClick={() => handleFileClick(file)}
                    >
                      <div className="bg-gray-100 rounded-2xl p-6 hover:bg-gray-200 transition-colors mb-4 relative">
                        <button
                          onClick={(e) => handleToggleFavorite(file.id, e)}
                          className="absolute top-3 right-3 p-1 rounded-full hover:bg-gray-300 transition-colors z-10"
                        >
                          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                        </button>
                        <div className="flex items-center justify-center h-16">
                          {getFileIcon(file.content_type)}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {file.original_name}
                        </p>
                        <div className="flex items-center justify-between text-xs text-gray-600">
                          <span>{formatFileSize(file.size)}</span>
                          <span>
                            {new Date(file.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="mx-auto w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-6">
                    <Star className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No starred files yet
                  </h3>
                  <p className="text-gray-600 mb-8 max-w-sm mx-auto">
                    Star your favorite files to quickly access them here
                  </p>
                  <a
                    href="/dashboard"
                    className="inline-flex items-center px-6 py-3 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-lg"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Go to Dashboard
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}

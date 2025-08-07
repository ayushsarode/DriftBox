"use client";

import React, { useState, useEffect } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import { fileAPI, folderAPI } from "@/lib/api";
import {
  Folder,
  File,
  Download,
  Trash2,
  Plus,
  MoreVertical,
  ArrowLeft,
  Search,
  Grid,
  List,
  Upload,
  FolderPlus,
  Star,
  Eye,
  Calendar,
  Filter,
  SortAsc,
  MoreHorizontal,
  Loader2,
} from "lucide-react";

interface FileType {
  id: string;
  name: string;
  original_name: string;
  size: number;
  content_type: string;
  url: string;
  created_at: string;
  folder_id?: string;
  is_favorite?: boolean;
}

interface FolderType {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
}

export default function FilesPage() {
  const [files, setFiles] = useState<FileType[]>([]);
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [viewingFileId, setViewingFileId] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [currentFolder]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".dropdown-container")) {
        setDropdownOpen(null);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [filesResponse, foldersResponse] = await Promise.all([
        fileAPI.getAll(currentFolder || undefined),
        folderAPI.getAll(currentFolder || undefined),
      ]);

      const filesArray = Array.isArray(filesResponse) ? filesResponse : [];
      const foldersArray = Array.isArray(foldersResponse)
        ? foldersResponse
        : [];

      setFiles(filesArray);
      setFolders(foldersArray);
    } catch (error) {
      console.error("Error fetching data:", error);
      setFiles([]);
      setFolders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (fileId: string, fileName: string) => {
    try {
      const response = await fileAPI.download(fileId);

      if (response.method === "proxy") {
        const link = document.createElement("a");
        link.href = response.download_url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        window.URL.revokeObjectURL(response.download_url);
      } else {
        window.open(response.download_url, "_blank");
      }
    } catch (error) {
      console.error("Error downloading file:", error);
      alert("Failed to download file. Please try again.");
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (window.confirm("Are you sure you want to delete this file?")) {
      try {
        await fileAPI.delete(fileId);
        fetchData();
      } catch (error) {
        console.error("Error deleting file:", error);
      }
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (
      window.confirm(
        "Are you sure you want to delete this folder and all its contents?"
      )
    ) {
      try {
        await folderAPI.delete(folderId);
        fetchData();
      } catch (error) {
        console.error("Error deleting folder:", error);
      }
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      await folderAPI.create({
        name: newFolderName,
        parent_id: currentFolder || undefined,
      });
      setNewFolderName("");
      setShowCreateFolder(false);
      fetchData();
    } catch (error) {
      console.error("Error creating folder:", error);
    }
  };

  const handleToggleFavorite = async (fileId: string) => {
    try {
      await fileAPI.toggleFavorite(fileId);

      setFiles((prevFiles) =>
        prevFiles.map((file) =>
          file.id === fileId
            ? { ...file, is_favorite: !file.is_favorite }
            : file
        )
      );
    } catch (error) {
      console.error("Error toggling favorite:", error);
      alert("Failed to update favorite status. Please try again.");
    }
  };

  const handleViewFile = async (file: FileType) => {
    try {
      setViewingFileId(file.id);
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
    } finally {
      setViewingFileId(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const filteredFolders = folders.filter((folder) =>
    folder.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredFiles = files.filter((file) =>
    file.original_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
              <p className="text-gray-600">Loading your files...</p>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Header Section */}
          <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
            <div className="flex items-center space-x-3 sm:space-x-4">
              {currentFolder && (
                <button
                  onClick={() => setCurrentFolder(null)}
                  className="inline-flex items-center px-2 sm:px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ArrowLeft className="h-4 w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Back</span>
                </button>
              )}
              <div>
                <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">
                  {currentFolder ? "Folder Contents" : "My Files"}
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  {filteredFolders.length + filteredFiles.length} items
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end space-x-3">
              {/* View Toggle */}
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-1.5 sm:p-2 rounded-md transition-colors ${
                    viewMode === "list"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <List className="h-3 w-3 sm:h-4 sm:w-4" />
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 sm:p-2 rounded-md transition-colors ${
                    viewMode === "grid"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <Grid className="h-3 w-3 sm:h-4 sm:w-4" />
                </button>
              </div>

              {/* Sort & Filter - Hidden on mobile, show as menu */}
              <div className="hidden sm:flex sm:items-center sm:space-x-3">
                <button className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                  <SortAsc className="h-4 w-4 mr-2" />
                  Sort
                </button>

                <button className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                  <Filter className="h-4 w-4 mr-2" />
                  Filter
                </button>
              </div>

              {/* Mobile menu button */}
              <button className="sm:hidden inline-flex items-center px-2 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                <MoreHorizontal className="h-4 w-4" />
              </button>

              {/* Action Buttons */}
              <div className="hidden sm:flex sm:items-center sm:space-x-3">
                <button
                  onClick={() => setShowCreateFolder(true)}
                  className="inline-flex items-center px-3 sm:px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <FolderPlus className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">New folder</span>
                </button>

                <a
                  href={`/dashboard/upload${
                    currentFolder ? `?folder=${currentFolder}` : ""
                  }`}
                  className="inline-flex items-center px-3 sm:px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Upload</span>
                </a>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search files and folders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>

          {/* Create Folder Modal */}
          {showCreateFolder && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-96 max-w-sm mx-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Create New Folder
                </h3>
                <input
                  type="text"
                  placeholder="Folder name"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
                  autoFocus
                />
                <div className="flex items-center justify-end space-x-3">
                  <button
                    onClick={() => {
                      setShowCreateFolder(false);
                      setNewFolderName("");
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateFolder}
                    disabled={!newFolderName.trim()}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Create
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Content Area */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            {filteredFolders.length === 0 && filteredFiles.length === 0 ? (
              <div className="text-center py-16">
                <div className="mx-auto w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center mb-6">
                  <Folder className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {searchTerm ? "No results found" : "This folder is empty"}
                </h3>
                <p className="text-gray-500 mb-6 max-w-sm mx-auto">
                  {searchTerm
                    ? "Try adjusting your search terms or browse your files."
                    : "Get started by uploading files or creating new folders to organize your content."}
                </p>
                <div className="flex items-center justify-center space-x-3">
                  <button
                    onClick={() => setShowCreateFolder(true)}
                    className="inline-flex items-center px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <FolderPlus className="h-4 w-4 mr-2" />
                    New folder
                  </button>
                  <a
                    href={`/dashboard/upload${
                      currentFolder ? `?folder=${currentFolder}` : ""
                    }`}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload files
                  </a>
                </div>
              </div>
            ) : viewMode === "list" ? (
              <div className="divide-y divide-gray-100">
                {/* Folders */}
                {filteredFolders.map((folder) => (
                  <div
                    key={folder.id}
                    className="flex items-center p-4 hover:bg-gray-50 group transition-colors"
                  >
                    <div
                      className="flex items-center flex-1 cursor-pointer"
                      onClick={() => setCurrentFolder(folder.id)}
                    >
                      <div className="flex-shrink-0 mr-4">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Folder className="h-6 w-6 text-blue-600" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {folder.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          Folder •{" "}
                          {new Date(folder.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                        <Star className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteFolder(folder.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded-lg"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Files */}
                {filteredFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center p-4 hover:bg-gray-50 group transition-colors"
                  >
                    <div className="flex items-center flex-1">
                      <div className="flex-shrink-0 mr-4">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                          <File className="h-6 w-6 text-gray-600" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {file.original_name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatFileSize(file.size)} •{" "}
                          {new Date(file.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleViewFile(file)}
                        disabled={viewingFileId === file.id}
                        className={`p-2 hover:bg-gray-100 rounded-lg transition-colors ${
                          viewingFileId === file.id
                            ? "text-blue-500 cursor-not-allowed"
                            : "text-gray-400 hover:text-gray-600"
                        }`}
                      >
                        {viewingFileId === file.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>

                      {/* More Actions Dropdown */}
                      <div className="relative dropdown-container">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();

                            setDropdownOpen(
                              dropdownOpen === file.id ? null : file.id
                            );
                          }}
                          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>

                        {dropdownOpen === file.id && (
                          <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();

                                handleToggleFavorite(file.id);
                                setDropdownOpen(null);
                              }}
                              className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
                            >
                              <Star
                                className={`h-4 w-4 mr-3 ${
                                  file.is_favorite
                                    ? "fill-current text-yellow-500"
                                    : ""
                                }`}
                              />
                              {file.is_favorite
                                ? "Remove from favorites"
                                : "Add to favorites"}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();

                                handleDownload(file.id, file.original_name);
                                setDropdownOpen(null);
                              }}
                              className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
                            >
                              <Download className="h-4 w-4 mr-3" />
                              Download
                            </button>
                            <hr className="my-1" />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();

                                handleDeleteFile(file.id);
                                setDropdownOpen(null);
                              }}
                              className="w-full flex items-center px-3 py-2 text-sm text-red-600 hover:bg-red-50 text-left"
                            >
                              <Trash2 className="h-4 w-4 mr-3" />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                  {/* Folders in Grid */}
                  {filteredFolders.map((folder) => (
                    <div
                      key={folder.id}
                      className="group relative bg-white hover:bg-gray-50 p-4 rounded-lg border border-gray-100 hover:border-gray-200 cursor-pointer transition-all"
                      onClick={() => setCurrentFolder(folder.id)}
                    >
                      <div className="flex flex-col items-center text-center">
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
                          <Folder className="h-8 w-8 text-blue-600" />
                        </div>
                        <p className="text-sm font-medium text-gray-900 truncate w-full">
                          {folder.name}
                        </p>
                      </div>
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFolder(folder.id);
                          }}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-white rounded"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Files in Grid */}
                  {filteredFiles.map((file) => (
                    <div
                      key={file.id}
                      className="group relative bg-white hover:bg-gray-50 p-4 rounded-lg border border-gray-100 hover:border-gray-200 transition-all"
                    >
                      <div className="flex flex-col items-center text-center">
                        <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mb-3">
                          <File className="h-8 w-8 text-gray-600" />
                        </div>
                        <p className="text-sm font-medium text-gray-900 truncate w-full">
                          {file.original_name}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
                        <button
                          onClick={() => handleViewFile(file)}
                          disabled={viewingFileId === file.id}
                          className={`p-1 hover:bg-white rounded transition-colors ${
                            viewingFileId === file.id
                              ? "text-blue-500 cursor-not-allowed"
                              : "text-gray-400 hover:text-gray-600"
                          }`}
                        >
                          {viewingFileId === file.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Eye className="h-3 w-3" />
                          )}
                        </button>

                        {/* More Actions Dropdown */}
                        <div className="relative dropdown-container">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();

                              setDropdownOpen(
                                dropdownOpen === file.id ? null : file.id
                              );
                            }}
                            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-white rounded"
                          >
                            <MoreVertical className="h-3 w-3" />
                          </button>

                          {dropdownOpen === file.id && (
                            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();

                                  handleToggleFavorite(file.id);
                                  setDropdownOpen(null);
                                }}
                                className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
                              >
                                <Star
                                  className={`h-4 w-4 mr-3 ${
                                    file.is_favorite
                                      ? "fill-current text-yellow-500"
                                      : ""
                                  }`}
                                />
                                {file.is_favorite
                                  ? "Remove from favorites"
                                  : "Add to favorites"}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();

                                  handleDownload(file.id, file.original_name);
                                  setDropdownOpen(null);
                                }}
                                className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
                              >
                                <Download className="h-4 w-4 mr-3" />
                                Download
                              </button>
                              <hr className="my-1" />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();

                                  handleDeleteFile(file.id);
                                  setDropdownOpen(null);
                                }}
                                className="w-full flex items-center px-3 py-2 text-sm text-red-600 hover:bg-red-50 text-left"
                              >
                                <Trash2 className="h-4 w-4 mr-3" />
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}

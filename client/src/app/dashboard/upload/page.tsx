"use client";

import React, { useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import { fileAPI, folderAPI } from "@/lib/api";
import {
  Upload,
  File,
  X,
  CheckCircle,
  AlertCircle,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
} from "lucide-react";

interface UploadFile {
  file: File;
  id: string;
  progress: number;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
}

interface FolderType {
  id: string;
  name: string;
  parent_id: string | null;
  full_path?: string;
  level?: number;
  children?: FolderType[];
  hasChildren?: boolean;
}

export default function UploadPage() {
  const searchParams = useSearchParams();
  const currentFolderId = searchParams.get("folder");

  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>(
    currentFolderId || ""
  );
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set()
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchAllFolders();
  }, []);

  useEffect(() => {
    if (currentFolderId) {
      setSelectedFolder(currentFolderId);
    }
  }, [currentFolderId]);

  const fetchAllFolders = async () => {
    try {
      const rootFolders = await folderAPI.getAll();
      let allFolders = [...rootFolders];

      const fetchSubfolders = async (parentFolders: any[]) => {
        for (const folder of parentFolders) {
          try {
            const subfolders = await folderAPI.getAll(folder.id);
            if (subfolders && subfolders.length > 0) {
              allFolders.push(...subfolders);
              await fetchSubfolders(subfolders);
            }
          } catch (error) {
            console.log(`No subfolders for ${folder.name}`);
          }
        }
      };

      await fetchSubfolders(rootFolders);

      if (!Array.isArray(allFolders)) {
        setFolders([]);
        return;
      }

      const buildHierarchy = (folders: any[]): FolderType[] => {
        const folderMap = new Map<string, any>();
        folders.forEach((folder) => folderMap.set(folder.id, folder));

        const buildPath = (folder: any): { path: string; level: number } => {
          if (!folder.parent_id) {
            return { path: folder.name, level: 0 };
          }
          const parent = folderMap.get(folder.parent_id);
          if (parent) {
            const parentInfo = buildPath(parent);
            return {
              path: `${parentInfo.path} / ${folder.name}`,
              level: parentInfo.level + 1,
            };
          }
          return { path: folder.name, level: 0 };
        };

        const rootFolders: FolderType[] = [];
        const allFoldersWithHierarchy = folders.map((folder) => {
          const { path, level } = buildPath(folder);
          const hasChildren = folders.some((f) => f.parent_id === folder.id);
          return {
            ...folder,
            full_path: path,
            level,
            children: [],
            hasChildren,
          };
        });

        const folderHierarchyMap = new Map<string, FolderType>();
        allFoldersWithHierarchy.forEach((folder) => {
          folderHierarchyMap.set(folder.id, folder);
        });

        allFoldersWithHierarchy.forEach((folder) => {
          if (!folder.parent_id) {
            rootFolders.push(folder);
          } else {
            const parent = folderHierarchyMap.get(folder.parent_id);
            if (parent) {
              if (!parent.children) parent.children = [];
              parent.children.push(folder);
            }
          }
        });

        const sortFolders = (folders: FolderType[]) => {
          folders.sort((a, b) => a.name.localeCompare(b.name));
          folders.forEach((folder) => {
            if (folder.children && folder.children.length > 0) {
              sortFolders(folder.children);
            }
          });
        };

        sortFolders(rootFolders);
        return rootFolders;
      };

      const hierarchicalFolders = buildHierarchy(allFolders);
      setFolders(hierarchicalFolders);

      if (currentFolderId) {
        const expandParents = (folderId: string) => {
          const allFlat = getAllFoldersFlat(hierarchicalFolders);
          const targetFolder = allFlat.find((f) => f.id === folderId);
          if (targetFolder && targetFolder.parent_id) {
            setExpandedFolders((prev) =>
              new Set(prev).add(targetFolder.parent_id!)
            );
            expandParents(targetFolder.parent_id);
          }
        };
        expandParents(currentFolderId);
      }
    } catch (error) {
      console.error("Error fetching folders:", error);
      setFolders([]);
    }
  };

  const getAllFoldersFlat = (folders: FolderType[]): FolderType[] => {
    const result: FolderType[] = [];
    const traverse = (folderList: FolderType[]) => {
      folderList.forEach((folder) => {
        result.push(folder);
        if (folder.children && folder.children.length > 0) {
          traverse(folder.children);
        }
      });
    };
    traverse(folders);
    return result;
  };

  const toggleFolderExpansion = (folderId: string) => {
    setExpandedFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  const getSelectedFolderName = () => {
    if (!selectedFolder) return "Root Folder";

    const allFlat = getAllFoldersFlat(folders);
    const folder = allFlat.find((f) => f.id === selectedFolder);
    return folder ? folder.full_path || folder.name : "Unknown Folder";
  };

  const renderFolderTree = (
    folders: FolderType[],
    level: number = 0
  ): React.ReactNode => {
    return folders.map((folder) => (
      <div key={folder.id} className="space-y-1">
        <div className="flex items-center">
          {/* Expand/Collapse button - always show if has children */}
          {folder.hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFolderExpansion(folder.id);
              }}
              className="p-1 hover:bg-gray-200 rounded transition-colors flex-shrink-0 mr-1"
              style={{ marginLeft: `${level * 16}px` }}
            >
              {expandedFolders.has(folder.id) ? (
                <ChevronDown className="h-4 w-4 text-gray-600" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-600" />
              )}
            </button>
          ) : (
            <div
              className="w-6 h-6 flex-shrink-0"
              style={{ marginLeft: `${level * 16}px` }}
            />
          )}

          {/* Folder button */}
          <button
            onClick={() => setSelectedFolder(folder.id)}
            className={`flex-1 p-2 border rounded-lg text-left hover:bg-gray-50 transition-colors ${
              selectedFolder === folder.id
                ? "border-blue-500 bg-blue-50"
                : "border-gray-300"
            }`}
          >
            <div className="flex items-center">
              <Folder className="h-4 w-4 text-yellow-600 mr-2 flex-shrink-0" />
              <span className="text-sm font-medium truncate">
                {folder.name}
              </span>
            </div>
          </button>
        </div>

        {/* Render children if expanded */}
        {folder.hasChildren &&
          expandedFolders.has(folder.id) &&
          folder.children &&
          folder.children.length > 0 && (
            <div className="ml-2">
              {renderFolderTree(folder.children, level + 1)}
            </div>
          )}
      </div>
    ));
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;

    const newUploadFiles: UploadFile[] = Array.from(files).map((file) => ({
      file,
      id: Math.random().toString(36).substring(7),
      progress: 0,
      status: "pending",
    }));

    setUploadFiles((prev) => [...prev, ...newUploadFiles]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const removeFile = (id: string) => {
    setUploadFiles((prev) => prev.filter((file) => file.id !== id));
  };

  const uploadSingleFile = async (uploadFile: UploadFile) => {
    const formData = new FormData();
    formData.append("file", uploadFile.file);
    if (selectedFolder) {
      formData.append("folder_id", selectedFolder);
    }

    setUploadFiles((prev) =>
      prev.map((file) =>
        file.id === uploadFile.id
          ? { ...file, status: "uploading", progress: 0 }
          : file
      )
    );

    try {
      const progressInterval = setInterval(() => {
        setUploadFiles((prev) =>
          prev.map((file) =>
            file.id === uploadFile.id && file.status === "uploading"
              ? { ...file, progress: Math.min(file.progress + 10, 90) }
              : file
          )
        );
      }, 200);

      await fileAPI.upload(formData);

      clearInterval(progressInterval);
      setUploadFiles((prev) =>
        prev.map((file) =>
          file.id === uploadFile.id
            ? { ...file, status: "success", progress: 100 }
            : file
        )
      );
    } catch (error: any) {
      setUploadFiles((prev) =>
        prev.map((file) =>
          file.id === uploadFile.id
            ? {
                ...file,
                status: "error",
                error: error.response?.data?.error || "Upload failed",
              }
            : file
        )
      );
    }
  };

  const uploadAllFiles = async () => {
    const pendingFiles = uploadFiles.filter(
      (file) => file.status === "pending"
    );

    for (const file of pendingFiles) {
      await uploadSingleFile(file);
    }
  };

  const clearCompleted = () => {
    setUploadFiles((prev) =>
      prev.filter(
        (file) => file.status !== "success" && file.status !== "error"
      )
    );
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "error":
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case "uploading":
        return (
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
        );
      default:
        return <File className="h-5 w-5 text-gray-400" />;
    }
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-4 sm:space-y-6 p-4 sm:p-6 lg:p-10">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              Upload Files
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Upload files to your cloud storage. Maximum file size: 50MB
            </p>
          </div>

          {/* Folder Selection */}
          <div className="bg-white shadow rounded-lg p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-4">
              Select Destination Folder
              {selectedFolder && (
                <span className="block sm:inline text-sm font-normal text-gray-500 sm:ml-2 mt-1 sm:mt-0">
                  (Selected: {getSelectedFolderName()})
                </span>
              )}
            </h3>
            <div className="space-y-2 max-h-48 sm:max-h-64 overflow-y-auto">
              <button
                onClick={() => setSelectedFolder("")}
                className={`w-full p-3 sm:p-4 border rounded-lg text-left hover:bg-gray-50 transition-colors ${
                  selectedFolder === ""
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-300"
                }`}
              >
                <div className="flex items-center">
                  <FolderOpen className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500 mr-3" />
                  <span className="font-medium text-sm sm:text-base">
                    📁 Root Folder
                  </span>
                </div>
              </button>
              {Array.isArray(folders) && renderFolderTree(folders)}
            </div>
          </div>

          {/* Upload Area */}
          <div className="bg-white shadow rounded-lg p-4 sm:p-6">
            <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center">
                <FolderOpen className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 mr-2" />
                <span className="text-xs sm:text-sm font-medium text-blue-900">
                  Files will be uploaded to: {getSelectedFolderName()}
                </span>
              </div>
            </div>
            <div
              className={`border-2 border-dashed rounded-lg p-6 sm:p-8 text-center transition-colors ${
                isDragOver
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-300 hover:border-gray-400"
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <Upload className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                Upload files
              </h3>
              <div className="mt-1">
                <p className="text-sm text-gray-500">
                  Drag and drop files here, or{" "}
                  <button
                    type="button"
                    className="font-medium text-blue-600 hover:text-blue-500"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    browse
                  </button>
                </p>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                PNG, JPG, PDF, DOC, DOCX up to 50MB
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files)}
                accept="*/*"
              />
            </div>
          </div>

          {/* Upload Queue */}
          {uploadFiles.length > 0 && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h3 className="text-base sm:text-lg font-medium text-gray-900">
                    Upload Queue ({uploadFiles.length} files)
                  </h3>
                  <div className="flex space-x-2">
                    <button
                      onClick={uploadAllFiles}
                      disabled={
                        !uploadFiles.some((file) => file.status === "pending")
                      }
                      className="inline-flex items-center px-3 sm:px-4 py-2 border border-transparent text-xs sm:text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Upload All
                    </button>
                    <button
                      onClick={clearCompleted}
                      className="inline-flex items-center px-3 sm:px-4 py-2 border border-gray-300 text-xs sm:text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Clear Completed
                    </button>
                  </div>
                </div>
              </div>
              <div className="divide-y divide-gray-200">
                {uploadFiles.map((uploadFile) => (
                  <div key={uploadFile.id} className="px-4 sm:px-6 py-4">
                    <div className="flex items-start sm:items-center justify-between">
                      <div className="flex items-start flex-1 min-w-0">
                        <div className="flex-shrink-0 mt-0.5 sm:mt-0">
                          {getStatusIcon(uploadFile.status)}
                        </div>
                        <div className="ml-3 sm:ml-4 flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {uploadFile.file.name}
                          </p>
                          <p className="text-xs sm:text-sm text-gray-500">
                            {formatFileSize(uploadFile.file.size)}
                          </p>
                          {uploadFile.status === "uploading" && (
                            <div className="mt-2">
                              <div className="bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${uploadFile.progress}%` }}
                                ></div>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
                                {uploadFile.progress}% complete
                              </p>
                            </div>
                          )}
                          {uploadFile.status === "error" &&
                            uploadFile.error && (
                              <p className="text-xs sm:text-sm text-red-600 mt-1">
                                {uploadFile.error}
                              </p>
                            )}
                        </div>
                      </div>
                      <div className="ml-2 sm:ml-4 flex-shrink-0 flex flex-col sm:flex-row space-y-1 sm:space-y-0 sm:space-x-2">
                        {uploadFile.status === "pending" && (
                          <button
                            onClick={() => uploadSingleFile(uploadFile)}
                            className="inline-flex items-center px-2 sm:px-3 py-1 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200"
                          >
                            Upload
                          </button>
                        )}
                        <button
                          onClick={() => removeFile(uploadFile.id)}
                          className="inline-flex items-center justify-center p-1 border border-transparent rounded text-red-400 hover:text-red-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}

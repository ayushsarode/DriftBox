"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { authAPI } from "@/lib/api";
import {
  Cloud,
  Files,
  FolderOpen,
  Upload,
  Settings,
  LogOut,
  Menu,
  X,
  User,
  Search,
  Bell,
  Grid3X3,
  List,
  Star,
  Trash2,
  Download,
  MoreHorizontal,
} from "lucide-react";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const mainElement = document.querySelector("main[data-scroll-container]");
    if (!mainElement) return;

    const handleScroll = () => setScrollY(mainElement.scrollTop);
    mainElement.addEventListener("scroll", handleScroll);
    return () => mainElement.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogout = () => {
    authAPI.logout();
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const welcomeOpacity = Math.max(0, 1 - scrollY / 100);

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Sidebar */}
      <div
        className={`bg-white shadow-sm border-r border-gray-100 transform ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 flex flex-col w-64 fixed inset-y-0 left-0 z-50`}
      >
        {/* Logo and Brand */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-100">
          <div className="flex items-center">
            <div className="p-2 bg-black rounded-xl">
              <Cloud className="h-5 w-5 text-white" />
            </div>
            <span className="ml-3 text-xl font-extralight text-gray-900">
              Vault
            </span>
            <span className="font-medium  text-gray-900 text-xl">Docs</span>
          </div>

          {/* Close button for mobile */}
          <button
            onClick={toggleSidebar}
            className="lg:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* User Profile Section */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                <User className="h-5 w-5 text-gray-600" />
              </div>
            </div>
            <div className="ml-3 flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.name || user?.email || "User"}
              </p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 flex flex-col pt-2 pb-4 overflow-y-auto">
          <nav className="flex-1 px-6 space-y-1">
            <a
              href="/dashboard"
              className="text-gray-700 hover:bg-gray-50 hover:text-gray-900 group flex items-center px-3 py-3 text-sm font-medium rounded-xl transition-colors"
            >
              <Grid3X3 className="text-gray-400 group-hover:text-gray-600 mr-3 h-5 w-5" />
              Dashboard
            </a>
            <a
              href="/dashboard/files"
              className="text-gray-700 hover:bg-gray-50 hover:text-gray-900 group flex items-center px-3 py-3 text-sm font-medium rounded-xl transition-colors"
            >
              <FolderOpen className="text-gray-400 group-hover:text-gray-600 mr-3 h-5 w-5" />
              My Files
            </a>
            <a
              href="/dashboard/upload"
              className="text-gray-700 hover:bg-gray-50 hover:text-gray-900 group flex items-center px-3 py-3 text-sm font-medium rounded-xl transition-colors"
            >
              <Upload className="text-gray-400 group-hover:text-gray-600 mr-3 h-5 w-5" />
              Upload
            </a>

            <div className="pt-6 pb-2">
              <p className="px-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                Quick Access
              </p>
            </div>

            <a
              href="/dashboard/starred"
              className="text-gray-700 hover:bg-gray-50 hover:text-gray-900 group flex items-center px-3 py-3 text-sm font-medium rounded-xl transition-colors"
            >
              <Star className="text-gray-400 group-hover:text-gray-600 mr-3 h-5 w-5" />
              Starred
            </a>

            <div className="pt-6 pb-2">
              <p className="px-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                Account
              </p>
            </div>

            <a
              href="/dashboard/settings"
              className="text-gray-700 hover:bg-gray-50 hover:text-gray-900 group flex items-center px-3 py-3 text-sm font-medium rounded-xl transition-colors"
            >
              <Settings className="text-gray-400 group-hover:text-gray-600 mr-3 h-5 w-5" />
              Settings
            </a>
          </nav>
        </div>

        {/* Logout Button */}
        <div className="flex-shrink-0 border-t border-gray-100 p-6">
          <button
            onClick={handleLogout}
            className="flex items-center text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 w-full px-3 py-3 rounded-xl transition-colors"
          >
            <LogOut className="text-gray-400 mr-3 h-5 w-5" />
            Sign out
          </button>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="fixed inset-0 bg-black bg-opacity-50"
            onClick={toggleSidebar}
          ></div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header Bar */}
        <header className="bg-white border-b border-gray-100 shadow-sm">
          <div className="flex items-center justify-between h-16 px-6 lg:px-8">
            {/* Mobile menu button */}
            <button
              type="button"
              className="lg:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-500"
              onClick={toggleSidebar}
            >
              <span className="sr-only">Open sidebar</span>
              <Menu className="h-5 w-5" />
            </button>

            {/* Welcome Message */}
            <div className="flex-1 max-w-2xl">
              <div
                style={{ opacity: welcomeOpacity }}
                className="transition-opacity duration-300"
              >
                <h1 className="text-sm sm:text-lg md:text-xl lg:text-2xl font-light text-gray-900 truncate">
                  Hello👋, {user?.name || user?.email || "User"}!
                </h1>
              </div>
            </div>

            {/* Right side actions */}
            <div className="flex items-center space-x-2 sm:space-x-4">
              {/* Upload button */}
              <a
                href="/dashboard/upload"
                className="inline-flex items-center px-3 sm:px-4 py-2 sm:py-2.5 bg-black text-white text-xs sm:text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors"
              >
                <Upload className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                <span className="hidden sm:inline">Upload</span>
              </a>

              {/* User menu */}
              <div className="relative">
                <button className="flex items-center p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl">
                  <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-gray-100 flex items-center justify-center">
                    <User className="h-3 w-3 sm:h-4 sm:w-4 text-gray-600" />
                  </div>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main
          className="flex-1 relative overflow-y-auto bg-gray-50"
          data-scroll-container
        >
          {children}
        </main>
      </div>
    </div>
  );
}

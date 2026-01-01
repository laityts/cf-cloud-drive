'use client';

import { useState, useEffect, useRef } from 'react';
import { Folder, File, Plus, ChevronRight, Home, LogOut, Upload, X, FileText, CheckCircle, AlertCircle, Search, Download, Trash2, Eye, Link as LinkIcon, Copy, Globe } from 'lucide-react';
import { useRouter, usePathname } from '@/i18n/routing';
import { toast } from 'sonner';
import { useTranslations, useLocale } from 'next-intl';



type FileNode = {
  id: string;
  parentId: string | null;
  name: string;
  type: 'file' | 'folder';
  size: number;
  mimeType?: string;
  createdAt: string;
};

type UploadStatus = 'pending' | 'uploading' | 'completed' | 'error';

interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: UploadStatus;
  error?: string;
}

export default function Dashboard() {
  const t = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const [files, setFiles] = useState<FileNode[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderHistory, setFolderHistory] = useState<{ id: string | null; name: string }[]>([
    { id: null, name: t('title') }, // Use translated title for Home
  ]);
  const [loading, setLoading] = useState(true);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
  // Language Switcher State
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);

  const handleLanguageChange = (newLocale: string) => {
    router.replace(pathname, { locale: newLocale });
    setIsLangMenuOpen(false);
  };

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Upload State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Preview State
  const [previewFile, setPreviewFile] = useState<FileNode | null>(null);
  
  // Pagination State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Debounce Search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchFiles = async (parentId: string | null, pageNum: number, limitNum: number, search: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: limitNum.toString(),
      });
      
      if (search) {
        params.append('search', search);
      } else if (parentId) {
        params.append('parentId', parentId);
      }

      const res = await fetch(`/api/files?${params.toString()}`);
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      const json = await res.json();
      setFiles(json.data);
      setTotal(json.meta.total);
      setTotalPages(json.meta.totalPages);
    } catch (error) {
      console.error('Failed to fetch files', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1); // Reset to page 1 when folder changes
  }, [currentFolderId, debouncedSearch]);

  useEffect(() => {
    fetchFiles(currentFolderId, page, limit, debouncedSearch);
  }, [currentFolderId, page, limit, debouncedSearch]);

  const handleFolderClick = (folder: FileNode) => {
    setCurrentFolderId(folder.id);
    setFolderHistory([...folderHistory, { id: folder.id, name: folder.name }]);
    setSearchQuery(''); // Clear search when navigating
  };

  const handleBreadcrumbClick = (index: number) => {
    const newHistory = folderHistory.slice(0, index + 1);
    setFolderHistory(newHistory);
    setCurrentFolderId(newHistory[newHistory.length - 1].id);
    setSearchQuery(''); // Clear search when navigating
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName) return;

    try {
      const res = await fetch('/api/files/folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolderName, parentId: currentFolderId }),
      });
      
      if (res.ok) {
        setNewFolderName('');
        setIsCreateFolderOpen(false);
        fetchFiles(currentFolderId, page, limit, debouncedSearch);
      }
    } catch (error) {
      console.error('Failed to create folder', error);
    }
  };

  const isImage = (file: FileNode) => {
    return file.mimeType?.startsWith('image/');
  };

  const handleCopyLink = (e: React.MouseEvent, file: FileNode) => {
    e.stopPropagation();
    const url = `${window.location.origin}/raw/${file.id}`;
    navigator.clipboard.writeText(url);
    toast.success(t('linkCopied'));
  };

  const handleDownload = async (e: React.MouseEvent, file: FileNode) => {
    e.stopPropagation();
    try {
      const res = await fetch('/api/files/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: file.id }),
      });
      
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || t('downloadFailed'));
        return;
      }

      const { url } = await res.json();
      
      // Trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success(t('downloadStarted'));
    } catch (error) {
      console.error('Download error', error);
      toast.error(t('downloadFailed'));
    }
  };

  const handleDelete = async (e: React.MouseEvent, file: FileNode) => {
    e.stopPropagation();
    
    toast(t('deleteConfirm'), {
      action: {
        label: t('delete'),
        onClick: async () => {
          try {
            const res = await fetch('/api/files/delete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ids: [file.id] }),
            });

            if (!res.ok) {
              const err = await res.json();
              toast.error(err.error || t('deleteFailed'));
              return;
            }

            toast.success(t('deleteSuccess'));
            fetchFiles(currentFolderId, page, limit, debouncedSearch);
          } catch (error) {
            console.error('Delete error', error);
            toast.error(t('deleteFailed'));
          }
        },
      },
      cancel: {
        label: t('cancel'),
      },
    });
  };

  // --- Upload Logic ---

  const processUploadQueue = async (items: UploadItem[]) => {
    for (const item of items) {
      if (item.status !== 'pending') continue;

      // Update status to uploading
      setUploadQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'uploading' } : i));

      try {
        // 1. Get Presigned URL
        const initRes = await fetch('/api/files/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: item.file.name,
            contentType: item.file.type,
          }),
        });

        if (!initRes.ok) throw new Error('Failed to get upload URL');
        const { url, key } = await initRes.json();

        // 2. Upload to R2 with Progress
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('PUT', url, true);
          xhr.setRequestHeader('Content-Type', item.file.type);

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const percentComplete = (e.loaded / e.total) * 100;
              setUploadQueue(prev => prev.map(i => i.id === item.id ? { ...i, progress: percentComplete } : i));
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          };

          xhr.onerror = () => reject(new Error('Network error during upload'));
          xhr.send(item.file);
        });

        // 3. Complete Upload (Save Metadata)
        const completeRes = await fetch('/api/files/upload/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key,
            filename: item.file.name,
            size: item.file.size,
            type: item.file.type,
            parentId: currentFolderId,
          }),
        });

        if (!completeRes.ok) throw new Error('Failed to save file metadata');

        // Mark as completed
        setUploadQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'completed', progress: 100 } : i));
        
        // Refresh list
        fetchFiles(currentFolderId, page, limit, debouncedSearch);

      } catch (error) {
        console.error(`Upload failed for ${item.file.name}`, error);
        setUploadQueue(prev => prev.map(i => i.id === item.id ? { 
          ...i, 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        } : i));
      }
    }
  };

  const handleFilesSelected = (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    const newItems: UploadItem[] = Array.from(selectedFiles).map(file => ({
      id: crypto.randomUUID(),
      file,
      progress: 0,
      status: 'pending',
    }));

    setUploadQueue(prev => [...prev, ...newItems]);
    
    // Start processing immediately (or we could have a "Start Upload" button)
    // For better UX, let's start immediately but we need to be careful with closure state.
    // We'll call a function that takes the new items.
    processUploadQueue(newItems);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFilesSelected(e.dataTransfer.files);
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span className="text-blue-600">☁️</span> {t('title')}
          </h1>
          <div className="flex items-center gap-4">
            {/* Language Switcher */}
            <div className="relative">
              <button 
                onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                className="flex items-center gap-1 text-gray-500 hover:text-gray-700"
              >
                <Globe size={20} />
                <span className="uppercase text-sm font-medium">{locale}</span>
              </button>
              
              {isLangMenuOpen && (
                <div className="absolute right-0 mt-2 w-32 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                  <div className="py-1">
                    {[
                      { code: 'en', label: 'English' },
                      { code: 'zh-CN', label: '简体中文' },
                      { code: 'zh-TW', label: '繁體中文' },
                      { code: 'fr', label: 'Français' },
                      { code: 'de', label: 'Deutsch' },
                      { code: 'ja', label: '日本語' }
                    ].map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => handleLanguageChange(lang.code)}
                        className={`block w-full px-4 py-2 text-left text-sm ${
                          locale === lang.code ? 'bg-gray-100 text-gray-900' : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {lang.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button 
              onClick={() => {
                document.cookie = 'auth_token=; Max-Age=0; path=/;';
                router.push('/login');
              }}
              className="text-gray-500 hover:text-red-600"
              title={t('logout')}
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Toolbar */}
        <div className="mb-6 flex items-center justify-between">
          {/* Breadcrumbs */}
          <nav className="flex items-center text-sm text-gray-500 overflow-x-auto whitespace-nowrap pb-2 sm:pb-0">
            {folderHistory.map((item, index) => (
              <div key={item.id || 'root'} className="flex items-center">
                {index > 0 && <ChevronRight size={16} className="mx-1" />}
                <button
                  onClick={() => handleBreadcrumbClick(index)}
                  className={`hover:text-blue-600 flex items-center ${
                    index === folderHistory.length - 1 ? 'font-semibold text-gray-900' : ''
                  }`}
                >
                  {index === 0 && <Home size={14} className="mr-1" />}
                  {item.name}
                </button>
              </div>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex gap-2">
            <div className="relative rounded-md shadow-sm mr-2">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-4 w-4 text-gray-400" aria-hidden="true" />
              </div>
              <input
                type="text"
                className="block w-full rounded-md border-0 py-1.5 pl-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                placeholder={t('searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button
              onClick={() => setIsCreateFolderOpen(true)}
              className="inline-flex items-center gap-1 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              <Folder size={16} className="text-gray-500" />
              {t('newFolder')}
            </button>
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <Plus size={16} />
              {t('upload')}
            </button>
          </div>
        </div>

        {/* File List */}
        <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl">
          {loading ? (
            <div className="p-8 text-center text-gray-500">{t('loading')}</div>
          ) : files.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Folder size={48} className="mx-auto mb-4 text-gray-300" />
              <p>{debouncedSearch ? t('noSearchResults') : t('noFiles')}</p>
            </div>
          ) : (
            <ul role="list" className="divide-y divide-gray-100">
              {files.map((file) => (
                <li
                  key={file.id}
                  className="flex items-center justify-between gap-x-6 py-4 px-4 hover:bg-gray-50 sm:px-6 cursor-pointer group"
                  onClick={() => file.type === 'folder' && handleFolderClick(file)}
                >
                  <div className="flex min-w-0 gap-x-4 items-center flex-1">
                    {file.type === 'folder' ? (
                      <Folder className="h-10 w-10 flex-none text-blue-400" />
                    ) : (
                      <File className="h-10 w-10 flex-none text-gray-400" />
                    )}
                    <div className="min-w-0 flex-auto">
                      <p className="text-sm font-semibold leading-6 text-gray-900">{file.name}</p>
                      <p className="mt-1 truncate text-xs leading-5 text-gray-500">
                        {file.type === 'folder' ? 'Folder' : formatSize(file.size)} • {new Date(file.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  
                  {/* Row Actions */}
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {file.type === 'file' && isImage(file) && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); setPreviewFile(file); }}
                          className="p-2 text-gray-400 hover:text-blue-600 rounded-full hover:bg-blue-50"
                          title={t('preview')}
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          onClick={(e) => handleCopyLink(e, file)}
                          className="p-2 text-gray-400 hover:text-blue-600 rounded-full hover:bg-blue-50"
                          title={t('copyLink')}
                        >
                          <LinkIcon size={18} />
                        </button>
                      </>
                    )}
                    {file.type === 'file' && (
                      <button
                        onClick={(e) => handleDownload(e, file)}
                        className="p-2 text-gray-400 hover:text-blue-600 rounded-full hover:bg-blue-50"
                        title={t('download')}
                      >
                        <Download size={18} />
                      </button>
                    )}
                    <button
                      onClick={(e) => handleDelete(e, file)}
                      className="p-2 text-gray-400 hover:text-red-600 rounded-full hover:bg-red-50"
                      title={t('delete')}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Pagination */}
        {!loading && files.length > 0 && (
          <div className="mt-4 flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 shadow-sm sm:rounded-lg">
            <div className="flex flex-1 justify-between sm:hidden">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {t('previous')}
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {t('next')}
              </button>
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  {t.rich('showing', {
                    start: (page - 1) * limit + 1,
                    end: Math.min(page * limit, total),
                    total: total
                  })}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label htmlFor="limit" className="text-sm text-gray-700">{t('rowsPerPage')}</label>
                  <select
                    id="limit"
                    value={limit}
                    onChange={(e) => setLimit(Number(e.target.value))}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
                <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                  >
                    <span className="sr-only">{t('previous')}</span>
                    <ChevronRight className="h-5 w-5 rotate-180" aria-hidden="true" />
                  </button>
                  {/* Simple Page Indicator */}
                  <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 focus:outline-offset-0">
                    {t('pageOf', { page, totalPages })}
                  </span>
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                  >
                    <span className="sr-only">{t('next')}</span>
                    <ChevronRight className="h-5 w-5" aria-hidden="true" />
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Upload Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-20 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setIsUploadModalOpen(false)} />
            
            <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
              <div className="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
                <button
                  type="button"
                  className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  onClick={() => setIsUploadModalOpen(false)}
                >
                  <span className="sr-only">{t('cancel')}</span>
                  <X size={24} />
                </button>
              </div>
              
              <div className="sm:flex sm:items-start">
                <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
                  <h3 className="text-base font-semibold leading-6 text-gray-900">{t('uploadModalTitle')}</h3>
                  
                  {/* Drop Zone */}
                  <div 
                    className={`mt-4 flex justify-center rounded-lg border border-dashed px-6 py-10 ${
                      isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-900/25'
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <div className="text-center">
                      <Upload className="mx-auto h-12 w-12 text-gray-300" aria-hidden="true" />
                      <div className="mt-4 flex text-sm leading-6 text-gray-600 justify-center">
                        <label
                          htmlFor="file-upload-modal"
                          className="relative cursor-pointer rounded-md bg-white font-semibold text-blue-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-600 focus-within:ring-offset-2 hover:text-blue-500"
                        >
                          <span>{t('uploadSelect')}</span>
                          <input 
                            id="file-upload-modal" 
                            name="file-upload-modal" 
                            type="file" 
                            className="sr-only" 
                            multiple
                            ref={fileInputRef}
                            onChange={(e) => handleFilesSelected(e.target.files)}
                          />
                        </label>
                        <p className="pl-1">{t('uploadDragDrop')}</p>
                      </div>
                      <p className="text-xs leading-5 text-gray-600">{t('uploadLimit')}</p>
                    </div>
                  </div>

                  {/* Upload Queue List */}
                  {uploadQueue.length > 0 && (
                    <div className="mt-6 max-h-60 overflow-y-auto">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">{t('uploadQueue')}</h4>
                      <ul className="divide-y divide-gray-100 rounded-md border border-gray-200">
                        {uploadQueue.map((item) => (
                          <li key={item.id} className="flex items-center justify-between py-3 pl-3 pr-4 text-sm">
                            <div className="flex w-0 flex-1 items-center">
                              <FileText className="h-5 w-5 flex-shrink-0 text-gray-400" aria-hidden="true" />
                              <div className="ml-4 flex min-w-0 flex-1 gap-2 flex-col">
                                <span className="truncate font-medium">{item.file.name}</span>
                                <span className="text-xs text-gray-500">{formatSize(item.file.size)}</span>
                                {/* Progress Bar */}
                                {item.status === 'uploading' && (
                                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                                    <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${item.progress}%` }}></div>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="ml-4 flex-shrink-0">
                              {item.status === 'completed' && <CheckCircle className="h-5 w-5 text-green-500" />}
                              {item.status === 'error' && <AlertCircle className="h-5 w-5 text-red-500" title={item.error} />}
                              {item.status === 'pending' && <span className="text-gray-400 text-xs">Waiting...</span>}
                              {item.status === 'uploading' && <span className="text-blue-600 text-xs">{Math.round(item.progress)}%</span>}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Folder Modal */}
      {isCreateFolderOpen && (
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setIsCreateFolderOpen(false)} />
            
            <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-sm sm:p-6">
              <h3 className="text-base font-semibold leading-6 text-gray-900 mb-4">{t('createFolderTitle')}</h3>
              <form onSubmit={handleCreateFolder}>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder={t('folderNamePlaceholder')}
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 mb-4 px-3"
                  autoFocus
                />
                <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                  <button
                    type="submit"
                    className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:col-start-2"
                  >
                    {t('create')}
                  </button>
                  <button
                    type="button"
                    className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0"
                    onClick={() => setIsCreateFolderOpen(false)}
                  >
                    {t('cancel')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-30 overflow-y-auto" onClick={() => setPreviewFile(null)}>
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <div className="fixed inset-0 bg-black bg-opacity-90 transition-opacity" />
            
            <div className="relative transform overflow-hidden rounded-lg bg-transparent text-left shadow-xl transition-all sm:max-w-4xl sm:w-full" onClick={e => e.stopPropagation()}>
              <div className="absolute right-0 top-0 pr-4 pt-4 z-10">
                <button
                  type="button"
                  className="rounded-md bg-black/50 text-white hover:text-gray-200 focus:outline-none"
                  onClick={() => setPreviewFile(null)}
                >
                  <span className="sr-only">{t('cancel')}</span>
                  <X size={24} />
                </button>
              </div>
              
              <div className="flex flex-col items-center">
                <img 
                  src={`/raw/${previewFile.id}`} 
                  alt={previewFile.name}
                  className="max-h-[80vh] w-auto object-contain rounded-md"
                />
                <div className="mt-4 flex gap-4">
                  <button
                    onClick={(e) => handleCopyLink(e, previewFile)}
                    className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50"
                  >
                    <Copy size={16} />
                    {t('copyLink')}
                  </button>
                  <button
                    onClick={(e) => handleDownload(e, previewFile)}
                    className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
                  >
                    <Download size={16} />
                    {t('download')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

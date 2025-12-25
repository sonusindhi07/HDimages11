import React, { useState, useRef, useEffect, useCallback, useMemo, useReducer } from 'react';
import { 
  Image as ImageIcon, 
  Trash2, 
  ChevronLeft, 
  ChevronRight,
  Upload, 
  Folder,
  Plus,
  X,
  FolderPlus,
  Layers,
  FolderUp,
  Loader2,
  ChevronRightSquare,
  FileUp,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

// --- API CONFIGURATION ---
const API_BASE = "https://694d4185ad0f8c8e6e203206.mockapi.io/albums";

// --- STATE MANAGEMENT ---
const initialState = {
  items: [],
  status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
  error: null,
  syncing: false
};

function albumReducer(state, action) {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, status: 'loading' };
    case 'FETCH_SUCCESS':
      return { ...state, status: 'succeeded', items: action.payload };
    case 'FETCH_ERROR':
      return { ...state, status: 'failed', error: action.payload };
    case 'SYNC_START':
      return { ...state, syncing: true };
    case 'SYNC_END':
      return { ...state, syncing: false };
    case 'SET_ITEMS':
      return { ...state, items: action.payload };
    default:
      return state;
  }
}

const App = () => {
  const [state, dispatch] = useReducer(albumReducer, initialState);
  const { items: albums, status, syncing, error } = state;
  
  const [currentPath, setCurrentPath] = useState([]); 
  const [isCreatingAlbum, setIsCreatingAlbum] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [viewerIndex, setViewerIndex] = useState(null); 
  const [showAllNested, setShowAllNested] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [uploadProgress, setUploadProgress] = useState({ active: false, percent: 0, fileName: '' });
  
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  // --- BACKEND API ACTIONS ---
  
  const fetchWithRetry = async (url, options = {}, retries = 3, backoff = 500) => {
    try {
      const response = await fetch(url, options);
      if (response.status === 404) return null; // Handle missing resource gracefully
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (err) {
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, backoff));
        return fetchWithRetry(url, options, retries - 1, backoff * 2);
      }
      throw err;
    }
  };

  const fetchAlbums = async () => {
    dispatch({ type: 'FETCH_START' });
    try {
      const data = await fetchWithRetry(API_BASE);
      
      // If data is null or empty, it's a fresh API
      if (!data || data.length === 0) {
        dispatch({ type: 'FETCH_SUCCESS', payload: [] });
        return;
      }

      // Look for our specific data container (ID 1)
      const remoteEntry = data.find(item => item.id === "1");
      dispatch({ type: 'FETCH_SUCCESS', payload: remoteEntry?.data || [] });
    } catch (err) {
      console.error("Fetch Error:", err);
      dispatch({ type: 'FETCH_ERROR', payload: "Failed to connect to backend storage. Please check your MockAPI endpoint." });
    }
  };

  const syncToBackend = async (newAlbums) => {
    dispatch({ type: 'SYNC_START' });
    try {
      // Try to update existing record 1
      const response = await fetch(`${API_BASE}/1`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: newAlbums })
      });

      // If record 1 doesn't exist, create it
      if (!response.ok) {
        await fetch(API_BASE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: "1", data: newAlbums })
        });
      }
    } catch (err) {
      console.error("Cloud sync failed:", err);
    } finally {
      dispatch({ type: 'SYNC_END' });
    }
  };

  const persistChanges = (newAlbums) => {
    dispatch({ type: 'SET_ITEMS', payload: newAlbums });
    syncToBackend(newAlbums);
  };

  useEffect(() => {
    fetchAlbums();
  }, []);

  // --- NAVIGATION HELPERS ---
  const getCurrentDirectory = useCallback(() => {
    let current = albums;
    for (const id of currentPath) {
      const folder = current.find(a => a.id === id);
      if (folder) current = folder.subAlbums || [];
    }
    return current;
  }, [albums, currentPath]);

  const getCurrentAlbum = useCallback(() => {
    if (currentPath.length === 0) return null;
    let current = null;
    let list = albums;
    for (const id of currentPath) {
      current = list.find(a => a.id === id);
      list = current?.subAlbums || [];
    }
    return current;
  }, [albums, currentPath]);

  const getAllPhotosRecursive = useCallback((album, pathName = "") => {
    const currentName = pathName ? `${pathName} / ${album.name}` : album.name;
    let photos = (album.images || []).map(img => ({ ...img, folderName: currentName }));
    if (album.subAlbums) {
      album.subAlbums.forEach(sub => {
        photos = [...photos, ...getAllPhotosRecursive(sub, currentName)];
      });
    }
    return photos;
  }, []);

  const activePhotos = useMemo(() => {
    const album = getCurrentAlbum();
    if (!album) return [];
    return showAllNested ? getAllPhotosRecursive(album) : (album.images || []);
  }, [getCurrentAlbum, showAllNested, getAllPhotosRecursive]);

  const navigateUp = () => {
    setCurrentPath(prev => prev.slice(0, -1));
    setShowAllNested(false);
  };

  const simulateUpload = async (name) => {
    setUploadProgress({ active: true, percent: 0, fileName: name });
    for (let i = 0; i <= 100; i += 20) {
      setUploadProgress(prev => ({ ...prev, percent: i }));
      await new Promise(r => setTimeout(r, 100));
    }
    setUploadProgress({ active: false, percent: 0, fileName: '' });
  };

  const processEntry = async (entry, targetList) => {
    if (entry.isFile) {
      const file = await new Promise((resolve) => entry.file(resolve));
      if (file.type.startsWith('image/')) {
        targetList.images.push({
          id: Math.random().toString(36).substr(2, 9),
          name: file.name,
          url: URL.createObjectURL(file),
          size: (file.size / 1024).toFixed(1) + ' KB'
        });
      }
    } else if (entry.isDirectory) {
      let folder = targetList.subAlbums.find(f => f.name === entry.name);
      if (!folder) {
        folder = { id: Math.random().toString(36).substr(2, 9), name: entry.name, images: [], subAlbums: [] };
        targetList.subAlbums.push(folder);
      }
      const dirReader = entry.createReader();
      const entries = await new Promise((resolve) => dirReader.readEntries(resolve));
      for (const childEntry of entries) {
        await processEntry(childEntry, folder);
      }
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    const items = e.dataTransfer.items;
    if (!items) return;

    await simulateUpload("Batch Uploading Folders...");
    const nextAlbums = JSON.parse(JSON.stringify(albums));
    let targetNode = { subAlbums: nextAlbums, images: [] };

    if (currentPath.length > 0) {
      let current = nextAlbums;
      let found = null;
      for (const id of currentPath) {
        found = current.find(a => a.id === id);
        if (found) current = found.subAlbums;
      }
      if (found) targetNode = found;
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry();
        if (entry) await processEntry(entry, targetNode);
      }
    }
    persistChanges(nextAlbums);
  };

  const createAlbum = () => {
    if (!newAlbumName.trim()) return;
    const newAlbum = {
      id: Math.random().toString(36).substr(2, 9),
      name: newAlbumName,
      images: [],
      subAlbums: []
    };

    let nextAlbums;
    if (currentPath.length === 0) {
      nextAlbums = [...albums, newAlbum];
    } else {
      const updateRecursive = (list) => {
        return list.map(item => {
          if (item.id === currentPath[currentPath.length - 1]) {
            return { ...item, subAlbums: [...(item.subAlbums || []), newAlbum] };
          }
          if (item.subAlbums) {
            return { ...item, subAlbums: updateRecursive(item.subAlbums) };
          }
          return item;
        });
      };
      nextAlbums = updateRecursive(albums);
    }
    persistChanges(nextAlbums);
    setNewAlbumName('');
    setIsCreatingAlbum(false);
  };

  const deleteAlbum = (e, id) => {
    if (e) e.stopPropagation();
    const deleteRecursive = (list) => {
      return list.filter(item => {
        if (item.id === id) return false;
        if (item.subAlbums) {
          item.subAlbums = deleteRecursive(item.subAlbums);
        }
        return true;
      });
    };
    persistChanges(deleteRecursive([...albums]));
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (!files.length || currentPath.length === 0) return;

    await simulateUpload(files.length === 1 ? files[0].name : `${files.length} images`);

    const newImages = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      url: URL.createObjectURL(file),
      size: (file.size / 1024).toFixed(1) + ' KB'
    }));

    const updateRecursive = (list) => {
      return list.map(item => {
        if (item.id === currentPath[currentPath.length - 1]) {
          return { ...item, images: [...(item.images || []), ...newImages] };
        }
        if (item.subAlbums) {
          return { ...item, subAlbums: updateRecursive(item.subAlbums) };
        }
        return item;
      });
    };
    persistChanges(updateRecursive(albums));
    e.target.value = '';
  };

  const deleteImage = useCallback((e, imageId) => {
    if (e) e.stopPropagation();
    const deleteFromRecursive = (list) => {
      return list.map(item => {
        const newItem = { ...item };
        if (newItem.images) newItem.images = newItem.images.filter(img => img.id !== imageId);
        if (newItem.subAlbums) newItem.subAlbums = deleteFromRecursive(newItem.subAlbums);
        return newItem;
      });
    };
    persistChanges(deleteFromRecursive([...albums]));
  }, [albums]);

  const navigateViewer = useCallback((direction) => {
    if (viewerIndex === null || activePhotos.length === 0) return;
    setViewerIndex((prev) => (prev + direction + activePhotos.length) % activePhotos.length);
  }, [viewerIndex, activePhotos]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setViewerIndex(null);
        setIsCreatingAlbum(false);
      }
      if (viewerIndex !== null) {
        if (e.key === 'ArrowRight') navigateViewer(1);
        else if (e.key === 'ArrowLeft') navigateViewer(-1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewerIndex, navigateViewer]);

  const currentAlbum = getCurrentAlbum();
  const currentItems = getCurrentDirectory();

  if (status === 'loading') {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-white z-[100]">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Connecting to Cloud...</p>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-white px-6 text-center z-[100]">
        <div className="bg-red-50 p-6 rounded-3xl mb-4 text-red-500"><AlertCircle size={48} /></div>
        <h2 className="text-2xl font-black text-slate-800 mb-2">Backend Connection Failed</h2>
        <p className="text-slate-500 max-w-sm mb-6">{error}</p>
        <button onClick={fetchAlbums} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold shadow-xl">Retry Connection</button>
      </div>
    );
  }

  return (
    <div 
      className="flex flex-col h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden relative"
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {syncing && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-white shadow-xl border px-4 py-2 rounded-full flex items-center gap-2 animate-bounce">
          <Loader2 size={12} className="text-blue-600 animate-spin" />
          <span className="text-[10px] font-black uppercase tracking-tighter text-slate-600">Cloud Sync Active</span>
        </div>
      )}

      {uploadProgress.active && (
        <div className="fixed bottom-6 right-6 z-[60] w-80 bg-white rounded-2xl shadow-2xl border p-4">
          <div className="flex items-center gap-3 mb-3">
            <Upload size={18} className="text-blue-600 animate-pulse" />
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-black uppercase text-slate-800 truncate">Uploading...</h4>
              <p className="text-[10px] text-slate-500 truncate">{uploadProgress.fileName}</p>
            </div>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${uploadProgress.percent}%` }} />
          </div>
        </div>
      )}

      {isDragging && (
        <div className="absolute inset-0 z-50 bg-blue-600/90 backdrop-blur-sm flex items-center justify-center border-8 border-dashed border-white/50 m-4 rounded-3xl pointer-events-none">
          <div className="flex flex-col items-center gap-6 text-white text-center">
            <FileUp size={80} className="animate-bounce" />
            <h3 className="text-4xl font-black">Drop to Sync</h3>
          </div>
        </div>
      )}

      <header className="bg-white border-b flex-shrink-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => {setCurrentPath([]); setShowAllNested(false);}}>
            <div className="bg-blue-600 p-2 rounded-xl shadow-lg"><ImageIcon className="text-white w-5 h-5" /></div>
            <h1 className="text-xl font-black tracking-tight text-slate-800">PhotoVault</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => folderInputRef.current?.click()} className="bg-white border px-3 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2">
              <FolderUp size={14} /> <span>Bulk Upload</span>
            </button>
            {currentPath.length > 0 && (
              <button onClick={() => fileInputRef.current?.click()} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-full text-xs font-bold shadow-md flex items-center gap-2">
                <Upload size={14} /> <span>Add Pics</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="mb-6 flex items-center gap-2 text-[11px] text-slate-400 font-black tracking-widest uppercase bg-white border px-4 py-3 rounded-2xl">
            <span className="hover:text-blue-600 cursor-pointer" onClick={() => {setCurrentPath([]); setShowAllNested(false);}}>Root</span>
            {currentPath.map((id, idx) => (
              <React.Fragment key={id}>
                <ChevronRight size={14} />
                <span className="text-blue-600">{id}</span>
              </React.Fragment>
            ))}
          </div>

          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              {currentPath.length > 0 && (
                <button onClick={navigateUp} className="p-3 bg-white border rounded-2xl hover:bg-slate-50 shadow-sm"><ChevronLeft size={20} /></button>
              )}
              <h2 className="text-3xl font-black text-slate-800">{currentPath.length === 0 ? "Collections" : currentAlbum?.name}</h2>
            </div>
            {!showAllNested && (
              <button onClick={() => setIsCreatingAlbum(true)} className="bg-white border-2 border-slate-200 text-slate-700 hover:border-blue-500 hover:text-blue-600 px-6 py-2.5 rounded-2xl font-bold transition-all text-sm flex items-center gap-2">
                <FolderPlus size={18} /> New Folder
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {isCreatingAlbum && (
              <div className="bg-white p-4 rounded-2xl border-2 border-dashed border-blue-400 flex flex-col gap-3 shadow-xl">
                <input autoFocus className="w-full px-3 py-2 border rounded-lg text-xs font-bold outline-none" placeholder="Folder name..." value={newAlbumName} onChange={(e) => setNewAlbumName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createAlbum()} />
                <div className="flex gap-2">
                  <button onClick={createAlbum} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-[10px] font-black uppercase">Create</button>
                  <button onClick={() => setIsCreatingAlbum(false)} className="flex-1 bg-slate-100 py-2 rounded-lg text-[10px] font-bold">Cancel</button>
                </div>
              </div>
            )}

            {!showAllNested && currentItems.map(album => (
              <div key={album.id} onClick={() => {setCurrentPath([...currentPath, album.id]); setShowAllNested(false);}}
                   className="group relative bg-white rounded-2xl border shadow-sm hover:shadow-xl transition-all cursor-pointer overflow-hidden">
                <div className="aspect-square bg-slate-100 flex items-center justify-center relative">
                  {album.images?.[0] ? <img src={album.images[0].url} alt="" className="w-full h-full object-cover" /> : <Folder size={48} className="text-slate-300" />}
                  <button onClick={(e) => deleteAlbum(e, album.id)} className="absolute top-2 right-2 p-2 bg-white text-slate-400 hover:bg-red-500 hover:text-white rounded-full opacity-0 group-hover:opacity-100 shadow-md transition-all"><Trash2 size={14} /></button>
                </div>
                <div className="p-3 border-t">
                  <h3 className="font-bold truncate text-slate-800 text-sm">{album.name}</h3>
                  <p className="text-[9px] text-blue-500 font-black uppercase tracking-tighter mt-1">{album.images?.length || 0} pics</p>
                </div>
              </div>
            ))}

            {activePhotos.map((image, index) => (
              <div key={image.id} onClick={() => setViewerIndex(index)}
                   className="group relative bg-white rounded-xl border-2 overflow-hidden shadow-sm hover:ring-2 hover:ring-blue-500 border-white transition-all cursor-zoom-in">
                <div className="aspect-[4/3] bg-slate-200 overflow-hidden">
                  <img src={image.url} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  <button onClick={(e) => deleteImage(e, image.id)} className="absolute top-2 right-2 p-2 bg-black/60 text-white rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all"><Trash2 size={12} /></button>
                </div>
                <div className="p-2 bg-white"><p className="text-[10px] font-bold truncate text-slate-700">{image.name}</p></div>
              </div>
            ))}
            
            {currentPath.length > 0 && !showAllNested && (
               <div onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-blue-50 transition-all text-slate-400 hover:text-blue-500 bg-white group">
                  <Plus size={28} />
                  <span className="text-[9px] font-black uppercase">Add Item</span>
                </div>
            )}
          </div>
        </div>
      </main>

      {viewerIndex !== null && activePhotos[viewerIndex] && (
        <div className="fixed inset-0 z-[110] bg-black/98 flex flex-col items-center justify-center backdrop-blur-xl animate-in fade-in">
          <button onClick={() => setViewerIndex(null)} className="absolute top-6 right-6 p-3 text-white hover:bg-white/10 rounded-full transition-all"><X size={32} /></button>
          <div className="w-full max-h-[80vh] flex items-center justify-center p-4">
            <img src={activePhotos[viewerIndex].url} alt="" className="max-w-full max-h-full object-contain" />
          </div>
        </div>
      )}

      <input type="file" multiple accept="image/*" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
      <input type="file" webkitdirectory="true" directory="" ref={folderInputRef} className="hidden" onChange={handleFileUpload} />
    </div>
  );
};

export default App;
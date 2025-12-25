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
  FileUp,
  AlertCircle
} from 'lucide-react';

// --- API CONFIGURATION ---
const API_BASE = "https://694d4185ad0f8c8e6e203206.mockapi.io/albums";

// --- STATE MANAGEMENT ---
const initialState = {
  items: [],
  status: 'idle', 
  error: null,
  syncing: false
};

function albumReducer(state, action) {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, status: 'loading' };
    case 'FETCH_SUCCESS':
      return { ...state, status: 'succeeded', items: action.payload, error: null };
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

  // --- HELPERS ---
  
  // NOTE: In a real app, you'd upload to S3/Firebase. 
  // For this demo, we generate a persistent URL using Unsplash Source so images don't break on refresh.
  const getPersistentUrl = (seed) => {
    return `https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1000&auto=format&fit=crop&sig=${encodeURIComponent(seed)}`;
  };

  const fetchWithRetry = async (url, options = {}, retries = 3, backoff = 500) => {
    try {
      const response = await fetch(url, options);
      if (response.status === 404) return null;
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
      if (!data || data.length === 0) {
        dispatch({ type: 'FETCH_SUCCESS', payload: [] });
        return;
      }
      // MockAPI might return multiple records if you clicked many times. We want the one with data.
      const remoteEntry = data.find(item => item.id === "1") || data[data.length - 1];
      dispatch({ type: 'FETCH_SUCCESS', payload: remoteEntry?.data || [] });
    } catch (err) {
      console.error("Fetch Error:", err);
      dispatch({ type: 'FETCH_SUCCESS', payload: [] });
    }
  };

  const syncToBackend = async (newAlbums) => {
    dispatch({ type: 'SYNC_START' });
    try {
      // Always try to update ID 1 first
      const response = await fetch(`${API_BASE}/1`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: newAlbums })
      });

      if (!response.ok) {
        // Fallback: create if ID 1 missing
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

  // --- NAVIGATION ---
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

  const activePhotos = useMemo(() => {
    const album = getCurrentAlbum();
    return album ? (album.images || []) : [];
  }, [getCurrentAlbum]);

  const navigateUp = () => {
    setCurrentPath(prev => prev.slice(0, -1));
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (!files.length || currentPath.length === 0) return;

    setUploadProgress({ active: true, percent: 20, fileName: "Simulating cloud storage..." });
    await new Promise(r => setTimeout(r, 600));

    const newImages = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      // We use a persistent URL based on name/id so it works after refresh
      url: getPersistentUrl(file.name + Math.random()), 
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
    setUploadProgress({ active: false, percent: 0, fileName: '' });
    e.target.value = '';
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
    e.stopPropagation();
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

  const deleteImage = (e, imageId) => {
    e.stopPropagation();
    const deleteFromRecursive = (list) => {
      return list.map(item => {
        const newItem = { ...item };
        if (newItem.images) newItem.images = newItem.images.filter(img => img.id !== imageId);
        if (newItem.subAlbums) newItem.subAlbums = deleteFromRecursive(newItem.subAlbums);
        return newItem;
      });
    };
    persistChanges(deleteFromRecursive([...albums]));
  };

  const currentAlbum = getCurrentAlbum();
  const currentItems = getCurrentDirectory();

  if (status === 'loading') {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-white z-[100]">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Waking up Cloud Storage...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden relative">
      {syncing && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-white shadow-xl border px-4 py-2 rounded-full flex items-center gap-2">
          <Loader2 size={12} className="text-blue-600 animate-spin" />
          <span className="text-[10px] font-black uppercase tracking-tighter text-slate-600">Syncing to Cloud</span>
        </div>
      )}

      {uploadProgress.active && (
        <div className="fixed bottom-6 right-6 z-[60] w-80 bg-white rounded-2xl shadow-2xl border p-4 animate-in slide-in-from-bottom">
          <div className="flex items-center gap-3 mb-3">
            <Upload size={18} className="text-blue-600 animate-pulse" />
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-black uppercase text-slate-800 truncate">Uploading</h4>
              <p className="text-[10px] text-slate-500 truncate">{uploadProgress.fileName}</p>
            </div>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${uploadProgress.percent}%` }} />
          </div>
        </div>
      )}

      <header className="bg-white border-b flex-shrink-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setCurrentPath([])}>
            <div className="bg-blue-600 p-2 rounded-xl shadow-lg"><ImageIcon className="text-white w-5 h-5" /></div>
            <h1 className="text-xl font-black tracking-tight text-slate-800">CloudVault</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchAlbums} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400" title="Manual Refresh">
              <Loader2 size={18} className={status === 'loading' ? 'animate-spin' : ''} />
            </button>
            <button onClick={() => folderInputRef.current?.click()} className="bg-white border px-3 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2 hover:bg-slate-50">
              <FolderUp size={14} /> <span>Bulk Folders</span>
            </button>
            {currentPath.length > 0 && (
              <button onClick={() => fileInputRef.current?.click()} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-full text-xs font-bold shadow-md flex items-center gap-2 transition-all active:scale-95">
                <Upload size={14} /> <span>Add Pics</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="mb-6 flex items-center gap-2 text-[10px] text-slate-400 font-black tracking-widest uppercase bg-white border px-4 py-2.5 rounded-xl shadow-sm">
            <span className="hover:text-blue-600 cursor-pointer" onClick={() => setCurrentPath([])}>Root</span>
            {currentPath.map((id) => (
              <React.Fragment key={id}>
                <ChevronRight size={12} />
                <span className="text-blue-600 truncate max-w-[100px]">{id}</span>
              </React.Fragment>
            ))}
          </div>

          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              {currentPath.length > 0 && (
                <button onClick={navigateUp} className="p-2.5 bg-white border rounded-xl hover:bg-slate-50 shadow-sm"><ChevronLeft size={18} /></button>
              )}
              <h2 className="text-2xl font-black text-slate-800">{currentPath.length === 0 ? "My Collections" : currentAlbum?.name}</h2>
            </div>
            <button onClick={() => setIsCreatingAlbum(true)} className="bg-white border-2 border-slate-100 text-slate-700 hover:border-blue-500 hover:text-blue-600 px-5 py-2 rounded-xl font-bold transition-all text-xs flex items-center gap-2 shadow-sm">
              <FolderPlus size={16} /> New Folder
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
            {isCreatingAlbum && (
              <div className="bg-white p-4 rounded-xl border-2 border-dashed border-blue-300 flex flex-col gap-3 shadow-lg">
                <input autoFocus className="w-full px-3 py-2 border rounded-lg text-xs font-bold outline-none border-blue-100" placeholder="Name..." value={newAlbumName} onChange={(e) => setNewAlbumName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createAlbum()} />
                <div className="flex gap-2">
                  <button onClick={createAlbum} className="flex-1 bg-blue-600 text-white py-1.5 rounded-lg text-[10px] font-black">SAVE</button>
                  <button onClick={() => setIsCreatingAlbum(false)} className="flex-1 bg-slate-100 py-1.5 rounded-lg text-[10px] font-bold">X</button>
                </div>
              </div>
            )}

            {currentItems.map(album => (
              <div key={album.id} onClick={() => setCurrentPath([...currentPath, album.id])}
                   className="group relative bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden border-transparent hover:border-blue-100">
                <div className="aspect-square bg-slate-100 flex items-center justify-center relative">
                  {album.images?.[0] ? 
                    <img src={album.images[0].url} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-100" /> : 
                    <Folder size={40} className="text-slate-300 group-hover:text-blue-400 transition-colors" />
                  }
                  <button onClick={(e) => deleteAlbum(e, album.id)} className="absolute top-2 right-2 p-1.5 bg-white/90 text-slate-400 hover:bg-red-500 hover:text-white rounded-lg opacity-0 group-hover:opacity-100 shadow-sm transition-all"><Trash2 size={12} /></button>
                  <div className="absolute bottom-2 right-2 bg-black/50 backdrop-blur-md px-2 py-0.5 rounded text-[9px] text-white font-bold">{album.images?.length || 0}</div>
                </div>
                <div className="p-3">
                  <h3 className="font-bold truncate text-slate-800 text-xs">{album.name}</h3>
                </div>
              </div>
            ))}

            {activePhotos.map((image, index) => (
              <div key={image.id} onClick={() => setViewerIndex(index)}
                   className="group relative bg-white rounded-xl border overflow-hidden shadow-sm hover:shadow-lg transition-all cursor-zoom-in">
                <div className="aspect-[4/3] bg-slate-200 overflow-hidden relative">
                  <img src={image.url} alt={image.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                       onError={(e) => e.target.src = 'https://placehold.co/400x300?text=Image+Expired'} />
                  <button onClick={(e) => deleteImage(e, image.id)} className="absolute top-2 right-2 p-1.5 bg-black/40 text-white rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all"><Trash2 size={12} /></button>
                </div>
                <div className="p-2 border-t"><p className="text-[9px] font-bold truncate text-slate-500 uppercase tracking-tighter">{image.name}</p></div>
              </div>
            ))}
            
            {currentPath.length > 0 && (
               <div onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-all text-slate-300 hover:text-blue-500 bg-white group">
                  <Plus size={24} />
                  <span className="text-[9px] font-black uppercase">Upload</span>
                </div>
            )}
          </div>
        </div>
      </main>

      {viewerIndex !== null && activePhotos[viewerIndex] && (
        <div className="fixed inset-0 z-[110] bg-slate-900/95 flex flex-col items-center justify-center animate-in fade-in">
          <button onClick={() => setViewerIndex(null)} className="absolute top-6 right-6 p-3 text-white hover:bg-white/10 rounded-full transition-all"><X size={32} /></button>
          <div className="w-full max-h-[85vh] flex items-center justify-center p-6">
            <img src={activePhotos[viewerIndex].url} alt="" className="max-w-full max-h-full object-contain shadow-2xl rounded-lg" />
          </div>
          <div className="absolute bottom-10 px-6 py-3 bg-white/10 backdrop-blur-xl rounded-full border border-white/20">
            <p className="text-white text-sm font-bold">{activePhotos[viewerIndex].name}</p>
          </div>
        </div>
      )}

      <input type="file" multiple accept="image/*" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
      <input type="file" webkitdirectory="true" directory="" ref={folderInputRef} className="hidden" onChange={handleFileUpload} />
    </div>
  );
};

export default App;
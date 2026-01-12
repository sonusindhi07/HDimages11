import React, { useState, useEffect } from 'react';
import { 
  Download, 
  Link as LinkIcon, 
  Youtube, 
  Instagram, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Play,
  Settings2,
  History
} from 'lucide-react';

const App = () => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('idle'); // idle, processing, success, error
  const [errorMsg, setErrorMsg] = useState('');
  const [downloadHistory, setDownloadHistory] = useState([]);
  const [selectedQuality, setSelectedQuality] = useState('1080p');

  // Detect platform based on URL
  const getPlatform = (link) => {
    if (link.includes('youtube.com') || link.includes('youtu.be')) return 'YouTube';
    if (link.includes('instagram.com')) return 'Instagram';
    return 'Unknown';
  };

  const validateUrl = (link) => {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
    const instagramRegex = /^(https?:\/\/)?(www\.)?instagram\.com\/(p|reels|reel|tv)\/.+$/;
    return youtubeRegex.test(link) || instagramRegex.test(link);
  };

  const handleDownload = async (e) => {
    e.preventDefault();
    
    if (!url) {
      setErrorMsg('Please paste a link first.');
      setStatus('error');
      return;
    }

    if (!validateUrl(url)) {
      setErrorMsg('Invalid URL. Please provide a valid YouTube or Instagram link.');
      setStatus('error');
      return;
    }

    setStatus('processing');
    setLoading(true);

    // Simulate API Call for downloading
    // In a real scenario, this would call a backend service that interacts with yt-dlp or similar
    try {
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const newEntry = {
        id: Date.now(),
        url,
        platform: getPlatform(url),
        quality: selectedQuality,
        date: new Date().toLocaleTimeString(),
      };

      setDownloadHistory([newEntry, ...downloadHistory].slice(0, 5));
      setStatus('success');
      setUrl('');
    } catch (err) {
      setErrorMsg('Server busy. Please try again later.');
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Navigation */}
      <nav className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2 font-bold text-xl text-indigo-600">
            <Download className="w-6 h-6" />
            <span>StreamFetch</span>
          </div>
          <div className="hidden md:flex gap-6 text-sm font-medium text-slate-600">
            <a href="#" className="hover:text-indigo-600 transition-colors">How it works</a>
            <a href="#" className="hover:text-indigo-600 transition-colors">Supported Sites</a>
            <a href="#" className="hover:text-indigo-600 transition-colors">Privacy</a>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4 tracking-tight">
            Download <span className="text-indigo-600">Videos & Reels</span> Instantly
          </h1>
          <p className="text-slate-500 text-lg max-w-2xl mx-auto">
            High-quality video downloader for YouTube and Instagram. Just paste the link and save your favorite content in seconds.
          </p>
        </div>

        {/* Input Card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 p-6 md:p-8 mb-10 border border-slate-100">
          <form onSubmit={handleDownload} className="space-y-6">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <LinkIcon className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-11 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-slate-700 placeholder:text-slate-400"
                placeholder="Paste YouTube or Instagram link here..."
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (status !== 'idle') setStatus('idle');
                }}
              />
            </div>

            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 flex items-center gap-4 bg-slate-50 p-2 rounded-xl border border-slate-200">
                <span className="pl-3 text-sm font-semibold text-slate-500 flex items-center gap-1">
                  <Settings2 className="w-4 h-4" /> Quality:
                </span>
                <div className="flex gap-2">
                  {['720p', '1080p', '4K'].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setSelectedQuality(q)}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                        selectedQuality === q 
                        ? 'bg-indigo-600 text-white shadow-md' 
                        : 'bg-white text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold py-4 px-8 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-200 min-w-[180px]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    Download Now
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Status Indicators */}
          <div className="mt-6">
            {status === 'success' && (
              <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 px-4 py-3 rounded-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-sm font-medium">Link processed successfully! Your download will start automatically.</span>
              </div>
            )}
            {status === 'error' && (
              <div className="bg-rose-50 border border-rose-100 text-rose-700 px-4 py-3 rounded-lg flex items-center gap-3">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm font-medium">{errorMsg}</span>
              </div>
            )}
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="p-6 bg-white rounded-xl border border-slate-100 text-center">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Youtube className="w-6 h-6" />
            </div>
            <h3 className="font-bold mb-2">YouTube Support</h3>
            <p className="text-sm text-slate-500 text-balance">Download full videos, shorts, or just the audio in high bitrate.</p>
          </div>
          <div className="p-6 bg-white rounded-xl border border-slate-100 text-center">
            <div className="w-12 h-12 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Instagram className="w-6 h-6" />
            </div>
            <h3 className="font-bold mb-2">Instagram Reels</h3>
            <p className="text-sm text-slate-500 text-balance">Save Reels and IGTV videos directly to your device gallery.</p>
          </div>
          <div className="p-6 bg-white rounded-xl border border-slate-100 text-center">
            <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <History className="w-6 h-6" />
            </div>
            <h3 className="font-bold mb-2">Fast & Free</h3>
            <p className="text-sm text-slate-500 text-balance">No registration required. Unlimited downloads at maximum speed.</p>
          </div>
        </div>

        {/* Recent Downloads Simulation */}
        {downloadHistory.length > 0 && (
          <div className="animate-in fade-in duration-700">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <History className="w-5 h-5 text-slate-400" />
              Recent Activity
            </h2>
            <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
              {downloadHistory.map((item) => (
                <div key={item.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${item.platform === 'YouTube' ? 'bg-red-50 text-red-500' : 'bg-pink-50 text-pink-500'}`}>
                      {item.platform === 'YouTube' ? <Youtube className="w-5 h-5" /> : <Instagram className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold truncate max-w-[200px] md:max-w-md">
                        {item.url}
                      </p>
                      <div className="flex gap-3 text-xs text-slate-400 mt-1">
                        <span>{item.date}</span>
                        <span>•</span>
                        <span className="uppercase">{item.quality}</span>
                      </div>
                    </div>
                  </div>
                  <button className="text-indigo-600 hover:text-indigo-800 p-2">
                    <Play className="w-5 h-5 fill-current" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="max-w-5xl mx-auto px-6 py-8 border-t border-slate-200 mt-12 text-center text-slate-400 text-sm">
        <p>© 2024 StreamFetch Downloader. For personal use only. Please respect copyright laws.</p>
      </footer>
    </div>
  );
};

export default App;

import React, { useState } from 'react';
import { Shield, Trash2, List, Plus, AlertCircle, RefreshCw } from 'lucide-react';
import { TRANSLATIONS } from '../utils/translations';

interface BlacklistManagerProps {
  lang: 'ja' | 'en';
  blacklist: string[];
  onAddCode: (code: string) => void;
  onRemoveCode: (code: string) => void;
  onClearAll: () => void;
}

export default function BlacklistManager({ lang, blacklist, onAddCode, onRemoveCode, onClearAll }: BlacklistManagerProps) {
  const [manualCode, setManualCode] = useState('');
  const t = TRANSLATIONS[lang];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    onAddCode(manualCode.trim());
    setManualCode('');
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-left h-full" id="blacklist-manager-panel">
      <div className="flex items-center justify-between mb-4 border-b border-slate-800/60 pb-3">
        <h3 className="text-sm font-semibold tracking-wider text-slate-300 uppercase flex items-center gap-2">
          <Shield className="w-4 h-4 text-rose-400" />
          {t.blackTitle}
        </h3>
        
        <span className="text-xs font-mono font-bold text-slate-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-850">
          {t.blackTotalLabel} <span className="text-rose-400 font-bold">{blacklist.length}</span>
        </span>
      </div>

      <p className="text-xs text-slate-400 mb-4 leading-relaxed font-sans">
        {t.blackDesc}
      </p>

      {/* Manual Insert Form */}
      <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
        <input
          type="text"
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value.toUpperCase())}
          placeholder={t.blackPlaceholder}
          className="grow bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-lg px-3.5 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-rose-500 font-sans"
          id="blacklist-manual-input"
        />
        <button
          type="submit"
          disabled={!manualCode.trim()}
          className="bg-rose-950/20 hover:bg-rose-950/40 border border-rose-500/20 hover:border-rose-500/40 text-rose-400 font-semibold rounded-lg px-4 py-1.5 text-xs font-sans transition disabled:opacity-40"
          id="blacklist-add-submit-btn"
        >
          {t.blackAddBtn}
        </button>
      </form>

      {/* Blacklist scroll panel */}
      {blacklist.length > 0 ? (
        <div className="space-y-2">
          <div className="max-h-[160px] overflow-y-auto border border-slate-950 bg-slate-950/50 rounded-xl divide-y divide-slate-950/80 pr-1">
            {blacklist.map((code) => (
              <div key={code} className="flex items-center justify-between p-2.5 transition hover:bg-slate-950/80">
                <span className="text-xs font-mono font-bold tracking-wide text-rose-400/90">{code}</span>
                <button
                  onClick={() => onRemoveCode(code)}
                  className="text-slate-500 hover:text-rose-400 p-1 rounded-md hover:bg-slate-900 transition"
                  title="Remove from Cache"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center pt-3 border-t border-slate-850">
            <span className="text-[10px] text-rose-400/70 flex items-center gap-1 font-sans">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {lang === 'ja' ? '※ 実装された `localStorage` 内のキーと完全に同期しています。' : '※ Fully synchronized with the active keys in localStorage.'}
            </span>

            <button
              onClick={onClearAll}
              className="text-[10px] bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-medium py-1 px-3 rounded-lg border border-rose-500/20 transition flex items-center gap-1 font-sans"
              id="btn-clear-blacklist"
            >
              <Trash2 className="w-3 h-3" />
              {t.blackClearBtn}
            </button>
          </div>
        </div>
      ) : (
        <div className="py-8 text-center bg-slate-950/40 border border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center gap-2">
          <List className="w-6 h-6 text-slate-600" />
          <p className="text-[11px] text-slate-500 font-sans">{t.blackNoData}</p>
        </div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { Settings, FileCode, Check, Copy, HelpCircle, ToggleLeft, ToggleRight, Trash2, Download, FolderArchive } from 'lucide-react';
import { ClaimConfig } from '../types';
import JSZip from 'jszip';
import {
  getDynamicUserscriptCode,
  getDynamicManifest,
  getExtContentScript,
  getPopupHtml,
  getPopupJs,
  getDashboardHtml,
  getDashboardJs,
  getReadmeText
} from '../utils/extensionTemplates';
import { TRANSLATIONS } from '../utils/translations';

interface ConfiguratorProps {
  lang: 'ja' | 'en';
  config: ClaimConfig;
  onConfigChange: (newConfig: ClaimConfig) => void;
}

export default function Configurator({ lang, config, onConfigChange }: ConfiguratorProps) {
  const [activeCodeTab, setActiveCodeTab] = useState<'userscript' | 'extension-js' | 'manifest'>('userscript');
  const [copied, setCopied] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');
  const [isZipping, setIsZipping] = useState(false);
  const t = TRANSLATIONS[lang];

  const triggerCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onConfigChange({
      ...config,
      delayMs: parseInt(e.target.value) || 150
    });
  };

  const handleToggleAutoClose = () => {
    onConfigChange({
      ...config,
      autoCloseLimit: !config.autoCloseLimit
    });
  };

  const handleToggleAudio = () => {
    onConfigChange({
      ...config,
      audioAlert: !config.audioAlert
    });
  };

  const handleAddKeyword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword.trim()) return;
    const cleanKw = newKeyword.trim();
    if (!config.keywords.includes(cleanKw)) {
      onConfigChange({
        ...config,
        keywords: [...config.keywords, cleanKw]
      });
    }
    setNewKeyword('');
  };

  const handleRemoveKeyword = (kwToRemove: string) => {
    onConfigChange({
      ...config,
      keywords: config.keywords.filter(kw => kw !== kwToRemove)
    });
  };

  const getActiveCode = () => {
    if (activeCodeTab === 'userscript') return getDynamicUserscriptCode(config);
    if (activeCodeTab === 'extension-js') return getDynamicUserscriptCode(config);
    return getDynamicManifest();
  };

  const downloadFile = (filename: string, content: string, contentType: string) => {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSingleFileDownload = () => {
    if (activeCodeTab === 'userscript') {
      downloadFile('stake_bonus_claimer.user.js', getDynamicUserscriptCode(config), 'application/javascript');
    } else if (activeCodeTab === 'extension-js') {
      downloadFile('stake_bonus_claimer.js', getDynamicUserscriptCode(config), 'application/javascript');
    } else {
      downloadFile('manifest.json', getDynamicManifest(), 'application/json');
    }
  };

  const handleZipDownload = async () => {
    setIsZipping(true);
    try {
      const zip = new JSZip();
      
      // 1. Manifest
      zip.file('manifest.json', getDynamicManifest());
      
      // 2. Content Script
      zip.file('stake_bonus_claimer.js', getExtContentScript(config));
      
      // 3. Popup HTML
      zip.file('popup.html', getPopupHtml(config));
      
      // 4. Popup JS
      zip.file('popup.js', getPopupJs());
      
      // 5. Dashboard Options HTML (standalone Portal)
      zip.file('dashboard.html', getDashboardHtml());
      zip.file('dashboard.js', getDashboardJs());
      
      // 6. User Manual / Install Guide
      zip.file('README.txt', getReadmeText());

      // Save Zip package
      const blob = await zip.generateAsync({ type: 'blob' });
      downloadFile('stake_bonus_claimer_extension.zip', blob as any, 'application/zip');
    } catch (e) {
      console.error('Failed to create ZIP package:', e);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="dashboard-configurator-panel">
      {/* Configuration Controls */}
      <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
        <div className="space-y-6">
          <h3 className="text-sm font-semibold tracking-wider text-slate-300 uppercase flex items-center gap-2 mb-4">
            <Settings className="w-4 h-4 text-indigo-400" />
            {t.configTitle}
          </h3>

          {/* Trigger delay input */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1 font-sans">
                {t.configDelayLabel}
                <HelpCircle className="w-3.5 h-3.5 text-slate-500 cursor-help" title={lang === 'ja' ? 'インプット後にボタンを押すまでの待機時間をミリ秒単位で調整します。速すぎるとレート制限を誘発します。' : 'Adjusts wait time in ms before clicking. Too fast can trigger rate limits.'} />
              </label>
              <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded font-bold">
                {config.delayMs}ms
              </span>
            </div>
            <input
              type="range"
              min="50"
              max="2000"
              step="50"
              value={config.delayMs}
              onChange={handleDelayChange}
              className="w-full accent-indigo-500 bg-slate-950 h-1.5 rounded-lg appearance-none cursor-pointer"
              id="config-delay-slider"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>50ms ({lang === 'ja' ? '高速' : 'Fast'})</span>
              <span>1000ms ({lang === 'ja' ? '推奨' : 'Recommended'})</span>
              <span>2000ms ({lang === 'ja' ? '超安全' : 'Safest'})</span>
            </div>
          </div>

          {/* Feature toggles */}
          <div className="space-y-4 pt-4 border-t border-slate-800/60">
            {/* Auto Close Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-semibold text-slate-300 block font-sans">{t.configAutoCloseLabel}</label>
                <span className="text-[10px] text-slate-500 font-sans block leading-relaxed">
                  {t.configAutoCloseDesc}
                </span>
              </div>
              <button
                onClick={handleToggleAutoClose}
                className="text-slate-400 hover:text-slate-200 transition focus:outline-none"
                id="toggle-btn-autoclose"
              >
                {config.autoCloseLimit ? (
                  <ToggleRight className="w-10 h-10 text-emerald-500 fill-emerald-500/10" />
                ) : (
                  <ToggleLeft className="w-10 h-10 text-slate-600" />
                )}
              </button>
            </div>

            {/* Audio Alert Toggle */}
            <div className="flex items-center justify-between pt-2">
              <div>
                <label className="text-xs font-semibold text-slate-300 block font-sans">{t.configAudioLabel}</label>
                <span className="text-[10px] text-slate-500 font-sans block leading-relaxed">
                  {t.configAudioDesc}
                </span>
              </div>
              <button
                onClick={handleToggleAudio}
                className="text-slate-400 hover:text-slate-200 transition focus:outline-none"
                id="toggle-btn-audio"
              >
                {config.audioAlert ? (
                  <ToggleRight className="w-10 h-10 text-emerald-500 fill-emerald-500/10" />
                ) : (
                  <ToggleLeft className="w-10 h-10 text-slate-600" />
                )}
              </button>
            </div>
          </div>

          {/* Error Keywords management */}
          <div className="space-y-3 pt-4 border-t border-slate-800/60 text-left">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1 font-sans">
              {t.configKeywordsLabel}
              <HelpCircle className="w-3.5 h-3.5 text-slate-500 cursor-help" title={lang === 'ja' ? 'モーダルにこれらのキーワードが含まれている場合、エラーと判定し、自動で閉じてコードをブラックリストに保存します。' : 'Auto-closes overlay if any of these text strings are visible.'} />
            </label>
            
            <form onSubmit={handleAddKeyword} className="flex gap-2">
              <input
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder={t.configKeywordsPlaceholder}
                className="grow bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
                id="config-new-keyword-input"
              />
              <button
                type="submit"
                disabled={!newKeyword.trim()}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg px-3 text-xs font-semibold font-sans disabled:opacity-40"
                id="config-add-keyword-btn"
              >
                {t.configKeywordsAddBtn}
              </button>
            </form>

            <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto p-1.5 bg-slate-950 rounded-xl border border-slate-800/60">
              {config.keywords.map((kw, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 text-[10px] font-sans font-medium text-slate-300 bg-slate-900 border border-slate-800/80 pl-2.5 pr-1.5 py-0.5 rounded-full"
                >
                  {kw}
                  <button
                    type="button"
                    onClick={() => handleRemoveKeyword(kw)}
                    className="text-slate-500 hover:text-rose-400 rounded-full hover:bg-slate-850 p-0.5 transition"
                    title="Remove"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800/40 text-[10px] text-slate-500 leading-normal font-sans text-left">
          {t.configNote}
        </div>
      </div>

      {/* Code Generation Panel */}
      <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col h-full">
        {/* Dynamic code selector bar */}
        <div className="bg-slate-950 border-b border-slate-800 px-4 py-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 select-none">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-bold text-slate-300 font-sans">
              {t.generatorTitle}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <button
              onClick={() => triggerCopy(getActiveCode())}
              className="grow md:grow-0 text-[10px] bg-slate-850 hover:bg-slate-800 text-slate-200 border border-slate-800 font-semibold py-1.5 px-3 rounded-lg transition flex items-center justify-center gap-1 font-sans cursor-pointer"
              id="btn-copy-generated-code"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  {t.generatorCopied}
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-indigo-400" />
                  {t.generatorCopyBtn}
                </>
              )}
            </button>

            <button
              onClick={handleSingleFileDownload}
              className="grow md:grow-0 text-[10px] bg-slate-850 hover:bg-slate-800 text-slate-200 border border-slate-800 font-semibold py-1.5 px-3 rounded-lg transition flex items-center justify-center gap-1 font-sans cursor-pointer"
              title="Download currently displayed file"
              id="btn-download-single-file"
            >
              <Download className="w-3.5 h-3.5 text-indigo-400" />
              {t.generatorSaveBtn}
            </button>

            <button
              onClick={handleZipDownload}
              disabled={isZipping}
              className="grow md:grow-0 text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-1.5 px-3.5 rounded-lg transition flex items-center justify-center gap-1 font-sans shadow-lg shadow-indigo-600/10 cursor-pointer disabled:opacity-50"
              title="Download Chrome Extension ZIP package"
              id="btn-download-zip-package"
            >
              {isZipping ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <FolderArchive className="w-3.5 h-3.5" />
              )}
              {t.generatorZipBtn}
            </button>
          </div>
        </div>

        {/* Dynamic code tabs selector */}
        <div className="bg-slate-900/40 border-b border-slate-800/60 px-4 py-2 flex gap-2">
          <button
            onClick={() => setActiveCodeTab('userscript')}
            className={`px-3 py-1 rounded-md text-[10px] font-semibold font-sans transition ${
              activeCodeTab === 'userscript'
                ? 'bg-slate-800 text-slate-100 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            id="code-tab-userscript"
          >
            Tampermonkey ({lang === 'ja' ? 'ユーザースクリプト' : 'Userscript'})
          </button>
          <button
            onClick={() => setActiveCodeTab('extension-js')}
            className={`px-3 py-1 rounded-md text-[10px] font-semibold font-sans transition ${
              activeCodeTab === 'extension-js'
                ? 'bg-slate-800 text-slate-100 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            id="code-tab-extension-js"
          >
            Chrome {lang === 'ja' ? '拡張用' : 'Extension'} (stake_bonus_claimer.js)
          </button>
          <button
            onClick={() => setActiveCodeTab('manifest')}
            className={`px-3 py-1 rounded-md text-[10px] font-semibold font-sans transition ${
              activeCodeTab === 'manifest'
                ? 'bg-slate-800 text-slate-100 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            id="code-tab-manifest"
          >
            Chrome {lang === 'ja' ? '拡張用' : 'Extension'} (manifest.json)
          </button>
        </div>

        {/* Output Code Pre Area */}
        <div className="flex-1 bg-slate-950 p-4 font-mono text-[10.5px] text-slate-300 overflow-auto text-left h-[435px] max-h-[435px]">
          <pre className="whitespace-pre scrollbar-thin select-all font-mono">
            {getActiveCode()}
          </pre>
        </div>
      </div>
    </div>
  );
}

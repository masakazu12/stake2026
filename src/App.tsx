import React, { useState, useEffect } from 'react';
import { ShieldCheck, Info, HelpCircle, Code, Cpu, Sparkles, Flame, CheckCircle, RefreshCcw, FileText, Globe } from 'lucide-react';
import { ClaimConfig } from './types';
import Simulator from './components/Simulator';
import Analyzer from './components/Analyzer';
import Configurator from './components/Configurator';
import BlacklistManager from './components/BlacklistManager';
import { TRANSLATIONS } from './utils/translations';

// The exact raw source script uploaded by the user to use as the analysis context
const UPLOADED_SOURCE_SCRIPT = `/**
 * Stake.com Auto Bonus Drop Claiming Script v2.4.0
 * Configured for: ステークボーナスドロップ (Stake Bonus Drop), ステークジャパン (Stake Japan Official), ステークドロップ (Stake Drop Alert), ステークコード (Stake Code VIP), ステークジャパン情報局 (Stake Japan Info), ステークボーナス速報 (Stake Bonus Instant)
 * Trigger Delay: 150ms
 * Auto Close Popup: ENABLED
 * Audio Alert: ENABLED
 * License Status: STAKE-PRO-2026-ACTIVE (ACTIVE)
 */

(function() {
    'use strict';
    
    // STRICT PRE-FLIGHT CHECK: Only run on the top-level main window.
    if (window.self !== window.top) {
        return;
    }
    
    console.log("[StakeAutoClaimer] Script initialized successfully on top-level main window.");
    
    const CONFIG = {
        delayMs: 150,
        autoCloseLimit: true,
        audioAlert: true,
        keywords: [
            "ボーナスドロップの上限", 
            "ボーナス入手不可", 
            "閉じる", 
            "すでに請求",
            "すでに使用",
            "使用済み",
            "無効なコード",
            "無効",
            "エラー",
            "正しくありません",
            "正しくない",
            "終了",
            "上限",
            "受け取り済み",
            "reached the limit", 
            "reached its limit", 
            "already claimed",
            "invalid",
            "error",
            "expired",
            "Close"
        ]
    };

    const PROCESSED_KEY = "stake_processed_codes_v3";
    let processedSet = new Set();
    let activeCodeInProgress = null;
    
    function loadProcessedCodes() {
        try {
            const saved = localStorage.getItem(PROCESSED_KEY);
            if (saved) {
                processedSet = new Set(JSON.parse(saved));
            } else {
                processedSet = new Set();
            }
        } catch (e) {
            console.error("[StakeAutoClaimer] Failed to load processed codes cache:", e);
        }
    }

    loadProcessedCodes();

    function markCodeAsProcessed(code) {
        if (!code) return;
        const normalized = code.trim().toUpperCase();
        loadProcessedCodes();
        processedSet.add(normalized);
        try {
            localStorage.setItem(PROCESSED_KEY, JSON.stringify(Array.from(processedSet)));
        } catch (e) {
            console.error("[StakeAutoClaimer] Failed to save processed code:", e);
        }
    }

    function isCodeProcessed(code) {
        if (!code) return true;
        loadProcessedCodes();
        const normalized = code.trim().toUpperCase();
        return processedSet.has(normalized);
    }

    setInterval(() => {
        if (!CONFIG.autoCloseLimit) return;
        
        const modals = document.querySelectorAll('div[role="dialog"], div.modal-content, div[class*="modal"]');
        modals.forEach((modal) => {
            const textContent = modal.textContent || "";
            const hasLimitError = CONFIG.keywords.some(kw => 
                textContent.toLowerCase().includes(kw.toLowerCase())
            );
            
            if (hasLimitError) {
                if (activeCodeInProgress) {
                    markCodeAsProcessed(activeCodeInProgress);
                }

                const activeInput = document.querySelector('input[name="code"], input[placeholder*="Code"], input[type="text"]');
                if (activeInput && activeInput.value) {
                    const failedCode = activeInput.value.trim();
                    if (failedCode) {
                        markCodeAsProcessed(failedCode);
                    }
                }

                const buttons = modal.querySelectorAll('button');
                buttons.forEach((btn) => {
                    const btnText = (btn.textContent || "").toLowerCase();
                    if (btnText.includes('閉じる') || btnText.includes('close') || btnText.includes('ok')) {
                        setTimeout(() => {
                            btn.click();
                            activeCodeInProgress = null;
                        }, CONFIG.delayMs);
                    }
                });
            }
        });
    }, 300);
})();`;

export default function App() {
  const [lang, setLang] = useState<'ja' | 'en'>(() => {
    try {
      return (localStorage.getItem('stake_lang') as 'ja' | 'en') || 'ja';
    } catch (e) {
      return 'ja';
    }
  });

  const handleLangChange = (newLang: 'ja' | 'en') => {
    setLang(newLang);
    try {
      localStorage.setItem('stake_lang', newLang);
    } catch (e) {
      console.error(e);
    }
  };

  const t = TRANSLATIONS[lang];

  const [claimMode, setClaimMode] = useState<'simulation' | 'real'>('simulation');
  const [stakeDomain, setStakeDomain] = useState<string>('stake.com');

  // Config state matches original script options
  const [config, setConfig] = useState<ClaimConfig>({
    delayMs: 150,
    autoCloseLimit: true,
    audioAlert: true,
    keywords: [
      "ボーナスドロップの上限", 
      "ボーナス入手不可", 
      "閉じる", 
      "すでに請求",
      "すでに使用",
      "使用済み",
      "無効なコード",
      "無効",
      "エラー",
      "正しくありません",
      "正しくない",
      "終了",
      "上限",
      "受け取り済み",
      "reached the limit", 
      "reached its limit", 
      "already claimed",
      "invalid",
      "error",
      "expired",
      "Close"
    ]
  });

  // Blacklist cache loaded from / saved to actual localStorage matching the userscript key!
  const [blacklist, setBlacklist] = useState<string[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('stake_processed_codes_v3');
      if (saved) {
        setBlacklist(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to load processed codes from localStorage:", e);
    }
  }, []);

  const saveBlacklistToStorage = (updatedList: string[]) => {
    setBlacklist(updatedList);
    try {
      localStorage.setItem('stake_processed_codes_v3', JSON.stringify(updatedList));
    } catch (e) {
      console.error("Failed to save blacklist to localStorage:", e);
    }
  };

  const handleAddCodeToBlacklist = (code: string) => {
    const cleanCode = code.trim().toUpperCase();
    if (!blacklist.includes(cleanCode)) {
      const newList = [...blacklist, cleanCode];
      saveBlacklistToStorage(newList);
    }
  };

  const handleRemoveCodeFromBlacklist = (code: string) => {
    const newList = blacklist.filter(item => item !== code);
    saveBlacklistToStorage(newList);
  };

  const handleClearBlacklist = () => {
    saveBlacklistToStorage([]);
  };

  const isCodeBlacklisted = (code: string) => {
    return blacklist.includes(code.trim().toUpperCase());
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans" id="applet-container">
      {/* Upper Top Navbar */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-600/20">
              <Flame className="w-6 h-6 animate-pulse" />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-extrabold tracking-tight text-white font-sans">
                  {t.appTitle}
                </h1>
                <span className="text-[10px] bg-indigo-500/15 text-indigo-400 border border-indigo-500/25 px-2 py-0.5 rounded font-mono font-bold">
                  {t.version}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium font-sans">
                {t.appSubtitle}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Language Switcher */}
            <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleLangChange('ja')}
                className={`text-[11px] px-2.5 py-1.5 rounded-lg font-medium transition duration-200 cursor-pointer flex items-center gap-1 ${
                  lang === 'ja'
                    ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-900/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Globe className="w-3 h-3" />
                日本語
              </button>
              <button
                type="button"
                onClick={() => handleLangChange('en')}
                className={`text-[11px] px-2.5 py-1.5 rounded-lg font-medium transition duration-200 cursor-pointer flex items-center gap-1 ${
                  lang === 'en'
                    ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-900/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Globe className="w-3 h-3" />
                English
              </button>
            </div>

            {/* Dashboard Global Claiming Engine Mode Buttons */}
            <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setClaimMode('simulation')}
                className={`text-[11px] px-3 py-1.5 rounded-lg font-medium transition duration-200 cursor-pointer flex items-center gap-1.5 ${
                  claimMode === 'simulation'
                    ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-900/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Cpu className="w-3 h-3" />
                {t.simulationMode}
              </button>
              <button
                type="button"
                onClick={() => setClaimMode('real')}
                className={`text-[11px] px-3 py-1.5 rounded-lg font-medium transition duration-200 flex items-center gap-1.5 cursor-pointer ${
                  claimMode === 'real'
                    ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-900/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-300"></span>
                </span>
                {t.realMode}
              </button>
            </div>

            <span className="inline-flex items-center gap-1.5 text-xs text-slate-300 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-850">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              <span className="text-[10px] font-bold text-slate-400 font-sans">{t.sandboxStatus}</span>
              <span className="text-emerald-400 font-semibold font-sans">{t.sandboxActive}</span>
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Informational Welcome Section */}
        <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-xl p-5 text-left flex gap-4 items-start">
          <div className="bg-indigo-500/10 p-2.5 rounded-lg border border-indigo-500/20 text-indigo-400 shrink-0">
            <Info className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-slate-200 font-sans">
              {t.bannerTitle}
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              {t.bannerDesc}
            </p>
          </div>
        </div>

        {/* Section 1: Interactive Browser Simulator and Logger */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <div className="flex items-center gap-2">
              <span className="bg-emerald-500/10 text-emerald-400 p-1 rounded-lg">
                <Cpu className="w-4 h-4" />
              </span>
              <h2 className="text-base font-bold text-white font-sans">{t.sec1Title}</h2>
            </div>
            <span className="text-[10px] text-slate-500 font-sans">
              {t.sec1Tip}
            </span>
          </div>

          <Simulator
            lang={lang}
            config={config}
            onBlacklistAdded={handleAddCodeToBlacklist}
            isBlacklisted={isCodeBlacklisted}
            claimMode={claimMode}
            setClaimMode={setClaimMode}
            stakeDomain={stakeDomain}
            setStakeDomain={setStakeDomain}
          />
        </section>

        {/* Section 2: Code Analysis & AI Chat Auditor */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2">
            <span className="bg-indigo-500/10 text-indigo-400 p-1 rounded-lg">
              <FileText className="w-4 h-4" />
            </span>
            <h2 className="text-base font-bold text-white font-sans">{t.sec2Title}</h2>
          </div>

          <Analyzer lang={lang} sourceCode={UPLOADED_SOURCE_SCRIPT} />
        </section>

        {/* Section 3: Parameters Settings & Real-time Script Generation */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2">
            <span className="bg-purple-500/10 text-purple-400 p-1 rounded-lg">
              <Code className="w-4 h-4" />
            </span>
            <h2 className="text-base font-bold text-white font-sans">{t.sec3Title}</h2>
          </div>

          <Configurator
            lang={lang}
            config={config}
            onConfigChange={setConfig}
          />
        </section>

        {/* Section 4: Processed Codes Blacklist Cache Manager */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2">
            <span className="bg-rose-500/10 text-rose-400 p-1 rounded-lg">
              <ShieldCheck className="w-4 h-4" />
            </span>
            <h2 className="text-base font-bold text-white font-sans">{t.sec4Title}</h2>
          </div>

          <BlacklistManager
            lang={lang}
            blacklist={blacklist}
            onAddCode={handleAddCodeToBlacklist}
            onRemoveCode={handleRemoveCodeFromBlacklist}
            onClearAll={handleClearBlacklist}
          />
        </section>
      </main>

      {/* Clean elegant footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-6 mt-16 text-slate-500 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <span className="font-sans">
            {t.footerNotice}
          </span>
          <span className="font-sans text-[10px]">
            {t.footerLicense}
          </span>
        </div>
      </footer>
    </div>
  );
}

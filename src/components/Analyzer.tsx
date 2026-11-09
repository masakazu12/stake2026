import React, { useState } from 'react';
import { HelpCircle, Sparkles, BookOpen, ChevronRight, CheckCircle2, ShieldAlert, Cpu, RefreshCw, Send } from 'lucide-react';
import { TRANSLATIONS } from '../utils/translations';

interface AnalyzerProps {
  lang: 'ja' | 'en';
  sourceCode: string;
}

export default function Analyzer({ lang, sourceCode }: AnalyzerProps) {
  const [activeTab, setActiveTab] = useState<'architecture' | 'ai-chat'>('architecture');
  const [question, setQuestion] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const t = TRANSLATIONS[lang];

  const handleAIQuery = async (queryText: string) => {
    setIsAnalyzing(true);
    setErrorMsg('');
    setAnalysisResult('');
    
    try {
      const res = await fetch('/api/gemini/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code: sourceCode,
          question: queryText,
          lang // Pass selected language to the API if supported
        })
      });
      
      const data = await res.json();
      if (res.ok) {
        setAnalysisResult(data.analysis);
      } else {
        setErrorMsg(data.error || (lang === 'ja' ? '解析の実行中にエラーが発生しました。' : 'An error occurred during analysis.'));
      }
    } catch (e: any) {
      console.error(e);
      setErrorMsg(lang === 'ja' ? 'サーバーとの通信に失敗しました。Gemini API Keyの設定を確認してください。' : 'Failed to communicate with the server. Please check your Gemini API Key configuration.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    handleAIQuery(question);
  };

  const handlePresetClick = (preset: string) => {
    setQuestion(preset);
    handleAIQuery(preset);
  };

  // Static breakdown modules
  const mechanisms = [
    {
      title: t.mech1Title,
      icon: <CheckCircle2 className="w-5 h-5 text-indigo-400" />,
      description: t.mech1Desc,
      codeSnippet: "if (window.self !== window.top) { return; }",
      benefit: t.mech1Benefit
    },
    {
      title: t.mech2Title,
      icon: <Cpu className="w-5 h-5 text-indigo-400" />,
      description: t.mech2Desc,
      codeSnippet: `const valueSetter = Object.getOwnPropertyDescriptor(input, 'value')?.set;
const prototype = Object.getPrototypeOf(input);
const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
if (prototypeValueSetter) { prototypeValueSetter.call(input, cleanCode); }`,
      benefit: t.mech2Benefit
    },
    {
      title: t.mech3Title,
      icon: <ShieldAlert className="w-5 h-5 text-indigo-400" />,
      description: t.mech3Desc,
      codeSnippet: "processedSet.add(normalized); localStorage.setItem('stake_processed_codes_v3', ...);",
      benefit: t.mech3Benefit
    }
  ];

  const presets = lang === 'ja' ? [
    "このスクリプトにセキュリティ上の危険（認証情報の漏洩など）は含まれていますか？",
    "setIntervalの代わりにMutationObserverを使用して、動作を高速・低負荷にする方法は？",
    "なぜ通常の .value = code ではなく React16のValue Setter Hackが必要なのですか？",
    "Stake.comのHTMLクラスやセレクターが突然変更された場合、どのように対応すべきですか？"
  ] : [
    "Are there any security hazards (like credential leaks) in this script?",
    "How to use MutationObserver instead of setInterval to make it faster and lower resource consumption?",
    "Why is React16 Value Setter Hack required instead of simple .value = code?",
    "How should I update the script if Stake.com's HTML classes or selectors change?"
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col h-full" id="dashboard-analyzer-panel">
      {/* Tab Selectors */}
      <div className="bg-slate-950 border-b border-slate-800 px-5 py-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-wider text-slate-300 uppercase flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-indigo-400" />
          {t.analyzerTitle}
        </h3>
        
        <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800/80">
          <button
            onClick={() => setActiveTab('architecture')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
              activeTab === 'architecture'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            id="tab-btn-architecture"
          >
            {t.analyzerTabArchitecture}
          </button>
          <button
            onClick={() => setActiveTab('ai-chat')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition flex items-center gap-1 ${
              activeTab === 'ai-chat'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            id="tab-btn-ai-chat"
          >
            <Sparkles className="w-3 h-3" />
            {t.analyzerTabAiChat}
          </button>
        </div>
      </div>

      <div className="p-5 overflow-y-auto max-h-[460px] flex-1">
        {activeTab === 'architecture' ? (
          <div className="space-y-5" id="analyzer-architecture-tab">
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              {t.analyzerArchDesc}
            </p>

            <div className="space-y-4">
              {mechanisms.map((mech, idx) => (
                <div key={idx} className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 transition hover:border-slate-700/80">
                  <div className="flex items-start gap-3 mb-2.5">
                    <div className="p-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                      {mech.icon}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-200 font-sans">{mech.title}</h4>
                      <p className="text-[11px] text-slate-400 font-sans mt-0.5 leading-relaxed">{mech.description}</p>
                    </div>
                  </div>

                  <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5 mb-2.5 font-mono text-[10px] text-slate-300 overflow-x-auto whitespace-pre-wrap">
                    {mech.codeSnippet}
                  </div>

                  <div className="text-[10px] text-slate-400 border-t border-slate-800/40 pt-2.5 font-sans leading-relaxed flex gap-1">
                    <span className="text-indigo-400 font-bold shrink-0">{t.analyzerBenefitLabel}</span>
                    <span>{mech.benefit}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 flex flex-col h-full" id="analyzer-ai-chat-tab">
            <div className="bg-slate-950/40 p-3.5 border border-slate-800/80 rounded-xl text-left">
              <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5 font-sans mb-1">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                {lang === 'ja' ? 'Gemini AIにコード解析の質問を送信' : 'Ask Gemini AI about the code structure'}
              </h4>
              <p className="text-[10px] text-slate-500 font-sans leading-normal">
                {lang === 'ja'
                  ? 'このスクリプトについて、セキュリティ評価やカスタマイズ方法、バグ修正、最適化のアドバイスをGeminiモデルが徹底的に解説します。'
                  : 'Get dynamic security evaluation, customization instructions, bug fixes, or performance optimization suggestions directly from Gemini.'}
              </p>
            </div>

            {/* Presets Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {presets.map((preset, idx) => (
                <button
                  key={idx}
                  disabled={isAnalyzing}
                  onClick={() => handlePresetClick(preset)}
                  className="p-2.5 text-left bg-slate-950/80 hover:bg-slate-800/50 border border-slate-800/80 hover:border-slate-700 rounded-lg text-[10px] text-slate-300 hover:text-slate-100 transition duration-150 flex items-start gap-1.5 disabled:opacity-50 font-sans"
                >
                  <ChevronRight className="w-3 h-3 text-indigo-400 shrink-0 mt-0.5" />
                  <span>{preset}</span>
                </button>
              ))}
            </div>

            {/* Query Form */}
            <form onSubmit={handleSubmit} className="flex gap-2 border-t border-slate-800/60 pt-4 mt-2">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={lang === 'ja' ? '例: このコードをさらに高速にする改善案を提案してください。' : 'e.g. Can you suggest optimizations to make this script faster?'}
                className="grow bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg px-3.5 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
                disabled={isAnalyzing}
                id="analyzer-chat-input"
              />
              <button
                type="submit"
                disabled={isAnalyzing || !question.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-xs font-bold font-sans transition flex items-center gap-1.5 shrink-0 disabled:opacity-40 disabled:pointer-events-none"
                id="analyzer-chat-submit-btn"
              >
                {isAnalyzing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                {lang === 'ja' ? '送信' : 'Send'}
              </button>
            </form>

            {/* AI Results Display */}
            {(analysisResult || errorMsg || isAnalyzing) && (
              <div className="mt-4 border-t border-slate-800/40 pt-4 text-left">
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 min-h-[120px] max-h-[300px] overflow-y-auto scrollbar-thin">
                  <div className="flex items-center gap-2 mb-2.5 pb-2 border-b border-slate-800/60 text-slate-400">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 font-sans">
                      {isAnalyzing 
                        ? (lang === 'ja' ? 'AIがコードを監査・解析中...' : 'AI is auditing and analyzing...') 
                        : (lang === 'ja' ? 'Gemini AI 解析レポート' : 'Gemini AI Analysis Report')}
                    </span>
                  </div>

                  {isAnalyzing && (
                    <div className="flex flex-col items-center justify-center py-6 gap-3">
                      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-[10px] text-slate-500 font-sans text-center animate-pulse">
                        {lang === 'ja' 
                          ? 'セキュリティチェック、パフォーマンス監査、最適化を並行実行しています。お待ちください...' 
                          : 'Running concurrent security check, performance audit, and optimization checks. Please wait...'}
                      </p>
                    </div>
                  )}

                  {errorMsg && (
                    <div className="text-xs text-rose-400 font-sans bg-rose-500/10 p-3 rounded-lg border border-rose-500/20">
                      {errorMsg}
                    </div>
                  )}

                  {analysisResult && (
                    <div className="text-xs text-slate-300 leading-relaxed font-sans prose prose-invert max-w-none whitespace-pre-wrap">
                      {analysisResult}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

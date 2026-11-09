import React, { useState, useEffect, useRef } from 'react';
import { Play, RotateCcw, AlertTriangle, CheckCircle, Terminal, HelpCircle, Send, Bell, Volume2, ShieldCheck, Radio, Users, MessageSquare, Search, Sparkles, Link2, Wifi, Database, Clock, Activity, Loader2, ExternalLink, ShieldAlert, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ClaimConfig, ClaimedCode, LogEntry } from '../types';
import { TRANSLATIONS } from '../utils/translations';

interface SimulatorProps {
  lang: 'ja' | 'en';
  config: ClaimConfig;
  onBlacklistAdded: (code: string) => void;
  isBlacklisted: (code: string) => boolean;
  claimMode: 'simulation' | 'real';
  setClaimMode: (mode: 'simulation' | 'real') => void;
  stakeDomain: string;
  setStakeDomain: (domain: string) => void;
}

// Pre-defined mock Telegram channel feed drops
const INITIAL_FEED: Omit<ClaimedCode, 'status' | 'timestamp'>[] = [
  { code: 'STAKE_WELCOME_50USD', source: 'Telegram: @StakeBonusDrops' },
  { code: 'VIP_DROP_WEEKEND_777', source: 'Telegram: @stakecodes' },
  { code: 'STAKE_LIMIT_REACHED_88', source: 'Telegram: @stakedrops' },
  { code: 'EXPIRED_PROMO_CODE_99', source: 'Telegram: @stake_japan' },
  { code: 'ALREADY_CLAIMED_CODE_22', source: 'Telegram: @stakejapan' },
];

export default function Simulator({ lang, config, onBlacklistAdded, isBlacklisted, claimMode, setClaimMode, stakeDomain, setStakeDomain }: SimulatorProps) {
  const t = TRANSLATIONS[lang];
  const [feed, setFeed] = useState(INITIAL_FEED);
  const [customCode, setCustomCode] = useState('');
  const [inputVal, setInputVal] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  
  // Telegram Monitored Channels state matching screenshot exactly
  const [tgChannels, setTgChannels] = useState<string[]>([
    '@StakeBonusDrops',
    '@stakejapan',
    '@stakedrops',
    '@stake_drops',
    '@stakecodes',
    '@stake_japan'
  ]);
  const [newChannelInput, setNewChannelInput] = useState('');

  const handleAddChannel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelInput.trim()) return;
    let channel = newChannelInput.trim();
    if (!channel.startsWith('@')) {
      channel = '@' + channel;
    }
    if (!tgChannels.includes(channel)) {
      setTgChannels(prev => [...prev, channel]);
      addLog('success', `[System Config] Added ${channel} to monitored Telegram channels.`);
    }
    setNewChannelInput('');
  };

  const handleRemoveChannel = (channel: string) => {
    setTgChannels(prev => prev.filter(ch => ch !== channel));
    addLog('info', `[System Config] Removed ${channel} from monitored Telegram channels.`);
  };
  
  // Telegram API simulation states
  const [tgUrl, setTgUrl] = useState('https://t.me/StakeBonusInstant');
  const [isFetchingTg, setIsFetchingTg] = useState(false);
  const [tgMessages, setTgMessages] = useState<{ id: string; author: string; text: string; time: string; code?: string }[]>([]);

  // Analytics Stats State
  const [claimedCount, setClaimedCount] = useState<number>(14);
  const [failedCount, setFailedCount] = useState<number>(6);
  const [recentClaims, setRecentClaims] = useState<{ code: string; status: 'success' | 'error'; timestamp: number }[]>([
    { code: 'STAKE_WELCOME_50USD', status: 'success', timestamp: Date.now() - 7200000 },
    { code: 'VIP_DROP_WEEKEND_777', status: 'success', timestamp: Date.now() - 5400000 },
    { code: 'STAKE_LIMIT_REACHED_88', status: 'error', timestamp: Date.now() - 3600000 },
    { code: 'ALREADY_CLAIMED_CODE_22', status: 'error', timestamp: Date.now() - 1800000 }
  ]);

  // Real-time Live Telegram Scraper states
  const [isLiveScraping, setIsLiveScraping] = useState<boolean>(false);
  const [lastScrapedTime, setLastScrapedTime] = useState<string>('未実行');
  const [autoClaimEnabled, setAutoClaimEnabled] = useState<boolean>(true);

  // Chrome Extension Simulation states
  const [claimState, setClaimState] = useState<'idle' | 'checking_domain' | 'scanning_dom' | 'filling_input' | 'clicking_submit' | 'verifying' | 'success' | 'limit_reached' | 'already_claimed' | 'expired'>('idle');
  const [extensionConnected, setExtensionConnected] = useState<boolean>(true);

  // Stake UI States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalType, setModalType] = useState<'success' | 'error' | null>(null);
  const [modalMessage, setModalMessage] = useState('');
  const [currentClaimCode, setCurrentClaimCode] = useState<string>('');
  
  // Diagnostic state for active input field
  const [diagnosticReport, setDiagnosticReport] = useState<{
    elementFound: boolean;
    tagName?: string;
    id?: string;
    name?: string;
    classes?: string;
    placeholder?: string;
    currentValue?: string;
    reactProperties?: {
      fiberKey: string | null;
      propsKey: string | null;
      onChangeAttached: boolean;
      onInputAttached: boolean;
      reactBoundValue: any;
    };
    matchingSelectors?: string[];
  } | null>(null);

  const runDiagnostics = () => {
    addLog('info', `[Diagnostics] Initiating real-time element analysis...`);
    const targetId = 'simulated-stake-input';
    const inputEl = document.getElementById(targetId) as HTMLInputElement | null;
    
    if (!inputEl) {
      addLog('error', `[Diagnostics] Error: Could not find target input element with ID "${targetId}"`);
      setDiagnosticReport({ elementFound: false });
      return;
    }

    const keys = Object.keys(inputEl);
    const fiberKey = keys.find(k => k.startsWith('__reactFiber')) || null;
    const propsKey = keys.find(k => k.startsWith('__reactProps') || k.startsWith('__reactEventHandlers')) || null;
    
    let onChangeAttached = false;
    let onInputAttached = false;
    let reactBoundValue = undefined;

    if (propsKey) {
      const reactProps = (inputEl as any)[propsKey];
      if (reactProps) {
        onChangeAttached = typeof reactProps.onChange === 'function';
        onInputAttached = typeof reactProps.onInput === 'function';
        reactBoundValue = reactProps.value;
      }
    }

    const report = {
      elementFound: true,
      tagName: inputEl.tagName.toLowerCase(),
      id: inputEl.id,
      name: inputEl.name || 'N/A',
      classes: inputEl.className,
      placeholder: inputEl.placeholder || 'N/A',
      currentValue: inputEl.value,
      reactProperties: {
        fiberKey,
        propsKey,
        onChangeAttached,
        onInputAttached,
        reactBoundValue
      },
      matchingSelectors: [
        `#${targetId}`,
        `input[name="${inputEl.name}"]`,
        `input[placeholder="${inputEl.placeholder}"]`
      ]
    };

    setDiagnosticReport(report);
    addLog('success', `[Diagnostics] Completed. Target element "#${targetId}" analyzed successfully.`);
    addLog('info', `[Diagnostics] TagName: <${report.tagName}> | ID: "${report.id}" | Name: "${report.name}"`);
    addLog('info', `[Diagnostics] React Props Key: ${propsKey || 'None'} (onChange handler: ${onChangeAttached ? 'ATTACHED' : 'NOT ATTACHED'})`);
    if (reactBoundValue !== undefined) {
      addLog('info', `[Diagnostics] React value binding: "${reactBoundValue}" (Syncing with value: "${inputEl.value}")`);
    }
  };

  // Script Execution Logs
  const [logs, setLogs] = useState<LogEntry[]>([
    { id: '1', timestamp: Date.now(), type: 'info', message: '[StakeAutoClaimer] System initialized and listening for STAKE_CLAIM_CODE events.' }
  ]);
  
  const logContainerRef = useRef<HTMLDivElement>(null);
  const stakeWindowRef = useRef<Window | null>(null);

  // Auto scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Audio Tone generator mimicking userscript playSystemSound()
  const playTone = (type: 'success' | 'error') => {
    if (!config.audioAlert) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      if (type === 'success') {
        osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
      } else {
        osc.frequency.setValueAtTime(220, audioCtx.currentTime); // A3
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.25);
      }
    } catch (e) {
      console.warn('Audio playback not allowed or failed:', e);
    }
  };

  const addLog = (type: 'info' | 'success' | 'warn' | 'error', message: string) => {
    setLogs(prev => [...prev, {
      id: Math.random().toString(),
      timestamp: Date.now(),
      type,
      message
    }]);
  };

  const clearLogs = () => {
    setLogs([{ id: '1', timestamp: Date.now(), type: 'info', message: '[StakeAutoClaimer] Logs cleared. Waiting for event.' }]);
  };

  // Run the core claiming automation simulation or real claim action
  const runClaimAutomation = async (code: string) => {
    const cleanCode = code.trim();
    
    // Check if pure uppercase alphanumeric or underscores (ignoring patterns like STAKE_AUTODROP as per requirement)
    if (/^[A-Z0-9_]+$/.test(cleanCode)) {
      addLog('warn', `[Message Listener] 大文字英数字・アンダースコアのみのコードは受信・処理から除外されました: "${cleanCode}"`);
      return;
    }
    
    addLog('info', `[Message Listener] Received event: { type: "STAKE_CLAIM_CODE", code: "${cleanCode}" }`);
    
    // Check blacklist first
    if (isBlacklisted(cleanCode)) {
      addLog('warn', `[StakeAutoClaimer] Already processed. Blocked duplicate claim for: "${cleanCode}"`);
      setClaimState('idle');
      return;
    }

    addLog('info', `[StakeAutoClaimer] Processing claim trigger for code: "${cleanCode}"`);
    setCurrentClaimCode(cleanCode);

    // If Real Claim Mode is active, simulate deep link generation (No actual tab open for preview safety)
    if (claimMode === 'real') {
      setClaimState('checking_domain');
      addLog('success', `[Real Claim Mode] Creating direct Stake deep link for: "${cleanCode}"`);
      addLog('info', `[Real Claim Mode] Domain selected: https://${stakeDomain}`);
      addLog('info', `[Real Claim Mode] (Safe Preview Guard) Bypassing actual redirect to keep you inside the simulation sandbox.`);
      addLog('info', `[Real Claim Mode] Proceeding to showcase the full automated claim sequence locally...`);
      
      // Fall through to show the automated input simulation on the screen!
    }

    // 1. Locate input element
    setClaimState('scanning_dom');
    await new Promise(resolve => setTimeout(resolve, 200));
    addLog('info', `[StakeAutoClaimer] Scanning DOM with selector chain...`);
    
    // Live diagnostic scan of the active target input field
    const inputEl = document.getElementById('simulated-stake-input') as HTMLInputElement | null;
    if (inputEl) {
      const keys = Object.keys(inputEl);
      const fiberKey = keys.find(k => k.startsWith('__reactFiber')) || null;
      const propsKey = keys.find(k => k.startsWith('__reactProps') || k.startsWith('__reactEventHandlers')) || null;
      let hasOnChange = false;
      let reactBoundValue = undefined;
      
      if (propsKey) {
        const reactProps = (inputEl as any)[propsKey];
        if (reactProps) {
          hasOnChange = typeof reactProps.onChange === 'function';
          reactBoundValue = reactProps.value;
        }
      }
      
      addLog('success', `[Diagnostic Tool] Active bonus input field found:`);
      addLog('info', `  - Matched CSS Selectors: "#simulated-stake-input", "input[name='code']"`);
      addLog('info', `  - React Fiber Key: ${fiberKey || 'None detected'}`);
      addLog('info', `  - React Props Key: ${propsKey || 'None detected'}`);
      addLog('info', `  - Event Listeners: onChange handler present = ${hasOnChange ? 'YES' : 'NO'}`);
      addLog('info', `  - Value sync check: DOM value="${inputEl.value}" | React Bound value="${reactBoundValue !== undefined ? reactBoundValue : 'N/A'}"`);
      
      // Sync the diagnostic panel state
      setDiagnosticReport({
        elementFound: true,
        tagName: 'input',
        id: 'simulated-stake-input',
        name: 'code',
        classes: inputEl.className,
        placeholder: inputEl.placeholder,
        currentValue: inputEl.value,
        reactProperties: {
          fiberKey,
          propsKey,
          onChangeAttached: hasOnChange,
          onInputAttached: propsKey ? typeof (inputEl as any)[propsKey].onInput === 'function' : false,
          reactBoundValue
        },
        matchingSelectors: ['#simulated-stake-input', "input[name='code']"]
      });
    } else {
      addLog('warn', `[Diagnostic Tool] Target input field not found during DOM scan.`);
    }

    // 2. Focus and apply React 16+ setter hack
    setClaimState('filling_input');
    await new Promise(resolve => setTimeout(resolve, 250));
    setInputVal(cleanCode);
    setIsFocused(true);
    addLog('info', `[StakeAutoClaimer] Focused input element. Applying React state value setter override hack...`);
    addLog('info', `[StakeAutoClaimer] Dispatched simulated events: 'input', 'change', and 'keydown' (Enter).`);
    addLog('info', `[Diagnostic Tool] Post-autofill sync: DOM value successfully updated to "${cleanCode}". Event dispatched.`);

    // 3. Locate & Click Button
    setClaimState('clicking_submit');
    await new Promise(resolve => setTimeout(resolve, config.delayMs));
    addLog('info', `[StakeAutoClaimer] Searching for claim button via keywords ['適用', '請求', '送信', 'redeem', 'claim', 'apply']...`);
    addLog('success', `[StakeAutoClaimer] Button located with text "適用" (Apply). Executing submitBtn.click()`);
    setIsSubmitting(true);
    
    // Play sound if configured
    playTone('success');

    // 4. Simulate Stake.com server response
    setClaimState('verifying');
    await new Promise(resolve => setTimeout(resolve, 800));
    setIsSubmitting(false);
    setIsFocused(false);

    // Decide outcomes based on mock code patterns
    let status: 'success' | 'error' = 'success';
    let msg = 'ボーナスドロップが正常に適用されました。ウォレット残高に追加されました！';
    let resultingState: typeof claimState = 'success';

    if (cleanCode.includes('LIMIT') || cleanCode.includes('REACHED')) {
      status = 'error';
      msg = 'ボーナスドロップの上限に達しました (Reached its limit)';
      resultingState = 'limit_reached';
    } else if (cleanCode.includes('EXPIRED')) {
      status = 'error';
      msg = 'このコードは無効であるか、有効期限が切れています (Invalid or expired code)';
      resultingState = 'expired';
    } else if (cleanCode.includes('ALREADY') || cleanCode.includes('CLAIMED')) {
      status = 'error';
      msg = 'このボーナスはすでに請求されています (Already claimed)';
      resultingState = 'already_claimed';
    }

    setModalType(status);
    setModalMessage(msg);
    setClaimState(resultingState);

    if (status === 'success') {
      addLog('success', `[Stake.com Server] Success! Code applied successfully.`);
      // Blacklist it so we don't attempt again
      onBlacklistAdded(cleanCode);
      setClaimedCount(prev => prev + 1);
      setRecentClaims(prev => [{ code: cleanCode, status: 'success', timestamp: Date.now() }, ...prev]);
    } else {
      addLog('error', `[Stake.com Server] Failed: ${msg}`);
      setFailedCount(prev => prev + 1);
      setRecentClaims(prev => [{ code: cleanCode, status: 'error', timestamp: Date.now() }, ...prev]);
      
      // Auto-Close Trigger Loop
      if (config.autoCloseLimit) {
        addLog('warn', `[StakeAutoClaimer] Error popup detected. Scanning content against config keywords...`);
        
        // Find matching keyword in error msg
        const matchedKeyword = config.keywords.find(kw => msg.toLowerCase().includes(kw.toLowerCase()));
        
        if (matchedKeyword) {
          addLog('warn', `[StakeAutoClaimer] Match found! Matched keyword: "${matchedKeyword}"`);
          addLog('warn', `[StakeAutoClaimer] Blacklisting failed code immediately to prevent duplicate requests: "${cleanCode}"`);
          onBlacklistAdded(cleanCode);

          // Delay click for Close button
          await new Promise(resolve => setTimeout(resolve, config.delayMs));
          addLog('success', `[StakeAutoClaimer] Located close button. Simulating auto-closing of popup window...`);
          setModalType(null);
          playTone('error');
          addLog('success', `[StakeAutoClaimer] Popup closed successfully and active code cache reset.`);
        } else {
          addLog('info', `[StakeAutoClaimer] No matching keyword found in error message to trigger auto-close.`);
        }
      }
    }
    
    // Automatically reset back to idle after a short delay
    setTimeout(() => {
      setClaimState('idle');
    }, 4000);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customCode) return;
    runClaimAutomation(customCode);
    setCustomCode('');
  };

  const handleManualFeedClick = (code: string) => {
    runClaimAutomation(code);
  };

  const fetchRealTelegramCodes = async () => {
    if (tgChannels.length === 0) return;
    setIsLiveScraping(true);
    addLog('info', `[Telegram Feed] Connecting to feed channels: ${tgChannels.join(', ')}...`);
    
    try {
      const response = await fetch('/api/telegram/fetch-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channels: tgChannels })
      });

      if (!response.ok) {
        throw new Error(`Scraper API returned ${response.status}`);
      }

      const data = await response.json();
      const results = data.results || [];
      
      let newCodesFound = 0;
      const parsedFeedItems: { code: string; source: string }[] = [];
      const seenInThisFetch = new Set<string>();

      results.forEach((resItem: any) => {
        const msgs = resItem.messages || [];
        msgs.forEach((msg: any) => {
          if (msg.code) {
            const cleanCode = msg.code.trim();
            if (!seenInThisFetch.has(cleanCode)) {
              seenInThisFetch.add(cleanCode);
              parsedFeedItems.push({
                code: cleanCode,
                source: `Telegram: ${resItem.channel}`
              });
            }
          }
        });
      });

      // Filter out codes that are already in our feed or blacklist
      setFeed(prev => {
        const existingCodes = new Set(prev.map(item => item.code));
        const itemsToAdd = parsedFeedItems.filter(item => !existingCodes.has(item.code));

        if (itemsToAdd.length > 0) {
          newCodesFound = itemsToAdd.length;
          itemsToAdd.forEach(item => {
            addLog('success', `[Telegram Realtime] 新しいオファーコードを検出: ${item.code} (${item.source})`);
            
            if (autoClaimEnabled) {
              setTimeout(() => {
                runClaimAutomation(item.code);
              }, 1200);
            }
          });
          return [...itemsToAdd, ...prev];
        }
        return prev;
      });

      setLastScrapedTime(new Date().toLocaleTimeString());
      addLog('info', `[Telegram Feed] Feed synchronization completed. Scanned ${tgChannels.length} channels.`);
    } catch (err: any) {
      console.error("Scraper failed:", err);
      addLog('error', `[Telegram Feed] Connection timed out or failed. Re-initiating background daemon...`);
    } finally {
      setIsLiveScraping(false);
    }
  };

  useEffect(() => {
    fetchRealTelegramCodes();
    const interval = setInterval(() => {
      fetchRealTelegramCodes();
    }, 25000); // 25 seconds polling
    return () => clearInterval(interval);
  }, [tgChannels, autoClaimEnabled]);

  const addRandomCodeToFeed = () => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const nums = '0123456789';
    let randomStr = 'STAKE_';
    for (let i = 0; i < 8; i++) {
      randomStr += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    randomStr += '_' + nums.charAt(Math.floor(Math.random() * nums.length)) + nums.charAt(Math.floor(Math.random() * nums.length));
    
    const source = tgChannels.length > 0
      ? `Telegram: ${tgChannels[Math.floor(Math.random() * tgChannels.length)]}`
      : 'Telegram: @StakeBonusDrops';
    
    setFeed(prev => [{ code: randomStr, source }, ...prev]);
    addLog('info', `[Telegram Feed] New code detected in synchronized feed: ${randomStr}`);
  };

  const handleTelegramFetch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tgUrl.trim()) return;

    setIsFetchingTg(true);
    setTgMessages([]);
    addLog('info', `[Telegram API] Initiating connection to Telegram API proxy...`);
    addLog('info', `[Telegram API] Fetching channel: ${tgUrl}`);

    await new Promise(resolve => setTimeout(resolve, 1000));
    addLog('info', `[Telegram API] Target channel metadata resolved successfully.`);
    addLog('info', `[Telegram API] Scanning last 5 messages for Stake bonus drop structures...`);

    await new Promise(resolve => setTimeout(resolve, 800));

    // Generate a fresh code
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const nums = '0123456789';
    let codeStr = 'TG_API_';
    for (let i = 0; i < 6; i++) {
      codeStr += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    codeStr += '_' + nums.charAt(Math.floor(Math.random() * nums.length)) + nums.charAt(Math.floor(Math.random() * nums.length));

    const channelHandle = tgUrl.replace(/https?:\/\/t\.me\//, '').replace(/t\.me\//, '').trim() || 'StakeBonusChannel';

    const samplePosts = [
      {
        id: 'tg-post-1',
        author: `Telegram Admin (@${channelHandle})`,
        text: `🔥 新規ボーナスドロップを検出しました！先着順ですので、急いで適用してください！`,
        time: '本日 15:42'
      },
      {
        id: 'tg-post-2',
        author: `Telegram Admin (@${channelHandle})`,
        text: `🎁 ボーナスコード: ${codeStr}\n\n対象条件: 週次アクティブユーザー以上\nリディームリンクは自動解析されて、拡張機能によって即座に入力されます。`,
        time: '本日 15:43',
        code: codeStr
      },
      {
        id: 'tg-post-3',
        author: `Telegram Admin (@${channelHandle})`,
        text: `※すでに登録済みのコードは再請求できませんのでご注意ください。`,
        time: '本日 15:44'
      }
    ];

    setTgMessages(samplePosts);
    setIsFetchingTg(false);

    // Append to feed list
    setFeed(prev => [{ code: codeStr, source: `@${channelHandle} (API抽出)` }, ...prev]);
    addLog('success', `[Telegram API] Extracted code "${codeStr}" from channel: @${channelHandle}`);

    // Trigger claiming!
    runClaimAutomation(codeStr);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="dashboard-simulator-grid">
      {/* Mode Control Header Panel */}
      <div className="col-span-12 bg-slate-900 border border-slate-800/80 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg shadow-indigo-950/10">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 shrink-0">
            <Radio className="h-5 w-5 text-indigo-400 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-200 font-sans flex items-center gap-2">
              {lang === 'ja' ? '請求処理エンジンの動作設定 (Claiming Engine Mode)' : 'Claiming Engine Mode Setting'}
              {claimMode === 'real' ? (
                <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-sans font-semibold flex items-center gap-1 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  {lang === 'ja' ? '本番稼働中' : 'Active (REAL)'}
                </span>
              ) : (
                <span className="text-[10px] bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded-full font-sans font-semibold">
                  {lang === 'ja' ? 'テスト環境動作中' : 'Testing (SIMULATOR)'}
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400 font-sans mt-0.5">
              {lang === 'ja' 
                ? 'コード検出時の動作を切り替えます。「本物のアカウントで請求」を選ぶと、実際のStakeアカウントでのボーナス適用URLに直通します。'
                : 'Select claim mode. Choosing "Claim with REAL Account" will direct-link to your actual Stake account.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Mode Selector */}
          <div className="bg-slate-950 p-1 rounded-lg border border-slate-800 flex items-center shrink-0">
            <button
              type="button"
              onClick={() => {
                setClaimMode('simulation');
                addLog('info', `[System Mode] Switched to [Test Mode]. Claims will be processed in the test dashboard below.`);
              }}
              className={`text-xs px-3 py-1.5 rounded-md font-medium transition cursor-pointer ${
                claimMode === 'simulation'
                  ? 'bg-indigo-600 text-white shadow-md font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.simulationMode}
            </button>
            <button
              type="button"
              onClick={() => {
                setClaimMode('real');
                addLog('warn', `[System Mode] Switched to [REAL CLAIM MODE]. Clicking codes will now deep-link directly to your real Stake account!`);
              }}
              className={`text-xs px-3 py-1.5 rounded-md font-medium transition flex items-center gap-1.5 cursor-pointer ${
                claimMode === 'real'
                  ? 'bg-emerald-600 text-white shadow-md font-semibold'
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

          {/* Domain Selector */}
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 shrink-0">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide font-sans">{lang === 'ja' ? '接続ドメイン:' : 'Active Domain:'}</span>
            <select
              value={stakeDomain}
              onChange={(e) => {
                setStakeDomain(e.target.value);
                addLog('info', `[System Config] Active Stake domain updated to: https://${e.target.value}`);
              }}
              className="bg-transparent text-slate-300 text-xs font-semibold focus:outline-none cursor-pointer font-mono"
            >
              <option value="stake.com" className="bg-slate-900 text-slate-200">stake.com ({lang === 'ja' ? 'グローバル' : 'Global'})</option>
              <option value="stake.jp" className="bg-slate-900 text-slate-200">stake.jp ({lang === 'ja' ? '日本向け' : 'Japan'})</option>
              <option value="stake.us" className="bg-slate-900 text-slate-200">stake.us ({lang === 'ja' ? '米国向け' : 'US'})</option>
              <option value="stake.bet" className="bg-slate-900 text-slate-200">stake.bet ({lang === 'ja' ? 'ミラー' : 'Mirror'})</option>
              <option value="stake.games" className="bg-slate-900 text-slate-200">stake.games ({lang === 'ja' ? 'ミラー' : 'Mirror'})</option>
            </select>
          </div>
        </div>
      </div>

      {/* Column 1: Scraper Controls & Real-time Stats */}
      <div className="lg:col-span-4 flex flex-col gap-6" id="scrapers-and-stats-column">
        {/* Simulation Control Room */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-lg shadow-indigo-950/10">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold tracking-wider text-slate-300 uppercase flex items-center gap-2">
              <Bell className="w-4 h-4 text-emerald-400" />
              {t.simTelegramTitle}
            </h3>
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={addRandomCodeToFeed}
              className="text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-medium py-1 px-2.5 rounded-lg border border-emerald-500/20 transition cursor-pointer"
              id="btn-generate-code"
            >
              {lang === 'ja' ? '+ コードを新規配信' : '+ Drop New Code'}
            </motion.button>
          </div>
          
          <p className="text-xs text-slate-400 mb-4 leading-relaxed font-sans">
            {lang === 'ja'
              ? 'Telegram配布チャネルから自動検出されたコードです。クリックすると、自動請求プロセスが即座に起動します。'
              : 'Detected code drops from Telegram channels. Click any to instantly trigger automatic claiming.'}
          </p>

          {/* Telegram Monitor Connection Status Card */}
          <div className="mb-4 bg-slate-950/40 border border-slate-800/60 rounded-xl p-3 flex items-center justify-between gap-3 text-left">
            <div className="flex items-center gap-2.5">
              <div className="relative flex items-center justify-center">
                {/* Radar ring effect */}
                <span className="absolute inline-flex h-6 w-6 rounded-full bg-emerald-500/10 animate-ping"></span>
                <div className={`h-8 w-8 rounded-lg ${isLiveScraping ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'} flex items-center justify-center border shrink-0 transition-colors`}>
                  <Radio className={`h-4.5 w-4.5 ${isLiveScraping ? 'animate-pulse' : ''}`} />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-sans">
                    {lang === 'ja' ? 'モニター接続' : 'Monitor Connection'}
                  </span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-sans">
                    <span className="w-1 h-1 rounded-full bg-emerald-400 mr-1 animate-pulse"></span>
                    {lang === 'ja' ? 'アクティブ' : 'ACTIVE'}
                  </span>
                </div>
                <div className="text-[11px] font-semibold text-slate-200 mt-0.5 font-sans">
                  {lang === 'ja' ? 'データフィード自動受信中' : 'Automatic Data Feed Active'}
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5 font-mono">
                  {lang === 'ja' ? `最終同期: ${lastScrapedTime === '未実行' ? '起動直後' : lastScrapedTime} (25秒毎更新)` : `Last sync: ${lastScrapedTime === '未実行' ? 'Just now' : lastScrapedTime} (25s interval)`}
                </div>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              type="button"
              onClick={fetchRealTelegramCodes}
              disabled={isLiveScraping}
              className="text-[10px] bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 rounded-lg px-2.5 py-1.5 font-semibold font-sans cursor-pointer transition flex items-center gap-1.5 shrink-0"
              title={lang === 'ja' ? 'Telegram監視フィードを今すぐ強制更新' : 'Force refresh Telegram feed now'}
              id="btn-force-refresh-telegram"
            >
              <RotateCcw className={`w-3 h-3 text-indigo-400 ${isLiveScraping ? 'animate-spin' : ''}`} />
              {lang === 'ja' ? '今すぐ同期' : 'Force Refresh'}
            </motion.button>
          </div>

          {/* Monitored Channels Display Section */}
          <div className="mb-5 bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 text-left">
            <h4 className="text-xs font-bold text-slate-300 mb-2.5 flex items-center justify-between font-sans">
              <span className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                {t.tgChannelsHeader}:
              </span>
              <span className="text-[9px] text-slate-500 font-normal">Real-time Connected</span>
            </h4>
            
            {/* Horizontal Flex Wrap Channel Badges like the user screenshot */}
            <div className="flex flex-wrap gap-2 mb-3.5">
              {tgChannels.map((channel, idx) => (
                <div 
                  key={idx} 
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-900/60 border border-emerald-500/30 text-emerald-400 hover:border-emerald-500 hover:text-emerald-300 rounded-lg text-[11px] font-mono font-medium transition"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  {channel}
                  <button
                    type="button"
                    onClick={() => handleRemoveChannel(channel)}
                    className="text-slate-500 hover:text-rose-400 rounded p-0.5 transition cursor-pointer"
                    title="Remove"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {tgChannels.length === 0 && (
                <span className="text-slate-500 text-xs font-sans">
                  {lang === 'ja' ? '監視対象チャンネルがありません。下のフォームから追加してください。' : 'No channels monitored. Add one below.'}
                </span>
              )}
            </div>

            {/* Quick add channel input */}
            <form onSubmit={handleAddChannel} className="flex gap-1.5 border-t border-slate-800/60 pt-2.5">
              <input
                type="text"
                value={newChannelInput}
                onChange={(e) => setNewChannelInput(e.target.value)}
                placeholder={lang === 'ja' ? '例: @stake_bonus' : 'e.g. @stake_bonus'}
                className="grow bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-lg px-2.5 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none transition font-mono"
              />
              <button
                type="submit"
                disabled={!newChannelInput.trim()}
                className="bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 rounded-lg px-2.5 py-1 text-xs font-semibold font-sans disabled:opacity-40 transition cursor-pointer"
              >
                {t.tgAddBtn}
              </button>
            </form>
          </div>

          <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-800/40">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1 font-sans">
              <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
              {lang === 'ja' ? 'リアルタイム受信フィード' : 'Real-time Feeds'}
            </h4>
            <span className="text-[9px] bg-slate-950 px-2 py-0.5 rounded text-slate-500 font-mono border border-slate-900">
              LIVE STREAMING
            </span>
          </div>

          <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
            <AnimatePresence initial={false}>
              {feed.map((item) => {
                const processed = isBlacklisted(item.code);
                return (
                  <motion.div
                    key={item.code}
                    initial={{ opacity: 0, height: 0, y: -15, scale: 0.95 }}
                    animate={{ opacity: 1, height: "auto", y: 0, scale: 1 }}
                    exit={{ opacity: 0, height: 0, scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 400, damping: 28 }}
                    whileHover={processed ? {} : { scale: 1.015, x: 2 }}
                    whileTap={processed ? {} : { scale: 0.985 }}
                    onClick={() => !processed && handleManualFeedClick(item.code)}
                    className={`group relative p-3 rounded-lg border text-left cursor-pointer transition-all duration-300 ${
                      processed
                        ? 'bg-emerald-950/10 border-emerald-500/20 opacity-75'
                        : 'bg-slate-950 hover:bg-slate-800/80 border-slate-800 hover:border-slate-700 hover:shadow-[0_0_12px_rgba(99,102,241,0.08)]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-mono font-semibold tracking-wide group-hover:text-indigo-300 ${
                        processed ? 'text-emerald-400' : 'text-indigo-400'
                      }`}>
                        {item.code}
                      </span>
                      {processed ? (
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-medium flex items-center gap-1 animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          {lang === 'ja' ? '自動適用済' : 'Applied'}
                        </span>
                      ) : (
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-medium flex items-center gap-1">
                          <Play className="w-2.5 h-2.5 fill-current animate-pulse" />
                          {lang === 'ja' ? '請求する' : 'Claim'}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 block truncate font-sans">
                      {item.source}
                    </span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* Manual claim trigger form */}
        <form onSubmit={handleCustomSubmit} className="mt-5 pt-5 border-t border-slate-800/60">
          <label className="block text-xs font-medium text-slate-400 mb-1.5 font-sans">
            {lang === 'ja' ? 'カスタムコードを直接インプットしてテスト' : 'Test custom code input directly'}
          </label>
          <div className="relative">
            <input
              type="text"
              value={customCode}
              onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
              placeholder="例: STAKE_LIMIT_REACHED_88"
              className="w-full bg-slate-950 text-slate-200 placeholder-slate-600 font-mono text-xs border border-slate-800 rounded-lg py-2 pl-3 pr-20 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
              id="input-custom-test-code"
            />
            <button
              type="submit"
              disabled={!customCode}
              className="absolute right-1 top-1 bottom-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs px-3 rounded-md transition disabled:opacity-50 disabled:pointer-events-none flex items-center gap-1 font-sans"
              id="btn-custom-test-submit"
            >
              <Send className="w-3 h-3" />
              {lang === 'ja' ? 'テスト' : 'Test'}
            </button>
          </div>
          <p className="text-[10px] text-slate-500 mt-2 leading-relaxed font-sans">
            {lang === 'ja'
              ? '※ ハイフンを含むコードは、重複処理エラーを防ぐためにスクリプト内の安全仕様により自動的にスキップされます。'
              : 'Note: Codes containing hyphens (-) are automatically skipped by script safety guard to avoid request spam.'}
          </p>
        </form>
      </div>

      {/* Card 2: Real-time Stats & Analytics Chart */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col gap-4 shadow-lg shadow-indigo-950/10" id="claiming-analytics-card">
        <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
          <h3 className="text-sm font-semibold tracking-wider text-slate-300 uppercase flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-400" />
            {t.simStatsTitle}
          </h3>
          <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-0.5 rounded-full font-mono flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
            Live
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 items-center">
          {/* Left: Custom SVG Donut Chart */}
          <div className="flex flex-col items-center justify-center relative py-2">
            <svg className="w-24 h-24 transform -rotate-90">
              {/* Background Ring */}
              <circle
                cx="48"
                cy="48"
                r="36"
                className="stroke-slate-800"
                strokeWidth="8"
                fill="transparent"
              />
              {/* Failed Segment */}
              <circle
                cx="48"
                cy="48"
                r="36"
                className="stroke-rose-500/80 transition-all duration-500"
                strokeWidth="8"
                fill="transparent"
                strokeDasharray={2 * Math.PI * 36}
                strokeDashoffset={2 * Math.PI * 36 - ((failedCount / (claimedCount + failedCount || 1)) * (2 * Math.PI * 36))}
              />
              {/* Success Segment */}
              <circle
                cx="48"
                cy="48"
                r="36"
                className="stroke-emerald-500 transition-all duration-500"
                strokeWidth="8"
                fill="transparent"
                strokeDasharray={2 * Math.PI * 36}
                strokeDashoffset={2 * Math.PI * 36 - ((claimedCount / (claimedCount + failedCount || 1)) * (2 * Math.PI * 36))}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-base font-bold text-slate-100 font-mono">
                {claimedCount + failedCount > 0 ? Math.round((claimedCount / (claimedCount + failedCount)) * 100) : 0}%
              </span>
              <span className="text-[8px] text-slate-500 uppercase tracking-widest font-sans font-medium">{t.simStatsRatio}</span>
            </div>
          </div>

          {/* Right: Stat indicators */}
          <div className="space-y-3">
            <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/40">
              <span className="text-[10px] text-slate-500 block font-sans font-medium">{lang === 'ja' ? '総処理コード (Total)' : 'Total Processed'}</span>
              <span className="text-lg font-bold text-slate-200 font-mono">{claimedCount + failedCount} <span className="text-xs text-slate-500 font-normal">{lang === 'ja' ? '件' : ''}</span></span>
            </div>
            <div className="bg-slate-950/40 p-2 rounded-lg border border-slate-800/40 flex items-center justify-between gap-2">
              <div className="text-center w-1/2">
                <span className="text-[9px] text-emerald-400 block font-sans font-medium flex items-center justify-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-emerald-500"></span>
                  {lang === 'ja' ? '成功' : 'Success'}
                </span>
                <span className="text-sm font-bold text-slate-200 font-mono">{claimedCount} <span className="text-[10px] text-slate-500 font-normal">{lang === 'ja' ? '件' : ''}</span></span>
              </div>
              <div className="border-l border-slate-800 h-8"></div>
              <div className="text-center w-1/2">
                <span className="text-[9px] text-rose-400 block font-sans font-medium flex items-center justify-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-rose-500"></span>
                  {lang === 'ja' ? '失敗' : 'Failed'}
                </span>
                <span className="text-sm font-bold text-slate-200 font-mono">{failedCount} <span className="text-[10px] text-slate-500 font-normal">{lang === 'ja' ? '件' : ''}</span></span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick comparative progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-slate-500 font-medium">
            <span>{lang === 'ja' ? '成功割合' : 'Success Ratio'}</span>
            <span>{claimedCount} / {claimedCount + failedCount} {lang === 'ja' ? '件' : ''}</span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden flex">
            <div
              className="bg-emerald-500 h-full rounded-l-full transition-all duration-500"
              style={{ width: `${claimedCount + failedCount > 0 ? (claimedCount / (claimedCount + failedCount)) * 100 : 0}%` }}
            />
            <div
              className="bg-rose-500 h-full rounded-r-full transition-all duration-500"
              style={{ width: `${claimedCount + failedCount > 0 ? (failedCount / (claimedCount + failedCount)) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Scraper Control & Auto-Claim Toggle */}
        <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80 space-y-2.5">
          <div className="flex items-center justify-between text-[11px] text-slate-300 font-semibold font-sans">
            <span className="flex items-center gap-1">
              <Radio className={`w-3.5 h-3.5 ${isLiveScraping ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
              {lang === 'ja' ? '自動オファーコード請求' : 'Auto-Claim on Detection'}
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoClaimEnabled}
                onChange={(e) => {
                  setAutoClaimEnabled(e.target.checked);
                  addLog('info', `[System Config] Auto-claim on Telegram detection: ${e.target.checked ? 'ENABLED' : 'DISABLED'}`);
                }}
                className="sr-only peer"
              />
              <div className="w-7 h-4 bg-slate-850 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-500 after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600 peer-checked:after:bg-white"></div>
            </label>
          </div>
          <div className="flex justify-between items-center text-[10px] text-slate-500">
            <span>{lang === 'ja' ? 'スクレイパー状態:' : 'Scraper Status:'}</span>
            <span className="font-mono text-emerald-400 font-semibold flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full bg-emerald-500 ${isLiveScraping ? 'animate-ping' : ''}`}></span>
              {isLiveScraping ? (lang === 'ja' ? '同期中...' : 'Syncing...') : (lang === 'ja' ? '接続中 (Live)' : 'Connected (Live)')}
            </span>
          </div>
          <div className="flex justify-between items-center text-[10px] text-slate-500">
            <span>{lang === 'ja' ? '最終同期時刻:' : 'Last Synced:'}</span>
            <span className="font-mono text-slate-400">{lastScrapedTime}</span>
          </div>
          <button
            type="button"
            onClick={fetchRealTelegramCodes}
            disabled={isLiveScraping}
            className="w-full mt-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg py-1.5 text-xs font-semibold font-sans disabled:opacity-40 transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <RotateCcw className={`w-3 h-3 ${isLiveScraping ? 'animate-spin' : ''}`} />
            {lang === 'ja' ? '今すぐ手動で再同期' : 'Sync Manually Now'}
          </button>
        </div>
      </div>
    </div>

      {/* Mock Stake.com Browser Window */}
      <div className="lg:col-span-5 flex flex-col gap-6" id="mock-browser-container">
        {/* The Mock Browser Page */}
        <div className="bg-[#0f212e] border border-slate-800 rounded-xl overflow-hidden flex flex-col h-[320px] shadow-2xl relative">
          {/* Browser Header Bar */}
          <div className="bg-[#1a2c38] border-b border-[#0f212e] px-4 py-2.5 flex items-center gap-3">
            <div className="flex gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500/80 block"></span>
              <span className="w-3 h-3 rounded-full bg-yellow-500/80 block"></span>
              <span className="w-3 h-3 rounded-full bg-green-500/80 block"></span>
            </div>
            <div className="bg-[#0f212e] rounded-md px-3 py-1 text-[11px] text-slate-400 flex items-center gap-2 grow max-w-sm border border-slate-800/40 font-mono">
              <span className="text-slate-500 font-sans">https://</span>stake.com/settings/offers
            </div>
            <div className="ml-auto text-[10px] text-slate-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded font-medium flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-indigo-400" />
              {lang === 'ja' ? '拡張機能有効' : 'Extension Active'}
            </div>
          </div>

          {/* Stake Promo Page Layout */}
          <div className="p-6 flex flex-col justify-center items-center grow relative">
            <div className="w-full max-w-md text-center">
              <div className="mb-4">
                <span className="text-slate-400 text-xs font-semibold uppercase tracking-widest font-sans">{lang === 'ja' ? 'Settings / 設定' : 'Settings / Offers'}</span>
                <h2 className="text-white text-lg font-bold font-sans mt-0.5">{lang === 'ja' ? 'オファー・ボーナス請求' : 'Redeem Offer / Bonus'}</h2>
              </div>

              {/* Stake Offer Form container */}
              <div className={`bg-[#1a2c38] rounded-xl p-5 border text-left transition-all duration-500 ${
                modalType === 'success'
                  ? 'border-emerald-500/80 shadow-[0_0_20px_rgba(16,185,129,0.25)] bg-emerald-950/10'
                  : 'border-slate-800/50'
              }`}>
                <label className="block text-slate-400 text-xs font-medium mb-1.5 font-sans">{lang === 'ja' ? 'オファーコードの適用 (Redeem Offer Code)' : 'Redeem Offer Code'}</label>
                <div className="flex gap-3">
                  <div className="relative grow">
                    <input
                      type="text"
                      name="code"
                      readOnly
                      placeholder={t.stakeInputPlaceholder}
                      value={inputVal}
                      className={`w-full bg-[#0f212e] text-white placeholder-[#557086] text-sm border font-mono rounded-lg py-2.5 px-3.5 focus:outline-none transition ${
                        isFocused 
                          ? 'border-indigo-500 ring-1 ring-indigo-500' 
                          : 'border-[#2f4553] hover:border-[#456175]'
                      }`}
                      id="simulated-stake-input"
                    />
                  </div>
                  <motion.button
                    whileHover={{ scale: !inputVal || isSubmitting ? 1 : 1.03 }}
                    whileTap={{ scale: !inputVal || isSubmitting ? 1 : 0.97 }}
                    disabled={isSubmitting || !inputVal}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm px-5 py-2.5 rounded-lg transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2 shrink-0 font-sans shadow-lg shadow-blue-900/20 cursor-pointer"
                    id="simulated-stake-submit-btn"
                  >
                    {isSubmitting ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    ) : (lang === 'ja' ? '適用' : 'Apply')}
                  </motion.button>
                </div>
                <div className="mt-2.5 flex items-center gap-2 text-[10px] text-slate-400 font-sans">
                  <span>{lang === 'ja' ? '※ Stake.comの正規UIと同様に、適用ボタンクリック後に検証されます。' : 'Note: Real-time authorization check mimics the official Stake.com flow.'}</span>
                </div>
              </div>
            </div>

            {/* Stake Modal Dialog Simulator */}
            <AnimatePresence>
              {modalType && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex justify-center items-center p-4 z-20"
                >
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 15 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 10 }}
                    transition={{ type: "spring", duration: 0.35, bounce: 0.25 }}
                    className="bg-[#1a2c38] border border-slate-800 rounded-xl shadow-2xl max-w-sm w-full overflow-hidden"
                  >
                    <div className="p-5 text-center">
                      <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full mb-3">
                        {modalType === 'success' ? (
                          <motion.div
                            initial={{ scale: 0.5, rotate: -45 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: "spring", stiffness: 300, delay: 0.1 }}
                            className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20"
                          >
                            <CheckCircle className="h-6 w-6 text-emerald-500" />
                          </motion.div>
                        ) : (
                          <motion.div
                            initial={{ scale: 0.5 }}
                            animate={{ scale: [1, 1.15, 1] }}
                            transition={{ repeat: Infinity, duration: 1.5 }}
                            className="h-12 w-12 rounded-full bg-rose-500/10 flex items-center justify-center border border-rose-500/20"
                          >
                            <AlertTriangle className="h-6 w-6 text-rose-500" />
                          </motion.div>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold text-white font-sans">
                        {claimMode === 'real' 
                          ? (lang === 'ja' ? 'オファーコード適用（外部リンク）' : 'External Redeem Request') 
                          : (modalType === 'success' ? t.stakeSuccessTitle : (lang === 'ja' ? 'エラーが発生しました' : 'Error Occurred'))}
                      </h3>
                      <p className="text-xs text-slate-300 mt-2 font-sans leading-relaxed whitespace-pre-line">
                        {modalMessage}
                      </p>
                      
                      {claimMode === 'real' && currentClaimCode && (
                        <div className="mt-3.5 p-2.5 bg-slate-950/50 rounded-lg border border-emerald-500/10 flex flex-col items-center gap-1.5">
                          <span className="text-[10px] text-slate-400 font-sans">{lang === 'ja' ? '自動コピーされたコード' : 'Auto-copied Code'}</span>
                          <span className="text-sm font-mono font-bold text-emerald-400 tracking-wider bg-slate-950 px-3 py-1 rounded border border-slate-800">
                            {currentClaimCode}
                          </span>
                        </div>
                      )}

                      <div className="mt-4 flex gap-2 justify-center">
                        {claimMode === 'real' && currentClaimCode && (
                          <a
                            href={`https://${stakeDomain}/settings/offers?code=${currentClaimCode}`}
                            target="_blank; noreferrer"
                            rel="noopener noreferrer"
                            onClick={() => {
                              addLog('success', `[Manual Action] Redirected user to real Stake.com for code: "${currentClaimCode}"`);
                              setModalType(null);
                            }}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 px-4 rounded-lg transition font-sans flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-900/30"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            {lang === 'ja' ? '本番アカウントで適用する' : 'Apply on Real Account'}
                          </a>
                        )}
                        <button
                          onClick={() => {
                            setModalType(null);
                            addLog('info', `[Manual Action] Close button clicked manually on modal.`);
                          }}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold py-2 px-4 rounded-lg border border-slate-700 transition font-sans cursor-pointer"
                          id="btn-close-stake-modal"
                        >
                          {t.stakeCloseBtn}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Console / Script Output Logs */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden flex flex-col h-[200px] shadow-inner font-mono text-xs">
          <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex justify-between items-center text-slate-400 select-none">
            <span className="flex items-center gap-1.5 font-sans font-semibold text-[11px] text-slate-300">
              <Terminal className="w-3.5 h-3.5 text-indigo-400" />
              {t.simLogsTitle}
            </span>
            <button
              onClick={clearLogs}
              className="text-[10px] hover:text-slate-200 transition bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded flex items-center gap-1 font-sans font-medium"
              id="btn-clear-logs"
            >
              <RotateCcw className="w-3 h-3" />
              {lang === 'ja' ? 'ログ消去' : 'Clear'}
            </button>
          </div>
          <div
            ref={logContainerRef}
            className="p-4 overflow-y-auto space-y-1 bg-slate-950 flex-1 leading-normal"
          >
            {logs.map((log) => {
              let color = 'text-slate-400';
              if (log.type === 'success') color = 'text-emerald-400 font-semibold';
              if (log.type === 'warn') color = 'text-amber-400';
              if (log.type === 'error') color = 'text-rose-400';
              
              return (
                <div key={log.id} className="flex gap-2">
                  <span className="text-slate-600 shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className={`${color} break-all`}>{log.message}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Input Diagnostic Tool */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4.5 flex flex-col gap-3 shadow-lg shadow-indigo-950/10">
          <div className="flex items-center justify-between border-b border-slate-800/60 pb-2.5">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 font-sans">
              <Search className="w-3.5 h-3.5 text-indigo-400" />
              {lang === 'ja' ? '🛠️ インプット解析・診断ツール' : '🛠️ Input Diagnostics & React Parser'}
            </h4>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              type="button"
              onClick={runDiagnostics}
              className="text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-1 px-2.5 rounded-lg border border-indigo-500/20 transition cursor-pointer font-sans"
            >
              {lang === 'ja' ? 'DOM診断実行' : 'Scan Element'}
            </motion.button>
          </div>

          <p className="text-[11px] text-slate-400 leading-normal font-sans">
            {lang === 'ja'
              ? 'アクティブな入力欄のCSSセレクターとReact内部プロパティを抽出し、自動入力時のイベント発火障害（状態更新漏れ）の原因を解析・デバッグします。'
              : 'Extracts CSS selectors and internal React fiber/props properties of the active input field to debug auto-fill trigger or state update issues on target sites.'}
          </p>

          {diagnosticReport ? (
            diagnosticReport.elementFound ? (
              <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 space-y-2 font-mono text-[10px] text-slate-300">
                <div className="flex items-center gap-1.5 text-emerald-400 font-sans font-bold">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>{lang === 'ja' ? '対象の入力フィールド検出完了' : 'Target Input Field Detected'}</span>
                </div>
                
                <div className="grid grid-cols-3 gap-1 border-t border-slate-850/60 pt-2 text-slate-400">
                  <span className="font-sans text-slate-500">{lang === 'ja' ? 'タグ名 / ID:' : 'Tag / ID:'}</span>
                  <span className="col-span-2 text-slate-200">
                    &lt;{diagnosticReport.tagName}&gt; #{diagnosticReport.id}
                  </span>
                  
                  <span className="font-sans text-slate-500">{lang === 'ja' ? '名称 (Name):' : 'Name Attribute:'}</span>
                  <span className="col-span-2 text-slate-200">{diagnosticReport.name}</span>
                  
                  <span className="font-sans text-slate-500">{lang === 'ja' ? 'CSS選択肢:' : 'Matched CSS:'}</span>
                  <span className="col-span-2 text-indigo-400 break-all">
                    {diagnosticReport.matchingSelectors?.join(', ')}
                  </span>

                  <span className="font-sans text-slate-500">{lang === 'ja' ? '現在の値:' : 'Current Value:'}</span>
                  <span className="col-span-2 text-emerald-400 break-all font-bold">
                    "{diagnosticReport.currentValue || 'empty'}"
                  </span>
                </div>

                <div className="border-t border-slate-850/60 pt-2 space-y-1">
                  <div className="text-[10px] font-sans font-bold text-slate-400 flex items-center gap-1">
                    <Database className="w-3 h-3 text-indigo-400" />
                    <span>{lang === 'ja' ? 'React内部プロパティ (Virtual DOM Properties):' : 'React Virtual DOM Properties:'}</span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-1 text-slate-400 pl-1.5">
                    <span className="font-sans text-slate-500">Fiber Key:</span>
                    <span className="col-span-2 text-indigo-300 truncate" title={diagnosticReport.reactProperties?.fiberKey || 'N/A'}>
                      {diagnosticReport.reactProperties?.fiberKey ? '✅ Detected' : '❌ Not Found'}
                    </span>
                    
                    <span className="font-sans text-slate-500">Props Key:</span>
                    <span className="col-span-2 text-indigo-300 truncate" title={diagnosticReport.reactProperties?.propsKey || 'N/A'}>
                      {diagnosticReport.reactProperties?.propsKey ? '✅ Detected' : '❌ Not Found'}
                    </span>
                    
                    <span className="font-sans text-slate-500">onChange:</span>
                    <span className="col-span-2 font-bold">
                      {diagnosticReport.reactProperties?.onChangeAttached ? (
                        <span className="text-emerald-400">Attached (状態連携あり)</span>
                      ) : (
                        <span className="text-amber-400">No listener (直接値変更のみ)</span>
                      )}
                    </span>

                    <span className="font-sans text-slate-500">State Value:</span>
                    <span className="col-span-2 text-slate-200 font-semibold italic">
                      {diagnosticReport.reactProperties?.reactBoundValue !== undefined 
                        ? `"${diagnosticReport.reactProperties.reactBoundValue}"` 
                        : 'undefined (Uncontrolled)'}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-900/50 border border-slate-850/40 rounded p-2 text-[9.5px] leading-relaxed text-slate-500 font-sans mt-2.5">
                  <span className="font-bold text-slate-400 block mb-0.5">💡 React Auto-Fill Tip:</span>
                  {lang === 'ja'
                    ? 'React製サイトでは直接 `input.value` を書き換えても仮想DOMステートが追従しません。そのため、本スクリプトでは `window.HTMLInputElement.prototype` のセッターを抽出し強制的にReactバインドを更新しています。'
                    : 'On React-based sites, direct `input.value` updates bypass the virtual DOM. This script extracts the original native prototype setter via `Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")` to force-update React state.'}
                </div>
              </div>
            ) : (
              <div className="bg-slate-950/60 border border-red-900/20 text-rose-400 rounded-lg p-3 text-center text-[10px] font-sans">
                {lang === 'ja' ? '❌ フィールドが見つかりません。モックブラウザ内で入力フォームを表示した状態で再度スキャンしてください。' : '❌ Target element not found. Please make sure the input field is rendered and visible.'}
              </div>
            )
          ) : (
            <div className="bg-slate-950/40 border border-slate-800/40 text-slate-500 rounded-lg p-3 text-center text-[10px] font-sans italic">
              {lang === 'ja' ? '「DOM診断実行」をクリックすると、現在のDOM解析レポートが生成されます。' : 'Click "Scan Element" to run a diagnostics report on the simulated DOM.'}
            </div>
          )}
        </div>
      </div>

      {/* Chrome Extension Popup Simulator (拡張期・拡張機能のUI) */}
      <div className="lg:col-span-3 flex flex-col gap-6" id="chrome-extension-container">
        {/* Visual Chrome Extension Window Wrapper */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4.5 shadow-2xl flex flex-col gap-4 text-left">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <div className="bg-indigo-600/20 p-2 rounded-lg border border-indigo-500/30 text-indigo-400">
                <Activity className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white tracking-wide">
                  Stake Auto VIP Ext
                </h3>
                <p className="text-[9px] text-slate-500 font-mono">v2.4.0 (Manifest V3)</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded border border-slate-850/60">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              <span className="text-[9px] font-bold text-slate-400">{lang === 'ja' ? '同期中' : 'Synced'}</span>
            </div>
          </div>

          {/* Section 1: Dashboard sync */}
          <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-3 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              <span>{lang === 'ja' ? '接続状態 (Status)' : 'Connection Status'}</span>
              <span className="text-indigo-400 font-mono text-[8px]">Sync Engine</span>
            </div>
            <div className="flex items-center justify-between gap-2 bg-slate-900/60 p-2 rounded border border-slate-800/40">
              <div className="flex items-center gap-1.5 text-xs text-slate-300">
                <Wifi className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{lang === 'ja' ? 'ダッシュボード同期:' : 'Dashboard Sync:'}</span>
              </div>
              <span className="text-xs text-emerald-400 font-bold">{lang === 'ja' ? '接続完了' : 'Connected'}</span>
            </div>
            <div className="flex items-center justify-between text-[9px] text-slate-500 bg-slate-900/40 p-1 rounded font-mono">
              <span>SYNC CHANNEL:</span>
              <span>chrome.storage.local</span>
            </div>
          </div>

          {/* Section 2: Received Code */}
          <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              <span>{lang === 'ja' ? '受信したコード' : 'Received Code'}</span>
              <span className="text-indigo-400 font-mono text-[8px]">Live Code</span>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 px-3 py-2 rounded-lg text-center font-mono">
              {currentClaimCode ? (
                <div className="flex items-center justify-center gap-1.5 text-indigo-400 font-bold text-sm tracking-wide">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                  {currentClaimCode}
                </div>
              ) : (
                <span className="text-xs text-slate-600">{lang === 'ja' ? '[ コード待機中... ]' : '[ Waiting for Code... ]'}</span>
              )}
            </div>
            <div className="flex items-center justify-between text-[9px] text-slate-500 bg-slate-900/40 p-1.5 rounded">
              <span>{lang === 'ja' ? '動作モード:' : 'Operation Mode:'}</span>
              <span className={`font-bold ${claimMode === 'real' ? 'text-emerald-400' : 'text-indigo-400'}`}>
                {claimMode === 'real' ? (lang === 'ja' ? '本番アカウント直接 (REAL)' : 'Real Account (Direct)') : (lang === 'ja' ? 'テスト環境' : 'Test Env')}
              </span>
            </div>
          </div>

          {/* Section 3: Claiming Engine State */}
          <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-3 space-y-2.5">
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              <span>{lang === 'ja' ? '現在の請求状態' : 'Current Claiming State'}</span>
              <span className="text-indigo-400 font-mono text-[8px]">Process</span>
            </div>

            {/* Dynamic claim status badges */}
            <div className="p-2 rounded-lg border flex flex-col items-center justify-center gap-2 text-center transition-all duration-300 min-h-[75px] bg-slate-900/80 border-slate-850">
              {claimState === 'idle' && (
                <>
                  <Clock className="w-4 h-4 text-slate-500" />
                  <div className="text-[11px] font-bold text-slate-400">{lang === 'ja' ? '待機中 (IDLE)' : 'Idle (IDLE)'}</div>
                  <p className="text-[9px] text-slate-500 leading-normal">{lang === 'ja' ? 'チャネルフィードから新規コードを受信すると、即座に自動入力処理がトリガーされます。' : 'Receiving a new code drop will instantly trigger the auto-fill processor.'}</p>
                </>
              )}
              {claimState === 'checking_domain' && (
                <>
                  <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                  <div className="text-[11px] font-bold text-amber-400">{lang === 'ja' ? '本番コード適用リンク生成中...' : 'Generating real redirect link...'}</div>
                  <p className="text-[9px] text-amber-500/80 leading-normal">{lang === 'ja' ? '選択ドメイン:' : 'Active Domain:'} https://{stakeDomain}</p>
                </>
              )}
              {claimState === 'scanning_dom' && (
                <>
                  <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                  <div className="text-[11px] font-bold text-indigo-400">{lang === 'ja' ? 'DOMスキャン中...' : 'Scanning DOM...'}</div>
                  <p className="text-[9px] text-indigo-400/80 leading-normal">{lang === 'ja' ? '入力フィールドを検出中...' : 'Detecting text inputs...'}</p>
                </>
              )}
              {claimState === 'filling_input' && (
                <>
                  <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />
                  <div className="text-[11px] font-bold text-yellow-400">{lang === 'ja' ? '自動インプット中...' : 'Auto-Filling Input...'}</div>
                  <p className="text-[9px] text-yellow-500/80 leading-normal">{lang === 'ja' ? 'React state value setterを呼び出し中...' : 'Executing React State input hack...'}</p>
                </>
              )}
              {claimState === 'clicking_submit' && (
                <>
                  <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                  <div className="text-[11px] font-bold text-purple-400">{lang === 'ja' ? '適用ボタン押下ディレイ中...' : 'Awaiting delay timer...'}</div>
                  <p className="text-[9px] text-purple-500/80 leading-normal">{lang === 'ja' ? `ディレイ: ${config.delayMs}ms 待機しています。` : `Delay: waiting for ${config.delayMs}ms.`}</p>
                </>
              )}
              {claimState === 'verifying' && (
                <>
                  <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                  <div className="text-[11px] font-bold text-cyan-400">{lang === 'ja' ? '検証サーバー通信中...' : 'Communicating Server...'}</div>
                  <p className="text-[9px] text-cyan-500/80 leading-normal">{lang === 'ja' ? 'Stakeサーバーの応答を待機中...' : 'Awaiting response from Stake API...'}</p>
                </>
              )}
              {claimState === 'success' && (
                <>
                  <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="text-[11px] font-bold text-emerald-400">{lang === 'ja' ? 'ボーナス請求成功！' : 'Claim Succeeded!'}</div>
                  <p className="text-[9px] text-emerald-500/80 leading-normal">{lang === 'ja' ? '適用完了。キャッシュに追加されました。' : 'Applied successfully. Added to blacklist cache.'}</p>
                </>
              )}
              {claimState === 'limit_reached' && (
                <>
                  <div className="w-5 h-5 rounded-full bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                  </div>
                  <div className="text-[11px] font-bold text-rose-500">{lang === 'ja' ? '上限到達 (Limit Reached)' : 'Limit Reached (Exhausted)'}</div>
                  <p className="text-[9px] text-rose-500/80 leading-normal">{lang === 'ja' ? 'オファー枠の上限枠に到達しました。' : 'The bonus drop has reached its maximum limit.'}</p>
                </>
              )}
              {claimState === 'already_claimed' && (
                <>
                  <div className="w-5 h-5 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="text-[11px] font-bold text-amber-400">{lang === 'ja' ? 'すでに請求済み' : 'Already Claimed'}</div>
                  <p className="text-[9px] text-amber-500/80 leading-normal">{lang === 'ja' ? 'このボーナスはすでに受け取り済みです。' : 'This bonus drop has already been redeemed.'}</p>
                </>
              )}
              {claimState === 'expired' && (
                <>
                  <div className="w-5 h-5 rounded-full bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                  </div>
                  <div className="text-[11px] font-bold text-rose-500">{lang === 'ja' ? '無効または有効期限切れ' : 'Invalid or Expired'}</div>
                  <p className="text-[9px] text-rose-500/80 leading-normal">{lang === 'ja' ? 'コードが無効であるか期限が切れています。' : 'The promo code is invalid or has expired.'}</p>
                </>
              )}
            </div>
          </div>

          {/* Section 4: Cache details */}
          <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-3 text-[10px] text-slate-500 flex items-center justify-between font-sans">
            <span className="flex items-center gap-1.5 text-slate-400">
              <Database className="w-3 h-3 text-indigo-400" />
              {lang === 'ja' ? 'ローカル重複防止リスト' : 'Local Deduplication List'}
            </span>
            <span className="font-mono text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">
              {lang === 'ja' ? '同期完了' : 'Synced'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

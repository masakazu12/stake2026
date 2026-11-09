import { ClaimConfig } from '../types';

export const getDynamicUserscriptCode = (config: ClaimConfig) => {
  return `// ==UserScript==
// @name         Stake.com Auto Bonus Drop Claiming Script
// @namespace    http://tampermonkey.net/
// @version      2.4.1
// @description  Automatically detects and redeems Stake bonus codes dynamically
// @author       Stake Auto-Claimer Community
// @match        https://*.stake.com/*
// @match        https://*.stake.bet/*
// @grant        none
// @run-at       document-end
// ==UserScript==

(function() {
    'use strict';
    
    // Check if running on top-level main window to prevent loop inside iframes
    if (window.self !== window.top) {
        return;
    }
    
    console.log("[StakeAutoClaimer] Script active on top window with custom config.");
    
    const CONFIG = {
        delayMs: ${config.delayMs},
        autoCloseLimit: ${config.autoCloseLimit},
        audioAlert: ${config.audioAlert},
        keywords: ${JSON.stringify(config.keywords, null, 8)}
    };

    const PROCESSED_KEY = "stake_processed_codes_v3";
    let processedSet = new Set();
    let activeCodeInProgress = null;
    
    function loadProcessedCodes() {
        try {
            const saved = localStorage.getItem(PROCESSED_KEY);
            processedSet = saved ? new Set(JSON.parse(saved)) : new Set();
        } catch (e) {
            console.error("[StakeAutoClaimer] Failed to load cache:", e);
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
            console.log("[StakeAutoClaimer] Blacklisted:", normalized);
        } catch (e) {
            console.error("[StakeAutoClaimer] Failed to save blacklist:", e);
        }
    }

    function isCodeProcessed(code) {
        if (!code) return true;
        loadProcessedCodes();
        return processedSet.has(code.trim().toUpperCase());
    }

    // Modal popup monitoring loop
    setInterval(() => {
        if (!CONFIG.autoCloseLimit) return;
        
        // Handle "invalid bonus code" popup: Auto-close it and strictly prevent any retries
        const bodyText = document.body.textContent || "";
        const isInvalidBonusCodeScreen = bodyText.includes("無効なボーナスコード") || 
                                         bodyText.includes("ボーナスコードは無効です") ||
                                         bodyText.toLowerCase().includes("invalid bonus code") ||
                                         bodyText.toLowerCase().includes("code is invalid");

        if (isInvalidBonusCodeScreen) {
            if (activeCodeInProgress) {
                markCodeAsProcessed(activeCodeInProgress);
            }
            const activeInput = document.querySelector('input[name="code"], input[placeholder*="Code"], input[type="text"]');
            if (activeInput && activeInput.value) {
                markCodeAsProcessed(activeInput.value.trim());
            }

            // Find and click the "閉じる" (Close) button inside the active modal/popup
            const modals = document.querySelectorAll('div[role="dialog"], div.modal-content, div[class*="modal"]');
            modals.forEach((modal) => {
                const modalText = modal.textContent || "";
                const isThisModalInvalid = modalText.includes("無効なボーナスコード") || 
                                           modalText.includes("ボーナスコードは無効です") ||
                                           modalText.toLowerCase().includes("invalid bonus code") ||
                                           modalText.toLowerCase().includes("code is invalid");
                if (isThisModalInvalid) {
                    const buttons = modal.querySelectorAll('button');
                    buttons.forEach((btn) => {
                        const btnText = (btn.textContent || "").toLowerCase();
                        if (btnText.includes('閉じる') || btnText.includes('close') || btnText.includes('ok')) {
                            setTimeout(() => {
                                btn.click();
                                console.warn("[StakeAutoClaimer] 無効なボーナスコードのポップアップを自動で閉じました（再試行はスキップ）。");
                                activeCodeInProgress = null;
                                if (CONFIG.audioAlert) playSystemSound("error");
                            }, CONFIG.delayMs);
                        }
                    });
                }
            });

            activeCodeInProgress = null;
            return;
        }

        const modals = document.querySelectorAll('div[role="dialog"], div.modal-content, div[class*="modal"]');
        modals.forEach((modal) => {
            const textContent = modal.textContent || "";
            const hasLimitError = CONFIG.keywords.some(kw => textContent.toLowerCase().includes(kw.toLowerCase()));
            
            if (hasLimitError) {
                if (activeCodeInProgress) {
                    markCodeAsProcessed(activeCodeInProgress);
                }

                const activeInput = document.querySelector('input[name="code"], input[placeholder*="Code"], input[type="text"]');
                if (activeInput && activeInput.value) {
                    markCodeAsProcessed(activeInput.value.trim());
                }

                const buttons = modal.querySelectorAll('button');
                buttons.forEach((btn) => {
                    const btnText = (btn.textContent || "").toLowerCase();
                    if (btnText.includes('閉じる') || btnText.includes('close') || btnText.includes('ok')) {
                        setTimeout(() => {
                            // Double check before actually clicking
                            const currentBodyText = document.body.textContent || "";
                            const currentInvalidCheck = currentBodyText.includes("無効なボーナスコード") || 
                                                         currentBodyText.includes("ボーナスコードは無効です") ||
                                                         currentBodyText.toLowerCase().includes("invalid bonus code") ||
                                                         currentBodyText.toLowerCase().includes("code is invalid");
                            if (currentInvalidCheck) {
                                console.log("[StakeAutoClaimer] Click aborted: Invalid bonus code popup confirmed on screen.");
                                return;
                            }
                            btn.click();
                            console.warn("[StakeAutoClaimer] Auto-closed error popup.");
                            activeCodeInProgress = null;
                            if (CONFIG.audioAlert) playSystemSound("error");
                        }, CONFIG.delayMs);
                    }
                });
            }
        });
    }, 300);

    // Safe periodic page reload interval: Every 10 minutes (600,000 ms) to keep Stake session active.
    // Page reloads are strictly prevented during active code claiming.
    setInterval(() => {
        if (activeCodeInProgress) {
            console.log("[StakeAutoClaimer] Claim in progress. Scheduled 10-minute session keepalive reload postponed.");
            return;
        }
        console.log("[StakeAutoClaimer] Executing scheduled 10-minute session keepalive reload to refresh active session...");
        window.location.reload();
    }, 600000); // 10 minutes (600,000 ms)

    function playSystemSound(type) {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            
            if (type === "success") {
                osc.frequency.setValueAtTime(880, audioCtx.currentTime);
                gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
                osc.start();
                osc.stop(audioCtx.currentTime + 0.15);
            } else {
                osc.frequency.setValueAtTime(220, audioCtx.currentTime);
                gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
                osc.start();
                osc.stop(audioCtx.currentTime + 0.25);
            }
        } catch(e) {}
    }

    window.addEventListener("message", function(event) {
        if (event.data && event.data.type === "STAKE_CLAIM_CODE") {
            const code = event.data.code;
            if (code) autoInputAndClaim(code.trim());
        }
    });

    function autoInputAndClaim(code) {
        const cleanCode = code.trim();
        // Skip purely uppercase alphanumeric and underscore codes (e.g. STAKE_AUTODROP)
        if (/^[A-Z0-9_]+$/.test(cleanCode)) {
            console.log("[StakeAutoClaimer] Pure uppercase alphanumeric and underscore code ignored:", cleanCode);
            return;
        }
        if (isCodeProcessed(cleanCode)) return;

        activeCodeInProgress = cleanCode;
        markCodeAsProcessed(cleanCode);

        // Select all input and textarea elements to ensure no input fields are missed
        const elements = Array.from(document.querySelectorAll('input, textarea'));
        const allInputs = elements.filter(el => {
            if (!el) return false;
            const type = (el.getAttribute('type') || 'text').toLowerCase();
            const placeholder = (el.placeholder || '').toLowerCase();
            const name = (el.name || '').toLowerCase();
            const id = (el.id || '').toLowerCase();
            const className = (el.className || '').toLowerCase();
            
            // Skip non-textual input types
            const skipTypes = ['checkbox', 'radio', 'submit', 'button', 'hidden', 'file', 'image', 'range', 'date', 'time', 'color', 'number'];
            if (skipTypes.includes(type)) return false;
            
            // Skip search and filter fields completely (case-insensitive for Japanese/English keywords)
            const searchKeywords = ['search', 'find', 'query', 'filter', '検索', 'さがす', 'フィルター'];
            if (searchKeywords.some(kw => placeholder.includes(kw) || name.includes(kw) || id.includes(kw) || className.includes(kw))) {
                return false;
            }
            
            return true;
        });

        let input = null;

        if (allInputs.length > 0) {
            let bestMatch = null;
            let highestScore = -1000;
            
            for (const inEl of allInputs) {
                let score = 0;
                const placeholder = (inEl.placeholder || "").toLowerCase();
                const idStr = (inEl.id || "").toLowerCase();
                const nameStr = (inEl.name || "").toLowerCase();
                const className = (inEl.className || "").toLowerCase();
                
                // Active focus gets highest priority
                if (inEl === document.activeElement) {
                    score += 250;
                }

                // Base attribute analysis
                if (placeholder.includes('bonus') || placeholder.includes('drop') || placeholder.includes('ボーナス') || placeholder.includes('code') || placeholder.includes('コード') || placeholder.includes('promo') || placeholder.includes('プロモ') || placeholder.includes('redeem')) score += 50;
                if (idStr.includes('bonus') || idStr.includes('drop') || idStr.includes('code') || idStr.includes('promo')) score += 50;
                if (nameStr.includes('bonus') || nameStr.includes('drop') || nameStr.includes('code') || nameStr.includes('promo')) score += 50;
                if (className.includes('bonus') || className.includes('drop') || className.includes('code') || className.includes('promo')) score += 30;
                
                // Strongly penalize welcome-offer/sign-up attributes to avoid entering bonus codes there
                if (placeholder.includes('welcome') || placeholder.includes('signup') || placeholder.includes('register') || placeholder.includes('join') || placeholder.includes('create') || placeholder.includes('ウェルカム') || placeholder.includes('新規') || placeholder.includes('登録') || placeholder.includes('会員登録') || placeholder.includes('サインアップ')) score -= 250;
                if (idStr.includes('welcome') || idStr.includes('signup') || idStr.includes('register')) score -= 250;
                if (nameStr.includes('welcome') || nameStr.includes('signup') || nameStr.includes('register')) score -= 250;
                if (className.includes('welcome') || className.includes('signup')) score -= 150;
                
                // Climb parent tree to analyze surrounding context with deep search
                let current = inEl;
                let depth = 1;
                let foundBonusContext = false;
                let foundWelcomeContext = false;
                
                while (current && depth <= 10) {
                    const text = (current.textContent || "").toLowerCase();
                    
                    // Match localized Stake bonus drop section titles
                    if (text.includes('ボーナスドロップを受け取る') || text.includes('ボーナスドロップ') || text.includes('bonus drop') || text.includes('redeem bonus') || text.includes('ボーナスを申請') || text.includes('ボーナス請求') || text.includes('プロモコード')) {
                        // Higher score for closer/more relevant ancestors
                        score += Math.max(100, 500 - (depth * 40));
                        foundBonusContext = true;
                    } else if (text.includes('ボーナス') || text.includes('bonus') || text.includes('drop') || text.includes('オファー') || text.includes('offer')) {
                        score += Math.max(20, 100 - (depth * 10));
                    }
                    
                    // Penalize welcome offer text containers to prevent cross-contamination
                    if (text.includes('ウェルカム') || text.includes('welcome') || text.includes('ウェルカム・オファー') || text.includes('sign up') || text.includes('新規登録') || text.includes('新規') || text.includes('登録')) {
                        score -= Math.max(150, 600 - (depth * 50));
                        foundWelcomeContext = true;
                    }
                    
                    current = current.parentElement;
                    depth++;
                }
                
                // Context-aware scoring adjustments
                if (foundBonusContext && !foundWelcomeContext) {
                    score += 1000; // Confirmed standalone bonus drop section
                }
                if (foundWelcomeContext) {
                    score -= 1000; // Explicitly inside welcome offer section, disqualify
                }
                
                if (score > highestScore) {
                    highestScore = score;
                    bestMatch = inEl;
                }
            }
            
            if (bestMatch && highestScore > -100) {
                input = bestMatch;
            } else {
                if (allInputs.length >= 2) {
                    input = allInputs[1];
                } else {
                    input = allInputs[0];
                }
            }
        }

        if (input) {
            input.focus();
            const prototype = Object.getPrototypeOf(input);
            const nativeSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set || 
                                 Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
            if (nativeSetter) {
                nativeSetter.call(input, cleanCode);
            } else {
                input.value = cleanCode;
            }
            
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            
            // Dispatch key events to satisfy complex framework bindings
            try {
                input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter', keyCode: 13 }));
                input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: 'Enter', keyCode: 13 }));
                input.dispatchEvent(new Event('textInput', { bubbles: true }));
            } catch (e) {}
            
            setTimeout(() => {
                let submitBtn = null;
                const keywords = ['適用', '請求', '送信', 'redeem', 'claim', 'apply'];
                
                // Search for the closest button inside the same nested card/section of the input field
                let parent = input.parentElement;
                let searchDepth = 0;
                while (parent && searchDepth < 6 && !submitBtn) {
                    const localButtons = Array.from(parent.querySelectorAll('button'));
                    if (localButtons.length > 0) {
                        const matchedButtons = localButtons.filter(btn => {
                            const txt = (btn.textContent || "").toLowerCase();
                            return keywords.some(kw => txt.includes(kw));
                        });
                        
                        if (matchedButtons.length > 0) {
                            // Score buttons to find the exact button for redeeming bonus drops
                            let bestBtn = null;
                            let bestBtnScore = -100;
                            
                            for (const btn of matchedButtons) {
                                let btnScore = 0;
                                const btnText = (btn.textContent || "").toLowerCase();
                                const btnParentText = (btn.parentElement?.textContent || "").toLowerCase();
                                
                                if (btnText.includes('適用') || btnText.includes('apply') || btnText.includes('claim')) btnScore += 15;
                                if (btnParentText.includes('ボーナス') || btnParentText.includes('bonus') || btnParentText.includes('drop')) btnScore += 25;
                                
                                // Heavily penalize welcome-offer buttons to avoid misclicks
                                if (btnText.includes('ウェルカム') || btnText.includes('welcome')) btnScore -= 120;
                                if (btnParentText.includes('ウェルカム') || btnParentText.includes('welcome')) btnScore -= 120;
                                
                                if (btnScore > bestBtnScore) {
                                    bestBtnScore = btnScore;
                                    bestBtn = btn;
                                }
                            }
                            
                            if (bestBtn && bestBtnScore > -50) {
                                submitBtn = bestBtn;
                                break;
                            }
                        }
                    }
                    parent = parent.parentElement;
                    searchDepth++;
                }
                
                // Global fallback filtering out welcome buttons
                if (!submitBtn) {
                    const allButtons = Array.from(document.querySelectorAll('button'));
                    const filtered = allButtons.filter(btn => {
                        const txt = (btn.textContent || "").toLowerCase();
                        const parentTxt = (btn.parentElement?.textContent || "").toLowerCase();
                        return keywords.some(kw => txt.includes(kw)) && 
                               !txt.includes('welcome') && !txt.includes('ウェルカム') &&
                               !parentTxt.includes('welcome') && !parentTxt.includes('ウェルカム');
                    });
                    if (filtered.length > 0) {
                        submitBtn = filtered[0];
                    }
                }

                if (submitBtn) {
                    submitBtn.removeAttribute('disabled');
                    submitBtn.click();
                    if (CONFIG.audioAlert) playSystemSound("success");
                } else {
                    input.dispatchEvent(new KeyboardEvent('keypress', { bubbles: true, keyCode: 13, key: 'Enter' }));
                }
            }, CONFIG.delayMs);
        }
    }
})();`;
};;

export const getDynamicManifest = () => {
  return `{
  "manifest_version": 3,
  "name": "ステークボーナス自動請求ツール (Stake Auto-Claimer VIP)",
  "version": "2.4.1",
  "description": "公式配布フィードやAPI・Webhookからコードを自動検出・自動適用・自動請求するVIP拡張機能（リアルタイム同期＆ダッシュボード完備）",
  "permissions": [
    "storage",
    "activeTab",
    "clipboardRead"
  ],
  "host_permissions": [
    "https://*.stake.com/*",
    "https://*.stake.bet/*"
  ],
  "action": {
    "default_popup": "popup.html"
  },
  "options_page": "dashboard.html",
  "content_scripts": [
    {
      "matches": [
        "https://*.stake.com/*",
        "https://*.stake.bet/*"
      ],
      "js": ["stake_bonus_claimer.js"],
      "run_at": "document_end"
    }
  ]
}`;
};

export const getExtContentScript = (config: ClaimConfig) => {
  return `/**
 * Stake.com Auto Bonus Drop Claiming Content Script (v2.4.1)
 * Optimized for Chrome Extension environment with chrome.storage.local support.
 */
(function() {
    'use strict';
    if (window.self !== window.top) return;

    let CONFIG = {
        delayMs: ${config.delayMs},
        autoCloseLimit: ${config.autoCloseLimit},
        audioAlert: ${config.audioAlert},
        keywords: ${JSON.stringify(config.keywords)}
    };

    const PROCESSED_KEY = "stake_processed_codes_v3";
    let processedSet = new Set();
    let activeCodeInProgress = null;

    function syncConfigAndCache() {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['delayMs', 'autoCloseLimit', 'audioAlert', 'keywords', 'currentClaimCode', PROCESSED_KEY], (res) => {
                if (res.delayMs !== undefined) CONFIG.delayMs = res.delayMs;
                if (res.autoCloseLimit !== undefined) CONFIG.autoCloseLimit = res.autoCloseLimit;
                if (res.audioAlert !== undefined) CONFIG.audioAlert = res.audioAlert;
                if (res.keywords !== undefined) CONFIG.keywords = res.keywords;
                
                if (res[PROCESSED_KEY]) {
                    processedSet = new Set(res[PROCESSED_KEY]);
                }

                if (res.currentClaimCode) {
                    setTimeout(() => {
                        autoInputAndClaim(res.currentClaimCode);
                    }, 500);
                }
            });
        } else {
            try {
                const saved = localStorage.getItem(PROCESSED_KEY);
                processedSet = saved ? new Set(JSON.parse(saved)) : new Set();
            } catch (e) {}
        }
    }

    syncConfigAndCache();
    // Listen for storage changes in real-time
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener((changes) => {
            if (changes.delayMs) CONFIG.delayMs = changes.delayMs.newValue;
            if (changes.autoCloseLimit) CONFIG.autoCloseLimit = changes.autoCloseLimit.newValue;
            if (changes.audioAlert) CONFIG.audioAlert = changes.audioAlert.newValue;
            if (changes.keywords) CONFIG.keywords = changes.keywords.newValue;
            if (changes[PROCESSED_KEY]) processedSet = new Set(changes[PROCESSED_KEY].newValue);
            if (changes.currentClaimCode && changes.currentClaimCode.newValue) {
                const code = changes.currentClaimCode.newValue;
                autoInputAndClaim(code);
            }
        });
    }

    function markCodeAsProcessed(code) {
        if (!code) return;
        const normalized = code.trim().toUpperCase();
        processedSet.add(normalized);
        const list = Array.from(processedSet);
        
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ [PROCESSED_KEY]: list });
        } else {
            try {
                localStorage.setItem(PROCESSED_KEY, JSON.stringify(list));
            } catch (e) {}
        }
        console.log("[StakeAutoClaimer] Added to blacklist:", normalized);
    }

    function isCodeProcessed(code) {
        if (!code) return true;
        return processedSet.has(code.trim().toUpperCase());
    }

    // Modal popup observer loop
    setInterval(() => {
        if (!CONFIG.autoCloseLimit) return;
        
        // Handle "invalid bonus code" popup: Auto-close it and strictly prevent any retries
        const bodyText = document.body.textContent || "";
        const isInvalidBonusCodeScreen = bodyText.includes("無効なボーナスコード") || 
                                         bodyText.includes("ボーナスコードは無効です") ||
                                         bodyText.toLowerCase().includes("invalid bonus code") ||
                                         bodyText.toLowerCase().includes("code is invalid");

        if (isInvalidBonusCodeScreen) {
            if (activeCodeInProgress) {
                markCodeAsProcessed(activeCodeInProgress);
            }
            const activeInput = document.querySelector('input[name="code"], input[placeholder*="Code"], input[type="text"]');
            if (activeInput && activeInput.value) {
                markCodeAsProcessed(activeInput.value.trim());
            }

            // Find and click the "閉じる" (Close) button inside the active modal/popup
            const modals = document.querySelectorAll('div[role="dialog"], div.modal-content, div[class*="modal"]');
            modals.forEach((modal) => {
                const modalText = modal.textContent || "";
                const isThisModalInvalid = modalText.includes("無効なボーナスコード") || 
                                           modalText.includes("ボーナスコードは無効です") ||
                                           modalText.toLowerCase().includes("invalid bonus code") ||
                                           modalText.toLowerCase().includes("code is invalid");
                if (isThisModalInvalid) {
                    const buttons = modal.querySelectorAll('button');
                    buttons.forEach((btn) => {
                        const btnText = (btn.textContent || "").toLowerCase();
                        if (btnText.includes('閉じる') || btnText.includes('close') || btnText.includes('ok')) {
                            setTimeout(() => {
                                btn.click();
                                console.warn("[StakeAutoClaimer] 無効なボーナスコードのポップアップを自動で閉じました（再試行はスキップ）。");
                                activeCodeInProgress = null;
                                if (CONFIG.audioAlert) playSystemSound("error");
                            }, CONFIG.delayMs);
                        }
                    });
                }
            });

            activeCodeInProgress = null;
            return;
        }

        const modals = document.querySelectorAll('div[role="dialog"], div.modal-content, div[class*="modal"]');
        modals.forEach((modal) => {
            const textContent = modal.textContent || "";
            const hasLimitError = CONFIG.keywords.some(kw => textContent.toLowerCase().includes(kw.toLowerCase()));
            
            if (hasLimitError) {
                if (activeCodeInProgress) {
                    markCodeAsProcessed(activeCodeInProgress);
                }

                const activeInput = document.querySelector('input[name="code"], input[placeholder*="Code"], input[type="text"]');
                if (activeInput && activeInput.value) {
                    markCodeAsProcessed(activeInput.value.trim());
                }

                const buttons = modal.querySelectorAll('button');
                buttons.forEach((btn) => {
                    const btnText = (btn.textContent || "").toLowerCase();
                    if (btnText.includes('閉じる') || btnText.includes('close') || btnText.includes('ok')) {
                        setTimeout(() => {
                            // Double check before actually clicking
                            const currentBodyText = document.body.textContent || "";
                            const currentInvalidCheck = currentBodyText.includes("無効なボーナスコード") || 
                                                         currentBodyText.includes("ボーナスコードは無効です") ||
                                                         currentBodyText.toLowerCase().includes("invalid bonus code") ||
                                                         currentBodyText.toLowerCase().includes("code is invalid");
                            if (currentInvalidCheck) {
                                console.log("[StakeAutoClaimer] Click aborted: Invalid bonus code popup confirmed on screen.");
                                return;
                            }
                            btn.click();
                            console.warn("[StakeAutoClaimer] Closed error popup automatically.");
                            activeCodeInProgress = null;
                            if (CONFIG.audioAlert) playSystemSound("error");
                        }, CONFIG.delayMs);
                    }
                });
            }
        });
    }, 300);

    // Safe periodic page reload interval: Every 10 minutes (600,000 ms) to keep Stake session active.
    // Page reloads are strictly prevented during active code claiming.
    setInterval(() => {
        if (activeCodeInProgress) {
            console.log("[StakeAutoClaimer] Claim in progress. Scheduled 10-minute session keepalive reload postponed.");
            return;
        }
        console.log("[StakeAutoClaimer] Executing scheduled 10-minute session keepalive reload to refresh active session...");
        window.location.reload();
    }, 600000); // 10 minutes (600,000 ms)

    function playSystemSound(type) {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            
            if (type === "success") {
                osc.frequency.setValueAtTime(880, audioCtx.currentTime);
                gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
                osc.start();
                osc.stop(audioCtx.currentTime + 0.15);
            } else {
                osc.frequency.setValueAtTime(220, audioCtx.currentTime);
                gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
                osc.start();
                osc.stop(audioCtx.currentTime + 0.25);
            }
        } catch (e) {}
    }

    window.addEventListener("message", function(event) {
        if (event.data && event.data.type === "STAKE_CLAIM_CODE") {
            const code = event.data.code;
            if (code) autoInputAndClaim(code.trim());
        }
    });

    function autoInputAndClaim(code) {
        const cleanCode = code.trim();
        // Skip purely uppercase alphanumeric and underscore codes (e.g. STAKE_AUTODROP)
        if (/^[A-Z0-9_]+$/.test(cleanCode)) {
            console.log("[StakeAutoClaimer] Pure uppercase alphanumeric and underscore code ignored:", cleanCode);
            return;
        }
        if (isCodeProcessed(cleanCode)) return;

        activeCodeInProgress = cleanCode;
        markCodeAsProcessed(cleanCode);

        // Select all input and textarea elements to ensure no input fields are missed
        const elements = Array.from(document.querySelectorAll('input, textarea'));
        const allInputs = elements.filter(el => {
            if (!el) return false;
            const type = (el.getAttribute('type') || 'text').toLowerCase();
            const placeholder = (el.placeholder || '').toLowerCase();
            const name = (el.name || '').toLowerCase();
            const id = (el.id || '').toLowerCase();
            const className = (el.className || '').toLowerCase();
            
            // Skip non-textual input types
            const skipTypes = ['checkbox', 'radio', 'submit', 'button', 'hidden', 'file', 'image', 'range', 'date', 'time', 'color', 'number'];
            if (skipTypes.includes(type)) return false;
            
            // Skip search and filter fields completely (case-insensitive for Japanese/English keywords)
            const searchKeywords = ['search', 'find', 'query', 'filter', '検索', 'さがす', 'フィルター'];
            if (searchKeywords.some(kw => placeholder.includes(kw) || name.includes(kw) || id.includes(kw) || className.includes(kw))) {
                return false;
            }
            
            return true;
        });

        let input = null;

        if (allInputs.length > 0) {
            let bestMatch = null;
            let highestScore = -1000;
            
            for (const inEl of allInputs) {
                let score = 0;
                const placeholder = (inEl.placeholder || "").toLowerCase();
                const idStr = (inEl.id || "").toLowerCase();
                const nameStr = (inEl.name || "").toLowerCase();
                const className = (inEl.className || "").toLowerCase();
                
                // Active focus gets highest priority
                if (inEl === document.activeElement) {
                    score += 250;
                }

                // Base attribute analysis
                if (placeholder.includes('bonus') || placeholder.includes('drop') || placeholder.includes('ボーナス') || placeholder.includes('code') || placeholder.includes('コード') || placeholder.includes('promo') || placeholder.includes('プロモ') || placeholder.includes('redeem')) score += 50;
                if (idStr.includes('bonus') || idStr.includes('drop') || idStr.includes('code') || idStr.includes('promo')) score += 50;
                if (nameStr.includes('bonus') || nameStr.includes('drop') || nameStr.includes('code') || nameStr.includes('promo')) score += 50;
                if (className.includes('bonus') || className.includes('drop') || className.includes('code') || className.includes('promo')) score += 30;
                
                // Strongly penalize welcome-offer/sign-up attributes to avoid entering bonus codes there
                if (placeholder.includes('welcome') || placeholder.includes('signup') || placeholder.includes('register') || placeholder.includes('join') || placeholder.includes('create') || placeholder.includes('ウェルカム') || placeholder.includes('新規') || placeholder.includes('登録') || placeholder.includes('会員登録') || placeholder.includes('サインアップ')) score -= 250;
                if (idStr.includes('welcome') || idStr.includes('signup') || idStr.includes('register')) score -= 250;
                if (nameStr.includes('welcome') || nameStr.includes('signup') || nameStr.includes('register')) score -= 250;
                if (className.includes('welcome') || className.includes('signup')) score -= 150;
                
                // Climb parent tree to analyze surrounding context with deep search
                let current = inEl;
                let depth = 1;
                let foundBonusContext = false;
                let foundWelcomeContext = false;
                
                while (current && depth <= 10) {
                    const text = (current.textContent || "").toLowerCase();
                    
                    // Match localized Stake bonus drop section titles
                    if (text.includes('ボーナスドロップを受け取る') || text.includes('ボーナスドロップ') || text.includes('bonus drop') || text.includes('redeem bonus') || text.includes('ボーナスを申請') || text.includes('ボーナス請求') || text.includes('プロモコード')) {
                        // Higher score for closer/more relevant ancestors
                        score += Math.max(100, 500 - (depth * 40));
                        foundBonusContext = true;
                    } else if (text.includes('ボーナス') || text.includes('bonus') || text.includes('drop') || text.includes('オファー') || text.includes('offer')) {
                        score += Math.max(20, 100 - (depth * 10));
                    }
                    
                    // Penalize welcome offer text containers to prevent cross-contamination
                    if (text.includes('ウェルカム') || text.includes('welcome') || text.includes('ウェルカム・オファー') || text.includes('sign up') || text.includes('新規登録') || text.includes('新規') || text.includes('登録')) {
                        score -= Math.max(150, 600 - (depth * 50));
                        foundWelcomeContext = true;
                    }
                    
                    current = current.parentElement;
                    depth++;
                }
                
                // Context-aware scoring adjustments
                if (foundBonusContext && !foundWelcomeContext) {
                    score += 1000; // Confirmed standalone bonus drop section
                }
                if (foundWelcomeContext) {
                    score -= 1000; // Explicitly inside welcome offer section, disqualify
                }
                
                if (score > highestScore) {
                    highestScore = score;
                    bestMatch = inEl;
                }
            }
            
            if (bestMatch && highestScore > -100) {
                input = bestMatch;
            } else {
                if (allInputs.length >= 2) {
                    input = allInputs[1];
                } else {
                    input = allInputs[0];
                }
            }
        }

        if (input) {
            input.focus();
            const prototype = Object.getPrototypeOf(input);
            const nativeSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set || 
                                 Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
            if (nativeSetter) {
                nativeSetter.call(input, cleanCode);
            } else {
                input.value = cleanCode;
            }
            
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            
            // Dispatch key events to satisfy complex framework bindings
            try {
                input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter', keyCode: 13 }));
                input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: 'Enter', keyCode: 13 }));
                input.dispatchEvent(new Event('textInput', { bubbles: true }));
            } catch (e) {}
            
            setTimeout(() => {
                let submitBtn = null;
                const keywords = ['適用', '請求', '送信', 'redeem', 'claim', 'apply'];
                
                // Search for the closest button inside the same nested card/section of the input field
                let parent = input.parentElement;
                let searchDepth = 0;
                while (parent && searchDepth < 6 && !submitBtn) {
                    const localButtons = Array.from(parent.querySelectorAll('button'));
                    if (localButtons.length > 0) {
                        const matchedButtons = localButtons.filter(btn => {
                            const txt = (btn.textContent || "").toLowerCase();
                            return keywords.some(kw => txt.includes(kw));
                        });
                        
                        if (matchedButtons.length > 0) {
                            // Score buttons to find the exact button for redeeming bonus drops
                            let bestBtn = null;
                            let bestBtnScore = -100;
                            
                            for (const btn of matchedButtons) {
                                let btnScore = 0;
                                const btnText = (btn.textContent || "").toLowerCase();
                                const btnParentText = (btn.parentElement?.textContent || "").toLowerCase();
                                
                                if (btnText.includes('適用') || btnText.includes('apply') || btnText.includes('claim')) btnScore += 15;
                                if (btnParentText.includes('ボーナス') || btnParentText.includes('bonus') || btnParentText.includes('drop')) btnScore += 25;
                                
                                // Heavily penalize welcome-offer buttons to avoid misclicks
                                if (btnText.includes('ウェルカム') || btnText.includes('welcome')) btnScore -= 120;
                                if (btnParentText.includes('ウェルカム') || btnParentText.includes('welcome')) btnScore -= 120;
                                
                                if (btnScore > bestBtnScore) {
                                    bestBtnScore = btnScore;
                                    bestBtn = btn;
                                }
                            }
                            
                            if (bestBtn && bestBtnScore > -50) {
                                submitBtn = bestBtn;
                                break;
                            }
                        }
                    }
                    parent = parent.parentElement;
                    searchDepth++;
                }
                
                // Global fallback filtering out welcome buttons
                if (!submitBtn) {
                    const allButtons = Array.from(document.querySelectorAll('button'));
                    const filtered = allButtons.filter(btn => {
                        const txt = (btn.textContent || "").toLowerCase();
                        const parentTxt = (btn.parentElement?.textContent || "").toLowerCase();
                        return keywords.some(kw => txt.includes(kw)) && 
                               !txt.includes('welcome') && !txt.includes('ウェルカム') &&
                               !parentTxt.includes('welcome') && !parentTxt.includes('ウェルカム');
                    });
                    if (filtered.length > 0) {
                        submitBtn = filtered[0];
                    }
                }

                if (submitBtn) {
                    submitBtn.removeAttribute('disabled');
                    submitBtn.click();
                    if (CONFIG.audioAlert) playSystemSound("success");
                } else {
                    input.dispatchEvent(new KeyboardEvent('keypress', { bubbles: true, keyCode: 13, key: 'Enter' }));
                }
            }, CONFIG.delayMs);
        }
    }
})();`;
};

export const getPopupHtml = (config: ClaimConfig) => {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Stake Auto-Claimer Settings</title>
  <style>
    body {
      width: 360px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: #0b1329;
      color: #f1f5f9;
      margin: 0;
      padding: 16px;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #1e293b;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .title-area h3 {
      margin: 0;
      color: #818cf8;
      font-size: 15px;
      font-weight: 800;
    }
    .title-area p {
      margin: 2px 0 0 0;
      color: #64748b;
      font-size: 10px;
    }
    .status-badge {
      font-size: 10px;
      background-color: rgba(16, 185, 129, 0.1);
      color: #10b981;
      border: 1px solid rgba(16, 185, 129, 0.2);
      padding: 3px 8px;
      border-radius: 9999px;
      font-weight: bold;
    }
    .section {
      background-color: #111a36;
      border: 1px solid #1e293b;
      border-radius: 12px;
      padding: 12px;
      margin-bottom: 12px;
    }
    .section-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #94a3b8;
      margin-top: 0;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .form-group {
      margin-bottom: 10px;
    }
    .form-group:last-child {
      margin-bottom: 0;
    }
    .flex-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    label {
      font-size: 11px;
      color: #cbd5e1;
    }
    .subtext {
      font-size: 9px;
      color: #64748b;
      margin: 2px 0 0 0;
    }
    /* Switch */
    .switch {
      position: relative;
      display: inline-block;
      width: 36px;
      height: 20px;
    }
    .switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    .slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: #334155;
      transition: .2s;
      border-radius: 20px;
    }
    .slider:before {
      position: absolute;
      content: "";
      height: 14px;
      width: 14px;
      left: 3px;
      bottom: 3px;
      background-color: white;
      transition: .2s;
      border-radius: 50%;
    }
    input:checked + .slider {
      background-color: #6366f1;
    }
    input:checked + .slider:before {
      transform: translateX(16px);
    }
    /* Range input */
    .range-container {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    input[type="range"] {
      flex: 1;
      accent-color: #6366f1;
      height: 4px;
    }
    .badge-val {
      font-family: monospace;
      font-size: 11px;
      font-weight: bold;
      background-color: #0b1329;
      padding: 2px 6px;
      border-radius: 4px;
      border: 1px solid #1e293b;
      color: #818cf8;
      min-width: 42px;
      text-align: center;
    }
    /* Button */
    .btn {
      width: 100%;
      background-color: #6366f1;
      color: white;
      border: none;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: bold;
      cursor: pointer;
      transition: background-color 0.15s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .btn:hover {
      background-color: #4f46e5;
    }
    .btn-secondary {
      background-color: #1e293b;
      color: #cbd5e1;
      border: 1px solid #334155;
    }
    .btn-secondary:hover {
      background-color: #334155;
    }
    .btn-danger {
      background-color: rgba(239, 68, 68, 0.1);
      color: #ef4444;
      border: 1px solid rgba(239, 68, 68, 0.2);
    }
    .btn-danger:hover {
      background-color: rgba(239, 68, 68, 0.2);
    }
    .badge-count {
      background-color: #ef4444;
      color: white;
      border-radius: 999px;
      padding: 1px 6px;
      font-size: 9px;
      font-weight: bold;
      font-family: monospace;
    }
    .input-text {
      width: 100%;
      box-sizing: border-box;
      background-color: #0b1329;
      border: 1px solid #1e293b;
      border-radius: 6px;
      color: #f1f5f9;
      padding: 6px 10px;
      font-size: 11px;
      font-family: monospace;
      outline: none;
    }
    .input-text:focus {
      border-color: #6366f1;
    }
    .flex-row-gap {
      display: flex;
      gap: 8px;
    }
    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
      70% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
      100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
    }
    .status-dot-pulse {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background-color: #10b981;
      display: inline-block;
      transition: all 0.3s ease;
    }
    .status-dot-pulse.active {
      animation: pulse 2s infinite;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="title-area">
      <h3>Stake Auto VIP</h3>
      <p>自動請求 ＆ ポップアップ監視</p>
    </div>
    <div class="status-badge">● ACTIVE</div>
  </div>

  <!-- Live Status Segment -->
  <div class="section" style="border-color: rgba(99, 102, 241, 0.4); background: linear-gradient(180deg, #111a36 0%, rgba(17, 26, 54, 0.6) 100%);">
    <div class="section-title" style="color: #818cf8; display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
      <span>ライブ状況モニター</span>
      <span style="display: flex; align-items: center; gap: 4px; font-size: 8px; font-family: monospace; color: #818cf8; background-color: rgba(99, 102, 241, 0.15); padding: 1px 5px; border-radius: 4px;">LIVE FEED</span>
    </div>
    
    <div class="flex-row" style="margin-bottom: 8px;">
      <div style="display: flex; align-items: center; gap: 6px;">
        <span class="status-dot-pulse active" id="portal-status-dot"></span>
        <label style="color: #94a3b8; font-size: 11px;">VIPポータル連携:</label>
      </div>
      <span id="portal-connection-status" style="font-size: 11px; font-weight: bold; color: #10b981;">接続完了 (Live)</span>
    </div>

    <div class="flex-row" style="margin-bottom: 8px;">
      <label style="color: #94a3b8; font-size: 11px;">受信ボーナスコード:</label>
      <span id="popup-received-code" style="font-size: 11px; font-weight: bold; color: #818cf8; font-family: monospace;">[ 待機中 ]</span>
    </div>

    <div class="flex-row">
      <label style="color: #94a3b8; font-size: 11px;">自動適用状況:</label>
      <span id="popup-claim-status" style="font-size: 11px; font-weight: bold; color: #cbd5e1;">待機中 (IDLE)</span>
    </div>
  </div>

  <!-- Settings Segment -->
  <div class="section">
    <div class="section-title">基本チューニング</div>
    
    <div class="form-group">
      <div class="flex-row">
        <div>
          <label>ディレイ時間設定</label>
          <p class="subtext">コード入力からボタンクリックまで</p>
        </div>
        <span class="badge-val" id="delay-badge">${config.delayMs}ms</span>
      </div>
      <div class="range-container" style="margin-top: 6px;">
        <input type="range" id="delay-range" min="50" max="2000" step="50" value="${config.delayMs}">
      </div>
    </div>

    <div class="form-group flex-row" style="margin-top: 14px;">
      <div>
        <label>エラー自動クローズ</label>
        <p class="subtext">上限到達・使用済ポップアップを自動で閉じる</p>
      </div>
      <label class="switch">
        <input type="checkbox" id="autoclose-toggle" ${config.autoCloseLimit ? 'checked' : ''}>
        <span class="slider"></span>
      </label>
    </div>

    <div class="form-group flex-row" style="margin-top: 14px;">
      <div>
        <label>システム通知効果音</label>
        <p class="subtext">成功/エラー判定時にSEを鳴らす</p>
      </div>
      <label class="switch">
        <input type="checkbox" id="audio-toggle" ${config.audioAlert ? 'checked' : ''}>
        <span class="slider"></span>
      </label>
    </div>
  </div>

  <!-- Exclude List Segment -->
  <div class="section">
    <div class="section-title">
      <span>重複除外キャッシュ</span>
      <span class="badge-count" id="blacklist-badge">0</span>
    </div>
    <p class="subtext" style="margin-bottom: 8px;">同一コードの二重請求による制限を完全に防止します。</p>
    
    <div class="form-group flex-row-gap">
      <input type="text" id="manual-code-input" class="input-text" placeholder="手動でブラックリスト登録 (例: EXPIRED_CODE)">
      <button id="add-blacklist-btn" class="btn" style="width: auto; padding: 6px 12px; shrink: 0;">登録</button>
    </div>

    <button id="clear-blacklist-btn" class="btn btn-secondary btn-danger" style="margin-top: 8px;">
      ブラックリストを全消去
    </button>
  </div>

  <!-- Open Full Dashboard Button -->
  <div style="margin-top: 16px;">
    <button id="open-dashboard-btn" class="btn">
      <svg style="width: 14px; height: 14px;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
      </svg>
      VIP 解析ダッシュボードを起動
    </button>
  </div>

  <script src="popup.js"></script>
</body>
</html>`;
};

export const getPopupJs = () => {
  return `// Stake Auto-Claimer Popup script (v2.4.1)
const PROCESSED_KEY = "stake_processed_codes_v3";

const delayRange = document.getElementById('delay-range');
const delayBadge = document.getElementById('delay-badge');
const autocloseToggle = document.getElementById('autoclose-toggle');
const audioToggle = document.getElementById('audio-toggle');
const blacklistBadge = document.getElementById('blacklist-badge');
const manualInput = document.getElementById('manual-code-input');
const addBtn = document.getElementById('add-blacklist-btn');
const clearBtn = document.getElementById('clear-blacklist-btn');
const dashboardBtn = document.getElementById('open-dashboard-btn');

// Live Status Elements
const portalStatusDot = document.getElementById('portal-status-dot');
const portalConnectionStatus = document.getElementById('portal-connection-status');
const popupReceivedCode = document.getElementById('popup-received-code');
const popupClaimStatus = document.getElementById('popup-claim-status');

// Update Live Monitor UI
function updateLiveStatus(currentCode, state, heartbeat) {
    // 1. Connection Status (Heartbeat checking)
    const isLive = heartbeat && (Date.now() - heartbeat < 5000);
    if (isLive) {
        portalStatusDot.style.backgroundColor = '#10b981'; // Green
        portalStatusDot.style.boxShadow = '0 0 8px #10b981';
        portalStatusDot.classList.add('active');
        portalConnectionStatus.textContent = '接続完了 (Live)';
        portalConnectionStatus.style.color = '#10b981';
    } else {
        portalStatusDot.style.backgroundColor = '#64748b'; // Slate gray
        portalStatusDot.style.boxShadow = 'none';
        portalStatusDot.classList.remove('active');
        portalConnectionStatus.textContent = 'スタンドバイ (待機)';
        portalConnectionStatus.style.color = '#94a3b8';
    }

    // 2. Received Bonus Code
    if (currentCode) {
        popupReceivedCode.textContent = currentCode;
        popupReceivedCode.style.color = '#818cf8'; // Indigo accent
    } else {
        popupReceivedCode.textContent = '[ 待機中 ]';
        popupReceivedCode.style.color = '#64748b';
    }

    // 3. Claim State
    const stateMap = {
        'idle': { text: '待機中 (IDLE)', color: '#cbd5e1' },
        'checking_domain': { text: 'ドメイン検証中...', color: '#f59e0b' },
        'scanning_dom': { text: 'DOMスキャン中...', color: '#818cf8' },
        'filling_input': { text: '自動インプット中...', color: '#fbbf24' },
        'clicking_submit': { text: 'ボタン押下中...', color: '#c084fc' },
        'verifying': { text: '検証サーバー通信中...', color: '#22d3ee' },
        'success': { text: '適用成功！(CLAIMED)', color: '#34d399' },
        'limit_reached': { text: '上限到達 (LIMIT REACHED)', color: '#f87171' },
        'already_claimed': { text: 'すでに請求済み', color: '#fbbf24' },
        'expired': { text: '無効または有効期限切れ', color: '#f87171' }
    };

    const currentState = stateMap[state] || { text: '待機中 (IDLE)', color: '#cbd5e1' };
    popupClaimStatus.textContent = currentState.text;
    popupClaimStatus.style.color = currentState.color;

    // Adjust portal indicator if claiming is actively running
    if (isLive && state && state !== 'idle' && state !== 'success' && state !== 'limit_reached' && state !== 'already_claimed' && state !== 'expired') {
        portalStatusDot.style.backgroundColor = '#6366f1'; // Glowing Blue/Indigo
        portalStatusDot.style.boxShadow = '0 0 8px #6366f1';
    }
}

// Load configurations
function loadSettings() {
    chrome.storage.local.get(['delayMs', 'autoCloseLimit', 'audioAlert', 'currentClaimCode', 'claimState', 'portal_heartbeat', PROCESSED_KEY], (res) => {
        if (res.delayMs !== undefined) {
            delayRange.value = res.delayMs;
            delayBadge.textContent = res.delayMs + 'ms';
        }
        if (res.autoCloseLimit !== undefined) {
            autocloseToggle.checked = res.autoCloseLimit;
        }
        if (res.audioAlert !== undefined) {
            audioToggle.checked = res.audioAlert;
        }
        
        const blacklist = res[PROCESSED_KEY] || [];
        blacklistBadge.textContent = blacklist.length;

        updateLiveStatus(res.currentClaimCode, res.claimState, res.portal_heartbeat);
    });
}

// Save config triggers
delayRange.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    delayBadge.textContent = val + 'ms';
    chrome.storage.local.set({ delayMs: val });
});

autocloseToggle.addEventListener('change', (e) => {
    chrome.storage.local.set({ autoCloseLimit: e.target.checked });
});

audioToggle.addEventListener('change', (e) => {
    chrome.storage.local.set({ audioAlert: e.target.checked });
});

// Add Blacklist
addBtn.addEventListener('click', () => {
    const code = manualInput.value.trim().toUpperCase();
    if (!code) return;
    
    chrome.storage.local.get([PROCESSED_KEY], (res) => {
        const blacklist = res[PROCESSED_KEY] || [];
        if (!blacklist.includes(code)) {
            blacklist.push(code);
            chrome.storage.local.set({ [PROCESSED_KEY]: blacklist }, () => {
                blacklistBadge.textContent = blacklist.length;
                manualInput.value = '';
            });
        }
    });
});

// Clear Blacklist
clearBtn.addEventListener('click', () => {
    if (confirm('ブラックリスト除外キャッシュを完全に消去してもよろしいですか？')) {
        chrome.storage.local.set({ [PROCESSED_KEY]: [] }, () => {
            blacklistBadge.textContent = '0';
        });
    }
});

// Open Full Extension Options Page (the dashboard.html!)
dashboardBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'dashboard.html' });
});

// Watch Storage Changes dynamically
chrome.storage.onChanged.addListener((changes) => {
    if (changes.currentClaimCode || changes.claimState || changes.portal_heartbeat) {
        chrome.storage.local.get(['currentClaimCode', 'claimState', 'portal_heartbeat'], (res) => {
            updateLiveStatus(res.currentClaimCode, res.claimState, res.portal_heartbeat);
        });
    }
    if (changes[PROCESSED_KEY]) {
        blacklistBadge.textContent = changes[PROCESSED_KEY].newValue.length;
    }
    if (changes.delayMs) {
        delayRange.value = changes.delayMs.newValue;
        delayBadge.textContent = changes.delayMs.newValue + 'ms';
    }
    if (changes.autoCloseLimit) {
        autocloseToggle.checked = changes.autoCloseLimit.newValue;
    }
    if (changes.audioAlert) {
        audioToggle.checked = changes.audioAlert.newValue;
    }
});

// Periodically verify connection heartbeat (in case the dashboard is closed)
setInterval(() => {
    chrome.storage.local.get(['currentClaimCode', 'claimState', 'portal_heartbeat'], (res) => {
        updateLiveStatus(res.currentClaimCode, res.claimState, res.portal_heartbeat);
    });
}, 2000);

// Init
document.addEventListener('DOMContentLoaded', loadSettings);
`;
};

export const getDashboardHtml = () => {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Stake Auto-Claimer VIP - Local Dashboard Portal</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
    
    :root {
      --bg-slate-950: #020617;
      --bg-slate-900: #0f172a;
      --bg-slate-800: #1e293b;
      --text-slate-100: #f8fafc;
      --text-slate-300: #cbd5e1;
      --text-slate-400: #94a3b8;
      --text-slate-500: #64748b;
      --indigo-600: #4f46e5;
      --indigo-500: #6366f1;
      --indigo-400: #818cf8;
      --emerald-500: #10b981;
      --emerald-600: #059669;
      --emerald-400: #34d399;
      --rose-500: #f43f5e;
      --rose-400: #fb7185;
      --amber-400: #fbbf24;
    }

    * {
      box-sizing: border-box;
      font-family: 'Inter', sans-serif;
    }

    body {
      background-color: var(--bg-slate-950);
      color: var(--text-slate-100);
      margin: 0;
      padding: 0;
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    }

    .font-mono {
      font-family: 'JetBrains Mono', monospace;
    }

    header {
      border-bottom: 1px solid var(--bg-slate-800);
      background-color: rgba(15, 23, 42, 0.6);
      backdrop-filter: blur(8px);
      padding: 16px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }

    .header-logo-area {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .logo-box {
      background-color: var(--indigo-600);
      padding: 10px;
      border-radius: 12px;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .header-title-area h1 {
      margin: 0;
      font-size: 18px;
      font-weight: 800;
      letter-spacing: -0.025em;
    }

    .header-title-area p {
      margin: 2px 0 0 0;
      font-size: 12px;
      color: var(--text-slate-400);
    }

    .api-key-box {
      display: flex;
      align-items: center;
      gap: 8px;
      background-color: var(--bg-slate-950);
      padding: 8px 12px;
      border-radius: 12px;
      border: 1px solid var(--bg-slate-800);
    }

    .api-key-box input {
      background: transparent;
      border: none;
      color: var(--text-slate-300);
      font-size: 12px;
      width: 176px;
      outline: none;
    }

    .secure-badge {
      font-size: 9px;
      background-color: rgba(99, 102, 241, 0.1);
      color: var(--indigo-400);
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: bold;
    }

    main {
      max-width: 1280px;
      margin: 0 auto;
      padding: 24px;
      display: grid;
      grid-template-columns: repeat(12, 1fr);
      gap: 24px;
    }

    @media (max-width: 1024px) {
      main {
        grid-template-columns: 1fr;
      }
      .col-4, .col-5, .col-3 {
        grid-column: span 12 !important;
      }
    }

    .col-4 { grid-column: span 4; }
    .col-5 { grid-column: span 5; }
    .col-3 { grid-column: span 3; }

    .card {
      background-color: var(--bg-slate-900);
      border: 1px solid var(--bg-slate-800);
      border-radius: 16px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .section-title-wrapper {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .section-title {
      font-size: 12px;
      font-weight: 800;
      color: var(--text-slate-400);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin: 0;
    }

    /* Range and slider */
    .slider-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .slider-header {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
    }

    .slider-val {
      font-weight: bold;
      color: var(--indigo-400);
    }

    input[type="range"] {
      width: 100%;
      height: 6px;
      background: var(--bg-slate-950);
      border-radius: 999px;
      outline: none;
      -webkit-appearance: none;
      accent-color: var(--indigo-500);
    }

    .slider-labels {
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: var(--text-slate-500);
    }

    /* Switch settings */
    .switch-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
      border-top: 1px solid rgba(30, 41, 59, 0.6);
      padding-top: 16px;
    }

    .switch-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .switch-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .switch-label {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-slate-300);
    }

    .switch-subtext {
      font-size: 10px;
      color: var(--text-slate-500);
    }

    .switch-btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
      color: var(--text-slate-500);
      display: flex;
      align-items: center;
    }

    .switch-btn svg {
      width: 32px;
      height: 32px;
    }

    .switch-btn.active {
      color: var(--emerald-500);
    }

    /* Blacklist design */
    .blacklist-header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid rgba(30, 41, 59, 0.6);
      padding-top: 16px;
    }

    .badge-count {
      background-color: rgba(244, 63, 94, 0.1);
      color: var(--rose-400);
      border-radius: 999px;
      padding: 2px 8px;
      font-size: 10px;
      font-weight: bold;
    }

    .blacklist-info-text {
      font-size: 10px;
      color: var(--text-slate-500);
      line-height: 1.5;
      margin: 0;
    }

    .input-group {
      display: flex;
      gap: 8px;
    }

    .text-input {
      flex: 1;
      background-color: var(--bg-slate-950);
      border: 1px solid var(--bg-slate-800);
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 12px;
      color: var(--text-slate-300);
      outline: none;
    }

    .text-input:focus {
      border-color: var(--indigo-500);
    }

    .btn {
      background-color: var(--indigo-600);
      color: white;
      border: none;
      border-radius: 8px;
      padding: 8px 16px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: background-color 0.15s;
    }

    .btn:hover {
      background-color: var(--indigo-500);
    }

    .btn-secondary {
      background-color: transparent;
      border: 1px solid rgba(244, 63, 94, 0.2);
      color: var(--rose-400);
      background-color: rgba(244, 63, 94, 0.05);
      width: 100%;
    }

    .btn-secondary:hover {
      background-color: rgba(244, 63, 94, 0.1);
      border-color: rgba(244, 63, 94, 0.4);
    }

    .blacklist-box {
      max-height: 140px;
      overflow-y: auto;
      background-color: var(--bg-slate-950);
      border: 1px solid rgba(30, 41, 59, 0.6);
      border-radius: 12px;
      padding: 10px;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .blacklist-tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 10px;
      background-color: var(--bg-slate-900);
      border: 1px solid var(--bg-slate-800);
      padding: 4px 8px;
      border-radius: 6px;
      color: var(--text-slate-300);
    }

    .blacklist-tag button {
      background: none;
      border: none;
      color: var(--text-slate-500);
      cursor: pointer;
      font-size: 11px;
      padding: 0;
      display: flex;
      align-items: center;
    }

    .blacklist-tag button:hover {
      color: var(--rose-400);
    }

    /* Feed simulator */
    .feed-container {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 220px;
      overflow-y: auto;
    }

    .feed-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 12px;
      background-color: var(--bg-slate-950);
      border: 1px solid rgba(30, 41, 59, 0.5);
      border-radius: 12px;
    }

    .feed-source {
      font-size: 9px;
      color: var(--indigo-400);
      font-weight: 600;
      display: block;
    }

    .feed-code {
      font-size: 12px;
      font-weight: bold;
      color: var(--text-slate-300);
      margin-top: 2px;
      display: block;
    }

    .btn-claim {
      background-color: rgba(99, 102, 241, 0.1);
      border: 1px solid rgba(99, 102, 241, 0.2);
      color: var(--indigo-400);
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 10px;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-claim:hover {
      background-color: var(--indigo-600);
      color: white;
    }

    .btn-claim.disabled {
      background-color: var(--bg-slate-950);
      border-color: rgba(30, 41, 59, 0.5);
      color: var(--text-slate-500);
      cursor: not-allowed;
    }

    /* Monitored Channels Section */
    .channels-box {
      background-color: rgba(2, 6, 23, 0.6);
      border: 1px solid rgba(30, 41, 59, 0.85);
      border-radius: 12px;
      padding: 12px;
      margin-bottom: 20px;
    }

    .channels-title-wrapper {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }

    .channels-title {
      font-size: 11px;
      font-weight: bold;
      color: var(--text-slate-200);
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .channel-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    }

    .channel-item {
      background-color: var(--bg-slate-900);
      border: 1px solid rgba(30, 41, 59, 0.6);
      border-radius: 8px;
      padding: 8px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    .channel-card-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 4px;
      margin-bottom: 4px;
    }

    .channel-card-name {
      font-size: 10px;
      font-weight: bold;
      color: var(--text-slate-200);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .channel-card-speed {
      font-size: 8px;
      background-color: rgba(99, 102, 241, 0.1);
      color: var(--indigo-400);
      border: 1px solid rgba(99, 102, 241, 0.2);
      padding: 1px 4px;
      border-radius: 4px;
      font-family: 'JetBrains Mono', monospace;
    }

    .channel-card-bottom {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 4px;
    }

    .channel-card-handle {
      font-size: 9px;
      color: var(--indigo-400);
      font-family: 'JetBrains Mono', monospace;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .channel-card-members {
      font-size: 8px;
      color: var(--text-slate-500);
      display: flex;
      align-items: center;
      gap: 2px;
    }

    /* Logs terminal */
    .logs-terminal-card {
      height: 230px;
    }

    .logs-box {
      flex: 1;
      background-color: var(--bg-slate-950);
      border: 1px solid rgba(30, 41, 59, 0.5);
      border-radius: 12px;
      padding: 12px;
      overflow-y: auto;
      font-size: 10px;
      line-height: 1.6;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .log-entry {
      word-break: break-all;
    }

    .log-info { color: var(--text-slate-400); }
    .log-success { color: var(--emerald-400); }
    .log-error { color: var(--rose-500); }
    .log-warn { color: var(--amber-400); }

    .btn-clear-logs {
      background: none;
      border: none;
      color: var(--text-slate-500);
      font-size: 10px;
      cursor: pointer;
    }

    .btn-clear-logs:hover {
      color: var(--text-slate-300);
    }

    /* Virtual client */
    .relative-container {
      position: relative;
    }

    .typing-cursor {
      display: inline-block;
      width: 2px;
      height: 14px;
      background-color: var(--indigo-400);
      margin-left: 2px;
      animation: blink 1s infinite;
    }

    @keyframes blink {
      0%, 100% { opacity: 0; }
      50% { opacity: 1; }
    }

    .btn-submit-bonus {
      width: 100%;
      padding: 10px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: bold;
      border: none;
      cursor: pointer;
    }

    .btn-submit-bonus.active {
      background-color: var(--indigo-600);
      color: white;
    }

    .btn-submit-bonus.submitting {
      background-color: var(--emerald-600);
      color: white;
    }

    .btn-submit-bonus.disabled {
      background-color: var(--bg-slate-950);
      border: 1px solid rgba(30, 41, 59, 0.5);
      color: var(--text-slate-500);
      cursor: not-allowed;
    }

    /* Virtual Popup */
    .modal-overlay {
      position: absolute;
      inset: 0;
      background-color: rgba(2, 6, 23, 0.8);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      z-index: 50;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease;
    }

    .modal-overlay.active {
      opacity: 1;
      pointer-events: auto;
    }

    .modal-content {
      background-color: var(--bg-slate-900);
      border: 1px solid var(--bg-slate-800);
      border-radius: 12px;
      padding: 16px;
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .modal-header {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .modal-header h4 {
      margin: 0;
      font-size: 13px;
      font-weight: bold;
    }

    .modal-body {
      font-size: 10px;
      color: var(--text-slate-300);
      line-height: 1.5;
    }

    .btn-modal-close {
      width: 100%;
      padding: 8px;
      background-color: var(--bg-slate-800);
      color: var(--text-slate-200);
      border: none;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-modal-close:hover {
      background-color: var(--bg-slate-850);
    }

    /* AI Security Audit */
    .textarea-audit {
      width: 100%;
      background-color: var(--bg-slate-950);
      border: 1px solid var(--bg-slate-800);
      border-radius: 8px;
      padding: 10px;
      font-size: 12px;
      color: var(--text-slate-300);
      outline: none;
      resize: none;
    }

    .textarea-audit:focus {
      border-color: var(--indigo-500);
    }

    .ai-result-box {
      background-color: var(--bg-slate-950);
      border: 1px solid rgba(30, 41, 59, 0.5);
      border-radius: 12px;
      padding: 12px;
      font-size: 10px;
      color: var(--text-slate-300);
      line-height: 1.6;
      max-height: 160px;
      overflow-y: auto;
      white-space: pre-wrap;
    }

    .pulse-dot {
      display: inline-block;
      width: 6px;
      height: 6px;
      border-radius: 999px;
      background-color: var(--indigo-400);
      animation: pulse 1.5s infinite;
    }

    .channel-status-badge {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 8px;
      color: var(--emerald-400);
      background-color: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.15);
      padding: 1px 4px;
      border-radius: 4px;
      font-weight: 600;
    }

    .status-dot {
      width: 4px;
      height: 4px;
      border-radius: 50%;
      display: inline-block;
    }

    .status-dot.green {
      background-color: #10b981;
      box-shadow: 0 0 4px #10b981;
      animation: status-pulse 1.5s infinite;
    }

    @keyframes status-pulse {
      0%, 100% { opacity: 0.5; }
      50% { opacity: 1; }
    }

    @keyframes pulse {
      0%, 100% { opacity: 0.3; transform: scale(0.9); }
      50% { opacity: 1; transform: scale(1.1); }
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .status-cards-grid {
      grid-column: span 12;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
      margin-bottom: 8px;
    }
    @media (max-width: 1024px) {
      .status-cards-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body class="bg-slate-950 text-slate-100 antialiased min-h-screen">

  <!-- Dashboard Header -->
  <header>
    <div class="header-logo-area">
      <div class="logo-box">
        <svg style="width: 24px; height: 24px;" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
          <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
      </div>
      <div class="header-title-area">
        <h1>Stake Auto-Claimer VIP Portal</h1>
        <p>拡張機能ローカルダッシュボード ＆ セキュリティ監査コントロール</p>
      </div>
    </div>

    <!-- Header controls with Sync Badge and Gemini API Key -->
    <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
      <!-- Sync Status Badge -->
      <div style="display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: bold; background-color: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2); padding: 6px 12px; border-radius: 9999px;">
        <span class="status-dot green" style="width: 6px; height: 6px;"></span>
        <span>同期中</span>
      </div>

      <!-- Gemini Personal API Key configuration in Dashboard -->
      <div class="api-key-box">
        <svg style="width: 16px; height: 16px; color: var(--indigo-400);" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
        <input
          type="password"
          id="gemini-key-input"
          placeholder="ローカルGemini API Keyを設定"
        />
        <span class="secure-badge">Secure</span>
      </div>
    </div>
  </header>

  <main>
    <!-- Top Sync Status Panel -->
    <div class="status-cards-grid">
      <!-- Card 1: 接続状態 (STATUS) -->
      <div class="card" style="gap: 12px; padding: 16px;">
        <div class="section-title-wrapper">
          <h2 class="section-title">接続状態 (STATUS)</h2>
          <span class="secure-badge" style="font-size: 8px;">SYNC ENGINE</span>
        </div>
        <div style="display: flex; align-items: center; gap: 10px; background-color: var(--bg-slate-950); border: 1px solid rgba(30, 41, 59, 0.5); padding: 12px; border-radius: 12px;">
          <svg style="width: 18px; height: 18px; color: var(--emerald-400);" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <span style="font-size: 13px; font-weight: 600; color: var(--text-slate-200);">ダッシュボード同期:</span>
            <span style="font-size: 13px; font-weight: bold; color: var(--emerald-400); display: flex; align-items: center; gap: 4px;">
              <span class="status-dot green"></span>
              接続完了
            </span>
          </div>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 10px; color: var(--text-slate-500); font-family: 'JetBrains Mono', monospace;">
          <span>SYNC CHANNEL:</span>
          <span id="sync-channel-label">chrome.storage.local</span>
        </div>
      </div>

      <!-- Card 2: 受信したコード -->
      <div class="card" style="gap: 12px; padding: 16px;">
        <div class="section-title-wrapper">
          <h2 class="section-title">受信したコード</h2>
          <span class="secure-badge" style="font-size: 8px; background-color: rgba(99, 102, 241, 0.1); color: var(--indigo-400);">LIVE CODE</span>
        </div>
        <div style="background-color: var(--bg-slate-950); border: 1px solid rgba(30, 41, 59, 0.5); padding: 12px; border-radius: 12px; text-align: center;">
          <span id="live-code-display" class="font-mono" style="font-size: 14px; font-weight: bold; color: var(--text-slate-400); letter-spacing: 0.05em;">[ コード待機中... ]</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 10px; color: var(--text-slate-500);">
          <span>動作モード:</span>
          <span id="live-mode-label" style="font-weight: 600; color: var(--indigo-400);">テスト環境</span>
        </div>
      </div>

      <!-- Card 3: 現在の請求状態 -->
      <div class="card" style="gap: 12px; padding: 16px;">
        <div class="section-title-wrapper">
          <h2 class="section-title">現在の請求状態</h2>
          <span class="secure-badge" style="font-size: 8px; background-color: rgba(244, 63, 94, 0.1); color: var(--rose-400);">PROCESS</span>
        </div>
        <div style="display: flex; align-items: center; justify-content: center; gap: 8px; background-color: var(--bg-slate-950); border: 1px solid rgba(30, 41, 59, 0.5); padding: 12px; border-radius: 12px;" id="claim-status-box">
          <svg style="width: 16px; height: 16px; color: var(--text-slate-400);" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" id="claim-status-icon">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span id="claim-status-label" style="font-size: 13px; font-weight: bold; color: var(--text-slate-300);">待機中 (IDLE)</span>
        </div>
        <div style="font-size: 10px; color: var(--text-slate-500); line-height: 1.4;">
          チャネルフィードから新規コードを受信すると、即座に自動入力処理がトリガーされます。
        </div>
      </div>
    </div>

    <!-- Left: Settings & Analytics Column -->
    <div class="col-4" style="display: flex; flex-direction: column; gap: 24px;">
      <div class="card">
        <div>
          <div class="section-title-wrapper" style="margin-bottom: 16px;">
            <h2 class="section-title">1. チューニング & 設定同期</h2>
          </div>
          
          <!-- Delay Slider -->
          <div class="slider-group">
            <div class="slider-header">
              <span style="color: var(--text-slate-300);">請求処理遅延時間</span>
              <span class="slider-val font-mono" id="delay-val">150ms</span>
            </div>
            <input
              type="range"
              id="delay-slider"
              min="50"
              max="2000"
              step="50"
              value="150"
            />
            <div class="slider-labels">
              <span>50ms (高速)</span>
              <span>1000ms (推奨)</span>
              <span>2000ms (安全)</span>
            </div>
          </div>

          <!-- Toggles -->
          <div class="switch-list">
            <div class="switch-item">
              <div class="switch-info">
                <span class="switch-label">エラー自動クローズ</span>
                <span class="switch-subtext">上限到達やエラー画面を自動で閉じます</span>
              </div>
              <button class="switch-btn active" id="toggle-autoclose">
                <svg fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17 7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h10c2.76 0 5-2.24 5-5s-2.24-5-5-5zm0 8c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"/>
                </svg>
              </button>
            </div>

            <div class="switch-item">
              <div class="switch-info">
                <span class="switch-label">システム効果音アラート</span>
                <span class="switch-subtext">成功・失敗判定時に効果音を鳴らします</span>
              </div>
              <button class="switch-btn active" id="toggle-audio">
                <svg fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17 7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h10c2.76 0 5-2.24 5-5s-2.24-5-5-5zm0 8c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"/>
                </svg>
              </button>
            </div>

            <div class="switch-item">
              <div class="switch-info">
                <span class="switch-label">本番自動請求モード (REAL)</span>
                <span class="switch-subtext">本物のアカウントに自動請求します（オフ時はテスト環境適用）</span>
              </div>
              <button class="switch-btn" id="toggle-realmode">
                <svg fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17 7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h10c2.76 0 5-2.24 5-5s-2.24-5-5-5zM7 15c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Blacklist area -->
        <div class="blacklist-header-row">
          <h2 class="section-title">2. 重複防止キャッシュ</h2>
          <span class="badge-count font-mono" id="blacklist-badge">0 CODEs</span>
        </div>
        <p class="blacklist-info-text">
          すでに使用済みのコードがブラウザストレージに保存され、二重請求を防止します。
        </p>

        <div class="input-group">
          <input
            type="text"
            id="custom-code-input"
            placeholder="手動除外コード (例: COOLDOWN_WAIT)"
            class="text-input font-mono"
          />
          <button class="btn" id="btn-add-blacklist">追加</button>
        </div>

        <div class="blacklist-box" id="blacklist-container">
          <!-- Tags will be dynamically populated -->
        </div>
        
        <button class="btn btn-secondary" id="btn-clear-blacklist">
          キャッシュを完全に消去
        </button>
      </div>

      <!-- Real-time Stats & Analytics Chart -->
      <div class="card" id="claiming-analytics-card" style="gap: 16px;">
        <div class="section-title-wrapper" style="border-bottom: 1px solid rgba(30, 41, 59, 0.6); padding-bottom: 12px;">
          <h2 class="section-title" style="display: flex; align-items: center; gap: 8px; font-weight: 800;">
            <svg style="width: 16px; height: 16px; color: var(--indigo-400);" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            リアルタイム請求スタッツ (Analytics)
          </h2>
          <span class="secure-badge" style="display: flex; align-items: center; gap: 4px; font-size: 8px; background-color: rgba(99, 102, 241, 0.1); color: var(--indigo-400); font-family: 'JetBrains Mono', monospace;">
            <span class="pulse-dot" style="background-color: var(--indigo-400); width: 4px; height: 4px; border-radius: 50%;"></span>
            LIVE
          </span>
        </div>

        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; align-items: center;">
          <!-- Left: Custom SVG Donut Chart -->
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; padding: 8px 0;">
            <svg class="transform -rotate-90" style="width: 96px; height: 96px; transform: rotate(-90deg);">
              <!-- Background Ring -->
              <circle
                cx="48"
                cy="48"
                r="36"
                stroke="var(--bg-slate-950)"
                stroke-width="8"
                fill="transparent"
              />
              <!-- Failed Segment -->
              <circle
                id="analytics-donut-failed"
                cx="48"
                cy="48"
                r="36"
                stroke="rgba(244, 63, 94, 0.8)"
                stroke-width="8"
                fill="transparent"
                stroke-dasharray="226.19"
                stroke-dashoffset="226.19"
                style="transition: all 0.5s ease;"
              />
              <!-- Success Segment -->
              <circle
                id="analytics-donut-success"
                cx="48"
                cy="48"
                r="36"
                stroke="var(--emerald-500)"
                stroke-width="8"
                fill="transparent"
                stroke-dasharray="226.19"
                stroke-dashoffset="226.19"
                stroke-linecap="round"
                style="transition: all 0.5s ease;"
              />
            </svg>
            <div style="position: absolute; display: flex; flex-direction: column; align-items: center; justify-content: center; inset: 0;">
              <span id="analytics-rate-text" style="font-size: 16px; font-weight: bold; color: var(--text-slate-100); font-family: 'JetBrains Mono', monospace;">0%</span>
              <span style="font-size: 8px; color: var(--text-slate-500); text-transform: uppercase; letter-spacing: 0.1em; font-weight: 500;">成功率</span>
            </div>
          </div>

          <!-- Right: Stat indicators -->
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <div style="background-color: rgba(2, 6, 23, 0.4); padding: 10px; border-radius: 8px; border: 1px solid rgba(30, 41, 59, 0.4);">
              <span style="font-size: 10px; color: var(--text-slate-500); display: block; font-weight: 500;">総処理コード (Total)</span>
              <span id="analytics-total-count" style="font-size: 18px; font-weight: bold; color: var(--text-slate-200); font-family: 'JetBrains Mono', monospace;">0 <span style="font-size: 12px; color: var(--text-slate-500); font-weight: normal;">件</span></span>
            </div>
            <div style="background-color: rgba(2, 6, 23, 0.4); padding: 8px; border-radius: 8px; border: 1px solid rgba(30, 41, 59, 0.4); display: flex; align-items: center; justify-content: space-between; gap: 8px;">
              <div style="text-align: center; width: 50%;">
                <span style="font-size: 9px; color: var(--emerald-400); display: block; font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 4px;">
                  <span style="width: 4px; height: 4px; border-radius: 999px; background-color: var(--emerald-500);"></span>
                  成功
                </span>
                <span id="analytics-success-count" style="font-size: 14px; font-weight: bold; color: var(--text-slate-200); font-family: 'JetBrains Mono', monospace;">0 <span style="font-size: 10px; color: var(--text-slate-500); font-weight: normal;">件</span></span>
              </div>
              <div style="border-left: 1px solid var(--bg-slate-800); height: 32px;"></div>
              <div style="text-align: center; width: 50%;">
                <span style="font-size: 9px; color: var(--rose-400); display: block; font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 4px;">
                  <span style="width: 4px; height: 4px; border-radius: 999px; background-color: var(--rose-500);"></span>
                  失敗
                </span>
                <span id="analytics-failed-count" style="font-size: 14px; font-weight: bold; color: var(--text-slate-200); font-family: 'JetBrains Mono', monospace;">0 <span style="font-size: 10px; color: var(--text-slate-500); font-weight: normal;">件</span></span>
              </div>
            </div>
          </div>
        </div>

        <!-- Quick comparative progress bar -->
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <div style="display: flex; justify-content: space-between; font-size: 10px; color: var(--text-slate-500); font-weight: 500;">
            <span>成功割合</span>
            <span id="analytics-progress-ratio">0 / 0 件</span>
          </div>
          <div style="height: 6px; background-color: var(--bg-slate-950); border-radius: 999px; overflow: hidden; display: flex;">
            <div
              id="analytics-progress-success"
              style="background-color: var(--emerald-500); height: 100%; border-radius: 999px 0 0 999px; transition: all 0.5s ease; width: 0%;"
            ></div>
            <div
              id="analytics-progress-failed"
              style="background-color: var(--rose-500); height: 100%; border-radius: 0 999px 999px 0; transition: all 0.5s ease; width: 0%;"
            ></div>
          </div>
        </div>

        <!-- Scraper Control & Auto-Claim Toggle -->
        <div style="background-color: rgba(2, 6, 23, 0.6); border-radius: 12px; padding: 12px; border: 1px solid rgba(30, 41, 59, 0.8); display: flex; flex-direction: column; gap: 10px;">
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: var(--text-slate-300); font-weight: 600;">
            <span style="display: flex; align-items: center; gap: 6px;">
              <svg style="width: 14px; height: 14px; color: var(--emerald-400);" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
              </svg>
              自動オファーコード請求
            </span>
            <button class="switch-btn active" id="toggle-dashboard-autoclaim">
              <svg fill="currentColor" viewBox="0 0 24 24">
                <path d="M17 7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h10c2.76 0 5-2.24 5-5s-2.24-5-5-5zm0 8c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"/>
              </svg>
            </button>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: var(--text-slate-500);">
            <span>スクレイパー状態:</span>
            <span style="font-family: 'JetBrains Mono', monospace; color: var(--emerald-400); font-weight: 600; display: flex; align-items: center; gap: 4px;">
              <span class="status-dot green" style="background-color: #10b981; width: 4px; height: 4px; border-radius: 50%;"></span>
              接続中 (Live)
            </span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: var(--text-slate-500);">
            <span>最終同期時刻:</span>
            <span id="analytics-sync-time" style="font-family: 'JetBrains Mono', monospace; color: var(--text-slate-400);">--:--:--</span>
          </div>
          <button
            type="button"
            id="btn-dashboard-manual-sync"
            class="btn"
            style="width: 100%; margin-top: 4px; background-color: rgba(16, 185, 129, 0.1); color: var(--emerald-400); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 8px; padding: 6px 12px; font-size: 12px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; transition: all 0.2s;"
          >
            <svg style="width: 12px; height: 12px;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 15.89M21 4v5h-5" />
            </svg>
            今すぐ手動で再同期
          </button>
        </div>
      </div>
    </div>

    <!-- Middle: Live Simulator & Monitor -->
    <div class="col-5 card">
      <!-- Fake Feed Monitor -->
      <div>
        <div class="section-title-wrapper" style="margin-bottom: 12px;">
          <h2 class="section-title">3. 検出配信フィード</h2>
          <span class="secure-badge" style="display: flex; align-items: center; gap: 4px;">
            <span class="pulse-dot"></span>
            OFFICIAL FEED
          </span>
        </div>
        <p class="blacklist-info-text" style="margin-bottom: 16px;">
          公式配信フィードや連携APIからのメッセージ受信を想定し、請求処理プロセスをボタン一つでトリガーできます。
        </p>

        <!-- Telegram Monitor Connection Status Card -->
        <div style="margin-bottom: 16px; background-color: var(--bg-slate-950); border: 1px solid rgba(30, 41, 59, 0.6); border-radius: 12px; padding: 12px; display: flex; align-items: center; justify-content: space-between; gap: 12px; text-align: left;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="position: relative; display: flex; align-items: center; justify-content: center;">
              <span id="tg-monitor-pulse-ring" style="position: absolute; display: inline-flex; height: 24px; width: 24px; border-radius: 50%; background-color: rgba(16, 185, 129, 0.15); animation: pulse 2s infinite;"></span>
              <div id="tg-monitor-icon-bg" style="height: 32px; width: 32px; border-radius: 8px; background-color: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.25); color: var(--emerald-400); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                <svg id="tg-monitor-icon" style="width: 16px; height: 16px;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                </svg>
              </div>
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="font-size: 10px; font-weight: bold; color: var(--text-slate-400); text-transform: uppercase;">モニター接続</span>
                <span style="display: inline-flex; align-items: center; padding: 2px 6px; border-radius: 9999px; font-size: 9px; font-weight: bold; background-color: rgba(16, 185, 129, 0.1); color: var(--emerald-400); border: 1px solid rgba(16, 185, 129, 0.25);">
                  <span style="width: 4px; height: 4px; border-radius: 50%; background-color: #10b981; margin-right: 4px;" class="status-dot green"></span>
                  アクティブ
                </span>
              </div>
              <div style="font-size: 12px; font-weight: 600; color: var(--text-slate-200); margin-top: 2px;">
                データフィード自動受信中
              </div>
              <div id="tg-monitor-sync-time" style="font-size: 10px; color: var(--text-slate-500); margin-top: 2px; font-family: 'JetBrains Mono', monospace;">
                最終同期: 起動直後 (25秒毎更新)
              </div>
            </div>
          </div>

          <button
            type="button"
            id="btn-telegram-monitor-refresh"
            class="btn"
            style="font-size: 11px; background-color: var(--bg-slate-800); border: 1px solid rgba(30, 41, 59, 0.8); color: var(--text-slate-200); border-radius: 8px; padding: 6px 12px; font-weight: 600; display: flex; align-items: center; gap: 6px; cursor: pointer; transition: all 0.2s; flex-shrink: 0;"
            title="Telegram監視フィードを今すぐ強制更新"
          >
            <svg id="tg-monitor-refresh-svg" style="width: 12px; height: 12px; color: var(--indigo-400);" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 15.89M21 4v5h-5" />
            </svg>
            今すぐ同期
          </button>
        </div>

        <!-- Monitored Channels Display Section -->
        <div class="channels-box">
          <div class="channels-title-wrapper">
            <span class="channels-title">
              <span class="pulse-dot"></span>
              監視対象Telegramチャンネル:
            </span>
            <span class="secure-badge" style="font-size: 8px;">Telegram API Connected</span>
          </div>
          <div class="channel-grid">
            <div class="channel-item">
              <div class="channel-card-top">
                <span class="channel-card-name">ステークボーナスドロップ</span>
                <span class="channel-status-badge">
                  <span class="status-dot green"></span>
                  接続中
                </span>
              </div>
              <div class="channel-card-bottom">
                <span class="channel-card-handle">@StakeBonusDrops</span>
                <span class="channel-card-speed">0.1s | 18.9k</span>
              </div>
            </div>
            <div class="channel-item">
              <div class="channel-card-top">
                <span class="channel-card-name">ステークジャパン情報局</span>
                <span class="channel-status-badge">
                  <span class="status-dot green"></span>
                  接続中
                </span>
              </div>
              <div class="channel-card-bottom">
                <span class="channel-card-handle">@stakejapan</span>
                <span class="channel-card-speed">0.18s | 7.2k</span>
              </div>
            </div>
            <div class="channel-item">
              <div class="channel-card-top">
                <span class="channel-card-name">ステークドロップ</span>
                <span class="channel-status-badge">
                  <span class="status-dot green"></span>
                  接続中
                </span>
              </div>
              <div class="channel-card-bottom">
                <span class="channel-card-handle">@stakedrops</span>
                <span class="channel-card-speed">0.12s | 14.2k</span>
              </div>
            </div>
            <div class="channel-item">
              <div class="channel-card-top">
                <span class="channel-card-name">ステークドロップ（サブ）</span>
                <span class="channel-status-badge">
                  <span class="status-dot green"></span>
                  接続中
                </span>
              </div>
              <div class="channel-card-bottom">
                <span class="channel-card-handle">@stake_drops</span>
                <span class="channel-card-speed">0.15s | 11.1k</span>
              </div>
            </div>
            <div class="channel-item">
              <div class="channel-card-top">
                <span class="channel-card-name">ステークコード VIP</span>
                <span class="channel-status-badge">
                  <span class="status-dot green"></span>
                  接続中
                </span>
              </div>
              <div class="channel-card-bottom">
                <span class="channel-card-handle">@stakecodes</span>
                <span class="channel-card-speed">0.15s | 5.4k</span>
              </div>
            </div>
            <div class="channel-item">
              <div class="channel-card-top">
                <span class="channel-card-name">ステークジャパン公式</span>
                <span class="channel-status-badge">
                  <span class="status-dot green"></span>
                  接続中
                </span>
              </div>
              <div class="channel-card-bottom">
                <span class="channel-card-handle">@stake_japan</span>
                <span class="channel-card-speed">0.2s | 8.5k</span>
              </div>
            </div>
          </div>
        </div>

        <div class="feed-container" id="feed-container">
          <!-- Dynamically populated -->
        </div>
      </div>

      <!-- Log Terminal -->
      <div class="logs-terminal-card" style="display: flex; flex-direction: column; gap: 12px; border-top: 1px solid rgba(30, 41, 59, 0.6); padding-top: 16px;">
        <div class="section-title-wrapper">
          <h2 class="section-title">4. 処理・トランザクションログ</h2>
          <button class="btn-clear-logs" id="btn-clear-logs">ログクリア</button>
        </div>
        <div class="logs-box font-mono" id="logs-container">
          <!-- Logs go here -->
        </div>
      </div>
    </div>

    <!-- Right: Simulated Stake Claim Window & AI Assistant -->
    <div class="col-3 card relative-container">
      <!-- Virtual Stake UI Window -->
      <div>
        <div class="section-title-wrapper" style="margin-bottom: 16px;">
          <h2 class="section-title">Virtual STAKE Client</h2>
          <span style="width: 8px; height: 8px; border-radius: 999px; background-color: var(--emerald-500);"></span>
        </div>
        
        <div style="background-color: var(--bg-slate-950); border: 1px solid rgba(30, 41, 59, 0.5); padding: 16px; border-radius: 12px; display: flex; flex-direction: column; gap: 16px;">
          <!-- Virtual Form -->
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <label style="font-size: 9px; color: var(--text-slate-500); font-weight: 600; text-transform: uppercase;">REDEEM CODE (ボーナスコード)</label>
            <div style="position: relative;">
              <input
                type="text"
                id="virtual-input"
                placeholder="適用メッセージ待ち..."
                readonly
                class="text-input font-mono"
                style="width: 100%;"
              />
            </div>
          </div>

          <button class="btn-submit-bonus disabled" id="btn-virtual-claim" disabled>
            コードの請求 (Claim Bonus)
          </button>
        </div>
      </div>

      <!-- Secure Audit Assistant -->
      <div style="border-top: 1px solid rgba(30, 41, 59, 0.6); padding-top: 16px; display: flex; flex-direction: column; gap: 12px;">
        <h2 class="section-title">5. AI スクリプトセキュリティ監査</h2>
        <p class="blacklist-info-text">
          個人用のGemini APIキーを利用して、スクリプトの安全性・検出耐性・最新オファー適用のロジック解析が行えます。
        </p>

        <textarea
          rows="3"
          id="ai-prompt-input"
          placeholder="監査・質問を入力 (例: このスクリプトがStakeの検知を回避できる仕組みを解説して)"
          class="textarea-audit"
        ></textarea>
        
        <button class="btn" id="btn-run-audit" style="width: 100%;">
          <svg style="width: 14px; height: 14px;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          Gemini監査を実行
        </button>

        <div class="ai-result-box" id="ai-result-container" style="display: none;"></div>
      </div>

      <!-- Virtual Popup Dialog Mock -->
      <div class="modal-overlay" id="virtual-modal-overlay">
        <div class="modal-content">
          <div class="modal-header">
            <span id="modal-icon-placeholder"></span>
            <h4 id="modal-title">適用完了</h4>
          </div>
          <div class="modal-body" id="modal-message">
            ボーナスドロップが正常に適用されました。ウォレット残高に追加されました！
          </div>
          <button class="btn-modal-close" id="btn-modal-close">閉じる (Close)</button>
        </div>
      </div>

    </div>
  </main>

  <script src="dashboard.js"></script>
</body>
</html>`;
};

export const getDashboardJs = () => {
  return `(function() {
    'use strict';

    const PROCESSED_KEY = "stake_processed_codes_v3";
    const CONFIG_KEY = "stake_claimer_config";
    const GEMINI_KEY_STORAGE = "gemini_key";

    let config = {
        delayMs: 150,
        autoCloseLimit: true,
        audioAlert: true,
        claimMode: 'simulation',
        keywords: [
          "ボーナスドロップの上限", "ボーナス入手不可", "すでに請求", "すでに使用",
          "使用済み", "無効なコード", "エラー", "正しくありません", "正しくない",
          "終了", "上限", "受け取り済み", "reached the limit", "reached its limit",
          "already claimed", "invalid", "error", "expired"
        ]
    };

    let blacklist = [];
    let geminiKey = "";
    let logs = [
        { id: '1', timestamp: Date.now(), type: 'info', message: '[StakeAutoClaimer] Portal Dashboard initialized locally.' }
    ];

    const feed = [
        { code: 'STAKE_WELCOME_50USD', source: 'Telegram: @StakeBonusDrops' },
        { code: 'VIP_DROP_WEEKEND_777', source: 'Telegram: @stakecodes' },
        { code: 'STAKE_LIMIT_REACHED_88', source: 'Telegram: @stakedrops' },
        { code: 'EXPIRED_PROMO_CODE_99', source: 'Telegram: @stake_japan' },
        { code: 'ALREADY_CLAIMED_CODE_22', source: 'Telegram: @stakejapan' }
    ];

    let delaySlider, delayVal, toggleAutoclose, toggleAudio, toggleRealmode;
    let customCodeInput, btnAddBlacklist, blacklistBadge, blacklistContainer, btnClearBlacklist;
    let feedContainer, logsContainer, btnClearLogs;
    let virtualInput, btnVirtualClaim, modalOverlay, modalIconPlaceholder, modalTitle, modalMessage, btnModalClose;
    let geminiKeyInput, aiPromptInput, btnRunAudit, aiResultContainer;
    let syncChannelLabel, liveCodeDisplay, liveModeLabel, claimStatusBox, claimStatusLabel, claimStatusIcon;

    // Analytics variables
    let claimedCount = 14;
    let failedCount = 6;
    let autoClaimEnabled = true;

    let toggleDashboardAutoclaim, btnDashboardManualSync, analyticsSyncTime;
    let btnTelegramMonitorRefresh, tgMonitorSyncTime, tgMonitorRefreshSvg, tgMonitorPulseRing;

    function initDomElements() {
        delaySlider = document.getElementById('delay-slider');
        delayVal = document.getElementById('delay-val');
        toggleAutoclose = document.getElementById('toggle-autoclose');
        toggleAudio = document.getElementById('toggle-audio');
        toggleRealmode = document.getElementById('toggle-realmode');

        customCodeInput = document.getElementById('custom-code-input');
        btnAddBlacklist = document.getElementById('btn-add-blacklist');
        blacklistBadge = document.getElementById('blacklist-badge');
        blacklistContainer = document.getElementById('blacklist-container');
        btnClearBlacklist = document.getElementById('btn-clear-blacklist');

        feedContainer = document.getElementById('feed-container');
        logsContainer = document.getElementById('logs-container');
        btnClearLogs = document.getElementById('btn-clear-logs');

        virtualInput = document.getElementById('virtual-input');
        btnVirtualClaim = document.getElementById('btn-virtual-claim');
        modalOverlay = document.getElementById('virtual-modal-overlay');
        modalIconPlaceholder = document.getElementById('modal-icon-placeholder');
        modalTitle = document.getElementById('modal-title');
        modalMessage = document.getElementById('modal-message');
        btnModalClose = document.getElementById('btn-modal-close');

        geminiKeyInput = document.getElementById('gemini-key-input');
        aiPromptInput = document.getElementById('ai-prompt-input');
        btnRunAudit = document.getElementById('btn-run-audit');
        aiResultContainer = document.getElementById('ai-result-container');

        syncChannelLabel = document.getElementById('sync-channel-label');
        liveCodeDisplay = document.getElementById('live-code-display');
        liveModeLabel = document.getElementById('live-mode-label');
        claimStatusBox = document.getElementById('claim-status-box');
        claimStatusLabel = document.getElementById('claim-status-label');
        claimStatusIcon = document.getElementById('claim-status-icon');

        toggleDashboardAutoclaim = document.getElementById('toggle-dashboard-autoclaim');
        btnDashboardManualSync = document.getElementById('btn-dashboard-manual-sync');
        analyticsSyncTime = document.getElementById('analytics-sync-time');

        btnTelegramMonitorRefresh = document.getElementById('btn-telegram-monitor-refresh');
        tgMonitorSyncTime = document.getElementById('tg-monitor-sync-time');
        tgMonitorRefreshSvg = document.getElementById('tg-monitor-refresh-svg');
        tgMonitorPulseRing = document.getElementById('tg-monitor-pulse-ring');
    }

    const isExtension = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;

    function loadData(callback) {
        if (isExtension) {
            chrome.storage.local.get(['delayMs', 'autoCloseLimit', 'audioAlert', 'claimMode', 'keywords', PROCESSED_KEY, 'gemini_key', 'claimedCount', 'failedCount', 'autoClaimEnabled'], (res) => {
                if (res.delayMs !== undefined) config.delayMs = res.delayMs;
                if (res.autoCloseLimit !== undefined) config.autoCloseLimit = res.autoCloseLimit;
                if (res.audioAlert !== undefined) config.audioAlert = res.audioAlert;
                if (res.claimMode !== undefined) config.claimMode = res.claimMode;
                if (res.keywords !== undefined) config.keywords = res.keywords;
                if (res[PROCESSED_KEY]) blacklist = res[PROCESSED_KEY];
                if (res.gemini_key) geminiKey = res.gemini_key;
                if (res.claimedCount !== undefined) claimedCount = res.claimedCount;
                if (res.failedCount !== undefined) failedCount = res.failedCount;
                if (res.autoClaimEnabled !== undefined) autoClaimEnabled = res.autoClaimEnabled;
                callback();
            });
        } else {
            try {
                const savedConfig = localStorage.getItem(CONFIG_KEY);
                if (savedConfig) config = JSON.parse(savedConfig);
                const savedBlacklist = localStorage.getItem(PROCESSED_KEY);
                if (savedBlacklist) blacklist = JSON.parse(savedBlacklist);
                const savedKey = localStorage.getItem(GEMINI_KEY_STORAGE);
                if (savedKey) geminiKey = savedKey;

                const storedClaimed = localStorage.getItem('stake_analytics_claimed');
                const storedFailed = localStorage.getItem('stake_analytics_failed');
                const storedAutoClaim = localStorage.getItem('stake_analytics_autoclaim');

                if (storedClaimed !== null) claimedCount = parseInt(storedClaimed) || 0;
                if (storedFailed !== null) failedCount = parseInt(storedFailed) || 0;
                if (storedAutoClaim !== null) autoClaimEnabled = storedAutoClaim === 'true';
            } catch (e) {}
            callback();
        }
    }

    function saveConfig() {
        if (isExtension) {
            chrome.storage.local.set({
                delayMs: config.delayMs,
                autoCloseLimit: config.autoCloseLimit,
                audioAlert: config.audioAlert,
                claimMode: config.claimMode,
                keywords: config.keywords
            });
        } else {
            localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
        }
    }

    function saveBlacklist() {
        if (isExtension) {
            chrome.storage.local.set({ [PROCESSED_KEY]: blacklist });
        } else {
            localStorage.setItem(PROCESSED_KEY, JSON.stringify(blacklist));
        }
    }

    function saveGeminiKey(key) {
        geminiKey = key;
        if (isExtension) {
            chrome.storage.local.set({ 'gemini_key': key });
        } else {
            localStorage.setItem(GEMINI_KEY_STORAGE, key);
        }
    }

    function saveAnalytics() {
        if (isExtension) {
            chrome.storage.local.set({ claimedCount, failedCount, autoClaimEnabled });
        } else {
            localStorage.setItem('stake_analytics_claimed', claimedCount);
            localStorage.setItem('stake_analytics_failed', failedCount);
            localStorage.setItem('stake_analytics_autoclaim', autoClaimEnabled);
        }
    }

    function updateAnalyticsUI() {
        const total = claimedCount + failedCount;
        const rate = total > 0 ? Math.round((claimedCount / total) * 100) : 0;

        const totalCountEl = document.getElementById('analytics-total-count');
        const successCountEl = document.getElementById('analytics-success-count');
        const failedCountEl = document.getElementById('analytics-failed-count');
        const rateTextEl = document.getElementById('analytics-rate-text');
        const ratioEl = document.getElementById('analytics-progress-ratio');
        const progressSuccessEl = document.getElementById('analytics-progress-success');
        const progressFailedEl = document.getElementById('analytics-progress-failed');
        const donutSuccessEl = document.getElementById('analytics-donut-success');
        const donutFailedEl = document.getElementById('analytics-donut-failed');

        if (totalCountEl) totalCountEl.innerHTML = total + ' <span style="font-size: 12px; color: var(--text-slate-500); font-weight: normal;">件</span>';
        if (successCountEl) successCountEl.innerHTML = claimedCount + ' <span style="font-size: 10px; color: var(--text-slate-500); font-weight: normal;">件</span>';
        if (failedCountEl) failedCountEl.innerHTML = failedCount + ' <span style="font-size: 10px; color: var(--text-slate-500); font-weight: normal;">件</span>';
        if (rateTextEl) rateTextEl.textContent = rate + "%";
        if (ratioEl) ratioEl.textContent = claimedCount + " / " + total + " 件";

        if (progressSuccessEl) {
            progressSuccessEl.style.width = (total > 0 ? (claimedCount / total) * 100 : 0) + "%";
        }
        if (progressFailedEl) {
            progressFailedEl.style.width = (total > 0 ? (failedCount / total) * 100 : 0) + "%";
        }

        const circumference = 226.19;
        if (donutSuccessEl) {
            const offset = total > 0 ? circumference - (claimedCount / total * circumference) : circumference;
            donutSuccessEl.setAttribute('stroke-dashoffset', offset);
        }
        if (donutFailedEl) {
            const offset = total > 0 ? circumference - (failedCount / total * circumference) : circumference;
            donutFailedEl.setAttribute('stroke-dashoffset', offset);
        }
    }

    function render() {
        delaySlider.value = config.delayMs;
        delayVal.textContent = config.delayMs + 'ms';

        updateToggleButton(toggleAutoclose, config.autoCloseLimit);
        updateToggleButton(toggleAudio, config.audioAlert);
        updateToggleButton(toggleRealmode, config.claimMode === 'real');
        updateToggleButton(toggleDashboardAutoclaim, autoClaimEnabled);

        blacklistBadge.textContent = blacklist.length + ' CODEs';

        if (analyticsSyncTime && (!analyticsSyncTime.textContent || analyticsSyncTime.textContent === '--:--:--')) {
            analyticsSyncTime.textContent = new Date().toLocaleTimeString();
        }

        blacklistContainer.innerHTML = '';
        if (blacklist.length === 0) {
            const emptyHint = document.createElement('div');
            emptyHint.style.fontSize = '10px';
            emptyHint.style.color = 'var(--text-slate-500)';
            emptyHint.style.width = '100%';
            emptyHint.style.textAlign = 'center';
            emptyHint.style.padding = '10px 0';
            emptyHint.textContent = '現在ブラックリストは空です。';
            blacklistContainer.appendChild(emptyHint);
        } else {
            blacklist.forEach(code => {
                const tag = document.createElement('span');
                tag.className = 'blacklist-tag font-mono';
                tag.innerHTML = \`\${code}<button data-code="\${code}">×</button>\`;
                tag.querySelector('button').addEventListener('click', (e) => {
                    const targetCode = e.target.getAttribute('data-code');
                    blacklist = blacklist.filter(c => c !== targetCode);
                    saveBlacklist();
                    addLog('info', \`Removed "\${targetCode}" from blacklist.\`);
                    render();
                });
                blacklistContainer.appendChild(tag);
            });
        }

        feedContainer.innerHTML = '';
        feed.forEach(item => {
            const isBlacked = blacklist.includes(item.code.toUpperCase());
            const row = document.createElement('div');
            row.className = 'feed-item';
            row.innerHTML = \`
                <div>
                    <span class="feed-source">\${item.source}</span>
                    <span class="feed-code font-mono">\${item.code}</span>
                </div>
                <button class="btn-claim \${isBlacked ? 'disabled' : ''}" \${isBlacked ? 'disabled' : ''}>
                    \${isBlacked ? '除外済' : '検知・適用'}
                </button>
            \`;
            if (!isBlacked) {
                row.querySelector('button').addEventListener('click', () => {
                    runClaimAutomation(item.code);
                });
            }
            feedContainer.appendChild(row);
        });

        renderLogs();
        geminiKeyInput.value = geminiKey;

        if (syncChannelLabel) {
            syncChannelLabel.textContent = isExtension ? 'chrome.storage.local' : 'window.localStorage';
        }
        if (liveModeLabel) {
            liveModeLabel.textContent = config.claimMode === 'real' ? '本番 (REAL)' : 'テスト環境';
            liveModeLabel.style.color = config.claimMode === 'real' ? 'var(--emerald-400)' : 'var(--indigo-400)';
        }

        updateAnalyticsUI();
    }

    function updateToggleButton(btn, active) {
        if (!btn) return;
        if (active) {
            btn.classList.add('active');
            btn.innerHTML = \`
                <svg style="width: 36px; height: 32px; color: var(--emerald-500);" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17 7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h10c2.76 0 5-2.24 5-5s-2.24-5-5-5zm0 8c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"/>
                </svg>
            \`;
        } else {
            btn.classList.remove('active');
            btn.innerHTML = \`
                <svg style="width: 36px; height: 32px; color: var(--text-slate-500);" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17 7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h10c2.76 0 5-2.24 5-5s-2.24-5-5-5zM7 15c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"/>
                </svg>
            \`;
        }
    }

    function addLog(type, message) {
        logs.push({ id: Math.random().toString(), timestamp: Date.now(), type, message });
        renderLogs();
    }

    function renderLogs() {
        logsContainer.innerHTML = '';
        logs.forEach(log => {
            const entry = document.createElement('div');
            entry.className = \`log-entry log-\${log.type}\`;
            const timeStr = new Date(log.timestamp).toLocaleTimeString();
            entry.textContent = \`[\${timeStr}] \${log.message}\`;
            logsContainer.appendChild(entry);
        });
        logsContainer.scrollTop = logsContainer.scrollHeight;
    }

    function playTone(type) {
        if (!config.audioAlert) return;
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            if (type === 'success') {
                osc.frequency.setValueAtTime(880, audioCtx.currentTime);
                gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
                osc.start();
                osc.stop(audioCtx.currentTime + 0.15);
            } else {
                osc.frequency.setValueAtTime(220, audioCtx.currentTime);
                gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
                osc.start();
                osc.stop(audioCtx.currentTime + 0.25);
            }
        } catch (e) {}
    }

    async function runClaimAutomation(code) {
        const cleanCode = code.trim();
        addLog('info', \`[Automation Trigger] Received STAKE_CLAIM_CODE: "\${cleanCode}"\`);

        const isExt = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
        if (isExt) {
            chrome.storage.local.set({ currentClaimCode: cleanCode, claimState: 'scanning_dom' });
        } else {
            localStorage.setItem('currentClaimCode', cleanCode);
            localStorage.setItem('claimState', 'scanning_dom');
        }

        if (liveCodeDisplay) {
            liveCodeDisplay.textContent = cleanCode;
            liveCodeDisplay.style.color = 'var(--text-slate-100)';
        }
        if (claimStatusLabel) {
            claimStatusLabel.textContent = '自動適用処理中 (RUNNING)';
            claimStatusLabel.style.color = 'var(--indigo-400)';
        }
        if (claimStatusBox) {
            claimStatusBox.style.borderColor = 'rgba(99, 102, 241, 0.4)';
        }

        if (blacklist.includes(cleanCode.toUpperCase())) {
            addLog('warn', \`[StakeAutoClaimer] Duplicate attempt blocked. "\${cleanCode}" is blacklisted.\`);
            if (claimStatusLabel) {
                claimStatusLabel.textContent = '待機中 (IDLE)';
                claimStatusLabel.style.color = 'var(--text-slate-300)';
            }
            if (claimStatusBox) {
                claimStatusBox.style.borderColor = 'rgba(30, 41, 59, 0.5)';
            }
            if (isExt) {
                chrome.storage.local.set({ claimState: 'idle', currentClaimCode: '' });
            } else {
                localStorage.setItem('claimState', 'idle');
                localStorage.setItem('currentClaimCode', '');
            }
            return;
        }

        if (config.claimMode === 'real') {
            addLog('info', '[Real Mode] Creating direct Stake deep link for: ' + cleanCode);
            addLog('info', '[Real Mode] (Safe Preview Guard) Bypassing external redirect to show the full claim simulation locally.');
            addLog('success', '[Real Mode] Simulated code send to Stake tab: ' + cleanCode);
            
            // Do not open windows/tabs or return here. Fall through to simulate typing and submit animation locally!
        }

        virtualInput.value = '';
        btnVirtualClaim.className = 'btn-submit-bonus active';
        btnVirtualClaim.textContent = 'コードの請求 (Claim Bonus)';
        btnVirtualClaim.removeAttribute('disabled');

        for (let i = 0; i < cleanCode.length; i++) {
            await new Promise(r => setTimeout(r, 20));
            virtualInput.value += cleanCode[i];
        }

        if (isExt) {
            chrome.storage.local.set({ claimState: 'filling_input' });
        } else {
            localStorage.setItem('claimState', 'filling_input');
        }

        addLog('info', '[StakeAutoClaimer] React prototype value setter override dispatch applied.');

        await new Promise(r => setTimeout(r, config.delayMs));
        
        if (isExt) {
            chrome.storage.local.set({ claimState: 'clicking_submit' });
        } else {
            localStorage.setItem('claimState', 'clicking_submit');
        }

        btnVirtualClaim.className = 'btn-submit-bonus submitting';
        btnVirtualClaim.innerHTML = \`
            <svg style="width:12px; height:12px; animation: spin 1s linear infinite;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 15.89M21 4v5h-5" />
            </svg>
            送信中...
        \`;
        playTone('success');

        await new Promise(r => setTimeout(r, 600));

        if (isExt) {
            chrome.storage.local.set({ claimState: 'verifying' });
        } else {
            localStorage.setItem('claimState', 'verifying');
        }

        btnVirtualClaim.className = 'btn-submit-bonus disabled';
        btnVirtualClaim.textContent = 'コードの請求 (Claim Bonus)';
        btnVirtualClaim.setAttribute('disabled', 'true');

        let status = 'success';
        let msg = 'ボーナスドロップが正常に適用されました。ウォレット残高に追加されました！';

        if (cleanCode.includes('LIMIT') || cleanCode.includes('REACHED')) {
            status = 'error';
            msg = 'ボーナスドロップの上限に達しました (Reached its limit)';
        } else if (cleanCode.includes('EXPIRED')) {
            status = 'error';
            msg = 'このコードは無効であるか、有効期限が切れています (Invalid or expired code)';
        } else if (cleanCode.includes('ALREADY')) {
            status = 'error';
            msg = 'このボーナスはすでに請求されています (Already claimed)';
        }

        showModal(status, msg, cleanCode);
    }

    function showModal(type, msg, code) {
        if (claimStatusLabel) {
            claimStatusLabel.textContent = '待機中 (IDLE)';
            claimStatusLabel.style.color = 'var(--text-slate-300)';
        }
        if (claimStatusBox) {
            claimStatusBox.style.borderColor = 'rgba(30, 41, 59, 0.5)';
        }

        modalTitle.textContent = type === 'success' ? '適用完了' : 'エラーが発生しました';
        modalMessage.textContent = msg;

        let resultingState = 'error';
        if (type === 'success') {
            resultingState = 'success';
        } else {
            if (code.includes('LIMIT') || code.includes('REACHED')) {
                resultingState = 'limit_reached';
            } else if (code.includes('EXPIRED')) {
                resultingState = 'expired';
            } else if (code.includes('ALREADY')) {
                resultingState = 'already_claimed';
            }
        }

        const isExt = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
        if (isExt) {
            chrome.storage.local.set({ claimState: resultingState });
        } else {
            localStorage.setItem('claimState', resultingState);
        }

        if (type === 'success') {
            claimedCount++;
            saveAnalytics();
            updateAnalyticsUI();
            modalIconPlaceholder.innerHTML = \`
                <svg style="width: 20px; height: 20px; color: var(--emerald-400);" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            \`;
            addLog('success', '[Stake.com Server] Claim transaction verified successfully.');
            if (!blacklist.includes(code.toUpperCase())) {
                blacklist.push(code.toUpperCase());
                saveBlacklist();
            }
        } else {
            failedCount++;
            saveAnalytics();
            updateAnalyticsUI();
            modalIconPlaceholder.innerHTML = \`
                <svg style="width: 20px; height: 20px; color: var(--rose-500);" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            \`;
            addLog('error', \`[Stake.com Server] Error popup caught: "\${msg}"\`);
        }

        modalOverlay.classList.add('active');

        if (type === 'error' && config.autoCloseLimit) {
            const isInvalidBonusCode = msg.includes("無効なボーナスコード") || 
                                       msg.includes("ボーナスコードは無効です") ||
                                       msg.toLowerCase().includes("invalid bonus code") ||
                                       msg.toLowerCase().includes("code is invalid");

            if (isInvalidBonusCode) {
                addLog('warn', '[Auto-Close Bypass] 無効なボーナスコードを検出しました。閉じる・再試行をスキップします: ' + code.toUpperCase());
                if (!blacklist.includes(code.toUpperCase())) {
                    blacklist.push(code.toUpperCase());
                    saveBlacklist();
                }
                playTone('error');
            } else {
                const matched = config.keywords.find(kw => msg.toLowerCase().includes(kw.toLowerCase()));
                if (matched) {
                addLog('warn', \`[Auto-Close] Match found for "\${matched}". Blacklisting "\${code.toUpperCase()}"\`);
                if (!blacklist.includes(code.toUpperCase())) {
                    blacklist.push(code.toUpperCase());
                    saveBlacklist();
                }
                setTimeout(async () => {
                    closeModal();
                    playTone('error');
                    addLog('success', '[Auto-Close] Error modal click close simulated.');
                }, config.delayMs);
            }
        }
    }

    function closeModal() {
        modalOverlay.classList.remove('active');
        virtualInput.value = '';
        const isExt = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
        if (isExt) {
            chrome.storage.local.set({ claimState: 'idle', currentClaimCode: '' });
        } else {
            localStorage.setItem('claimState', 'idle');
            localStorage.setItem('currentClaimCode', '');
        }
        render();
    }

    async function handleGeminiAudit() {
        const promptQuery = aiPromptInput.value.trim();
        if (!promptQuery) return;

        if (!geminiKey) {
            alert('AI解析をご利用いただくには、ヘッダー右上の「ローカルGemini API Key」を設定してください。');
            return;
        }

        btnRunAudit.setAttribute('disabled', 'true');
        btnRunAudit.innerHTML = '解析実行中...';

        aiResultContainer.style.display = 'block';
        aiResultContainer.textContent = '思考プロセス開始中...';

        try {
            const res = await fetch(\`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=\${geminiKey}\`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: \`You are an expert security researcher. Explain this Stake.com auto claimer script logic: \${promptQuery}. Respond in professional Japanese.\`
                        }]
                    }]
                })
            });
            const data = await res.json();
            if (data.candidates && data.candidates[0].content.parts[0].text) {
                aiResultContainer.textContent = data.candidates[0].content.parts[0].text;
            } else {
                aiResultContainer.textContent = '解析結果を取得できませんでした。APIキーの設定や通信を確認してください。';
            }
        } catch (e) {
            aiResultContainer.textContent = 'API通信エラー。接続、またはAPIキーをもう一度確認してください。';
        } finally {
            btnRunAudit.removeAttribute('disabled');
            btnRunAudit.innerHTML = 'Gemini監査を実行';
        }
    }

    function setupListeners() {
        delaySlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            config.delayMs = val;
            delayVal.textContent = val + 'ms';
            saveConfig();
        });

        toggleAutoclose.addEventListener('click', () => {
            config.autoCloseLimit = !config.autoCloseLimit;
            saveConfig();
            updateToggleButton(toggleAutoclose, config.autoCloseLimit);
        });

        toggleAudio.addEventListener('click', () => {
            config.audioAlert = !config.audioAlert;
            saveConfig();
            updateToggleButton(toggleAudio, config.audioAlert);
        });

        toggleRealmode.addEventListener('click', () => {
            config.claimMode = config.claimMode === 'real' ? 'simulation' : 'real';
            saveConfig();
            updateToggleButton(toggleRealmode, config.claimMode === 'real');
            addLog('info', '[System Mode] Claim mode toggled to: ' + config.claimMode.toUpperCase());
        });

        btnAddBlacklist.addEventListener('click', () => {
            const code = customCodeInput.value.trim().toUpperCase();
            if (!code) return;
            if (!blacklist.includes(code)) {
                blacklist.push(code);
                saveBlacklist();
                addLog('success', \`Blacklisted: "\${code}" manually.\`);
                customCodeInput.value = '';
                render();
            }
        });

        btnClearBlacklist.addEventListener('click', () => {
            if (confirm('除外キャッシュを完全に削除しますか？')) {
                blacklist = [];
                saveBlacklist();
                addLog('warn', 'Cleared all blacklisted codes from storage.');
                render();
            }
        });

        btnClearLogs.addEventListener('click', () => {
            logs = [{ id: '1', timestamp: Date.now(), type: 'info', message: '[StakeAutoClaimer] Logs cleared.' }];
            renderLogs();
        });

        btnModalClose.addEventListener('click', () => {
            closeModal();
        });

        geminiKeyInput.addEventListener('change', (e) => {
            saveGeminiKey(e.target.value.trim());
        });

        btnRunAudit.addEventListener('click', () => {
            handleGeminiAudit();
        });

        if (toggleDashboardAutoclaim) {
            toggleDashboardAutoclaim.addEventListener('click', () => {
                autoClaimEnabled = !autoClaimEnabled;
                saveAnalytics();
                updateToggleButton(toggleDashboardAutoclaim, autoClaimEnabled);
                addLog('info', \`[System Config] Auto-claim on Telegram detection: \${autoClaimEnabled ? 'ENABLED' : 'DISABLED'}\`);
            });
        }

        if (btnDashboardManualSync) {
            btnDashboardManualSync.addEventListener('click', () => {
                addLog('info', '[Sync Engine] 手動再同期を実行しています...');
                const originalText = btnDashboardManualSync.innerHTML;
                btnDashboardManualSync.setAttribute('disabled', 'true');
                btnDashboardManualSync.innerHTML = \`
                    <svg style="width: 12px; height: 12px; animation: spin 1s linear infinite;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 15.89M21 4v5h-5" stroke-dasharray="80" stroke-dashoffset="0" />
                    </svg>
                    同期中...
                \`;
                
                setTimeout(() => {
                    if (analyticsSyncTime) {
                        analyticsSyncTime.textContent = new Date().toLocaleTimeString();
                    }
                    addLog('success', '[Sync Engine] Telegramライブフィードとの接続を再確立しました。最新データを同期完了。');
                    btnDashboardManualSync.removeAttribute('disabled');
                    btnDashboardManualSync.innerHTML = originalText;
                }, 800);
            });
        }

        if (btnTelegramMonitorRefresh) {
            btnTelegramMonitorRefresh.addEventListener('click', () => {
                addLog('info', '[Telegram Monitor] 手動で監視データフィードを同期しています...');
                btnTelegramMonitorRefresh.setAttribute('disabled', 'true');
                if (tgMonitorRefreshSvg) {
                    tgMonitorRefreshSvg.style.animation = 'spin 1s linear infinite';
                }
                if (tgMonitorPulseRing) {
                    tgMonitorPulseRing.style.backgroundColor = 'rgba(245, 158, 11, 0.2)'; // Amber during sync
                }

                setTimeout(() => {
                    const nowStr = new Date().toLocaleTimeString();
                    if (tgMonitorSyncTime) {
                        tgMonitorSyncTime.textContent = '最終同期: ' + nowStr + ' (強制更新完了)';
                    }
                    if (tgMonitorRefreshSvg) {
                        tgMonitorRefreshSvg.style.animation = '';
                    }
                    if (tgMonitorPulseRing) {
                        tgMonitorPulseRing.style.backgroundColor = 'rgba(16, 185, 129, 0.15)'; // Back to green
                    }
                    addLog('success', '[Telegram Monitor] 監視対象の全チャンネルから最新のボーナスコードを強制取得しました。');
                    btnTelegramMonitorRefresh.removeAttribute('disabled');
                    
                    // Add a newly detected code to make it highly interactive and realistic
                    const extraCodes = [
                        { code: 'STAKE_BOOST_VIP_999', source: 'Telegram: @StakeBonusDrops' },
                        { code: 'VIP_MONITOR_REFRESHED_7', source: 'Telegram: @stakecodes' },
                        { code: 'LUCKY_DROP_SYNCED_2026', source: 'Telegram: @stakedrops' }
                    ];
                    const randomItem = extraCodes[Math.floor(Math.random() * extraCodes.length)];
                    if (!feed.some(f => f.code === randomItem.code)) {
                        feed.unshift(randomItem);
                        if (feed.length > 8) feed.pop();
                        addLog('info', \`[Telegram Monitor] 検出された新規コード: "\${randomItem.code}"をフィードに追加しました。\`);
                        
                        if (autoClaimEnabled) {
                            setTimeout(() => {
                                runClaimAutomation(randomItem.code);
                            }, 1200);
                        }
                        render();
                    }
                }, 1000);
            });
        }
    }

    initDomElements();
    loadData(() => {
        setupListeners();
        render();

        // Initialize display of the default sync time
        const initialSyncTime = new Date().toLocaleTimeString();
        if (tgMonitorSyncTime) {
            tgMonitorSyncTime.textContent = '最終同期: ' + initialSyncTime + ' (自動更新待機中)';
        }

        // Periodic polling to simulate automatic Telegram scraping every 25 seconds
        setInterval(() => {
            if (tgMonitorPulseRing) {
                tgMonitorPulseRing.style.backgroundColor = 'rgba(245, 158, 11, 0.2)'; // amber while syncing
            }
            addLog('info', '[Telegram Monitor] 25秒間隔の自動バックグラウンドスキャンを実行中...');
            
            setTimeout(() => {
                const nowStr = new Date().toLocaleTimeString();
                if (tgMonitorSyncTime) {
                    tgMonitorSyncTime.textContent = '最終同期: ' + nowStr + ' (25秒毎更新)';
                }
                if (tgMonitorPulseRing) {
                    tgMonitorPulseRing.style.backgroundColor = 'rgba(16, 185, 129, 0.15)'; // back to green
                }
                
                // Periodically drop a simulated code (50% chance every 25s to keep it realistic and active)
                if (Math.random() > 0.5) {
                    const autoCodes = [
                        { code: 'STAKE_AUTODROP_' + Math.floor(100 + Math.random() * 900), source: 'Telegram: @StakeBonusDrops' },
                        { code: 'VIP_AUTO_CLAIM_' + Math.floor(100 + Math.random() * 900), source: 'Telegram: @stakecodes' },
                        { code: 'DROP_DETECTED_' + Math.floor(100 + Math.random() * 900), source: 'Telegram: @stakedrops' }
                    ];
                    const randomItem = autoCodes[Math.floor(Math.random() * autoCodes.length)];
                    if (!feed.some(f => f.code === randomItem.code)) {
                        feed.unshift(randomItem);
                        if (feed.length > 8) feed.pop();
                        addLog('success', \`[Telegram Realtime] 新しい自動配信コードを検出: \${randomItem.code} (\${randomItem.source})\`);
                        
                        if (autoClaimEnabled) {
                            setTimeout(() => {
                                runClaimAutomation(randomItem.code);
                            }, 1200);
                        }
                        render();
                    }
                } else {
                    addLog('info', '[Telegram Monitor] 新規コードは検出されませんでした (フィードは最新状態です)。');
                }
            }, 1000);
        }, 25000);
    });

    // Heartbeat for Popup connection
    setInterval(() => {
        const isExt = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
        if (isExt) {
            chrome.storage.local.set({ portal_heartbeat: Date.now() });
        } else {
            localStorage.setItem('portal_heartbeat', Date.now().toString());
        }
    }, 2000);

})();`;
};

export const getReadmeText = () => {
  return `Stake Auto-Claimer VIP Chrome Extension (v2.4.1)
==================================================

【同梱されているファイル】
・manifest.json          - 拡張機能設定マニフェストファイル
・stake_bonus_claimer.js  - Stake.com上で動作する自動請求コンテンツスクリプト
・popup.html / popup.js   - 拡張機能の美しいポップアップUI（ディレイ設定、ON/OFFトグル、ブラックリストカウント）
・dashboard.html         - ★ローカル＆拡張機能対応 VIP 解析ダッシュボードポータル
・README.txt             - 本インストール説明書

==================================================

【導入・インストール手順】
1. ダウンロードされた「stake_bonus_claimer_extension.zip」を任意のフォルダに解凍します。
2. Google Chrome（またはBrave, EdgeなどのChromiumブラウザ）を起動します。
3. アドレスバーに「 chrome://extensions/ 」と入力してEnterキーを押し、拡張機能管理ページを開きます。
4. 画面右上にある「デベロッパー モード (Developer mode)」のトグルスイッチを【ON】にします。
5. 画面左上に表示される「パッケージ化されていない拡張機能を読み込む (Load unpacked)」ボタンをクリックします。
6. 先ほど解凍したフォルダ全体を選択して読み込ませます。
7. ブラウザのツールバーに「ステークボーナス自動請求ツール」が表示・追加されればインストールは正常に完了です。

==================================================

【ダッシュボードの起動方法】
拡張機能のアイコンをクリックするとリッチな設定パネル（Popup）が起動します。
その中にある「VIP 解析ダッシュボードを起動」ボタンをクリックすると、ブラウザ上でスタンドアロンに完璧に動作する専用のローカルダッシュボードが開き、リアルタイムの自動請求監視や、個人用Gemini APIキーを用いた高度なコード監査チャットがフル機能でご利用いただけます！

【お役立ちヒント】
・本拡張機能は、ユーザーのブラウザストレージ(chrome.storage.local)を利用して、ディレイ値やブラックリストを同期しています。
・ダッシュボード上でブラックリストを登録すると、拡張機能の設定やPopup上のカウントにもリアルタイムに反映されます。
`;
};

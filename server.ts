import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Lazy initialization of the Gemini SDK to prevent server crash on startup if key is missing
let aiInstance: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required but missing. Please set it in Settings > Secrets.");
    }
    aiInstance = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for Gemini analysis
  app.post("/api/gemini/analyze", async (req, res) => {
    try {
      const { code, question } = req.body;
      if (!code) {
        return res.status(400).json({ error: "解析するコードが指定されていません。" });
      }

      const client = getGeminiClient();

      const prompt = `
You are an expert security researcher and browser automation developer.
The user wants to analyze the following JavaScript browser userscript/extension code:

\`\`\`javascript
${code}
\`\`\`

User's Question/Request: ${question || "Explain what this script does, its core mechanisms, security implications, and how it can be optimized or made more reliable."}

Please provide a highly professional, detailed, and clean analysis in Japanese containing:
1. **概要 (Executive Summary)**: A concise 2-3 sentence overview of the script's purpose and functionality.
2. **動作メカニズムの解説 (Core Mechanisms)**: Break down how it works step-by-step (iframe avoidance, storage cache, React value setter hack, event dispatching, auto-close).
3. **セキュリティと安全性評価 (Security & Safety Audit)**: Check for credential stealing, security variables, sandbox constraints, and safety of running it.
4. **耐障害性とエッジケース (Failures & Edge Cases)**: What makes it fail? (e.g. target site CSS class updates, rate limiting, UI differences, timing delays).
5. **最適化・改善案 (Optimization Suggestions)**: How to make it faster, safer, or more compatible (e.g. using MutationObserver instead of setInterval, cleaner selectors).

Respond with high-quality markdown, proper headers, and elegant formatting. Use professional, polite Japanese (敬体).
`;

      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
      });

      res.json({ analysis: response.text });
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      res.status(500).json({ 
        error: error.message || "解析中にエラーが発生しました。Gemini APIの設定を確認してください。" 
      });
    }
  });

  // Helper to scrape a public Telegram channel's webview
  async function scrapeTelegramChannel(channelName: string) {
    const cleanHandle = channelName.replace(/^@/, '').trim();
    if (!cleanHandle) return [];
    
    const url = `https://t.me/s/${cleanHandle}`;
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) {
        console.error(`Telegram fetch failed for @${cleanHandle}: Status ${response.status}`);
        return [];
      }

      const html = await response.text();
      
      // Split by message container to isolate individual messages
      const messageBlocks = html.split('<div class="tgme_widget_message_wrap');
      const messages: any[] = [];
      
      // Skip index 0 as it represents the page head
      for (let i = 1; i < messageBlocks.length; i++) {
        const block = messageBlocks[i];
        
        // Extract Post ID / link
        const postIdMatch = block.match(/data-post="([^"]+)"/);
        const id = postIdMatch ? postIdMatch[1] : `msg-${Date.now()}-${i}`;
        
        // Extract Message Text HTML
        const textMatch = block.match(/<div class="tgme_widget_message_text[^"]*"[^>]* dir="auto">([\s\S]*?)<\/div>/) 
                      || block.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
        
        if (!textMatch) continue;
        
        const rawText = textMatch[1];
        
        // Clean tags, format line breaks
        let cleanText = rawText
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/p>/gi, '\n')
          .replace(/<[^>]+>/g, '') // Strip HTML tags
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .trim();
        
        // 1. Try to find code wrapped in <code>...</code> tags
        let code: string | null = null;
        const codeTagMatch = rawText.match(/<code>([\s\S]*?)<\/code>/);
        if (codeTagMatch) {
          const pot = codeTagMatch[1].replace(/<[^>]+>/g, '').trim();
          if (/^[a-zA-Z0-9_-]{5,35}$/.test(pot)) {
            code = pot;
          }
        }
        
        // 2. Try to extract from links e.g. stake.com/settings/offers?code=XXXX
        if (!code) {
          const linkMatch = rawText.match(/(?:settings\/offers\?code=|settings\/offers\?promo=|stake\.com\/settings\/offers\?code=)([a-zA-Z0-9_-]{5,35})/i);
          if (linkMatch) {
            code = linkMatch[1];
          }
        }
        
        // 3. Try to extract from text using general Stake bonus codes regexes
        if (!code) {
          // Look for words that are uppercase alphanumeric, 6-30 chars, contains at least one letter, avoids standard words
          const words = cleanText.split(/[\s\n\t,.:;!?()\[\]"']/);
          for (const word of words) {
            const cleanWord = word.trim();
            if (/^[A-Z0-9_]{6,30}$/.test(cleanWord) && /[A-Z]/.test(cleanWord)) {
              // Ignore common words
              const common = ['STAKE', 'TELEGRAM', 'BONUS', 'ADMIN', 'VIP', 'WELCOME', 'CLAIM', 'SETTINGS', 'OFFERS', 'PROMO', 'CODE', 'LINK', 'INFO', 'JAPAN', 'DROPS', 'WEEKLY', 'MONTHLY', 'DAILY', 'ACTIVE', 'DROP', 'ALERT'];
              if (!common.includes(cleanWord)) {
                code = cleanWord;
                break;
              }
            }
          }
        }

        // 4. Extract time info
        const timeMatch = block.match(/<time[^>]*class="[^"]*time[^"]*"[^>]*>([^<]+)<\/time>/) 
                       || block.match(/<span class="tgme_widget_message_meta">[\s\S]*?<time[^>]*>([^<]+)<\/time>/);
        const timeStr = timeMatch ? timeMatch[1].trim() : '最近';
        
        messages.push({
          id,
          author: `@${cleanHandle}`,
          text: cleanText,
          time: timeStr,
          code: code || undefined
        });
      }
      
      return messages;
    } catch (e) {
      console.error(`Scraper error for @${cleanHandle}:`, e);
      return [];
    }
  }

  // API endpoint to scrape multiple Telegram channels
  app.post("/api/telegram/fetch-bulk", async (req, res) => {
    try {
      const { channels } = req.body;
      if (!channels || !Array.isArray(channels)) {
        return res.status(400).json({ error: "有効なチャンネルの配列を指定してください。" });
      }
      
      const results = await Promise.all(
        channels.map(async (ch) => {
          const msgs = await scrapeTelegramChannel(ch);
          return { channel: ch, messages: msgs };
        })
      );
      
      res.json({ results });
    } catch (error: any) {
      console.error("Bulk Telegram Scrape Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API endpoint to fetch single Telegram channel
  app.get("/api/telegram/fetch", async (req, res) => {
    try {
      const channel = req.query.channel as string;
      if (!channel) {
        return res.status(400).json({ error: "チャンネル名が指定されていません。" });
      }
      const messages = await scrapeTelegramChannel(channel);
      res.json({ messages });
    } catch (error: any) {
      console.error("Single Telegram Scrape Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

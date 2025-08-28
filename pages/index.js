import Head from 'next/head';
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';

const MAX_HISTORY = 3;

export default function Home() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem('ai-detector-history');
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('ai-detector-history', JSON.stringify(history.slice(0, MAX_HISTORY)));
  }, [history]);

  const verdictLabel = useMemo(() => {
    if (!result) return '';
    // Support new verdict values (Human/Uncertain/AI) and legacy
    const v = result.verdictLegacy || result.verdict;
    if (v === 'ai' || v === 'AI') return 'Likely AI-generated';
    if (v === 'human' || v === 'Human') return 'Likely Human';
    return 'Uncertain / Mixed';
  }, [result]);

  const percentageLabel = useMemo(() => {
    if (!result) return '';
    const pct = Math.round(result.score ?? result.percentage ?? 0);
    return `${pct}% AI-likelihood`;
  }, [result]);

  async function handleDetect() {
    if (!text.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      setResult(data);
      setHistory((prev) => [{ timestamp: Date.now(), text, ...data }, ...prev].slice(0, MAX_HISTORY));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function copyResult() {
    if (!result) return;
    const out = `${percentageLabel} — ${verdictLabel}`;
    navigator.clipboard.writeText(out);
  }

  function shareResult() {
    if (!result) return;
    const textToShare = `${percentageLabel} — ${verdictLabel}`;
    if (navigator.share) {
      navigator.share({ title: 'AI Detector', text: textToShare, url: location.href }).catch(() => {});
    } else {
      copyResult();
      alert('Result copied to clipboard');
    }
  }

  return (
    <>
      <Head>
        <title>AI Detector</title>
        <meta name="description" content="Check if your text was written by AI or a human. Fast, private, and free." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta property="og:title" content="AI Detector" />
        <meta property="og:description" content="Check if your text was written by AI or a human. Fast, private, and free." />
        <meta property="og:type" content="website" />
      </Head>

      <main className="min-h-screen flex flex-col">
        <header className="border-b border-gray-200/60 dark:border-gray-800">
          <div className="container-max flex items-center justify-between py-4">
            <div className="flex items-center gap-2">
              <img src="/logo.svg" alt="AI Detector logo" width="32" height="32" className="h-8 w-8 rounded-xl object-contain" />
              <span className="font-semibold text-lg">AI Detector</span>
            </div>
            <button
              aria-label="Toggle theme"
              className="rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-900"
              onClick={() => mounted && setTheme((resolvedTheme === 'dark') ? 'light' : 'dark')}
            >
              {mounted ? ((resolvedTheme === 'dark') ? 'Light' : 'Dark') : 'Theme'} mode
            </button>
          </div>
        </header>

        <section className="container-max flex-1">
          <div className="text-center mt-14 mb-8">
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-3xl md:text-5xl font-bold tracking-tight"
            >
              AI Detector
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.05 }}
              className="mt-3 text-base md:text-lg text-gray-600 dark:text-gray-300"
            >
              Check if your text was written by AI or a human
            </motion.p>
          </div>

          <div className="grid gap-4">
            <motion.textarea
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              rows={10}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste or type your text here..."
              className="w-full card p-4 outline-none focus:ring-2 focus:ring-brand"
            />

            <div className="flex items-center gap-3">
              <motion.button
                whileTap={{ scale: 0.98 }}
                whileHover={{ scale: loading ? 1 : 1.01 }}
                onClick={handleDetect}
                disabled={loading || !text.trim()}
                className="btn-primary"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                    </svg>
                    Analyzing...
                  </span>
                ) : (
                  'Detect'
                )}
              </motion.button>

              <button
                onClick={copyResult}
                disabled={!result}
                className="rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-60"
              >
                Copy result
              </button>

              <button
                onClick={shareResult}
                disabled={!result}
                className="rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-60"
              >
                Share
              </button>
            </div>

            <AnimatePresence>
              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.35 }}
                  className="card p-5"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Result</div>
                      <div className="text-xl font-semibold">{percentageLabel}</div>
                    </div>
                    <span className={`px-3 py-1.5 rounded-lg text-sm font-medium ${(() => {
                      const v = result.verdictLegacy || result.verdict;
                      if (v === 'ai' || v === 'AI') return 'bg-red-500/10 text-red-600 dark:text-red-400';
                      if (v === 'human' || v === 'Human') return 'bg-green-500/10 text-green-600 dark:text-green-400';
                      return 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400';
                    })()}`}>{verdictLabel}</span>
                  </div>
                  {Array.isArray(result.highlights) && result.highlights.length > 0 && (
                    <div className="mt-3">
                      <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Suspicious sentences</div>
                      <ul className="list-disc pl-5 space-y-1 text-sm">
                        {result.highlights.slice(0, 5).map((s, i) => (
                          <li key={i} className="text-gray-700 dark:text-gray-200">{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {history.length > 0 && (
              <div className="grid gap-2">
                <div className="text-sm text-gray-500 dark:text-gray-400">Recent checks</div>
                <div className="grid gap-2">
                  {history.map((h) => (
                    <div key={h.timestamp} className="card p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {new Date(h.timestamp).toLocaleString()}
                        </div>
                        <div className="text-sm font-medium">
                          {Math.round(h.percentage)}% — {h.verdict === 'ai' ? 'AI' : 'Human'}
                        </div>
                      </div>
                      <p className="mt-2 line-clamp-3 text-sm text-gray-700 dark:text-gray-200">{h.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        <footer className="mt-12 border-t border-gray-200/60 dark:border-gray-800">
          <div className="container-max py-6 text-sm text-gray-500 dark:text-gray-400 flex items-center justify-between">
            <span>© {new Date().getFullYear()} AI Detector</span>
            <span></span>
          </div>
        </footer>
      </main>
    </>
  );
}



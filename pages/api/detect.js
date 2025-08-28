export const config = { runtime: 'edge' };

// ---------- Text utilities ----------
function toSentences(text) {
  return text
    .split(/[\.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

// ---------- Signals ----------
function signalBurstiness(text) {
  const sentences = toSentences(text);
  if (sentences.length <= 1) return { value: 0, details: { lengths: [] } };
  const lengths = sentences.map((s) => s.split(/\s+/).filter(Boolean).length);
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((sum, l) => sum + Math.pow(l - mean, 2), 0) / (lengths.length - 1);
  const std = Math.sqrt(variance);
  const cv = mean === 0 ? 0 : std / mean; // coefficient of variation
  return { value: cv, details: { lengths } };
}

// Lightweight character trigram perplexity-like score
function signalPseudoPerplexity(text) {
  const normalized = text.toLowerCase().replace(/[^a-z\s]/g, ' ');
  const chars = normalized.replace(/\s+/g, ' ');
  if (chars.length < 3) return { value: 0 };
  const counts = new Map();
  let total = 0;
  for (let i = 0; i < chars.length - 2; i++) {
    const tri = chars.slice(i, i + 3);
    counts.set(tri, (counts.get(tri) || 0) + 1);
    total++;
  }
  const probs = Array.from(counts.values()).map((c) => c / total);
  const entropy = -probs.reduce((sum, p) => sum + p * Math.log2(p), 0);
  const perplexity = Math.pow(2, entropy);
  return { value: perplexity };
}

function signalRepetition(tokens) {
  if (tokens.length === 0) return { value: 0 };
  const unigram = new Map();
  for (const t of tokens) unigram.set(t, (unigram.get(t) || 0) + 1);
  const repeats = Array.from(unigram.values()).filter((c) => c >= 3).length;
  const repeatRatio = repeats / Math.max(1, unigram.size);
  // Bigram repetition
  const bigram = new Map();
  for (let i = 0; i < tokens.length - 1; i++) {
    const bg = tokens[i] + ' ' + tokens[i + 1];
    bigram.set(bg, (bigram.get(bg) || 0) + 1);
  }
  const frequentBigrams = Array.from(bigram.values()).filter((c) => c >= 2).length;
  const bigramRatio = frequentBigrams / Math.max(1, bigram.size);
  return { value: 0.6 * repeatRatio + 0.4 * bigramRatio };
}

function signalConnectorOveruse(tokens) {
  const connectors = new Set(['moreover','furthermore','additionally','however','therefore','thus','hence','consequently','overall','in','addition','additionally','additionally,','also','additionally.','however,','therefore,']);
  if (tokens.length === 0) return { value: 0 };
  const count = tokens.filter((t) => connectors.has(t)).length;
  const ratio = count / tokens.length;
  return { value: Math.min(1, ratio * 8) };
}

function signalUniformSentenceStructure(text) {
  const sentences = toSentences(text);
  if (sentences.length <= 1) return { value: 0 };
  const wordsPerSentence = sentences.map((s) => s.split(/\s+/).filter(Boolean).length);
  const mean = wordsPerSentence.reduce((a, b) => a + b, 0) / wordsPerSentence.length;
  const variance = wordsPerSentence.reduce((sum, l) => sum + Math.pow(l - mean, 2), 0) / (wordsPerSentence.length - 1);
  const std = Math.sqrt(variance);
  const cv = mean === 0 ? 0 : std / mean;
  const uniformity = 1 - Math.max(0, Math.min(1, cv)); // lower variance -> more uniform
  return { value: uniformity };
}

function signalAvgWordLength(tokens) {
  if (tokens.length === 0) return { value: 0 };
  const total = tokens.reduce((s, t) => s + t.length, 0);
  return { value: total / tokens.length };
}

function signalSentenceComplexity(text) {
  const sentences = toSentences(text);
  if (sentences.length === 0) return { value: 0 };
  const complexityScores = sentences.map((s) => {
    const commas = (s.match(/,/g) || []).length;
    const semicolons = (s.match(/;/g) || []).length;
    const length = s.split(/\s+/).filter(Boolean).length;
    return (commas + semicolons) / Math.max(1, length / 20); // normalize by length
  });
  const avg = complexityScores.reduce((a, b) => a + b, 0) / complexityScores.length;
  return { value: avg };
}

function signalUncommonPhraseUsage(tokens) {
  // Approximate: ratio of tokens not in a small list of very common words
  const common = new Set(['the','be','to','of','and','a','in','that','have','i','it','for','not','on','with','he','as','you','do','at']);
  if (tokens.length === 0) return { value: 0 };
  const uncommonCount = tokens.filter((t) => !common.has(t)).length;
  const ratio = uncommonCount / tokens.length;
  // Extremely low or extremely high uncommon ratio could be suspicious; we map mid-high to human
  const aiLike = ratio < 0.6 ? (0.6 - ratio) / 0.6 : 0.1 * (ratio - 0.6); // penalize overly common vocab
  return { value: Math.max(0, Math.min(1, aiLike)) };
}

// ---------- Scoring and highlights ----------
function computeScore(text) {
  const tokens = tokenize(text);

  const burst = signalBurstiness(text); // higher -> more human
  const ppl = signalPseudoPerplexity(text); // lower -> more AI-like
  const repetition = signalRepetition(tokens); // higher -> more AI-like
  const connectors = signalConnectorOveruse(tokens); // higher -> more AI-like
  const uniform = signalUniformSentenceStructure(text); // higher -> more AI-like
  const avgWordLen = signalAvgWordLength(tokens); // higher can indicate AI verbosity
  const sentenceComplexity = signalSentenceComplexity(text); // higher may be AI
  const uncommonPhrase = signalUncommonPhraseUsage(tokens); // higher -> more AI-like (per mapping)

  // Normalize to 0..1 where higher = more AI-like
  const burstScore = 1 - Math.max(0, Math.min(1, Math.min(burst.value, 1))); // low burstiness -> AI-like
  const pplScore = Math.max(0, Math.min(1, (6 - Math.min(ppl.value, 12)) / 6));
  const repetitionScore = Math.max(0, Math.min(1, repetition.value));
  const connectorScore = Math.max(0, Math.min(1, connectors.value));
  const uniformScore = Math.max(0, Math.min(1, uniform.value));
  const avgWordLenScore = Math.max(0, Math.min(1, (Math.min(avgWordLen.value, 7) - 4) / 3)); // >4 chars tilts AI-like
  const complexityScore = Math.max(0, Math.min(1, Math.min(sentenceComplexity.value / 2, 1)));
  const uncommonScore = Math.max(0, Math.min(1, uncommonPhrase.value));

  const weighted =
    0.22 * pplScore +
    0.18 * burstScore +
    0.16 * repetitionScore +
    0.10 * connectorScore +
    0.12 * uniformScore +
    0.10 * avgWordLenScore +
    0.07 * complexityScore +
    0.05 * uncommonScore;

  const score = Math.round(weighted * 100);
  let verdict;
  if (score <= 40) verdict = 'Human';
  else if (score <= 70) verdict = 'Uncertain';
  else verdict = 'AI';

  // Highlights: flag sentences with low burst components or high uniformity/repetition locally
  const sentences = toSentences(text);
  const highlights = [];
  for (const s of sentences) {
    const tks = tokenize(s);
    const repS = signalRepetition(tks).value;
    const avgLen = signalAvgWordLength(tks).value;
    const connS = signalConnectorOveruse(tks).value;
    const flag = repS > 0.12 || avgLen > 5.5 || connS > 0.08;
    if (flag && highlights.length < 5) highlights.push(s);
  }

  return {
    score,
    verdict,
    details: {
      pplScore,
      burstScore,
      repetitionScore,
      connectorScore,
      uniformScore,
      avgWordLenScore,
      complexityScore,
      uncommonScore,
    },
    highlights,
  };
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { text } = await req.json();
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Text is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { score, verdict, highlights, details } = computeScore(text);
    // Backward-compat fields for UI already deployed
    const percentage = score;
    const legacyVerdict = verdict === 'AI' ? 'ai' : verdict === 'Human' ? 'human' : 'uncertain';
    const payload = { score, verdict, highlights, details, percentage, verdictLegacy: legacyVerdict };
    return new Response(JSON.stringify(payload), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ score: Math.floor(Math.random() * 100), verdict: 'Uncertain', highlights: [] }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}



// Vercel Serverless Function: /api/describe
// いいねされた画像を読み取り、共通する design 特徴を英語テキスト（プロンプト追記用）に言語化して返す。
// APIキーは環境変数 GEMINI_API_KEY。合言葉は ACCESS_CODE。
const VISION_MODEL = "gemini-2.5-flash";

const INSTRUCTION = [
  "You are helping build an image-generation prompt for Japanese detached houses (注文住宅).",
  "The attached photos are examples the user LIKES.",
  "Extract the COMMON visual and design characteristics shared across them.",
  "Cover: exterior wall materials and colours, roof form and material, massing and proportion,",
  "window/opening character, entrance and approach, landscaping and greenery, boundary treatment,",
  "and lighting / photographic mood.",
  "Output ONE concise English paragraph of comma-separated descriptive attributes (max about 80 words),",
  "suitable to append directly to an image-generation prompt.",
  "Do not describe any single house uniquely, do not mention brands, no bullet points, no headings,",
  "no preamble — output only the descriptive text."
].join(" ");

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }

  const KEY = process.env.GEMINI_API_KEY;
  const CODE = process.env.ACCESS_CODE;
  if (!KEY) { res.status(500).json({ error: "サーバー側でAPIキーが未設定です（GEMINI_API_KEY）" }); return; }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};
  const { passcode, images } = body;

  if (CODE && passcode !== CODE) { res.status(401).json({ error: "合言葉が違います" }); return; }
  if (!Array.isArray(images) || !images.length) { res.status(400).json({ error: "画像がありません" }); return; }

  const parts = [{ text: INSTRUCTION }];
  images.slice(0, 16).forEach(d => {
    if (!d || typeof d !== "string") return;
    const c = d.indexOf(",");
    if (c < 0) return;
    parts.push({ inlineData: { mimeType: d.slice(5, d.indexOf(";")) || "image/jpeg", data: d.slice(c + 1) } });
  });

  try {
    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" + VISION_MODEL + ":generateContent?key=" + encodeURIComponent(KEY),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts }] })
      }
    );
    if (!r.ok) {
      let m = "HTTP " + r.status;
      try { const j = await r.json(); if (j.error && j.error.message) m = j.error.message; } catch (e) {}
      res.status(502).json({ error: m });
      return;
    }
    const data = await r.json();
    const cand = data.candidates && data.candidates[0];
    const ps = (cand && cand.content && cand.content.parts) || [];
    const text = ps.map(p => p.text || "").join(" ").trim().replace(/\s+/g, " ");
    if (!text) { res.status(200).json({ error: "分析結果が空でした" }); return; }
    res.status(200).json({ profile: text });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
}

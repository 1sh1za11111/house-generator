// Vercel Serverless Function: /api/generate
// APIキーは環境変数 GEMINI_API_KEY に置く（コード/リポジトリには書かない）。
// 合言葉は環境変数 ACCESS_CODE に置く。ブラウザから送られた passcode と照合する。
const MODEL = "gemini-3-pro-image"; // Nano Banana Pro

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }

  const KEY = process.env.GEMINI_API_KEY;
  const CODE = process.env.ACCESS_CODE;
  if (!KEY) { res.status(500).json({ error: "サーバー側でAPIキーが未設定です（環境変数 GEMINI_API_KEY を設定してください）" }); return; }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};
  const { prompt, aspectRatio, imageSize, passcode, refs } = body;

  // 合言葉チェック（ACCESS_CODE が設定されている場合のみ）
  if (CODE && passcode !== CODE) { res.status(401).json({ error: "合言葉が違います" }); return; }
  if (!prompt) { res.status(400).json({ error: "prompt がありません" }); return; }

  const parts = [{ text: String(prompt) }];
  (Array.isArray(refs) ? refs : []).forEach(d => {
    if (!d || typeof d !== "string") return;
    const c = d.indexOf(",");
    if (c < 0) return;
    const b64 = d.slice(c + 1);
    const mime = d.slice(5, d.indexOf(";")) || "image/jpeg";
    parts.push({ inlineData: { mimeType: mime, data: b64 } });
  });

  const payload = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: { aspectRatio: aspectRatio || "1:1", imageSize: imageSize || "1K" }
    }
  };

  try {
    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" + MODEL + ":generateContent?key=" + encodeURIComponent(KEY),
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
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
    for (const p of ps) {
      const inl = p.inlineData || p.inline_data;
      if (inl && inl.data) {
        const mime = inl.mimeType || inl.mime_type || "image/png";
        res.status(200).json({ dataUrl: "data:" + mime + ";base64," + inl.data });
        return;
      }
    }
    const fr = cand && (cand.finishReason || cand.finish_reason);
    res.status(200).json({ error: fr ? ("画像なし: " + fr) : "画像が返りませんでした" });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
}

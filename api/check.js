// Vercel Serverless Function: /api/check
// 生成画像を構造・法規の観点で判定し、{pass, issues} を返す。
// APIキーは環境変数 GEMINI_API_KEY。合言葉は ACCESS_CODE。
const VISION_MODEL = "gemini-2.5-flash";

const INSTRUCTION = [
  "You are a strict architectural reviewer checking an AI-generated image of a Japanese detached house.",
  "Judge ONLY the following points:",
  "1) Balcony / terrace railing height: it must look at least about 1.1 m tall (adult chest height) measured from the balcony floor. A clearly waist-high or lower railing is a FAIL.",
  "2) Cantilever: a balcony or upper-floor overhang must not project far without visible support. A clearly impossible, deep, unsupported overhang is a FAIL.",
  "3) Roof consistency: one coherent roof design. Contradictory mixed roof types on one house, or ridge / eaves lines that do not connect, is a FAIL.",
  "4) Material consistency: roof material and wall cladding must form a realistic combination and be applied consistently. Clearly contradictory or impossible material use is a FAIL.",
  "5) Structural plausibility: floating or unsupported elements, warped or impossible geometry, is a FAIL.",
  "Be lenient: mark FAIL only when a violation is clear and obvious. If you are uncertain, PASS.",
  "Respond with STRICT JSON only, no markdown and no extra text:",
  '{"pass": true or false, "issues": ["short reason in Japanese", ...]}'
].join(" ");

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }

  const KEY = process.env.GEMINI_API_KEY;
  const CODE = process.env.ACCESS_CODE;
  if (!KEY) { res.status(500).json({ error: "サーバー側でAPIキーが未設定です（GEMINI_API_KEY）" }); return; }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};
  const { passcode, image } = body;

  if (CODE && passcode !== CODE) { res.status(401).json({ error: "合言葉が違います" }); return; }
  if (!image || typeof image !== "string" || image.indexOf(",") < 0) { res.status(400).json({ error: "画像がありません" }); return; }

  const parts = [
    { text: INSTRUCTION },
    { inlineData: { mimeType: image.slice(5, image.indexOf(";")) || "image/jpeg", data: image.slice(image.indexOf(",") + 1) } }
  ];

  try {
    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" + VISION_MODEL + ":generateContent?key=" + encodeURIComponent(KEY),
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ role: "user", parts }] }) }
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
    let text = ps.map(p => p.text || "").join(" ").trim();
    text = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    let verdict = null;
    try { verdict = JSON.parse(text); } catch (e) {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) { try { verdict = JSON.parse(m[0]); } catch (e2) {} }
    }
    // 判定できなかった場合は通す（生成を無駄に捨てない）
    if (!verdict || typeof verdict.pass !== "boolean") { res.status(200).json({ pass: true, issues: [] }); return; }
    res.status(200).json({ pass: verdict.pass, issues: Array.isArray(verdict.issues) ? verdict.issues.slice(0, 4) : [] });
  } catch (e) {
    res.status(200).json({ pass: true, issues: [], error: String((e && e.message) || e) });
  }
}

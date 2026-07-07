# 住宅外観ジェネレーター（プロキシ版 / キー秘匿）

Nano Banana Pro（Gemini 3 Pro Image）で日本の注文住宅の外観を生成するツールです。
**APIキーはサーバー側（Vercelの環境変数）に置き、ブラウザには一切出しません。** 利用者は「合言葉（パスコード）」を入れて使います。

## 構成
- `index.html` … フロント（画面）。`/api/generate` を叩くだけ。キーは持たない。
- `api/generate.js` … Vercel Serverless Function。環境変数のキーでGeminiを呼び、合言葉を照合する。

## Vercel での設定（重要）

1. このリポジトリを Vercel で Import → Deploy（Framework Preset は Other でOK）。
2. Vercel のプロジェクト → **Settings → Environment Variables** に次の2つを追加：
   - `GEMINI_API_KEY` … あなたの Gemini APIキー（課金有効化済み）
   - `ACCESS_CODE` … 利用者に共有する合言葉（例: `suumo2026` など任意）
3. 環境変数を追加したら、**Deployments → 最新のデプロイを Redeploy**（環境変数は再デプロイで反映）。

これで、公開URLを開いた人は「右上メニューに合言葉を入力 → 生成」できます。合言葉を知らない人は生成できません。キーはソースにも通信にも出ません。

## 注意
- 生成は同時最大4枚（暴走防止のため）。5枚目以降は順番待ちになります。
- 解像度は 1K / 2K。サーバー経由のため大きすぎる画像（2K）はまれに失敗することがあります。その場合は 1K でお試しください。
- 合言葉を変えたいときは `ACCESS_CODE` を変更して Redeploy してください。
- キーを無効化したいときは Google 側でキーを削除、または Vercel の `GEMINI_API_KEY` を削除して Redeploy。

## 更新のしかた
`index.html` や `api/generate.js` を変更したら `git push` すれば、Vercelが自動で再デプロイします。

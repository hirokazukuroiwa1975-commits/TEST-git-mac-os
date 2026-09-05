import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");

const app = express();
app.use(express.json({ limit: "15mb" }));
app.use(express.static(rootDir));

const client = new Anthropic();

const ReceiptSchema = z.object({
  storeName: z.string().nullable().describe("店名・発行者名。読み取れない場合はnull"),
  purchaseDate: z
    .string()
    .nullable()
    .describe("購入日。ISO 8601形式 (YYYY-MM-DD)。読み取れない場合はnull"),
  totalAmount: z
    .number()
    .nullable()
    .describe("合計金額（税込）。通貨記号を除いた数値のみ。読み取れない場合はnull"),
  itemName: z
    .string()
    .nullable()
    .describe("主な購入品の名称。複数ある場合は代表的な1つ。判別できない場合はnull"),
  rawText: z.string().describe("レシート・納品書上に見えるテキストをそのまま書き起こしたもの"),
});

const ALLOWED_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_IMAGE_BASE64_LENGTH = 10 * 1024 * 1024; // ~10MB of base64 text

app.post("/api/analyze-receipt", async (req, res) => {
  const { image, mediaType } = req.body || {};

  if (!image || typeof image !== "string") {
    return res.status(400).json({ error: "画像データ(image)が必要です。" });
  }
  if (image.length > MAX_IMAGE_BASE64_LENGTH) {
    return res.status(413).json({ error: "画像サイズが大きすぎます。" });
  }
  if (!ALLOWED_MEDIA_TYPES.has(mediaType)) {
    return res.status(400).json({ error: "対応していない画像形式です（jpeg/png/webp/gifのみ）。" });
  }

  try {
    const response = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
            {
              type: "text",
              text: "この画像は買い物の際のレシートまたは納品書です。店名、購入日、合計金額、主な購入品名を読み取ってください。読み取れない項目はnullにしてください。",
            },
          ],
        },
      ],
      output_config: { format: zodOutputFormat(ReceiptSchema) },
    });

    if (!response.parsed_output) {
      return res.status(502).json({ error: "レシートの解析に失敗しました。画像を確認してもう一度お試しください。" });
    }

    res.json(response.parsed_output);
  } catch (err) {
    console.error("analyze-receipt error:", err);
    if (err instanceof Anthropic.AuthenticationError) {
      return res.status(500).json({ error: "サーバーのAPIキー設定に問題があります。管理者に確認してください。" });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: "APIのレート制限に達しました。しばらく待ってから再度お試しください。" });
    }
    if (err instanceof Anthropic.APIError) {
      return res.status(502).json({ error: `解析APIエラー: ${err.message}` });
    }
    res.status(500).json({ error: "サーバーエラーが発生しました。" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Hobby collection tracker running at http://localhost:${PORT}`);
});

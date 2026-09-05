import express from "express";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");

// Kept outside of the statically-served directories below so it's never
// reachable over HTTP directly.
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "items.json");

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, "[]\n", "utf8");
  }
}

// Serializes writes so two near-simultaneous saves (e.g. PC + phone) can't
// interleave and corrupt the file.
let writeChain = Promise.resolve();
function persistItems(itemsArray) {
  writeChain = writeChain.then(() =>
    fs.writeFile(DATA_FILE, JSON.stringify(itemsArray, null, 2), "utf8")
  );
  return writeChain;
}

const app = express();
app.use(express.json({ limit: "15mb" }));

// Only the specific frontend assets are exposed - never the whole project
// root (which would otherwise also expose server source and stored data).
app.get(["/", "/index.html"], (req, res) => res.sendFile(path.join(rootDir, "index.html")));
app.use("/css", express.static(path.join(rootDir, "css")));
app.use("/js", express.static(path.join(rootDir, "js")));

const client = new Anthropic();

app.get("/api/items", async (req, res) => {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    res.json(Array.isArray(parsed) ? parsed : []);
  } catch (err) {
    console.error("Failed to read items:", err);
    res.status(500).json({ error: "データの読み込みに失敗しました。" });
  }
});

app.put("/api/items", async (req, res) => {
  if (!Array.isArray(req.body)) {
    return res.status(400).json({ error: "アイテムの配列(array)が必要です。" });
  }
  try {
    await persistItems(req.body);
    res.json({ ok: true });
  } catch (err) {
    console.error("Failed to save items:", err);
    res.status(500).json({ error: "データの保存に失敗しました。" });
  }
});

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
      model: "claude-sonnet-5",
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

await ensureDataFile();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Hobby collection tracker running at http://localhost:${PORT}`);
});

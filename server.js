const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const crypto = require('crypto');
const lockfile = require('proper-lockfile');

const PORT = process.env.PORT || 3000;

function loadConfig() {
  const configPath = path.join(__dirname, 'config.json');
  let fileConfig = {};
  if (fs.existsSync(configPath)) {
    try {
      fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (err) {
      console.error('config.json の読み込みに失敗しました:', err.message);
    }
  }
  const configuredDir = process.env.DATA_DIR || (fileConfig.dataDir && fileConfig.dataDir.trim());
  const dataDir = configuredDir || path.join(__dirname, 'data');
  return { dataDir: path.resolve(dataDir) };
}

const { dataDir } = loadConfig();
const postsFile = path.join(dataDir, 'posts.json');
const uploadsDir = path.join(dataDir, 'uploads');

function ensureStorage() {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(uploadsDir, { recursive: true });
  if (!fs.existsSync(postsFile)) {
    fs.writeFileSync(postsFile, '[]', 'utf8');
  }
}
ensureStorage();

async function readPosts() {
  const raw = await fsp.readFile(postsFile, 'utf8').catch(() => '[]');
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writePosts(posts) {
  const tmpFile = `${postsFile}.${process.pid}.${Date.now()}.tmp`;
  await fsp.writeFile(tmpFile, JSON.stringify(posts, null, 2), 'utf8');
  await fsp.rename(tmpFile, postsFile);
}

async function withPostsLock(fn) {
  const release = await lockfile.lock(postsFile, {
    retries: { retries: 20, minTimeout: 50, maxTimeout: 300 },
    realpath: false
  });
  try {
    const posts = await readPosts();
    const result = await fn(posts);
    await writePosts(posts);
    return result;
  } finally {
    await release();
  }
}

function newId() {
  return crypto.randomUUID();
}

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(uploadsDir, req.params.id);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const safeName = file.originalname.replace(/[/\\]/g, '_');
      cb(null, `${Date.now()}-${safeName}`);
    }
  }),
  limits: { fileSize: 20 * 1024 * 1024 }
});

app.get('/api/posts', async (req, res) => {
  const posts = await readPosts();
  posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(posts);
});

app.post('/api/posts', async (req, res) => {
  const { author, title, body } = req.body || {};
  if (!title || !title.trim() || !body || !body.trim()) {
    return res.status(400).json({ error: 'title と body は必須です' });
  }
  const post = {
    id: newId(),
    author: (author && author.trim()) || '匿名',
    title: title.trim(),
    body: body.trim(),
    createdAt: new Date().toISOString(),
    comments: [],
    attachments: []
  };
  await withPostsLock((posts) => {
    posts.push(post);
  });
  res.status(201).json(post);
});

app.post('/api/posts/:id/comments', async (req, res) => {
  const { author, body } = req.body || {};
  if (!body || !body.trim()) {
    return res.status(400).json({ error: 'body は必須です' });
  }
  let created = null;
  await withPostsLock((posts) => {
    const post = posts.find((p) => p.id === req.params.id);
    if (!post) return;
    created = {
      id: newId(),
      author: (author && author.trim()) || '匿名',
      body: body.trim(),
      createdAt: new Date().toISOString()
    };
    post.comments.push(created);
  });
  if (!created) return res.status(404).json({ error: '投稿が見つかりません' });
  res.status(201).json(created);
});

app.post('/api/posts/:id/attachments', upload.array('files', 5), async (req, res) => {
  const files = req.files || [];
  if (files.length === 0) {
    return res.status(400).json({ error: 'ファイルがありません' });
  }
  let updatedPost = null;
  await withPostsLock((posts) => {
    const post = posts.find((p) => p.id === req.params.id);
    if (!post) return;
    for (const file of files) {
      post.attachments.push({
        id: newId(),
        originalName: file.originalname,
        storedName: file.filename,
        size: file.size,
        url: `/uploads/${req.params.id}/${encodeURIComponent(file.filename)}`
      });
    }
    updatedPost = post;
  });
  if (!updatedPost) {
    return res.status(404).json({ error: '投稿が見つかりません' });
  }
  res.status(201).json(updatedPost);
});

app.listen(PORT, () => {
  console.log(`掲示板サーバーを起動しました: http://localhost:${PORT}`);
  console.log(`データ保存先: ${dataDir}`);
});

const postsContainer = document.getElementById('posts');
const newPostForm = document.getElementById('new-post-form');

async function fetchPosts() {
  const res = await fetch('/api/posts');
  const posts = await res.json();
  renderPosts(posts);
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDate(iso) {
  return new Date(iso).toLocaleString('ja-JP');
}

function renderPosts(posts) {
  postsContainer.innerHTML = '';
  if (posts.length === 0) {
    postsContainer.innerHTML = '<p class="empty">まだ投稿はありません。</p>';
    return;
  }
  for (const post of posts) {
    postsContainer.appendChild(renderPost(post));
  }
}

function renderPost(post) {
  const article = document.createElement('article');
  article.className = 'post';
  article.innerHTML = `
    <header class="post-header">
      <h2>${escapeHtml(post.title)}</h2>
      <div class="meta">${escapeHtml(post.author)} ・ ${formatDate(post.createdAt)}</div>
    </header>
    <p class="post-body">${escapeHtml(post.body)}</p>
    <div class="attachments"></div>
    <form class="attachment-form">
      <input type="file" name="files" multiple />
      <button type="submit">添付を追加</button>
    </form>
    <section class="comments"></section>
    <form class="comment-form">
      <input type="text" name="author" placeholder="お名前(省略可)" />
      <textarea name="body" placeholder="コメントを入力" required></textarea>
      <button type="submit">コメントする</button>
    </form>
  `;

  const attachmentsEl = article.querySelector('.attachments');
  for (const att of post.attachments) {
    const link = document.createElement('a');
    link.href = att.url;
    link.textContent = `📎 ${att.originalName}`;
    link.target = '_blank';
    link.rel = 'noopener';
    attachmentsEl.appendChild(link);
  }

  const commentsEl = article.querySelector('.comments');
  for (const comment of post.comments) {
    const div = document.createElement('div');
    div.className = 'comment';
    div.innerHTML = `<span class="comment-meta">${escapeHtml(comment.author)} ・ ${formatDate(comment.createdAt)}</span><p></p>`;
    div.querySelector('p').textContent = comment.body;
    commentsEl.appendChild(div);
  }

  article.querySelector('.comment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const author = form.author.value;
    const body = form.body.value;
    if (!body.trim()) return;
    await fetch(`/api/posts/${post.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author, body })
    });
    form.reset();
    fetchPosts();
  });

  article.querySelector('.attachment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const input = form.querySelector('input[type="file"]');
    if (!input.files.length) return;
    const formData = new FormData();
    for (const file of input.files) formData.append('files', file);
    await fetch(`/api/posts/${post.id}/attachments`, {
      method: 'POST',
      body: formData
    });
    form.reset();
    fetchPosts();
  });

  return article;
}

newPostForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const author = form.author.value;
  const title = form.title.value;
  const body = form.body.value;
  if (!title.trim() || !body.trim()) return;
  await fetch('/api/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ author, title, body })
  });
  form.reset();
  fetchPosts();
});

fetchPosts();
setInterval(fetchPosts, 15000);

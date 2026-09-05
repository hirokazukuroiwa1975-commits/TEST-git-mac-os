import { getAllItems, addItem, deleteItem } from './db.js';
import { compressImage } from './image.js';

const CATS = ['レコード', '本・マンガ', 'ファッション', 'その他'];
const CAT_COLOR = {
  'レコード': { bar: 'var(--teal)', bg: 'var(--teal-bg)', fg: 'var(--teal)' },
  '本・マンガ': { bar: 'var(--gold)', bg: 'var(--gold-bg)', fg: 'var(--gold)' },
  'ファッション': { bar: 'var(--rose)', bg: 'var(--rose-bg)', fg: 'var(--rose)' },
  'その他': { bar: 'var(--grey)', bg: 'var(--grey-bg)', fg: 'var(--grey)' }
};
function colorFor(cat) {
  return CAT_COLOR[cat] || { bar: 'var(--grey)', bg: 'var(--grey-bg)', fg: 'var(--grey)' };
}

let items = [];
let activeTab = 'すべて';
let newStatus = 'existing';
let pendingPhoto = null; // Blob | null
let listObjectUrls = [];
let previewObjectUrl = null;

function fmtYen(n) {
  if (n === null || n === undefined || n === '') return '';
  return '¥' + Number(n).toLocaleString('ja-JP');
}

function escapeHtml(s) {
  if (s === undefined || s === null) return '';
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove('show'), 2200);
}

async function loadItems() {
  try {
    items = await getAllItems();
  } catch (e) {
    console.error('load failed', e);
    items = [];
    showToast('データの読み込みに失敗しました');
  }
  render();
}

function allCategories() {
  const dynamic = [...new Set(items.map((i) => i.category))];
  return [...new Set([...CATS, ...dynamic])];
}

function renderStats() {
  const total = items.length;
  const thisYear = new Date().getFullYear();
  const spentThisYear = items
    .filter((i) => i.status === 'new' && i.price && i.date && new Date(i.date).getFullYear() === thisYear)
    .reduce((s, i) => s + Number(i.price), 0);
  const totalSpent = items
    .filter((i) => i.status === 'new' && i.price)
    .reduce((s, i) => s + Number(i.price), 0);

  document.getElementById('stats').innerHTML = `
    <div class="stat-box"><div class="num">${total}</div><div class="lbl">総アイテム数</div></div>
    <div class="stat-box"><div class="num">${fmtYen(spentThisYear) || '¥0'}</div><div class="lbl">${thisYear}年の購入額</div></div>
    <div class="stat-box"><div class="num">${fmtYen(totalSpent) || '¥0'}</div><div class="lbl">記録済み購入総額</div></div>
  `;
}

function renderTabs() {
  const cats = allCategories();
  const tabsEl = document.getElementById('tabs');
  const all = ['すべて', ...cats];
  tabsEl.innerHTML = all
    .map((c) => `<button class="tab ${c === activeTab ? 'active' : ''}" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`)
    .join('');
  tabsEl.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.cat;
      render();
    });
  });
}

function revokeListObjectUrls() {
  listObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  listObjectUrls = [];
}

function renderList() {
  revokeListObjectUrls();
  const listEl = document.getElementById('list');
  let filtered = activeTab === 'すべて' ? items : items.filter((i) => i.category === activeTab);
  filtered = [...filtered].sort((a, b) => {
    const da = a.date || a.createdAt;
    const db = b.date || b.createdAt;
    return db.localeCompare(da);
  });

  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="empty"><div class="big">まだ記録がありません</div>「+ アイテムを追加」から最初の1件を記録しましょう</div>`;
    return;
  }

  listEl.innerHTML = filtered
    .map((i) => {
      const c = colorFor(i.category);
      const metaBits = [];
      if (i.status === 'new') {
        if (i.date) metaBits.push(i.date);
        if (i.place) metaBits.push(i.place);
      } else {
        metaBits.push('既存所有');
      }
      let thumbSrc = '';
      if (i.photo) {
        thumbSrc = URL.createObjectURL(i.photo);
        listObjectUrls.push(thumbSrc);
      }
      const media = thumbSrc
        ? `<img class="thumb" src="${thumbSrc}">`
        : `<div class="placeholder" style="background:${c.bg};color:${c.fg}">${escapeHtml(i.category.slice(0, 1))}</div>`;
      const priceTag = i.status === 'new' && i.price ? `<div class="price-tag">${fmtYen(i.price)}</div>` : '';
      return `
        <div class="item">
          <div class="media">
            ${media}
            <span class="cat-badge" style="background:${c.bg};color:${c.fg}">${escapeHtml(i.category)}</span>
            ${i.status === 'new' ? `<span class="ribbon">NEW</span>` : ''}
            <button class="card-del" data-id="${i.id}" aria-label="削除">×</button>
            ${priceTag}
          </div>
          <div class="body">
            <div class="name">${escapeHtml(i.name)}</div>
            ${i.brand ? `<div class="brand">${escapeHtml(i.brand)}</div>` : ''}
            <div class="meta-row">${metaBits.map(escapeHtml).join(' ・ ')}</div>
            ${i.notes ? `<div class="notes">${escapeHtml(i.notes)}</div>` : ''}
          </div>
        </div>
      `;
    })
    .join('');

  listEl.querySelectorAll('.card-del').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('このアイテムを削除しますか?')) return;
      try {
        await deleteItem(btn.dataset.id);
        items = items.filter((i) => i.id !== btn.dataset.id);
        render();
      } catch (e) {
        console.error('delete failed', e);
        showToast('削除に失敗しました');
      }
    });
  });
}

function render() {
  renderStats();
  renderTabs();
  renderList();
}

function renderPhotoPreview() {
  const area = document.getElementById('photoPreviewArea');
  if (previewObjectUrl) {
    URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = null;
  }
  if (!pendingPhoto) {
    area.innerHTML = '';
    return;
  }
  previewObjectUrl = URL.createObjectURL(pendingPhoto);
  area.innerHTML = `
    <div class="photo-preview-wrap">
      <img src="${previewObjectUrl}">
      <button type="button" class="photo-remove" id="removePhotoBtn">×</button>
    </div>
  `;
  document.getElementById('removePhotoBtn').addEventListener('click', () => {
    pendingPhoto = null;
    document.getElementById('f-photo').value = '';
    renderPhotoPreview();
  });
}

function setStatus(s) {
  newStatus = s;
  document.getElementById('s-existing').classList.toggle('on', s === 'existing');
  document.getElementById('s-new').classList.toggle('on', s === 'new');
  document.getElementById('purchase-fields').style.display = s === 'new' ? 'block' : 'none';
}

function resetForm() {
  document.getElementById('f-category').value = 'レコード';
  document.getElementById('f-category-custom-wrap').style.display = 'none';
  document.getElementById('f-category-custom').value = '';
  document.getElementById('f-name').value = '';
  document.getElementById('f-brand').value = '';
  document.getElementById('f-date').value = '';
  document.getElementById('f-price').value = '';
  document.getElementById('f-place').value = '';
  document.getElementById('f-notes').value = '';
  document.getElementById('f-photo').value = '';
  pendingPhoto = null;
  renderPhotoPreview();
  setStatus('existing');
}

function openPanel() {
  document.getElementById('panel').classList.add('open');
  document.getElementById('toggleAdd').style.display = 'none';
}

function closePanel() {
  document.getElementById('panel').classList.remove('open');
  document.getElementById('toggleAdd').style.display = 'block';
  resetForm();
}

function wireForm() {
  document.getElementById('toggleAdd').addEventListener('click', openPanel);
  document.getElementById('cancelAdd').addEventListener('click', closePanel);
  document.getElementById('s-existing').addEventListener('click', () => setStatus('existing'));
  document.getElementById('s-new').addEventListener('click', () => setStatus('new'));
  document.getElementById('photoPickBtn').addEventListener('click', () => {
    document.getElementById('f-photo').click();
  });
  document.getElementById('f-photo').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      pendingPhoto = await compressImage(file);
      renderPhotoPreview();
    } catch (err) {
      console.error(err);
      alert('写真の読み込みに失敗しました');
    }
  });
  document.getElementById('f-category').addEventListener('change', (e) => {
    document.getElementById('f-category-custom-wrap').style.display =
      e.target.value === '__custom' ? 'block' : 'none';
  });

  document.getElementById('saveItem').addEventListener('click', async () => {
    const name = document.getElementById('f-name').value.trim();
    if (!name) {
      alert('タイトル・品名を入力してください');
      return;
    }
    let category = document.getElementById('f-category').value;
    if (category === '__custom') {
      category = document.getElementById('f-category-custom').value.trim();
      if (!category) {
        alert('新しいカテゴリ名を入力してください');
        return;
      }
    }

    const saveBtn = document.getElementById('saveItem');
    saveBtn.disabled = true;

    const item = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      category,
      name,
      brand: document.getElementById('f-brand').value.trim(),
      status: newStatus,
      date: newStatus === 'new' ? document.getElementById('f-date').value : '',
      price: newStatus === 'new' ? document.getElementById('f-price').value : '',
      place: newStatus === 'new' ? document.getElementById('f-place').value.trim() : '',
      notes: document.getElementById('f-notes').value.trim(),
      photo: pendingPhoto || null,
      createdAt: new Date().toISOString()
    };

    try {
      await addItem(item);
      items.push(item);
      closePanel();
      render();
      showToast('保存しました');
    } catch (err) {
      console.error('save failed', err);
      alert('保存に失敗しました。写真のサイズが大きすぎる可能性があります。');
    } finally {
      saveBtn.disabled = false;
    }
  });
}

wireForm();
loadItems();

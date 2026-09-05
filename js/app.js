(() => {
  const statusLabels = {
    owned: "所有中",
    wishlist: "欲しいもの",
    sold: "手放した",
  };

  const els = {
    form: document.getElementById("item-form"),
    formTitle: document.getElementById("form-title"),
    id: document.getElementById("item-id"),
    name: document.getElementById("item-name"),
    category: document.getElementById("item-category"),
    status: document.getElementById("item-status"),
    series: document.getElementById("item-series"),
    volume: document.getElementById("item-volume"),
    seriesList: document.getElementById("series-list"),
    date: document.getElementById("item-date"),
    price: document.getElementById("item-price"),
    store: document.getElementById("item-store"),
    url: document.getElementById("item-url"),
    tags: document.getElementById("item-tags"),
    notes: document.getElementById("item-notes"),
    submitBtn: document.getElementById("submit-btn"),
    cancelEditBtn: document.getElementById("cancel-edit-btn"),
    categoryList: document.getElementById("category-list"),
    itemList: document.getElementById("item-list"),
    emptyMessage: document.getElementById("empty-message"),
    searchInput: document.getElementById("search-input"),
    filterCategory: document.getElementById("filter-category"),
    filterStatus: document.getElementById("filter-status"),
    filterDateFrom: document.getElementById("filter-date-from"),
    filterDateTo: document.getElementById("filter-date-to"),
    sortOrder: document.getElementById("sort-order"),
    statOwnedCount: document.getElementById("stat-owned-count"),
    statTotalSpent: document.getElementById("stat-total-spent"),
    statYearSpent: document.getElementById("stat-year-spent"),
    statCategoryCount: document.getElementById("stat-category-count"),
    categoryBreakdown: document.getElementById("category-breakdown"),
    exportJsonBtn: document.getElementById("export-json-btn"),
    exportMarkdownBtn: document.getElementById("export-markdown-btn"),
    exportCsvBtn: document.getElementById("export-csv-btn"),
    importJsonInput: document.getElementById("import-json-input"),
    receiptInput: document.getElementById("receipt-input"),
    receiptStatus: document.getElementById("receipt-status"),
    photoUrl: document.getElementById("item-photo-url"),
    photoInput: document.getElementById("item-photo-input"),
    photoPreview: document.getElementById("photo-preview"),
    photoStatus: document.getElementById("photo-status"),
    removePhotoBtn: document.getElementById("remove-photo-btn"),
  };

  // Data lives on the server (server/data/items.json) so PC and phone share
  // the same list as long as both point at the same running server.
  let items = [];

  // Photo lifecycle tracking for the current form session: the photo the
  // item already had saved when editing started, and any new photos
  // uploaded during this session (which are orphans until a save confirms
  // one of them as the kept value).
  let originalPhotoUrl = null;
  let pendingPhotoUploads = [];

  async function loadItems() {
    try {
      const res = await fetch("/api/items");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error("Failed to load items", err);
      alert("サーバーからデータを読み込めませんでした。サーバー(npm start)が起動しているか確認してください。");
      return [];
    }
  }

  async function saveItems() {
    try {
      const res = await fetch("/api/items", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(items),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return true;
    } catch (err) {
      console.error("Failed to save items", err);
      return false;
    }
  }

  function uid() {
    return `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function formatYen(amount) {
    const n = Number(amount) || 0;
    return `¥${n.toLocaleString("ja-JP")}`;
  }

  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));
  }

  function setPhotoPreview(url) {
    els.photoUrl.value = url || "";
    if (url) {
      els.photoPreview.src = url;
      els.photoPreview.hidden = false;
      els.removePhotoBtn.hidden = false;
    } else {
      els.photoPreview.src = "";
      els.photoPreview.hidden = true;
      els.removePhotoBtn.hidden = true;
    }
  }

  function resetForm() {
    els.form.reset();
    els.id.value = "";
    els.status.value = "owned";
    els.formTitle.textContent = "アイテムを追加";
    els.submitBtn.textContent = "追加する";
    els.cancelEditBtn.hidden = true;
    setPhotoPreview(null);
    els.photoStatus.textContent = "";
    originalPhotoUrl = null;
    pendingPhotoUploads = [];
  }

  // Recognizes trailing volume markers like "11巻", "第11巻", "(11)", "vol.11", or a
  // bare trailing number, and splits the rest of the name off as the series name.
  function parseSeriesAndVolume(name) {
    if (!name) return null;
    const trimmed = name.trim();
    const patterns = [
      /^(?<series>.+?)[\s　]+第[\s　]*(?<vol>\d+)[\s　]*(?:巻|券)?[\s　]*$/,
      /^(?<series>.+?)[\s　]*[\(（][\s　]*(?<vol>\d+)[\s　]*[\)）][\s　]*$/,
      /^(?<series>.+?)[\s　]+vol\.?[\s　]*(?<vol>\d+)[\s　]*$/i,
      /^(?<series>.+?)[\s　]+volume[\s　]*(?<vol>\d+)[\s　]*$/i,
      /^(?<series>.+?)[\s　]+(?<vol>\d+)[\s　]*(?:巻|券)[\s　]*$/,
      /^(?<series>.+?)[\s　]+(?<vol>\d+)[\s　]*$/,
    ];

    for (const pattern of patterns) {
      const match = trimmed.match(pattern);
      if (match && match.groups) {
        const series = match.groups.series.trim();
        const vol = parseInt(match.groups.vol, 10);
        if (series && Number.isFinite(vol)) {
          return { series, volume: vol };
        }
      }
    }
    return null;
  }

  function suggestSeriesAndVolume() {
    if (els.series.value.trim() || els.volume.value.trim()) return;
    const parsed = parseSeriesAndVolume(els.name.value);
    if (parsed) {
      els.series.value = parsed.series;
      els.volume.value = parsed.volume;
    }
  }

  function startEdit(item) {
    els.id.value = item.id;
    els.name.value = item.name;
    els.category.value = item.category;
    els.status.value = item.status;
    els.series.value = item.seriesName || "";
    els.volume.value = item.volumeNumber ?? "";
    originalPhotoUrl = item.photoUrl || null;
    pendingPhotoUploads = [];
    setPhotoPreview(item.photoUrl || null);
    els.date.value = item.date || "";
    els.price.value = item.price ?? "";
    els.store.value = item.store || "";
    els.url.value = item.url || "";
    els.tags.value = (item.tags || []).join(", ");
    els.notes.value = item.notes || "";
    els.formTitle.textContent = "アイテムを編集";
    els.submitBtn.textContent = "更新する";
    els.cancelEditBtn.hidden = false;
    els.form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function getCategories() {
    return [...new Set(items.map((i) => i.category).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, "ja")
    );
  }

  function getSeriesNames() {
    return [...new Set(items.map((i) => (i.seriesName || "").trim()).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b, "ja")
    );
  }

  function refreshCategoryOptions() {
    const categories = getCategories();

    els.categoryList.innerHTML = categories
      .map((c) => `<option value="${escapeHtml(c)}"></option>`)
      .join("");

    const currentFilter = els.filterCategory.value;
    els.filterCategory.innerHTML =
      '<option value="">すべてのカテゴリ</option>' +
      categories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
    if (categories.includes(currentFilter)) {
      els.filterCategory.value = currentFilter;
    }

    els.seriesList.innerHTML = getSeriesNames()
      .map((s) => `<option value="${escapeHtml(s)}"></option>`)
      .join("");
  }

  // Collapses consecutive/owned volume numbers into a compact range string,
  // e.g. [1,2,3,5,7,8] -> "1〜3, 5, 7〜8巻".
  function formatVolumeRange(volumeNumbers) {
    const nums = [...new Set(volumeNumbers.filter((v) => Number.isFinite(v)))].sort((a, b) => a - b);
    if (nums.length === 0) return "";

    const ranges = [];
    let start = nums[0];
    let prev = nums[0];
    for (let i = 1; i <= nums.length; i++) {
      const cur = nums[i];
      if (cur === prev + 1) {
        prev = cur;
        continue;
      }
      ranges.push(start === prev ? `${start}` : `${start}〜${prev}`);
      if (cur !== undefined) {
        start = cur;
        prev = cur;
      }
    }
    return `${ranges.join(", ")}巻`;
  }

  function renderStats() {
    const owned = items.filter((i) => i.status === "owned");
    const totalSpent = items.reduce((sum, i) => sum + (Number(i.price) || 0), 0);
    const currentYear = new Date().getFullYear();
    const yearSpent = items
      .filter((i) => i.date && new Date(i.date).getFullYear() === currentYear)
      .reduce((sum, i) => sum + (Number(i.price) || 0), 0);
    const categories = getCategories();

    els.statOwnedCount.textContent = owned.length;
    els.statTotalSpent.textContent = formatYen(totalSpent);
    els.statYearSpent.textContent = formatYen(yearSpent);
    els.statCategoryCount.textContent = categories.length;

    const byCategory = {};
    items.forEach((i) => {
      const cat = i.category || "未分類";
      byCategory[cat] = (byCategory[cat] || 0) + (Number(i.price) || 0);
    });

    els.categoryBreakdown.innerHTML = Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .map(
        ([cat, total]) =>
          `<span class="category-chip">${escapeHtml(cat)}: <strong>${formatYen(total)}</strong></span>`
      )
      .join("");
  }

  function getFilteredSortedItems() {
    const query = els.searchInput.value.trim().toLowerCase();
    const categoryFilter = els.filterCategory.value;
    const statusFilter = els.filterStatus.value;
    const dateFrom = els.filterDateFrom.value;
    const dateTo = els.filterDateTo.value;
    const sortOrder = els.sortOrder.value;

    let result = items.filter((item) => {
      if (categoryFilter && item.category !== categoryFilter) return false;
      if (statusFilter && item.status !== statusFilter) return false;
      if (dateFrom || dateTo) {
        if (!item.date) return false;
        if (dateFrom && item.date < dateFrom) return false;
        if (dateTo && item.date > dateTo) return false;
      }
      if (query) {
        const haystack = [item.name, item.notes, item.seriesName, ...(item.tags || [])]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });

    result.sort((a, b) => {
      switch (sortOrder) {
        case "date-asc":
          return (a.date || "").localeCompare(b.date || "");
        case "price-desc":
          return (Number(b.price) || 0) - (Number(a.price) || 0);
        case "price-asc":
          return (Number(a.price) || 0) - (Number(b.price) || 0);
        case "name-asc":
          return a.name.localeCompare(b.name, "ja");
        case "date-desc":
        default:
          return (b.date || "").localeCompare(a.date || "");
      }
    });

    return result;
  }

  function renderItemCard(item) {
    const tagsHtml = (item.tags || [])
      .map((t) => `<span class="item-tag">#${escapeHtml(t)}</span>`)
      .join("");
    const metaParts = [];
    if (item.volumeNumber !== undefined && item.volumeNumber !== null && item.volumeNumber !== "") {
      metaParts.push(`${escapeHtml(item.volumeNumber)}巻`);
    }
    if (item.date) metaParts.push(`購入日: ${escapeHtml(item.date)}`);
    if (item.price !== undefined && item.price !== null && item.price !== "") {
      metaParts.push(`金額: ${formatYen(item.price)}`);
    }
    if (item.store) metaParts.push(`購入場所: ${escapeHtml(item.store)}`);
    if (item.url) {
      metaParts.push(`<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">参考リンク</a>`);
    }
    const thumbHtml = item.photoUrl
      ? `<img class="item-thumb" src="${escapeHtml(item.photoUrl)}" alt="">`
      : "";

    return `
    <article class="item-card" data-id="${item.id}">
      <div class="item-card-main">
        ${thumbHtml}
        <div class="item-card-body">
          <div class="item-card-header">
            <div>
              <div class="item-name">${escapeHtml(item.name)}</div>
              <div class="hint">${escapeHtml(item.category)}</div>
            </div>
            <span class="item-status ${item.status}">${statusLabels[item.status] || item.status}</span>
          </div>
          <div class="item-meta">${metaParts.join(" ・ ")}</div>
          ${item.notes ? `<div class="item-notes">${escapeHtml(item.notes)}</div>` : ""}
          ${tagsHtml ? `<div class="item-tags">${tagsHtml}</div>` : ""}
          <div class="item-actions">
            <button type="button" class="secondary edit-btn">編集</button>
            <button type="button" class="delete-btn">削除</button>
          </div>
        </div>
      </div>
    </article>`;
  }

  function renderSeriesCard(seriesName, members) {
    const sortedMembers = [...members].sort((a, b) => {
      const av = Number.isFinite(a.volumeNumber) ? a.volumeNumber : Infinity;
      const bv = Number.isFinite(b.volumeNumber) ? b.volumeNumber : Infinity;
      if (av !== bv) return av - bv;
      return (a.date || "").localeCompare(b.date || "");
    });
    const volumeRangeText = formatVolumeRange(sortedMembers.map((i) => i.volumeNumber));
    const totalPrice = members.reduce((sum, i) => sum + (Number(i.price) || 0), 0);
    const category = members[0].category;

    return `
    <article class="series-card" data-series="${escapeHtml(seriesName)}">
      <div class="series-card-header">
        <div>
          <div class="item-name">${escapeHtml(seriesName)}</div>
          <div class="hint">${escapeHtml(category)}</div>
        </div>
        <div class="series-summary">
          <span class="item-status owned">${members.length}冊${volumeRangeText ? " ・ " + volumeRangeText : ""}</span>
        </div>
      </div>
      <div class="item-meta">合計金額: ${formatYen(totalPrice)}</div>
      <button type="button" class="toggle-series-btn">巻ごとの詳細を表示</button>
      <div class="series-members" hidden>
        ${sortedMembers.map((item) => renderItemCard(item)).join("")}
      </div>
    </article>`;
  }

  function renderList() {
    const filtered = getFilteredSortedItems();
    els.emptyMessage.hidden = items.length !== 0;

    if (filtered.length === 0) {
      els.itemList.innerHTML = "";
      if (items.length > 0) {
        els.itemList.innerHTML = `<p class="empty-message">条件に一致するアイテムがありません。</p>`;
      }
      return;
    }

    // Group items that share a series name (2+ members) into one card;
    // everything else renders as an individual card, in first-seen order.
    const seenSeries = new Set();
    const html = filtered
      .map((item) => {
        const seriesKey = (item.seriesName || "").trim();
        if (!seriesKey) return renderItemCard(item);
        if (seenSeries.has(seriesKey)) return "";
        seenSeries.add(seriesKey);
        const members = filtered.filter((i) => (i.seriesName || "").trim() === seriesKey);
        return members.length >= 2 ? renderSeriesCard(seriesKey, members) : renderItemCard(item);
      })
      .join("");

    els.itemList.innerHTML = html;
  }

  function renderAll() {
    refreshCategoryOptions();
    renderStats();
    renderList();
  }

  els.form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const tags = els.tags.value
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const data = {
      name: els.name.value.trim(),
      category: els.category.value.trim(),
      status: els.status.value,
      seriesName: els.series.value.trim() || null,
      volumeNumber: els.volume.value === "" ? null : Number(els.volume.value),
      photoUrl: els.photoUrl.value || null,
      date: els.date.value,
      price: els.price.value === "" ? null : Number(els.price.value),
      store: els.store.value.trim(),
      url: els.url.value.trim(),
      tags,
      notes: els.notes.value.trim(),
    };

    if (!data.name || !data.category) return;

    // Any photo not kept as the final value is now an orphan: the item's
    // previously-saved photo (if replaced/removed) and any photo uploaded
    // during this session other than the one actually kept.
    const photosToCleanup = [];
    if (originalPhotoUrl && originalPhotoUrl !== data.photoUrl) {
      photosToCleanup.push(originalPhotoUrl);
    }
    pendingPhotoUploads.forEach((url) => {
      if (url !== data.photoUrl) photosToCleanup.push(url);
    });

    const editingId = els.id.value;
    if (editingId) {
      const idx = items.findIndex((i) => i.id === editingId);
      if (idx !== -1) {
        items[idx] = { ...items[idx], ...data, updatedAt: new Date().toISOString() };
      }
    } else {
      items.unshift({
        id: uid(),
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    resetForm();
    renderAll();
    const ok = await saveItems();
    if (!ok) {
      alert("サーバーへの保存に失敗しました。ネットワーク接続とサーバーの起動状態を確認してください。");
      return;
    }
    photosToCleanup.forEach((url) => deletePhotoFile(url));
  });

  els.cancelEditBtn.addEventListener("click", () => {
    // Discard any photo uploaded during this (now-abandoned) edit session.
    pendingPhotoUploads.forEach((url) => deletePhotoFile(url));
    resetForm();
  });

  els.name.addEventListener("blur", suggestSeriesAndVolume);

  els.itemList.addEventListener("click", async (e) => {
    if (e.target.classList.contains("toggle-series-btn")) {
      const members = e.target.closest(".series-card").querySelector(".series-members");
      const willShow = members.hidden;
      members.hidden = !willShow;
      e.target.textContent = willShow ? "巻ごとの詳細を隠す" : "巻ごとの詳細を表示";
      return;
    }

    const card = e.target.closest(".item-card");
    if (!card) return;
    const id = card.dataset.id;

    if (e.target.classList.contains("edit-btn")) {
      const item = items.find((i) => i.id === id);
      if (item) startEdit(item);
    } else if (e.target.classList.contains("delete-btn")) {
      if (confirm("このアイテムを削除しますか？")) {
        const target = items.find((i) => i.id === id);
        items = items.filter((i) => i.id !== id);
        renderAll();
        const ok = await saveItems();
        if (!ok) {
          alert("サーバーへの保存に失敗しました。ネットワーク接続とサーバーの起動状態を確認してください。");
        }
        if (target && target.photoUrl) {
          deletePhotoFile(target.photoUrl);
        }
      }
    }
  });

  [
    els.searchInput,
    els.filterCategory,
    els.filterStatus,
    els.filterDateFrom,
    els.filterDateTo,
    els.sortOrder,
  ].forEach((el) => {
    el.addEventListener("input", renderList);
    el.addEventListener("change", renderList);
  });

  function downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  els.exportJsonBtn.addEventListener("click", () => {
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadFile(`hobby-collection-${dateStr}.json`, JSON.stringify(items, null, 2), "application/json");
  });

  els.exportCsvBtn.addEventListener("click", () => {
    const headers = [
      "name",
      "category",
      "seriesName",
      "volumeNumber",
      "status",
      "date",
      "price",
      "store",
      "url",
      "tags",
      "notes",
    ];
    const rows = items.map((item) =>
      headers
        .map((h) => {
          let val = h === "tags" ? (item.tags || []).join("|") : item[h];
          val = val === undefined || val === null ? "" : String(val);
          if (val.includes(",") || val.includes('"') || val.includes("\n")) {
            val = `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        })
        .join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadFile(`hobby-collection-${dateStr}.csv`, "﻿" + csv, "text/csv");
  });

  els.exportMarkdownBtn.addEventListener("click", () => {
    const byCategory = {};
    items.forEach((item) => {
      const cat = item.category || "未分類";
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(item);
    });

    let md = `# 私の趣味コレクション\n\n`;
    md += `_出力日: ${new Date().toISOString().slice(0, 10)}_\n\n`;

    Object.keys(byCategory)
      .sort((a, b) => a.localeCompare(b, "ja"))
      .forEach((cat) => {
        md += `## ${cat}\n\n`;

        const seriesGroups = {};
        byCategory[cat].forEach((item) => {
          const key = (item.seriesName || "").trim();
          if (!key) return;
          if (!seriesGroups[key]) seriesGroups[key] = [];
          seriesGroups[key].push(item);
        });
        const seriesNames = Object.keys(seriesGroups).filter((key) => seriesGroups[key].length >= 2);
        if (seriesNames.length > 0) {
          md += `### シリーズ一覧\n\n`;
          seriesNames.sort((a, b) => a.localeCompare(b, "ja")).forEach((name) => {
            const members = seriesGroups[name];
            const range = formatVolumeRange(members.map((i) => i.volumeNumber));
            const total = members.reduce((sum, i) => sum + (Number(i.price) || 0), 0);
            md += `- ${name}: ${range}（${members.length}冊、合計${formatYen(total)}）\n`;
          });
          md += `\n`;
        }

        byCategory[cat].forEach((item) => {
          md += `### ${item.name}（${statusLabels[item.status] || item.status}）\n\n`;
          if (item.seriesName) md += `- シリーズ: ${item.seriesName}\n`;
          if (item.volumeNumber !== undefined && item.volumeNumber !== null && item.volumeNumber !== "") {
            md += `- 巻: ${item.volumeNumber}\n`;
          }
          if (item.date) md += `- 購入日: ${item.date}\n`;
          if (item.price !== undefined && item.price !== null && item.price !== "") {
            md += `- 購入金額: ${formatYen(item.price)}\n`;
          }
          if (item.store) md += `- 購入場所: ${item.store}\n`;
          if (item.url) md += `- 参考リンク: ${item.url}\n`;
          if (item.tags && item.tags.length) md += `- タグ: ${item.tags.map((t) => `#${t}`).join(" ")}\n`;
          if (item.notes) md += `\n${item.notes}\n`;
          md += `\n`;
        });
      });

    const dateStr = new Date().toISOString().slice(0, 10);
    downloadFile(`hobby-collection-${dateStr}.md`, md, "text/markdown");
  });

  els.importJsonInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const imported = JSON.parse(reader.result);
        if (!Array.isArray(imported)) throw new Error("Invalid format");
        const replace = confirm(
          "既存のデータを置き換えますか？\n「OK」で置き換え、「キャンセル」で追加します。"
        );
        if (replace) {
          items = imported;
        } else {
          const existingIds = new Set(items.map((i) => i.id));
          imported.forEach((item) => {
            if (!item.id || existingIds.has(item.id)) item.id = uid();
            items.push(item);
          });
        }
        renderAll();
        const ok = await saveItems();
        alert(ok ? "インポートが完了しました。" : "インポートしたデータのサーバーへの保存に失敗しました。");
      } catch (err) {
        alert("JSONの読み込みに失敗しました。ファイル形式を確認してください。");
        console.error(err);
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  });

  // Downscales an image file to a small thumbnail (JPEG) entirely in the
  // browser before upload, so the server never stores full-resolution photos.
  function resizeImageToBlob(file, maxDim = 480, quality = 0.82) {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(objectUrl);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("画像の変換に失敗しました"))),
          "image/jpeg",
          quality
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("画像の読み込みに失敗しました"));
      };
      img.src = objectUrl;
    });
  }

  function deletePhotoFile(url) {
    const filename = (url || "").split("/").pop();
    if (!filename) return;
    fetch(`/api/photos/${encodeURIComponent(filename)}`, { method: "DELETE" }).catch((err) => {
      console.error("Failed to delete photo file", err);
    });
  }

  els.photoInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    els.photoStatus.textContent = "アップロード中...";
    try {
      const resized = await resizeImageToBlob(file);
      const { data, mediaType } = await fileToBase64(resized);
      const response = await fetch("/api/upload-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: data, mediaType }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "アップロードに失敗しました。");
      pendingPhotoUploads.push(result.url);
      setPhotoPreview(result.url);
      els.photoStatus.textContent = "";
    } catch (err) {
      console.error(err);
      els.photoStatus.textContent = `エラー: ${err.message}`;
    } finally {
      e.target.value = "";
    }
  });

  els.removePhotoBtn.addEventListener("click", () => {
    setPhotoPreview(null);
  });

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const match = /^data:(.+);base64,(.*)$/.exec(reader.result || "");
        if (!match) {
          reject(new Error("画像の読み込みに失敗しました"));
          return;
        }
        resolve({ mediaType: match[1], data: match[2] });
      };
      reader.onerror = () => reject(new Error("ファイルの読み込みに失敗しました"));
      reader.readAsDataURL(file);
    });
  }

  els.receiptInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    els.receiptStatus.textContent = "解析中...";

    try {
      const { data, mediaType } = await fileToBase64(file);
      const response = await fetch("/api/analyze-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: data, mediaType }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "解析に失敗しました。");
      }

      if (result.itemName) {
        els.name.value = result.itemName;
        suggestSeriesAndVolume();
      }
      if (result.storeName) els.store.value = result.storeName;
      if (result.purchaseDate) els.date.value = result.purchaseDate;
      if (result.totalAmount !== null && result.totalAmount !== undefined) {
        els.price.value = result.totalAmount;
      }
      if (result.rawText) {
        const label = "[レシート読み取り内容]";
        els.notes.value = els.notes.value
          ? `${els.notes.value}\n\n${label}\n${result.rawText}`
          : `${label}\n${result.rawText}`;
      }

      els.receiptStatus.textContent = "読み取り結果をフォームに反映しました。内容を確認して保存してください。";
      els.form.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      console.error(err);
      els.receiptStatus.textContent = `エラー: ${err.message}`;
    } finally {
      e.target.value = "";
    }
  });

  async function init() {
    resetForm();
    items = await loadItems();
    renderAll();
  }

  init();
})();

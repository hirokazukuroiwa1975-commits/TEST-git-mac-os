(() => {
  const STORAGE_KEY = "hobby-collection-items-v1";

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
  };

  let items = loadItems();

  function loadItems() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error("Failed to load items", e);
      return [];
    }
  }

  function saveItems() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
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

  function resetForm() {
    els.form.reset();
    els.id.value = "";
    els.status.value = "owned";
    els.formTitle.textContent = "アイテムを追加";
    els.submitBtn.textContent = "追加する";
    els.cancelEditBtn.hidden = true;
  }

  function startEdit(item) {
    els.id.value = item.id;
    els.name.value = item.name;
    els.category.value = item.category;
    els.status.value = item.status;
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
    const sortOrder = els.sortOrder.value;

    let result = items.filter((item) => {
      if (categoryFilter && item.category !== categoryFilter) return false;
      if (statusFilter && item.status !== statusFilter) return false;
      if (query) {
        const haystack = [item.name, item.notes, ...(item.tags || [])]
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

  function renderList() {
    const filtered = getFilteredSortedItems();
    els.emptyMessage.hidden = items.length !== 0;
    els.itemList.hidden = filtered.length === 0 && items.length !== 0 ? false : false;

    if (filtered.length === 0) {
      els.itemList.innerHTML = "";
      if (items.length > 0) {
        els.itemList.innerHTML = `<p class="empty-message">条件に一致するアイテムがありません。</p>`;
      }
      return;
    }

    els.itemList.innerHTML = filtered
      .map((item) => {
        const tagsHtml = (item.tags || [])
          .map((t) => `<span class="item-tag">#${escapeHtml(t)}</span>`)
          .join("");
        const metaParts = [];
        if (item.date) metaParts.push(`購入日: ${escapeHtml(item.date)}`);
        if (item.price !== undefined && item.price !== null && item.price !== "") {
          metaParts.push(`金額: ${formatYen(item.price)}`);
        }
        if (item.store) metaParts.push(`購入場所: ${escapeHtml(item.store)}`);
        if (item.url) {
          metaParts.push(`<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">参考リンク</a>`);
        }

        return `
        <article class="item-card" data-id="${item.id}">
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
        </article>`;
      })
      .join("");
  }

  function renderAll() {
    refreshCategoryOptions();
    renderStats();
    renderList();
  }

  els.form.addEventListener("submit", (e) => {
    e.preventDefault();

    const tags = els.tags.value
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const data = {
      name: els.name.value.trim(),
      category: els.category.value.trim(),
      status: els.status.value,
      date: els.date.value,
      price: els.price.value === "" ? null : Number(els.price.value),
      store: els.store.value.trim(),
      url: els.url.value.trim(),
      tags,
      notes: els.notes.value.trim(),
    };

    if (!data.name || !data.category) return;

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

    saveItems();
    resetForm();
    renderAll();
  });

  els.cancelEditBtn.addEventListener("click", () => {
    resetForm();
  });

  els.itemList.addEventListener("click", (e) => {
    const card = e.target.closest(".item-card");
    if (!card) return;
    const id = card.dataset.id;

    if (e.target.classList.contains("edit-btn")) {
      const item = items.find((i) => i.id === id);
      if (item) startEdit(item);
    } else if (e.target.classList.contains("delete-btn")) {
      if (confirm("このアイテムを削除しますか？")) {
        items = items.filter((i) => i.id !== id);
        saveItems();
        renderAll();
      }
    }
  });

  [els.searchInput, els.filterCategory, els.filterStatus, els.sortOrder].forEach((el) => {
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
    const headers = ["name", "category", "status", "date", "price", "store", "url", "tags", "notes"];
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
        byCategory[cat].forEach((item) => {
          md += `### ${item.name}（${statusLabels[item.status] || item.status}）\n\n`;
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
    reader.onload = () => {
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
        saveItems();
        renderAll();
        alert("インポートが完了しました。");
      } catch (err) {
        alert("JSONの読み込みに失敗しました。ファイル形式を確認してください。");
        console.error(err);
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  });

  resetForm();
  renderAll();
})();

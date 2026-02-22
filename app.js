const STORAGE_KEY = "nifgati_posts_v1";

const $ = (sel) => document.querySelector(sel);

const form = $("#complaintForm");
const postsList = $("#postsList");
const yearEl = $("#year");
const searchEl = $("#search");
const filterEl = $("#filter");
const clearDraftBtn = $("#clearDraft");
const wipeAllBtn = $("#wipeAll");

yearEl.textContent = new Date().getFullYear();

function escapeHtml(str) {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function loadPosts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePosts(posts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function matchesFilters(post, query, category) {
  const q = query.trim().toLowerCase();
  const catOk = category === "all" ? true : post.category === category;

  if (!q) return catOk;

  const hay = [
    post.title,
    post.body,
    post.name,
    post.location,
    post.category,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return catOk && hay.includes(q);
}

function render() {
  const posts = loadPosts();
  const query = searchEl.value || "";
  const category = filterEl.value || "all";

  const filtered = posts.filter((p) => matchesFilters(p, query, category));

  if (filtered.length === 0) {
    postsList.innerHTML = `
      <div class="post">
        <h4 class="post-title">No posts yet</h4>
        <p class="post-body muted">When you submit a complaint, it will appear here.</p>
      </div>
    `;
    return;
  }

  postsList.innerHTML = filtered
    .map((post) => {
      const title = escapeHtml(post.title);
      const body = escapeHtml(post.body);
      const category = escapeHtml(post.category);
      const name = escapeHtml(post.name || "Anonymous");
      const loc = escapeHtml(post.location || "");
      const when = formatDate(post.createdAt);

      const metaParts = [name, loc].filter(Boolean);
      const meta = metaParts.length ? `${metaParts.join(" • ")} • ${when}` : when;

      return `
        <article class="post" data-id="${post.id}">
          <div class="post-head">
            <h4 class="post-title">${title}</h4>
            <span class="badge">${category}</span>
          </div>
          <div class="post-meta">${meta}</div>
          <p class="post-body">${body}</p>
          <div class="post-actions">
            <button class="linklike" data-action="copy">Copy link</button>
            <button class="linklike" data-action="remove">Remove (local)</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function clearForm() {
  form.reset();
}

function addPost(post) {
  const posts = loadPosts();
  posts.unshift(post);
  savePosts(posts);
  render();
}

form.addEventListener("submit", (e) => {
  e.preventDefault();

  const title = $("#title").value.trim();
  const category = $("#category").value.trim();
  const body = $("#body").value.trim();
  const name = $("#name").value.trim();
  const location = $("#location").value.trim();

  const post = {
    id: crypto.randomUUID(),
    title,
    category,
    body,
    name,
    location,
    createdAt: new Date().toISOString(),
  };

  addPost(post);
  clearForm();

  // gentle confirmation without being loud
  window.location.hash = "#posts";
});

postsList.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  const action = btn.getAttribute("data-action");
  const postEl = e.target.closest(".post");
  const id = postEl?.getAttribute("data-id");
  if (!id) return;

  const posts = loadPosts();
  const idx = posts.findIndex((p) => p.id === id);
  if (idx === -1) return;

  if (action === "remove") {
    posts.splice(idx, 1);
    savePosts(posts);
    render();
    return;
  }

  if (action === "copy") {
    const url = new URL(window.location.href);
    url.hash = `post-${id}`;
    try {
      await navigator.clipboard.writeText(url.toString());
      btn.textContent = "Copied";
      setTimeout(() => (btn.textContent = "Copy link"), 900);
    } catch {
      // fallback: select + prompt
      prompt("Copy this link:", url.toString());
    }
  }
});

clearDraftBtn.addEventListener("click", () => {
  clearForm();
});

wipeAllBtn.addEventListener("click", () => {
  const ok = confirm("Delete all local posts stored in this browser?");
  if (!ok) return;
  localStorage.removeItem(STORAGE_KEY);
  render();
});

searchEl.addEventListener("input", render);
filterEl.addEventListener("change", render);

// Optional: jump to a post if hash is post-<id>
function scrollToHashPost() {
  const hash = (window.location.hash || "").replace("#", "");
  if (!hash.startsWith("post-")) return;
  const id = hash.replace("post-", "");
  const el = document.querySelector(`.post[data-id="${id}"]`);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

window.addEventListener("hashchange", () => {
  render();
  scrollToHashPost();
});

render();
scrollToHashPost();
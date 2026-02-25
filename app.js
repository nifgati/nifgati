// Nifgati.org
// - Public feed: reads only APPROVED posts from Supabase (RLS enforces this)
// - Submissions: go through Cloudflare Worker (Turnstile verified) -> stored as PENDING

// Supabase (public read)
const SUPABASE_URL = "https://occbwdcdhljrtdlxtunq.supabase.co";
const SUPABASE_KEY = "sb_publishable_NkVM9hDUVaJdeGYkJgi-EA_VYD8wByW";
const POSTS_ENDPOINT = `${SUPABASE_URL}/rest/v1/posts`;

// Cloudflare Worker (Turnstile verify + insert)
const WORKER_ENDPOINT = "https://nifgati-submit.accounts-f74.workers.dev";

const $ = (sel) => document.querySelector(sel);

const form = $("#complaintForm");
const postsList = $("#postsList");
const yearEl = $("#year");
const statusEl = $("#formStatus");

if (yearEl) yearEl.textContent = new Date().getFullYear();

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function setStatus(msg) {
  if (!statusEl) return;
  statusEl.textContent = msg || "";
}

// Optional: auto-clear status messages after a short delay
function setStatusAutoClear(msg, ms = 6000) {
  setStatus(msg);
  if (!msg) return;
  window.setTimeout(() => setStatus(""), ms);
}

async function fetchApprovedPosts() {
  // RLS policy should restrict anon SELECT to status='approved'
  const url = `${POSTS_ENDPOINT}?select=*&order=created_at.desc`;

  try {
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });

    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function renderEmptyState() {
  if (!postsList) return;
  postsList.innerHTML = `
    <div class="post">
      <h4 class="post-title">No posts yet</h4>
      <p class="post-body muted">Approved posts will appear here.</p>
    </div>
  `;
}

async function renderPosts() {
  if (!postsList) return;

  const posts = await fetchApprovedPosts();

  if (!posts.length) {
    renderEmptyState();
    return;
  }

  postsList.innerHTML = posts
    .map((post) => {
      const title = escapeHtml(post.title);
      const body = escapeHtml(post.message);
      const category = escapeHtml(post.category);
      const name = escapeHtml(post.name || "Anonymous");
      const loc = escapeHtml(post.shiur_when || "");
      const when = formatDate(post.created_at);

      const metaParts = [name, loc].filter(Boolean);
      const meta = metaParts.length ? `${metaParts.join(" • ")} • ${when}` : when;

      return `
        <article class="post" data-id="${escapeHtml(post.id)}">
          <div class="post-head">
            <h4 class="post-title">${title}</h4>
            <span class="badge">${category}</span>
          </div>
          <div class="post-meta">${escapeHtml(meta)}</div>
          <p class="post-body">${body}</p>
        </article>
      `;
    })
    .join("");
}

function getTurnstileToken() {
  return window.turnstile?.getResponse?.() || "";
}

function resetTurnstile() {
  window.turnstile?.reset?.();
}

function getPayloadFromForm() {
  return {
    title: $("#title")?.value.trim() || "",
    category: $("#category")?.value.trim() || "",
    message: $("#body")?.value.trim() || "",
    name: $("#name")?.value.trim() || null,
    shiur_when: $("#location")?.value.trim() || null,
  };
}

async function submitToWorker(payload) {
  const res = await fetch(WORKER_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  return { ok: res.ok && data.ok, data, status: res.status };
}

async function handleSubmit(e) {
  e.preventDefault();

  setStatus("Posting...");

  const turnstileToken = getTurnstileToken();
  if (!turnstileToken) {
    setStatus("Please complete the captcha.");
    return;
  }

  const formData = getPayloadFromForm();

  // quick client-side checks (Worker will validate again)
  if (!formData.title || !formData.category || !formData.message) {
    setStatus("Please fill out the required fields.");
    return;
  }

  const payload = { ...formData, turnstileToken };

  try {
    const { ok, data } = await submitToWorker(payload);

    if (!ok) {
      setStatus(data?.error || "Error submitting post.");
      return;
    }

    form.reset();
    resetTurnstile();
    setStatusAutoClear("Your post has been sent for approval.", 6000);
    window.location.hash = "#submit";
  } catch {
    setStatus("Network error.");
  }
}

if (form) {
  form.addEventListener("submit", handleSubmit);
}

// Initial load
renderPosts();

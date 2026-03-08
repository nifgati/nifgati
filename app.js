// Nifgati.org
// Public feed reads approved posts from Supabase
// Submissions go to the Cloudflare Worker for Turnstile verification and storage as pending

const SUPABASE_URL = "https://occbwdcdhljrtdlxtunq.supabase.co";
const SUPABASE_KEY = "sb_publishable_NkVM9hDUVaJdeGYkJgi-EA_VYD8wByW";
const POSTS_ENDPOINT = `${SUPABASE_URL}/rest/v1/posts`;

const WORKER_ENDPOINT = "https://submit.nifgati.org";

const $ = (selector) => document.querySelector(selector);

const form = $("#complaintForm");
const postsList = $("#postsList");
const yearEl = $("#year");
const statusEl = $("#formStatus");

if (yearEl) {
  yearEl.textContent = new Date().getFullYear();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function setStatus(message) {
  if (!statusEl) return;
  statusEl.textContent = message || "";
}

function setStatusAutoClear(message, delay = 6000) {
  setStatus(message);
  if (!message) return;

  window.setTimeout(() => {
    setStatus("");
  }, delay);
}

async function fetchApprovedPosts() {
  const url = `${POSTS_ENDPOINT}?select=*&order=created_at.desc`;

  try {
    const response = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
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

function buildPostMarkup(post) {
  const title = escapeHtml(post.title);
  const body = escapeHtml(post.message);
  const category = escapeHtml(post.category);
  const name = escapeHtml(post.name || "Anonymous");
  const location = escapeHtml(post.shiur_when || "");
  const createdAt = formatDate(post.created_at);

  const metaParts = [name, location].filter(Boolean);
  const meta = metaParts.length ? `${metaParts.join(" • ")} • ${createdAt}` : createdAt;

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
}

async function renderPosts() {
  if (!postsList) return;

  const posts = await fetchApprovedPosts();

  if (!posts.length) {
    renderEmptyState();
    return;
  }

  postsList.innerHTML = posts.map(buildPostMarkup).join("");
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
  const response = await fetch(WORKER_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  return {
    ok: response.ok && data.ok,
    data,
    status: response.status,
  };
}

async function handleSubmit(event) {
  event.preventDefault();

  setStatus("Posting...");

  const turnstileToken = getTurnstileToken();
  if (!turnstileToken) {
    setStatus("Please complete the captcha.");
    return;
  }

  const formData = getPayloadFromForm();

  if (!formData.title || !formData.category || !formData.message) {
    setStatus("Please fill out the required fields.");
    return;
  }

  const payload = {
    ...formData,
    "cf-turnstile-response": turnstileToken,
  };

  try {
    const { ok, data } = await submitToWorker(payload);

    if (!ok) {
      setStatus(data?.error || "Error submitting post.");
      return;
    }

    form.reset();
    resetTurnstile();
    setStatusAutoClear("Your post has been sent for approval.");
    window.location.hash = "#submit";
  } catch {
    setStatus("Network error.");
  }
}

if (form) {
  form.addEventListener("submit", handleSubmit);
}

renderPosts();

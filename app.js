// Supabase config (yours)
const SUPABASE_URL = "https://occbwdcdhljrtdlxtunq.supabase.co";
const SUPABASE_KEY = "sb_publishable_NkVM9hDUVaJdeGYkJgi-EA_VYD8wByW";

// REST endpoint for your table
const POSTS_ENDPOINT = `${SUPABASE_URL}/rest/v1/posts`;

const $ = (sel) => document.querySelector(sel);

const form = $("#complaintForm");
const postsList = $("#postsList");
const yearEl = $("#year");

// If you keep the status span from my earlier suggestion, this will use it.
// If not present, it will just skip status messages.
let statusEl = $("#formStatus");

yearEl.textContent = new Date().getFullYear();

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

function setStatus(msg) {
  if (!statusEl) return;
  statusEl.textContent = msg;
}

async function fetchPosts() {
  const url = `${POSTS_ENDPOINT}?select=*&order=created_at.desc`;

  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });

  if (!res.ok) return [];
  return await res.json();
}

async function insertPost(payload) {
  const res = await fetch(POSTS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Insert failed");
  }
}

async function render() {
  const posts = await fetchPosts();

  if (!posts.length) {
    postsList.innerHTML = `
      <div class="post">
        <h4 class="post-title">No posts yet</h4>
        <p class="post-body muted">When you submit, it will appear here publicly.</p>
      </div>
    `;
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
        <article class="post" data-id="${post.id}">
          <div class="post-head">
            <h4 class="post-title">${title}</h4>
            <span class="badge">${category}</span>
          </div>
          <div class="post-meta">${meta}</div>
          <p class="post-body">${body}</p>
        </article>
      `;
    })
    .join("");
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  setStatus("Posting...");

  const payload = {
    title: $("#title").value.trim(),
    category: $("#category").value.trim(),
    message: $("#body").value.trim(),
    name: ($("#name").value.trim() || null),
    shiur_when: ($("#location").value.trim() || null),
  };

  try {
    await insertPost(payload);
    form.reset();
    setStatus("Posted.");
    window.location.hash = "#posts";
    await render();
  } catch (err) {
    console.log(err);
    setStatus("Error posting. Check Supabase RLS policies.");
  }
});

render();

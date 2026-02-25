// Nifgati.org - Public feed (approved only) + Captcha-protected submissions via Cloudflare Worker

// Supabase (public read only)
const SUPABASE_URL = "https://occbwdcdhljrtdlxtunq.supabase.co";
const SUPABASE_KEY = "sb_publishable_NkVM9hDUVaJdeGYkJgi-EA_VYD8wByW";
const POSTS_ENDPOINT = `${SUPABASE_URL}/rest/v1/posts`;

// Cloudflare Worker (handles Turnstile verification + inserts into Supabase)
const WORKER_ENDPOINT = "https://nifgati-submit.accounts-f74.workers.dev";

const $ = (sel) => document.querySelector(sel);

const form = $("#complaintForm");
const postsList = $("#postsList");
const yearEl = $("#year");
const statusEl = $("#formStatus");

if (yearEl) yearEl.textContent = new Date().getFullYear();

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
  statusEl.textContent = msg || "";
}

async function fetchApprovedPosts() {
  // RLS policy limits anon SELECT to status = 'approved'
  const url = `${POSTS_ENDPOINT}?select=*&order=created_at.desc`;

  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });

  if (!res.ok) {
    // optional: log for debugging
    // console.log("fetchApprovedPosts failed:", await res.text());
    return [];
  }

  return await res.json();
}

async function render() {
  if (!postsList) return;

  const posts = await fetchApprovedPosts();

  if (!posts.length) {
    postsList.innerHTML = `
      <div class="post">
        <h4 class="post-title">No posts yet</h4>
        <p class="post-body muted">Approved posts will appear here.</p>
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

// Submit goes to Worker (captcha verification + insert). Public never inserts directly to Supabase.
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    setStatus("Posting...");

    const turnstileToken = window.turnstile?.getResponse();
    if (!turnstileToken) {
      setStatus("Please complete the captcha.");
      return;
    }

    const payload = {
      title: $("#title")?.value.trim() || "",
      category: $("#category")?.value.trim() || "",
      message: $("#body")?.value.trim() || "",
      name: $("#name")?.value.trim() || null,
      shiur_when: $("#location")?.value.trim() || null,
      turnstileToken,
    };

    try {
      const res = await fetch(WORKER_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        setStatus(data.error || "Error submitting post.");
        return;
      }

      form.reset();
      window.turnstile?.reset();
      setStatus("Your post has been sent for approval.");

      // stay on submit section
      window.location.hash = "#submit";
    } catch (err) {
      // console.log(err);
      setStatus("Network error.");
    }
  });
}

render();

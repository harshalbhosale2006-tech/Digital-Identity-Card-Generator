/**
 * ==========================================================================
 * Digital Identity Card Generator - Core Application Script
 * Pure Vanilla JavaScript (No Frameworks, No Backend)
 * ==========================================================================
 */

// --- Default Initial Cards for Demonstration ---
const INITIAL_DEMO_CARDS = [
  {
    id: "card_1",
    fullName: "Alex Morgan",
    idNumber: "MIT-2026-1042",
    dob: "2003-05-14",
    department: "Computer Science & Engineering",
    course: "B.Tech",
    year: "3rd Year",
    semester: "Semester 6",
    email: "alex.morgan@mit.edu",
    phone: "+1 (555) 234-5678",
    bloodGroup: "O+",
    address: "742 Evergreen Terrace, Silicon Tech Park, CA",
    photo: "assets/default-avatar.svg",
    status: "active",
    issuedDate: "2026-08-15"
  },
  {
    id: "card_2",
    fullName: "Sophia Chen",
    idNumber: "MIT-2026-1189",
    dob: "2001-09-22",
    department: "Information Technology",
    course: "M.Tech",
    year: "1st Year",
    semester: "Semester 2",
    email: "sophia.chen@mit.edu",
    phone: "+1 (555) 987-6543",
    bloodGroup: "A+",
    address: "128 Innovation Way, Suite 400, Boston, MA",
    photo: "assets/default-avatar.svg",
    status: "active",
    issuedDate: "2026-08-20"
  },
  {
    id: "card_3",
    fullName: "Marcus  Johnson",
    idNumber: "MIT-2026-0925",
    dob: "2004-11-03",
    department: "Mechanical Engineering",
    course: "BCA",
    year: "2nd Year",
    semester: "Semester 4",
    email: "marcus.j@mit.edu",
    phone: "+1 (555) 456-7890",
    bloodGroup: "B+",
    address: "45 Cyber Boulevard, Metro Heights, NY",
    photo: "assets/default-avatar.svg",
    status: "pending",
    issuedDate: "2026-09-02"
  }
];

// --- 1. Backend API Manager ---
const API_BASE = (window.API_BASE_URL || `${window.location.protocol}//${window.location.hostname || "localhost"}:8080/api`)
  .replace(/\/+$/, "");

async function getCardVerificationState(card) {
  if (!card.verificationToken || !card.verificationUrl) {
    return { status: "Pending", qrBlob: null };
  }

  const token = encodeURIComponent(card.verificationToken);
  let qrBlob;
  try {
    const qrResponse = await fetch(`${API_BASE}/verify/${token}/qr.svg`, {
      headers: { Accept: "image/svg+xml" },
      cache: "no-store",
      credentials: "omit"
    });
    if (qrResponse.status === 404) return { status: "Card Not Found", qrBlob: null };
    if (!qrResponse.ok) {
      throw new Error(`QR generation returned HTTP ${qrResponse.status}.`);
    }

    const contentType = qrResponse.headers.get("Content-Type") || "";
    if (!contentType.toLowerCase().startsWith("image/svg+xml")) {
      throw new Error("QR generation returned an unexpected content type.");
    }
    qrBlob = await qrResponse.blob();
    const svg = await qrBlob.text();
    if (!/<svg(?:\s|>)/i.test(svg) || !/<path(?:\s|>)/i.test(svg)) {
      throw new Error("QR generation did not return an SVG QR image.");
    }
    qrBlob = new Blob([svg], { type: "image/svg+xml" });
  } catch (error) {
    console.error("Card QR generation failed.", error);
    return { status: "Pending", qrBlob: null };
  }

  try {
    const verificationResponse = await fetch(`${API_BASE}/verify/${token}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      credentials: "omit"
    });
    if (verificationResponse.status === 404) return { status: "Card Not Found", qrBlob: null };
    if (!verificationResponse.ok) {
      throw new Error(`Verification returned HTTP ${verificationResponse.status}.`);
    }
    const result = await verificationResponse.json();
    const cardStatus = String(result.status || "").toLowerCase();
    if (result.verified && cardStatus === "active") {
      return { status: "Verified — Active", qrBlob };
    }
    if (["active", "inactive", "pending", "blocked"].includes(cardStatus)) {
      return { status: "Card Inactive", qrBlob };
    }
    return { status: "Card Not Found", qrBlob: null };
  } catch (error) {
    console.error("Card database verification failed.", error);
    return { status: "Verification Temporarily Unavailable", qrBlob };
  }
}

async function displayCardVerificationQr(card, image, placeholder, statusElement) {
  const requestId = Number(image.dataset.verificationRequestId || 0) + 1;
  image.dataset.verificationRequestId = String(requestId);
  const isCurrentRequest = () => image.dataset.verificationRequestId === String(requestId);
  const setStatus = status => {
    if (!isCurrentRequest()) return;
    statusElement.textContent = status;
    if (placeholder) {
      const label = placeholder.querySelector("span");
      if (label) label.textContent = status;
      else placeholder.textContent = status;
    }
  };
  const clearQrImage = () => {
    image.hidden = true;
    image.removeAttribute("src");
    if (image.dataset.objectUrl) {
      URL.revokeObjectURL(image.dataset.objectUrl);
      delete image.dataset.objectUrl;
    }
  };

  clearQrImage();
  if (placeholder) placeholder.hidden = false;
  setStatus("Pending");
  const result = await getCardVerificationState(card);
  if (!isCurrentRequest()) return false;
  if (!result.qrBlob) {
    if (placeholder) placeholder.hidden = false;
    setStatus(result.status);
    return false;
  }

  const objectUrl = URL.createObjectURL(result.qrBlob);
  image.dataset.objectUrl = objectUrl;
  try {
    const imageReady = new Promise((resolve, reject) => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", () => reject(new Error("The generated QR image could not be decoded.")), { once: true });
      image.src = objectUrl;
      if (image.complete && image.naturalWidth > 0) resolve();
    });
    await imageReady;
    if (!isCurrentRequest()) return false;
    image.hidden = false;
    if (placeholder) placeholder.hidden = true;
    setStatus(result.status);
    return true;
  } catch (error) {
    if (!isCurrentRequest()) return false;
    console.error("Generated card QR could not be rendered.", error);
    clearQrImage();
    if (placeholder) placeholder.hidden = false;
    setStatus("Pending");
    return false;
  }
}

function initializeCardVerificationQrs(root) {
  root.querySelectorAll("[data-verification-token]").forEach(image => {
    const panel = image.closest(".card-qr-panel");
    const placeholder = panel && panel.querySelector("[data-qr-placeholder]");
    const status = panel && panel.querySelector("[data-qr-status]");
    if (!panel || !placeholder || !status) return;

    const card = {
      verificationToken: image.dataset.verificationToken,
      verificationUrl: image.dataset.verificationUrl
    };
    image.verificationPromise = displayCardVerificationQr(card, image, placeholder, status);
  });
}

async function apiRequest(path, options = {}) {
  if (window.location.protocol === "file:") {
    throw new Error("Open the frontend from its local web server (http://127.0.0.1:5500), not directly from file://.");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  let data = {};
  try { data = await response.json(); } catch (_) {}

  if (!response.ok) {
    const error = new Error(data.message || "Server request failed");
    error.status = response.status;
    throw error;
  }
  return data;
}

const CardStore = {
  async getAll() {
    const data = await apiRequest("/cards");
    return data.content || [];
  },

  async getById(id) {
    try {
      return await apiRequest(`/cards/${encodeURIComponent(id)}`);
    } catch (_) {
      return null;
    }
  },

  async save(cardData) {
    const method = cardData.id ? "PUT" : "POST";
    const path = cardData.id
      ? `/cards/${encodeURIComponent(cardData.id)}`
      : "/cards";

    const data = await apiRequest(path, {
      method,
      body: JSON.stringify(cardData)
    });
    return data;
  },

  async delete(id) {
    await apiRequest(`/cards/${encodeURIComponent(id)}`, { method: "DELETE" });
    return true;
  },

  async getStats() {
    return apiRequest("/cards/stats");
  }
};

// --- 2. Auth Session Manager ---
const AuthManager = {
  AUTH_KEY: "digital_id_current_user",

  getCurrentUser() {
    try {
      const user = localStorage.getItem(this.AUTH_KEY) || sessionStorage.getItem(this.AUTH_KEY);
      return user ? JSON.parse(user) : null;
    } catch (_) {
      return null;
    }
  },

  async checkSession() {
    try {
      const user = await apiRequest("/auth/me");
      localStorage.setItem(this.AUTH_KEY, JSON.stringify(user));
      return user;
    } catch (error) {
      if (error.status !== 401) throw error;
      localStorage.removeItem(this.AUTH_KEY);
      sessionStorage.removeItem(this.AUTH_KEY);
      return null;
    }
  },

  async login(identifier, password, rememberMe = true) {
    const user = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier, password })
    });

    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem(this.AUTH_KEY, JSON.stringify(user));
    return user;
  },

  async logout() {
    try {
      await apiRequest("/auth/logout", { method: "POST" });
    } catch (_) {}
    localStorage.removeItem(this.AUTH_KEY);
    sessionStorage.removeItem(this.AUTH_KEY);
    window.location.href = "login.html";
  },

  async requireAuth() {
    let user;
    try {
      user = await this.checkSession();
    } catch (error) {
      showToast(error.message || "Unable to verify your session.", "error");
      return false;
    }
    if (!user) {
      window.location.href = "login.html";
      return false;
    }
    return true;
  },

  async redirectIfLoggedIn() {
    const user = await this.checkSession();
    if (user) window.location.href = "dashboard.html";
    return !!user;
  }
};

// --- 3. Toast Notifications ---
function showToast(message, type = "success") {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  
  const icon = type === "success" 
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;

  toast.innerHTML = `${icon}<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// --- 4. Global Navigation Setup ---
async function setupNavigation() {
  const toggleBtn = document.querySelector(".btn-mobile-toggle");
  const navLinks = document.querySelector(".nav-links");
  if (toggleBtn && navLinks) {
    toggleBtn.addEventListener("click", () => {
      const isOpen = navLinks.classList.toggle("mobile-open");
      toggleBtn.setAttribute("aria-expanded", String(isOpen));
    });
  }

  // Bind logout buttons
  const logoutBtns = document.querySelectorAll(".btn-logout-action");
  logoutBtns.forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      await AuthManager.logout();
    });
  });

  // Display user name in header if element exists
  const userNameDisplay = document.querySelector(".current-user-name");
  if (userNameDisplay) {
    try {
      const currentUser = await AuthManager.checkSession();
      if (currentUser) userNameDisplay.textContent = currentUser.name;
    } catch (error) {
      showToast(error.message || "Unable to verify your session.", "error");
    }
  }
}

// ==========================================================================
// LOGIN PAGE LOGIC
// ==========================================================================
async function initLoginPage() {
  // If already logged in, redirect to dashboard
  try {
    if (await AuthManager.redirectIfLoggedIn()) return;
  } catch (error) {
    showToast(error.message || "Unable to connect to the authentication service.", "error");
  }

  const loginForm = document.getElementById("loginForm");
  const identifierInput = document.getElementById("identifier");
  const passwordInput = document.getElementById("password");
  const rememberCheckbox = document.getElementById("rememberMe");
  const togglePwdBtn = document.getElementById("togglePassword");
  const forgotPasswordLink = document.getElementById("forgotPasswordLink");

  // Toggle password visibility
  if (togglePwdBtn && passwordInput) {
    togglePwdBtn.addEventListener("click", () => {
      const isPassword = passwordInput.getAttribute("type") === "password";
      passwordInput.setAttribute("type", isPassword ? "text" : "password");
      togglePwdBtn.innerHTML = isPassword 
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
    });
  }

  // Forgot password modal/alert
  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener("click", (e) => {
      e.preventDefault();
      alert("Password reset is not available from this page. Please contact your administrator.");
    });
  }

  // Form submit handler
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearErrors();

      const identifier = identifierInput.value.trim();
      const password = passwordInput.value;
      const remember = rememberCheckbox ? rememberCheckbox.checked : true;
      let hasError = false;

      if (!identifier) {
        showInputError(identifierInput, "Please enter your username or email");
        hasError = true;
      }

      if (!password) {
        showInputError(passwordInput, "Please enter your password");
        hasError = true;
      } else if (password.length < 4) {
        showInputError(passwordInput, "Password must be at least 4 characters");
        hasError = true;
      }

      if (hasError) return;

      // Simulate successful login
      const submitBtn = loginForm.querySelector("button[type='submit']");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `Logging in...`;
      }

      try {
        await AuthManager.login(identifier, password, remember);
        showToast("Login successful! Opening dashboard...", "success");
        setTimeout(() => {
          window.location.href = "dashboard.html";
        }, 600);
      } catch (error) {
        showToast(error.message || "Invalid login credentials.", "error");
        submitBtn.disabled = false;
        submitBtn.innerHTML = "Sign In";
      }
    });
  }

  function showInputError(input, message) {
    input.classList.add("is-invalid");
    const group = input.closest(".form-group");
    const help = group ? group.querySelector(".form-help") : null;
    if (help) help.textContent = message;
  }

  function clearErrors() {
    document.querySelectorAll(".form-control").forEach(inp => inp.classList.remove("is-invalid"));
    document.querySelectorAll(".form-help").forEach(h => h.textContent = "");
  }
}

// ==========================================================================
// DASHBOARD PAGE LOGIC
// ==========================================================================
let selectedDashboardCardId = null;

async function initDashboardPage() {
  if (!(await AuthManager.requireAuth())) return;

  await renderDashboardStats();
  await renderCardsTable();

  // Search input filter
  const searchInput = document.getElementById("tableSearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const term = e.target.value.toLowerCase();
      renderCardsTable(term);
    });
  }

  // Preview modal close buttons
  const modalCloseBtns = document.querySelectorAll(".modal-close-trigger");
  modalCloseBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      closeModal();
    });
  });

  // Close modal when clicking outside modal-container
  const modalOverlay = document.getElementById("cardPreviewModal");
  if (modalOverlay) {
    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) closeModal();
    });
  }
  window.addEventListener("afterprint", () => {
    document.body.classList.remove("dashboard-print-mode");
  });

  const modalBody = document.getElementById("modalCardMount");
  if (modalBody) {
    modalBody.addEventListener("click", (event) => {
      const flipButton = event.target.closest("#dashboardFlipCardBtn");
      if (!flipButton) return;
      const perspective = modalBody.querySelector(".id-card-perspective, .category-card-perspective");
      if (!perspective) return;
      const flipped = perspective.classList.toggle("flipped");
      flipButton.textContent = flipped ? "View Front" : "Flip Card";
      flipButton.setAttribute("aria-pressed", String(flipped));
    });
  }

  const printButton = document.getElementById("dashboardPrintCardBtn");
  if (printButton) printButton.addEventListener("click", printSelectedDashboardCard);
}

async function renderDashboardStats() {
  const stats = await CardStore.getStats();
  const totalEl = document.getElementById("statTotalCards");
  const activeEl = document.getElementById("statActiveCards");
  const pendingEl = document.getElementById("statPendingCards");

  if (totalEl) totalEl.textContent = stats.total;
  if (activeEl) activeEl.textContent = stats.active;
  if (pendingEl) pendingEl.textContent = stats.pending;
}

async function renderCardsTable(filterTerm = "") {
  const tableBody = document.getElementById("cardsTableBody");
  const emptyState = document.getElementById("cardsEmptyState");
  if (!tableBody) return;

  const cards = await CardStore.getAll();
  const filtered = cards.filter(card => {
    if (!filterTerm) return true;
    const details = card.categoryDetails && typeof card.categoryDetails === "object" ? card.categoryDetails : {};
    return (
      [card.fullName, card.idNumber, card.department, card.course, card.cardType, ...Object.values(details)]
        .some(value => String(value || "").toLowerCase().includes(filterTerm))
    );
  });

  tableBody.innerHTML = "";

  if (filtered.length === 0) {
    if (emptyState) emptyState.style.display = "block";
    return;
  }

  if (emptyState) emptyState.style.display = "none";

  filtered.forEach(card => {
    const safe = value => String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    })[character]);
    const cardType = String(card.cardType || "STUDENT").toUpperCase();
    const details = card.categoryDetails && typeof card.categoryDetails === "object" ? card.categoryDetails : {};
    const isStudent = cardType === "STUDENT";
    const subtitle = isStudent
      ? `${safe(card.course)} • ${safe(card.year)}`
      : `${safe(cardType.replace("_", " "))} ID card`;
    const affiliation = isStudent
      ? safe(card.department)
      : safe(details.organization || details.eventName || details.department || details.profession || "Identity card");
    const initialStatus = isStudent ? "Pending" : String(card.status || "Pending");
    const initialStatusClass = isStudent ? "pending" : initialStatus.toLowerCase();
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div class="user-cell">
          <img src="${safe(card.photo || 'assets/default-avatar.svg')}" alt="${safe(card.fullName)}" class="table-avatar" onerror="this.src='assets/default-avatar.svg'">
          <div class="user-cell-meta">
            <span class="user-cell-name">${safe(card.fullName)}</span>
            <span class="user-cell-id">${safe(card.idNumber)}</span>
          </div>
        </div>
      </td>
      <td>
        <div><strong>${affiliation}</strong></div>
        <div style="font-size:0.8rem; color:var(--text-muted);">${subtitle}</div>
      </td>
      <td>
        <div>${safe(card.email)}</div>
        <div style="font-size:0.8rem; color:var(--text-muted);">${safe(card.phone)}</div>
      </td>
      <td>
        <span class="status-badge ${safe(initialStatusClass)}"${isStudent ? ' data-dashboard-verification-status aria-live="polite"' : ""}>
          <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:currentColor;"></span>
          <span>${safe(initialStatus)}</span>
        </span>
      </td>
      <td>
        <div class="action-buttons">
          <button class="btn btn-secondary btn-sm" onclick="openPreviewModal('${safe(card.id)}')" title="Preview ID Card">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            View
          </button>
          <button class="btn btn-outline btn-sm" onclick="triggerCardPrint('${safe(card.id)}')" title="Print ID Card">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
          </button>
          <button class="btn btn-danger btn-sm" onclick="confirmDeleteCard('${safe(card.id)}')" title="Delete Card">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </td>
    `;
    tableBody.appendChild(tr);
    if (isStudent) {
      const verificationStatus = tr.querySelector("[data-dashboard-verification-status]");
      void updateDashboardVerificationStatus(card, verificationStatus);
    }
  });
}

async function updateDashboardVerificationStatus(card, statusElement) {
  const result = await getCardVerificationState(card);
  if (!statusElement || !statusElement.isConnected) return;
  const label = statusElement.querySelector("span:last-child");
  if (label) label.textContent = result.status;
  statusElement.classList.remove("active", "pending", "inactive", "blocked");
  const statusClass = result.status === "Verified — Active"
    ? "active"
    : result.status === "Card Inactive"
      ? "inactive"
      : result.status === "Pending"
        ? "pending"
        : "blocked";
  statusElement.classList.add(statusClass);
}

async function confirmDeleteCard(id) {
  if (confirm("Are you sure you want to delete this digital identity card?")) {
    await CardStore.delete(id);
    showToast("ID Card deleted successfully", "success");
    await renderDashboardStats();
    await renderCardsTable();
  }
}

async function openPreviewModal(cardId) {
  try {
    const card = cardId
      ? await CardStore.getById(cardId)
      : (await CardStore.getAll())[0];
    if (!card) {
      showToast(cardId ? "The selected ID card could not be found." : "No cards available to preview.", "error");
      return false;
    }

    const modal = document.getElementById("cardPreviewModal");
    const modalBody = document.getElementById("modalCardMount");
    if (!modal || !modalBody) {
      showToast("The ID card preview is unavailable on this page.", "error");
      return false;
    }

    selectedDashboardCardId = String(card.id);
    modalBody.innerHTML = generateCardMarkup(card);
    initializeCardVerificationQrs(modalBody);
    modal.classList.add("active");
    return true;
  } catch (error) {
    showToast(error.message || "Could not load the selected ID card.", "error");
    return false;
  }
}

function closeModal() {
  const modal = document.getElementById("cardPreviewModal");
  if (modal) modal.classList.remove("active");
}

async function waitForCardImages(cardRoot) {
  const images = Array.from(cardRoot.querySelectorAll("img"));
  await Promise.all(images.map(async (image) => {
    if (image.verificationPromise) {
      const qrReady = await image.verificationPromise;
      if (image.dataset.verificationToken && !qrReady) {
        throw new Error("The verification QR is not available to print yet.");
      }
    }
    if (image.hidden && !image.getAttribute("src")) return;
    if (image.complete && image.naturalWidth > 0) return;
    if (image.complete && image.naturalWidth === 0) {
      throw new Error("A card image or QR code could not be loaded.");
    }
    if (typeof image.decode === "function") {
      await image.decode();
      return;
    }
    await new Promise((resolve, reject) => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", () => reject(new Error("A card image or QR code could not be loaded.")), { once: true });
    });
    if (image.naturalWidth === 0) throw new Error("A card image or QR code could not be loaded.");
  }));
}

async function printSelectedDashboardCard() {
  const cardRoot = document.querySelector("#modalCardMount .id-card-perspective, #modalCardMount .category-card-perspective");
  if (!selectedDashboardCardId || !cardRoot) {
    showToast("Open a saved ID card before printing.", "error");
    return;
  }

  try {
    await waitForCardImages(cardRoot);
    document.body.classList.add("dashboard-print-mode");
    window.print();
  } catch (error) {
    document.body.classList.remove("dashboard-print-mode");
    showToast(error.message || "The ID card could not be prepared for printing.", "error");
  }
}

function triggerCardPrint(cardId) {
  void (async () => {
    const opened = await openPreviewModal(cardId);
    if (!opened || selectedDashboardCardId !== String(cardId)) return;
    await printSelectedDashboardCard();
  })();
}

// ==========================================================================
// CREATE CARD & REAL-TIME PREVIEW LOGIC
// ==========================================================================
const ADDITIONAL_CARD_TYPES = {
  EMPLOYEE: {
    title: "Employee ID Card",
    description: "An employee identity card for staff and organization personnel.",
    organizationKey: "organization",
    fields: [
      { key: "jobTitle", label: "Job title", required: true, type: "text" },
      { key: "department", label: "Department", required: true, type: "text" },
      { key: "organization", label: "Organization", required: true, type: "text" },
      { key: "startDate", label: "Start date", required: true, type: "date" }
    ]
  },
  PERSONAL: {
    title: "Personal ID Card",
    description: "A personal identity card with optional date of birth and nationality.",
    fields: [
      { key: "birthDate", label: "Date of birth", required: false, type: "date" },
      { key: "nationality", label: "Nationality", required: false, type: "text" }
    ]
  },
  MEMBER: {
    title: "Organization / Member ID Card",
    description: "A membership card for an organization, club, association or community.",
    organizationKey: "organization",
    fields: [
      { key: "organization", label: "Organization", required: true, type: "text" },
      { key: "membershipType", label: "Membership type", required: true, type: "text" },
      { key: "memberSince", label: "Member since", required: true, type: "date" },
      { key: "memberUntil", label: "Member until", required: false, type: "date" }
    ]
  },
  EVENT: {
    title: "Event ID Card",
    description: "An event-specific badge for attendees, volunteers, speakers and staff.",
    organizationKey: "eventName",
    fields: [
      { key: "eventName", label: "Event name", required: true, type: "text" },
      { key: "role", label: "Role", required: true, type: "text" },
      { key: "date", label: "Event date", required: true, type: "date" },
      { key: "venue", label: "Venue", required: true, type: "text" }
    ]
  },
  FREELANCER: {
    title: "Freelancer ID Card",
    description: "A professional identity card for independent specialists.",
    fields: [
      { key: "profession", label: "Profession", required: true, type: "text" },
      { key: "specialty", label: "Service / specialty", required: true, type: "text" },
      { key: "portfolioUrl", label: "Portfolio URL", required: false, type: "url" }
    ]
  }
};

async function initCategoryCardPage() {
  if (!(await AuthManager.requireAuth())) return;

  const type = new URLSearchParams(window.location.search).get("type") || "";
  const config = ADDITIONAL_CARD_TYPES[type];
  if (!config) {
    window.location.replace("card-categories.html");
    return;
  }

  const form = document.getElementById("categoryCardForm");
  const categoryFields = document.getElementById("categorySpecificFields");
  const submitButton = form.querySelector('button[type="submit"]');
  const fileInput = document.getElementById("categoryPhoto");
  const errorBox = document.getElementById("categoryFormError");
  const previewDetails = document.getElementById("categoryPreviewDetails");
  const state = { photo: "", flipped: false };

  document.title = `${config.title} - Digital Identity Card Generator`;
  document.getElementById("categoryPageTitle").textContent = config.title;
  document.getElementById("categoryPageDescription").textContent = config.description;
  document.getElementById("categoryPreviewTitle").textContent = config.title;
  document.getElementById("previewCategoryLabel").textContent = config.title.toUpperCase();
  document.getElementById("previewType").textContent = config.title.toUpperCase();
  document.getElementById("previewBackCategory").textContent = config.title.toUpperCase();
  document.getElementById("categoryCardPerspective").dataset.cardType = type.toLowerCase();
  categoryFields.innerHTML = config.fields.map(field => `
    <div class="form-group">
      <label class="form-label" for="categoryDetail-${field.key}">${field.label}
        ${field.required ? '<span class="required">*</span>' : '<span class="optional-label">Optional</span>'}
      </label>
      <input class="form-control no-icon" id="categoryDetail-${field.key}" name="${field.key}" type="${field.type}"
        maxlength="200" ${field.required ? "required" : ""} ${field.type === "url" ? 'placeholder="https://example.com"' : ""}>
      <div class="form-help"></div>
    </div>`).join("");

  const escaped = value => String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  })[character]);
  const setPreviewText = (id, value, fallback) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value || fallback;
  };
  const updatePreview = () => {
    const name = document.getElementById("categoryName").value.trim();
    const idNumber = document.getElementById("categoryId").value.trim();
    const email = document.getElementById("categoryEmail").value.trim();
    const phone = document.getElementById("categoryPhone").value.trim();
    const values = Object.fromEntries(config.fields.map(field => [
      field.key, document.getElementById(`categoryDetail-${field.key}`).value.trim()
    ]));
    setPreviewText("previewName", name, "Cardholder Name");
    setPreviewText("previewBackName", name, "Cardholder Name");
    setPreviewText("previewId", idNumber, "CARD-ID");
    setPreviewText("previewBackId", idNumber, "CARD-ID");
    setPreviewText("previewOrganization", values[config.organizationKey], "DIGITAL IDENTITY");
    setPreviewText("previewPrimaryDetail", config.fields.map(field => values[field.key]).find(Boolean), "Additional details");
    setPreviewText("previewContact", [email, phone].filter(Boolean).join(" · ") || "Contact details are optional");
    previewDetails.innerHTML = config.fields.filter(field => values[field.key]).map(field =>
      `<div><dt>${escaped(field.label)}</dt><dd>${escaped(field.type === "date" ? formatDate(values[field.key]) : values[field.key])}</dd></div>`
    ).join("");
  };
  form.addEventListener("input", updatePreview);
  form.addEventListener("change", updatePreview);

  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type) || file.size > 4 * 1024 * 1024) {
      fileInput.value = "";
      showToast("Choose a PNG, JPEG, WebP or GIF image smaller than 4 MB.", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = event => {
      if (typeof event.target.result !== "string") {
        showToast("Could not read the selected profile photo.", "error");
        return;
      }
      state.photo = event.target.result;
      document.getElementById("categoryPreviewPhoto").src = state.photo;
    };
    reader.onerror = () => showToast("Could not read the selected profile photo.", "error");
    reader.readAsDataURL(file);
  });

  document.getElementById("categoryFlipBtn").addEventListener("click", event => {
    state.flipped = !state.flipped;
    document.getElementById("categoryCardPerspective").classList.toggle("flipped", state.flipped);
    event.currentTarget.textContent = state.flipped ? "View Front" : "Flip Card";
    event.currentTarget.setAttribute("aria-pressed", String(state.flipped));
  });

  document.getElementById("categoryPrintBtn").addEventListener("click", async () => {
    try {
      await waitForCardImages(document.getElementById("categoryCardPerspective"));
    } catch (error) {
      showToast(error.message || "The ID card could not be prepared for printing.", "error");
      return;
    }
    state.flipped = false;
    document.getElementById("categoryCardPerspective").classList.remove("flipped");
    document.body.classList.add("category-card-print-mode");
    window.addEventListener("afterprint", () => document.body.classList.remove("category-card-print-mode"), { once: true });
    window.print();
  });

  document.getElementById("categoryResetBtn").addEventListener("click", () => {
    form.reset();
    state.photo = "";
    document.getElementById("categoryPreviewPhoto").src = "assets/default-avatar.svg";
    errorBox.hidden = true;
    form.querySelectorAll(".is-invalid").forEach(field => field.classList.remove("is-invalid"));
    form.querySelectorAll(".form-help").forEach(help => help.textContent = "");
    updatePreview();
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    errorBox.hidden = true;
    form.querySelectorAll(".is-invalid").forEach(field => field.classList.remove("is-invalid"));
    form.querySelectorAll(".form-help").forEach(help => {
      if (!help.id) help.textContent = "";
    });

    const name = document.getElementById("categoryName");
    const idNumber = document.getElementById("categoryId");
    const email = document.getElementById("categoryEmail");
    const requiredFields = [
      { element: name, message: "Name is required." },
      { element: idNumber, message: "A unique ID is required." },
      ...config.fields.filter(field => field.required).map(field => ({
        element: document.getElementById(`categoryDetail-${field.key}`),
        message: `${field.label} is required.`
      }))
    ];
    const missing = requiredFields.find(field => !field.element.value.trim());
    if (missing) {
      missing.element.classList.add("is-invalid");
      missing.element.closest(".form-group").querySelector(".form-help").textContent = missing.message;
      missing.element.focus();
      return;
    }
    if (email.value && !email.validity.valid) {
      email.classList.add("is-invalid");
      email.closest(".form-group").querySelector(".form-help").textContent = "Enter a valid email address.";
      email.focus();
      return;
    }
    const portfolio = document.getElementById("categoryDetail-portfolioUrl");
    if (portfolio && portfolio.value.trim() && !portfolio.validity.valid) {
      portfolio.classList.add("is-invalid");
      portfolio.closest(".form-group").querySelector(".form-help").textContent = "Enter a valid HTTP or HTTPS portfolio URL.";
      portfolio.focus();
      return;
    }

    const categoryDetails = Object.fromEntries(config.fields.map(field => [
      field.key, document.getElementById(`categoryDetail-${field.key}`).value.trim()
    ]).filter(([, value]) => value));
    const card = {
      cardType: type,
      fullName: name.value.trim(),
      idNumber: idNumber.value.trim(),
      email: email.value.trim(),
      phone: document.getElementById("categoryPhone").value.trim(),
      photo: state.photo,
      categoryDetails
    };
    if (submitButton) submitButton.disabled = true;
    try {
      await CardStore.save(card);
      showToast(`${config.title} saved. This card is not officially verified.`, "success");
      window.location.assign("dashboard.html");
    } catch (error) {
      errorBox.textContent = error.message || "The ID card could not be saved.";
      errorBox.hidden = false;
      if (error.status === 409) idNumber.classList.add("is-invalid");
      if (submitButton) submitButton.disabled = false;
    }
  });
  updatePreview();
}

async function initCreateCardPage() {
  if (!(await AuthManager.requireAuth())) return;

  const form = document.getElementById("idCardForm");
  const resetBtn = document.getElementById("resetFormBtn");
  const sampleBtn = document.getElementById("sampleDataBtn");
  const flipCardBtn = document.getElementById("flipCardBtn");
  const printCardBtn = document.getElementById("printCardBtn");
  const photoFileInput = document.getElementById("photoFileInput");
  const photoUploadBtn = document.getElementById("photoUploadBtn");
  const photoUploadZone = document.querySelector(".photo-upload-zone");
  const previewQrCode = document.getElementById("previewQrCode");
  const previewQrPlaceholder = document.getElementById("previewQrPlaceholder");
  const previewVerificationState = document.getElementById("previewVerificationState");

  // Keep an active card data model
  let currentCardData = {
    fullName: "Alex Morgan",
    idNumber: "MIT-2026-1042",
    dob: "2003-05-14",
    department: "Computer Science & Engineering",
    course: "B.Tech",
    year: "3rd Year",
    semester: "Semester 6",
    email: "alex.morgan@mit.edu",
    phone: "+1 (555) 234-5678",
    bloodGroup: "O+",
    address: "742 Evergreen Terrace, Silicon Tech Park, CA",
    photo: "assets/default-avatar.svg",
    status: "active"
  };

  function showPreviewOnly() {
    if (previewQrCode) {
      const requestId = Number(previewQrCode.dataset.verificationRequestId || 0) + 1;
      previewQrCode.dataset.verificationRequestId = String(requestId);
      previewQrCode.verificationPromise = null;
      previewQrCode.hidden = true;
      previewQrCode.removeAttribute("src");
      if (previewQrCode.dataset.objectUrl) {
        URL.revokeObjectURL(previewQrCode.dataset.objectUrl);
        delete previewQrCode.dataset.objectUrl;
      }
    }
    if (previewQrPlaceholder) previewQrPlaceholder.hidden = false;
    if (previewQrPlaceholder) {
      const label = previewQrPlaceholder.querySelector("span");
      if (label) label.textContent = "Pending";
    }
    if (previewVerificationState) previewVerificationState.textContent = "Pending";
  }

  function showSavedVerification(card) {
    if (!previewQrCode || !previewVerificationState) return;
    previewQrCode.verificationPromise = displayCardVerificationQr(
      card, previewQrCode, previewQrPlaceholder, previewVerificationState);
  }

  showPreviewOnly();

  // Profile photo file picker trigger
  if (photoUploadBtn && photoFileInput) {
    photoUploadBtn.addEventListener("click", () => photoFileInput.click());
  }

  function handlePhotoFile(file) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("Please upload an image file (JPG, PNG, WebP).", "error");
      if (photoFileInput) photoFileInput.value = "";
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      showToast("Image size must be less than 4MB.", "error");
      if (photoFileInput) photoFileInput.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target.result !== "string") {
        showToast("Could not read the selected image.", "error");
        return;
      }

      currentCardData.photo = event.target.result;
      showPreviewOnly();

      const formThumb = document.getElementById("photoThumbnail");
      if (formThumb) formThumb.src = event.target.result;

      const previewPhoto = document.getElementById("cardPreviewPhoto");
      if (previewPhoto) previewPhoto.src = event.target.result;

      showToast("Photo uploaded successfully!");
    };
    reader.onerror = () => showToast("Could not read the selected image.", "error");
    reader.readAsDataURL(file);
  }

  if (photoFileInput) {
    photoFileInput.addEventListener("change", () => handlePhotoFile(photoFileInput.files[0]));
  }

  if (photoUploadZone) {
    photoUploadZone.addEventListener("dragover", (event) => {
      event.preventDefault();
      photoUploadZone.classList.add("is-dragging");
    });
    photoUploadZone.addEventListener("dragleave", (event) => {
      if (!event.relatedTarget || !photoUploadZone.contains(event.relatedTarget)) {
        photoUploadZone.classList.remove("is-dragging");
      }
    });
    photoUploadZone.addEventListener("drop", (event) => {
      event.preventDefault();
      photoUploadZone.classList.remove("is-dragging");
      handlePhotoFile(event.dataTransfer.files[0]);
    });
  }

  // Bind live form inputs to card preview
  const inputsToSync = [
    { inputId: "fullName", cardTargetId: "previewFullName", fallback: "Your Full Name" },
    { inputId: "idNumber", cardTargetId: "previewIdNumber", fallback: "MIT-2026-XXXX" },
    { inputId: "dob", cardTargetId: "previewDob", fallback: "DD/MM/YYYY", format: 'date' },
    { inputId: "department", cardTargetId: "previewDepartment", fallback: "Department" },
    { inputId: "course", cardTargetId: "previewCourse", fallback: "Course / Program" },
    { inputId: "bloodGroup", cardTargetId: "previewBloodGroupText", fallback: "O+" },
    { inputId: "email", cardTargetId: "previewEmail", fallback: "email@institute.edu" },
    { inputId: "phone", cardTargetId: "previewPhone", fallback: "+1 (555) 000-0000" },
    { inputId: "address", cardTargetId: "previewAddress", fallback: "Campus Address / City" }
  ];

  inputsToSync.forEach(mapping => {
    const el = document.getElementById(mapping.inputId);
    if (!el) return;

    const syncPreviewField = () => {
      showPreviewOnly();
      const val = el.value.trim();
      currentCardData[mapping.inputId] = val;
      const targetEl = document.getElementById(mapping.cardTargetId);
      if (targetEl) {
        if (mapping.format === 'date' && val) {
          targetEl.textContent = formatDate(val);
        } else {
          targetEl.textContent = val || mapping.fallback;
        }
      }
      if (mapping.inputId === "bloodGroup") {
        const bloodDrop = document.querySelector(".card-blood-drop");
        if (bloodDrop) bloodDrop.setAttribute("aria-label", `Blood group ${val || mapping.fallback}`);
      }
      // Also update back-card address if applicable
      if (mapping.inputId === "address") {
        const backAddr = document.getElementById("previewBackAddress");
        if (backAddr) backAddr.textContent = val || mapping.fallback;
      }
      const backTargets = {
        idNumber: "previewBackId",
        dob: "previewBackDob",
        email: "previewBackEmail",
        phone: "previewBackPhone"
      };
      const backTarget = backTargets[mapping.inputId];
      const backEl = backTarget && document.getElementById(backTarget);
      if (backEl) backEl.textContent = val || mapping.fallback;
    };
    el.addEventListener("input", syncPreviewField);
    el.addEventListener("change", syncPreviewField);
  });

  // Year & Semester combine sync
  const yearSelect = document.getElementById("year");
  const semesterSelect = document.getElementById("semester");
  function syncYearSemester() {
    showPreviewOnly();
    const yVal = yearSelect ? yearSelect.value : "";
    const sVal = semesterSelect ? semesterSelect.value : "";
    const previewYearSem = document.getElementById("previewYearSem");
    if (previewYearSem) {
      if (yVal && sVal) {
        previewYearSem.textContent = `${yVal} • ${sVal}`;
      } else if (yVal) {
        previewYearSem.textContent = yVal;
      } else if (sVal) {
        previewYearSem.textContent = sVal;
      } else {
        previewYearSem.textContent = "Year / Sem";
      }
    }
    currentCardData.year = yVal;
    currentCardData.semester = sVal;
  }

  if (yearSelect) yearSelect.addEventListener("change", syncYearSemester);
  if (semesterSelect) semesterSelect.addEventListener("change", syncYearSemester);

  // Flip Card 3D animation
  if (flipCardBtn) {
    flipCardBtn.addEventListener("click", () => {
      const perspective = document.querySelector(".id-card-perspective");
      if (perspective) {
        perspective.classList.toggle("flipped");
        const isFlipped = perspective.classList.contains("flipped");
        flipCardBtn.innerHTML = isFlipped
          ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg> View Front`
          : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg> Flip Card`;
      }
    });
  }

  // Print Card trigger
  if (printCardBtn) {
    printCardBtn.addEventListener("click", async () => {
      // Ensure front side is visible when printing
      const perspective = document.querySelector(".id-card-perspective");
      if (perspective) perspective.classList.remove("flipped");
      if (previewQrCode && previewQrCode.verificationPromise) {
        await previewQrCode.verificationPromise;
      }
      window.print();
    });
  }

  // Fill Sample Data Button
  if (sampleBtn) {
    sampleBtn.addEventListener("click", () => {
      populateSampleData();
      showToast("Sample student identity loaded!");
    });
  }

  // Reset Button
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (confirm("Reset the form back to initial placeholder values?")) {
        form.reset();
        if (photoFileInput) photoFileInput.value = "";
        showPreviewOnly();
        resetToInitialPreview();
        showToast("Form reset to blank.");
      }
    });
  }

  // Form Submit (Generate ID Card)
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearFormErrors();

      // Basic Form Validation
      const fullName = document.getElementById("fullName").value.trim();
      const idNumber = document.getElementById("idNumber").value.trim();
      const dob = document.getElementById("dob").value;
      const department = document.getElementById("department").value.trim();
      const course = document.getElementById("course").value.trim();
      const year = document.getElementById("year").value;
      const semester = document.getElementById("semester").value;
      const email = document.getElementById("email").value.trim();
      const phone = document.getElementById("phone").value.trim();
      const bloodGroup = document.getElementById("bloodGroup").value;
      const address = document.getElementById("address").value.trim();

      let hasErrors = false;

      if (!fullName) {
        showFieldError("fullName", "Full Name is required");
        hasErrors = true;
      }

      if (!idNumber) {
        showFieldError("idNumber", "Student or Employee ID is required");
        hasErrors = true;
      }

      if (!dob) {
        showFieldError("dob", "Date of Birth is required");
        hasErrors = true;
      }

      if (!department) {
        showFieldError("department", "Department is required");
        hasErrors = true;
      }

      if (!course) {
        showFieldError("course", "Course is required");
        hasErrors = true;
      }

      if (!year) {
        showFieldError("year", "Please select a Year");
        hasErrors = true;
      }

      if (!semester) {
        showFieldError("semester", "Please select a Semester");
        hasErrors = true;
      }

      if (!email) {
        showFieldError("email", "Email Address is required");
        hasErrors = true;
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showFieldError("email", "Please enter a valid email format");
        hasErrors = true;
      }

      if (!phone) {
        showFieldError("phone", "Phone Number is required");
        hasErrors = true;
      }

      if (!bloodGroup) {
        showFieldError("bloodGroup", "Please select a Blood Group");
        hasErrors = true;
      }

      if (!address) {
        showFieldError("address", "Address is required");
        hasErrors = true;
      }

      if (hasErrors) {
        showToast("Please fill in all required fields correctly.", "error");
        return;
      }

      // Prepare final card object
      const finalCard = {
        fullName,
        idNumber,
        dob,
        department,
        course,
        year,
        semester,
        email,
        phone,
        bloodGroup,
        address,
        photo: currentCardData.photo || "assets/default-avatar.svg",
        status: "active"
      };

      try {
        const savedCard = await CardStore.save(finalCard);
        showSavedVerification(savedCard);
        showToast("Digital Identity Card Generated Successfully!", "success");
      } catch (error) {
        showToast(error.message || "Could not save the ID card.", "error");
        return;
      }

      // Smooth transition to dashboard after 1.2s
      setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 1200);
    });
  }

  function showFieldError(fieldId, msg) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    field.classList.add("is-invalid");
    const parent = field.closest(".form-group");
    const help = parent ? parent.querySelector(".form-help") : null;
    if (help) help.textContent = msg;
  }

  function clearFormErrors() {
    document.querySelectorAll(".form-control").forEach(el => el.classList.remove("is-invalid"));
    document.querySelectorAll(".form-help").forEach(el => el.textContent = "");
  }

  function populateSampleData() {
    document.getElementById("fullName").value = "Elena Rostova";
    document.getElementById("idNumber").value = "MIT-2026-4410";
    document.getElementById("dob").value = "2002-07-19";
    document.getElementById("department").value = "Artificial Intelligence & Robotics";
    document.getElementById("course").value = "B.Tech AI";
    document.getElementById("year").value = "3rd Year";
    document.getElementById("semester").value = "Semester 5";
    document.getElementById("email").value = "elena.rostova@mit.edu";
    document.getElementById("phone").value = "+1 (555) 728-3920";
    document.getElementById("bloodGroup").value = "AB+";
    document.getElementById("address").value = "88 Quantum Way, Apt 3B, Cyber City";

    // Trigger input events to update preview
    inputsToSync.forEach(item => {
      const el = document.getElementById(item.inputId);
      if (el) el.dispatchEvent(new Event("input"));
    });
    syncYearSemester();
    clearFormErrors();
  }

  function resetToInitialPreview() {
    inputsToSync.forEach(item => {
      const target = document.getElementById(item.cardTargetId);
      if (target) target.textContent = item.fallback;
    });
    const previewYearSem = document.getElementById("previewYearSem");
    if (previewYearSem) previewYearSem.textContent = "Year / Sem";
    const bloodDrop = document.querySelector(".card-blood-drop");
    if (bloodDrop) bloodDrop.setAttribute("aria-label", "Blood group O+");

    const thumb = document.getElementById("photoThumbnail");
    if (thumb) thumb.src = "assets/default-avatar.svg";

    const cardPhoto = document.getElementById("cardPreviewPhoto");
    if (cardPhoto) cardPhoto.src = "assets/default-avatar.svg";

    currentCardData.photo = "assets/default-avatar.svg";
    clearFormErrors();
  }
}

// Utility: Date formatter
function formatDate(dateString) {
  if (!dateString) return "";
  try {
    const parts = dateString.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const d = new Date(dateString);
    return d.toLocaleDateString();
  } catch (e) {
    return dateString;
  }
}

// Helper: Generates standalone HTML for a card (used in Dashboard preview modal)
function generateCardMarkup(card) {
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[character]);
  const text = (value, fallback = "—") => escapeHtml(value || fallback);
  if (card.cardType && card.cardType !== "STUDENT") return generateAdditionalCardMarkup(card, escapeHtml);
  const candidatePhoto = typeof card.photo === "string" ? card.photo : "";
  const photo = /^(data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/]+=*|assets\/[a-z0-9._/-]+)$/i.test(candidatePhoto)
    ? escapeHtml(candidatePhoto)
    : "assets/default-avatar.svg";
  const qrIssued = Boolean(card.verificationToken && card.verificationUrl);
  return `
    <div class="dashboard-card-preview">
      <div class="dashboard-card-controls">
        <button class="btn btn-secondary btn-sm" type="button" id="dashboardFlipCardBtn" aria-pressed="false">Flip Card</button>
      </div>
      <div class="id-card-perspective">
        <div class="id-card-flipper">
          <div class="digital-id-card id-card-front" aria-label="Front of digital identity card">
            <div class="card-top-header">
              <div class="card-org-branding">
                <img src="assets/logo.svg" alt="" class="card-org-logo">
                <span class="card-org-name">METROPOLITAN INSTITUTE OF TECHNOLOGY</span>
              </div>
              <div class="card-title-pill">DIGITAL IDENTITY CARD</div>
            </div>
            <div class="card-main-body">
              <div class="card-identity-profile">
                <div class="card-photo-frame">
                  <img src="${photo}" alt="Profile photo of ${text(card.fullName)}" class="card-photo-img">
                </div>
                <div class="card-identity-copy">
                  <span class="card-profile-eyebrow">STUDENT IDENTITY</span>
                  <div class="card-full-name">${text(card.fullName)}</div>
                  <div class="card-id-number">${text(card.idNumber)}</div>
                  <svg class="card-blood-drop" viewBox="0 0 44 52" role="img" aria-label="Blood group ${text(card.bloodGroup, "not provided")}">
                    <path d="M22 2C17 10 5 22 5 33a17 17 0 0 0 34 0C39 22 27 10 22 2Z" fill="#a83249" stroke="#e58b9b" stroke-width="1.5"/>
                    <text x="22" y="34" text-anchor="middle">${text(card.bloodGroup)}</text>
                  </svg>
                </div>
              </div>
              <div class="card-details-grid">
                <div class="detail-item">
                  <span class="detail-label">Department</span>
                  <span class="detail-value">${text(card.department)}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Course</span>
                  <span class="detail-value">${text(card.course)}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Year / Semester</span>
                  <span class="detail-value">${text(card.year)} · ${text(card.semester)}</span>
                </div>
              </div>
              <div class="card-front-footer">
                <div class="card-blood-note">
                  <span class="card-footer-label">CARD STATUS</span>
                  <span class="card-footer-value">${text(card.status, "Active")}</span>
                  <span class="card-serial">PROPERTY OF THE INSTITUTE</span>
                </div>
                <div class="card-qr-panel">
                  ${qrIssued ? `<img class="card-qr-code" data-verification-token="${escapeHtml(card.verificationToken)}" data-verification-url="${escapeHtml(card.verificationUrl)}" alt="QR code for ${text(card.idNumber)} verification" hidden>` : ""}
                  <div class="card-qr-placeholder" data-qr-placeholder${qrIssued ? " hidden" : ""}>${qrIssued ? "" : "Pending"}</div>
                  <span class="card-qr-caption" data-qr-status role="status" aria-live="polite">Pending</span>
                </div>
              </div>
            </div>
          </div>
          <div class="digital-id-card id-card-back" aria-label="Back of digital identity card">
            <div class="card-back-header">
              <div class="card-back-brand">
                <img src="assets/logo.svg" alt="" class="card-org-logo">
                <div>
                  <span class="card-back-institution">METROPOLITAN INSTITUTE OF TECHNOLOGY</span>
                  <span class="card-back-title">CARDHOLDER DETAILS</span>
                </div>
              </div>
            </div>
            <div class="card-back-body">
              <div class="card-back-section">
                <span class="card-back-label">Student ID</span>
                <p class="card-back-text card-back-id">${text(card.idNumber)}</p>
              </div>
              <div class="card-back-details">
                <div class="card-back-section">
                  <span class="card-back-label">Date of birth</span>
                  <p class="card-back-text">${text(formatDate(card.dob))}</p>
                </div>
                <div class="card-back-section">
                  <span class="card-back-label">Phone</span>
                  <p class="card-back-text">${text(card.phone)}</p>
                </div>
                <div class="card-back-section">
                  <span class="card-back-label">Email</span>
                  <p class="card-back-text">${text(card.email)}</p>
                </div>
              </div>
              <div class="card-back-section">
                <span class="card-back-label">Verification</span>
                <p class="card-back-text">Scan the QR code on the front to check the card's current status online.</p>
              </div>
              <div class="card-back-footer">
                <span class="card-back-serial">DIGITAL IDENTITY · AUTHENTICATED RECORD</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function generateAdditionalCardMarkup(card, escapeHtml) {
  const details = card.categoryDetails && typeof card.categoryDetails === "object" ? card.categoryDetails : {};
  const fields = ADDITIONAL_CARD_TYPES[card.cardType];
  const detailLabels = fields ? Object.fromEntries(fields.fields.map(field => [field.key, field.label])) : {};
  const photo = typeof card.photo === "string"
    && /^(data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/]+=*|assets\/[a-z0-9._/-]+)$/i.test(card.photo)
    ? escapeHtml(card.photo) : "assets/default-avatar.svg";
  const dateKeys = new Set(["startDate", "birthDate", "memberSince", "memberUntil", "date"]);
  const detailRows = Object.entries(details).filter(([, value]) => typeof value === "string" && value.trim()).map(([key, value]) => `
    <div><dt>${escapeHtml(detailLabels[key] || key)}</dt><dd>${escapeHtml(dateKeys.has(key) ? formatDate(value) : value)}</dd></div>
  `).join("");
  const primary = Object.entries(details).find(([, value]) => typeof value === "string" && value.trim());
  return `
    <div class="dashboard-card-preview category-dashboard-preview">
      <div class="dashboard-card-controls">
        <button class="btn btn-secondary btn-sm" type="button" id="dashboardFlipCardBtn" aria-pressed="false">Flip Card</button>
      </div>
      <div class="category-card-perspective dashboard-category-perspective" data-card-type="${escapeHtml(card.cardType.toLowerCase())}">
        <div class="category-card-flipper">
          <article class="category-id-card category-id-card-front" aria-label="Front of ${escapeHtml(card.cardType)} ID card">
            <header class="category-card-header"><img src="assets/logo.svg" alt="" class="category-card-logo"><div>
              <span class="category-org">${escapeHtml(details.organization || details.eventName || "DIGITAL IDENTITY")}</span>
              <strong>${escapeHtml(card.cardType.replace("_", " "))} ID CARD</strong></div>
              <span class="category-card-status">${escapeHtml(card.status || "Active")}</span>
            </header>
            <div class="category-card-front-content"><img class="category-card-photo" src="${photo}" alt="Profile photo of ${escapeHtml(card.fullName || "cardholder")}">
              <div class="category-card-primary"><span class="category-card-type">${escapeHtml(card.cardType)} IDENTITY</span>
                <h3>${escapeHtml(card.fullName || "")}</h3><p>${escapeHtml(card.idNumber || "")}</p>
                <strong class="category-card-highlight">${escapeHtml(primary ? primary[1] : "Identity card")}</strong>
              </div>
            </div>
            <div class="category-card-bottom"><span>${escapeHtml(card.email || card.phone || "Identity credential")}</span><span class="category-card-unverified">NOT OFFICIALLY VERIFIED</span></div>
          </article>
          <article class="category-id-card category-id-card-back" aria-label="Back of ${escapeHtml(card.cardType)} ID card">
            <header class="category-card-header"><img src="assets/logo.svg" alt="" class="category-card-logo"><div><span class="category-org">DIGITAL IDENTITY</span><strong>CARD DETAILS</strong></div></header>
            <div class="category-card-back-content"><h3>${escapeHtml(card.fullName || "")}</h3><p>${escapeHtml(card.idNumber || "")}</p><dl>${detailRows}</dl>
              <p class="category-card-privacy">This category is not eligible for official public QR verification.</p></div>
            <footer class="category-card-bottom"><span>${escapeHtml(card.cardType)} ID CARD</span><span class="category-card-unverified">UNVERIFIED CATEGORY</span></footer>
          </article>
        </div>
      </div>
    </div>`;
}

async function initVerificationPage() {
  const title = document.getElementById("verificationTitle");
  const message = document.getElementById("verificationMessage");
  const icon = document.getElementById("verificationIcon");
  const recordStatus = document.getElementById("verificationRecordStatus");
  const statusText = document.getElementById("verificationStatusText");
  const student = document.getElementById("verifiedStudent");
  const token = new URLSearchParams(window.location.search).get("token");

  const showUnavailable = (heading, detail) => {
    title.textContent = heading;
    message.textContent = detail;
    recordStatus.hidden = true;
    student.hidden = true;
    icon.classList.remove("is-verified");
    icon.classList.add("is-unverified");
  };

  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    showUnavailable("Card Not Found", "This verification link does not identify a valid card.");
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/verify/${encodeURIComponent(token)}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      credentials: "omit"
    });
    if (response.status === 404) {
      showUnavailable("Card Not Found", "This verification code is not recognized.");
      return;
    }
    if (!response.ok) throw new Error(`Verification service returned HTTP ${response.status}.`);
    const result = await response.json();
    if (!result.verified) {
      showUnavailable(
        "Card Inactive",
        result.message || "The institution reports that this card is not active."
      );
      return;
    }

    if (String(result.status).toLowerCase() !== "active") {
      showUnavailable("Card Inactive", "The institution reports that this card is not active.");
      return;
    }

    title.textContent = "Verified — Active";
    message.textContent = result.message || "The institution confirms this active identity card.";
    icon.classList.remove("is-unverified");
    icon.classList.add("is-verified");
    student.hidden = false;
    recordStatus.hidden = false;
    statusText.textContent = `Status: ${result.status}`;
    document.getElementById("verifiedName").textContent = result.fullName || "";
    document.getElementById("verifiedId").textContent = result.idNumber || "";

    const setOptionalDetail = (rowId, valueId, value) => {
      const row = document.getElementById(rowId);
      const element = document.getElementById(valueId);
      const visible = typeof value === "string" && value.trim().length > 0;
      row.hidden = !visible;
      if (visible) element.textContent = value;
    };
    setOptionalDetail("verifiedDepartmentRow", "verifiedDepartment", result.department);
    setOptionalDetail("verifiedCourseRow", "verifiedCourse", result.course);
    const academicPeriod = [result.year, result.semester].filter(Boolean).join(" · ");
    setOptionalDetail("verifiedYearRow", "verifiedYear", academicPeriod);

    const photo = document.getElementById("verifiedPhoto");
    const safePhoto = typeof result.photo === "string"
      && /^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/]+=*$/i.test(result.photo);
    photo.src = safePhoto ? result.photo : "assets/default-avatar.svg";
    photo.alt = result.fullName ? `Profile photo of ${result.fullName}` : "Student profile photo";
  } catch (error) {
    console.error("Identity verification request failed.", error);
    showUnavailable(
      "Verification Temporarily Unavailable",
      "We couldn’t reach the institution’s verification service. Please try again later."
    );
  }
}

// Global script initialiser based on page
document.addEventListener("DOMContentLoaded", async () => {
  setupNavigation();

  const page = document.body.dataset.page;
  if (page === "login") {
    initLoginPage();
  } else if (page === "dashboard") {
    initDashboardPage();
  } else if (page === "create-card") {
    initCreateCardPage();
  } else if (page === "card-categories") {
    AuthManager.requireAuth();
  } else if (page === "category-card") {
    initCategoryCardPage();
  } else if (page === "verify") {
    initVerificationPage();
  }
});

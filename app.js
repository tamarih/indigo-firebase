import {
  DB_KEY,
  SESSION_KEY,
  DEFAULT_LOGO_URL,
  INSURANCE_RENEWAL_URL,
  ROLES,
  RANKS,
  NITROX_LEVELS,
  PAYMENT_METHODS,
  PAYMENT_STATUS,
  APPROVAL_STATUS,
  EQUIPMENT_ITEMS,
  DEFAULT_REGISTRATION_FIELDS
} from "./js/constants.js";
import {
  id,
  today,
  nowIso,
  formatDate,
  escapeHtml,
  hashPassword,
  verifyPassword,
  generateLoginCode,
  isInsuranceExpired,
  dataUrlToBlob,
  readFileAsStoredUrl,
  phoneToWhatsApp
} from "./js/utils.js";
import {
  state,
  loadDb,
  saveDb,
  normalizeDb,
  normalizeRegistrationFields,
  currentUser,
  canManage,
  isAdmin,
  getProfile,
  textValue,
  siteById,
  eventById,
  approvedCount,
  seatCount,
  eventOpenForSite,
  nextFutureEventForSite,
  homeSites,
  futureDiveEvents,
  isEventFull,
  eventRegistrationState,
  eventParticipants,
  eventWaitlist
} from "./js/state.js";

const app = document.querySelector("#app");
const nav = document.querySelector("#mainNav");
const userMenu = document.querySelector("#userMenu");
const toast = document.querySelector("#toast");
const brandLogo = document.querySelector("#brandLogo");



function renderLoading() {
  renderBrandLogo();
  app.innerHTML = `
    <section class="section">
      <div class="panel">
        <p class="eyebrow">INDIGO</p>
        <h2>טוען את נתוני המועדון...</h2>
        <p>אם Firebase מחובר, הנתונים נטענים מהענן. אם לא, האפליקציה עובדת במצב מקומי.</p>
      </div>
    </section>
  `;
}

async function bootstrapApp() {
  renderLoading();

  try {
    const cloudResult = await window.IndigoCloud?.load(state.db);
    if (cloudResult?.db) {
      state.db = normalizeDb(cloudResult.db);
      localStorage.setItem(DB_KEY, JSON.stringify(state.db));
    }
    state.cloudEnabled = Boolean(cloudResult?.enabled);
  } catch (error) {
    console.error("Cloud bootstrap failed", error);
    state.cloudEnabled = false;
  }

  if (state.currentUserId !== "guest" && !state.db.Users.some((user) => user.id === state.currentUserId)) {
    state.currentUserId = "guest";
    sessionStorage.setItem(SESSION_KEY, state.currentUserId);
  }

  runSelfCheck();
  render();

  if (state.cloudEnabled) {
    showToast("האפליקציה מחוברת ל-Firebase ושומרת בענן.");
  }
}



function showToast(message, type = "ok") {
  toast.textContent = message;
  toast.className = `toast show ${type === "error" ? "error" : ""}`;
  window.setTimeout(() => toast.classList.remove("show"), 3600);
}

function showInsuranceRenewalPopup() {
  document.querySelector(".insurance-modal")?.remove();
  const modal = document.createElement("div");
  modal.className = "insurance-modal";
  modal.innerHTML = `
    <div class="insurance-modal__card" role="dialog" aria-modal="true" aria-labelledby="insuranceModalTitle">
      <button class="insurance-modal__close" type="button" data-insurance-modal-close aria-label="סגירת חלון">×</button>
      <div class="insurance-modal__icon" aria-hidden="true">🛡</div>
      <p class="eyebrow">ביטוח צלילה</p>
      <h3 id="insuranceModalTitle">הביטוח אינו בתוקף</h3>
      <p>כדי שהמועדון יוכל לאשר את ההרשמה, יש לחדש ביטוח צלילה לפני הצלילה.</p>
      <div class="actions">
        <a class="btn primary" href="${INSURANCE_RENEWAL_URL}" target="_blank" rel="noopener noreferrer">חידוש ביטוח צלילה</a>
        <button class="btn ghost" type="button" data-insurance-modal-close>המשך בטופס</button>
      </div>
    </div>
  `;
  modal.addEventListener("click", (event) => {
    if (event.target === modal || event.target.closest("[data-insurance-modal-close]")) modal.remove();
  });
  document.body.appendChild(modal);
}

function maybeShowInsuranceRenewalPopup() {
  if (!state.registrationState || !isInsuranceExpired(state.registrationState.form.insurance_valid_until)) return;
  if (state.registrationState.insurancePopupShownFor === state.registrationState.form.insurance_valid_until) return;
  state.registrationState.insurancePopupShownFor = state.registrationState.form.insurance_valid_until;
  showInsuranceRenewalPopup();
}

function navigate(hash) {
  window.location.hash = hash;
}

function render() {
  renderBrandLogo();
  renderUserMenuV2();
  renderNavV2();
  const [route, param] = (location.hash.replace("#", "") || "home").split("/");

  const routes = {
    home: renderHome,
    sites: renderSites,
    site: () => renderSiteDetails(param),
    register: () => renderRegistration(param),
    waitlist: () => renderWaitlist(param),
    mydives: renderMyDives,
    profile: renderProfile,
    login: renderLogin,
    signup: renderSignup,
    club: renderClubAdmin,
    success: () => renderSuccess(param)
  };

  (routes[route] || renderHome)();
  document.querySelector("#mainNav")?.classList.remove("open");
}

function logout() {
  state.currentUserId = "guest";
  state.loginState = null;
  state.registrationState = null;
  sessionStorage.removeItem(SESSION_KEY);
  showToast("התנתקת מהמערכת.");
  navigate("home");
  render();
}

function renderUserMenuV2() {
  const user = currentUser();
  const connected = user.id !== "guest";
  userMenu.innerHTML = `
    <div class="user-chip">
      <span>
        <strong>${connected ? `${escapeHtml(user.first_name)} ${escapeHtml(user.last_name)}` : "משתמש לא מחובר"}</strong>
        <small>${connected ? escapeHtml(ROLES[user.role] || "משתמש רגיל") : "אפשר להירשם לצלילה גם בלי חשבון"}</small>
        <small class="${state.cloudEnabled ? "cloud-ok" : "cloud-off"}">${state.cloudEnabled ? "ענן מחובר" : "שמירה מקומית בלבד"}</small>
      </span>
    </div>
  `;
}

function renderNavV2() {
  const user = currentUser();
  const connected = user.id !== "guest";
  const items = connected
    ? [
        ["home", "דף הבית"],
        ["mydives", "הצלילות שלי"],
        ["profile", "הפרופיל שלי"]
      ]
    : [
        ["home", "דף הבית"],
        ["login", "התחברות"],
        ["signup", "הרשמה"]
      ];
  if (connected && canManage(user)) items.push(["club", "ניהול מועדון"]);
  const active = location.hash.replace("#", "").split("/")[0] || "home";
  nav.innerHTML = `
    ${items.map(([route, label]) => `<a class="${active === route ? "active" : ""}" href="#${route}">${label}</a>`).join("")}
    ${connected ? `<button class="nav-link-button" type="button" data-action="logout">התנתקות</button>` : ""}
  `;
}

function renderBrandLogo() {
  const logoUrl = state.db.BrandSettings?.logo_data_url || DEFAULT_LOGO_URL;
  brandLogo.innerHTML = `<img class="brand-logo-img" src="${logoUrl}" alt="${escapeHtml(state.db.BrandSettings?.logo_alt || "INDIGO מועדון צלילה")}" />`;
}

function renderUserMenu() {
  const user = currentUser();
  userMenu.innerHTML = `
    <div class="user-chip">
      <span>
        <strong>${escapeHtml(user.first_name)} ${escapeHtml(user.last_name)}</strong>
        <small>${user.id === "guest" ? "לא מחובר/ת" : escapeHtml(ROLES[user.role])}</small>
        <small class="${state.cloudEnabled ? "cloud-ok" : "cloud-off"}">${state.cloudEnabled ? "ענן מחובר" : "שמירה מקומית בלבד"}</small>
      </span>
      <button class="btn ghost compact" type="button" data-action="open-login">כניסה / החלפה</button>
    </div>
  `;
}

function renderNav() {
  const user = currentUser();
  const items = [
    ["home", "דף בית"],
    ["sites", "אתרי צלילה"],
    ["mydives", "הצלילות שלי"],
    ["profile", "הפרופיל שלי"]
  ];
  if (canManage(user)) items.push(["club", "ניהול מועדון"]);
  const active = location.hash.replace("#", "").split("/")[0] || "home";
  nav.innerHTML = items.map(([route, label]) => `<a class="${active === route ? "active" : ""}" href="#${route}">${label}</a>`).join("");
}

function renderHome() {
  const sites = homeSites();
  const insuranceCard = renderInsuranceCard();

  app.innerHTML = `
    <section class="hero">
      <div class="hero-water-heart" aria-hidden="true"></div>
      <div class="hero-sea-life" aria-hidden="true">
        <span class="sea-dolphin sea-dolphin-1">⌒</span>
        <span class="sea-dolphin sea-dolphin-2">⌒</span>
        <span class="sea-horse sea-horse-1">♞</span>
        <span class="sea-horse sea-horse-2">♞</span>
        <span class="sea-horse sea-horse-3">♞</span>
        <span class="sea-fish sea-fish-1">›</span>
        <span class="sea-fish sea-fish-2">›</span>
        <span class="sea-fish sea-fish-3">›</span>
        <span class="sea-fish sea-fish-4">›</span>
        <span class="sea-fish sea-fish-5">›</span>
        <span class="sea-diver sea-diver-1"></span>
        <span class="sea-diver sea-diver-2"></span>
      </div>
      <div class="hero-bubbles" aria-hidden="true">
        <span></span><span></span><span></span><span></span><span></span><span></span>
      </div>
      <div class="hero-content">
        <p class="eyebrow">INDIGO DIVE CLUB</p>
        <h1>צלילות פתוחות<br>והרשמה למועדון<br>אינדיגו</h1>
        <p>ניהול אתרי צלילה, הרשמות, פרופיל צולל, תשלום ואישור מועדון במקום אחד.</p>
        <div class="hero-actions">
          <a class="btn primary" href="#sites">אתרי צלילה</a>
          <a class="btn secondary" href="#mydives">הצלילות שלי</a>
        </div>
      </div>
    </section>
    <section class="section insurance-section">
      <div class="grid">${insuranceCard}</div>
    </section>
    <section class="section">
      <div class="section-header">
        <div>
          <p class="eyebrow">אתרים פעילים</p>
          <h2>אתרי הצלילה של אינדיגו</h2>
          <p>אתרים עם צלילה עתידית מופיעים ראשונים לפי התאריך הקרוב ביותר, ואחריהם שאר אתרי הצלילה.</p>
        </div>
      </div>
      ${sites.length ? `<div class="grid">${sites.map(renderSiteCard).join("")}</div>` : `<div class="empty">אין כרגע אתרי צלילה פעילים להצגה.</div>`}
    </section>
  `;
}

function renderHomeDiveCard(event) {
  const site = siteById(event.site_id);
  const state = eventRegistrationState(event);
  const count = seatCount(event.id);
  const mediaStyle = site?.image_url ? `style="background-image: linear-gradient(180deg, rgba(5, 70, 83, 0.08), rgba(5, 70, 83, 0.62)), url('${escapeHtml(site.image_url)}')"` : "";
  const statusText = state === "open" ? "סטטוס: פתוח להרשמה" : state === "full" ? "סטטוס: הצלילה מלאה" : "סטטוס: ההרשמה סגורה";
  const statusClass = state === "open" ? "ok" : state === "full" ? "warn" : "danger";
  const action = state === "open"
    ? `<a class="btn primary" href="#register/${event.id}">הרשמה</a>`
    : state === "full"
      ? `<a class="btn secondary" href="#waitlist/${event.id}">הצטרפות לרשימת המתנה</a>`
      : "";

  return `
    <article class="card dive-event-card">
      <div class="card-media" ${mediaStyle}><span>${escapeHtml(site?.difficulty_level || "")}</span></div>
      <div class="card-body">
        <h3>${escapeHtml(site?.name || "אתר צלילה")}</h3>
        <div class="meta-list">
          <div class="meta-item"><span>תאריך</span><strong>${formatDate(event.dive_date)}</strong></div>
          <div class="meta-item"><span>שעה</span><strong>${escapeHtml(event.dive_time || "-")}</strong></div>
          <div class="meta-item"><span>עומק</span><strong>${escapeHtml(site?.depth || "-")}</strong></div>
          <div class="meta-item"><span>דרגה נדרשת</span><strong>${escapeHtml(site?.suitable_for_ranks || "-")}</strong></div>
          <div class="meta-item"><span>נרשמו</span><strong>${count} / ${event.max_participants}</strong></div>
        </div>
        <div class="actions">
          <span class="pill ${statusClass}">${statusText}</span>
          ${action}
          <a class="btn ghost" href="#site/${site?.id || ""}">פרטים</a>
        </div>
      </div>
    </article>
  `;
}

function insuranceStatus() {
  const profile = getProfile();
  if (!profile?.insurance_valid_until) {
    return {
      valid: false,
      label: "נדרש חידוש ביטוח"
    };
  }
  const insuranceDate = new Date(`${profile.insurance_valid_until}T00:00:00`);
  return insuranceDate >= new Date()
    ? { valid: true, label: "הביטוח בתוקף" }
    : { valid: false, label: "נדרש חידוש ביטוח" };
}

function renderInsuranceCard() {
  const status = insuranceStatus();
  return `
    <a class="insurance-strip ${status.valid ? "insurance-strip--valid" : "insurance-strip--expired"}" href="${INSURANCE_RENEWAL_URL}" target="_blank" rel="noopener noreferrer" aria-label="חידוש ביטוח צלילה נפתח בלשונית חדשה">
      <span class="insurance-strip__icon" aria-hidden="true">♢</span>
      <strong>חידוש ביטוח צלילה</strong>
      <span class="pill ${status.valid ? "ok" : "danger"}">${status.label}</span>
      <small>לחצו כאן לרכישת או חידוש ביטוח צלילה דרך ההתאחדות</small>
    </a>
  `;
}

function renderSites() {
  const sites = state.db.DiveSites.filter((site) => site.is_active).sort((a, b) => a.order_index - b.order_index);
  app.innerHTML = `
    <section class="section">
      <div class="section-header">
        <div>
          <p class="eyebrow">אתרי צלילה</p>
          <h2>כל אתרי הצלילה של אינדיגו</h2>
          <p>פרטים מלאים, צלילות קרובות וכפתור הרשמה לאתרים שפתוחים להרשמה.</p>
        </div>
      </div>
      <div class="grid">${sites.map(renderSiteCard).join("")}</div>
    </section>
  `;
}

function renderSiteCard(site) {
  const event = nextFutureEventForSite(site.id);
  const eventState = eventRegistrationState(event);
  const mediaStyle = site.image_url ? `style="background-image: linear-gradient(180deg, rgba(5, 70, 83, 0.08), rgba(5, 70, 83, 0.62)), url('${escapeHtml(site.image_url)}')"` : "";
  const eventAction = (() => {
    if (!event || !site.allow_registration) return "";
    const dateText = formatDate(event.dive_date);
    if (eventState === "open") {
      return `<a class="site-registration-link" href="#register/${event.id}">להרשמה לצלילה בתאריך ${dateText} לחץ כאן</a>`;
    }
    if (eventState === "full") {
      return `<a class="site-registration-link warn" href="#waitlist/${event.id}">הצלילה בתאריך ${dateText} מלאה - להצטרפות לרשימת המתנה לחץ כאן</a>`;
    }
    return `<span class="site-registration-link disabled">צלילה בתאריך ${dateText} - ההרשמה סגורה</span>`;
  })();
  return `
    <article class="card">
      <div class="card-media" ${mediaStyle}><span>${escapeHtml(site.difficulty_level)}</span></div>
      <div class="card-body">
        <h3>${escapeHtml(site.name)}</h3>
        <p>${escapeHtml(site.short_description)}</p>
        ${eventAction}
        <div class="meta-list">
          <div class="meta-item"><span>עומק</span><strong>${escapeHtml(site.depth)}</strong></div>
          <div class="meta-item"><span>מתאים ל</span><strong>${escapeHtml(site.suitable_for_ranks)}</strong></div>
        </div>
        <div class="actions">
          <a class="btn secondary" href="#site/${site.id}">פרטים נוספים</a>
          ${eventState === "open" && site.allow_registration ? `<a class="btn primary" href="#register/${event.id}">הרשמה</a>` : ""}
          ${eventState === "full" && site.allow_registration ? `<a class="btn secondary" href="#waitlist/${event.id}">רשימת המתנה</a>` : ""}
        </div>
      </div>
    </article>
  `;
}

function renderSiteDetails(siteId) {
  const site = siteById(siteId);
  if (!site) return renderNotFound();
  const events = state.db.DiveEvents.filter((event) => event.site_id === site.id && event.dive_date >= today()).sort((a, b) => a.dive_date.localeCompare(b.dive_date));
  const siteHero = site.image_url ? `<div class="site-detail-image" style="background-image: linear-gradient(180deg, rgba(5, 70, 83, 0.05), rgba(5, 70, 83, 0.34)), url('${escapeHtml(site.image_url)}')"></div>` : "";
  app.innerHTML = `
    <section class="section">
      <div class="panel">
        ${siteHero}
        <p class="eyebrow">פרטי אתר צלילה</p>
        <h1>${escapeHtml(site.title || site.name)}</h1>
        <p>${escapeHtml(site.full_description)}</p>
        <div class="meta-list">
          <div class="meta-item"><span>מחיר</span><strong>${site.price} ש"ח</strong></div>
          <div class="meta-item"><span>עומק</span><strong>${escapeHtml(site.depth)}</strong></div>
          <div class="meta-item"><span>רמת קושי</span><strong>${escapeHtml(site.difficulty_level)}</strong></div>
          <div class="meta-item"><span>דרגות מתאימות</span><strong>${escapeHtml(site.suitable_for_ranks)}</strong></div>
        </div>
      </div>
    </section>
    <section class="section">
      <div class="section-header">
        <div>
          <h2>צלילות קרובות באתר</h2>
          <p>כל הרשמה נשארת בהמתנה עד אישור מועדון.</p>
        </div>
      </div>
      ${events.length ? `<div class="grid two">${events.map(renderEventCard).join("")}</div>` : `<div class="empty">אין כרגע צלילות פתוחות באתר הזה.</div>`}
    </section>
  `;
}

function renderEventCard(event) {
  const site = siteById(event.site_id);
  const state = eventRegistrationState(event);
  const count = seatCount(event.id);
  const statusText = state === "open" ? "סטטוס: פתוח להרשמה" : state === "full" ? "סטטוס: הצלילה מלאה" : "סטטוס: ההרשמה סגורה";
  const statusClass = state === "open" ? "ok" : state === "full" ? "warn" : "danger";
  const action = state === "open"
    ? `<a class="btn primary" href="#register/${event.id}">הרשמה</a>`
    : state === "full"
      ? `<a class="btn secondary" href="#waitlist/${event.id}">הצטרפות לרשימת המתנה</a>`
      : "";
  return `
    <article class="card">
      <div class="card-body">
        <h3>${escapeHtml(site?.name || "")}</h3>
        <div class="meta-list">
          <div class="meta-item"><span>תאריך</span><strong>${formatDate(event.dive_date)}</strong></div>
          <div class="meta-item"><span>שעה</span><strong>${event.dive_time}</strong></div>
          <div class="meta-item"><span>מפגש</span><strong>${event.meeting_time}</strong></div>
          <div class="meta-item"><span>מקומות</span><strong>${count} / ${event.max_participants}</strong></div>
          <div class="meta-item"><span>עומק</span><strong>${escapeHtml(site?.depth || "-")}</strong></div>
          <div class="meta-item"><span>דרגה נדרשת</span><strong>${escapeHtml(site?.suitable_for_ranks || "-")}</strong></div>
        </div>
        <p>${escapeHtml(event.registration_notes)}</p>
        <div class="actions">
          <span class="pill ${statusClass}">${statusText}</span>
          ${action}
        </div>
      </div>
    </article>
  `;
}

function renderWaitlist(eventId) {
  const event = eventById(eventId);
  const site = event ? siteById(event.site_id) : null;
  if (!event || !site) return renderNotFound();
  const state = eventRegistrationState(event);

  app.innerHTML = `
    <section class="section">
      <div class="panel narrow-panel">
        <p class="eyebrow">רשימת המתנה</p>
        <h2>${escapeHtml(site.name)}</h2>
        <p>הצלילה בתאריך ${formatDate(event.dive_date)} בשעה ${escapeHtml(event.dive_time || "")} מלאה כרגע. אפשר להצטרף לרשימת ההמתנה, והמועדון יצור קשר אם יתפנה מקום.</p>
        ${state !== "full" ? `<div class="alert ok">כרגע יש מקום בצלילה הזו. אפשר להמשיך להרשמה מלאה.</div><div class="actions"><a class="btn primary" href="#register/${event.id}">מעבר להרשמה</a></div>` : `
          <form id="waitlistForm" class="form-grid">
            ${inputField("first_name", "שם פרטי", currentUser().id !== "guest" ? currentUser().first_name : "", true)}
            ${inputField("last_name", "שם משפחה", currentUser().id !== "guest" ? currentUser().last_name : "", true)}
            ${inputField("phone", "טלפון נייד", currentUser().id !== "guest" ? currentUser().phone : "", true, "tel")}
            ${selectField("diving_rank", "דרגת צלילה", "", RANKS, true)}
            <div class="field">
              <button class="btn primary" type="submit">הצטרפות לרשימת המתנה</button>
            </div>
          </form>
        `}
      </div>
    </section>
  `;

  document.querySelector("#waitlistForm")?.addEventListener("submit", (submitEvent) => {
    submitEvent.preventDefault();
    const data = Object.fromEntries(new FormData(submitEvent.currentTarget).entries());
    const registration = {
      id: id("reg"),
      event_id: event.id,
      user_id: state.currentUserId !== "guest" ? state.currentUserId : "",
      first_name: String(data.first_name || "").trim(),
      last_name: String(data.last_name || "").trim(),
      phone: String(data.phone || "").trim(),
      email: state.currentUserId !== "guest" ? currentUser().email || "" : "",
      id_number: state.currentUserId !== "guest" ? currentUser().id_number || "" : "",
      birth_date: state.currentUserId !== "guest" ? currentUser().birth_date || "" : "",
      diving_rank: data.diving_rank,
      nitrox_certified: false,
      nitrox_level: "none",
      insurance_valid_until: "",
      last_dive_date: "",
      certification_file_url: "",
      insurance_file_url: "",
      buddy_name: "",
      air_type: "air",
      terms_accepted: false,
      signature_url: "",
      payment_method: "no_payment_yet",
      payment_status: "unpaid",
      club_approval_status: "waiting_list",
      admin_notes: "רשימת המתנה",
      user_notes: "",
      is_club_member_registration: false,
      equipment_required: false,
      equipment_items: [],
      shoe_size: "",
      equipment_cost: 0,
      total_price: Number(event.price || site.price || 0),
      waitlist_created_date: nowIso(),
      created_date: nowIso()
    };

    if (!registration.first_name || !registration.last_name || !registration.phone || !registration.diving_rank) {
      showToast("יש למלא שם פרטי, שם משפחה, טלפון ודרגת צלילה.", "error");
      return;
    }

    state.db.DiveRegistrations.push(registration);
    saveDb();
    app.innerHTML = `
      <section class="success-screen">
        <div class="panel success-card">
          <h2>נרשמת בהצלחה לרשימת ההמתנה.</h2>
          <p>אם יתפנה מקום, מנהל המועדון יוכל להעביר אותך לרשימת המשתתפים.</p>
          <div class="actions"><a class="btn primary" href="#home">חזרה לדף הבית</a></div>
        </div>
      </section>
    `;
    showToast("נרשמת בהצלחה לרשימת ההמתנה.");
  });
}

function renderRegistration(eventId) {
  const event = eventById(eventId);
  const site = event ? siteById(event.site_id) : null;
  if (!event || !site) return renderNotFound();
  const state = eventRegistrationState(event);
  if (state === "full") return renderWaitlist(eventId);
  if (state === "closed") {
    app.innerHTML = `
      <section class="section">
        <div class="panel">
          <h2>ההרשמה סגורה</h2>
          <p>ההרשמה לצלילה הזו אינה פתוחה כרגע.</p>
          <div class="actions"><a class="btn primary" href="#home">חזרה לדף הבית</a></div>
        </div>
      </section>
    `;
    return;
  }
  const profile = getProfile();
  const user = currentUser();

  state.registrationState = state.registrationState?.event_id === eventId ? state.registrationState : {
    event_id: eventId,
    step: 1,
    loading: false,
    signatureDataUrl: "",
    newCertificationFile: null,
    newInsuranceFile: null,
    insurancePopupShownFor: "",
    warnings: [],
    form: {
      first_name: profile?.first_name || user.first_name || "",
      last_name: profile?.last_name || user.last_name || "",
      phone: profile?.phone || user.phone || "",
      email: profile?.email || user.email || "",
      id_number: profile?.id_number || user.id_number || "",
      birth_date: profile?.birth_date || user.birth_date || "",
      diving_rank: profile?.diving_rank || "",
      nitrox_certified: profile?.nitrox_certified ? "yes" : "no",
      nitrox_level: profile?.nitrox_level || "none",
      insurance_valid_until: profile?.insurance_valid_until || "",
      last_dive_date: profile?.last_dive_date || "",
      existingCertificationFileUrl: profile?.certification_file_url || "",
      existingInsuranceFileUrl: profile?.insurance_file_url || "",
      buddy_name: "",
      air_type: "air",
      equipment_required: "no",
      equipment_items: [],
      shoe_size: "",
      terms_accepted: false,
      payment_method: user.is_club_member ? "club_member" : "bit",
      user_notes: "",
      save_details_for_next_time: Boolean(profile?.save_details_for_next_time)
    }
  };

  const f = state.registrationState.form;
  app.innerHTML = `
    <section class="section">
      <div class="section-header">
        <div>
          <p class="eyebrow">הרשמה לצלילה</p>
          <h2>${escapeHtml(site.name)} · ${formatDate(event.dive_date)} · ${event.dive_time}</h2>
          <p>${escapeHtml(textValue("registration", "intro", "מלאו את הפרטים בשני שלבים קצרים."))}</p>
        </div>
        <span class="pill">${event.price} ש"ח</span>
      </div>
      <div class="registration-layout">
        <aside class="panel stepper">
          ${[["1", "פרטים אישיים, צלילה וביטוח"], ["2", "תשלום, חתימה ושליחה"]].map(([step, label]) => `<button class="btn ${state.registrationState.step === Number(step) ? "active" : ""}" data-step="${step}" type="button">${step}. ${label}</button>`).join("")}
        </aside>
        <form id="registrationForm" class="panel" novalidate>
          <div id="registrationStep">${renderRegistrationStep(f, event)}</div>
          <div id="registrationWarnings" class="warning-list">${renderWarnings(state.registrationState.warnings)}</div>
          <div class="form-actions">
            ${state.registrationState.step > 1 ? `<button class="btn ghost" type="button" data-action="prev-step">הקודם</button>` : ""}
            ${state.registrationState.step < 2 ? `<button class="btn primary" type="button" data-action="next-step">הבא</button>` : `<button class="btn primary" type="submit" ${state.registrationState.loading ? "disabled" : ""}>${state.registrationState.loading ? "שולח..." : "שליחת הרשמה"}</button>`}
          </div>
        </form>
      </div>
    </section>
  `;
  bindRegistrationEvents();
  if (state.registrationState.step === 2) setupSignaturePad();
}

function renderRegistrationStep(f, event) {
  const dynamicFields = state.db.DynamicFormFields.filter((field) => field.form_name === "registration" && field.is_active).sort((a, b) => a.order_index - b.order_index);
  if (state.registrationState.step === 1) {
    return `
      <h3>פרטים אישיים</h3>
      <div class="form-grid">
        ${renderConfiguredRegistrationFields("personal", f)}
      </div>
      <h3 class="form-section-title">פרטי צלילה וביטוח</h3>
      <div class="form-grid">
        ${renderConfiguredRegistrationFields("dive", f)}
      </div>
      ${renderEquipmentRentalSection(f)}
      <div class="form-grid">${dynamicFields.map((field) => dynamicField(field, f[field.field_key] || "")).join("")}</div>
    `;
  }
  if (state.registrationState.step === 2) {
    const user = currentUser();
    return `
      <h3>תשלום ותנאים</h3>
      <p>${escapeHtml(state.db.PaymentsSettings.payment_text)}</p>
      ${renderPaymentSummary(f, event)}
      <div class="radio-stack">
        ${paymentOption("bit", `${PAYMENT_METHODS.bit} (${state.db.PaymentsSettings.bit_link})`, f.payment_method)}
        ${paymentOption("paybox", `${PAYMENT_METHODS.paybox} (${state.db.PaymentsSettings.paybox_link})`, f.payment_method)}
        ${paymentOption("phone", `${PAYMENT_METHODS.phone} - ${state.db.PaymentsSettings.phone_payment_number}`, f.payment_method)}
        ${user.is_club_member ? paymentOption("club_member", PAYMENT_METHODS.club_member, f.payment_method) : ""}
      </div>
      ${configuredCheckbox("terms_accepted", f.terms_accepted, state.db.PaymentsSettings.cancellation_terms_text)}
      ${configuredCheckbox("save_details_for_next_time", f.save_details_for_next_time)}
      <div class="form-grid">
        ${configuredInput("account_password", f.account_password || "", "password")}
        ${configuredInput("account_password_confirm", f.account_password_confirm || "", "password")}
      </div>
      <p class="muted">אם סימנת שמירת פרטים, הסיסמה תשמש לכניסה הבאה לאפליקציה.</p>
      ${isRegistrationFieldActive("signature") ? `<h3 class="form-section-title">${escapeHtml(registrationField("signature").label)}</h3>
        <p class="muted">חתימה דיגיטלית היא חובה. אם שמירת החתימה נכשלת תופיע הודעת שגיאה ברורה והכפתור יחזור לפעול.</p>
        <canvas id="signaturePad" class="signature-pad" width="900" height="260" aria-label="חתימה דיגיטלית"></canvas>
        <div class="actions">
          <button class="btn secondary" type="button" data-action="clear-signature">ניקוי חתימה</button>
        </div>
        <div class="warning-list">${state.registrationState.signatureDataUrl ? `<div class="alert ok">חתימה נקלטה.</div>` : `<div class="alert danger">יש לחתום לפני שליחת ההרשמה.</div>`}</div>` : ""}
    `;
  }
  if (state.registrationState.step === 1) {
    return `
      <h3>פרטים אישיים</h3>
      <div class="form-grid">
        ${inputField("first_name", "שם פרטי", f.first_name, true)}
        ${inputField("last_name", "שם משפחה", f.last_name, true)}
        ${inputField("phone", "טלפון", f.phone, true, "tel")}
        ${inputField("email", "אימייל", f.email, false, "email")}
        ${inputField("id_number", "תעודת זהות", f.id_number, true)}
        ${inputField("birth_date", "תאריך לידה", f.birth_date, true, "date")}
      </div>
    `;
  }
  if (state.registrationState.step === 2) {
    return `
      <h3>פרטי צלילה וביטוח</h3>
      <div class="form-grid">
        ${selectField("diving_rank", "דרגת צלילה", f.diving_rank, RANKS, true)}
        ${selectField("nitrox_certified", "הסמכת נייטרוקס", f.nitrox_certified, [["yes", "כן"], ["no", "לא"]], true)}
        ${selectField("nitrox_level", "דרגת נייטרוקס", f.nitrox_level, NITROX_LEVELS.map((level) => [level, level === "none" ? "ללא" : level]), false)}
        ${inputField("insurance_valid_until", "תוקף ביטוח", f.insurance_valid_until, true, "date")}
        ${inputField("last_dive_date", "תאריך צלילה אחרונה", f.last_dive_date, true, "date")}
        ${selectField("air_type", "סוג אוויר", f.air_type, [["air", "אוויר"], ["nitrox", "נייטרוקס"]], true)}
      </div>
      <div class="form-grid">
        ${fileField("certification_file", "העלאת תעודת צלילה", f.existingCertificationFileUrl, state.registrationState.newCertificationFile, true)}
        ${fileField("insurance_file", "העלאת ביטוח", f.existingInsuranceFileUrl, state.registrationState.newInsuranceFile, true)}
      </div>
      <div class="form-grid">${dynamicFields.map((field) => dynamicField(field, f[field.field_key] || "")).join("")}</div>
    `;
  }
  if (state.registrationState.step === 3) {
    const user = currentUser();
    return `
      <h3>תשלום ותנאים</h3>
      <p>${escapeHtml(state.db.PaymentsSettings.payment_text)}</p>
      <div class="radio-stack">
        ${paymentOption("bit", `${PAYMENT_METHODS.bit} (${state.db.PaymentsSettings.bit_link})`, f.payment_method)}
        ${paymentOption("paybox", `${PAYMENT_METHODS.paybox} (${state.db.PaymentsSettings.paybox_link})`, f.payment_method)}
        ${paymentOption("phone", `${PAYMENT_METHODS.phone} - ${state.db.PaymentsSettings.phone_payment_number}`, f.payment_method)}
        ${user.is_club_member ? paymentOption("club_member", PAYMENT_METHODS.club_member, f.payment_method) : ""}
      </div>
      <label class="checkbox-field">
        <input type="checkbox" name="terms_accepted" ${f.terms_accepted ? "checked" : ""} />
        <span><span class="required">*</span> ${escapeHtml(state.db.PaymentsSettings.cancellation_terms_text)}</span>
      </label>
      <label class="checkbox-field">
        <input type="checkbox" name="save_details_for_next_time" ${f.save_details_for_next_time ? "checked" : ""} />
        <span>האם להירשם לאפליקציה ולשמור את הפרטים להרשמות הבאות?</span>
      </label>
      <div class="form-grid">
        ${inputField("account_password", "בחירת סיסמה לשמירת פרטים", f.account_password || "", false, "password")}
        ${inputField("account_password_confirm", "אימות סיסמה", f.account_password_confirm || "", false, "password")}
      </div>
      <p class="muted">אם סימנת שמירת פרטים, הסיסמה תשמש לכניסה הבאה לאפליקציה.</p>
    `;
  }
  return `
    <h3>חתימה ושליחה</h3>
    <p class="muted">חתימה דיגיטלית היא חובה. אם שמירת החתימה נכשלת תופיע הודעת שגיאה ברורה והכפתור יחזור לפעול.</p>
    <canvas id="signaturePad" class="signature-pad" width="900" height="260" aria-label="חתימה דיגיטלית"></canvas>
    <div class="actions">
      <button class="btn secondary" type="button" data-action="clear-signature">ניקוי חתימה</button>
    </div>
    <div class="warning-list">${state.registrationState.signatureDataUrl ? `<div class="alert ok">חתימה נקלטה.</div>` : `<div class="alert danger">יש לחתום לפני שליחת ההרשמה.</div>`}</div>
  `;
}

function selectedEquipmentItems(f) {
  return Array.isArray(f.equipment_items) ? f.equipment_items : String(f.equipment_items || "").split(",").filter(Boolean);
}

function equipmentCost(f) {
  const selected = selectedEquipmentItems(f);
  return EQUIPMENT_ITEMS.filter((item) => selected.includes(item.key)).reduce((sum, item) => sum + item.price, 0);
}

function equipmentLabels(f) {
  const selected = selectedEquipmentItems(f);
  return EQUIPMENT_ITEMS.filter((item) => selected.includes(item.key)).map((item) => `${item.label} - ${item.price} ₪`);
}

function finalRegistrationTotal(f, event) {
  return Number(event?.price || 0) + equipmentCost(f);
}

function renderEquipmentRentalSection(f) {
  const required = f.equipment_required === "yes";
  const selected = selectedEquipmentItems(f);
  return `
    <section class="equipment-rental">
      <h3 class="form-section-title">השכרת ציוד צלילה</h3>
      <label class="field">
        <span>האם נדרש ציוד צלילה?</span>
        <select name="equipment_required">
          <option value="no" ${!required ? "selected" : ""}>לא</option>
          <option value="yes" ${required ? "selected" : ""}>כן</option>
        </select>
      </label>
      ${required ? `
        <div class="equipment-options">
          ${EQUIPMENT_ITEMS.map((item) => `<label class="checkbox-field equipment-option">
            <input name="equipment_items" type="checkbox" value="${item.key}" ${selected.includes(item.key) ? "checked" : ""} />
            <span>${item.label} - ${item.price} ₪</span>
          </label>`).join("")}
        </div>
        ${selected.includes("fins") ? inputField("shoe_size", "מידת נעליים", f.shoe_size || "", true, "number") : ""}
      ` : ""}
    </section>
  `;
}

function renderPaymentSummary(f, event) {
  const labels = equipmentLabels(f);
  const cost = equipmentCost(f);
  return `
    <div class="payment-summary">
      <div><span>מחיר הצלילה</span><strong>${Number(event?.price || 0)} ₪</strong></div>
      <div><span>ציוד שנבחר</span><strong>${labels.length ? escapeHtml(labels.join(", ")) : "לא נבחר ציוד"}</strong></div>
      <div><span>עלות ציוד</span><strong>${cost} ₪</strong></div>
      <div class="payment-summary-total"><span>סה"כ לתשלום</span><strong>${finalRegistrationTotal(f, event)} ₪</strong></div>
    </div>
  `;
}

function inputField(name, label, value, required, type = "text") {
  return `<label class="field"><span>${required ? `<span class="required">*</span> ` : ""}${label}</span><input name="${name}" type="${type}" value="${escapeHtml(value)}" ${required ? "required" : ""} /></label>`;
}

function registrationField(key) {
  return state.db.RegistrationFields?.find((field) => field.field_key === key) || DEFAULT_REGISTRATION_FIELDS.find((field) => field.field_key === key);
}

function isRegistrationFieldActive(key) {
  return registrationField(key)?.is_active !== false;
}

function isRegistrationFieldRequired(key) {
  const field = registrationField(key);
  return field?.is_active !== false && Boolean(field?.required);
}

function registrationOptions(key, fallback = []) {
  const field = registrationField(key);
  if (!field?.options) return fallback;
  return String(field.options).split(/\n|,/).map((item) => item.trim()).filter(Boolean).map((item) => {
    const [value, label] = item.split("|").map((part) => part.trim());
    return [value, label || value];
  });
}

function configuredInput(key, value, fallbackType = "text") {
  const field = registrationField(key);
  if (!field || field.is_active === false) return "";
  if (field.type === "select") return selectField(key, field.label, value, registrationOptions(key), field.required);
  return inputField(key, field.label, value, field.required, field.type || fallbackType);
}

function configuredFile(key, existing, nextFile) {
  const field = registrationField(key);
  if (!field || field.is_active === false) return "";
  return fileField(key, field.label, existing, nextFile, field.required);
}

function configuredCheckbox(key, checked, fallbackLabel = "") {
  const field = registrationField(key);
  if (!field || field.is_active === false) return "";
  return `<label class="checkbox-field"><input type="checkbox" name="${key}" ${checked ? "checked" : ""} /><span>${field.required ? `<span class="required">*</span> ` : ""}${escapeHtml(field.label || fallbackLabel)}</span></label>`;
}

function renderConfiguredRegistrationFields(section, f) {
  return (state.db.RegistrationFields || [])
    .filter((field) => field.section === section && field.is_active)
    .sort((a, b) => a.order_index - b.order_index)
    .map((field) => {
      if (field.field_key === "nitrox_level" && f.nitrox_certified !== "yes") return "";
      if (field.field_key === "certification_file") return configuredFile("certification_file", f.existingCertificationFileUrl, state.registrationState.newCertificationFile);
      if (field.field_key === "insurance_file") return configuredFile("insurance_file", f.existingInsuranceFileUrl, state.registrationState.newInsuranceFile);
      if (field.type === "checkbox") return configuredCheckbox(field.field_key, Boolean(f[field.field_key]));
      if (field.type === "signature") return "";
      return configuredInput(field.field_key, f[field.field_key] || "", field.type);
    })
    .join("");
}

function selectField(name, label, value, options, required) {
  const normalized = options.map((option) => Array.isArray(option) ? option : [option, option]);
  return `<label class="field"><span>${required ? `<span class="required">*</span> ` : ""}${label}</span><select name="${name}" ${required ? "required" : ""}><option value="">בחירה</option>${normalized.map(([optionValue, text]) => `<option value="${escapeHtml(optionValue)}" ${String(value) === String(optionValue) ? "selected" : ""}>${escapeHtml(text)}</option>`).join("")}</select></label>`;
}

function fileField(name, label, existing, nextFile, required) {
  const hasFile = Boolean(existing || nextFile);
  return `<label class="field"><span>${required && !hasFile ? `<span class="required">*</span> ` : ""}${label}</span><input name="${name}" type="file" accept=".pdf,image/*" /><small>${hasFile ? `קובץ קיים: ${escapeHtml(nextFile?.name || existing)}` : "לא קיים קובץ שמור"}</small></label>`;
}

function dynamicField(field, value) {
  if (field.type === "textarea") return `<label class="field"><span>${field.required ? `<span class="required">*</span> ` : ""}${escapeHtml(field.label)}</span><textarea name="${field.field_key}" rows="3">${escapeHtml(value)}</textarea><small>${escapeHtml(field.help_text)}</small></label>`;
  if (field.type === "checkbox" || field.type === "switch") return `<label class="checkbox-field"><input name="${field.field_key}" type="checkbox" ${value ? "checked" : ""} /><span>${field.required ? `<span class="required">*</span> ` : ""}${escapeHtml(field.label)}</span></label>`;
  if (field.type === "select") {
    const options = String(field.options || "").split(",").map((item) => item.trim()).filter(Boolean);
    return selectField(field.field_key, field.label, value, options, field.required);
  }
  return inputField(field.field_key, field.label, value, field.required, field.type === "date" ? "date" : "text");
}

function paymentOption(value, label, selected) {
  return `<label><input type="radio" name="payment_method" value="${value}" ${selected === value ? "checked" : ""} /> ${escapeHtml(label)}</label>`;
}

function renderWarnings(warnings) {
  return warnings.map((warning) => `<div class="alert ${warning.type}">${escapeHtml(warning.text)}</div>`).join("");
}

function bindRegistrationEvents() {
  document.querySelectorAll("[data-step]").forEach((button) => {
    button.addEventListener("click", () => {
      collectRegistrationForm();
      state.registrationState.step = Number(button.dataset.step);
      renderRegistration(state.registrationState.event_id);
    });
  });
  document.querySelector("[data-action='next-step']")?.addEventListener("click", () => {
    collectRegistrationForm();
    const errors = validateStep(state.registrationState.step);
    state.registrationState.warnings = buildWarnings();
    maybeShowInsuranceRenewalPopup();
    if (errors.length) return showToast(errors[0], "error");
    state.registrationState.step += 1;
    renderRegistration(state.registrationState.event_id);
  });
  document.querySelector("[data-action='prev-step']")?.addEventListener("click", () => {
    collectRegistrationForm();
    state.registrationState.step -= 1;
    renderRegistration(state.registrationState.event_id);
  });
  document.querySelector("#registrationForm")?.addEventListener("change", (event) => {
    if (event.target.name === "certification_file") state.registrationState.newCertificationFile = event.target.files[0] || null;
    if (event.target.name === "insurance_file") state.registrationState.newInsuranceFile = event.target.files[0] || null;
    collectRegistrationForm();
    if (event.target.name === "insurance_valid_until") maybeShowInsuranceRenewalPopup();
    if (["nitrox_certified", "equipment_required", "equipment_items"].includes(event.target.name)) {
      if (state.registrationState.form.nitrox_certified !== "yes") state.registrationState.form.nitrox_level = "none";
      renderRegistration(state.registrationState.event_id);
    }
  });
  document.querySelector("#registrationForm")?.addEventListener("submit", handleRegistrationSubmit);
}

function collectRegistrationForm() {
  const form = document.querySelector("#registrationForm");
  if (!form || !state.registrationState) return;
  syncRegistrationFilesFromForm(form);
  const data = new FormData(form);
  for (const [key, value] of data.entries()) {
    if (key !== "certification_file" && key !== "insurance_file") state.registrationState.form[key] = typeof value === "string" ? value.trim() : value;
  }
  state.registrationState.form.terms_accepted = data.get("terms_accepted") === "on";
  state.registrationState.form.save_details_for_next_time = data.get("save_details_for_next_time") === "on";
  state.registrationState.form.equipment_required = data.get("equipment_required") || state.registrationState.form.equipment_required || "no";
  state.registrationState.form.equipment_items = state.registrationState.form.equipment_required === "yes" ? data.getAll("equipment_items") : [];
  if (!state.registrationState.form.equipment_items.includes("fins")) state.registrationState.form.shoe_size = "";
  if (state.registrationState.form.nitrox_certified !== "yes") state.registrationState.form.nitrox_level = "none";
}

function syncRegistrationFilesFromForm(form) {
  const certificationFile = form.querySelector('input[name="certification_file"]')?.files?.[0];
  const insuranceFile = form.querySelector('input[name="insurance_file"]')?.files?.[0];
  if (certificationFile) state.registrationState.newCertificationFile = certificationFile;
  if (insuranceFile) state.registrationState.newInsuranceFile = insuranceFile;
}

function requiredActiveDynamicFields() {
  return state.db.DynamicFormFields.filter((field) => field.form_name === "registration" && field.is_active && field.required);
}

function validateStep(step) {
  const f = state.registrationState.form;
  const errors = [];
  if (step === 1) {
    ["first_name", "last_name", "phone", "email", "id_number", "birth_date"].forEach((key) => {
      if (isRegistrationFieldRequired(key) && !f[key]) errors.push("יש למלא את כל שדות החובה בפרטים האישיים.");
    });
    ["diving_rank", "nitrox_certified", "nitrox_level", "insurance_valid_until", "last_dive_date", "air_type"].forEach((key) => {
      if (isRegistrationFieldRequired(key) && !f[key]) errors.push("יש להשלים את פרטי הצלילה והביטוח.");
    });
    if (isRegistrationFieldRequired("certification_file") && !f.existingCertificationFileUrl && !state.registrationState.newCertificationFile) errors.push("יש להעלות תעודת צלילה או להשתמש בקובץ שמור.");
    if (isRegistrationFieldRequired("insurance_file") && !f.existingInsuranceFileUrl && !state.registrationState.newInsuranceFile) errors.push("יש להעלות ביטוח או להשתמש בקובץ שמור.");
    if (f.equipment_required === "yes" && selectedEquipmentItems(f).includes("fins") && !f.shoe_size) errors.push("יש להזין מידת נעליים עבור השכרת סנפירים.");
    requiredActiveDynamicFields().forEach((field) => {
      const value = f[field.field_key];
      if ((field.type === "checkbox" || field.type === "switch") && !value) errors.push(`יש לסמן את השדה: ${field.label}`);
      if (field.type !== "checkbox" && field.type !== "switch" && !value) errors.push(`יש למלא את השדה: ${field.label}`);
    });
    return [...new Set(errors)];
  }
  if (step === 2) {
    if (isRegistrationFieldRequired("terms_accepted") && !f.terms_accepted) errors.push("יש לאשר את תנאי הביטול.");
    if (isRegistrationFieldActive("save_details_for_next_time") && f.save_details_for_next_time) {
      if (!f.account_password || f.account_password.length < 6) errors.push("כדי לשמור פרטים יש לבחור סיסמה באורך 6 תווים לפחות.");
      if (f.account_password !== f.account_password_confirm) errors.push("אימות הסיסמה לא תואם לסיסמה שנבחרה.");
    }
    if (isRegistrationFieldRequired("signature") && !state.registrationState.signatureDataUrl) errors.push("חתימה דיגיטלית היא חובה.");
    return [...new Set(errors)];
  }
  if (step === 1) {
    ["first_name", "last_name", "phone", "id_number", "birth_date"].forEach((key) => {
      if (!f[key]) errors.push("יש למלא את כל שדות החובה בפרטים האישיים.");
    });
  }
  if (step === 2) {
    ["diving_rank", "nitrox_certified", "insurance_valid_until", "last_dive_date", "air_type"].forEach((key) => {
      if (!f[key]) errors.push("יש להשלים את פרטי הצלילה והביטוח.");
    });
    if (!f.existingCertificationFileUrl && !state.registrationState.newCertificationFile) errors.push("יש להעלות תעודת צלילה או להשתמש בקובץ שמור.");
    if (!f.existingInsuranceFileUrl && !state.registrationState.newInsuranceFile) errors.push("יש להעלות ביטוח או להשתמש בקובץ שמור.");
  }
  if (step === 3 && !f.terms_accepted) errors.push("יש לאשר את תנאי הביטול.");
  if (step === 4 && !state.registrationState.signatureDataUrl) errors.push("חתימה דיגיטלית היא חובה.");
  return [...new Set(errors)];
}

function buildWarnings() {
  const f = state.registrationState.form;
  const warnings = [];
  const insuranceDate = new Date(`${f.insurance_valid_until}T00:00:00`);
  const lastDiveDate = new Date(`${f.last_dive_date}T00:00:00`);
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  if (f.insurance_valid_until && insuranceDate < new Date()) {
    warnings.push({ type: "danger", text: "הביטוח אינו בתוקף. יש לחדש ביטוח לפני אישור ההרשמה." });
  }
  if (f.last_dive_date && ["OWD / כוכב 1", "AOWD / כוכב 2"].includes(f.diving_rank) && lastDiveDate < sixMonthsAgo) {
    warnings.push({ type: "danger", text: "לפי תאריך הצלילה האחרונה ייתכן שנדרשת צלילת רענון. יש ליצור קשר עם המועדון." });
  }
  if (f.last_dive_date && ["Dive Master", "Instructor"].includes(f.diving_rank) && lastDiveDate < sixMonthsAgo) {
    warnings.push({ type: "warn", text: "עבר זמן מאז הצלילה האחרונה שלך. כדייבמאסטר / מדריך, אין חובה לצלילת רענון, אך אנו ממליצים לבצע הערכה עצמית ולוודא שאתה מרגיש כשיר, מאוזן ובטוח לקראת הצלילה." });
  }
  if (f.last_dive_date && f.diving_rank === "Master Diver" && lastDiveDate < sixMonthsAgo) {
    warnings.push({ type: "warn", text: "עבר זמן מאז הצלילה האחרונה שלך. ההודעה אינפורמטיבית בלבד ואינה חוסמת הרשמה, אך מומלץ לוודא שאתה מרגיש כשיר, מאוזן ובטוח לקראת הצלילה." });
  }
  return warnings;
}

function setupSignaturePad() {
  const canvas = document.querySelector("#signaturePad");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#054653";
  let drawing = false;
  const position = (event) => {
    const rect = canvas.getBoundingClientRect();
    const point = event.touches ? event.touches[0] : event;
    return { x: (point.clientX - rect.left) * (canvas.width / rect.width), y: (point.clientY - rect.top) * (canvas.height / rect.height) };
  };
  const start = (event) => {
    drawing = true;
    const p = position(event);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    event.preventDefault();
  };
  const move = (event) => {
    if (!drawing) return;
    const p = position(event);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    state.registrationState.signatureDataUrl = canvas.toDataURL("image/png");
    event.preventDefault();
  };
  const end = () => {
    drawing = false;
    state.registrationState.signatureDataUrl = canvas.toDataURL("image/png");
  };
  canvas.addEventListener("pointerdown", start);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointerleave", end);
  canvas.addEventListener("touchstart", start, { passive: false });
  canvas.addEventListener("touchmove", move, { passive: false });
  canvas.addEventListener("touchend", end);
  document.querySelector("[data-action='clear-signature']")?.addEventListener("click", () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    state.registrationState.signatureDataUrl = "";
    renderRegistration(state.registrationState.event_id);
  });
}

async function handleRegistrationSubmit(event) {
  event.preventDefault();
  collectRegistrationForm();
  state.registrationState.warnings = buildWarnings();
  maybeShowInsuranceRenewalPopup();
  const errors = validateStep(2);
  if (errors.length) {
    showToast(errors[0], "error");
    renderRegistration(state.registrationState.event_id);
    return;
  }

  state.registrationState.loading = true;
  renderRegistration(state.registrationState.event_id);

  try {
    console.log("התחלת שליחה");
    console.log("בדיקת שדות חובה");
    if (validateStep(1).length || validateStep(2).length) throw new Error("יש להשלים שדות חובה.");

    console.log("התחלת העלאת תעודה");
    const certificationUrl = state.registrationState.newCertificationFile ? await readFileAsStoredUrl(state.registrationState.newCertificationFile) : state.registrationState.form.existingCertificationFileUrl;
    console.log("סיום העלאת תעודה");

    console.log("התחלת העלאת ביטוח");
    const insuranceUrl = state.registrationState.newInsuranceFile ? await readFileAsStoredUrl(state.registrationState.newInsuranceFile) : state.registrationState.form.existingInsuranceFileUrl;
    console.log("סיום העלאת ביטוח");

    console.log("התחלת שמירת חתימה");
    const signatureBlob = dataUrlToBlob(state.registrationState.signatureDataUrl);
    if (!signatureBlob.size) throw new Error("שמירת החתימה נכשלה. נסו לחתום שוב.");
    const signatureUrl = state.registrationState.signatureDataUrl;
    console.log("סיום שמירת חתימה");

    const eventData = eventById(state.registrationState.event_id);
    const waitingList = seatCount(eventData.id) >= eventData.max_participants;
    const f = state.registrationState.form;
    const paymentStatus = f.payment_method === "club_member" ? "exempt_club_member" : "unpaid";
    const registeredUserId = f.save_details_for_next_time ? await ensureRegularUserFromRegistration(f) : guestRegistrationUserId(f);
    const selectedEquipment = f.equipment_required === "yes" ? selectedEquipmentItems(f) : [];
    const selectedEquipmentCost = f.equipment_required === "yes" ? equipmentCost(f) : 0;
    const totalPrice = Number(eventData.price || 0) + selectedEquipmentCost;

    console.log("יצירת הרשמה");
    const registration = {
      id: id("registration"),
      event_id: eventData.id,
      user_id: registeredUserId,
      first_name: f.first_name,
      last_name: f.last_name,
      phone: f.phone,
      email: f.email,
      id_number: f.id_number,
      birth_date: f.birth_date,
      diving_rank: f.diving_rank,
      nitrox_certified: f.nitrox_certified === "yes",
      nitrox_level: f.nitrox_level || "none",
      insurance_valid_until: f.insurance_valid_until,
      last_dive_date: f.last_dive_date,
      certification_file_url: certificationUrl,
      insurance_file_url: insuranceUrl,
      buddy_name: f.buddy_name || "",
      air_type: f.air_type,
      equipment_required: f.equipment_required === "yes",
      equipment_items: selectedEquipment,
      shoe_size: selectedEquipment.includes("fins") ? f.shoe_size : "",
      equipment_cost: selectedEquipmentCost,
      total_price: totalPrice,
      terms_accepted: f.terms_accepted,
      signature_url: signatureUrl,
      payment_method: f.payment_method,
      payment_status: paymentStatus,
      club_approval_status: waitingList ? "waiting_list" : "pending",
      admin_notes: state.registrationState.warnings.map((warning) => warning.text).join(" | "),
      user_notes: f.user_notes || "",
      is_club_member_registration: state.db.Users.find((user) => user.id === registeredUserId)?.is_club_member || false,
      created_date: nowIso()
    };
    state.db.DiveRegistrations.push(registration);

    if (f.save_details_for_next_time) {
      console.log("עדכון פרופיל");
      updateProfileFromRegistration(f, certificationUrl, insuranceUrl, registeredUserId);
    }

    saveDb();
    console.log("סיום הצלחה");
    state.registrationState = null;
    navigate(`success/${registration.id}`);
  } catch (error) {
    showToast(error.message || "שגיאה בשליחת ההרשמה.", "error");
  } finally {
    if (state.registrationState) state.registrationState.loading = false;
    render();
  }
}

function guestRegistrationUserId(f) {
  const existing = state.db.Users.find((user) => user.id === state.currentUserId && (user.id_number === f.id_number || user.phone === f.phone));
  return existing?.id || "";
}

async function ensureRegularUserFromRegistration(f) {
  const existing = state.db.Users.find((user) => user.id_number === f.id_number || user.phone === f.phone);
  const passwordHash = f.account_password ? await hashPassword(f.account_password) : "";
  if (existing) {
    if (passwordHash) {
      existing.password_hash = passwordHash;
      existing.password_updated_date = nowIso();
    }
    state.currentUserId = existing.id;
    sessionStorage.setItem(SESSION_KEY, state.currentUserId);
    return existing.id;
  }

  const newUser = {
    id: id("user"),
    first_name: f.first_name,
    last_name: f.last_name,
    email: f.email,
    phone: f.phone,
    id_number: f.id_number,
    birth_date: f.birth_date,
    role: "user",
    is_club_member: false,
    club_member_notes: "",
    saved_diver_profile: false,
    password_hash: passwordHash,
    password_updated_date: passwordHash ? nowIso() : "",
    created_date: nowIso()
  };
  state.db.Users.push(newUser);
  state.currentUserId = newUser.id;
  sessionStorage.setItem(SESSION_KEY, state.currentUserId);
  return newUser.id;
}

function updateProfileFromRegistration(f, certificationUrl, insuranceUrl, userId = state.currentUserId) {
  const profile = getProfile(userId);
  const payload = {
    user_id: userId,
    first_name: f.first_name,
    last_name: f.last_name,
    phone: f.phone,
    email: f.email,
    id_number: f.id_number,
    birth_date: f.birth_date,
    diving_rank: f.diving_rank,
    nitrox_certified: f.nitrox_certified === "yes",
    nitrox_level: f.nitrox_level || "none",
    insurance_valid_until: f.insurance_valid_until,
    last_dive_date: f.last_dive_date,
    certification_file_url: certificationUrl,
    insurance_file_url: insuranceUrl,
    save_details_for_next_time: true,
    updated_date: nowIso()
  };
  if (profile) Object.assign(profile, payload);
  else state.db.DiverProfiles.push({ id: id("profile"), ...payload });
  Object.assign(state.db.Users.find((user) => user.id === userId), {
    first_name: f.first_name,
    last_name: f.last_name,
    phone: f.phone,
    email: f.email,
    id_number: f.id_number,
    birth_date: f.birth_date,
    saved_diver_profile: true
  });
}

function renderSuccess(registrationId) {
  const registration = state.db.DiveRegistrations.find((item) => item.id === registrationId);
  app.innerHTML = `
    <section class="success-screen">
      <div class="panel success-card">
        <p class="eyebrow">ההרשמה נקלטה</p>
        <h1>${escapeHtml(textValue("success", "summary", "ההרשמה התקבלה ונמצאת בהמתנה לאישור המועדון."))}</h1>
        <p>${registration?.payment_method !== "club_member" ? "ההרשמה תאושר סופית לאחר קבלת תשלום ואישור המועדון." : "חבר/ת מועדון יכול/ה להירשם בלי תשלום מראש, ועדיין נדרש אישור מועדון."}</p>
        <div class="actions">
          <a class="btn primary" href="#mydives">הצלילות שלי</a>
          <a class="btn secondary" href="#sites">חזרה לאתרים</a>
        </div>
      </div>
    </section>
  `;
}

function renderMyDives() {
  if (state.currentUserId === "guest") {
    app.innerHTML = `
      <section class="section">
        <div class="panel">
          <p class="eyebrow">הצלילות שלי</p>
          <h2>כדי לראות הרשמות שמורות צריך להיכנס</h2>
          <p>אפשר להירשם לצלילה גם בלי חשבון. אם בסוף ההרשמה בוחרים לשמור פרטים, ניתן לראות כאן את ההרשמות בפעמים הבאות.</p>
          <a class="btn primary" href="#login">כניסה לפי טלפון או תעודת זהות</a>
        </div>
      </section>
    `;
    return;
  }
  const rows = state.db.DiveRegistrations.filter((reg) => reg.user_id === state.currentUserId);
  app.innerHTML = `
    <section class="section">
      <div class="section-header">
        <div>
          <p class="eyebrow">הצלילות שלי</p>
          <h2>הרשמות וסטטוסים</h2>
          <p>כאן מוצגים אישור המועדון, סטטוס תשלום והערות פנימיות שחולקו איתך.</p>
        </div>
      </div>
      ${rows.length ? `<div class="grid two">${rows.map(renderMyDiveCard).join("")}</div>` : `<div class="empty">עוד אין הרשמות.</div>`}
    </section>
  `;
}

function renderMyDiveCard(registration) {
  const event = eventById(registration.event_id);
  const site = siteById(event?.site_id);
  return `
    <article class="card">
      <div class="card-body">
        <h3>${escapeHtml(site?.name || "")}</h3>
        <div class="meta-list">
          <div class="meta-item"><span>תאריך</span><strong>${formatDate(event?.dive_date)}</strong></div>
          <div class="meta-item"><span>שעה</span><strong>${event?.dive_time || ""}</strong></div>
          <div class="meta-item"><span>סטטוס אישור</span><strong>${APPROVAL_STATUS[registration.club_approval_status]}</strong></div>
          <div class="meta-item"><span>סטטוס תשלום</span><strong>${PAYMENT_STATUS[registration.payment_status]}</strong></div>
        </div>
        <p>${escapeHtml(registration.admin_notes || "אין הערות מועדון.")}</p>
      </div>
    </article>
  `;
}

function renderProfile() {
  if (state.currentUserId === "guest") {
    app.innerHTML = `
      <section class="section">
        <div class="panel">
          <p class="eyebrow">הפרופיל שלי</p>
          <h2>אין פרופיל שמור לאורח/ת</h2>
          <p>בסוף הרשמה לצלילה אפשר לבחור להירשם לאפליקציה ולשמור את הפרטים לפעם הבאה.</p>
          <a class="btn primary" href="#sites">בחירת צלילה להרשמה</a>
        </div>
      </section>
    `;
    return;
  }
  const profile = getProfile();
  app.innerHTML = `
    <section class="section">
      <div class="panel">
        <p class="eyebrow">הפרופיל שלי</p>
        <h2>פרטי צולל שמורים</h2>
        <form id="profileForm" class="form-grid">
          ${inputField("first_name", "שם פרטי", profile?.first_name || currentUser().first_name, true)}
          ${inputField("last_name", "שם משפחה", profile?.last_name || currentUser().last_name, true)}
          ${inputField("phone", "טלפון", profile?.phone || currentUser().phone, true)}
          ${inputField("email", "אימייל", profile?.email || currentUser().email, false, "email")}
          ${inputField("id_number", "תעודת זהות", profile?.id_number || currentUser().id_number, true)}
          ${inputField("birth_date", "תאריך לידה", profile?.birth_date || currentUser().birth_date, true, "date")}
          ${selectField("diving_rank", "דרגת צלילה", profile?.diving_rank || "", RANKS, true)}
          ${selectField("nitrox_certified", "הסמכת נייטרוקס", profile?.nitrox_certified ? "yes" : "no", [["yes", "כן"], ["no", "לא"]], true)}
          ${selectField("nitrox_level", "דרגת נייטרוקס", profile?.nitrox_level || "none", NITROX_LEVELS.map((level) => [level, level === "none" ? "ללא" : level]), false)}
          ${inputField("insurance_valid_until", "תוקף ביטוח", profile?.insurance_valid_until || "", true, "date")}
          ${inputField("last_dive_date", "תאריך צלילה אחרונה", profile?.last_dive_date || "", true, "date")}
          <div class="field"><button class="btn primary" type="submit">שמירת פרופיל</button></div>
        </form>
      </div>
    </section>
  `;
  document.querySelector("#profileForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    updateProfileFromRegistration({ ...data, save_details_for_next_time: true }, profile?.certification_file_url || "", profile?.insurance_file_url || "");
    saveDb();
    showToast("הפרופיל נשמר.");
    render();
  });
}

function renderSignup() {
  if (state.currentUserId !== "guest") {
    app.innerHTML = `
      <section class="section">
        <div class="panel">
          <h2>כבר התחברת</h2>
          <p>אפשר להמשיך לדף הבית, לפרופיל או לצלילות שלך.</p>
          <div class="actions">
            <a class="btn primary" href="#home">דף הבית</a>
            <a class="btn secondary" href="#profile">הפרופיל שלי</a>
          </div>
        </div>
      </section>
    `;
    return;
  }

  app.innerHTML = `
    <section class="section">
      <div class="panel">
        <p class="eyebrow">הרשמה</p>
        <h2>יצירת משתמש לשמירת פרטים לפעמים הבאות</h2>
        <p>אפשר להירשם לצלילות גם בלי חשבון. משתמש נוצר רק אם רוצים לשמור פרטים ולהיכנס בפעמים הבאות עם סיסמה.</p>
        <form id="signupForm" class="form-grid">
          ${inputField("first_name", "שם פרטי", "", true)}
          ${inputField("last_name", "שם משפחה", "", true)}
          ${inputField("phone", "טלפון נייד", "", true, "tel")}
          ${inputField("email", "אימייל", "", false, "email")}
          ${inputField("id_number", "תעודת זהות", "", false)}
          ${inputField("password", "סיסמה", "", true, "password")}
          <div class="field">
            <button class="btn primary" type="submit">יצירת משתמש</button>
          </div>
        </form>
      </div>
    </section>
  `;

  document.querySelector("#signupForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const email = String(data.email || "").trim().toLowerCase();
    const phone = String(data.phone || "").trim();
    const idNumber = String(data.id_number || "").trim();
    const password = String(data.password || "");

    if (!data.first_name || !data.last_name || !phone || password.length < 6) {
      showToast("יש למלא שם, טלפון וסיסמה באורך 6 תווים לפחות.", "error");
      return;
    }
    if (state.db.Users.some((user) => (email && user.email?.toLowerCase() === email) || (phone && user.phone === phone) || (idNumber && user.id_number === idNumber))) {
      showToast("כבר קיים משתמש עם המייל, הטלפון או תעודת הזהות האלו.", "error");
      return;
    }

    const newUser = {
      id: id("user"),
      first_name: String(data.first_name || "").trim(),
      last_name: String(data.last_name || "").trim(),
      email,
      phone,
      id_number: idNumber,
      birth_date: "",
      role: "user",
      is_club_member: false,
      club_member_notes: "",
      saved_diver_profile: false,
      password_hash: await hashPassword(password),
      password_updated_date: nowIso(),
      created_date: nowIso()
    };
    state.db.Users.push(newUser);
    state.currentUserId = newUser.id;
    sessionStorage.setItem(SESSION_KEY, state.currentUserId);
    saveDb();
    showToast("המשתמש נוצר בהצלחה.");
    navigate("profile");
  });
}

function renderLogin() {
  if (state.loginState?.needsAdminCode) {
    app.innerHTML = `
      <section class="section">
        <div class="panel">
          <p class="eyebrow">אימות מנהל</p>
          <h2>קוד אישור לאדמין</h2>
          <p>נדרש קוד אישור נוסף למנהלי מועדון ואדמין. בשלב זה, עד שנחבר שליחת SMS/מייל אמיתית, הקוד מופיע כאן לבדיקה: <strong>${state.loginState.adminCode}</strong></p>
          <form id="adminCodeForm" class="form-grid">
            ${inputField("admin_code", "קוד אישור", "", true)}
            <div class="field">
              <button class="btn primary" type="submit">אישור כניסה</button>
            </div>
          </form>
        </div>
      </section>
    `;
    document.querySelector("#adminCodeForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const code = String(new FormData(event.currentTarget).get("admin_code") || "").trim();
      if (code !== state.loginState.adminCode) {
        showToast("קוד האישור שגוי.", "error");
        return;
      }
      state.currentUserId = state.loginState.userId;
      sessionStorage.setItem(SESSION_KEY, state.currentUserId);
      state.loginState = null;
      state.registrationState = null;
      showToast("נכנסת כאדמין.");
      navigate("home");
    });
    return;
  }

  app.innerHTML = `
    <section class="section">
      <div class="panel">
        <p class="eyebrow">כניסה</p>
        <h2>כניסה לפי אימייל, טלפון או תעודת זהות</h2>
        <p>משתמש ששמר פרטים נכנס עם הסיסמה שבחר. הרשאות מנהל ואדמין ניתנות רק דרך ניהול מועדון.</p>
        <form id="loginForm" class="form-grid">
          ${inputField("identifier", "אימייל, טלפון או תעודת זהות", "", true)}
          ${inputField("password", "סיסמה", "", false, "password")}
          <div class="field">
            <button class="btn primary" type="submit">כניסה</button>
          </div>
          <button class="btn ghost" type="button" data-action="forgot-password">שכחתי סיסמה</button>
        </form>
      </div>
    </section>
  `;
  document.querySelector("#loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const identifier = String(data.get("identifier") || "").trim();
    const password = String(data.get("password") || "");
    const normalizedIdentifier = identifier.toLowerCase();
    const user = state.db.Users.find((item) => item.phone === identifier || item.id_number === identifier || item.email?.toLowerCase() === normalizedIdentifier);
    if (!user) {
      showToast("לא נמצא משתמש עם האימייל, הטלפון או תעודת הזהות שהוזנו. בהרשמה הראשונה ייווצר משתמש רגיל.", "error");
      return;
    }
    if (!user.password_hash) {
      if (!password || password.length < 6) {
        showToast("זו כניסה ראשונה. בחרי סיסמה באורך 6 תווים לפחות.", "error");
        return;
      }
      user.password_hash = await hashPassword(password);
      user.password_updated_date = nowIso();
      saveDb();
    } else if (!await verifyPassword(password, user.password_hash)) {
      showToast("הסיסמה שגויה.", "error");
      return;
    }
    if (user.role === "admin" || user.role === "club_manager") {
      state.loginState = {
        needsAdminCode: true,
        userId: user.id,
        adminCode: generateLoginCode()
      };
      showToast("נדרש קוד אישור נוסף למנהל.");
      renderLogin();
      return;
    }
    state.currentUserId = user.id;
    sessionStorage.setItem(SESSION_KEY, state.currentUserId);
    state.registrationState = null;
    showToast(`נכנסת כ-${user.first_name} ${user.last_name}`);
    navigate("home");
  });
  document.querySelector("[data-action='forgot-password']").addEventListener("click", () => {
    showToast("איפוס סיסמה במייל דורש חיבור Firebase Auth. הכנתי את מסך הסיסמאות, ונחבר שליחה אמיתית בשלב הבא.", "error");
  });
}

function renderClubAdmin() {
  if (!canManage()) {
    app.innerHTML = `<section class="section"><div class="alert danger">אין לך הרשאה לצפות בניהול מועדון.</div></section>`;
    return;
  }
  const tabs = [
    ["registrations", "ניהול הרשמות"],
    ["sites", "ניהול אתרי צלילה"],
    ["events", "ניהול צלילות פתוחות"],
    ["users", "ניהול משתמשים / הרשאות"],
    ["brand", "לוגו המועדון"],
    ["texts", "ניהול טקסטים ושדות"],
    ["payments", "הגדרות תשלום"]
  ];
  app.innerHTML = `
    <section class="section">
      <div class="section-header">
        <div>
          <p class="eyebrow">ניהול מועדון</p>
          <h2>אזור מנהלים</h2>
          <p>גלוי רק למשתמשים עם role מסוג admin או club_manager.</p>
        </div>
      </div>
      ${state.cloudEnabled ? "" : `<div class="alert danger">האפליקציה אינה מחוברת כרגע ל-Firebase. הרשמות ממכשירים אחרים לא יופיעו כאן עד שחיבור הענן יפעל.</div>`}
      <div class="admin-layout">
        <aside class="panel admin-menu">${tabs.map(([key, label]) => `<button class="btn ${state.currentAdminTab === key ? "primary" : "secondary"}" data-admin-tab="${key}" type="button">${label}</button>`).join("")}</aside>
        <div id="adminContent">${renderAdminContent()}</div>
      </div>
    </section>
  `;
  document.querySelectorAll("[data-admin-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.currentAdminTab = button.dataset.adminTab;
      renderClubAdmin();
    });
  });
  bindAdminForms();
}

function renderAdminContent() {
  if (state.currentAdminTab === "sites") return renderAdminSites();
  if (state.currentAdminTab === "events") return renderAdminEvents();
  if (state.currentAdminTab === "users") return renderAdminUsers();
  if (state.currentAdminTab === "brand") return renderAdminBrand();
  if (state.currentAdminTab === "texts") return renderAdminTexts();
  if (state.currentAdminTab === "payments") return renderAdminPayments();
  return renderAdminRegistrations();
}

function tableSelect(field, value, options) {
  return `<select data-reg-field="${field}">${options.map(([optionValue, label]) => `<option value="${escapeHtml(optionValue)}" ${String(value) === String(optionValue) ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")}</select>`;
}

function equipmentItemsText(items) {
  const selected = Array.isArray(items) ? items : String(items || "").split(",").filter(Boolean);
  const labels = EQUIPMENT_ITEMS.filter((item) => selected.includes(item.key)).map((item) => item.label);
  return labels.length ? labels.join(", ") : "-";
}

function equipmentCheckboxes(items) {
  const selected = Array.isArray(items) ? items : String(items || "").split(",").filter(Boolean);
  return `<div class="equipment-admin-options">${EQUIPMENT_ITEMS.map((item) => `<label class="checkbox-field compact-check"><input data-reg-equipment-item value="${item.key}" type="checkbox" ${selected.includes(item.key) ? "checked" : ""} /> ${item.label}</label>`).join("")}</div>`;
}

function registrationFileLink(registrationId, field, url, label) {
  if (!url) return "-";
  if (!isPreviewableFileUrl(url)) return `<span class="muted-file">${label} נשמר</span>`;
  return `<button class="link-button file-preview-link" type="button" data-file-preview="${registrationId}" data-file-field="${field}">צפייה ב${label}</button>`;
}

function isPreviewableFileUrl(url) {
  return /^(data:|https?:|blob:)/i.test(String(url || ""));
}

function fileTypeLabel(field) {
  return field === "insurance_file_url" ? "ביטוח" : "תעודת צלילה";
}

function showFilePreview(registrationId, field, sourceElement) {
  const reg = state.db.DiveRegistrations.find((item) => item.id === registrationId);
  const editedValue = sourceElement?.closest("[data-registration-row]")?.querySelector(`[data-reg-field="${field}"]`)?.value?.trim();
  const url = editedValue || reg?.[field] || "";
  if (!isPreviewableFileUrl(url)) {
    showToast("אין קובץ שניתן להציג. ייתכן שזו הרשמה ישנה ששמרה רק שם קובץ.", "error");
    return;
  }
  document.querySelector(".file-preview-modal")?.remove();
  const modal = document.createElement("div");
  modal.className = "file-preview-modal";
  modal.innerHTML = `
    <div class="file-preview-modal__card" role="dialog" aria-modal="true">
      <div class="file-preview-modal__head">
        <h3>צפייה ב${fileTypeLabel(field)}</h3>
        <button class="btn ghost compact" type="button" data-file-preview-close>סגירה</button>
      </div>
      <div class="file-preview-frame-wrap">
        ${String(url).startsWith("data:image") ? `<img src="${escapeHtml(url)}" alt="${fileTypeLabel(field)}" />` : `<iframe src="${escapeHtml(url)}" title="${fileTypeLabel(field)}"></iframe>`}
      </div>
      <div class="actions">
        <a class="btn secondary" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">פתיחה בלשונית חדשה</a>
      </div>
    </div>
  `;
  modal.addEventListener("click", (event) => {
    if (event.target === modal || event.target.closest("[data-file-preview-close]")) modal.remove();
  });
  document.body.appendChild(modal);
}

function filePreviewEditor(registrationId, field, value, label) {
  return `<div class="file-preview-editor">
    <input data-reg-field="${field}" value="${escapeHtml(value)}" />
    ${isPreviewableFileUrl(value) ? `<button class="btn secondary compact" type="button" data-file-preview="${registrationId}" data-file-field="${field}">צפייה ב${label}</button>` : `<span class="file-preview-empty">אין קובץ להצגה, רק שם קובץ שמור</span>`}
  </div>`;
}

function registrationEditCell(label, control) {
  return `<td><label class="compact-edit-field"><span>${label}</span>${control}</label></td>`;
}

function renderRegistrationAdminRow(reg) {
  const event = eventById(reg.event_id);
  const site = siteById(event?.site_id);
  const isEditing = state.editingRegistrationId === reg.id;
  const summaryRow = `<tr>
    <td>${escapeHtml(reg.first_name)} ${escapeHtml(reg.last_name)}</td>
    <td>${escapeHtml(reg.diving_rank || "-")}</td>
    <td>${escapeHtml(reg.phone || "-")}</td>
    <td>${escapeHtml(reg.email || "-")}</td>
    <td>${PAYMENT_METHODS[reg.payment_method] || reg.payment_method || "-"}</td>
    <td><span class="badge info">${PAYMENT_STATUS[reg.payment_status] || reg.payment_status}</span></td>
    <td><span class="badge ok">${APPROVAL_STATUS[reg.club_approval_status] || reg.club_approval_status}</span></td>
    <td>${formatDate(event?.dive_date || "")}</td>
    <td>${escapeHtml(event?.dive_time || "-")}</td>
    <td>${escapeHtml(site?.name || "-")}</td>
    <td>${reg.equipment_required ? equipmentItemsText(reg.equipment_items) : "לא"}</td>
    <td>${Number(reg.total_price || event?.price || 0)} ₪</td>
    <td>${reg.is_club_member_registration ? `<span class="badge warn">כן</span>` : "לא"}</td>
    <td>${registrationFileLink(reg.id, "certification_file_url", reg.certification_file_url, "תעודה")} ${registrationFileLink(reg.id, "insurance_file_url", reg.insurance_file_url, "ביטוח")}</td>
    <td><button class="link-button" type="button" data-registration-edit="${reg.id}">${isEditing ? "סגור" : "עריכה"}</button></td>
  </tr>`;
  if (!isEditing) return summaryRow;
  return `${summaryRow}<tr class="registration-edit-row" data-registration-row="${reg.id}">
    <td colspan="15">
      <div class="registration-edit-scroll">
        <table class="registration-edit-table">
          <thead><tr><th>שם פרטי</th><th>שם משפחה</th><th>טלפון</th><th>אימייל</th><th>תעודת זהות</th><th>תאריך לידה</th><th>דרגה</th><th>תוקף ביטוח</th><th>צלילה אחרונה</th><th>נייטרוקס</th><th>דרגת נייטרוקס</th><th>סוג אוויר</th><th>בן זוג</th><th>נדרש ציוד</th><th>פריטי ציוד</th><th>מידת נעליים</th><th>עלות ציוד</th><th>סה"כ לתשלום</th><th>שיטת תשלום</th><th>סטטוס תשלום</th><th>סטטוס אישור</th><th>חבר מועדון</th><th>הערות מנהל</th><th>הערות צולל</th><th>תעודה</th><th>ביטוח</th><th>חתימה</th><th>פעולות</th></tr></thead>
          <tbody><tr>
            ${registrationEditCell("שם פרטי", `<input data-reg-field="first_name" value="${escapeHtml(reg.first_name)}" />`)}
            ${registrationEditCell("שם משפחה", `<input data-reg-field="last_name" value="${escapeHtml(reg.last_name)}" />`)}
            ${registrationEditCell("טלפון", `<input data-reg-field="phone" type="tel" value="${escapeHtml(reg.phone)}" />`)}
            ${registrationEditCell("אימייל", `<input data-reg-field="email" type="email" value="${escapeHtml(reg.email)}" />`)}
            ${registrationEditCell("תעודת זהות", `<input data-reg-field="id_number" value="${escapeHtml(reg.id_number)}" />`)}
            ${registrationEditCell("תאריך לידה", `<input data-reg-field="birth_date" type="date" value="${escapeHtml(reg.birth_date)}" />`)}
            ${registrationEditCell("דרגת צלילה", tableSelect("diving_rank", reg.diving_rank, RANKS.map((rank) => [rank, rank])))}
            ${registrationEditCell("תוקף ביטוח", `<input data-reg-field="insurance_valid_until" type="date" value="${escapeHtml(reg.insurance_valid_until)}" />`)}
            ${registrationEditCell("צלילה אחרונה", `<input data-reg-field="last_dive_date" type="date" value="${escapeHtml(reg.last_dive_date)}" />`)}
            ${registrationEditCell("הסמכת נייטרוקס", tableSelect("nitrox_certified", reg.nitrox_certified ? "yes" : "no", [["yes", "כן"], ["no", "לא"]]))}
            ${registrationEditCell("דרגת נייטרוקס", tableSelect("nitrox_level", reg.nitrox_level || "none", NITROX_LEVELS.map((level) => [level, level === "none" ? "ללא" : level])))}
            ${registrationEditCell("סוג אוויר", tableSelect("air_type", reg.air_type || "air", [["air", "אוויר"], ["nitrox", "נייטרוקס"]]))}
            ${registrationEditCell("בן זוג", `<input data-reg-field="buddy_name" value="${escapeHtml(reg.buddy_name)}" />`)}
            ${registrationEditCell("נדרש ציוד", tableSelect("equipment_required", reg.equipment_required ? "yes" : "no", [["no", "לא"], ["yes", "כן"]]))}
            ${registrationEditCell("פריטי ציוד", equipmentCheckboxes(reg.equipment_items))}
            ${registrationEditCell("מידת נעליים", `<input data-reg-field="shoe_size" value="${escapeHtml(reg.shoe_size || "")}" />`)}
            ${registrationEditCell("עלות ציוד", `<input data-reg-field="equipment_cost" type="number" value="${escapeHtml(reg.equipment_cost || 0)}" />`)}
            ${registrationEditCell("סהכ לתשלום", `<input data-reg-field="total_price" type="number" value="${escapeHtml(reg.total_price || event?.price || 0)}" />`)}
            ${registrationEditCell("שיטת תשלום", tableSelect("payment_method", reg.payment_method, Object.entries(PAYMENT_METHODS)))}
            ${registrationEditCell("סטטוס תשלום", tableSelect("payment_status", reg.payment_status, Object.entries(PAYMENT_STATUS)))}
            ${registrationEditCell("סטטוס אישור", tableSelect("club_approval_status", reg.club_approval_status, Object.entries(APPROVAL_STATUS)))}
            ${registrationEditCell("חבר מועדון", `<label class="checkbox-field"><input data-reg-field="is_club_member_registration" type="checkbox" ${reg.is_club_member_registration ? "checked" : ""} /> כן</label>`)}
            ${registrationEditCell("הערות מנהל", `<textarea data-reg-field="admin_notes" rows="2">${escapeHtml(reg.admin_notes)}</textarea>`)}
            ${registrationEditCell("הערות צולל", `<textarea data-reg-field="user_notes" rows="2">${escapeHtml(reg.user_notes)}</textarea>`)}
            ${registrationEditCell("תעודה", filePreviewEditor(reg.id, "certification_file_url", reg.certification_file_url, "תעודה"))}
            ${registrationEditCell("ביטוח", filePreviewEditor(reg.id, "insurance_file_url", reg.insurance_file_url, "ביטוח"))}
            ${registrationEditCell("חתימה", `<textarea data-reg-field="signature_url" rows="2">${escapeHtml(reg.signature_url)}</textarea>`)}
            <td><div class="row-actions"><button class="btn primary" type="button" data-registration-save="${reg.id}">שמור</button><button class="btn danger" type="button" data-registration-delete="${reg.id}">מחק</button></div></td>
          </tr></tbody>
        </table>
      </div>
    </td>
  </tr>`;
}

function renderAdminRegistrations() {
  const rows = state.db.DiveRegistrations.map(renderRegistrationAdminRow).join("");
  return `<div class="registrations-panel">
    <div class="registrations-toolbar">
      <h3>הרשמות (${state.db.DiveRegistrations.length})</h3>
      <select aria-label="סינון צלילות"><option>כל הצלילות</option></select>
    </div>
    <div class="table-wrap registrations-table-wrap">
      <table class="registrations-table">
        <thead><tr><th>שם</th><th>דרגה</th><th>טלפון</th><th>אימייל</th><th>אמצעי</th><th>סטטוס תשלום</th><th>אישור מועדון</th><th>תאריך</th><th>שעה</th><th>אתר</th><th>ציוד</th><th>סה"כ</th><th>חבר מועדון</th><th>מסמכים</th><th>פעולות</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="15">אין הרשמות.</td></tr>`}</tbody>
      </table>
    </div>
  </div>`;
}

function renderAdminSites() {
  const editingSite = state.editingSiteId ? siteById(state.editingSiteId) : null;
  const siteForm = {
    name: editingSite?.name || "",
    short_description: editingSite?.short_description || "",
    full_description: editingSite?.full_description || "",
    depth: editingSite?.depth || "",
    difficulty_level: editingSite?.difficulty_level || "",
    suitable_for_ranks: editingSite?.suitable_for_ranks || "",
    image_url: editingSite?.image_url || "",
    price: editingSite?.price ?? "",
    order_index: editingSite?.order_index ?? state.db.DiveSites.length + 1,
    is_active: editingSite?.is_active ?? true,
    show_on_homepage: editingSite?.show_on_homepage ?? true,
    allow_registration: editingSite?.allow_registration ?? true,
    show_price_only_in_details: editingSite?.show_price_only_in_details ?? true
  };
  return `
    <div id="siteEditor" class="panel ${editingSite ? "editor-active" : ""}">
      ${editingSite ? `<div class="alert ok">מצב עריכה פתוח עבור “${escapeHtml(editingSite.name)}”. עדכני את השדות ולחצי “שמור שינויים”.</div>` : ""}
      <h3>${editingSite ? `עריכת אתר: ${escapeHtml(editingSite.name)}` : "הוספת אתר צלילה"}</h3>
      <form id="siteForm" class="form-grid">
        <input type="hidden" name="site_id" value="${escapeHtml(editingSite?.id || "")}" />
        ${inputField("name", "שם", siteForm.name, true)}
        ${inputField("depth", "עומק", siteForm.depth, true)}
        ${inputField("difficulty_level", "רמת קושי", siteForm.difficulty_level, true)}
        ${inputField("suitable_for_ranks", "מתאים לדרגות", siteForm.suitable_for_ranks, true)}
        ${inputField("price", "מחיר", siteForm.price, true, "number")}
        ${inputField("order_index", "סדר תצוגה", siteForm.order_index, true, "number")}
        ${inputField("image_url", "קישור תמונה", siteForm.image_url, false)}
        <label class="field"><span>תיאור קצר</span><textarea name="short_description" rows="2">${escapeHtml(siteForm.short_description)}</textarea></label>
        <label class="field"><span>תיאור מלא</span><textarea name="full_description" rows="3">${escapeHtml(siteForm.full_description)}</textarea></label>
        <label class="checkbox-field"><input name="show_on_homepage" type="checkbox" ${siteForm.show_on_homepage ? "checked" : ""} /> הצגה בדף הבית</label>
        <label class="checkbox-field"><input name="allow_registration" type="checkbox" ${siteForm.allow_registration ? "checked" : ""} /> אפשר הרשמה</label>
        <label class="checkbox-field"><input name="show_price_only_in_details" type="checkbox" ${siteForm.show_price_only_in_details ? "checked" : ""} /> להציג מחיר רק בדף פרטים</label>
        <label class="checkbox-field"><input name="is_active" type="checkbox" ${siteForm.is_active ? "checked" : ""} /> פעיל</label>
        <div class="actions">
          <button class="btn primary" type="submit">${editingSite ? "שמור שינויים" : "הוסף אתר"}</button>
          ${editingSite ? `<button class="btn ghost" type="button" data-site-cancel-edit>ביטול עריכה</button>` : ""}
        </div>
      </form>
    </div>
    <div class="grid two section">${state.db.DiveSites
      .sort((a, b) => a.order_index - b.order_index)
      .map((site) => `<article class="card"><div class="card-body"><h3>${escapeHtml(site.name)}</h3><p>${escapeHtml(site.short_description)}</p><div class="meta-list"><div class="meta-item"><span>מחיר</span><strong>${site.price} ש"ח</strong></div><div class="meta-item"><span>סטטוס</span><strong>${site.is_active ? "פעיל" : "מוסתר"}</strong></div></div><div class="actions"><button class="btn primary" type="button" data-site-edit="${site.id}">עריכה</button><button class="btn secondary" type="button" data-site-toggle="${site.id}">${site.is_active ? "הסתר" : "הצג"}</button><button class="btn danger" type="button" data-site-delete="${site.id}">מחק</button></div></div></article>`)
      .join("")}</div>
  `;
}

function renderAdminEvents() {
  const editingEvent = state.editingEventId ? eventById(state.editingEventId) : null;
  const eventForm = {
    site_id: editingEvent?.site_id || "",
    dive_date: editingEvent?.dive_date || today(14),
    dive_time: editingEvent?.dive_time || "09:00",
    meeting_time: editingEvent?.meeting_time || "08:15",
    max_participants: editingEvent?.max_participants ?? 10,
    price: editingEvent?.price ?? 280,
    status: editingEvent?.status || "open",
    notes: editingEvent?.notes || "",
    registration_notes: editingEvent?.registration_notes || "כל הרשמה נבדקת ומאושרת על ידי המועדון.",
    requires_club_approval: editingEvent?.requires_club_approval ?? true
  };
  return `
    <div class="panel">
      ${editingEvent ? `<div class="alert ok">מצב עריכה פתוח עבור ${escapeHtml(siteById(editingEvent.site_id)?.name || "צלילה")} בתאריך ${formatDate(editingEvent.dive_date)}.</div>` : ""}
      <h3>${editingEvent ? "עריכת צלילה פתוחה" : "ניהול צלילות פתוחות"}</h3>
      <form id="eventForm" class="form-grid">
        <input type="hidden" name="event_id" value="${escapeHtml(editingEvent?.id || "")}" />
        ${selectField("site_id", "אתר", eventForm.site_id, state.db.DiveSites.map((site) => [site.id, site.name]), true)}
        ${inputField("dive_date", "תאריך", eventForm.dive_date, true, "date")}
        ${inputField("dive_time", "שעת צלילה", eventForm.dive_time, true, "time")}
        ${inputField("meeting_time", "שעת מפגש", eventForm.meeting_time, true, "time")}
        ${inputField("max_participants", "מקסימום משתתפים", eventForm.max_participants, true, "number")}
        ${inputField("price", "מחיר", eventForm.price, true, "number")}
        ${selectField("status", "סטטוס", eventForm.status, [["open", "פתוח"], ["closed", "סגור"], ["cancelled", "מבוטל"], ["full", "מלא"]], true)}
        <label class="field"><span>הערות</span><textarea name="notes" rows="2">${escapeHtml(eventForm.notes)}</textarea></label>
        <label class="field"><span>הערות להרשמה</span><textarea name="registration_notes" rows="2">${escapeHtml(eventForm.registration_notes)}</textarea></label>
        <label class="checkbox-field"><input name="requires_club_approval" type="checkbox" ${eventForm.requires_club_approval ? "checked" : ""} /> דורש אישור מועדון</label>
        <div class="actions">
          <button class="btn primary" type="submit">${editingEvent ? "שמור צלילה" : "הוסף צלילה"}</button>
          ${editingEvent ? `<button class="btn ghost" type="button" data-event-cancel-edit>ביטול עריכה</button>` : ""}
        </div>
      </form>
    </div>
    <div class="grid two section">${state.db.DiveEvents.map(renderAdminEventCard).join("")}</div>
  `;
}

function renderAdminEventCard(event) {
  const site = siteById(event.site_id);
  const count = seatCount(event.id);
  const participants = eventParticipants(event.id);
  const waitlist = eventWaitlist(event.id);
  const hasRoom = count < Number(event.max_participants || 0);
  return `<article class="card">
    <div class="card-body">
      <h3>${escapeHtml(site?.name || "אתר לא נמצא")}</h3>
      <div class="meta-list">
        <div class="meta-item"><span>תאריך</span><strong>${formatDate(event.dive_date)}</strong></div>
        <div class="meta-item"><span>שעה</span><strong>${event.dive_time}</strong></div>
        <div class="meta-item"><span>מפגש</span><strong>${event.meeting_time}</strong></div>
        <div class="meta-item"><span>מקומות</span><strong>${count} / ${event.max_participants}</strong></div>
        <div class="meta-item"><span>מחיר</span><strong>${event.price} ש"ח</strong></div>
        <div class="meta-item"><span>סטטוס</span><strong>${escapeHtml(event.status)}</strong></div>
      </div>
      <p>${escapeHtml(event.registration_notes || event.notes || "")}</p>
      <div class="admin-event-lists">
        <div class="admin-event-list">
          <h4>רשימת משתתפים (${participants.length})</h4>
          ${participants.length ? participants.map((reg) => `
            <div class="admin-event-person">
              <strong>${escapeHtml(reg.first_name)} ${escapeHtml(reg.last_name)}</strong>
              <span>${escapeHtml(reg.phone || "-")} � ${escapeHtml(reg.diving_rank || "-")} � ${escapeHtml(APPROVAL_STATUS[reg.club_approval_status] || reg.club_approval_status)}</span>
            </div>
          `).join("") : `<p class="muted">אין עדיין משתתפים מאושרים.</p>`}
        </div>
        <div class="admin-event-list">
          <h4>רשימת המתנה (${waitlist.length})</h4>
          ${waitlist.length ? waitlist.map((reg, index) => `
            <div class="admin-event-person">
              <strong>${index + 1}. ${escapeHtml(reg.first_name)} ${escapeHtml(reg.last_name)}</strong>
              <span>${escapeHtml(reg.phone || "-")} � ${escapeHtml(reg.diving_rank || "-")} � ${formatDate((reg.waitlist_created_date || reg.created_date || "").slice(0, 10))}</span>
            </div>
          `).join("") : `<p class="muted">אין ממתינים.</p>`}
          ${waitlist.length && hasRoom ? `<button class="btn secondary compact" type="button" data-waitlist-promote="${event.id}">העבר למשתתפים</button>` : ""}
        </div>
      </div>
      <div class="actions">
        <button class="btn primary" type="button" data-event-edit="${event.id}">עריכה</button>
        <button class="btn danger" type="button" data-event-delete="${event.id}">מחק</button>
        <a class="btn secondary" href="#register/${event.id}">מסך הרשמה</a>
      </div>
    </div>
  </article>`;
}

function renderUserRow(user) {
  return `<tr data-user-row="${user.id}">
    <td><input data-user-field="first_name" value="${escapeHtml(user.first_name)}" ${!isAdmin() ? "disabled" : ""} /></td>
    <td><input data-user-field="last_name" value="${escapeHtml(user.last_name)}" ${!isAdmin() ? "disabled" : ""} /></td>
    <td><input data-user-field="email" type="email" value="${escapeHtml(user.email)}" ${!isAdmin() ? "disabled" : ""} /></td>
    <td><input data-user-field="phone" type="tel" value="${escapeHtml(user.phone)}" ${!isAdmin() ? "disabled" : ""} /></td>
    <td><select data-user-field="role" ${!isAdmin() ? "disabled" : ""}>${Object.entries(ROLES).map(([key, label]) => `<option value="${key}" ${user.role === key ? "selected" : ""}>${label}</option>`).join("")}</select></td>
    <td><label class="checkbox-field"><input data-user-field="is_club_member" type="checkbox" ${user.is_club_member ? "checked" : ""} ${!canManage() ? "disabled" : ""} /> כן</label></td>
    <td><input data-user-field="password" type="password" placeholder="סיסמה חדשה" ${!isAdmin() ? "disabled" : ""} /></td>
    <td><div class="row-actions"><button class="btn primary" type="button" data-user-save="${user.id}" ${!isAdmin() ? "disabled" : ""}>שמור</button><button class="btn danger" type="button" data-user-delete="${user.id}" ${!isAdmin() ? "disabled" : ""}>מחק</button></div></td>
  </tr>`;
}

function renderAdminUsers() {
  const editingUser = state.editingUserId ? state.db.Users.find((user) => user.id === state.editingUserId) : null;
  const userForm = {
    first_name: editingUser?.first_name || "",
    last_name: editingUser?.last_name || "",
    email: editingUser?.email || "",
    phone: editingUser?.phone || "",
    role: editingUser?.role || "club_manager",
    is_club_member: editingUser?.is_club_member || false
  };
  return `
    <div class="panel">
      ${editingUser ? `<div class="alert ok">מצב עריכה פתוח עבור ${escapeHtml(editingUser.first_name)} ${escapeHtml(editingUser.last_name)}.</div>` : ""}
      <h3>${editingUser ? "עריכת משתמש והרשאה" : "הוספת משתמש והרשאה"}</h3>
      <p>רק אדמין יכול להגדיר משתמש רגיל, מנהל מועדון או אדמין. מנהל מועדון יכול לראות את הרשימה, אבל לא לשנות role.</p>
      <form id="adminUserForm" class="form-grid">
        <input type="hidden" name="user_id" value="${escapeHtml(editingUser?.id || "")}" />
        ${inputField("first_name", "שם פרטי", userForm.first_name, true)}
        ${inputField("last_name", "שם משפחה", userForm.last_name, true)}
        ${inputField("email", "אימייל", userForm.email, true, "email")}
        ${inputField("phone", "טלפון", userForm.phone, false, "tel")}
        ${selectField("role", "הרשאה", userForm.role, [["user", "משתמש רגיל"], ["club_manager", "מנהל מועדון"], ["admin", "אדמין"]], true)}
        ${inputField("password", editingUser ? "סיסמה חדשה (רשות)" : "סיסמה ראשונית", "", !editingUser, "password")}
        <label class="checkbox-field"><input name="is_club_member" type="checkbox" ${userForm.is_club_member ? "checked" : ""} /> חבר/ת מועדון</label>
        <div class="field">
          <button class="btn primary" type="submit" ${!isAdmin() ? "disabled" : ""}>${editingUser ? "שמור שינויים" : "הוסף משתמש"}</button>
          ${editingUser ? `<button class="btn ghost" type="button" data-user-cancel-edit>ביטול עריכה</button>` : ""}
        </div>
      </form>
    </div>
    <div class="table-wrap section">
      <table>
        <thead><tr><th>שם פרטי</th><th>שם משפחה</th><th>מייל</th><th>טלפון</th><th>role</th><th>חבר מועדון</th><th>סיסמה</th><th>פעולות</th></tr></thead>
        <tbody>${state.db.Users.map(renderUserRow).join("")}</tbody>
      </table>
    </div>
  `;
}

function renderAdminBrand() {
  const hasCustomLogo = Boolean(state.db.BrandSettings?.logo_data_url);
  const previewLogo = hasCustomLogo ? state.db.BrandSettings.logo_data_url : DEFAULT_LOGO_URL;
  return `
    <div class="panel">
      <h3>לוגו המועדון</h3>
      <p>אפשר להעלות לוגו מתוך האפליקציה. ברירת המחדל היא לוגו אינדיגו שצירפת, וכל לוגו חדש נשמר מקומית בדפדפן ומופיע מיד בכותרת.</p>
      <div class="logo-preview">
        <img src="${previewLogo}" alt="${escapeHtml(state.db.BrandSettings?.logo_alt || "INDIGO מועדון צלילה")}" />
      </div>
      <form id="brandForm" class="form-grid section">
        ${inputField("logo_alt", "טקסט חלופי ללוגו", state.db.BrandSettings?.logo_alt || "INDIGO מועדון צלילה", true)}
        <label class="field"><span>קובץ לוגו</span><input name="logo_file" type="file" accept="image/*" /></label>
        <div class="actions">
          <button class="btn primary" type="submit">שמור לוגו</button>
          ${hasCustomLogo ? `<button class="btn ghost" type="button" data-brand-reset>חזרה ללוגו ברירת מחדל</button>` : ""}
        </div>
      </form>
    </div>
  `;
}

function renderAdminTexts() {
  state.textDrafts = Object.fromEntries(state.db.DynamicTexts.map((item) => [item.id, state.textDrafts[item.id] ?? item.text_value]));
  state.fieldDrafts = Object.fromEntries(state.db.DynamicFormFields.map((item) => [item.id, state.fieldDrafts[item.id] ?? item.label]));
  return `
    <div class="panel">
      <h3>ניהול שדות טופס הרשמה</h3>
      <p>אפשר לשנות טקסט שדה, חובה/לא חובה, להציג או להסתיר, סדר תצוגה ואפשרויות לשדות בחירה. השינויים נשמרים רק בלחיצה על “שמור שדות הרשמה”.</p>
      <div class="table-wrap">
        <table class="editable-table registration-fields-table">
          <thead><tr><th>מפתח</th><th>טקסט שדה</th><th>סוג</th><th>חובה</th><th>פעיל</th><th>סדר</th><th>אפשרויות</th></tr></thead>
          <tbody>${state.db.RegistrationFields.map((field) => `<tr data-registration-field-row="${escapeHtml(field.field_key)}">
            <td><strong>${escapeHtml(field.field_key)}</strong></td>
            <td><input data-registration-field-prop="label" value="${escapeHtml(field.label)}" /></td>
            <td>${escapeHtml(field.type)}</td>
            <td><label class="checkbox-field compact-check"><input data-registration-field-prop="required" type="checkbox" ${field.required ? "checked" : ""} /> חובה</label></td>
            <td><label class="checkbox-field compact-check"><input data-registration-field-prop="is_active" type="checkbox" ${field.is_active ? "checked" : ""} /> מוצג באתר</label></td>
            <td><input data-registration-field-prop="order_index" type="number" value="${escapeHtml(field.order_index)}" /></td>
            <td><textarea data-registration-field-prop="options" rows="3" placeholder="value|label, שורה לכל אפשרות">${escapeHtml(field.options || "")}</textarea></td>
          </tr>`).join("")}</tbody>
        </table>
      </div>
      <div class="actions section">
        <button class="btn primary" type="button" data-save-registration-fields>שמור שדות הרשמה</button>
        <button class="btn ghost" type="button" data-reset-registration-fields>חזרה לברירת מחדל</button>
      </div>
    </div>
    <div class="panel">
      <h3>ניהול טקסטים</h3>
      <p>הקלדה נשמרת ב-state מקומי בלבד. רק כפתור שמור מעדכן את הנתונים, לכן אין רינדור מחדש אחרי כל אות.</p>
      ${state.db.DynamicTexts.map((item) => `<label class="field"><span>${escapeHtml(item.screen_name)} / ${escapeHtml(item.text_key)}</span><textarea data-text-draft="${item.id}" rows="3">${escapeHtml(state.textDrafts[item.id])}</textarea></label><button class="btn secondary" data-save-text="${item.id}">שמור טקסט</button>`).join("")}
    </div>
    <div class="panel section">
      <h3>ניהול שדות דינמיים</h3>
      <div class="table-wrap">
        <table class="editable-table registration-fields-table">
          <thead><tr><th>מפתח</th><th>טקסט</th><th>סוג</th><th>חובה</th><th>פעיל</th><th>סדר</th><th>אפשרויות</th><th>עזרה</th><th>פעולות</th></tr></thead>
          <tbody>${state.db.DynamicFormFields.map((item) => `<tr data-dynamic-field-row="${item.id}">
            <td><input data-dynamic-field-prop="field_key" value="${escapeHtml(item.field_key)}" /></td>
            <td><input data-dynamic-field-prop="label" value="${escapeHtml(item.label)}" /></td>
            <td>${selectField("dynamic_type_preview", "", item.type, ["text", "select", "date", "file", "checkbox", "switch", "textarea"], false).replace("name=\"dynamic_type_preview\"", "data-dynamic-field-prop=\"type\"")}</td>
            <td><label class="checkbox-field compact-check"><input data-dynamic-field-prop="required" type="checkbox" ${item.required ? "checked" : ""} /> חובה</label></td>
            <td><label class="checkbox-field compact-check"><input data-dynamic-field-prop="is_active" type="checkbox" ${item.is_active ? "checked" : ""} /> מוצג באתר</label></td>
            <td><input data-dynamic-field-prop="order_index" type="number" value="${escapeHtml(item.order_index)}" /></td>
            <td><textarea data-dynamic-field-prop="options" rows="2">${escapeHtml(item.options || "")}</textarea></td>
            <td><input data-dynamic-field-prop="help_text" value="${escapeHtml(item.help_text || "")}" /></td>
            <td><div class="row-actions"><button class="btn primary" type="button" data-save-dynamic-field="${item.id}">שמור</button><button class="btn danger" type="button" data-delete-dynamic-field="${item.id}">מחק</button></div></td>
          </tr>`).join("")}</tbody>
        </table>
      </div>
      <form id="dynamicFieldForm" class="form-grid section">
        ${inputField("field_key", "מפתח שדה", "", true)}
        ${inputField("label", "טקסט שדה", "", true)}
        ${selectField("type", "סוג", "text", ["text", "select", "date", "file", "checkbox", "switch", "textarea"], true)}
        ${inputField("options", "אפשרויות", "", false)}
        <label class="checkbox-field"><input name="required" type="checkbox" /> חובה</label>
        <button class="btn primary" type="submit">הוסף שדה</button>
      </form>
    </div>
  `;
}

function renderAdminPayments() {
  const p = state.db.PaymentsSettings;
  return `<div class="panel"><h3>הגדרות תשלום</h3><form id="paymentForm" class="form-grid">${inputField("bit_link", "קישור ביט", p.bit_link, false)}${inputField("paybox_link", "קישור פייבוקס", p.paybox_link, false)}${inputField("phone_payment_number", "מספר טלפון לתשלום", p.phone_payment_number, false)}<label class="field"><span>טקסט תשלום</span><textarea name="payment_text" rows="3">${escapeHtml(p.payment_text)}</textarea></label><label class="field"><span>תנאי ביטול</span><textarea name="cancellation_terms_text" rows="3">${escapeHtml(p.cancellation_terms_text)}</textarea></label><button class="btn primary" type="submit">שמירת הגדרות</button></form></div>`;
}

function bindAdminForms() {
  document.querySelector("#adminContent")?.addEventListener("click", async (event) => {
    const editButton = event.target.closest("[data-site-edit]");
    const cancelEditButton = event.target.closest("[data-site-cancel-edit]");
    const toggleButton = event.target.closest("[data-site-toggle]");
    const deleteButton = event.target.closest("[data-site-delete]");
    const eventEditButton = event.target.closest("[data-event-edit]");
    const eventCancelEditButton = event.target.closest("[data-event-cancel-edit]");
    const eventDeleteButton = event.target.closest("[data-event-delete]");
    const userEditButton = event.target.closest("[data-user-edit]");
    const userCancelEditButton = event.target.closest("[data-user-cancel-edit]");
    const userDeleteButton = event.target.closest("[data-user-delete]");
    const userSaveButton = event.target.closest("[data-user-save]");
    const registrationEditButton = event.target.closest("[data-registration-edit]");
    const filePreviewButton = event.target.closest("[data-file-preview]");
    const registrationSaveButton = event.target.closest("[data-registration-save]");
    const registrationDeleteButton = event.target.closest("[data-registration-delete]");
    const waitlistPromoteButton = event.target.closest("[data-waitlist-promote]");

    if (editButton) {
      state.editingSiteId = editButton.dataset.siteEdit;
      renderClubAdmin();
      showToast("נפתח טופס עריכת אתר.");
      window.setTimeout(() => document.querySelector("#siteEditor")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
    }

    if (cancelEditButton) {
      state.editingSiteId = null;
      renderClubAdmin();
    }

    if (toggleButton) {
      const site = siteById(toggleButton.dataset.siteToggle);
      site.is_active = !site.is_active;
      saveDb();
      renderClubAdmin();
    }

    if (deleteButton) {
      state.db.DiveSites = state.db.DiveSites.filter((site) => site.id !== deleteButton.dataset.siteDelete);
      if (state.editingSiteId === deleteButton.dataset.siteDelete) state.editingSiteId = null;
      saveDb();
      renderClubAdmin();
    }

    if (eventEditButton) {
      state.editingEventId = eventEditButton.dataset.eventEdit;
      renderClubAdmin();
      showToast("נפתח טופס עריכת צלילה.");
      window.setTimeout(() => document.querySelector("#eventForm")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
    }

    if (eventCancelEditButton) {
      state.editingEventId = null;
      renderClubAdmin();
    }

    if (eventDeleteButton) {
      const eventId = eventDeleteButton.dataset.eventDelete;
      const hasRegistrations = state.db.DiveRegistrations.some((registration) => registration.event_id === eventId);
      if (hasRegistrations && !window.confirm("יש הרשמות לצלילה הזו. למחוק את הצלילה בכל זאת? ההרשמות יישארו בטבלת ההרשמות.")) return;
      state.db.DiveEvents = state.db.DiveEvents.filter((eventItem) => eventItem.id !== eventId);
      if (state.editingEventId === eventId) state.editingEventId = null;
      saveDb();
      showToast("הצלילה נמחקה.");
      renderClubAdmin();
    }

    if (waitlistPromoteButton) {
      promoteNextWaitlist(waitlistPromoteButton.dataset.waitlistPromote);
    }

    if (userEditButton) {
      if (!isAdmin()) {
        showToast("רק אדמין יכול לערוך פרטי משתמשים והרשאות.", "error");
        return;
      }
      state.editingUserId = userEditButton.dataset.userEdit;
      renderClubAdmin();
      showToast("נפתח טופס עריכת משתמש.");
      window.setTimeout(() => document.querySelector("#adminUserForm")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
    }

    if (userCancelEditButton) {
      state.editingUserId = null;
      renderClubAdmin();
    }

    if (userDeleteButton) {
      if (!isAdmin()) {
        showToast("רק אדמין יכול למחוק משתמשים.", "error");
        return;
      }
      const userId = userDeleteButton.dataset.userDelete;
      if (userId === state.currentUserId) {
        showToast("אי אפשר למחוק את המשתמש המחובר כרגע.", "error");
        return;
      }
      const hasRegistrations = state.db.DiveRegistrations.some((registration) => registration.user_id === userId);
      if (hasRegistrations && !window.confirm("למשתמש הזה יש הרשמות קיימות. למחוק אותו בכל זאת? ההרשמות יישארו בטבלת ההרשמות.")) return;
      state.db.Users = state.db.Users.filter((user) => user.id !== userId);
      state.db.DiverProfiles = state.db.DiverProfiles.filter((profile) => profile.user_id !== userId);
      if (state.editingUserId === userId) state.editingUserId = null;
      saveDb();
      showToast("המשתמש נמחק.");
      renderClubAdmin();
    }

    if (userSaveButton) {
      if (!isAdmin()) {
        showToast("רק אדמין יכול לעדכן פרטי משתמשים והרשאות.", "error");
        return;
      }
      const row = userSaveButton.closest("[data-user-row]");
      const userId = userSaveButton.dataset.userSave;
      const user = state.db.Users.find((item) => item.id === userId);
      const value = (field) => row.querySelector(`[data-user-field="${field}"]`);
      const email = value("email").value.trim().toLowerCase();
      const phone = value("phone").value.trim();
      const role = value("role").value;
      const password = value("password").value;
      if (user.id === state.currentUserId && role !== "admin") {
        showToast("אי אפשר להסיר לעצמך הרשאת אדמין מתוך המשתמש הנוכחי.", "error");
        renderClubAdmin();
        return;
      }
      if (password && password.length < 6) {
        showToast("סיסמה חדשה חייבת להיות באורך 6 תווים לפחות.", "error");
        return;
      }
      if (state.db.Users.some((item) => item.id !== userId && (item.email?.toLowerCase() === email || (phone && item.phone === phone)))) {
        showToast("כבר קיים משתמש עם האימייל או הטלפון האלה.", "error");
        return;
      }
      Object.assign(user, {
        first_name: value("first_name").value.trim(),
        last_name: value("last_name").value.trim(),
        email,
        phone,
        role,
        is_club_member: value("is_club_member").checked,
        club_member_notes: value("is_club_member").checked ? (user.club_member_notes || "עודכן על ידי אדמין") : "",
        updated_date: nowIso()
      });
      if (password) {
        user.password_hash = await hashPassword(password);
        user.password_updated_date = nowIso();
      }
      saveDb();
      showToast("פרטי המשתמש נשמרו.");
      renderClubAdmin();
    }

    if (registrationEditButton) {
      state.editingRegistrationId = state.editingRegistrationId === registrationEditButton.dataset.registrationEdit ? null : registrationEditButton.dataset.registrationEdit;
      renderClubAdmin();
    }

    if (filePreviewButton) {
      showFilePreview(filePreviewButton.dataset.filePreview, filePreviewButton.dataset.fileField, filePreviewButton);
    }

    if (registrationSaveButton) {
      if (!canManage()) {
        showToast("רק מנהל מועדון או אדמין יכולים לעדכן הרשמות.", "error");
        return;
      }
      const row = registrationSaveButton.closest("[data-registration-row]");
      const reg = state.db.DiveRegistrations.find((item) => item.id === registrationSaveButton.dataset.registrationSave);
      const value = (field) => row.querySelector(`[data-reg-field="${field}"]`);
      const selectedEquipment = [...row.querySelectorAll("[data-reg-equipment-item]:checked")].map((input) => input.value);
      Object.assign(reg, {
        first_name: value("first_name").value.trim(),
        last_name: value("last_name").value.trim(),
        phone: value("phone").value.trim(),
        email: value("email").value.trim(),
        id_number: value("id_number").value.trim(),
        birth_date: value("birth_date").value,
        diving_rank: value("diving_rank").value,
        insurance_valid_until: value("insurance_valid_until").value,
        last_dive_date: value("last_dive_date").value,
        nitrox_certified: value("nitrox_certified").value === "yes",
        nitrox_level: value("nitrox_certified").value === "yes" ? value("nitrox_level").value : "none",
        air_type: value("air_type").value,
        buddy_name: value("buddy_name").value.trim(),
        equipment_required: value("equipment_required").value === "yes",
        equipment_items: value("equipment_required").value === "yes" ? selectedEquipment : [],
        shoe_size: selectedEquipment.includes("fins") ? value("shoe_size").value.trim() : "",
        equipment_cost: Number(value("equipment_cost").value) || 0,
        total_price: Number(value("total_price").value) || 0,
        payment_method: value("payment_method").value,
        payment_status: value("payment_status").value,
        club_approval_status: value("club_approval_status").value,
        is_club_member_registration: value("is_club_member_registration").checked,
        admin_notes: value("admin_notes").value.trim(),
        user_notes: value("user_notes").value.trim(),
        certification_file_url: value("certification_file_url").value.trim(),
        insurance_file_url: value("insurance_file_url").value.trim(),
        signature_url: value("signature_url").value.trim(),
        updated_date: nowIso()
      });
      saveDb();
      state.editingRegistrationId = null;
      showToast("ההרשמה נשמרה.");
      renderClubAdmin();
    }

    if (registrationDeleteButton) {
      if (!canManage()) {
        showToast("רק מנהל מועדון או אדמין יכולים למחוק הרשמות.", "error");
        return;
      }
      if (!window.confirm("למחוק את ההרשמה הזו?")) return;
      state.db.DiveRegistrations = state.db.DiveRegistrations.filter((item) => item.id !== registrationDeleteButton.dataset.registrationDelete);
      if (state.editingRegistrationId === registrationDeleteButton.dataset.registrationDelete) state.editingRegistrationId = null;
      saveDb();
      showToast("ההרשמה נמחקה.");
      renderClubAdmin();
    }
  });
  document.querySelectorAll("[data-reg-action]").forEach((button) => button.addEventListener("click", () => updateRegistration(button.dataset.id, button.dataset.regAction)));
  document.querySelectorAll("[data-reg-note]").forEach((textarea) => textarea.addEventListener("change", () => {
    const reg = state.db.DiveRegistrations.find((item) => item.id === textarea.dataset.regNote);
    reg.admin_notes = textarea.value;
    saveDb();
    showToast("הערה נשמרה.");
  }));
  document.querySelector("#siteForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const payload = {
      name: data.name,
      short_description: data.short_description,
      full_description: data.full_description,
      depth: data.depth,
      difficulty_level: data.difficulty_level,
      suitable_for_ranks: data.suitable_for_ranks,
      image_url: data.image_url,
      is_active: data.is_active === "on",
      show_on_homepage: data.show_on_homepage === "on",
      order_index: Number(data.order_index),
      price: Number(data.price),
      show_price_only_in_details: data.show_price_only_in_details === "on",
      allow_registration: data.allow_registration === "on"
    };
    if (data.site_id) {
      Object.assign(siteById(data.site_id), payload);
      state.editingSiteId = null;
      showToast("האתר עודכן.");
    } else {
      state.db.DiveSites.push({ id: id("site"), ...payload });
      showToast("אתר נוסף.");
    }
    saveDb();
    renderClubAdmin();
  });
  document.querySelector("#eventForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const payload = {
      site_id: data.site_id,
      dive_date: data.dive_date,
      dive_time: data.dive_time,
      meeting_time: data.meeting_time,
      max_participants: Number(data.max_participants) || 10,
      price: Number(data.price),
      status: data.status,
      notes: data.notes,
      registration_notes: data.registration_notes || "כל הרשמה נבדקת ומאושרת על ידי המועדון.",
      requires_club_approval: data.requires_club_approval === "on"
    };
    if (data.event_id) {
      Object.assign(eventById(data.event_id), payload, { updated_date: nowIso() });
      state.editingEventId = null;
      showToast("הצלילה עודכנה.");
    } else {
      state.db.DiveEvents.push({ id: id("event"), ...payload, created_by: state.currentUserId });
      showToast("צלילה פתוחה נוספה.");
    }
    saveDb();
    renderClubAdmin();
  });
  document.querySelector("#adminUserForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!isAdmin()) {
      showToast("רק אדמין יכול להוסיף משתמשים והרשאות.", "error");
      return;
    }
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const userId = String(data.user_id || "");
    const email = String(data.email || "").trim().toLowerCase();
    const phone = String(data.phone || "").trim();
    const password = String(data.password || "");
    const existingUser = userId ? state.db.Users.find((user) => user.id === userId) : null;
    if (!existingUser && password.length < 6) {
      showToast("סיסמה ראשונית חייבת להיות באורך 6 תווים לפחות.", "error");
      return;
    }
    if (password && password.length < 6) {
      showToast("סיסמה חדשה חייבת להיות באורך 6 תווים לפחות.", "error");
      return;
    }
    if (state.db.Users.some((user) => user.id !== userId && (user.email?.toLowerCase() === email || (phone && user.phone === phone)))) {
      showToast("כבר קיים משתמש עם האימייל או הטלפון האלה.", "error");
      return;
    }
    if (existingUser) {
      if (existingUser.id === state.currentUserId && data.role !== "admin") {
        showToast("אי אפשר להסיר לעצמך הרשאת אדמין מתוך המשתמש הנוכחי.", "error");
        return;
      }
      Object.assign(existingUser, {
        first_name: data.first_name,
        last_name: data.last_name,
        email,
        phone,
        role: data.role,
        is_club_member: data.is_club_member === "on",
        club_member_notes: data.is_club_member === "on" ? (existingUser.club_member_notes || "סומן על ידי אדמין") : "",
        updated_date: nowIso()
      });
      if (password) {
        existingUser.password_hash = await hashPassword(password);
        existingUser.password_updated_date = nowIso();
      }
      state.editingUserId = null;
      saveDb();
      showToast("פרטי המשתמש עודכנו.");
      renderClubAdmin();
      return;
    }
    state.db.Users.push({
      id: id("user"),
      first_name: data.first_name,
      last_name: data.last_name,
      email,
      phone,
      id_number: "",
      birth_date: "",
      role: data.role,
      is_club_member: data.is_club_member === "on",
      club_member_notes: data.is_club_member === "on" ? "סומן בעת יצירת המשתמש" : "",
      saved_diver_profile: false,
      password_hash: await hashPassword(password),
      password_updated_date: nowIso(),
      created_date: nowIso()
    });
    state.editingUserId = null;
    saveDb();
    showToast("המשתמש נוסף עם ההרשאה שנבחרה.");
    renderClubAdmin();
  });
  document.querySelectorAll("[data-user-role]").forEach((select) => select.addEventListener("change", () => {
    if (!isAdmin()) {
      showToast("רק אדמין יכול לשנות הרשאות role.", "error");
      renderClubAdmin();
      return;
    }
    const user = state.db.Users.find((item) => item.id === select.dataset.userRole);
    if (user.id === state.currentUserId && select.value !== "admin") {
      showToast("אי אפשר להסיר לעצמך הרשאת אדמין מתוך המשתמש הנוכחי.", "error");
      renderClubAdmin();
      return;
    }
    user.role = select.value;
    saveDb();
    render();
  }));
  document.querySelectorAll("[data-user-member]").forEach((button) => button.addEventListener("click", () => {
    if (!canManage()) {
      showToast("רק מנהל מועדון או אדמין יכולים לסמן חבר מועדון.", "error");
      return;
    }
    const user = state.db.Users.find((item) => item.id === button.dataset.userMember);
    user.is_club_member = !user.is_club_member;
    user.club_member_notes = user.is_club_member ? "סומן על ידי מנהל מועדון" : "";
    saveDb();
    renderClubAdmin();
  }));
  document.querySelector("#brandForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const file = data.get("logo_file");
    const logoAlt = String(data.get("logo_alt") || "INDIGO מועדון צלילה");
    if (file && file.size) {
      const reader = new FileReader();
      reader.onload = () => {
        state.db.BrandSettings = {
          logo_data_url: reader.result,
          logo_alt: logoAlt,
          updated_date: nowIso()
        };
        saveDb();
        showToast("הלוגו נשמר.");
        render();
      };
      reader.onerror = () => showToast("שמירת הלוגו נכשלה. נסו קובץ אחר.", "error");
      reader.readAsDataURL(file);
    } else {
      state.db.BrandSettings.logo_alt = logoAlt;
      state.db.BrandSettings.updated_date = nowIso();
      saveDb();
      showToast("פרטי הלוגו נשמרו.");
      render();
    }
  });
  document.querySelector("[data-brand-reset]")?.addEventListener("click", () => {
    state.db.BrandSettings = {
      logo_data_url: "",
      logo_alt: "INDIGO מועדון צלילה",
      updated_date: nowIso()
    };
    saveDb();
    showToast("הלוגו חזר לברירת המחדל.");
    render();
  });
  document.querySelector("#paymentForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    Object.assign(state.db.PaymentsSettings, Object.fromEntries(new FormData(event.currentTarget).entries()), { updated_date: nowIso() });
    saveDb();
    showToast("הגדרות התשלום נשמרו.");
  });
  document.querySelectorAll("[data-text-draft]").forEach((textarea) => textarea.addEventListener("input", () => {
    state.textDrafts[textarea.dataset.textDraft] = textarea.value;
  }));
  document.querySelectorAll("[data-save-text]").forEach((button) => button.addEventListener("click", () => {
    const item = state.db.DynamicTexts.find((text) => text.id === button.dataset.saveText);
    item.text_value = state.textDrafts[item.id];
    saveDb();
    showToast("טקסט נשמר.");
  }));
  document.querySelectorAll("[data-field-draft]").forEach((input) => input.addEventListener("input", () => {
    state.fieldDrafts[input.dataset.fieldDraft] = input.value;
  }));
  document.querySelectorAll("[data-save-field]").forEach((button) => button.addEventListener("click", () => {
    const item = state.db.DynamicFormFields.find((field) => field.id === button.dataset.saveField);
    item.label = state.fieldDrafts[item.id];
    saveDb();
    showToast("שדה נשמר.");
  }));
  document.querySelectorAll("[data-save-dynamic-field]").forEach((button) => button.addEventListener("click", () => {
    const row = button.closest("[data-dynamic-field-row]");
    const item = state.db.DynamicFormFields.find((field) => field.id === button.dataset.saveDynamicField);
    const prop = (name) => row.querySelector(`[data-dynamic-field-prop="${name}"]`);
    Object.assign(item, {
      field_key: prop("field_key").value.trim(),
      label: prop("label").value.trim(),
      type: prop("type").value,
      required: prop("required").checked,
      is_active: prop("is_active").checked,
      order_index: Number(prop("order_index").value) || item.order_index,
      options: prop("options").value,
      help_text: prop("help_text").value
    });
    state.db.DynamicFormFields.sort((a, b) => a.order_index - b.order_index);
    saveDb();
    showToast("השדה הדינמי נשמר.");
    renderClubAdmin();
  }));
  document.querySelectorAll("[data-delete-dynamic-field]").forEach((button) => button.addEventListener("click", () => {
    if (!window.confirm("למחוק את השדה הדינמי?")) return;
    state.db.DynamicFormFields = state.db.DynamicFormFields.filter((field) => field.id !== button.dataset.deleteDynamicField);
    saveDb();
    showToast("השדה הדינמי נמחק.");
    renderClubAdmin();
  }));
  document.querySelector("[data-save-registration-fields]")?.addEventListener("click", () => {
    document.querySelectorAll("[data-registration-field-row]").forEach((row) => {
      const key = row.dataset.registrationFieldRow;
      const field = state.db.RegistrationFields.find((item) => item.field_key === key);
      if (!field) return;
      const prop = (name) => row.querySelector(`[data-registration-field-prop="${name}"]`);
      field.label = prop("label").value.trim() || field.label;
      field.required = prop("required").checked;
      field.is_active = prop("is_active").checked;
      field.order_index = Number(prop("order_index").value) || field.order_index;
      field.options = prop("options").value;
    });
    state.db.RegistrationFields.sort((a, b) => a.order_index - b.order_index);
    saveDb();
    showToast("שדות ההרשמה נשמרו.");
    renderClubAdmin();
  });
  document.querySelector("[data-reset-registration-fields]")?.addEventListener("click", () => {
    if (!window.confirm("להחזיר את כל שדות ההרשמה לברירת המחדל?")) return;
    state.db.RegistrationFields = normalizeRegistrationFields([]);
    saveDb();
    showToast("שדות ההרשמה אופסו לברירת המחדל.");
    renderClubAdmin();
  });
  document.querySelector("#dynamicFieldForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    state.db.DynamicFormFields.push({ id: id("field"), form_name: "registration", field_key: data.field_key, label: data.label, type: data.type, required: data.required === "on", options: data.options, is_active: true, order_index: state.db.DynamicFormFields.length + 1, help_text: "" });
    saveDb();
    renderClubAdmin();
  });
}

function openWhatsAppNotification(reg, action) {
  const phone = phoneToWhatsApp(reg.phone);
  if (!phone || phone.length < 10) return;
  const event = eventById(reg.event_id);
  const site = event ? siteById(event.site_id) : null;
  const siteName = site?.name || "הצלילה";
  const dateStr = event ? formatDate(event.dive_date) : "";
  const timeStr = event?.dive_time || "";

  let message;
  if (action === "approve") {
    message = `שלום ${reg.first_name}!\n\nהרשמתך לצלילה *${siteName}* בתאריך *${dateStr}* בשעה *${timeStr}* אושרה על ידי מועדון אינדיגו.\n\nנתראה במים!\nצוות אינדיגו מרכז צלילה`;
  } else if (action === "reject") {
    message = `שלום ${reg.first_name},\n\nלצערנו לא ניתן לאשר את הרשמתך לצלילה *${siteName}* בתאריך *${dateStr}*.\n\nאנא צרי/צור קשר עם המועדון לפרטים נוספים.\nצוות אינדיגו מרכז צלילה`;
  } else {
    return;
  }

  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
}

function updateRegistration(registrationId, action) {
  const reg = state.db.DiveRegistrations.find((item) => item.id === registrationId);
  if (!reg) return;
  if (action === "approve") reg.club_approval_status = "approved";
  if (action === "reject") reg.club_approval_status = "rejected";
  if (action === "wait") reg.club_approval_status = "waiting_list";
  if (action === "bit") reg.payment_status = "paid_by_bit";
  if (action === "paybox") reg.payment_status = "paid_by_paybox";
  if (action === "phone") reg.payment_status = "paid_by_phone";
  if (action === "member") {
    const user = state.db.Users.find((item) => item.id === reg.user_id);
    user.is_club_member = true;
    reg.is_club_member_registration = true;
    reg.payment_method = "club_member";
    reg.payment_status = "exempt_club_member";
  }
  if (action === "delete") state.db.DiveRegistrations = state.db.DiveRegistrations.filter((item) => item.id !== registrationId);
  saveDb();
  showToast("ההרשמה עודכנה.");
  if (action === "approve" || action === "reject") openWhatsAppNotification(reg, action);
  renderClubAdmin();
}

function promoteNextWaitlist(eventId) {
  if (!canManage()) {
    showToast("רק מנהל מועדון או אדמין יכולים לנהל רשימת המתנה.", "error");
    return;
  }
  const event = eventById(eventId);
  if (!event) {
    showToast("הצלילה לא נמצאה.", "error");
    return;
  }
  if (seatCount(eventId) >= Number(event.max_participants || 0)) {
    showToast("אין מקום פנוי בצלילה הזו כרגע.", "error");
    return;
  }
  const next = eventWaitlist(eventId)[0];
  if (!next) {
    showToast("אין ממתינים ברשימת ההמתנה.", "error");
    return;
  }
  next.club_approval_status = "approved";
  next.promoted_from_waitlist_date = nowIso();
  next.admin_notes = [next.admin_notes, "הועבר מרשימת המתנה למשתתפים"].filter(Boolean).join(" | ");
  saveDb();
  showToast("הממתין הראשון הועבר לרשימת המשתתפים.");
  renderClubAdmin();
}

function renderNotFound() {
  app.innerHTML = `<section class="section"><div class="empty">העמוד לא נמצא.</div></section>`;
}

function runSelfCheck() {
  const userNav = ["home", "sites", "mydives", "profile"];
  const managerNav = ["home", "sites", "mydives", "profile", "club"];
  const checks = [
    state.db.Users.every((user) => ["user", "club_manager", "admin"].includes(user.role)),
    state.db.DiveSites.length >= 11,
    state.db.PaymentsSettings.payment_text.includes("ההרשמה אינה מאושרת"),
    state.db.DynamicFormFields.some((field) => field.field_key === "buddy_name"),
    !userNav.includes("club"),
    managerNav.includes("club")
  ];
  console.log("Indigo self-check", checks.every(Boolean) ? "עבר" : "נכשל", checks);
}

userMenu.addEventListener("click", (event) => {
  if (!event.target.closest("[data-action='open-login']")) return;
  navigate("login");
});

nav.addEventListener("click", (event) => {
  if (!event.target.closest("[data-action='logout']")) return;
  logout();
});

document.querySelector("[data-action='toggle-menu']").addEventListener("click", () => {
  nav.classList.toggle("open");
});

window.addEventListener("hashchange", () => {
  state.registrationState = null;
  state.editingUserId = null;
  state.editingEventId = null;
  state.editingRegistrationId = null;
  render();
});

bootstrapApp();

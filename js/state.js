import {
  DB_KEY,
  SESSION_KEY,
  SITE_CONTENT_VERSION,
  DEFAULT_ADMIN,
  DEFAULT_REGISTRATION_FIELDS,
  INITIAL_SITES
} from "./constants.js";
import { SITE_CONTENT } from "./site-content.js";
import { id, today, nowIso } from "./utils.js";

export const state = {
  db: null,
  currentUserId: sessionStorage.getItem(SESSION_KEY) || "guest",
  cloudEnabled: false,
  currentAdminTab: "registrations",
  editingSiteId: null,
  editingUserId: null,
  editingEventId: null,
  editingRegistrationId: null,
  registrationState: null,
  loginState: null,
  textDrafts: {},
  fieldDrafts: {}
};

export function loadDb() {
  const saved = localStorage.getItem(DB_KEY);
  if (saved) {
    return normalizeDb(JSON.parse(saved));
  }
  const seeded = seedDb();
  localStorage.setItem(DB_KEY, JSON.stringify(seeded));
  return seeded;
}

export function normalizeDb(nextDb) {
  nextDb.Users ??= [];
  nextDb.RegistrationFields = normalizeRegistrationFields(nextDb.RegistrationFields || []);
  nextDb.BrandSettings ??= {
    logo_data_url: "",
    logo_alt: "INDIGO מועדון צלילה",
    updated_date: nowIso()
  };
  nextDb.DiveSites = (nextDb.DiveSites || []).map((site, index) => ({
    image_url: "",
    show_price_only_in_details: true,
    order_index: index + 1,
    ...site
  }));
  if (nextDb.Meta?.site_content_version !== SITE_CONTENT_VERSION) {
    applySiteContent(nextDb);
    nextDb.Meta = {
      ...(nextDb.Meta || {}),
      site_content_version: SITE_CONTENT_VERSION
    };
  }
  const registrationIntro = nextDb.DynamicTexts?.find((text) => text.screen_name === "registration" && text.text_key === "intro");
  if (registrationIntro?.text_value?.includes("ארבעה שלבים")) {
    registrationIntro.text_value = "מלאו את הפרטים בשני שלבים קצרים. המועדון יאשר את ההרשמה לאחר בדיקת הפרטים והתשלום.";
  }
  ensureDefaultAdmin(nextDb);
  return nextDb;
}

export function normalizeRegistrationFields(fields) {
  const existing = new Map(fields.map((field) => [field.field_key, field]));
  return DEFAULT_REGISTRATION_FIELDS.map((field) => ({
    ...field,
    ...(existing.get(field.field_key) || {})
  })).sort((a, b) => a.order_index - b.order_index);
}

export function ensureDefaultAdmin(targetDb) {
  const adminByEmail = targetDb.Users.find((user) => user.email?.toLowerCase() === DEFAULT_ADMIN.email);
  if (adminByEmail) {
    Object.assign(adminByEmail, {
      first_name: DEFAULT_ADMIN.first_name,
      last_name: DEFAULT_ADMIN.last_name,
      phone: DEFAULT_ADMIN.phone,
      role: "admin",
      is_club_member: true,
      club_member_notes: adminByEmail.club_member_notes || DEFAULT_ADMIN.club_member_notes
    });
    return;
  }
  targetDb.Users.push({
    ...DEFAULT_ADMIN,
    created_date: nowIso()
  });
}

export function applySiteContent(targetDb) {
  targetDb.DiveSites = (targetDb.DiveSites || []).map((site) => ({
    ...site,
    ...(SITE_CONTENT[site.name] || {})
  }));
}

export function saveDb() {
  localStorage.setItem(DB_KEY, JSON.stringify(state.db));
  window.IndigoCloud?.save(state.db);
}

export function seedDb() {
  const users = [
    {
      id: "user_regular",
      first_name: "תמר",
      last_name: "כהן",
      email: "tamar@example.com",
      phone: "050-1234567",
      id_number: "123456789",
      birth_date: "1992-04-12",
      role: "user",
      is_club_member: false,
      club_member_notes: "",
      saved_diver_profile: true,
      created_date: nowIso()
    },
    {
      id: "user_manager",
      first_name: "דנה",
      last_name: "מנהלת",
      email: "manager@indigo.local",
      phone: "052-7777777",
      id_number: "987654321",
      birth_date: "1988-08-22",
      role: "club_manager",
      is_club_member: true,
      club_member_notes: "מנהלת פעילה",
      saved_diver_profile: true,
      created_date: nowIso()
    },
    {
      id: "user_admin",
      first_name: "אדמין",
      last_name: "אינדיגו",
      email: "admin@indigo.local",
      phone: "053-9999999",
      id_number: "111222333",
      birth_date: "1985-01-01",
      role: "admin",
      is_club_member: true,
      club_member_notes: "גישה מלאה",
      saved_diver_profile: true,
      created_date: nowIso()
    },
    {
      id: "user_member",
      first_name: "נועה",
      last_name: "חברת מועדון",
      email: "noa@example.com",
      phone: "054-2222222",
      id_number: "222333444",
      birth_date: "1995-06-16",
      role: "user",
      is_club_member: true,
      club_member_notes: "חברה עד סוף השנה",
      saved_diver_profile: true,
      created_date: nowIso()
    }
  ];

  const profiles = users.map((user, index) => ({
    id: id("profile"),
    user_id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    phone: user.phone,
    email: user.email,
    id_number: user.id_number,
    birth_date: user.birth_date,
    diving_rank: index === 0 ? "OWD / כוכב 1" : "AOWD / כוכב 2",
    nitrox_certified: index > 0,
    nitrox_level: index > 0 ? "1" : "none",
    insurance_valid_until: index === 0 ? today(-4) : today(120),
    last_dive_date: index === 0 ? today(-220) : today(-40),
    certification_file_url: "קובץ שמור: תעודת צלילה.pdf",
    insurance_file_url: index === 0 ? "" : "קובץ שמור: ביטוח.pdf",
    save_details_for_next_time: true,
    updated_date: nowIso()
  }));

  const sites = INITIAL_SITES.map((name, index) => ({
    id: `site_${index + 1}`,
    name,
    short_description: "אתר צלילה צפוני עם נוף תת ימי עשיר, מתאים לתכנון יציאה מסודרת עם המועדון.",
    full_description: `${name} הוא אתר אהוב של אינדיגו, עם תוואי צלילה מגוון, תנאי ים משתנים ונקודות עניין לצוללים מוסמכים.`,
    depth: index < 3 ? "8-18 מטר" : "18-32 מטר",
    difficulty_level: index < 3 ? "קל-בינוני" : "בינוני-מתקדם",
    suitable_for_ranks: index < 3 ? "OWD ומעלה" : "AOWD ומעלה",
    image_url: "",
    is_active: true,
    show_on_homepage: true,
    order_index: index + 1,
    price: index < 3 ? 220 : 280,
    show_price_only_in_details: true,
    allow_registration: true
  }));

  const events = sites.slice(0, 7).map((site, index) => ({
    id: `event_${index + 1}`,
    site_id: site.id,
    dive_date: today(7 + index * 3),
    dive_time: index % 2 ? "13:00" : "09:00",
    meeting_time: index % 2 ? "12:15" : "08:15",
    max_participants: index === 0 ? 1 : 10,
    price: site.price,
    status: "open",
    notes: "להגיע עם תעודות וביטוח בתוקף.",
    registration_notes: "כל הרשמה נבדקת ומאושרת על ידי המועדון.",
    requires_club_approval: true,
    created_by: "user_manager"
  }));

  const seeded = {
    Users: users,
    DiverProfiles: profiles,
    DiveSites: sites,
    DiveEvents: events,
    DiveRegistrations: [],
    PaymentsSettings: {
      bit_link: "https://bit.example/indigo",
      paybox_link: "https://paybox.example/indigo",
      phone_payment_number: "04-9000000",
      payment_text: "ההרשמה אינה מאושרת סופית עד לאישור המועדון וקבלת תשלום. מומלץ לשלם מראש בביט או בפייבוקס.",
      cancellation_terms_text: "אני מאשר/ת כי דמי ההרשמה לא יוחזרו אם לא עודכן ביטול לפחות 24 שעות מראש.",
      updated_date: nowIso()
    },
    DynamicFormFields: [
      { id: id("field"), form_name: "registration", field_key: "buddy_name", label: "בן/בת זוג לצלילה", type: "text", required: false, options: "", is_active: true, order_index: 1, help_text: "אופציונלי" },
      { id: id("field"), form_name: "registration", field_key: "user_notes", label: "הערות לצוות", type: "textarea", required: false, options: "", is_active: true, order_index: 2, help_text: "" }
    ],
    RegistrationFields: normalizeRegistrationFields([]),
    DynamicTexts: [
      { id: id("text"), screen_name: "success", text_key: "summary", text_value: "ההרשמה התקבלה ונמצאת בהמתנה לאישור המועדון.", is_active: true },
      { id: id("text"), screen_name: "registration", text_key: "intro", text_value: "מלאו את הפרטים בשני שלבים קצרים. המועדון יאשר את ההרשמה לאחר בדיקת הפרטים והתשלום.", is_active: true }
    ],
    BrandSettings: {
      logo_data_url: "",
      logo_alt: "INDIGO מועדון צלילה",
      updated_date: nowIso()
    },
    Meta: {
      site_content_version: SITE_CONTENT_VERSION
    }
  };
  applySiteContent(seeded);

  return seeded;
}

export function currentUser() {
  return state.db.Users.find((user) => user.id === state.currentUserId) || {
    id: "guest",
    first_name: "אורח/ת",
    last_name: "",
    email: "",
    phone: "",
    id_number: "",
    birth_date: "",
    role: "user",
    is_club_member: false,
    club_member_notes: "",
    saved_diver_profile: false,
    created_date: ""
  };
}

export function canManage(user = currentUser()) {
  return user.role === "admin" || user.role === "club_manager";
}

export function isAdmin(user = currentUser()) {
  return user.role === "admin";
}

export function getProfile(userId = state.currentUserId) {
  return state.db.DiverProfiles.find((profile) => profile.user_id === userId);
}

export function textValue(screen, key, fallback) {
  return state.db.DynamicTexts.find((text) => text.screen_name === screen && text.text_key === key && text.is_active)?.text_value || fallback;
}

export function siteById(siteId) {
  return state.db.DiveSites.find((site) => site.id === siteId);
}

export function eventById(eventId) {
  return state.db.DiveEvents.find((event) => event.id === eventId);
}

export function approvedCount(eventId) {
  return state.db.DiveRegistrations.filter((reg) => reg.event_id === eventId && reg.club_approval_status === "approved").length;
}

export function seatCount(eventId) {
  return state.db.DiveRegistrations.filter((reg) => reg.event_id === eventId && ["pending", "approved"].includes(reg.club_approval_status)).length;
}

export function eventOpenForSite(siteId) {
  return state.db.DiveEvents
    .filter((event) => event.site_id === siteId && event.status === "open" && event.dive_date >= today())
    .sort((a, b) => `${a.dive_date} ${a.dive_time}`.localeCompare(`${b.dive_date} ${b.dive_time}`))[0];
}

export function nextFutureEventForSite(siteId) {
  return state.db.DiveEvents
    .filter((event) => event.site_id === siteId && event.status !== "cancelled" && event.dive_date >= today())
    .sort((a, b) => `${a.dive_date} ${a.dive_time || ""}`.localeCompare(`${b.dive_date} ${b.dive_time || ""}`))[0];
}

export function homeSites() {
  return state.db.DiveSites
    .filter((site) => site.is_active && site.show_on_homepage)
    .sort((a, b) => {
      const eventA = nextFutureEventForSite(a.id);
      const eventB = nextFutureEventForSite(b.id);
      if (eventA && eventB) return `${eventA.dive_date} ${eventA.dive_time || ""}`.localeCompare(`${eventB.dive_date} ${eventB.dive_time || ""}`);
      if (eventA) return -1;
      if (eventB) return 1;
      return a.order_index - b.order_index;
    });
}

export function futureDiveEvents() {
  return state.db.DiveEvents
    .filter((event) => event.dive_date >= today() && event.status !== "cancelled")
    .sort((a, b) => `${a.dive_date} ${a.dive_time || ""}`.localeCompare(`${b.dive_date} ${b.dive_time || ""}`));
}

export function isEventFull(event) {
  return seatCount(event.id) >= Number(event.max_participants || 0);
}

export function eventRegistrationState(event) {
  if (!event || event.status === "closed" || event.status === "cancelled") return "closed";
  if (event.status === "full" || isEventFull(event)) return "full";
  return "open";
}

export function eventParticipants(eventId) {
  return state.db.DiveRegistrations
    .filter((reg) => reg.event_id === eventId && ["pending", "approved"].includes(reg.club_approval_status))
    .sort((a, b) => String(a.created_date || "").localeCompare(String(b.created_date || "")));
}

export function eventWaitlist(eventId) {
  return state.db.DiveRegistrations
    .filter((reg) => reg.event_id === eventId && reg.club_approval_status === "waiting_list")
    .sort((a, b) => String(a.waitlist_created_date || a.created_date || "").localeCompare(String(b.waitlist_created_date || b.created_date || "")));
}

state.db = loadDb();

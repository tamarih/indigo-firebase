export const DB_KEY = "indigo_dive_club_db_v2";
export const SESSION_KEY = "indigo_current_user_id";
export const DEFAULT_LOGO_URL = "indigo-logo-default.jpg";
export const INSURANCE_RENEWAL_URL = "https://www.diving.org.il/index2.php?id=42&aff=+indigo&lang=HEB";
export const SITE_CONTENT_VERSION = 3;

export const DEFAULT_ADMIN = {
  id: "user_tamar_admin",
  first_name: "תמר",
  last_name: "הופמן",
  email: "tamar@hoffmann.co.il",
  phone: "0546420020",
  id_number: "",
  birth_date: "",
  role: "admin",
  is_club_member: true,
  club_member_notes: "אדמין ראשי של מועדון אינדיגו",
  saved_diver_profile: false
};

export const ROLES = {
  user: "משתמש רגיל",
  club_manager: "מנהל מועדון",
  admin: "אדמין"
};

export const RANKS = ["OWD / כוכב 1", "AOWD / כוכב 2", "Master Diver", "Dive Master", "Instructor"];
export const NITROX_LEVELS = ["none", "1", "2"];

export const PAYMENT_METHODS = {
  bit: "תשלום בביט",
  paybox: "תשלום בפייבוקס",
  phone: "תשלום טלפוני באשראי",
  club_member: "חבר מועדון",
  no_payment_yet: "ללא תשלום עדיין"
};

export const PAYMENT_STATUS = {
  unpaid: "לא שולם",
  paid_by_bit: "שולם בביט",
  paid_by_paybox: "שולם בפייבוקס",
  paid_by_phone: "שולם טלפונית",
  exempt_club_member: "פטור חבר מועדון"
};

export const APPROVAL_STATUS = {
  pending: "ממתין לאישור",
  approved: "מאושר",
  rejected: "נדחה",
  waiting_list: "רשימת המתנה"
};

export const EQUIPMENT_ITEMS = [
  { key: "bcd", label: "מאזן", price: 35 },
  { key: "regulator", label: "וסת", price: 35 },
  { key: "mask", label: "מסיכה", price: 20 },
  { key: "fins", label: "סנפירים", price: 20 },
  { key: "wetsuit", label: "חליפה", price: 20 },
  { key: "full_set", label: "ציוד מלא", price: 80 }
];

export const DEFAULT_REGISTRATION_FIELDS = [
  { field_key: "first_name", label: "שם פרטי", type: "text", required: true, is_active: true, order_index: 10, section: "personal", options: "" },
  { field_key: "last_name", label: "שם משפחה", type: "text", required: true, is_active: true, order_index: 20, section: "personal", options: "" },
  { field_key: "phone", label: "טלפון", type: "tel", required: true, is_active: true, order_index: 30, section: "personal", options: "" },
  { field_key: "email", label: "אימייל", type: "email", required: false, is_active: true, order_index: 40, section: "personal", options: "" },
  { field_key: "id_number", label: "תעודת זהות", type: "text", required: true, is_active: true, order_index: 50, section: "personal", options: "" },
  { field_key: "birth_date", label: "תאריך לידה", type: "date", required: true, is_active: true, order_index: 60, section: "personal", options: "" },
  { field_key: "diving_rank", label: "דרגת צלילה", type: "select", required: true, is_active: true, order_index: 70, section: "dive", options: "OWD / כוכב 1\nAOWD / כוכב 2\nMaster Diver\nDive Master\nInstructor" },
  { field_key: "nitrox_certified", label: "הסמכת נייטרוקס", type: "select", required: true, is_active: true, order_index: 80, section: "dive", options: "yes|כן\nno|לא" },
  { field_key: "nitrox_level", label: "דרגת נייטרוקס", type: "select", required: false, is_active: true, order_index: 90, section: "dive", options: "none|ללא\n1|1\n2|2" },
  { field_key: "insurance_valid_until", label: "תוקף ביטוח", type: "date", required: true, is_active: true, order_index: 100, section: "dive", options: "" },
  { field_key: "last_dive_date", label: "תאריך צלילה אחרונה", type: "date", required: true, is_active: true, order_index: 110, section: "dive", options: "" },
  { field_key: "air_type", label: "סוג אוויר", type: "select", required: true, is_active: true, order_index: 120, section: "dive", options: "air|אוויר\nnitrox|נייטרוקס" },
  { field_key: "certification_file", label: "העלאת תעודת צלילה", type: "file", required: true, is_active: true, order_index: 130, section: "dive", options: "" },
  { field_key: "insurance_file", label: "העלאת ביטוח", type: "file", required: true, is_active: true, order_index: 140, section: "dive", options: "" },
  { field_key: "terms_accepted", label: "אישור תנאי ביטול", type: "checkbox", required: true, is_active: true, order_index: 150, section: "payment", options: "" },
  { field_key: "save_details_for_next_time", label: "האם להירשם לאפליקציה ולשמור את הפרטים להרשמות הבאות?", type: "checkbox", required: false, is_active: true, order_index: 160, section: "payment", options: "" },
  { field_key: "account_password", label: "בחירת סיסמה לשמירת פרטים", type: "password", required: false, is_active: true, order_index: 170, section: "payment", options: "" },
  { field_key: "account_password_confirm", label: "אימות סיסמה", type: "password", required: false, is_active: true, order_index: 180, section: "payment", options: "" },
  { field_key: "signature", label: "חתימה דיגיטלית", type: "signature", required: true, is_active: true, order_index: 190, section: "payment", options: "" }
];

export const INITIAL_SITES = [
  "מערות ראש הנקרה",
  "קניון אכזיב",
  "האוניה הטורקית בנהריה",
  "הסטי\"ל אח\"י כידון",
  "קניון העוגנים",
  "הגוררת איתנה",
  "מערות שבי ציון",
  "קניון עכו",
  "הצוללת שירה",
  "אוניית המלט",
  "הדוברה הגדולה"
];

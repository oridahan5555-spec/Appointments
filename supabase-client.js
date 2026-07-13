(function () {
  const config = window.SUPABASE_CONFIG || {};
  const url = String(config.url || "").trim();
  const anonKey = String(config.anonKey || "").trim();
  const ownerLoginName = String(config.ownerLoginName || "admin").trim() || "admin";
  const ownerEmail = String(config.ownerEmail || "").trim().toLowerCase();
  const ownerPasswordResetRedirect = String(config.ownerPasswordResetRedirect || "").trim();
  const hasLibrary = Boolean(window.supabase?.createClient);
  const isConfigured = Boolean(url && anonKey && hasLibrary);
  const REQUEST_TIMEOUT_MS = 15_000;

  async function fetchWithTimeout(input, init = {}) {
    const controller = new AbortController();
    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);
    const upstreamSignal = init.signal;
    const abortFromUpstream = () => controller.abort();

    if (upstreamSignal?.aborted) {
      controller.abort();
    } else {
      upstreamSignal?.addEventListener?.("abort", abortFromUpstream, { once: true });
    }

    try {
      return await window.fetch(input, { ...init, signal: controller.signal });
    } catch (error) {
      if (timedOut) {
        throw new Error("החיבור לשרת התארך מדי. נסו שוב בעוד רגע.");
      }
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
      upstreamSignal?.removeEventListener?.("abort", abortFromUpstream);
    }
  }

  const client = isConfigured
    ? window.supabase.createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        },
        realtime: {
          params: {
            eventsPerSecond: 5
          }
        },
        global: {
          fetch: fetchWithTimeout
        }
      })
    : null;

  const DEFAULT_PUBLIC_STATE = {
    business: null,
    services: [],
    workingHours: [],
    specialHours: [],
    blockedSlots: [],
    bookings: []
  };
  const PUBLIC_BUSINESS_COLUMNS = "id,name,description,address,phone,instagram_url,features,cover_image,profile_image,preparation_message,created_at,updated_at";

  let ownerSyncPromise = Promise.resolve();

  function ensureClient() {
    if (!client) {
      throw new Error("Supabase client is not configured");
    }

    return client;
  }

  function normalizePhone(phone) {
    return String(phone || "").replace(/[^\d+]/g, "");
  }

  function createUuid() {
    return window.createAppUuid();
  }

  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
  }

  function withUuid(value) {
    return isUuid(value) ? String(value) : createUuid();
  }

  function mapBusinessToDb(business) {
    return {
      id: business?.id && isUuid(business.id) ? business.id : undefined,
      name: String(business?.name || "").trim() || "שם העסק שלך",
      description: String(business?.description || "").trim(),
      address: String(business?.address || "").trim(),
      phone: String(business?.phone || "").trim(),
      owner_email: String(business?.owner_email || "").trim().toLowerCase(),
      instagram_url: String(business?.instagram_url || "").trim(),
      cover_image: String(business?.cover_image || "").trim(),
      profile_image: String(business?.profile_image || "").trim(),
      preparation_message: String(business?.preparation_message || "").trim(),
      features: business?.features || {}
    };
  }

  function mapBusinessFromDb(row) {
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      name: row.name || "",
      description: row.description || "",
      address: row.address || "",
      phone: row.phone || "",
      owner_email: row.owner_email || "",
      instagram_url: row.instagram_url || "",
      cover_image: row.cover_image || "",
      profile_image: row.profile_image || "",
      preparation_message: row.preparation_message || "",
      features: row.features || {}
    };
  }

  function mapServicesToDb(services) {
    return (Array.isArray(services) ? services : []).map((service, index) => ({
      id: withUuid(service?.id),
      category: String(service?.category || "").trim() || "קטגוריה ראשית",
      name: String(service?.name || "").trim() || `שירות ${index + 1}`,
      price: Number(service?.price || 0),
      duration_minutes: Number(service?.duration_minutes || 30),
      is_active: service?.is_active !== false,
      display_order: index
    }));
  }

  function mapServicesFromDb(rows) {
    return (Array.isArray(rows) ? rows : []).map((row) => ({
      id: row.id,
      category: row.category || "",
      name: row.name || "",
      price: Number(row.price || 0),
      duration_minutes: Number(row.duration_minutes || 30),
      is_active: row.is_active !== false
    }));
  }

  function mapWorkingHoursToDb(items) {
    return (Array.isArray(items) ? items : []).map((item, index) => ({
      id: isUuid(item?.id) ? item.id : undefined,
      day_of_week: Number(item?.day_of_week ?? index),
      day_label: String(item?.day_label || "").trim(),
      opens_at: item?.opens_at || null,
      closes_at: item?.closes_at || null,
      slot_interval_minutes: Number(item?.slot_interval_minutes || 30),
      is_closed: Boolean(item?.is_closed)
    }));
  }

  function mapWorkingHoursFromDb(rows) {
    return (Array.isArray(rows) ? rows : []).map((row) => ({
      id: row.id,
      day_of_week: Number(row.day_of_week || 0),
      day_label: row.day_label || "",
      opens_at: row.opens_at ? String(row.opens_at).slice(0, 5) : null,
      closes_at: row.closes_at ? String(row.closes_at).slice(0, 5) : null,
      slot_interval_minutes: Number(row.slot_interval_minutes || 30),
      is_closed: Boolean(row.is_closed)
    }));
  }

  function mapSpecialHoursToDb(items) {
    return (Array.isArray(items) ? items : []).map((item) => ({
      id: isUuid(item?.id) ? item.id : undefined,
      special_date: String(item?.special_date || "").trim(),
      opens_at: item?.opens_at || null,
      closes_at: item?.closes_at || null,
      slot_interval_minutes: Number(item?.slot_interval_minutes || 30),
      is_closed: Boolean(item?.is_closed),
      note: String(item?.note || "").trim()
    })).filter((item) => item.special_date);
  }

  function mapSpecialHoursFromDb(rows) {
    return (Array.isArray(rows) ? rows : []).map((row) => ({
      id: row.id,
      special_date: row.special_date,
      opens_at: row.opens_at ? String(row.opens_at).slice(0, 5) : null,
      closes_at: row.closes_at ? String(row.closes_at).slice(0, 5) : null,
      slot_interval_minutes: Number(row.slot_interval_minutes || 30),
      is_closed: Boolean(row.is_closed),
      note: row.note || ""
    }));
  }

  function mapBlockedSlotsToDb(items) {
    return (Array.isArray(items) ? items : []).map((item) => ({
      id: isUuid(item?.id) ? item.id : undefined,
      blocked_date: String(item?.blocked_date || "").trim(),
      blocked_time: String(item?.blocked_time || "").trim(),
      note: String(item?.note || "").trim()
    })).filter((item) => item.blocked_date && item.blocked_time);
  }

  function mapBlockedSlotsFromDb(rows) {
    return (Array.isArray(rows) ? rows : []).map((row) => ({
      id: row.id,
      blocked_date: row.blocked_date,
      blocked_time: String(row.blocked_time || "").slice(0, 5),
      note: row.note || ""
    }));
  }

  function mapCustomerRowFromDb(row) {
    return {
      id: row.id,
      auth_user_id: row.auth_user_id || "",
      firstName: row.first_name || "",
      lastName: row.last_name || "",
      phone: row.phone || "",
      email: row.email || "",
      owner_note: row.owner_note || "",
      is_blocked: Boolean(row.is_blocked),
      blocked_reason: row.blocked_reason || "",
      blocked_at: row.blocked_at || "",
      no_show_count: Number(row.no_show_count || 0),
      created_at: row.created_at || new Date().toISOString()
    };
  }

  function mapCustomersToDb(users) {
    return (Array.isArray(users) ? users : []).map((user) => ({
      id: isUuid(user?.id) ? user.id : undefined,
      auth_user_id: isUuid(user?.auth_user_id) ? user.auth_user_id : undefined,
      first_name: String(user?.firstName || "").trim(),
      last_name: String(user?.lastName || "").trim(),
      phone: normalizePhone(user?.phone),
      email: String(user?.email || "").trim().toLowerCase() || null,
      owner_note: String(user?.owner_note || "").trim(),
      is_blocked: Boolean(user?.is_blocked),
      blocked_reason: String(user?.blocked_reason || "").trim(),
      blocked_at: user?.blocked_at || null,
      no_show_count: Number(user?.no_show_count || 0)
    })).filter((user) => user.phone);
  }

  function mapBookingFromDb(row, customerRow) {
    return {
      id: row.id,
      service_id: row.service_id,
      service_ids: Array.isArray(row.service_ids) ? row.service_ids : row.service_ids || [],
      service_names: Array.isArray(row.service_names) ? row.service_names : row.service_names || [],
      service_name: Array.isArray(row.service_names) && row.service_names.length ? row.service_names.join(" + ") : "",
      staff_id: "staff-owner",
      staff_name: "בעלת העסק",
      customer_first_name: row.customer_first_name || customerRow?.first_name || "",
      customer_last_name: row.customer_last_name || customerRow?.last_name || "",
      customer_phone: row.customer_phone || customerRow?.phone || "",
      customer_auth_user_id: row.customer_auth_user_id || "",
      customer_email: row.customer_email || customerRow?.email || "",
      notes: row.notes || "",
      booking_date: row.booking_date,
      booking_time: String(row.booking_time || "").slice(0, 5),
      duration_minutes: Number(row.duration_minutes || 30),
      status: row.status || "pending",
      replaces_booking_id: row.replaces_booking_id || null,
      hidden_for_customer: Boolean(row.hidden_for_customer),
      arrival_status: row.arrival_status || "",
      attendance_confirmation_requested_at: row.attendance_confirmation_requested_at || "",
      attendance_confirmation_status: row.attendance_confirmation_status || "",
      attendance_confirmation_answered_at: row.attendance_confirmation_answered_at || ""
    };
  }

  function mapBookingToDb(booking) {
    return {
      id: isUuid(booking?.id) ? booking.id : undefined,
      service_id: booking?.service_id,
      service_ids: booking?.service_ids || [],
      service_names: booking?.service_names || [],
      customer_first_name: String(booking?.customer_first_name || "").trim(),
      customer_last_name: String(booking?.customer_last_name || "").trim(),
      customer_phone: normalizePhone(booking?.customer_phone),
      customer_auth_user_id: isUuid(booking?.customer_auth_user_id) ? booking.customer_auth_user_id : undefined,
      customer_email: String(booking?.customer_email || "").trim().toLowerCase() || null,
      notes: String(booking?.notes || "").trim(),
      booking_date: booking?.booking_date,
      booking_time: booking?.booking_time,
      duration_minutes: Number(booking?.duration_minutes || 30),
      status: String(booking?.status || "pending"),
      customer_confirmed: Boolean(booking?.customer_confirmed),
      replaces_booking_id: isUuid(booking?.replaces_booking_id) ? booking.replaces_booking_id : null,
      hidden_for_customer: Boolean(booking?.hidden_for_customer),
      arrival_status: String(booking?.arrival_status || ""),
      attendance_confirmation_requested_at: booking?.attendance_confirmation_requested_at || null,
      attendance_confirmation_status: booking?.attendance_confirmation_status || "",
      attendance_confirmation_answered_at: booking?.attendance_confirmation_answered_at || null
    };
  }

  function mapNotificationToDb(item) {
    return {
      id: isUuid(item?.id) ? item.id : undefined,
      title: String(item?.title || "").trim(),
      message: String(item?.message || "").trim(),
      user_id: String(item?.user_id || "").trim(),
      type: String(item?.type || "general").trim(),
      is_read: Boolean(item?.is_read ?? item?.read),
      created_at: item?.created_at || undefined,
      booking_id: isUuid(item?.booking_id) ? item.booking_id : null,
      action_url: String(item?.action_url || "").trim() || null,
      metadata: item?.metadata && typeof item.metadata === "object" ? item.metadata : {},
      event_key: String(item?.event_key || "").trim() || null
    };
  }

  function mapNotificationFromDb(row) {
    return {
      id: row.id,
      title: row.title || "",
      message: row.message || "",
      created_at: row.created_at || new Date().toISOString(),
      is_read: Boolean(row.is_read),
      user_id: row.user_id || "",
      type: row.type || "general",
      booking_id: row.booking_id || "",
      action_url: row.action_url || "",
      metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : {},
      event_key: row.event_key || ""
    };
  }

  function mapWaitlistFromDb(row) {
    return {
      id: row.id,
      customer_phone: row.customer_phone || "",
      customer_name: row.customer_name || "",
      customer_auth_user_id: row.customer_auth_user_id || "",
      service_id: row.service_id || "",
      service_name: row.service_name || "",
      booking_date: row.booking_date,
      notes: row.notes || "",
      status: row.status || "waiting",
      created_at: row.created_at || new Date().toISOString(),
      notified_at: row.notified_at || ""
    };
  }

  function mapWaitlistToDb(row) {
    return {
      id: isUuid(row?.id) ? row.id : undefined,
      customer_phone: normalizePhone(row?.customer_phone),
      customer_name: String(row?.customer_name || "").trim(),
      customer_auth_user_id: isUuid(row?.customer_auth_user_id) ? row.customer_auth_user_id : undefined,
      service_id: row?.service_id,
      service_name: String(row?.service_name || "").trim(),
      booking_date: row?.booking_date,
      notes: String(row?.notes || "").trim(),
      status: String(row?.status || "waiting"),
      notified_at: row?.notified_at || null
    };
  }

  async function getSingleBusinessRow() {
    const supabase = ensureClient();
    const { data, error } = await supabase
      .from("business")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data || null;
  }

  async function replaceOwnedRows(table, rows) {
    const supabase = ensureClient();
    const normalizedRows = Array.isArray(rows) ? rows : [];
    if (normalizedRows.length) {
      const { error: upsertError } = await supabase.from(table).upsert(normalizedRows);
      if (upsertError) {
        throw upsertError;
      }
    }
  }

  async function deleteOwnerRow(table, id) {
    const supabase = ensureClient();
    const allowedTables = new Set(["services", "special_hours", "blocked_slots", "waitlist_entries"]);
    const rowId = String(id || "").trim();
    if (!allowedTables.has(table)) {
      throw new Error("הפעולה שניסית לבצע אינה מותרת.");
    }
    if (!isUuid(rowId)) {
      throw new Error("לא ניתן למחוק את הפריט כי המזהה שלו אינו תקין. רענני את הדף ונסי שוב.");
    }

    const { error } = await supabase.from(table).delete().eq("id", rowId);
    if (error) {
      throw error;
    }
  }

  async function getSession() {
    const supabase = ensureClient();
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session || null;
  }

  async function getCurrentUser() {
    const session = await getSession();
    return session?.user || null;
  }

  async function isOwnerUser() {
    const user = await getCurrentUser();
    if (!user) return false;
    const supabase = ensureClient();
    const { data, error } = await supabase.from("owner_profiles").select("id").eq("id", user.id).maybeSingle();
    if (error) throw error;
    return Boolean(data?.id);
  }

  async function signInOwner(credentials) {
    const supabase = ensureClient();
    const rawIdentifier = String(credentials?.email || credentials?.username || "").trim();
    const normalizedIdentifier = rawIdentifier.toLowerCase();
    const password = String(credentials?.password || "");

    if (normalizedIdentifier !== ownerLoginName.toLowerCase()) {
      throw new Error(`שם המשתמש לניהול חייב להיות ${ownerLoginName}.`);
    }
    if (!ownerEmail) {
      throw new Error("כתובת חשבון הניהול עדיין לא הוגדרה במערכת.");
    }
    if (!password) {
      throw new Error("צריך למלא סיסמה.");
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email: ownerEmail, password });
    if (error) {
      const message = String(error.message || "").toLowerCase();
      if (message.includes("invalid login credentials")) {
        throw new Error("שם המשתמש או הסיסמה אינם נכונים.");
      }
      if (message.includes("email not confirmed")) {
        throw new Error("חשבון הניהול עדיין לא אושר באימייל.");
      }
      if (message.includes("rate limit")) {
        throw new Error("בוצעו יותר מדי ניסיונות בזמן קצר. חכו רגע ונסו שוב.");
      }
      throw error;
    }
    return data;
  }

  async function signOut() {
    if (!client) return;
    await client.auth.signOut();
  }

  async function sendOwnerPasswordReset() {
    const supabase = ensureClient();
    if (!ownerEmail) {
      throw new Error("חסר ownerEmail ב-supabase-config.js.");
    }

    const redirectTo = ownerPasswordResetRedirect || "https://appointments-rosy-chi.vercel.app/owner.html";
    const { error } = await supabase.auth.resetPasswordForEmail(ownerEmail, { redirectTo });
    if (error) throw error;
    return true;
  }

  async function sendCustomerPasswordReset(email) {
    const supabase = ensureClient();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail) {
      throw new Error("צריך למלא אימייל כדי לאפס סיסמה.");
    }

    const redirectTo = `${window.location.origin}/index.html`;
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo });
    if (error) {
      if (String(error.message || "").toLowerCase().includes("rate limit")) {
        throw new Error("נשלחו יותר מדי בקשות איפוס. חכי רגע ונסי שוב.");
      }
      throw error;
    }
    return true;
  }

  async function updateCurrentUserPassword(password) {
    const supabase = ensureClient();
    const nextPassword = String(password || "");
    if (!nextPassword.trim()) {
      throw new Error("חסרה סיסמה חדשה.");
    }

    const { data, error } = await supabase.auth.updateUser({ password: nextPassword });
    if (error) throw error;
    return data.user || null;
  }

  const updateOwnerPassword = updateCurrentUserPassword;

  async function claimCustomerAccount(payload = {}) {
    const supabase = ensureClient();
    const user = await getCurrentUser();
    if (!user) {
      throw new Error("צריך להתחבר לפני שיוצרים פרופיל לקוחה.");
    }

    const firstName = String(payload?.firstName || user.user_metadata?.first_name || "").trim();
    const lastName = String(payload?.lastName || user.user_metadata?.last_name || "").trim();
    const phone = normalizePhone(payload?.phone || user.user_metadata?.phone);
    const email = String(payload?.email || user.email || "").trim().toLowerCase();

    const { data, error } = await supabase.rpc("claim_customer_account", {
      p_first_name: firstName,
      p_last_name: lastName,
      p_phone: phone,
      p_email: email
    });

    if (error) {
      const message = String(error.message || "");
      if (message.includes("CUSTOMER_ALREADY_LINKED") || message.includes("PHONE_ALREADY_REGISTERED")) {
        throw new Error("הטלפון או האימייל כבר שייכים לחשבון לקוחה אחר.");
      }
      if (message.includes("PHONE_REQUIRED_TO_CREATE_CUSTOMER") || message.includes("VALID_PHONE_REQUIRED")) {
        throw new Error("התחברת, אבל חסר מספר טלפון בפרופיל. צרי קשר עם בעלת העסק כדי להשלים את הפרטים.");
      }
      throw error;
    }

    return data;
  }

  async function registerCustomer(payload) {
    const supabase = ensureClient();
    const email = String(payload?.email || "").trim().toLowerCase();
    const password = String(payload?.password || "");
    const firstName = String(payload?.firstName || "").trim();
    const lastName = String(payload?.lastName || "").trim();
    const phone = normalizePhone(payload?.phone);

    if (!email || !password || !firstName || !lastName || !phone) {
      throw new Error("צריך למלא את כל הפרטים כדי ליצור חשבון.");
    }
    if (phone.replace(/\D/g, "").length < 9 || phone.replace(/\D/g, "").length > 15) {
      throw new Error("מספר הטלפון אינו תקין. צריך להקליד בין 9 ל-15 ספרות.");
    }
    if (password.length < 6) {
      throw new Error("הסיסמה קצרה מדי. בחרי סיסמה עם לפחות 6 תווים.");
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          phone,
          first_name: firstName,
          last_name: lastName,
          role: "customer"
        }
      }
    });

    if (error) {
      const message = String(error.message || "").toLowerCase();
      if (
        message.includes("already registered")
        || message.includes("already exists")
        || message.includes("user already")
        || message.includes("email address is already")
      ) {
        throw new Error("כבר קיים חשבון עם האימייל הזה. נסי להתחבר דרך 'כניסה ללקוחה קיימת'.");
      }
      if (
        message.includes("password")
        && (message.includes("weak") || message.includes("least") || message.includes("short") || message.includes("6"))
      ) {
        throw new Error("הסיסמה קצרה מדי. בחרי סיסמה חזקה יותר.");
      }
      if (message.includes("database error saving new user")) {
        throw new Error("כבר קיים חשבון עם האימייל הזה, או שיש תקלה זמנית ביצירת החשבון.");
      }
      throw error;
    }

    if (!data.session) {
      return {
        ...data,
        needsEmailConfirmation: true
      };
    }

    await claimCustomerAccount({ firstName, lastName, phone, email });
    return {
      ...data,
      needsEmailConfirmation: false
    };
  }

  async function signInCustomer(payload) {
    const supabase = ensureClient();
    const email = String(payload?.email || "").trim().toLowerCase();
    const password = String(payload?.password || "");
    if (!email || !password) {
      throw new Error("צריך למלא אימייל וסיסמה.");
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (String(error.message || "").toLowerCase().includes("invalid login credentials")) {
        throw new Error("האימייל או הסיסמה לא נכונים.");
      }
      throw error;
    }

    try {
      await claimCustomerAccount({
        email,
        phone: payload?.phone || data.user?.user_metadata?.phone || "",
        firstName: payload?.firstName || data.user?.user_metadata?.first_name || "",
        lastName: payload?.lastName || data.user?.user_metadata?.last_name || ""
      });
    } catch (claimError) {
      const claimMessage = String(claimError?.message || "");
      if (claimMessage.includes("PHONE_REQUIRED_TO_CREATE_CUSTOMER") || claimMessage.includes("VALID_PHONE_REQUIRED") || claimMessage.includes("חסרים פרטי")) {
        throw new Error("התחברת, אבל חסר מספר טלפון בפרופיל. צרי קשר עם בעלת העסק כדי להשלים את הפרטים.");
      }
      if (claimMessage.includes("CUSTOMER_ALREADY_LINKED") || claimMessage.includes("כבר שייכים")) {
        throw new Error("הטלפון או האימייל כבר מחוברים לחשבון לקוחה אחר. אם זה החשבון שלך, נסי להתחבר עם האימייל של אותו חשבון או השתמשי בשכחתי סיסמה.");
      }
      throw claimError;
    }
    return data;
  }

  async function updateOwnerCredentials(payload) {
    const supabase = ensureClient();
    const nextPassword = String(payload?.password || "");

    if (!nextPassword.trim()) {
      return null;
    }

    const { data, error } = await supabase.auth.updateUser({ password: nextPassword });
    if (error) throw error;
    return data.user || null;
  }

  async function resetOwnerBusinessData() {
    const supabase = ensureClient();
    const { data, error } = await supabase.rpc("reset_owner_business_data");
    if (error) throw error;
    return data;
  }

  async function loadPublicState() {
    const supabase = ensureClient();
    const [businessResponse, servicesResponse, hoursResponse, specialHoursResponse, blockedSlotsResponse, slotsResponse] = await Promise.all([
      supabase.from("business").select(PUBLIC_BUSINESS_COLUMNS).order("created_at", { ascending: true }).limit(1).maybeSingle(),
      supabase.from("services").select("*").eq("is_active", true).order("display_order", { ascending: true }),
      supabase.from("working_hours").select("*").order("day_of_week", { ascending: true }),
      supabase.rpc("get_public_special_hours"),
      supabase.rpc("get_public_blocked_slots"),
      supabase.rpc("get_public_booking_slots")
    ]);

    [businessResponse, servicesResponse, hoursResponse, specialHoursResponse, blockedSlotsResponse, slotsResponse].forEach((response) => {
      if (response.error) {
        throw response.error;
      }
    });

    if (!businessResponse.data?.id) {
      throw new Error("לא נמצאו נתוני עסק להצגה כרגע.");
    }

    return {
      business: mapBusinessFromDb(businessResponse.data),
      services: mapServicesFromDb(servicesResponse.data),
      workingHours: mapWorkingHoursFromDb(hoursResponse.data),
      specialHours: mapSpecialHoursFromDb(specialHoursResponse.data),
      blockedSlots: mapBlockedSlotsFromDb(blockedSlotsResponse.data),
      bookings: (slotsResponse.data || []).map((row) => mapBookingFromDb(row))
    };
  }

  async function loadCustomerState({ claimMissingProfile = true } = {}) {
    const supabase = ensureClient();
    const user = await getCurrentUser();
    if (!user) {
      return {
        customer: null,
        bookings: [],
        notifications: [],
        waitlistEntries: []
      };
    }

    const [customerResponse, bookingsResponse, notificationsResponse, waitlistResponse] = await Promise.all([
      supabase.from("customers").select("*").eq("auth_user_id", user.id).maybeSingle(),
      supabase.from("bookings").select("*").eq("customer_auth_user_id", user.id).order("booking_date", { ascending: true }).order("booking_time", { ascending: true }),
      supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("waitlist_entries").select("*").eq("customer_auth_user_id", user.id).order("created_at", { ascending: false })
    ]);

    [customerResponse, bookingsResponse, notificationsResponse, waitlistResponse].forEach((response) => {
      if (response.error) {
        throw response.error;
      }
    });

    if (!customerResponse.data && claimMissingProfile) {
      await claimCustomerAccount({
        email: user.email || "",
        phone: user.user_metadata?.phone || "",
        firstName: user.user_metadata?.first_name || "",
        lastName: user.user_metadata?.last_name || ""
      });
      return loadCustomerState({ claimMissingProfile: false });
    }

    const customer = customerResponse.data ? mapCustomerRowFromDb(customerResponse.data) : null;
    return {
      customer,
      bookings: (bookingsResponse.data || []).map((row) => mapBookingFromDb(row, customerResponse.data)),
      notifications: (notificationsResponse.data || []).map(mapNotificationFromDb),
      waitlistEntries: (waitlistResponse.data || []).map(mapWaitlistFromDb)
    };
  }

  async function loadOwnerState() {
    const supabase = ensureClient();
    const user = await getCurrentUser();
    if (!user) {
      throw new Error("צריך להתחבר לחשבון ניהול לפני טעינת נתוני העסק.");
    }

    const [publicState, customersResponse, bookingsResponse, notificationsResponse, waitlistResponse, specialHoursResponse, blockedSlotsResponse, ownerResponse, ownerEmailResponse] = await Promise.all([
      loadPublicState(),
      supabase.from("customers").select("*").order("created_at", { ascending: true }),
      supabase.from("bookings").select("*").order("booking_date", { ascending: true }).order("booking_time", { ascending: true }),
      supabase.from("notifications").select("*").order("created_at", { ascending: false }),
      supabase.from("waitlist_entries").select("*").order("created_at", { ascending: false }),
      supabase.from("special_hours").select("*").order("special_date", { ascending: true }),
      supabase.from("blocked_slots").select("*").order("blocked_date", { ascending: true }).order("blocked_time", { ascending: true }),
      supabase.from("owner_profiles").select("id").eq("id", user.id).maybeSingle(),
      supabase.rpc("get_owner_email_context")
    ]);

    [customersResponse, bookingsResponse, notificationsResponse, waitlistResponse, specialHoursResponse, blockedSlotsResponse, ownerResponse, ownerEmailResponse].forEach((response) => {
      if (response.error) {
        throw response.error;
      }
    });

    const customersMap = new Map((customersResponse.data || []).map((row) => [normalizePhone(row.phone), row]));

    return {
      ...publicState,
      business: {
        ...publicState.business,
        owner_email: String(ownerEmailResponse.data?.owner_email || "").trim().toLowerCase()
      },
      users: (customersResponse.data || []).map(mapCustomerRowFromDb),
      bookings: (bookingsResponse.data || []).map((row) => mapBookingFromDb(row, customersMap.get(normalizePhone(row.customer_phone)))),
      notifications: (notificationsResponse.data || []).map(mapNotificationFromDb),
      waitlistEntries: (waitlistResponse.data || []).map(mapWaitlistFromDb),
      specialHours: mapSpecialHoursFromDb(specialHoursResponse.data || []),
      blockedSlots: mapBlockedSlotsFromDb(blockedSlotsResponse.data || []),
      owner: ownerResponse.data || null
    };
  }

  async function markNotificationRead(notificationId) {
    const supabase = ensureClient();
    const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", notificationId);
    if (error) throw error;
  }

  async function markAllNotificationsRead(userId) {
    const supabase = ensureClient();
    const { error } = await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false);
    if (error) throw error;
  }

  async function deleteNotification(notificationId) {
    const supabase = ensureClient();
    const { error } = await supabase.from("notifications").delete().eq("id", notificationId);
    if (error) throw error;
  }

  async function createNotification(notification) {
    const supabase = ensureClient();
    const payload = mapNotificationToDb({
      ...notification,
      id: withUuid(notification?.id),
      created_at: notification?.created_at || new Date().toISOString()
    });
    const { data, error } = await supabase.from("notifications").upsert(payload).select("*").single();
    if (error) throw error;
    return mapNotificationFromDb(data);
  }

  async function createBooking(payload) {
    const supabase = ensureClient();
    const { data, error } = await supabase.rpc("create_booking_public", {
      p_service_id: payload.serviceId,
      p_service_ids: payload.serviceIds || [],
      p_customer_first_name: payload.firstName,
      p_customer_last_name: payload.lastName,
      p_customer_phone: payload.phone,
      p_notes: payload.notes || "",
      p_booking_date: payload.bookingDate,
      p_booking_time: payload.bookingTime,
      p_replaces_booking_id: payload.replacesBookingId || null
    });

    if (error) throw error;
    return data?.[0] || null;
  }

  async function cancelMyBooking(bookingId) {
    const supabase = ensureClient();
    const { error } = await supabase.rpc("cancel_my_booking", {
      p_booking_id: bookingId
    });
    if (error) throw error;
  }

  async function hideMyBooking(bookingId) {
    const supabase = ensureClient();
    const { error } = await supabase.rpc("hide_my_booking", {
      p_booking_id: bookingId
    });
    if (error) throw error;
  }

  async function respondAttendance(bookingId, response) {
    const supabase = ensureClient();
    const { error } = await supabase.rpc("respond_attendance_confirmation", {
      p_booking_id: bookingId,
      p_response: response
    });
    if (error) throw error;
  }

  async function requestBookingAttendance(bookingId) {
    const supabase = ensureClient();
    const { error } = await supabase.rpc("request_booking_attendance_confirmation", {
      p_booking_id: bookingId
    });
    if (error) throw error;
  }

  async function joinWaitlist(payload) {
    const supabase = ensureClient();
    const { error } = await supabase.rpc("join_waitlist_public", {
      p_service_id: payload.serviceId,
      p_service_name: payload.serviceName,
      p_booking_date: payload.bookingDate,
      p_notes: payload.notes || ""
    });
    if (error) throw error;
  }

  async function syncOwnerState(snapshot) {
    const supabase = ensureClient();
    const businessPayload = mapBusinessToDb(snapshot.business);
    const servicesPayload = mapServicesToDb(snapshot.services);
    const workingHoursPayload = mapWorkingHoursToDb(snapshot.workingHours);
    const specialHoursPayload = mapSpecialHoursToDb(snapshot.specialHours);
    const blockedSlotsPayload = mapBlockedSlotsToDb(snapshot.blockedSlots);
    const customersPayload = mapCustomersToDb(snapshot.users);
    const bookingsPayload = (Array.isArray(snapshot.bookings) ? snapshot.bookings : []).map(mapBookingToDb).filter((item) => item.service_id && item.booking_date && item.booking_time);
    const notificationsPayload = (Array.isArray(snapshot.notifications) ? snapshot.notifications : []).map((item) => mapNotificationToDb({ ...item, id: withUuid(item?.id) })).filter((item) => item.title && item.user_id);
    const waitlistPayload = (Array.isArray(snapshot.waitlistEntries) ? snapshot.waitlistEntries : []).map(mapWaitlistToDb).filter((item) => item.customer_phone && item.service_id && item.booking_date);

    ownerSyncPromise = ownerSyncPromise.catch(() => undefined).then(async () => {
      if (!businessPayload.id) {
        const existingBusiness = await getSingleBusinessRow();
        if (existingBusiness?.id) {
          businessPayload.id = existingBusiness.id;
        }
      }

      const { error: businessError } = await supabase.from("business").upsert(businessPayload);
      if (businessError) throw businessError;

      await replaceOwnedRows("services", servicesPayload);

      if (workingHoursPayload.length) {
        const { error } = await supabase.from("working_hours").upsert(workingHoursPayload);
        if (error) throw error;
      }

      await replaceOwnedRows("special_hours", specialHoursPayload);

      await replaceOwnedRows("blocked_slots", blockedSlotsPayload);

      if (customersPayload.length) {
        const { error } = await supabase.from("customers").upsert(customersPayload, { onConflict: "phone" });
        if (error) throw error;
      }

      if (bookingsPayload.length) {
        const { error } = await supabase.from("bookings").upsert(bookingsPayload);
        if (error) throw error;
      }

      await replaceOwnedRows("waitlist_entries", waitlistPayload);

      if (notificationsPayload.length) {
        const { error } = await supabase.from("notifications").upsert(notificationsPayload);
        if (error) throw error;
      }

      return businessPayload;
    });

    return ownerSyncPromise;
  }

  function subscribe(table, callback, filter) {
    if (!client) {
      return () => undefined;
    }

    let channel = client.channel(`rt-${table}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    const config = {
      event: "*",
      schema: "public",
      table
    };

    if (filter) {
      config.filter = filter;
    }

    channel = channel.on("postgres_changes", config, callback).subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }

  function onAuthStateChange(callback) {
    if (!client) {
      return { data: { subscription: { unsubscribe: () => undefined } } };
    }

    return client.auth.onAuthStateChange((event, session) => {
      callback?.(event, session);
    });
  }

  window.AppSupabase = {
    isConfigured: () => isConfigured,
    getClient: () => client,
    getSession,
    getCurrentUser,
    isOwnerUser,
    signInOwner,
    sendOwnerPasswordReset,
    sendCustomerPasswordReset,
    updateOwnerPassword,
    updateCurrentUserPassword,
    signOut,
    claimCustomerAccount,
    registerCustomer,
    signInCustomer,
    updateOwnerCredentials,
    loadPublicState,
    loadCustomerState,
    loadOwnerState,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    createNotification,
    createBooking,
    cancelMyBooking,
    hideMyBooking,
    respondAttendance,
    requestBookingAttendance,
    joinWaitlist,
    syncOwnerState,
    resetOwnerBusinessData,
    deleteOwnerRow,
    subscribe,
    onAuthStateChange,
    normalizePhone,
    getOwnerLoginName: () => ownerLoginName,
    getOwnerEmail: () => ownerEmail
  };
})();

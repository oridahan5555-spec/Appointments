(function () {
  const config = window.SUPABASE_CONFIG || {};
  const url = String(config.url || "").trim();
  const anonKey = String(config.anonKey || "").trim();
  const ownerLoginName = String(config.ownerLoginName || "admin").trim() || "admin";
  const ownerEmail = String(config.ownerEmail || "").trim().toLowerCase();
  const ownerPasswordResetRedirect = String(config.ownerPasswordResetRedirect || "").trim();
  const hasLibrary = Boolean(window.supabase?.createClient);
  const isConfigured = Boolean(url && anonKey && hasLibrary);
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

  function customerEmailFromPhone(phone) {
    const normalized = normalizePhone(phone);
    return normalized ? `${normalized}@customers.local` : "";
  }

  function createUuid() {
    if (window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }

    return `uuid-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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
      password: "",
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
      is_read: Boolean(item?.read ?? item?.is_read),
      created_at: item?.created_at || undefined
    };
  }

  function mapNotificationFromDb(row) {
    return {
      id: row.id,
      title: row.title || "",
      message: row.message || "",
      created_at: row.created_at || new Date().toISOString(),
      read: Boolean(row.is_read),
      user_id: row.user_id || "",
      type: row.type || "general"
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
    const desiredIds = new Set(
      normalizedRows
        .map((row) => row?.id)
        .filter((id) => isUuid(id))
        .map((id) => String(id))
    );

    if (normalizedRows.length) {
      const { error: upsertError } = await supabase.from(table).upsert(normalizedRows);
      if (upsertError) {
        throw upsertError;
      }
    }
    const { data: existingRows, error: existingError } = await supabase.from(table).select("id");
    if (existingError) {
      throw existingError;
    }

    const idsToDelete = (existingRows || [])
      .map((row) => row?.id)
      .filter((id) => isUuid(id) && !desiredIds.has(String(id)));

    if (!idsToDelete.length) {
      return;
    }

    const { error } = await supabase.from(table).delete().in("id", idsToDelete);
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
    const email = ownerEmail
      || (normalizedIdentifier.includes("@") ? normalizedIdentifier : "")
      || (normalizedIdentifier === ownerLoginName.toLowerCase() ? ownerEmail : "");
    const password = String(credentials?.password || "");
    if (!email) {
      throw new Error("חסר ownerEmail ב-supabase-config.js כדי לאפשר התחברות עם admin.");
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
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

  async function updateOwnerPassword(password) {
    const supabase = ensureClient();
    const nextPassword = String(password || "");
    if (!nextPassword.trim()) {
      throw new Error("חסרה סיסמה חדשה.");
    }

    const { data, error } = await supabase.auth.updateUser({ password: nextPassword });
    if (error) throw error;
    return data.user || null;
  }

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
      if (String(error.message || "").includes("CUSTOMER_ALREADY_LINKED")) {
        throw new Error("הטלפון או האימייל כבר שייכים לחשבון לקוחה אחר.");
      }
      if (String(error.message || "").includes("PHONE_REQUIRED_TO_CREATE_CUSTOMER")) {
        throw new Error("כדי ליצור חשבון חדש חייבים טלפון תקין.");
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
      throw error;
    }

    if (!data.session) {
      throw new Error("צריך לכבות Email confirmation ב-Supabase כדי שהלקוחה תיכנס אוטומטית אחרי יצירת החשבון.");
    }

    await claimCustomerAccount({ firstName, lastName, phone, email });
    return data;
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

    await claimCustomerAccount({ email });
    return data;
  }

  async function updateOwnerCredentials(payload) {
    const supabase = ensureClient();
    const nextEmail = String(payload?.email || payload?.username || "").trim();
    const nextPassword = String(payload?.password || "");
    const updatePayload = {};

    if (nextEmail) {
      updatePayload.email = nextEmail;
    }

    if (nextPassword.trim()) {
      updatePayload.password = nextPassword;
    }

    if (!Object.keys(updatePayload).length) {
      return null;
    }

    const { data, error } = await supabase.auth.updateUser(updatePayload);
    if (error) throw error;
    return data.user || null;
  }

  async function createOwnerProfile(ownerUserId) {
    const supabase = ensureClient();
    const { data: businessRows, error: businessError } = await supabase.from("business").select("id").limit(1);
    if (businessError) throw businessError;
    const businessId = businessRows?.[0]?.id;
    if (!businessId) {
      throw new Error("אין עדיין רשומת עסק ב-Supabase.");
    }

    const { error } = await supabase.from("owner_profiles").upsert({
      id: ownerUserId,
      business_id: businessId
    }, {
      onConflict: "id"
    });

    if (error) throw error;
  }

  async function loadPublicState() {
    const supabase = ensureClient();
    const [businessResponse, servicesResponse, hoursResponse, specialHoursResponse, blockedSlotsResponse, slotsResponse] = await Promise.all([
      supabase.from("business").select("*").order("created_at", { ascending: true }).limit(1).maybeSingle(),
      supabase.from("services").select("*").eq("is_active", true).order("display_order", { ascending: true }),
      supabase.from("working_hours").select("*").order("day_of_week", { ascending: true }),
      supabase.from("special_hours").select("*").order("special_date", { ascending: true }),
      supabase.from("blocked_slots").select("*").order("blocked_date", { ascending: true }).order("blocked_time", { ascending: true }),
      supabase.rpc("get_public_booking_slots")
    ]);

    [businessResponse, servicesResponse, hoursResponse, slotsResponse].forEach((response) => {
      if (response.error) {
        throw response.error;
      }
    });

    if (!businessResponse.data?.id) {
      throw new Error("לא נמצאה רשומת עסק ב-Supabase.");
    }

    return {
      business: mapBusinessFromDb(businessResponse.data),
      services: mapServicesFromDb(servicesResponse.data),
      workingHours: mapWorkingHoursFromDb(hoursResponse.data),
      specialHours: specialHoursResponse.error ? [] : mapSpecialHoursFromDb(specialHoursResponse.data),
      blockedSlots: blockedSlotsResponse.error ? [] : mapBlockedSlotsFromDb(blockedSlotsResponse.data),
      bookings: (slotsResponse.data || []).map((row) => mapBookingFromDb(row))
    };
  }

  async function loadCustomerState() {
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
    const [publicState, customersResponse, bookingsResponse, notificationsResponse, waitlistResponse, ownerResponse] = await Promise.all([
      loadPublicState(),
      supabase.from("customers").select("*").order("created_at", { ascending: true }),
      supabase.from("bookings").select("*").order("booking_date", { ascending: true }).order("booking_time", { ascending: true }),
      supabase.from("notifications").select("*").order("created_at", { ascending: false }),
      supabase.from("waitlist_entries").select("*").order("created_at", { ascending: false }),
      supabase.from("owner_profiles").select("id").maybeSingle()
    ]);

    [customersResponse, bookingsResponse, notificationsResponse, waitlistResponse, ownerResponse].forEach((response) => {
      if (response.error && response !== ownerResponse) {
        throw response.error;
      }
    });

    const customersMap = new Map((customersResponse.data || []).map((row) => [normalizePhone(row.phone), row]));

    return {
      ...publicState,
      users: (customersResponse.data || []).map(mapCustomerRowFromDb),
      bookings: (bookingsResponse.data || []).map((row) => mapBookingFromDb(row, customersMap.get(normalizePhone(row.customer_phone)))),
      notifications: (notificationsResponse.data || []).map(mapNotificationFromDb),
      waitlistEntries: (waitlistResponse.data || []).map(mapWaitlistFromDb),
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

    ownerSyncPromise = ownerSyncPromise.then(async () => {
      if (!businessPayload.id) {
        const existingBusiness = await getSingleBusinessRow();
        if (existingBusiness?.id) {
          businessPayload.id = existingBusiness.id;
        }
      }

      const { data: businessRow, error: businessError } = await supabase.from("business").upsert(businessPayload).select("*").single();
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

      return businessRow;
    });

    return ownerSyncPromise;
  }

  async function bootstrapOwnerDataFromLocal(snapshot) {
    const supabase = ensureClient();
    const { count, error } = await supabase.from("services").select("*", { count: "exact", head: true });
    if (error) throw error;
    if (Number(count || 0) > 0) {
      return false;
    }

    await syncOwnerState(snapshot);
    return true;
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
    signOut,
    claimCustomerAccount,
    registerCustomer,
    signInCustomer,
    updateOwnerCredentials,
    createOwnerProfile,
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
    joinWaitlist,
    syncOwnerState,
    bootstrapOwnerDataFromLocal,
    subscribe,
    onAuthStateChange,
    normalizePhone,
    customerEmailFromPhone
    ,
    getOwnerLoginName: () => ownerLoginName,
    getOwnerEmail: () => ownerEmail
  };
})();

/**
 * POST /api/admin/create-admin
 *
 * Phase 13.44 — create a brand-new admin from a form. The previous
 * "Add Admin" flow promoted an existing user; the founder wants
 * a self-contained form that creates the auth user + profile +
 * permissions in one step.
 *
 * Flow:
 *   1. Validate the caller's JWT, confirm role = 'super_admin'.
 *   2. Use the service-role client to create the auth user
 *      (auth.admin.createUser, email_confirmed=true so they can
 *      log in immediately).
 *   3. Insert / update the profile row with the form fields and
 *      role='admin'.
 *   4. Set admin_permissions via the existing RPC.
 *   5. Return success.
 *
 * Error codes (JSON):
 *   • 401 unauthenticated      — no session
 *   • 403 not_super_admin      — caller isn't super_admin
 *   • 400 invalid_input        — missing fields / weak password
 *   • 409 email_already_exists — auth.createUser conflict
 *   • 500 service_role_missing — SUPABASE_SERVICE_ROLE_KEY unset
 *   • 500 internal             — anything else, with `error` text
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

interface CreateAdminBody {
  full_name?: string
  phone?: string
  email?: string
  password?: string
  permissions?: string[]
}

export async function POST(req: Request) {
  // ─── 1. Caller authentication + super_admin gate ───────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 },
    )
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()
  const callerRole = (profile as { role?: string } | null)?.role
  if (callerRole !== "super_admin") {
    return NextResponse.json(
      { ok: false, error: "not_super_admin" },
      { status: 403 },
    )
  }

  // ─── 2. Parse + validate body ──────────────────────────────────
  let body: CreateAdminBody
  try {
    body = (await req.json()) as CreateAdminBody
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 },
    )
  }

  const fullName = (body.full_name ?? "").trim()
  const phone    = (body.phone ?? "").trim()
  const email    = (body.email ?? "").trim().toLowerCase()
  const password = (body.password ?? "")
  const permissions = Array.isArray(body.permissions)
    ? body.permissions.filter((p) => typeof p === "string")
    : []

  if (!fullName || fullName.length < 2) {
    return NextResponse.json({ ok: false, error: "name_required" }, { status: 400 })
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "email_invalid" }, { status: 400 })
  }
  if (!password || password.length < 6) {
    return NextResponse.json({ ok: false, error: "password_too_short" }, { status: 400 })
  }

  // ─── 3. Service-role client ────────────────────────────────────
  const adminSb = createAdminClient()
  if (!adminSb) {
    return NextResponse.json(
      { ok: false, error: "service_role_missing" },
      { status: 500 },
    )
  }

  // ─── 4. Create the auth user ───────────────────────────────────
  // email_confirm=true bypasses the verification email so the new
  // admin can log in immediately. Phone is stored as metadata + on
  // the profile row below; Supabase Auth's phone column requires
  // SMS provisioning which we don't need here.
  const createRes = await adminSb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      phone: phone || undefined,
    },
  })
  if (createRes.error) {
    const msg = createRes.error.message || ""
    const isConflict =
      msg.toLowerCase().includes("already") ||
      msg.toLowerCase().includes("registered") ||
      msg.toLowerCase().includes("duplicate")
    return NextResponse.json(
      {
        ok: false,
        error: isConflict ? "email_already_exists" : "auth_create_failed",
        detail: msg,
      },
      { status: isConflict ? 409 : 500 },
    )
  }
  const newUserId = createRes.data.user?.id
  if (!newUserId) {
    return NextResponse.json(
      { ok: false, error: "auth_create_failed", detail: "missing user id" },
      { status: 500 },
    )
  }

  // ─── 5. Upsert the profile row ─────────────────────────────────
  // The auth.users row triggers a default profile insert in some
  // schemas; we upsert with the form fields + role='admin'.
  const { error: profErr } = await adminSb
    .from("profiles")
    .upsert(
      {
        id: newUserId,
        full_name: fullName,
        phone: phone || null,
        role: "admin",
      },
      { onConflict: "id" },
    )
  if (profErr) {
    return NextResponse.json(
      {
        ok: false,
        error: "profile_upsert_failed",
        detail: profErr.message,
      },
      { status: 500 },
    )
  }

  // ─── 6. Set admin permissions via the existing RPC ─────────────
  // admin_grant_admin handles the admin_permissions column + audit
  // log. We call it with the service-role client so it bypasses
  // the "caller must be super_admin" check that the RPC also has
  // (we already verified above).
  try {
    const { error: permErr } = await adminSb.rpc("admin_grant_admin", {
      p_user_id: newUserId,
      p_permissions: permissions,
    })
    if (permErr) {
      // Non-fatal — the admin still exists with role='admin' but
      // without explicit permissions. Surface the error so the UI
      // can hint at it.
      return NextResponse.json(
        {
          ok: true,
          user_id: newUserId,
          warning: "permissions_failed",
          detail: permErr.message,
        },
        { status: 200 },
      )
    }
  } catch (err) {
    return NextResponse.json(
      {
        ok: true,
        user_id: newUserId,
        warning: "permissions_failed",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 200 },
    )
  }

  return NextResponse.json({ ok: true, user_id: newUserId }, { status: 200 })
}

/**
 * My Profile (avatar menu > Profile): what the signed-in user sees about their own account and the personal details
 * they may change themselves. Identity and access (user ID, roles, branch, designation, reporting line, status) are
 * read-only here and stay with User Management; the e-mail address is editable only when
 * security.profile_email_editable is on, because it receives the password reset codes.
 */
import { one, query } from '../../db/pool.js';
import { z } from '../../lib/validate.js';
import { getSetting } from '../../lib/settings.js';

export const GENDERS = ['male', 'female', 'other', 'undisclosed'];

/** Philippine contact numbers: mobile 09XX XXX XXXX / +63 9XX XXX XXXX, or a landline with its area code. */
export const PH_PHONE = /^(?:\+63|0)(?:9\d{9}|[2-8]\d{7,9})$/;
/** Spaces, dashes, dots and brackets are formatting only. */
export const normalisePhone = (v) => String(v || '').replace(/[\s\-.()]/g, '');

const text = (max) => z.union([z.string().trim().max(max), z.null()]).optional();

const dateOfBirth = z.union([z.literal(''), z.null(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD')])
  .optional()
  .refine((v) => {
    if (!v) return true;
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v && v >= '1900-01-01' && d.getTime() < Date.now();
  }, 'Enter a valid date of birth in the past');

export const profileSchema = z.object({
  displayName: z.string().trim().min(1, 'Display name is required').max(120).optional(),
  firstName: text(80),
  lastName: text(80),
  email: z.union([z.literal(''), z.string().trim().email('Enter a valid e-mail address').max(320)]).optional(),
  phone: z.union([z.null(), z.string()]).optional()
    .transform((v) => (v == null ? v : normalisePhone(v)))
    .refine((v) => !v || PH_PHONE.test(v), 'Enter a Philippine number, for example 0917 123 4567 or +63 2 8123 4567'),
  dateOfBirth,
  gender: z.union([z.literal(''), z.null(), z.enum(GENDERS)]).optional(),
  addressLine: text(200),
  barangay: text(120),
  city: text(120),
  province: text(120),
  zipCode: z.union([z.literal(''), z.null(), z.string().trim().regex(/^[A-Za-z0-9 -]{3,10}$/, 'Enter a valid ZIP / postal code')]).optional(),
  country: text(80),
}).superRefine((b, ctx) => {
  // A Philippine ZIP code has 4 digits (the country is the Philippines unless another one is given)
  const ph = !b.country || /^(philippines|ph)$/i.test(String(b.country).trim());
  if (b.zipCode && ph && !/^\d{4}$/.test(b.zipCode)) ctx.addIssue({ code: 'custom', path: ['zipCode'], message: 'A Philippine ZIP code has 4 digits' });
});

/** API field -> users column, for the fields a user may change on their own profile. */
const COLUMNS = {
  displayName: 'display_name', firstName: 'first_name', lastName: 'last_name', email: 'email', phone: 'phone',
  dateOfBirth: 'date_of_birth', gender: 'gender', addressLine: 'address_line', barangay: 'barangay', city: 'city',
  province: 'province', zipCode: 'zip_code', country: 'country',
};

export const emailEditable = async () => (await getSetting('security.profile_email_editable', false)) === true;

const isoDay = (d) => {
  if (!d) return null;
  if (typeof d === 'string') return d.slice(0, 10);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

/** The profile as GET /auth/profile returns it. */
export async function loadProfile(userId) {
  const r = await one(`
    SELECT u.id, u.username, u.display_name, u.first_name, u.last_name, u.email, u.phone, u.status, u.last_login_at,
           u.totp_enabled, u.employee_code, u.branch_code, u.department, u.designation, u.reporting_to,
           u.date_of_birth, u.gender, u.address_line, u.barangay, u.city, u.province, u.zip_code, u.country,
           b.name AS branch_name, m.display_name AS reporting_to_name, m.username AS reporting_to_username,
           COALESCE((SELECT array_agg(r.name ORDER BY r.name) FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id), '{}') AS role_names,
           COALESCE((SELECT array_agg(r.code ORDER BY r.name) FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id), '{}') AS role_codes,
           (SELECT h.at FROM login_history h WHERE h.user_id = u.id AND h.success ORDER BY h.at DESC, h.id DESC OFFSET 1 LIMIT 1) AS previous_login_at
    FROM users u
    LEFT JOIN branches b ON b.code = u.branch_code
    LEFT JOIN users m ON m.id = u.reporting_to
    WHERE u.id = $1`, [userId]);
  if (!r) return null;
  return {
    userId: r.id, username: r.username, displayName: r.display_name, firstName: r.first_name, lastName: r.last_name,
    email: r.email, phone: r.phone, status: r.status, lastLoginAt: r.last_login_at, previousLoginAt: r.previous_login_at,
    twoFactorEnabled: !!r.totp_enabled, employeeCode: r.employee_code, branchCode: r.branch_code, branchName: r.branch_name,
    department: r.department, designation: r.designation, reportingTo: r.reporting_to,
    reportingToName: r.reporting_to_name || r.reporting_to_username || null,
    roleCodes: r.role_codes, roleNames: r.role_names,
    dateOfBirth: isoDay(r.date_of_birth), gender: r.gender, addressLine: r.address_line, barangay: r.barangay, city: r.city,
    province: r.province, zipCode: r.zip_code, country: r.country,
    emailEditable: await emailEditable(),
  };
}

/** Save the fields present in `body` (an empty value clears an optional field). Returns the changed fields. */
export async function saveProfile(userId, body, username) {
  const sets = [];
  const params = [userId];
  const changed = {};
  for (const [field, column] of Object.entries(COLUMNS)) {
    if (body[field] === undefined) continue;
    const value = body[field] === '' ? null : body[field];
    params.push(value);
    sets.push(`${column} = $${params.length}`);
    changed[field] = value;
  }
  if (!sets.length) return changed;
  params.push(username);
  await query(`UPDATE users SET ${sets.join(', ')}, updated_by = $${params.length} WHERE id = $1`, params);
  return changed;
}

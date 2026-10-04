import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { BreadCrumb } from "primereact/breadcrumb";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { AutoComplete } from "primereact/autocomplete";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { Skeleton } from "primereact/skeleton";
import SvgDot from "../../assets/icons/SvgDot";
import InitialsAvatar from "../../agentModule/component/InitialsAvatar";
import { ChangePasswordDialog, TwoFactorDialog } from "../../agentModule/authModule/security/AccountSecurityDialogs";
import profileService from "../../services/profileService";
import addressService from "../../services/addressService";
import { calendarDateFormat, formatDate } from "../../utility/dateFormat";
import { notifyError, notifySuccess } from "../../utility/dialogs";
import { displayNameOf, roleLabel } from "../../utility/userIdentity";
import { DEFAULT_COUNTRY, GENDERS, formatPhone, isPhilippines, toFormValues, toPayload, validateProfile } from "./profileForm";
import "./index.scss";

const STATUS_CLASS = { active: "is-active", locked: "is-locked", inactive: "is-inactive" };

/** Names from an address picker response, for an editable drop-down (free text is still accepted). */
const namesOf = (result) => (result?.success && Array.isArray(result.data) ? result.data : []);

/** Label above, value or input below: the same field layout in view and edit mode. */
const Field = ({ id, label, required, hint, error, children, full }) => (
  <div className={`myprofile__field${full ? " is-full" : ""}`}>
    <label htmlFor={id} className="myprofile__label">
      {label}
      {required && <span className="myprofile__required" aria-hidden="true"> *</span>}
    </label>
    {children}
    {error ? (
      <small id={`${id}-error`} className="myprofile__error" role="alert">
        {error}
      </small>
    ) : hint ? (
      <small id={`${id}-hint`} className="myprofile__hint">
        {hint}
      </small>
    ) : null}
  </div>
);

const Value = ({ id, children }) => (
  <div id={id} className={`myprofile__value${children ? "" : " is-empty"}`}>
    {children || "—"}
  </div>
);

/**
 * My Profile (avatar menu > Profile): who the signed-in user is in the system (read-only: user ID, roles, branch,
 * designation, reporting line, status, last sign-in) and the personal, contact and address details they keep up to
 * date themselves (GET / PUT /auth/profile).
 */
const MyProfile = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState(toFormValues());
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [dialog, setDialog] = useState("");
  const [countries, setCountries] = useState([]);
  const [regions, setRegions] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [cities, setCities] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [suggestions, setSuggestions] = useState({});

  const load = useCallback(() => {
    setLoadError("");
    profileService
      .getProfile()
      .then((p) => {
        setProfile(p);
        setValues(toFormValues(p));
      })
      .catch((e) => setLoadError(e.message || t("myProfile.loadFailed")));
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  // Address pickers (edit mode): country -> region -> province -> city / municipality -> barangay
  useEffect(() => {
    if (!editing) return;
    addressService.getCountries().then((r) => setCountries(namesOf(r)));
  }, [editing]);
  useEffect(() => {
    if (!editing) return;
    addressService.getRegionsByCountry(values.country || DEFAULT_COUNTRY).then((r) => setRegions(namesOf(r)));
  }, [editing, values.country]);
  useEffect(() => {
    if (!editing) return;
    addressService.getProvincesByCountry(values.country || DEFAULT_COUNTRY).then((r) => setProvinces(namesOf(r)));
  }, [editing, values.country]);
  useEffect(() => {
    if (!editing || !values.province) return setCities([]);
    addressService.getCitiesByProvince(values.province).then((r) => setCities(namesOf(r)));
    return undefined;
  }, [editing, values.province]);
  useEffect(() => {
    if (!editing || !values.city) return setBarangays([]);
    addressService.getBarangaysByCity(values.city).then((r) => setBarangays(namesOf(r)));
    return undefined;
  }, [editing, values.city]);

  const set = (field) => (e) => {
    const value = e && e.target !== undefined ? e.target.value : e?.value !== undefined ? e.value : e;
    setValues((v) => ({ ...v, [field]: value ?? "" }));
    if (errors[field]) setErrors((x) => ({ ...x, [field]: undefined }));
  };

  // choosing a province fills its region; choosing a city fills its region (Isabela City: Region IX) and suggests its ZIP code
  const onProvince = (e) => {
    const name = e.value ?? "";
    const match = provinces.find((p) => p.name === name);
    setValues((v) => ({ ...v, province: name, region: match?.regionName || v.region }));
  };
  const onCity = (e) => {
    const name = e.value ?? "";
    const match = cities.find((c) => c.name === name);
    setValues((v) => ({ ...v, city: name, region: match?.regionName || v.region, zipCode: match?.zipCode && !v.zipCode ? match.zipCode : v.zipCode }));
  };

  const onBarangay = (e) => {
    const name = e.value ?? "";
    const match = barangays.find((b) => b.name === name);
    setValues((v) => ({ ...v, barangay: name, zipCode: match?.postalCode && !v.zipCode ? match.postalCode : v.zipCode }));
  };

  const emailEditable = !!profile?.emailEditable;

  const startEdit = () => {
    setValues(toFormValues(profile));
    setErrors({});
    setEditing(true);
  };
  const cancel = () => {
    setValues(toFormValues(profile));
    setErrors({});
    setEditing(false);
  };

  const save = async (e) => {
    e?.preventDefault();
    const found = validateProfile(values, { emailEditable });
    if (Object.keys(found).length) {
      setErrors(Object.fromEntries(Object.entries(found).map(([k, key]) => [k, t(`myProfile.errors.${key}`)])));
      return;
    }
    setSaving(true);
    try {
      const saved = await profileService.updateProfile(toPayload(values, { emailEditable }));
      setProfile(saved);
      setValues(toFormValues(saved));
      setEditing(false);
      notifySuccess(t("myProfile.saved"));
    } catch (err) {
      if (err.errors?.length) setErrors(Object.fromEntries(err.errors.map((x) => [x.path, x.message])));
      notifyError(err.message || t("myProfile.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const genderOptions = useMemo(() => GENDERS.map((g) => ({ value: g, label: t(`myProfile.genders.${g}`) })), [t]);
  const genderText = (g) => (g ? t(`myProfile.genders.${g}`, { defaultValue: g }) : "");

  const breadcrumb = (
    <BreadCrumb
      home={{ label: t("myProfile.home"), command: () => navigate("/") }}
      model={[{ label: t("myProfile.myAccount") }, { label: t("myProfile.title") }]}
      separatorIcon={<SvgDot color={"#000"} />}
      className="myprofile__breadcrumb"
    />
  );

  if (loadError) {
    return (
      <div className="myprofile">
        <h1 className="page-title">{t("myProfile.title")}</h1>
        {breadcrumb}
        <div className="myprofile__card myprofile__load-error" role="alert">
          <span>{loadError}</span>
          <Button type="button" label={t("myProfile.retry")} className="p-button-outlined p-button-sm" onClick={load} />
        </div>
      </div>
    );
  }

  const roles = profile ? (profile.roleNames?.length ? profile.roleNames : (profile.roles || []).map(roleLabel)) : [];
  const lastSignIn = profile ? profile.previousLoginAt || profile.lastLoginAt : null;
  const facts = profile
    ? [
        ["role", roles.length > 1 ? t("myProfile.roles") : t("myProfile.role"), roles.join(", ")],
        ["branch", t("myProfile.branch"), profile.branchName ? `${profile.branchName}${profile.branchCode ? ` (${profile.branchCode})` : ""}` : profile.branchCode],
        ["designation", t("myProfile.designation"), profile.designation],
        ["reportingTo", t("myProfile.reportingTo"), profile.reportingToName],
        ["email", t("myProfile.email"), profile.email],
        ["lastSignIn", t("myProfile.lastSignIn"), lastSignIn ? formatDate(lastSignIn, { withTime: true }) : t("myProfile.firstSignIn")],
      ]
    : [];

  const view = (field) => {
    if (field === "dateOfBirth") return profile?.dateOfBirth ? formatDate(profile.dateOfBirth) : "";
    if (field === "gender") return genderText(profile?.gender);
    if (field === "phone") return formatPhone(profile?.phone);
    if (field === "country") return profile?.country || "";
    return profile?.[field] || "";
  };

  const errorProps = (id, field) => ({
    id,
    "aria-invalid": errors[field] ? true : undefined,
    "aria-describedby": errors[field] ? `${id}-error` : undefined,
    className: `w-full${errors[field] ? " p-invalid" : ""}`,
  });

  const text = (field, label, { required, hint, inputProps = {}, readOnly } = {}) => {
    const id = `mp-${field}`;
    return (
      <Field id={id} label={label} required={editing && !readOnly && required} hint={editing ? hint : undefined} error={editing ? errors[field] : undefined}>
        {editing && !readOnly ? (
          <InputText value={values[field]} onChange={set(field)} {...errorProps(id, field)} {...inputProps} />
        ) : (
          <Value id={id}>{view(field)}</Value>
        )}
      </Field>
    );
  };

  /** Address field with suggestions from the address masters; any other value can be typed. */
  const picker = (field, label, options, { onChange } = {}) => {
    const id = `mp-${field}`;
    const names = options.map((x) => x.name);
    return (
      <Field id={id} label={label} error={editing ? errors[field] : undefined}>
        {editing ? (
          <AutoComplete
            inputId={id}
            value={values[field]}
            suggestions={suggestions[field] || []}
            completeMethod={(e) => {
              const q = String(e.query || "").trim().toLowerCase();
              setSuggestions((x) => ({ ...x, [field]: q ? names.filter((n) => n.toLowerCase().includes(q)) : [...names] }));
            }}
            onChange={(e) => (onChange || set(field))({ value: typeof e.value === "string" ? e.value : e.value?.name ?? "" })}
            dropdown
            dropdownAriaLabel={t("myProfile.showOptions", { field: label })}
            maxLength={120}
            className={`w-full${errors[field] ? " p-invalid" : ""}`}
            inputClassName="w-full"
            aria-invalid={errors[field] ? true : undefined}
          />
        ) : (
          <Value id={id}>{view(field)}</Value>
        )}
      </Field>
    );
  };

  return (
    <div className="myprofile">
      <div className="myprofile__header">
        <div>
          <h1 className="page-title">{t("myProfile.title")}</h1>
          {breadcrumb}
        </div>
      </div>

      {/* Identity and access: read-only, maintained in User Management */}
      <section className="myprofile__card myprofile__summary" aria-label={t("myProfile.accountSummary")}>
        {!profile ? (
          <div className="myprofile__summary-main">
            <Skeleton shape="circle" size="64px" />
            <div className="flex-1">
              <Skeleton width="14rem" height="1.5rem" className="mb-2" />
              <Skeleton width="9rem" height="1rem" />
            </div>
          </div>
        ) : (
          <>
            <div className="myprofile__summary-main">
              <InitialsAvatar person={profile} size="64px" />
              <div className="myprofile__identity">
                <div className="myprofile__name-row">
                  <h2 className="myprofile__name">{displayNameOf(profile)}</h2>
                  <span className={`myprofile__status ${STATUS_CLASS[profile.status] || ""}`}>
                    {t(`myProfile.status.${profile.status}`, { defaultValue: profile.status })}
                  </span>
                </div>
                <div className="myprofile__userid">
                  {t("myProfile.userId")}: <strong>{profile.username}</strong>
                  {profile.employeeCode ? (
                    <>
                      <span className="myprofile__sep" aria-hidden="true">|</span>
                      {t("myProfile.employeeNo")}: <strong>{profile.employeeCode}</strong>
                    </>
                  ) : null}
                </div>
              </div>
              <div className="myprofile__summary-actions">
                <Button type="button" icon="pi pi-key" label={t("security.changePassword")} className="p-button-outlined p-button-secondary p-button-sm" onClick={() => setDialog("password")} />
                <Button type="button" icon="pi pi-shield" label={t("myProfile.twoStep")} className="p-button-outlined p-button-secondary p-button-sm" onClick={() => setDialog("2fa")} />
              </div>
            </div>
            <dl className="myprofile__facts">
              {facts.map(([key, label, value]) => (
                <div key={key} className="myprofile__fact">
                  <dt>{label}</dt>
                  <dd className={value ? "" : "is-empty"}>{value || t("myProfile.notAssigned")}</dd>
                </div>
              ))}
            </dl>
            <p className="myprofile__note">
              <i className="pi pi-info-circle" aria-hidden="true" /> {t("myProfile.managedNote")}
            </p>
          </>
        )}
      </section>

      {/* Personal, contact and address details: the user keeps these up to date */}
      <form className="myprofile__card myprofile__details" onSubmit={save} noValidate aria-busy={saving || undefined}>
        <div className="myprofile__card-head">
          <div>
            <h2 className="myprofile__card-title">{t("myProfile.detailsTitle")}</h2>
            <p className="myprofile__card-sub">{editing ? t("myProfile.editingHelp") : t("myProfile.detailsHelp")}</p>
          </div>
          {!editing && profile && <Button type="button" icon="pi pi-pencil" label={t("myProfile.editProfile")} onClick={startEdit} />}
        </div>

        {!profile ? (
          <div className="myprofile__grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="myprofile__field">
                <Skeleton width="6rem" height="0.8rem" className="mb-2" />
                <Skeleton height="2.5rem" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <h3 className="myprofile__section">{t("myProfile.personal")}</h3>
            <div className="myprofile__grid">
              {text("firstName", t("myProfile.firstName"), { required: true, inputProps: { autoComplete: "given-name", maxLength: 80 } })}
              {text("lastName", t("myProfile.lastName"), { inputProps: { autoComplete: "family-name", maxLength: 80 } })}
              {text("displayName", t("myProfile.displayName"), { required: true, hint: t("myProfile.displayNameHint"), inputProps: { maxLength: 120 } })}
              <Field id="mp-employee" label={t("myProfile.employeeNo")} hint={editing ? t("myProfile.readOnlyHint") : undefined}>
                <Value id="mp-employee">{profile.employeeCode}</Value>
              </Field>
              <Field id="mp-dateOfBirth" label={t("myProfile.dateOfBirth")} error={editing ? errors.dateOfBirth : undefined}>
                {editing ? (
                  <Calendar
                    inputId="mp-dateOfBirth"
                    value={values.dateOfBirth}
                    onChange={set("dateOfBirth")}
                    dateFormat={calendarDateFormat()}
                    maxDate={new Date()}
                    showIcon
                    showButtonBar
                    yearNavigator
                    monthNavigator
                    yearRange={`1930:${new Date().getFullYear()}`}
                    viewDate={values.dateOfBirth || new Date(1990, 0, 1)}
                    className={`w-full${errors.dateOfBirth ? " p-invalid" : ""}`}
                    inputClassName="w-full"
                  />
                ) : (
                  <Value id="mp-dateOfBirth">{view("dateOfBirth")}</Value>
                )}
              </Field>
              <Field id="mp-gender" label={t("myProfile.gender")}>
                {editing ? (
                  <Dropdown inputId="mp-gender" value={values.gender} options={genderOptions} onChange={set("gender")} placeholder={t("myProfile.select")} showClear className="w-full" />
                ) : (
                  <Value id="mp-gender">{view("gender")}</Value>
                )}
              </Field>
            </div>

            <h3 className="myprofile__section">{t("myProfile.contact")}</h3>
            <div className="myprofile__grid">
              <Field
                id="mp-email"
                label={t("myProfile.email")}
                required={editing && emailEditable}
                hint={editing && !emailEditable ? t("myProfile.emailManaged") : undefined}
                error={editing ? errors.email : undefined}
              >
                {editing && emailEditable ? (
                  <InputText type="email" value={values.email} onChange={set("email")} autoComplete="email" {...errorProps("mp-email", "email")} />
                ) : (
                  <Value id="mp-email">{profile.email}</Value>
                )}
              </Field>
              {text("phone", t("myProfile.contactNumber"), {
                hint: t("myProfile.phoneHint"),
                inputProps: { type: "tel", inputMode: "tel", autoComplete: "tel", maxLength: 20, placeholder: "0917 123 4567", onBlur: () => setValues((v) => ({ ...v, phone: formatPhone(v.phone) })) },
              })}
            </div>

            <h3 className="myprofile__section">{t("myProfile.address")}</h3>
            <div className="myprofile__grid">
              {text("addressLine", t("myProfile.houseNoStreet"), { inputProps: { autoComplete: "address-line1", maxLength: 200 } })}
              {picker("barangay", t("myProfile.barangay"), barangays, { onChange: onBarangay })}
              {picker("city", t("myProfile.city"), cities, { onChange: onCity })}
              {picker("province", t("myProfile.province"), provinces, { onChange: onProvince })}
              {picker("region", t("myProfile.region"), regions)}
              {text("zipCode", t("myProfile.zipCode"), {
                inputProps: { inputMode: isPhilippines(values.country) ? "numeric" : "text", autoComplete: "postal-code", maxLength: isPhilippines(values.country) ? 4 : 10 },
              })}
              {picker("country", t("myProfile.country"), countries.length ? countries : [{ name: DEFAULT_COUNTRY }])}
            </div>
          </>
        )}

        {editing && (
          <div className="myprofile__actions">
            <Button type="button" label={t("myProfile.cancel")} className="p-button-outlined p-button-secondary" onClick={cancel} disabled={saving} />
            <Button type="submit" icon="pi pi-check" label={t("myProfile.save")} loading={saving} disabled={saving} />
          </div>
        )}
      </form>

      <ChangePasswordDialog visible={dialog === "password"} onHide={() => setDialog("")} />
      <TwoFactorDialog visible={dialog === "2fa"} onHide={() => setDialog("")} />
    </div>
  );
};

export default MyProfile;

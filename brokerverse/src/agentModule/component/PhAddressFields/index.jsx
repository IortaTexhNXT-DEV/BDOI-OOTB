import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import InputTextField from "../inputText";
import DropdownField from "../DropdownField";
import addressService from "../../../services/addressService";
import { addressOptionsWithSaved, findAddressItem, isPhilippines } from "../../../utility/addressHelpers";

/** Form field of each part of the address (override the names a form uses). */
export const PH_ADDRESS_NAMES = {
  country: "Country",
  region: "Region",
  province: "Province",
  city: "City",
  barangay: "Barangay",
  houseNo: "HouseNo",
  street: "Street",
  zipCode: "ZIPCode",
};

const useList = (load, key) => {
  const [items, setItems] = useState([]);
  useEffect(() => {
    if (!key) {
      setItems([]);
      return undefined;
    }
    let cancelled = false;
    load(key).then((res) => {
      if (!cancelled) setItems(res?.success && Array.isArray(res.data) ? res.data : []);
    });
    return () => {
      cancelled = true;
    };
  }, [load, key]);
  return items;
};

const loadRegions = (country) => addressService.getRegionsByCountry(country);
const loadProvinces = (country) => addressService.getProvincesByCountry(country);
const loadCities = (province) => addressService.getCitiesByProvince(province);
const loadBarangays = (city) => addressService.getBarangaysByCity(city);

/**
 * Philippine address block (House / Unit No., Street, Barangay, City / Municipality, Province, Region, ZIP code) with
 * the cascade Region -> Province -> City / Municipality -> Barangay of the PSGC masters. Choosing a province fills its
 * region, choosing a city suggests its ZIP code, a ZIP code typed first fills the city, province and region. The
 * barangay is a list when the city's barangays are loaded and free text otherwise. Another country takes free text.
 *
 * Props: formik (values, setFieldValue, handleChange, errors, touched), names (form field per address part, defaults
 * PH_ADDRESS_NAMES), showCountry (default true), disabled, required ({ part: true }), cols (grid class of a field).
 */
function PhAddressFields({ formik, names: namesProp, showCountry = true, disabled = false, required = {}, cols = "col-12 md:col-6 lg:col-6" }) {
  const { t } = useTranslation();
  const names = useMemo(() => ({ ...PH_ADDRESS_NAMES, ...(namesProp || {}) }), [namesProp]);
  const value = (part) => formik.values?.[names[part]] ?? "";
  const set = useCallback((part, v) => formik.setFieldValue(names[part], v ?? ""), [formik, names]);
  const zipSuggested = useRef("");
  const [countries, setCountries] = useState([]);

  useEffect(() => {
    if (!showCountry) return undefined;
    let cancelled = false;
    addressService.getCountries().then((res) => {
      if (!cancelled && res.success) setCountries(Array.isArray(res.data) ? res.data : []);
    });
    return () => {
      cancelled = true;
    };
  }, [showCountry]);

  const country = value("country") || (showCountry ? "" : "Philippines");
  const ph = !country || isPhilippines(country);
  const countryKey = ph ? "PH" : findAddressItem(countries, country)?.id || "";

  const regions = useList(loadRegions, ph ? "PH" : "");
  const allProvinces = useList(loadProvinces, countryKey);
  const region = findAddressItem(regions, value("region"));
  const provinces = useMemo(
    () => (ph && region ? allProvinces.filter((p) => p.regionId === region.id) : allProvinces),
    [ph, region, allProvinces]
  );
  const province = findAddressItem(allProvinces, value("province"));
  const cities = useList(loadCities, province?.id || "");
  const city = findAddressItem(cities, value("city"));
  const barangays = useList(loadBarangays, city?.id || "");

  // a saved value written differently ("Makati" for "Makati City") is shown under its master name
  useEffect(() => {
    if (province && value("province") && province.name !== value("province")) set("province", province.name);
    if (city && value("city") && city.name !== value("city")) set("city", city.name);
    if (ph && !value("region") && (city?.regionName || province?.regionName)) set("region", city?.regionName || province?.regionName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [province?.id, city?.id]);

  const onCountry = (v) => {
    set("country", v);
    ["region", "province", "city", "barangay"].forEach((p) => set(p, ""));
  };
  const onRegion = (v) => {
    set("region", v);
    const r = findAddressItem(regions, v);
    if (province && r && province.regionId !== r.id) ["province", "city", "barangay"].forEach((p) => set(p, ""));
  };
  const onProvince = (v) => {
    set("province", v);
    set("city", "");
    set("barangay", "");
    const p = findAddressItem(allProvinces, v);
    if (p?.regionName) set("region", p.regionName);
  };
  const onCity = (v) => {
    set("city", v);
    set("barangay", "");
    const c = findAddressItem(cities, v);
    if (c?.regionName) set("region", c.regionName);
    const zip = String(value("zipCode") || "").trim();
    if (c?.zipCode && (!zip || zip === zipSuggested.current)) {
      zipSuggested.current = c.zipCode;
      set("zipCode", c.zipCode);
    }
  };
  // a ZIP code typed before the city fills the city, province and region
  const onZipBlur = async () => {
    const zip = String(value("zipCode") || "").trim();
    if (!ph || !/^\d{4}$/.test(zip) || value("city")) return;
    const res = await addressService.getPostalCodeLookup("PH", zip);
    const hit = res.success && Array.isArray(res.data) ? res.data[0] : null;
    if (!hit) return;
    if (hit.region) set("region", hit.region);
    set("province", hit.province || "");
    set("city", hit.city || "");
    zipSuggested.current = zip;
  };

  const error = (part) => (formik.touched?.[names[part]] && formik.errors?.[names[part]] ? formik.errors[names[part]] : null);
  const label = (key, part) => `${t(key)}${required[part] ? "*" : ""}`;
  const errorText = (part) =>
    error(part) ? (
      <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-2">
        {error(part)}
      </div>
    ) : null;
  const text = (part, key, extra = {}) => (
    <div className={cols}>
      <InputTextField label={label(key, part)} value={value(part)} onChange={(e) => set(part, e.target.value)} disabled={disabled} {...extra} />
      {errorText(part)}
    </div>
  );
  const list = (part, key, items, onChange, extra = {}) => (
    <div className={cols}>
      <DropdownField
        label={label(key, part)}
        value={value(part)}
        options={addressOptionsWithSaved(items, value(part))}
        onChange={(e) => onChange(e.value)}
        disabled={disabled || extra.disabled}
        filter={items.length > 10}
      />
      {errorText(part)}
    </div>
  );

  return (
    <>
      <div className="grid mt-2">
        {showCountry && list("country", "address.country", countries, onCountry)}
        {text("zipCode", "address.zipCode", { onBlur: onZipBlur, keyfilter: ph ? "int" : undefined, maxLength: ph ? 4 : 10 })}
      </div>
      <div className="grid mt-2">
        {ph && list("region", "address.region", regions, onRegion)}
        {allProvinces.length ? list("province", "address.province", provinces, onProvince) : text("province", "address.province")}
      </div>
      <div className="grid mt-2">
        {cities.length || (ph && province) ? list("city", "address.cityMunicipality", cities, onCity, { disabled: !province }) : text("city", "address.cityMunicipality")}
        {barangays.length ? (
          <div className={cols}>
            <DropdownField
              label={label("address.barangay", "barangay")}
              value={value("barangay")}
              options={addressOptionsWithSaved(barangays, value("barangay"))}
              onChange={(e) => set("barangay", e.value)}
              disabled={disabled}
              filter
              editable
            />
            {errorText("barangay")}
          </div>
        ) : (
          text("barangay", "address.barangay")
        )}
      </div>
      <div className="grid mt-2">
        {text("houseNo", "address.houseUnitNo")}
        {text("street", "address.street")}
      </div>
    </>
  );
}

export default PhAddressFields;

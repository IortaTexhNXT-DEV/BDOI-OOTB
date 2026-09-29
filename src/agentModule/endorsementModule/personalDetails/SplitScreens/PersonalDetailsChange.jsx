import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import InputTextField from "../../../component/inputText";
import DropdownField from "../../../component/DropdwonField";
import { useFormik } from "formik";
import addressService from "../../../../services/addressService";
import {
  addFallbackOption,
  isThailand,
  normalizeCountryName,
  toAddressOptions,
} from "../../../../utility/addressHelpers";

const initialValue = {
  CompanyName: "",
  TaxNumber: "",
  FirstName: "",
  LastName: "",
  PreferredName: "",
  EmailID: "",
  ContactNumber: "",
  HouseNo: "",
  Barangay: "",
  Country: "",
  Province: "",
  City: "",
  ZIPCode: "",
  DateofBirth: "",
};

const mapPersonalDetailsToInitialValues = (details) => ({
  ...initialValue,
  CompanyName: details?.CompanyName ?? "",
  TaxNumber: details?.TaxNumber ?? "",
  FirstName: details?.FirstName ?? "",
  LastName: details?.LastName ?? "",
  PreferredName: details?.PreferredName ?? "",
  EmailID: details?.EmailID ?? "",
  ContactNumber: details?.ContactNumber ?? "",
  HouseNo: details?.HouseNo ?? "",
  Barangay: details?.Barangay ?? "",
  Country: normalizeCountryName(details?.Country ?? ""),
  Province: details?.Province ?? "",
  City: details?.City ?? "",
  ZIPCode: details?.ZIPCode ?? "",
  DateofBirth: details?.DateofBirth ?? "",
});

const PersonalDetailsChange = ({
  index,
  disabled,
  shouldSubmit,
  onSectionSubmitted,
  personalDetails,
}) => {
  const { t } = useTranslation();
  const formikInitialValues = useMemo(
    () => mapPersonalDetailsToInitialValues(personalDetails),
    [personalDetails]
  );

  const [countryList, setCountryList] = useState([]);
  const [provinceList, setProvinceList] = useState([]);
  const [cityList, setCityList] = useState([]);
  const [districtList, setDistrictList] = useState([]);

  const formik = useFormik({
    initialValues: formikInitialValues,
    enableReinitialize: true,
    onSubmit: (values) => {
      onSectionSubmitted?.(index, values);
    },
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await addressService.getCountries();
      if (!cancelled && res.success && res.data) {
        setCountryList(Array.isArray(res.data) ? res.data : []);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedCountryId = countryList.find(
    (c) =>
      (c.name || c.code) === formik.values.Country ||
      c.id === formik.values.Country
  )?.id;
  const selectedProvinceId = provinceList.find(
    (p) =>
      (p.name || p.code) === formik.values.Province ||
      p.id === formik.values.Province
  )?.id;
  const selectedCityId = cityList.find(
    (c) =>
      (c.name || c.code) === formik.values.City || c.id === formik.values.City
  )?.id;

  useEffect(() => {
    if (!selectedCountryId) {
      setProvinceList([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await addressService.getProvincesByCountry(selectedCountryId);
      if (!cancelled && res.success && res.data) {
        setProvinceList(Array.isArray(res.data) ? res.data : []);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCountryId]);

  useEffect(() => {
    if (!selectedProvinceId) {
      setCityList([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await addressService.getCitiesByProvince(selectedProvinceId);
      if (!cancelled && res.success && res.data) {
        setCityList(Array.isArray(res.data) ? res.data : []);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedProvinceId]);

  useEffect(() => {
    if (!selectedCityId || !isThailand(formik.values.Country)) {
      setDistrictList([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await addressService.getDistrictsByCity(selectedCityId);
      if (!cancelled && res.success && res.data) {
        setDistrictList(Array.isArray(res.data) ? res.data : []);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCityId, formik.values.Country]);

  const countryOptions = useMemo(
    () =>
      addFallbackOption(formik.values.Country, toAddressOptions(countryList)),
    [countryList, formik.values.Country]
  );
  const provinceOptions = useMemo(
    () =>
      addFallbackOption(formik.values.Province, toAddressOptions(provinceList)),
    [provinceList, formik.values.Province]
  );
  const cityOptions = useMemo(
    () => addFallbackOption(formik.values.City, toAddressOptions(cityList)),
    [cityList, formik.values.City]
  );
  const districtOptions = useMemo(
    () => toAddressOptions(districtList),
    [districtList]
  );

  useEffect(() => {
    if (!shouldSubmit) {
      return;
    }

    formik.submitForm();
  }, [formik, shouldSubmit]);

  return (
    <div>
      <div className="customer__info__subtitle mt-2 mb-2">
        {t("endorsement.personalDetailsChange")}
      </div>
      <div className="grid">
        <div className="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <InputTextField
            label={t("endorsement.firstName")}
            disabled={disabled}
            value={formik.values.FirstName}
            onChange={formik.handleChange("FirstName")}
            error={formik.touched.FirstName && formik.errors.FirstName}
          />
        </div>
        <div className="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <InputTextField
            label={t("endorsement.lastName")}
            disabled={disabled}
            value={formik.values.LastName}
            onChange={formik.handleChange("LastName")}
            error={formik.touched.LastName && formik.errors.LastName}
          />
        </div>
        <div className="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <InputTextField
            label={t("endorsement.preferredName")}
            disabled={disabled}
            value={formik.values.PreferredName}
            onChange={formik.handleChange("PreferredName")}
            error={formik.touched.PreferredName && formik.errors.PreferredName}
          />
        </div>
        <div className="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <InputTextField
            label={t("endorsement.contactNumber")}
            disabled={disabled}
            value={formik.values.ContactNumber}
            onChange={formik.handleChange("ContactNumber")}
            error={formik.touched.ContactNumber && formik.errors.ContactNumber}
          />
        </div>
        <div className="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <InputTextField
            disabled={disabled}
            label={t("endorsement.houseNoStreet")}
            value={formik.values.HouseNo}
            onChange={formik.handleChange("HouseNo")}
            error={formik.touched.HouseNo && formik.errors.HouseNo}
          />
        </div>
        <div className="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          {isThailand(formik.values.Country) && districtOptions.length > 0 ? (
            <DropdownField
              label={t("leadCreation.subDistrictTambon")}
              disabled={disabled || !formik.values.City}
              value={formik.values.Barangay}
              options={districtOptions}
              onChange={(e) => formik.setFieldValue("Barangay", e.value)}
              error={formik.touched.Barangay && formik.errors.Barangay}
            />
          ) : (
            <InputTextField
              disabled={disabled}
              label={
                isThailand(formik.values.Country)
                  ? t("leadCreation.subDistrictTambon")
                  : t("endorsement.barangaySubd")
              }
              value={formik.values.Barangay}
              onChange={formik.handleChange("Barangay")}
              error={formik.touched.Barangay && formik.errors.Barangay}
            />
          )}
        </div>
        <div className="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <DropdownField
            label={t("endorsement.country")}
            disabled={disabled}
            value={formik.values.Country}
            options={countryOptions}
            onChange={(e) => {
              formik.setFieldValue("Country", e.value);
              formik.setFieldValue("Province", "");
              formik.setFieldValue("City", "");
              formik.setFieldValue("Barangay", "");
              formik.setFieldValue("ZIPCode", "");
            }}
            error={formik.touched.Country && formik.errors.Country}
          />
        </div>
        <div className="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <DropdownField
            label={
              isThailand(formik.values.Country)
                ? t("leadCreation.provinceChangwat")
                : t("endorsement.province")
            }
            disabled={disabled || !formik.values.Country}
            value={formik.values.Province}
            options={provinceOptions}
            onChange={(e) => {
              formik.setFieldValue("Province", e.value);
              formik.setFieldValue("City", "");
              formik.setFieldValue("Barangay", "");
            }}
            error={formik.touched.Province && formik.errors.Province}
          />
        </div>
        <div className="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <DropdownField
            label={
              isThailand(formik.values.Country)
                ? t("leadCreation.districtAmphoe")
                : t("endorsement.city")
            }
            disabled={disabled || !formik.values.Province}
            value={formik.values.City}
            options={cityOptions}
            onChange={(e) => {
              formik.setFieldValue("City", e.value);
              formik.setFieldValue("Barangay", "");
            }}
            error={formik.touched.City && formik.errors.City}
          />
        </div>
        <div className="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <InputTextField
            label={
              isThailand(formik.values.Country)
                ? t("leadCreation.postalCode")
                : t("endorsement.zipCode")
            }
            disabled={disabled}
            value={formik.values.ZIPCode}
            onChange={formik.handleChange("ZIPCode")}
            error={formik.touched.ZIPCode && formik.errors.ZIPCode}
          />
        </div>
      </div>
    </div>
  );
};

export default PersonalDetailsChange;

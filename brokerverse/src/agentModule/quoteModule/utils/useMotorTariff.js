import { useEffect, useState } from "react";
import quotationService from "../../../services/quotationService";

const EMPTY = { templateCode: null, vehicleTypes: [], appa: { limits: [], ratePercent: 0 } };

const slug = (s) =>
  String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

/** Vehicle class of a stored value (class code, or the label older quotes saved); null when unknown. */
export const findVehicleClass = (tariff, value) => {
  if (!value) return null;
  const s = slug(value);
  return (
    (tariff?.vehicleTypes || []).find(
      (t) => t.value === value || t.value === s || slug(t.label) === s
    ) || null
  );
};

/** Auto Passenger PA: total cover and premium for a per-person limit and number of seats. */
export const appaFigures = (tariff, perPerson, seats) => {
  const limit = Number(String(perPerson ?? "").replace(/[^0-9.]/g, "")) || 0;
  const n = Number(seats) || 0;
  const total = limit * n;
  const premium = (total * (Number(tariff?.appa?.ratePercent) || 0)) / 100;
  return { total: total.toFixed(2), premium: premium.toFixed(2) };
};

/**
 * Motor tariff from GET /quotations/motor-tariff (Product Configurator): vehicle classes with the fixed CTPL
 * premium, own damage rate and default seats, and the Auto Passenger PA limits and rate. The server applies the same
 * tariff when it prices the quote.
 */
const useMotorTariff = () => {
  const [tariff, setTariff] = useState(EMPTY);

  useEffect(() => {
    let active = true;
    quotationService
      .getMotorTariff()
      .then((loaded) => active && setTariff({ ...EMPTY, ...loaded }))
      .catch(() => active && setTariff(EMPTY));
    return () => {
      active = false;
    };
  }, []);

  return tariff;
};

export default useMotorTariff;

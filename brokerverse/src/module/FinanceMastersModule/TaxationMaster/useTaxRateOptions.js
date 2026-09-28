import { useEffect, useState } from "react";
import systemSettingsService from "../../../services/systemSettingsService";

const toPercent = (fraction) => Math.round(Number(fraction) * 10000) / 100;

/** Tax rate dropdown options (percent values) from the tax configuration (GET /settings?group=tax). */
const useTaxRateOptions = () => {
  const [options, setOptions] = useState([]);

  useEffect(() => {
    let cancelled = false;
    systemSettingsService
      .getConfiguration("tax")
      .then((items) => {
        const byRate = new Map();
        items
          .filter((item) => item.type === "number")
          .forEach((item) => {
            const rate = toPercent(item.value);
            const label = byRate.has(rate) ? `${byRate.get(rate).label}, ${item.label}` : `${rate}% - ${item.label}`;
            byRate.set(rate, { label, value: rate, name: `${rate}%` });
          });
        if (!cancelled) setOptions([...byRate.values()]);
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return options;
};

export default useTaxRateOptions;

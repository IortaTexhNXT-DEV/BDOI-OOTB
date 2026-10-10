import { createContext, useContext, useEffect, useState } from "react";
import brandingService from "../../services/brandingService";

/**
 * The letterhead of printed pages (GET /document-templates/letterhead: company, address, TIN, licence, contact, the
 * print logo and the documents section of the theme), loaded once per session.
 */
let pending = null;

export const loadLetterhead = () => {
  if (!pending) {
    pending = brandingService.letterhead().catch((e) => {
      pending = null;
      throw e;
    });
  }
  return pending;
};

/** Set by printView: the letterhead it loaded before rendering (null when it could not be loaded). */
export const LetterheadContext = createContext(undefined);

/** The letterhead given, else the one printView provides, else loaded here (a preview on screen). */
export const useLetterhead = (given) => {
  const provided = useContext(LetterheadContext);
  const known = given !== undefined ? given : provided;
  const [loaded, setLoaded] = useState(null);
  useEffect(() => {
    if (known !== undefined) return undefined;
    let live = true;
    loadLetterhead()
      .then((lh) => {
        if (live) setLoaded(lh);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [known]);
  return known !== undefined ? known : loaded;
};

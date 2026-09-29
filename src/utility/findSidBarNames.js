const findNamesByPath = (logs, path, result = [], currentNames = []) => {
  if (!logs || !Array.isArray(logs)) return result;

  const processedPath = path?.replace(/\d+/g, "") || "";

  logs.forEach((dat) => {
    if (!dat) return;

    // Push the current name to the array for the current level
    currentNames.push(dat.name);

    if (Array.isArray(dat?.submenu) && dat.submenu.length > 0) {
      // If this item has submenu, recursively check submenu items
      const resultLengthBefore = result.length;
      findNamesByPath(dat.submenu, path, result, currentNames);
      // If a submenu item matched, ensure this parent name is also in result
      if (result.length > resultLengthBefore && !result.includes(dat.name)) {
        result.push(dat.name);
      }
    } else {
      // This is a leaf node - check if it matches the path
      if (dat.includes && Array.isArray(dat.includes)) {
        // Check specific includes first (excluding "/")
        const specificIncludes = dat.includes.filter((inc) => inc !== "/");
        const hasGenericRoot = dat.includes.includes("/");

        let matches = false;

        // Check specific includes
        if (specificIncludes.length > 0) {
          matches = specificIncludes.some((inc) => {
            return processedPath.startsWith(inc);
          });
        }

        // Only check "/" if path is exactly "/" and no specific match found
        if (!matches && hasGenericRoot && processedPath === "/") {
          matches = true;
        }

        // If this item matches, add all names in the hierarchy to result
        if (matches) {
          currentNames.forEach((name) => {
            if (!result.includes(name)) {
              result.push(name);
            }
          });
        }
      }
    }

    // Pop the last name to backtrack when moving up to the parent level
    currentNames.pop();
  });

  return result;
};

export default findNamesByPath;

export const patchMethod = (obj, key, replacement) => {
  const original = obj[key];
  obj[key] = replacement;
  return () => {
    obj[key] = original;
  };
};

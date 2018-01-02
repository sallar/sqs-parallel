export function times(count: number, fn: any) {
  return Array(count)
    .fill(null)
    .forEach((_, index) => fn(index));
}

export function jsonParse(str: string) {
  let obj;
  try {
    obj = JSON.parse(str);
  } catch (err) {}
  return obj;
}

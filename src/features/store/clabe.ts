export function isValidClabe(value: string) {
  if (!/^\d{18}$/.test(value)) return false;

  const weights = [3, 7, 1] as const;
  const sum = [...value.slice(0, 17)].reduce(
    (total, digit, index) => total + (Number(digit) * weights[index % weights.length]) % 10,
    0,
  );
  const checkDigit = (10 - (sum % 10)) % 10;
  return Number(value[17]) === checkDigit;
}

export function buildStoreAvatarStoragePath(sellerId: string, imageId = crypto.randomUUID()) {
  return `sellers/${sellerId}/avatar/${imageId}.jpg`;
}

// Card number a seller gives for cash deposits at OXXO. OXXO deposits to a card's 16 digits,
// not to a CLABE, so buyers without a bank app need this to pay the deposit.

export function cleanCardNumber(value: string) {
  return value.replace(/\D/g, "");
}

/** 16 digits with a valid Luhn check digit: catches a mistyped card before anyone pays cash into it. */
export function isValidCardNumber(value: string) {
  if (!/^\d{16}$/.test(value)) return false;
  const sum = [...value].reverse().reduce((total, char, index) => {
    const digit = Number(char);
    if (index % 2 === 0) return total + digit;
    const doubled = digit * 2;
    return total + (doubled > 9 ? doubled - 9 : doubled);
  }, 0);
  return sum % 10 === 0;
}

export function formatCardNumber(value: string) {
  return cleanCardNumber(value).replace(/(\d{4})(?=\d)/g, "$1 ");
}

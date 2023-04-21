export function zeroPadLeftUntilTwoChars(input: string) {
  return `00${input}`.slice(-2);
}

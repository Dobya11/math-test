export function getAuthEmailForUsername(username: string): string {
  return `${username.trim().toLowerCase()}@login.math-test.invalid`;
}

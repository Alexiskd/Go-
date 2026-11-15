/**
 * `npm create go-@latest mon-projet` exécute ce package : il délègue à `go- init`
 * et installe les dépendances (désactivable avec --no-install).
 */
export function toInitArgs(argv: readonly string[]): string[] {
  const args = argv.filter((a) => a !== '--no-install');
  const install = !argv.includes('--no-install') && !argv.includes('--install');
  return ['init', ...args, ...(install ? ['--install'] : [])];
}

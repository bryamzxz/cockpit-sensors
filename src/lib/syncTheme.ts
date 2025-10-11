/**
 * Sincroniza el tema PatternFly del iframe del plugin con el tema global
 * aplicado por Cockpit en el documento padre.
 *
 * Cockpit añade una clase en <html>:
 *   - pf-v6-theme-dark
 *   - pf-v6-theme-light
 *   - pf-v6-theme-system
 *
 * Aquí observamos el <html> padre y reflejamos esa clase en el <html> local.
 */
export function syncWithParentPatternflyTheme(): () => void {
  try {
    const selfRoot = document.documentElement;
    const parentRoot = window.parent && window.parent !== window
      ? window.parent.document.documentElement
      : null;

    if (!parentRoot || parentRoot === selfRoot) {
      return () => undefined;
    }

    const THEMES = ['pf-v6-theme-dark', 'pf-v6-theme-light', 'pf-v6-theme-system'];

    const apply = () => {
      const parentTheme = Array.from(parentRoot.classList).find(c => THEMES.includes(c));
      THEMES.forEach(c => selfRoot.classList.remove(c));
      if (parentTheme) selfRoot.classList.add(parentTheme);
    };

    // Aplicación inicial
    apply();

    // Observa cambios del tema en caliente (cuando el usuario lo cambia)
    const mo = new MutationObserver(apply);
    mo.observe(parentRoot, { attributes: true, attributeFilter: ['class'] });

    return () => mo.disconnect();
  } catch {
    // no-op: nunca tires la UI por tema
    return () => undefined;
  }
}

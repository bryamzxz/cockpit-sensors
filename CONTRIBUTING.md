# Contribuir a Cockpit Sensors

¡Gracias por querer mejorar Cockpit Sensors! Este documento resume las pautas
para proponer cambios de forma coherente con la filosofía del proyecto.

## Filosofía

- **Menos magia, menos dependencias.** Prefiere soluciones explícitas y evita
  añadir paquetes mientras no exista una justificación técnica clara.
- **Compatibilidad primero.** Asegúrate de que las novedades funcionan con las
  versiones de Node y Cockpit soportadas (actualmente Node 20).
- **Documenta lo que cambias.** Si introduces comportamientos o flujos nuevos,
  actualiza el README u otra documentación relevante.

## Flujo de trabajo

1. Crea una rama a partir de `main` usando el prefijo adecuado: `feature/*` para
   nuevas funcionalidades o `fix/*` para correcciones.
2. Instala dependencias con `npm ci` y trabaja siempre contra Node 20.x.
3. Realiza commits siguiendo [Conventional Commits](https://www.conventionalcommits.org/).
4. Antes de abrir un Pull Request, verifica que todo pasa:
   ```bash
   npm run lint
   npm run test
   npm run build
   ```
   Añade pruebas o mocks nuevos cuando sea necesario para cubrir la funcionalidad
   modificada.
5. Incluye en la descripción del PR un resumen claro, los riesgos conocidos y
   cualquier decisión relevante.

## Estilo de código

- Utiliza TypeScript o JavaScript moderno con módulos ES (`type": "module"`).
- Sigue las reglas definidas por ESLint y Stylelint. Puedes arreglar problemas
  automáticamente con `npx eslint . --fix` y `npx stylelint "src/**/*.scss" --fix`.
- Prefiere componentes y hooks pequeños, con responsabilidades únicas.
- Evita hardcodear credenciales, secretos o rutas de sistemas externos.

## Pruebas

- Usa [Vitest](https://vitest.dev/) y Testing Library para probar componentes y
  hooks. Ejecuta `npm run test` con regularidad mientras desarrollas.
- Cuando añadas funciones críticas, acompáñalas de pruebas unitarias o de
  integración que puedan ejecutarse en CI.
- No olvides ejecutar `npm run lint` para asegurar un estilo consistente.

## Revisiones

- Responde los comentarios de revisión con commits adicionales (también bajo
  Conventional Commits) o explicaciones claras.
- Mantén los cambios acotados: evita mezclar refactors amplios con nuevas
  características.
- Antes de fusionar, vuelve a ejecutar los comandos de pruebas y construcción
  para garantizar que nada se rompió durante la revisión.

Gracias por colaborar y mantener el proyecto saludable.

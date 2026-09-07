# V2.1 — Seguimientos

Deuda visual/UX identificada durante la V2.1 pero dejada fuera de alcance a
propósito — cambios funcionales reales, no ajustes puramente visuales, o
mejoras que requerirían tocar más superficie de la que el Bloque
correspondiente necesitaba. Ninguno es un bug; son extensiones futuras.
Ver `docs/V2_1_UI_CHANGELOG.md` para el contexto completo de cada Bloque.

## Fichas de captación y operación sin reestructurar (Bloque UI-5)

`/acquisitions/[id]` y `/deals/[id]` siguen siendo una pila plana de
`Card`s, el mismo patrón que tenían `/contacts/[id]` y `/properties/[id]`
antes del Bloque UI-4. No se tocó su jerarquía en V2.1 porque la spec no
las lista como "ficha" en ninguno de sus puntos 36-45 (esos puntos son
específicamente ficha cliente/ficha propiedad) — el Bloque UI-5 estaba
acotado a Kanban/tabla/filtros de captaciones y operaciones, no a
rediseñar sus fichas de detalle. Si se pide, el mismo criterio de UI-4
(IDENTIDAD → datos clave → PRÓXIMA ACCIÓN → actividad → datos secundarios)
aplicaría razonablemente bien acá también.

## Búsqueda global no cubre todas las entidades (Bloque UI-2)

El command palette (⌘K) busca clientes y propiedades — no leads,
búsquedas, captaciones ni operaciones. `lib/actions/search.ts` ya está
armado para extenderse (mismo patrón: reusar `listX({search})` de cada
`lib/data/*.ts`), así que ampliar la cobertura es agregar 1-2 llamadas más
al `Promise.all`, no una reestructuración.

## Sin ítem de navegación para "Tareas" (Bloque UI-2)

Las tareas viven dentro de "Hoy" y de cada ficha — no hay una sección
`/tasks` propia en el sidebar. La spec sugiere una sección "Tareas" bajo
"Gestión", pero como no existe esa ruta hoy, agregarla sería un módulo
funcional nuevo (regla 1: no introducir módulos funcionales en V2.1), no
un reordenamiento de navegación.

## Filtro de captaciones/operaciones solo por texto libre (Bloque UI-5)

`AcquisitionsBoard`/`DealsBoard` filtran por propiedad/propietario
(o comprador/vendedor) como texto libre — no hay filtro por origen
(`CONTACT_SOURCE_LABELS`) ni por rango de valor estimado. Ampliable
agregando más criterios al mismo `.filter()` en memoria, sin tocar el
data layer.

## "Nueva tarea"/"Nueva nota" siguen siendo formularios inline (Bloque UI-6)

La spec nombra estos como candidatos a drawer (punto 56), pero son
formularios de 2-3 campos ya compactos dentro de su propia `Card` — se
priorizó convertir "Finalizar visita" (7 campos, la más grande) a `Sheet`
en vez de tocar los 5-6 archivos que ya tienen estos quick-adds inline y
verificados. Mismo patrón (`Sheet`/`SheetTrigger`/`SheetContent`) aplicaría
si se pide.

## Sin gráficos de tendencia temporal ni de origen de leads (Bloque UI-7)

La spec sugiere un line chart de leads/visitas/captaciones por mes y un
bar chart de origen de leads (puntos 70-71). El dashboard actual es KPIs +
embudos, sin series temporales — agregar esto necesita datos agrupados por
mes (una query nueva, no solo un total del período elegido) y
probablemente sí justificaría una librería de charts liviana, a diferencia
de los embudos (que se resuelven bien con barras CSS a mano por tener solo
un puñado de etapas). Candidato a un Bloque futuro si se pide
explícitamente — no se instaló ninguna dependencia de charts en V2.1
(regla 96: no instalar dependencias nuevas sin necesidad real).

## Dark mode dormido (Bloque UI-1)

Los tokens `.dark` en `app/globals.css` están actualizados y consistentes
con el tema claro (mismo primary/success/warning/danger), pero no hay
ningún toggle conectado (`next-themes` está instalado pero sin
`ThemeProvider` en el árbol) — confirmado que nadie puede activarlo hoy.
Sin cambios en V2.1 a propósito: la spec (punto 85) dice explícitamente no
priorizarlo si no existe ya activo.

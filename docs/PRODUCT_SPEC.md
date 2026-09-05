# Product Spec — CRM Inmobiliario

## Objetivo

Un CRM para que un asesor inmobiliario (y, más adelante, un equipo) gestione
toda su operación comercial diaria: contactos, propietarios, compradores,
inversores, inquilinos, búsquedas, propiedades, captaciones, tasaciones,
visitas, leads, operaciones, tareas, agenda y fidelización — todo con
historial y una próxima acción explícita.

Principio rector: **"Toda relación comercial debe tener contexto, historial y
próxima acción."** Cada ficha importante debe responder de un vistazo:
¿con quién trabajo?, ¿qué necesita?, ¿qué propiedad está involucrada?,
¿en qué estado está la oportunidad?, ¿qué pasó hasta ahora?, ¿qué sigue?

## Alcance del MVP

Un usuario debe poder, de punta a punta: registrarse → crear un contacto →
clasificarlo por rol → crear una propiedad → asociar propietario → iniciar una
captación → registrar una tasación → crear una búsqueda → registrar y
convertir un lead → agendar una visita → crear tareas → ver las tareas del día
→ registrar notas → crear una operación → avanzarla por etapas → consultar su
timeline → usar la agenda → sincronizar con Google Calendar → consultar el
dashboard comercial.

Fuera del MVP (ver docs/ROADMAP.md para cuándo, si acaso): portal público,
publicación automática en portales, WhatsApp Business API, email marketing,
firma electrónica, generación automática de contratos, tasación con IA,
facturación, permisos de equipo avanzados, app nativa.

## Entidades del dominio

El modelo distingue explícitamente: **Persona, Propiedad, Búsqueda,
Captación, Operación, Actividad, Tarea, Lead**. No se mezclan artificialmente
(ver docs/DATABASE.md para el esquema).

- **Contacto** puede tener múltiples **roles** simultáneos (comprador,
  vendedor, propietario, inversor, inquilino, locador, referidor, ex-cliente,
  otro) — nunca un campo rígido `client_type`.
- **Propiedad** puede tener múltiples propietarios y múltiples tasaciones.
- **Captación** pertenece a una propiedad; representa el proceso comercial de
  conseguirla para comercializar.
- **Búsqueda** pertenece a un contacto (no a una propiedad) — ver
  docs/ARCHITECTURE.md, sección de decisiones, para el porqué.
- **Lead** es la entrada cruda (portal, WhatsApp, referido...) que se
  convierte en Contacto + Búsqueda sin duplicar datos.
- **Operación (deal)** conecta comprador, vendedor y propiedad con un pipeline
  propio (negociación → oferta → reserva → documentación → contrato → cierre).
- **Actividad** es cualquier interacción ya ocurrida o agendada (llamada,
  WhatsApp, visita, reunión, tasación...); **Tarea** es una próxima acción
  pendiente con prioridad y estado.

## Reglas de negocio clave

1. Un contacto puede tener múltiples roles y múltiples búsquedas.
2. Una propiedad puede tener múltiples propietarios y tasaciones.
3. Una captación pertenece a una propiedad; una operación también.
4. Toda actividad puede asociarse opcionalmente a contacto/propiedad/deal/
   búsqueda/captación/lead — ningún FK es obligatorio.
5. Una oportunidad activa (captación, búsqueda, operación) debería mostrar
   siempre una próxima acción.
6. Un lead convertido no debe duplicar contacto/búsqueda existentes — se
   verifican coincidencias por teléfono/email/DNI antes de crear.
7. Cerrar una operación o búsqueda conserva el historial; archivar una
   propiedad conserva las operaciones anteriores (soft delete, nunca borrado
   físico de entidades con historial).

## Experiencia diaria esperada

El asesor abre el CRM y ve **Hoy**: reuniones, tareas, seguimientos vencidos,
leads nuevos, alertas ("5 compradores activos sin próxima acción"). Hace clic
en un seguimiento vencido, entra a la ficha del contacto y ve de inmediato qué
busca, su presupuesto, objetivo, última interacción y próxima acción, con el
timeline completo debajo y acciones rápidas (llamar, nota, visita, enviar
propiedad, nueva operación) a un clic.

## Fuera de alcance explícito de esta fase de IA

El producto se diseña para incorporar IA más adelante (parseo de texto libre
a contacto + búsqueda + tarea estructurados), pero **no se implementa en el
MVP**. Primero se modela correctamente el dato; la capa de IA vendrá después
de estabilizar el core (ver docs/ROADMAP.md).

## Criterios de aceptación

Ver la lista completa de 21 puntos en la sección "56" del brief original,
resumida arriba en "Alcance del MVP". El roadmap por fases en
docs/ROADMAP.md mapea cada uno a la fase que lo entrega.

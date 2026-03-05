# Mission Control — Guía de Usuario

**Cómo usar la plataforma**

Mission Control es una plataforma de méritos y aprendizaje en equipo: te unes a un equipo, avanzas por roles, ganas logros, completas módulos de academia y usas herramientas compartidas (tableros, reuniones, objetivos, etc.). Esta guía explica cómo usarla.

---

## Inicio de sesión y equipos

- **Inicia sesión** con Google (botón en la primera pantalla).
- **Elige un equipo** en el selector. Verás:
  - **Tus equipos** — equipos en los que estás (activo o pendiente).
  - **Unirse a un equipo** — explorar y solicitar unirse a otros.
- **Cambia de equipo** cuando quieras con "Cambiar Equipo" en el encabezado; tus datos son por equipo.
- **Los admins de plataforma** pueden crear nuevos equipos y administrar todos.

---

## Roles y qué puedes hacer

| Rol | Qué ves y puedes hacer |
|-----|------------------------|
| **Visitante** (sin sesión) | Explorar nombres y resúmenes de equipos; debe iniciar sesión para unirse. |
| **Aspirante** | Solo la pestaña **Resumen** (eslogan, acerca de, historia, objetivos, KPIs). |
| **Novato / Junior / Senior** | Todas las pestañas en **solo lectura**: Áreas, Miembros, Logros, Clasificación, Calendario, Herramientas, Academia, Fondos. Puede completar módulos de Academia. |
| **Líder** | Lo mismo que arriba, más puede **otorgar logros** solo en su área asignada. |
| **Admin de Equipo** | Edición completa de ese equipo: resumen, áreas, miembros, logros, academia, herramientas, fondos y la pestaña **Admin** para opciones de menús. |
| **Admin de Plataforma** | Igual que Admin de Equipo para **todos** los equipos; puede crear, renombrar y eliminar equipos. |

---

## Pestañas principales

### Resumen
- Eslogan del equipo, acerca de, historia, objetivos y tarjetas KPI personalizadas.
- **Admins:** haz clic en "Editar" para cambiar texto y agregar/eliminar KPIs. Las estadísticas (miembros, puntos, módulos) se actualizan automáticamente.

### Feed
- Publicaciones y comentarios. Crea una publicación (URL de imagen opcional); comenta; elimina tu propio contenido. **Admins** pueden eliminar cualquier cosa.

### Áreas (Categorías)
- Lista de áreas del equipo (ej. Mecánica, Software). **Admins:** crear, editar, eliminar áreas y asignar miembros a un área.

### Miembros
- Todos los miembros, roles, áreas y faltas. **Admins:** cambiar rol, asignar área, agregar/eliminar faltas (3 faltas = suspendido). Haz clic en un miembro para ver su perfil. **Admins** pueden agregar miembros "fantasma" (sin cuenta Google) y aprobar/rechazar solicitudes de ingreso.

### Logros
- Lista de logros (nombre, puntos, categoría, nivel). **Admins:** crear/editar/eliminar logros y definir quién puede otorgarlos. **Líderes** otorgan logros solo en su área. No puedes otorgarte logros a ti mismo. Los puntos del ranking se obtienen de los logros otorgados.

### Clasificación
- Puntos por miembro: **Temporada** (últimos 3 meses) e **Histórico**. Solo lectura; se actualiza desde los eventos de logros.

### Calendario
- Eventos del equipo (crear/editar/eliminar; global o por área). Marca la casilla para ver fechas de nacimiento.

### Herramientas
- **FODA** — análisis FODA.  
- **Eisenhower** — matrices de urgencia/importancia (global o por área).  
- **Pugh** — matrices de Pugh con criterios y puntuaciones (global o por área).  
- **Tableros** — Kanban y SCRUM (global o por área).  
- **Reuniones** — notas de reunión y puntos de acción.  
- **Objetivos** — objetivos con resultados clave.  
La visibilidad y permisos de edición dependen de tu rol y área; los filtros de "alcance" permiten cambiar entre Todo, Global o un área.

### Academia
- **Módulos** (texto + video opcional). Abre un módulo, lee y mira, luego responde la **pregunta de recuperación** para marcarlo como completado. Tu completado y respuesta se guardan. **Admins:** crear/editar/eliminar módulos y definir orden.

### Fondos
- **Cuentas** (ej. presupuestos) y **movimientos** (transacciones). **Admins** crean/editan/eliminan cuentas y movimientos.

### Mi Perfil
- Tu nombre, foto, rol, área, bio, carrera, semestre, etiquetas de colaboración, cultura (canciones, libros, frases, etc.) y estatus semanal. **Admins** pueden editar el perfil de cualquier miembro; tú puedes editar el tuyo. Usa "Ver perfil" en un miembro para abrir su perfil.

### Admin (solo Admin de Equipo)
- Edita las opciones que aparecen en los menús del equipo: carreras/majors, semestres, etiquetas de personalidad, sugerencias de colaboración, tipos/dominios/niveles de logros. Un valor por línea o separados por coma.

---

## Encabezado y navegación

- **Contraer/expandir** la barra lateral con el botón `‹` / `›`.
- **Avatar de perfil** — haz clic para abrir tu perfil.
- **Cambiar Equipo** — volver al selector de equipos.
- **Cerrar Sesión** — cerrar sesión de Google.
- **Admins de plataforma:** "Vista previa como…" permite ver la app como otro rol (ej. Novato). "Salir de Vista Previa" vuelve a tu rol real.

---

## Inicio rápido (ejecutar la app localmente)

```bash
npm install
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173).  
Para que la app funcione (auth y datos), completa la configuración de Firebase: **[FIREBASE_SETUP.md](./FIREBASE_SETUP.md)**.

---

## Compilar y desplegar

```bash
npm run build
```

La salida está en `dist/`. Despliega esa carpeta con Firebase Hosting o cualquier host estático. Para Firebase: `firebase init hosting` (directorio público `dist`), luego `firebase deploy`.

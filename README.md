# API headless de cuestionarios

Proyecto del laboratorio DAE S08 con Django REST Framework. Expone exámenes, preguntas y opciones por HTTP y agrega un contrato OpenAPI, un cliente de consola y una frontera segura para un agente de IA.

## Instalación y puesta en marcha

Requisitos: Python 3.12 o superior.

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_quiz
python manage.py add_concept_art_quizzes
python manage.py runserver
```

`seed_quiz` crea datos de muestra y dos identidades con token. El comando reinicia los exámenes y preguntas de ejemplo; ejecútalo en una base local de desarrollo. `add_concept_art_quizzes` agrega, sin borrar ni reemplazar datos, los cuestionarios «Arte conceptual · Fundamentos visuales» y «Arte conceptual · Diseño para 3D»; puede ejecutarse más de una vez. Copia las líneas de token que imprime para configurarlas en la terminal desde la que usarás los clientes.

```powershell
$env:QUIZ_URL = 'http://127.0.0.1:8000'
$env:QUIZ_TOKEN_HUMANO = '<token que imprimió seed_quiz>'
$env:QUIZ_TOKEN_AGENTE = '<token que imprimió seed_quiz>'
$env:QUIZ_TOKEN = $env:QUIZ_TOKEN_HUMANO
```

La ruta `/` muestra el portal de estudio Aula Nexo. Para consultar exámenes desde el frontend, conecta un token de usuario. La API requiere encabezado `Authorization: Token <token>`. El contrato y la documentación están en `/api/schema/` y `/api/docs/`; Swagger permite ingresar un token con **Authorize**.

## API REST

Los exámenes se referencian por ID y las opciones viajan anidadas en la pregunta con el campo `choices` (también se devuelve `options` como alias para la primera versión del proyecto). Cada pregunta debe tener al menos dos opciones y exactamente una correcta.

| Recurso | Dirección | Método | Cuerpo | Respuesta HTTP |
|---|---|---|---|---|
| Colección de exámenes | `/api/exams/` | GET | — | `200 OK` (paginado) |
| Colección de exámenes | `/api/exams/` | POST | `{"title":"Fundamentos de Python","description":"Evaluación"}` | `201 Created`; inválido: `400` |
| Examen individual | `/api/exams/{id}/` | GET | — | `200 OK`; ID inexistente: `404` |
| Examen individual | `/api/exams/{id}/` | PUT | `{"title":"Python básico","description":"Actualizado"}` | `200 OK` para `profe`; `403` para `agente`; inválido: `400` |
| Examen individual | `/api/exams/{id}/` | PATCH | `{"title":"Python intermedio"}` | `200 OK` para `profe`; `403` para `agente`; inválido: `400` |
| Examen individual | `/api/exams/{id}/` | DELETE | — | `204 No Content` para `profe`; `403` para `agente` y usuarios de solo lectura |
| Colección de preguntas | `/api/questions/` | GET | — | `200 OK` (paginado); admite `?exam=1` y `?search=texto` |
| Colección de preguntas | `/api/questions/` | POST | `{"exam":1,"text":"¿Qué es REST?","choices":[{"text":"Estilo de arquitectura","is_correct":true},{"text":"Lenguaje","is_correct":false}]}` | `201 Created`; inválido: `400` |
| Pregunta individual | `/api/questions/{id}/` | GET | — | `200 OK`; ID inexistente: `404` |
| Pregunta individual | `/api/questions/{id}/` | PUT | Cuerpo de creación | `200 OK` para `profe`; `403` para `agente`; inválido: `400` |
| Pregunta individual | `/api/questions/{id}/` | PATCH | Cuerpo parcial; si incluye `choices`, reemplaza las opciones | `200 OK` para `profe`; `403` para `agente`; inválido: `400` |
| Pregunta individual | `/api/questions/{id}/` | DELETE | — | `204 No Content` para `profe`; `403` para `agente` y usuarios de solo lectura |
| Colección de opciones | `/api/options/` | GET | — | `200 OK` (paginado) |
| Colección de opciones | `/api/options/` | POST | `{"question":1,"text":"Opción","is_correct":false}` | `201 Created`; inválido: `400` |
| Opción individual | `/api/options/{id}/` | GET | — | `200 OK`; ID inexistente: `404` |
| Opción individual | `/api/options/{id}/` | PUT, PATCH | `{"question":1,"text":"Respuesta","is_correct":true}` | `200 OK` para `profe`; `403` para `agente`; inválido: `400` |
| Opción individual | `/api/options/{id}/` | DELETE | — | `204 No Content` si se permite; `400` si quitarla deja la pregunta sin respuesta correcta; `403` para `agente` |

Sin token o con token inválido, la API responde `401 Unauthorized`. Un usuario autenticado sin permiso para escribir o borrar recibe `403 Forbidden`. La paginación usa cinco resultados por página; las preguntas admiten `?exam=1`, `?search=texto` y `?page=2`.

## Identidades y permisos

- **`profe` (staff):** lectura, creación, modificación y eliminación.
- **`agente` (grupo `agente`):** lectura y creación. `PUT`, `PATCH` y `DELETE` reciben `403`; bloquear `PATCH` también evita que un reemplazo anidado borre opciones.
- **Otros usuarios autenticados:** solo lectura.
- **Sin token:** 401.

`AgentPermission` aplica las reglas en el servidor, aunque un cliente intente evadirlas. Las credenciales se generan localmente y no están escritas en el código.

## Contrato OpenAPI

Consulta `http://127.0.0.1:8000/api/docs/` o exporta el contrato:

```powershell
python manage.py spectacular --file schema.yml
```

## Cliente de consola `quizctl`

Desde otra terminal, selecciona el token según la identidad que quieras usar:

```powershell
python quizctl.py exams list
python quizctl.py exams create --title 'Evaluación temporal'
python quizctl.py exams get 3
python quizctl.py exams put 3 --title 'Python básico' --description 'Evaluación actualizada'
python quizctl.py exams patch 3 --title 'Python intermedio'
python quizctl.py exams delete 3
python quizctl.py questions list --search prefetch --json
python quizctl.py questions create --exam 1 --text '¿Qué es REST?' --choice 'Un estilo:ok' --choice 'Un lenguaje'
python quizctl.py --dry-run questions delete 3
python quizctl.py ops
```

Los códigos de salida son: 0 éxito, 1 otro error/uso, 2 validación (400), 3 no autorizado/no permitido (401/403), 4 no encontrado (404), 5 error de servidor (5xx) y 6 sin conexión. `--dry-run` describe las escrituras sin enviarlas.

## Frontera del agente

El agente solo recibe una lista cerrada de operaciones leída del contrato OpenAPI. No recibe claves de shell, SQL ni código Python. Las lecturas y la creación permitida pasan por la API usando el token del agente; los datos devueltos se etiquetan como `untrusted_data`. El texto hostil incluido en una pregunta de muestra se conserva como contenido y no se interpreta como instrucción.

El modelo local es opcional. Para usar un endpoint compatible con OpenAI, configura `LLM_URL` y `LLM_MODEL`; el modelo propone intenciones, pero el gateway valida cada operación y argumento antes de llamar a la API.

```powershell
python -m agent --intent '{"op":"exams_list"}'
python -m agent --intent '{"op":"questions_list","query":{"search":"prefetch"}}'
python -m agent --intent '{"op":"questions_create","body":{"exam":1,"text":"¿Qué es REST?","choices":[{"text":"Un estilo","is_correct":true},{"text":"Un lenguaje","is_correct":false}]}}'
```

El agente no tiene operaciones de modificación ni eliminación, ni un flujo de aprobación para borrar. El gateway solo admite lecturas y creación de preguntas; bloquea cualquier intención de `PUT`, `PATCH` o `DELETE`. El servidor también limita al grupo `agente` a lecturas y `POST`, incluso si esa cuenta tuviera permiso de staff. Esto evita la eliminación indirecta que causaría reemplazar opciones anidadas durante un `PATCH`. El módulo del agente nunca carga el token humano. Las decisiones quedan registradas en `agent_audit.jsonl`.

```powershell
python -m agent --intent '{"op":"questions_destroy","path":{"id":1}}'
```

El intento anterior queda denegado y no envía una petición de borrado. Una persona puede administrar los recursos por separado con su propio token humano; el agente no puede solicitar ni aprobar esa acción.

## Verificación

```powershell
python manage.py test
```

`quizctl` es un cliente externo HTTP basado en `requests`. Las pruebas de integración `CliLiveTests` levantan un servidor local y recorren `GET`, `POST`, `PUT`, `PATCH` y `DELETE` con códigos esperados (`200`, `201`, `204`, además de `400`, `403` y `404`). El caso de borrado exitoso usa únicamente un examen temporal y el token humano `profe`. Otros casos intentan borrar una pregunta con el token del agente y reemplazar sus opciones anidadas con `PATCH`: verifican `403` y que el recurso y sus opciones sigan existiendo. El agente no tiene operaciones de modificación o borrado en su gateway; el servidor restringe el grupo `agente` a lecturas y creación.

Ejecuta la verificación con `python manage.py test`. También se pueden recorrer las mismas operaciones manualmente con Postman, Insomnia o VS Code REST Client.

## Estructura

- `config/`: configuración Django, rutas API y vistas OpenAPI.
- `quiz/`: modelos, serializadores, viewsets, permisos y datos de ejemplo.
- `quizctl.py`: cliente HTTP headless.
- `agent/`: gateway, auditoría y adaptador opcional a modelo local.
- `quiz/tests/`: pruebas de API, permisos, cliente y gateway.

Código, nombres y comentarios en inglés; documentación para la entrega en español.

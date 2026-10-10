# ТЗ бэкенда MVP, пакет 2: задачи, связи, ссылки, поиск

Продукт: [05-task-card.md](../05-task-card.md) (карточка), [06-create-task-dialog.md](../06-create-task-dialog.md) (создание). Соглашения: [00-conventions.md](00-conventions.md). Модель: [08](../08-data-model-and-permissions.md). Контракт: [openapi/openapi.yaml](openapi/openapi.yaml), теги Tasks и Links.

**Зависит от:** пакет 1 (права, справочники). Читать вместе с [03](03-board-and-move.md), раздел 3 (порядок карточек). Пока нет пакета 4, `spentMinutes`, `subtasksSpentMinutes` и `commentCount` равны 0.

Разделы 1–9 — требования, раздел 10 — рекомендации (необязательно).

## 1. Цель и границы
Дать фронту создание задач и подзадач, чтение карточки по ключу, правку полей и тегов, историю изменений, связи «блокирует», ссылки и поиск задач для выбора родителя и связи.
- Не входит: архивация и восстановление задач (задачу закрывают статусом Cancelled), список «Все задачи», подписки и уведомления, удаление задач.

## 2. Задача
`id`, `number`, `parentId?`, `type` (`task` | `bug` | `subtask`), `title`, `description?`, `statusId`, `priority` (`low` | `medium` | `high` | `critical`), `assigneeId?`, `reviewerId?`, `subsystemId?`, `dueDate?`, `estimateMinutes?`, `reporterId`, позиция в колонке, `createdAt`, `updatedAt`, момент закрытия.

- **Ключ** `KEY-number` (`DEMO-152`) у всех типов, нумерация общая для проекта, по возрастанию, без повторов и переиспользования.
- **Название:** после `trim` 1–100 символов. **Описание:** markdown до 5000 символов; пустая строка — `null`. Бэкенд разметку не очищает и не рендерит.
- **Тип:** Task ↔ Bug меняются через `PATCH`; Subtask фиксирован.
- **Родитель:** только у Subtask, обязателен при создании, Task или Bug того же проекта; после создания не меняется. Подзадачи у подзадачи нет.
- **Приоритет** по умолчанию `medium`.
- **Исполнитель и ревьюер:** участники проекта (иначе 422 `not_member`); могут совпадать.
- **Срок** `dueDate` — любая дата. **Оценка** `estimateMinutes` — 1–100000 или `null`.
- **Теги:** до 50, только теги проекта.
- **Статус при создании:** переданный или первый в порядке workflow статус без `requiresReason`. Статус с `requiresReason` при создании — 422 (`fields.statusId = reason_required`): причину некуда записать. Дальше статус меняет только `move` ([03](03-board-and-move.md)).
- **Момент закрытия** ставится, когда задача попадает в статус категории `done`, и сбрасывается при выходе из неё. Наружу не отдаётся; нужен окну Done на доске.
- **Позиция:** новая задача встаёт в конец колонки своего статуса.
- **`updatedAt`** обновляется при изменении полей, тегов, статуса, связей, ссылок и комментариев. `PATCH` с тем же значением ничего не пишет: ни историю, ни `updatedAt`.
- **Параллельные правки:** последнее сохранение побеждает на уровне поля; версий нет.

## 3. Ответ `TaskDetail`
`id`, `key`, `type`, `title`, `description`, `status` `{ id, name, color, category }`, `priority`, `assignee`, `reviewer` (`{ userId, name, username } | null`), `reporter`, `subsystem` `{ id, name } | null`, `tags` `[{ id, name }]`, `dueDate`, `isOverdue`, `estimateMinutes`, `spentMinutes`, `parent` `{ id, key, title } | null`, `blocked`, `commentCount`, `subtasks`, `subtasksEstimateMinutes`, `subtasksSpentMinutes`, `links`, `urls`, `createdAt`, `updatedAt`.
- `isOverdue` — срок задан, раньше сегодняшней даты UTC, статус не категории `done`.
- `blocked` — есть связь, где задача заблокирована (`blocked_by`), а блокирующая задача не в статусе категории `done`.
- `subtasks` — `[{ id, key, title, status, assignee }]` по возрастанию номера; у подзадачи — пустой массив. Прогресс «N из M» фронт считает сам по категории статуса.
- `subtasksEstimateMinutes`, `subtasksSpentMinutes` — суммы по подзадачам (без собственных значений родителя); без подзадач — 0.
- `links` — `[{ id, type, task: { id, key, title, status } }]`, `type` с точки зрения этой задачи (`blocks` | `blocked_by`); порядок: сначала `blocks`, затем `blocked_by`, внутри — по номеру задачи как числу (`DEMO-99` раньше `DEMO-100`).
- `urls` — `[{ id, url, title, createdAt }]` по возрастанию `createdAt`.
- `commentCount` — число комментариев обоих видов (пакет 4).

## 4. Ручки задач
| Ручка | Права | Поведение |
|---|---|---|
| `POST /projects/:projectId/tasks` `{ type, title, description?, statusId?, priority?, assigneeId?, reviewerId?, subsystemId?, dueDate?, estimateMinutes?, tagIds?, parentId? }` | `task-create` | Автор — текущий пользователь. Ошибки 422: `title` пустое или длиннее 100; `description` длиннее 5000; Subtask без `parentId` (`required`); `parentId` у Task и Bug (`not_allowed`); родитель не найден в проекте (`not_found`) или сам подзадача (`invalid`); `statusId`, `subsystemId`, `tagIds` не из проекта (`not_found`); статус с `requiresReason` (`reason_required`); исполнитель или ревьюер не участник (`not_member`); `estimateMinutes` вне 1–100000; `tagIds` больше 50 (`too_many`) или с повторами (`duplicate`). Пишет событие `created`. 201 `TaskDetail` |
| `GET /projects/:projectId/tasks/by-key/:key` | `task-view` | `TaskDetail`. Регистр ключа не важен (`demo-12`); префикс должен совпасть с ключом проекта из пути. Нет задачи или чужой префикс — 404 |
| `PATCH /tasks/:taskId` `{ title?, description?, type?, priority?, assigneeId?, reviewerId?, subsystemId?, dueDate?, estimateMinutes?, tagIds? }` | `task-update` | Частичная правка: нет поля — не менять, `null` очищает (у `title`, `type`, `priority` `null` — 422 `invalid`). Ошибки как при создании; поле, которого нет в схеме (в том числе `statusId`, `parentId`), — 422 `invalid`; `type = subtask` или любой `type` у подзадачи — 422 (`fields.type = invalid`). `tagIds` — полный новый набор; бэкенд сам пишет `tag_added` / `tag_removed` по каждому отличию. 200 `TaskDetail` |
| `GET /tasks/:taskId/history` | `task-view` | `{ items: [HistoryEvent] }` от новых к старым, без пагинации |
| `GET /projects/:projectId/tasks/search?q=&types=&excludeId=&limit=` | `task-view` | Поиск для выбора родителя (`types=task,bug`) и связанной задачи. Раздел 6 |

## 5. История
`HistoryEvent`: `id`, `kind`, `field`, `oldValue`, `newValue`, `createdAt`, `actor` (`UserRef`).
- `kind`: `created`, `field_changed`, `link_added`, `link_removed`, `url_added`, `url_removed`, `tag_added`, `tag_removed`.
- `field` для `field_changed`: `status`, `assignee`, `reviewer`, `priority`, `type`, `subsystem`, `dueDate`, `estimateMinutes`; для `link_*` — тип связи с точки зрения задачи; иначе `null`. Название, описание, комментарии и списания в историю не пишутся.
- Значение — `{ id, label }` или `null`. Для сущностей (`status`, `assignee`, `reviewer`, `subsystem`, тег, связанная задача, ссылка) `id` — идентификатор, `label` — название на момент события (имя, ключ, `title` или `url` ссылки). Для скаляров (`priority`, `type`, `dueDate`, `estimateMinutes`) `id = null`, `label` — сырое значение (`high`, `bug`, `2026-11-03`, `150`); форматирует фронт.

| `kind` | `oldValue` | `newValue` |
|---|---|---|
| `created` | `null` | `null` |
| `field_changed` | прежнее | новое |
| `tag_added` / `tag_removed` | `null` / тег | тег / `null` |
| `link_added` / `link_removed` | `null` / другая задача | другая задача / `null` |
| `url_added` / `url_removed` | `null` / ссылка | ссылка / `null` |

Несколько полей в одном запросе — по событию на поле с общим `createdAt`. События неизменяемы.

## 6. Поиск задач
- `q` до 100 символов; пустой — последние обновлённые задачи. По названию — подстрока без учёта регистра (`%`, `_`, `\` — обычные символы). По ключу ищется только запрос, похожий на номер: `N`, `-N` или `KEY-N` (`demo-1` находит `DEMO-1` и `DEMO-10`); `de`, `demo` ищут только по названию, чтобы часть ключа проекта не возвращала весь проект.
- `types` — `task`, `bug`, `subtask` через запятую; без параметра — все типы. `excludeId` — исключить задачу (проверяется только формат). `limit` 1–20, по умолчанию 10.
- Порядок: точное совпадение ключа, затем ключ содержит `q`, затем название содержит `q`; внутри — по `updatedAt` от новых.
- Ответ: `{ items: [{ id, key, type, title, status }] }`.

## 7. Связи и ссылки
**Связь** «A блокирует B» хранится одной записью. На вход `type`: `blocks` или `blocked_by` (`blocked_by` для A и цели B сохраняется как «B блокирует A»).

| Ручка | Права | Поведение |
|---|---|---|
| `POST /tasks/:taskId/links` `{ type, targetTaskId }` | `link-manage` | Связь с собой — 422 (`fields.targetTaskId = same_task`); цель не найдена в проекте — 422 (`not_found`); такая связь уже есть — 409 `link_exists`; связь замкнула бы цикл `blocks` (из цели по цепочке достижима исходная задача; прямая обратная пара — частный случай) — 409 `link_cycle`. Пишет `link_added` в историю обеих задач, обновляет их `updatedAt`. 201 `{ link }` с точки зрения `taskId` |
| `DELETE /tasks/:taskId/links/:linkId` | `link-manage` | Удаляет связь, где `taskId` — любая из сторон, иначе 404. Пишет `link_removed` обеим задачам. 204 |
| `POST /tasks/:taskId/urls` `{ url, title? }` | `link-manage` | `url` — корректный адрес `http://` или `https://`, до 2000 символов, иначе 422 (`fields.url = invalid`); `title` до 100, пустой — `null`; больше 50 ссылок у задачи — 422 (`fields.url = too_many`). Одинаковые адреса допустимы. Пишет `url_added`. 201 `{ url }` |
| `DELETE /tasks/:taskId/urls/:urlId` | `link-manage` | Чужая или несуществующая ссылка — 404. Пишет `url_removed`. 204 |

Редактирования ссылки и связи нет: удалить и добавить заново.

## 8. Тестовые данные (`DEV_SEED=true`)
- `DEMO`, около 30 задач: все статусы шаблона, в том числе Done и Cancelled; 4–5 багов; 4 задачи с подзадачами (2–4 у каждой, часть закрыта); задачи без исполнителя, без срока, с просроченным сроком (не закрытые), с оценкой, с тегами, с направлениями Frontend и Backend; авторы — разные участники.
- Связи: две незакрытые задачи блокируют третью (`blocked = true`), ещё одна блокирующая — в Done; цепочка из трёх `blocks` без цикла (для проверки отказа при замыкании).
- У 5–6 задач по 1–2 ссылки (merge request, документ).
- История: у каждой задачи `created`, у нескольких — 1–2 изменения полей.
- `SIMPLE`: 5 задач без подзадач.

## 9. Критерии приёмки
1. Ключи `KEY-N` идут подряд; 20 одновременных созданий в одном проекте дают 20 разных номеров (повторить 10 раз). Пишется `created`.
2. Subtask без `parentId` — 422; с родителем-подзадачей — 422 `invalid`; с родителем другого проекта — 422 `not_found`; Task с `parentId` — 422 `not_allowed`.
3. Создание в Blocked или Cancelled — 422 `reason_required`; без `statusId` задача попадает в Backlog (первый статус без причины в `dev`) и встаёт в конец колонки.
4. Название 101 символ и описание 5001 символ — 422 `too_long`; пробелы по краям названия отсекаются.
5. `PATCH` меняет только переданные поля; то же значение не пишет историю и не меняет `updatedAt`; несколько полей — по событию на поле с общим `createdAt`.
6. `PATCH` с `statusId` или `parentId` — 422 `invalid`; Task ↔ Bug работает; `type` у подзадачи или `type: subtask` — 422 `invalid`.
7. Теги: набор заменяется целиком, по событию на отличие; чужой тег — 422 `not_found`; 51 тег — `too_many`; повтор — `duplicate`.
8. Исполнитель не участник — 422 (`fields.assigneeId = not_member`); для ревьюера — `fields.reviewerId`.
9. `by-key/demo-12` возвращает задачу; не участнику, несуществующему ключу и ключу чужого проекта — 404.
10. `TaskDetail` родителя: `subtasks` по номеру, суммы оценок и времени по подзадачам; у задачи без подзадач — пустой массив и нули. `isOverdue` верен для просроченной незакрытой и ложен для закрытой.
11. История от новых к старым; `label` не меняется после переименования участника.
12. Связи `blocks` и `blocked_by` видны с правильной стороны у обеих задач, в истории обеих — `link_added`; на себя — 422 `same_task`; повтор — 409 `link_exists`; цикл по цепочке и обратная пара — 409 `link_cycle`; одновременные A→B и B→A (20 повторов) — один 201, второй 409.
13. `blocked = true` при незакрытом блокере и `false`, когда блокер в Done; совпадает в `TaskDetail` и карточке доски.
14. Ссылки: `ftp://x`, пустая, длиннее 2000 — 422 `invalid`; 51-я — 422 `too_many`; удаление пишет `url_removed`.
15. Поиск: `q=de` не возвращает задачи без «de» в названии; `q=12` находит `DEMO-12`; `q=demo-1` — `DEMO-1` и `DEMO-10`; `types=task,bug` исключает подзадачи; `excludeId` исключает задачу; не больше `limit`.
16. `eva_viewer`: `POST` задачи, `PATCH`, связи и ссылки — 403; чтение — 200.

## 10. Рекомендации (необязательно)
- Номер задачи — из счётчика проекта атомарным обновлением плюс уникальное ограничение `(projectId, number)`.
- Проверку цикла и вставку связи — под advisory-блокировкой проекта, первой в транзакции.
- Общие функции: «применить статус» (статус, позиция, момент закрытия, `updatedAt`, история), «записать историю» (одна `createdAt` на запрос), «отметить задачу изменённой» — вызываются из пакетов 2–4.
- В `ILIKE` экранировать `%`, `_`, `\`; «похоже на номер» проверять регулярным выражением до запроса.

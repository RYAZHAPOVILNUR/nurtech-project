# Модель данных и ключи разрешений

Сводный документ по всем страницам (01–12). Основа для ТЗ бэкенда и для типа `Permission` на фронте. Источники правды по темам (кто главнее при расхождении) — в [README](README.md), раздел «Иерархия источников»: здесь главные роли и ключи (§4) и логическая модель (§2–3), контракт — OpenAPI.

## 1. Принципы
- Граница доступа — проект; глобально только флаг системного администратора.
- Связи между задачами, статусами, досками, тегами и направлениями — только внутри проекта.
- Пользователи и задачи не удаляются физически: пользователь деактивируется, задача архивируется. Удаляются (физически) комментарии, списания времени, ссылки, связи, теги, направления, доски; статусы удаляются с переносом задач.
- Время хранится в минутах, даты и моменты времени — в UTC; фронт показывает моменты времени в часовом поясе пользователя. Даты без времени (срок, дата списания) — строки `YYYY-MM-DD`, без пересчёта в пояс; «сегодня» на бэкенде — UTC.
- Порядок карточек в колонке однозначен и общий для статуса; наружу он отдаётся строкой `rank` — непрозрачной для клиента. Как порядок считается и хранится, решает разработчик бэкенда (рекомендации — [b06](backend/06-boards-and-move.md), раздел 10).

## 2. Сущности
Таблицы описывают логическую модель: какие данные есть у системы и какие правила на них действуют. Служебные поля (хеши токенов и пароля, `rank`, счётчик `taskSeq`, закрытие запросов `usedAt`) и вспомогательные сущности (`TelegramOutbox`) в контракте не появляются; способ хранения и названия колонок решает разработчик бэкенда.

### Аккаунты и доступ
| Сущность | Поля | Правила |
|---|---|---|
| **User** | `id`, `name`, `username`, `status` (invited / active / deactivated), `isSystemAdmin`, пароль (хеш; наружу не отдаётся, в API — признак `hasPassword`), `mustChangePassword`, `telegramId?`, `telegramUsername?`, `notifyTelegram`, `createdAt` | `username`: латиница, цифры, `_`, уникален без учёта регистра, пуст, пока приглашение не принято, потом не меняется (смены в интерфейсе и API нет, при необходимости — консольная команда); `telegramId` уникален; хотя бы один способ входа после принятия приглашения; сид-админ создаётся при первом запуске, `mustChangePassword = true` до смены пароля при первом входе (при этой смене текущий пароль не запрашивается); пароль можно только сменить, если он есть: пользователь, входящий только через Telegram, пароль задать не может; `notifyTelegram = true` только при привязанном Telegram; `active` в `Member`/`UserRef` равно `status ≠ deactivated` (у приглашённого после «Новой ссылки» `active = true`) |
| **Invitation** | `id`, `userId`, `kind` (new / reissue), `tokenHash`, `createdBy`, `createdAt`, `expiresAt` (7 дней), `usedAt?` | одноразовая; `kind = reissue`, если у пользователя уже есть логин, иначе `new` (логин выбирается при принятии); новая ссылка отзывает прежнюю, сбрасывает пароль, привязку Telegram и `notifyTelegram`; деактивация делает ссылку недействительной |
| **Session** | `id`, `userId`, `tokenHash`, `createdAt`, `expiresAt`, `revokedAt?` | httpOnly cookie; деактивация пользователя отзывает все сессии |
| **TelegramAuthRequest** | `tokenHash`, `purpose` (login / invite / link), `userId?`, `invitationId?`, `sessionId?` (только `link`: сессия, создавшая запрос), `telegramId?`, `telegramUsername?`, `status` (waiting / confirmed / expired / not_linked / deactivated / already_linked), `expiresAt` (5 минут; у подтверждённого `invite` — 5 минут от подтверждения), `usedAt?` (запрос закрыт, ставится один раз условным обновлением) | `purpose = invite` — привязка к приглашению; ответ статуса при подтверждении содержит `telegramUsername` для предложения логина, а закрывает запрос `accept`. Подтверждение засчитывается только нажатием кнопки в боте тем же `telegramId`, что прислал `/start` |

### Проект и справочники
| Сущность | Поля | Правила |
|---|---|---|
| **Project** | `id`, `key`, `name`, `description?`, `template` (dev / simple), `taskSeq`, `createdAt` | `key`: 2–6 символов A–Z и 0–9, первый — буква, уникален, не меняется; шаблон задаёт статусы, доски и направления только при создании; архивации проекта нет (после релиза) |
| **Membership** | `projectId`, `userId`, `role` (owner / admin / member / viewer), `addedAt` | уникальна пара (проект, пользователь); в проекте всегда минимум один owner; владелец проекта — участник с ролью owner; удаление участника снимает его с исполнителя/ревьюера задач проекта (запись в историю) |
| **Status** | `id`, `projectId`, `name`, `color` (8 фиксированных), `category` (backlog / todo / in_progress / done), `requiresReason`, `position` | имя уникально в проекте без учёта регистра; всегда минимум один статус категории done; удаление: перенос задач (`moveTo`), колонки досок с этим статусом убираются |
| **Board** | `id`, `projectId`, `name`, `doneWindowDays` (1–365, по умолчанию 14), `baseFilter`, `createdAt` | имя уникально в проекте; в проекте минимум одна доска; доски идут в порядке создания (шаблон `dev`: «Разработка», затем «Планирование»; поля порядка нет); `baseFilter` — JSON с массивами значений по полям: исполнитель, ревьюер, приоритет, тип, направление, теги (без статуса) |
| **BoardColumn** | `boardId`, `statusId`, `position` | пара (доска, статус) уникальна; минимум одна колонка у доски |
| **Subsystem** («Направление») | `id`, `projectId`, `name` | имя уникально; удаление: перенос задач в другое направление или в «без направления» |
| **Tag** | `id`, `projectId`, `name` | имя уникально без учёта регистра; создаётся на лету в задаче; удаление убирает тег у задач |

### Задача и всё, что к ней относится
| Сущность | Поля | Правила |
|---|---|---|
| **Task** | `id`, `projectId`, `number`, `parentId?`, `type` (task / bug / subtask), `title` (до 100 символов), `description?` (markdown, до 5000 символов), `statusId`, `priority` (low / medium / high / critical, по умолчанию medium), `assigneeId?`, `reviewerId?`, `subsystemId?`, `dueDate?`, `estimateMinutes?`, `reporterId`, `rank`, `createdAt`, `updatedAt`, `resolvedAt?`, `archivedAt?` | ключ: `KEY-number` у всех типов, включая Subtask (общая нумерация проекта, связь с родителем видна по бейджу и блоку подзадач); `parentId` только у Subtask и ссылается на Task или Bug того же проекта; родитель не меняется после создания; тип меняется только Task ↔ Bug, у Subtask фиксирован; `resolvedAt` ставится при переходе в статус категории done и сбрасывается при выходе из неё, при смене категории статуса задним числом не пересчитывается; архивация родителя архивирует его неархивные подзадачи; восстановление родителя возвращает все его подзадачи, в том числе архивированные отдельно (служебного поля каскада нет); `assigneeId` и `reviewerId` — только участники проекта |
| **TaskTag** | `taskId`, `tagId` | |
| **TaskLink** | `id`, `projectId`, `fromTaskId`, `toTaskId`, `type` (blocks) | обе задачи в одном проекте, `from ≠ to`; «заблокирована» — обратная сторона blocks; циклов blocks нет; пара (from, to, type) уникальна. Связи relates и duplicates — после релиза |
| **TaskUrl** («Ссылки») | `id`, `taskId`, `url`, `title?`, `createdAt` | `url` начинается с http:// или https:// |
| **Comment** | `id`, `taskId`, `authorId`, `kind` (comment / status_reason), `body` (markdown, до 2000 символов), `mentions[]` (userId), `createdAt`, `editedAt?` | плоский список; `status_reason` создаётся при смене статуса с непустой причиной (обязательна для статуса с `requiresReason`), отображается как комментарий с пометкой причины; править может только автор (в том числе admin и owner — только свои); удалять — свой, admin и owner — любой |
| **Worklog** | `id`, `taskId`, `userId`, `date`, `minutes` (> 0), `comment?`, `createdAt` | править и удалять своё; admin и owner — любое |
| **Attachment** (после релиза, в резерве) | `id`, `taskId`, `commentId?`, `uploaderId`, `fileName`, `size`, `mime`, `storageKey`, `createdAt` | |
| **Watch** | `taskId`, `userId` | автор, исполнитель и ревьюер подписываются автоматически, так же автор комментария и упомянутые в нём; остальные — звёздочкой |
| **HistoryEvent** | `id`, `taskId`, `actorId`, `kind` (created / field_changed / link_added / link_removed / url_added / url_removed / tag_added / tag_removed / archived / restored / unassigned_on_member_removal), `field?`, `oldValue?`, `newValue?`, `createdAt` | отслеживаются поля: статус, исполнитель, ревьюер, приоритет, тип, направление, срок, оценка, связи, ссылки, теги (родитель после создания не меняется; значение `parent` оставлено в перечне `HistoryField` как резерв); комментарии и списания времени в историю не пишутся |
| **Notification** | `id`, `userId` (получатель), `type` (`assigned` / `reviewer_assigned` / `mentioned` / `commented` / `status_changed` / `assignee_changed` / `reviewer_changed`), `actorId`, `taskId`, `details?`, `createdAt`, `readAt?` | автор действия о своём действии не уведомляется; те же события уходят в Telegram, если `notifyTelegram` и Telegram привязан |
| **TelegramOutbox** | `id`, `userId`, `projectId`, `chatId`, `text`, `status` (pending / sent / failed), `attempts`, `nextAttemptAt`, `lastError?`, `createdAt`, `sentAt?` | внутренняя сущность бэкенда (рекомендация, [b08](backend/08-notifications-and-telegram.md), раздел 11): очередь сообщений в Telegram; перед отправкой проверяются активность, `notifyTelegram`, `telegramId = chatId` и членство |

### Вычисляемые поля задачи (не хранятся)
`spentMinutes` (сумма списаний), `subtaskCount`, `subtasksDone`, `subtasksEstimateMinutes`, `subtasksSpentMinutes`, `blocked` (есть незакрытая блокирующая задача), `isOverdue`, число задач на статусе / направлении / теге для страниц настроек.

## 3. Связи
```
User ──< Membership >── Project ──< Status
                           ├──< Board ──< BoardColumn >── Status
                           ├──< Subsystem
                           ├──< Tag
                           └──< Task ──< Subtask (Task.parentId)
Task ──< Comment, Worklog, Attachment, TaskUrl, HistoryEvent, Watch
Task ──< TaskTag >── Tag
Task ──< TaskLink >── Task
Task ──> User (reporter, assignee, reviewer), Status, Subsystem
User ──< Notification >── Task
```

## 4. Роли и ключи разрешений

### Принцип
Бэкенд отдаёт два списка ключей: глобальный в `GET /auth/me` и проектный в `GET /projects/:id/me` вместе с ролью. Ключи повторяют действия (формат `сущность-действие`, через дефис); в OpenAPI у каждой ручки указан `x-permission`. Тип `Permission` на фронте — объединение `GlobalPermission | ProjectPermission`, которое `openapi-typescript` строит из enum этих схем (vendor-расширение `x-permission` генераторы не читают, его соответствие enum сверяется вручную; генерация типов предлагается фронту и не является требованием к бэкенду). Каждый ключ принадлежит ровно одному списку: менять owner может только системный администратор, у проектных ролей такого ключа нет; архивации проекта в первой версии нет.

**Источник ключа для `*appCan`.** Структурная директива и функция проверки прав берут ключ из своего хранилища: `*appCan="'task-create'"` (проектный ключ, список из `GET /projects/:id/me` текущего проекта) и `*appCanGlobal="'project-create'"` (глобальный ключ, список из `GET /auth/me`). Параметр `scope` не нужен: тип ключа однозначно говорит, откуда его искать, а компилятор не даст передать в `*appCan` глобальный ключ.

### Глобальные ключи (системный администратор)
`user-list`, `user-invite`, `user-reissue-access`, `user-deactivate`, `project-create`, `project-list-all`, `project-change-owner`.

### Проектные ключи по ролям
| Ключ | viewer | member | admin | owner |
|---|---|---|---|---|
| `project-view`, `board-view`, `task-view`, `member-list` | ✓ | ✓ | ✓ | ✓ |
| `comment-create`, `watch-toggle` | ✓ | ✓ | ✓ | ✓ |
| `comment-update` | своё | своё | своё | своё |
| `comment-delete` | своё | своё | любое | любое |
| `task-create`, `task-update`, `task-move`, `link-manage`, `attachment-add` (резерв), `worklog-create`, `tag-create` | | ✓ | ✓ | ✓ |
| `task-archive`, `attachment-delete` (резерв), `worklog-update`, `worklog-delete` | | своё | любое | любое |
| `task-restore` | | | ✓ | ✓ |
| `project-update`, `status-manage`, `board-manage`, `subsystem-manage`, `tag-manage` | | | ✓ | ✓ |
| `member-add`, `member-remove`, `member-role-change` | | | ✓* | ✓ |
\* admin и owner различаются только тем, что owner нельзя изменить и удалить ни одному из них (проверяет бэкенд; Q-23, I-03).

### Как работает «своё»
Ключ у member и у admin один и тот же. Фронт скрывает кнопку, если автор не совпадает с `userId` и пользователь не `isProjectAdmin` (роль owner или admin); бэкенд проверяет то же. Относится к: `task-archive` (автор — `reporterId`), `comment-delete` (`authorId`), `worklog-update` и `worklog-delete` (`userId`), `attachment-delete` (`uploaderId`). Исключение — `comment-update`: правит только автор (`authorId`) у любой роли, `isProjectAdmin` права на чужое не даёт.

### Личные действия без ключей
Профиль, смена пароля, привязка и отвязка Telegram, уведомления, переключатель проектов.

### Видимость страниц и пунктов по ключам
| Что | Условие |
|---|---|
| Меню «Настройки проекта» | есть любой из `project-update`, `status-manage`, `board-manage`, `subsystem-manage`, `tag-manage` |
| Раздел «Администрирование» | есть `user-list` |
| Кнопка «+ Задача», «+ Подзадача» | `task-create` |
| Пункт «Архивные» в фильтре статуса | `task-restore` |
| Кнопки добавления, смены роли, удаления участников | `member-add`, `member-role-change`, `member-remove` (с учётом строки) |

## 5. Ключ → ручки
Таблица повторяет `x-permission` каждой операции OpenAPI и при изменении контракта обновляется вместе с ним. Источник — [backend/openapi/openapi.yaml](backend/openapi/openapi.yaml). Ключи вложений (`attachment-add`, `attachment-delete`) в резерве (после релиза, Q-05): ручек в OpenAPI нет. У ключей `status-manage` и `board-manage` ручки есть, но интерфейса в первой версии нет.

<!-- generated:key-to-endpoints:start -->
| Ключ | Ручки (OpenAPI) |
|---|---|
| `user-list` | `GET /admin/users` |
| `user-invite` | `POST /admin/users/invite` |
| `user-reissue-access` | `POST /admin/users/{id}/reissue` |
| `user-deactivate` | `POST /admin/users/{id}/deactivate`, `POST /admin/users/{id}/activate` |
| `project-create` | `POST /admin/projects` |
| `project-list-all` | `GET /admin/projects` |
| `project-change-owner` | `GET /admin/projects/{id}/members`, `POST /admin/projects/{id}/change-owner` |
| `project-view` | `GET /projects/{projectId}`, `GET /projects/{projectId}/me`, `GET /projects/{projectId}/statuses` |
| `board-view` | `GET /projects/{projectId}/boards`, `GET /boards/{boardId}`, `GET /boards/{boardId}/cards` |
| `task-view` | `GET /projects/{projectId}/subsystems`, `GET /projects/{projectId}/tags`, `GET /projects/{projectId}/tasks`, `GET /projects/{projectId}/tasks/by-key/{key}`, `GET /projects/{projectId}/tasks/search`, `GET /tasks/{taskId}/subtasks`, `GET /tasks/{taskId}/history`, `GET /tasks/{taskId}/comments`, `GET /tasks/{taskId}/worklogs` |
| `member-list` | `GET /projects/{projectId}/members` |
| `comment-create` | `POST /tasks/{taskId}/comments` |
| `watch-toggle` | `POST /tasks/{taskId}/watch`, `DELETE /tasks/{taskId}/watch` |
| `comment-update` | `PATCH /comments/{commentId}` |
| `comment-delete` | `DELETE /comments/{commentId}` |
| `task-create` | `POST /projects/{projectId}/tasks` |
| `task-update` | `PATCH /tasks/{taskId}` |
| `task-move` | `POST /tasks/{taskId}/move` |
| `link-manage` | `POST /tasks/{taskId}/links`, `DELETE /tasks/{taskId}/links/{linkId}`, `POST /tasks/{taskId}/urls`, `DELETE /tasks/{taskId}/urls/{urlId}` |
| `attachment-add` | — (резерв, ручек нет) |
| `worklog-create` | `POST /tasks/{taskId}/worklogs` |
| `tag-create` | `POST /projects/{projectId}/tags` |
| `task-archive` | `POST /tasks/{taskId}/archive` |
| `attachment-delete` | — (резерв, ручек нет) |
| `worklog-update` | `PATCH /worklogs/{worklogId}` |
| `worklog-delete` | `DELETE /worklogs/{worklogId}` |
| `task-restore` | `POST /tasks/{taskId}/restore` |
| `project-update` | `PATCH /projects/{projectId}` |
| `status-manage` | `POST /projects/{projectId}/statuses`, `PUT /projects/{projectId}/statuses/order`, `PATCH /statuses/{statusId}`, `DELETE /statuses/{statusId}` |
| `board-manage` | `POST /projects/{projectId}/boards`, `PATCH /boards/{boardId}`, `DELETE /boards/{boardId}` |
| `subsystem-manage` | `POST /projects/{projectId}/subsystems`, `PATCH /subsystems/{subsystemId}`, `DELETE /subsystems/{subsystemId}` |
| `tag-manage` | `PATCH /tags/{tagId}`, `DELETE /tags/{tagId}` |
| `member-add` | `POST /projects/{projectId}/members`, `GET /projects/{projectId}/member-candidates` |
| `member-remove` | `DELETE /projects/{projectId}/members/{userId}` |
| `member-role-change` | `PATCH /projects/{projectId}/members/{userId}` |
| без ключа (`none` или публичные) | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/telegram/start`, `POST /auth/telegram/status`, `GET /invitations/{token}`, `GET /invitations/{token}/username-available`, `POST /invitations/{token}/telegram/start`, `POST /invitations/{token}/accept`, `PATCH /profile`, `POST /profile/password`, `POST /profile/telegram/start`, `DELETE /profile/telegram`, `PATCH /profile/notifications`, `GET /projects`, `GET /notifications`, `GET /notifications/unread-count`, `POST /notifications/read-all`, `POST /notifications/{notificationId}/read`, `POST /telegram/webhook` |
<!-- generated:key-to-endpoints:end -->

## 6. Наблюдения для ТЗ и решения, которые надо принять
1. **Ключ подзадачи** (решено): обычный номер проекта `PROJ-152`, без точки; адрес `/p/PROJ/tasks/PROJ-152`.
2. **Архивация проекта** (решено, Q-05, Q-11, Q-23 I-25): в первой версии не делается — после релиза; в модели нет `status`/`archivedAt` проекта. Ключей `project-archive` и `project-transfer-owner` нет; менять owner может только системный администратор (`project-change-owner`).
3. **Причина смены статуса** хранится комментарием вида `status_reason`, а не отдельной сущностью.
4. **Ограничения длины** (решено): название задачи до 100 символов, описание до 5000, комментарий до 2000. По аналогии (подтвердить в ТЗ): названия проекта, статуса, доски, направления и тега до 100 символов, описание проекта до 5000, комментарий к списанию времени до 2000, причина смены статуса до 2000.
5. **Параллельные правки:** последнее сохранение побеждает на уровне поля; версионирования строки задачи нет.
6. **Пагинация** только у «Все задачи» (серверная), у уведомлений («Показать ещё»), у комментариев (последние 20); остальные списки отдаются целиком.

## 7. Рекомендация (необязательно): индексы, ограничения и внешние ключи
Не является требованием к бэкенду: схему хранения, индексы и ограничения выбирает разработчик. Сводка полезна для миграций; миграция пакета может создавать таблицу сразу с этими индексами. Колонка «ТЗ» — где правило описано подробнее.

| Сущность | Уникальные ключи | Индексы | ТЗ |
|---|---|---|---|
| User | `lower(username)` WHERE `username` IS NOT NULL; `telegramId` WHERE NOT NULL | — | b01 |
| Invitation | `tokenHash` | `(userId)` WHERE `usedAt` IS NULL | b01 |
| Session | `tokenHash` | `(userId)` | b01 |
| TelegramAuthRequest | `tokenHash` | `(expiresAt)` | b01 |
| Project | `key` | — | b02 |
| Membership | PK `(projectId, userId)` | `(userId)` | b02 |
| Status | `(projectId, lower(name))` | `(projectId, position)` | b03 |
| Board | `(projectId, lower(name))` | — | b03 |
| BoardColumn | PK `(boardId, statusId)` | `(statusId)` | b03 |
| Subsystem | `(projectId, lower(name))` | — | b03 |
| Tag | `(projectId, lower(name))` | — | b03 |
| Task | `(projectId, number)`; `(statusId, rank)` с `COLLATE "C"`, `DEFERRABLE INITIALLY DEFERRED` | `(projectId, archivedAt, updatedAt)`, `(projectId, assigneeId)`, `(projectId, reviewerId)`, `(projectId, statusId)`, `(parentId)` | b04, b05, b06 |
| TaskTag | PK `(taskId, tagId)` | `(tagId)` | b04 |
| TaskLink | `(fromTaskId, toTaskId, type)` | `(toTaskId)` | b05 |
| TaskUrl | — | `(taskId)` | b05 |
| Comment | — | `(taskId, createdAt, id)` | b06, b07 |
| Worklog | — | `(taskId)` | b07 |
| Attachment («важное») | — | `(taskId)` | — |
| Watch | PK `(taskId, userId)` | `(userId)` | b07 |
| HistoryEvent | — | `(taskId, createdAt)` | b04 |
| Notification | — | `(userId, createdAt desc, id)`; частичный `(userId)` WHERE `readAt` IS NULL | b08 |
| TelegramOutbox | — | `(status, nextAttemptAt)` | b08 |

**Политика внешних ключей.**
- `Task` → `Status`: RESTRICT (статус удаляется только через `moveTo`, задачи переносятся до удаления).
- `BoardColumn` → `Board`: CASCADE.
- `TaskTag` → `Tag`: CASCADE, после записи `tag_removed` в историю каждой задачи.
- `commentId` в `details` уведомления — не внешний ключ: комментарий может быть удалён, уведомление остаётся.
- Остальные внешние ключи — RESTRICT: физически удаляется только то, что названо в разделе 1.

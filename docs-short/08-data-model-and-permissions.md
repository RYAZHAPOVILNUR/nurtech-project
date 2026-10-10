# Модель данных и ключи разрешений (MVP)

Логическая модель MVP и роли. Источник правды по ролям и ключам — раздел 4 этого документа; поля и форматы — схемы [OpenAPI](backend/openapi/openapi.yaml); поведение — [ТЗ бэкенда](backend/00-conventions.md). Полная модель — `docs/13-data-model-and-permissions.md`.

## 1. Принципы
- Граница доступа — проект. Глобальных ролей в интерфейсе нет: пользователей и проекты заводит разработчик бэкенда служебными средствами.
- Связи между задачами, статусами, досками, тегами и направлениями — только внутри проекта.
- Задачи не удаляются и не архивируются: ненужную задачу закрывают статусом Cancelled. Физически удаляются комментарии, списания времени, ссылки и связи.
- Время — в минутах; моменты — в UTC (фронт показывает в поясе пользователя); даты без времени (срок, дата списания) — строки `YYYY-MM-DD` без пересчёта в пояс.
- Порядок карточек внутри статуса однозначен и общий для всех досок; наружу — непрозрачная строка `rank`.

## 2. Сущности
Служебные поля (хеши паролей и токенов, счётчик номеров, ранг, момент закрытия) в контракте не появляются или появляются только в нужном экрану виде; способ хранения решает разработчик бэкенда.

| Сущность | Поля | Правила |
|---|---|---|
| **User** | `id`, `name`, `username`, пароль (хеш), `createdAt` | `username` `^[a-z0-9_]{3,32}$`, уникален без учёта регистра, выбирается при принятии приглашения и не меняется; до принятия логина и пароля нет |
| **Invitation** | `userId`, `kind` (new / reissue), токен (хеш), `expiresAt` (7 дней), признак использования | одноразовое; новая ссылка отзывает прежние и сбрасывает пароль |
| **Session** | `userId`, токен (хеш), `expiresAt`, отзыв | httpOnly cookie `sid`; смена пароля отзывает остальные сессии |
| **Project** | `id`, `key`, `name`, `template` (dev / simple) | `key` 2–6 символов A–Z и 0–9, первая — буква, уникален, не меняется; шаблон создаёт статусы, доски и направления |
| **Membership** | `projectId`, `userId`, `role` (owner / admin / member / viewer) | пара уникальна; в проект добавляют только принявших приглашение |
| **Status** | `id`, `projectId`, `name`, `color` (8 фиксированных), `category` (backlog / todo / in_progress / done), `requiresReason`, порядок | создаёт шаблон; редактора нет |
| **Board** | `id`, `projectId`, `name`, колонки (статусы по порядку), базовый фильтр, `doneWindowDays` (по умолчанию 14) | создаёт шаблон или разработчик бэкенда; базовый фильтр применяет сервер |
| **Subsystem** («Направление») | `id`, `projectId`, `name` | создаёт шаблон (`dev`: Frontend, Backend) |
| **Tag** | `id`, `projectId`, `name` | имя уникально без учёта регистра; создаётся на лету в задаче |
| **Task** | `id`, `projectId`, `number`, `parentId?`, `type` (task / bug / subtask), `title` (до 100), `description?` (markdown, до 5000), `statusId`, `priority` (по умолчанию medium), `assigneeId?`, `reviewerId?`, `subsystemId?`, `dueDate?`, `estimateMinutes?`, `reporterId`, ранг, `createdAt`, `updatedAt`, момент закрытия | ключ `KEY-number` общей нумерации; `parentId` только у Subtask, ссылается на Task или Bug, не меняется; тип меняется только Task ↔ Bug; исполнитель и ревьюер — участники проекта |
| **TaskTag** | `taskId`, `tagId` | до 50 тегов на задачу |
| **TaskLink** | `id`, `fromTaskId`, `toTaskId`, `type` (blocks) | обе задачи в одном проекте, `from ≠ to`; «заблокирована» — обратная сторона; пара уникальна; циклов нет |
| **TaskUrl** («Ссылки») | `id`, `taskId`, `url`, `title?`, `createdAt` | `http://` или `https://`; до 50 на задачу |
| **Comment** | `id`, `taskId`, `authorId`, `kind` (comment / status_reason), `body` (до 2000), `createdAt`, `editedAt?` | `status_reason` создаёт перенос в статус с причиной; править — только автор; удалять — автор, admin и owner — любой |
| **Worklog** | `id`, `taskId`, `userId`, `date`, `minutes` (1–1440), `comment?`, `createdAt` | править и удалять своё; admin и owner — любое |
| **HistoryEvent** | `id`, `taskId`, `actorId`, `kind` (created / field_changed / link_added / link_removed / url_added / url_removed / tag_added / tag_removed), `field?`, `oldValue?`, `newValue?`, `createdAt` | поля: статус, исполнитель, ревьюер, приоритет, тип, направление, срок, оценка; плюс теги, связи, ссылки, создание. Название, описание, комментарии и списания не пишутся |

**Вычисляемые поля задачи** (не хранятся): `spentMinutes`, `subtasksEstimateMinutes`, `subtasksSpentMinutes`, `commentCount`, `blocked` (есть незакрытая блокирующая задача), `isOverdue`.

## 3. Связи
```
User ──< Membership >── Project ──< Status
                           ├──< Board (колонки → Status)
                           ├──< Subsystem
                           ├──< Tag
                           └──< Task ──< Subtask (Task.parentId)
Task ──< Comment, Worklog, TaskUrl, HistoryEvent
Task ──< TaskTag >── Tag
Task ──< TaskLink >── Task
Task ──> User (reporter, assignee, reviewer), Status, Subsystem
```

## 4. Роли и ключи разрешений
Бэкенд отдаёт список ключей проекта в `GET /projects/:projectId/me` вместе с ролью. Ключ повторяет действие (`сущность-действие`); у каждой ручки в OpenAPI указан `x-permission`. Тип `Permission` на фронте — enum `ProjectPermission` из OpenAPI. Директива `*appCan="'task-create'"` скрывает недоступные элементы.

| Ключ | viewer | member | admin | owner |
|---|---|---|---|---|
| `project-view`, `board-view`, `task-view`, `member-list` | ✓ | ✓ | ✓ | ✓ |
| `comment-create` | ✓ | ✓ | ✓ | ✓ |
| `comment-update` | своё | своё | своё | своё |
| `comment-delete` | своё | своё | любое | любое |
| `task-create`, `task-update`, `task-move`, `link-manage`, `worklog-create`, `tag-create` | | ✓ | ✓ | ✓ |
| `worklog-update`, `worklog-delete` | | своё | любое | любое |

В MVP admin и owner по правам не различаются: разница появится вместе со страницей «Участники» (полная версия).

**Как работает «своё».** Ключ у ролей один и тот же; фронт скрывает кнопку, если автор записи не совпадает с `userId` из `/me` и пользователь не `isProjectAdmin` (роль owner или admin); бэкенд проверяет то же. `comment-delete` — `authorId`; `worklog-update`, `worklog-delete` — `userId` записи. Исключение — `comment-update`: правит только автор у любой роли, `isProjectAdmin` права на чужое не даёт.

**Личные действия без ключей:** профиль, смена пароля, переключатель проектов.

### Видимость элементов по ключам
| Что | Условие |
|---|---|
| «+ Задача», «+ Подзадача» | `task-create` |
| Перетаскивание карточек, поле «Статус» | `task-move` |
| Правка полей, названия, описания, тегов | `task-update` |
| «Создать тег «…»» | `tag-create` |
| «+ Связь», «+ Ссылка», 🗑 у связей и ссылок | `link-manage` |
| Форма «Новая запись» на вкладке «Время» | `worklog-create` |

## 5. Ключ → ручки
| Ключ | Ручки |
|---|---|
| `project-view` | `GET /projects/{projectId}/me`, `GET /projects/{projectId}/statuses` |
| `board-view` | `GET /projects/{projectId}/boards`, `GET /boards/{boardId}/cards` |
| `task-view` | `GET /projects/{projectId}/subsystems`, `GET /projects/{projectId}/tags`, `GET /projects/{projectId}/tasks/by-key/{key}`, `GET /projects/{projectId}/tasks/search`, `GET /tasks/{taskId}/history`, `GET /tasks/{taskId}/comments`, `GET /tasks/{taskId}/worklogs` |
| `member-list` | `GET /projects/{projectId}/members` |
| `comment-create` | `POST /tasks/{taskId}/comments` |
| `comment-update` | `PATCH /comments/{commentId}` |
| `comment-delete` | `DELETE /comments/{commentId}` |
| `task-create` | `POST /projects/{projectId}/tasks` |
| `task-update` | `PATCH /tasks/{taskId}` |
| `task-move` | `POST /tasks/{taskId}/move` |
| `link-manage` | `POST /tasks/{taskId}/links`, `DELETE /tasks/{taskId}/links/{linkId}`, `POST /tasks/{taskId}/urls`, `DELETE /tasks/{taskId}/urls/{urlId}` |
| `worklog-create` | `POST /tasks/{taskId}/worklogs` |
| `worklog-update` | `PATCH /worklogs/{worklogId}` |
| `worklog-delete` | `DELETE /worklogs/{worklogId}` |
| `tag-create` | `POST /projects/{projectId}/tags` |
| без ключа (`none` или публичные) | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `GET /invitations/{token}`, `GET /invitations/{token}/username-available`, `POST /invitations/{token}/accept`, `PATCH /profile`, `POST /profile/password`, `GET /projects` |

## 6. Решения
1. Ключ подзадачи — обычный номер проекта (`PROJ-152`).
2. Причина смены статуса хранится комментарием `status_reason`.
3. Ограничения длины: название задачи и тега до 100 символов, описание до 5000, комментарий, причина и комментарий к списанию до 2000.
4. Параллельные правки: последнее сохранение побеждает на уровне поля.
5. Пагинация только у комментариев (последние 20 и «Показать ещё»).

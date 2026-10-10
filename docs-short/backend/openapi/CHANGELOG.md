# CHANGELOG контракта MVP

Формат строки: дата, версия, что изменилось, откуда решение. Ломающие изменения помечаются словом «Ломающее» и делаются только с согласия ментора.

## 2026-10-10 · 0.1.0 — первая версия MVP
Получена из полного контракта `docs/backend/openapi/openapi.yaml` 0.7.0. Пути, `operationId` и имена оставшихся полей не менялись; убрано то, что не нужно экранам MVP (доска, карточка, диалог создания, вход, приглашение, профиль). Решение ментора: [01-scope.md](../../01-scope.md), раздел «Что изменено против полной версии».

**Ручки: 35 вместо 80.**
- Убраны целиком: Telegram (`/auth/telegram/*`, `/invitations/{token}/telegram/start`, `/profile/telegram*`, `/profile/notifications`, `/telegram/webhook`); администрирование (`/admin/*`); уведомления (`/notifications*`); подписки (`/tasks/{taskId}/watch`); управление участниками (`POST`, `PATCH`, `DELETE` участников, `/member-candidates`); настройки проекта и редакторы справочников (`PATCH /projects/{projectId}`, `POST|PATCH|DELETE` статусов, досок, направлений, `PATCH|DELETE /tags/{tagId}`, `PUT /statuses/order`); список «Все задачи» (`GET /projects/{projectId}/tasks`); архивация (`/tasks/{taskId}/archive`, `/restore`).
- Убраны как лишние запросы: `GET /projects/{projectId}` (хватает `GET /projects` и `/me`), `GET /boards/{boardId}` (доски приходят списком, 404 даёт `/cards`), `GET /tasks/{taskId}/subtasks` (подзадачи встроены в `TaskDetail.subtasks`).
- Убраны параметры `search` у `GET /projects/{projectId}/members` и `GET /projects/{projectId}/tags`: списки небольшие, фильтрует фронт.

**Схемы.**
- `MeResponse` — только `{ user }` (без `permissions`, `mustChangePassword`). `User` — `{ id, name, username }`, `username` не nullable.
- `UserRef`, `Member` — `{ userId, name, username }` (без `active`; у `Member` без `role`).
- `AcceptInvitationRequest` — без `telegramToken`; `password` обязателен. `ChangePasswordRequest` — `current` обязателен.
- `ProjectPermission` — 15 ключей (без `watch-toggle`, `attachment-*`, `task-archive`, `task-restore`, `project-update`, `status-manage`, `board-manage`, `subsystem-manage`, `tag-manage`, `member-add`, `member-remove`, `member-role-change`). `GlobalPermission` удалён.
- `Status` — без `position`, `taskCount`, `boards` (порядок — порядок массива). `Subsystem`, `Tag` — без `taskCount`. `Board` — без `baseFilter`, `createdAt`. `BoardColumnCards` — без `requiresReason` (есть в `Board.columns`).
- `TaskSummary` удалён; `TaskDetail` — самостоятельная схема без `projectId`, `archived`, `archivedAt`, `resolvedAt`, `watching`, `subtaskCount`, `subtasksDone`; добавлено `subtasks: SubtaskItem[]`. `LinkedTask` — без `archived`.
- `HistoryKind` — без `archived`, `restored`, `unassigned_on_member_removal`; `HistoryField` — без резервного `parent`.
- `Comment`, `CreateCommentRequest`, `UpdateCommentRequest` — без `mentions`.
- `UpdateTaskRequest` — `additionalProperties: false`.

**Ошибки.**
- `ErrorCode` — 14 кодов вместо 37 (убраны коды Telegram, деактивации, владельцев и участников, ключа проекта, удаления статусов и досок, архива, `password_change_required`).
- `ErrorResponse.details` удалён: фронт на 409 не ветвится по коду.
- `FieldErrorReason` — 12 причин вместо 21. Вместо `use_move`, `immutable`, `locked` — общее `invalid` (лишнее поле в `PATCH`, тип подзадачи); вместо `invalid_order` — 409 `stale_position`; вместо `limit` у ссылок — `too_many`; `empty`, `mismatch`, `not_active`, `archived` не нужны.

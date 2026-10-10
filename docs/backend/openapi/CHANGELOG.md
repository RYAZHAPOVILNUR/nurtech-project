# Журнал изменений контракта API

Файл ведётся вместе с [openapi.yaml](openapi.yaml): любое изменение контракта (ручка, схема, поле, enum, пример) — это строка здесь и повышение minor в `info.version`. Правила — в [00-conventions.md](../00-conventions.md), раздел 8. Ломающие изменения (удаление или переименование ручки, поля, значения enum, смена типа или обязательности) допускаются только с согласия ментора и помечаются словом «Ломающее». Пока major равен 0, фронту предлагается перегенерировать типы после каждого изменения (скрипт `api:gen` и шаг CI предлагаются фронту; это не требование к бэкенду).

Источник решений — [docs/decisions.md](../../decisions.md) (Q-…); метки находок (R-, I-, C-…) ссылаются на удалённый аудит и оставлены как история.

## 0.7.0 — 2026-10-09 (последние неоднозначности перед заморозкой, recheck-2 §8)

### Добавлено
- `BoardColumnCards.requiresReason` (обязательное булево, значение как у статуса колонки): диалог причины на доске не требует `getBoard` или `listStatuses` (RR-31 = RR-50; страница 07 ждала поле в ответе карточек).

### Изменено
- `CreateTaskRequest.statusId`, `priority`, `parentId` и `MoveTaskRequest.prevId`, `nextId` — `nullable: true`. Правило: в POST `null` равен отсутствию поля; в PATCH отсутствие — не менять, `null` — очистить (где поле очищаемо); `null` у `title`, `type`, `priority` в `updateTask` — 422 `invalid` (RR-10, R-07).
- Описания `createTask` и `updateTask`: причины 422, которые схема не выражает, — `type = subtask` и любой `type` у подзадачи → `locked`; больше 50 значений `tagIds` → `too_many`; повторы → `duplicate` (RR-11, RR-12). Таблица «нарушение схемы → причина в `fields`» — в b00 §3.
- `moveTask`, `MoveTaskRequest.prevId`, `nextId`: сосед, не найденный в проекте (в том числе неизвестный UUID), архивированный или находящийся не в целевом статусе, — 409 `stale_position`; слово «удалён» для задач убрано, задачи не удаляются (RR-32).
- Описание `ProjectPermission`: скрипт `docs-sources.mjs` и шаг CI предлагаются фронту, это не требование к бэкенду (R-14).

## 0.6.0 — 2026-10-09 (фиксация контракта: принцип «контракт + наблюдаемое поведение», recheck §0, §7)

### Добавлено
- Общие ответы `BadRequest` (400, `bad_request`) и `InternalError` (500, `internal_error`) подключены ко всем операциям (R-07).
- `NotificationType`: значение `reviewer_changed` — подписчики задачи узнают о смене и снятии ревьюера; `details` как у `assignee_changed` (Q-33 б).
- `BoardColumn.requiresReason` (обязательное булево): доске не нужен `listStatuses` для диалога причины (R-77).
- Заголовок `Retry-After` в ответе `TooManyAttempts`; ответ 429 у `changePassword` (R-57).
- Ответ 404 у `receiveTelegramWebhook` (режим polling) (R-46).

### Изменено
- `ChangePasswordRequest.current` и описание `changePassword` (R-03, R-04; Q-35, Q-36′ а): `current` обязателен, кроме `mustChangePassword = true`; пользователь без пароля получает 422 `fields.current = required` — установки пароля без пароля нет. Заголовок операции: «Сменить пароль».
- `moveTask`, `MoveTaskRequest.prevId`, `nextId`, `reason` (R-01, R-22; Q-37): `prevId` и `nextId` — соседи, которых пользователь видит; карточка встаёт между ними даже при скрытых фильтром и архивных задачах между ними; 409 `stale_position` — только если сосед ушёл из статуса, архивирован, удалён или это сама задача; `reason` без смены статуса игнорируется (схема приведена к описанию операции).
- `InvitationInfo.kind`, `reissueUserAccess`, `AcceptInvitationRequest.username`, `acceptInvitation` (R-05, R-18, R-19, R-27, R-28): «Новая ссылка» пользователю без логина даёт `kind = new` (логин обязателен при `accept`); для `new` логин передаётся всегда, и в Telegram-ветке; только в нижнем регистре; ответ — `MeResponse`; приглашение одноразовое и недействительно после деактивации (описания).
- `deactivateUser`: деактивация отзывает приглашения и открытые Telegram-запросы, повтор — 200 (R-27, R-65).
- `changeMemberRole`, `removeMember`: порядок ответов «сам себя» раньше «цель — owner» (R-29).
- `Member.active`, `UserRef.active` (R-34; Q-32 а): `false` только у деактивированного; приглашённый после «Новой ссылки» отдаётся с `true`.
- Описание параметра `q` у `listTasks`, `searchTasks`, `getBoardCards` (R-30; Q-43 а): по ключу ищутся только запросы вида `12`, `-12`, `DEMO-12`.
- `createTaskLink`: при проверке цикла учитываются связи архивных задач (R-31).
- `updateComment`: править может только автор, у любой роли; чужой — 403 (R-09; Q-26).
- `listBoards`: порядок «в порядке создания; шаблон Dev team: „Разработка“, затем „Планирование“» (R-06). Поля `position` нет.
- `listTasks.sort` — enum из восьми значений, `default: updatedAt:desc`; элементы `assignee`, `reviewer`, `subsystem` — `anyOf` UUID или константа; `uniqueItems` у query-параметров `listTasks` и `getBoardCards` убран (повтор значения не ошибка) (R-50).
- `NotificationDetails`: всегда объект, `nullable` убран; у `assigned` и `reviewer_assigned` все поля `null` (R-71).
- `login`: тело, не прошедшее проверку длины, — 401 `invalid_credentials` (R-57, R-59 — регистр логина не важен).

### Удалено
- Ответ 409 у `updateProject`, `reorderStatuses`, `deleteTag`, `createTask`, `watchTask`, `unwatchTask`: остался от `project_archived`, ТЗ этих кодов не называет (R-46).

### Не менялось
- `operationId`, ключи прав, пути и перечни `ErrorCode`/`FieldErrorReason`; поле порядка досок не вводилось (Q-38).

## 0.5.0 — 2026-10-08 (пакет 6: план и скоуп, Q-05 и Q-23)

### Удалено
- **Ломающее** (Q-23, I-17: окно удаления участника без чисел): `GET /projects/{projectId}/members/{userId}/impact` (`getMemberImpact`) и схема `MemberImpact`.
- **Ломающее** (Q-23, I-25: архивация проекта целиком — после релиза): схема `ProjectStatus`; поля `status` и `archivedAt` у `Project`, `ProjectListItem` и `AdminProject`; query-параметр `status` у `GET /admin/projects` (`listAdminProjects`); код ошибки `project_archived` из `ErrorCode` и описания `Conflict`. Порядок `GET /projects` и `GET /admin/projects` — по названию.
- **Ломающее** (Q-23, I-07: только blocks / blocked by): значения `relates` и `duplicates` из `LinkTypeInput` и `LinkType`.

### Изменено
- Описания `addMembers`, `changeMemberRole`, `removeMember` (Q-23, I-03): admin и owner равны, нельзя изменить и удалить только owner (409 `owner_role_locked`); роль admin admin назначает так же, как owner. Новых ответов и кодов нет.
- Описания `restoreTask` и заголовок (Q-23, I-16): восстановление родителя возвращает все его подзадачи; служебного поля каскада в контракте не было.

### Не менялось (решено оставить)
- Ручки статусов и досок (`status-manage`, `board-manage`) остаются в контракте: редакторы в интерфейсе — после релиза (Q-05), статусы и доски создаёт шаблон, ручки готовит бэкенд и принимает ментор.
- Ключи `attachment-add` и `attachment-delete` остаются в `ProjectPermission` как резерв (после релиза, Q-05): ручек нет.

## 0.4.0 — 2026-10-08 (пакет 3, сверка с Q-05 и Q-23)

### Удалено
- **Ломающее** (Q-05, Q-23: архивация проекта целиком — после релиза): `POST /admin/projects/{id}/archive` (`adminArchiveProject`) и `POST /admin/projects/{id}/restore` (`adminRestoreProject`).
- **Ломающее**: ключ `project-archive` из `GlobalPermission` (теперь 7 глобальных и 28 проектных ключей).
- **Ломающее**: коды ошибок `project_already_archived` и `project_not_archived` из `ErrorCode` и описания `Conflict`.

### Не менялось (оставлено как задел)
- `Project.status`, `archivedAt`, фильтр `status` в `listAdminProjects` и код `project_archived` остаются: убрать их нужно решением вместе с пакетами, где они используются. (Убраны в 0.5.0.)

## 0.3.0 — 2026-10-08 (пакет 4 исправлений)

### Изменено
- **Ломающее** (Q-04 = а, Q-14: формулировка по умолчанию, ментор не возражал): `GET /auth/telegram/status?token=` → `POST /auth/telegram/status` с телом `{ token }` (`getTelegramStatus` → `pollTelegramStatus`, новая схема `TelegramStatusRequest`). Ручка создаёт сессию и привязывает Telegram, поэтому не GET; токен не попадает в адрес, `Referer` и журналы доступа (C-04, B-09). Опрос раз в 2 секунды остаётся.
- Описания `pollTelegramStatus`, `acceptInvitation`, `receiveTelegramWebhook`: подтверждение входа, приглашения и привязки кнопкой в боте (`callback_query` от того же `from.id`), закрытие запроса по целям, проверки `telegramToken` при `accept` (B-02, C-01, C-08).
- **Ломающее** (Q-24): `before` в `GET /tasks/{taskId}/comments` и `GET /notifications` — непрозрачный курсор из пары (`createdAt`, `id`) вместо UUID записи; в `CommentPage` и `NotificationPage` добавлено обязательное поле `nextCursor` (`null`, если `hasMore = false`) (B-11).
- **Ломающее** (Q-25): `GET /projects/{projectId}/member-candidates`: `search` обязателен, не короче 2 символов; добавлен ответ 422 (C-14).
- Описания `listTasks`, `getBoardCards` (Q-24): неизвестный UUID в фильтре игнорируется, `archived=true` — только архивные Task и Bug (B-26, B-35).
- Описание `moveTask` (Q-24): при неизменном статусе `reason` игнорируется (раньше 422 `not_allowed`), повторный запрос — успех (B-16).

### Не менялось (решено не вносить)
- Статуса `cancelled`/`rejected` для кнопки «Это не я» нет: запрос закрывается со статусом `expired`, чтобы не расширять enum `TelegramStatusResponse.status`.

## 0.2.0 — 2026-10-08 (пакет 3 исправлений)

### Добавлено
- `GET /admin/projects/{id}/members` (`listAdminProjectMembers`, `project-change-owner`, ответ `MemberList`): участники любого проекта для выбора нового owner в админке. Системный администратор не участник, обычная `GET /projects/{projectId}/members` отвечает ему 404 (A-01, Q-11).
- `TaskDetail.commentCount` (обязательное целое ≥ 0): счётчик на вкладке «Комментарии» (A-05, Q-17).
- В `info.description` — правило источника истины и версионирования (G-22).

### Изменено
- **Ломающее** (вариант «перенести под `/projects/{projectId}/`» из S-18; согласие ментора на слияние нужно, фронт на этих ручках ещё не работает): `GET /tasks/by-key/{key}` → `GET /projects/{projectId}/tasks/by-key/{key}` (`getTaskByKey`). Префикс ключа должен совпасть с ключом проекта из пути, иначе 404. Исчезли 10 предупреждений `no-ambiguous-paths` (B-19, B-18).
- **Ломающее**: `GET /tasks/search?projectId=` → `GET /projects/{projectId}/tasks/search` (`searchTasks`); query-параметр `projectId` убран, проект определяется только по пути (B-18).
- Описание `ProjectPermission` и `GlobalPermission`: тип `Permission` на фронте строится из enum; `x-permission` сверяет скрипт `docs-sources.mjs`; шаг CI предлагается фронту, это не требование к бэкенду (G-23, R-14).
- Описания `changeProjectOwner`, `adminArchiveProject`, `adminRestoreProject`: это единственный путь соответствующего действия.

### Удалено
- **Ломающее** (Q-11 = в, решение принято, закрывает I-05): `POST /projects/{projectId}/transfer-owner` (`transferProjectOwner`), `POST /projects/{projectId}/archive` (`archiveProject`), `POST /projects/{projectId}/restore` (`restoreProject`). Смену owner, архивацию и возврат из архива делает только системный администратор через `/admin/projects/...`.
- **Ломающее**: схема `TransferOwnerResponse`.
- **Ломающее**: из enum `ProjectPermission` убраны `project-archive` и `project-transfer-owner`. `project-archive` остаётся только в `GlobalPermission`: ключ больше не встречается в двух списках (G-23). В `GET /projects/{projectId}/me` архивного проекта у owner больше нет ключа `project-archive`.

### Не менялось (решено не вносить)
- Смена логина: ручка `PATCH /admin/users/{id}` не добавляется, обещание убрано из документов 10 и 13 (Q-12 = а, A-03).
- `updatedBy` в `TaskDetail` не добавляется, счётчики времени и истории не добавляются; вместо «Обновил Y» показывается «обновлено N назад» по `updatedAt` (Q-17 = а, A-04).
- Моки и Prism не вводятся (Q-02: бэкенд вне скоупа, моков на фронте нет), поэтому S-19 не выполняется; примеры в контракт не добавляются (S-19 не выполняется).

## 0.1.0

Первая версия: пакеты 1–8 (вход, приглашения, сессия, профиль, администрирование пользователей; проекты, участники, права; статусы, доски, направления, теги; задачи; связи, ссылки, поиск, список; карточки досок и перенос; комментарии, списания, подписки; уведомления и webhook бота).

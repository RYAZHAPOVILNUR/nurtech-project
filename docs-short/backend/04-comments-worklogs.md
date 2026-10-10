# ТЗ бэкенда MVP, пакет 4: комментарии и списания времени

Продукт: [05-task-card.md](../05-task-card.md) (вкладки «Комментарии» и «Время»). Соглашения: [00-conventions.md](00-conventions.md). Контракт: [openapi/openapi.yaml](openapi/openapi.yaml), теги Comments и Worklogs.

**Зависит от:** пакеты 1–3. С этого пакета `spentMinutes`, `subtasksSpentMinutes` и `commentCount` в `TaskDetail` считаются по реальным данным.

Разделы 1–6 — требования, раздел 7 — рекомендации (необязательно).

## 1. Цель и границы
Дать фронту вкладки карточки «Комментарии» и «Время».
- Не входит: упоминания с уведомлениями (в MVP «Ответить» просто вставляет `@username` в текст, бэкенд его не разбирает), подписки, вложения.

## 2. Комментарии
**Модель:** `id`, `taskId`, `authorId`, `kind` (`comment` | `status_reason`), `body`, `createdAt`, `editedAt?`.
- `body`: после `trim` 1–2000 символов (длина считается по обрезанному тексту, хранится исходный — отступы markdown сохраняются). Бэкенд не рендерит и не очищает markdown.
- `status_reason` создаёт только `move` ([03](03-board-and-move.md)); через ручки этого пакета создать такой комментарий нельзя, читаются, правятся и удаляются они по общим правилам.
- Список плоский.

**Права.** Читать — `task-view`. Писать — `comment-create` (все роли, включая viewer). Править — `comment-update`: **только автор**, у любой роли; чужой комментарий не правит никто, включая admin и owner (403). Удалять — `comment-delete`: свой — любая роль; чужой — только admin и owner (иначе 403).

**`updatedAt` задачи** обновляется при создании, правке и удалении комментария. В историю комментарии не пишутся.

| Ручка | Права | Поведение |
|---|---|---|
| `GET /tasks/:taskId/comments?before=&limit=` | `task-view` | `{ items: [Comment], hasMore, nextCursor }`. Без `before` — последние `limit` (по умолчанию 20, максимум 50); с `before` — `limit` более ранних. Внутри ответа — от старых к новым. `nextCursor` — курсор самого раннего показанного, `null` при `hasMore = false`. Порядок по (`createdAt`, `id`); удалённый комментарий-курсор выдачу не ломает ([00](00-conventions.md), раздел 5) |
| `POST /tasks/:taskId/comments` `{ body }` | `comment-create` | `kind = comment`, автор — текущий пользователь. 422 (`fields.body = required` / `too_long`). 201 `Comment` |
| `PATCH /comments/:commentId` `{ body? }` | `comment-update` | Чужой — 403. `editedAt` ставится, если текст изменился. Без полей — 200 без изменений. 200 `Comment` |
| `DELETE /comments/:commentId` | `comment-delete` | Физическое удаление; чужой (не admin/owner) — 403. 204 |
`Comment` = `{ id, taskId, kind, body, author: UserRef, createdAt, editedAt }`. Комментарий другого проекта или несуществующий — 404.

## 3. Списания времени
**Модель** `Worklog`: `id`, `taskId`, `userId`, `date`, `minutes`, `comment?`, `createdAt`.
- `minutes` — 1–1440 (до 24 ч за запись); формат `2h 30m` разбирает фронт.
- `date` — `YYYY-MM-DD`, фронт передаёт локальную дату пользователя; без поля — сегодня по UTC. Не позже завтрашней даты UTC (запас на часовые пояса), иначе 422 (`fields.date = in_future`); в прошлое — без ограничений.
- `comment` — до 2000 символов, пустой — `null`.
- Несколько записей одного человека на одну дату допустимы. Автор записи при правке админом не меняется.

**Права.** Читать — `task-view` (viewer видит вкладку без формы). Создавать — `worklog-create` (member, admin, owner). Править и удалять — `worklog-update` / `worklog-delete`: своё у member, любое у admin и owner (иначе 403).

**Суммы.** `spentMinutes` — сумма `minutes` записей задачи; `subtasksSpentMinutes` у родителя — сумма `spentMinutes` подзадач. Списания не меняют `updatedAt` и не пишутся в историю.

| Ручка | Права | Поведение |
|---|---|---|
| `GET /tasks/:taskId/worklogs` | `task-view` | `{ items: [Worklog], totalMinutes }` без пагинации; порядок: `date` по убыванию, затем `createdAt` по убыванию |
| `POST /tasks/:taskId/worklogs` `{ minutes, date?, comment? }` | `worklog-create` | От имени текущего пользователя. 422 (`minutes = invalid`, `date = invalid` / `in_future`, `comment = too_long`). 201 `Worklog` |
| `PATCH /worklogs/:worklogId` `{ minutes?, date?, comment? }` | `worklog-update` | Чужая (не admin/owner) — 403. 200 `Worklog` |
| `DELETE /worklogs/:worklogId` | `worklog-delete` | Чужая (не admin/owner) — 403. 204 |
`Worklog` = `{ id, taskId, user: UserRef, date, minutes, comment, createdAt }`.

## 4. Тестовые данные (`DEV_SEED=true`)
- В `DEMO` у задачи с подзадачами — больше 25 комментариев разных авторов (проверка «Показать ещё»), в том числе свои и чужие для `clara_member`, `boris_admin`, `eva_viewer`; один изменённый (`editedAt`); комментарии-причины у задач в Blocked и Cancelled.
- Списания у 5–6 задач от разных участников, в том числе у подзадач (чтобы у родителя была строка «по подзадачам»).

## 5. Критерии приёмки
1. Комментарии: создание добавляет комментарий в конец ленты, `commentCount` растёт; 2001 символ — 422 `too_long`; пустой — 422 `required`.
2. Курсор: у задачи с 26+ комментариями первый запрос отдаёт последние 20 и `hasMore = true`; запрос с `nextCursor` — более ранние без пропусков и повторов, в том числе если комментарий-курсор удалили между запросами; `before=abc` — 422.
3. Правка: автор правит свой (появляется `editedAt`); `boris_admin` и `anna_owner` правят чужой — 403; удаляют чужой — 204; `clara_member` удаляет чужой — 403, свой — 204; `eva_viewer` пишет, правит и удаляет свой.
4. `updatedAt` задачи меняется после создания, правки и удаления комментария и не меняется после списания времени.
5. Списания: `0`, `1441`, дата послезавтра (UTC) — 422; дата завтра — 201; `spentMinutes` задачи и `subtasksSpentMinutes` родителя пересчитаны; `totalMinutes` — сумма записей.
6. `clara_member` правит и удаляет своё списание, чужое — 403; `boris_admin` — любое; `eva_viewer` создать не может — 403.
7. Комментарий или списание из чужого проекта — 404.

## 6. Открытых вопросов нет

## 7. Рекомендации (необязательно)
- Суммы времени и `commentCount` вычислять запросом (не хранить), пакетно для карточки.
- Курсор — base64url от (`createdAt`, `id`); индекс `(taskId, createdAt, id)`.

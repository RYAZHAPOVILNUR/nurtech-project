# ТЗ бэкенда MVP, пакет 1: вход, профиль, проекты, справочники

Продукт: [07-account-and-shell.md](../07-account-and-shell.md) (вход, приглашение, профиль, верхняя панель), [04-board.md](../04-board.md) (доски). Соглашения: [00-conventions.md](00-conventions.md). Модель и ключи: [08](../08-data-model-and-permissions.md). Контракт: [openapi/openapi.yaml](openapi/openapi.yaml), теги Session, Invitations, Profile, Projects, Members, Statuses, Boards, Subsystems, Tags.

Разделы 1–8 — требования, раздел 9 — рекомендации (необязательно).

## 1. Цель и границы
Дать фронту вход по паролю, принятие приглашения, профиль, список проектов пользователя, права в проекте, участников (для выбора исполнителя) и справочники проекта (статусы, доски, направления, теги).
- Не входит: Telegram, администрирование пользователей и проектов, управление участниками, настройки проекта и редакторы справочников. Всё, что в полной версии делалось через эти экраны, разработчик бэкенда делает служебными средствами ([00](00-conventions.md), раздел 1).

## 2. Пользователь, приглашение, сессия
- **Пользователь:** `name` 1–100 символов; `username` — `^[a-z0-9_]{3,32}$`, хранится в нижнем регистре, уникален без учёта регистра, выбирается при принятии приглашения и потом не меняется. Пока приглашение не принято, логина и пароля нет, войти нельзя.
- **Пароль:** 8–128 символов, хотя бы одна буква и одна цифра.
- **Приглашение:** одноразовое, срок `INVITATION_TTL_DAYS` (7 дней). Вид `new` — у пользователя ещё нет логина; `reissue` — логин есть, ссылка выдана вместо забытого пароля. Новая ссылка делает прежние недействительными и сбрасывает пароль.
- **Сессия:** cookie `sid`, срок `SESSION_TTL_DAYS` (7 дней) с продлением при активности, абсолютный предел 30 дней.

## 3. Ручки входа и профиля
| Ручка | Права | Поведение |
|---|---|---|
| `POST /auth/login` `{ username, password }` | public | `username` перед поиском обрезается и приводится к нижнему регистру. Успех: 200 `{ user }`, `Set-Cookie: sid`. Нет пользователя, неверный пароль, пользователь без пароля, слишком длинные поля — 401 `invalid_credentials` (одинаковый ответ, время ответа не зависит от существования логина). Лимиты неудачных попыток за 15 минут: 10 на пару (логин, IP), 20 на логин, 30 на IP; при превышении — 429 `too_many_attempts` с `Retry-After` в секундах |
| `POST /auth/logout` | none | Отзывает текущую сессию, очищает cookie. 204 |
| `GET /auth/me` | none | 200 `{ user: { id, name, username } }`. Нет сессии — 401 |
| `GET /invitations/:token` | public | 200 `{ name, kind, username }`; у `new` `username = null`, у `reissue` — текущий логин. Токена нет, он использован, просрочен или заменён новой ссылкой — 404 `invitation_invalid` (один и тот же ответ) |
| `GET /invitations/:token/username-available?username=` | public | 200 `{ available, reason }`, `reason`: `taken`, `invalid` (формат) или `null`. Недействительный токен — 404 `invitation_invalid` |
| `POST /invitations/:token/accept` `{ username?, password }` | public | `new`: `username` обязателен (422 `required`), в нижнем регистре по формату (заглавные — 422 `invalid`, приводит фронт), занят — 409 `username_taken`. `reissue`: `username` не передаётся (422 `not_allowed`). Слабый пароль — 422 (`fields.password = invalid`). Успех: пароль установлен, приглашение закрыто, 200 `{ user }` и `Set-Cookie: sid`. Из двух одновременных запросов успешен один, второй — 404 `invitation_invalid` |
| `PATCH /profile` `{ name }` | none | Меняет имя (1–100 символов). 200 `{ user }` |
| `POST /profile/password` `{ current, next }` | none | Неверный `current` — 422 (`fields.current = invalid`); неверные попытки считаются теми же счётчиками, что и вход, при превышении — 429. Слабый `next` — 422 (`fields.next = invalid`). Успех: 204, остальные сессии пользователя отозваны, текущая остаётся |

## 4. Проекты, права, участники
**Проект:** `key` — `^[A-Z][A-Z0-9]{1,5}$`, уникален, не меняется; `name` 1–100 символов. **Членство:** пара (проект, пользователь) уникальна, роль `owner` | `admin` | `member` | `viewer`. Владелец проекта — ментор (роль owner).

| Ручка | Права | Поведение |
|---|---|---|
| `GET /projects` | none | Проекты, где пользователь участник: `{ items: [{ id, key, name, role }] }`, по названию, без пагинации. Пустой список — фронт показывает экран «Вас ещё не добавили в проекты» |
| `GET /projects/:projectId/me` | `project-view` | `{ userId, role, permissions }`; `permissions` — ключи роли по матрице [08](../08-data-model-and-permissions.md), раздел 4. Фронт запрашивает при входе в проект и после любого 403 |
| `GET /projects/:projectId/members` | `member-list` | Все участники: `{ items: [{ userId, name, username }] }`, по имени, без пагинации |

Права: ручка, для которой у роли нет ключа, отвечает 403. Ключи с пометкой «своё» (`comment-update`, `comment-delete`, `worklog-update`, `worklog-delete`) отдаются в `/me` по матрице; принадлежность записи проверяется в самой ручке ([04](04-comments-worklogs.md)).

## 5. Справочники
**Статус:** `id`, `name`, `color` (`gray`, `blue`, `cyan`, `green`, `yellow`, `orange`, `red`, `purple`), `category` (`backlog`, `todo`, `in_progress`, `done`), `requiresReason`. Категория `done` — «закрыто»: окно Done на доске, срок не краснеет. **Доска:** `id`, `name`, `columns` (статусы по порядку, у колонки `{ statusId, name, color, category, requiresReason }`), `doneWindowDays` (1–365, по умолчанию 14), а также базовый фильтр, который применяет сервер и не отдаёт наружу ([03](03-board-and-move.md)). **Направление** и **тег:** `id`, `name`.

| Ручка | Права | Поведение |
|---|---|---|
| `GET /projects/:projectId/statuses` | `project-view` | `{ items: [Status] }` в порядке workflow (как в таблице шаблона) |
| `GET /projects/:projectId/boards` | `board-view` | `{ items: [Board] }` в порядке создания (первая доска открывается по умолчанию) |
| `GET /projects/:projectId/subsystems` | `task-view` | `{ items: [{ id, name }] }` по названию; пустой список — фронт скрывает поле «Направление» |
| `GET /projects/:projectId/tags` | `task-view` | `{ items: [{ id, name }] }` по названию, все теги проекта |
| `POST /projects/:projectId/tags` `{ name }` | `tag-create` | Создаёт тег (1–100 символов после `trim`). Имя уже есть без учёта регистра — 409 `name_taken` (`fields.name = taken`). 201 `{ id, name }` |

## 6. Шаблоны проекта
Шаблон применяется один раз, когда разработчик бэкенда создаёт проект: проект создаётся целиком вместе со статусами, досками и направлениями.

**`dev` («Dev team»).** Статусы по порядку:
| Название | Категория | Цвет | `requiresReason` |
|---|---|---|---|
| Backlog | `backlog` | `gray` | нет |
| PBR | `backlog` | `purple` | нет |
| Plan | `todo` | `blue` | нет |
| To do | `todo` | `cyan` | нет |
| Reopened | `todo` | `orange` | нет |
| In progress | `in_progress` | `yellow` | нет |
| In review | `in_progress` | `purple` | нет |
| In test | `in_progress` | `blue` | нет |
| For release | `in_progress` | `cyan` | нет |
| Blocked | `in_progress` | `red` | **да** |
| Done | `done` | `green` | нет |
| Cancelled | `done` | `gray` | **да** |

Доски (в таком порядке): **Разработка** — To do, Reopened, In progress, In review, In test, For release, Blocked, Done; **Планирование** — Backlog, PBR, Plan, To do. Базовый фильтр пустой, окно Done 14 дней. Колонки Cancelled нет: статус ставится в карточке задачи. Направления: Frontend, Backend.

**`simple`.** Статусы To do (`todo`, `cyan`), In progress (`in_progress`, `yellow`), Done (`done`, `green`), Cancelled (`done`, `gray`, причина обязательна). Доска **Основная**: To do, In progress, Done. Направлений нет.

Дополнительные доски-фильтры (например, «Frontend» с фильтром по направлению Frontend) создаёт разработчик бэкенда по просьбе ментора.

## 7. Тестовые данные (`DEV_SEED=true`)
- Пользователи (пароль `DEV_SEED_PASSWORD`): `anna_owner`, `boris_admin`, `clara_member`, `denis_member`, `eva_viewer`, `hanna_free` (активна, ни в одном проекте). Плюс `gleb_invited` — с действующей ссылкой-приглашением вида `new` (ссылка печатается в журнал при старте сида).
- Проект `DEMO` (шаблон `dev`): `anna_owner` — owner, `boris_admin` — admin, `clara_member` и `denis_member` — member, `eva_viewer` — viewer. Теги `release`, `tech-debt`, `ux`. Дополнительная доска «Frontend» с фильтром по направлению Frontend.
- Проект `SIMPLE` (шаблон `simple`): `boris_admin` — owner, `clara_member` — member.

## 8. Критерии приёмки
1. Вход: верные данные — 200 и cookie; `Anna_Owner` входит как `anna_owner`; неверный пароль и несуществующий логин дают одинаковый 401; 11-я неудачная попытка с одной пары (логин, IP) за 15 минут — 429 с `Retry-After`.
2. `GET /auth/me` без cookie — 401; после `logout` прежняя cookie — 401.
3. Приглашение `new`: `GET` отдаёт имя и `kind = new`; `username-available` отвечает `taken` для `anna_owner` и `invalid` для `A!`; `accept` без логина — 422, с занятым — 409 `username_taken`, со слабым паролем — 422; успешный `accept` создаёт сессию; повторный `accept` и `GET` по той же ссылке — 404 `invitation_invalid`.
4. Приглашение `reissue`: `GET` отдаёт текущий логин; `accept` с `username` — 422 `not_allowed`; без него — 200, новый пароль работает, старый — нет.
5. Два одновременных `accept` одной ссылки (20 повторов): один 200, второй 404.
6. `PATCH /profile` меняет имя (пустое — 422, 101 символ — 422 `too_long`); `POST /profile/password` с неверным `current` — 422 `invalid`, с верным — 204, вторая сессия пользователя после этого получает 401.
7. `GET /projects` у `clara_member` — `DEMO` и `SIMPLE` с ролями, у `hanna_free` — пустой список.
8. `GET /projects/<DEMO>/me` у каждой роли отдаёт ключи ровно по матрице [08](../08-data-model-and-permissions.md), раздел 4; у `hanna_free` — 404; не UUID в пути — 404.
9. Участники `DEMO` — пять человек по имени; статусы `DEMO` — 12 в порядке шаблона; доски — «Разработка», «Планирование», «Frontend» с колонками в порядке шаблона и `requiresReason` у Blocked; направления — Frontend, Backend; у `SIMPLE` направлений нет.
10. Тег: создание `Release` при существующем `release` — 409 `name_taken`; `eva_viewer` — 403; два одновременных создания одного имени (20 повторов) — один 201, второй 409.
11. В OpenAPI у каждой ручки пакета есть `x-permission` или `x-public`.

## 9. Рекомендации (необязательно)
- Счётчики неудачных попыток входа хранить в памяти или Redis со скользящим окном 15 минут.
- Служебные команды: `create-user --name`, `reissue --username`, `create-project --key --name --template`, `add-member --project --username --role`, `create-board --project --name --columns --filter`; каждая печатает результат (ссылку-приглашение — один раз).
- Шаблон проекта создавать в одной транзакции с проектом.

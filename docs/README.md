# Документация проекта

Учебный таск-менеджер (Angular 21 + Taiga UI + ngrx-signals). Документы идут в порядке проработки; номер 03 пропущен (эпики вырезаны из скоупа, материалы лежат в `archive/epics/`).

| Документ | О чём |
|---|---|
| [01-scope.md](01-scope.md) | границы проекта, принятые решения, приоритеты, этапы |
| [02-scenarios-and-permissions.md](02-scenarios-and-permissions.md) | роли словами, сценарии (указатель на страницы) |
| [04-task-card.md](04-task-card.md) | карточка задачи (Task, Bug, Subtask) |
| [05-create-task-dialog.md](05-create-task-dialog.md) | диалог создания задачи |
| [06-all-tasks-page.md](06-all-tasks-page.md) | страница «Все задачи» |
| [07-boards-page.md](07-boards-page.md) | доски (разработка, планирование) |
| [08-project-settings-page.md](08-project-settings-page.md) | настройки проекта |
| [09-members-page.md](09-members-page.md) | участники проекта |
| [10-account-and-admin.md](10-account-and-admin.md) | вход, приглашение, профиль, администрирование |
| [11-navigation-and-notifications.md](11-navigation-and-notifications.md) | верхняя панель, меню, уведомления |
| [12-ui-rules.md](12-ui-rules.md) | общие правила интерфейса |
| [15-backlog.md](15-backlog.md) | бэклог в Taiga: шаблон карточки, разбиение на задачи ≤ 6 ч, импорт, DoD |
| [13-data-model-and-permissions.md](13-data-model-and-permissions.md) | модель данных, ключи разрешений (§4), соответствие ключей ручкам (§5, генерируется из OpenAPI) |
| [backend/](backend/00-conventions.md) | ТЗ бэкенда: соглашения, пакеты 1–8, OpenAPI-контракт (`backend/openapi/openapi.yaml`); изменения контракта — [CHANGELOG](backend/openapi/CHANGELOG.md), версия — `info.version` |

Макеты лежат в `wireframes/` по страницам: `board`, `card`, `create-task`, `all-tasks`, `settings`, `members`, `account`, `admin`, `navigation`. Устаревшие макеты лежат в `archive/wireframes-old/`, не использовать. Макеты функций «после релиза» (редакторы статусов и досок) — в `archive/wireframes-after-release/`.

## Иерархия источников
У каждой темы один владелец; в остальных местах — ссылка. При расхождении прав владелец темы, остальное исправляется.

| Тема | Источник правды | Остальные места |
|---|---|---|
| Продукт и UX (экраны, состояния, тексты, сценарии страниц) | страницы [04–12](04-task-card.md) | 02 — только указатель сценариев |
| Роли и ключи прав | [13](13-data-model-and-permissions.md), §4 | в 02 и ТЗ — ссылка; таблицы «действие → ключ» на страницах — проекция, а не дубль |
| Логическая модель (сущности, связи, инварианты) | 13, §2–3 | поля и форматы — схемы OpenAPI; служебные поля и индексы — ТЗ |
| Контракт: пути, поля, коды ошибок, лимиты, `x-permission` | [OpenAPI](backend/openapi/openapi.yaml) | разделы «API» на страницах — только группы и важное для UX; 13 §5 генерируется из OpenAPI |
| Поведение бэкенда (алгоритмы, порядок проверок, эффекты) | пакеты ТЗ [b01–b08](backend/00-conventions.md) | в b00 — общие соглашения и сквозные сервисы |
| Сценарии | страницы 04–11 | 02 §4 — указатель |

При изменении контракта сверяются вручную: ключи в 13 §4 совпадают с enum `GlobalPermission` / `ProjectPermission`, таблица 13 §5 соответствует `x-permission` в OpenAPI, пути на страницах 04–11 есть в OpenAPI.

Часы, этапы и нагрузка по неделям — в [01-scope.md](01-scope.md); они складываются из разделов «Оценка трудозатрат фронта» страниц 04–11.

Словарь терминов — [12](12-ui-rules.md), раздел 1.

Журнал решений по спорным вопросам (метки Q-01…Q-45 в текстах) — [decisions.md](decisions.md).

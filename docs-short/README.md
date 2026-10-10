# Документация MVP

Укороченная версия учебного таск-менеджера (Angular 21 + Taiga UI + ngrx-signals): **доска задач и карточка задачи**. Полная версия продукта лежит в `docs/` и здесь не меняется — после MVP проект дорабатывается по ней. Что вырезано и почему — [01-scope.md](01-scope.md).

| Документ | О чём |
|---|---|
| [01-scope.md](01-scope.md) | границы MVP, что изменено против полной версии, роли, адреса |
| [02-plan.md](02-plan.md) | недели, контрольные точки, эпики и задачи для Taiga (≤ 6 ч), резерв |
| [03-ui-rules.md](03-ui-rules.md) | общие правила интерфейса, реакция на ошибки API, markdown |
| [04-board.md](04-board.md) | доска: колонки, drag&drop, причина, фильтры |
| [05-task-card.md](05-task-card.md) | карточка задачи: диалог и отдельная страница |
| [06-create-task-dialog.md](06-create-task-dialog.md) | диалог создания задачи |
| [07-account-and-shell.md](07-account-and-shell.md) | вход, приглашение, профиль, верхняя панель (каркас ментора) |
| [08-data-model-and-permissions.md](08-data-model-and-permissions.md) | модель данных, роли и ключи, ключ → ручки |
| [backend/AGENT.md](backend/AGENT.md) | инструкция для ИИ-агента разработчика бэкенда: что читать, правила, сроки |
| [backend/](backend/00-conventions.md) | ТЗ бэкенда: соглашения и пакеты 1–4; контракт — [backend/openapi/openapi.yaml](backend/openapi/openapi.yaml), отличия от полной версии — [CHANGELOG](backend/openapi/CHANGELOG.md) |

Макеты — `wireframes/` по экранам: `board` (доски и состояния), `card` (диалог, страница, вкладки, окна, состояния), `create-task`, `account` (вход, приглашение, профиль, служебные экраны), `navigation` (верхняя панель и переключатели). Макеты в стиле Taiga UI 5 без подписей компонентов; эмодзи обозначают иконки.

## Кто главнее при расхождении
| Тема | Источник правды |
|---|---|
| Экраны, состояния, тексты, сценарии | страницы [04–07](04-board.md) |
| Роли и ключи прав | [08](08-data-model-and-permissions.md), раздел 4 |
| Пути, поля, коды ошибок, лимиты | [OpenAPI](backend/openapi/openapi.yaml) |
| Поведение бэкенда | [backend/01–04](backend/00-conventions.md) |
| Часы и порядок работ | [02](02-plan.md) |

Проверка контракта: `npx @redocly/cli lint docs-short/backend/openapi/openapi.yaml` (допустимы только предупреждения `info-license` и `tag-description`).

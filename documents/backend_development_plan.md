# 震颤卫士后端开发计划（基于当前仓库现状）

## 1. 当前项目进度判断

截至 2026-04-05，对当前仓库的检查结果如下：

### 已完成

- 已有产品需求与系统架构文档：
  - `documents/震颤卫士PRD构建指南.md`
  - `documents/system_architecture.md`
- 已有一个可运行的前端原型项目：
  - `tremor-guard-frontend/`
- 前端原型可以正常构建，说明演示层基本可用。
- 前端已经表达了核心产品形态：
  - 健康看板
  - AI 助手
  - 历史记录占位
  - 复诊报告占位

### 尚未完成

- 仓库内还没有后端工程目录。
- 没有数据库模型、迁移脚本、环境变量模板。
- 没有 API 定义文档（OpenAPI / Swagger / Apifox 均未见）。
- 没有设备数据接入服务。
- 没有用户认证、权限、审计、日志系统。
- 没有 AI 服务编排层。
- 没有测试、部署、CI/CD、容器化配置。

### 当前阶段结论

项目目前处于：

`需求定义 + 架构设想 + 前端高保真原型`

还没有进入真正的“后端基础设施落地”阶段。

前端代码中暂未接入真实接口，主要使用本地 mock 数据和模拟 AI 回复，因此后端一期可以按“从 0 到 1 搭底座”的思路推进。

## 2. 后端建设目标

后端一期目标不是一次性做完整个医疗系统，而是先搭出一个稳定、可演进、便于联调的基础平台，支持以下最小闭环：

1. 用户登录与基础身份管理
2. 设备数据接收与存储
3. 震颤特征数据查询
4. 用药打卡记录
5. AI 问答接口占位与审计记录
6. 报告生成接口占位

## 3. 建议技术方案

结合你现在的项目阶段，我建议后端优先选择“开发效率高、结构清晰、便于前后端联调”的技术栈。

### 推荐方案

- 语言：TypeScript
- 运行时：Node.js 22 LTS
- 框架：NestJS
- API 风格：REST 为主，后续可扩展 WebSocket
- 数据库：
  - PostgreSQL：业务数据
  - TimescaleDB 或 PostgreSQL 普通分表：时序监测数据
- ORM：Prisma
- 缓存/队列：Redis
- 文档：Swagger / OpenAPI
- 鉴权：JWT + Refresh Token
- 校验：class-validator / zod 二选一
- 日志：Pino
- 测试：Vitest 或 Jest
- 容器化：Docker Compose

### 为什么不建议一期就做得太重

- 你们现在还没有稳定接口和数据模型，先上微服务会放大复杂度。
- AI、FFT、设备接入、业务 API 目前都还在探索期，更适合先用模块化单体。
- 等接口稳定后，再按边界拆分为：
  - `ingestion`
  - `analytics`
  - `ai-service`
  - `api-gateway`

## 4. 一期推荐系统边界

建议先做一个“模块化单体后端”，内部按领域拆模块：

- `auth`：登录、用户、角色
- `device`：设备注册、绑定、状态
- `ingestion`：设备数据上报
- `tremor`：震颤事件、特征查询、趋势分析
- `medication`：用药打卡
- `report`：报告任务、导出记录
- `ai`：AI 对话接口、提示词安全边界、审计日志
- `common`：日志、异常、配置、通用响应

## 5. 建议目录结构

```text
backend/
  src/
    main.ts
    app.module.ts
    common/
    config/
    modules/
      auth/
      users/
      devices/
      ingestion/
      tremor/
      medication/
      reports/
      ai/
      audit/
    prisma/
  test/
  prisma/
    schema.prisma
    migrations/
  docs/
  .env.example
  docker-compose.yml
  Dockerfile
```

## 6. 一期核心数据模型建议

先不要追求完整，优先围绕联调闭环设计。

### 用户与权限

- `User`
- `Role`
- `UserSession`

### 设备与绑定

- `Device`
- `DeviceBinding`
- `DeviceHeartbeat`

### 采集与分析

- `SensorRawBatch`
- `TremorFeature`
- `TremorEvent`

### 业务记录

- `MedicationRecord`
- `ReportTask`
- `AiConversation`
- `AiMessage`
- `AuditLog`

## 7. 一期 API 优先级

### P0：先满足前端联调

- `POST /auth/login`
- `GET /users/me`
- `GET /dashboard/summary`
- `GET /tremor/timeline`
- `GET /tremor/events`
- `POST /medication/check-in`
- `GET /medication/records`
- `POST /ai/chat`
- `GET /reports`

### P1：满足设备接入

- `POST /devices/register`
- `POST /devices/:id/bind`
- `POST /ingestion/raw-batches`
- `POST /devices/:id/heartbeat`

### P2：满足管理与审计

- `GET /audit/logs`
- `GET /devices`
- `GET /users`

## 8. 开发阶段计划

### Phase 0：后端基础搭建（1-2 天）

目标：把工程骨架搭起来。

- 初始化 `backend` 工程
- 配置 NestJS + TypeScript + ESLint + Prettier
- 接入 Prisma
- 配置 PostgreSQL 与 Redis
- 建立 `.env.example`
- 接入 Swagger
- 建立统一异常处理与日志
- 建立 Docker Compose 本地开发环境

交付物：

- 可启动的后端服务
- 健康检查接口 `GET /health`
- 数据库可连接

### Phase 1：账号与基础对象（2-3 天）

目标：先有用户、设备、权限基础能力。

- 用户表、设备表、绑定表建模
- JWT 登录鉴权
- `me` 接口
- 设备注册与绑定接口

交付物：

- 前端能完成登录态模拟
- 能建立“用户-设备”关系

### Phase 2：监测数据链路（3-5 天）

目标：打通“设备数据进来，前端能查出去”。

- 定义设备上报数据格式
- 实现原始批次写入
- 实现震颤特征表
- 实现看板摘要接口
- 实现时序趋势接口

交付物：

- 前端看板从 mock 切到真实 API
- 可查看日级震颤趋势

### Phase 3：业务功能闭环（3-4 天）

目标：把用药、AI、报告先做成可演示版本。

- 用药打卡接口
- AI 对话接口占位
- AI 会话与消息落库
- 审计日志记录
- 报告任务表与报告列表接口

交付物：

- 前端 AI 助手可调用真实后端
- 用药记录与趋势数据可以关联展示

### Phase 4：质量与部署（2-3 天）

目标：从“能跑”提升到“能协作开发”。

- 单元测试与集成测试基础
- seed 数据
- 开发/测试环境配置
- CI 基础检查
- 部署脚本或容器化说明

交付物：

- 新成员能按文档启动项目
- 基础接口有自动化校验

## 9. 建议里程碑

### M1：后端骨架完成

判定标准：

- 服务可启动
- 数据库连通
- Swagger 可访问
- 至少 1 个受保护接口可用

### M2：前后端首次联调完成

判定标准：

- 登录、看板摘要、趋势图、用药打卡可真实联调

### M3：设备数据接入闭环完成

判定标准：

- 设备可上报数据
- 后端可存储并生成基础特征
- 前端可展示真实监测结果

### M4：演示版完成

判定标准：

- AI 助手、报告列表、核心看板可演示
- 有基础审计与合规提示

## 10. 第一周建议执行清单

如果你准备现在开始搭后端，我建议第一周只做这些：

1. 新建 `backend/`，用 NestJS 初始化工程
2. 接入 PostgreSQL、Prisma、Swagger、Docker Compose
3. 完成 `User / Device / DeviceBinding / MedicationRecord / TremorFeature` 五张核心表
4. 做完 `auth`、`users/me`、`dashboard/summary`、`tremor/timeline`、`medication/check-in`
5. 给前端提供一份固定的联调数据结构
6. 补 `.env.example`、启动文档、初始化 SQL 或 Prisma migrate

这一周结束时，目标不是“功能很多”，而是：

`后端工程正式建立 + 前端能开始脱离 mock 数据`

## 11. 风险与注意事项

### 1. 不要过早上 AI 全能力

当前最容易失控的是 AI 模块。建议先把 AI 当作一个受控服务接口：

- 先做问答接口占位
- 先做审计日志
- 先做医疗免责声明
- 暂不做复杂 RAG 编排

### 2. 不要让原始时序数据和业务数据混在一起

原始监测数据量会迅速膨胀，建议从设计上把以下两类数据分清：

- 高频原始数据
- 聚合后的特征数据

前端大多数场景读的其实是“特征数据”，不是全量原始波形。

### 3. 先定义接口，再改前端

当前前端已经把核心页面形态做出来了，后端应先输出稳定的数据结构，再逐步替换 mock，避免前后端同时漂移。

### 4. 合规声明要前后端共同兜底

这是医疗辅助场景，不应只靠前端显示免责声明。后端在 AI 输出、报告导出、审计记录上也要保留合规边界。

## 12. 推荐的下一步动作

最适合马上开始的动作是：

1. 确定后端框架为 `NestJS + PostgreSQL + Prisma + Redis`
2. 在仓库下新建 `backend/`
3. 先完成工程初始化和数据库建模
4. 先做给前端看板联调用的 3-5 个核心接口

---

如果后续继续推进，建议下一份文档直接写：

- 数据库 ER 图
- API 接口清单
- 前后端联调字段协议
- 设备上报 JSON 格式规范

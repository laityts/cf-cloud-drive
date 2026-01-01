# CF Cloud Drive

基于 Cloudflare 生态构建的轻量级、无服务器云存储解决方案。利用 Cloudflare Workers、D1 数据库和 R2 对象存储，为您提供快速、安全且低成本的文件管理服务。

## ✨ 功能特性

- **📂 文件管理**：支持文件上传、下载、预览、删除及文件夹管理。
- **🌍 多语言支持**：内置 6 种语言支持（简体中文、繁体中文、英语、法语、德语、日语）。
- **⚡️ 无服务器架构**：完全运行在 Cloudflare Edge Network 上，全球低延迟访问。
- **🔐 安全认证**：内置管理员认证系统，支持初始化设置密码。
- **💾 低成本存储**：使用 Cloudflare R2 存储，无出口流量费；使用 D1 数据库，轻量高效。
- **🎨 现代化界面**：基于 Next.js 15、Tailwind CSS 和 Shadcn UI 构建的响应式界面。

## 🛠️ 技术栈

- **框架**: [Next.js 15](https://nextjs.org/) (App Router)
- **部署**: [Cloudflare Workers](https://workers.cloudflare.com/) (@opennextjs/cloudflare)
- **数据库**: [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite)
- **存储**: [Cloudflare R2](https://developers.cloudflare.com/r2/)
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/)
- **样式**: [Tailwind CSS](https://tailwindcss.com/)
- **国际化**: [next-intl](https://next-intl-docs.vercel.app/)

## 🚀 部署指南

本指南将指导您将项目部署到 Cloudflare Workers。

### 1. 准备工作

确保您已安装以下工具：
- [Node.js](https://nodejs.org/) (v18 或更高版本)
- [Git](https://git-scm.com/)

注册一个 [Cloudflare 账户](https://dash.cloudflare.com/sign-up)。

### 2. 获取代码

```bash
git clone https://github.com/your-username/cf-cloud-drive.git
cd cf-cloud-drive
npm install
```

### 3. 创建 Cloudflare 资源

登录 Wrangler CLI（如果尚未登录）：
```bash
npx wrangler login
```

#### 3.1 创建 D1 数据库
```bash
npx wrangler d1 create cf-cloud-drive-db
```
执行成功后，控制台会输出 `database_id`。请复制该 ID，并替换 `wrangler.toml` 文件中的 `database_id` 字段。

#### 3.2 创建 R2 存储桶
```bash
npx wrangler r2 bucket create cf-cloud-drive-bucket
```
如果您修改了存储桶名称，请同步修改 `wrangler.toml` 中的 `bucket_name`。

#### 3.3 创建 KV 命名空间 (可选)
```bash
npx wrangler kv:namespace create KV
```
复制输出的 `id`，替换 `wrangler.toml` 中的 `kv_namespaces` 下的 `id`。

### 4. 初始化数据库

将数据库表结构应用到远程 D1 数据库：
```bash
npx wrangler d1 execute cf-cloud-drive-db --file=./schema.sql --remote
```

### 5. 配置环境变量 (R2 访问凭证)

为了支持大文件上传和下载，项目需要使用 S3 兼容协议访问 R2。您需要创建一个 R2 API Token。

1. 访问 [Cloudflare Dashboard R2 页面](https://dash.cloudflare.com/?to=/:account/r2/api-tokens)。
2. 点击 **"Manage API Tokens"** -> **"Create API Token"**。
3. 权限选择：**Admin Read & Write**。
4. 创建后，您将获得 `Access Key ID`, `Secret Access Key` 和 `Account ID`。

使用 Wrangler 设置生产环境密钥：

```bash
npx wrangler secret put R2_ACCOUNT_ID
# 输入您的 Account ID

npx wrangler secret put R2_ACCESS_KEY_ID
# 输入您的 Access Key ID

npx wrangler secret put R2_SECRET_ACCESS_KEY
# 输入您的 Secret Access Key

npx wrangler secret put R2_BUCKET_NAME
# 输入您的存储桶名称 (例如 cf-cloud-drive-bucket)
```

### 6. 部署上线

执行以下命令构建并部署到 Cloudflare Workers：

```bash
npm run deploy
```

部署完成后，控制台会输出您的访问域名（例如 `https://cf-cloud-drive.your-subdomain.workers.dev`）。

### 7. 初始化系统

首次访问您的域名，系统会自动跳转到初始化页面（或 `/login`）。
由于是首次运行，您需要访问 `/api/auth/setup` (或者在界面上根据提示) 来设置管理员密码（如果系统设计了此功能）。
*注：请根据实际业务逻辑完善此步骤说明。*

## 📄 许可证

MIT License

# CF Cloud Drive

基于 Cloudflare 生态构建的轻量级、无服务器云存储解决方案。利用 Cloudflare Pages、D1 数据库和 R2 对象存储，为您提供快速、安全且低成本的文件管理服务。

## ✨ 功能特性

- **📂 文件管理**：支持文件上传、下载、预览、删除及文件夹管理。
- **🌍 多语言支持**：内置 6 种语言支持（简体中文、繁体中文、英语、法语、德语、日语）。
- **⚡️ 无服务器架构**：完全运行在 Cloudflare Edge Network 上，全球低延迟访问。
- **🔐 安全认证**：内置管理员认证系统，支持初始化设置密码。
- **💾 低成本存储**：使用 Cloudflare R2 存储，无出口流量费；使用 D1 数据库，轻量高效。
- **🎨 现代化界面**：基于 Next.js 15、Tailwind CSS 和 Shadcn UI 构建的响应式界面。

## 🛠️ 技术栈

- **框架**: [Next.js 15](https://nextjs.org/) (App Router)
- **部署**: [Cloudflare Pages](https://pages.cloudflare.com/) (@cloudflare/next-on-pages)
- **数据库**: [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite)
- **存储**: [Cloudflare R2](https://developers.cloudflare.com/r2/)
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/)
- **样式**: [Tailwind CSS](https://tailwindcss.com/)
- **国际化**: [next-intl](https://next-intl-docs.vercel.app/)


## 📄 许可证

MIT License

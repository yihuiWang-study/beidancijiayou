# 雅思考点词背诵

一个可部署到 Vercel 的静态背词网页，包含：

- 阅读 538 考点词
- 听力 179 考点词
- 会 / 不会 自测
- 错词本
- 本机浏览器进度保存

## Vercel 部署

1. 把本项目上传到 GitHub 仓库。
2. 用 GitHub 登录 Vercel。
3. 在 Vercel 点击 New Project，选择这个仓库。
4. 保持默认配置，确认 Build Command 为：

   ```bash
   node tools/build-static.js
   ```

5. Output Directory 为：

   ```bash
   dist
   ```

6. 点击 Deploy。

部署完成后，Vercel 会生成一个 `vercel.app` 网址。

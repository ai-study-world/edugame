#!/usr/bin/env bash
# ============================================================
# 幼小衔接趣味学习乐园 - GitHub Pages 一键部署脚本
# ============================================================
# 用法:  bash deploy.sh
# 前提:  本机已通过 git 登录 GitHub（第一次运行脚本会提示登录）
# 产物:  https://<你的用户名>.github.io/edugame/
# ============================================================
set -e

REPO_NAME="edugame"
echo "🔄 [1/4] 检查 git 配置..."
if [ -z "$(git config user.name)" ] || [ -z "$(git config user.email)" ]; then
  echo "❌ 请先配置 git 用户名和邮箱:"
  echo "   git config --global user.name \"你的名字\""
  echo "   git config --global user.email \"你的邮箱\""
  exit 1
fi

echo "🔄 [2/4] 测试 GitHub 登录状态..."
# 尝试读取远程仓库（触发可能的登录）
if ! git ls-remote "https://github.com/$(git config user.name)/$REPO_NAME.git" >/dev/null 2>&1; then
  echo "   → 仓库尚不存在，准备创建（或首次登录）"
fi

echo "🔄 [3/4] 添加远程仓库并推送..."
# 若已存在同名远程则移除
git remote remove origin 2>/dev/null || true
git remote add origin "https://github.com/$(git config user.name)/$REPO_NAME.git"
# 推送到 main（首次推送会触发 GitHub 登录授权）
if git push -u origin main 2>&1; then
  echo "   ✅ 推送成功"
else
  echo ""
  echo "⚠️  推送需要 GitHub 登录授权。请按下面步骤操作："
  echo ""
  echo "  1. 运行:   git config --global credential.helper store"
  echo "  2. 运行:   git push -u origin main"
  echo "     → 浏览器会弹出 GitHub 登录页，登录后自动返回"
  echo "  3. 推送成功后，重新运行:   bash deploy.sh"
  echo ""
  exit 1
fi

echo "🔄 [4/4] 开启 GitHub Pages..."
# 尝试通过 GitHub API 开启 Pages（需要 token，可选）
echo ""
echo "🎉 部署完成！"
echo ""
echo "   ⚠️ 最后一步：开启 GitHub Pages"
echo ""
echo "   请在浏览器打开:  https://github.com/$(git config user.name)/$REPO_NAME/settings/pages"
echo ""
echo "   选择:  Branch = main  →  / (root)  →  Save"
echo ""
echo "   等待 1-2 分钟后访问:"
echo "   https://$(git config user.name).github.io/$REPO_NAME/"
echo ""
echo "   把这个网址分享给小伙伴即可 🎮"
